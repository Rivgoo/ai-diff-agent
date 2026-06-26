import { use } from 'react';
import { ComposerContext } from './composerContext';
import styles from './composer.module.css';

export const ComposerInput = () => {
    const context = use(ComposerContext);
    if (!context) throw new Error('ComposerInput must be inside ComposerProvider');

    const { state, actions, meta } = context;

    return (
        <textarea
            ref={meta.inputRef}
            className={styles.textarea}
            value={state.value}
            onChange={(e) => actions.updateValue(e.target.value)}
            disabled={state.isProcessing}
            spellCheck={false}
            placeholder={state.isProcessing ? 'Processing payload...' : 'Paste AI XML payload here...'}
            aria-label="Agent instructions input"
        />
    );
};
