"use client";
// use-client: formulaire interactif (notes, niveaux par objectif) avec useTransition.
/**
 * SatisfactionV2PortailForm — questionnaire à chaud / à froid, version 2 (lot L08).
 *
 * Reprend la note globale et le commentaire de la v1 et y ajoute l'ÉVALUATION DES
 * ACQUIS PAR OBJECTIF, sur l'échelle 1-3 du positionnement et de l'évaluation
 * finale. Les questions sont celles du contenu versionné
 * (`questionnaire-contenu.ts`) : le formulaire n'en invente aucune.
 *
 * Sobre (charte publique — PAS de tokens admin). Français, apostrophes échappées.
 */

import { useState, useTransition } from "react";

import {
  CONTENUS_QUESTIONNAIRE,
  MISE_EN_PRATIQUE,
} from "@/server/qualiopi/pedagogie/questionnaire-contenu";

type ActionResult<T> = { data: T } | { error: string };

const NIVEAUX = [
  { valeur: 1, label: "Je découvre" },
  { valeur: 2, label: "Quelques notions" },
  { valeur: 3, label: "Je maîtrise" },
] as const;

interface Props {
  questionnaireId: string;
  type: "satisfaction_chaud" | "satisfaction_froid";
  objectifs: string[];
  soumettreAction: (input: {
    questionnaireId: string;
    reponses: Record<string, unknown>;
    noteGlobale?: number;
  }) => Promise<ActionResult<{ id: string }>>;
}

function Etoiles({
  valeur,
  onChange,
  desactive,
  libelle,
}: {
  valeur: number | null;
  onChange: (v: number) => void;
  desactive: boolean;
  libelle: string;
}): React.ReactElement {
  return (
    <div role="group" aria-label={libelle} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          disabled={desactive}
          aria-label={`${libelle} : ${v} sur 5`}
          aria-pressed={valeur === v}
          className={
            "h-8 w-8 rounded text-xl transition-colors " +
            (valeur !== null && v <= valeur
              ? "text-amber-500"
              : "text-gray-300 hover:text-amber-400")
          }
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function SatisfactionV2PortailForm({
  questionnaireId,
  type,
  objectifs,
  soumettreAction,
}: Props): React.ReactElement {
  const questions = CONTENUS_QUESTIONNAIRE[type][1]!.questions;
  const aQuestion = (id: string) => questions.find((q) => q.id === id);

  const [note, setNote] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<string, number>>({});
  const [niveaux, setNiveaux] = useState<Record<number, number>>({});
  const [choix, setChoix] = useState("");
  const [frein, setFrein] = useState("");
  const [commentaire, setCommentaire] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (note === null) {
      setError("Indiquez votre satisfaction globale.");
      return;
    }
    startTransition(async () => {
      const result = await soumettreAction({
        questionnaireId,
        noteGlobale: note,
        reponses: {
          ...notes,
          ...(choix !== "" ? { miseEnPratique: choix } : {}),
          acquisParObjectif: Object.fromEntries(
            objectifs.map((o, i) => [o, niveaux[i] ?? null]).filter(([, v]) => v !== null),
          ),
          ...(frein.trim() ? { frein: frein.trim() } : {}),
          ...(commentaire.trim() ? { commentaire: commentaire.trim() } : {}),
        },
      });
      if ("error" in result) setError(result.error);
      else setSuccess(true);
    });
  }

  if (success) {
    return (
      <p className="text-sm text-green-700">Merci pour votre retour. Il a bien été enregistré.</p>
    );
  }

  const champ =
    "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none";
  const aspects = questions.filter((q) => q.type === "note5");

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <p className="mb-2 text-sm text-gray-700">{aQuestion("noteGlobale")?.libelle}</p>
        <Etoiles
          valeur={note}
          onChange={setNote}
          desactive={isPending}
          libelle="Satisfaction globale"
        />
      </div>

      {aspects.map((q) => (
        <div key={q.id}>
          <p className="mb-2 text-sm text-gray-700">{q.libelle}</p>
          <Etoiles
            valeur={notes[q.id] ?? null}
            onChange={(v) => setNotes((n) => ({ ...n, [q.id]: v }))}
            desactive={isPending}
            libelle={q.libelle}
          />
        </div>
      ))}

      {type === "satisfaction_froid" ? (
        <div>
          <label
            htmlFor={`pratique-${questionnaireId}`}
            className="mb-1 block text-sm text-gray-700"
          >
            {aQuestion("miseEnPratique")?.libelle}
          </label>
          <select
            id={`pratique-${questionnaireId}`}
            value={choix}
            onChange={(e) => setChoix(e.target.value)}
            disabled={isPending}
            className={champ}
          >
            <option value="">—</option>
            {MISE_EN_PRATIQUE.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {objectifs.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-900">
            {aQuestion("acquisParObjectif")?.libelle}
          </p>
          {objectifs.map((objectif, i) => (
            <fieldset key={objectif} className="space-y-1">
              <legend className="text-sm text-gray-700">{objectif}</legend>
              <div className="flex flex-wrap gap-2">
                {NIVEAUX.map((n) => (
                  <label key={n.valeur} className="cursor-pointer text-sm text-gray-700">
                    <input
                      type="radio"
                      name={`niveau-${i}`}
                      value={n.valeur}
                      checked={niveaux[i] === n.valeur}
                      onChange={() => setNiveaux((c) => ({ ...c, [i]: n.valeur }))}
                      disabled={isPending}
                      className="mr-1"
                    />
                    {n.label}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      ) : null}

      {type === "satisfaction_froid" ? (
        <div>
          <label htmlFor={`frein-${questionnaireId}`} className="mb-1 block text-sm text-gray-700">
            {aQuestion("frein")?.libelle} (facultatif)
          </label>
          <textarea
            id={`frein-${questionnaireId}`}
            value={frein}
            onChange={(e) => setFrein(e.target.value)}
            disabled={isPending}
            rows={2}
            maxLength={2000}
            className={champ}
          />
        </div>
      ) : null}

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
          className={champ}
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
