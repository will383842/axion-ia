// Tour de France IA — TOUT le texte de la landing, en un seul endroit (2026-10-25,
// refonte « landing de conversion » le 2026-10-26).
//
// Pourquoi un module à part : le test des mots interdits
// (`__tests__/le-tour-est-ouvert.spec.ts`) lit CE fichier et la page ; un
// texte écrit ailleurs échapperait à la garde. Les composants visuels
// (`_composants/`) ne portent AUCUN texte visible : ils le reçoivent d'ici.
//
// Règles de rédaction : vouvoiement, phrases courtes, apostrophe typographique
// (’), espace insécable ( ) avant « : ; ? ! » et à l'intérieur des
// guillemets. Aucun montant, aucun chiffre inventé, aucune promesse de résultat.
// L'offre est dite en clair : audit et formation GRATUITS pour les entreprises de
// l'étape, soirée à la charge de chacun. « Gratuit » est RÉSERVÉ à l'audit et à la
// formation : la visio n'est dite que « sans engagement » (`MICRO_TEXTE_CTA`, seul
// endroit où la changer). Condition toujours visible
// (DGCCRF) : gratuit, la ville s'ouvre dès 5 entreprises confirmées, sans frais
// cachés. Le texte ne parle jamais de transaction à conclure : un test le garde.
//
// Les seuls chiffres de la page sont ceux du CONCEPT (5 entreprises, 2 à 4 h,
// 4 h, 30 minutes, une semaine) : aucun compteur, aucune statistique.

import { TOUR_PREFIX } from "@/features/tour-de-france/visibilite";

/** Le nom de l'événement. */
export const NOM_DU_TOUR = "Tour de France IA";

/** Le seuil d'ouverture d'une ville — un fait du concept, pas un compteur. */
export const SEUIL_OUVERTURE = 5;

/** La page de rendez-vous visio de 30 minutes (type `tour` de `types-reservables.ts`). */
export const CHEMIN_RENDEZ_VOUS = "/fr/appel/tour-de-france-ia";

/** Le libellé UNIQUE de tous les boutons : une seule action sur la page. */
export const LIBELLE_CTA = "Participer";

/**
 * Le micro-texte sous chaque bouton principal — la SEULE phrase qui décrit la
 * visio (affichée sous les deux grands boutons). Sans « gratuite » : le mot est réservé à l'audit
 * et à la formation du Tour.
 */
export const MICRO_TEXTE_CTA = "Visio de 30 minutes · sans engagement";

/**
 * Les emplacements des boutons, mesurés en `utm_term` chez Calendly puis lus par
 * la console. Liste FERMÉE : la console ne connaît que ces quatre-là, un
 * emplacement inventé y tomberait en « inconnu ».
 */
export const EMPLACEMENTS_CTA = ["tdf-heros", "tdf-bandeau", "tdf-final", "tdf-collant"] as const;
export type EmplacementCta = (typeof EMPLACEMENTS_CTA)[number];

/**
 * L'adresse du bouton, avec l'emplacement cliqué (`depuis`). Les `utm_*` de
 * l'arrivée sont ajoutés côté navigateur (`PiloteCta.tsx`), pour que la page
 * reste statique.
 */
export function lienRendezVous(depuis: EmplacementCta): string {
  return `${CHEMIN_RENDEZ_VOUS}?depuis=${encodeURIComponent(depuis)}`;
}

/** L'offre, en une phrase : affichée en grand sous le titre. */
export const OFFRE = "Un audit de 2 à 4 h et la formation de vos équipes, gratuits, chez vous.";

/** La condition qui accompagne « gratuit » — visible, jamais en note de bas de page. */
export const CONDITION_GRATUITE =
  "Gratuit pour les entreprises de l’étape, sans frais cachés. La ville s’ouvre dès que 5 entreprises ont confirmé.";

export const META = {
  titre: "Tour de France IA : audit et formation gratuits chez vous",
  description:
    "Audit de 2 à 4 h et formation de vos équipes, gratuits, chez vous. La ville s’ouvre dès 5 entreprises confirmées, sans frais cachés.",
  /** Chemin canonique (sans barre finale : `trailingSlash` est faux sur tout le site). */
  chemin: TOUR_PREFIX,
  /**
   * Image de partage 1200 × 630 : `opengraph-image.jpg` et `twitter-image.jpg` de ce
   * dossier (convention de FICHIER — elle seule l'emporte sur `src/app/opengraph-image.tsx`,
   * qui s'appliquerait sinon à toutes les routes). Texte alternatif : `*.alt.txt`.
   */
  image: `${TOUR_PREFIX}/opengraph-image.jpg`,
  imageAlt:
    "Tour de France IA, organisé par Axion-IA : une carte de France stylisée, une ville s’ouvre à 5 entreprises.",
} as const;

export const HEROS = {
  /** La jauge du héros : le concept en deux secondes (5 points, l'étape s'ouvre). */
  jauge: "5 entreprises confirmées, l’étape s’ouvre",
  /**
   * Le H1 en trois morceaux : seul « au travail » prend l'accent. Il répond à
   * l'accroche d'un post (« Et si l’IA venait chez vous ? ») par le BÉNÉFICE
   * du dirigeant, sans reprendre le slogan d'Axion-IA.
   */
  titreAvant: "Une journée pour mettre l’IA ",
  titreAccent: "au travail",
  titreApres: " dans votre entreprise.",
  sousTitre: OFFRE,
  condition: CONDITION_GRATUITE,
} as const;

/** La définition citable, en texte visible (GEO). */
export const DEFINITION =
  "Le Tour de France IA est un événement organisé par Axion-IA, fondé par Williams Jullin. Une ville s’ouvre dès que 5 entreprises ont confirmé leur participation. Chaque entreprise reçoit alors sa journée chez elle : un audit gratuit le matin (2 à 4 h), la formation gratuite de ses équipes l’après-midi (4 h). Le vendredi soir, une soirée réseau réunit les entreprises de l’étape, chacun règle sa part.";

export const EN_BREF = "En bref";

/** Le problème du dirigeant : à faire SENTIR, sans slogan. */
export const PROBLEME = {
  titre: "Parmi tous les outils d’IA, lesquels servent votre métier ?",
  constats: [
    {
      titre: "Trop d’outils pour tout essayer",
      texte: "Vous n’avez pas le temps de trier ce qui compte pour votre métier.",
    },
    {
      titre: "Des essais chacun dans son coin",
      texte: "Quelqu’un teste, puis oublie. Rien ne devient une habitude d’équipe.",
    },
    {
      titre: "Une question qui reste ouverte",
      texte: "Qu’est-ce que ça change, concrètement, pour votre entreprise ?",
    },
  ],
  chute: "Le Tour vient chez vous pour y répondre, à partir de votre activité réelle.",
} as const;

export const JOURNEE = {
  titre: "Votre journée, en trois temps",
  moments: [
    {
      moment: "Temps 1",
      titre: "Audit gratuit le matin",
      duree: "2 à 4 h",
      texte:
        "Nous regardons comment votre entreprise travaille et repérons où l’IA peut s’appliquer.",
    },
    {
      moment: "Temps 2",
      titre: "Formation gratuite l’après-midi",
      duree: "4 h",
      texte: "Vos équipes s’exercent sur leurs propres tâches, avec des outils d’IA.",
    },
    {
      moment: "Temps 3",
      titre: "Soirée réseau, chacun règle sa part",
      duree: "Vendredi soir",
      texte: "Retrouvez les autres entreprises de l’étape, au restaurant.",
    },
  ],
} as const;

/** La carte : le principe d'une étape, sans aucune ville nommée. */
export const PRINCIPE = {
  titre: "Une étape, c’est une semaine dans une ville",
  texte:
    "La ville s’ouvre dès que 5 entreprises ont confirmé. Nous passons une journée chez chacune, dans la semaine. Le vendredi soir, tout le monde se retrouve.",
  legende: "Illustration du principe. Les points ne représentent pas des villes annoncées.",
  /** Texte alternatif de la carte (la carte elle-même n'a aucun texte). */
  alt: "Carte de France stylisée. Des points marquent des villes possibles. L’un d’eux se remplit jusqu’à 5 entreprises, puis s’ouvre.",
} as const;

export const ETAPES = {
  titre: "Comment ça marche",
  liste: [
    "Vous choisissez un créneau de visio (30 min)",
    "Nous faisons connaissance et vous confirmez votre participation",
    "À 5 entreprises confirmées, la ville s’ouvre et vous êtes prévenu",
    "Nous venons chez vous : votre journée",
  ],
} as const;

export const POUR_QUI = {
  titre: "Pour qui ?",
  phrase: "De l’indépendant au grand groupe. Tous secteurs.",
  tailles: ["Indépendant", "TPE", "PME", "ETI", "Grand groupe"],
  secteurs: [
    "Commerce",
    "Industrie",
    "Santé",
    "Bâtiment",
    "Services",
    "Associations",
    "Hôtellerie-restauration",
    "Transport",
  ],
  suite: "Votre secteur n’est pas dans la liste ? Il est concerné aussi.",
} as const;

export const BENEFICES = {
  titre: "Ce que vous en retirez",
  liste: [
    {
      titre: "Un regard extérieur sur votre organisation",
      texte: "Un regard neuf, sans vos habitudes.",
    },
    {
      titre: "Des cas d’usage adaptés à votre métier",
      texte: "Pas une démonstration générale : vos documents, vos tâches, vos clients.",
    },
    {
      titre: "Des équipes formées sur leurs propres tâches",
      texte: "La formation part des tâches que vos équipes font chaque jour.",
    },
    {
      titre: "Un plan d’action pour la suite",
      texte: "Ce qu’il faut faire d’abord, et ce qui peut attendre.",
    },
  ],
  mention: "Sans engagement de résultat.",
} as const;

export const FONDATEUR = {
  titre: "Qui organise ?",
  nom: "Williams Jullin",
  role: "Fondateur du Tour de France IA et d’Axion-IA",
  ligne2: "Il a imaginé le Tour pour faire venir l’IA dans les entreprises, chez elles.",
  ligne3: "La visio de 30 minutes se fait avec une personne de l’équipe d’Axion-IA.",
  lien: "Découvrir Williams",
  /** La fiche d'équipe d'Axion (`FOUNDER.pagePath`, servie en FR). */
  chemin: "/fr/equipe/williams",
  /** La photo PUBLIQUE déjà utilisée par la page « À propos » du site. */
  photo: "/illustrations/home-founder-william.jpg",
  photoAlt: "Portrait de Williams Jullin, fondateur d’Axion-IA",
} as const;

export const FAQ = {
  titre: "Questions fréquentes",
  questions: [
    {
      question: "C’est quoi le Tour de France IA ?",
      reponse:
        "Un événement organisé par Axion-IA. Une ville s’ouvre dès que 5 entreprises ont confirmé. Chacune reçoit sa journée chez elle : un audit gratuit le matin, la formation gratuite de ses équipes l’après-midi.",
    },
    {
      question: "Combien ça coûte ?",
      reponse:
        "L’audit et la formation sont gratuits pour les entreprises de l’étape. La soirée réseau est à la charge de chacun. La ville s’ouvre dès que 5 entreprises ont confirmé. Aucuns frais cachés.",
    },
    {
      question: "Pourquoi 5 entreprises ?",
      reponse:
        "C’est le seuil pour qu’une étape ait lieu. Si votre ville n’atteint pas 5, nous vous prévenons dès qu’une étape devient possible près de chez vous.",
    },
    {
      question: "Est-ce adapté à ma taille et à mon secteur ?",
      reponse:
        "Oui. De l’indépendant au grand groupe, tous secteurs. L’audit et la formation partent de votre activité réelle.",
    },
    {
      question: "Où cela se passe-t-il ?",
      reponse:
        "Chez vous, dans vos locaux. La soirée réseau du vendredi a lieu au restaurant, dans la ville de l’étape.",
    },
    {
      question: "Quel lien avec le Tour de France cycliste ?",
      reponse:
        "Aucun. Le Tour de France IA n’a aucun lien avec le Tour de France cycliste ni avec son organisateur.",
    },
  ],
} as const;

export const APPEL_FINAL = {
  titre: "Faites venir le Tour chez vous.",
  texte:
    "Une visio de 30 minutes pour faire connaissance. Dès que votre ville compte 5 entreprises confirmées, nous venons.",
} as const;

export const PIED = {
  organise: "Organisé par Axion-IA",
  nonAffiliation:
    "Le Tour de France IA n’a aucun lien avec le Tour de France cycliste ni avec son organisateur.",
  liens: [
    { libelle: "À propos d’Axion-IA", href: "https://axion-ia.com/fr/a-propos" },
    { libelle: "Contact", href: "https://axion-ia.com/fr/contact" },
    { libelle: "Mentions légales", href: "https://axion-ia.com/fr/mentions-legales" },
    {
      libelle: "Politique de confidentialité",
      href: "https://axion-ia.com/fr/politique-confidentialite",
    },
    { libelle: "Accessibilité", href: "https://axion-ia.com/fr/accessibilite" },
  ],
} as const;

/** Tout le texte visible, à plat — pour le test des mots interdits. */
export function toutLeTexte(): string {
  return [
    LIBELLE_CTA,
    MICRO_TEXTE_CTA,
    META.titre,
    META.description,
    META.imageAlt,
    ...Object.values(HEROS),
    OFFRE,
    CONDITION_GRATUITE,
    EN_BREF,
    DEFINITION,
    PROBLEME.titre,
    ...PROBLEME.constats.flatMap((c) => [c.titre, c.texte]),
    PROBLEME.chute,
    JOURNEE.titre,
    ...JOURNEE.moments.flatMap((m) => [m.moment, m.titre, m.duree, m.texte]),
    ...Object.values(PRINCIPE),
    ETAPES.titre,
    ...ETAPES.liste,
    POUR_QUI.titre,
    POUR_QUI.phrase,
    ...POUR_QUI.tailles,
    ...POUR_QUI.secteurs,
    POUR_QUI.suite,
    BENEFICES.titre,
    ...BENEFICES.liste.flatMap((b) => [b.titre, b.texte]),
    BENEFICES.mention,
    FONDATEUR.titre,
    FONDATEUR.nom,
    FONDATEUR.role,
    FONDATEUR.ligne2,
    FONDATEUR.ligne3,
    FONDATEUR.lien,
    FONDATEUR.photoAlt,
    FAQ.titre,
    ...FAQ.questions.flatMap((q) => [q.question, q.reponse]),
    APPEL_FINAL.titre,
    APPEL_FINAL.texte,
    PIED.organise,
    PIED.nonAffiliation,
    ...PIED.liens.map((l) => l.libelle),
  ].join("\n");
}
