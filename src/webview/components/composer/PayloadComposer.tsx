import React, { useState, useRef } from 'react';
import { ComposerTextArea } from './ComposerTextArea';
import { ComposerActionBar } from './ComposerActionBar';
import { useAutoResize } from '../../hooks/useAutoResize';
import { useComposerShortcuts } from '../../hooks/useComposerShortcuts';
import { useAgentStore } from '../../store/agentStore';
import { useIPC } from '../../hooks/useIPC';

export const PayloadComposer = () => {
    const { sendEvent } = useIPC();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    
    const [value, setValue] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    
    const toggleSettings = useAgentStore((state) => state.toggleSettings);
    const { stage } = useAgentStore((state) => state.pipelineProgress);
    
    // A pipeline is considered "processing" if it's running automation tasks.
    // 'reviewing' means it's awaiting user input, which is safe to start a new payload.
    const activeStages = ['parsing', 'validating', 'resolving', 'staging'];
    const isProcessing = activeStages.includes(stage);

    useAutoResize(textareaRef, value);

    const handleSubmit = () => {
        if (!value.trim() || isProcessing) return;
        sendEvent({ type: 'SUBMIT_PAYLOAD', payload: value });
        setValue('');
    };

    const handleCancel = () => {
        if (isProcessing) {
            sendEvent({ type: 'CANCEL_PROCESSING' });
        }
    };

    const handleClear = () => {
        if (value === '') {
            textareaRef.current?.blur();
        } else {
            setValue('');
        }
    };

    useComposerShortcuts(textareaRef, {
        onSubmit: handleSubmit,
        onCancel: handleCancel,
        onClear: handleClear
    }, isProcessing);

    const containerStyle: React.CSSProperties = {
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--vscode-input-background)',
        border: `1px solid ${isFocused ? 'var(--vscode-focusBorder)' : 'var(--vscode-input-border)'}`,
        borderRadius: '6px',
        margin: '12px',
        overflow: 'hidden',
        transition: 'border-color 0.2s ease',
        boxShadow: isFocused ? '0 0 0 1px var(--vscode-focusBorder) inset' : 'none'
    };

    return (
        <div style={containerStyle}>
            <ComposerTextArea
                ref={textareaRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                disabled={isProcessing}
                placeholder={isProcessing ? 'Processing payload...' : 'Paste AI XML payload here...'}
            />
            <ComposerActionBar
                isFocused={isFocused}
                isProcessing={isProcessing}
                hasValue={value.trim().length > 0}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                onToggleSettings={toggleSettings}
            />
        </div>
    );
};
