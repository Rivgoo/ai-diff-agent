import * as vscode from 'vscode';
import { IWorkspaceSearchPort } from '../../core/resolver/ports';
import { PathNormalizer } from '../../core/workspace/pathNormalizer';

/**
 * Adapter implementing IWorkspaceSearchPort.
 * Integrates indexing with high-performance vscode.workspace.findFiles lookups.
 */
export class VsCodeWorkspaceSearchAdapter implements IWorkspaceSearchPort {
    public async findFiles(globPattern: string, excludePattern?: string): Promise<string[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return [];
        }

        const rootName = workspaceFolders[0].name;
        
        // Resolve target workspace exclusions globs securely
        const excludeFilter = excludePattern ? excludePattern : undefined;

        try {
            const matches = await vscode.workspace.findFiles(globPattern, excludeFilter);
            return matches.map(uri => PathNormalizer.normalize(uri.fsPath, rootName));
        } catch {
            return [];
        }
    }
}
