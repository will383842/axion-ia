// Accès en LECTURE aux pièces de l'apporteur (PR K, #2464) : autofactures, relevés, contrat.
// Pur, sans accès base. Un apporteur signé hors mode restreint, ou résilié (avec ou sans
// argent en jeu), peut lire et enregistrer SES pièces. Le contrôle « ce numéro est à lui »
// reste dans chaque route ; ce garde ne remplace que le contrôle de statut.
import type { DossierVue } from "./donnees";

export function peutLireSesPieces(
  d: Pick<DossierVue, "statut" | "restreint" | "archive">,
): boolean {
  if (d.statut === "resilie") return true;
  return d.statut === "signe" && !d.restreint;
}
