import { Position } from '../../shared/contracts';

/**
 * Decoupled boundary port representing target file access.
 * Allows execution of core search engine outside of VS Code context.
 */
export interface IDocument {
    readonly path: string;
    getText(): string;
    getLineCount(): number;
    /** Accurate translation of character absolute offsets into positions, delegated to implementation */
    positionAt(offset: number): Position;
}
