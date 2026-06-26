import { VSCodeCheckbox, VSCodeTextField, VSCodeDivider } from '@vscode/webview-ui-toolkit/react';
import { useAgentStore } from '@/webview/store/agentStore';
import { useSettingsSync } from './hooks/useSettingsSync';
import { IconArrowLeft } from '@tabler/icons-react';
import styles from './SettingsView.module.css';

export const SettingsView = () => {
    const settings = useAgentStore((state) => state.settings);
    const toggleSettings = useAgentStore((state) => state.toggleSettings);
    const { updateSetting } = useSettingsSync();

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <button className={styles.backBtn} onClick={toggleSettings} aria-label="Go back">
                    <IconArrowLeft size={16} />
                </button>
                <h2 className={styles.title}>Agent Configuration</h2>
            </div>

            <div className={styles.content}>
                <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>Behavior</h3>
                    
                    <div className={styles.settingItem}>
                        <VSCodeCheckbox 
                            checked={settings.behavior.autoScroll} 
                            onChange={(e: any) => updateSetting('behavior', 'autoScroll', e.target.checked)}
                        >
                            Auto-scroll to bottom
                        </VSCodeCheckbox>
                        <p className={styles.description}>Automatically scroll the chat view when new messages arrive.</p>
                    </div>

                    <div className={styles.settingItem}>
                        <VSCodeCheckbox 
                            checked={settings.behavior.compactMode} 
                            onChange={(e: any) => updateSetting('behavior', 'compactMode', e.target.checked)}
                        >
                            Compact Mode
                        </VSCodeCheckbox>
                        <p className={styles.description}>Reduce visual padding and gaps to show more operations on screen.</p>
                    </div>
                </section>
                
                <VSCodeDivider />

                <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>Diff Engine</h3>
                    
                    <div className={styles.settingItem}>
                        <VSCodeCheckbox 
                            checked={settings.engine.strictParsing} 
                            onChange={(e: any) => updateSetting('engine', 'strictParsing', e.target.checked)}
                        >
                            Strict XML Parsing
                        </VSCodeCheckbox>
                        <p className={styles.description}>Enforce strict XML. Disables recovery for malformed markdown blocks.</p>
                    </div>

                    <div className={styles.settingItem}>
                        <label className={styles.label}>Max Backup Retention (Days)</label>
                        <VSCodeTextField 
                            type="number" 
                            value={settings.engine.maxBackupRetentionDays.toString()} 
                            onInput={(e: any) => updateSetting('engine', 'maxBackupRetentionDays', parseInt(e.target.value, 10))}
                        />
                        <p className={styles.description}>Number of days to keep transaction backups before purging.</p>
                    </div>
                </section>
            </div>
        </div>
    );
};
