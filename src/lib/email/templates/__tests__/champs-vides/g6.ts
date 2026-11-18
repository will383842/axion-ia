/**
 * Champs vides du groupe G6 (lot L4g) : l'état RÉEL mesuré le 2026-11-17 (détecteur complété après relecture), sans toucher aucun gabarit.
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
export const CHAMPS_VIDES_G6: readonly string[] = [
  "qualiopi-adaptation-formateur|vide|espace-avant-virgule", // champ : titreFormation (« pour la formation , »)
  "qualiopi-adaptation-formateur|vide|virgule-seule", // champ : titreFormation (« pour la formation , »)
  "formateur-magic-link|vide|lien-vide", // champ : magicLink (bouton sans href)
  "formateur-mission-proposee|vide|espace-avant-point", // champ : dateDebut, dateFin, dateLimiteReponse, numeroSession
  "formateur-mission-proposee|vide|espace-avant-virgule", // champ : dateFin, dateLimiteReponse (« du au , »)
  "formateur-mission-proposee|vide|lien-vide", // champ : lienReponse (bouton sans href)
  "formateur-mission-proposee|vide|salutation-virgule", // champ : prenom / formateurPrenomNom (« Bonjour — »)
  "formateur-mission-proposee|vide|virgule-seule", // champ : dateFin, dateLimiteReponse (« du au , »)
  "formateur-convocation-j7|vide|espace-avant-point", // champ : dateDebut (« à partir du — . »)
  "formateur-convocation-j7|vide|lien-vide", // champ : lienEspace (bouton sans href)
  "formateur-convocation-j7|vide|salutation-virgule", // champ : formateurPrenomNom (« Bonjour — »)
  "formateur-convocation-j7|vide|undefined", // champ : dateDebut, dateFin (« Dates : du undefined au undefined »)
  "formateur-rappel-j1|vide|espace-avant-point", // champ : dateDebut, lieu (« le — . »)
  "formateur-rappel-j1|vide|lien-vide", // champ : lienEspace (bouton sans href)
  "formateur-rappel-j1|vide|salutation-virgule", // champ : formateurPrenomNom (« Bonjour — »)
  "formateur-rappel-j1|vide|undefined", // champ : dateDebut, dateFin (« Dates : du undefined au undefined »)
  "formateur-contresignature|vide|lien-vide", // champ : lienEspace (bouton sans href)
  "formateur-contresignature|vide|parentheses-vides", // champ : titreFormation / numeroSession (« pour () »)
  "formateur-contresignature|vide|salutation-virgule", // champ : formateurPrenomNom (« Bonjour — »)
  "formateur-contrat-travail|vide|espace-avant-point", // champ : numeroPiece (« Référence de la pièce : . »)
  "formateur-contrat-travail|vide|espace-avant-virgule", // champ : formateurPrenomNom, natureContrat (« Bonjour , votre est établi »)
  "formateur-contrat-travail|vide|lien-vide", // champ : lienEspace (bouton sans href)
  "formateur-contrat-travail|vide|salutation-virgule", // champ : formateurPrenomNom (« Bonjour — »)
  "formateur-contrat-travail|vide|virgule-seule", // champ : formateurPrenomNom, natureContrat (« Bonjour , votre est établi »)
];
