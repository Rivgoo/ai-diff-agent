import * as vscode from 'vscode';

/**
 * Global observability utility providing unified diagnostic logging.
 * Decouples engine logs and redirects them to a dedicated VS Code Output Channel.
 * Wire: call OutputLogger.initialize() once in extension.ts activation.
 */
export class OutputLogger {
    private static channel: vscode.OutputChannel | undefined;

    public static initialize(): void {
        if (!this.channel) {
            this.channel = vscode.window.createOutputChannel('AI Diff Agent');
        }
    }

    public static log(message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO'): void {
        if (!this.channel) {
            this.initialize();
        }
        const timestamp = new Date().toISOString();
        this.channel!.appendLine(`[${timestamp}] [${level}] ${message}`);
    }

    public static show(): void {
        if (!this.channel) {
            this.initialize();
        }
        this.channel!.show(true);
    }

    public static dispose(): void {
        this.channel?.dispose();
        this.channel = undefined;
    }
}
