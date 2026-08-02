import { Result, type Range, type CoreDiagnostic } from '@/shared/contracts';
import type { ConflictDetails } from '@/shared/models';
import type { ITransactionContext } from '../core/ITransactionContext';
import { BaseCommand } from './BaseCommand';
import type { UpdateFileOperation } from '@/core/models/operations';
import { PathNormalizer } from '@/core/workspace/pathNormalizer';
import { TextNormalizerV2 } from '@/core/matcher/heuristics/textNormalizerV2';
import * as vscode from 'vscode';

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
                { 
                    respectGitIgnore: context.settingsManager.getSettings().engine.respectGitIgnore,
                    maxGlobalSearchCandidates: context.settingsManager.getSettings().engine.maxGlobalSearchCandidates
                }
            );
            
            if (resolution.status === 'AMBIGUOUS_MATCH') {
                return Result.fail(this.buildConflict('AMBIGUOUS_MATCH', resolution.candidatePaths, 0, 0, 'N/A', {
                    operationId: this.operationId,
                    path: this.operation.path,
                    severity: 'warning',
                    title: 'Ambiguous File Target',
                    detailedMessage: `Found multiple files matching this name. Cannot safely determine the target.`,
                    code: 'AMBIGUOUS_FILE'
                }));
            }
            if (resolution.status === 'NOT_FOUND') {
                return Result.fail(this.buildConflict('FILE_NOT_FOUND', undefined, 0, 0, 'N/A', {
                    operationId: this.operationId,
                    path: this.operation.path,
                    severity: 'warning',
                    title: 'File Not Found',
                    detailedMessage: `Target file does not exist on disk and could not be resolved.`,
                    code: 'FILE_NOT_FOUND'
                }));
            }
            
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
        if (!exists) {
            return Result.fail(this.buildConflict('FILE_NOT_FOUND', undefined, 0, 0, 'N/A', {
                operationId: this.operationId,
                path: this.targetPath,
                severity: 'warning',
                title: 'File Not Found',
                detailedMessage: `Target file does not exist on disk.`,
                code: 'FILE_NOT_FOUND'
            }));
        }

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
                
                // ФІКС: Створюємо CoreDiagnostic для відправки в панель Problems
                const diagnosticObj: CoreDiagnostic = match.diagnostic || {
                    operationId: this.operationId,
                    path: this.targetPath,
                    severity: 'warning',
                    title: reason === 'NOT_FOUND' ? 'Pattern Not Found' : 'Ambiguous Pattern',
                    detailedMessage: reason === 'NOT_FOUND' 
                        ? `Could not find the target code block in the file (Block ${i + 1}/${this.operation.changes.length}). The context may have changed.` 
                        : `The target code block matches multiple places in the file (Block ${i + 1}/${this.operation.changes.length}). Cannot safely replace.`,
                    code: reason
                };

                return Result.fail(this.buildConflict(reason as any, undefined, i + 1, this.operation.changes.length, excerpt, diagnosticObj));
            }

            if (astSettings.blastRadiusAnalysis && match.strategy === 'SEMANTIC_AST_MATCH') {
                try {
                    const targetUri = context.getAbsoluteUri(this.targetPath);
                    const refs = await vscode.commands.executeCommand<vscode.Location[]>(
                        'vscode.executeReferenceProvider',
                        targetUri,
                        new vscode.Position(match.range.start.line, match.range.start.character)
                    );
                    
                    if (refs && refs.length > 0) {
                        const uniqueFiles = new Set(refs.map(r => r.uri.fsPath));
                        uniqueFiles.delete(targetUri.fsPath);
                        
                        if (uniqueFiles.size > 0) {
                            this.metadata.blastRadiusWarning = `⚠️ Blast Radius: Modifying this entity may affect ${uniqueFiles.size} other file(s).`;
                            context.logger.warn(`[Blast Radius] Entity in ${this.targetPath} is referenced in ${uniqueFiles.size} external files.`);
                        }
                    }
                } catch (e) {
                    context.logger.info(`[Blast Radius] Provider not available or failed: ${e}`);
                }
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

        for (const match of this.matchedBlocks) {
            const contentToInsert = match.replace;
            const lineDelta = match.replace.split(/\r?\n/).length;

            context.uow.replace(this.targetPath, match.range, contentToInsert);
            
            const originalChange = this.operation.changes.find(c => 
                TextNormalizerV2.aggressiveNormalizeSearchBlock(c.replace) === TextNormalizerV2.aggressiveNormalizeSearchBlock(match.replace)
            );

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