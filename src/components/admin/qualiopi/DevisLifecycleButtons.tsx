"use client";
// use-client: boutons conditionnels de cycle de vie d'un devis (sendDevisAction / acceptDevisAction / declineDevisAction) selon le statut courant. useTransition + router.refresh().

/**
 * DevisLifecycleButtons — Boutons du cycle de vie d&apos;un devis commercial.
 *
 * Affichage conditionnel selon le statut :
 *   - brouillon : « Envoyer au client » → sendDevisAction.
 *   - envoye    : « Marquer accepté » → acceptDevisAction
 *                 « Marquer refusé »  → declineDevisAction.
 *   - autres    : aucun bouton (terminal).
 *
 * router.refresh() après chaque succès.
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  sendDevisAction,
  acceptDevisAction,
  declineDevisAction,
} from "@/server/actions/qualiopi/devis";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type DevisStatut =
  | "brouillon"
  | "envoye"
  | "accepte"
  | "refuse"
  | "expire"
  | "transforme_convention";

export interface DevisLifecycleButtonsProps {
  devisId: string;
  statut: DevisStatut;
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────────────────────────────────────

export function DevisLifecycleButtons({
  devisId,
  statut,
}: DevisLifecycleButtonsProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function handleSend() {
    setError(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const result = await sendDevisAction(devisId);
      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccessMsg("Devis marqué comme envoyé.");
        router.refresh();
      }
    });
  }

  function handleAccept() {
    setError(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const result = await acceptDevisAction(devisId);
      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccessMsg("Devis accepté.");
        router.refresh();
      }
    });
  }

  function handleDecline() {
    setError(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const result = await declineDevisAction(devisId);
      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccessMsg("Devis refusé.");
        router.refresh();
      }
    });
  }

  // Statuts terminaux : aucune action disponible
  if (statut !== "brouillon" && statut !== "envoye") {
    return (
      <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        Aucune action disponible pour ce statut.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-[var(--space-admin-3)]">
      <div className="flex flex-wrap gap-[var(--space-admin-3)]">
        {statut === "brouillon" && (
          <button
            type="button"
            onClick={handleSend}
            disabled={isPending}
            className="admin-button"
            aria-label="Marquer le devis comme envoyé au client"
          >
            {isPending ? "…" : "Envoyer au client"}
          </button>
        )}

        {statut === "envoye" && (
          <>
            <button
              type="button"
              onClick={handleAccept}
              disabled={isPending}
              className="admin-button"
              aria-label="Marquer le devis comme accepté"
            >
              {isPending ? "…" : "Marquer accepté"}
            </button>
            <button
              type="button"
              onClick={handleDecline}
              disabled={isPending}
              className="admin-button-danger"
              aria-label="Marquer le devis comme refusé"
            >
              {isPending ? "…" : "Marquer refusé"}
            </button>
          </>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}
      {successMsg && (
        <p
          role="status"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          {successMsg}
        </p>
      )}
    </div>
  );
}
