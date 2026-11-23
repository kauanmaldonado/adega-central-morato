"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/Icon";
import styles from "./store.module.css";

/**
 * Painel que sobe de baixo (bottom sheet) com comportamento de diálogo
 * acessível: foco preso dentro, Esc fecha, fundo bloqueado.
 */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  hideHeader = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  hideHeader?: boolean;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => {
      panel.current?.querySelector<HTMLElement>("button, a[href], input, select, textarea")?.focus();
    }, 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panel.current) {
        const items = panel.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        const first = items[0];
        const last = items[items.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
      lastFocus.current?.focus?.();
    };
  }, [open, onClose]);

  return (
    <>
      <div className={open ? styles.backdropOn : styles.backdrop} onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        className={open ? styles.sheetOn : styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-hidden={!open}
        inert={!open}
      >
        <span className={styles.grabber} aria-hidden="true" />
        {!hideHeader && (
          <div className={styles.sheetHead}>
            <div>
              <h2 className="serif" style={{ fontSize: 32, lineHeight: 1, margin: 0 }}>{title}</h2>
              {subtitle && <span className="muted" style={{ fontSize: 13 }}>{subtitle}</span>}
            </div>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
              <Icon name="x" size={18} stroke={2.2} />
            </button>
          </div>
        )}
        <div className={styles.sheetScroll}>{children}</div>
      </div>
    </>
  );
}
