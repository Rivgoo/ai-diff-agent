import * as vscode from 'vscode';
import { OutputLogger } from '@/infrastructure/logging/outputLogger';

export class EditorService {
    /**
     * Silently formats a list of URIs in the background without stealing editor focus.
     */
    public async formatFilesSilently(uris: vscode.Uri[]): Promise<void> {
        if (uris.length === 0) return;

        const formatEdit = new vscode.WorkspaceEdit();
        let formattedCount = 0;

        for (const uri of uris) {
            try {
                const edits = await vscode.commands.executeCommand<vscode.TextEdit[]>(
                    'vscode.executeFormatDocumentProvider', 
                    uri, 
                    { tabSize: 4, insertSpaces: true } 
                );

                if (edits && edits.length > 0) {
                    formatEdit.set(uri, edits);
                    formattedCount++;
                }
            } catch (error) {
                OutputLogger.log(`Skipped silent auto-formatting for ${uri.fsPath}`, 'INFO');
            }
        }

        if (formattedCount > 0) {
            try {

                await vscode.workspace.applyEdit(formatEdit);
                
                for (const uri of uris) {
                    const doc = vscode.workspace.textDocuments.find(d => d.uri.toString() === uri.toString());
                    if (doc && doc.isDirty) {
                        await doc.save();
                    }
                }
            } catch (error) {
                OutputLogger.log(`Failed to apply background formatting: ${error}`, 'ERROR');
            }
        }
    }
}