"use client";
// use-client: ouverture à la demande du formulaire de retrait (chargé en `next/dynamic` au clic).
//
// Score IA TPE-PME — ancre `#retrait` de la page : accessible sans refaire le questionnaire.
// Aucun code de retrait, aucune saisie, aucun réseau tant que la personne n'a pas cliqué.

import * as React from "react";
import dynamic from "next/dynamic";
import { RETRAIT } from "@/content/score-ia-pme/textes";

const RetraitReponses = dynamic(() => import("./RetraitReponses").then((m) => m.RetraitReponses), {
  ssr: false,
});

export function RetraitBloc() {
  const [ouvert, setOuvert] = React.useState(false);
  return (
    <div className="min-h-[3rem]">
      {ouvert ? (
        <RetraitReponses />
      ) : (
        <button
          type="button"
          onClick={() => setOuvert(true)}
          className="border-ink/60 inline-flex min-h-[44px] items-center rounded-lg border px-4 text-sm font-medium"
        >
          {RETRAIT.titre}
        </button>
      )}
    </div>
  );
}
