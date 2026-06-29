/**
 * Ports Layer (Inversion of Control).
 * Decouples core resolution strategies from vscode-specific disk APIs,
 * enabling lightweight, instantaneous testing via memory-based double-mocks.
 */

export interface IFileSystemPort {
    exists(relativePath: string): Promise<boolean>;
    /**
     * Reads the content of a file. Returns undefined if the file cannot be read.
     * @param relativePath Clean relative path to the file.
     */
    readFile(relativePath: string): Promise<string | undefined>;
}

export interface IWorkspaceSearchPort {
    /**
     * Scans the active workspace folders using globs, returning normalized relative matches.
     * @param globPattern Search pattern (e.g., '**\/Button.tsx').
     * @param excludePattern Directories or files to ignore.
     */
    findFiles(globPattern: string, excludePattern?: string): Promise<string[]>;
}
