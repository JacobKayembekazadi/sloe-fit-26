import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    private handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen bg-black flex items-center justify-center p-6">
                    <div className="card max-w-md w-full text-center p-8 space-y-6">
                        <div className="text-6xl">😵</div>
                        <h2 className="text-2xl font-black text-white">Something went wrong</h2>
                        <p className="text-gray-400">
                            An unexpected error occurred. Please try again.
                        </p>
                        {this.state.error && (
                            <details className="text-left bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                                <summary className="text-red-400 cursor-pointer font-bold text-sm">
                                    Error Details
                                </summary>
                                <pre className="text-red-300 text-xs mt-2 overflow-auto">
                                    {this.state.error.message}
                                </pre>
                            </details>
                        )}
                        <div className="flex gap-3">
                            <button
                                onClick={this.handleRetry}
                                className="btn-primary flex-1"
                            >
                                Try Again
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="btn-secondary flex-1"
                            >
                                Reload App
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
