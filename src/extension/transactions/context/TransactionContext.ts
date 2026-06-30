import * as vscode from 'vscode';
import type { ITransactionContext } from '@/extension/transactions/core/ITransactionContext';
import type { IUnitOfWork } from '@/extension/transactions/core/IUnitOfWork';
import type { ILogger } from '@/extension/transactions/core/ILogger';
import type { SearchEngine } from '@/core/matcher/searchEngine';
import type { ResilientPathResolver } from '@/core/resolver/resilientPathResolver';
import type { SnapshotService } from '@/extension/transactions/services/SnapshotService';
import type { SettingsManager } from '@/extension/settings/settingsManager';
import type { IDocument } from '@/core/matcher/documentPort';
import { VsCodeDocument } from '@/infrastructure/adapters/vsCodeDocument';

export class TransactionContext implements ITransactionContext {
    private readonly resolvedPaths = new Map<string, string>();
    private readonly documentCache = new Map<string, IDocument>();

    constructor(
        private readonly workspaceRootUri: vscode.Uri, // Використовуємо Uri для безпеки
        public readonly rootName: string,
        public readonly uow: IUnitOfWork,
        public readonly searchEngine: SearchEngine,
        public readonly pathResolver: ResilientPathResolver,
        private readonly snapshotService: SnapshotService,
        public readonly logger: ILogger,
        public readonly settingsManager: SettingsManager
    ) {}

    // ГАРАНТОВАНО БЕЗПЕЧНИЙ МЕТОД ДЛЯ WINDOWS ТА UNIX
    public getAbsoluteUri(relativePath: string): vscode.Uri {
        const cleanPath = relativePath.replace(/^[\/\\]+/, '');
        return vscode.Uri.joinPath(this.workspaceRootUri, cleanPath);
    }

    public getResolvedPath(rawPath: string): string | undefined {
        return this.resolvedPaths.get(rawPath);
    }

    public setResolvedPath(rawPath: string, actualPath: string): void {
        this.resolvedPaths.set(rawPath, actualPath);
    }

    public async getDocument(relativePath: string): Promise<IDocument> {
        if (this.documentCache.has(relativePath)) {
            return this.documentCache.get(relativePath)!;
        }
        const uri = this.getAbsoluteUri(relativePath);
        const vsDoc = await vscode.workspace.openTextDocument(uri);
        const domainDoc = new VsCodeDocument(vsDoc);
        this.documentCache.set(relativePath, domainDoc);
        return domainDoc;
    }

    public async ensureDirectoryExists(targetRelativeDirPath: string): Promise<string[]> {
        const targetDir = this.getAbsoluteUri(targetRelativeDirPath);
        const rootFsPath = this.workspaceRootUri.fsPath;
        let currentDir = targetDir;
        const missingDirs: string[] = [];

        while (currentDir.fsPath.length > rootFsPath.length) {
            try {
                await vscode.workspace.fs.stat(currentDir);
                break;
            } catch {
                missingDirs.push(currentDir.fsPath);
                currentDir = vscode.Uri.joinPath(currentDir, '..');
            }
        }

        for (let i = missingDirs.length - 1; i >= 0; i--) {
            try { await vscode.workspace.fs.createDirectory(vscode.Uri.file(missingDirs[i])); } 
            catch { /* Ignore */ }
        }
        return missingDirs;
    }

    public async fileExists(relativePath: string): Promise<boolean> {
        try {
            await vscode.workspace.fs.stat(this.getAbsoluteUri(relativePath));
            return true;
        } catch {
            return false;
        }
    }

    public async createBackup(operationId: string, relativePath: string): Promise<void> {
        const absoluteUri = this.getAbsoluteUri(relativePath);
        await this.snapshotService.createSnapshot(operationId, relativePath, absoluteUri);
    }
}