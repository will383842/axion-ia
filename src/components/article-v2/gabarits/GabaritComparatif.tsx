/**
 * Gabarit « Comparatif » — rend pour l'instant la mise en page Analyse (repli). La PR
 * G3 remplace ce rendu ; elle ne touche que ce fichier, sa feuille de style et
 * ses messages.
 */
import "@/styles/article-v2/comparatif.css";
import type { ArticleGabaritProps } from "../types";
import { MiseEnPageAnalyse } from "./GabaritAnalyse";

export function GabaritComparatif(p: ArticleGabaritProps) {
  return <MiseEnPageAnalyse p={p} cta="diagnostic" />;
}
