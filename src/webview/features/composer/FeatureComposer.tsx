import { use } from 'react';
import { ComposerProvider } from './ComposerProvider';
import { ComposerFrame } from './ComposerFrame';
import { ComposerInput } from './ComposerInput';
import { ComposerActionBar, ComposerLeftGroup, ComposerRightGroup } from './ComposerActionBar';
import { ComposerSubmit, ComposerCancel, ComposerSettings, ComposerClear } from './ComposerActions';
import { ComposerActionHints } from './ComposerActionHints';
import { ComposerContext } from './composerContext';

const ComposerDecisionRoot = () => {
    const context = use(ComposerContext);
    if (!context) return null;

    return (
        <ComposerFrame>
            <ComposerInput />
            <ComposerActionBar>
                <ComposerLeftGroup>
                    <ComposerSettings />
                    <ComposerClear />
                </ComposerLeftGroup>
                
                <ComposerRightGroup>
                    <ComposerActionHints />
                    {context.state.isProcessing ? <ComposerCancel /> : <ComposerSubmit />}
                </ComposerRightGroup>
            </ComposerActionBar>
        </ComposerFrame>
    );
};

export const FeatureComposer = () => {
    return (
        <ComposerProvider>
            <ComposerDecisionRoot />
        </ComposerProvider>
    );
};
