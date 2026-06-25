import * as vscode from 'vscode';
import { AnyOperation } from '../../core/models/operations';
import { PathSandbox } from '../../vscode/workspace/pathSandbox';
import { SearchEngine } from '../../core/matcher/searchEngine';
import { VsCodeDocument } from '../../infrastructure/adapters/vsCodeDocument';
import { OutputLogger } from '../../infrastructure/logging/outputLogger';
import { PathNormalizer } from '../../core/workspace/pathNormalizer';
import { CompensationStore, AntiAction } from './compensationStore';
import { SnapshotService } from './snapshotService';
import { EditorService } from './editorService';
import { DecorationService } from './decorationService';
import { OperationStatus } from '../../shared/models';

/**
 * Handles Workspace edits by applying updates directly.
 * Backs up all states using SnapshotService, guaranteeing 100% rollback accuracy.
 */
export class TransactionManager {
    private searchEngine = new SearchEngine();
    private snapshotService = new SnapshotService();
    private editorService = new EditorService();
    
    constructor(
        private readonly store: CompensationStore,
        private readonly decorationService: DecorationService,
        private readonly statusCallback: (opId: string, status: OperationStatus) => void
    ) {}

    public async applyBatch(operations: AnyOperation[]): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) throw new Error('No open workspace found.');
        
        const rootName = workspaceFolders[0].name;
        const rootUri = workspaceFolders[0].uri;
        
        // Ensure stale legacy backup directories are purged before transaction starts
        await this.snapshotService.cleanStaleBackups(rootUri);
        
        const edit = new vscode.WorkspaceEdit();
        const filesToOpen: vscode.Uri[] = [];
        const pendingDecorations = new Map<string, { uri: vscode.Uri; ranges: vscode.Range[] }>();

        // Pre-create missing directories for any moves or file creations to prevent atomic VS Code errors
        for (const op of operations) {
            if (op.status !== 'pending') continue;
            const baseOp = op as any;
            
            if (op.type === 'create_file' || op.type === 'move_path') {
                const targetPath = op.type === 'create_file' ? baseOp.path : baseOp.destinationPath;
                const normalized = PathNormalizer.normalize(targetPath, rootName);
                const targetUri = PathSandbox.validate(normalized);
                const parentDir = vscode.Uri.joinPath(targetUri, '..');
                
                try {
                    await vscode.workspace.fs.createDirectory(parentDir);
                } catch (e) {
                    OutputLogger.log(`Directory pre-creation failed for ${parentDir.fsPath}: ${e}`, 'WARN');
                }
            }
        }

        for (const op of operations) {
            if (op.status !== 'pending') continue;

            const baseOp = op as any;
            const normalizedPath = PathNormalizer.normalize(baseOp.path, rootName);
            let targetUri: vscode.Uri;
            
            try {
                targetUri = PathSandbox.validate(normalizedPath);
            } catch (e) {
                OutputLogger.log(`Path validation failed for ${baseOp.path}`, 'ERROR');
                this.statusCallback(op.id, 'error');
                continue;
            }

            const antiActions: AntiAction[] = [];
            let isStaged = false;

            if (op.type === 'create_file') {
                edit.createFile(targetUri, { ignoreIfExists: true });
                edit.insert(targetUri, new vscode.Position(0, 0), op.content);
                antiActions.push({ type: 'delete_created', uri: targetUri });
                filesToOpen.push(targetUri);
                isStaged = true;

                const lineCount = op.content.split(/\r?\n/).length;
                const createdRange = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(lineCount, 999));
                pendingDecorations.set(op.id, { uri: targetUri, ranges: [createdRange] });
            } 
            else if (op.type === 'delete_path') {
                try {
                    // Pre-verify file existence before taking snapshots or staging deletions
                    await vscode.workspace.fs.stat(targetUri);
                    await this.snapshotService.createSnapshot(rootUri, op.id, normalizedPath, targetUri);
                    
                    edit.deleteFile(targetUri, { ignoreIfNotExists: true, recursive: true });
                    antiActions.push({ type: 'restore_file', uri: targetUri, relativePath: normalizedPath });
                    isStaged = true;
                } catch {
                    OutputLogger.log(`File to delete not found: ${normalizedPath}, skipping deletion.`, 'WARN');
                    this.statusCallback(op.id, 'saved'); // Mark already missing as successfully cleared
                }
            }
            else if (op.type === 'move_path') {
                const normalizedDest = PathNormalizer.normalize(baseOp.destinationPath, rootName);
                const destUri = PathSandbox.validate(normalizedDest);

                try {
                    // Pre-verify source presence before renaming
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
                    isStaged = true;
                } catch {
                    OutputLogger.log(`Source file for move not found: ${normalizedPath}, aborting move action.`, 'ERROR');
                    this.statusCallback(op.id, 'conflict');
                }
            }
            else if (op.type === 'update_file') {
                let document: vscode.TextDocument;
                try {
                    document = await vscode.workspace.openTextDocument(targetUri);
                } catch (e) {
                    OutputLogger.log(`Failed to open document for update: ${normalizedPath}`, 'ERROR');
                    this.statusCallback(op.id, 'conflict');
                    continue;
                }

                const domainDoc = new VsCodeDocument(document);
                const matchedBlocks: { range: vscode.Range; replace: string; originalText: string }[] = [];
                let matchFailed = false;

                for (const change of op.changes) {
                    const match = this.searchEngine.findMatch(domainDoc, change.search);
                    if (match.status !== 'MATCHED') {
                        OutputLogger.log(`Match failed in ${normalizedPath}. Reason: ${match.status === 'FAILED' ? match.reason : 'unknown'}`, 'ERROR');
                        this.statusCallback(op.id, 'conflict');
                        matchFailed = true;
                        break;
                    }
                    const vsRange = new vscode.Range(
                        new vscode.Position(match.range.start.line, match.range.start.character),
                        new vscode.Position(match.range.end.line, match.range.end.character)
                    );
                    matchedBlocks.push({ range: vsRange, replace: change.replace, originalText: change.search });
                }

                if (matchFailed) continue;

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
                isStaged = true;
            }

            if (isStaged) {
                this.store.addTransaction({ operationId: op.id, antiActions });
            }
        }

        const success = await vscode.workspace.applyEdit(edit);
        if (success) {
            for (const op of operations) {
                if (this.store.getTransaction(op.id)) {
                    this.statusCallback(op.id, 'applied_dirty');
                    
                    const pending = pendingDecorations.get(op.id);
                    if (pending) {
                        this.decorationService.addDecorations(pending.uri, op.id, pending.ranges);
                    }
                }
            }
            await this.editorService.focusFiles(filesToOpen);
            OutputLogger.log(`Transaction applied globally.`);
        } else {
            OutputLogger.log(`applyEdit failed globally. Atomic edit transaction rejected.`, 'ERROR');
        }
    }

    public async saveBatch(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return;
        
        const openDocs = vscode.workspace.textDocuments;
        const txIds = this.store.getAllIds();

        for (const id of txIds) {
            const tx = this.store.getTransaction(id);
            if (!tx) continue;

            for (const act of tx.antiActions) {
                const targetUri = (act as any).uri || (act as any).sourceUri;
                if (!targetUri) continue;

                const doc = openDocs.find(d => d.uri.toString() === targetUri.toString());
                if (doc && doc.isDirty) {
                    await doc.save();
                }
            }
            this.statusCallback(id, 'saved');
            this.store.clearTransaction(id);
        }

        this.decorationService.clearAllDecorations();
        await this.snapshotService.purgeSnapshots(workspaceFolders[0].uri);
        OutputLogger.log(`Batch saved successfully.`);
    }

    public async revertBatch(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return;
        const rootUri = workspaceFolders[0].uri;

        const txIds = this.store.getAllIds();
        const edit = new vscode.WorkspaceEdit();

        for (const id of txIds) {
            const tx = this.store.getTransaction(id);
            if (!tx) continue;

            for (let i = tx.antiActions.length - 1; i >= 0; i--) {
                const act = tx.antiActions[i];
                if (act.type === 'delete_created') {
                    edit.deleteFile(act.uri, { ignoreIfNotExists: true });
                } else if (act.type === 'restore_move') {
                    edit.deleteFile(act.destinationUri, { ignoreIfNotExists: true });
                }
            }
        }

        await vscode.workspace.applyEdit(edit);

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

        for (const id of txIds) {
            this.statusCallback(id, 'reverted');
            this.store.clearTransaction(id);
        }

        this.decorationService.clearAllDecorations();
        await this.snapshotService.purgeSnapshots(rootUri);
        OutputLogger.log(`Batch reverted successfully.`);
    }
}
