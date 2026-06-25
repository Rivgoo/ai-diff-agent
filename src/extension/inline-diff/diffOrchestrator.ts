import * as vscode from 'vscode';
import { DiffOperation, OperationStatus } from '../../shared/models';
import { UndoTracker } from './undoTracker';
import { DecorationManager } from './decorationManager';
import { ActionLensProvider } from './actionLensProvider';
import { BlockMatcher } from './blockMatcher';

/**
 * Coordinates the transactional application of AI code changes into the VS Code Editor.
 * Includes conflict detection for manual user edits.
 */
export class DiffOrchestrator {
    private undoTracker = new UndoTracker();
    private decorationManager = new DecorationManager();
    public lensProvider = new ActionLensProvider();
    
    // Tracks active ranges to detect manual conflicts
    private activeRanges = new Map<string, { uri: vscode.Uri; range: vscode.Range }[]>();
    private isApplyingEdit = false;

    constructor(private readonly statusUpdateCallback: (opId: string, status: OperationStatus) => void) {}

    /**
     * Listens to document changes to detect if a user manually edits a block under AI review.
     */
    public handleDocumentChange(event: vscode.TextDocumentChangeEvent): void {
        if (this.isApplyingEdit || event.contentChanges.length === 0) return;

        const changedDocUri = event.document.uri.toString();

        for (const [opId, ranges] of this.activeRanges.entries()) {
            for (const activeRangeData of ranges) {
                if (activeRangeData.uri.toString() !== changedDocUri) continue;

                // Check if any manual edit intersects with our AI-modified range
                for (const change of event.contentChanges) {
                    if (activeRangeData.range.intersection(change.range)) {
                        // User modified the reviewing block manually!
                        // Remove UI overlays and mark as manual conflict.
                        this.decorationManager.clearDecorations(opId);
                        this.lensProvider.removeLenses(opId);
                        this.undoTracker.clear(opId);
                        this.activeRanges.delete(opId);
                        
                        this.statusUpdateCallback(opId, 'manual_modified');
                        return; // Process one operation conflict at a time
                    }
                }
            }
        }
    }

    public async stageOperations(operations: DiffOperation[]): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return;
        const rootUri = workspaceFolders[0].uri;

        for (const op of operations) {
            if (op.type !== 'update_file') continue;

            const fileUri = vscode.Uri.joinPath(rootUri, op.path);
            let document: vscode.TextDocument;
            
            try {
                document = await vscode.workspace.openTextDocument(fileUri);
            } catch (e) {
                this.statusUpdateCallback(op.id, 'error');
                continue;
            }

            const editor = await vscode.window.showTextDocument(document, { preview: false, preserveFocus: true });
            const edit = new vscode.WorkspaceEdit();
            
            const matchedBlocks = [];
            for (const change of op.changes) {
                const range = BlockMatcher.findMatch(document, change.search);
                if (!range) {
                    this.statusUpdateCallback(op.id, 'conflict');
                    return;
                }
                matchedBlocks.push({ range, replace: change.replace, search: change.search });
            }

            matchedBlocks.sort((a, b) => b.range.start.compareTo(a.range.start));
            const trackedRanges: { uri: vscode.Uri; range: vscode.Range }[] = [];

            for (const match of matchedBlocks) {
                edit.replace(fileUri, match.range, match.replace);

                const lineDelta = match.replace.split('\n').length - match.search.split('\n').length;
                const newEndLine = match.range.end.line + lineDelta;
                const newRange = new vscode.Range(match.range.start.line, 0, newEndLine, 999);

                this.undoTracker.track(op.id, {
                    uri: fileUri,
                    originalText: match.search,
                    appliedRange: newRange
                });

                this.decorationManager.highlightInsertion(op.id, editor, newRange);
                this.lensProvider.addLens(fileUri, op.id, newRange);
                trackedRanges.push({ uri: fileUri, range: newRange });
            }

            // Lock edits to prevent triggering our own change listener
            this.isApplyingEdit = true;
            const success = await vscode.workspace.applyEdit(edit);
            this.isApplyingEdit = false;

            if (success) {
                this.activeRanges.set(op.id, trackedRanges);
                this.statusUpdateCallback(op.id, 'reviewing');
            } else {
                this.statusUpdateCallback(op.id, 'error');
            }
        }
    }

    public async acceptOperation(operationId: string): Promise<void> {
        this.clearTracking(operationId);
        this.statusUpdateCallback(operationId, 'applied');
    }

    public async rejectOperation(operationId: string): Promise<void> {
        const reverts = this.undoTracker.consumeRevertData(operationId);
        if (reverts.length > 0) {
            const edit = new vscode.WorkspaceEdit();
            reverts.sort((a, b) => b.appliedRange.start.compareTo(a.appliedRange.start));
            
            for (const revert of reverts) {
                edit.replace(revert.uri, revert.appliedRange, revert.originalText);
            }
            
            this.isApplyingEdit = true;
            await vscode.workspace.applyEdit(edit);
            this.isApplyingEdit = false;
        }

        this.clearTracking(operationId);
        this.statusUpdateCallback(operationId, 'rejected');
    }

    private clearTracking(operationId: string): void {
        this.decorationManager.clearDecorations(operationId);
        this.lensProvider.removeLenses(operationId);
        this.undoTracker.clear(operationId);
        this.activeRanges.delete(operationId);
    }
}
