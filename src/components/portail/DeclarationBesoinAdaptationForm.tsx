"use client";
// use-client: formulaire de déclaration de besoin (choix + textarea + useTransition).
/**
 * DeclarationBesoinAdaptationForm — « mon compte » du portail stagiaire.
 *
 * ## Le défaut que cet écran ferme (dette D2/D4)
 *
 * Il s&apos;appelait `HandicapDeclarationForm` et disait : « Si vous avez une
 * situation nécessitant des aménagements particuliers (handicap, trouble
 * d&apos;apprentissage, etc.) ». Son unique action posait
 * `Trainee.situationHandicap = true`. Un besoin purement matériel ou
 * d&apos;organisation — une pause plus longue, une place près de la porte, un
 * support agrandi — faisait donc qualifier la personne « en situation de
 * handicap », et alimentait le décompte handicap (indicateurs 20 et 26).
 *
 * 🔑 L&apos;écran demande désormais ce qu&apos;il enregistre : deux intentions
 * distinctes, deux enregistrements distincts, et le texte dit lequel.
 *
 * PII : le texte est envoyé à l&apos;action serveur qui le chiffre. AUCUNE
 * information de santé n&apos;est transmise ailleurs.
 *
 * Sobre (charte publique — PAS de tokens admin).
 * Français, apostrophes JSX échappées.
 */

import { useState, useTransition } from "react";

type ActionResult<T> = { data: T } | { error: string };

type Declaration = (input: { besoin: string }) => Promise<ActionResult<{ ok: boolean }>>;

/** Ce que la personne veut dire — c'est elle qui le dit, pas nous. */
type Nature = "handicap" | "amenagement";

interface DeclarationBesoinAdaptationFormProps {
  situationDeclaree: boolean;
  /** Handicap ou problème de santé → la situation est enregistrée comme telle. */
  declarerHandicapAction: Declaration;
  /** Aménagement sans handicap → le besoin est enregistré, la situation non. */
  declarerBesoinAmenagementAction: Declaration;
}

export function DeclarationBesoinAdaptationForm({
  situationDeclaree,
  declarerHandicapAction,
  declarerBesoinAmenagementAction,
}: DeclarationBesoinAdaptationFormProps): React.ReactElement {
  const [showForm, setShowForm] = useState(false);
  const [nature, setNature] = useState<Nature | null>(null);
  const [besoin, setBesoin] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [declaree, setDeclaree] = useState(situationDeclaree);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // 🔑 Aucune valeur par défaut : sans choix explicite, rien ne part. Un
    // défaut « handicap » recréerait exactement le défaut corrigé ici, et un
    // défaut « aménagement » perdrait une situation de handicap réelle.
    if (nature === null) {
      setError("Indiquez d’abord de quoi il s’agit.");
      return;
    }
    if (!besoin.trim()) return;
    setError(null);

    const action = nature === "handicap" ? declarerHandicapAction : declarerBesoinAmenagementAction;
    startTransition(async () => {
      const result = await action({ besoin: besoin.trim() });
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
          Votre besoin a bien été pris en compte. L&apos;équipe pédagogique adaptera les conditions
          si nécessaire.
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
        Vous pouvez nous signaler un besoin d&apos;aménagement pour suivre la formation, qu&apos;il
        soit lié ou non à un handicap.
      </p>

      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="text-primary focus-visible:ring-primary mt-3 rounded-sm text-sm underline hover:no-underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Signaler un besoin d&apos;aménagement
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <fieldset>
            {/* Le texte DIT ce qui sera enregistré dans chaque cas : c'est tout
                l'objet de ce correctif. Sans jargon, et sans le mot
                « handicap » sur l'option qui n'en est pas un. */}
            <legend className="text-fg-soft mb-2 block text-sm">De quoi s&apos;agit-il ?</legend>

            <label htmlFor="nature-amenagement" className="mt-1 flex items-start gap-2 text-sm">
              <input
                type="radio"
                id="nature-amenagement"
                name="nature-du-besoin"
                value="amenagement"
                checked={nature === "amenagement"}
                onChange={() => setNature("amenagement")}
                disabled={isPending}
                className="mt-1 shrink-0"
              />
              <span className="text-fg">
                J&apos;ai besoin d&apos;un aménagement pratique — matériel, rythme, accès à la
                salle, organisation.
                <span className="text-fg-muted block text-xs">
                  Nous enregistrons votre besoin et l&apos;équipe le prépare. Rien n&apos;est
                  enregistré comme une situation de handicap.
                </span>
              </span>
            </label>

            <label htmlFor="nature-handicap" className="mt-3 flex items-start gap-2 text-sm">
              <input
                type="radio"
                id="nature-handicap"
                name="nature-du-besoin"
                value="handicap"
                checked={nature === "handicap"}
                onChange={() => setNature("handicap")}
                disabled={isPending}
                className="mt-1 shrink-0"
              />
              <span className="text-fg">
                Je déclare une situation de handicap ou un problème de santé qui demande une
                adaptation.
                <span className="text-fg-muted block text-xs">
                  Votre dossier portera cette information, pour que le référent handicap organise ce
                  qu&apos;il faut.
                </span>
              </span>
            </label>
          </fieldset>

          <div>
            <label htmlFor="besoin-adaptation" className="text-fg-soft mb-1 block text-sm">
              Dites-nous ce dont vous avez besoin
            </label>
            <textarea
              id="besoin-adaptation"
              value={besoin}
              onChange={(e) => setBesoin(e.target.value)}
              disabled={isPending}
              rows={4}
              maxLength={2000}
              required
              className="border-border bg-paper text-fg placeholder:text-fg-muted focus-visible:border-border-strong focus-visible:ring-primary w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
              placeholder="Ex. : une pause plus longue, une place près de la porte, un support agrandi, un accès sans marche..."
            />
            {/* `text-fg-muted` et non un gris clair : cette ligne porte la
                promesse de confidentialité. Illisible, elle ne rassure
                personne — c'est le seul endroit où le chiffrement est dit. */}
            <p className="text-fg-muted mt-1 text-xs">
              Ce texte est chiffré. Seul le responsable habilité de l&apos;organisme peut le lire,
              et chaque lecture est tracée.
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
              disabled={isPending || !besoin.trim() || nature === null}
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
