import type { Range } from '@/shared/contracts';
import { AstParserRegistry, type ISyntaxNode } from '../ast/treeSitterRegistry';
import type { EngineSettings, AstSettings } from '@/shared/models';

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
        engineSettings: EngineSettings,
        astSettings: AstSettings
    ): Promise<boolean> {
        const langKey = LANGUAGE_DISPATCH_MAP[fileExtension.toLowerCase()];
        if (!langKey || !astSettings.enabledLanguages.includes(langKey)) return true;

        const parser = await AstParserRegistry.getParser(langKey);
        if (!parser) return true;

        const newText = this.applyChange(originalText, matchRange, replaceBlock);

        if (langKey === 'json') {
            const tree = parser.parse(newText);
            const hasError = tree.rootNode.hasError();
            tree.delete();
            return !hasError;
        }

        const isStrict = engineSettings.strictSyntaxValidation || astSettings.sanityStrictness === 'block_on_error';
        if (!isStrict && astSettings.sanityStrictness === 'ignore') {
            return true;
        }

        try {
            // ВИПРАВЛЕНО: Чисте перепарсування замість інкрементального (усуває проблеми з \r\n індексами)
            const originalTree = parser.parse(originalText);
            const originalErrors = this.countErrors(originalTree.rootNode);
            originalTree.delete();

            const newTree = parser.parse(newText);
            const newErrors = this.countErrors(newTree.rootNode);
            newTree.delete();

            // Блокуємо тільки якщо кількість помилок зросла БІЛЬШЕ ніж на 1
            return newErrors <= originalErrors + 1;
        } catch {
            return true;
        }
    }

    private static countErrors(root: ISyntaxNode): number {
        let count = 0;
        const walk = (node: ISyntaxNode) => {
            if (node.type === 'ERROR' || node.type === 'MISSING') count++;
            for (const child of node.children) walk(child);
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