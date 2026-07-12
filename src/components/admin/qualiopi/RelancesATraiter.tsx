"use client";
// use-client: boutons d'action Envoyer/Ignorer/Reporter (useTransition + router.refresh)

/**
 * Hub facturation — liste des relances PROPOSÉES à traiter (Phase 4).
 *
 * Chaque relance s'envoie (email manuel avec PDF joint — factures CRM),
 * s'ignore ou se reporte de 7 jours. RIEN ne part sans clic : c'est l'écran
 * qui matérialise la règle « relances 100 % manuelles ».
 * "use client" justifié : boutons d'action (useTransition + refresh).
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  envoyerRelanceAction,
  traiterRelanceAction,
} from "@/server/actions/qualiopi/facturation-hub";

export interface RelanceItem {
  id: string;
  libelle: string;
  palier: string;
  suggestion: string | null;
  /** true = facture CRM (envoi direct possible) ; false = document booking. */
  envoiDirect: boolean;
}

export function RelancesATraiter({ relances }: { relances: ReadonlyArray<RelanceItem> }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  if (relances.length === 0) return null;

  const traiter = (relanceId: string, action: "ignorer" | "reporter") => {
    setErreur(null);
    startTransition(async () => {
      const res = await traiterRelanceAction({ relanceId, action });
      if ("error" in res) setErreur(res.error);
      else router.refresh();
    });
  };

  const envoyer = (relanceId: string) => {
    setErreur(null);
    startTransition(async () => {
      const res = await envoyerRelanceAction({ relanceId });
      if ("error" in res) setErreur(res.error);
      else router.refresh();
    });
  };

  return (
    <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-4)]">
      <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
        Relances à traiter ({relances.length}) — rien ne part sans votre clic
      </p>
      {erreur !== null && (
        <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-danger,inherit)]">
          {erreur}
        </p>
      )}
      <ul className="space-y-[var(--space-admin-3)]">
        {relances.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center gap-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]"
          >
            <span className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] uppercase">
              {r.palier}
            </span>
            <span className="flex-1">{r.suggestion ?? r.libelle}</span>
            {r.envoiDirect ? (
              <button
                type="button"
                className="admin-button"
                disabled={isPending}
                onClick={() => envoyer(r.id)}
              >
                Envoyer la relance
              </button>
            ) : null}
            <button
              type="button"
              className="admin-button"
              disabled={isPending}
              onClick={() => traiter(r.id, "reporter")}
            >
              Reporter 7 j
            </button>
            <button
              type="button"
              className="admin-button"
              disabled={isPending}
              onClick={() => traiter(r.id, "ignorer")}
            >
              Ignorer
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
