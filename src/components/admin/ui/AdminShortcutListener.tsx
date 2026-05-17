"use client";
// use-client: window keydown listener + native event handling.
//
// Refonte admin mai 2026 — PR 12 polish UX (ADR 0028, master prompt §3.5).
//
// Écoute les raccourcis clavier admin (Cmd/Ctrl+S, ESC, J/K) et dispatche
// vers des callbacks fournis par le consumer. Additive : aucune action
// par défaut si pas de callback wired.

import { useEffect } from "react";

export interface AdminShortcut {
  /** Combo affiché aux utilisateurs ("⌘+S", "ESC", "J"). */
  combo: string;
  /** Modifier Ctrl/Cmd requis. */
  meta?: boolean;
  /** Modifier Shift. */
  shift?: boolean;
  /** Code clavier (KeyboardEvent.code ex: "KeyS", "Escape", "KeyJ"). */
  code: string;
  /** Callback à exécuter. preventDefault automatique. */
  handler: () => void;
  /** Désactive le shortcut si focus dans un champ texte (default true). */
  ignoreInInput?: boolean;
}

interface Props {
  shortcuts: ReadonlyArray<AdminShortcut>;
}

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    (el as HTMLElement).isContentEditable
  );
}

export function AdminShortcutListener({ shortcuts }: Props): null {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      for (const sc of shortcuts) {
        const ignore = sc.ignoreInInput !== false;
        if (ignore && isInputFocused()) continue;
        if (sc.meta && !(e.ctrlKey || e.metaKey)) continue;
        if (!sc.meta && (e.ctrlKey || e.metaKey)) continue;
        if (sc.shift && !e.shiftKey) continue;
        if (!sc.shift && e.shiftKey) continue;
        if (e.code !== sc.code) continue;
        e.preventDefault();
        sc.handler();
        return;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shortcuts]);
  return null;
}
