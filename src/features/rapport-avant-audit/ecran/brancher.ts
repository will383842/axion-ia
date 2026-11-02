/**
 * LE raccord entre l'écran « Rapport d'analyse » et le vrai code du chantier (2026-11-02).
 *
 * Aujourd'hui : l'accès « pas encore installé ». Rien n'est lu, rien n'est lancé, rien n'est
 * téléchargeable ; l'écran le dit et le bouton reste éteint (`RAISON_NON_BRANCHE`).
 *
 * Une fois fusionnées la PR « persistance » (table `rapports_avant_audit`, `persistance.ts`,
 * action `lancerRapportAvantAudit(clientId)`) et la PR « sorties » (`baseEnJson`,
 * `baseEnMarkdown`, `ficheEnMarkdown`, `genererPdfClient`), remplacer le corps de
 * `accesRapports()` par une implémentation de `AccesRapports` qui délègue à ce code. C'est le
 * SEUL fichier de l'écran à modifier. Le raccord est décrit dans la PR de l'écran.
 */

import type { AccesRapports } from "./contrat";

export const ACCES_NON_BRANCHE: AccesRapports = {
  branche: false,
  listerRapports: async () => [],
  lireBase: async () => null,
  lirePropositions: async () => [],
  telecharger: async () => null,
  validerPdf: async () => ({
    ok: false,
    raison: "L'analyse n'est pas encore installée sur ce site.",
  }),
  lancer: async () => ({
    ok: false,
    raison: "L'analyse n'est pas encore installée sur ce site.",
  }),
};

export function accesRapports(): AccesRapports {
  return ACCES_NON_BRANCHE;
}
