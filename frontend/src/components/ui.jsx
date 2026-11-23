import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  Copy,
  Inbox,
  Loader2,
  X,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { useToast } from "../context/ToastContext";
import { shortAddress } from "../lib/format";

export function Button({
  variant = "secondary",
  size,
  loading = false,
  icon,
  children,
  className = "",
  ...props
}) {
  const classes = ["btn", `btn-${variant}`, size ? `btn-${size}` : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={classes} {...props} disabled={props.disabled || loading}>
      {loading ? <Loader2 size={15} className="spin" /> : icon}
      {children}
    </button>
  );
}

export function Card({ className = "", children, ...props }) {
  return (
    <div className={`card ${className}`} {...props}>
      {children}
    </div>
  );
}

export function Badge({ tone = "gray", dot = false, children }) {
  return (
    <span className={`badge badge-${tone}`}>
      {dot ? <span className="badge-dot" /> : null}
      {children}
    </span>
  );
}

export function Field({ label, hint, error, children }) {
  return (
    <label className="field">
      {label ? <span>{label}</span> : null}
      {children}
      {error ? (
        <span className="hint" style={{ color: "var(--danger)" }}>
          {error}
        </span>
      ) : hint ? (
        <span className="hint">{hint}</span>
      ) : null}
    </label>
  );
}

export function Modal({ open, onClose, title, subtitle, children, footer, large = false }) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${large ? "modal-lg" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal-head">
          <div className="grow">
            <h3 id={titleId}>{title}</h3>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}

export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon || <Inbox size={20} />}</div>
      <h4>{title}</h4>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}

export function Spinner({ dark = false }) {
  return <span className={`spinner ${dark ? "spinner-dark" : ""}`} aria-label="Loading" />;
}

export function Skeleton({ height = 16, width = "100%", style }) {
  return (
    <div className="skeleton" style={{ height, width, ...style }} aria-hidden="true" />
  );
}

export function Tabs({ value, onChange, options }) {
  return (
    <div className="tabs" role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          className={`tab ${value === option.value ? "active" : ""}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.count !== undefined ? ` (${option.count})` : ""}
        </button>
      ))}
    </div>
  );
}

export function Progress({ value, lime = false }) {
  return (
    <div className={`progress ${lime ? "progress-lime" : ""}`}>
      <div style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function StatCard({ label, value, unit, icon, foot }) {
  return (
    <Card className="stat">
      <div className="stat-top">
        {icon ? <span className="stat-icon">{icon}</span> : null}
        {label}
      </div>
      <div className="stat-value">
        {value}
        {unit ? <small>{unit}</small> : null}
      </div>
      {foot ? <div className="stat-foot">{foot}</div> : null}
    </Card>
  );
}

export function AddressChip({ address, chars = 4, label }) {
  const { push } = useToast();
  const [copied, setCopied] = useState(false);

  const copy = async (event) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      push({ title: "Could not copy", description: address, tone: "error" });
    }
  };

  return (
    <button
      type="button"
      className="address-chip"
      onClick={copy}
      title={`Copy ${address}`}
      aria-label={`Copy address ${address}`}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {label || shortAddress(address, chars)}
    </button>
  );
}

export function CopyButton({ text, label = "Copy" }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost btn-xs"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          /* ignore */
        }
      }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copied" : label}
    </button>
  );
}

export function RoleNote({ children, warn = false, icon }) {
  return (
    <div className={`role-note ${warn ? "warn-note" : ""}`}>
      {icon || <AlertTriangle size={15} />}
      <div>{children}</div>
    </div>
  );
}

export function QueryError({ error }) {
  return (
    <RoleNote warn icon={<AlertTriangle size={15} />}>
      <strong>Could not load on-chain data.</strong>{" "}
      {error?.shortMessage || error?.message || "Check your RPC connection and try again."}
    </RoleNote>
  );
}

