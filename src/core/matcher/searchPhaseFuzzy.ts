import { ISearchStrategy } from './searchPhase';
import { IDocument } from './documentPort';
import { MatchResult } from '../../shared/contracts';

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Indentation and Whitespace Resilient Strategy.
 * Ignores varying indentation levels, allowing matching even if the LLM output 
 * has broken spacing or tab levels.
 */
export class FuzzyMatchStrategy implements ISearchStrategy {
    public readonly name = 'FUZZY';

    public findMatches(docText: string, searchBlock: string, document: IDocument): MatchResult {
        const rawLines = searchBlock.split(/\r?\n/);
        
        let startIdx = 0;
        while (startIdx < rawLines.length && rawLines[startIdx].trim() === '') {
            startIdx++;
        }
        
        let endIdx = rawLines.length - 1;
        while (endIdx >= 0 && rawLines[endIdx].trim() === '') {
            endIdx--;
        }

        if (startIdx > endIdx) {
            return { status: 'FAILED', reason: 'EMPTY_SEARCH_BLOCK', matchesFound: 0 };
        }

        const targetLines = rawLines.slice(startIdx, endIdx + 1);

        const escapedLines = targetLines.map(line => {
            const trimmed = line.trim();
            if (trimmed === '') {
                return '[ \\t]*'; // Match optional horizontal space for empty internal lines
            }
            return escapeRegExp(trimmed);
        });

        // Match horizontal spacing boundaries securely
        const fuzzyPattern = '[ \\t]*' + escapedLines.join('[ \\t]*\\r?\\n[ \\t]*') + '[ \\t]*';
        const regex = new RegExp(fuzzyPattern, 'g');

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
            confidence: 'fallback'
        };
    }
}
