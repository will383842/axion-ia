// Page VSL de recrutement d'apporteurs — CONTENU de `/apporteur-affaires/video`
// et de `/apporteur-affaires/video/merci` (plan `_PLAN-VSL-TUNNEL-APPORTEURS-2026-10-05`,
// lot 3 ; textes de `02-ACQUISITION-CREATIF.md` §6 et §7, tranchés par `03`).
//
// ── Ce qui a écrit chaque phrase ────────────────────────────────────────────
// Un visiteur venu d'une publicité Facebook ou Instagram, sur son téléphone,
// qui donne dix secondes. TRÈS PEU DE TEXTE, une colonne, UN seul bouton répété.
//
// 🔴 VOUVOIEMENT partout (décision du 29/09/2026).
// 🔴 AUCUN MONTANT EN DUR : la seule somme de la page vient de `pricing.ts` et
//    entre par un PARAMÈTRE (`faqVsl`). Deux barèmes publics ont déjà divergé de
//    150 € pour un montant recopié. Aucun gain en tête de page (décision 11 du
//    plan 03) : le chiffre vit en petit, « à titre indicatif », dans la FAQ.
// 🔴 AUCUN Qualiopi, AUCUN parrainage (jamais, dans une publicité ni sur sa page).
// 🔴 AUCUN numéro de téléphone public.
// 🔴 VOCABULAIRE : « recommander », « présenter », « mettre en relation »,
//    « échange ». Jamais « commercial », « poste », « recrutement », « entretien »
//    ni le verbe « vendre » (R7 du plan 03, décisions du 19/09 et du 03/09).
// 🔴 AUCUN DÉLAI DE RÉPONSE PROMIS, aucun compteur de rareté, aucun faux témoignage.
// 🔴 « Vous recevez un e-mail » : l'envoi est fait par la capture (autre PR) ; ces
//    textes ne promettent pas d'appel.
//
// Le test `vsl-apporteur.spec.ts` verrouille ces règles sur le TEXTE servi.

/** Dimension d'analyse de la page (propriété `landing` des événements). */
export const VSL_SLUG = "vsl-apporteur-v1";

/** Chemins sans préfixe de langue (le `Link` d'`@/i18n/navigation` le pose). */
export const VSL_PATH = "/apporteur-affaires/video";
export const VSL_MERCI_PATH = "/apporteur-affaires/video/merci";
/** Ancre du formulaire — tous les boutons de la page y mènent. */
export const VSL_ANCRE = "candidater";

export const VSL_META = {
  title: "Apporteur d'affaires IA : présentez, nous faisons le reste",
  description:
    "Vous connaissez des dirigeants de PME ? Présentez-les à Axion-IA. Nous nous occupons de la vente, de la facturation et de la formation.",
} as const;

export const VSL_HERO = {
  badge: "Apporteur d'affaires indépendant",
  h1: "Vous connaissez des dirigeants de PME ?",
  h1Em: "Présentez-les. Nous nous occupons du reste.",
  sousTitre:
    "Axion-IA forme les équipes des entreprises à l'IA. Vous recommandez, nous nous occupons de la vente, de la facturation et de la formation.",
  cta: "Je candidate (2 minutes)",
  micro: "Aucun frais d'entrée · Aucun quota · Aucun gain garanti",
  videoLabel: "Regardez comment ça marche",
} as const;

/**
 * Le film. Les fichiers sont posés par Will dans `public/videos/` ; le bloc
 * n'apparaît QUE si le MP4 ET l'affiche existent (`videoDisponible`), donc la
 * page est livrable sans film. Les sous-titres (`.vtt`) et la transcription
 * sont facultatifs : la transcription est lue dans le `.vtt` quand il existe.
 *
 * 🔴 Même domaine, pas d'hébergeur tiers : la CSP n'a pas de `media-src`, une
 * vidéo externe serait bloquée sans message (voir `content/lp/diagnostic.ts`).
 * 🔴 Nom de fichier VERSIONNÉ (`-v1`) : l'en-tête de cache de `/videos/*` est
 * long (un an, immuable) ; un film refait prend un nouveau nom.
 */
export const VSL_VIDEO_FICHIERS = {
  src: "/videos/vsl-apporteur-v1.mp4",
  poster: "/videos/vsl-apporteur-v1-poster.avif",
  sousTitres: "/videos/vsl-apporteur-v1.fr.vtt",
  /** Ce que lit l'affiche (« 1 min 20 ») — à ajuster à la durée réelle du film. */
  durationLabel: "1 min 20",
} as const;

/** Les trois pastilles « pour qui ». */
export const VSL_POUR_QUI: readonly string[] = [
  "Vous avez des contacts de dirigeants de PME",
  "Vous gardez votre activité",
  "Aucune négociation, aucune explication technique à fournir",
];

export const VSL_PAS_POUR_QUI =
  "Ce n'est pas pour vous si vous cherchez un salaire fixe ou si vous n'avez pas de contacts en entreprise.";

export const VSL_ETAPES: readonly { readonly titre: string; readonly texte: string }[] = [
  {
    titre: "Vous présentez",
    texte: "Vous mettez en relation Axion-IA et un dirigeant que vous connaissez.",
  },
  {
    titre: "Nous nous occupons du reste",
    texte: "Nous menons le rendez-vous, la proposition, la facturation et la formation.",
  },
  {
    titre: "Vous recevez votre commission",
    texte: "Quand l'entreprise a payé, selon les conditions du contrat.",
  },
];

/** Section anti-doute : ce que ce n'est pas. */
export const VSL_PAS_CA: readonly string[] = [
  "Pas de frais d'entrée",
  "Pas de quota, pas d'exclusivité",
  "Pas de gain garanti : la commission dépend des entreprises que vous présentez",
  "Un contrat écrit, des conditions que vous lisez avant de signer",
];

/** Preuves honnêtes : ce qui existe réellement. Aucune statistique. */
export const VSL_PREUVES = {
  catalogue: {
    titre: "Des formations réelles, avec leurs prix publics",
    lien: "Voir le catalogue",
  },
  commission: {
    titre: "Une commission calculée sur la facture",
    texte: "Versée quand l'entreprise a payé.",
  },
  echange: {
    titre: "Un échange de 15 minutes avant tout engagement",
  },
} as const;

/**
 * Les six questions. Une seule somme, passée en PARAMÈTRE (libellé déjà formaté
 * par la page à partir de `pricing.ts`), « à titre indicatif » dans la même
 * phrase (garde `jur:remuneration-indicative`).
 */
export function faqVsl(commissionParJournee: string): readonly {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
}[] {
  return [
    {
      id: "ia",
      question: "Faut-il connaître l'IA ?",
      answer: "Non. Vous présentez ; nous nous occupons des explications.",
    },
    {
      id: "statut",
      question: "Faut-il un statut ?",
      answer:
        "Oui : vous intervenez comme indépendant (micro-entreprise ou société). Vous n'êtes pas salarié d'Axion-IA.",
    },
    {
      id: "gains",
      question: "Combien puis-je gagner ?",
      answer: `À titre indicatif, jusqu'à ${commissionParJournee} par journée de formation facturée et encaissée, selon le contrat. Cela dépend des entreprises que vous présentez et de celles qui signent : nous ne garantissons aucun gain.`,
    },
    {
      id: "negocier",
      question: "Dois-je négocier quelque chose ?",
      answer:
        "Non. Vous présentez ; nous nous occupons du rendez-vous, de la proposition et de la facturation.",
    },
    {
      id: "frais",
      question: "Y a-t-il des frais, un quota, une exclusivité ?",
      answer: "Non, aucun des trois.",
    },
    {
      id: "apres",
      question: "Que se passe-t-il après ma candidature ?",
      answer:
        "Vous recevez un e-mail de confirmation, puis vous choisissez un créneau de 15 minutes. Si nous poursuivons ensemble, vous complétez un dossier en ligne, puis un contrat vous est proposé.",
    },
  ];
}

/** Réponses fermées de l'étape 2 — les identifiants sont ceux du contrat serveur. */
export const VSL_REPONSES = [
  { id: "moins-5", libelle: "Moins de 5" },
  { id: "5-20", libelle: "De 5 à 20" },
  { id: "20-50", libelle: "De 20 à 50" },
  { id: "plus-50", libelle: "Plus de 50" },
] as const;

export const VSL_FORMULAIRE = {
  titre: "Candidater en 2 minutes",
  etape1: {
    eyebrow: "Étape 1 sur 2",
    titre: "Parlons de vous",
    micro: "20 secondes.",
    prenom: "Prénom",
    prenomAide: "Pour vous écrire correctement.",
    email: "E-mail",
    emailAide: "Pour vous envoyer la confirmation.",
    bouton: "Continuer",
    // ⚠️ Texte versionné : le serveur enregistre la VERSION du consentement
    // (`LEAD_APPORTEUR_CONSENT_VERSION`, v3 portée par la PR de capture). Ce
    // texte doit rester celui de cette version ; il dit explicitement qu'on peut
    // écrire à la personne même si elle ne termine pas (relance d'abandon).
    consent:
      "J'accepte qu'Axion-IA m'écrive au sujet du réseau d'apporteurs d'affaires, y compris si je ne termine pas mon inscription. Données conservées 24 mois après la clôture de mon dossier, jamais cédées à des tiers.",
    legal: "Vos données sont utilisées pour traiter votre candidature.",
    legalLien: "Politique de confidentialité",
  },
  etape2: {
    eyebrow: "Étape 2 sur 2",
    titre: "Dernière étape",
    telephone: "Téléphone",
    telephoneAide:
      "Pour vous joindre au sujet de votre rendez-vous. Nous ne l'affichons jamais publiquement.",
    question: "Combien de dirigeants connaissez-vous à peu près ?",
    bouton: "Envoyer et choisir mon créneau",
    micro: "Un échange de 15 minutes. Aucun engagement.",
    retour: "Modifier mes réponses précédentes",
  },
  annonceEtape: (n: number) => `Étape ${n} sur 2`,
} as const;

/** Messages d'erreur — simples, jamais accusateurs. */
export const VSL_ERREURS = {
  prenom: "Votre prénom, pour savoir à qui nous écrivons.",
  emailVide: "Votre e-mail, pour vous envoyer la confirmation.",
  emailInvalide: "Cette adresse semble incomplète.",
  consent: "Cochez la case pour que nous puissions vous écrire.",
  telephoneVide: "Votre numéro, pour vous joindre au sujet de votre rendez-vous.",
  telephoneInvalide: "Ce numéro ne ressemble pas à un téléphone.",
  reponse: "Choisissez la réponse qui s'en approche le plus.",
  invalide: "Une information semble incorrecte. Vérifiez vos réponses et réessayez.",
  rate: "Trop de tentatives pour le moment. Réessayez dans quelques minutes.",
  jeton: "Votre inscription a expiré. Reprenez l'étape 1 : ce sera très rapide.",
  inconnue: "Une erreur est survenue. Réessayez ou écrivez-nous à contact@axion-ia.com.",
  perime: "Le site vient d'être mis à jour. Rechargez la page et renvoyez le formulaire.",
} as const;

/** Page de remerciement. */
export const VSL_MERCI = {
  title: "C'est noté.",
  texte: "Choisissez maintenant le créneau de 15 minutes qui vous convient.",
  cta: "Choisir mon créneau",
  ctaMicro: "Un échange de 15 minutes. Aucun engagement.",
  email: "Vous recevez aussi le lien par e-mail. Pensez à regarder vos courriers indésirables.",
  aucunCreneau: "Aucun créneau ne vous convient ? Répondez à l'e-mail de confirmation.",
  kitTitre: "En attendant, découvrez ce que vous pourrez recommander",
  kitCatalogue: "Le catalogue des prestations",
  description: "Choisissez votre créneau de 15 minutes.",
} as const;
