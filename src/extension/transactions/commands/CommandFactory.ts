import type { AnyOperation } from '../../../core/models/operations';
import type { ITransactionCommand } from '../core/ITransactionCommand';
import { CreateFileCommand } from './CreateFileCommand';
import { UpdateFileCommand } from './UpdateFileCommand';
import { DeletePathCommand } from './DeletePathCommand';
import { MovePathCommand } from './MovePathCommand';
import { CreateDirCommand } from './CreateDirCommand';

export class CommandFactory {
    public static create(operation: AnyOperation): ITransactionCommand {
        switch (operation.type) {
            case 'create_file':
                return new CreateFileCommand(operation as any);
            case 'update_file':
                return new UpdateFileCommand(operation as any);
            case 'delete_path':
                return new DeletePathCommand(operation as any);
            case 'move_path':
                return new MovePathCommand(operation as any);
            case 'create_dir':
                return new CreateDirCommand(operation as any);
            default:
                throw new Error(`Unsupported operation type: ${(operation as any).type}`);
        }
    }
}
