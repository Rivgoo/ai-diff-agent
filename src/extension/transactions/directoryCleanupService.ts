import * as vscode from 'vscode';
import { OutputLogger } from '../../infrastructure/logging/outputLogger';

/**
 * Service that identifies, prioritizes, and removes empty directories created
 * dynamically or left behind by file deletions or transfers in a transaction.
 */
export class DirectoryCleanupService {
    // OS-specific metadata files that should be ignored when deciding if a directory is empty
    private static readonly IGNORED_METADATA_FILES = new Set([
        '.ds_store',
        'thumbs.db',
        'desktop.ini'
    ]);

    /**
     * Identifies, prioritizes and cleans up empty parent directories resulting from deleted or moved files.
     * Evaluates bottom-up (deepest-first) to allow cascading folder cleanups.
     * @param candidatePaths Set of relative directory paths to evaluate.
     * @param rootUri The active workspace root Uri.
     * @returns A promise resolving to an array of Uris of directories that were successfully deleted.
     */
    public async cleanupEmptyDirectories(
        candidatePaths: string[],
        rootUri: vscode.Uri
    ): Promise<vscode.Uri[]> {
        const deletedUris: vscode.Uri[] = [];
        if (candidatePaths.length === 0) {
            return deletedUris;
        }

        // Sanitize, filter, and sort candidate paths by depth (longest string first)
        const sortedCandidates = Array.from(new Set(candidatePaths))
            .map(p => p.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, ''))
            .filter(Boolean)
            .sort((a, b) => b.length - a.length);

        for (const relativeDir of sortedCandidates) {
            const dirUri = vscode.Uri.joinPath(rootUri, relativeDir);

            // Root Guard: Prevent evaluating or deleting root workspace or non-project paths
            if (dirUri.fsPath.length <= rootUri.fsPath.length) {
                continue; 
            }
            if (relativeDir.startsWith('.vscode') || relativeDir.includes('/.vscode')) {
                continue; // Protected system directory
            }

            try {
                // Verify existence before evaluating content
                await vscode.workspace.fs.stat(dirUri);

                const contents = await vscode.workspace.fs.readDirectory(dirUri);
                const usefulContents = contents.filter(([name, _type]) => {
                    return !DirectoryCleanupService.IGNORED_METADATA_FILES.has(name.toLowerCase());
                });

                if (usefulContents.length === 0) {
                    // Clean up OS-ignored files first if any exist
                    for (const [name, _type] of contents) {
                        const fileUri = vscode.Uri.joinPath(dirUri, name);
                        await vscode.workspace.fs.delete(fileUri, { recursive: false, useTrash: false });
                    }

                    // Delete the now completely empty directory non-recursively
                    await vscode.workspace.fs.delete(dirUri, { recursive: false, useTrash: false });
                    deletedUris.push(dirUri);
                    OutputLogger.log(`Cleaned up empty transaction-scoped directory: ${relativeDir}`);
                }
            } catch {
                // Folder already deleted, inaccessible, or non-existent. Skip.
            }
        }

        return deletedUris;
    }
}
