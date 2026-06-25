import { IDocument } from './documentPort';
import { MatchResult } from '../../shared/contracts';
import { TextNormalizer } from './textNormalizer';
import { ExactMatchStrategy } from './searchPhaseExact';
import { FuzzyMatchStrategy } from './searchPhaseFuzzy';

/**
 * Coordinating Search Engine employing sequentially degrading strategies.
 */
export class SearchEngine {
    private readonly strategies = [
        new ExactMatchStrategy(),
        new FuzzyMatchStrategy()
    ];

    public findMatch(document: IDocument, searchBlock: string): MatchResult {
        const cleanSearchBlock = TextNormalizer.stripBOM(searchBlock).trim();
        if (!cleanSearchBlock) {
            return { status: 'FAILED', reason: 'EMPTY_SEARCH_BLOCK', matchesFound: 0 };
        }

        const docText = TextNormalizer.stripBOM(document.getText());

        for (const strategy of this.strategies) {
            const result = strategy.findMatches(docText, cleanSearchBlock, document);
            
            if (result.status === 'MATCHED') {
                return result;
            }
            
            if (result.status === 'FAILED' && result.reason === 'AMBIGUOUS_MATCH') {
                return result;
            }
        }

        return { status: 'FAILED', reason: 'NOT_FOUND', matchesFound: 0 };
    }
}
