/**
 * Champs vides du groupe G5 (lot L4g) : l'état RÉEL mesuré le 2026-11-17 (détecteur complété après relecture), sans toucher aucun gabarit.
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
export const CHAMPS_VIDES_G5: readonly string[] = [
  "qualiopi-convocation|vide|undefined", // champ : titreFormation, dateDebut, dateFin, lieu, numeroSession, stagiairePrenomNom
  "qualiopi-rappel-j7|vide|espace-avant-point", // champ : dateDebut (« démarre le — . »)
  "qualiopi-rappel-j7|vide|salutation-virgule", // champ : stagiairePrenomNom (« Bonjour — »)
  "qualiopi-rappel-j1|vide|espace-avant-point", // champ : dateDebut, dateFin (« démarre le — . »)
  "qualiopi-rappel-j1|vide|salutation-virgule", // champ : stagiairePrenomNom (« Bonjour — »)
  "qualiopi-satisfaction-j1|vide|espace-avant-point", // champ : dateFinFormation (« terminée le . »)
  "qualiopi-satisfaction-j1|vide|lien-vide", // champ : lienQuestionnaire (bouton sans href)
  "qualiopi-satisfaction-j1|vide|salutation-virgule", // champ : stagiairePrenomNom (« Bonjour — »)
  "qualiopi-suivi-j30|vide|salutation-virgule", // champ : stagiairePrenomNom (« Bonjour — »)
  "qualiopi-positionnement|vide|espace-avant-point", // champ : numeroSession (« Session . »)
  "qualiopi-positionnement|vide|salutation-virgule", // champ : stagiairePrenomNom (« Bonjour — »)
  "qualiopi-questionnaire-relance|vide|salutation-virgule", // champ : stagiairePrenomNom (« Bonjour — »)
  "qualiopi-enquete-entreprise|vide|lien-vide", // champ : lienEnquete (bouton sans href)
  "qualiopi-enquete-entreprise|vide|salutation-virgule", // champ : contactNom (« Bonjour — »)
  "qualiopi-attestation-disponible|vide|salutation-virgule", // champ : stagiairePrenomNom (« Bonjour — »)
  "qualiopi-portail-acces|vide|salutation-virgule", // champ : stagiairePrenomNom (« Bonjour — »)
  "qualiopi-emargement-lien|vide|espace-avant-point", // champ : titreFormation, numeroSession, dateDebutFormation
  "qualiopi-emargement-lien|vide|salutation-virgule", // champ : stagiairePrenomNom (« Bonjour — »)
  "qualiopi-presence-confirmation|vide|rendu-leve", // champ : lienPresence (absent : le gabarit lève volontairement)
  "qualiopi-presence-entreprise|vide|espace-avant-point", // champ : titreFormation, dateDebutFormation (« débute le . »)
  "documents-nouvelle-version|vide|parentheses-vides", // champ : familleLabel, interventionLabel (« Document () »)
  "documents-nouvelle-version|vide|undefined", // champ : version
];
