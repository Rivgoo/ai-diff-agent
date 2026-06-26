import { VSCodeCheckbox, VSCodeDivider } from '@vscode/webview-ui-toolkit/react';
import { useAgentStore } from '@/webview/store/agentStore';
import { useIPC } from '@/webview/hooks/useIPC';
import { Button } from '@/webview/shared/ui/Button/Button';
import { IconX } from '@tabler/icons-react';
import styles from './SettingsModal.module.css';

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
        <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <div className={styles.header}>
                <h2 id="settings-title" className={styles.title}>Agent Settings</h2>
                <Button variant="icon" onClick={toggleSettings} aria-label="Close Settings">
                    <IconX size={16} aria-hidden="true" />
                </Button>
            </div>
            <VSCodeDivider />
            
            <div className={styles.list}>
                <VSCodeCheckbox checked={settings.autoScroll} onChange={handleToggleAutoScroll}>
                    Auto-scroll to bottom
                </VSCodeCheckbox>
                <p className={styles.description}>
                    Automatically scroll the chat view when new messages arrive.
                </p>
                
                <VSCodeCheckbox checked={settings.strictParsing} onChange={handleToggleStrictParsing}>
                    Strict XML Parsing
                </VSCodeCheckbox>
                <p className={styles.description}>
                    Enforce exact XML. Disables recovery for malformed markdown blocks.
                </p>
            </div>
            
            <div className={styles.spacer} />
            <Button variant="primary" onClick={toggleSettings} className={styles.doneBtn}>
                Done
            </Button>
        </div>
    );
};
