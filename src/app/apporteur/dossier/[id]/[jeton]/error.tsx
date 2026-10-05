"use client";
// use-client: convention Next — une page d'erreur de segment est un composant client.

// L'affichage ou un enregistrement du dossier en ligne a échoué (panne de base, clé de
// chiffrement absente…). L'apporteur garde la même coquille plutôt que la page générique.

import { Coquille } from "./Coquille";
import { ADRESSE_CONTACT, TEXTES } from "./textes";

export default function ErreurDossier({ retry }: { error: Error; retry: () => void }) {
  return (
    <Coquille>
      <section aria-labelledby="erreur-titre" className="bg-paper bg-halo-warm shadow-card rounded-3xl p-6 sm:p-8">
        <h1 id="erreur-titre" className="font-serif text-[30px] leading-tight font-medium tracking-tight">
          {TEXTES.erreurTitre}
        </h1>
        <p className="text-fg-soft mt-3 text-[18px] leading-relaxed">
          {TEXTES.erreurLigne}{" "}
          <a
            href={`mailto:${ADRESSE_CONTACT}`}
            className="text-terracotta-deep font-semibold underline underline-offset-4"
          >
            {ADRESSE_CONTACT}
          </a>
          .
        </p>
        <button
          type="button"
          onClick={() => retry()}
          className="bg-terracotta hover:bg-terracotta-deep focus-visible:outline-terracotta mt-6 inline-flex min-h-[52px] items-center justify-center rounded-full px-7 text-[18px] font-bold text-white focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-solid"
        >
          {TEXTES.reessayer}
        </button>
      </section>
    </Coquille>
  );
}
