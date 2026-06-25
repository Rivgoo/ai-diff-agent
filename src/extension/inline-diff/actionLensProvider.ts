import * as vscode from 'vscode';

export interface CodeLensData {
    operationId: string;
    range: vscode.Range;
}

/**
 * Renders interactive [Accept] and [Reject] buttons directly above modified code blocks.
 */
export class ActionLensProvider implements vscode.CodeLensProvider {
    private lenses = new Map<string, CodeLensData[]>(); // Keyed by URI fsPath
    private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

    /**
     * Registers a new CodeLens for a specific operation.
     */
    public addLens(uri: vscode.Uri, operationId: string, range: vscode.Range): void {
        const key = uri.fsPath;
        const existing = this.lenses.get(key) || [];
        existing.push({ operationId, range });
        this.lenses.set(key, existing);
        this._onDidChangeCodeLenses.fire();
    }

    /**
     * Removes all CodeLenses associated with an operation.
     */
    public removeLenses(operationId: string): void {
        for (const [key, dataArray] of this.lenses.entries()) {
            const filtered = dataArray.filter(d => d.operationId !== operationId);
            if (filtered.length !== dataArray.length) {
                this.lenses.set(key, filtered);
                this._onDidChangeCodeLenses.fire();
            }
        }
    }

    public provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
        const key = document.uri.fsPath;
        const dataArray = this.lenses.get(key) || [];
        const result: vscode.CodeLens[] = [];

        for (const data of dataArray) {
            // Accept Command Lens
            const acceptCmd: vscode.Command = {
                title: "$(check) Accept",
                tooltip: "Accept and finalize this AI change",
                command: "ai-diff-agent.action.accept",
                arguments: [data.operationId]
            };
            result.push(new vscode.CodeLens(data.range, acceptCmd));

            // Reject Command Lens
            const rejectCmd: vscode.Command = {
                title: "$(close) Reject",
                tooltip: "Discard this AI change and revert to original code",
                command: "ai-diff-agent.action.reject",
                arguments: [data.operationId]
            };
            result.push(new vscode.CodeLens(data.range, rejectCmd));
        }

        return result;
    }
}
