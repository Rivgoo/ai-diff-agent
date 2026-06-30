import { Result } from '@/shared/contracts';
import type { ConflictDetails } from '@/shared/models';
import type { ITransactionContext } from '../core/ITransactionContext';
import { BaseCommand } from './BaseCommand';
import type { CreateFileOperation } from '@/core/models/operations';
import { PathNormalizer } from '@/core/workspace/pathNormalizer';
import { TextNormalizerV2 } from '@/core/matcher/heuristics/textNormalizerV2';

export class CreateFileCommand extends BaseCommand<CreateFileOperation> {
    private fileExistsOnDisk = false;

    public async validate(context: ITransactionContext): Promise<Result<void, ConflictDetails>> {
        this.normalizedPath = PathNormalizer.normalize(this.operation.path);
        this.targetPath = this.normalizedPath;

        this.fileExistsOnDisk = await context.fileExists(this.targetPath);
        
        if (this.fileExistsOnDisk) {
            const doc = await context.getDocument(this.targetPath);
            const docText = doc.getText();
            
            const normDoc = TextNormalizerV2.normalizeSearchBlock(docText);
            const normContent = TextNormalizerV2.normalizeSearchBlock(this.operation.content);

            if (normDoc === normContent) {
                context.logger.info(`[Idempotency] File ${this.targetPath} exists and is identical. Marked as already applied.`);
                this.metadata.alreadyApplied = true;
            }
        }

        return Result.ok(undefined);
    }

    public async prepareBackup(context: ITransactionContext): Promise<void> {
        if (this.metadata.alreadyApplied) return;
        await context.createBackup(this.operationId, this.targetPath);
    }

    public async apply(context: ITransactionContext): Promise<void> {
        if (this.metadata.alreadyApplied) return; // ІДЕМПОТЕНТНІСТЬ

        if (this.fileExistsOnDisk) {
            const document = await context.getDocument(this.targetPath);
            const fullRange = {
                start: { line: 0, character: 0 },
                end: document.positionAt(document.getText().length)
            };
            context.uow.replace(this.targetPath, fullRange, this.operation.content);
            this.antiActions.push({ type: 'restore_file', path: this.targetPath, relativePath: this.normalizedPath });
        } else {
            context.uow.createFile(this.targetPath, this.operation.content, { ignoreIfExists: true });
            this.antiActions.push({ type: 'delete_created', path: this.targetPath });
        }

        const lineCount = this.operation.content.split(/\r?\n/).length;
        context.uow.addAppliedRange(this.operationId, this.targetPath, {
            start: { line: 0, character: 0 },
            end: { line: lineCount, character: 999 }
        });
    }
}