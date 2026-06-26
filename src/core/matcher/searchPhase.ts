import type { IDocument } from '@/core/matcher/documentPort';
import type { MatchResult } from '@/shared/contracts';

export interface ISearchStrategy {
    readonly name: string;
    findMatches(docText: string, searchBlock: string, document: IDocument): MatchResult;
}
