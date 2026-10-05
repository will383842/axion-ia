// Les TEXTES du dossier en ligne de l'apporteur (démarrage manuel, 2026-10-05), en un
// seul endroit. Vouvoiement, phrases courtes, aucun numéro de téléphone, aucun délai
// promis. « e‑mail » porte un trait d'union INSÉCABLE (U+2011).

export const ADRESSE_CONTACT = "contact@axion-ia.com";

export const ETAPES = ["Vous", "Votre activité", "Vos documents", "Votre contrat"] as const;

export const TEXTES = {
  marque: "Axion-IA",
  surtitre: "Votre contrat d'apporteur",
  bonjour: (prenom: string) => (prenom ? `Bonjour ${prenom}` : "Bonjour"),
  etapeNsur4: (n: number) => `Étape ${n} sur 4`,
  duree: "Environ 10 minutes · vous pouvez reprendre plus tard",
  continuer: "Continuer",
  retour: "Retour",
  enregistrement: "Enregistrement…",
  // Étape 1
  prenom: "Prénom",
  nom: "Nom",
  email: "E‑mail",
  telephone: "Téléphone",
  lectureSeule: "Une erreur ? Écrivez-nous.",
  // Étape 2
  siren: "Numéro SIREN (9 chiffres)",
  rechercher: "Rechercher",
  recherche: "Recherche…",
  trouve: "Trouvé",
  active: "active",
  sirenInvalide: "Ce numéro SIREN n'est pas valide : vérifiez les 9 chiffres.",
  introuvable: "Entreprise introuvable dans le registre : indiquez-la ci-dessous.",
  indisponible: "Le registre ne répond pas : indiquez votre entreprise ci-dessous.",
  diffusionPartielle: "Vos coordonnées ne sont pas publiques : indiquez-les ci-dessous.",
  denomination: "Nom de l'entreprise",
  adresse: "Adresse du siège",
  statut: "Votre statut",
  choisir: "Choisissez…",
  tva: "Facturez-vous la TVA ?",
  tvaNon: "Non (franchise)",
  tvaOui: "Oui",
  numeroTva: "Numéro de TVA",
  iban: "IBAN (pour vos commissions)",
  ibanEnregistre: (masque: string) => `Enregistré : ${masque}`,
  ibanRemplacer: "Laissez vide pour garder celui-ci.",
  ibanInvalide: "Cet IBAN n'est pas valide : vérifiez-le.",
  rechercherDabord: "Recherchez d'abord votre numéro SIREN.",
  // Étape 3
  ajouter: "Ajouter",
  remplacer: "Remplacer",
  ajoutee: "Ajoutée",
  envoi: "Envoi…",
  facultatif: "facultatif",
  aRetransmettre: (motif: string) => `À renvoyer : ${motif}`,
  conforme: "Vérifiée",
  manque: "Il manque encore :",
  dateDelivrance: "Date de délivrance",
  // Étape 4
  contratTitre: "Votre contrat, rempli",
  telecharger: "Télécharger en PDF",
  declarationsTitre: "Vous déclarez",
  acceptationsTitre: "Vous acceptez",
  nomTape: "Tapez votre prénom et votre nom",
  nomTapeAide: (attendu: string) => `Comme sur votre dossier : ${attendu}`,
  signer: "Signer mon contrat",
  signature: "Signature…",
  // A compléter
  aCompleterTitre: "Quelques points à reprendre",
  aCompleterLigne: "Corrigez, puis signez de nouveau.",
  // Fin
  merciTitre: "Merci, c'est signé",
  merciLigne:
    "Nous vérifions votre dossier et vous recevrez votre contrat contresigné par e‑mail.",
  recuPastille: "Dossier reçu",
  recuTitre: "Dossier reçu, en cours de vérification",
  recuLigne: "Vous recevrez votre contrat contresigné par e‑mail.",
  signePastille: "Contrat signé",
  signeTitre: "Votre contrat est signé",
  signeLigne: "Déposez ici les attestations que nous vous demandons.",
  fermer: "Vous pouvez fermer cette page.",
  // Lien invalide
  invalidePastille: "Lien invalide",
  invalideTitre: "Ce lien ne fonctionne plus",
  invalideLigne: "Écrivez-nous : nous vous renvoyons le bon.",
  nousEcrire: "Nous écrire",
  trop: "Trop d'essais depuis cette connexion. Réessayez dans quelques minutes.",
  erreurTitre: "Un souci est survenu",
  erreurLigne: "Votre saisie enregistrée est conservée. Réessayez dans quelques minutes, ou écrivez à",
  reessayer: "Réessayer",
} as const;
