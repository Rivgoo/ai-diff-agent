import * as vscode from 'vscode';

/**
 * Encapsulates metadata representing the active editor state of a workspace file.
 */
export interface LiveDocumentMetadata {
    readonly isDirty: boolean;
    readonly isOpen: boolean;
    readonly liveContent: string;
}

/**
 * Service contract for resolving document state including memory-cached buffers.
 */
export interface ILiveDocumentRegistry {
    getDocumentState(uri: vscode.Uri): Promise<LiveDocumentMetadata>;
}

/**
 * Accesses active VS Code text document buffers to preserve unsaved human-made edits.
 */
export class LiveDocumentRegistry implements ILiveDocumentRegistry {
    /**
     * Resolves the actual document state. If the document is open in VS Code,
     * we prioritize its live unsaved (dirty) text buffer in memory. Otherwise,
     * we read its saved representation directly from disk.
     */
    public async getDocumentState(uri: vscode.Uri): Promise<LiveDocumentMetadata> {
        // Query the loaded VS Code text document models to check for in-memory modifications
        const openedDoc = vscode.workspace.textDocuments.find(
            doc => doc.uri.toString() === uri.toString()
        );

        if (openedDoc) {
            return {
                isDirty: openedDoc.isDirty,
                isOpen: true,
                liveContent: openedDoc.getText()
            };
        }

        // Fallback: File is cold on disk, read it directly
        try {
            const fileBytes = await vscode.workspace.fs.readFile(uri);
            const content = new TextDecoder('utf-8').decode(fileBytes);
            return {
                isDirty: false,
                isOpen: false,
                liveContent: content
            };
        } catch (error) {
            // Document does not exist yet on disk (safe defaults for brand-new files)
            return {
                isDirty: false,
                isOpen: false,
                liveContent: ''
            };
        }
    }
}
