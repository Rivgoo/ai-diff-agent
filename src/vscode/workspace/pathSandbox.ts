import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Validates that all AI-provided paths remain within the workspace root.
 * Blocks path traversal attacks (e.g. ../../.ssh/authorized_keys).
 */
export class PathSandbox {
    /**
     * Validates a single relative path against the workspace root.
     * Returns the resolved Uri on success, throws on traversal attempt.
     */
    public static validate(relativePath: string): vscode.Uri {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('WORKSPACE_NOT_OPEN: No folder is open in VS Code.');
        }

        const rootUri = workspaceFolders[0].uri;
        const rootFsPath = rootUri.fsPath;

        // Strip leading slashes to allow joining
        const cleanPath = relativePath.replace(/^[\/\\]+/, '');
        const resolvedUri = vscode.Uri.joinPath(rootUri, cleanPath);
        const resolvedFsPath = resolvedUri.fsPath;

        // Normalise both paths for reliable prefix comparison
        const normRoot = path.normalize(rootFsPath) + path.sep;
        const normResolved = path.normalize(resolvedFsPath);

        if (!normResolved.startsWith(normRoot) && normResolved !== path.normalize(rootFsPath)) {
            throw new Error(
                `PATH_TRAVERSAL_DETECTED: The path "${relativePath}" resolves outside the workspace root. Operation rejected.`
            );
        }

        return resolvedUri;
    }

    /**
     * Validates an array of paths; throws on the first violation.
     */
    public static validateAll(paths: string[]): void {
        for (const p of paths) {
            PathSandbox.validate(p);
        }
    }
}
