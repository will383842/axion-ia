/**
 * Gabarit « Questions-réponses » — rend pour l'instant la mise en page Analyse (repli). La PR
 * G7 remplace ce rendu ; elle ne touche que ce fichier, sa feuille de style et
 * ses messages.
 */
import type { ArticleGabaritProps } from "../types";
import { MiseEnPageAnalyse } from "./GabaritAnalyse";

export function GabaritFaq(p: ArticleGabaritProps) {
  return <MiseEnPageAnalyse p={p} cta="rdv" />;
}
