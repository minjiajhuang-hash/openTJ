"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";

export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {title ? (
        <div className="panel-header">
          <h2 className="panel-title">{title}</h2>
          {action}
        </div>
      ) : null}
      <div className="panel-body">{children}</div>
    </section>
  );
}

export function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: "blue" | "success" | "warning" | "danger";
}) {
  return <span className={`badge${tone ? ` badge-${tone}` : ""}`}>{children}</span>;
}

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const focusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]') ?? []);
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key === "Tab") {
        const targets = focusable(); const first = targets[0]; const last = targets.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div aria-labelledby={titleId} aria-modal="true" className="dialog" ref={dialogRef} role="dialog">
        <div className="dialog-header">
          <h2 id={titleId}>{title}</h2>
          <button aria-label="Close dialog" className="header-button" onClick={onClose} style={{ color: "var(--text)" }} type="button">
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="dialog-body">{children}</div>
      </div>
    </div>
  );
}

export function AsyncForm({ children, onSubmit, label = "Save", onCancel }: { children: ReactNode; onSubmit(form: FormData): Promise<void>; label?: string; onCancel?: () => void }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const pending = useRef(false);
  return <form className="stack" onSubmit={async (event) => { event.preventDefault(); if (pending.current) return; const form = new FormData(event.currentTarget); pending.current = true; setBusy(true); setError(null); try { await onSubmit(form); } catch (err) { setError(err instanceof Error ? err.message : "The request failed."); } finally { pending.current = false; setBusy(false); } }}>
    <fieldset className="form-fields stack" disabled={busy}>{children}</fieldset>
    {error ? <p className="notice notice-warning" role="alert">{error}</p> : null}
    <div className="dialog-actions">{onCancel ? <button className="button" onClick={onCancel} type="button">Cancel</button> : null}<button className="button button-primary" disabled={busy} type="submit">{busy ? "Saving…" : label}</button></div>
  </form>;
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div aria-live="polite" className="toast" role="status">
      {message}
    </div>
  );
}
