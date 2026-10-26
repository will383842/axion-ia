// 404 propre au Tour de France IA : la coquille du Tour (aucun en-tête d'Axion),
// `noindex`, un seul lien utile. Rendue par `notFound()` sous `/tourdefrance-ia`
// (`[...reste]/page.tsx` y envoie toute adresse inconnue du Tour).
//
// ⚠️ Tant que le Tour est fermé, un visiteur sans aperçu n'arrive jamais ici : le
// proxy répond 404 en texte brut avant le rendu (`features/tour-de-france/porte.ts`).

import type { Metadata } from "next";
import Link from "next/link";

import { NOM_DU_TOUR } from "./contenu";

export const metadata: Metadata = {
  title: { absolute: `Page introuvable · ${NOM_DU_TOUR}` },
  robots: { index: false, follow: false },
};

export default function TourIntrouvable() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col items-start justify-center px-4">
      <p className="text-fg-muted font-mono text-sm tracking-[0.08em] uppercase">{NOM_DU_TOUR}</p>
      <h1 className="text-fg mt-4 font-serif text-4xl leading-tight font-medium">
        Cette page n’existe pas.
      </h1>
      <Link
        href="/tourdefrance-ia"
        className="text-fg decoration-border-strong hover:decoration-terracotta mt-6 inline-flex min-h-11 items-center underline decoration-1 underline-offset-4"
      >
        Retour au Tour de France IA
      </Link>
    </main>
  );
}
