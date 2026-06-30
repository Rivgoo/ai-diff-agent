/// <reference types="node" />
import * as path from 'path';
import * as fs from 'fs';

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

const WebTreeSitter = require('web-tree-sitter');

const ParserClass = (WebTreeSitter.Parser || WebTreeSitter.default || WebTreeSitter) as ITreeSitterConstructor;
const LanguageClass = (WebTreeSitter.Language || ParserClass.Language) as ITreeSitterLanguage;


export class AstParserRegistry {
    private static initialized = false;
    private static parsers = new Map<string, ITreeSitterParser>();

    public static async getParser(language: string, logger?: any): Promise<ITreeSitterParser | null> {
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
                logger?.warn(`[AstParserRegistry] WASM file missing: ${wasmPath}`);
                return null;
            }

            const parser = new ParserClass();
            const lang = await LanguageClass.load(wasmPath);
            parser.setLanguage(lang);
            
            this.parsers.set(language, parser);
            return parser;
        } catch (e) {
            logger?.warn(`[AstParserRegistry] Failed to load WASM grammar for ${language}: ${e}`);
            return null;
        }
    }
}