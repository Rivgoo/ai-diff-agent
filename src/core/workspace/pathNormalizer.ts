import * as vscode from 'vscode';
import { PathSanitizer } from './pathSanitizer';

/**
 * Domain-driven Path Normalizer.
 * Safely sanitizes AI-generated paths, resolving absolute/hallucinated segments 
 * into strict relative paths based on the active VS Code workspace boundaries.
 */
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

        const rootName = workspaceFolders[0].name.toLowerCase();
        const parts = clean.split('/').filter(Boolean);

        if (parts.length === 0) return '';

        // Якщо перший сегмент шляху - це ім'я проєкту (напр. totemforge-client/src/...)
        // Жорстко відрізаємо його!
        if (parts[0].toLowerCase() === rootName) {
            return parts.slice(1).join('/');
        }

        // Якщо ім'я проєкту загубилося десь посередині (напр. /home/user/totemforge-client/src/...)
        const rootIdx = parts.findIndex(p => p.toLowerCase() === rootName);
        if (rootIdx !== -1 && rootIdx < parts.length - 1) {
            return parts.slice(rootIdx + 1).join('/');
        }

        return clean.replace(/^\/+/, '');
    }
}