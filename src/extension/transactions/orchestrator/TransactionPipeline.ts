import * as vscode from 'vscode';
import type { AnyOperation } from '@/core/models/operations';
import { CommandFactory } from '@/extension/transactions/commands/CommandFactory';
import { TransactionContext } from '@/extension/transactions/context/TransactionContext';
import { VsCodeUnitOfWork } from '@/extension/transactions/context/VsCodeUnitOfWork';
import { TransactionLock } from '@/extension/transactions/store/TransactionLock';
import type { OperationStatusUpdate } from '@/extension/transactions/core/TransactionEvents';
import type { CompensationStore } from '@/extension/transactions/store/CompensationStore';
import type { DecorationService } from '@/extension/transactions/services/DecorationService';
import type { SearchEngine } from '@/core/matcher/searchEngine';
import type { ResilientPathResolver } from '@/core/resolver/resilientPathResolver';
import type { SnapshotService } from '@/extension/transactions/services/SnapshotService';
import type { EditorService } from '@/extension/transactions/services/EditorService';
import type { DirectoryCleanupService } from '@/extension/transactions/services/DirectoryCleanupService';
import type { ILogger } from '@/extension/transactions/core/ILogger';
import type { ConflictDetails } from '@/shared/models';
import type { SettingsManager } from '@/extension/settings/settingsManager'; 

import { ValidationPhase } from './phases/ValidationPhase';
import { ExecutionPhase } from './phases/ExecutionPhase';
import { CommitPhase } from './phases/CommitPhase';

export class TransactionPipeline {
    private readonly transactionLock = new TransactionLock();
    
    private readonly validationPhase = new ValidationPhase();
    private readonly executionPhase = new ExecutionPhase();
    private readonly commitPhase: CommitPhase;

    constructor(
        private readonly store: CompensationStore,
        private readonly decorationService: DecorationService,
        private readonly searchEngine: SearchEngine,
        private readonly pathResolver: ResilientPathResolver,
        private readonly snapshotService: SnapshotService,
        private readonly editorService: EditorService,
        private readonly directoryCleanupService: DirectoryCleanupService,
        private readonly logger: ILogger,
        private readonly settingsManager: SettingsManager,
        private readonly onStatusUpdate: (event: OperationStatusUpdate) => void
    ) {
        this.commitPhase = new CommitPhase(store, decorationService, directoryCleanupService, editorService, onStatusUpdate);
    }

    public async applyBatch(operations: AnyOperation[]): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            this.logger.error("No open workspace found.");
            return;
        }

        const rootName = workspaceFolders[0].name;
        const rootUri = workspaceFolders[0].uri;

        const pendingOps = operations.filter(op => op.status === 'pending');
        if (pendingOps.length === 0) return;

        const pendingOpIds = pendingOps.map(op => op.id);
        if (!this.transactionLock.acquireBatch(pendingOpIds)) {
            this.logger.warn("Transaction rejected. Lock held by other operations.");
            this.abortBatch(pendingOps, "Lock held by other operations.", new Map());
            return;
        }

        const commands = pendingOps.map(op => CommandFactory.create(op));
        const uow = new VsCodeUnitOfWork(rootUri);
        const context = new TransactionContext(
            rootUri, 
            rootName,
            uow,
            this.searchEngine,
            this.pathResolver,
            this.snapshotService,
            this.logger,
            this.settingsManager
        );

        try {
            this.logger.info(`Starting transaction pipeline for ${commands.length} commands.`);
            
            const validationResult = await this.validationPhase.execute(commands, context);
            if (!validationResult.success) {
                this.logger.warn(`Validation failed for ${validationResult.error.failedId}. Aborting batch.`);
                const conflictMap = new Map<string, ConflictDetails>();
                conflictMap.set(validationResult.error.failedId, validationResult.error.conflict);
                this.abortBatch(pendingOps, "Validation failed", conflictMap, validationResult.error.failedId);
                return;
            }

            await this.executionPhase.execute(commands, context);
            await this.commitPhase.execute(commands, pendingOps, context, rootName, rootUri);

            this.logger.info("Transaction pipeline executed successfully.");

        } catch (err) {
            this.logger.error(`Pipeline execution crashed: ${err}`);
            
            for (const cmd of commands) {
                await this.revertOperation(cmd.operationId); 

                await this.snapshotService.purgeSnapshotForOp(cmd.operationId);
                this.transactionLock.release(cmd.operationId);
                this.onStatusUpdate({
                    operationId: cmd.operationId,
                    status: 'error',
                    conflict: { reason: 'UNKNOWN', blockIndex: 0, totalBlocks: 0, searchExcerpt: String(err), originalSearchBlock: '' }
                });
            }
        }
    }

    private abortBatch(
        operations: AnyOperation[], 
        failReason: string, 
        conflictMap: Map<string, ConflictDetails>,
        culpritId?: string
    ): void {
        for (const op of operations) {
            this.transactionLock.release(op.id);
            let conflictData = conflictMap.get(op.id);
            
            if (culpritId && op.id !== culpritId) {
                conflictData = {
                    reason: 'ABORTED',
                    blockIndex: 0,
                    totalBlocks: 0,
                    searchExcerpt: 'Transaction aborted due to failure in another file.',
                    originalSearchBlock: '',
                    wasValidated: true
                };
            } else if (!conflictData) {
                conflictData = { reason: 'UNKNOWN', blockIndex: 0, totalBlocks: 0, searchExcerpt: failReason, originalSearchBlock: '' };
            }

            this.onStatusUpdate({ operationId: op.id, status: 'conflict', conflict: conflictData });
        }
    }

    public async saveBatch(): Promise<void> {
        const txIds = this.store.getAllIds();
        for (const id of txIds) {
            await this.saveOperation(id);
        }
        this.logger.info('Batch saved successfully.');
    }

    public async revertBatch(): Promise<void> {
        const txIds = this.store.getAllIds().reverse(); 
        for (const id of txIds) {
            await this.revertOperation(id);
        }
        this.logger.info('Batch reverted successfully.');
    }

    private getAbsoluteUri(relativePath: string): vscode.Uri | null {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) return null;
        const cleanPath = relativePath.replace(/^[\/\\]+/, '');
        return vscode.Uri.joinPath(workspaceFolders[0].uri, cleanPath);
    }

    public async saveOperation(opId: string): Promise<void> {
        const tx = this.store.getTransaction(opId);
        if (!tx) return;

        for (const act of tx.antiActions) {
            const targetPath = (act as any).path || (act as any).destinationPath;
            if (!targetPath) continue;
            try {
                const targetUri = this.getAbsoluteUri(targetPath);
                if (targetUri) {
                    const doc = await vscode.workspace.openTextDocument(targetUri);
                    if (doc.isDirty) await doc.save();
                }
            } catch { /* safe ignore */ }
        }

        this.onStatusUpdate({ operationId: opId, status: 'saved' });
        this.transactionLock.release(opId);
        this.decorationService.clearDecorationsForOp(opId);
    }

    public async revertOperation(opId: string): Promise<void> {
        const tx = this.store.getTransaction(opId);
        if (!tx) return;

        const edit = new vscode.WorkspaceEdit();
        const directoriesToDelete: vscode.Uri[] = [];
        const directoriesToRestore: vscode.Uri[] = [];
        const filesToRestoreBinary: { uri: vscode.Uri, data: Uint8Array }[] = [];

        // 1. Видаляємо сміття (те що ШІ створив) З КІНЦЯ В ПОЧАТОК
        for (let i = tx.antiActions.length - 1; i >= 0; i--) {
            const act = tx.antiActions[i];
            if (act.type === 'delete_created') {
                const uri = this.getAbsoluteUri(act.path);
                if (uri) edit.deleteFile(uri, { ignoreIfNotExists: true });
            }
            else if (act.type === 'restore_move') {
                const uri = this.getAbsoluteUri(act.destinationPath);
                if (uri) edit.deleteFile(uri, { ignoreIfNotExists: true });
            }
            else if (act.type === 'delete_dir_if_empty') {
                const uri = this.getAbsoluteUri(act.path);
                if (uri) directoriesToDelete.push(uri);
            }
            else if (act.type === 'restore_dir') {
                const uri = this.getAbsoluteUri(act.path);
                if (uri) directoriesToRestore.push(uri);
            }
        }

        // 2. Готуємо відновлення тексту
        for (const act of tx.antiActions) {
            let backupUri: vscode.Uri | undefined;
            let targetUri: vscode.Uri | null = null;

            if (act.type === 'restore_file') {
                backupUri = this.snapshotService.getBackupUri(opId, act.relativePath);
                targetUri = this.getAbsoluteUri(act.path);
            } else if (act.type === 'restore_move') {
                backupUri = this.snapshotService.getBackupUri(opId, act.relativeSourcePath);
                targetUri = this.getAbsoluteUri(act.sourcePath);
            }

            if (backupUri && targetUri) {
                try {
                    const backupData = await vscode.workspace.fs.readFile(backupUri);
                    try {
                        await vscode.workspace.fs.stat(targetUri);
                        // Файл існує -> М'яка текстова заміна
                        const rawText = new TextDecoder('utf-8').decode(backupData);
                        const doc = await vscode.workspace.openTextDocument(targetUri);
                        
                        // Зберігаємо CRLF для GIT
                        const isCRLF = doc.getText().includes('\r\n');
                        const normalizedText = rawText.replace(/\r?\n/g, isCRLF ? '\r\n' : '\n');

                        const fullRange = new vscode.Range(0, 0, doc.lineCount, 9999);
                        edit.replace(targetUri, fullRange, normalizedText);
                    } catch {
                        // ВИПРАВЛЕННЯ: Файлу немає. Ставимо в чергу на 100% бінарне створення на диску.
                        filesToRestoreBinary.push({ uri: targetUri, data: backupData });
                    }
                } catch (e) {
                    this.logger.error(`Failed to stage text restoration for ${targetUri.fsPath}: ${e}`);
                }
            }
        }

        await vscode.workspace.applyEdit(edit);

        // БІНАРНЕ ВІДНОВЛЕННЯ видалених файлів
        for (const file of filesToRestoreBinary) {
            await vscode.workspace.fs.writeFile(file.uri, file.data);
        }

        directoriesToDelete.sort((a, b) => b.fsPath.length - a.fsPath.length);
        for (const dirUri of directoriesToDelete) {
            try {
                const contents = await vscode.workspace.fs.readDirectory(dirUri);
                if (contents.length === 0) await vscode.workspace.fs.delete(dirUri, { recursive: false, useTrash: false });
            } catch { /* ignore */ }
        }

        directoriesToRestore.sort((a, b) => a.fsPath.length - b.fsPath.length);
        for (const dirUri of directoriesToRestore) {
            try { await vscode.workspace.fs.createDirectory(dirUri); } catch { /* ignore */ }
        }

        this.onStatusUpdate({ operationId: opId, status: 'reverted' });
        this.store.clearTransaction(opId);
        this.transactionLock.release(opId);
        this.decorationService.clearDecorationsForOp(opId);
        await this.snapshotService.purgeSnapshotForOp(opId);
    }
}