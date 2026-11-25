"use client";
// use-client: état du formulaire d'aide (useActionState) : erreurs et confirmation sans recharger.

// Deux champs, chacun relié à son libellé ; l'aide et l'erreur sont rattachées au champ
// (`aria-describedby`) et l'erreur est annoncée (`role="alert"`). Toute la validation fait foi
// côté serveur ; les attributs HTML ne font qu'aider. Sans JavaScript, le formulaire part quand
// même (action serveur).

import { useActionState } from "react";

import {
  MESSAGE_AIDE_MAX,
  MESSAGE_AIDE_MIN,
  SUJETS_AIDE,
  TEXTES_AIDE as T,
  type EtatDemandeAide,
} from "@/features/apporteurs-reseau/demande-aide-textes";

const champ =
  "border-border-strong bg-paper focus:border-terracotta focus:outline-terracotta mt-1 block w-full rounded-xl border px-3.5 text-[17px] focus:outline-2 focus:outline-offset-1";
const etiquette = "text-fg-soft block text-[15px] font-semibold";

export function FormulaireAide({
  envoyerAction,
}: {
  envoyerAction: (etat: EtatDemandeAide | undefined, fd: FormData) => Promise<EtatDemandeAide>;
}) {
  const [etat, action, enCours] = useActionState<EtatDemandeAide | undefined, FormData>(
    envoyerAction,
    undefined,
  );

  if (etat?.ok) {
    return (
      <p role="status" className="bg-sand mt-6 rounded-2xl p-5 text-[17px] leading-relaxed">
        {T.confirmation}
      </p>
    );
  }

  const erreur = etat && !etat.ok ? etat : null;
  const surSujet = erreur?.champ === "sujet";
  const surMessage = erreur?.champ === "message";

  return (
    <form action={action} className="mt-6 grid gap-4" aria-busy={enCours}>
      <div>
        <label htmlFor="aide-sujet" className={etiquette}>
          {T.sujet}
        </label>
        <select
          id="aide-sujet"
          name="sujet"
          required
          // Après un refus, React vide le formulaire : la saisie rendue par l'action le remplit.
          key={`sujet-${erreur?.saisie?.sujet ?? ""}`}
          defaultValue={erreur?.saisie?.sujet ?? ""}
          aria-invalid={surSujet || undefined}
          aria-describedby={surSujet ? "aide-erreur" : undefined}
          className={`${champ} min-h-[52px]`}
        >
          <option value="" disabled>
            {T.choisir}
          </option>
          {SUJETS_AIDE.map((s) => (
            <option key={s.cle} value={s.cle}>
              {s.libelle}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="aide-message" className={etiquette}>
          {T.message}
        </label>
        <textarea
          id="aide-message"
          name="message"
          required
          rows={7}
          minLength={MESSAGE_AIDE_MIN}
          maxLength={MESSAGE_AIDE_MAX}
          defaultValue={erreur?.saisie?.message ?? ""}
          aria-invalid={surMessage || undefined}
          aria-describedby={`aide-message-aide${surMessage ? " aide-erreur" : ""}`}
          className={`${champ} py-3 leading-relaxed`}
        />
        <p id="aide-message-aide" className="text-fg-soft mt-2 text-[15px]">
          <strong className="text-fg">{T.jamaisBancaire}</strong> {T.aideMessage}
        </p>
      </div>
      {erreur ? (
        <p
          id="aide-erreur"
          role="alert"
          className="bg-terracotta-soft text-error rounded-xl p-3 text-[16px] font-semibold"
        >
          {erreur.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={enCours}
        className="bg-terracotta hover:bg-terracotta-deep focus-visible:outline-terracotta disabled:bg-sand-deep disabled:text-fg-soft inline-flex min-h-[56px] w-full items-center justify-center rounded-2xl px-6 text-[18px] font-bold text-white focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-solid disabled:cursor-not-allowed"
      >
        {enCours ? T.envoi : T.envoyer}
      </button>
    </form>
  );
}
