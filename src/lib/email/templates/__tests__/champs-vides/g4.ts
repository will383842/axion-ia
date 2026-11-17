/**
 * Champs vides du groupe G4 (lot L4g) : l'état RÉEL mesuré le 2026-11-17 (détecteur complété après relecture), sans toucher aucun gabarit.
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
export const CHAMPS_VIDES_G4: readonly string[] = [
  "payment-link|vide|lien-vide", // champ : checkoutUrl (bouton sans href)
  "payment-link|vide|undefined", // champ : contactName, invoiceNumber, amountTtc, expiresAt
  "payment-receipt|vide|lien-vide", // champ : bookingId (href …/booking/undefined)
  "payment-receipt|vide|undefined", // champ : contactName, amountTtc, invoiceNumber, paidAt, bookingId
  "payment-failed|vide|undefined", // champ : contactName, amountTtc, invoiceNumber
  "force-majeure-notice|vide|undefined", // champ : contactName, interventionType, notes, bookingId
  "cancellation-confirmed-by-user|vide|undefined", // champ : contactName, bookingId
  "qualiopi-relance-impayee|vide|espace-avant-point", // champ : destinataireNom (« Bonjour . »)
  "qualiopi-relance-impayee|vide|espace-avant-virgule", // champ : numeroFacture, montantDu, dateEcheance
  "qualiopi-relance-impayee|vide|virgule-seule", // champ : numeroFacture, montantDu, dateEcheance, joursRetard
  "devis-envoi|vide|espace-avant-virgule", // champ : numero (« votre devis , »)
  "devis-envoi|vide|virgule-seule", // champ : numero (« votre devis , »)
  "devis-commande-confirmation|vide|espace-avant-point", // champ : numero (« devis . »)
  "devis-commande-confirmation|vide|espace-avant-virgule", // champ : montantHtLabel, montantTvaLabel, montantTtcLabel
  "devis-commande-confirmation|vide|virgule-seule", // champ : montantHtLabel, montantTvaLabel, montantTtcLabel
  "relance-devis-client|vide|espace-avant-point", // champ : numero (« le devis . »)
  "facture-envoi|vide|espace-avant-virgule", // champ : numero (« votre facture , »)
  "facture-envoi|vide|virgule-seule", // champ : numero (« votre facture , »)
  "autofacture-transmission|vide|espace-avant-point", // champ : numero (« la facture d'honoraires . »)
  "opco-suivi-entreprise|vide|espace-avant-virgule", // champ : intituleFormation, numeroSession, dateDebutSession
  "opco-suivi-entreprise|vide|virgule-seule", // champ : intituleFormation, numeroSession, dateDebutSession
];
