import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    sectionName?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class SectionErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error(`[SectionErrorBoundary] ${this.props.sectionName || 'Section'} crashed:`, error, errorInfo);
    }

    private isChunkLoadError(): boolean {
        const msg = this.state.error?.message || '';
        return msg.includes('Loading chunk') ||
               msg.includes('Failed to fetch dynamically imported module') ||
               msg.includes('Importing a module script failed');
    }

    private handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    private handleReload = () => {
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            const isChunkError = this.isChunkLoadError();
            return (
                <div className="card p-6 text-center space-y-4" role="alert">
                    <div className="w-12 h-12 mx-auto bg-red-500/20 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-bold text-white">
                        {isChunkError
                            ? 'App update available'
                            : `${this.props.sectionName || 'This section'} encountered an error`}
                    </h3>
                    <p className="text-gray-400 text-sm">
                        {isChunkError
                            ? 'A new version has been deployed. Please reload to continue.'
                            : (this.state.error?.message || 'Something went wrong.')}
                    </p>
                    <button
                        onClick={isChunkError ? this.handleReload : this.handleRetry}
                        className="px-6 py-2 bg-[var(--color-primary)] text-black font-bold rounded-xl hover:scale-105 transition-transform"
                    >
                        {isChunkError ? 'Reload App' : 'Try Again'}
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default SectionErrorBoundary;
