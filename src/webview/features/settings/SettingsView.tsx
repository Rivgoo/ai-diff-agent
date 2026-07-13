import { useState, useEffect } from 'react';
import { 
    VSCodeCheckbox, 
    VSCodeTextField, 
    VSCodeDropdown, 
    VSCodeOption, 
    VSCodeDivider 
} from '@vscode/webview-ui-toolkit/react';
import { useAgentStore } from '@/webview/store/agentStore';
import { useSettingsSync } from './hooks/useSettingsSync';
import { IconArrowLeft } from '@tabler/icons-react';
import styles from './SettingsView.module.css';

type TabId = 'ui' | 'workflow' | 'engine' | 'ast' | 'ai';

const AVAILABLE_LANGUAGES = [
    { id: 'javascript', label: 'JavaScript' },
    { id: 'typescript', label: 'TypeScript' },
    { id: 'python', label: 'Python' },
    { id: 'c_sharp', label: 'C#' },
    { id: 'json', label: 'JSON' },
    { id: 'html', label: 'HTML' },
    { id: 'css', label: 'CSS' },
    { id: 'bash', label: 'Bash' },
    { id: 'c', label: 'C / C++' }
];

export const SettingsView = () => {
    const settings = useAgentStore((state) => state.settings);
    const toggleSettings = useAgentStore((state) => state.toggleSettings);
    const { updateSetting } = useSettingsSync();

    const [activeTab, setActiveTab] = useState<TabId>('ui');
    const [retentionInput, setRetentionInput] = useState(settings.workflow.backupRetentionDays.toString());
    const [fileSizeInput, setFileSizeInput] = useState(settings.engine.maxFileSizeMb.toString());

    useEffect(() => {
        setRetentionInput(settings.workflow.backupRetentionDays.toString());
        setFileSizeInput(settings.engine.maxFileSizeMb.toString());
    }, [settings.workflow.backupRetentionDays, settings.engine.maxFileSizeMb]);

    const handleNumberChange = (category: 'workflow' | 'engine', key: string, val: string, setter: (val: string) => void) => {
        setter(val);
        if (val.trim() === '') return; 
        
        const parsed = parseInt(val, 10);
        if (!isNaN(parsed) && parsed > 0) {
            updateSetting(category, key, parsed);
        }
    };

    const toggleLanguage = (langId: string, checked: boolean) => {
        const currentLangs = settings.ast.enabledLanguages;
        let newLangs: string[];
        
        if (checked) {
            newLangs = [...new Set([...currentLangs, langId])];
        } else {
            newLangs = currentLangs.filter(l => l !== langId);
        }
        
        updateSetting('ast', 'enabledLanguages', newLangs);
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <button type="button" className={styles.backBtn} onClick={toggleSettings} aria-label="Go back">
                    <IconArrowLeft size={16} />
                </button>
                <h2 className={styles.title}>Agent Configuration</h2>
            </div>

            {/* Custom Horizontal Scrollable Tabs */}
            <div className={styles.tabBar} role="tablist" aria-label="Settings Categories">
                <button type="button" role="tab" aria-selected={activeTab === 'ui'} className={`${styles.tabBtn} ${activeTab === 'ui' ? styles.tabBtnActive : ''}`} onClick={() => setActiveTab('ui')}>UI & Display</button>
                <button type="button" role="tab" aria-selected={activeTab === 'workflow'} className={`${styles.tabBtn} ${activeTab === 'workflow' ? styles.tabBtnActive : ''}`} onClick={() => setActiveTab('workflow')}>Workflow</button>
                <button type="button" role="tab" aria-selected={activeTab === 'engine'} className={`${styles.tabBtn} ${activeTab === 'engine' ? styles.tabBtnActive : ''}`} onClick={() => setActiveTab('engine')}>Diff Engine</button>
                <button type="button" role="tab" aria-selected={activeTab === 'ast'} className={`${styles.tabBtn} ${activeTab === 'ast' ? styles.tabBtnActive : ''}`} onClick={() => setActiveTab('ast')}>AST & Semantics</button>
                <button type="button" role="tab" aria-selected={activeTab === 'ai'} className={`${styles.tabBtn} ${activeTab === 'ai' ? styles.tabBtnActive : ''}`} onClick={() => setActiveTab('ai')}>AI Feedback</button>
            </div>

            <div className={styles.content}>
                {/* --- UI SETTINGS --- */}
                {activeTab === 'ui' && (
                    <section className={styles.section}>
                        <h3 className={styles.sectionTitle}>Interface & Layout</h3>
                        
                        <div className={styles.settingItem}>
                            <VSCodeCheckbox checked={settings.ui.autoScroll} onChange={(e: any) => updateSetting('ui', 'autoScroll', e.target.checked)}>
                                Auto-scroll to bottom
                            </VSCodeCheckbox>
                            <p className={styles.description}>Automatically scrolls the chat feed when the agent replies.</p>
                        </div>

                        <div className={styles.settingItem}>
                            <VSCodeCheckbox checked={settings.ui.compactMode} onChange={(e: any) => updateSetting('ui', 'compactMode', e.target.checked)}>
                                Compact Mode
                            </VSCodeCheckbox>
                            <p className={styles.description}>Reduces visual padding and font sizes in the message feed.</p>
                        </div>

                        <div className={styles.settingItem}>
                            <VSCodeCheckbox checked={settings.ui.showConfidenceBadges} onChange={(e: any) => updateSetting('ui', 'showConfidenceBadges', e.target.checked)}>
                                Show Confidence Badges (HIGH, MED, LOW)
                            </VSCodeCheckbox>
                            <p className={styles.description}>Displays a badge on files indicating how accurately the agent's code matched the original target.</p>
                        </div>

                        <div className={styles.settingItem}>
                            <VSCodeCheckbox checked={settings.ui.enableCodeLens} onChange={(e: any) => updateSetting('ui', 'enableCodeLens', e.target.checked)}>
                                Enable Editor CodeLens Buttons
                            </VSCodeCheckbox>
                            <p className={styles.description}>Shows floating [Accept Block] / [Reject Block] directly inside the text editor.</p>
                        </div>

                        <div className={styles.settingItem}>
                            <VSCodeCheckbox checked={settings.ui.phantomInlineDiffs} onChange={(e: any) => updateSetting('ui', 'phantomInlineDiffs', e.target.checked)}>
                                Enable Phantom Inline Diffs
                            </VSCodeCheckbox>
                            <p className={styles.description}>Shows deleted text as red transparent overlays directly above the new code in the editor.</p>
                        </div>

                        <div className={styles.settingItem}>
                            <VSCodeCheckbox checked={settings.ui.enableWalkthroughMode} onChange={(e: any) => updateSetting('ui', 'enableWalkthroughMode', e.target.checked)}>
                                Enable Walkthrough Mode
                            </VSCodeCheckbox>
                            <p className={styles.description}>Allows step-by-step camera jumps between edited blocks for large file batches.</p>
                        </div>
                    </section>
                )}
                
                {/* --- WORKFLOW SETTINGS --- */}
                {activeTab === 'workflow' && (
                    <section className={styles.section}>
                        <h3 className={styles.sectionTitle}>Lifecycle & Operations</h3>
                        
                        <div className={styles.settingItem}>
                            <label className={styles.label}>Execution Mode</label>
                            <VSCodeDropdown value={settings.workflow.executionMode} onChange={(e: any) => updateSetting('workflow', 'executionMode', e.target.value)}>
                                <VSCodeOption value="tolerant">Tolerant (Skip broken files)</VSCodeOption>
                                <VSCodeOption value="atomic">Atomic (Fail entire batch on 1 error)</VSCodeOption>
                            </VSCodeDropdown>
                            <p className={styles.description}>Dictates whether the pipeline aborts completely upon hitting a file resolution conflict.</p>
                        </div>

                        <div className={styles.settingItem}>
                            <label className={styles.label}>Chat History Scope</label>
                            <VSCodeDropdown value={settings.workflow.chatHistoryMode} onChange={(e: any) => updateSetting('workflow', 'chatHistoryMode', e.target.value)}>
                                <VSCodeOption value="workspace">Workspace (.vscode folder)</VSCodeOption>
                                <VSCodeOption value="global">Global (System Storage)</VSCodeOption>
                                <VSCodeOption value="disabled">Disabled (Do not save)</VSCodeOption>
                            </VSCodeDropdown>
                            <p className={styles.description}>Determines where chat sessions and operations are persisted.</p>
                        </div>

                        <div className={styles.settingItem}>
                            <label className={styles.label}>Auto-Format Behavior</label>
                            <VSCodeDropdown value={settings.workflow.formatBehavior} onChange={(e: any) => updateSetting('workflow', 'formatBehavior', e.target.value)}>
                                <VSCodeOption value="always">Always Format</VSCodeOption>
                                <VSCodeOption value="onSaveOnly">Trigger On Save Only</VSCodeOption>
                                <VSCodeOption value="never">Never Auto-Format</VSCodeOption>
                            </VSCodeDropdown>
                            <p className={styles.description}>Applies Prettier/ESLint formatting silently in the background.</p>
                        </div>

                        <div className={styles.settingItem}>
                            <VSCodeCheckbox checked={settings.workflow.autoSaveAfterAccept} onChange={(e: any) => updateSetting('workflow', 'autoSaveAfterAccept', e.target.checked)}>
                                Auto-Save on Accept Block
                            </VSCodeCheckbox>
                            <p className={styles.description}>Writes changes to physical disk immediately when you click Accept.</p>
                        </div>

                        <div className={styles.settingItem}>
                            <VSCodeCheckbox checked={settings.workflow.cleanupEmptyDirectories} onChange={(e: any) => updateSetting('workflow', 'cleanupEmptyDirectories', e.target.checked)}>
                                Cleanup Empty Directories on Revert
                            </VSCodeCheckbox>
                            <p className={styles.description}>Removes scaffolded folders automatically if you roll back a file creation.</p>
                        </div>

                        <div className={styles.settingItem}>
                            <VSCodeCheckbox checked={settings.workflow.clipboardWatcher} onChange={(e: any) => updateSetting('workflow', 'clipboardWatcher', e.target.checked)}>
                                Enable Clipboard Watcher
                            </VSCodeCheckbox>
                            <p className={styles.description}>Listens for copied XML payloads and prompts to apply them automatically.</p>
                        </div>

                        <div className={styles.settingItem}>
                            <VSCodeCheckbox checked={settings.workflow.historyBranchAwareness} onChange={(e: any) => updateSetting('workflow', 'historyBranchAwareness', e.target.checked)}>
                                Git Branch Awareness in History
                            </VSCodeCheckbox>
                            <p className={styles.description}>Hides operations from the History tab that belong to a different Git branch.</p>
                        </div>

                        <div className={styles.settingItem}>
                            <label className={styles.label}>Backup Retention (Days)</label>
                            <VSCodeTextField value={retentionInput} onInput={(e: any) => handleNumberChange('workflow', 'backupRetentionDays', e.target.value, setRetentionInput)} />
                            <p className={styles.description}>Number of days to preserve rollback file snapshots.</p>
                        </div>
                    </section>
                )}

                {/* --- ENGINE SETTINGS --- */}
                {activeTab === 'engine' && (
                    <section className={styles.section}>
                        <h3 className={styles.sectionTitle}>Text Parsing & Search</h3>
                        
                        <div className={styles.settingItem}>
                            <label className={styles.label}>Payload Recovery Mode</label>
                            <VSCodeDropdown value={settings.engine.payloadRecoveryMode} onChange={(e: any) => updateSetting('engine', 'payloadRecoveryMode', e.target.value)}>
                                <VSCodeOption value="strict">Strict (Fail on junk)</VSCodeOption>
                                <VSCodeOption value="standard">Standard (Strip markdown fences)</VSCodeOption>
                                <VSCodeOption value="aggressive">Aggressive (Strip CDATA and code tags)</VSCodeOption>
                            </VSCodeDropdown>
                            <p className={styles.description}>How aggressively the parser attempts to salvage malformed XML wrappers.</p>
                        </div>

                        <div className={styles.settingItem}>
                            <label className={styles.label}>Fallback Search Level</label>
                            <VSCodeDropdown value={settings.engine.fallbackMatchLevel} onChange={(e: any) => updateSetting('engine', 'fallbackMatchLevel', e.target.value)}>
                                <VSCodeOption value="none">None (AST / Exact Only)</VSCodeOption>
                                <VSCodeOption value="safe">Safe (Ignore whitespaces)</VSCodeOption>
                                <VSCodeOption value="aggressive">Aggressive (Ignore quotes/punctuation)</VSCodeOption>
                            </VSCodeDropdown>
                            <p className={styles.description}>Search strategies applied if AST and exact-match strings fail to find the code.</p>
                        </div>

                        <div className={styles.settingItem}>
                            <VSCodeCheckbox checked={settings.engine.useUnsavedBuffers} onChange={(e: any) => updateSetting('engine', 'useUnsavedBuffers', e.target.checked)}>
                                Target Unsaved Editor Buffers
                            </VSCodeCheckbox>
                            <p className={styles.description}>Searches within actively edited files in VS Code instead of purely reading from disk.</p>
                        </div>

                        <div className={styles.settingItem}>
                            <VSCodeCheckbox checked={settings.engine.polyglotParsing} onChange={(e: any) => updateSetting('engine', 'polyglotParsing', e.target.checked)}>
                                Enable Polyglot Parsing (Markdown Diffs)
                            </VSCodeCheckbox>
                            <p className={styles.description}>Attempts to parse standard Markdown code blocks if the AI forgets to use XML tags.</p>
                        </div>

                        <div className={styles.settingItem}>
                            <label className={styles.label}>Max File Size Limit (MB)</label>
                            <VSCodeTextField value={fileSizeInput} onInput={(e: any) => handleNumberChange('engine', 'maxFileSizeMb', e.target.value, setFileSizeInput)} />
                            <p className={styles.description}>Files larger than this limit will be bypassed to prevent Out-Of-Memory crashes.</p>
                        </div>
                    </section>
                )}

                {/* --- AST SETTINGS --- */}
                {activeTab === 'ast' && (
                    <section className={styles.section}>
                        <h3 className={styles.sectionTitle}>Tree-Sitter & Semantics</h3>
                        
                        <div className={styles.settingItem}>
                            <VSCodeCheckbox checked={settings.ast.enableAstMatching} onChange={(e: any) => updateSetting('ast', 'enableAstMatching', e.target.checked)}>
                                Enable Semantic AST Matching
                            </VSCodeCheckbox>
                            <p className={styles.description}>Uses language parsers to match functions/classes by their structural signature.</p>
                        </div>

                        <div className={styles.settingItem}>
                            <label className={styles.label}>AST Match Tolerance</label>
                            <VSCodeDropdown value={settings.ast.queryTolerance} onChange={(e: any) => updateSetting('ast', 'queryTolerance', e.target.value)}>
                                <VSCodeOption value="exact">Exact Signatures</VSCodeOption>
                                <VSCodeOption value="allow_signature_drift">Allow Signature Drift (Wildcard)</VSCodeOption>
                            </VSCodeDropdown>
                            <p className={styles.description}>Controls whether the parser attempts to find renamed or modified function signatures.</p>
                        </div>

                        <div className={styles.settingItem}>
                            <label className={styles.label}>Enabled Grammar Languages</label>
                            <p className={styles.description} style={{ marginTop: '-4px' }}>Disable languages you don't use to save WASM memory overhead.</p>
                            
                            <div className={styles.languageGrid}>
                                {AVAILABLE_LANGUAGES.map(lang => (
                                    <VSCodeCheckbox 
                                        key={lang.id} 
                                        checked={settings.ast.enabledLanguages.includes(lang.id)} 
                                        onChange={(e: any) => toggleLanguage(lang.id, e.target.checked)}
                                    >
                                        {lang.label}
                                    </VSCodeCheckbox>
                                ))}
                            </div>
                        </div>

                        <VSCodeDivider style={{ margin: '8px 0' }} />

                        <div className={styles.settingItem}>
                            <VSCodeCheckbox checked={settings.ast.strictSyntaxValidation} onChange={(e: any) => updateSetting('ast', 'strictSyntaxValidation', e.target.checked)}>
                                Block On Syntax Corruption
                            </VSCodeCheckbox>
                            <p className={styles.description}>Aborts the transaction if the AI introduces critical syntax errors (missing brackets).</p>
                        </div>

                        <div className={styles.settingItem}>
                            <VSCodeCheckbox checked={settings.ast.autoFixSyntax} onChange={(e: any) => updateSetting('ast', 'autoFixSyntax', e.target.checked)}>
                                Auto-Fix LLM Typos
                            </VSCodeCheckbox>
                            <p className={styles.description}>Repairs common hallucinations like trailing JSON commas or missing JSX tags.</p>
                        </div>

                        <div className={styles.settingItem}>
                            <VSCodeCheckbox checked={settings.ast.lspValidation} onChange={(e: any) => updateSetting('ast', 'lspValidation', e.target.checked)}>
                                Enable LSP Dry-Run Validation
                            </VSCodeCheckbox>
                            <p className={styles.description}>Validates code against the Language Server (TypeScript/C#) before saving.</p>
                        </div>

                        <div className={styles.settingItem}>
                            <VSCodeCheckbox checked={settings.ast.autoStitchImports} onChange={(e: any) => updateSetting('ast', 'autoStitchImports', e.target.checked)}>
                                Auto-Stitch Missing Imports
                            </VSCodeCheckbox>
                            <p className={styles.description}>Automatically calls VS Code API to resolve and insert missing file imports.</p>
                        </div>

                        <div className={styles.settingItem}>
                            <VSCodeCheckbox checked={settings.ast.blastRadiusAnalysis} onChange={(e: any) => updateSetting('ast', 'blastRadiusAnalysis', e.target.checked)}>
                                Enable Blast Radius Analysis
                            </VSCodeCheckbox>
                            <p className={styles.description}>Warns you if changing a function signature will break references in other files.</p>
                        </div>
                    </section>
                )}

                {/* --- AI AUTOMATION SETTINGS --- */}
                {activeTab === 'ai' && (
                    <section className={styles.section}>
                        <h3 className={styles.sectionTitle}>Feedback Loop</h3>

                        <div className={styles.settingItem}>
                            <VSCodeCheckbox checked={settings.ai.feedbackLoopEnabled} onChange={(e: any) => updateSetting('ai', 'feedbackLoopEnabled', e.target.checked)}>
                                Enable Auto-Correction Feedback
                            </VSCodeCheckbox>
                            <p className={styles.description}>Tracks manual corrections you make to AI code. Injects learned rules directly into the prompt copied via "Rules" from the main menu.</p>
                        </div>
                    </section>
                )}

            </div>
        </div>
    );
};