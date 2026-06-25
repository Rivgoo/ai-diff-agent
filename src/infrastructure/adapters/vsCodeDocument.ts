import * as vscode from 'vscode';
import { IDocument } from '../../core/matcher/documentPort';
import { Position } from '../../shared/contracts';

/**
 * Adapter implementing the decoupled IDocument port.
 * Translates VS Code TextDocument calls to pure Typescript domain entities.
 */
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

    /**
     * Translates absolute string offsets to line/character positions.
     * Safely delegates calculation to VS Code API to correctly handle multi-byte Unicode/Emojis.
     */
    public positionAt(offset: number): Position {
        const vsCodePos = this.document.positionAt(offset);
        return {
            line: vsCodePos.line,
            character: vsCodePos.character
        };
    }
}
