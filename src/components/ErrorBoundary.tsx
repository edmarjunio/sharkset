import React, { Component, ErrorInfo, ReactNode } from 'react';
import { reportUnexpectedError } from '../services/errorReporter';

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
    reportUnexpectedError(`${error.message}\n${errorInfo.componentStack || ''}`, 'erro de renderização');
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#071D3D] text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-sky-400/30 space-y-4">
            <h1 className="text-2xl font-black text-sky-300">SHARKSET</h1>
            <p className="text-slate-200 text-sm">
              Ocorreu algo inesperado. Atualize a aplicação e tente novamente. O erro foi registrado para suporte.
            </p>
            <button
              onClick={() => {
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
