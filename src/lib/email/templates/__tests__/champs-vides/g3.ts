/**
 * Champs vides du groupe G3 (lot L4g) : l'état RÉEL mesuré le 2026-11-17 (détecteur complété après relecture), sans toucher aucun gabarit.
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
export const CHAMPS_VIDES_G3: readonly string[] = [
  "gdpr-export-link|vide|lien-vide", // champ : exportUrl (bouton sans href)
  "gdpr-export-link|vide|undefined", // champ : expiresHours
  "rgpd-demande-recue|vide|undefined", // champ : reference, deposeeLe
  "rgpd-effacement-confirme|vide|undefined", // champ : compteurs demandes, newsletter, candidatures, appels, conversations…
  "reclamation-accuse|vide|undefined", // champ : numero, recueLe, reponseAvant
  "reclamation-reponse|vide|undefined", // champ : numero, signataireNom
  "reclamation-reponse|vide|virgule-seule", // champ : signataireNom, signataireQualite (« {nom}, {qualité} »)
];
