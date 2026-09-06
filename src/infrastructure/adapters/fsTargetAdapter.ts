import * as vscode from 'vscode';
import type { IFileSystemPort } from '../../core/resolver/ports';
import { PathSandbox } from '../../vscode/workspace/pathSandbox';
import { PathNormalizer } from '../../core/workspace/pathNormalizer';
import { OutputLogger } from '../logging/outputLogger';
import type { EngineSettings } from '../../shared/models';

export class VsCodeFileSystemAdapter implements IFileSystemPort {
    constructor(private readonly getEngineSettings: () => EngineSettings) {}

    public async exists(relativePath: string): Promise<boolean> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) return false;

        try {
            const cleanPath = PathNormalizer.normalize(relativePath);
            const targetUri = PathSandbox.validate(cleanPath);
            
            if (this.getEngineSettings().useUnsavedBuffers) {
                const isOpen = vscode.workspace.textDocuments.some(doc => doc.uri.toString() === targetUri.toString());
                if (isOpen) return true;
            }

            await vscode.workspace.fs.stat(targetUri);
            return true;
        } catch {
            return false;
        }
    }

    public async readFile(relativePath: string): Promise<string | undefined> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) return undefined;

        try {
            const cleanPath = PathNormalizer.normalize(relativePath);
            const targetUri = PathSandbox.validate(cleanPath);
            const settings = this.getEngineSettings();
            
            if (settings.useUnsavedBuffers) {
                const openDoc = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === targetUri.toString());
                if (openDoc) {
                    return openDoc.getText();
                }
            }

            const stat = await vscode.workspace.fs.stat(targetUri);
            const maxBytes = settings.maxFileSizeMb * 1024 * 1024;
            
            if (stat.size !== undefined && stat.size > maxBytes) {
                OutputLogger.log(`File bypassed during search: ${relativePath} (${(stat.size / 1024 / 1024).toFixed(2)} MB) exceeds ${settings.maxFileSizeMb} MB limit.`, 'WARN');
                return undefined;
            }

            const fileData = await vscode.workspace.fs.readFile(targetUri);
            return new TextDecoder('utf-8').decode(fileData);
        } catch (error) {
            return undefined;
        }
    }
}