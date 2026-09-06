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
                const legacyFile = vscode.Uri.joinPath(this.workspaceRoot, '.vscode', 'ai-chat-history.json');
                Promise.resolve(vscode.workspace.fs.delete(legacyFile, { useTrash: false }))
                    .catch((e) => {
                        if (e.code !== 'FileNotFound') OutputLogger.log(`[SessionManager] Failed to delete legacy history file: ${e.message}`, 'WARN');
                    });

                const dirUri = vscode.Uri.joinPath(this.workspaceRoot, '.vscode', 'ai-chats');
                await vscode.workspace.fs.createDirectory(dirUri);
                
                const entries = await vscode.workspace.fs.readDirectory(dirUri);
                this.sessions = {};
                
                for (const [name, type] of entries) {
                    if (type === vscode.FileType.File && name.endsWith('.json')) {
                        const fileUri = vscode.Uri.joinPath(dirUri, name);
                        const data = await vscode.workspace.fs.readFile(fileUri);
                        const content = new TextDecoder('utf-8').decode(data);
                        const session: ChatSession = JSON.parse(content);
                        this.sessions[session.id] = session;
                    }
                }
                
                try {
                    const activeMetaUri = vscode.Uri.joinPath(this.workspaceRoot, '.vscode', 'ai-chat-meta.json');
                    const metaData = await vscode.workspace.fs.readFile(activeMetaUri);
                    const meta = JSON.parse(new TextDecoder('utf-8').decode(metaData));
                    this.activeSessionId = meta.activeSessionId || '';
                } catch {
                    const keys = Object.keys(this.sessions);
                    this.activeSessionId = keys.length > 0 ? keys[keys.length - 1] : '';
                }

            } catch (e) {
                OutputLogger.log(`Failed to load workspace sessions, starting fresh.`, 'WARN');
            }
        } else {
            const storedSessions = this.storage.get<Record<string, ChatSession>>(`${SYSTEM_CONSTANTS.STORAGE_KEY_CHAT_SESSION}_v2`);
            const storedActiveId = this.storage.get<string>(`${SYSTEM_CONSTANTS.STORAGE_KEY_CHAT_SESSION}_activeId`);

            if (storedSessions && Object.keys(storedSessions).length > 0 && storedActiveId) {
                this.sessions = storedSessions;
                this.activeSessionId = storedActiveId;
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
            
            if (this.isWorkspaceStorageEnabled() && this.workspaceRoot) {
                const dirUri = vscode.Uri.joinPath(this.workspaceRoot, '.vscode', 'ai-chats', `session_${id}.json`);
                Promise.resolve(vscode.workspace.fs.delete(dirUri, { useTrash: false }))
                    .catch((e) => {
                        if (e.code !== 'FileNotFound') OutputLogger.log(`[SessionManager] Failed to delete session file for ${id}: ${e.message}`, 'WARN');
                    });
            }

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
                    Object.assign(op, update);
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
        if (this.saveTimer) clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => this.executeSave(), 1000); 
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
            const activeSession = this.sessions[this.activeSessionId];
            if (!activeSession) return;

            if (this.isWorkspaceStorageEnabled() && this.workspaceRoot) {
                try {
                    const dirUri = vscode.Uri.joinPath(this.workspaceRoot, '.vscode', 'ai-chats');
                    await vscode.workspace.fs.createDirectory(dirUri);
                    
                    const fileUri = vscode.Uri.joinPath(dirUri, `session_${activeSession.id}.json`);
                    const content = JSON.stringify(activeSession, null, 2);
                    await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(content));

                    const metaUri = vscode.Uri.joinPath(this.workspaceRoot, '.vscode', 'ai-chat-meta.json');
                    await vscode.workspace.fs.writeFile(metaUri, new TextEncoder().encode(JSON.stringify({ activeSessionId: this.activeSessionId })));
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