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
  transformDevisToConventionAction,
} from "@/server/actions/qualiopi/devis";
import { envoyerDevisEmailAction } from "@/server/actions/qualiopi/facturation-emails";

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
  // Avertissement : action réussie côté statut, mais l'email n'est PAS parti
  // (pas d'email de contact, PDF absent, file d'attente indisponible). À NE PAS
  // afficher en vert « succès » — sinon l'admin croit le devis reçu par le client.
  const [warningMsg, setWarningMsg] = useState<string | null>(null);

  function resetMessages() {
    setError(null);
    setSuccessMsg(null);
    setWarningMsg(null);
  }

  function handleSend() {
    resetMessages();
    startTransition(async () => {
      const result = await sendDevisAction(devisId);
      if ("error" in result) {
        setError(result.error);
      } else {
        if (result.data.emailEnvoye && result.data.signatureCreee) {
          setSuccessMsg("Devis envoyé au client par email (PDF joint + lien de signature).");
        } else if (result.data.emailEnvoye) {
          // 🔴 F4 : ce message vert annonçait un « lien de signature » qui
          // n'existait dans AUCUN des envois réels. Ne jamais promettre en vert
          // ce que l'action n'a pas produit — l'admin doit savoir qu'il faut
          // relancer autrement (PDF signé retourné, ou révision du devis).
          setWarningMsg(
            result.data.note ??
              "Devis envoyé par email (PDF joint), mais SANS lien de signature électronique.",
          );
        } else {
          // Statut passé à « envoyé », mais le client n'a rien reçu → avertissement.
          setWarningMsg(
            result.data.note ??
              "Devis marqué comme envoyé, mais aucun email n'a été expédié au client.",
          );
        }
        router.refresh();
      }
    });
  }

  function handleResend() {
    resetMessages();
    startTransition(async () => {
      const result = await envoyerDevisEmailAction({ devisId });
      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccessMsg(`Devis renvoyé par email à ${result.data.to}.`);
        router.refresh();
      }
    });
  }

  function handleAccept() {
    resetMessages();
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
    resetMessages();
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

  function handleTransform() {
    resetMessages();
    startTransition(async () => {
      const result = await transformDevisToConventionAction(devisId);
      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccessMsg("Devis transformé en convention — créez la session liée.");
        router.refresh();
      }
    });
  }

  // Statuts terminaux : aucune action disponible (sauf accepté → transformer)
  if (statut !== "brouillon" && statut !== "envoye" && statut !== "accepte") {
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

        {(statut === "envoye" || statut === "accepte") && (
          <button
            type="button"
            onClick={handleResend}
            disabled={isPending}
            className="admin-button"
            aria-label="Renvoyer le devis au client par email (PDF joint)"
          >
            {isPending ? "…" : "Renvoyer par email"}
          </button>
        )}

        {statut === "accepte" && (
          <button
            type="button"
            onClick={handleTransform}
            disabled={isPending}
            className="admin-button"
            aria-label="Transformer le devis accepté en convention"
          >
            {isPending ? "…" : "Transformer en convention"}
          </button>
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
      {warningMsg && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-warning)]"
        >
          {warningMsg}
        </p>
      )}
    </div>
  );
}
