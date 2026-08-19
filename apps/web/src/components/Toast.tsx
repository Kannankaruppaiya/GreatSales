import { AlertCircle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useToastStore, type ToastMessage } from "../store/toastStore";
import { cn } from "../lib/utils";

const ICONS = {
  success: CheckCircle2,
  info: Info,
  warning: AlertCircle,
  error: XCircle,
};

const STYLES = {
  success: "border-brand/40 bg-surface text-ink shadow-lg shadow-brand/10",
  info: "border-blue/40 bg-surface text-ink shadow-lg shadow-blue/10",
  warning: "border-amber/40 bg-surface text-ink shadow-lg shadow-amber/10",
  error: "border-red/40 bg-surface text-ink shadow-lg shadow-red/10",
};

const ICON_COLORS = {
  success: "text-brand",
  info: "text-blue",
  warning: "text-amber",
  error: "text-red",
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onClose,
}: {
  toast: ToastMessage;
  onClose: () => void;
}) {
  const Icon = ICONS[toast.type];

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-start gap-3 p-3 rounded-xl border backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-3 duration-200",
        STYLES[toast.type]
      )}
    >
      <Icon className={cn("h-4.5 w-4.5 shrink-0 mt-0.5", ICON_COLORS[toast.type])} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold text-ink leading-snug">{toast.title}</div>
        {toast.message && (
          <div className="text-[11.5px] text-muted leading-relaxed mt-0.5">
            {toast.message}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="text-muted hover:text-ink p-0.5 rounded cursor-pointer transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
