import * as vscode from 'vscode';
import type { IDocument } from '../../core/matcher/documentPort';
import type { Position } from '../../shared/contracts';

/**
 * Adapter implementing the decoupled IDocument port.
 * Translates VS Code TextDocument calls to pure Typescript domain entities.
 */
export class VsCodeDocument implements IDocument {
    private readonly MAX_SUPPORTED_LINES = 30000;

    constructor(private readonly document: vscode.TextDocument) {}

    public get path(): string {
        return this.document.uri.fsPath;
    }

    public getText(): string {
        if (this.document.lineCount > this.MAX_SUPPORTED_LINES) {
            throw new Error(`File exceeds maximum supported size for AST parsing (${this.MAX_SUPPORTED_LINES} lines).`);
        }
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