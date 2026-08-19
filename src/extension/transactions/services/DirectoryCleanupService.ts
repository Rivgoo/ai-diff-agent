import * as vscode from 'vscode';
import { OutputLogger } from '@/infrastructure/logging/outputLogger';

export class DirectoryCleanupService {
    public async cleanupEmptyDirectories(
        candidatePaths: string[],
        rootUri: vscode.Uri,
        ignoredDirs: string[] = ['.ds_store', 'thumbs.db', 'desktop.ini']
    ): Promise<vscode.Uri[]> {
        const deletedUris: vscode.Uri[] = [];
        if (candidatePaths.length === 0) {
            return deletedUris;
        }

        const ignoredSet = new Set(ignoredDirs.map(d => d.toLowerCase()));

        const sortedCandidates = Array.from(new Set(candidatePaths))
            .map(p => p.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, ''))
            .filter(Boolean)
            .sort((a, b) => b.length - a.length);

        for (const relativeDir of sortedCandidates) {
            const dirUri = vscode.Uri.joinPath(rootUri, relativeDir);

            if (dirUri.fsPath.length <= rootUri.fsPath.length) {
                continue; 
            }
            if (relativeDir.startsWith('.vscode') || relativeDir.includes('/.vscode')) {
                continue;
            }

            try {
                await vscode.workspace.fs.stat(dirUri);

                const contents = await vscode.workspace.fs.readDirectory(dirUri);
                const usefulContents = contents.filter(([name, _type]) => {
                    return !ignoredSet.has(name.toLowerCase());
                });

                if (usefulContents.length === 0) {
                    for (const [name, _type] of contents) {
                        const fileUri = vscode.Uri.joinPath(dirUri, name);
                        await vscode.workspace.fs.delete(fileUri, { recursive: false, useTrash: false });
                    }

                    await vscode.workspace.fs.delete(dirUri, { recursive: false, useTrash: false });
                    deletedUris.push(dirUri);
                    OutputLogger.log(`Cleaned up empty transaction-scoped directory: ${relativeDir}`);
                }
            } catch (error) {
                OutputLogger.log(`[DirectoryCleanupService] Failed to clean up directory '${relativeDir}'. It might be locked by another process or OS. Error: ${error instanceof Error ? error.message : String(error)}`, 'WARN');
            }
        }

        return deletedUris;
    }
}