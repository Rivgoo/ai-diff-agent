import { use } from 'react';
import { ComposerContext } from './composerContext';
import { Button } from '@/webview/shared/ui/Button/Button';
import { IconSend, IconX, IconAdjustmentsHorizontal, IconTrash } from '@tabler/icons-react';

export const ComposerSubmit = () => {
    const context = use(ComposerContext);
    if (!context) return null;
    return (
        <Button variant="primary" onClick={context.actions.submit} disabled={!context.state.hasValue} aria-label="Apply AI Payload">
            <IconSend size={16} aria-hidden="true" /> Apply
        </Button>
    );
};

export const ComposerCancel = () => {
    const context = use(ComposerContext);
    if (!context) return null;
    return (
        <Button variant="danger" onClick={context.actions.cancel} aria-label="Cancel Processing">
            <IconX size={16} aria-hidden="true" /> Cancel
        </Button>
    );
};

export const ComposerSettings = () => {
    const context = use(ComposerContext);
    if (!context) return null;
    return (
        <Button variant="icon" onClick={context.actions.toggleSettings} aria-label="Composer Settings">
            <IconAdjustmentsHorizontal size={16} aria-hidden="true" />
        </Button>
    );
};

export const ComposerClear = () => {
    const context = use(ComposerContext);
    if (!context) return null;
    return (
        <Button variant="icon" onClick={context.actions.clearSession} disabled={context.state.isClearDisabled} aria-label="Clear Chat History">
            <IconTrash size={16} aria-hidden="true" />
        </Button>
    );
};
