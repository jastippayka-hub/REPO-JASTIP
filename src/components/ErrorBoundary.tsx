import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
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
    console.error('[PAYKAJASTIP ErrorBoundary] Uncaught render error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200 p-6 sm:p-8 text-center space-y-5">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center text-3xl font-bold shadow-inner">
              ⚠️
            </div>

            <div className="space-y-2">
              <span className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold tracking-wide">
                PAYKAJASTIP SINGKAWANG
              </span>
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-800">
                Terjadi Kendala Tampilan
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Halaman mengalami kendala saat memuat komponen. Data akun dan pesanan Anda tetap aman di server. Silakan muat ulang untuk melanjutkan.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs shadow-md transition"
              >
                🔄 Muat Ulang Halaman
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold text-xs transition"
              >
                🏠 Ke Beranda
              </button>
            </div>

            <p className="text-[11px] text-slate-400">
              Layanan Jastip & Kurir Singkawang, Kalimantan Barat
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
