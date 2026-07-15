import * as vscode from 'vscode';
import type { IFileSystemPort } from '../../core/resolver/ports';
import { PathSandbox } from '../../vscode/workspace/pathSandbox';
import { PathNormalizer } from '../../core/workspace/pathNormalizer';

export class VsCodeFileSystemAdapter implements IFileSystemPort {
    // Впроваджуємо функцію доступу до налаштування замість жорсткого значення
    constructor(private readonly getUseUnsavedBuffers: () => boolean = () => true) {}

    public async exists(relativePath: string): Promise<boolean> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) return false;

        try {
            const cleanPath = PathNormalizer.normalize(relativePath);
            const targetUri = PathSandbox.validate(cleanPath);
            
            // Перевіряємо налаштування користувача перед читанням оперативної пам'яті
            if (this.getUseUnsavedBuffers()) {
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
            
            if (this.getUseUnsavedBuffers()) {
                const openDoc = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === targetUri.toString());
                if (openDoc) {
                    return openDoc.getText();
                }
            }

            const fileData = await vscode.workspace.fs.readFile(targetUri);
            return new TextDecoder('utf-8').decode(fileData);
        } catch {
            return undefined;
        }
    }
}