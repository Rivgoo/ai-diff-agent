import * as vscode from 'vscode';
import { IFileSystemPort } from '../../core/resolver/ports';
import { PathSandbox } from '../../vscode/workspace/pathSandbox';
import { PathNormalizer } from '../../core/workspace/pathNormalizer';

/**
 * Adapter implementing IFileSystemPort.
 * Safely redirects core domain checks to physical VS Code file system services.
 */
export class VsCodeFileSystemAdapter implements IFileSystemPort {
    public async exists(relativePath: string): Promise<boolean> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return false;
        }

        try {
            const rootName = workspaceFolders[0].name;
            const cleanPath = PathNormalizer.normalize(relativePath, rootName);
            const targetUri = PathSandbox.validate(cleanPath);
            
            await vscode.workspace.fs.stat(targetUri);
            return true;
        } catch {
            return false;
        }
    }
}
