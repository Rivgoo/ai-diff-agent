interface ErrorAlertProps {
    details: string;
}

export const ErrorAlert = (props: ErrorAlertProps) => {
    const { details } = props;
    return (
        <div style={{
            marginTop: '8px',
            padding: '10px',
            backgroundColor: 'var(--vscode-inputValidation-errorBackground)',
            border: '1px solid var(--vscode-inputValidation-errorBorder)',
            color: 'var(--vscode-editorError-foreground)',
            borderRadius: '4px',
            fontSize: '13px'
        }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Parsing Failed</div>
            <div style={{ fontFamily: 'var(--vscode-editor-font-family)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {details}
            </div>
        </div>
    );
};
