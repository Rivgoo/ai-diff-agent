import type Parser from 'web-tree-sitter';
import * as _Parser from 'web-tree-sitter';
import * as path from 'path';

/**
 * Dynamic ESM-to-CJS Interop Resolver.
 * Uses bracket notation lookup to bypass esbuild's compile-time static analysis warnings.
 */
const ParserConstructor = (_Parser as any)['default'] || _Parser;

/**
 * Singleton Registry for loading and caching WebAssembly Tree-sitter parsers.
 */
export class AstParserRegistry {
    private static initialized = false;
    private static parsers = new Map<string, Parser>();

    public static async getParser(language: string): Promise<Parser | null> {
        try {
            if (!this.initialized) {
                // Initialize Parser with dynamic file resolution for VS Code sandboxes
                await ParserConstructor.init({
                    locateFile: (scriptName: string) => {
                        return path.join(__dirname, 'grammars', scriptName);
                    }
                });
                this.initialized = true;
            }

            if (this.parsers.has(language)) {
                return this.parsers.get(language)!;
            }

            const parser = new ParserConstructor() as Parser;
            const wasmPath = path.join(__dirname, 'grammars', `tree-sitter-${language}.wasm`);
            const lang = await ParserConstructor.Language.load(wasmPath);
            parser.setLanguage(lang);
            
            this.parsers.set(language, parser);
            return parser;
        } catch (e) {
            console.warn(`[AstParserRegistry] Failed to load WASM grammar for ${language}. Falling back to heuristics.`);
            return null;
        }
    }
}
