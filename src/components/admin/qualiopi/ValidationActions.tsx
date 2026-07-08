"use client";
// use-client: état interactif local (consigne de rejet + feedback) + useTransition
// pour les server actions approveFileValidationAction / rejectFileValidationAction.
/**
 * ValidationActions — Boutons Approuver / Rejeter d'une FileValidation en attente.
 *
 * Câble le point de contrôle humain obligatoire (AI Act art. 50 — ADR 0024) qui fait
 * avancer la machine à états `statutGeneration` du Formation Engine :
 *   - Approuver → approveFileValidationAction → `resolveNextStatutAfterApproval`
 *     (contenu → contenu_valide, assemblage → publie, structure → contenu_evalue) ;
 *   - Rejeter (avec consigne de correction ≥ 10 car.) → rejectFileValidationAction
 *     → rétrograde le statut pour re-génération.
 *
 * Sans ce composant, une formation arrivée à `contenu_genere` reste bloquée : aucune
 * autre action console ne résout la FileValidation en_attente.
 *
 * "use client" : appel Server Action + feedback interactif. Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// Types (calqués sur les signatures des server actions engine)
// ─────────────────────────────────────────────────────────────────────────────

export type EtapeValidation = "structure" | "contenu" | "assemblage";

export interface ValidationActionsProps {
  /** id de la FileValidation en_attente. */
  id: string;
  /** Étape (vérification croisée côté action). */
  etape: EtapeValidation;
  /** Server Action — approuve + fait avancer statutGeneration. */
  approuverAction: (input: {
    id: string;
    etape?: EtapeValidation;
  }) => Promise<
    { data: { fileValidationId: string; statutGeneration: string } } | { error: string }
  >;
  /** Server Action — rejette avec consigne de correction (≥ 10 car.). */
  rejeterAction: (input: {
    id: string;
    consigne: string;
  }) => Promise<
    { data: { fileValidationId: string; statutGeneration: string } } | { error: string }
  >;
}

const CONSIGNE_MIN = 10;

// ─────────────────────────────────────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────────────────────────────────────

export function ValidationActions({
  id,
  etape,
  approuverAction,
  rejeterAction,
}: ValidationActionsProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [modeRejet, setModeRejet] = useState(false);
  const [consigne, setConsigne] = useState("");

  function clearFeedback() {
    setError(null);
    setSucces(null);
  }

  function handleApprouver() {
    clearFeedback();
    startTransition(async () => {
      const result = await approuverAction({ id, etape });
      if ("error" in result) {
        setError(result.error);
      } else {
        setSucces(`Approuvé — statut : ${result.data.statutGeneration}.`);
        router.refresh();
      }
    });
  }

  function handleRejeter() {
    clearFeedback();
    if (consigne.trim().length < CONSIGNE_MIN) {
      setError(`La consigne de correction doit faire au moins ${CONSIGNE_MIN} caractères.`);
      return;
    }
    startTransition(async () => {
      const result = await rejeterAction({ id, consigne: consigne.trim() });
      if ("error" in result) {
        setError(result.error);
      } else {
        setSucces(`Rejeté — retour en correction (statut : ${result.data.statutGeneration}).`);
        setModeRejet(false);
        setConsigne("");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col items-stretch gap-[var(--space-admin-2)]">
      {!modeRejet ? (
        <div className="flex gap-[var(--space-admin-2)]">
          <button
            type="button"
            onClick={handleApprouver}
            disabled={isPending}
            className="admin-button"
          >
            {isPending ? "…" : "Approuver"}
          </button>
          <button
            type="button"
            onClick={() => {
              clearFeedback();
              setModeRejet(true);
            }}
            disabled={isPending}
            className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)] hover:border-[color:var(--color-admin-error)] disabled:opacity-50"
          >
            Rejeter
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-[var(--space-admin-2)]">
          <label className="flex flex-col gap-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            Consigne de correction (transmise au moteur pour re-génération)
            <textarea
              value={consigne}
              onChange={(e) => setConsigne(e.target.value)}
              disabled={isPending}
              rows={3}
              placeholder="Ex. : renforcer les exercices pratiques du module 2, ajouter un corrigé détaillé…"
              className="w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg)]"
            />
          </label>
          <div className="flex gap-[var(--space-admin-2)]">
            <button
              type="button"
              onClick={handleRejeter}
              disabled={isPending}
              className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-error)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-error)] disabled:opacity-50"
            >
              {isPending ? "…" : "Confirmer le rejet"}
            </button>
            <button
              type="button"
              onClick={() => {
                setModeRejet(false);
                setConsigne("");
                clearFeedback();
              }}
              disabled={isPending}
              className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] disabled:opacity-50"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {succes !== null && (
        <p
          role="status"
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-success)]"
        >
          {succes}
        </p>
      )}
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
