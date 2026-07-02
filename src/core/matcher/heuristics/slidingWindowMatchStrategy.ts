import type { IMatchStrategy, MatchContext } from '../types';
import type { MatchResult } from '@/shared/contracts';
import { TextNormalizerV2 } from './textNormalizerV2';

/**
 * Strategy level 3: Sliding Window Match.
 * Detects AI hallucinated placeholders (e.g. "// ...") and attempts to match 
 * the 'head' and 'tail' of the block separately, bridging the gap between them.
 */
export class SlidingWindowMatchStrategy implements IMatchStrategy {
    public readonly name = 'SLIDING_WINDOW_MATCH';
    public readonly tier = 3;

    public async findMatch(context: MatchContext): Promise<MatchResult> {
        if (!context.allowSlidingWindow) {
            return { status: 'FAILED', reason: 'NOT_FOUND', matchesFound: 0 };
        }

        const { document, searchBlock } = context;
        const docText = document.getText();

        // Detect common AI placeholders (// ..., /* ... */, # ..., <!-- ... -->)
        const placeholderRegex = /^[\s]*(\/\/|\/\*|#|<!--)[\s\.]+(.*)?$/gm;
        const match = placeholderRegex.exec(searchBlock);

        if (!match) {
            return { status: 'FAILED', reason: 'NOT_FOUND', matchesFound: 0 };
        }

        // Split the search block into Head and Tail at the placeholder
        const splitIndex = match.index;
        const head = searchBlock.substring(0, splitIndex).trim();
        const tail = searchBlock.substring(splitIndex + match[0].length).trim();

        if (!head || !tail) {
            return { status: 'FAILED', reason: 'NOT_FOUND', matchesFound: 0 };
        }

        const map = TextNormalizerV2.normalizeWithMap(docText);
        const normHead = TextNormalizerV2.normalizeSearchBlock(head);
        const normTail = TextNormalizerV2.normalizeSearchBlock(tail);

        const headIdx = map.normalizedText.indexOf(normHead);
        if (headIdx === -1) return { status: 'FAILED', reason: 'NOT_FOUND', matchesFound: 0 };

        // Ensure head is relatively unique to avoid catastrophic mismatches
        if (map.normalizedText.indexOf(normHead, headIdx + 1) !== -1) {
            return { status: 'FAILED', reason: 'AMBIGUOUS_MATCH', matchesFound: 2 };
        }

        // Search for the tail strictly AFTER the head
        const tailSearchStart = headIdx + normHead.length;
        const tailIdx = map.normalizedText.indexOf(normTail, tailSearchStart);

        if (tailIdx === -1) return { status: 'FAILED', reason: 'NOT_FOUND', matchesFound: 0 };

        if (map.normalizedText.indexOf(normTail, tailIdx + 1) !== -1) {
            return { status: 'FAILED', reason: 'AMBIGUOUS_MATCH', matchesFound: 2 };
        }

        const normEnd = tailIdx + normTail.length - 1;

        const realStart = map.originalIndices[headIdx];
        const realEnd = map.originalIndices[normEnd] + 1;

        const { s, e } = TextNormalizerV2.expandToWhitespaceBoundaries(docText, realStart, realEnd);

        context.logger?.info(`[Heuristics] Sliding Window successfully bridged a hallucinated gap.`);

        return {
            status: 'MATCHED',
            range: {
                start: document.positionAt(s),
                end: document.positionAt(e)
            },
            confidence: 'fallback',
            confidenceScore: 'Low',
            strategy: this.name
        };
    }
}