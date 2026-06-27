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
import { PathNormalizer } from '@/core/workspace/pathNormalizer';
import type { ConflictDetails } from '@/shared/models';

export class TransactionPipeline {
    private readonly transactionLock = new TransactionLock();

    constructor(
        private readonly store: CompensationStore,
        private readonly decorationService: DecorationService,
        private readonly searchEngine: SearchEngine,
        private readonly pathResolver: ResilientPathResolver,
        private readonly snapshotService: SnapshotService,
        private readonly editorService: EditorService,
        private readonly directoryCleanupService: DirectoryCleanupService,
        private readonly logger: ILogger,
        private readonly onStatusUpdate: (event: OperationStatusUpdate) => void
    ) {}

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
        const uow = new VsCodeUnitOfWork();
        const context = new TransactionContext(
            rootUri,
            rootName,
            uow,
            this.searchEngine,
            this.pathResolver,
            this.snapshotService,
            this.logger
        );

        try {
            this.logger.info(`Starting transaction pipeline for ${commands.length} commands.`);
            const validatedIds = new Set<string>();

            // Phase 1: Validate (PreFlight)
            for (const cmd of commands) {
                const res = await cmd.validate(context);
                if (!res.success) {
                    this.logger.warn(`Validation failed for ${cmd.operationId}. Aborting batch.`);
                    const conflictMap = new Map<string, ConflictDetails>();
                    conflictMap.set(cmd.operationId, res.error);
                    
                    // Mark the specific failing command as the culprit
                    this.abortBatch(pendingOps, "Validation failed", conflictMap, cmd.operationId, validatedIds);
                    return;
                }
                validatedIds.add(cmd.operationId);
            }

            // Phase 2: Snapshots
            for (const cmd of commands) {
                await cmd.prepareBackup(context);
            }

            // Phase 3: Staging
            for (const cmd of commands) {
                await cmd.apply(context);
            }

            // Phase 4: Commit to Disk
            const committed = await uow.commit();
            if (!committed) {
                throw new Error("Workspace edit commit failed at VS Code FS level.");
            }

            // Phase 5: Post-Commit Hooks & Sagas
            const allCandidateDirs = this.extractAllDirectoryCandidates(pendingOps, rootName);
            const cleanedDirs = await this.directoryCleanupService.cleanupEmptyDirectories(allCandidateDirs, rootUri);

            for (const cmd of commands) {
                const antiActions = cmd.getCompensation();

                const cmdCandidates = this.extractDirectoryCandidates(cmd.operation, rootName);
                for (const dirUri of cleanedDirs) {
                    const relativeDir = PathNormalizer.normalize(dirUri.fsPath, rootName);
                    if (cmdCandidates.includes(relativeDir)) {
                        antiActions.push({ type: 'restore_dir', uri: dirUri });
                    }
                }

                if (antiActions.length > 0) {
                    this.store.addTransaction({ operationId: cmd.operationId, antiActions });
                    this.onStatusUpdate({
                        operationId: cmd.operationId,
                        status: 'applied_dirty',
                        ...cmd.metadata
                    });

                    const appliedData = uow.getAppliedRanges(cmd.operationId);
                    if (appliedData) {
                        this.decorationService.addDecorations(appliedData.uri, cmd.operationId, appliedData.ranges);
                    }
                } else {
                    this.onStatusUpdate({
                        operationId: cmd.operationId,
                        status: 'saved',
                        ...cmd.metadata
                    });
                    this.transactionLock.release(cmd.operationId);
                }
            }

            await this.editorService.focusFiles(uow.getModifiedUris());
            this.logger.info("Transaction pipeline executed successfully.");

        } catch (err) {
            this.logger.error(`Pipeline execution crashed: ${err}`);
            
            for (const cmd of commands) {
                await this.snapshotService.purgeSnapshotForOp(rootUri, cmd.operationId);
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
        culpritId?: string,
        validatedIds?: Set<string>
    ): void {
        for (const op of operations) {
            this.transactionLock.release(op.id);
            
            let conflictData = conflictMap.get(op.id);
            
            // If we have a known culprit, and this is NOT the culprit, mark as an aborted victim
            if (culpritId && op.id !== culpritId) {
                conflictData = {
                    reason: 'ABORTED',
                    blockIndex: 0,
                    totalBlocks: 0,
                    searchExcerpt: 'Transaction aborted due to failure in another file.',
                    originalSearchBlock: '',
                    wasValidated: validatedIds?.has(op.id)
                };
            } else if (!conflictData) {
                // Fallback for general rejection
                conflictData = { reason: 'UNKNOWN', blockIndex: 0, totalBlocks: 0, searchExcerpt: failReason, originalSearchBlock: '' };
            }

            this.onStatusUpdate({
                operationId: op.id,
                status: 'conflict',
                conflict: conflictData
            });
        }
    }

    private extractAllDirectoryCandidates(operations: AnyOperation[], rootName: string): string[] {
        return operations.flatMap(op => this.extractDirectoryCandidates(op, rootName));
    }

    private extractDirectoryCandidates(op: AnyOperation, rootName: string): string[] {
        const candidates: string[] = [];
        if (op.type === 'delete_path' || op.type === 'move_path') {
            const normalizedPath = PathNormalizer.normalize((op as any).path, rootName);
            let currentDir = normalizedPath.split('/').slice(0, -1).join('/');
            while (currentDir) {
                candidates.push(currentDir);
                currentDir = currentDir.split('/').slice(0, -1).join('/');
            }
        }
        return candidates;
    }

    public async saveBatch(): Promise<void> {
        const txIds = this.store.getAllIds();
        for (const id of txIds) {
            await this.saveOperation(id);
        }
        this.logger.info('Batch saved successfully.');
    }

    public async revertBatch(): Promise<void> {
        const txIds = this.store.getAllIds();
        for (const id of txIds) {
            await this.revertOperation(id);
        }
        this.logger.info('Batch reverted successfully.');
    }

    public async saveOperation(opId: string): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return;

        const tx = this.store.getTransaction(opId);
        if (!tx) return;

        for (const act of tx.antiActions) {
            const targetUri = (act as any).uri || (act as any).destinationUri;
            if (!targetUri) continue;
            try {
                const doc = await vscode.workspace.openTextDocument(targetUri);
                if (doc.isDirty) await doc.save();
            } catch {
                // Safe ignore
            }
        }

        this.onStatusUpdate({ operationId: opId, status: 'saved' });
        this.store.clearTransaction(opId);
        this.transactionLock.release(opId);
        this.decorationService.clearDecorationsForOp(opId);
        await this.snapshotService.purgeSnapshotForOp(workspaceFolders[0].uri, opId);
    }

    public async revertOperation(opId: string): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return;
        const rootUri = workspaceFolders[0].uri;

        const tx = this.store.getTransaction(opId);
        if (!tx) return;

        const edit = new vscode.WorkspaceEdit();
        const directoriesToDelete: vscode.Uri[] = [];
        const directoriesToRestore: vscode.Uri[] = [];

        for (let i = tx.antiActions.length - 1; i >= 0; i--) {
            const act = tx.antiActions[i];
            if (act.type === 'delete_created') edit.deleteFile(act.uri, { ignoreIfNotExists: true });
            else if (act.type === 'restore_move') edit.deleteFile(act.destinationUri, { ignoreIfNotExists: true });
            else if (act.type === 'delete_dir_if_empty') directoriesToDelete.push(act.uri);
            else if (act.type === 'restore_dir') directoriesToRestore.push(act.uri);
        }

        await vscode.workspace.applyEdit(edit);

        directoriesToDelete.sort((a, b) => b.fsPath.length - a.fsPath.length);
        for (const dirUri of directoriesToDelete) {
            try {
                const contents = await vscode.workspace.fs.readDirectory(dirUri);
                if (contents.length === 0) {
                    await vscode.workspace.fs.delete(dirUri, { recursive: false, useTrash: false });
                }
            } catch {
                /* ignore */
            }
        }

        directoriesToRestore.sort((a, b) => a.fsPath.length - b.fsPath.length);
        for (const dirUri of directoriesToRestore) {
            try {
                await vscode.workspace.fs.createDirectory(dirUri);
            } catch {
                /* ignore */
            }
        }

        for (const act of tx.antiActions) {
            if (act.type === 'restore_file') {
                await this.snapshotService.restoreSnapshot(rootUri, opId, act.relativePath, act.uri);
            } else if (act.type === 'restore_move') {
                await this.snapshotService.restoreSnapshot(rootUri, opId, act.relativeSourcePath, act.sourceUri);
            }
        }

        this.onStatusUpdate({ operationId: opId, status: 'reverted' });
        this.store.clearTransaction(opId);
        this.transactionLock.release(opId);
        this.decorationService.clearDecorationsForOp(opId);
        await this.snapshotService.purgeSnapshotForOp(rootUri, opId);
    }
}
