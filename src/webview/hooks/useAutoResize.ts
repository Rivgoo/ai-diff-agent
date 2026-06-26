import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Automatically adjusts textarea height based on content.
 */
export const useAutoResize = (ref: RefObject<HTMLTextAreaElement | null>, value: string) => {
    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        el.style.height = 'auto';
        const scrollHeight = el.scrollHeight;
        const newHeight = Math.min(Math.max(scrollHeight, 40), 300);
        el.style.height = `${newHeight}px`;
    }, [value, ref]);
};
