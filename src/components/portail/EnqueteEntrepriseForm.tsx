"use client";
// use-client: formulaire à état local (note, champs, soumission) + appel Server Action.

/**
 * Formulaire public de l'enquête ENTREPRISE (page /portail/enquete/[token]).
 *
 * Répondu par le CONTACT CLIENT, pas par le stagiaire. Une note obligatoire,
 * le reste facultatif — deux minutes, c'est la promesse de l'email.
 */

import React, { useState, useTransition } from "react";
import { soumettreEnqueteEntrepriseAction } from "@/server/actions/qualiopi/enquete-public";

const NOTES: Array<{ valeur: number; libelle: string }> = [
  { valeur: 1, libelle: "1 — Très insatisfait" },
  { valeur: 2, libelle: "2 — Insatisfait" },
  { valeur: 3, libelle: "3 — Correct" },
  { valeur: 4, libelle: "4 — Satisfait" },
  { valeur: 5, libelle: "5 — Très satisfait" },
];

export function EnqueteEntrepriseForm({ token }: { token: string }): React.ReactElement {
  const [note, setNote] = useState<number | null>(null);
  const [commentaire, setCommentaire] = useState("");
  const [repondantNom, setRepondantNom] = useState("");
  const [repondantFonction, setRepondantFonction] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoye, setEnvoye] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (note === null) {
      setErreur("Merci de choisir une note.");
      return;
    }
    setErreur(null);
    startTransition(async () => {
      const result = await soumettreEnqueteEntrepriseAction({
        token,
        noteGlobale: note,
        ...(commentaire.trim() !== "" ? { commentaire: commentaire.trim() } : {}),
        ...(repondantNom.trim() !== "" ? { repondantNom: repondantNom.trim() } : {}),
        ...(repondantFonction.trim() !== "" ? { repondantFonction: repondantFonction.trim() } : {}),
      });
      if ("error" in result) {
        setErreur(result.error);
        return;
      }
      setEnvoye(true);
    });
  }

  if (envoye) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Merci !</h2>
        <p className="mt-2 text-sm text-gray-600">
          Votre avis est enregistré. Il alimente directement notre démarche qualité.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-gray-900">
          Globalement, votre entreprise est… <span aria-hidden="true">*</span>
        </legend>
        <div className="flex flex-col gap-2">
          {NOTES.map((n) => (
            <label
              key={n.valeur}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
                note === n.valeur
                  ? "border-gray-900 bg-gray-50 font-medium text-gray-900"
                  : "border-gray-200 text-gray-700 hover:border-gray-400"
              }`}
            >
              <input
                type="radio"
                name="note"
                value={n.valeur}
                checked={note === n.valeur}
                onChange={() => setNote(n.valeur)}
                className="h-4 w-4"
              />
              {n.libelle}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-gray-900">Commentaire (facultatif)</span>
        <textarea
          value={commentaire}
          onChange={(e) => setCommentaire(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="La formation a-t-elle produit les effets attendus dans votre activité ?"
          className="rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-900 focus:outline-none"
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-900">Votre nom (facultatif)</span>
          <input
            type="text"
            value={repondantNom}
            onChange={(e) => setRepondantNom(e.target.value)}
            maxLength={200}
            autoComplete="name"
            className="rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-900 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-900">Votre fonction (facultatif)</span>
          <input
            type="text"
            value={repondantFonction}
            onChange={(e) => setRepondantFonction(e.target.value)}
            maxLength={150}
            autoComplete="organization-title"
            className="rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-900 focus:outline-none"
          />
        </label>
      </div>

      {erreur !== null && (
        <p role="alert" className="text-sm text-red-700">
          {erreur}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || note === null}
        className="rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
      >
        {isPending ? "Envoi…" : "Envoyer notre avis"}
      </button>
    </form>
  );
}
