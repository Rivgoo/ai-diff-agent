import { useContext } from 'react';
import { ComposerContext } from './composerContext';
import styles from './composer.module.css';

export const ComposerActionHints = () => {
    const context = useContext(ComposerContext);
    if (!context || context.state.isProcessing) return null;

    return (
        <div className={styles.hints} aria-hidden="true">
            <span><kbd>↵</kbd> Apply</span>
            <span><kbd>⇧↵</kbd> Newline</span>
        </div>
    );
};
