/**
 * Gabarit « Sélection » — rend pour l'instant la mise en page Analyse (repli). La PR
 * G4 remplace ce rendu ; elle ne touche que ce fichier, sa feuille de style et
 * ses messages.
 */
import "@/styles/article-v2/selection.css";
import type { ArticleGabaritProps } from "../types";
import { MiseEnPageAnalyse } from "./GabaritAnalyse";

export function GabaritSelection(p: ArticleGabaritProps) {
  return <MiseEnPageAnalyse p={p} cta="diagnostic" />;
}
