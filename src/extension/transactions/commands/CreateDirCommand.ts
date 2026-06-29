import { Result } from '../../../shared/contracts';
import type { ConflictDetails } from '../../../shared/models';
import type { ITransactionContext } from '../core/ITransactionContext';
import { BaseCommand } from './BaseCommand';
import type { CreateDirOperation } from '../../../core/models/operations';
import { PathNormalizer } from '../../../core/workspace/pathNormalizer';
import { PathSandbox } from '../../../vscode/workspace/pathSandbox';

export class CreateDirCommand extends BaseCommand<CreateDirOperation> {
    public async validate(_context: ITransactionContext): Promise<Result<void, ConflictDetails>> {
        this.normalizedPath = PathNormalizer.normalize(this.operation.path);
        try {
            this.targetUri = PathSandbox.validate(this.normalizedPath);
            return Result.ok(undefined);
        } catch (e) {
            return Result.fail(this.buildConflict('PATH_TRAVERSAL'));
        }
    }

    public async prepareBackup(_context: ITransactionContext): Promise<void> {
        // No backup required for directory scaffolding
    }

    public async apply(context: ITransactionContext): Promise<void> {
        const createdDirs = await context.ensureDirectoryExists(this.targetUri);
        for (const dir of createdDirs) {
            this.antiActions.push({ type: 'delete_dir_if_empty', uri: dir });
        }
    }
}
