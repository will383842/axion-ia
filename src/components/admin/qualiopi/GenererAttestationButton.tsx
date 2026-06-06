"use client";
// use-client: état interactif local (résultat + erreur) + useTransition pour la server action genererAttestationAction.
/**
 * GenererAttestationButton — Bouton de génération d'attestation d'un stagiaire.
 *
 * Déclenche `genererAttestationAction` et affiche le résultat :
 * complète / partielle / aucune. Propose un bouton « Forcer la regénération »
 * si une attestation existe déjà.
 *
 * "use client" : appel Server Action + feedback interactif.
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// Types props
// ─────────────────────────────────────────────────────────────────────────────

type AttestationResultat = "complete" | "partielle" | "aucune";

export interface GenererAttestationButtonProps {
  enrollmentId: string;
  /** True si une attestation a déjà été générée (affiche le bouton "Forcer"). */
  dejaGeneree: boolean;
  /** Server Action AGENT B. */
  genererAction: (input: {
    enrollmentId: string;
    force?: boolean;
  }) => Promise<
    { data: { resultat: AttestationResultat; documentId: string | null } } | { error: string }
  >;
}

// ─────────────────────────────────────────────────────────────────────────────
// Libellés
// ─────────────────────────────────────────────────────────────────────────────

const RESULTAT_LABELS: Record<AttestationResultat, string> = {
  complete: "Attestation complète générée",
  partielle: "Attestation partielle générée",
  aucune: "Taux de présence insuffisant — aucune attestation",
};

function resultatCouleur(resultat: AttestationResultat): string {
  if (resultat === "complete") return "text-[color:var(--color-admin-success)]";
  if (resultat === "partielle") return "text-[color:var(--color-admin-warning)]";
  return "text-[color:var(--color-admin-error)]";
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────────────────────────────────────

export function GenererAttestationButton({
  enrollmentId,
  dejaGeneree,
  genererAction,
}: GenererAttestationButtonProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [resultat, setResultat] = useState<AttestationResultat | null>(null);

  function handleGenerer(force = false) {
    setError(null);
    setResultat(null);

    startTransition(async () => {
      const result = await genererAction({
        enrollmentId,
        ...(force ? { force: true } : {}),
      });
      if ("error" in result) {
        setError(result.error);
      } else {
        setResultat(result.data.resultat);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-[var(--space-admin-2)]">
      {/* Bouton principal */}
      {!dejaGeneree && (
        <button
          type="button"
          onClick={() => handleGenerer(false)}
          disabled={isPending}
          className="admin-button"
        >
          {isPending ? "Génération…" : "Générer l'attestation"}
        </button>
      )}

      {/* Bouton forcer si déjà générée */}
      {dejaGeneree && (
        <button
          type="button"
          onClick={() => handleGenerer(true)}
          disabled={isPending}
          className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] hover:border-[color:var(--color-admin-accent)] hover:text-[color:var(--color-admin-accent)] disabled:opacity-50"
        >
          {isPending ? "Génération…" : "Regénérer (forcer)"}
        </button>
      )}

      {/* Résultat */}
      {resultat !== null && (
        <p
          role="status"
          className={`text-[length:var(--text-admin-xs)] ${resultatCouleur(resultat)}`}
        >
          {RESULTAT_LABELS[resultat]}
        </p>
      )}

      {/* Erreur */}
      {error !== null && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          Erreur : {error}
        </p>
      )}
    </div>
  );
}
