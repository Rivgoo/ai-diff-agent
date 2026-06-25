import { useState } from 'react';
import { VSCodeTextArea, VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import { useIPC } from '../hooks/useIPC';

export const ChatInput = () => {
    const [input, setInput] = useState('');
    const { sendEvent } = useIPC();

    const handleSubmit = () => {
        if (!input.trim()) return;
        sendEvent({ type: 'SUBMIT_PAYLOAD', payload: input });
        setInput('');
    };

    const handleKeyDown = (e: any) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', borderTop: '1px solid var(--vscode-panel-border)' }}>
            <VSCodeTextArea
                placeholder="Paste AI XML payload here..."
                value={input}
                onInput={(e: any) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                resize="vertical"
                style={{ width: '100%' }}
            />
            <VSCodeButton onClick={handleSubmit} style={{ alignSelf: 'flex-end' }}>
                Send to Agent
            </VSCodeButton>
        </div>
    );
};
