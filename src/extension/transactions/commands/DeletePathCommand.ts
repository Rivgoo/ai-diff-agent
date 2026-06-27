import * as vscode from 'vscode';
import { Result } from '../../../shared/contracts';
import type { ConflictDetails } from '../../../shared/models';
import type { ITransactionContext } from '../core/ITransactionContext';
import { BaseCommand } from './BaseCommand';
import type { DeletePathOperation } from '../../../core/models/operations';
import { PathNormalizer } from '../../../core/workspace/pathNormalizer';
import { PathSandbox } from '../../../vscode/workspace/pathSandbox';

export class DeletePathCommand extends BaseCommand<DeletePathOperation> {
    public async validate(context: ITransactionContext): Promise<Result<void, ConflictDetails>> {
        this.normalizedPath = PathNormalizer.normalize(this.operation.path, context.rootName);
        
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
            
            this.targetUri = PathSandbox.validate(this.normalizedPath);
            return Result.ok(undefined);
        } catch (e) {
            return Result.fail(this.buildConflict('PATH_TRAVERSAL'));
        }
    }

    public async prepareBackup(context: ITransactionContext): Promise<void> {
        try {
            await vscode.workspace.fs.stat(this.targetUri);
            await context.snapshotService.createSnapshot(
                context.workspaceRoot, 
                this.operationId, 
                this.normalizedPath, 
                this.targetUri
            );
        } catch {
            // Ignore if already deleted
        }
    }

    public async apply(context: ITransactionContext): Promise<void> {
        context.uow.deleteFile(this.targetUri, { recursive: true, ignoreIfNotExists: true });
        this.antiActions.push({ type: 'restore_file', uri: this.targetUri, relativePath: this.normalizedPath });
    }
}
