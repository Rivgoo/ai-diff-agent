import type { MatchContext, IMatchStrategy } from '../types';
import type { MatchResult } from '@/shared/contracts';
import { AstMatchStrategy } from '../ast/astMatchStrategy';
import { ExactMatchStrategy } from '../heuristics/exactMatchStrategy';
import { NormalizedMatchStrategy } from '../heuristics/normalizedMatchStrategy';
import { SlidingWindowMatchStrategy } from '../heuristics/slidingWindowMatchStrategy';
import { AnchorMatchStrategy } from '../heuristics/anchorMatchStrategy';
import { SyntaxSanityChecker } from '../verification/syntaxSanityChecker';
import { AggressiveMatchStrategy } from '../heuristics/aggressiveMatchStrategy';

export class MatchPipeline {
    private readonly strategies: IMatchStrategy[] = [
        new AstMatchStrategy(),
        new ExactMatchStrategy(),
        new NormalizedMatchStrategy(),
        new SlidingWindowMatchStrategy(), 
        new AnchorMatchStrategy(),
        new AggressiveMatchStrategy()
    ];

    private readonly strictExtensions = new Set(['.py', '.yaml', '.yml']);

    public async execute(context: MatchContext): Promise<MatchResult> {
        let bestFailure: MatchResult | null = null;
        const isStrict = this.strictExtensions.has(context.fileExtension.toLowerCase());

        const errorPriority: Record<string, number> = {
            'SYNTAX_CORRUPTION_PREVENTED': 3,
            'AMBIGUOUS_MATCH': 2,
            'EMPTY_SEARCH_BLOCK': 1,
            'NOT_FOUND': 0
        };

        const fallbackLevel = context.engineSettings.fallbackMatchLevel;

        for (const strategy of this.strategies) {
            if (strategy.tier >= 2 && fallbackLevel === 'none') continue;
            if (strategy.tier >= 4 && fallbackLevel === 'safe') continue;
            
            if (strategy.tier >= 2 && isStrict) {
                continue; 
            }

            let result: MatchResult;
            
            try {
                result = await strategy.findMatch(context);
            } catch (error) {
                context.logger?.warn(`[MatchPipeline] Strategy '${strategy.name}' threw an unexpected execution error: ${error instanceof Error ? error.message : String(error)}. Skipping to next fallback strategy.`);
                continue;
            }

            if (!result) continue;
            
            if (result.status === 'MATCHED') {
                if (context.replaceBlock !== undefined) {
                    let sanity;
                    
                    try {
                        sanity = await SyntaxSanityChecker.verify(
                            context.document.getText(),
                            result.range,
                            context.replaceBlock,
                            context.fileExtension,
                            context.astSettings,
                            context.logger
                        );
                    } catch (sanityError) {
                        context.logger?.error(`[MatchPipeline] SyntaxSanityChecker crashed: ${sanityError instanceof Error ? sanityError.message : String(sanityError)}`);
                        sanity = { isSane: false, errorMessage: 'Internal Sanity Checker crash.' };
                    }
                    
                    if (!sanity.isSane) {
                        return { 
                            status: 'FAILED', 
                            reason: 'SYNTAX_CORRUPTION_PREVENTED', 
                            matchesFound: 1,
                            diagnostic: {
                                path: context.document.path,
                                severity: 'critical',
                                title: 'AST Syntax Corruption',
                                detailedMessage: `AI modification introduces a critical syntax error: ${sanity.errorMessage}`,
                                range: sanity.errorRange,
                                code: 'AST_CORRUPTION'
                            }
                        };
                    }
                }
                return result;
            }
            
            if (result.status === 'FAILED') {
                const currentPriority = errorPriority[result.reason] ?? 0;
                const bestPriority = bestFailure ? (errorPriority[bestFailure.reason] ?? 0) : -1;
                
                if (currentPriority > bestPriority) {
                    bestFailure = result;
                }
            }
        }

        return bestFailure || { status: 'FAILED', reason: 'NOT_FOUND', matchesFound: 0 };
    }
}