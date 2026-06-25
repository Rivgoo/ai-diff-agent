import * as vscode from 'vscode';

/**
 * Manages the visual highlighting of transactional AI-applied edits.
 * Leverages native theme colors dynamically to adjust to dark, light, or high-contrast editors.
 */
export class DecorationService {
    private decorationType: vscode.TextEditorDecorationType;
    private activeDecorations = new Map<string, { opId: string; range: vscode.Range }[]>();

    constructor() {
        this.decorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: new vscode.ThemeColor('diffEditor.insertedTextBackground'),
            isWholeLine: true,
            overviewRulerColor: new vscode.ThemeColor('diffEditor.insertedTextBorder'),
            overviewRulerLane: vscode.OverviewRulerLane.Right
        });
    }

    public addDecorations(uri: vscode.Uri, opId: string, ranges: vscode.Range[]): void {
        const key = uri.toString();
        const existing = this.activeDecorations.get(key) || [];
        for (const r of ranges) {
            existing.push({ opId, range: r });
        }
        this.activeDecorations.set(key, existing);
        this.triggerUpdateDecorations();
    }

    public clearDecorationsForOp(opId: string): void {
        for (const [key, decs] of this.activeDecorations.entries()) {
            const filtered = decs.filter(d => d.opId !== opId);
            if (filtered.length === 0) {
                this.activeDecorations.delete(key);
            } else {
                this.activeDecorations.set(key, filtered);
            }
        }
        this.triggerUpdateDecorations();
    }

    public clearAllDecorations(): void {
        this.activeDecorations.clear();
        this.triggerUpdateDecorations();
    }

    public updateDecorationsForEditor(editor: vscode.TextEditor): void {
        const key = editor.document.uri.toString();
        const decs = this.activeDecorations.get(key);
        if (!decs) {
            editor.setDecorations(this.decorationType, []);
            return;
        }

        const ranges = decs.map(d => d.range);
        editor.setDecorations(this.decorationType, ranges);
    }

    private triggerUpdateDecorations(): void {
        for (const editor of vscode.window.visibleTextEditors) {
            this.updateDecorationsForEditor(editor);
        }
    }
}
