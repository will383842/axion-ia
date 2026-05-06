"use client";
// use-client: trap-focus drawer + Escape key + open/close state. Server
// rendering of nav links is handled by the parent <Header>; this client
// component only manages the drawer UI and key handling.

import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";

interface MobileNavProps {
  children: React.ReactNode;
}

export function MobileNav({ children }: MobileNavProps) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    // Move focus into dialog
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      // Restore focus to trigger (captured at effect start)
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="mobile-nav-dialog"
        aria-label={t("openMenu")}
        className="text-fg hover:bg-border/50 inline-flex h-11 w-11 items-center justify-center rounded-sm lg:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      {open ? (
        <div
          id="mobile-nav-dialog"
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={t("openMenu")}
          tabIndex={-1}
          className="bg-bg fixed inset-0 z-50 flex flex-col overflow-y-auto outline-none"
        >
          <div className="border-border flex h-16 items-center justify-between border-b px-4">
            <span className="text-fg text-sm font-semibold tracking-tight">AxionIA</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("closeMenu")}
              className="text-fg hover:bg-border/50 inline-flex h-11 w-11 items-center justify-center rounded-sm"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div className="flex-1 px-4 py-6">{children}</div>
        </div>
      ) : null}
    </>
  );
}
