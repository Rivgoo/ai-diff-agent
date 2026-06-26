import * as vscode from 'vscode';

/**
 * Global observability utility providing unified diagnostic logging.
 * Decouples engine logs and redirects them to a dedicated VS Code Output Channel.
 * Automatically self-initializes if invoked prior to de-serialisation.
 */
export class OutputLogger {
    private static channel: vscode.OutputChannel | undefined;

    /**
     * Allocates the VS Code Output Channel if it does not already exist.
     */
    public static initialize(): void {
        if (!this.channel) {
            this.channel = vscode.window.createOutputChannel('AI Diff Agent');
        }
    }

    /**
     * Emits a formatted timestamped trace to the output console.
     */
    public static log(message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO'): void {
        if (!this.channel) {
            this.initialize();
        }
        const timestamp = new Date().toISOString();
        this.channel!.appendLine(`[${timestamp}] [${level}] ${message}`);
    }

    /**
     * Focuses the dedicated output panel to provide user visibility.
     */
    public static show(): void {
        if (!this.channel) {
            this.initialize();
        }
        this.channel!.show(true);
    }

    /**
     * Disposes of the active channel reference to avoid host leaks on deactivation.
     */
    public static dispose(): void {
        this.channel?.dispose();
        this.channel = undefined;
    }
}
