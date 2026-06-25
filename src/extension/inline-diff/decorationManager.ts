import * as vscode from 'vscode';

/**
 * Manages the visual highlighting of inserted code using VS Code's native theme colors.
 */
export class DecorationManager {
    private insertedTextDecoration: vscode.TextEditorDecorationType;
    private activeDecorations = new Map<string, { editor: vscode.TextEditor, range: vscode.Range }[]>();

    constructor() {
        // Uses the native green background matching the user's current VS Code theme
        this.insertedTextDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: new vscode.ThemeColor('diffEditor.insertedTextBackground'),
            isWholeLine: true,
            overviewRulerColor: new vscode.ThemeColor('diffEditor.insertedTextBorder'),
            overviewRulerLane: vscode.OverviewRulerLane.Right
        });
    }

    /**
     * Applies a highlighting decoration to a specific range and tracks it by operation ID.
     */
    public highlightInsertion(operationId: string, editor: vscode.TextEditor, range: vscode.Range): void {
        const existing = this.activeDecorations.get(operationId) || [];
        existing.push({ editor, range });
        this.activeDecorations.set(operationId, existing);

        this.renderDecorations(editor);
    }

    /**
     * Removes all visual decorations associated with an operation (e.g., after Accept/Reject).
     */
    public clearDecorations(operationId: string): void {
        const records = this.activeDecorations.get(operationId);
        if (!records) return;

        this.activeDecorations.delete(operationId);

        // Re-render affected editors
        const affectedEditors = new Set(records.map(r => r.editor));
        for (const editor of affectedEditors) {
            this.renderDecorations(editor);
        }
    }

    private renderDecorations(editor: vscode.TextEditor): void {
        const rangesToApply: vscode.Range[] = [];
        
        for (const records of this.activeDecorations.values()) {
            for (const record of records) {
                if (record.editor === editor) {
                    rangesToApply.push(record.range);
                }
            }
        }

        editor.setDecorations(this.insertedTextDecoration, rangesToApply);
    }
}
