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
import { LspValidationPhase } from './phases/LspValidationPhase';

export class TransactionPipeline {
    private readonly transactionLock = new TransactionLock();
    
    private readonly validationPhase = new ValidationPhase();
    private readonly executionPhase = new ExecutionPhase();
    private readonly lspPhase = new LspValidationPhase();
    private readonly commitPhase: CommitPhase;

    constructor(
        private readonly store: CompensationStore,
        private readonly decorationService: DecorationService,
        private readonly searchEngine: SearchEngine,
        private readonly pathResolver: ResilientPathResolver,
        private readonly snapshotService: SnapshotService,
        editorService: EditorService,
        directoryCleanupService: DirectoryCleanupService,
        private readonly logger: ILogger,
        private readonly settingsManager: SettingsManager,
        private readonly onStatusUpdate: (event: OperationStatusUpdate) => void,
        private readonly onWalkthroughComplete: () => void 
    ) {
        this.commitPhase = new CommitPhase(store, decorationService, directoryCleanupService, editorService, onStatusUpdate);
    }

    public emergencyUnlock(): void {
        this.transactionLock.releaseAll();
        this.logger.warn("Emergency unlock triggered. All transaction locks cleared.");
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
            const executionMode = this.settingsManager.getSettings().workflow.executionMode;
            
            if (validationResult.conflicts.size > 0 && executionMode === 'atomic') {
                const firstConflictId = Array.from(validationResult.conflicts.keys())[0];
                this.logger.warn(`Atomic Mode: Validation failed for ${firstConflictId}. Aborting entire batch.`);
                this.abortBatch(pendingOps, "Validation failed (Atomic Mode)", validationResult.conflicts, firstConflictId);
                return;
            }

            if (validationResult.conflicts.size > 0) {
                this.logger.warn(`Tolerant Mode: Isolated ${validationResult.conflicts.size} conflicts.`);
                const conflictOps = pendingOps.filter(op => validationResult.conflicts.has(op.id));
                this.abortBatch(conflictOps, "Isolated conflict", validationResult.conflicts);
            }

            const validCommands = validationResult.validCommands;
            
            if (validCommands.length === 0) {
                this.logger.warn(`No valid operations left to execute. Stopping pipeline.`);
                return;
            }
            await this.executionPhase.execute(validCommands, context);
            
            const validPendingOps = pendingOps.filter(op => validCommands.some(cmd => cmd.operationId === op.id));
            await this.commitPhase.execute(validCommands, validPendingOps, context, rootName, rootUri);

            const astSettings = this.settingsManager.getSettings().ast;
            if (astSettings.lspValidation || astSettings.autoStitchImports) {
                this.logger.info(`Polling Language Servers (LSP) for diagnostics (up to 2000ms)...`);
                
                const maxWaitMs = 2000;
                const pollInterval = 250;
                let elapsed = 0;
                let lspFailures: any[] = [];

                while (elapsed < maxWaitMs) {
                    await new Promise(res => setTimeout(res, pollInterval));
                    elapsed += pollInterval;
                    
                    lspFailures = await this.lspPhase.execute(validCommands, context);
                    if (lspFailures.length > 0) {
                        break; 
                    }
                }
                
                if (lspFailures.length > 0) {
                    if (executionMode === 'atomic') {
                        this.logger.warn(`Atomic Mode: LSP Validation failed. Rolling back the entire batch.`);
                        await this.revertBatch(); 
                        
                        for (const cmd of validCommands) {
                            const failure = lspFailures.find(f => f.cmd.operationId === cmd.operationId);
                            this.onStatusUpdate({
                                operationId: cmd.operationId,
                                status: 'conflict',
                                conflict: failure ? {
                                    reason: 'LSP_ERROR', blockIndex: 0, totalBlocks: 0, searchExcerpt: 'LSP Compilation Failed', originalSearchBlock: '',
                                    semanticDiagnostic: failure.diagnostic
                                } : {
                                    reason: 'ABORTED', blockIndex: 0, totalBlocks: 0, searchExcerpt: 'Batch aborted due to LSP errors in other files.', originalSearchBlock: '', wasValidated: true
                                }
                            });
                        }
                    } else {
                        this.logger.warn(`Tolerant Mode: Isolating ${lspFailures.length} files with LSP errors.`);
                        for (const failure of lspFailures) {
                            await this.revertOperation(failure.cmd.operationId);
                            this.onStatusUpdate({
                                operationId: failure.cmd.operationId,
                                status: 'conflict',
                                conflict: {
                                    reason: 'LSP_ERROR', blockIndex: 0, totalBlocks: 0, searchExcerpt: 'LSP Compilation Failed', originalSearchBlock: '',
                                    semanticDiagnostic: failure.diagnostic
                                }
                            });
                        }
                    }
                }
            }

            this.logger.info(`Transaction pipeline executed successfully for ${validCommands.length} commands.`);

        } catch (err) {
            this.logger.error(`Pipeline execution crashed: ${err}`);
            
            for (const cmd of commands) {
                try {
                    await this.revertOperation(cmd.operationId);
                    await this.snapshotService.purgeSnapshotForOp(cmd.operationId);
                } catch (revertErr) {
                    this.logger.error(`Failed to revert operation ${cmd.operationId} during crash recovery: ${revertErr}`);
                } finally {
                    this.transactionLock.release(cmd.operationId);
                    this.onStatusUpdate({
                        operationId: cmd.operationId,
                        status: 'error',
                        conflict: { reason: 'UNKNOWN', blockIndex: 0, totalBlocks: 0, searchExcerpt: String(err), originalSearchBlock: '' }
                    });
                }
            }
        } finally {
            context.dispose();
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

    public async saveOperation(opId: string, isWalkthrough: boolean = false): Promise<void> {
        const tx = this.store.getTransaction(opId);
        if (!tx) return;

        const autoSave = this.settingsManager.getSettings().workflow?.autoSaveAfterAccept ?? true;

        if (autoSave) {
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
        }

        this.onStatusUpdate({ operationId: opId, status: 'saved' });
        this.transactionLock.release(opId);
        this.decorationService.clearDecorationsForOp(opId);
        
        this.store.clearTransaction(opId);
        await this.snapshotService.purgeSnapshotForOp(opId);

        if (isWalkthrough) {
            await this.jumpToNextDirtyBlock();
        }
    }

    public async revertOperation(opId: string, isWalkthrough: boolean = false): Promise<void> {
        const tx = this.store.getTransaction(opId);
        if (!tx) return;

        const edit = new vscode.WorkspaceEdit();
        const directoriesToDelete: vscode.Uri[] = [];
        const directoriesToRestore: vscode.Uri[] = [];
        const filesToRestoreBinary: { uri: vscode.Uri, data: Uint8Array }[] = [];
        const filesRestoredText: vscode.Uri[] = [];

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
                        const rawText = new TextDecoder('utf-8').decode(backupData);
                        const doc = await vscode.workspace.openTextDocument(targetUri);
                        
                        const isCRLF = doc.getText().includes('\r\n');
                        const normalizedText = rawText.replace(/\r?\n/g, isCRLF ? '\r\n' : '\n');

                        const fullRange = new vscode.Range(0, 0, doc.lineCount, 9999);
                        edit.replace(targetUri, fullRange, normalizedText);
                        filesRestoredText.push(targetUri);
                    } catch {
                        filesToRestoreBinary.push({ uri: targetUri, data: backupData });
                    }
                } catch (e) {
                    this.logger.error(`Failed to stage text restoration for ${targetUri.fsPath}: ${e}`);
                }
            }
        }

        await vscode.workspace.applyEdit(edit);

        for (const uri of filesRestoredText) {
            try {
                const doc = await vscode.workspace.openTextDocument(uri);
                if (doc.isDirty) {
                    await doc.save();
                }
            } catch (e) {
                this.logger.error(`Failed to forcefully save reverted document ${uri.fsPath}: ${e}`);
            }
        }

        for (const file of filesToRestoreBinary) {
            await vscode.workspace.fs.writeFile(file.uri, file.data);
        }

        const cleanupEnabled = this.settingsManager.getSettings().workflow?.cleanupEmptyDirectories ?? true;
        
        if (cleanupEnabled) {
            directoriesToDelete.sort((a, b) => b.fsPath.length - a.fsPath.length);
            for (const dirUri of directoriesToDelete) {
                try {
                    const contents = await vscode.workspace.fs.readDirectory(dirUri);
                    if (contents.length === 0) await vscode.workspace.fs.delete(dirUri, { recursive: false, useTrash: false });
                } catch { /* ignore */ }
            }
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

        if (isWalkthrough) {
            await this.jumpToNextDirtyBlock();
        }
    }

    public async jumpToNextDirtyBlock(): Promise<void> {
        const allDecorations = this.decorationService.getAllActiveDecorations();
        
        if (allDecorations.length === 0) {
            this.logger.info("Walkthrough complete: No more dirty blocks left.");
            this.onWalkthroughComplete(); 
            return;
        }

        const nextTarget = allDecorations[0];

        const uri = vscode.Uri.parse(nextTarget.uriString);

        try {
            const doc = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(doc, { preview: false });

            editor.revealRange(nextTarget.decoration.range, vscode.TextEditorRevealType.InCenter);
            editor.selection = new vscode.Selection(nextTarget.decoration.range.start, nextTarget.decoration.range.start);
        } catch (e) {
            this.logger.warn(`Walkthrough jump failed: ${e}`);
        }
    }
}