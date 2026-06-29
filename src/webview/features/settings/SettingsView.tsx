import { useState, useEffect } from 'react';
import { VSCodeCheckbox, VSCodeTextField, VSCodeDivider } from '@vscode/webview-ui-toolkit/react';
import { useAgentStore } from '@/webview/store/agentStore';
import { useSettingsSync } from './hooks/useSettingsSync';
import { IconArrowLeft } from '@tabler/icons-react';
import styles from './SettingsView.module.css';
import bonkGif from '@/webview/assets/bonk.gif';

export const SettingsView = () => {
    const settings = useAgentStore((state) => state.settings);
    const toggleSettings = useAgentStore((state) => state.toggleSettings);
    const { updateSetting } = useSettingsSync();

    const [retentionInput, setRetentionInput] = useState(settings.engine.maxBackupRetentionDays.toString());

    useEffect(() => {
        setRetentionInput(settings.engine.maxBackupRetentionDays.toString());
    }, [settings.engine.maxBackupRetentionDays]);

    const handleRetentionChange = (e: any) => {
        const val = e.target.value;
        setRetentionInput(val);
        
        const parsed = parseInt(val, 10);
        if (!isNaN(parsed) && parsed > 0) {
            updateSetting('engine', 'maxBackupRetentionDays', parsed);
        }
    };

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

                    <div className={styles.settingItem}>
                        <VSCodeCheckbox 
                            checked={settings.behavior.storeChatInWorkspace} 
                            onChange={(e: any) => updateSetting('behavior', 'storeChatInWorkspace', e.target.checked)}
                        >
                            Store Chat in Workspace
                        </VSCodeCheckbox>
                        <p className={styles.description}>Save history in <code>.vscode/ai-chat-history.json</code> to persist and share prompts via Git.</p>
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
                            value={retentionInput} 
                            onInput={handleRetentionChange}
                        />
                        <p className={styles.description}>Number of days to keep transaction backups before purging.</p>
                    </div>

                    <div className={styles.settingItem}>
                        <VSCodeCheckbox 
                            checked={settings.engine.autoFixSyntax} 
                            onChange={(e: any) => updateSetting('engine', 'autoFixSyntax', e.target.checked)}
                        >
                            <div className={styles.labelWithGif}>
                                <img src={bonkGif} alt="Bonk" className={styles.bonkGif} />
                                <span>Auto-Fix Syntax Hallucinations</span>
                            </div>
                        </VSCodeCheckbox>
                        <p className={styles.description}>Safely repair missing quotes, JSON trailing commas, and invisible characters based on file type.</p>
                    </div>

                    <div className={styles.settingItem}>
                        <VSCodeCheckbox 
                            checked={settings.engine.autoFormatOnApply} 
                            onChange={(e: any) => updateSetting('engine', 'autoFormatOnApply', e.target.checked)}
                        >
                            Auto-Format on Apply
                        </VSCodeCheckbox>
                        <p className={styles.description}>Silently format files in the background after AI modifications are applied.</p>
                    </div>

                    <div className={styles.settingItem}>
                        <VSCodeCheckbox 
                            checked={settings.engine.enableAstMatching} 
                            onChange={(e: any) => updateSetting('engine', 'enableAstMatching', e.target.checked)}
                        >
                            Enable Semantic AST Matching
                        </VSCodeCheckbox>
                        <p className={styles.description}>Use structural syntax trees instead of plain text matching. Highly recommended for robustness.</p>
                    </div>

                </section>
            </div>
        </div>
    );
};