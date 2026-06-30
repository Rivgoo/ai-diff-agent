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
}

export class UpdateFileCommand extends BaseCommand<UpdateFileOperation> {
    private matchedBlocks: MatchedBlock[] = [];

    public async validate(context: ITransactionContext): Promise<Result<void, ConflictDetails>> {
        this.normalizedPath = PathNormalizer.normalize(this.operation.path);
        
        let currentPath = context.getResolvedPath(this.normalizedPath);

        if (!currentPath) {
            const firstSearchBlock = this.operation.changes.length > 0 ? this.operation.changes[0].search : undefined;
            const resolution = await context.pathResolver.resolvePath(this.normalizedPath, firstSearchBlock);
            
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

        // ДИНАМІЧНО: Беремо актуальне значення з налаштувань
        const isAstEnabled = context.settingsManager.getSettings().engine.enableAstMatching;
        
        for (let i = 0; i < this.operation.changes.length; i++) {
            const change = this.operation.changes[i];
            
            const match = await context.searchEngine.findMatch(document, change.search, change.replace, isAstEnabled, context.logger);

            if (match.status !== 'MATCHED') {
                const normDoc = TextNormalizerV2.normalizeSearchBlock(docText);
                const normReplace = TextNormalizerV2.normalizeSearchBlock(change.replace);
                
                if (normReplace.length > 0 && normDoc.includes(normReplace)) {
                    context.logger.info(`[Idempotency] Block ${i + 1} already exists in ${this.targetPath}. Skipping.`);
                    continue; 
                }

                const reason = match.reason === 'AMBIGUOUS_MATCH' ? 'AMBIGUOUS_MATCH' : 
                               match.reason === 'SYNTAX_CORRUPTION_PREVENTED' ? 'SYNTAX_CORRUPTION_PREVENTED' : 'NOT_FOUND';
                
                const excerpt = change.search.split(/\r?\n/).slice(0, 3).join('\n');
                return Result.fail(this.buildConflict(reason as any, undefined, i + 1, this.operation.changes.length, excerpt, match.semanticDiagnostic));
            }

            allBlocksAlreadyApplied = false;
            this.metadata.matchStrategy = match.strategy;

            let finalReplace = match.cleanReplaceBlock !== undefined ? match.cleanReplaceBlock : change.replace;
            
            if (match.hoistedImports && match.hoistedImports.length > 0) {
                 finalReplace = match.hoistedImports.join('\n') + '\n' + finalReplace;
            }

            this.matchedBlocks.push({
                range: match.range,
                replace: finalReplace
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

        for (const match of this.matchedBlocks) {
            context.uow.replace(this.targetPath, match.range, match.replace);
            const lineDelta = match.replace.split(/\r?\n/).length;
            context.uow.addAppliedRange(this.operationId, this.targetPath, {
                start: { line: match.range.start.line, character: 0 },
                end: { line: match.range.start.line + lineDelta - 1, character: 999 }
            });
        }

        this.antiActions.push({ type: 'restore_file', path: this.targetPath, relativePath: this.normalizedPath });
    }
}