"use client";
// use-client: formulaire de déclaration handicap avec état local (textarea + useTransition).
/**
 * HandicapDeclarationForm — Déclaration de situation de handicap depuis le portail stagiaire.
 *
 * Si déjà déclarée → affiche un message de confirmation.
 * Sinon → formulaire de description du besoin.
 * Submit → `declarerHandicapAction` (chiffre le détail via encryptPii côté action).
 *
 * PII : le texte de besoin est envoyé à l&apos;action serveur qui l&apos;encrypte.
 * AUCUNE information médicale n&apos;est transmise à d&apos;autres services.
 *
 * Sobre (charte publique — PAS de tokens admin).
 * Français, apostrophes JSX échappées.
 */

import { useState, useTransition } from "react";

type ActionResult<T> = { data: T } | { error: string };

interface HandicapDeclarationFormProps {
  situationDeclaree: boolean;
  declarerHandicapAction: (input: { besoin: string }) => Promise<ActionResult<{ ok: boolean }>>;
}

export function HandicapDeclarationForm({
  situationDeclaree,
  declarerHandicapAction,
}: HandicapDeclarationFormProps): React.ReactElement {
  const [showForm, setShowForm] = useState(false);
  const [besoin, setBesoin] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [declaree, setDeclaree] = useState(situationDeclaree);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!besoin.trim()) return;
    setError(null);

    startTransition(async () => {
      const result = await declarerHandicapAction({ besoin: besoin.trim() });
      if ("error" in result) {
        setError(result.error);
      } else {
        setDeclaree(true);
        setShowForm(false);
      }
    });
  }

  if (declaree) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
        <p className="text-sm text-green-800">
          Votre situation a bien été prise en compte. L&apos;équipe pédagogique adaptera les
          conditions si nécessaire.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-700">
        Si vous avez une situation nécessitant des aménagements particuliers (handicap, trouble
        d&apos;apprentissage, etc.), vous pouvez nous en informer.
      </p>

      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="mt-3 text-sm text-blue-600 underline hover:no-underline"
        >
          Déclarer une situation particulière
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label htmlFor="handicap-besoin" className="mb-1 block text-sm text-gray-700">
              Décrivez votre besoin ou les aménagements souhaités
            </label>
            <textarea
              id="handicap-besoin"
              value={besoin}
              onChange={(e) => setBesoin(e.target.value)}
              disabled={isPending}
              rows={4}
              maxLength={2000}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-400 focus:outline-none"
              placeholder="Ex. : difficultés de lecture, aménagement du temps, accès mobilité réduite..."
            />
            <p className="mt-1 text-xs text-gray-400">
              Ces informations sont strictement confidentielles et chiffrées.
            </p>
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isPending || !besoin.trim()}
              className="rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {isPending ? "Envoi..." : "Transmettre"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              disabled={isPending}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Annuler
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
