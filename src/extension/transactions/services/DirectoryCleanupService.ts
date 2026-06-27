import * as vscode from 'vscode';
import { OutputLogger } from '@/infrastructure/logging/outputLogger';

export class DirectoryCleanupService {
    private static readonly IGNORED_METADATA_FILES = new Set([
        '.ds_store',
        'thumbs.db',
        'desktop.ini'
    ]);

    public async cleanupEmptyDirectories(
        candidatePaths: string[],
        rootUri: vscode.Uri
    ): Promise<vscode.Uri[]> {
        const deletedUris: vscode.Uri[] = [];
        if (candidatePaths.length === 0) {
            return deletedUris;
        }

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
                    return !DirectoryCleanupService.IGNORED_METADATA_FILES.has(name.toLowerCase());
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
            } catch {
                // Ignore safe FS exceptions
            }
        }

        return deletedUris;
    }
}
