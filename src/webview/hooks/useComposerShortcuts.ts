import { RefObject, useEffect } from 'react';

interface ShortcutHandlers {
    onSubmit: () => void;
    onCancel: () => void;
    onClear: () => void;
}

/**
 * Attaches standard IDE-like keyboard shortcuts to the composer input.
 */
export const useComposerShortcuts = (
    ref: RefObject<HTMLTextAreaElement>,
    handlers: ShortcutHandlers,
    isProcessing: boolean
) => {
    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Enter to submit (Shift+Enter allows standard newlines)
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (isProcessing) {
                    handlers.onCancel();
                } else {
                    handlers.onSubmit();
                }
            }
            
            // Escape to clear or cancel
            if (e.key === 'Escape') {
                e.preventDefault();
                handlers.onClear();
            }
        };

        el.addEventListener('keydown', handleKeyDown);
        return () => el.removeEventListener('keydown', handleKeyDown);
    }, [ref, handlers, isProcessing]);
};
