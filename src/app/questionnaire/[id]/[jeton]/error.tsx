"use client";
// use-client: convention Next — une page d'erreur de segment est un composant client.

// L'envoi (ou l'affichage) du questionnaire en ligne a échoué : panne de base,
// clé de chiffrement absente… Sans cette page, le client tomberait sur la page
// générique du site (`global-error.tsx`). Ici, il garde la même coquille, et
// apprend que ses réponses sont toujours sur son appareil : le brouillon local
// n'est effacé qu'à l'écran « Merci, c'est reçu » (avis de l'architecte, C5).

import { Coquille } from "./Coquille";
import { ADRESSE_CONTACT, TEXTES_ERREUR } from "./textes";

export default function ErreurQuestionnaire({ retry }: { error: Error; retry: () => void }) {
  return (
    <Coquille>
      <section
        aria-labelledby="erreur-titre"
        className="bg-paper bg-halo-warm shadow-card rounded-3xl p-7 sm:p-10"
      >
        <h1
          id="erreur-titre"
          className="font-serif text-[34px] leading-tight font-medium tracking-tight sm:text-[40px]"
        >
          {TEXTES_ERREUR.titre}
        </h1>
        <p className="text-fg-soft mt-3 text-[20px] leading-relaxed">
          {TEXTES_ERREUR.ligne}{" "}
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
          className="bg-terracotta hover:bg-terracotta-deep focus-visible:outline-terracotta mt-6 inline-flex min-h-[56px] items-center justify-center rounded-full px-8 text-[19px] font-bold text-white focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-solid"
        >
          {TEXTES_ERREUR.reessayer}
        </button>
      </section>
    </Coquille>
  );
}
