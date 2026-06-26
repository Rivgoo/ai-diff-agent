import * as vscode from 'vscode';
import { OutputLogger } from '@/infrastructure/logging/outputLogger';
import { SYSTEM_CONSTANTS } from '@/shared/constants';
import { LiveDocumentRegistry } from '@/extension/transactions/liveDocumentRegistry';

/**
 * Handles transaction-scoped, isolated backups of files undergoing AI operations.
 * Captures live unsaved states from editor buffers to prevent data loss.
 */
export class SnapshotService {
    private readonly liveRegistry = new LiveDocumentRegistry();

    /**
     * Generates an isolated, safe URI for a snapshot within the transaction scope directory.
     */
    private getBackupUri(workspaceRoot: vscode.Uri, opId: string, relativePath: string): vscode.Uri {
        const safeName = Buffer.from(relativePath).toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
        return vscode.Uri.joinPath(workspaceRoot, SYSTEM_CONSTANTS.BACKUP_FOLDER_NAME, opId, safeName);
    }

    /**
     * Captures a snapshot of the target file. Resolves live in-memory changes instead of cold file copy.
     */
    public async createSnapshot(workspaceRoot: vscode.Uri, opId: string, relativePath: string, fileUri: vscode.Uri): Promise<void> {
        const backupUri = this.getBackupUri(workspaceRoot, opId, relativePath);
        
        try {
            // Ensure transaction backup folder structure exists
            await vscode.workspace.fs.createDirectory(
                vscode.Uri.joinPath(workspaceRoot, SYSTEM_CONSTANTS.BACKUP_FOLDER_NAME, opId)
            );

            // Fetch live editor buffer state to preserve pre-existing dirty changes (Resolves Deviation 1)
            const docMetadata = await this.liveRegistry.getDocumentState(fileUri);
            const contentBytes = new TextEncoder().encode(docMetadata.liveContent);
            
            await vscode.workspace.fs.writeFile(backupUri, contentBytes);
            OutputLogger.log(`Captured file snapshot (live state): ${relativePath} -> ${backupUri.fsPath}`);
        } catch (e) {
            OutputLogger.log(`Failed to create file backup snapshot for ${relativePath}: ${e}`, 'ERROR');
        }
    }

    /**
     * Restores a file back to its exact pre-transaction state from the backup snapshot.
     */
    public async restoreSnapshot(workspaceRoot: vscode.Uri, opId: string, relativePath: string, targetUri: vscode.Uri): Promise<void> {
        const backupUri = this.getBackupUri(workspaceRoot, opId, relativePath);
        
        try {
            await vscode.workspace.fs.copy(backupUri, targetUri, { overwrite: true });
            OutputLogger.log(`Restored original file state from snapshot: ${backupUri.fsPath} -> ${targetUri.fsPath}`);
        } catch (e) {
            OutputLogger.log(`Failed to restore backup snapshot for ${relativePath}: ${e}`, 'ERROR');
        }
    }

    /**
     * Safely deletes snapshots associated only with a completed or reverted operation.
     * Prevents multi-transaction race-conditions (Resolves Deviation 3).
     */
    public async purgeSnapshotForOp(workspaceRoot: vscode.Uri, opId: string): Promise<void> {
        const backupDir = vscode.Uri.joinPath(workspaceRoot, SYSTEM_CONSTANTS.BACKUP_FOLDER_NAME, opId);
        try {
            await vscode.workspace.fs.delete(backupDir, { recursive: true, useTrash: false });
            OutputLogger.log(`Flushed file snapshots for operation: ${opId}`);
        } catch {
            // Directory already purged or missing, fail-safe ignore
        }
    }

    /**
     * Purges all transaction snapshots in the workspace (force global cleanup).
     */
    public async purgeSnapshots(workspaceRoot: vscode.Uri): Promise<void> {
        const backupDir = vscode.Uri.joinPath(workspaceRoot, SYSTEM_CONSTANTS.BACKUP_FOLDER_NAME);
        try {
            await vscode.workspace.fs.delete(backupDir, { recursive: true, useTrash: false });
            OutputLogger.log(`Flushed all transactional file snapshots.`);
        } catch {
            // Directory missing, ignore purge
        }
    }

    /**
     * Sweeps stale backups. Avoids sweeping parallel operations by ignoring generic directories.
     * (Sweeps are scoped and executed transactionally via purgeSnapshotForOp).
     */
    public async cleanStaleBackups(workspaceRoot: vscode.Uri): Promise<void> {
        // Multi-tenant backups are preserved. Only obsolete sweeps are allowed.
        OutputLogger.log(`Stale backups sweep skipped to preserve parallel transactional snapshots.`);
    }
}
