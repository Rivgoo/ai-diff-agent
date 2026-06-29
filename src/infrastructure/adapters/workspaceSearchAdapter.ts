import * as vscode from 'vscode';
import type { IWorkspaceSearchPort } from '../../core/resolver/ports';
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
        
        // Resolve target workspace exclusions globs securely
        const excludeFilter = excludePattern ? excludePattern : undefined;

        try {
            const matches = await vscode.workspace.findFiles(globPattern, excludeFilter);
            return matches.map(uri => PathNormalizer.normalize(uri.fsPath));
        } catch {
            return [];
        }
    }
}
