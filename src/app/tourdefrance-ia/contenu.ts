// Tour de France IA — TOUT le texte de la landing, en un seul endroit (2026-10-25,
// refonte « landing de conversion » le 2026-10-26, réécriture « offre » le
// 2026-10-26 sur le retour de Will).
//
// Pourquoi un module à part : le test des mots interdits
// (`__tests__/le-tour-est-ouvert.spec.ts`) lit CE fichier et la page ; un
// texte écrit ailleurs échapperait à la garde. Les composants visuels
// (`_composants/`) ne portent AUCUN texte visible : ils le reçoivent d'ici.
//
// Règles de rédaction : vouvoiement, phrases courtes, apostrophe typographique
// (’), espace insécable ( ) avant « : ; ? ! » et à l'intérieur des
// guillemets. Aucun montant, aucun chiffre inventé, aucune promesse de résultat.
//
// Ce que la page fait SENTIR, du point de vue de l'entreprise : le Tour vient
// CHEZ ELLE, avec un audit offert qui chiffre ce que l'IA lui ferait gagner, et
// 4 h de formation offertes à ses équipes. Ce n'est pas un rendez-vous où l'on
// se déplace : aucun vocabulaire d'événement, d'inscription ni de billet.
// « Offert » (ou « gratuit ») est RÉSERVÉ à l'audit et à la formation : la visio
// n'est dite que « sans engagement » (`MICRO_TEXTE_CTA`, seul endroit où la
// changer). Condition toujours visible (DGCCRF) : offerts aux entreprises de
// l'étape, sans frais cachés, la ville s'ouvre dès 5 entreprises confirmées. La
// soirée du vendredi est dite ouverte aux entreprises de l'étape, sans jamais
// dire qui paie quoi. L'AI Act est cité avec prudence : la formation « aide à
// répondre » à son exigence, jamais plus.
//
// Les seuls chiffres de la page sont ceux du CONCEPT (5 entreprises, 2 à 4 h,
// 4 h, 30 minutes, une semaine) : aucun compteur, aucune statistique.

import { TOUR_PREFIX } from "@/features/tour-de-france/visibilite";

/** Le nom du Tour. */
export const NOM_DU_TOUR = "Tour de France IA";

/** Le seuil d'ouverture d'une ville — un fait du concept, pas un compteur. */
export const SEUIL_OUVERTURE = 5;

/** La page de rendez-vous visio de 30 minutes (type `tour` de `types-reservables.ts`). */
export const CHEMIN_RENDEZ_VOUS = "/fr/appel/tour-de-france-ia";

/**
 * Le libellé des grands boutons : ce que l'entreprise OBTIENT. Une seule action
 * sur la page, dite de la même façon partout.
 */
export const LIBELLE_CTA = "Je veux mon audit offert";

/** La même action, en court : la pilule de l'en-tête (téléphone de 360 px). */
export const LIBELLE_CTA_COURT = "Mon audit offert";

/**
 * Le micro-texte sous chaque grand bouton — la SEULE phrase qui décrit la visio.
 * Sans « gratuite » : le mot est réservé à l'audit et à la formation du Tour.
 */
export const MICRO_TEXTE_CTA = "Visio de 30 minutes · sans engagement";

/**
 * Les emplacements des boutons, mesurés en `utm_term` chez Calendly puis lus par
 * la console. Liste FERMÉE : la console ne connaît que ces cinq-là
 * (`libelleEmplacement`), un emplacement inventé y tomberait en valeur brute.
 */
export const EMPLACEMENTS_CTA = [
  "tdf-entete",
  "tdf-heros",
  "tdf-bandeau",
  "tdf-final",
  "tdf-collant",
] as const;
export type EmplacementCta = (typeof EMPLACEMENTS_CTA)[number];

/**
 * L'adresse du bouton, avec l'emplacement cliqué (`depuis`). Les `utm_*` de
 * l'arrivée sont ajoutés côté navigateur (`PiloteCta.tsx`), pour que la page
 * reste statique.
 */
export function lienRendezVous(depuis: EmplacementCta): string {
  return `${CHEMIN_RENDEZ_VOUS}?depuis=${encodeURIComponent(depuis)}`;
}

/** L'accroche imposée par Will : H1 de la page et titre de partage. */
export const ACCROCHE = {
  question: "Vous entendez parler d’IA partout et ne savez plus par où commencer ?",
  reponse: "Nous, si.",
} as const;

/** L'offre, en une phrase : affichée en grand sous le titre. */
export const OFFRE =
  "Le Tour de France IA vient dans votre entreprise : un audit offert qui chiffre ce que l’IA vous ferait gagner, et 4 h de formation offertes à vos équipes.";

/** La condition qui accompagne « offert » — visible, jamais en note de bas de page. */
export const CONDITION_OFFERTE =
  "Offerts aux entreprises de l’étape, sans frais cachés. Le Tour s’arrête dans votre ville dès que 5 entreprises ont confirmé.";

export const META = {
  titre: "Tour de France IA : audit et formation IA offerts chez vous",
  description:
    "Un audit offert qui chiffre ce que l’IA vous ferait gagner, et 4 h de formation offertes à vos équipes. Dès 5 entreprises confirmées dans votre ville.",
  /** Titre de partage (Facebook, LinkedIn) : l'accroche de Will, telle quelle. */
  titrePartage: `${ACCROCHE.question} ${ACCROCHE.reponse}`,
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

/** L'en-tête de tunnel : le logo et une seule action. */
export const ENTETE = {
  /** Nom accessible du logo (le logo n'est pas un lien : aucune sortie du tunnel). */
  logo: "Axion-IA",
} as const;

export const HEROS = {
  /** Le sur-titre : qui vient, en une ligne. */
  surTitre: `${NOM_DU_TOUR} · par Axion-IA`,
  titre: ACCROCHE.question,
  titreAccent: ACCROCHE.reponse,
  sousTitre: OFFRE,
  condition: CONDITION_OFFERTE,
  /** La jauge du héros : le concept en deux secondes (5 points, l'étape s'ouvre). */
  jauge: "5 entreprises confirmées, le Tour s’arrête chez vous",
} as const;

/** La définition citable, en texte visible (GEO). */
export const DEFINITION =
  "Le Tour de France IA est une tournée d’Axion-IA, fondée par Williams Jullin, dans les entreprises qui le souhaitent, de la TPE à l’ETI, tous secteurs. Une étape, c’est une semaine dans une ville, ouverte dès que 5 entreprises ont confirmé. Chaque entreprise reçoit chez elle un audit offert de son activité (2 à 4 h), qui chiffre ce que l’IA lui ferait gagner en temps, en rentabilité et en chiffre d’affaires, puis une formation offerte de 4 h pour ses équipes. Le vendredi soir, une soirée réseau réunit les entreprises de l’étape.";

export const EN_BREF = "En bref";

/** Ce qu'il y a dedans : les quatre choses que l'entreprise reçoit. */
export const DEDANS = {
  surTitre: "Ce qu’il y a dedans",
  titre: "Le Tour vient chez vous. Avec tout ça.",
  cartes: [
    {
      etiquette: "Offert",
      titre: "L’audit de votre activité",
      duree: "2 à 4 h, chez vous",
      texte:
        "Nous regardons comment votre entreprise travaille, puis nous chiffrons ce que l’IA vous ferait gagner : temps, rentabilité, chiffre d’affaires.",
    },
    {
      etiquette: "Offerte",
      titre: "La formation de vos équipes",
      duree: "4 h, chez vous",
      texte:
        "Vos équipes s’exercent sur leurs propres tâches, avec des outils d’IA. Du concret, pas de théorie hors sol.",
    },
    {
      etiquette: "Près de chez vous",
      titre: "Une étape dans votre ville",
      duree: "Une semaine",
      texte:
        "Le Tour s’installe une semaine dans votre ville et passe une journée dans chaque entreprise de l’étape.",
    },
    {
      etiquette: "Vendredi soir",
      titre: "La soirée réseau",
      duree: "Fin de semaine",
      texte:
        "Les dirigeants de l’étape se retrouvent pour échanger ce qu’ils ont vu. Ouverte à toutes les entreprises de l’étape.",
    },
  ],
} as const;

/** Le bandeau du milieu : la jauge, présentée comme une chance. */
export const BANDEAU = {
  titre: "Il suffit de 5 entreprises pour que le Tour s’arrête dans votre ville.",
  texte: "Faites partie des premières : votre audit et votre formation sont offerts.",
} as const;

/** Ce que l'audit met sur la table : les trois gains, sans aucun chiffre inventé. */
export const AUDIT = {
  surTitre: "L’audit offert",
  titre: "Combien l’IA vous ferait gagner, chez vous, chiffré.",
  texte:
    "Pas une démonstration générale : l’audit part de vos tâches, de vos outils et de vos chiffres. Vous voyez où l’IA s’applique, comment, et ce que cela représente pour votre entreprise.",
  gains: [
    {
      titre: "Du temps",
      texte: "Les heures que vos équipes pourraient récupérer, tâche par tâche.",
    },
    {
      titre: "De la rentabilité",
      texte: "Ce que cela changerait à vos marges, une fois l’IA à sa place.",
    },
    {
      titre: "Du chiffre d’affaires",
      texte: "Les pistes pour mieux répondre, relancer et servir vos clients.",
    },
  ],
  mention: "Des estimations construites sur votre activité réelle, pas des promesses.",
} as const;

/** La formation offerte, et l'AI Act — formulé avec prudence. */
export const FORMATION = {
  surTitre: "La formation offerte",
  titre: "4 h pour que vos équipes prennent l’IA en main.",
  texte:
    "Sur leurs propres tâches, à leur poste, avec un formateur d’Axion-IA. Chacun repart en sachant quoi faire lundi matin.",
  aiAct:
    "L’AI Act demande aux entreprises qui utilisent l’IA de veiller à la maîtrise de l’IA par leurs équipes. Cette formation vous aide à répondre à cette exigence.",
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
    "Vous choisissez un créneau de visio (30 min)",
    "Nous faisons connaissance et vous confirmez que le Tour passe chez vous",
    "À 5 entreprises confirmées, la ville s’ouvre et vous êtes prévenu",
    "Nous venons chez vous : audit, puis formation",
  ],
} as const;

export const POUR_QUI = {
  titre: "Pour qui ?",
  phrase: "De la TPE à l’ETI. Tous secteurs.",
  tailles: ["TPE", "PME", "ETI"],
  /** Ce que l'audit chiffre ou met en évidence, secteur par secteur — sans chiffre. */
  intro: "Quelques exemples de ce que l’audit chiffre ou met en évidence :",
  secteurs: [
    {
      nom: "Commerce",
      exemple: "le temps passé sur les fiches produits et les réponses aux clients",
    },
    { nom: "Industrie", exemple: "les ressaisies entre commandes, stocks et bons de livraison" },
    { nom: "Santé", exemple: "le temps administratif pris sur le temps de soin" },
    { nom: "Bâtiment", exemple: "les heures de chiffrage et de suivi de chantier" },
    { nom: "Services", exemple: "les comptes rendus, les relances et la facturation" },
    { nom: "Associations", exemple: "les heures d’administratif de l’équipe et des bénévoles" },
    {
      nom: "Hôtellerie-restauration",
      exemple: "les plannings et les réponses aux demandes des clients",
    },
    { nom: "Transport", exemple: "l’organisation des tournées et le suivi des documents" },
  ],
  suite: "Votre secteur n’est pas dans la liste ? Il est concerné aussi.",
} as const;

export const FONDATEUR = {
  titre: "Qui vient chez vous ?",
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
      question: "C’est quoi, le Tour de France IA ?",
      reponse:
        "Une tournée d’Axion-IA dans les entreprises qui le souhaitent. Le Tour s’arrête une semaine dans une ville dès que 5 entreprises ont confirmé. Chacune reçoit chez elle un audit offert de son activité, puis une formation offerte de 4 h pour ses équipes.",
    },
    {
      question: "L’audit et la formation sont-ils vraiment offerts ?",
      reponse:
        "Oui. L’audit et la formation sont offerts aux entreprises de l’étape, sans frais cachés. La ville s’ouvre dès que 5 entreprises ont confirmé.",
    },
    {
      question: "Que m’apporte l’audit, concrètement ?",
      reponse:
        "Il part de votre activité réelle et chiffre où l’IA vous ferait gagner : le temps de vos équipes, votre rentabilité, votre chiffre d’affaires. Ce sont des estimations construites avec vous, pas des promesses.",
    },
    {
      question: "La formation m’aide-t-elle pour l’AI Act ?",
      reponse:
        "Elle vous aide à répondre à l’exigence de maîtrise de l’IA que l’AI Act pose aux entreprises qui l’utilisent. Elle ne vaut pas, à elle seule, mise en conformité.",
    },
    {
      question: "Est-ce adapté à ma taille et à mon secteur ?",
      reponse:
        "Oui. De la TPE à l’ETI, tous secteurs. L’audit et la formation partent de votre activité réelle.",
    },
    {
      question: "Pourquoi 5 entreprises ?",
      reponse:
        "C’est le seuil pour que le Tour s’arrête dans une ville. Si la vôtre n’y est pas encore, nous vous prévenons dès qu’une étape devient possible près de chez vous.",
    },
    {
      question: "Et la soirée du vendredi ?",
      reponse:
        "Une soirée réseau dans la ville de l’étape, ouverte à toutes les entreprises de l’étape. Les dirigeants y échangent ce qu’ils ont vu dans la semaine.",
    },
    {
      question: "Quel lien avec le Tour de France cycliste ?",
      reponse:
        "Aucun. Le Tour de France IA n’a aucun lien avec le Tour de France cycliste ni avec son organisateur.",
    },
  ],
} as const;

export const APPEL_FINAL = {
  titre: "Faites venir le Tour dans votre entreprise.",
  texte:
    "Une visio de 30 minutes pour faire connaissance. Dès que votre ville compte 5 entreprises confirmées, nous venons avec votre audit et votre formation.",
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
    LIBELLE_CTA_COURT,
    MICRO_TEXTE_CTA,
    ...Object.values(ACCROCHE),
    META.titre,
    META.description,
    META.titrePartage,
    META.imageAlt,
    ENTETE.logo,
    ...Object.values(HEROS),
    OFFRE,
    CONDITION_OFFERTE,
    EN_BREF,
    DEFINITION,
    DEDANS.surTitre,
    DEDANS.titre,
    ...DEDANS.cartes.flatMap((c) => [c.etiquette, c.titre, c.duree, c.texte]),
    BANDEAU.titre,
    BANDEAU.texte,
    AUDIT.surTitre,
    AUDIT.titre,
    AUDIT.texte,
    ...AUDIT.gains.flatMap((g) => [g.titre, g.texte]),
    AUDIT.mention,
    ...Object.values(FORMATION),
    ...Object.values(PRINCIPE),
    ETAPES.titre,
    ...ETAPES.liste,
    POUR_QUI.titre,
    POUR_QUI.phrase,
    ...POUR_QUI.tailles,
    POUR_QUI.intro,
    ...POUR_QUI.secteurs.flatMap((s) => [s.nom, s.exemple]),
    POUR_QUI.suite,
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
