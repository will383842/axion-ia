/**
 * Aiguillage des gabarits d'articles de blog (S1 : squelette ; S2 : composants
 * communs, huit fichiers de gabarit, feuilles de style). Composant SERVEUR,
 * aucun JavaScript client.
 *
 * Reçoit le HTML et la table des matières BRUTS (tels que `buildToc` les a
 * produits) : chaque gabarit construit lui-même son sommaire.
 *
 * Le conteneur est un `<div data-gabarit>` et non un `<main>` : le landmark
 * `main` et la cible du skip-link sont portés par le layout.
 */
import type { ComponentType } from "react";
import "@/styles/article-v2/socle.css";
import "@/styles/article-v2/complements.css";
import type { GabaritArticle } from "@/server/content-gen/blog/gabarits";
import type { ArticleGabaritProps } from "./types";
import { GabaritAnalyse } from "./gabarits/GabaritAnalyse";
import { GabaritGuide } from "./gabarits/GabaritGuide";
import { GabaritComparatif } from "./gabarits/GabaritComparatif";
import { GabaritSelection } from "./gabarits/GabaritSelection";
import { GabaritCas } from "./gabarits/GabaritCas";
import { GabaritDefinition } from "./gabarits/GabaritDefinition";
import { GabaritFaq } from "./gabarits/GabaritFaq";
import { GabaritChiffres } from "./gabarits/GabaritChiffres";

export type { ArticleGabaritProps, BlocCorps } from "./types";

/** Table exhaustive : un code de gabarit ajouté sans composant casse la compilation. */
const GABARITS: Record<GabaritArticle, ComponentType<ArticleGabaritProps>> = {
  analyse: GabaritAnalyse,
  guide: GabaritGuide,
  comparatif: GabaritComparatif,
  selection: GabaritSelection,
  cas: GabaritCas,
  definition: GabaritDefinition,
  faq: GabaritFaq,
  chiffres: GabaritChiffres,
};

export function ArticleGabarit(p: ArticleGabaritProps) {
  const Gabarit = GABARITS[p.gabarit] ?? GabaritAnalyse;
  return <Gabarit {...p} />;
}
