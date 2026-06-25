import * as vscode from 'vscode';
import { OutputLogger } from '../../infrastructure/logging/outputLogger';

/**
 * Handles safe file deletion via moving targets to a temporary VS Code trash boundary.
 */
export class TrashService {
    private readonly trashFolderName = '.vscode/.ai-diff-trash';

    public async moveToTrash(originalUri: vscode.Uri, workspaceRoot: vscode.Uri): Promise<vscode.Uri> {
        const trashDir = vscode.Uri.joinPath(workspaceRoot, this.trashFolderName);
        await vscode.workspace.fs.createDirectory(trashDir);
        
        const timestamp = Date.now().toString();
        const safeName = `${timestamp}_${originalUri.path.split('/').pop()}`;
        const targetUri = vscode.Uri.joinPath(trashDir, safeName);

        const edit = new vscode.WorkspaceEdit();
        edit.renameFile(originalUri, targetUri, { overwrite: true });
        await vscode.workspace.applyEdit(edit);

        OutputLogger.log(`Moved to trash: ${originalUri.fsPath} -> ${targetUri.fsPath}`);
        return targetUri;
    }

    public async emptyTrash(workspaceRoot: vscode.Uri): Promise<void> {
        const trashDir = vscode.Uri.joinPath(workspaceRoot, this.trashFolderName);
        try {
            await vscode.workspace.fs.delete(trashDir, { recursive: true, useTrash: false });
            OutputLogger.log(`Trash emptied.`);
        } catch {
            // Ignore if missing
        }
    }
}
