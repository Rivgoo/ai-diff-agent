import * as vscode from 'vscode';
import type { AnyOperation } from '../../core/models/operations';
import { PathSandbox } from '../../vscode/workspace/pathSandbox';
import { SearchEngine } from '../../core/matcher/searchEngine';
import { VsCodeDocument } from '../../infrastructure/adapters/vsCodeDocument';
import { OutputLogger } from '../../infrastructure/logging/outputLogger';
import { PathNormalizer } from '../../core/workspace/pathNormalizer';
import type { CompensationStore, AntiAction } from './compensationStore';
import { SnapshotService } from './snapshotService';
import { EditorService } from './editorService';
import type { DecorationService } from './decorationService';
import type { OperationStatus } from '../../shared/models';
import { TransactionLock } from './transactionLock';

/**
 * Orchestrates atomic transactions using the Saga Pattern.
 * Manages locks, directory bottom-up cleanups, and secure buffer saves.
 * Ensures absolute atomicity: if one operation in a batch fails to prepare,
 * the entire batch is rolled back and discarded before modifying files.
 */
export class TransactionManager {
    private searchEngine = new SearchEngine();
    private snapshotService = new SnapshotService();
    private editorService = new EditorService();
    private transactionLock = new TransactionLock();
    
    constructor(
        private readonly store: CompensationStore,
        private readonly decorationService: DecorationService,
        private readonly statusCallback: (opId: string, status: OperationStatus) => void
    ) {}

    /**
     * Applies a batch of operations. Safely backs up files, stages edits in editor memory,
     * and acquires concurrency locks to preserve working space integrity.
     */
    public async applyBatch(operations: AnyOperation[]): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) throw new Error('No open workspace found.');
        
        const rootName = workspaceFolders[0].name;
        const rootUri = workspaceFolders[0].uri;
        
        const edit = new vscode.WorkspaceEdit();
        const filesToOpen: vscode.Uri[] = [];
        const pendingDecorations = new Map<string, { uri: vscode.Uri; ranges: vscode.Range[] }>();
        const localCreatedDirs: vscode.Uri[] = [];

        // Step 1: Secure concurrency locks (Batch scale lock coordination)
        const opIds = operations.filter(op => op.status === 'pending').map(op => op.id);
        if (!this.transactionLock.acquireBatch(opIds)) {
            OutputLogger.log('Transaction rejected. Lock held by other operations.', 'WARN');
            for (const op of operations) {
                if (op.status === 'pending') {
                    this.statusCallback(op.id, 'conflict');
                }
            }
            return;
        }

        let batchFailed = false;
        let failReason = '';
        const opAntiActionsMap = new Map<string, AntiAction[]>();

        try {
            // Step 2: Prepare scaffold directories and pre-register them
            for (const op of operations) {
                if (op.status !== 'pending') continue;
                const baseOp = op as any;
                
                if (op.type === 'create_file' || op.type === 'move_path') {
                    const targetPath = op.type === 'create_file' ? baseOp.path : baseOp.destinationPath;
                    const normalized = PathNormalizer.normalize(targetPath, rootName);
                    const targetUri = PathSandbox.validate(normalized);
                    const parentDir = vscode.Uri.joinPath(targetUri, '..');
                    
                    const antiActions: AntiAction[] = [];
                    await this.trackAndCreateDirectory(rootUri, parentDir, antiActions);
                    if (antiActions.length > 0) {
                        opAntiActionsMap.set(op.id, antiActions);
                        for (const act of antiActions) {
                            if (act.type === 'delete_dir_if_empty') {
                                localCreatedDirs.push(act.uri);
                            }
                        }
                    }
                }
            }

            // Step 3: Stage changes and capture live state backups
            for (const op of operations) {
                if (op.status !== 'pending') continue;

                const baseOp = op as any;
                const normalizedPath = PathNormalizer.normalize(baseOp.path, rootName);
                let targetUri: vscode.Uri;
                
                try {
                    targetUri = PathSandbox.validate(normalizedPath);
                } catch (e) {
                    batchFailed = true;
                    failReason = `Path validation failed for ${baseOp.path}`;
                    break;
                }

                const antiActions: AntiAction[] = opAntiActionsMap.get(op.id) || [];

                if (op.type === 'create_file') {
                    edit.createFile(targetUri, { ignoreIfExists: true });
                    edit.insert(targetUri, new vscode.Position(0, 0), op.content);
                    antiActions.push({ type: 'delete_created', uri: targetUri });
                    filesToOpen.push(targetUri);

                    const lineCount = op.content.split(/\r?\n/).length;
                    const createdRange = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(lineCount, 999));
                    pendingDecorations.set(op.id, { uri: targetUri, ranges: [createdRange] });
                } 
                else if (op.type === 'delete_path') {
                    try {
                        await vscode.workspace.fs.stat(targetUri);
                        await this.snapshotService.createSnapshot(rootUri, op.id, normalizedPath, targetUri);
                        
                        edit.deleteFile(targetUri, { ignoreIfNotExists: true, recursive: true });
                        antiActions.push({ type: 'restore_file', uri: targetUri, relativePath: normalizedPath });
                    } catch {
                        OutputLogger.log(`File to delete not found: ${normalizedPath}, skipping.`, 'WARN');
                    }
                }
                else if (op.type === 'move_path') {
                    const normalizedDest = PathNormalizer.normalize(baseOp.destinationPath, rootName);
                    const destUri = PathSandbox.validate(normalizedDest);

                    try {
                        await vscode.workspace.fs.stat(targetUri);
                        await this.snapshotService.createSnapshot(rootUri, op.id, normalizedPath, targetUri);

                        edit.renameFile(targetUri, destUri, { overwrite: true });
                        antiActions.push({ 
                            type: 'restore_move', 
                            sourceUri: targetUri, 
                            destinationUri: destUri, 
                            relativeSourcePath: normalizedPath 
                        });
                        filesToOpen.push(destUri);
                    } catch {
                        batchFailed = true;
                        failReason = `Source file for move not found: ${normalizedPath}`;
                        break;
                    }
                }
                else if (op.type === 'update_file') {
                    let document: vscode.TextDocument;
                    try {
                        document = await vscode.workspace.openTextDocument(targetUri);
                    } catch (e) {
                        batchFailed = true;
                        failReason = `Failed to open document: ${normalizedPath}`;
                        break;
                    }

                    const domainDoc = new VsCodeDocument(document);
                    const matchedBlocks: { range: vscode.Range; replace: string; originalText: string }[] = [];

                    for (const change of op.changes) {
                        const match = this.searchEngine.findMatch(domainDoc, change.search);
                        if (match.status !== 'MATCHED') {
                            batchFailed = true;
                            const reasonText = match.status === 'FAILED' ? match.reason : 'unknown';
                            failReason = `Search match failed in ${normalizedPath}. Reason: ${reasonText}`;
                            break;
                        }
                        const vsRange = new vscode.Range(
                            new vscode.Position(match.range.start.line, match.range.start.character),
                            new vscode.Position(match.range.end.line, match.range.end.character)
                        );
                        matchedBlocks.push({ range: vsRange, replace: change.replace, originalText: change.search });
                    }

                    if (batchFailed) break;

                    await this.snapshotService.createSnapshot(rootUri, op.id, normalizedPath, targetUri);

                    matchedBlocks.sort((a, b) => b.range.start.compareTo(a.range.start));
                    const appliedRanges: vscode.Range[] = [];

                    for (const match of matchedBlocks) {
                        edit.replace(targetUri, match.range, match.replace);
                        const lineDelta = match.replace.split(/\r?\n/).length;
                        const endLine = match.range.start.line + lineDelta - 1;
                        const appliedRange = new vscode.Range(
                            new vscode.Position(match.range.start.line, 0),
                            new vscode.Position(endLine, 999)
                        );
                        appliedRanges.push(appliedRange);
                    }

                    pendingDecorations.set(op.id, { uri: targetUri, ranges: appliedRanges });
                    antiActions.push({ type: 'restore_file', uri: targetUri, relativePath: normalizedPath });
                    filesToOpen.push(targetUri);
                }
                else if (op.type === 'create_dir') {
                    const parentDir = targetUri;
                    await this.trackAndCreateDirectory(rootUri, parentDir, antiActions);
                    for (const act of antiActions) {
                        if (act.type === 'delete_dir_if_empty' && !localCreatedDirs.some(d => d.fsPath === act.uri.fsPath)) {
                            localCreatedDirs.push(act.uri);
                        }
                    }
                }

                if (antiActions.length > 0) {
                    opAntiActionsMap.set(op.id, antiActions);
                }
            }
        } catch (err) {
            batchFailed = true;
            failReason = err instanceof Error ? err.message : 'Unknown core/system failure';
        }

        // Step 4: Handle failure or commit workspace edit
        if (batchFailed) {
            OutputLogger.log(`Batch preparation aborted: ${failReason}`, 'ERROR');
            
            // Cleanup pre-created scaffold directories bottom-up
            localCreatedDirs.sort((a, b) => b.fsPath.length - a.fsPath.length);
            for (const dirUri of localCreatedDirs) {
                try {
                    await vscode.workspace.fs.delete(dirUri, { recursive: false, useTrash: false });
                } catch {
                    // Safe ignore
                }
            }

            // Cleanup any snapshots created during this failed attempt
            for (const op of operations) {
                await this.snapshotService.purgeSnapshotForOp(rootUri, op.id);
                this.transactionLock.release(op.id);
                if (op.status === 'pending') {
                    this.statusCallback(op.id, 'conflict');
                }
            }
            return;
        }

        // Apply edits atomically
        const success = await vscode.workspace.applyEdit(edit);
        if (success) {
            for (const op of operations) {
                if (op.status !== 'pending') continue;
                
                const antiActions = opAntiActionsMap.get(op.id);
                if (antiActions && antiActions.length > 0) {
                    this.store.addTransaction({ operationId: op.id, antiActions });
                    this.statusCallback(op.id, 'applied_dirty');
                    
                    const pending = pendingDecorations.get(op.id);
                    if (pending) {
                        this.decorationService.addDecorations(pending.uri, op.id, pending.ranges);
                    }
                } else {
                    this.statusCallback(op.id, 'saved');
                    this.transactionLock.release(op.id);
                }
            }
            await this.editorService.focusFiles(filesToOpen);
            OutputLogger.log('Transaction applied globally.');
        } else {
            OutputLogger.log('applyEdit failed globally. Transaction rejected.', 'ERROR');
            
            // Clean up directories on workspace edit failure
            localCreatedDirs.sort((a, b) => b.fsPath.length - a.fsPath.length);
            for (const dirUri of localCreatedDirs) {
                try {
                    await vscode.workspace.fs.delete(dirUri, { recursive: false, useTrash: false });
                } catch {
                    // Safe ignore
                }
            }

            for (const op of operations) {
                await this.snapshotService.purgeSnapshotForOp(rootUri, op.id);
                this.transactionLock.release(op.id);
                if (op.status === 'pending') {
                    this.statusCallback(op.id, 'error');
                }
            }
        }
    }

    /**
     * Commits all staged edits. Loads files into document cache to guarantee saves
     * trigger even on closed, out-of-focus editor tabs.
     */
    public async saveBatch(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return;
        const rootUri = workspaceFolders[0].uri;
        
        const txIds = this.store.getAllIds();

        for (const id of txIds) {
            const tx = this.store.getTransaction(id);
            if (!tx) continue;

            for (const act of tx.antiActions) {
                const targetUri = (act as any).uri || (act as any).destinationUri;
                if (!targetUri) continue;

                try {
                    const doc = await vscode.workspace.openTextDocument(targetUri);
                    if (doc.isDirty) {
                        await doc.save();
                    }
                } catch {
                    // Safe ignore for deleted or non-text assets
                }
            }
            this.statusCallback(id, 'saved');
            this.store.clearTransaction(id);
            this.transactionLock.release(id);
            
            await this.snapshotService.purgeSnapshotForOp(rootUri, id);
        }

        this.decorationService.clearAllDecorations();
        OutputLogger.log('Batch saved successfully.');
    }

    /**
     * Reverts all active transactions, restoring files from snapshots and recursively
     * deleting created empty directories bottom-up.
     */
    public async revertBatch(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return;
        const rootUri = workspaceFolders[0].uri;

        const txIds = this.store.getAllIds();
        const edit = new vscode.WorkspaceEdit();
        const directoriesToDelete: vscode.Uri[] = [];

        for (const id of txIds) {
            const tx = this.store.getTransaction(id);
            if (!tx) continue;

            for (let i = tx.antiActions.length - 1; i >= 0; i--) {
                const act = tx.antiActions[i];
                if (act.type === 'delete_created') {
                    edit.deleteFile(act.uri, { ignoreIfNotExists: true });
                } else if (act.type === 'restore_move') {
                    edit.deleteFile(act.destinationUri, { ignoreIfNotExists: true });
                } else if (act.type === 'delete_dir_if_empty') {
                    directoriesToDelete.push(act.uri);
                }
            }
        }

        // Apply file deletions
        await vscode.workspace.applyEdit(edit);

        // Restore file contents from isolated snapshots
        for (const id of txIds) {
            const tx = this.store.getTransaction(id);
            if (!tx) continue;

            for (const act of tx.antiActions) {
                if (act.type === 'restore_file') {
                    await this.snapshotService.restoreSnapshot(rootUri, id, act.relativePath, act.uri);
                } else if (act.type === 'restore_move') {
                    await this.snapshotService.restoreSnapshot(rootUri, id, act.relativeSourcePath, act.sourceUri);
                }
            }
        }

        // Safe bottom-up empty directory removal to prevent recursion overflows
        directoriesToDelete.sort((a, b) => b.fsPath.length - a.fsPath.length);
        for (const dirUri of directoriesToDelete) {
            try {
                const contents = await vscode.workspace.fs.readDirectory(dirUri);
                if (contents.length === 0) {
                    await vscode.workspace.fs.delete(dirUri, { recursive: false, useTrash: false });
                    OutputLogger.log(`Cleaned empty scaffolded directory: ${dirUri.fsPath}`);
                }
            } catch {
                // Directory missing or already cleared, ignore
            }
        }

        // Complete transactions, release locks, and clean snapshots
        for (const id of txIds) {
            this.statusCallback(id, 'reverted');
            this.store.clearTransaction(id);
            this.transactionLock.release(id);
            await this.snapshotService.purgeSnapshotForOp(rootUri, id);
        }

        this.decorationService.clearAllDecorations();
        OutputLogger.log('Batch reverted successfully.');
    }

    /**
     * Traverses upwards to the workspace root to track and create missing directory paths.
     * Registers directory segments to anti-actions for bottom-up revert cleanup.
     */
    private async trackAndCreateDirectory(rootUri: vscode.Uri, targetDir: vscode.Uri, antiActions: AntiAction[]): Promise<void> {
        const rootFsPath = rootUri.fsPath;

        let currentDir = targetDir;
        const missingDirs: vscode.Uri[] = [];

        // Traverse upwards to find non-existent parent directories
        while (currentDir.fsPath.length > rootFsPath.length) {
            try {
                await vscode.workspace.fs.stat(currentDir);
                break; // Directory exists, stop traversal
            } catch {
                missingDirs.push(currentDir);
                currentDir = vscode.Uri.joinPath(currentDir, '..');
            }
        }

        // Create missing directories bottom-to-top (shallowest first)
        for (let i = missingDirs.length - 1; i >= 0; i--) {
            const dirUri = missingDirs[i];
            try {
                await vscode.workspace.fs.createDirectory(dirUri);
                antiActions.push({ type: 'delete_dir_if_empty', uri: dirUri });
                OutputLogger.log(`Created and registered empty parent directory segment: ${dirUri.fsPath}`);
            } catch (e) {
                OutputLogger.log(`Failed to create directory ${dirUri.fsPath}: ${e}`, 'WARN');
            }
        }
    }
}
