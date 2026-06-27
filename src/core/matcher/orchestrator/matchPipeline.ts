import type { MatchContext, IMatchStrategy } from '../types';
import type { MatchResult } from '@/shared/contracts';
import { AstMatchStrategy } from '../ast/astMatchStrategy';
import { ExactMatchStrategy } from '../heuristics/exactMatchStrategy';
import { NormalizedMatchStrategy } from '../heuristics/normalizedMatchStrategy';
import { AnchorMatchStrategy } from '../heuristics/anchorMatchStrategy';
import { SyntaxSanityChecker } from '../verification/syntaxSanityChecker';

export class MatchPipeline {
    private readonly strategies: IMatchStrategy[] = [
        new AstMatchStrategy(),
        new ExactMatchStrategy(),
        new NormalizedMatchStrategy(),
        new AnchorMatchStrategy()
    ];

    private readonly strictExtensions = new Set(['.py', '.yaml', '.yml']);

    public async execute(context: MatchContext): Promise<MatchResult> {
        let bestFailure: MatchResult | null = null;
        const isStrict = this.strictExtensions.has(context.fileExtension.toLowerCase());

        for (const strategy of this.strategies) {
            if (strategy.tier >= 2 && isStrict) {
                continue;
            }

            const result = await strategy.findMatch(context);
            if (!result) continue;
            
            if (result.status === 'MATCHED') {
                // Post-Apply Syntax Verification
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
                if (result.reason === 'AMBIGUOUS_MATCH') {
                    return result; 
                }
                bestFailure = result;
            }
        }

        return bestFailure || { status: 'FAILED', reason: 'NOT_FOUND', matchesFound: 0 };
    }
}
