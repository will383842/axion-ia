"use client";
// use-client: formulaire interactif de satisfaction (étoiles + commentaire) avec useTransition.
/**
 * SatisfactionPortailForm — Formulaire de satisfaction depuis le portail stagiaire.
 *
 * Affiche une saisie de note /5 (étoiles) + commentaire libre.
 * Submit → `soumettreSatisfactionPortailAction`.
 *
 * Sobre (charte publique — PAS de tokens admin).
 * Français, apostrophes JSX échappées.
 */

import { useState, useTransition } from "react";

import {
  CLE_AMENAGEMENTS_UTILES,
  MESSAGE_AMENAGEMENTS_SANS_REPONSE,
  QuestionAmenagementsUtiles,
} from "./QuestionAmenagementsUtiles";

type ActionResult<T> = { data: T } | { error: string };

interface SatisfactionPortailFormProps {
  questionnaireId: string;
  /** Chantier QNC, L04 — poser « les aménagements vous ont-ils été utiles ? ». */
  questionAmenagements?: boolean;
  soumettreSatisfactionAction: (input: {
    questionnaireId: string;
    reponses: Record<string, unknown>;
    noteGlobale?: number;
  }) => Promise<ActionResult<{ id: string }>>;
}

export function SatisfactionPortailForm({
  questionnaireId,
  questionAmenagements = false,
  soumettreSatisfactionAction,
}: SatisfactionPortailFormProps): React.ReactElement {
  const [note, setNote] = useState<number | null>(null);
  const [amenagementsUtiles, setAmenagementsUtiles] = useState<boolean | null>(null);
  const [commentaire, setCommentaire] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (questionAmenagements && amenagementsUtiles === null) {
      setError(MESSAGE_AMENAGEMENTS_SANS_REPONSE);
      return;
    }

    startTransition(async () => {
      const result = await soumettreSatisfactionAction({
        questionnaireId: questionnaireId,
        reponses: {
          ...(commentaire.trim() ? { commentaire: commentaire.trim() } : {}),
          ...(questionAmenagements && amenagementsUtiles !== null
            ? { [CLE_AMENAGEMENTS_UTILES]: amenagementsUtiles }
            : {}),
        },
        ...(note !== null ? { noteGlobale: note } : {}),
      });

      if ("error" in result) {
        setError(result.error);
      } else {
        setSuccess(true);
      }
    });
  }

  if (success) {
    return (
      <p className="text-sm text-green-700">Merci pour votre retour. Il a bien été enregistré.</p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Note /5 */}
      <div>
        <p className="mb-2 text-sm text-gray-700">Votre satisfaction globale</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setNote(v)}
              disabled={isPending}
              aria-label={`Note ${v} sur 5`}
              className={
                "h-8 w-8 rounded text-xl transition-colors " +
                (note !== null && v <= note
                  ? "text-amber-500"
                  : "text-gray-300 hover:text-amber-400")
              }
            >
              ★
            </button>
          ))}
        </div>
      </div>

      {questionAmenagements && (
        <QuestionAmenagementsUtiles
          questionnaireId={questionnaireId}
          valeur={amenagementsUtiles}
          onChange={setAmenagementsUtiles}
          desactive={isPending}
        />
      )}

      {/* Commentaire */}
      <div>
        <label
          htmlFor={`commentaire-${questionnaireId}`}
          className="mb-1 block text-sm text-gray-700"
        >
          Commentaire (facultatif)
        </label>
        <textarea
          id={`commentaire-${questionnaireId}`}
          value={commentaire}
          onChange={(e) => setCommentaire(e.target.value)}
          disabled={isPending}
          rows={3}
          maxLength={2000}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-400 focus:outline-none"
          placeholder="Votre avis sur la formation..."
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
      >
        {isPending ? "Envoi en cours..." : "Envoyer mon évaluation"}
      </button>
    </form>
  );
}
