// Les TEXTES de la déclaration d'entreprise (contrat v2 art. 3.2). Vouvoiement, très peu
// de texte, aucun engagement de délai. « e‑mail » porte un trait d'union INSÉCABLE (U+2011).

export const TEXTES_DECLARATION = {
  titre: "Déclarer une entreprise",
  ligne: "Tous les champs sont nécessaires.",
  entreprise: "L'entreprise",
  personne: "La personne rencontrée",
  // Contrat 2.6 : l'attribution porte sur l'établissement visité.
  siret: "Numéro SIRET de l'établissement visité (14 chiffres)",
  denomination: "Nom de l'entreprise",
  nom: "Prénom et nom",
  fonction: "Fonction",
  email: "E‑mail",
  telephone: "Téléphone",
  dateContact: "Date du contact",
  envoyer: "Déclarer cette entreprise",
  envoi: "Envoi…",
  confirmationTitre: "Déclaration reçue",
  confirmationLigne: "Merci. Elle apparaît ci-dessous.",
  autre: "Déclarer une autre entreprise",
  listeTitre: "Vos déclarations",
  listeVide: "Aucune déclaration pour le moment.",
  // 2026-10-07 (décision de Will) : ce qui se passe après la déclaration. Aucun délai
  // de réponse promis. La durée vient de `PROTECTION_MOIS` (jamais écrite à la main).
  commentTitre: "Comment ça se passe",
  jusquAu: (date: string) => `jusqu'au ${date}`,
  // Contrat 2.3, art. 4.2 : la commission naît de la prestation RÉALISÉE et entièrement payée.
  prestationEnAttente: "Prestation commandée, en attente de réalisation",
  prestationRealisee: (date: string) => `Prestation réalisée le ${date}`,
  // Annexe 1, A1.7 : produit hors grille, qualifié dans les soixante jours de l'encaissement.
  horsGrille:
    "Prestation hors grille de commissions : sa commission vous est indiquée par écrit dans les soixante jours de l'encaissement.",
} as const;
