import * as vscode from 'vscode';

/**
 * Utility class to safely resolve relative paths provided by the AI 
 * into absolute VS Code URIs.
 */
export class PathResolver {
    
    /**
     * Resolves a relative path (e.g. "src/app.ts") against the current workspace root.
     * Returns undefined if no workspace is opened.
     */
    public static resolve(relativePath: string): vscode.Uri | undefined {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return undefined;
        }

        // Defaulting to the first workspace folder for simplicity.
        // In a multi-root workspace, more complex resolution logic might be needed.
        const rootUri = workspaceFolders[0].uri;
        
        // Ensure we don't have leading slashes that break URI joining
        const cleanPath = relativePath.replace(/^[\/\\]+/, '');
        
        return vscode.Uri.joinPath(rootUri, cleanPath);
    }

    /**
     * Attempts to read the document safely. 
     * Prioritizes the unsaved (dirty) state in the editor if it's currently open.
     */
    public static async readDocumentSafe(uri: vscode.Uri): Promise<vscode.TextDocument | undefined> {
        try {
            // openTextDocument automatically handles fetching the dirty state if the file is modified
            return await vscode.workspace.openTextDocument(uri);
        } catch (error) {
            // File does not exist on disk
            return undefined;
        }
    }
}
