// GEL DES 4 GÉNÉRATEURS ANNEXES DE PAGES VILLE
// ─────────────────────────────────────────────────────────────────────────────
// Écosystème, secteurs, FAQ étendue, cas d'usage. Aucune page (`src/app`) ne lit
// les tables qu'ils étaient censés remplir (generated_ville_ecosystem, _secteurs,
// _faq_extended, _cas_usage). Le prompt « cas d'usage » demande même des gains
// chiffrés plausibles. Coût et risque dormants, aucun bénéfice : on gèle.
//
// Gel PAR DÉFAUT. Réactivation sans déploiement de code :
//   VILLES_GENERATEURS_ANNEXES_ACTIFS=true
// Retour arrière = mettre la variable à "true" (ou revert de la PR).
//
// NE SONT PAS gelés : `landing-ville-economic-data` et `ville-hub-copy`, qui
// servent les pages.
//
// Lecture de process.env à l'appel (pas à l'import) : réactivable sans rebuild
// et testable. Valeur strictement "true", toute autre valeur laisse le gel.
// ─────────────────────────────────────────────────────────────────────────────

export const TYPES_GENERATEURS_ANNEXES_VILLE = [
  "landing-ville-cas-usage",
  "landing-ville-ecosystem",
  "landing-ville-faq-extended",
  "landing-ville-secteurs",
] as const;

export function generateurAnnexeVilleGele(type: string): boolean {
  if (!(TYPES_GENERATEURS_ANNEXES_VILLE as readonly string[]).includes(type)) return false;
  return process.env.VILLES_GENERATEURS_ANNEXES_ACTIFS !== "true";
}

export const MESSAGE_GENERATEUR_ANNEXE_GELE =
  "générateur annexe ville gelé (aucune page ne lit sa table) — réactivable avec VILLES_GENERATEURS_ANNEXES_ACTIFS=true";
