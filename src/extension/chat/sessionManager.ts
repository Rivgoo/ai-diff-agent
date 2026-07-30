import * as vscode from 'vscode';
import type { ChatSession, ChatMessage, DiffOperation } from '../../shared/models';
import { SYSTEM_CONSTANTS } from '../../shared/constants';
import { OutputLogger } from '@/infrastructure/logging/outputLogger';

const MAX_MESSAGES_PER_SESSION = 50;

export class ChatSessionManager {
    private sessions: Record<string, ChatSession> = {};
    private activeSessionId: string = '';
    private saveTimer: NodeJS.Timeout | null = null;

    private saveQueue: Promise<void> = Promise.resolve();

    constructor(
        private readonly storage: vscode.Memento,
        private readonly workspaceRoot: vscode.Uri | undefined,
        private readonly isWorkspaceStorageEnabled: () => boolean,
        private readonly onReady: () => void
    ) {
        this.reload();
    }

    public async reload(): Promise<void> {
        this.forceSave(); 

        if (this.isWorkspaceStorageEnabled() && this.workspaceRoot) {
            try {
                const fileUri = vscode.Uri.joinPath(this.workspaceRoot, '.vscode', 'ai-chat-history.json');
                const data = await vscode.workspace.fs.readFile(fileUri);
                const content = new TextDecoder('utf-8').decode(data);
                const parsed = JSON.parse(content);
                
                this.sessions = parsed.sessions || {};
                this.activeSessionId = parsed.activeSessionId || '';
            } catch (e) {
                this.createSessionSync();
            }
        } else {
            const storedSessions = this.storage.get<Record<string, ChatSession>>(`${SYSTEM_CONSTANTS.STORAGE_KEY_CHAT_SESSION}_v2`);
            const storedActiveId = this.storage.get<string>(`${SYSTEM_CONSTANTS.STORAGE_KEY_CHAT_SESSION}_activeId`);

            if (storedSessions && Object.keys(storedSessions).length > 0 && storedActiveId) {
                this.sessions = storedSessions;
                this.activeSessionId = storedActiveId;
            } else {
                this.createSessionSync();
            }
        }

        if (Object.keys(this.sessions).length === 0) {
            this.createSessionSync();
        }
        
        this.onReady();
    }

    public getActiveSession(): ChatSession {
        return this.sessions[this.activeSessionId];
    }

    public getAllSessions(): Record<string, ChatSession> {
        return this.sessions;
    }

    public getActiveSessionId(): string {
        return this.activeSessionId;
    }

    public createSession(): void {
        this.forceSave(); 
        this.createSessionSync();
        this.scheduleSave();
    }

    public switchSession(id: string): void {
        if (this.sessions[id]) {
            this.forceSave();
            this.activeSessionId = id;
            this.scheduleSave();
        }
    }

    public deleteSession(id: string): void {
        if (this.sessions[id]) {
            delete this.sessions[id];
            const remainingKeys = Object.keys(this.sessions);
            
            if (remainingKeys.length === 0) {
                this.createSessionSync();
            } else if (this.activeSessionId === id) {
                this.activeSessionId = remainingKeys[0];
            }
            this.forceSave();
        }
    }

    public addMessage(message: ChatMessage): void {
        const session = this.getActiveSession();
        session.messages.push(message);
        
        if (session.messages.length > MAX_MESSAGES_PER_SESSION) {
            session.messages = session.messages.slice(-MAX_MESSAGES_PER_SESSION);
        }
        
        if (session.messages.length === 1 && message.role === 'user') {
            const preview = message.text.substring(0, 20).replace(/\n/g, ' ');
            session.title = preview.length > 0 ? `${preview}...` : session.title;
        }
        
        this.scheduleSave();
    }

    public updateOperationFromEvent(update: any): void {
        const session = this.getActiveSession();
        for (const msg of session.messages) {
            if (msg.operations) {
                const op = msg.operations.find(o => o.id === update.operationId);
                if (op) {
                    if (update.status !== undefined) op.status = update.status;
                    if (update.conflict !== undefined) op.conflict = update.conflict;
                    if (update.matchStrategy !== undefined) op.matchStrategy = update.matchStrategy;
                    if (update.confidenceScore !== undefined) op.confidenceScore = update.confidenceScore;
                    if (update.resolvedResiliently !== undefined) op.resolvedResiliently = update.resolvedResiliently;
                    if (update.path !== undefined) op.path = update.path;
                    if (update.alreadyApplied !== undefined) op.alreadyApplied = update.alreadyApplied;
                    if (update.isPartiallyResolved !== undefined) op.isPartiallyResolved = update.isPartiallyResolved;
                    
                    this.scheduleSave();
                    return;
                }
            }
        }
    }

    public updateOperation(operation: DiffOperation): void {
        const session = this.getActiveSession();
        for (const msg of session.messages) {
            if (msg.operations) {
                const idx = msg.operations.findIndex(o => o.id === operation.id);
                if (idx !== -1) {
                    msg.operations[idx] = { ...msg.operations[idx], ...operation };
                    this.scheduleSave();
                    return;
                }
            }
        }
    }

    public clearSession(): void {
        this.getActiveSession().messages = [];
        this.forceSave();
    }

    private createSessionSync(): void {
        const id = Date.now().toString();
        this.sessions[id] = {
            id,
            title: `Task ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            messages: []
        };
        this.activeSessionId = id;
    }

    private scheduleSave(): void {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
        }
        this.saveTimer = setTimeout(() => {
            this.executeSave();
        }, 1000); 
    }

    private forceSave(): void {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
        this.executeSave();
    }

    private executeSave(): void {
        this.saveQueue = this.saveQueue.then(async () => {
            const dataToSave = {
                sessions: this.sessions,
                activeSessionId: this.activeSessionId
            };
            
            const content = await new Promise<string>((resolve) => {
                setTimeout(() => {
                    resolve(JSON.stringify(dataToSave, null, 2));
                }, 0);
            });

            if (this.isWorkspaceStorageEnabled() && this.workspaceRoot) {
                try {
                    const fileUri = vscode.Uri.joinPath(this.workspaceRoot, '.vscode', 'ai-chat-history.json');
                    const data = new TextEncoder().encode(content);
                    await vscode.workspace.fs.writeFile(fileUri, data);
                } catch (e) {
                    OutputLogger.log(`Failed to save chat history to workspace: ${e}`, 'ERROR');
                }
            } else {
                this.storage.update(`${SYSTEM_CONSTANTS.STORAGE_KEY_CHAT_SESSION}_v2`, this.sessions);
                this.storage.update(`${SYSTEM_CONSTANTS.STORAGE_KEY_CHAT_SESSION}_activeId`, this.activeSessionId);
            }
        }).catch(e => {
            OutputLogger.log(`Critical save queue error: ${e}`, 'ERROR');
        });
    }
}