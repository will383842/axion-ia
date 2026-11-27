// Lot 5 : les textes de « Mon compte bancaire » (plan §12.1, §12.2), MOT POUR MOT.
// Textes soumis à la relecture du dirigeant (D-10) : ne pas les retoucher sans elle.
export const TEXTES_COMPTE = {
  titre: "Mon compte bancaire",
  compteActuel: (fin4: string) => `Nous versons vos commissions sur le compte qui se termine par ${fin4}.`,
  changer: "Changer de compte",
  formTitre: "Changer de compte bancaire",
  formIban: "Votre nouvel IBAN",
  formRib: "Le RIB de ce compte (PDF ou photo, 10 Mo au plus)",
  formRibAide: "Le compte doit être à votre nom ou à celui de votre entreprise.",
  ceQuiVaSePasser: "Ce qui va se passer",
  etape1: "Nous vous envoyons un e-mail. Vous cliquez dessus pour confirmer.",
  etape2: "Nous vérifions votre RIB et nous vous appelons. Cela prend au moins 3 jours.",
  etape3:
    "Tant que le changement n'est pas validé, nos virements vers vous sont en attente. Vos commissions continuent d'être enregistrées, et le virement part dès la décision.",
  envoyer: "Envoyer ma demande",
  regardezTitre: "Regardez vos e-mails",
  regardezLigne: "Nous venons de vous écrire. Cliquez sur le bouton de cet e-mail pour confirmer. Vous avez 24 heures.",
  annuler: "Annuler ma demande",
  enCoursTitre: "Demande en cours",
  enCoursLigne: (demandee: string, reponse: string, fin4: string) =>
    `Vous avez demandé à changer de compte le ${demandee}. Nous vérifions votre RIB et nous vous appelons. Réponse au plus tôt le ${reponse}. Tant que la décision n'est pas prise, nos virements vers vous sont en attente ; vos commissions continuent d'être enregistrées. Compte actuel : celui qui se termine par ${fin4}.`,
  refuseTitre: "Votre demande n'a pas été acceptée",
  refuseRaison: "Raison :",
  refuseLigne: "Votre compte n'a pas changé. Vous pouvez faire une nouvelle demande.",
  sansTelTitre: "Changer de compte",
  sansTelLigne:
    "Nous avons besoin de vous appeler pour vérifier un changement de compte, et nous n'avons pas de numéro de téléphone pour vous. Écrivez-nous pour nous le donner : nous reviendrons vers vous.",
  ferme: "Pour changer de compte, écrivez-nous.",
  erreurIbanInvalide: "Cet IBAN n'est pas valide. Vérifiez-le.",
  erreurRibManque: "Ajoutez le RIB du nouveau compte.",
  erreurFichier: "Ce fichier n'est pas accepté. Envoyez un PDF, un PNG ou un JPG de 10 Mo au plus.",
  erreurTrop: "Vous avez fait trop de demandes. Écrivez-nous.",
  erreurFerme: "Ce service est fermé pour le moment. Écrivez-nous.",
  erreurNeutre: "La demande n'a pas pu être enregistrée. Réessayez.",
  // Pages des liens (§12.2)
  confirmerTitre: "Confirmer le changement de compte",
  confirmerLigne: "Vous demandez que vos commissions soient versées sur un nouveau compte.",
  confirmerBouton: "Oui, je confirme",
  pasVous: "Ce n'est pas vous ?",
  bloquerLien: "Bloquer cette demande",
  confirmeTitre: "C'est noté.",
  confirmeLigne: (reponse: string) =>
    `Nous vérifions votre RIB et nous vous appelons. Réponse au plus tôt le ${reponse}. En attendant, vos virements sont en attente de la décision ; vos commissions continuent d'être enregistrées.`,
  bloquerTitre: "Bloquer cette demande",
  bloquerLigne:
    "Si vous n'avez pas demandé à changer de compte, cliquez ici. Nous annulons la demande et nous vous envoyons un nouveau lien pour votre espace.",
  bloquerBouton: "Je n'ai rien demandé : bloquer",
  bloqueLigne:
    "C'est fait. Votre compte n'a pas changé. Regardez vos e-mails : votre nouveau lien y est. Nous vous appelons.",
  lienMort: "Ce lien ne fonctionne plus.",
} as const;
