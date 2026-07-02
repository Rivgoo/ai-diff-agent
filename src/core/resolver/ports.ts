export interface IFileSystemPort {
    exists(relativePath: string): Promise<boolean>;
    readFile(relativePath: string): Promise<string | undefined>;
}

export interface IWorkspaceSearchPort {
    /**
     * Scans the active workspace folders using globs.
     * @param globPattern Search pattern (e.g., '**\/Button.tsx').
     * @param excludePattern Directories or files to ignore.
     * @param respectGitIgnore If true, delegates ignoring to VS Code defaults.
     */
    findFiles(globPattern: string, excludePattern?: string, respectGitIgnore?: boolean): Promise<string[]>;
}