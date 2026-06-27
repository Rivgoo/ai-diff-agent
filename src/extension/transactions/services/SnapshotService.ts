import * as vscode from 'vscode';
import { OutputLogger } from '@/infrastructure/logging/outputLogger';
import { SYSTEM_CONSTANTS } from '@/shared/constants';
import { LiveDocumentRegistry } from './LiveDocumentRegistry';

export class SnapshotService {
    private readonly liveRegistry = new LiveDocumentRegistry();
    private readonly backupFolder = SYSTEM_CONSTANTS.BACKUP_FOLDER_NAME;

    public getBackupUri(workspaceRoot: vscode.Uri, opId: string, relativePath: string): vscode.Uri {
        const safeName = encodeURIComponent(relativePath).replace(/%/g, '_');
        return vscode.Uri.joinPath(workspaceRoot, this.backupFolder, opId, safeName);
    }

    public async createSnapshot(workspaceRoot: vscode.Uri, opId: string, relativePath: string, fileUri: vscode.Uri): Promise<void> {
        const backupUri = this.getBackupUri(workspaceRoot, opId, relativePath);
        
        try {
            await vscode.workspace.fs.createDirectory(
                vscode.Uri.joinPath(workspaceRoot, SYSTEM_CONSTANTS.BACKUP_FOLDER_NAME, opId)
            );

            const docMetadata = await this.liveRegistry.getDocumentState(fileUri);
            const contentBytes = new TextEncoder().encode(docMetadata.liveContent);
            
            await vscode.workspace.fs.writeFile(backupUri, contentBytes);
            OutputLogger.log(`Captured file snapshot (live state): ${relativePath} -> ${backupUri.fsPath}`);
        } catch (e) {
            OutputLogger.log(`Failed to create file backup snapshot for ${relativePath}: ${e}`, 'ERROR');
        }
    }

    public async restoreSnapshot(workspaceRoot: vscode.Uri, opId: string, relativePath: string, targetUri: vscode.Uri): Promise<void> {
        const backupUri = this.getBackupUri(workspaceRoot, opId, relativePath);
        
        try {
            await vscode.workspace.fs.copy(backupUri, targetUri, { overwrite: true });
            OutputLogger.log(`Restored original file state from snapshot: ${backupUri.fsPath} -> ${targetUri.fsPath}`);
        } catch (e) {
            OutputLogger.log(`Failed to restore backup snapshot for ${relativePath}: ${e}`, 'ERROR');
        }
    }

    public async purgeSnapshotForOp(workspaceRoot: vscode.Uri, opId: string): Promise<void> {
        const backupDir = vscode.Uri.joinPath(workspaceRoot, SYSTEM_CONSTANTS.BACKUP_FOLDER_NAME, opId);
        try {
            await vscode.workspace.fs.delete(backupDir, { recursive: true, useTrash: false });
            OutputLogger.log(`Flushed file snapshots for operation: ${opId}`);
        } catch {
            // Safe ignore
        }
    }

    public async cleanStaleBackups(_workspaceRoot: vscode.Uri): Promise<void> {
        OutputLogger.log('Stale backups sweep skipped to preserve parallel transactional snapshots.');
    }
}
