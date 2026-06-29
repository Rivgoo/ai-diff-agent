import * as vscode from 'vscode';
import type { ITransactionContext } from '@/extension/transactions/core/ITransactionContext';
import type { IUnitOfWork } from '@/extension/transactions/core/IUnitOfWork';
import type { ILogger } from '@/extension/transactions/core/ILogger';
import type { SearchEngine } from '@/core/matcher/searchEngine';
import type { ResilientPathResolver } from '@/core/resolver/resilientPathResolver';
import type { SnapshotService } from '@/extension/transactions/services/SnapshotService';
import type { SettingsManager } from '@/extension/settings/settingsManager';

export class TransactionContext implements ITransactionContext {
    private readonly resolvedUris = new Map<string, vscode.Uri>();
    private readonly documentCache = new Map<string, vscode.TextDocument>();

    constructor(
        public readonly workspaceRoot: vscode.Uri,
        public readonly rootName: string,
        public readonly uow: IUnitOfWork,
        public readonly searchEngine: SearchEngine,
        public readonly pathResolver: ResilientPathResolver,
        public readonly snapshotService: SnapshotService,
        public readonly logger: ILogger,
        public readonly settingsManager: SettingsManager
    ) {}

    public getResolvedUri(rawPath: string): vscode.Uri | undefined {
        return this.resolvedUris.get(rawPath);
    }

    public setResolvedUri(rawPath: string, actualUri: vscode.Uri): void {
        this.resolvedUris.set(rawPath, actualUri);
    }

    public async getDocument(uri: vscode.Uri): Promise<vscode.TextDocument> {
        const key = uri.toString();
        if (this.documentCache.has(key)) {
            return this.documentCache.get(key)!;
        }
        const doc = await vscode.workspace.openTextDocument(uri);
        this.documentCache.set(key, doc);
        return doc;
    }

    public async ensureDirectoryExists(targetDir: vscode.Uri): Promise<vscode.Uri[]> {
        const rootFsPath = this.workspaceRoot.fsPath;
        let currentDir = targetDir;
        const missingDirs: vscode.Uri[] = [];

        while (currentDir.fsPath.length > rootFsPath.length) {
            try {
                await vscode.workspace.fs.stat(currentDir);
                break;
            } catch {
                missingDirs.push(currentDir);
                currentDir = vscode.Uri.joinPath(currentDir, '..');
            }
        }

        for (let i = missingDirs.length - 1; i >= 0; i--) {
            const dirUri = missingDirs[i];
            try {
                await vscode.workspace.fs.createDirectory(dirUri);
            } catch {
                // Fail gracefully, rely on FS cascading
            }
        }
        return missingDirs;
    }
}
