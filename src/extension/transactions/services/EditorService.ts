import * as vscode from 'vscode';
import { OutputLogger } from '@/infrastructure/logging/outputLogger';

export class EditorService {
    private readonly maxOpenFiles = 5;

    public async focusFiles(uris: vscode.Uri[]): Promise<void> {
        const toOpen = uris.slice(0, this.maxOpenFiles);
        
        for (const uri of toOpen) {
            try {
                const doc = await vscode.workspace.openTextDocument(uri);
                await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: true });

                try {
                    const fallbackOptions = { tabSize: 4, insertSpaces: true };
                    const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === uri.toString());
                    const formatOptions = editor ? editor.options : fallbackOptions;

                    const edits = await vscode.commands.executeCommand<vscode.TextEdit[]>(
                        'vscode.executeFormatDocumentProvider', 
                        uri, 
                        formatOptions
                    );

                    if (edits && edits.length > 0) {
                        const formatEdit = new vscode.WorkspaceEdit();
                        formatEdit.set(uri, edits);
                        await vscode.workspace.applyEdit(formatEdit);
                    }
                } catch {
                    OutputLogger.log(`Skipped auto-formatting for ${uri.fsPath}`, 'INFO');
                }

            } catch (error) {
                OutputLogger.log(`Failed to open document: ${uri.fsPath}`, 'WARN');
            }
        }

        if (uris.length > this.maxOpenFiles) {
            vscode.window.showInformationMessage(`Applied edits to ${uris.length} files (opened ${this.maxOpenFiles}).`);
        }
    }
}
