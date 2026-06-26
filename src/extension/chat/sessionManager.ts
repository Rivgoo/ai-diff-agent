import type * as vscode from 'vscode';
import type { ChatSession, ChatMessage, OperationStatus, DiffOperation } from '../../shared/models';
import { SYSTEM_CONSTANTS } from '../../shared/constants';

export class ChatSessionManager {
    private sessions: Record<string, ChatSession> = {};
    private activeSessionId: string = '';

    constructor(private readonly storage: vscode.Memento) {
        this.loadSessions();
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
        const id = Date.now().toString();
        this.sessions[id] = {
            id,
            title: `Task ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            messages: []
        };
        this.activeSessionId = id;
        this.saveSessions();
    }

    public switchSession(id: string): void {
        if (this.sessions[id]) {
            this.activeSessionId = id;
            this.saveSessions();
        }
    }

    public deleteSession(id: string): void {
        if (this.sessions[id]) {
            delete this.sessions[id];
            const remainingKeys = Object.keys(this.sessions);
            
            if (remainingKeys.length === 0) {
                this.createSession();
            } else if (this.activeSessionId === id) {
                this.activeSessionId = remainingKeys[0];
            }
            this.saveSessions();
        }
    }

    public addMessage(message: ChatMessage): void {
        const session = this.getActiveSession();
        session.messages.push(message);
        
        // Авто-перейменування сесії за першим запитом
        if (session.messages.length === 1 && message.role === 'user') {
            const preview = message.text.substring(0, 20).replace(/\n/g, ' ');
            session.title = preview.length > 0 ? `${preview}...` : session.title;
        }
        
        this.saveSessions();
    }

    public updateOperationStatus(operationId: string, status: OperationStatus): void {
        const session = this.getActiveSession();
        for (const msg of session.messages) {
            if (msg.operations) {
                const op = msg.operations.find(o => o.id === operationId);
                if (op) {
                    op.status = status;
                    this.saveSessions();
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
                    this.saveSessions();
                    return;
                }
            }
        }
    }

    public clearSession(): void {
        this.getActiveSession().messages = [];
        this.saveSessions();
    }

    private loadSessions(): void {
        const storedSessions = this.storage.get<Record<string, ChatSession>>(`${SYSTEM_CONSTANTS.STORAGE_KEY_CHAT_SESSION}_v2`);
        const storedActiveId = this.storage.get<string>(`${SYSTEM_CONSTANTS.STORAGE_KEY_CHAT_SESSION}_activeId`);

        if (storedSessions && Object.keys(storedSessions).length > 0 && storedActiveId) {
            this.sessions = storedSessions;
            this.activeSessionId = storedActiveId;
        } else {
            // Міграція зі старої версії або чистий старт
            this.createSession();
        }
    }

    private saveSessions(): void {
        this.storage.update(`${SYSTEM_CONSTANTS.STORAGE_KEY_CHAT_SESSION}_v2`, this.sessions);
        this.storage.update(`${SYSTEM_CONSTANTS.STORAGE_KEY_CHAT_SESSION}_activeId`, this.activeSessionId);
    }
}