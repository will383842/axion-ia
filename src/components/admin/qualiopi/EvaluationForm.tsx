"use client";
// use-client: état interactif local (grille notes 1/2/3 + observations + type + date) + useTransition pour la server action createEvaluationAcquisAction.
/**
 * EvaluationForm — Formulaire d'ajout d'une évaluation des acquis.
 *
 * Reçoit les objectifs pédagogiques de la formation (string[]) depuis le
 * Server Component parent et pré-remplit la grille de compétences.
 *
 * "use client" : interactivité (grille notes dynamique) + appel Server Action.
 * Zéro appel DB côté client.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// Types props
// ─────────────────────────────────────────────────────────────────────────────

type EvaluationTypeInput = "initiale" | "intermediaire" | "finale";

interface CompetenceInput {
  libelle: string;
  note?: 1 | 2 | 3;
  observations?: string;
  objectifRef?: string;
}

export interface EvaluationFormProps {
  enrollmentId: string;
  /** Objectifs pédagogiques de la formation : sert à pré-remplir la grille. */
  objectifsPedagogiques: string[];
  /** Server Action AGENT B. */
  createAction: (input: {
    enrollmentId: string;
    type: EvaluationTypeInput;
    dateEvaluation: string;
    competences: CompetenceInput[];
    recommandations?: string;
  }) => Promise<{ data: { id: string } } | { error: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_OPTIONS: Array<{ value: EvaluationTypeInput; label: string }> = [
  { value: "initiale", label: "Initiale (avant formation)" },
  { value: "intermediaire", label: "Intermédiaire (en cours)" },
  { value: "finale", label: "Finale (après formation)" },
];

const NOTE_OPTIONS: Array<{ value: 1 | 2 | 3; label: string }> = [
  { value: 1, label: "1 — Non acquis" },
  { value: 2, label: "2 — En cours d'acquisition" },
  { value: 3, label: "3 — Acquis" },
];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// État local d'une ligne de compétence
// ─────────────────────────────────────────────────────────────────────────────

interface CompetenceState {
  libelle: string;
  note: "" | "1" | "2" | "3";
  observations: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────────────────────────────────────

export function EvaluationForm({
  enrollmentId,
  objectifsPedagogiques,
  createAction,
}: EvaluationFormProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Formulaire principal
  const [type, setType] = useState<EvaluationTypeInput>("initiale");
  const [dateEvaluation, setDateEvaluation] = useState<string>(todayISO());
  const [recommandations, setRecommandations] = useState<string>("");

  // Grille compétences — initialisée depuis les objectifs pédagogiques
  const [competences, setCompetences] = useState<CompetenceState[]>(() =>
    objectifsPedagogiques.length > 0
      ? objectifsPedagogiques.map((libelle) => ({ libelle, note: "", observations: "" }))
      : [{ libelle: "", note: "", observations: "" }],
  );

  function updateCompetence(index: number, field: keyof CompetenceState, value: string) {
    setCompetences((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  }

  function addCompetence() {
    setCompetences((prev) => [...prev, { libelle: "", note: "", observations: "" }]);
  }

  function removeCompetence(index: number) {
    setCompetences((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    // Validation minimale côté client
    if (!dateEvaluation) {
      setError("La date d'évaluation est obligatoire.");
      return;
    }
    const competencesFilled = competences.filter((c) => c.libelle.trim() !== "");
    if (competencesFilled.length === 0) {
      setError("Au moins une compétence avec un libellé est requise.");
      return;
    }

    // Construire le payload
    const competencesPayload: CompetenceInput[] = competencesFilled.map((c, idx) => {
      const parsed = parseInt(c.note, 10);
      const result: CompetenceInput = {
        libelle: c.libelle.trim(),
        objectifRef: c.libelle.trim(), // référence = libellé de l'objectif
        ...(parsed === 1 || parsed === 2 || parsed === 3 ? { note: parsed as 1 | 2 | 3 } : {}),
        ...(c.observations.trim() !== "" ? { observations: c.observations.trim() } : {}),
      };
      // Utiliser l'index de l'objectif comme référence si objectifs préremplis
      if (idx < objectifsPedagogiques.length) {
        result.objectifRef = `objectif-${idx + 1}`;
      }
      return result;
    });

    startTransition(async () => {
      const result = await createAction({
        enrollmentId,
        type,
        dateEvaluation,
        competences: competencesPayload,
        ...(recommandations.trim() !== "" ? { recommandations: recommandations.trim() } : {}),
      });
      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccessMsg("Évaluation enregistrée avec succès.");
        // Réinitialiser la grille après sauvegarde
        setRecommandations("");
        setCompetences(
          objectifsPedagogiques.length > 0
            ? objectifsPedagogiques.map((libelle) => ({ libelle, note: "", observations: "" }))
            : [{ libelle: "", note: "", observations: "" }],
        );
        router.refresh();
      }
    });
  }

  const labelCls =
    "block text-[length:var(--text-admin-xs)] font-medium tracking-wide uppercase text-[color:var(--color-admin-fg-muted)] mb-1";
  const inputCls =
    "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";
  const selectCls = inputCls;
  const thCls =
    "px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";
  const tdCls = "px-[var(--space-admin-3)] py-[var(--space-admin-2)] align-top";

  return (
    <form onSubmit={handleSubmit} className="space-y-[var(--space-admin-5)]">
      {/* Type + Date */}
      <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
        <div>
          <label htmlFor={`eval-type-${enrollmentId}`} className={labelCls}>
            Type d&apos;évaluation
          </label>
          <select
            id={`eval-type-${enrollmentId}`}
            value={type}
            onChange={(e) => setType(e.target.value as EvaluationTypeInput)}
            disabled={isPending}
            className={selectCls}
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`eval-date-${enrollmentId}`} className={labelCls}>
            Date d&apos;évaluation
          </label>
          <input
            id={`eval-date-${enrollmentId}`}
            type="date"
            value={dateEvaluation}
            onChange={(e) => setDateEvaluation(e.target.value)}
            disabled={isPending}
            required
            className={inputCls}
          />
        </div>
      </div>

      {/* Grille de compétences */}
      <div>
        <p className={labelCls}>Grille de compétences</p>
        <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)]">
          <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
            <thead className="border-b border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)]">
              <tr>
                <th className={thCls} style={{ width: "40%" }}>
                  Compétence / Objectif
                </th>
                <th className={thCls} style={{ width: "20%" }}>
                  Note
                </th>
                <th className={thCls} style={{ width: "35%" }}>
                  Observations
                </th>
                <th className={thCls} style={{ width: "5%" }}></th>
              </tr>
            </thead>
            <tbody>
              {competences.map((comp, index) => (
                <tr
                  key={index}
                  className="border-b border-[color:var(--color-admin-border)] last:border-b-0"
                >
                  {/* Libellé */}
                  <td className={tdCls}>
                    <input
                      type="text"
                      value={comp.libelle}
                      onChange={(e) => updateCompetence(index, "libelle", e.target.value)}
                      disabled={isPending}
                      placeholder="Libellé de la compétence"
                      aria-label={`Compétence ${index + 1} libellé`}
                      className={inputCls}
                    />
                  </td>

                  {/* Note */}
                  <td className={tdCls}>
                    <select
                      value={comp.note}
                      onChange={(e) => updateCompetence(index, "note", e.target.value)}
                      disabled={isPending}
                      aria-label={`Compétence ${index + 1} note`}
                      className={selectCls}
                    >
                      <option value="">— Non évalué</option>
                      {NOTE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={String(opt.value)}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Observations */}
                  <td className={tdCls}>
                    <input
                      type="text"
                      value={comp.observations}
                      onChange={(e) => updateCompetence(index, "observations", e.target.value)}
                      disabled={isPending}
                      placeholder="Observations (optionnel)"
                      aria-label={`Compétence ${index + 1} observations`}
                      className={inputCls}
                    />
                  </td>

                  {/* Supprimer */}
                  <td className={tdCls}>
                    {competences.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCompetence(index)}
                        disabled={isPending}
                        aria-label={`Supprimer la compétence ${index + 1}`}
                        className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)] hover:opacity-75"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          onClick={addCompetence}
          disabled={isPending}
          className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
        >
          + Ajouter une compétence
        </button>
      </div>

      {/* Recommandations */}
      <div>
        <label htmlFor={`eval-reco-${enrollmentId}`} className={labelCls}>
          Recommandations (optionnel)
        </label>
        <textarea
          id={`eval-reco-${enrollmentId}`}
          value={recommandations}
          onChange={(e) => setRecommandations(e.target.value)}
          disabled={isPending}
          rows={3}
          placeholder="Points à renforcer, axes de progression, conseils…"
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

      <button type="submit" disabled={isPending} className="admin-button">
        {isPending ? "Enregistrement…" : "Enregistrer l'évaluation"}
      </button>
    </form>
  );
}
