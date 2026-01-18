import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        this.setState({ errorInfo });

        // Log error for debugging
        console.error('[ErrorBoundary] Caught error:', error);
        console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);

        // Call optional error handler
        this.props.onError?.(error, errorInfo);
    }

    handleReset = (): void => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            // Custom fallback provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default error UI
            return (
                <div className="flex flex-col items-center justify-center p-8 bg-gray-800 rounded-lg border border-red-500/30 m-4">
                    <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">
                        Something went wrong
                    </h2>
                    <p className="text-gray-400 text-sm text-center mb-4 max-w-md">
                        {this.state.error?.message || 'An unexpected error occurred'}
                    </p>
                    {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                        <details className="w-full max-w-lg mb-4">
                            <summary className="text-gray-500 text-xs cursor-pointer hover:text-gray-300">
                                Show technical details
                            </summary>
                            <pre className="mt-2 p-2 bg-gray-900 rounded text-xs text-red-400 overflow-auto max-h-32">
                                {this.state.errorInfo.componentStack}
                            </pre>
                        </details>
                    )}
                    <button
                        onClick={this.handleReset}
                        className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
                    >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Try Again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
