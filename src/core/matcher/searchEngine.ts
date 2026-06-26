import type { IDocument } from '@/core/matcher/documentPort';
import type { MatchResult } from '@/shared/contracts';
import { TextNormalizer } from '@/core/matcher/textNormalizer';
import { ExactMatchStrategy } from '@/core/matcher/searchPhaseExact';
import { FuzzyMatchStrategy } from '@/core/matcher/searchPhaseFuzzy';

export class SearchEngine {
    private readonly exactStrategy = new ExactMatchStrategy();
    private readonly fuzzyStrategy = new FuzzyMatchStrategy();

    // Формати файлів, для яких відступи є критичною частиною синтаксису
    private readonly strictExtensions = new Set(['.py', '.yaml', '.yml']);

    public findMatch(document: IDocument, searchBlock: string): MatchResult {
        const cleanSearchBlock = TextNormalizer.stripBOM(searchBlock).trim();
        if (!cleanSearchBlock) {
            return { status: 'FAILED', reason: 'EMPTY_SEARCH_BLOCK', matchesFound: 0 };
        }

        const docText = TextNormalizer.stripBOM(document.getText());
        
        // 1. Спочатку завжди намагаємося знайти точний збіг
        let result = this.exactStrategy.findMatches(docText, cleanSearchBlock, document);
        if (result.status === 'MATCHED' || (result.status === 'FAILED' && result.reason === 'AMBIGUOUS_MATCH')) {
            return result;
        }

        // 2. Блокуємо нечіткий пошук (Fuzzy Match) для чутливих до відступів мов
        const ext = this.getFileExtension(document.path);
        if (this.strictExtensions.has(ext)) {
            return { status: 'FAILED', reason: 'NOT_FOUND', matchesFound: 0 };
        }

        // 3. Застосовуємо нечіткий пошук як запасний варіант
        result = this.fuzzyStrategy.findMatches(docText, cleanSearchBlock, document);
        if (result.status === 'MATCHED' || (result.status === 'FAILED' && result.reason === 'AMBIGUOUS_MATCH')) {
            return result;
        }

        return { status: 'FAILED', reason: 'NOT_FOUND', matchesFound: 0 };
    }

    private getFileExtension(filePath: string): string {
        const dotIndex = filePath.lastIndexOf('.');
        return dotIndex !== -1 ? filePath.substring(dotIndex).toLowerCase() : '';
    }
}