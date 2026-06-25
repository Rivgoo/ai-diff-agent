import { VSCodeCheckbox, VSCodeButton, VSCodeDivider } from '@vscode/webview-ui-toolkit/react';
import { useAgentStore } from '../../store/agentStore';
import { useIPC } from '../../hooks/useIPC';

const CloseIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ display: 'block' }}>
        <path fillRule="evenodd" clipRule="evenodd" d="M7.11 8l-3.47-3.48.7-.7 3.49 3.47 3.48-3.47.7.7L9 8l3.48 3.48-.7.7-3.48-3.48-3.49 3.48-.7-.7L7.11 8z" />
    </svg>
);

export const SettingsModal = () => {
    const { sendEvent } = useIPC();
    const settings = useAgentStore((state) => state.settings);
    const isOpen = useAgentStore((state) => state.isSettingsOpen);
    const toggleSettings = useAgentStore((state) => state.toggleSettings);

    if (!isOpen) return null;

    const handleToggleAutoScroll = (e: any) => {
        sendEvent({ type: 'UPDATE_SETTINGS', settings: { ...settings, autoScroll: e.target.checked } });
    };

    const handleToggleStrictParsing = (e: any) => {
        sendEvent({ type: 'UPDATE_SETTINGS', settings: { ...settings, strictParsing: e.target.checked } });
    };

    return (
        <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'var(--vscode-editor-background)', zIndex: 100,
            display: 'flex', flexDirection: 'column', padding: '20px'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ margin: 0, fontSize: '16px', color: 'var(--vscode-foreground)' }}>Agent Settings</h2>
                <VSCodeButton appearance="icon" onClick={toggleSettings} title="Close Settings">
                    <CloseIcon />
                </VSCodeButton>
            </div>
            <VSCodeDivider />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                <VSCodeCheckbox checked={settings.autoScroll} onChange={handleToggleAutoScroll}>
                    Auto-scroll to bottom
                </VSCodeCheckbox>
                <p style={{ margin: '-10px 0 0 28px', fontSize: '12px', color: 'var(--vscode-descriptionForeground)' }}>
                    Automatically scroll the chat view when new messages arrive.
                </p>
                <VSCodeCheckbox checked={settings.strictParsing} onChange={handleToggleStrictParsing}>
                    Strict XML Parsing
                </VSCodeCheckbox>
                <p style={{ margin: '-10px 0 0 28px', fontSize: '12px', color: 'var(--vscode-descriptionForeground)' }}>
                    Enforce exact XML. Disables recovery for malformed markdown blocks.
                </p>
            </div>
            <div style={{ flex: 1 }} />
            <VSCodeButton appearance="primary" onClick={toggleSettings} style={{ marginTop: '20px' }}>
                Done
            </VSCodeButton>
        </div>
    );
};
