/// <reference types="node" />

import * as path from 'path';
import * as fs from 'fs';

export interface ITreeSitterPoint {
    row: number;
    column: number;
}

export interface ITreeSitterEdit {
    startIndex: number;
    oldEndIndex: number;
    newEndIndex: number;
    startPosition: ITreeSitterPoint;
    oldEndPosition: ITreeSitterPoint;
    newEndPosition: ITreeSitterPoint;
}

export interface ISyntaxNode {
    type: string;
    text: string;
    isNamed: boolean;
    startIndex: number;
    endIndex: number;
    startPosition: ITreeSitterPoint;
    endPosition: ITreeSitterPoint;
    parent: ISyntaxNode | null;
    children: ISyntaxNode[];
    
    hasError(): boolean;
    childForFieldName(fieldName: string): ISyntaxNode | null;
    walk(): ITreeCursor;
}

export interface ITreeCursor {
    nodeType: string;
    nodeText: string;
    nodeIsNamed: boolean;
    startPosition: ITreeSitterPoint;
    endPosition: ITreeSitterPoint;
    startIndex: number;
    endIndex: number;
    readonly currentNode: ISyntaxNode;

    gotoParent(): boolean;
    gotoFirstChild(): boolean;
    gotoNextSibling(): boolean;
    delete(): void;
}

export interface IParserTree {
    rootNode: ISyntaxNode;
    edit(delta: ITreeSitterEdit): IParserTree;
    getLanguage(): any;
    delete(): void;
}

export interface ITreeSitterParser {
    setLanguage(language: any): void;
    getLanguage(): any;
    parse(input: string, previousTree?: IParserTree): IParserTree;
    setTimeoutMicros?(timeout: number): void;
    setTimeout?(timeout: number): void;
    delete(): void;
}

interface ITreeSitterLanguage {
    load(wasmFilePath: string): Promise<any>;
}

interface ITreeSitterConstructor {
    init(options?: { locateFile?: (scriptName: string) => string }): Promise<void>;
    Language?: ITreeSitterLanguage;
    Query: any; // Клас запитів знаходиться тут у JS-обгортці
    new (): ITreeSitterParser;
}

const WebTreeSitter = require('web-tree-sitter');
const ParserClass = (WebTreeSitter.Parser || WebTreeSitter.default || WebTreeSitter) as ITreeSitterConstructor;
const LanguageClass = (WebTreeSitter.Language || ParserClass.Language) as ITreeSitterLanguage;

export class AstParserRegistry {
    private static isInitialized = false;
    private static wasmDirectoryPath = '';
    private static readonly parsers = new Map<string, ITreeSitterParser>();
    private static readonly languages = new Map<string, any>();

    public static async initialize(absoluteWasmDirectory: string): Promise<void> {
        if (this.isInitialized) return;
        
        this.wasmDirectoryPath = absoluteWasmDirectory;
        
        await ParserClass.init({
            locateFile: (scriptName: string) => {
                return path.join(this.wasmDirectoryPath, scriptName);
            }
        });
        
        this.isInitialized = true;
    }

    public static async getParser(language: string, logger?: any, timeoutMs: number = 100): Promise<ITreeSitterParser | null> {
        if (!this.isInitialized) {
            logger?.error('[AST] ParserRegistry accessed before initialization. Call initialize() first.');
            return null;
        }

        if (this.parsers.has(language)) {
            const parser = this.parsers.get(language)!;
            const micros = timeoutMs * 1000;
            if (typeof parser.setTimeoutMicros === 'function') {
                parser.setTimeoutMicros(micros);
            } else if (typeof parser.setTimeout === 'function') {
                parser.setTimeout(micros);
            }
            return parser;
        }

        const wasmFileName = `tree-sitter-${language}.wasm`;
        const wasmPath = path.join(this.wasmDirectoryPath, wasmFileName);
        
        if (!fs.existsSync(wasmPath)) {
            logger?.warn(`[AST] WASM grammar missing for language '${language}': ${wasmPath}`);
            return null;
        }

        try {
            const parser = new ParserClass();
            const lang = await LanguageClass.load(wasmPath);
            
            parser.setLanguage(lang);

            const micros = timeoutMs * 1000;
            if (typeof parser.setTimeoutMicros === 'function') {
                parser.setTimeoutMicros(micros); 
            } else if (typeof parser.setTimeout === 'function') {
                parser.setTimeout(micros);
            }
            
            this.parsers.set(language, parser);
            this.languages.set(language, lang);
            
            return parser;
        } catch (error) {
            logger?.error(`[AST] Failed to compile WASM grammar for '${language}': ${error}`);
            return null;
        }
    }

    public static dispose(): void {
        for (const parser of this.parsers.values()) {
            parser.delete();
        }
        this.parsers.clear();
        this.languages.clear();
        this.isInitialized = false;
    }
}