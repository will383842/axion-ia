"use client";
// use-client: bouton interactif déclenchant une server action via useTransition.
/**
 * GenererCreneauxButton — Bouton pour générer les créneaux de présence d'une session.
 *
 * Appelle `generateSessionCreneauxAction` puis rafraîchit la page.
 * "use client" : interactivité + Server Action.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export interface GenererCreneauxButtonProps {
  sessionId: string;
  genererAction: (input: {
    sessionId: string;
    heuresParJour?: number;
    confirmerSansJournees?: boolean;
  }) => Promise<
    | { data: { created: number; reconcilies: number; horsPlan: number } }
    | { error: string; confirmable?: boolean }
  >;
  hasCreneaux: boolean;
}

export function GenererCreneauxButton({
  sessionId,
  genererAction,
  hasCreneaux,
}: GenererCreneauxButtonProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmable, setConfirmable] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    reconcilies: number;
    horsPlan: number;
  } | null>(null);

  function handleClick(confirmerSansJournees = false) {
    setError(null);
    setConfirmable(false);
    setResult(null);
    startTransition(async () => {
      const r = await genererAction({
        sessionId,
        ...(confirmerSansJournees ? { confirmerSansJournees } : {}),
      });
      if ("error" in r) {
        setError(r.error);
        // Refus levable (garde-fou D14) : on propose de confirmer, sans jamais
        // le faire à la place de l'admin.
        setConfirmable(r.confirmable === true);
      } else {
        setResult(r.data);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-[var(--space-admin-2)]">
      <div className="flex items-center gap-[var(--space-admin-3)]">
        <button
          type="button"
          onClick={() => handleClick()}
          disabled={isPending}
          className="admin-button"
        >
          {isPending
            ? "Génération..."
            : hasCreneaux
              ? "Régénérer les créneaux"
              : "Générer les créneaux"}
        </button>
        {hasCreneaux && (
          <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            (idempotent — les créneaux existants ne seront pas dupliqués)
          </span>
        )}
      </div>
      {error && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          Erreur : {error}
        </p>
      )}
      {confirmable && !isPending && (
        <button
          type="button"
          onClick={() => handleClick(true)}
          className="admin-button-ghost self-start"
        >
          Générer quand même (session réellement continue)
        </button>
      )}
      {result && (
        <p
          role="status"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          {result.created} créneau(x) créé{result.created > 1 ? "s" : ""}
          {result.reconcilies > 0 &&
            `, ${result.reconcilies} durée${result.reconcilies > 1 ? "s" : ""} corrigée${result.reconcilies > 1 ? "s" : ""}`}
          .
          {result.horsPlan > 0 && (
            <>
              {" "}
              <strong>
                {result.horsPlan} créneau(x) ne correspondent à aucune journée déclarée.
              </strong>{" "}
              Ils comptent encore dans le taux de présence. Ils ne sont pas supprimés
              automatiquement : l&apos;un d&apos;eux peut porter une signature, et rien ne distingue
              en base une absence émargée d&apos;un créneau vierge.
            </>
          )}
        </p>
      )}
    </div>
  );
}
