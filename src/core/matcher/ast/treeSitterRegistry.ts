/// <reference types="node" />
import * as _Parser from 'web-tree-sitter';
import * as path from 'path';
import * as fs from 'fs';

// 1. Створюємо власні строгі інтерфейси
export interface ISyntaxNode {
    hasError(): boolean;
    text: string;
    children: ISyntaxNode[];
    startIndex: number;
    endIndex: number;
}

export interface IParserTree {
    rootNode: ISyntaxNode;
    delete(): void;
}

export interface ITreeSitterParser {
    setLanguage(language: unknown): void;
    parse(input: string): IParserTree;
}

interface ITreeSitterConstructor {
    init(options?: object): Promise<void>;
    Language: {
        load(wasmFilePath: string): Promise<unknown>;
    };
    new (): ITreeSitterParser;
}

// 2. Ховаємо ключ 'default' у змінну
const defaultKey = 'default';
const ParserConstructor = (((_Parser as unknown) as Record<string, ITreeSitterConstructor>)[defaultKey] || _Parser) as ITreeSitterConstructor;

/**
 * Singleton Registry for loading and caching WebAssembly Tree-sitter parsers.
 */
export class AstParserRegistry {
    private static initialized = false;
    private static parsers = new Map<string, ITreeSitterParser>();

    public static async getParser(language: string): Promise<ITreeSitterParser | null> {
        try {
            if (!this.initialized) {
                const grammarsDir = path.join(__dirname, 'grammars');
                
                await ParserConstructor.init({
                    locateFile: (scriptName: string) => {
                        return path.join(grammarsDir, scriptName);
                    }
                });
                this.initialized = true;
            }

            if (this.parsers.has(language)) {
                return this.parsers.get(language)!;
            }

            const wasmPath = path.join(__dirname, 'grammars', `tree-sitter-${language}.wasm`);
            
            if (!fs.existsSync(wasmPath)) {
                console.warn(`[AstParserRegistry] WASM file missing: ${wasmPath}`);
                return null;
            }

            const parser = new ParserConstructor();
            const lang = await ParserConstructor.Language.load(wasmPath);
            parser.setLanguage(lang);
            
            this.parsers.set(language, parser);
            return parser;
        } catch (e) {
            console.warn(`[AstParserRegistry] Failed to load WASM grammar for ${language}:`, e);
            return null;
        }
    }
}