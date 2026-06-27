import type { IMatchStrategy, MatchContext } from '../types';
import type { MatchResult } from '@/shared/contracts';
import { TextNormalizerV2 } from './textNormalizerV2';

export class AnchorMatchStrategy implements IMatchStrategy {
    public readonly name = 'ANCHOR_HEURISTIC_MATCH';
    public readonly tier = 3;

    public async findMatch(context: MatchContext): Promise<MatchResult | null> {
        const { document, searchBlock } = context;
        const docText = document.getText();
        
        const lines = searchBlock.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length <= 3) return null;

        const headAnchor = lines.slice(0, 2).join('\n');
        const tailAnchor = lines.slice(-2).join('\n');

        const map = TextNormalizerV2.normalizeWithMap(docText);
        const normHead = TextNormalizerV2.normalizeSearchBlock(headAnchor);
        const normTail = TextNormalizerV2.normalizeSearchBlock(tailAnchor);
        const normSearchTotal = TextNormalizerV2.normalizeSearchBlock(searchBlock);

        if (normHead.length === 0 || normTail.length === 0) return null;

        const headIndices: number[] = [];
        let cursor = 0;
        while ((cursor = map.normalizedText.indexOf(normHead, cursor)) !== -1) {
            headIndices.push(cursor);
            cursor++;
        }

        if (headIndices.length === 0) return null;

        const validPairs: { start: number; end: number }[] = [];
        const expectedDistance = normSearchTotal.length;
        const tolerance = Math.max(20, expectedDistance * 0.3); 

        for (const hIdx of headIndices) {
            const searchStart = hIdx + normHead.length;
            let tCursor = searchStart;
            
            while ((tCursor = map.normalizedText.indexOf(normTail, tCursor)) !== -1) {
                const matchDistance = (tCursor + normTail.length) - hIdx;
                if (Math.abs(matchDistance - expectedDistance) <= tolerance) {
                    validPairs.push({ start: hIdx, end: tCursor + normTail.length - 1 });
                }
                tCursor++;
            }
        }

        if (validPairs.length === 0) return null;
        if (validPairs.length > 1) {
            return { status: 'FAILED', reason: 'AMBIGUOUS_MATCH', matchesFound: validPairs.length };
        }

        const pair = validPairs[0];
        const realStart = map.originalIndices[pair.start];
        const realEnd = map.originalIndices[pair.end] + 1;

        const { s, e } = TextNormalizerV2.expandToWhitespaceBoundaries(docText, realStart, realEnd);

        return {
            status: 'MATCHED',
            range: {
                start: document.positionAt(s),
                end: document.positionAt(e)
            },
            confidence: 'fallback'
        };
    }
}
