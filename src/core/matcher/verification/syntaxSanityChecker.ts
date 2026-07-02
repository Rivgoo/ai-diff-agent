import type { Range } from '@/shared/contracts';
import { AstParserRegistry } from '../ast/treeSitterRegistry';

/**
 * Post-Flight verification system.
 * Simulates applying a matched replacement into memory to detect accidental syntax corruption.
 */
export class SyntaxSanityChecker {
    public static async verify(
        originalText: string,
        matchRange: Range,
        replaceBlock: string,
        fileExtension: string
    ): Promise<boolean> {
        const newText = this.applyChange(originalText, matchRange, replaceBlock);

        // 1. AST Validation for strictly structured data formats (like JSON)
        if (fileExtension === '.json') {
            const parser = await AstParserRegistry.getParser('json');
            if (parser) {
                const tree = parser.parse(newText);
                const hasError = tree.rootNode.hasError();
                tree.delete();
                return !hasError;
            }
        }

        return true;
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