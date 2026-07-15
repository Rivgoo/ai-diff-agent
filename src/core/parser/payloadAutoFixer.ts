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

        return fixed;
    }
}