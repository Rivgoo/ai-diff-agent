import * as vscode from 'vscode';
import { OutputLogger } from '../../infrastructure/logging/outputLogger';

/**
 * Robust snapshotting service that backups file states on disk before modifications.
 * This guarantees zero range drift during reverts and survives VS Code hot restarts.
 */
export class SnapshotService {
    private readonly backupFolder = '.vscode/.ai-backups';

    private getBackupUri(workspaceRoot: vscode.Uri, opId: string, relativePath: string): vscode.Uri {
        // Safe base64url encoding to map any nested relative path to a single file on disk
        const safeName = Buffer.from(relativePath).toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
        return vscode.Uri.joinPath(workspaceRoot, this.backupFolder, opId, safeName);
    }

    public async createSnapshot(workspaceRoot: vscode.Uri, opId: string, relativePath: string, fileUri: vscode.Uri): Promise<void> {
        const backupUri = this.getBackupUri(workspaceRoot, opId, relativePath);
        await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(workspaceRoot, this.backupFolder, opId));
        
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
        const backupDir = vscode.Uri.joinPath(workspaceRoot, this.backupFolder);
        try {
            await vscode.workspace.fs.delete(backupDir, { recursive: true, useTrash: false });
            OutputLogger.log(`Flushed all file snapshots.`);
        } catch {
            // Directory missing, ignore purge
        }
    }

    public async cleanStaleBackups(workspaceRoot: vscode.Uri): Promise<void> {
        const backupDir = vscode.Uri.joinPath(workspaceRoot, this.backupFolder);
        try {
            await vscode.workspace.fs.delete(backupDir, { recursive: true, useTrash: false });
            OutputLogger.log(`Flushed stale legacy backups successfully.`);
        } catch {
            // Directory missing, ignore
        }
    }
}
