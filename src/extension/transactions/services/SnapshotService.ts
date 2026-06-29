import * as vscode from 'vscode';
import { OutputLogger } from '@/infrastructure/logging/outputLogger';
import { LiveDocumentRegistry } from './LiveDocumentRegistry';

export class SnapshotService {
    private readonly liveRegistry = new LiveDocumentRegistry();

    // Тепер ми приймаємо глобальну папку для зберігання
    constructor(private readonly globalStorageUri: vscode.Uri) {}

    public getBackupUri(opId: string, relativePath: string): vscode.Uri {
        const safeName = encodeURIComponent(relativePath).replace(/%/g, '_');
        return vscode.Uri.joinPath(this.globalStorageUri, 'backups', opId, safeName);
    }

    public async createSnapshot(opId: string, relativePath: string, fileUri: vscode.Uri): Promise<void> {
        const backupUri = this.getBackupUri(opId, relativePath);
        
        try {
            await vscode.workspace.fs.createDirectory(
                vscode.Uri.joinPath(this.globalStorageUri, 'backups', opId)
            );

            let contentBytes = new Uint8Array();
            
            try {
                // Якщо файл існує - беремо його текст
                const docMetadata = await this.liveRegistry.getDocumentState(fileUri);
                contentBytes = new TextEncoder().encode(docMetadata.liveContent);
            } catch (readError) {
                // Файлу не існує. Залишаємо contentBytes порожнім!
            }
            
            await vscode.workspace.fs.writeFile(backupUri, contentBytes);
            OutputLogger.log(`Captured isolated file snapshot: ${relativePath}`);
        } catch (e) {
            OutputLogger.log(`Failed to create file backup snapshot for ${relativePath}: ${e}`, 'ERROR');
        }
    }

    // Метод для очищення бекапів, якщо транзакція СКАСОВАНА або ПОМИЛКОВА
    public async purgeSnapshotForOp(opId: string): Promise<void> {
        const backupDir = vscode.Uri.joinPath(this.globalStorageUri, 'backups', opId);
        try {
            await vscode.workspace.fs.delete(backupDir, { recursive: true, useTrash: false });
            OutputLogger.log(`Flushed file snapshots for operation: ${opId}`);
        } catch {
            // Safe ignore
        }
    }

    // Реальний працюючий Сміттєзбирач (Garbage Collector)
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
                    
                    // Якщо папка старша за дозволену кількість днів - видаляємо
                    if (ageDays > retentionDays) {
                        await vscode.workspace.fs.delete(folderUri, { recursive: true, useTrash: false });
                        OutputLogger.log(`Purged stale backup folder: ${folderName} (Age: ${Math.round(ageDays)} days)`);
                    }
                }
            }
        } catch (e) {
            // Якщо папки backups ще немає, ігноруємо
            OutputLogger.log('No stale backups found for cleanup.', 'INFO');
        }
    }
}