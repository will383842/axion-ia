"use client";
// use-client: copie dans le presse-papiers (état local, Server Action)

// Fiche d'un apporteur résilié : copier le lien d'accès à ses pièces (PR K, 2464).
// Aucun e-mail n'est envoyé.

import { useState, useTransition } from "react";

import { lienArchiveAction } from "@/features/apporteurs-reseau/actions-apporteurs";

export function LienArchive({ apporteurId }: { apporteurId: string }) {
  const [enCours, demarrer] = useTransition();
  const [retour, setRetour] = useState<{ ok: boolean; message: string } | null>(null);
  return (
    <div className="flex flex-col gap-[var(--space-admin-2)]">
      <div>
        <button
          type="button"
          className="admin-button-secondary"
          disabled={enCours}
          onClick={() =>
            demarrer(async () => {
              const r = await lienArchiveAction({ apporteurId });
              if (!r.ok) return setRetour(r);
              try {
                await navigator.clipboard.writeText(r.message);
                setRetour({ ok: true, message: "Lien copié. Aucun e-mail n'a été envoyé." });
              } catch {
                setRetour({ ok: false, message: "Copie impossible : copiez le lien à la main." });
              }
            })
          }
        >
          Copier le lien d&apos;accès aux pièces
        </button>
      </div>
      {retour ? (
        <p role={retour.ok ? "status" : "alert"} className="text-[length:var(--text-admin-sm)]">
          {retour.message}
        </p>
      ) : null}
    </div>
  );
}
