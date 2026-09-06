import { useContext, useEffect, useRef } from 'react';
import { useIPC } from '@/webview/hooks/useIPC';
import { AgentContext } from '@/webview/store/AgentProvider';
import { IconPlus, IconX, IconBrandGithub, IconFolder, IconHistory } from '@tabler/icons-react';
import styles from './SessionTabs.module.css';

export const SessionTabs = () => {
    const { sendEvent } = useIPC();
    const context = useContext(AgentContext);
    
    const containerRef = useRef<HTMLDivElement>(null);
    
    if (!context) throw new Error('SessionTabs must be inside AgentProvider');
    const { sessions, activeSessionId, settings } = context.state;

    const sessionList = Object.values(sessions).sort((a, b) => Number(a.id) - Number(b.id));

    useEffect(() => {
        if (!containerRef.current || !activeSessionId) return;
        
        setTimeout(() => {
            if (!containerRef.current) return;
            const activeTabElement = containerRef.current.querySelector(`.${styles.tabActive}`);
            if (activeTabElement) {
                activeTabElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }, 50);
    }, [activeSessionId, sessionList.length]);

    if (sessionList.length === 0) return null;

    return (
        <div className={styles.container} ref={containerRef}>
            <div className={styles.topActions} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0 8px' }}>
                <button 
                    className={styles.iconBtn} style={{ background: 'none', border: 'none', color: 'var(--vscode-icon-foreground)', cursor: 'pointer' }}
                    onClick={() => {
                        // ФІКС: Логіка перенаправлення
                        if (settings.bridge.enableBridge) {
                            sendEvent({ type: 'BRIDGE_TO_MAKE1TXT' });
                        } else {
                            sendEvent({ type: 'OPEN_EXTERNAL_LINK', url: 'https://make1txt.vercel.app/' });
                        }
                    }} 
                    title={settings.bridge.enableBridge ? "Export Project to Make1Txt" : "Open Make1Txt (Bridge Disabled)"}
                >
                    <IconFolder size={14} />
                </button>
                <button 
                    className={styles.iconBtn} style={{ background: 'none', border: 'none', color: 'var(--vscode-icon-foreground)', cursor: 'pointer' }}
                    onClick={() => sendEvent({ type: 'OPEN_EXTERNAL_LINK', url: 'https://github.com/Rivgoo/ai-diff-agent' })} 
                    title="AI Diff Agent GitHub"
                >
                    <IconBrandGithub size={14} />
                </button>
                <button 
                    className={styles.iconBtn} style={{ background: 'none', border: 'none', color: 'var(--vscode-icon-foreground)', cursor: 'pointer' }}
                    onClick={() => context.actions.toggleHistoryWindow(true)} 
                    title="Transaction History"
                >
                    <IconHistory size={14} />
                </button>
                <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--vscode-editorGroupHeader-tabsBorder)', margin: '0 4px' }} />
            </div>

            {sessionList.map((session) => (
                <div 
                    key={session.id}
                    className={`${styles.tab} ${session.id === activeSessionId ? styles.tabActive : ''}`}
                    onClick={() => sendEvent({ type: 'SWITCH_SESSION', sessionId: session.id })}
                    title={session.title}
                >
                    <span className={styles.tabTitle}>{session.title}</span>
                    <button className={styles.closeBtn} onClick={(e) => { e.stopPropagation(); sendEvent({ type: 'DELETE_SESSION', sessionId: session.id }); }}>
                        <IconX size={12} />
                    </button>
                </div>
            ))}
            
            <button className={styles.addBtn} onClick={() => sendEvent({ type: 'NEW_SESSION' })}>
                <IconPlus size={14} />
            </button>
        </div>
    );
};