import * as vscode from 'vscode';
import type { IDocument } from '../../core/matcher/documentPort';
import type { Position } from '../../shared/contracts';

export class VsCodeDocument implements IDocument {
    constructor(private readonly document: vscode.TextDocument) {}

    public get path(): string {
        return this.document.uri.fsPath;
    }

    public getText(): string {
        return this.document.getText();
    }

    public getLineCount(): number {
        return this.document.lineCount;
    }

    public positionAt(offset: number): Position {
        const vsCodePos = this.document.positionAt(offset);
        return {
            line: vsCodePos.line,
            character: vsCodePos.character
        };
    }
}