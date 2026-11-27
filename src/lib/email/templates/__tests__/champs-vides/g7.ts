/**
 * Champs vides du groupe G7 (lot L4g) : l'état RÉEL mesuré le 2026-11-17 (détecteur complété après relecture), sans toucher aucun gabarit.
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
export const CHAMPS_VIDES_G7: readonly string[] = [
  "lead-apporteur-recu|vide|lien-vide", // champ : dossierUrl (bouton sans href)
  "lead-apporteur-relance|vide|lien-vide", // champ : dossierUrl (bouton sans href)
  "apporteur-invitation-appel|vide|lien-vide", // champ : calendlyUrl (bouton sans href)
  "apporteur-invitation-relance|vide|lien-vide", // champ : calendlyUrl (bouton sans href)
  // EXCEPTION VOULUE (relecture #2414, point 3) : e-mail de sécurité, il lève sans ses deux liens
  // plutôt que de partir sans moyen de bloquer la demande. Ne pas « corriger » : le gabarit doit lever.
  "apporteur-compte-a-confirmer|vide|rendu-leve", // champs : lienConfirmer, lienBloquer
];
