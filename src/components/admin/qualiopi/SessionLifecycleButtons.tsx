"use client";
// use-client: boutons de transition de statut d'une session (machine à états) + report. Appelle transitionSessionAction / reportSessionAction via useTransition. router.refresh() après succès.

/**
 * SessionLifecycleButtons — Boutons du cycle de vie d'une session de formation.
 *
 * Affiche uniquement les transitions autorisées depuis le statut courant
 * (SESSION_TRANSITIONS — machine à états), plus un bouton « Reporter » si le
 * statut le permet (planifiee | en_cours).
 *
 * Appelle :
 *   - transitionSessionAction  (sessions.ts)
 *   - reportSessionAction      (sessions-recurrentes.ts)
 *
 * router.refresh() après chaque succès.
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { transitionSessionAction } from "@/server/actions/qualiopi/sessions";
import { reportSessionAction } from "@/server/actions/qualiopi/sessions-recurrentes";
import { SESSION_TRANSITIONS } from "@/server/qualiopi/formations/state-machine";
import type { TrainingSessionStatut } from "../../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types props
// ─────────────────────────────────────────────────────────────────────────────

export interface SessionLifecycleButtonsProps {
  sessionId: string;
  /** Statut courant de la session — détermine les transitions disponibles. */
  statut: TrainingSessionStatut;
}

// ─────────────────────────────────────────────────────────────────────────────
// Libellés et libellés de transition
// ─────────────────────────────────────────────────────────────────────────────

const TRANSITION_LABELS: Record<TrainingSessionStatut, string> = {
  planifiee: "Planifier",
  en_cours: "Démarrer",
  realisee: "Marquer réalisée",
  annulee: "Annuler",
  reportee: "Reporter",
};

const TRANSITION_TONES: Record<TrainingSessionStatut, string> = {
  planifiee: "admin-button-secondary",
  en_cours: "admin-button",
  realisee: "admin-button",
  annulee: "admin-button-danger",
  reportee: "admin-button-secondary",
};

/** Statuts pour lesquels le bouton « Reporter » est disponible. */
const STATUTS_REPORTABLES: TrainingSessionStatut[] = ["planifiee", "en_cours"];

// ─────────────────────────────────────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────────────────────────────────────

export function SessionLifecycleButtons({
  sessionId,
  statut,
}: SessionLifecycleButtonsProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // État du panneau report
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportDateDebut, setReportDateDebut] = useState("");
  const [reportDateFin, setReportDateFin] = useState("");
  const [reportMotif, setReportMotif] = useState("");

  const transitions = SESSION_TRANSITIONS[statut] ?? [];
  const peutReporter = STATUTS_REPORTABLES.includes(statut);

  function handleTransition(toStatus: TrainingSessionStatut) {
    setError(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const result = await transitionSessionAction({ id: sessionId, toStatus });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSuccessMsg(`Session passée au statut « ${TRANSITION_LABELS[toStatus]} » avec succès.`);
      router.refresh();
    });
  }

  function handleReport() {
    if (!reportDateDebut || !reportDateFin || !reportMotif.trim()) {
      setError("Veuillez renseigner la nouvelle date de début, de fin et le motif du report.");
      return;
    }
    setError(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const result = await reportSessionAction({
        sessionId,
        nouvelleDateDebut: new Date(reportDateDebut),
        nouvelleDateFin: new Date(reportDateFin),
        motif: reportMotif.trim(),
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSuccessMsg(
        `Session reportée. Nouvelle session créée : ${result.data.nouvelleSessionNumero}.`,
      );
      setShowReportForm(false);
      setReportDateDebut("");
      setReportDateFin("");
      setReportMotif("");
      router.refresh();
    });
  }

  const labelCls =
    "block text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-[var(--space-admin-1)]";
  const inputCls =
    "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";

  const isTerminal = transitions.length === 0 && !peutReporter;

  return (
    <div className="flex flex-col gap-[var(--space-admin-4)]">
      {/* ── Boutons de transition ─────────────────────────────────────────── */}
      {isTerminal ? (
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Ce statut est terminal — aucune transition disponible.
        </p>
      ) : (
        <div className="flex flex-wrap gap-[var(--space-admin-3)]">
          {transitions
            .filter((t) => t !== "reportee")
            .map((toStatus) => (
              <button
                key={toStatus}
                type="button"
                disabled={isPending}
                onClick={() => handleTransition(toStatus)}
                className={TRANSITION_TONES[toStatus] ?? "admin-button"}
                aria-label={`Passer la session au statut ${toStatus}`}
              >
                {isPending ? "…" : TRANSITION_LABELS[toStatus]}
              </button>
            ))}

          {peutReporter && !showReportForm && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setShowReportForm(true);
                setError(null);
                setSuccessMsg(null);
              }}
              className="admin-button-secondary"
              aria-label="Ouvrir le formulaire de report de session"
            >
              Reporter la session
            </button>
          )}
        </div>
      )}

      {/* ── Formulaire de report ──────────────────────────────────────────── */}
      {showReportForm && (
        <div className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)]">
          <h3 className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
            Reporter la session
          </h3>
          <p className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Une nouvelle session sera créée avec les dates indiquées. Les stagiaires seront
            automatiquement migrés vers la nouvelle session.
          </p>

          <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="report-date-debut">
                Nouvelle date de début
              </label>
              <input
                id="report-date-debut"
                type="datetime-local"
                value={reportDateDebut}
                onChange={(e) => setReportDateDebut(e.target.value)}
                disabled={isPending}
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="report-date-fin">
                Nouvelle date de fin
              </label>
              <input
                id="report-date-fin"
                type="datetime-local"
                value={reportDateFin}
                onChange={(e) => setReportDateFin(e.target.value)}
                disabled={isPending}
                className={inputCls}
                required
              />
            </div>
          </div>

          <div className="mt-[var(--space-admin-4)]">
            <label className={labelCls} htmlFor="report-motif">
              Motif du report
            </label>
            <textarea
              id="report-motif"
              value={reportMotif}
              onChange={(e) => setReportMotif(e.target.value)}
              disabled={isPending}
              rows={3}
              className={inputCls}
              placeholder="Expliquer la raison du report (ex. : demande du client, indisponibilité formateur…)"
              required
            />
          </div>

          <div className="mt-[var(--space-admin-4)] flex gap-[var(--space-admin-3)]">
            <button
              type="button"
              disabled={isPending}
              onClick={handleReport}
              className="admin-button"
              aria-label="Confirmer le report de la session"
            >
              {isPending ? "Report en cours…" : "Confirmer le report"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setShowReportForm(false);
                setError(null);
              }}
              className="admin-button-secondary"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* ── Messages ─────────────────────────────────────────────────────── */}
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
