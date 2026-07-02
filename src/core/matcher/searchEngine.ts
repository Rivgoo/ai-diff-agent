import type { IDocument } from '@/core/matcher/documentPort';
import type { MatchResult } from '@/shared/contracts';
import { MatchPipeline } from './orchestrator/matchPipeline';
import type { MatchContext, IMatcherLogger } from './types';

export class SearchEngine {
    private readonly pipeline = new MatchPipeline();

    constructor() {}

    public async findMatch(
        document: IDocument, 
        searchBlock: string, 
        replaceBlock?: string,
        enableAstMatching: boolean = true, 
        allowFuzzyMatching: boolean = true, 
        allowSlidingWindow: boolean = true, 
        logger?: IMatcherLogger
    ): Promise<MatchResult> {
        const cleanSearchBlock = this.stripBOM(searchBlock).trim();
        
        if (!cleanSearchBlock) {
            return { status: 'FAILED', reason: 'EMPTY_SEARCH_BLOCK', matchesFound: 0 };
        }

        const context: MatchContext = {
            document,
            searchBlock: cleanSearchBlock,
            replaceBlock,
            fileExtension: this.getFileExtension(document.path),
            enableAstMatching,
            allowFuzzyMatching,
            allowSlidingWindow,
            logger
        };

        return await this.pipeline.execute(context);
    }

    private stripBOM(text: string): string {
        return text.charCodeAt(0) === 0xFEFF ? text.substring(1) : text;
    }

    private getFileExtension(filePath: string): string {
        const dotIndex = filePath.lastIndexOf('.');
        return dotIndex !== -1 ? filePath.substring(dotIndex).toLowerCase() : '';
    }
}