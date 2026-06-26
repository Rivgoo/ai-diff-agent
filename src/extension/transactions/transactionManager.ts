import * as vscode from 'vscode';
import type { AnyOperation } from '../../core/models/operations';
import { 
    isCreateFileOperation, 
    isUpdateFileOperation, 
    isDeletePathOperation, 
    isMovePathOperation, 
    isCreateDirOperation 
} from '../../core/models/operations';
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
import { ResilientPathResolver } from '../../core/resolver/resilientPathResolver';
import { VsCodeFileSystemAdapter } from '../../infrastructure/adapters/fsTargetAdapter';
import { VsCodeWorkspaceSearchAdapter } from '../../infrastructure/adapters/workspaceSearchAdapter';
import { DirectoryCleanupService } from './directoryCleanupService';

interface PreFlightResult {
    success: boolean;
    failReason: string;
    conflictMap: Map<string, ConflictDetails>;
    opCandidatesMap: Map<string, string[]>;
}

export class TransactionManager {
    private readonly searchEngine = new SearchEngine();
    private readonly snapshotService = new SnapshotService();
    private readonly editorService = new EditorService();
    private readonly transactionLock = new TransactionLock();
    private readonly directoryCleanupService = new DirectoryCleanupService();
    
    private readonly pathResolver = new ResilientPathResolver(
        new VsCodeFileSystemAdapter(),
        new VsCodeWorkspaceSearchAdapter()
    );
    
    constructor(
        private readonly store: CompensationStore,
        private readonly decorationService: DecorationService,
        private readonly statusCallback: (opId: string, status: OperationStatus, metadata?: Partial<DiffOperation>) => void
    ) {}

    public async applyBatch(operations: AnyOperation[]): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) throw new Error('No open workspace found.');
        
        const rootName = workspaceFolders[0].name;
        const rootUri = workspaceFolders[0].uri;

        const pendingOpIds = operations.filter(op => op.status === 'pending').map(op => op.id);
        if (!this.transactionLock.acquireBatch(pendingOpIds)) {
            OutputLogger.log('Transaction rejected. Lock held by other operations.', 'WARN');
            this.abortBatch(operations, 'Lock held by other operations.', new Map());
            return;
        }

        const preFlightResult = await this.executePreFlight(operations, rootName);

        if (!preFlightResult.success) {
            OutputLogger.log(`Pre-flight checks failed: ${preFlightResult.failReason}`, 'ERROR');
            this.abortBatch(operations, preFlightResult.failReason, preFlightResult.conflictMap);
            return;
        }

        await this.executeModifications(operations, rootUri, rootName, preFlightResult.opCandidatesMap);
    }

    private async executePreFlight(operations: AnyOperation[], rootName: string): Promise<PreFlightResult> {
        const conflictMap = new Map<string, ConflictDetails>();
        const opCandidatesMap = new Map<string, string[]>();

        for (const op of operations) {
            if (op.status !== 'pending') continue;

            const normalizedPath = PathNormalizer.normalize(op.path, rootName);
            let targetUri: vscode.Uri;
            
            try {
                const resolution = await this.pathResolver.resolvePath(normalizedPath);

                if (resolution.status === 'AMBIGUOUS_MATCH') {
                    conflictMap.set(op.id, this.buildConflict('AMBIGUOUS_MATCH', op, resolution.candidatePaths));
                    return { success: false, failReason: 'Ambiguous matches found.', conflictMap, opCandidatesMap };
                }

                if (resolution.status === 'NOT_FOUND' && (isUpdateFileOperation(op) || isDeletePathOperation(op) || isMovePathOperation(op))) {
                    conflictMap.set(op.id, this.buildConflict('FILE_NOT_FOUND', op));
                    return { success: false, failReason: `File not found: ${normalizedPath}`, conflictMap, opCandidatesMap };
                }

                if (resolution.status === 'RESOLVED_RESILIENTLY') {
                    (op as any).resolvedResiliently = true;
                    (op as any).originalPath = op.path;
                    (op as any).path = resolution.resolvedPath;
                }

                const finalPath = PathNormalizer.normalize(op.path, rootName);
                targetUri = PathSandbox.validate(finalPath);
            } catch (e) {
                conflictMap.set(op.id, this.buildConflict('PATH_TRAVERSAL', op));
                return { success: false, failReason: 'Path traversal validation failed.', conflictMap, opCandidatesMap };
            }

            if (isUpdateFileOperation(op)) {
                let document: vscode.TextDocument;
                try {
                    document = await vscode.workspace.openTextDocument(targetUri);
                } catch (e) {
                    conflictMap.set(op.id, this.buildConflict('FILE_NOT_FOUND', op));
                    return { success: false, failReason: `Failed to open document: ${targetUri.fsPath}`, conflictMap, opCandidatesMap };
                }

                const domainDoc = new VsCodeDocument(document);

                for (let i = 0; i < op.changes.length; i++) {
                    const change = op.changes[i];
                    const match = this.searchEngine.findMatch(domainDoc, change.search);
                    
                    if (match.status !== 'MATCHED') {
                        const reasonCode: ConflictReason = match.reason === 'AMBIGUOUS_MATCH' ? 'AMBIGUOUS_MATCH' : 'NOT_FOUND';
                        conflictMap.set(op.id, {
                            reason: reasonCode,
                            blockIndex: i + 1,
                            totalBlocks: op.changes.length,
                            searchExcerpt: change.search.split(/\r?\n/).slice(0, 3).join('\n'),
                            originalSearchBlock: change.search,
                            matchesFound: match.matchesFound
                        });
                        return { success: false, failReason: `Search match failed. Reason: ${match.reason}`, conflictMap, opCandidatesMap };
                    }
                }
            } else if (isMovePathOperation(op)) {
                try {
                    await vscode.workspace.fs.stat(targetUri);
                } catch {
                    conflictMap.set(op.id, this.buildConflict('FILE_NOT_FOUND', op));
                    return { success: false, failReason: `Source file not found: ${targetUri.fsPath}`, conflictMap, opCandidatesMap };
                }
            }

            if (isDeletePathOperation(op) || isMovePathOperation(op)) {
                const opCandidates: string[] = [];
                let currentDir = normalizedPath.split('/').slice(0, -1).join('/');
                while (currentDir) {
                    opCandidates.push(currentDir);
                    currentDir = currentDir.split('/').slice(0, -1).join('/');
                }
                if (opCandidates.length > 0) {
                    opCandidatesMap.set(op.id, opCandidates);
                }
            }
        }

        return { success: true, failReason: '', conflictMap, opCandidatesMap };
    }

    private async executeModifications(
        operations: AnyOperation[], 
        rootUri: vscode.Uri, 
        rootName: string,
        opCandidatesMap: Map<string, string[]>
    ): Promise<void> {
        const edit = new vscode.WorkspaceEdit();
        const filesToOpen: vscode.Uri[] = [];
        const pendingDecorations = new Map<string, { uri: vscode.Uri; ranges: vscode.Range[] }>();
        const localCreatedDirs: vscode.Uri[] = [];
        const opAntiActionsMap = new Map<string, AntiAction[]>();

        try {
            for (const op of operations) {
                if (op.status !== 'pending') continue;
                
                const antiActions: AntiAction[] = [];
                
                if (isCreateFileOperation(op) || isMovePathOperation(op) || isCreateDirOperation(op)) {
                    const targetPath = isMovePathOperation(op) ? op.destinationPath : op.path;
                    const normalized = PathNormalizer.normalize(targetPath, rootName);
                    const targetUri = PathSandbox.validate(normalized);
                    const parentDir = isCreateDirOperation(op) ? targetUri : vscode.Uri.joinPath(targetUri, '..');
                    
                    await this.trackAndCreateDirectory(rootUri, parentDir, antiActions);
                    
                    for (const act of antiActions) {
                        if (act.type === 'delete_dir_if_empty') {
                            localCreatedDirs.push(act.uri);
                        }
                    }
                }
                opAntiActionsMap.set(op.id, antiActions);
            }

            for (const op of operations) {
                if (op.status !== 'pending') continue;

                const normalizedPath = PathNormalizer.normalize(op.path, rootName);
                const targetUri = PathSandbox.validate(normalizedPath);
                
                // ВИПРАВЛЕННЯ: Безпечно отримуємо масив бекапів зі словника, або створюємо новий і ЗБЕРІГАЄМО його
                let antiActions = opAntiActionsMap.get(op.id);
                if (!antiActions) {
                    antiActions = [];
                    opAntiActionsMap.set(op.id, antiActions);
                }

                if (isCreateFileOperation(op)) {
                    edit.createFile(targetUri, { ignoreIfExists: true });
                    edit.insert(targetUri, new vscode.Position(0, 0), op.content);
                    antiActions.push({ type: 'delete_created', uri: targetUri });
                    filesToOpen.push(targetUri);

                    const lineCount = op.content.split(/\r?\n/).length;
                    pendingDecorations.set(op.id, { 
                        uri: targetUri, 
                        ranges: [new vscode.Range(new vscode.Position(0, 0), new vscode.Position(lineCount, 999))] 
                    });
                } 
                else if (isDeletePathOperation(op)) {
                    try {
                        await vscode.workspace.fs.stat(targetUri);
                        await this.snapshotService.createSnapshot(rootUri, op.id, normalizedPath, targetUri);
                        edit.deleteFile(targetUri, { ignoreIfNotExists: true, recursive: true });
                        antiActions.push({ type: 'restore_file', uri: targetUri, relativePath: normalizedPath });
                    } catch { /* ignore */ }
                }
                else if (isMovePathOperation(op)) {
                    const normalizedDest = PathNormalizer.normalize(op.destinationPath, rootName);
                    const destUri = PathSandbox.validate(normalizedDest);
                    await this.snapshotService.createSnapshot(rootUri, op.id, normalizedPath, targetUri);
                    edit.renameFile(targetUri, destUri, { overwrite: true });
                    antiActions.push({ type: 'restore_move', sourceUri: targetUri, destinationUri: destUri, relativeSourcePath: normalizedPath });
                    filesToOpen.push(destUri);
                }
                else if (isUpdateFileOperation(op)) {
                    const document = await vscode.workspace.openTextDocument(targetUri);
                    const domainDoc = new VsCodeDocument(document);
                    const matchedBlocks: { range: vscode.Range; replace: string }[] = [];

                    for (const change of op.changes) {
                        const match = this.searchEngine.findMatch(domainDoc, change.search);
                        if (match.status === 'MATCHED') {
                            matchedBlocks.push({ 
                                range: new vscode.Range(match.range.start.line, match.range.start.character, match.range.end.line, match.range.end.character),
                                replace: change.replace 
                            });
                        }
                    }

                    await this.snapshotService.createSnapshot(rootUri, op.id, normalizedPath, targetUri);
                    matchedBlocks.sort((a, b) => b.range.start.compareTo(a.range.start));
                    const appliedRanges: vscode.Range[] = [];

                    for (const match of matchedBlocks) {
                        edit.replace(targetUri, match.range, match.replace);
                        const lineDelta = match.replace.split(/\r?\n/).length;
                        appliedRanges.push(new vscode.Range(match.range.start.line, 0, match.range.start.line + lineDelta - 1, 999));
                    }

                    pendingDecorations.set(op.id, { uri: targetUri, ranges: appliedRanges });
                    antiActions.push({ type: 'restore_file', uri: targetUri, relativePath: normalizedPath });
                    filesToOpen.push(targetUri);
                }
            }

            const success = await vscode.workspace.applyEdit(edit);
            if (!success) {
                throw new Error('Workspace applyEdit failed globally.');
            }

            const allCandidates = Array.from(opCandidatesMap.values()).flat();
            const cleanedDirs = await this.directoryCleanupService.cleanupEmptyDirectories(allCandidates, rootUri);

            for (const dirUri of cleanedDirs) {
                const relativeDir = PathNormalizer.normalize(dirUri.fsPath, rootName);
                for (const [opId, candidates] of opCandidatesMap.entries()) {
                    if (candidates.includes(relativeDir)) {
                        opAntiActionsMap.get(opId)?.push({ type: 'restore_dir', uri: dirUri });
                        break;
                    }
                }
            }

            for (const op of operations) {
                if (op.status !== 'pending') continue;
                
                const antiActions = opAntiActionsMap.get(op.id) || [];
                const resProps = (op as any).resolvedResiliently ? {
                    resolvedResiliently: true,
                    originalPath: (op as any).originalPath,
                    path: op.path
                } : {};

                if (antiActions.length > 0) {
                    this.store.addTransaction({ operationId: op.id, antiActions });
                    this.statusCallback(op.id, 'applied_dirty', resProps);
                    
                    const pending = pendingDecorations.get(op.id);
                    if (pending) {
                        this.decorationService.addDecorations(pending.uri, op.id, pending.ranges);
                    }
                } else {
                    this.statusCallback(op.id, 'saved', resProps);
                    this.transactionLock.release(op.id);
                }
            }

            await this.editorService.focusFiles(filesToOpen);
            OutputLogger.log('Transaction applied globally.');

        } catch (err) {
            OutputLogger.log(`Failed to execute workspace modifications: ${err}`, 'ERROR');
            
            localCreatedDirs.sort((a, b) => b.fsPath.length - a.fsPath.length);
            for (const dirUri of localCreatedDirs) {
                try {
                    await vscode.workspace.fs.delete(dirUri, { recursive: false, useTrash: false });
                } catch { /* ignore */ }
            }

            for (const op of operations) {
                await this.snapshotService.purgeSnapshotForOp(rootUri, op.id);
                this.transactionLock.release(op.id);
                if (op.status === 'pending') {
                    op.errorMessage = err instanceof Error ? err.message : 'Unknown write/edit error';
                    this.statusCallback(op.id, 'error', { errorMessage: op.errorMessage });
                }
            }
        }
    }

    private abortBatch(operations: AnyOperation[], failReason: string, conflictMap: Map<string, ConflictDetails>): void {
        for (const op of operations) {
            this.transactionLock.release(op.id);
            if (op.status === 'pending') {
                const conflictData = conflictMap.get(op.id);
                op.errorMessage = conflictData ? failReason : 'Transaction aborted due to conflict in other files.';
                
                const meta: Partial<DiffOperation> = { conflict: conflictData };
                if ((op as any).resolvedResiliently) {
                    meta.resolvedResiliently = true;
                    meta.originalPath = (op as any).originalPath;
                    meta.path = op.path;
                }
                this.statusCallback(op.id, 'conflict', meta);
            }
        }
    }

    private buildConflict(reason: ConflictReason, op: AnyOperation, candidates?: string[]): ConflictDetails {
        return {
            reason,
            blockIndex: 0,
            totalBlocks: isUpdateFileOperation(op) ? op.changes.length : 0,
            searchExcerpt: 'N/A',
            originalSearchBlock: '',
            candidatePaths: candidates
        };
    }

    public async saveBatch(): Promise<void> {
        const txIds = this.store.getAllIds();
        for (const id of txIds) {
            await this.saveOperation(id);
        }
        OutputLogger.log('Batch saved successfully.');
    }

    public async revertBatch(): Promise<void> {
        const txIds = this.store.getAllIds();
        for (const id of txIds) {
            await this.revertOperation(id);
        }
        OutputLogger.log('Batch reverted successfully.');
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
            } catch { /* ignore */ }
        }

        this.statusCallback(opId, 'saved');
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
                if (contents.length === 0) await vscode.workspace.fs.delete(dirUri, { recursive: false, useTrash: false });
            } catch { /* ignore */ }
        }

        directoriesToRestore.sort((a, b) => a.fsPath.length - b.fsPath.length);
        for (const dirUri of directoriesToRestore) {
            try { await vscode.workspace.fs.createDirectory(dirUri); } catch { /* ignore */ }
        }

        for (const act of tx.antiActions) {
            if (act.type === 'restore_file') await this.snapshotService.restoreSnapshot(rootUri, opId, act.relativePath, act.uri);
            else if (act.type === 'restore_move') await this.snapshotService.restoreSnapshot(rootUri, opId, act.relativeSourcePath, act.sourceUri);
        }

        this.statusCallback(opId, 'reverted');
        this.store.clearTransaction(opId);
        this.transactionLock.release(opId);
        this.decorationService.clearDecorationsForOp(opId);
        await this.snapshotService.purgeSnapshotForOp(rootUri, opId);
    }

    private async trackAndCreateDirectory(rootUri: vscode.Uri, targetDir: vscode.Uri, antiActions: AntiAction[]): Promise<void> {
        const rootFsPath = rootUri.fsPath;
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
                antiActions.push({ type: 'delete_dir_if_empty', uri: dirUri });
            } catch { /* Ignore */ }
        }
    }
}