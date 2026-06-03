// Sauvegardes & DR (ADR 0032) — bouton manuel "lancer un drill maintenant".
// Client component minimal (useTransition). L'action serveur est write-gardée.
"use client";
// use-client: bouton interactif (onClick + useTransition + état local) déclenchant une server action.

import { useState, useTransition } from "react";
import { triggerRestoreDrill } from "@/server/actions/backups/trigger-drill";

export function TriggerDrillButton(): React.ReactElement {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function onClick() {
    setMsg(null);
    startTransition(async () => {
      try {
        const r = await triggerRestoreDrill();
        setMsg({ ok: r.ok, text: r.message });
      } catch {
        setMsg({ ok: false, text: "Action non autorisée." });
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-[var(--space-admin-3)]">
      <button type="button" onClick={onClick} disabled={pending} className="admin-link">
        {pending ? "Déclenchement…" : "↻ Lancer un drill maintenant"}
      </button>
      {msg && (
        <span className={`admin-meta admin-severity-${msg.ok ? "info" : "warning"}`}>
          {msg.text}
        </span>
      )}
    </span>
  );
}
