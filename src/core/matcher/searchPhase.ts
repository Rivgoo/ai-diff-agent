import { IDocument } from './documentPort';
import { MatchResult } from '../../shared/contracts';

/**
 * Common Strategy interface for executing target code search.
 */
export interface ISearchStrategy {
    readonly name: string;
    findMatches(docText: string, searchBlock: string, document: IDocument): MatchResult;
}
