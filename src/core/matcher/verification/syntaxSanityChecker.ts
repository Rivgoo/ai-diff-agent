import type { Range } from '@/shared/contracts';
import { AstParserRegistry, type ISyntaxNode } from '../ast/treeSitterRegistry';

const LANGUAGE_DISPATCH_MAP: Record<string, string> = {
    '.json': 'json',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.cs': 'c_sharp',
    '.py': 'python',
    '.html': 'html',
    '.css': 'css',
    '.sh': 'bash',
    '.bash': 'bash'
};

export class SyntaxSanityChecker {
    public static async verify(
        originalText: string,
        matchRange: Range,
        replaceBlock: string,
        fileExtension: string,
        blockOnSyntaxErrors: boolean // ДОДАНО
    ): Promise<boolean> {
        const newText = this.applyChange(originalText, matchRange, replaceBlock);
        
        const langKey = LANGUAGE_DISPATCH_MAP[fileExtension.toLowerCase()];
        if (!langKey) return true;

        const parser = await AstParserRegistry.getParser(langKey);
        if (!parser) return true;

        // JSON завжди перевіряємо жорстко, бо поламаний JSON крашить конфіги
        if (langKey === 'json') {
            const tree = parser.parse(newText);
            const hasError = tree.rootNode.hasError();
            tree.delete();
            return !hasError;
        }

        // Для звичайного коду (C#, TS)
        if (!blockOnSyntaxErrors) {
            return true; // Пропускаємо, довіряючи LSP VS Code
        }

        try {
            const originalTree = parser.parse(originalText);
            const originalErrors = this.countErrors(originalTree.rootNode);
            originalTree.delete();

            const newTree = parser.parse(newText);
            const newErrors = this.countErrors(newTree.rootNode);
            newTree.delete();

            // Блокуємо тільки якщо кількість помилок зросла БІЛЬШЕ ніж на 2.
            // Це захищає від дрібних нестиковок версій Tree-Sitter.
            return newErrors <= originalErrors + 2;
        } catch {
            return true;
        }
    }

    private static countErrors(root: ISyntaxNode): number {
        let count = 0;
        const walk = (node: ISyntaxNode) => {
            if (node.type === 'ERROR' || node.type === 'MISSING') {
                count++;
            }
            for (const child of node.children) {
                walk(child);
            }
        };
        walk(root);
        return count;
    }

    private static applyChange(text: string, range: Range, replaceWith: string): string {
        const lines = text.split(/\r?\n/);
        const beforeLines = lines.slice(0, range.start.line);
        const startLineBefore = lines[range.start.line]?.substring(0, range.start.character) || '';
        const before = beforeLines.join('\n') + (beforeLines.length > 0 ? '\n' : '') + startLineBefore;

        const endLineAfter = lines[range.end.line]?.substring(range.end.character) || '';
        const afterLines = lines.slice(range.end.line + 1);
        const after = endLineAfter + (afterLines.length > 0 ? '\n' : '') + afterLines.join('\n');

        return before + replaceWith + after;
    }
}