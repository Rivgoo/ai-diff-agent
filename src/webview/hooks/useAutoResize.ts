import { RefObject, useEffect } from 'react';

/**
 * Automatically adjusts the height of a textarea based on its content scroll height.
 * Caps out at a predefined maximum height to prevent consuming the entire screen.
 */
export const useAutoResize = (ref: RefObject<HTMLTextAreaElement>, value: string) => {
    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        // Reset height to auto to correctly shrink if text is deleted
        el.style.height = 'auto';
        
        // Calculate new height, bounded between 40px and 300px
        const scrollHeight = el.scrollHeight;
        const newHeight = Math.min(Math.max(scrollHeight, 40), 300);
        
        el.style.height = `${newHeight}px`;
    }, [value, ref]);
};
