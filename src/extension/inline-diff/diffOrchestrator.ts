import * as vscode from 'vscode';
import { DiffOperation, OperationStatus } from '../../shared/models';
import { UndoTracker } from './undoTracker';
import { DecorationManager } from './decorationManager';
import { ActionLensProvider } from './actionLensProvider';
import { SearchEngine } from '../../core/matcher/searchEngine';
import { VsCodeDocument } from '../../infrastructure/adapters/vsCodeDocument';
import { PathSandbox } from '../../vscode/workspace/pathSandbox';
import { OutputLogger } from '../../infrastructure/logging/outputLogger';

/**
 * Coordinates the transactional application of AI code changes into the VS Code Editor.
 * Uses the canonical SearchEngine (not BlockMatcher) for all matching.
 * Conflict detection guards against manual user edits during review.
 */
export class DiffOrchestrator {
    private undoTracker = new UndoTracker();
    private decorationManager = new DecorationManager();
    public lensProvider = new ActionLensProvider();
    private searchEngine = new SearchEngine();

    // Tracks active ranges to detect manual conflicts
    private activeRanges = new Map<string, { uri: vscode.Uri; range: vscode.Range }[]>();

    // Fix §3.7: Replace boolean with Set to handle concurrent async edits correctly
    private inFlightEditIds = new Set<string>();

    constructor(private readonly statusUpdateCallback: (opId: string, status: OperationStatus) => void) {}

    /**
     * Listens to document changes to detect if a user manually edits a block under AI review.
     */
    public handleDocumentChange(event: vscode.TextDocumentChangeEvent): void {
        // Suppress conflict detection for any edit we are currently applying
        if (this.inFlightEditIds.size > 0 || event.contentChanges.length === 0) return;

        const changedDocUri = event.document.uri.toString();

        for (const [opId, ranges] of this.activeRanges.entries()) {
            for (const activeRangeData of ranges) {
                if (activeRangeData.uri.toString() !== changedDocUri) continue;

                for (const change of event.contentChanges) {
                    if (activeRangeData.range.intersection(change.range)) {
                        OutputLogger.log(`Manual edit conflict detected for operation ${opId}`, 'WARN');
                        this.decorationManager.clearDecorations(opId);
                        this.lensProvider.removeLenses(opId);
                        this.undoTracker.clear(opId);
                        this.activeRanges.delete(opId);
                        this.statusUpdateCallback(opId, 'manual_modified');
                        return;
                    }
                }
            }
        }
    }

    public async stageOperations(operations: DiffOperation[]): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            OutputLogger.log('stageOperations called with no workspace open', 'WARN');
            return;
        }

        for (const op of operations) {
            if (op.type !== 'update_file') {
                // Non-update operations are registered for deferred commit on accept
                // They don't need staging in the editor — mark as pending (unchanged)
                OutputLogger.log(`Operation ${op.id} (${op.type}) registered for deferred commit`, 'INFO');
                continue;
            }

            // Validate path is within workspace boundary
            let fileUri: vscode.Uri;
            try {
                fileUri = PathSandbox.validate(op.path);
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                OutputLogger.log(`Path validation failed for ${op.path}: ${msg}`, 'ERROR');
                this.statusUpdateCallback(op.id, 'error');
                continue;
            }

            let document: vscode.TextDocument;
            try {
                document = await vscode.workspace.openTextDocument(fileUri);
            } catch {
                OutputLogger.log(`File not found for staging: ${op.path}`, 'ERROR');
                this.statusUpdateCallback(op.id, 'error');
                continue;
            }

            const editor = await vscode.window.showTextDocument(document, { preview: false, preserveFocus: true });
            const domainDoc = new VsCodeDocument(document);
            const edit = new vscode.WorkspaceEdit();

            const matchedBlocks: { range: vscode.Range; replace: string; originalText: string }[] = [];
            let stagingFailed = false;

            for (const change of op.changes) {
                const matchResult = this.searchEngine.findMatch(domainDoc, change.search);

                if (matchResult.status !== 'MATCHED') {
                    OutputLogger.log(
                        `Match failed for op ${op.id} in ${op.path}. Reason: ${matchResult.status === 'FAILED' ? matchResult.reason : 'unknown'}`,
                        'WARN'
                    );
                    this.statusUpdateCallback(op.id, 'conflict');
                    stagingFailed = true;
                    break;
                }

                OutputLogger.log(
                    `Matched change block in ${op.path} with confidence="${matchResult.confidence}"`,
                    'INFO'
                );

                const vsRange = new vscode.Range(
                    new vscode.Position(matchResult.range.start.line, matchResult.range.start.character),
                    new vscode.Position(matchResult.range.end.line, matchResult.range.end.character)
                );
                matchedBlocks.push({ range: vsRange, replace: change.replace, originalText: change.search });
            }

            if (stagingFailed) continue;

            // Apply changes bottom-up to prevent offset drift during multi-block staging
            matchedBlocks.sort((a, b) => b.range.start.compareTo(a.range.start));
            const trackedRanges: { uri: vscode.Uri; range: vscode.Range }[] = [];

            for (const match of matchedBlocks) {
                edit.replace(fileUri, match.range, match.replace);

                const lineDelta = match.replace.split('\n').length - match.originalText.split('\n').length;
                const newEndLine = match.range.end.line + lineDelta;
                const newRange = new vscode.Range(match.range.start.line, 0, Math.max(match.range.start.line, newEndLine), 999);

                // Store original search text (not the range) for drift-safe revert
                this.undoTracker.track(op.id, {
                    uri: fileUri,
                    originalText: match.originalText,
                    appliedRange: newRange
                });

                this.decorationManager.highlightInsertion(op.id, editor, newRange);
                this.lensProvider.addLens(fileUri, op.id, newRange);
                trackedRanges.push({ uri: fileUri, range: newRange });
            }

            // Fix §3.7: Use operation ID as in-flight token
            this.inFlightEditIds.add(op.id);
            const success = await vscode.workspace.applyEdit(edit);
            this.inFlightEditIds.delete(op.id);

            if (success) {
                this.activeRanges.set(op.id, trackedRanges);
                this.statusUpdateCallback(op.id, 'reviewing');
                OutputLogger.log(`Staged operation ${op.id} for ${op.path}`, 'INFO');
            } else {
                OutputLogger.log(`applyEdit returned false for operation ${op.id}`, 'ERROR');
                this.statusUpdateCallback(op.id, 'error');
            }
        }
    }

    public async acceptOperation(operationId: string): Promise<void> {
        this.clearTracking(operationId);
        this.statusUpdateCallback(operationId, 'applied');
        OutputLogger.log(`Operation ${operationId} accepted`, 'INFO');
    }

    /**
     * Fix §3.8: On reject, re-match the stored originalText against the current document
     * instead of trusting stored range coordinates which may have drifted.
     */
    public async rejectOperation(operationId: string): Promise<void> {
        const reverts = this.undoTracker.consumeRevertData(operationId);

        if (reverts.length > 0) {
            const edit = new vscode.WorkspaceEdit();

            // Group reverts by document so we open each file once
            const byUri = new Map<string, typeof reverts>();
            for (const r of reverts) {
                const key = r.uri.toString();
                const existing = byUri.get(key) ?? [];
                existing.push(r);
                byUri.set(key, existing);
            }

            for (const [, fileReverts] of byUri.entries()) {
                // Re-open the current document state to get fresh content
                let document: vscode.TextDocument | undefined;
                try {
                    document = await vscode.workspace.openTextDocument(fileReverts[0].uri);
                } catch {
                    OutputLogger.log(`Could not open document for revert of op ${operationId}`, 'ERROR');
                    continue;
                }

                const domainDoc = new VsCodeDocument(document);

                // Re-match each original text block against the live document
                // to get accurate current positions (fixes offset drift §3.8)
                const resolvedReverts: { range: vscode.Range; text: string }[] = [];
                for (const revert of fileReverts) {
                    const matchResult = this.searchEngine.findMatch(domainDoc, revert.originalText);
                    if (matchResult.status === 'MATCHED') {
                        const vsRange = new vscode.Range(
                            new vscode.Position(matchResult.range.start.line, matchResult.range.start.character),
                            new vscode.Position(matchResult.range.end.line, matchResult.range.end.character)
                        );
                        resolvedReverts.push({ range: vsRange, text: revert.originalText });
                    } else {
                        // Fall back to stored range if re-match fails (e.g. content already reverted)
                        OutputLogger.log(
                            `Re-match for revert of op ${operationId} failed (${matchResult.status === 'FAILED' ? matchResult.reason : 'unknown'}), using stored range`,
                            'WARN'
                        );
                        resolvedReverts.push({ range: revert.appliedRange, text: revert.originalText });
                    }
                }

                // Apply reverts bottom-up to prevent offset conflicts
                resolvedReverts.sort((a, b) => b.range.start.compareTo(a.range.start));
                for (const r of resolvedReverts) {
                    edit.replace(fileReverts[0].uri, r.range, r.text);
                }
            }

            this.inFlightEditIds.add(operationId);
            await vscode.workspace.applyEdit(edit);
            this.inFlightEditIds.delete(operationId);
        }

        this.clearTracking(operationId);
        this.statusUpdateCallback(operationId, 'rejected');
        OutputLogger.log(`Operation ${operationId} rejected and reverted`, 'INFO');
    }

    private clearTracking(operationId: string): void {
        this.decorationManager.clearDecorations(operationId);
        this.lensProvider.removeLenses(operationId);
        this.undoTracker.clear(operationId);
        this.activeRanges.delete(operationId);
    }
}
