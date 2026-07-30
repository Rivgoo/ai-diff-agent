import type { Range } from '@/shared/contracts';
import { AstParserRegistry, type ISyntaxNode } from '../ast/treeSitterRegistry';
import type { AstSettings } from '@/shared/models';

const LANGUAGE_DISPATCH_MAP: Record<string, string> = {
    '.json': 'json',
    '.ts': 'typescript',
    '.tsx': 'tsx',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.cs': 'c_sharp',
    '.py': 'python',
    '.html': 'html',
    '.css': 'css',
    '.sh': 'bash',
    '.bash': 'bash',
    '.cpp': 'cpp',
    '.hpp': 'cpp',
    '.cc': 'cpp',
    '.c': 'c',
    '.h': 'c'
};

export interface SanityResult {
    isSane: boolean;
    errorMessage?: string;
    errorRange?: Range;
}

export class SyntaxSanityChecker {
    public static async verify(
        originalText: string,
        matchRange: Range,
        replaceBlock: string,
        fileExtension: string,
        astSettings: AstSettings,
        logger?: { warn: (m: string) => void }
    ): Promise<SanityResult> {
        const isStrict = astSettings.strictSyntaxValidation || astSettings.sanityStrictness === 'block_on_error';
        
        if (!isStrict) {
            return { isSane: true };
        }

        const langKey = LANGUAGE_DISPATCH_MAP[fileExtension.toLowerCase()];
        if (!langKey || !astSettings.enabledLanguages.includes(langKey)) return { isSane: true };

        const parser = await AstParserRegistry.getParser(langKey);
        if (!parser) return { isSane: true };

        const newText = this.applyChange(originalText, matchRange, replaceBlock);

        if (langKey === 'json') {
            try {
                const tree = parser.parse(newText);
                const hasError = tree.rootNode.hasError();
                tree.delete();
                if (hasError) {
                    return { isSane: false, errorMessage: 'Invalid JSON structure.' };
                }
                return { isSane: true };
            } catch {
                return { isSane: false, errorMessage: 'Fatal JSON parsing error.' };
            }
        }

        try {
            const newTree = parser.parse(newText);
            
            const linesAdded = replaceBlock.split(/\r?\n/).length - 1;
            const linesRemoved = matchRange.end.line - matchRange.start.line;
            const newLineDelta = linesAdded - linesRemoved;
            const newEndLine = matchRange.end.line + newLineDelta;

            const errorNode = this.findFirstError(newTree.rootNode, matchRange.start.line, newEndLine);
            newTree.delete();

            if (errorNode) {
                const errorLine = errorNode.startPosition.row + 1;
                const nodeLabel = errorNode.type === 'MISSING' ? `Missing element` : `Unexpected token '${errorNode.text}'`;
                
                logger?.warn(`[SyntaxSanityChecker] Prevented AST corruption. Found ${nodeLabel} near line ${errorLine}.`);
                
                return {
                    isSane: false,
                    errorMessage: `${nodeLabel} near line ${errorLine}`,
                    errorRange: {
                        start: { line: errorNode.startPosition.row, character: errorNode.startPosition.column },
                        end: { line: errorNode.endPosition.row, character: errorNode.endPosition.column }
                    }
                };
            }

            return { isSane: true };
        } catch {
            return { isSane: false, errorMessage: 'Fatal AST parsing collision.' };
        }
    }

    private static findFirstError(root: ISyntaxNode, startLine: number, endLine: number): ISyntaxNode | null {
        let found: ISyntaxNode | null = null;
        const safeStart = Math.max(0, startLine - 2);
        const safeEnd = endLine + 2;

        const walk = (node: ISyntaxNode) => {
            if (found) return;
            if (node.type === 'ERROR' || node.type === 'MISSING') {
                if (node.startPosition.row <= safeEnd && node.endPosition.row >= safeStart) {
                    found = node;
                    return;
                }
            }
            for (const child of node.children) walk(child);
        };
        
        walk(root);
        return found;
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