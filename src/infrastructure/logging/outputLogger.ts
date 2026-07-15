import * as vscode from 'vscode';

export class OutputLogger {
    private static _channel: vscode.OutputChannel | undefined;

    private static get channel(): vscode.OutputChannel {
        if (!this._channel) {
            this._channel = vscode.window.createOutputChannel('AI Diff Agent');
        }
        return this._channel;
    }

    public static initialize(): void {
        const _ = this.channel; // Форсуємо створення
    }

    public static log(message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO'): void {
        const timestamp = new Date().toISOString();
        const formattedMessage = `[${timestamp}] [${level}] ${message}`;
        
        this.channel.appendLine(formattedMessage);

        if (level === 'ERROR') {
            console.error(formattedMessage);
        } else if (level === 'WARN') {
            console.warn(formattedMessage);
        } else {
            console.log(formattedMessage);
        }
    }

    public static show(): void {
        this.channel.show(true);
    }

    public static dispose(): void {
        this._channel?.dispose();
        this._channel = undefined;
    }
}