/**
 * Champs vides du groupe G2 (lot L4g) : l'état RÉEL mesuré le 2026-11-17 (détecteur complété après relecture), sans toucher aucun gabarit.
 *
 * Une entrée = `gabarit|charge|motif` : `charge` vaut `vide` (charge `{}`) ou `exemple`
 * (`PAYLOAD_EXEMPLE`) ; `motif` dit ce qui fuit dans le sujet, le corps ou le texte
 * (`undefined`, `null`, `NaN`, `objet`, `salutation-virgule`, `virgule-seule`, `rendu-leve`, `parentheses-vides`, `date-invalide`, `espace-avant-virgule`, `espace-avant-point`, `lien-vide`).
 * Le test exige l'égalité des ensembles : un défaut nouveau rougit, et un défaut corrigé mais
 * encore listé rougit aussi. La liste ne fait que diminuer : la fiche de migration du groupe
 * (S4 à S11) vide ce fichier, et lui seul. Ne jamais y AJOUTER une ligne : corriger le gabarit.
 * Le commentaire en fin de ligne nomme le champ de la charge en cause. Tout défaut vaut pour les
 * deux langues (fr et en) sauf mention contraire. Toute PR qui corrige un gabarit listé retire sa ligne
 * de ce fichier.
 */
export const CHAMPS_VIDES_G2: readonly string[] = [
  "newsletter-confirm-optin|vide|lien-vide", // champ : confirmToken (href …?token=undefined)
  "newsletter-confirm-optin|vide|undefined", // champ : confirmToken (jeton dans l'adresse)
  "guide-ia-envoi|vide|lien-vide", // champ : downloadToken (href …?t=undefined)
  "guide-ia-envoi|vide|undefined", // champ : downloadToken (jeton dans l'adresse)
  "roi-report|vide|NaN", // champ : savedEurLow, savedEurHigh, savedEurPerYear, savedHoursPerYear, fteRecovered (formatés sans garde)
  "roi-report|vide|lien-vide", // champ : reportUrl (bouton sans href)
  "roi-report|vide|undefined", // champ : sectorLabel, headcount (« votre entreprise (undefined, undefined personne) »)
  "podcast-demande-recue|vide|undefined", // champ : leaderName, companyName, city
  "rappel-confirme|vide|undefined", // champ : telephone
  "submission-reply|vide|rendu-leve", // champ : bodyMarkdown (absent : paragraphes(undefined) lève sur .split)
  "ressources-magic-link|vide|lien-vide", // champ : magicLink (bouton sans href)
];
