import * as vscode from 'vscode';

export interface OpDecoration {
    opId: string;
    range: vscode.Range;
    originalSearch: string; 
}

export class DecorationService {
    private decorationType: vscode.TextEditorDecorationType;
    private activeDecorations = new Map<string, OpDecoration[]>();

    private _onDidChangeDecorations = new vscode.EventEmitter<void>();
    public readonly onDidChangeDecorations = this._onDidChangeDecorations.event;

    constructor() {
        this.decorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: new vscode.ThemeColor('diffEditor.insertedTextBackground'),
            isWholeLine: true,
            overviewRulerColor: new vscode.ThemeColor('diffEditor.insertedTextBorder'),
            overviewRulerLane: vscode.OverviewRulerLane.Right
        });
    }

    public addDecorations(uri: vscode.Uri, opId: string, blocks: { range: vscode.Range, originalSearch: string }[]): void {
        const key = uri.toString();
        const existing = this.activeDecorations.get(key) || [];
        for (const b of blocks) {
            existing.push({ opId, range: b.range, originalSearch: b.originalSearch });
        }
        this.activeDecorations.set(key, existing);
        this.triggerUpdateDecorations();
    }

    // НОВИЙ МЕТОД: Для видалення ОДНОГО конкретного блоку (знадобиться в Частині 2)
    public removeDecorationBlock(uri: vscode.Uri, opId: string, exactRange: vscode.Range): void {
        const key = uri.toString();
        const decs = this.activeDecorations.get(key);
        if (!decs) return;

        const filtered = decs.filter(d => 
            !(d.opId === opId && d.range.isEqual(exactRange))
        );

        if (filtered.length === 0) {
            this.activeDecorations.delete(key);
        } else {
            this.activeDecorations.set(key, filtered);
        }
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

    public clearDecorationsForDocument(uri: vscode.Uri): void {
        const key = uri.toString();
        if (this.activeDecorations.has(key)) {
            this.activeDecorations.delete(key);
            this._onDidChangeDecorations.fire();
        }
    }

    public clearAllDecorations(): void {
        this.activeDecorations.clear();
        this.triggerUpdateDecorations();
    }

    public getRangesForOp(opId: string): vscode.Range[] {
        const result: vscode.Range[] = [];
        for (const decs of this.activeDecorations.values()) {
            for (const d of decs) {
                if (d.opId === opId) {
                    result.push(d.range);
                }
            }
        }
        return result;
    }

    // НОВИЙ МЕТОД: Отримання ВСІХ декорацій для конкретного документа (для CodeLens)
    public getDecorationsForDocument(uri: vscode.Uri): OpDecoration[] {
        return this.activeDecorations.get(uri.toString()) || [];
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
        // Сповіщаємо CodeLensProvider, що потрібно перемалювати кнопки
        this._onDidChangeDecorations.fire();
    }

    public shiftDecorations(uri: vscode.Uri, changes: readonly vscode.TextDocumentContentChangeEvent[]): void {
        const key = uri.toString();
        let decs = this.activeDecorations.get(key);
        if (!decs || decs.length === 0) return;

        let requiresUpdate = false;

        for (const change of changes) {
            const linesDelta = (change.text.match(/\n/g) || []).length - (change.range.end.line - change.range.start.line);
            if (linesDelta === 0) continue; 

            decs = decs.map(d => {
                if (change.range.end.line < d.range.start.line) {
                    requiresUpdate = true;
                    return {
                        ...d,
                        range: new vscode.Range(
                            d.range.start.line + linesDelta, 0,
                            d.range.end.line + linesDelta, 0
                        )
                    };
                }
                return d;
            });
        }

        if (requiresUpdate) {
            this.activeDecorations.set(key, decs);
            this.triggerUpdateDecorations();
        }
    }
}