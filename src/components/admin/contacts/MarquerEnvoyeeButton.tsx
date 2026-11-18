"use client";
// use-client: bouton interactif « Marquer comme envoyée » (réponse « issue inconnue » retrouvée
// dans ZeptoMail). Les actions serveur sont importées AU CLIC (import dynamique) : ni le graphe
// des écrans parents (`next-auth`), ni le premier chargement de la page n'en portent le poids.

import { useState, useTransition } from "react";
import type { GabaritReponse } from "@/lib/email/reponse-manuelle-etat";

export const TEXTE_CONFIRMATION_MARQUAGE =
  "Vous avez trouvé cet e-mail dans ZeptoMail (page E-mails envoyés, bouton ZeptoMail, onglet Processed emails) ? La réponse sera notée envoyée et ne pourra plus être renvoyée.";
const TEXTE_ETAT_CHANGE = "Cette réponse a changé d'état entre-temps : rechargez la page.";

interface Props {
  readonly replyId: string;
  readonly gabarit: GabaritReponse;
  /** Appelé une fois la réponse notée envoyée (le composeur de candidature s'en sert). */
  readonly onDone?: () => void;
}

export function MarquerEnvoyeeButton({ replyId, gabarit, onDone }: Props): React.ReactElement {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="mt-3 inline-block">
      <button
        type="button"
        disabled={isPending || done}
        className="admin-button-ghost"
        onClick={() => {
          if (!window.confirm(TEXTE_CONFIRMATION_MARQUAGE)) return;
          startTransition(async () => {
            const r =
              gabarit === "submission-reply"
                ? await (
                    await import("@/features/admin-submissions/reply-actions")
                  ).marquerReponseEnvoyeeAction(replyId)
                : await (
                    await import("@/features/admin-job-applications/reply-actions")
                  ).marquerReponseCandidatureEnvoyeeAction(replyId);
            if (r.ok) {
              setDone(true);
              setError(null);
              onDone?.();
            } else {
              setError(r.error === "etat_change" ? TEXTE_ETAT_CHANGE : (r.error ?? "echec"));
            }
          });
        }}
      >
        Marquer comme envoyée
      </button>
      {done && (
        <p role="status" className="mt-1 text-xs">
          Réponse notée comme envoyée.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-1 text-xs text-[color:var(--color-admin-danger-fg)]">
          {error}
        </p>
      )}
    </span>
  );
}
