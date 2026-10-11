/**
 * Statut juridique d'une entreprise — liste fermée NEUTRE (FAC-5), sortie du dossier
 * apporteur. Module pur.
 */

/** Liste fermée de Partners (`StatutJuridique`, PR #727), avec ses libellés. */
export const STATUTS_JURIDIQUES = [
  { valeur: "micro_entrepreneur", libelle: "Micro-entrepreneur (auto-entrepreneur)" },
  { valeur: "entrepreneur_individuel", libelle: "Entrepreneur individuel (hors micro)" },
  { valeur: "eurl", libelle: "EURL" },
  { valeur: "sarl", libelle: "SARL" },
  { valeur: "sasu", libelle: "SASU" },
  { valeur: "sas", libelle: "SAS" },
  { valeur: "sa", libelle: "SA" },
  { valeur: "snc", libelle: "SNC" },
] as const;
export type StatutJuridique = (typeof STATUTS_JURIDIQUES)[number]["valeur"];

export function estStatutJuridique(v: unknown): v is StatutJuridique {
  return STATUTS_JURIDIQUES.some((s) => s.valeur === v);
}
