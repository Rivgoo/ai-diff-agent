import * as vscode from 'vscode';
import { Result } from '@/shared/contracts';
import type { ConflictDetails } from '@/shared/models';
import type { ITransactionContext } from '../core/ITransactionContext';
import { BaseCommand } from './BaseCommand';
import type { DeletePathOperation } from '@/core/models/operations';
import { PathNormalizer } from '@/core/workspace/pathNormalizer';

export class DeletePathCommand extends BaseCommand<DeletePathOperation> {
    public async validate(context: ITransactionContext): Promise<Result<void, ConflictDetails>> {
        this.normalizedPath = PathNormalizer.normalize(this.operation.path);
        
        const resolution = await context.pathResolver.resolvePath(
            this.normalizedPath, 
            undefined, 
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
                detailedMessage: `Found multiple files matching this name. Cannot safely delete.`,
                code: 'AMBIGUOUS_FILE'
            }));
        }
        
        if (resolution.status === 'RESOLVED_RESILIENTLY') {
            this.metadata = { resolvedResiliently: true, originalPath: this.operation.path, path: resolution.resolvedPath };
            this.normalizedPath = PathNormalizer.normalize(resolution.resolvedPath);
        }
        
        this.targetPath = this.normalizedPath;

        const exists = await context.fileExists(this.targetPath);
        if (!exists) {
            context.logger.info(`[Idempotency] File ${this.targetPath} already deleted. Marked as applied.`);
            this.metadata.alreadyApplied = true;
            return Result.ok(undefined);
        }

        const uri = context.getAbsoluteUri(this.targetPath);
        const isOpenAndDirty = vscode.workspace.textDocuments.some(doc => doc.uri.toString() === uri.toString() && doc.isDirty);
        if (isOpenAndDirty) {
            return Result.fail(this.buildConflict('UNSAVED_CHANGES', undefined, 0, 0, 'N/A', {
                operationId: this.operationId,
                path: this.targetPath,
                severity: 'critical',
                title: 'Unsaved Changes',
                detailedMessage: `Cannot delete file with unsaved changes. Please save or close it first.`,
                code: 'UNSAVED_CHANGES'
            }));
        }

        this.metadata = { ...this.metadata, isDirectory: false }; 
        return Result.ok(undefined);
    }

    public async apply(context: ITransactionContext): Promise<void> {
        if (this.metadata.alreadyApplied) return; 
        context.uow.deleteFile(this.targetPath, { recursive: true, ignoreIfNotExists: true });
        this.antiActions.push({ type: 'restore_file', path: this.targetPath, relativePath: this.normalizedPath });
    }

    public async prepareBackup(context: ITransactionContext): Promise<void> {
        const exists = await context.fileExists(this.targetPath);
        if (exists) {
            await context.createBackup(this.operationId, this.targetPath);
        }
    }
}