"use client";
// use-client: état de l'envoi (useActionState) + jeton Turnstile ; la soumission reste un formulaire natif.

import { startTransition, useActionState, useCallback, useState } from "react";
import dynamic from "next/dynamic";
import type {
  EtatQuestionnaire,
  envoyerQuestionnaireAction,
} from "@/server/actions/equipe/questionnaire";

// Turnstile n'a pas à peser dans le JS initial de la page.
const TurnstileDiffere = dynamic(
  () => import("@/components/forms/TurnstileWidget").then((m) => m.TurnstileWidget),
  { ssr: false },
);

const ETAT_INITIAL: EtatQuestionnaire = { etat: "initial" };

export function FormulaireQuestionnaire({
  action,
  classeBouton,
  messageNeutre,
  children,
}: {
  action: typeof envoyerQuestionnaireAction;
  classeBouton: string;
  messageNeutre: string;
  children: React.ReactNode;
}) {
  const [etat, soumettre, enCours] = useActionState(action, ETAT_INITIAL);
  const [token, setToken] = useState("");
  const effacerToken = useCallback(() => setToken(""), []);

  if (etat.etat === "recu") {
    return (
      <div role="status" className="border-border bg-paper rounded-lg border p-6">
        <p className="text-mocha font-serif text-lg font-semibold">
          Merci, votre fiche sera relue avant sa mise en ligne.
        </p>
        {etat.photo === "echec" && (
          <p className="text-fg-soft mt-2 text-sm">
            Votre photo n&apos;a pas pu être enregistrée ; l&apos;équipe vous recontactera.
          </p>
        )}
        {etat.photo === "non-appliquee" && (
          <p className="text-fg-soft mt-2 text-sm">
            Votre page est déjà en ligne : votre nouvelle photo sera examinée avec le reste.
          </p>
        )}
      </div>
    );
  }
  if (etat.etat === "neutre") {
    return (
      <p role="alert" className="text-fg text-sm">
        {messageNeutre}
      </p>
    );
  }

  return (
    // `onSubmit` plutôt que `action` : avec `action`, React vide le formulaire après chaque envoi, et une
    // présentation de 300 caractères refusée serait perdue (la limite par jeton empêcherait de la réécrire).
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const donnees = new FormData(e.currentTarget);
        startTransition(() => soumettre(donnees));
      }}
      className="flex flex-col gap-5"
    >
      <input type="hidden" name="cf-turnstile-response" value={token} />
      {children}
      {etat.etat === "erreur" && (
        <p role="alert" className="text-terracotta text-sm">
          {etat.message}
        </p>
      )}
      <TurnstileDiffere action="equipe-questionnaire" onToken={setToken} onExpire={effacerToken} />
      <button type="submit" disabled={enCours} className={classeBouton}>
        {enCours ? "Envoi…" : "Envoyer mes réponses"}
      </button>
    </form>
  );
}
