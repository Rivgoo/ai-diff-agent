import { ISearchStrategy } from './searchPhase';
import { IDocument } from './documentPort';
import { MatchResult } from '../../shared/contracts';

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Exact Match Strategy.
 * Matches code block line-by-line verbatim, while remaining resilient to CRLF vs LF line endings.
 */
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
