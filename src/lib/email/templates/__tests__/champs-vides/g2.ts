/**
 * Champs vides du groupe G2 (lot L4g) : l'état RÉEL mesuré le 2026-11-17, sans toucher aucun gabarit.
 *
 * Une entrée = `gabarit|charge|motif` : `charge` vaut `vide` (charge `{}`) ou `exemple`
 * (`PAYLOAD_EXEMPLE`) ; `motif` dit ce qui fuit dans le sujet, le corps ou le texte
 * (`undefined`, `null`, `NaN`, `objet`, `salutation-virgule`, `virgule-seule`, `rendu-leve`).
 * Le test exige l'égalité des ensembles : un défaut nouveau rougit, et un défaut corrigé mais
 * encore listé rougit aussi. La liste ne fait que diminuer : la fiche de migration du groupe
 * (S4 à S11) vide ce fichier, et lui seul. Ne jamais y AJOUTER une ligne : corriger le gabarit.
 */
export const CHAMPS_VIDES_G2: readonly string[] = [
  "guide-ia-envoi|vide|undefined",
  "newsletter-confirm-optin|vide|undefined",
  "podcast-demande-recue|vide|undefined",
  "rappel-confirme|vide|undefined",
  "roi-report|vide|NaN",
  "roi-report|vide|undefined",
  "submission-reply|vide|rendu-leve",
];
