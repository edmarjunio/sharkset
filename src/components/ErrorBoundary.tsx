import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('SHARKSET ErrorBoundary caught:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#071D3D] text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-sky-400/30 space-y-4">
            <h1 className="text-2xl font-black text-sky-300">SHARKSET</h1>
            <p className="text-slate-200 text-sm">
              Ocorreu uma instabilidade momentânea ao carregar a interface.
            </p>
            {this.state.error && (
              <pre className="p-3 bg-black/40 rounded-lg text-xs text-left overflow-auto max-h-40 text-red-300">
                {this.state.error.message || String(this.state.error)}
              </pre>
            )}
            <button
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="w-full bg-[#0987CE] hover:bg-[#076fa8] text-white font-bold py-3 rounded-xl transition-all shadow-lg"
            >
              Recarregar Aplicação
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
