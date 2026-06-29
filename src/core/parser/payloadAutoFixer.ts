/**
 * Heuristic auto-recovery tool for common LLM syntax hallucinations.
 * Safely repairs structure based on file context without building a full AST.
 */
export class PayloadAutoFixer {
    
    /**
     * Attempts to repair broken syntax inside a given code block.
     * @param content The raw payload string from the LLM.
     * @param filePath The destination path to determine context-specific rules.
     */
    public static fix(content: string, filePath: string): string {
        if (!content) return content;
        
        let fixed = content;

        // --- GLOBAL FIXES ---
        
        // 1. Strip invisible Zero-Width Spaces (ZWSP) that LLMs often hallucinate,
        // which break standard TS/JS compilers silently.
        fixed = fixed.replace(/[\u200B-\u200D\uFEFF]/g, '');


        // --- WEB FRAMEWORK FIXES (React, Vue, Svelte, HTML) ---
        
        const isWebFile = /\.(tsx|jsx|html|vue|svelte)$/i.test(filePath);
        if (isWebFile) {
            // Fix 1: Missing backticks in template literals.
            // Matches: class={flex-1 ${isDatabase ? 'a' : 'b'}} or className=...
            // Replaces: class={`flex-1 ${isDatabase ? 'a' : 'b'}`}
            fixed = fixed.replace(/(class|className)=\{([^`"'{}]*?\$\{.+?\}[^`"'{}]*?)\}/g, '$1={`$2`}');

            // Fix 2: Missing standard quotes for plain string classes.
            // Matches: className={flex items-center gap-3}
            // Replaces: className="flex items-center gap-3"
            fixed = fixed.replace(/(class|className)=\{([a-zA-Z0-9\s\-_/]+)\}/g, '$1="$2"');
        }


        // --- DATA FORMAT FIXES (JSON) ---

        const isJson = /\.json$/i.test(filePath);
        if (isJson) {
            // Fix 3: Trailing commas in JSON.
            // LLMs frequently leave trailing commas when deleting the last item in a JSON object/array.
            // Matches a comma followed only by whitespace and a closing bracket/brace.
            fixed = fixed.replace(/,(?=\s*[}\]])/g, '');
        }

        return fixed;
    }
}