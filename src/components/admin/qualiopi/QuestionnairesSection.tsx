"use client";
// use-client: état interactif (formulaire saisie réponses par questionnaire, toggling, génération) + useTransition + router.refresh().
/**
 * QuestionnairesSection — Section « Questionnaires » du hub session.
 *
 * Affiche les questionnaires de la session (positionnement / satisfaction),
 * permet de les générer en masse et de saisir les réponses côté admin.
 *
 * Props injectées par le Server Component parent (données sérialisées — zéro appel DB ici).
 * Câble genererQuestionnairesSessionAction + saisirReponsesQuestionnaireAction.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

// Types que la GÉNÉRATION par session accepte — un questionnaire par stagiaire.
type QuestionnaireTypeStagiaire = "positionnement" | "satisfaction_chaud" | "satisfaction_froid";

// Types que la LISTE affiche : les trois stagiaire + l'enquête entreprise
// (une par session, créée par le cron enquete-entreprise-j30 — jamais générée
// ici, sinon on en créerait une par stagiaire).
type QuestionnaireType = QuestionnaireTypeStagiaire | "satisfaction_entreprise";

/** Données sérialisées par le Server Component parent (dates en ISO string). */
export interface QuestionnaireRow {
  id: string;
  /** Token d'accès (utilisé pour la saisie admin). */
  token: string;
  /** Nom complet du stagiaire (enrollment.trainee.nom + prenom). */
  traineeNom: string;
  type: QuestionnaireType;
  /** ISO string ou null si non répondu. */
  reponduAt: string | null;
  /**
   * ISO string ou null si le lien n'a JAMAIS été envoyé au stagiaire.
   *
   * 🔴 Distinction vitale devant un auditeur : « envoyé, sans réponse » et
   * « jamais envoyé » ne se plaident pas pareil. La colonne existait en base et
   * n'était écrite par personne — l'écran ne pouvait donc pas les distinguer.
   */
  envoyeAt: string | null;
  /** 1-5 ou null. */
  noteGlobale: number | null;
}

type ActionResult<T> = { data: T } | { error: string };

export interface QuestionnairesSectionProps {
  sessionId: string;
  questionnaires: QuestionnaireRow[];
  genererAction: (input: {
    sessionId: string;
    types?: QuestionnaireTypeStagiaire[];
  }) => Promise<ActionResult<{ crees: number; total: number }>>;
  saisirReponsesAction: (input: {
    token: string;
    reponses: Record<string, unknown>;
    noteGlobale?: number;
  }) => Promise<ActionResult<{ id: string }>>;
  /**
   * Envoi MANUEL du lien au stagiaire.
   *
   * Les crons `satisfaction-j1` et `suivi-j30` sélectionnent sur une fenêtre
   * glissante de 24 h ET exigent que la session soit déjà `realisee` ce
   * matin-là. Une session clôturée avec un jour de retard sortait de la fenêtre
   * et perdait DÉFINITIVEMENT ses questionnaires : aucun rattrapage, aucune
   * alerte, aucun bouton. Constaté sur le dossier INVEST SUN.
   */
  envoyerAction: (input: {
    questionnaireId: string;
  }) => Promise<ActionResult<{ questionnaireId: string; envoyeAt: string }>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<QuestionnaireType, string> = {
  positionnement: "Positionnement",
  satisfaction_chaud: "Satisfaction à chaud",
  satisfaction_froid: "Satisfaction à froid",
  // Répondu par le CONTACT CLIENT via la page publique /enquete/[token].
  satisfaction_entreprise: "Enquête entreprise",
};

function formatDateFR(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composant : formulaire de saisie des réponses pour un questionnaire
// ─────────────────────────────────────────────────────────────────────────────

interface SaisieFormProps {
  questionnaire: QuestionnaireRow;
  saisirReponsesAction: QuestionnairesSectionProps["saisirReponsesAction"];
  onDone: () => void;
}

function SaisieForm({ questionnaire, saisirReponsesAction, onDone }: SaisieFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Note globale (1-5) — obligatoire pour les questionnaires satisfaction
  const [noteGlobale, setNoteGlobale] = useState<string>("");

  // Questions communes minimales selon le type
  // Les réponses sont stockées en JSON libre (Record<string,unknown>).
  // On propose un ensemble de champs cohérent avec ce que les stagiaires
  // remplissent via le portail (objectifs atteints, points forts, axes amélioration).
  const [objectifsAtteints, setObjectifsAtteints] = useState<string>("");
  const [pointsForts, setPointsForts] = useState<string>("");
  const [axesAmelioration, setAxesAmelioration] = useState<string>("");
  const [commentaire, setCommentaire] = useState<string>("");

  const isSatisfaction =
    questionnaire.type === "satisfaction_chaud" || questionnaire.type === "satisfaction_froid";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (isSatisfaction && noteGlobale === "") {
      setError("La note globale est obligatoire pour les questionnaires de satisfaction.");
      return;
    }

    // Construction du payload reponses (Record<string, unknown>)
    const reponses: Record<string, unknown> = {
      ...(objectifsAtteints.trim() !== "" ? { objectifs_atteints: objectifsAtteints.trim() } : {}),
      ...(pointsForts.trim() !== "" ? { points_forts: pointsForts.trim() } : {}),
      ...(axesAmelioration.trim() !== "" ? { axes_amelioration: axesAmelioration.trim() } : {}),
      ...(commentaire.trim() !== "" ? { commentaire: commentaire.trim() } : {}),
      saisie_admin: true,
    };

    const noteInt = noteGlobale !== "" ? parseInt(noteGlobale, 10) : undefined;

    startTransition(async () => {
      const result = await saisirReponsesAction({
        token: questionnaire.token,
        reponses,
        ...(noteInt !== undefined ? { noteGlobale: noteInt } : {}),
      });
      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccessMsg("Réponses enregistrées.");
        onDone();
      }
    });
  }

  const labelCls =
    "block text-[length:var(--text-admin-xs)] font-medium tracking-wide uppercase text-[color:var(--color-admin-fg-muted)] mb-1";
  const inputCls =
    "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-[var(--space-admin-3)] space-y-[var(--space-admin-4)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)]"
    >
      <p className="text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
        Saisie admin — {TYPE_LABELS[questionnaire.type]} — {questionnaire.traineeNom}
      </p>

      {/* Note globale (satisfaction seulement) */}
      {isSatisfaction && (
        <div>
          <label htmlFor={`note-${questionnaire.id}`} className={labelCls}>
            Note globale (1 à 5) *
          </label>
          <select
            id={`note-${questionnaire.id}`}
            value={noteGlobale}
            onChange={(e) => setNoteGlobale(e.target.value)}
            disabled={isPending}
            required
            className={inputCls}
          >
            <option value="">— Sélectionner</option>
            <option value="1">1 — Très insatisfait</option>
            <option value="2">2 — Insatisfait</option>
            <option value="3">3 — Neutre</option>
            <option value="4">4 — Satisfait</option>
            <option value="5">5 — Très satisfait</option>
          </select>
        </div>
      )}

      {/* Objectifs atteints */}
      <div>
        <label htmlFor={`obj-${questionnaire.id}`} className={labelCls}>
          Objectifs atteints (optionnel)
        </label>
        <textarea
          id={`obj-${questionnaire.id}`}
          value={objectifsAtteints}
          onChange={(e) => setObjectifsAtteints(e.target.value)}
          disabled={isPending}
          rows={2}
          placeholder="Les objectifs de la formation ont-ils été atteints ?"
          className={`${inputCls} resize-y`}
        />
      </div>

      {/* Points forts */}
      <div>
        <label htmlFor={`pf-${questionnaire.id}`} className={labelCls}>
          Points forts (optionnel)
        </label>
        <input
          id={`pf-${questionnaire.id}`}
          type="text"
          value={pointsForts}
          onChange={(e) => setPointsForts(e.target.value)}
          disabled={isPending}
          placeholder="Ce qui a bien fonctionné…"
          className={inputCls}
        />
      </div>

      {/* Axes d'amélioration */}
      <div>
        <label htmlFor={`aa-${questionnaire.id}`} className={labelCls}>
          Axes d&apos;amélioration (optionnel)
        </label>
        <input
          id={`aa-${questionnaire.id}`}
          type="text"
          value={axesAmelioration}
          onChange={(e) => setAxesAmelioration(e.target.value)}
          disabled={isPending}
          placeholder="Points à améliorer…"
          className={inputCls}
        />
      </div>

      {/* Commentaire libre */}
      <div>
        <label htmlFor={`com-${questionnaire.id}`} className={labelCls}>
          Commentaire libre (optionnel)
        </label>
        <textarea
          id={`com-${questionnaire.id}`}
          value={commentaire}
          onChange={(e) => setCommentaire(e.target.value)}
          disabled={isPending}
          rows={2}
          placeholder="Observations complémentaires…"
          className={`${inputCls} resize-y`}
        />
      </div>

      {/* Feedback */}
      {error && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          Erreur : {error}
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

      <div className="flex gap-[var(--space-admin-3)]">
        <button type="submit" disabled={isPending} className="admin-button">
          {isPending ? "Enregistrement…" : "Enregistrer les réponses"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={onDone}
          className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-4)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] hover:bg-[color:var(--color-admin-surface)]"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export function QuestionnairesSection({
  sessionId,
  questionnaires,
  genererAction,
  saisirReponsesAction,
  envoyerAction,
}: QuestionnairesSectionProps): React.ReactElement {
  const router = useRouter();
  const [isPendingGenerer, startGenererTransition] = useTransition();
  const [genererError, setGenererError] = useState<string | null>(null);
  const [genererSuccess, setGenererSuccess] = useState<string | null>(null);

  // Id du questionnaire dont le formulaire de saisie est ouvert (null = aucun)
  const [saisieOuverteId, setSaisieOuverteId] = useState<string | null>(null);

  // Envoi manuel : id en cours d'envoi, et message par questionnaire.
  const [envoiEnCoursId, setEnvoiEnCoursId] = useState<string | null>(null);
  const [envoiMessage, setEnvoiMessage] = useState<Record<string, string>>({});
  const [, startEnvoiTransition] = useTransition();

  function handleEnvoyer(questionnaireId: string) {
    setEnvoiEnCoursId(questionnaireId);
    setEnvoiMessage((m) => ({ ...m, [questionnaireId]: "" }));
    startEnvoiTransition(async () => {
      const result = await envoyerAction({ questionnaireId });
      setEnvoiEnCoursId(null);
      setEnvoiMessage((m) => ({
        ...m,
        [questionnaireId]: "error" in result ? result.error : "Lien envoyé au stagiaire.",
      }));
      if (!("error" in result)) router.refresh();
    });
  }

  function handleGenerer() {
    setGenererError(null);
    setGenererSuccess(null);

    startGenererTransition(async () => {
      const result = await genererAction({ sessionId });
      if ("error" in result) {
        setGenererError(result.error);
      } else {
        setGenererSuccess(
          `${result.data.crees} questionnaire${result.data.crees > 1 ? "s" : ""} créé${result.data.crees > 1 ? "s" : ""} sur ${result.data.total} attendu${result.data.total > 1 ? "s" : ""}.`,
        );
        router.refresh();
      }
    });
  }

  function handleSaisieDone() {
    setSaisieOuverteId(null);
    router.refresh();
  }

  const thCls =
    "px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";
  const tdCls =
    "px-[var(--space-admin-3)] py-[var(--space-admin-3)] align-top text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";

  return (
    <section aria-labelledby="questionnaires-heading" className="space-y-[var(--space-admin-4)]">
      {/* En-tête de section */}
      <div className="flex flex-wrap items-center justify-between gap-[var(--space-admin-3)]">
        <h2
          id="questionnaires-heading"
          className="text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]"
        >
          Questionnaires
        </h2>

        <button
          type="button"
          onClick={handleGenerer}
          disabled={isPendingGenerer}
          className="admin-button"
        >
          {isPendingGenerer ? "Génération…" : "Générer les questionnaires de la session"}
        </button>
      </div>

      {/* Feedback génération */}
      {genererError && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]"
        >
          Erreur : {genererError}
        </p>
      )}
      {genererSuccess && (
        <p
          role="status"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
        >
          {genererSuccess}
        </p>
      )}

      {/* Liste des questionnaires */}
      {questionnaires.length === 0 ? (
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Aucun questionnaire généré pour cette session.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]">
          <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)]">
            <thead className="border-b border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)]">
              <tr>
                <th className={thCls}>Stagiaire</th>
                <th className={thCls}>Type</th>
                <th className={thCls}>État</th>
                <th className={thCls}>Note</th>
                <th className={thCls}>Répondu le</th>
                <th className={thCls}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {questionnaires.map((q) => {
                const isRepandu = q.reponduAt !== null;
                const isFormOpen = saisieOuverteId === q.id;

                return (
                  <tr
                    key={q.id}
                    className="border-b border-[color:var(--color-admin-border)] last:border-b-0"
                  >
                    <td className={tdCls}>{q.traineeNom}</td>

                    <td className={tdCls}>{TYPE_LABELS[q.type]}</td>

                    {/* État */}
                    <td className={tdCls}>
                      <span
                        className={
                          isRepandu
                            ? "inline-flex items-center rounded-full bg-[color:var(--color-admin-success-subtle)] px-[var(--space-admin-2)] py-0.5 text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-success)]"
                            : "inline-flex items-center rounded-full bg-[color:var(--color-admin-warning-subtle)] px-[var(--space-admin-2)] py-0.5 text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-warning)]"
                        }
                      >
                        {isRepandu ? "Répondu" : "À remplir"}
                      </span>
                    </td>

                    {/* Note */}
                    <td className={tdCls}>
                      {q.noteGlobale !== null ? (
                        <span className="font-semibold">{q.noteGlobale}/5</span>
                      ) : (
                        <span className="text-[color:var(--color-admin-fg-muted)]">—</span>
                      )}
                    </td>

                    {/* Répondu le */}
                    <td className={tdCls}>
                      {q.reponduAt !== null ? (
                        formatDateFR(q.reponduAt)
                      ) : (
                        <span className="text-[color:var(--color-admin-fg-muted)]">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className={tdCls}>
                      {!isRepandu && !isFormOpen && (
                        <div className="flex flex-col items-start gap-[var(--space-admin-1)]">
                          {/*
                            « Envoyer » AVANT « Saisir » : recueillir la réponse du
                            stagiaire est la seule chose qui vaut preuve. Saisir à sa
                            place documente l'organisme, pas l'appréciation du
                            bénéficiaire — un auditeur fait la différence.
                          */}
                          <button
                            type="button"
                            onClick={() => handleEnvoyer(q.id)}
                            disabled={envoiEnCoursId === q.id}
                            className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline disabled:opacity-60"
                          >
                            {envoiEnCoursId === q.id
                              ? "Envoi…"
                              : q.envoyeAt !== null
                                ? "Renvoyer le lien"
                                : "Envoyer au stagiaire"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setSaisieOuverteId(q.id)}
                            className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] underline-offset-2 hover:underline"
                          >
                            Saisir les réponses
                          </button>
                          {envoiMessage[q.id] !== undefined && envoiMessage[q.id] !== "" && (
                            <span
                              role="status"
                              className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]"
                            >
                              {envoiMessage[q.id]}
                            </span>
                          )}
                        </div>
                      )}
                      {isRepandu && (
                        <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                          Complet
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Formulaire de saisie inline (affiché sous le tableau) */}
      {saisieOuverteId !== null &&
        (() => {
          const q = questionnaires.find((x) => x.id === saisieOuverteId);
          if (q === undefined) return null;
          return (
            <SaisieForm
              questionnaire={q}
              saisirReponsesAction={saisirReponsesAction}
              onDone={handleSaisieDone}
            />
          );
        })()}
    </section>
  );
}
