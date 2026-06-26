import { use } from 'react';
import { ComposerContext } from './composerContext';
import styles from './composer.module.css';

export const ComposerActionHints = () => {
    const context = use(ComposerContext);
    if (!context || context.state.isProcessing) return null;

    // We use CSS focus-within on the frame, but for hints opacity we might just keep them always visible slightly 
    // or rely on a wrapper class. Since we removed manual isFocused, we just display them.
    return (
        <div className={styles.hints} aria-hidden="true">
            <span><kbd>↵</kbd> Apply</span>
            <span><kbd>⇧↵</kbd> Newline</span>
        </div>
    );
};
