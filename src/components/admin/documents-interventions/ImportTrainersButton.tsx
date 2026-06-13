"use client";

// Bouton « Importer les formateurs » : pré-remplit l'annuaire de notification
// avec les formateurs actifs des fiches Qualiopi (dédoublonné). Évite la
// double saisie.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importTrainersAction } from "@/server/actions/intervention-documents/recipients.actions";

export function ImportTrainersButton(): React.ReactElement {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    setMsg(null);
    startTransition(async () => {
      const res = await importTrainersAction();
      if (!res.ok) {
        setMsg(res.error ?? "Erreur lors de l'import.");
        return;
      }
      setMsg(`${res.imported ?? 0} formateur(s) importé(s) · ${res.skipped ?? 0} déjà présent(s).`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="border-terracotta text-terracotta hover:bg-terracotta-soft rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
      >
        {pending ? "Import en cours…" : "⬇ Importer les formateurs (fiches Qualiopi)"}
      </button>
      {msg ? <span className="text-fg-muted text-xs">{msg}</span> : null}
    </div>
  );
}
