import * as vscode from 'vscode';

export interface LiveDocumentMetadata {
    readonly isDirty: boolean;
    readonly isOpen: boolean;
    readonly liveContent: string | null;
}

export interface ILiveDocumentRegistry {
    getDocumentState(uri: vscode.Uri): Promise<LiveDocumentMetadata>;
}

export class LiveDocumentRegistry implements ILiveDocumentRegistry {
    public async getDocumentState(uri: vscode.Uri): Promise<LiveDocumentMetadata> {
        const openedDoc = vscode.workspace.textDocuments.find(
            doc => doc.uri.toString() === uri.toString()
        );

        if (openedDoc) {
            let text = openedDoc.getText();
            if (openedDoc.eol === vscode.EndOfLine.CRLF && !text.includes('\r\n')) {
                text = text.replace(/\n/g, '\r\n');
            }

            return {
                isDirty: openedDoc.isDirty,
                isOpen: true,
                liveContent: text
            };
        }

        try {
            const fileBytes = await vscode.workspace.fs.readFile(uri);
            const content = new TextDecoder('utf-8').decode(fileBytes);
            return {
                isDirty: false,
                isOpen: false,
                liveContent: content
            };
        } catch (error) {
            return {
                isDirty: false,
                isOpen: false,
                liveContent: null
            };
        }
    }
}