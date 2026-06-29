import * as vscode from 'vscode';
import type { IFileSystemPort } from '../../core/resolver/ports';
import { PathSandbox } from '../../vscode/workspace/pathSandbox';
import { PathNormalizer } from '../../core/workspace/pathNormalizer';

export class VsCodeFileSystemAdapter implements IFileSystemPort {
    public async exists(relativePath: string): Promise<boolean> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) return false;

        try {
            const cleanPath = PathNormalizer.normalize(relativePath);
            const targetUri = PathSandbox.validate(cleanPath);
            
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
            
            const fileData = await vscode.workspace.fs.readFile(targetUri);
            return new TextDecoder('utf-8').decode(fileData);
        } catch {
            return undefined;
        }
    }
}