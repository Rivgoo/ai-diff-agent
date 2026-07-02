import type { IMatchStrategy, MatchContext } from '../types';
import type { MatchResult } from '@/shared/contracts';
import { TextNormalizerV2 } from './textNormalizerV2';

export class NormalizedMatchStrategy implements IMatchStrategy {
    public readonly name = 'NORMALIZED_MATCH';
    public readonly tier = 2;

    public async findMatch(context: MatchContext): Promise<MatchResult> {
        const { document, searchBlock } = context;
        const docText = document.getText();
        
        const map = TextNormalizerV2.normalizeWithMap(docText);
        const normalizedSearch = TextNormalizerV2.normalizeSearchBlock(searchBlock);

        if (normalizedSearch.length === 0) return { status: 'FAILED', reason: 'NOT_FOUND', matchesFound: 0 };

        const matchIdx = map.normalizedText.indexOf(normalizedSearch);
        if (matchIdx === -1) return { status: 'FAILED', reason: 'NOT_FOUND', matchesFound: 0 };

        const nextMatchIdx = map.normalizedText.indexOf(normalizedSearch, matchIdx + 1);
        if (nextMatchIdx !== -1) {
            let count = 2;
            let cursor = nextMatchIdx + 1;
            while ((cursor = map.normalizedText.indexOf(normalizedSearch, cursor)) !== -1) {
                count++;
            }
            return { status: 'FAILED', reason: 'AMBIGUOUS_MATCH', matchesFound: count };
        }

        const normStart = matchIdx;
        const normEnd = matchIdx + normalizedSearch.length - 1;

        const realStart = map.originalIndices[normStart];
        const realEnd = map.originalIndices[normEnd] + 1;

        const { s, e } = TextNormalizerV2.expandToWhitespaceBoundaries(docText, realStart, realEnd);

        return {
            status: 'MATCHED',
            range: {
                start: document.positionAt(s),
                end: document.positionAt(e)
            },
            confidence: 'fallback',
            confidenceScore: 'Medium',
            strategy: this.name
        };
    }
}
