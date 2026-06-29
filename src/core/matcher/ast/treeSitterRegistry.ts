/// <reference types="node" />
import * as path from 'path';
import * as fs from 'fs';

// --- Строгі інтерфейси домену (Чиста Архітектура) ---

export interface ISyntaxNode {
    hasError(): boolean;
    text: string;
    type: string;
    isNamed: boolean;
    parent: ISyntaxNode | null;
    childForFieldName(fieldName: string): ISyntaxNode | null;
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

interface ITreeSitterLanguage {
    load(wasmFilePath: string): Promise<unknown>;
}

interface ITreeSitterConstructor {
    init(options?: { locateFile?: (scriptName: string) => string }): Promise<void>;
    Language?: ITreeSitterLanguage;
    new (): ITreeSitterParser;
}

// --- Універсальне завантаження бібліотеки (Обхід версійності) ---

// eslint-disable-next-line @typescript-eslint/no-var-requires
const WebTreeSitter = require('web-tree-sitter');

// Безпечно витягуємо класи залежно від версії web-tree-sitter (v0.24 vs v0.26+)
const ParserClass = (WebTreeSitter.Parser || WebTreeSitter.default || WebTreeSitter) as ITreeSitterConstructor;
const LanguageClass = (WebTreeSitter.Language || ParserClass.Language) as ITreeSitterLanguage;

// --- Реєстр Парсерів ---

export class AstParserRegistry {
    private static initialized = false;
    private static parsers = new Map<string, ITreeSitterParser>();

    public static async getParser(language: string): Promise<ITreeSitterParser | null> {
        try {
            if (!this.initialized) {
                const grammarsDir = path.join(__dirname, 'grammars');
                
                await ParserClass.init({
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

            const parser = new ParserClass();
            const lang = await LanguageClass.load(wasmPath);
            parser.setLanguage(lang);
            
            this.parsers.set(language, parser);
            return parser;
        } catch (e) {
            console.warn(`[AstParserRegistry] Failed to load WASM grammar for ${language}:`, e);
            return null;
        }
    }
}