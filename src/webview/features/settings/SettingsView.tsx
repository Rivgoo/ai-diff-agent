import { useState, useEffect } from 'react';
import { VSCodeCheckbox, VSCodeTextField, VSCodeDivider, VSCodeDropdown, VSCodeOption } from '@vscode/webview-ui-toolkit/react';
import { useAgentStore } from '@/webview/store/agentStore';
import { useSettingsSync } from './hooks/useSettingsSync';
import { IconArrowLeft } from '@tabler/icons-react';
import styles from './SettingsView.module.css';

export const SettingsView = () => {
    const settings = useAgentStore((state) => state.settings);
    const toggleSettings = useAgentStore((state) => state.toggleSettings);
    const { updateSetting } = useSettingsSync();

    const [retentionInput, setRetentionInput] = useState(settings.workflow.backupRetentionDays.toString());
    const [fileSizeInput, setFileSizeInput] = useState(settings.engine.maxFileSizeMb.toString());

    useEffect(() => {
        setRetentionInput(settings.workflow.backupRetentionDays.toString());
        setFileSizeInput(settings.engine.maxFileSizeMb.toString());
    }, [settings.workflow.backupRetentionDays, settings.engine.maxFileSizeMb]);

    const handleNumberChange = (category: 'workflow' | 'engine', key: string, val: string, setter: any) => {
        setter(val);
        const parsed = parseInt(val, 10);
        if (!isNaN(parsed) && parsed > 0) {
            updateSetting(category, key, parsed);
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
                
                {/* --- UI SETTINGS --- */}
                <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>UI & Display</h3>
                    
                    <div className={styles.settingItem}>
                        <VSCodeCheckbox checked={settings.ui.autoScroll} onChange={(e: any) => updateSetting('ui', 'autoScroll', e.target.checked)}>
                            Auto-scroll to bottom
                        </VSCodeCheckbox>
                    </div>

                    <div className={styles.settingItem}>
                        <VSCodeCheckbox checked={settings.ui.compactMode} onChange={(e: any) => updateSetting('ui', 'compactMode', e.target.checked)}>
                            Compact Mode
                        </VSCodeCheckbox>
                    </div>

                    <div className={styles.settingItem}>
                        <VSCodeCheckbox checked={settings.ui.showConfidenceBadges} onChange={(e: any) => updateSetting('ui', 'showConfidenceBadges', e.target.checked)}>
                            Show Confidence Badges (HIGH, MED, LOW)
                        </VSCodeCheckbox>
                    </div>

                    <div className={styles.settingItem}>
                        <VSCodeCheckbox checked={settings.ui.enableCodeLens} onChange={(e: any) => updateSetting('ui', 'enableCodeLens', e.target.checked)}>
                            Enable Editor CodeLens Buttons
                        </VSCodeCheckbox>
                    </div>
                </section>
                
                <VSCodeDivider />

                {/* --- WORKFLOW SETTINGS --- */}
                <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>Workflow & Lifecycle</h3>
                    
                    <div className={styles.settingItem}>
                        <label className={styles.label}>Chat History Mode</label>
                        <VSCodeDropdown value={settings.workflow.chatHistoryMode} onChange={(e: any) => updateSetting('workflow', 'chatHistoryMode', e.target.value)}>
                            <VSCodeOption value="workspace">Workspace (.vscode folder)</VSCodeOption>
                            <VSCodeOption value="global">Global (System Storage)</VSCodeOption>
                            <VSCodeOption value="disabled">Disabled (Do not save)</VSCodeOption>
                        </VSCodeDropdown>
                    </div>

                    <div className={styles.settingItem}>
                        <label className={styles.label}>Auto-Format Behavior</label>
                        <VSCodeDropdown value={settings.workflow.formatBehavior} onChange={(e: any) => updateSetting('workflow', 'formatBehavior', e.target.value)}>
                            <VSCodeOption value="always">Always Format</VSCodeOption>
                            <VSCodeOption value="onSaveOnly">Trigger On Save Only</VSCodeOption>
                            <VSCodeOption value="never">Never Auto-Format</VSCodeOption>
                        </VSCodeDropdown>
                    </div>

                    <div className={styles.settingItem}>
                        <VSCodeCheckbox checked={settings.workflow.autoSaveAfterAccept} onChange={(e: any) => updateSetting('workflow', 'autoSaveAfterAccept', e.target.checked)}>
                            Auto-Save on Accept Block
                        </VSCodeCheckbox>
                    </div>

                    <div className={styles.settingItem}>
                        <VSCodeCheckbox checked={settings.workflow.cleanupEmptyDirectories} onChange={(e: any) => updateSetting('workflow', 'cleanupEmptyDirectories', e.target.checked)}>
                            Clean up Empty Directories on Revert
                        </VSCodeCheckbox>
                    </div>

                    <div className={styles.settingItem}>
                        <label className={styles.label}>Backup Retention (Days)</label>
                        <VSCodeTextField value={retentionInput} onInput={(e: any) => handleNumberChange('workflow', 'backupRetentionDays', e.target.value, setRetentionInput)} />
                    </div>
                </section>

                <VSCodeDivider />

                {/* --- ENGINE SETTINGS --- */}
                <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>Diff Engine (Parsing)</h3>
                    
                    <div className={styles.settingItem}>
                        <label className={styles.label}>Payload Recovery Mode</label>
                        <VSCodeDropdown value={settings.engine.payloadRecoveryMode} onChange={(e: any) => updateSetting('engine', 'payloadRecoveryMode', e.target.value)}>
                            <VSCodeOption value="strict">Strict (Fail on junk)</VSCodeOption>
                            <VSCodeOption value="standard">Standard (Strip markdown fences)</VSCodeOption>
                            <VSCodeOption value="aggressive">Aggressive (Strip CDATA and code tags)</VSCodeOption>
                        </VSCodeDropdown>
                    </div>

                    <div className={styles.settingItem}>
                        <label className={styles.label}>Fallback Search Level</label>
                        <VSCodeDropdown value={settings.engine.fallbackMatchLevel} onChange={(e: any) => updateSetting('engine', 'fallbackMatchLevel', e.target.value)}>
                            <VSCodeOption value="none">None (AST / Exact Only)</VSCodeOption>
                            <VSCodeOption value="safe">Safe (Ignore whitespaces)</VSCodeOption>
                            <VSCodeOption value="aggressive">Aggressive (Ignore quotes/punctuation)</VSCodeOption>
                        </VSCodeDropdown>
                    </div>

                    <div className={styles.settingItem}>
                        <VSCodeCheckbox checked={settings.engine.enableAstMatching} onChange={(e: any) => updateSetting('engine', 'enableAstMatching', e.target.checked)}>
                            Enable Semantic AST Matching
                        </VSCodeCheckbox>
                    </div>

                    <div className={styles.settingItem}>
                        <VSCodeCheckbox checked={settings.engine.strictSyntaxValidation} onChange={(e: any) => updateSetting('engine', 'strictSyntaxValidation', e.target.checked)}>
                            Block On Syntax Corruption (AST)
                        </VSCodeCheckbox>
                    </div>

                    <div className={styles.settingItem}>
                        <VSCodeCheckbox checked={settings.engine.autoFixSyntax} onChange={(e: any) => updateSetting('engine', 'autoFixSyntax', e.target.checked)}>
                            Auto-Fix Typos (Trailing commas, etc)
                        </VSCodeCheckbox>
                    </div>

                    <div className={styles.settingItem}>
                        <label className={styles.label}>Max File Size Limit (MB)</label>
                        <VSCodeTextField value={fileSizeInput} onInput={(e: any) => handleNumberChange('engine', 'maxFileSizeMb', e.target.value, setFileSizeInput)} />
                    </div>
                </section>

            </div>
        </div>
    );
};