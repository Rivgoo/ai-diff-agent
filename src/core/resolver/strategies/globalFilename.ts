import type { IPathResolutionStrategy, ResolutionOptions } from './base';
import type { ResolutionResult } from '../models';
import type { IFileSystemPort, IWorkspaceSearchPort } from '../ports';
import { RESOLVER_CONSTANTS } from '../constants';
import { TextNormalizerV2 } from '../../matcher/heuristics/textNormalizerV2';

function makeCaseInsensitiveGlob(filename: string): string {
    return '**/' + filename.split('').map(char => {
        if (/[a-zA-Z]/.test(char)) {
            return `[${char.toLowerCase()}${char.toUpperCase()}]`;
        }
        return char;
    }).join('');
}

export class GlobalFilenameStrategy implements IPathResolutionStrategy {
    public readonly name = RESOLVER_CONSTANTS.STRATEGY_NAMES.GLOBAL;

    public async resolve(
        rawPath: string,
        fs: IFileSystemPort,
        search: IWorkspaceSearchPort,
        searchBlock?: string,
        options?: ResolutionOptions
    ): Promise<ResolutionResult | null> {
        const segments = rawPath.replace(/\\/g, '/').split('/').filter(Boolean);
        if (segments.length === 0) return null;

        const filename = segments[segments.length - 1];
        const caseInsensitivePattern = makeCaseInsensitiveGlob(filename);
        const respectGitIgnore = options?.respectGitIgnore ?? true;
        const maxCandidates = options?.maxGlobalSearchCandidates ?? 5;
        
        const candidates = await search.findFiles(
            caseInsensitivePattern,
            RESOLVER_CONSTANTS.DEFAULT_EXCLUSIONS,
            respectGitIgnore
        );

        if (candidates.length === 0) return null;

        if (candidates.length === 1) {
            return {
                status: 'RESOLVED_RESILIENTLY',
                resolvedPath: candidates[0],
                originalPath: rawPath,
                strategyUsed: this.name
            };
        }

        if (candidates.length > maxCandidates) {
            options?.logger?.warn(`[GlobalFilenameStrategy] Found ${candidates.length} candidates for '${filename}', exceeding maximum allowed limit of ${maxCandidates}. Aborting deep read to prevent Memory/CPU crash.`);
            return this.buildAmbiguousMatch(rawPath, candidates);
        }

        if (!searchBlock) {
            return this.buildAmbiguousMatch(rawPath, candidates);
        }

        const normalizedSearch = TextNormalizerV2.normalizeSearchBlock(searchBlock);
        if (normalizedSearch.length === 0) {
            return this.buildAmbiguousMatch(rawPath, candidates);
        }

        const validCandidates: string[] = [];

        for (const candidate of candidates) {
            try {
                const content = await fs.readFile(candidate);
                if (!content) continue;

                const normalizedContent = TextNormalizerV2.normalizeWithMap(content).normalizedText;
                
                if (normalizedContent.includes(normalizedSearch)) {
                    validCandidates.push(candidate);
                }
            } catch (e) {
                options?.logger?.warn(`[GlobalFilenameStrategy] Failed to read candidate file '${candidate}' for fingerprinting: ${e instanceof Error ? e.message : String(e)}`);
                continue;
            }
        }

        if (validCandidates.length === 1) {
            options?.logger?.info(`[GlobalFilenameStrategy] Successfully identified unique target among ${candidates.length} candidates using Content Fingerprinting.`);
            return {
                status: 'RESOLVED_RESILIENTLY',
                resolvedPath: validCandidates[0],
                originalPath: rawPath,
                strategyUsed: `${this.name}_WITH_FINGERPRINT`
            };
        }

        const finalCandidates = validCandidates.length > 0 ? validCandidates : candidates;
        return this.buildAmbiguousMatch(rawPath, finalCandidates);
    }

    private buildAmbiguousMatch(rawPath: string, candidates: string[]): ResolutionResult {
        return {
            status: 'AMBIGUOUS_MATCH',
            resolvedPath: rawPath,
            originalPath: rawPath,
            strategyUsed: this.name,
            candidatePaths: candidates
        };
    }
}