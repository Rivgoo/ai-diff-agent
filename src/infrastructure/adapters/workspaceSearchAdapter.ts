import * as vscode from 'vscode';
import type { IWorkspaceSearchPort } from '../../core/resolver/ports';
import { PathNormalizer } from '../../core/workspace/pathNormalizer';
import { OutputLogger } from '../logging/outputLogger';

export class VsCodeWorkspaceSearchAdapter implements IWorkspaceSearchPort {
    private readonly IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'out', 'build', '.vscode']);

    public async findFiles(globPattern: string, excludePattern?: string, respectGitIgnore: boolean = true): Promise<string[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return [];
        }
        
        let excludeFilter = null;
        if (respectGitIgnore && excludePattern) {
            excludeFilter = excludePattern.includes(',') ? `{${excludePattern}}` : excludePattern;
        }

        try {
            const matches = await vscode.workspace.findFiles(globPattern, excludeFilter);
            return matches.map(uri => PathNormalizer.normalize(uri.fsPath));
        } catch (error) {
            OutputLogger.log(`Native workspace.findFiles failed. Falling back to manual recursive search. Error: ${error}`, 'WARN');
            return await this.fallbackRecursiveSearch(workspaceFolders[0].uri, globPattern);
        }
    }

    private async fallbackRecursiveSearch(rootUri: vscode.Uri, globPattern: string): Promise<string[]> {
        const results: string[] = [];
        
        let regexStr = globPattern.replace(/\./g, '\\.').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*');
        if (!regexStr.startsWith('.*')) regexStr = '^' + regexStr;
        
        regexStr = regexStr + '$';
        
        const regex = new RegExp(regexStr, 'i');
        const visited = new Set<string>();

        const walk = async (currentUri: vscode.Uri) => {
            const fsPath = currentUri.fsPath;
            if (visited.has(fsPath)) return;
            visited.add(fsPath);

            try {
                const entries = await vscode.workspace.fs.readDirectory(currentUri);
                
                for (const [name, type] of entries) {
                    if (type === vscode.FileType.Directory || type === vscode.FileType.SymbolicLink) {
                        if (!this.IGNORE_DIRS.has(name.toLowerCase())) {
                            await walk(vscode.Uri.joinPath(currentUri, name));
                        }
                    } else if (type === vscode.FileType.File) {
                        const fullUri = vscode.Uri.joinPath(currentUri, name);
                        const normalizedPath = PathNormalizer.normalize(fullUri.fsPath);
                        if (regex.test(normalizedPath)) {
                            results.push(normalizedPath);
                        }
                    }
                }
            } catch {

            }
        };

        await walk(rootUri);
        return results;
    }
}