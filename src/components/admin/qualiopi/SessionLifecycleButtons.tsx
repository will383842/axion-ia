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

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { transitionSessionAction } from "@/server/actions/qualiopi/sessions";
import { reportSessionAction } from "@/server/actions/qualiopi/sessions-recurrentes";
import { SESSION_TRANSITIONS } from "@/server/qualiopi/formations/state-machine";
import type { TrainingSessionStatut } from "../../../../prisma/generated/client";
import { exigeUnMotif, refusMotif } from "@/server/qualiopi/formations/transition-motif";
import { datesParDefautReport } from "@/features/admin-qualiopi/session-cycle/report-defauts";

// ─────────────────────────────────────────────────────────────────────────────
// Types props
// ─────────────────────────────────────────────────────────────────────────────

export interface SessionLifecycleButtonsProps {
  sessionId: string;
  /** Statut courant de la session — détermine les transitions disponibles. */
  statut: TrainingSessionStatut;
  /**
   * Base des routes de session (`/fr/<prefixe>/qualiopi/sessions`).
   *
   * 🔴 Sans elle, le succès d'un report ne pouvait qu'ANNONCER le numéro de
   * la nouvelle session, jamais y conduire : on lisait « AXI-SESS-2026-014 »
   * et on repartait la chercher dans la liste. Le préfixe d'admin est
   * variable, il ne peut pas être deviné côté client.
   */
  baseSessions: string;
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

/**
 * 🔴 LES VERBES SERVAIENT AUSSI DE NOMS D'ÉTAT. `TRANSITION_LABELS` porte des
 * ACTIONS (« Démarrer », « Marquer réalisée ») ; le message de confirmation les
 * réemployait comme statuts, d'où « Session passée au statut « Démarrer » ».
 * Un verbe à l'infinitif n'est pas un état, et l'aria-label, lui, lisait la
 * valeur d'enum brute (« Passer la session au statut en_cours »).
 */
const STATUT_LABELS: Record<TrainingSessionStatut, string> = {
  planifiee: "Planifiée",
  en_cours: "En cours",
  realisee: "Réalisée",
  annulee: "Annulée",
  reportee: "Reportée",
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
  baseSessions,
}: SessionLifecycleButtonsProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // 🔴 Le succès n'est plus une phrase : il porte un LIEN. Un report réussi
  // annonçait le numéro de la nouvelle session sans jamais y conduire.
  const [succes, setSucces] = useState<{
    texte: string;
    sessionId?: string;
    numero?: string;
  } | null>(null);
  // Motif d'annulation — voir `transition-motif.ts`. L'écran l'ouvre AVANT
  // l'envoi plutôt que d'encaisser un refus serveur : un champ qu'on découvre
  // par une erreur se remplit à contrecœur.
  const [transitionAMotiver, setTransitionAMotiver] = useState<TrainingSessionStatut | null>(null);
  const [motifTransition, setMotifTransition] = useState("");
  // ⚠️ Le focus, pas seulement `role="alert"` : l'annonce sonore ne déplace pas
  // le curseur, et l'erreur était rendue APRÈS le panneau — hors de vue sur un
  // écran court.
  const erreurRef = useRef<HTMLParagraphElement | null>(null);
  const succesRef = useRef<HTMLParagraphElement | null>(null);

  // État du panneau report
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportDateDebut, setReportDateDebut] = useState("");
  const [reportDateFin, setReportDateFin] = useState("");
  const [reportMotif, setReportMotif] = useState("");

  // Le focus suit le message. Sans lui, `role="alert"` annonce mais laisse le
  // curseur sur le bouton : au clavier, on n'atteint jamais la phrase, et on
  // reclique le bouton qui vient d'échouer.
  useEffect(() => {
    if (error !== null) erreurRef.current?.focus();
  }, [error]);
  useEffect(() => {
    if (succes !== null) succesRef.current?.focus();
  }, [succes]);

  const transitions = SESSION_TRANSITIONS[statut] ?? [];
  const peutReporter = STATUTS_REPORTABLES.includes(statut);

  function handleTransition(toStatus: TrainingSessionStatut) {
    setError(null);
    setSucces(null);

    // Le motif s'obtient AVANT l'envoi : on ouvre le champ plutôt que
    // d'encaisser un refus serveur que l'utilisateur ne comprendrait pas.
    if (exigeUnMotif(toStatus) && transitionAMotiver !== toStatus) {
      setTransitionAMotiver(toStatus);
      setMotifTransition("");
      return;
    }
    const refus = refusMotif(toStatus, motifTransition);
    if (refus !== null) {
      setError(refus);
      return;
    }
    const motif = motifTransition.trim();

    startTransition(async () => {
      const result = await transitionSessionAction({
        id: sessionId,
        toStatus,
        ...(motif.length > 0 ? { reason: motif } : {}),
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSucces({ texte: `Session passée au statut « ${STATUT_LABELS[toStatus]} ».` });
      setTransitionAMotiver(null);
      setMotifTransition("");
      router.refresh();
    });
  }

  function handleReport() {
    if (!reportDateDebut || !reportDateFin || !reportMotif.trim()) {
      setError("Veuillez renseigner la nouvelle date de début, de fin et le motif du report.");
      return;
    }
    setError(null);
    setSucces(null);
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
      setSucces({
        texte: "Session reportée. Nouvelle session créée :",
        sessionId: result.data.nouvelleSessionId,
        numero: result.data.nouvelleSessionNumero,
      });
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
      {/* 🔴 L'ERREUR EST EN TÊTE, PAS EN PIED.
          Elle était rendue APRÈS le panneau de report : sur un écran court on
          cliquait « Confirmer », rien ne semblait se passer, et la cause du refus
          attendait hors du champ de vision. `role="alert"` l'annonce aux lecteurs
          d'écran, mais une annonce sonore ne déplace pas le curseur — d'où le
          focus, posé explicitement. */}
      {error && (
        <p
          ref={erreurRef}
          role="alert"
          tabIndex={-1}
          className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-error)] p-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          {error}
        </p>
      )}

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
                aria-label={`Passer la session au statut « ${STATUT_LABELS[toStatus]} »`}
              >
                {isPending ? "…" : TRANSITION_LABELS[toStatus]}
              </button>
            ))}

          {transitionAMotiver !== null && (
            <div className="w-full rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]">
              <label className={labelCls} htmlFor="motif-transition">
                Motif — obligatoire
              </label>
              <textarea
                id="motif-transition"
                value={motifTransition}
                onChange={(e) => setMotifTransition(e.target.value)}
                disabled={isPending}
                rows={2}
                className={inputCls}
                autoFocus
                placeholder="Pourquoi cette session est-elle annulée ? (demande du client, effectif insuffisant…)"
              />
              {/* 🔴 La conséquence est ÉCRITE sous le verbe. « Annuler », seul,
                  ne dit pas que l'état est terminal ni que les liens
                  d'émargement seront révoqués. */}
              <p className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                Définitif : le statut « Annulée » est terminal et les liens d’émargement de cette
                session seront révoqués.
              </p>
              <div className="mt-[var(--space-admin-3)] flex gap-[var(--space-admin-3)]">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleTransition(transitionAMotiver)}
                  className="admin-button-danger"
                >
                  {isPending ? "…" : `Confirmer : ${TRANSITION_LABELS[transitionAMotiver]}`}
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    setTransitionAMotiver(null);
                    setMotifTransition("");
                    setError(null);
                  }}
                  className="admin-button-secondary"
                >
                  Fermer sans annuler la session
                </button>
              </div>
            </div>
          )}

          {peutReporter && !showReportForm && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setShowReportForm(true);
                setError(null);
                setSucces(null);
                // Proposition modifiable : le lendemain, 09:00 → 17:00.
                const d = datesParDefautReport(new Date());
                setReportDateDebut(d.debut);
                setReportDateFin(d.fin);
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
              {/* 🔴 S'appelait « Annuler » — le MÊME mot que l'action métier
                  « Annuler la session », juste au-dessus, et qui elle est
                  définitive. Fermer un panneau et détruire un dossier ne
                  peuvent pas porter le même verbe. */}
              Fermer sans reporter
            </button>
          </div>
        </div>
      )}

      {/* 🔴 LE SUCCÈS N'ABANDONNE PAS.
          Un report réussi annonçait « Nouvelle session créée : AXI-SESS-… » et
          s'arrêtait là : on lisait un numéro, puis on repartait le chercher à la
          main dans la liste. L'action retournait pourtant déjà l'identifiant — il
          était simplement jeté. Le focus s'y déplace : pendant symétrique du
          focus sur l'erreur. */}
      {succes && (
        <p
          ref={succesRef}
          role="status"
          tabIndex={-1}
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          {succes.texte}{" "}
          {succes.sessionId !== undefined && succes.numero !== undefined ? (
            <Link
              href={`${baseSessions}/${succes.sessionId}`}
              className="font-semibold underline underline-offset-2"
            >
              Ouvrir la session {succes.numero} →
            </Link>
          ) : null}
        </p>
      )}
    </div>
  );
}
