import type { Position } from '@/shared/contracts';

export interface IDocument {
    readonly path: string;
    getText(): string;
    getLineCount(): number;
    positionAt(offset: number): Position;
}
