import type { IPathResolutionStrategy, ResolutionOptions } from './base';
import type { ResolutionResult } from '../models';
import type { IFileSystemPort, IWorkspaceSearchPort } from '../ports';
import { RESOLVER_CONSTANTS } from '../constants';

function makeCaseInsensitiveGlob(filename: string): string {
    return '**/' + filename.split('').map(char => {
        if (/[a-zA-Z]/.test(char)) {
            return `[${char.toLowerCase()}${char.toUpperCase()}]`;
        }
        return char;
    }).join('');
}

export class SegmentHeuristicStrategy implements IPathResolutionStrategy {
    public readonly name = RESOLVER_CONSTANTS.STRATEGY_NAMES.HEURISTIC;

    public async resolve(
        rawPath: string,
        _fs: IFileSystemPort,
        search: IWorkspaceSearchPort,
        _searchBlock?: string,
        options?: ResolutionOptions
    ): Promise<ResolutionResult | null> {
        const requestedSegments = rawPath.replace(/\\/g, '/').split('/').filter(Boolean);
        if (requestedSegments.length === 0) {
            return null;
        }

        const filename = requestedSegments[requestedSegments.length - 1];
        const caseInsensitivePattern = makeCaseInsensitiveGlob(filename);
        const respectGitIgnore = options?.respectGitIgnore ?? true;
        
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

            if (score >= RESOLVER_CONSTANTS.HEURISTIC_MIN_MATCH_SCORE) {
                if (score > maxScore) {
                    maxScore = score;
                    bestCandidates = [candidate];
                } else if (score === maxScore) {
                    bestCandidates.push(candidate);
                }
            }
        }

        if (bestCandidates.length === 1) {
            return {
                status: 'RESOLVED_RESILIENTLY',
                resolvedPath: bestCandidates[0],
                originalPath: rawPath,
                strategyUsed: this.name
            };
        }

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