import * as vscode from 'vscode';
import type { IWorkspaceSearchPort } from '../../core/resolver/ports';
import { PathNormalizer } from '../../core/workspace/pathNormalizer';

/**
 * Adapter implementing IWorkspaceSearchPort.
 * Integrates indexing with high-performance vscode.workspace.findFiles lookups.
 */
export class VsCodeWorkspaceSearchAdapter implements IWorkspaceSearchPort {
    public async findFiles(globPattern: string, excludePattern?: string, respectGitIgnore: boolean = true): Promise<string[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return [];
        }
        
        const excludeFilter = respectGitIgnore ? (excludePattern ? excludePattern : undefined) : null;

        try {
            const matches = await vscode.workspace.findFiles(globPattern, excludeFilter);
            return matches.map(uri => PathNormalizer.normalize(uri.fsPath));
        } catch {
            return [];
        }
    }
}
