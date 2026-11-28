"use client";
// use-client: état de l'envoi (useActionState) + jeton Turnstile ; la soumission reste un formulaire natif.

import { startTransition, useActionState, useCallback, useState } from "react";
import dynamic from "next/dynamic";
import type { EtatRetrait, retirerParLienAction } from "@/server/actions/equipe/retrait";

const TurnstileDiffere = dynamic(
  () => import("@/components/forms/TurnstileWidget").then((m) => m.TurnstileWidget),
  { ssr: false },
);

const ETAT_INITIAL: EtatRetrait = { etat: "initial" };

const CONFIRMATIONS: Record<"total" | "photo" | "linkedin", string> = {
  total: "Votre page est retirée du site. Elle n'est plus visible.",
  photo: "Votre photo est retirée : un avatar la remplace.",
  linkedin: "Votre lien LinkedIn est retiré de votre page.",
};

export function FormulaireRetrait({
  action,
  jeton,
  classeBouton,
  peutRetirerPhoto,
  peutRetirerLinkedin,
}: {
  action: typeof retirerParLienAction;
  jeton: string;
  classeBouton: string;
  peutRetirerPhoto: boolean;
  peutRetirerLinkedin: boolean;
}) {
  const [etat, soumettre, enCours] = useActionState(action, ETAT_INITIAL);
  const [token, setToken] = useState("");
  const effacerToken = useCallback(() => setToken(""), []);

  if (etat.etat === "fait") {
    return (
      <div role="status" className="border-border bg-paper rounded-lg border p-6">
        <p className="text-mocha font-serif text-lg font-semibold">{CONFIRMATIONS[etat.portee]}</p>
        <p className="text-fg-soft mt-2 text-sm">
          Pour effacer aussi vos données, répondez simplement à notre dernier message : nous le
          ferons.
        </p>
      </div>
    );
  }
  if (etat.etat === "neutre") {
    return (
      <p role="alert" className="text-fg text-sm">
        {etat.message}
      </p>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const donnees = new FormData(e.currentTarget);
        startTransition(() => soumettre(donnees));
      }}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="jeton" value={jeton} />
      <input type="hidden" name="cf-turnstile-response" value={token} />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-fg mb-1 text-sm font-medium">Que voulez-vous retirer ?</legend>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="portee" value="total" defaultChecked className="mt-1" />
          <span>Toute ma page (elle disparaît du site tout de suite)</span>
        </label>
        {peutRetirerPhoto && (
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="portee" value="photo" className="mt-1" />
            <span>Seulement ma photo (un avatar la remplace)</span>
          </label>
        )}
        {peutRetirerLinkedin && (
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="portee" value="linkedin" className="mt-1" />
            <span>Seulement mon lien LinkedIn</span>
          </label>
        )}
      </fieldset>
      {etat.etat === "erreur" && (
        <p role="alert" className="text-terracotta text-sm">
          {etat.message}
        </p>
      )}
      <TurnstileDiffere action="equipe-retrait" onToken={setToken} onExpire={effacerToken} />
      <button type="submit" disabled={enCours} className={classeBouton}>
        {enCours ? "Envoi…" : "Retirer"}
      </button>
    </form>
  );
}
