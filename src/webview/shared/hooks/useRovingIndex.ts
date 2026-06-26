import { useState, useCallback, KeyboardEvent } from 'react';

/**
 * Handles keyboard a11y navigation (ArrowUp/ArrowDown) for list items.
 */
export function useRovingIndex(itemCount: number, initialIndex = -1) {
    const [activeIndex, setActiveIndex] = useState(initialIndex);

    const onKeyDown = useCallback((e: KeyboardEvent) => {
        if (itemCount === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((prev) => (prev + 1) % itemCount);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((prev) => (prev - 1 + itemCount) % itemCount);
        }
    }, [itemCount]);

    return { activeIndex, setActiveIndex, onKeyDown };
}
