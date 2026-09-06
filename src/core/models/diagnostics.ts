import type { Range } from '../../shared/contracts';

export type DiagnosticSeverity = 'critical' | 'warning' | 'info';

export interface CoreDiagnostic {
    readonly operationId?: string;
    readonly path: string;
    readonly severity: DiagnosticSeverity;
    readonly title: string;
    readonly detailedMessage: string;
    readonly range?: Range;
    readonly code?: string;
}