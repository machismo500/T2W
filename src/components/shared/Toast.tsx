"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, AlertTriangle, Info, XCircle, X } from "lucide-react";

export type ToastKind = "success" | "error" | "info" | "warning";

type Toast = {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
  duration: number;
};

type ToastContextValue = {
  show: (t: Omit<Toast, "id" | "duration"> & { duration?: number }) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const kindStyles: Record<ToastKind, { icon: typeof CheckCircle; color: string; bg: string; border: string }> = {
  success: {
    icon: CheckCircle,
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/30",
  },
  error: {
    icon: XCircle,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
  },
  info: {
    icon: Info,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback<ToastContextValue["show"]>((t) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const duration = t.duration ?? 4500;
    setToasts((prev) => [...prev, { ...t, id, duration }]);
    if (duration > 0) {
      const timer = window.setTimeout(() => {
        timersRef.current.delete(id);
        setToasts((prev) => prev.filter((x) => x.id !== id));
      }, duration);
      timersRef.current.set(id, timer);
    }
  }, []);

  const success = useCallback((title: string, message?: string) => show({ kind: "success", title, message }), [show]);
  const error = useCallback((title: string, message?: string) => show({ kind: "error", title, message }), [show]);
  const info = useCallback((title: string, message?: string) => show({ kind: "info", title, message }), [show]);
  const warning = useCallback((title: string, message?: string) => show({ kind: "warning", title, message }), [show]);

  return (
    <ToastContext.Provider value={{ show, success, error, info, warning, dismiss }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed right-4 top-20 z-[100] flex w-full max-w-sm flex-col gap-2 sm:right-6"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const { icon: Icon, color, bg, border } = kindStyles[t.kind];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, x: 80, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 80, scale: 0.96, transition: { duration: 0.2 } }}
                transition={{ type: "spring", stiffness: 320, damping: 28 }}
                className={`pointer-events-auto flex gap-3 rounded-2xl border ${border} ${bg} bg-t2w-surface/95 p-4 shadow-2xl backdrop-blur`}
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${bg}`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">{t.title}</p>
                  {t.message && (
                    <p className="mt-1 text-xs leading-relaxed text-t2w-muted">{t.message}</p>
                  )}
                </div>
                <button
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss notification"
                  className="shrink-0 self-start rounded-md p-1 text-t2w-muted transition-colors hover:bg-white/5 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Safe no-op fallback when used outside provider (e.g. during SSR edge cases)
    const noop = () => {};
    return { show: noop, success: noop, error: noop, info: noop, warning: noop, dismiss: noop };
  }
  return ctx;
}
