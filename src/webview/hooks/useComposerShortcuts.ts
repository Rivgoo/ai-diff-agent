import { useEffect } from 'react';
import type { RefObject } from 'react';

interface ShortcutHandlers {
    onSubmit: () => void;
    onCancel: () => void;
    onClear: () => void;
}

export const useComposerShortcuts = (
    ref: RefObject<HTMLTextAreaElement | null>,
    handlers: ShortcutHandlers,
    isProcessing: boolean
) => {
    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (isProcessing) handlers.onCancel();
                else handlers.onSubmit();
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                handlers.onClear();
            }
        };

        el.addEventListener('keydown', handleKeyDown);
        return () => el.removeEventListener('keydown', handleKeyDown);
    }, [ref, handlers, isProcessing]);
};
