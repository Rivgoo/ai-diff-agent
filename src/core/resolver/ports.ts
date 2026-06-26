/**
 * Ports Layer (Inversion of Control).
 * Decouples core resolution strategies from vscode-specific disk APIs,
 * enabling lightweight, instantaneous testing via memory-based double-mocks.
 */

export interface IFileSystemPort {
    /**
     * Verifies the physical existence of a file or directory on the host workspace.
     * @param relativePath Clean relative path to test.
     */
    exists(relativePath: string): Promise<boolean>;
}

export interface IWorkspaceSearchPort {
    /**
     * Scans the active workspace folders using globs, returning normalized relative matches.
     * @param globPattern Search pattern (e.g., '**\/Button.tsx').
     * @param excludePattern Directories or files to ignore.
     */
    findFiles(globPattern: string, excludePattern?: string): Promise<string[]>;
}
