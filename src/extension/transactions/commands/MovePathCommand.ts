import * as vscode from 'vscode';
import { Result } from '../../../shared/contracts';
import type { ConflictDetails } from '../../../shared/models';
import type { ITransactionContext } from '../core/ITransactionContext';
import { BaseCommand } from './BaseCommand';
import type { MovePathOperation } from '../../../core/models/operations';
import { PathNormalizer } from '../../../core/workspace/pathNormalizer';
import { PathSandbox } from '../../../vscode/workspace/pathSandbox';

export class MovePathCommand extends BaseCommand<MovePathOperation> {
    private destUri!: vscode.Uri;
    private normalizedDestPath!: string;

    public async validate(context: ITransactionContext): Promise<Result<void, ConflictDetails>> {
        this.normalizedPath = PathNormalizer.normalize(this.operation.path, context.rootName);
        this.normalizedDestPath = PathNormalizer.normalize(this.operation.destinationPath, context.rootName);
        
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
            this.destUri = PathSandbox.validate(this.normalizedDestPath);

            try {
                await vscode.workspace.fs.stat(this.targetUri);
            } catch {
                return Result.fail(this.buildConflict('FILE_NOT_FOUND'));
            }

            // Path Chaining Resolution: Register alias so immediate next updates know the physical destination
            context.setResolvedUri(this.normalizedPath, this.destUri);

            return Result.ok(undefined);
        } catch (e) {
            return Result.fail(this.buildConflict('PATH_TRAVERSAL'));
        }
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
        const parentDir = vscode.Uri.joinPath(this.destUri, '..');
        const createdDirs = await context.ensureDirectoryExists(parentDir);
        
        for (const dir of createdDirs) {
            this.antiActions.push({ type: 'delete_dir_if_empty', uri: dir });
        }

        context.uow.renameFile(this.targetUri, this.destUri, { overwrite: true });
        this.antiActions.push({
            type: 'restore_move',
            sourceUri: this.targetUri,
            destinationUri: this.destUri,
            relativeSourcePath: this.normalizedPath
        });
    }
}
