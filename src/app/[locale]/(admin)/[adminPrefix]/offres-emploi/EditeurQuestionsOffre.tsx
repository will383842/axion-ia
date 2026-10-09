"use client";
// use-client: éditeur interactif des questions (ajouter, réordonner, typer) — état local.

/**
 * L13 (paquet 4a, chantier « candidatures unifiées ») — les questions de
 * sélection d'une offre, SANS JSON.
 *
 * Avant : on tapait `[{"id":"q1","labelFr":"…","required":true}]` à la main.
 * Ici : un petit formulaire — ajouter, supprimer, monter/descendre une question ;
 * libellé, type (texte libre, réponse courte, prix), obligatoire oui/non.
 *
 * L'éditeur ne détient rien : il lit le texte du champ et le réécrit
 * (`valeur` / `onChange`). Même stockage, même validation côté serveur ; le JSON
 * produit est identique à l'ancien pour les mêmes questions (cf.
 * `lib/careers/questions-offre.ts` et son test d'aller-retour).
 *
 * Chargé À LA DEMANDE par `JobOfferForm` (`next/dynamic`) : il ne pèse pas sur
 * le chunk du formulaire.
 */

import {
  ajouterQuestion,
  clesConservees,
  deplacerQuestion,
  ecrireQuestions,
  lireQuestions,
  modifierQuestion,
  supprimerQuestion,
  typeInconnu,
  TYPES_DE_QUESTION,
  type Modification,
  type QuestionStockee,
} from "@/lib/careers/questions-offre";

export function EditeurQuestionsOffre({
  valeur,
  onChange,
  disabled = false,
}: {
  /** Texte du champ `screeningQuestions` (JSON, ou vide). */
  valeur: string;
  onChange: (texte: string) => void;
  disabled?: boolean;
}): React.ReactElement {
  const lecture = lireQuestions(valeur);
  if (!lecture.ok) {
    return (
      <p role="alert" className="admin-alert admin-alert-warning">
        {lecture.raison} L&apos;éditeur ne s&apos;ouvre pas pour ne rien perdre : corrigez le texte
        dans le mode avancé (JSON) ci-dessous.
      </p>
    );
  }
  const questions = lecture.questions;
  const ecrire = (q: QuestionStockee[]) => onChange(ecrireQuestions(q));
  const modifier = (i: number, m: Modification) => ecrire(modifierQuestion(questions, i, m));

  return (
    <div className="admin-form">
      {questions.length === 0 ? (
        <p className="admin-help">
          Aucune question : le formulaire de candidature n&apos;en pose pas.
        </p>
      ) : null}
      {questions.map((q, i) => {
        const n = i + 1;
        const inconnu = typeInconnu(q);
        const conservees = clesConservees(q);
        return (
          <fieldset key={`${q.id}-${i}`} className="admin-card-inset" aria-label={`Question ${n}`}>
            <div className="admin-field">
              <label htmlFor={`question-${i}-libelle`} className="admin-label">
                Question {n}
              </label>
              <input
                id={`question-${i}-libelle`}
                type="text"
                className="admin-input"
                aria-label={`Libellé de la question ${n}`}
                value={q.labelFr ?? ""}
                maxLength={300}
                disabled={disabled}
                placeholder="Exemple : Votre prix pour une journée de tournage"
                onChange={(e) => modifier(i, { champ: "labelFr", valeur: e.target.value })}
              />
            </div>
            <div className="admin-form-row">
              <div className="admin-field">
                <label htmlFor={`question-${i}-type`} className="admin-label">
                  Type de réponse
                </label>
                <select
                  id={`question-${i}-type`}
                  className="admin-input"
                  aria-label={`Type de la question ${n}`}
                  value={inconnu ?? q.type ?? ""}
                  disabled={disabled}
                  onChange={(e) => modifier(i, { champ: "type", valeur: e.target.value })}
                >
                  {TYPES_DE_QUESTION.map((t) => (
                    <option key={t.valeur} value={t.valeur}>
                      {t.libelle}
                    </option>
                  ))}
                  {inconnu ? <option value={inconnu}>Autre, conservé : {inconnu}</option> : null}
                </select>
              </div>
              <div className="admin-field">
                <span className="admin-label">Réponse</span>
                <label className="admin-checkbox-label" htmlFor={`question-${i}-obligatoire`}>
                  <input
                    id={`question-${i}-obligatoire`}
                    type="checkbox"
                    aria-label={`Question ${n} obligatoire`}
                    checked={q.required === true}
                    disabled={disabled}
                    onChange={(e) => modifier(i, { champ: "required", valeur: e.target.checked })}
                  />{" "}
                  Obligatoire
                </label>
              </div>
            </div>
            {q.type === "price" ? (
              <p className="admin-meta-small">
                Le candidat saisit UN montant en euros ; une fourchette est refusée.
              </p>
            ) : null}
            {conservees.length > 0 ? (
              <p className="admin-meta-small">
                Réglages avancés conservés tels quels : {conservees.join(", ")} (modifiables en mode
                avancé).
              </p>
            ) : null}
            <div className="admin-actions-row">
              <button
                type="button"
                className="admin-button-ghost admin-button-xs"
                aria-label={`Monter la question ${n}`}
                disabled={disabled || i === 0}
                onClick={() => ecrire(deplacerQuestion(questions, i, -1))}
              >
                ↑ Monter
              </button>
              <button
                type="button"
                className="admin-button-ghost admin-button-xs"
                aria-label={`Descendre la question ${n}`}
                disabled={disabled || i === questions.length - 1}
                onClick={() => ecrire(deplacerQuestion(questions, i, 1))}
              >
                ↓ Descendre
              </button>
              <button
                type="button"
                className="admin-button-ghost-danger admin-button-xs"
                aria-label={`Supprimer la question ${n}`}
                disabled={disabled}
                onClick={() => ecrire(supprimerQuestion(questions, i))}
              >
                Supprimer
              </button>
            </div>
          </fieldset>
        );
      })}
      <div>
        <button
          type="button"
          className="admin-button-secondary"
          disabled={disabled}
          onClick={() => ecrire(ajouterQuestion(questions))}
        >
          Ajouter une question
        </button>
      </div>
    </div>
  );
}
