import * as vscode from 'vscode';
import { Result } from '../../../shared/contracts';
import type { ConflictDetails } from '../../../shared/models';
import type { ITransactionContext } from '../core/ITransactionContext';
import { BaseCommand } from './BaseCommand';
import type { UpdateFileOperation } from '../../../core/models/operations';
import { PathNormalizer } from '../../../core/workspace/pathNormalizer';
import { PathSandbox } from '../../../vscode/workspace/pathSandbox';
import { VsCodeDocument } from '../../../infrastructure/adapters/vsCodeDocument';

interface MatchedBlock {
    range: vscode.Range;
    replace: string;
}

export class UpdateFileCommand extends BaseCommand<UpdateFileOperation> {
    private matchedBlocks: MatchedBlock[] = [];

    public async validate(context: ITransactionContext): Promise<Result<void, ConflictDetails>> {
        this.normalizedPath = PathNormalizer.normalize(this.operation.path, context.rootName);
        
        let currentUri = context.getResolvedUri(this.normalizedPath);

        if (!currentUri) {
            try {
                const resolution = await context.pathResolver.resolvePath(this.normalizedPath);
                if (resolution.status === 'AMBIGUOUS_MATCH') {
                    return Result.fail(this.buildConflict('AMBIGUOUS_MATCH', resolution.candidatePaths));
                }
                if (resolution.status === 'NOT_FOUND') {
                    return Result.fail(this.buildConflict('FILE_NOT_FOUND'));
                }
                
                if (resolution.status === 'RESOLVED_RESILIENTLY') {
                    this.metadata = {
                        resolvedResiliently: true,
                        originalPath: this.operation.path,
                        path: resolution.resolvedPath
                    };
                    this.normalizedPath = PathNormalizer.normalize(resolution.resolvedPath, context.rootName);
                }
                currentUri = PathSandbox.validate(this.normalizedPath);
            } catch (e) {
                return Result.fail(this.buildConflict('PATH_TRAVERSAL'));
            }
        }

        this.targetUri = currentUri;

        let document: vscode.TextDocument;
        try {
            document = await context.getDocument(this.targetUri);
        } catch (e) {
            return Result.fail(this.buildConflict('FILE_NOT_FOUND'));
        }

        const domainDoc = new VsCodeDocument(document);

        for (let i = 0; i < this.operation.changes.length; i++) {
            const change = this.operation.changes[i];
            const match = context.searchEngine.findMatch(domainDoc, change.search);

            if (match.status !== 'MATCHED') {
                const reason = match.reason === 'AMBIGUOUS_MATCH' ? 'AMBIGUOUS_MATCH' : 'NOT_FOUND';
                const excerpt = change.search.split(/\r?\n/).slice(0, 3).join('\n');
                return Result.fail(this.buildConflict(reason, undefined, i + 1, this.operation.changes.length, excerpt));
            }

            this.matchedBlocks.push({
                range: new vscode.Range(
                    match.range.start.line, match.range.start.character,
                    match.range.end.line, match.range.end.character
                ),
                replace: change.replace
            });
        }

        return Result.ok(undefined);
    }

    public async prepareBackup(context: ITransactionContext): Promise<void> {
        await context.snapshotService.createSnapshot(
            context.workspaceRoot, 
            this.operationId, 
            this.normalizedPath, 
            this.targetUri
        );
    }

    public async apply(context: ITransactionContext): Promise<void> {
        this.matchedBlocks.sort((a, b) => b.range.start.compareTo(a.range.start));

        for (const match of this.matchedBlocks) {
            context.uow.replace(this.targetUri, match.range, match.replace);
            const lineDelta = match.replace.split(/\r?\n/).length;
            context.uow.addAppliedRange(this.operationId, this.targetUri, new vscode.Range(
                match.range.start.line, 0,
                match.range.start.line + lineDelta - 1, 999
            ));
        }

        this.antiActions.push({ type: 'restore_file', uri: this.targetUri, relativePath: this.normalizedPath });
    }
}
