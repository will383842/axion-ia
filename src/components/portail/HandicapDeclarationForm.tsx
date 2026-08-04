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
      <div className="border-sage/30 bg-sage-soft rounded-lg border px-4 py-3">
        <p className="text-sage text-sm">
          Votre situation a bien été prise en compte. L&apos;équipe pédagogique adaptera les
          conditions si nécessaire.
        </p>
      </div>
    );
  }

  return (
    // `bg-bg` (ivoire) et non `bg-paper` : la section qui contient ce bloc est
    // DÉJÀ en `bg-paper`, donc un fond blanc dessinait une carte invisible dans
    // une carte. L'ivoire le fait lire comme un encart en creux.
    <div className="border-border bg-bg rounded-lg border p-4">
      <p className="text-fg-soft text-sm">
        Si vous avez une situation nécessitant des aménagements particuliers (handicap, trouble
        d&apos;apprentissage, etc.), vous pouvez nous en informer.
      </p>

      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="text-primary focus-visible:ring-primary mt-3 rounded-sm text-sm underline hover:no-underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Déclarer une situation particulière
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label htmlFor="handicap-besoin" className="text-fg-soft mb-1 block text-sm">
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
              className="border-border bg-paper text-fg placeholder:text-fg-muted focus-visible:border-border-strong focus-visible:ring-primary w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
              placeholder="Ex. : difficultés de lecture, aménagement du temps, accès mobilité réduite..."
            />
            {/* `text-fg-muted` et non un gris clair : cette ligne porte la
                promesse de confidentialité. Illisible, elle ne rassure
                personne — c'est le seul endroit où le chiffrement est dit. */}
            <p className="text-fg-muted mt-1 text-xs">
              Ces informations sont strictement confidentielles et chiffrées.
            </p>
          </div>

          {error && (
            <p role="alert" className="text-error text-sm">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isPending || !besoin.trim()}
              className="bg-primary text-primary-fg hover:bg-primary-hover focus-visible:ring-primary rounded-md px-4 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
            >
              {isPending ? "Envoi..." : "Transmettre"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              disabled={isPending}
              className="border-border text-fg-soft hover:bg-sand focus-visible:ring-primary rounded-md border px-4 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              Annuler
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
