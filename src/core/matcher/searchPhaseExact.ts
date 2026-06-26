import type { ISearchStrategy } from '@/core/matcher/searchPhase';
import type { IDocument } from '@/core/matcher/documentPort';
import type { MatchResult } from '@/shared/contracts';

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class ExactMatchStrategy implements ISearchStrategy {
    public readonly name = 'EXACT';

    public findMatches(docText: string, searchBlock: string, document: IDocument): MatchResult {
        const lines = searchBlock.split(/\r?\n/);
        const escapedLines = lines.map(line => escapeRegExp(line));
        
        const exactPattern = escapedLines.join('\\r?\\n');
        const regex = new RegExp(exactPattern, 'g');

        const matches: { index: number; length: number }[] = [];
        let match;

        while ((match = regex.exec(docText)) !== null) {
            matches.push({ index: match.index, length: match[0].length });
            if (regex.lastIndex === match.index) {
                regex.lastIndex++;
            }
        }

        if (matches.length === 0) {
            return { status: 'FAILED', reason: 'NOT_FOUND', matchesFound: 0 };
        }

        if (matches.length > 1) {
            return { status: 'FAILED', reason: 'AMBIGUOUS_MATCH', matchesFound: matches.length };
        }

        const targetMatch = matches[0];
        const startPos = document.positionAt(targetMatch.index);
        const endPos = document.positionAt(targetMatch.index + targetMatch.length);

        return {
            status: 'MATCHED',
            range: { start: startPos, end: endPos },
            confidence: 'exact'
        };
    }
}
