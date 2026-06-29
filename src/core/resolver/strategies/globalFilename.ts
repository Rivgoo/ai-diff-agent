import type { IPathResolutionStrategy } from './base';
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
        searchBlock?: string
    ): Promise<ResolutionResult | null> {
        const segments = rawPath.replace(/\\/g, '/').split('/').filter(Boolean);
        if (segments.length === 0) return null;

        const filename = segments[segments.length - 1];
        const caseInsensitivePattern = makeCaseInsensitiveGlob(filename);
        
        const candidates = await search.findFiles(
            caseInsensitivePattern,
            RESOLVER_CONSTANTS.DEFAULT_EXCLUSIONS
        );

        if (candidates.length === 0) return null;

        // Якщо знайдено рівно 1 файл - це ідеальний збіг
        if (candidates.length === 1) {
            return {
                status: 'RESOLVED_RESILIENTLY',
                resolvedPath: candidates[0],
                originalPath: rawPath,
                strategyUsed: this.name
            };
        }

        // Якщо маємо кілька кандидатів, але немає блоку для пошуку - віддаємо амбівалентність
        if (!searchBlock) {
            return this.buildAmbiguousMatch(rawPath, candidates);
        }

        // --- Унікальна перевірка контенту (Content Fingerprinting) ---
        // Нормалізуємо пошуковий блок для ігнорування відступів
        const normalizedSearch = TextNormalizerV2.normalizeSearchBlock(searchBlock);
        if (normalizedSearch.length === 0) {
            return this.buildAmbiguousMatch(rawPath, candidates);
        }

        const validCandidates: string[] = [];

        for (const candidate of candidates) {
            try {
                const content = await fs.readFile(candidate); // Потребує оновлення IFileSystemPort (див. нижче)
                if (!content) continue;

                const normalizedContent = TextNormalizerV2.normalizeWithMap(content).normalizedText;
                
                // Перевіряємо, чи є блок у цьому файлі
                if (normalizedContent.includes(normalizedSearch)) {
                    validCandidates.push(candidate);
                }
            } catch (e) {
                // Ігноруємо файли, які не вдалося прочитати
                continue;
            }
        }

        // Якщо блок знайдено рівно в одному з файлів - ми врятували транзакцію!
        if (validCandidates.length === 1) {
            return {
                status: 'RESOLVED_RESILIENTLY',
                resolvedPath: validCandidates[0],
                originalPath: rawPath,
                strategyUsed: `${this.name}_WITH_FINGERPRINT`
            };
        }

        // Якщо блок є у кількох файлах (або не знайдено в жодному), зберігаємо амбівалентність
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