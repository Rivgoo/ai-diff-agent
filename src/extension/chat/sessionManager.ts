import * as vscode from 'vscode';
import type { ChatSession, ChatMessage, OperationStatus, DiffOperation } from '../../shared/models';
import { SYSTEM_CONSTANTS } from '../../shared/constants';
import { OutputLogger } from '@/infrastructure/logging/outputLogger';

export class ChatSessionManager {
    private sessions: Record<string, ChatSession> = {};
    private activeSessionId: string = '';

    constructor(
        private readonly storage: vscode.Memento,
        private readonly workspaceRoot: vscode.Uri | undefined,
        private readonly isWorkspaceStorageEnabled: () => boolean,
        private readonly onReady: () => void
    ) {
        this.reload();
    }

    /**
     * Асинхронне завантаження сесій. Використовується при ініціалізації 
     * або при зміні налаштувань зберігання.
     */
    public async reload(): Promise<void> {
        if (this.isWorkspaceStorageEnabled() && this.workspaceRoot) {
            try {
                const fileUri = vscode.Uri.joinPath(this.workspaceRoot, '.vscode', 'ai-chat-history.json');
                const data = await vscode.workspace.fs.readFile(fileUri);
                const content = new TextDecoder('utf-8').decode(data);
                const parsed = JSON.parse(content);
                
                this.sessions = parsed.sessions || {};
                this.activeSessionId = parsed.activeSessionId || '';
            } catch (e) {
                // Якщо файлу ще немає або він пошкоджений, створюємо нову пусту сесію
                this.createSessionSync();
            }
        } else {
            // Завантаження з внутрішнього Memento
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
        
        // Сповіщаємо UI, що дані завантажені та готові до відтворення
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
        this.createSessionSync();
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
                this.createSessionSync();
            } else if (this.activeSessionId === id) {
                this.activeSessionId = remainingKeys[0];
            }
            this.saveSessions();
        }
    }

    public addMessage(message: ChatMessage): void {
        const session = this.getActiveSession();
        session.messages.push(message);
        
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

    private createSessionSync(): void {
        const id = Date.now().toString();
        this.sessions[id] = {
            id,
            title: `Task ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            messages: []
        };
        this.activeSessionId = id;
    }

    private async saveSessions(): Promise<void> {
        if (this.isWorkspaceStorageEnabled() && this.workspaceRoot) {
            try {
                // Зберігаємо історію в .vscode/ai-chat-history.json
                const fileUri = vscode.Uri.joinPath(this.workspaceRoot, '.vscode', 'ai-chat-history.json');
                const content = JSON.stringify({
                    sessions: this.sessions,
                    activeSessionId: this.activeSessionId
                }, null, 2);
                
                const data = new TextEncoder().encode(content);
                await vscode.workspace.fs.writeFile(fileUri, data);
            } catch (e) {
                OutputLogger.log(`Failed to save chat history to workspace: ${e}`, 'ERROR');
            }
        } else {
            // Зберігаємо у внутрішню базу Memento
            this.storage.update(`${SYSTEM_CONSTANTS.STORAGE_KEY_CHAT_SESSION}_v2`, this.sessions);
            this.storage.update(`${SYSTEM_CONSTANTS.STORAGE_KEY_CHAT_SESSION}_activeId`, this.activeSessionId);
        }
    }
}