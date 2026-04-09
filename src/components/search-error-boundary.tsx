"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface SearchErrorBoundaryProps {
  children: ReactNode;
}

interface SearchErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  retryKey: number;
}

export class SearchErrorBoundary extends Component<
  SearchErrorBoundaryProps,
  SearchErrorBoundaryState
> {
  constructor(props: SearchErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: "",
      retryKey: 0,
    };
  }

  static getDerivedStateFromError(error: Error): SearchErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || "Search interface failed to render.",
      retryKey: 0,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("SearchErrorBoundary caught an error", { error, errorInfo });
  }

  private handleRetry = () => {
    this.setState((prev) => ({
      hasError: false,
      errorMessage: "",
      retryKey: prev.retryKey + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-4">
          <div className="frost-panel w-full rounded-2xl p-6 text-center">
            <h1 className="text-2xl font-semibold">Search UI crashed</h1>
            <p className="ink-muted mt-2 text-sm">
              {this.state.errorMessage || "An unexpected error occurred in the search interface."}
            </p>
            <button
              onClick={this.handleRetry}
              className="mt-4 rounded-xl bg-(--accent-1) px-4 py-2 text-sm font-semibold text-white"
            >
              Reload search
            </button>
          </div>
        </main>
      );
    }

    return <div key={this.state.retryKey}>{this.props.children}</div>;
  }
}