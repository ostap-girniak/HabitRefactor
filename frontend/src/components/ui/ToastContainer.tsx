"use client";

import { useEffect, useState } from "react";
import { X, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { useUIStore } from "@/lib/store";

export function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);

  return (
    <div className="fixed bottom-20 md:bottom-6 right-6 z-50 space-y-2 max-w-sm">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

function Toast({
  id,
  type,
  message,
  onDismiss,
}: {
  id: string;
  type: "success" | "error" | "info";
  message: string;
  onDismiss: () => void;
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => setIsVisible(true));

    // Auto-dismiss after 4s
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onDismiss, 300);
    }, 4000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-[var(--accent-success)]" />,
    error: <AlertTriangle className="w-5 h-5 text-[var(--accent-danger)]" />,
    info: <Info className="w-5 h-5 text-[var(--accent-info)]" />,
  };

  const borders = {
    success: "border-[var(--accent-success)]",
    error: "border-[var(--accent-danger)]",
    info: "border-[var(--accent-info)]",
  };

  return (
    <div
      className={`glass border ${borders[type]} rounded-xl p-4 flex items-center gap-3 transition-all duration-300 ${
        isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
      }`}
    >
      {icons[type]}
      <span className="text-sm text-[var(--text-primary)] flex-1">{message}</span>
      <button onClick={onDismiss} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
