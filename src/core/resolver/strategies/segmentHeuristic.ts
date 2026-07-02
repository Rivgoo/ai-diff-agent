import type { IPathResolutionStrategy } from './base';
import type { ResolutionResult } from '../models';
import type { IFileSystemPort, IWorkspaceSearchPort } from '../ports';
import { RESOLVER_CONSTANTS } from '../constants';

/**
 * Generates a case-insensitive glob pattern by wrapping each alphabetic character in a bracket class.
 * e.g., "Logger.ts" -> "**\/[Ll][Oo][Gg][Gg][Ee][Rr].[Tt][Ss]"
 */
function makeCaseInsensitiveGlob(filename: string): string {
    return '**/' + filename.split('').map(char => {
        if (/[a-zA-Z]/.test(char)) {
            return `[${char.toLowerCase()}${char.toUpperCase()}]`;
        }
        return char;
    }).join('');
}

/**
 * Strategy level 2: Trailing Segment Matching.
 * Leverages structured sliding-window segment evaluations to resolve relocated modules
 * (e.g., matching 'src/components/button/Button.tsx' to 'src/features/ui/button/Button.tsx').
 */
export class SegmentHeuristicStrategy implements IPathResolutionStrategy {
    public readonly name = RESOLVER_CONSTANTS.STRATEGY_NAMES.HEURISTIC;

    public async resolve(
        rawPath: string,
        _fs: IFileSystemPort,
        search: IWorkspaceSearchPort,
        _searchBlock?: string,
        respectGitIgnore?: boolean
    ): Promise<ResolutionResult | null> {
        const requestedSegments = rawPath.replace(/\\/g, '/').split('/').filter(Boolean);
        if (requestedSegments.length === 0) {
            return null;
        }

        const filename = requestedSegments[requestedSegments.length - 1];
        const caseInsensitivePattern = makeCaseInsensitiveGlob(filename);
        
        // Locate all files matching the target filename globally using a case-insensitive glob class
        const candidates = await search.findFiles(
            caseInsensitivePattern,
            RESOLVER_CONSTANTS.DEFAULT_EXCLUSIONS,
            respectGitIgnore
        );

        if (candidates.length === 0) {
            return null;
        }

        let maxScore = 0;
        let bestCandidates: string[] = [];

        // Score candidates based on consecutive matching suffix segments (moving right to left)
        for (const candidate of candidates) {
            const candidateSegments = candidate.replace(/\\/g, '/').split('/').filter(Boolean);
            let score = 0;
            let reqIdx = requestedSegments.length - 1;
            let candIdx = candidateSegments.length - 1;

            while (reqIdx >= 0 && candIdx >= 0) {
                if (requestedSegments[reqIdx].toLowerCase() === candidateSegments[candIdx].toLowerCase()) {
                    score++;
                    reqIdx--;
                    candIdx--;
                } else {
                    break;
                }
            }

            // High confidence is achieved when at least the filename and its parent folder match (score >= 2)
            if (score >= RESOLVER_CONSTANTS.HEURISTIC_MIN_MATCH_SCORE) {
                if (score > maxScore) {
                    maxScore = score;
                    bestCandidates = [candidate];
                } else if (score === maxScore) {
                    bestCandidates.push(candidate);
                }
            }
        }

        // Return direct resolution if single best heuristic matches
        if (bestCandidates.length === 1) {
            return {
                status: 'RESOLVED_RESILIENTLY',
                resolvedPath: bestCandidates[0],
                originalPath: rawPath,
                strategyUsed: this.name
            };
        }

        // Handle ambiguous scenario where multiple files share the exact same high-confidence match score
        if (bestCandidates.length > 1) {
            return {
                status: 'AMBIGUOUS_MATCH',
                resolvedPath: rawPath,
                originalPath: rawPath,
                strategyUsed: this.name,
                candidatePaths: bestCandidates
            };
        }

        return null;
    }
}
