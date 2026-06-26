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
import type { OperationStatus, ConflictDetails, ConflictReason, DiffOperation } from '../../shared/models';
import { TransactionLock } from './transactionLock';

// Resilient path resolver domain and adapters
import { ResilientPathResolver } from '../../core/resolver/resilientPathResolver';
import { VsCodeFileSystemAdapter } from '../../infrastructure/adapters/fsTargetAdapter';
import { VsCodeWorkspaceSearchAdapter } from '../../infrastructure/adapters/workspaceSearchAdapter';

/**
 * Orchestrates atomic transactions using the Saga Pattern.
 * Integrates cascading fallback path resolutions seamlessly.
 */
export class TransactionManager {
    private searchEngine = new SearchEngine();
    private snapshotService = new SnapshotService();
    private editorService = new EditorService();
    private transactionLock = new TransactionLock();
    
    // Instantiating the resilient path resolver with physical vscode infrastructure adapters
    private readonly pathResolver = new ResilientPathResolver(
        new VsCodeFileSystemAdapter(),
        new VsCodeWorkspaceSearchAdapter()
    );
    
    constructor(
        private readonly store: CompensationStore,
        private readonly decorationService: DecorationService,
        private readonly statusCallback: (opId: string, status: OperationStatus, metadata?: Partial<DiffOperation>) => void
    ) {}

    /**
     * Applies a batch of operations. Safely backs up files, stages edits in editor memory,
     * and acquires concurrency locks. Resolves relative paths resiliently during pre-flight.
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
        const conflictMap = new Map<string, ConflictDetails>();

        // Step 2: Pre-flight Verification Pass with Resilient Path Resolution
        for (const op of operations) {
            if (op.status !== 'pending') continue;

            const baseOp = op as any;
            const normalizedPath = PathNormalizer.normalize(baseOp.path, rootName);
            let targetUri: vscode.Uri;
            
            try {
                // Execute Cascading Heuristic Path Resolution
                const resolution = await this.pathResolver.resolvePath(normalizedPath);

                // Handling Ambiguous Matching Conflict
                if (resolution.status === 'AMBIGUOUS_MATCH') {
                    batchFailed = true;
                    failReason = `Ambiguous matches found globally for: ${normalizedPath}`;
                    conflictMap.set(op.id, {
                        reason: 'AMBIGUOUS_MATCH',
                        blockIndex: 0,
                        totalBlocks: op.type === 'update_file' ? op.changes.length : 0,
                        searchExcerpt: 'N/A',
                        originalSearchBlock: '',
                        candidatePaths: resolution.candidatePaths
                    });
                    break;
                }

                // Handling Strict File Not Found Errors (only for modifications and deletions)
                if (resolution.status === 'NOT_FOUND') {
                    if (op.type === 'update_file' || op.type === 'delete_path' || op.type === 'move_path') {
                        batchFailed = true;
                        failReason = `File resource not found in workspace: ${normalizedPath}`;
                        conflictMap.set(op.id, {
                            reason: 'FILE_NOT_FOUND',
                            blockIndex: 0,
                            totalBlocks: op.type === 'update_file' ? op.changes.length : 0,
                            searchExcerpt: 'N/A',
                            originalSearchBlock: ''
                        });
                        break;
                    }
                }

                // Inject Resilient Path Warning Metadata on Successful Fallbacks
                if (resolution.status === 'RESOLVED_RESILIENTLY') {
                    baseOp.resolvedResiliently = true;
                    baseOp.originalPath = baseOp.path;
                    baseOp.path = resolution.resolvedPath; // Dynamically update file write destination
                    OutputLogger.log(`Resiliently resolved path mapping: ${normalizedPath} -> ${resolution.resolvedPath}`, 'WARN');
                }

                const finalPath = PathNormalizer.normalize(baseOp.path, rootName);
                targetUri = PathSandbox.validate(finalPath);
            } catch (e) {
                batchFailed = true;
                failReason = `Path resolution or traversal validation failed: ${e instanceof Error ? e.message : 'Unknown error'}`;
                conflictMap.set(op.id, {
                    reason: 'PATH_TRAVERSAL',
                    blockIndex: 0,
                    totalBlocks: 0,
                    searchExcerpt: 'N/A',
                    originalSearchBlock: ''
                });
                break;
            }

            if (op.type === 'update_file') {
                let document: vscode.TextDocument;
                try {
                    document = await vscode.workspace.openTextDocument(targetUri);
                } catch (e) {
                    batchFailed = true;
                    failReason = `Failed to open document: ${targetUri.fsPath}`;
                    conflictMap.set(op.id, {
                        reason: 'FILE_NOT_FOUND',
                        blockIndex: 0,
                        totalBlocks: op.changes.length,
                        searchExcerpt: 'N/A',
                        originalSearchBlock: ''
                    });
                    break;
                }

                const domainDoc = new VsCodeDocument(document);

                for (let i = 0; i < op.changes.length; i++) {
                    const change = op.changes[i];
                    const match = this.searchEngine.findMatch(domainDoc, change.search);
                    if (match.status !== 'MATCHED') {
                        batchFailed = true;
                        const reasonText = match.status === 'FAILED' ? match.reason : 'unknown';
                        failReason = `Search match failed in ${targetUri.fsPath}. Reason: ${reasonText}`;
                        
                        const reasonCode: ConflictReason = match.status === 'FAILED' && 
                            (match.reason === 'NOT_FOUND' || match.reason === 'AMBIGUOUS_MATCH')
                            ? match.reason
                            : 'UNKNOWN';

                        conflictMap.set(op.id, {
                            reason: reasonCode,
                            blockIndex: i + 1,
                            totalBlocks: op.changes.length,
                            searchExcerpt: change.search.split(/\r?\n/).slice(0, 3).join('\n'),
                            originalSearchBlock: change.search,
                            matchesFound: match.status === 'FAILED' ? match.matchesFound : undefined
                        });
                        break;
                    }
                }
                if (batchFailed) break;
            } else if (op.type === 'move_path') {
                try {
                    await vscode.workspace.fs.stat(targetUri);
                } catch {
                    batchFailed = true;
                    failReason = `Source file for move not found: ${targetUri.fsPath}`;
                    conflictMap.set(op.id, {
                        reason: 'FILE_NOT_FOUND',
                        blockIndex: 0,
                        totalBlocks: 0,
                        searchExcerpt: 'N/A',
                        originalSearchBlock: ''
                    });
                    break;
                }
            }
        }

        // Step 3: Handle Pre-flight failure (Instant Atomic Abort)
        if (batchFailed) {
            OutputLogger.log(`Pre-flight checks failed. Aborting batch transaction: ${failReason}`, 'ERROR');
            
            for (const op of operations) {
                this.transactionLock.release(op.id);
                if (op.status === 'pending') {
                    const conflictData = conflictMap.get(op.id);
                    const baseOp = op as any;
                    
                    if (conflictData) {
                        op.conflict = conflictData;
                        op.errorMessage = failReason;
                        this.statusCallback(op.id, 'conflict', {
                            conflict: conflictData,
                            resolvedResiliently: baseOp.resolvedResiliently,
                            originalPath: baseOp.originalPath,
                            path: baseOp.path
                        });
                    } else {
                        op.errorMessage = 'Transaction aborted due to conflict in other files of this batch.';
                        this.statusCallback(op.id, 'conflict', { // Fixed: Changed from 'error' to 'conflict'
                            resolvedResiliently: baseOp.resolvedResiliently,
                            originalPath: baseOp.originalPath,
                            path: baseOp.path
                        });
                    }
                }
            }
            return;
        }

        // Step 4: Execute workspace modifications safely since pre-flight passed
        try {
            // Scaffold directories first
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

            // Populate workspace edits
            for (const op of operations) {
                if (op.status !== 'pending') continue;

                const baseOp = op as any;
                const normalizedPath = PathNormalizer.normalize(baseOp.path, rootName);
                const targetUri = PathSandbox.validate(normalizedPath);
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

                    await this.snapshotService.createSnapshot(rootUri, op.id, normalizedPath, targetUri);

                    edit.renameFile(targetUri, destUri, { overwrite: true });
                    antiActions.push({ 
                        type: 'restore_move', 
                        sourceUri: targetUri, 
                        destinationUri: destUri, 
                        relativeSourcePath: normalizedPath 
                    });
                    filesToOpen.push(destUri);
                }
                else if (op.type === 'update_file') {
                    const document = await vscode.workspace.openTextDocument(targetUri);
                    const domainDoc = new VsCodeDocument(document);
                    const matchedBlocks: { range: vscode.Range; replace: string; originalText: string }[] = [];

                    for (const change of op.changes) {
                        const match = this.searchEngine.findMatch(domainDoc, change.search);
                        if (match.status === 'MATCHED') {
                            const vsRange = new vscode.Range(
                                new vscode.Position(match.range.start.line, match.range.start.character),
                                new vscode.Position(match.range.end.line, match.range.end.character)
                            );
                            matchedBlocks.push({ range: vsRange, replace: change.replace, originalText: change.search });
                        }
                    }

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

            // Step 5: Commit workspace edit
            const success = await vscode.workspace.applyEdit(edit);
            if (success) {
                for (const op of operations) {
                    if (op.status !== 'pending') continue;
                    
                    const baseOp = op as any;
                    const antiActions = opAntiActionsMap.get(op.id);
                    if (antiActions && antiActions.length > 0) {
                        this.store.addTransaction({ operationId: op.id, antiActions });
                        
                        this.statusCallback(op.id, 'applied_dirty', {
                            resolvedResiliently: baseOp.resolvedResiliently,
                            originalPath: baseOp.originalPath,
                            path: baseOp.path
                        });
                        
                        const pending = pendingDecorations.get(op.id);
                        if (pending) {
                            this.decorationService.addDecorations(pending.uri, op.id, pending.ranges);
                        }
                    } else {
                        this.statusCallback(op.id, 'saved', {
                            resolvedResiliently: baseOp.resolvedResiliently,
                            originalPath: baseOp.originalPath,
                            path: baseOp.path
                        });
                        this.transactionLock.release(op.id);
                    }
                }
                await this.editorService.focusFiles(filesToOpen);
                OutputLogger.log('Transaction applied globally.');
            } else {
                throw new Error('Workspace applyEdit failed globally.');
            }
        } catch (err) {
            OutputLogger.log(`Failed to execute workspace modifications: ${err}`, 'ERROR');
            
            // Clean up scaffolded directories
            localCreatedDirs.sort((a, b) => b.fsPath.length - a.fsPath.length);
            for (const dirUri of localCreatedDirs) {
                try {
                    await vscode.workspace.fs.delete(dirUri, { recursive: false, useTrash: false });
                } catch {
                    // Fail-safe ignore
                }
            }

            for (const op of operations) {
                await this.snapshotService.purgeSnapshotForOp(rootUri, op.id);
                this.transactionLock.release(op.id);
                const baseOp = op as any;
                if (op.status === 'pending') {
                    op.errorMessage = err instanceof Error ? err.message : 'Unknown write/edit error';
                    this.statusCallback(op.id, 'error', {
                        errorMessage: op.errorMessage,
                        resolvedResiliently: baseOp.resolvedResiliently,
                        originalPath: baseOp.originalPath,
                        path: baseOp.path
                    });
                }
            }
        }
    }

    /**
     * Commits all staged edits.
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
     * Reverts all active transactions, restoring files from snapshots.
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
