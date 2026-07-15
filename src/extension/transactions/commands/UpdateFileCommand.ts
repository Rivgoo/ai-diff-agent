import { Result, type Range } from '@/shared/contracts';
import type { ConflictDetails } from '@/shared/models';
import type { ITransactionContext } from '../core/ITransactionContext';
import { BaseCommand } from './BaseCommand';
import type { UpdateFileOperation } from '@/core/models/operations';
import { PathNormalizer } from '@/core/workspace/pathNormalizer';
import { TextNormalizerV2 } from '@/core/matcher/heuristics/textNormalizerV2';

interface MatchedBlock {
    range: Range;
    replace: string;
    requiresMerge: boolean;
}

export class UpdateFileCommand extends BaseCommand<UpdateFileOperation> {
    private matchedBlocks: MatchedBlock[] = [];

    public async validate(context: ITransactionContext): Promise<Result<void, ConflictDetails>> {
        this.normalizedPath = PathNormalizer.normalize(this.operation.path);
        
        let currentPath = context.getResolvedPath(this.normalizedPath);

        if (!currentPath) {
            const firstSearchBlock = this.operation.changes.length > 0 ? this.operation.changes[0].search : undefined;
            const resolution = await context.pathResolver.resolvePath(
                this.normalizedPath, 
                firstSearchBlock, 
                { respectGitIgnore: context.settingsManager.getSettings().engine.respectGitIgnore }
            );
            
            if (resolution.status === 'AMBIGUOUS_MATCH') return Result.fail(this.buildConflict('AMBIGUOUS_MATCH', resolution.candidatePaths));
            if (resolution.status === 'NOT_FOUND') return Result.fail(this.buildConflict('FILE_NOT_FOUND'));
            
            if (resolution.status === 'RESOLVED_RESILIENTLY') {
                this.metadata = {
                    resolvedResiliently: true,
                    originalPath: this.operation.path,
                    path: resolution.resolvedPath
                };
                this.normalizedPath = PathNormalizer.normalize(resolution.resolvedPath);
            }
            currentPath = this.normalizedPath;
        }

        this.targetPath = currentPath;

        const exists = await context.fileExists(this.targetPath);
        if (!exists) return Result.fail(this.buildConflict('FILE_NOT_FOUND'));

        const document = await context.getDocument(this.targetPath);
        const docText = document.getText();
        
        let allBlocksAlreadyApplied = true;
        
        for (let i = 0; i < this.operation.changes.length; i++) {
            const change = this.operation.changes[i];
            
            const normDoc = TextNormalizerV2.aggressiveNormalizeSearchBlock(docText);
            const normReplace = TextNormalizerV2.aggressiveNormalizeSearchBlock(change.replace);
            
            if (normReplace.length > 15 && normDoc.includes(normReplace)) {
                context.logger.info(`[Idempotency] Block ${i + 1} already exists in ${this.targetPath}. Skipping.`);
                continue; 
            }

            const engineSettings = context.settingsManager.getSettings().engine;
            const astSettings = context.settingsManager.getSettings().ast;
            
            const match = await context.searchEngine.findMatch(
                document, 
                change.search, 
                change.replace, 
                engineSettings, 
                astSettings,
                context.logger
            );

            if (match.status !== 'MATCHED') {
                const reason = match.reason === 'AMBIGUOUS_MATCH' ? 'AMBIGUOUS_MATCH' : 
                               match.reason === 'SYNTAX_CORRUPTION_PREVENTED' ? 'SYNTAX_CORRUPTION_PREVENTED' : 'NOT_FOUND';
                
                const excerpt = change.search.split(/\r?\n/).slice(0, 3).join('\n');
                return Result.fail(this.buildConflict(reason as any, undefined, i + 1, this.operation.changes.length, excerpt, match.semanticDiagnostic));
            }

            allBlocksAlreadyApplied = false;
            this.metadata.matchStrategy = match.strategy;
            (this.metadata as any).confidenceScore = match.confidenceScore;

            let finalReplace = match.cleanReplaceBlock !== undefined ? match.cleanReplaceBlock : change.replace;
            
            if (match.hoistedImports && match.hoistedImports.length > 0) {
                 finalReplace = match.hoistedImports.join('\n') + '\n' + finalReplace;
            }

            let requiresMerge = false;
            if (match.strategy !== 'EXACT_MATCH') {
                const currentFileText = this.extractFullLines(docText, match.range.start.line, match.range.end.line);
                const normCurrent = TextNormalizerV2.aggressiveNormalizeSearchBlock(currentFileText);
                const normAI = TextNormalizerV2.aggressiveNormalizeSearchBlock(change.search);
                
                if (normCurrent !== normAI) {
                    requiresMerge = true;
                    this.metadata.requiresAutoMerge = true;
                }
            }

            this.matchedBlocks.push({
                range: match.range,
                replace: finalReplace,
                requiresMerge
            });
        }

        if (allBlocksAlreadyApplied && this.operation.changes.length > 0) {
            this.metadata.alreadyApplied = true;
        }

        return Result.ok(undefined);
    }

    public async prepareBackup(context: ITransactionContext): Promise<void> {
        if (this.metadata.alreadyApplied) return;
        await context.createBackup(this.operationId, this.targetPath);
    }

    public async apply(context: ITransactionContext): Promise<void> {
        if (this.metadata.alreadyApplied) return; 

        this.matchedBlocks.sort((a, b) => b.range.start.line - a.range.start.line);

        const document = await context.getDocument(this.targetPath);
        const docText = document.getText();

        for (const match of this.matchedBlocks) {
            let contentToInsert = match.replace;
            let lineDelta = match.replace.split(/\r?\n/).length;


            if (match.requiresMerge) {
                const currentText = this.extractFullLines(docText, match.range.start.line, match.range.end.line);
                contentToInsert = `<<<<<<< CURRENT (Your Changes)\n${currentText}\n=======\n${match.replace}\n>>>>>>> INCOMING (AI Changes)`;
                lineDelta = contentToInsert.split(/\r?\n/).length;
                context.logger.warn(`[Semantic Merge] Inserted merge markers for block in ${this.targetPath}`);
            }

            context.uow.replace(this.targetPath, match.range, contentToInsert);
            
            const originalChange = this.operation.changes.find(c => TextNormalizerV2.aggressiveNormalizeSearchBlock(c.replace) === TextNormalizerV2.aggressiveNormalizeSearchBlock(match.replace));

            context.uow.addAppliedBlock(this.operationId, this.targetPath, {
                range: {
                    start: { line: match.range.start.line, character: 0 },
                    end: { line: match.range.start.line + lineDelta - 1, character: 999 }
                },
                originalSearch: originalChange ? originalChange.search : ''
            });
        }

        this.antiActions.push({ type: 'restore_file', path: this.targetPath, relativePath: this.normalizedPath });
    }

    private extractFullLines(text: string, startLine: number, endLine: number): string {
        const lines = text.split(/\r?\n/); 
        const targetLines = lines.slice(startLine, endLine + 1);
        return targetLines.join('\n');
    }
}