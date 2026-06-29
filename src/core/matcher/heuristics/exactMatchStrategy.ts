import type { IMatchStrategy, MatchContext } from '../types';
import type { MatchResult } from '@/shared/contracts';

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class ExactMatchStrategy implements IMatchStrategy {
    public readonly name = 'EXACT_MATCH';
    public readonly tier = 1;

    public async findMatch(context: MatchContext): Promise<MatchResult | null> {
        const { document, searchBlock } = context;
        const docText = document.getText();
        
        // Розбиваємо на рядки та екрануємо кожен окремо
        const lines = searchBlock.replace(/\r\n/g, '\n').split('\n');
        const escapedLines = lines.map(line => escapeRegExp(line));
        
        // Збираємо назад, дозволяючи опціональні символи повернення каретки (\r) 
        // для сумісності між Windows та Unix
        const exactPattern = escapedLines.join('\\r?\\n');
        const regex = new RegExp(exactPattern, 'g');

        const matches: { index: number; length: number }[] = [];
        let match;

        while ((match = regex.exec(docText)) !== null) {
            matches.push({ index: match.index, length: match[0].length });
            // Запобігаємо нескінченному циклу для пустих збігів
            if (regex.lastIndex === match.index) {
                regex.lastIndex++;
            }
        }

        if (matches.length === 0) return null;
        
        // Якщо знайдено більше одного точного збігу - сигналізуємо про амбівалентність
        if (matches.length > 1) {
            return { status: 'FAILED', reason: 'AMBIGUOUS_MATCH', matchesFound: matches.length };
        }

        const targetMatch = matches[0];
        return {
            status: 'MATCHED',
            range: {
                start: document.positionAt(targetMatch.index),
                end: document.positionAt(targetMatch.index + targetMatch.length)
            },
            confidence: 'exact',
            strategy: this.name
        };
    }
}