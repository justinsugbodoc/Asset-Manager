import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Router as WouterRouter } from 'wouter';
import { AppRoutes } from './routes';
import { AuthProvider } from './hooks/use-auth';

const queryClient = new QueryClient();

type RuntimeErrorBoundaryState = {
  error: Error | null;
};

class RuntimeErrorBoundary extends Component<
  { children: ReactNode },
  RuntimeErrorBoundaryState
> {
  state: RuntimeErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RuntimeErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('SugboDoc failed to render:', error, errorInfo);
  }

  handleReset = () => {
    try {
      window.sessionStorage.removeItem('sugbodoc_auth_token');
      window.sessionStorage.removeItem('sugbodoc_current_user');
    } catch {
      // The recovery screen remains usable even if storage is unavailable.
    }
    window.location.href = `${import.meta.env.BASE_URL ?? '/' }login`;
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-background">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-2xl text-destructive">
            !
          </div>
          <h1 className="mt-4 text-xl font-bold text-foreground">SugboDoc could not load</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The preview encountered a client-side error. Reset the saved session and try again.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted"
            >
              Reload
            </button>
            <button
              type="button"
              onClick={this.handleReset}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Reset session
            </button>
          </div>
          <p className="mt-5 break-words text-left text-[11px] text-muted-foreground">
            {this.state.error.message}
          </p>
        </div>
      </div>
    );
  }
}

function AppContent() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <AppRoutes />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function App() {
  return (
    <RuntimeErrorBoundary>
      <AppContent />
    </RuntimeErrorBoundary>
  );
}

export default App;
