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
  lectureSeule: "Une erreur ? Écrivez-nous :",
  nomManquant: "Indiquez votre nom de famille : il figure sur votre contrat.",
  // Étape 2
  // Contrat 2.4 (décision de Will, 08/10) : on ne demande plus que le SIRET ; le SIREN en est déduit.
  siren: "Numéro SIRET",
  aideSiret:
    "14 chiffres, sur votre avis de situation INSEE ou annuaire-entreprises.data.gouv.fr. Si vous avez plusieurs activités, indiquez le SIRET de celle sous laquelle vous apportez des affaires.",
  siretAttendu: "Indiquez le numéro SIRET (14 chiffres) de votre établissement.",
  rechercher: "Rechercher",
  recherche: "Recherche…",
  trouve: "Trouvé",
  active: "active",
  sirenInvalide: "Ce numéro SIREN n'est pas valide : vérifiez les 9 chiffres.",
  siretInvalide: "Ce numéro SIRET n'est pas valide : vérifiez les 14 chiffres.",
  introuvable: "Entreprise introuvable dans le registre : indiquez-la ci-dessous.",
  indisponible: "Le registre ne répond pas : indiquez votre entreprise ci-dessous.",
  diffusionPartielle: "Vos coordonnées ne sont pas publiques : indiquez-les ci-dessous.",
  denomination: "Nom de l'entreprise",
  // Contrat 2.4 : l'adresse lue au registre est celle de l'ÉTABLISSEMENT (SIRET) ; le siège d'une
  // société se demande à part (contrat 2.7, art. 14).
  adresse: "Adresse de l'établissement",
  statut: "Votre statut",
  // Contrat 2.7, art. 14 : la qualité de l'Apporteur.
  siege: "Adresse du siège",
  siegeAide: "L'adresse du siège social de votre société, telle qu'elle figure au registre.",
  fonction: "Fonction du signataire",
  fonctionAide: "Votre fonction dans la société : président, gérant…",
  rcs: "Êtes-vous immatriculé au registre du commerce et des sociétés ?",
  rcsOui: "Oui",
  rcsNon: "Non",
  choisir: "Choisissez…",
  tva: "Facturez-vous la TVA ?",
  tvaNon: "Non (franchise)",
  tvaOui: "Oui",
  numeroTva: "Numéro de TVA",
  iban: "IBAN (pour vos commissions)",
  ibanEnregistre: (masque: string) => `Enregistré : ${masque}`,
  ibanRemplacer: "Laissez vide pour garder celui-ci.",
  ibanInvalide:
    "Cet IBAN n'est pas valide, ou n'est pas celui d'un compte de la zone SEPA (Europe), où nous versons les commissions : vérifiez-le.",
  rechercherDabord: "Recherchez d'abord votre numéro SIRET.",
  // Décision de Will (07/10) : dire COMMENT obtenir un SIREN, sans détail fiscal ni délai
  // autre que « quelques jours ». La règle ne change pas : le SIREN reste obligatoire.
  // 07/10 : « Continuer » grisé → la liste de ce qui manque, dite en clair.
  ilManque: "Pour continuer, il manque :",
  manqueSiren: "votre numéro SIRET, recherché au registre",
  manqueEntreprise: "le nom et l'adresse de votre entreprise",
  manqueStatut: "votre statut",
  manqueSiege: "l'adresse du siège de votre société",
  manqueFonction: "votre fonction dans la société",
  manqueRcs: "votre réponse sur l'immatriculation au registre du commerce et des sociétés",
  manqueTva: "votre régime de TVA",
  manqueNumeroTva: "votre numéro de TVA",
  manqueIban: "un IBAN valide",
  sansSirenTitre: "Pas encore de numéro SIREN ?",
  sansSirenTexte:
    "Si vous résidez en France : pour recevoir vos commissions, il vous faut un numéro SIREN. Le plus simple : créer une micro-entreprise. C'est gratuit et cela se fait en ligne, en une vingtaine de minutes, sur le site officiel",
  sansSirenLien: "formalites.entreprises.gouv.fr",
  sansSirenUrl: "https://formalites.entreprises.gouv.fr",
  sansSirenSuite:
    "Vous recevez votre numéro SIREN sous quelques jours. Votre dossier reste enregistré : revenez avec votre numéro.",
  // Décision de Will (09/10/2026) : le contrat d'apporteur est réservé à la France. Un résident
  // étranger n'est pas refusé sèchement : il est prévenu, et peut écrire (contrat à part plus tard).
  horsFranceTitre: "Vous résidez hors de France ?",
  horsFranceTexte:
    "Ce contrat est réservé aux personnes qui résident fiscalement en France et y exercent sous un numéro SIRET actif. Créer une micro-entreprise en France ne suffit pas si vous résidez à l'étranger. Écrivez-nous : nous vous répondrons si nous ouvrons le réseau à votre pays.",
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
  apercuDe: (piece: string) => `Aperçu : ${piece}`,
  voirLePdf: "Voir le fichier envoyé (PDF)",
  caseCertifie: "Je certifie que :",
  caseAccepte: "J'ai lu le contrat et je l'accepte, en particulier :",
  cochezLesDeuxCases: "Cochez les deux cases pour pouvoir signer.",
  signataireTitre: "Vous signez en tant que",
  pourLeCompteDe: (societe: string) => `pour le compte de ${societe}`,
  signatairePasVous: "Ce nom est faux ? Écrivez-nous avant de signer :",
  signer: "Signer mon contrat",
  signature: "Signature…",
  // A compléter
  aCompleterTitre: "Quelques points à reprendre",
  aCompleterLigne: "Corrigez, puis signez de nouveau.",
  // Fin
  merciTitre: "Merci, c'est signé",
  merciLigne: "Nous vérifions votre dossier et vous recevrez votre contrat contresigné par e‑mail.",
  recuPastille: "Dossier reçu",
  recuTitre: "Dossier reçu, en cours de vérification",
  recuLigne: "Vous recevrez votre contrat contresigné par e‑mail.",
  signePastille: "Contrat signé",
  signeTitre: "Votre contrat est signé",
  signeLigne: "Vous pouvez nous déclarer une entreprise ci-dessous.",
  signeLigneVigilance: "Déposez ici les attestations que nous vous demandons.",
  telechargerSigne: "Télécharger mon contrat signé (PDF)",
  connexionPerdue: "Connexion perdue : vos réponses sont conservées sur cet écran, réessayez.",
  etapeAnnonce: (n: number, nom: string) => `Étape ${n} sur 4 : ${nom}`,
  fermer: "Vous pouvez fermer cette page.",
  // Lien invalide
  // Le lien d'exemple de l'aperçu de la console (2026-10-07) : Will a cliqué le
  // bouton de l'aperçu de « Retenu » et est tombé sur « Ce lien ne fonctionne plus ».
  // Fiche retirée du réseau, argent encore en jeu (2026-10-07).
  restreintPastille: "Vos commissions",
  restreintTitre: "Vos commissions restent dues",
  restreintLigne:
    "Votre fiche n'est plus active dans le réseau. Les commissions qui vous sont dues vous seront versées dans les conditions de votre contrat. Si l'on vous les demande, déposez ici vos attestations.",
  exemplePastille: "Aperçu",
  exempleTitre: "Ceci est un lien d'exemple",
  exempleLigne:
    "Vous êtes dans l'aperçu de l'e-mail. Le lien personnel du dossier est créé au moment de l'envoi : c'est celui que recevra l'apporteur.",
  invalidePastille: "Lien invalide",
  invalideTitre: "Ce lien ne fonctionne plus",
  invalideLigne: "Écrivez-nous : nous vous renvoyons le bon.",
  nousEcrire: "Nous écrire",
  trop: "Trop d'essais depuis cette connexion. Réessayez dans quelques minutes.",
  erreurTitre: "Un souci est survenu",
  erreurLigne:
    "Votre saisie enregistrée est conservée. Réessayez dans quelques minutes, ou écrivez à",
  reessayer: "Réessayer",
} as const;
