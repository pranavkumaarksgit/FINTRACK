import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends (Component as any) {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[FINTRACK ErrorBoundary caught]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // ignore
    }
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#070b14] text-white flex items-center justify-center p-6 relative overflow-hidden font-sans">
          {/* Ambient background glow */}
          <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-md w-full bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl relative z-10 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-5 shadow-lg shadow-rose-500/10">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h2 className="text-xl font-bold tracking-tight text-white mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-slate-400 mb-6 font-mono leading-relaxed">
              FINTRACK encountered an unexpected error while rendering this view.
            </p>

            {this.state.error && (
              <div className="text-left bg-black/40 border border-white/10 rounded-2xl p-3.5 mb-6 text-xs font-mono text-rose-300 overflow-x-auto max-h-32">
                <span className="font-semibold text-rose-400 block mb-1">
                  {this.state.error.name}: {this.state.error.message}
                </span>
                {this.state.errorInfo?.componentStack && (
                  <pre className="text-[10px] text-slate-500 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack.slice(0, 300)}
                  </pre>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all active:scale-95 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Reload View
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full sm:flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm border border-white/10 transition-all active:scale-95 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Reset Cache
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
