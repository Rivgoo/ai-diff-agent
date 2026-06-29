import type { IDocument } from '@/core/matcher/documentPort';
import type { MatchResult } from '@/shared/contracts';

export interface MatchContext {
    readonly document: IDocument;
    readonly searchBlock: string;
    readonly replaceBlock?: string;
    readonly fileExtension: string;
    readonly enableAstMatching: boolean;
}

export interface IMatchStrategy {
    readonly name: string;
    readonly tier: number;
    findMatch(context: MatchContext): Promise<MatchResult | null>;
}
