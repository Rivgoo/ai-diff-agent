import { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { ComposerContext } from './composerContext';
import { useAgentStore } from '@/webview/store/agentStore';
import { useIPC } from '@/webview/hooks/useIPC';
import { useComposerShortcuts } from '@/webview/hooks/useComposerShortcuts';
import { useAutoResize } from '@/webview/hooks/useAutoResize';

interface ComposerProviderProps {
    children: ReactNode;
}

export const ComposerProvider = ({ children }: ComposerProviderProps) => {
    const { sendEvent } = useIPC();
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const [value, setValue] = useState('');

    const toggleSettings = useAgentStore((state) => state.toggleSettings);
    const messages = useAgentStore((state) => state.messages);
    const { stage } = useAgentStore((state) => state.pipelineProgress);
    const composerDraft = useAgentStore((state) => state.composerDraft);
    const setComposerDraft = useAgentStore((state) => state.setComposerDraft);

    const activeStages = ['parsing', 'validating', 'resolving', 'staging'];
    const isProcessing = activeStages.includes(stage);
    const isClearDisabled = messages.length === 0;

    useAutoResize(inputRef, value);

    useEffect(() => {
        if (composerDraft !== '') {
            setValue(composerDraft);
            setComposerDraft('');
            inputRef.current?.focus();
        }
    }, [composerDraft, setComposerDraft]);

    const submit = () => {
        if (!value.trim() || isProcessing) return;
        sendEvent({ type: 'SUBMIT_PAYLOAD', payload: value });
        setValue('');
    };

    const cancel = () => {
        if (isProcessing) sendEvent({ type: 'CANCEL_PROCESSING' });
    };

    const clear = () => {
        if (value === '') inputRef.current?.blur();
        else setValue('');
    };

    const clearSession = () => {
        if (!isClearDisabled) sendEvent({ type: 'CLEAR_SESSION' });
    };

    useComposerShortcuts(inputRef, { onSubmit: submit, onCancel: cancel, onClear: clear }, isProcessing);

    const contextValue = {
        state: { value, isProcessing, hasValue: value.trim().length > 0, isClearDisabled },
        actions: { updateValue: setValue, submit, cancel, clear, clearSession, toggleSettings },
        meta: { inputRef }
    };

    return <ComposerContext.Provider value={contextValue}>{children}</ComposerContext.Provider>;
};
