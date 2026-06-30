import { Result } from '@/shared/contracts';
import type { ConflictDetails } from '@/shared/models';
import type { ITransactionContext } from '../core/ITransactionContext';
import { BaseCommand } from './BaseCommand';
import type { DeletePathOperation } from '@/core/models/operations';
import { PathNormalizer } from '@/core/workspace/pathNormalizer';

export class DeletePathCommand extends BaseCommand<DeletePathOperation> {
    public async validate(context: ITransactionContext): Promise<Result<void, ConflictDetails>> {
        this.normalizedPath = PathNormalizer.normalize(this.operation.path);
        
        const resolution = await context.pathResolver.resolvePath(this.normalizedPath);
        if (resolution.status === 'AMBIGUOUS_MATCH') return Result.fail(this.buildConflict('AMBIGUOUS_MATCH', resolution.candidatePaths));
        
        if (resolution.status === 'RESOLVED_RESILIENTLY') {
            this.metadata = { resolvedResiliently: true, originalPath: this.operation.path, path: resolution.resolvedPath };
            this.normalizedPath = PathNormalizer.normalize(resolution.resolvedPath);
        }
        
        this.targetPath = this.normalizedPath;

        const exists = await context.fileExists(this.targetPath);
        if (!exists) {
            // ІДЕМПОТЕНТНІСТЬ: Якщо файлу вже немає, значить його вже видалили. Пропускаємо.
            context.logger.info(`[Idempotency] File ${this.targetPath} already deleted. Marked as applied.`);
            this.metadata.alreadyApplied = true;
            return Result.ok(undefined);
        }

        this.metadata = { ...this.metadata, isDirectory: false }; 
        return Result.ok(undefined);
    }

    public async apply(context: ITransactionContext): Promise<void> {
        if (this.metadata.alreadyApplied) return; // Блокуємо мутацію
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