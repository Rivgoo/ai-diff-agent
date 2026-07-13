import * as vscode from 'vscode';
import { PathSanitizer } from './pathSanitizer';
export class PathNormalizer {
    public static normalize(rawPath: string): string {
        let clean = PathSanitizer.sanitize(rawPath);
        
        if (clean.toLowerCase().startsWith('file://')) {
            clean = clean.substring(7);
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return clean.replace(/^\/+/, '');
        }

        const rootUri = workspaceFolders[0].uri;
        const rootFsPath = PathSanitizer.sanitize(rootUri.fsPath).toLowerCase();
        const cleanLower = clean.toLowerCase();

        if (cleanLower.startsWith(rootFsPath)) {
            clean = clean.substring(rootFsPath.length);
        } 
        else if (rootUri.path && cleanLower.startsWith(rootUri.path.toLowerCase())) {
            clean = clean.substring(rootUri.path.length);
        }

        const rootName = workspaceFolders[0].name.toLowerCase();
        const parts = clean.split('/').filter(Boolean);

        if (parts.length > 0 && parts[0].toLowerCase() === rootName) {
            return parts.slice(1).join('/');
        }

        return clean.replace(/^\/+/, '');
    }
}