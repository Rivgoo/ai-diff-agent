import { use } from 'react';
import { useIPC } from '@/webview/hooks/useIPC';
import { AgentContext } from '@/webview/store/AgentProvider';
import { IconPlus, IconX, IconBrandGithub, IconFolder } from '@tabler/icons-react';
import styles from './SessionTabs.module.css';

export const SessionTabs = () => {
    const { sendEvent } = useIPC();
    const context = use(AgentContext);
    
    if (!context) throw new Error('SessionTabs must be inside AgentProvider');
    const { sessions, activeSessionId } = context.state;

    const handleSwitch = (id: string) => {
        if (id !== activeSessionId) {
            sendEvent({ type: 'SWITCH_SESSION', sessionId: id });
        }
    };

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        sendEvent({ type: 'DELETE_SESSION', sessionId: id });
    };

    const handleNew = () => {
        sendEvent({ type: 'NEW_SESSION' });
    };

    const sessionList = Object.values(sessions).sort((a, b) => Number(a.id) - Number(b.id));

    if (sessionList.length === 0) return null;

    return (
        <div className={styles.container}>
            <div className={styles.topActions}>
                <button 
                    className={styles.iconBtn} 
                    onClick={() => sendEvent({ type: 'OPEN_EXTERNAL_LINK', url: 'https://make1txt.vercel.app/' })} 
                    title="Convert Repo to TXT (Make1txt)"
                >
                    <IconFolder size={14} />
                </button>
                <button 
                    className={styles.iconBtn} 
                    onClick={() => sendEvent({ type: 'OPEN_EXTERNAL_LINK', url: 'https://github.com/Rivgoo/ai-diff-agent' })} 
                    title="AI Diff Agent GitHub"
                >
                    <IconBrandGithub size={14} />
                </button>
                <div className={styles.divider} />
            </div>

            {sessionList.map((session) => (
                <div 
                    key={session.id}
                    className={`${styles.tab} ${session.id === activeSessionId ? styles.tabActive : ''}`}
                    onClick={() => handleSwitch(session.id)}
                    title={session.title}
                >
                    <span className={styles.tabTitle}>{session.title}</span>
                    <button className={styles.closeBtn} onClick={(e) => handleDelete(e, session.id)} title="Close Task">
                        <IconX size={12} />
                    </button>
                </div>
            ))}
            
            <button className={styles.addBtn} onClick={handleNew} title="New Task">
                <IconPlus size={14} />
            </button>
        </div>
    );
};