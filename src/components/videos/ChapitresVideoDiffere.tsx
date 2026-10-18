"use client";
// use-client: charge l'île des chapitres à la demande (import dynamique).

// Les chapitres et le `?t=` entrant vivent dans un chunk à part, hors du `page-*.js` sommé par
// le cliquet « Poids du bundle ». Le rendu SERVEUR est conservé (l'import dynamique garde son rendu serveur) : la liste
// est dans le HTML, donc rien ne s'insère après l'hydratation et le CLS reste nul, sans place
// réservée à deviner (marges fusionnées, titres sur plusieurs lignes).
import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { ChapitresVideo as ChapitresVideoType } from "./ChapitresVideo";

type Props = ComponentProps<typeof ChapitresVideoType>;

const Chapitres = dynamic(() => import("./ChapitresVideo").then((m) => m.ChapitresVideo));

export function ChapitresVideoDiffere(props: Props) {
  return <Chapitres {...props} />;
}
