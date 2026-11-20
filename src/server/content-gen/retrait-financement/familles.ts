/**
 * Retrait des mentions de financement — PR B : générateur d'overrides PAR FAMILLE (squelette).
 * Les fonctions sont écrites au commit suivant ; ce squelette sert au test rouge.
 */
export type Famille = "F1" | "F2" | "F3" | "F4" | "F5" | "F6" | "F7";
export interface CasAmbigu {
  cle: string;
  table: string;
  id: string;
  champ: string;
  message: string;
  passage: string;
  lignes: string[];
}
export interface EntreeOverride {
  contenu: string;
  champ: string;
  famille: "F1" | "F4";
  portee: "champ-entier" | "zone" | "element-faqJson";
  origine: string;
  remplacement: string;
  raison: string;
  pertesAcceptees: string[];
  empreinteOrigine: string | null;
  zoneEstimee: boolean;
  reponseOrigine?: string;
  reponseRemplacement?: string;
  consignes: string[];
}
export interface CasClasse {
  cas: CasAmbigu;
  famille: Famille;
}
export interface Sortie {
  auto: EntreeOverride[];
  agent: CasClasse[];
  aLaMain: CasClasse[];
}
const A_FAIRE = (): never => {
  throw new Error("non implémenté");
};
export const lireRapport = (_md: string): CasAmbigu[] => A_FAIRE();
export const classerAmbigus = (_cas: readonly CasAmbigu[]): CasClasse[] => A_FAIRE();
export const genererOverrides = (_cas: readonly CasAmbigu[]): Sortie => A_FAIRE();
export const refusReplacement = (_texte: string): string | null => A_FAIRE();
export const rendreOverridesAuto = (_s: Sortie): string => A_FAIRE();
export const rendreLotAgent = (_s: Sortie): string => A_FAIRE();
export const rendreALaMain = (_s: Sortie): string => A_FAIRE();
