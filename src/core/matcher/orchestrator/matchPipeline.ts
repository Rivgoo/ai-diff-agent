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

        // Встановлюємо вагу помилок. Найважливіші не повинні перезаписуватись слабшими.
        const errorPriority: Record<string, number> = {
            'SYNTAX_CORRUPTION_PREVENTED': 3,
            'AMBIGUOUS_MATCH': 2,
            'EMPTY_SEARCH_BLOCK': 1,
            'NOT_FOUND': 0
        };

        for (const strategy of this.strategies) {
            if (strategy.tier >= 2 && isStrict) {
                continue;
            }

            const result = await strategy.findMatch(context);
            if (!result) continue;
            
            if (result.status === 'MATCHED') {
                if (context.replaceBlock !== undefined) {
                    const isSane = await SyntaxSanityChecker.verify(
                        context.document.getText(),
                        result.range,
                        context.replaceBlock,
                        context.fileExtension
                    );
                    if (!isSane) {
                        return { status: 'FAILED', reason: 'SYNTAX_CORRUPTION_PREVENTED', matchesFound: 1 };
                    }
                }
                return result;
            }
            
            if (result.status === 'FAILED') {
                // Записуємо помилку тільки якщо вона важливіша за попередню
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
