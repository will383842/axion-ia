"use client";
// use-client: beforeunload listener + DOM event handling.
//
// Refonte admin mai 2026 — PR 12 polish UX (ADR 0028, master prompt §3.7).
//
// Avertit l'utilisateur avant de quitter la page si un formulaire long
// est dirty (Tiptap, multi-fields). Additive : aucun warning si dirty=false.

import { useEffect } from "react";

interface Props {
  /** Le formulaire est dirty (modifications non sauvegardées). */
  dirty: boolean;
  /** Message custom (fallback navigateur souvent ignoré, géré par UA). */
  message?: string;
}

export function AdminFormDirtyGuard({ dirty, message }: Props): null {
  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      // Chrome/Edge requièrent returnValue, Firefox + Safari l'ignorent.
      e.returnValue = message ?? "";
      return message ?? "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, message]);
  return null;
}
