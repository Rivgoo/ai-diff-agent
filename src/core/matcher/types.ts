import type { IDocument } from '@/core/matcher/documentPort';
import type { MatchResult } from '@/shared/contracts';

export interface IMatcherLogger {
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
}

export interface MatchContext {
    readonly document: IDocument;
    readonly searchBlock: string;
    readonly replaceBlock?: string;
    readonly fileExtension: string;
    readonly enableAstMatching: boolean;
    readonly logger?: IMatcherLogger;
}

export interface IMatchStrategy {
    readonly name: string;
    readonly tier: number;
    findMatch(context: MatchContext): Promise<MatchResult>;
}