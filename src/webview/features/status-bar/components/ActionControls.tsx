import { IconDeviceFloppy, IconArrowBackUp, IconPlayerPlay, IconPlayerStop } from '@tabler/icons-react';
import { useAgentStore } from '@/webview/store/agentStore';
import { useIPC } from '@/webview/hooks/useIPC';
import styles from '../StatusBarMinimal.module.css';

interface ActionControlsProps {
    readonly onSave: () => void;
    readonly onRevert: () => void;
}

export const ActionControls = ({ onSave, onRevert }: ActionControlsProps) => {
    const isMac = navigator.userAgent.toUpperCase().includes('MAC');
    const saveShortcut = isMac ? '⇧⌘A' : 'Ctrl+Shift+A';
    const revertShortcut = isMac ? '⇧⌘R' : 'Ctrl+Shift+R';

    const { sendEvent } = useIPC(); 

    const enableWalkthrough = useAgentStore(state => state.settings.ui.enableWalkthroughMode);
    const isWalkthroughActive = useAgentStore(state => state.isWalkthroughActive);
    const startWalkthrough = useAgentStore(state => state.startWalkthrough);
    const stopWalkthrough = useAgentStore(state => state.stopWalkthrough);

    const handleWalkthroughToggle = () => {
        if (isWalkthroughActive) {
            stopWalkthrough();
            sendEvent({ type: 'SET_WALKTHROUGH_STATE', isActive: false });
        } else {
            startWalkthrough();
            sendEvent({ type: 'SET_WALKTHROUGH_STATE', isActive: true });
            sendEvent({ type: 'ACTION_JUMP_TO_NEXT_BLOCK' }); 
        }
    };

    return (
        <div className={styles.rightGroup}>
            {enableWalkthrough && (
                <button 
                    type="button" 
                    className={`${styles.actionBtn} ${isWalkthroughActive ? styles.btnActiveWalkthrough : ''}`} 
                    onClick={handleWalkthroughToggle}
                    title="Step-by-step camera jumps to next edit"
                    aria-label="Toggle Walkthrough Mode"
                >
                    {isWalkthroughActive ? <IconPlayerStop size={12} aria-hidden="true" color="#e2c08d" /> : <IconPlayerPlay size={12} aria-hidden="true" />}
                    <span>{isWalkthroughActive ? 'Stop Review' : 'Start Review'}</span>
                </button>
            )}

            <button 
                type="button" 
                className={`${styles.actionBtn} ${styles.btnRevert}`} 
                onClick={onRevert}
                title={`Discard all uncommitted files (${revertShortcut})`}
                aria-label="Revert all uncommitted files"
            >
                <IconArrowBackUp size={12} aria-hidden="true" />
                <span>Revert</span>
            </button>
            
            <button 
                type="button" 
                className={`${styles.actionBtn} ${styles.btnSave}`} 
                onClick={onSave}
                title={`Commit all transaction writes to disk (${saveShortcut})`}
                aria-label="Commit all files to workspace"
            >
                <IconDeviceFloppy size={12} aria-hidden="true" />
                <span>Save All</span>
            </button>
        </div>
    );
};