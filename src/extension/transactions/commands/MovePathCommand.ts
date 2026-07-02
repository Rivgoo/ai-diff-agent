import { Result } from '@/shared/contracts';
import type { ConflictDetails } from '@/shared/models';
import type { ITransactionContext } from '../core/ITransactionContext';
import { BaseCommand } from './BaseCommand';
import type { MovePathOperation } from '@/core/models/operations';
import { PathNormalizer } from '@/core/workspace/pathNormalizer';

export class MovePathCommand extends BaseCommand<MovePathOperation> {
    private destPath!: string;
    private normalizedDestPath!: string;

    public async validate(context: ITransactionContext): Promise<Result<void, ConflictDetails>> {
        this.normalizedPath = PathNormalizer.normalize(this.operation.path);
        this.normalizedDestPath = PathNormalizer.normalize(this.operation.destinationPath);
        
        const resolution = await context.pathResolver.resolvePath(
                this.normalizedPath, 
                undefined, 
                { respectGitIgnore: context.settingsManager.getSettings().engine.respectGitIgnore }
            );
        if (resolution.status === 'AMBIGUOUS_MATCH') return Result.fail(this.buildConflict('AMBIGUOUS_MATCH', resolution.candidatePaths));
        
        if (resolution.status === 'RESOLVED_RESILIENTLY') {
            this.metadata = { resolvedResiliently: true, originalPath: this.operation.path, path: resolution.resolvedPath };
            this.normalizedPath = PathNormalizer.normalize(resolution.resolvedPath);
        }
        
        this.targetPath = this.normalizedPath;
        this.destPath = this.normalizedDestPath;

        const sourceExists = await context.fileExists(this.targetPath);
        if (!sourceExists) {
            const destExists = await context.fileExists(this.destPath);
            if (destExists) {
                // ІДЕМПОТЕНТНІСТЬ: Файл вже на новому місці.
                context.logger.info(`[Idempotency] File already moved to ${this.destPath}. Marked as applied.`);
                this.metadata.alreadyApplied = true;
                context.setResolvedPath(this.normalizedPath, this.destPath);
                return Result.ok(undefined);
            }
            return Result.fail(this.buildConflict('FILE_NOT_FOUND'));
        }

        context.setResolvedPath(this.normalizedPath, this.destPath);
        return Result.ok(undefined);
    }

    public async apply(context: ITransactionContext): Promise<void> {
        if (this.metadata.alreadyApplied) return; // Блокуємо мутацію
        context.uow.renameFile(this.targetPath, this.destPath, { overwrite: true });
        this.antiActions.push({ type: 'restore_move', sourcePath: this.targetPath, destinationPath: this.destPath, relativeSourcePath: this.normalizedPath });
    }

    public async prepareBackup(context: ITransactionContext): Promise<void> {
        await context.createBackup(this.operationId, this.targetPath);
    }
}