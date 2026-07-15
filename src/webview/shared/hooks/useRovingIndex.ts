import { useState, useCallback, type KeyboardEvent } from 'react';

export function useRovingIndex(itemCount: number, onSelect?: (index: number) => void, initialIndex = -1) {
    const [activeIndex, setActiveIndex] = useState(initialIndex);

    const onKeyDown = useCallback((e: KeyboardEvent) => {
        if (itemCount === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((prev) => (prev + 1) % itemCount);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((prev) => (prev - 1 + itemCount) % itemCount);
        } else if (e.key === 'Enter' && activeIndex !== -1) {
            e.preventDefault();
            if (onSelect) onSelect(activeIndex);
        }
    }, [itemCount, activeIndex, onSelect]);

    return { activeIndex, setActiveIndex, onKeyDown };
}