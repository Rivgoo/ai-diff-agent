import * as vscode from 'vscode';
import { OutputLogger } from '@/infrastructure/logging/outputLogger';
import { SYSTEM_CONSTANTS } from '@/shared/constants';

export class SnapshotService {
    private getBackupUri(workspaceRoot: vscode.Uri, opId: string, relativePath: string): vscode.Uri {
        const safeName = Buffer.from(relativePath).toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
        return vscode.Uri.joinPath(workspaceRoot, SYSTEM_CONSTANTS.BACKUP_FOLDER_NAME, opId, safeName);
    }

    public async createSnapshot(workspaceRoot: vscode.Uri, opId: string, relativePath: string, fileUri: vscode.Uri): Promise<void> {
        const backupUri = this.getBackupUri(workspaceRoot, opId, relativePath);
        await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(workspaceRoot, SYSTEM_CONSTANTS.BACKUP_FOLDER_NAME, opId));
        
        try {
            await vscode.workspace.fs.copy(fileUri, backupUri, { overwrite: true });
            OutputLogger.log(`Created file snapshot: ${relativePath} -> ${backupUri.fsPath}`);
        } catch (e) {
            OutputLogger.log(`Failed to create file backup snapshot for ${relativePath}: ${e}`, 'ERROR');
        }
    }

    public async restoreSnapshot(workspaceRoot: vscode.Uri, opId: string, relativePath: string, targetUri: vscode.Uri): Promise<void> {
        const backupUri = this.getBackupUri(workspaceRoot, opId, relativePath);
        
        try {
            await vscode.workspace.fs.copy(backupUri, targetUri, { overwrite: true });
            OutputLogger.log(`Restored original file state: ${backupUri.fsPath} -> ${targetUri.fsPath}`);
        } catch (e) {
            OutputLogger.log(`Failed to restore backup snapshot for ${relativePath}: ${e}`, 'ERROR');
        }
    }

    public async purgeSnapshots(workspaceRoot: vscode.Uri): Promise<void> {
        const backupDir = vscode.Uri.joinPath(workspaceRoot, SYSTEM_CONSTANTS.BACKUP_FOLDER_NAME);
        try {
            await vscode.workspace.fs.delete(backupDir, { recursive: true, useTrash: false });
            OutputLogger.log(`Flushed all file snapshots.`);
        } catch {
            // Directory missing, ignore purge
        }
    }

    public async cleanStaleBackups(workspaceRoot: vscode.Uri): Promise<void> {
        const backupDir = vscode.Uri.joinPath(workspaceRoot, SYSTEM_CONSTANTS.BACKUP_FOLDER_NAME);
        try {
            await vscode.workspace.fs.delete(backupDir, { recursive: true, useTrash: false });
            OutputLogger.log(`Flushed stale legacy backups successfully.`);
        } catch {
            // Directory missing, ignore
        }
    }
}
