import * as vscode from 'vscode';
import { OutputLogger } from '@/infrastructure/logging/outputLogger';
import { LiveDocumentRegistry } from './LiveDocumentRegistry';

export class SnapshotService {
    private readonly liveRegistry = new LiveDocumentRegistry();

    constructor(private readonly globalStorageUri: vscode.Uri) {}

    public getBackupUri(opId: string, relativePath: string): vscode.Uri {
        const safeName = encodeURIComponent(relativePath).replace(/%/g, '_');
        return vscode.Uri.joinPath(this.globalStorageUri, 'backups', opId, safeName);
    }

    public async createSnapshot(opId: string, relativePath: string, targetFileUri: vscode.Uri): Promise<void> {
        const backupUri = this.getBackupUri(opId, relativePath);
        
        try {
            await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(this.globalStorageUri, 'backups', opId));
            
            try {
                const docMetadata = await this.liveRegistry.getDocumentState(targetFileUri);
                
                if (docMetadata.isDirty && docMetadata.liveContent !== null) {
                    const contentBytes = new TextEncoder().encode(docMetadata.liveContent);
                    await vscode.workspace.fs.writeFile(backupUri, contentBytes);
                } else {
                    const diskBytes = await vscode.workspace.fs.readFile(targetFileUri);
                    await vscode.workspace.fs.writeFile(backupUri, diskBytes);
                }
                OutputLogger.log(`Captured isolated file snapshot: ${relativePath}`);
            } catch (readError) {
                // Файл ще не існує
            }
        } catch (e) {
            OutputLogger.log(`Failed to create file backup snapshot for ${relativePath}: ${e}`, 'ERROR');
        }
    }

    public async purgeSnapshotForOp(opId: string): Promise<void> {
        const backupDir = vscode.Uri.joinPath(this.globalStorageUri, 'backups', opId);
        try {
            await vscode.workspace.fs.delete(backupDir, { recursive: true, useTrash: false });
        } catch { /* Safe ignore */ }
    }

    public async cleanStaleBackups(retentionDays: number): Promise<void> {
        const backupsDir = vscode.Uri.joinPath(this.globalStorageUri, 'backups');
        try {
            const entries = await vscode.workspace.fs.readDirectory(backupsDir);
            const now = Date.now();
            const msInDay = 1000 * 60 * 60 * 24;

            for (const [folderName, type] of entries) {
                if (type === vscode.FileType.Directory) {
                    const folderUri = vscode.Uri.joinPath(backupsDir, folderName);
                    const stat = await vscode.workspace.fs.stat(folderUri);
                    const ageDays = (now - stat.mtime) / msInDay;
                    if (ageDays > retentionDays) {
                        await vscode.workspace.fs.delete(folderUri, { recursive: true, useTrash: false });
                    }
                }
            }
        } catch (e) { /* Ignore */ }
    }
}