import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertOctagon, Home, RefreshCw } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { reportException } from "@/lib/sentry";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
    // Report to error tracking (no-op unless a DSN is configured), and keep the
    // console trace for local debugging.
    reportException(error);
    console.error("[ErrorBoundary caught an unhandled error]:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
          <Card className="max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-pop border-line bg-surface">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-red-500/10 border border-red-500/20 text-red shadow-2xs">
                <AlertOctagon className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <span className="rounded-full bg-red-soft border border-red/30 px-2 py-0.5 text-[10px] font-bold text-red uppercase tracking-wider">
                  Runtime Error Caught
                </span>
                <h2 className="text-xl font-bold text-ink font-sans tracking-tight">
                  Something went wrong
                </h2>
                <p className="text-xs text-muted leading-relaxed">
                  An unexpected error occurred while rendering this interface. The session has been protected from data corruption.
                </p>
              </div>
            </div>

            {/* Error Message Details */}
            {this.state.error && (
              <div className="rounded-xl border border-red/20 bg-red-soft/40 p-3 text-xs text-red font-mono break-all space-y-1">
                <div className="font-bold text-[11px] uppercase tracking-wider text-red/80">
                  Exception:
                </div>
                <div>{this.state.error.toString()}</div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-line/60">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.location.href = "/dashboard";
                }}
              >
                <Home className="h-3.5 w-3.5 mr-1" /> Dashboard
              </Button>
              <Button variant="primary" size="sm" onClick={this.handleReset}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reload Page
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
