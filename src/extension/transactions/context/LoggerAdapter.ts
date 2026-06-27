import { OutputLogger } from '../../../infrastructure/logging/outputLogger';
import type { ILogger } from '../core/ILogger';

export class LoggerAdapter implements ILogger {
    public info(message: string): void {
        OutputLogger.log(message, 'INFO');
    }

    public warn(message: string): void {
        OutputLogger.log(message, 'WARN');
    }

    public error(message: string): void {
        OutputLogger.log(message, 'ERROR');
    }
}
