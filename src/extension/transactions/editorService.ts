import * as vscode from 'vscode';
import { OutputLogger } from '../../infrastructure/logging/outputLogger';

/**
 * Handles batch openings of modified files while preventing editor overflow.
 */
export class EditorService {
    private readonly maxOpenFiles = 5;

    public async focusFiles(uris: vscode.Uri[]): Promise<void> {
        const toOpen = uris.slice(0, this.maxOpenFiles);
        
        for (const uri of toOpen) {
            try {
                const doc = await vscode.workspace.openTextDocument(uri);
                await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: true });
            } catch (error) {
                OutputLogger.log(`Failed to open document: ${uri.fsPath}`, 'WARN');
            }
        }

        if (uris.length > this.maxOpenFiles) {
            vscode.window.showInformationMessage(`Applied edits to ${uris.length} files (opened ${this.maxOpenFiles}).`);
        }
    }
}
