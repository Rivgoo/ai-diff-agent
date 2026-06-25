import * as vscode from 'vscode';
import { SearchEngine } from '../../core/matcher/searchEngine';
import { UpdateFileOperation } from '../../core/models/operations';
import { PathResolver } from '../../vscode/workspace/pathResolver';
import { VsCodeDocument } from '../adapters/vsCodeDocument';

/**
 * Custom TextDocumentContentProvider serving in-memory virtual preview buffers.
 */
export class VirtualFsProvider implements vscode.TextDocumentContentProvider {
    public static readonly scheme = 'ai-diff-agent';

    private readonly operationStore = new Map<string, UpdateFileOperation>();
    private readonly searchEngine = new SearchEngine();

    private readonly onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
    public readonly onDidChange = this.onDidChangeEmitter.event;

    public registerOperation(operation: UpdateFileOperation): void {
        const baseOp = operation as any;
        this.operationStore.set(baseOp.id, operation);
    }

    public async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        const params = new URLSearchParams(uri.query);
        const opId = params.get('opId');

        if (!opId) {
            return 'Error: Missing required operation ID in URI query parameters.';
        }

        const operation = this.operationStore.get(opId);
        if (!operation) {
            return `Error: Operation ${opId} was not found in-memory.`;
        }

        const baseOp = operation as any;
        const originalUri = PathResolver.resolve(baseOp.path);
        if (!originalUri) {
            return 'Error: Could not resolve workspace target paths.';
        }

        const document = await PathResolver.readDocumentSafe(originalUri);
        if (!document) {
            return 'Error: Original document could not be retrieved from disk or editors.';
        }

        const domainDoc = new VsCodeDocument(document);
        let content = document.getText();

        const resolvedEdits: { startOffset: number; endOffset: number; replace: string }[] = [];

        // Retrieve match boundaries for each block JIT
        for (const change of operation.changes) {
            const match = this.searchEngine.findMatch(domainDoc, change.search);
            if (match.status === 'MATCHED' && match.range) {
                // Convert domain positions safely to string offsets to maintain surrogate character safety
                const startOffset = document.offsetAt(new vscode.Position(match.range.start.line, match.range.start.character));
                const endOffset = document.offsetAt(new vscode.Position(match.range.end.line, match.range.end.character));
                
                resolvedEdits.push({ startOffset, endOffset, replace: change.replace });
            }
        }

        // Apply replacements descending (Bottom-Up) to avoid offset shifts
        resolvedEdits.sort((a, b) => b.startOffset - a.startOffset);

        for (const edit of resolvedEdits) {
            const before = content.slice(0, edit.startOffset);
            const after = content.slice(edit.endOffset);
            content = before + edit.replace + after;
        }

        return content;
    }
}
