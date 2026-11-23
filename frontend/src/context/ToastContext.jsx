import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

const ToastContext = createContext({ push: () => {} });

let counter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    ({ title, description, tone = "success", href, duration = 7000 }) => {
      counter += 1;
      const id = `${Date.now()}-${counter}`;
      setToasts((items) => [...items.slice(-3), { id, title, description, tone, href }]);
      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  const value = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="region" aria-label="Notifications" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.tone === "error" ? "error" : ""}`}>
            <div style={{ flex: "none", marginTop: 1 }}>
              {toast.tone === "error" ? (
                <AlertTriangle size={16} color="var(--danger)" />
              ) : toast.tone === "info" ? (
                <Info size={16} color="var(--info)" />
              ) : (
                <CheckCircle2 size={16} color="var(--brand-2)" />
              )}
            </div>
            <div className="grow">
              <div className="toast-title">{toast.title}</div>
              {toast.description ? (
                <div className="toast-desc">
                  {toast.href ? (
                    <a href={toast.href} target="_blank" rel="noreferrer">
                      {toast.description}
                    </a>
                  ) : (
                    toast.description
                  )}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              style={{ flex: "none", padding: 0, width: 22, height: 22 }}
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
