import * as vscode from 'vscode';
import { Result } from '../../../shared/contracts';
import type { ConflictDetails } from '../../../shared/models';
import type { ITransactionContext } from '../core/ITransactionContext';
import { BaseCommand } from './BaseCommand';
import type { CreateFileOperation } from '../../../core/models/operations';
import { PathNormalizer } from '../../../core/workspace/pathNormalizer';
import { PathSandbox } from '../../../vscode/workspace/pathSandbox';

export class CreateFileCommand extends BaseCommand<CreateFileOperation> {
    private fileExistsOnDisk = false;

    public async validate(context: ITransactionContext): Promise<Result<void, ConflictDetails>> {
        this.normalizedPath = PathNormalizer.normalize(this.operation.path, context.rootName);
        
        try {
            this.targetUri = PathSandbox.validate(this.normalizedPath);
            try {
                await vscode.workspace.fs.stat(this.targetUri);
                this.fileExistsOnDisk = true;
            } catch {
                this.fileExistsOnDisk = false;
            }
            return Result.ok(undefined);
        } catch (e) {
            return Result.fail(this.buildConflict('PATH_TRAVERSAL'));
        }
    }

    public async prepareBackup(context: ITransactionContext): Promise<void> {
        if (this.fileExistsOnDisk) {
            await context.snapshotService.createSnapshot(
                context.workspaceRoot, 
                this.operationId, 
                this.normalizedPath, 
                this.targetUri
            );
        }
    }

    public async apply(context: ITransactionContext): Promise<void> {
        const parentDir = vscode.Uri.joinPath(this.targetUri, '..');
        const createdDirs = await context.ensureDirectoryExists(parentDir);
        
        for (const dir of createdDirs) {
            this.antiActions.push({ type: 'delete_dir_if_empty', uri: dir });
        }

        if (this.fileExistsOnDisk) {
            const document = await context.getDocument(this.targetUri);
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(document.getText().length)
            );
            context.uow.replace(this.targetUri, fullRange, this.operation.content);
            this.antiActions.push({ type: 'restore_file', uri: this.targetUri, relativePath: this.normalizedPath });
        } else {
            context.uow.createFile(this.targetUri, this.operation.content, { ignoreIfExists: true });
            this.antiActions.push({ type: 'delete_created', uri: this.targetUri });
        }

        const lineCount = this.operation.content.split(/\r?\n/).length;
        context.uow.addAppliedRange(this.operationId, this.targetUri, new vscode.Range(0, 0, lineCount, 999));
    }
}
