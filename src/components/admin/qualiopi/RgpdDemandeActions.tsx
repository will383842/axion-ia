"use client";
// use-client: bouton interactif (traiter une demande RGPD) via useTransition + Server Action. Affiche l'export JSON le cas échéant.

/**
 * RgpdDemandeActions — Bouton « Traiter » pour une demande RGPD en attente.
 *
 * - type=export      → l'action renvoie le JSON des données ; on propose un téléchargement.
 * - type=suppression → l'action anonymise le stagiaire (soft-delete) ; on affiche un statut.
 *
 * "use client" : useTransition + appel Server Action.
 * Zéro appel DB côté client — toute mutation passe par la Server Action.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { traiterDemandeRgpdAction } from "@/server/actions/qualiopi/appreciations";

export interface RgpdDemandeActionsProps {
  demandeId: string;
  type: "export" | "suppression";
  traiterAction: typeof traiterDemandeRgpdAction;
}

export function RgpdDemandeActions({
  demandeId,
  type,
  traiterAction,
}: RgpdDemandeActionsProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function handleTraiter() {
    setError(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const result = await traiterAction({ demandeId });
      if ("error" in result) {
        setError(result.error);
        return;
      }

      if (result.data.type === "export" && result.data.exportData !== undefined) {
        // Téléchargement du JSON export RGPD côté client (jamais persisté serveur).
        try {
          const blob = new Blob([JSON.stringify(result.data.exportData, null, 2)], {
            type: "application/json",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `export-rgpd-${demandeId}.json`;
          a.click();
          URL.revokeObjectURL(url);
        } catch {
          // Le téléchargement est best-effort ; la demande reste traitée côté serveur.
        }
        setSuccessMsg("Export généré et téléchargé.");
      } else {
        setSuccessMsg("Suppression (anonymisation) effectuée.");
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start gap-[var(--space-admin-2)]">
      <button
        type="button"
        onClick={handleTraiter}
        disabled={isPending}
        className={
          type === "suppression"
            ? "rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-error)] px-[var(--space-admin-3)] py-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-error)] transition-opacity hover:opacity-80 disabled:opacity-50"
            : "rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-accent)] px-[var(--space-admin-3)] py-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-accent)] transition-opacity hover:opacity-80 disabled:opacity-50"
        }
      >
        {isPending
          ? "Traitement…"
          : type === "export"
            ? "Traiter (export)"
            : "Traiter (suppression)"}
      </button>
      {error && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
      {successMsg && (
        <p
          role="status"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-success)]"
        >
          {successMsg}
        </p>
      )}
    </div>
  );
}
