import * as vscode from 'vscode';
import type { IUnitOfWork } from '@/extension/transactions/core/IUnitOfWork';
import type { ILogger } from '@/extension/transactions/core/ILogger';
import type { SearchEngine } from '@/core/matcher/searchEngine';
import type { ResilientPathResolver } from '@/core/resolver/resilientPathResolver';
import type { SnapshotService } from '@/extension/transactions/services/SnapshotService';

export interface ITransactionContext {
    readonly workspaceRoot: vscode.Uri;
    readonly rootName: string;
    readonly uow: IUnitOfWork;
    readonly searchEngine: SearchEngine;
    readonly pathResolver: ResilientPathResolver;
    readonly snapshotService: SnapshotService;
    readonly logger: ILogger;

    getResolvedUri(rawPath: string): vscode.Uri | undefined;
    setResolvedUri(rawPath: string, actualUri: vscode.Uri): void;
    getDocument(uri: vscode.Uri): Promise<vscode.TextDocument>;
    ensureDirectoryExists(targetDir: vscode.Uri): Promise<vscode.Uri[]>;
}
