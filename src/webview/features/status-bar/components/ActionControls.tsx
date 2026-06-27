import { IconDeviceFloppy, IconArrowBackUp } from '@tabler/icons-react';
import styles from '../StatusBarMinimal.module.css';

interface ActionControlsProps {
    readonly onSave: () => void;
    readonly onRevert: () => void;
}

export const ActionControls = ({ onSave, onRevert }: ActionControlsProps) => {
    const isMac = navigator.userAgent.toUpperCase().includes('MAC');
    const saveShortcut = isMac ? '⇧⌘A' : 'Ctrl+Shift+A';
    const revertShortcut = isMac ? '⇧⌘R' : 'Ctrl+Shift+R';

    return (
        <div className={styles.rightGroup}>
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
