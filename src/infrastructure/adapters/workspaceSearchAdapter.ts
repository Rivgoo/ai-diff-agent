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
        
        const excludeFilter = respectGitIgnore ? (excludePattern ? excludePattern : undefined) : null;

        try {
            // Швидкий нативний пошук (працює через rg.exe під капотом)
            const matches = await vscode.workspace.findFiles(globPattern, excludeFilter);
            return matches.map(uri => PathNormalizer.normalize(uri.fsPath));
        } catch (error) {
            OutputLogger.log(`Native workspace.findFiles failed (likely ripgrep missing). Falling back to manual recursive search. Error: ${error}`, 'WARN');
            // Резервний ручний обхід директорій
            return await this.fallbackRecursiveSearch(workspaceFolders[0].uri, globPattern);
        }
    }

    private async fallbackRecursiveSearch(rootUri: vscode.Uri, globPattern: string): Promise<string[]> {
        const results: string[] = [];
        const filenameTarget = globPattern.replace('**/', '').toLowerCase();

        const walk = async (currentUri: vscode.Uri) => {
            try {
                const entries = await vscode.workspace.fs.readDirectory(currentUri);
                
                for (const [name, type] of entries) {
                    if (type === vscode.FileType.Directory) {
                        if (!this.IGNORE_DIRS.has(name.toLowerCase())) {
                            await walk(vscode.Uri.joinPath(currentUri, name));
                        }
                    } else if (type === vscode.FileType.File) {
                        // Якщо патерн є складним глобом, цей простий фолбек шукає лише точний збіг імені
                        if (name.toLowerCase() === filenameTarget) {
                            const fullUri = vscode.Uri.joinPath(currentUri, name);
                            results.push(PathNormalizer.normalize(fullUri.fsPath));
                        }
                    }
                }
            } catch {
                // Ігноруємо папки, до яких немає доступу
            }
        };

        await walk(rootUri);
        return results;
    }
}