import { Result } from '@/shared/contracts';
import type { ConflictDetails } from '@/shared/models';
import type { ITransactionContext } from '../core/ITransactionContext';
import { BaseCommand } from './BaseCommand';
import type { CreateDirOperation } from '@/core/models/operations';
import { PathNormalizer } from '@/core/workspace/pathNormalizer';

export class CreateDirCommand extends BaseCommand<CreateDirOperation> {
    public async validate(_context: ITransactionContext): Promise<Result<void, ConflictDetails>> {
        this.normalizedPath = PathNormalizer.normalize(this.operation.path);
        this.targetPath = this.normalizedPath;
        return Result.ok(undefined);
    }

    public async prepareBackup(_context: ITransactionContext): Promise<void> {
        // No backup required for directory scaffolding
    }

    public async apply(context: ITransactionContext): Promise<void> {
        const createdDirs = await context.ensureDirectoryExists(this.targetPath);
        for (const dir of createdDirs) {
            this.antiActions.push({ type: 'delete_dir_if_empty', path: dir });
        }
    }
}