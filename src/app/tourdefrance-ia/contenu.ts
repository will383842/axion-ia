// Tour de France IA — TOUT le texte de la landing, en un seul endroit (2026-10-25,
// refonte « landing de conversion » le 2026-10-26, réécriture « offre » le
// 2026-10-26 après relecture de Will).
//
// Pourquoi un module à part : le test des mots interdits
// (`__tests__/le-tour-est-ouvert.spec.ts`) lit CE fichier et la page ; un
// texte écrit ailleurs échapperait à la garde. Les composants visuels
// (`_composants/`) ne portent AUCUN texte visible : ils le reçoivent d'ici.
//
// Ce que la page dit, du point de vue de l'entreprise : le Tour vient CHEZ ELLE,
// de la TPE à l'ETI, tous secteurs ; elle reçoit un AUDIT offert qui chiffre ce
// que l'IA peut lui apporter (temps, rentabilité, chiffre d'affaires) et une
// FORMATION de 4 h offerte à ses équipes, qui l'aide à répondre à l'exigence de
// formation de l'AI Act (formule prudente : ni obligation, ni attestation, ni
// promesse de conformité). Une étape = une semaine dans une ville, ouverte dès
// 5 entreprises confirmées du même secteur géographique ; soirée réseau le
// vendredi, ouverte à toutes les entreprises de l'étape (jamais un mot sur qui
// règle quoi).
//
// Règles de rédaction : vouvoiement, phrases courtes, apostrophe typographique
// (’), espace insécable ( ) avant « : ; ? ! » et à l'intérieur des
// guillemets. Aucun montant, aucun chiffre inventé, aucune garantie de résultat :
// l'audit « chiffre » ou « met en évidence », il ne promet pas. « Offert » et
// « gratuit » sont RÉSERVÉS à l'audit et à la formation : la visio n'est dite que
// « sans engagement » (`MICRO_TEXTE_CTA`). Jamais de vocabulaire d'événement, de
// billetterie ou de transaction : un test le garde.
//
// Les seuls chiffres de la page sont ceux du CONCEPT (5 entreprises, 2 à 4 h,
// 4 h, 30 minutes) : aucun compteur, aucune statistique.

import { TOUR_PREFIX } from "@/features/tour-de-france/visibilite";

/** Le nom du Tour. */
export const NOM_DU_TOUR = "Tour de France IA";

/** Le seuil d'ouverture d'une étape — un fait du concept, pas un compteur. */
export const SEUIL_OUVERTURE = 5;

/** La page de rendez-vous visio de 30 minutes (type `tour` de `types-reservables.ts`). */
export const CHEMIN_RENDEZ_VOUS = "/fr/appel/tour-de-france-ia";

/** Le libellé des grands boutons : ce que l'entreprise obtient. Une seule action sur la page. */
export const LIBELLE_CTA = "Je veux mon audit offert";

/** Le même, en court : l'en-tête et le bandeau, où la place manque à 360 px. */
export const LIBELLE_CTA_COURT = "Mon audit offert";

/**
 * Le micro-texte sous chaque bouton principal — la SEULE phrase qui décrit la
 * visio (affichée sous les deux grands boutons). Sans « gratuite » : le mot est réservé à l'audit
 * et à la formation du Tour.
 */
export const MICRO_TEXTE_CTA = "Visio de 30 minutes · sans engagement";

/**
 * Les emplacements des boutons, mesurés en `utm_term` chez Calendly puis lus par
 * la console (`LIBELLES_EMPLACEMENT` de `bilan-rendez-vous.ts`). Liste FERMÉE : un
 * emplacement absent de la console y tomberait en valeur brute.
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

/** La règle d'ouverture d'une étape, écrite UNE fois : héros, bandeau, FAQ et appel final la citent. */
export const REGLE_ETAPE =
  "Votre étape s’ouvre dès que 5 entreprises de votre secteur géographique ont confirmé.";

/** L'offre, en une phrase : affichée en grand sous le titre. */
export const OFFRE =
  "Un audit offert qui chiffre ce que l’IA peut rapporter à votre entreprise, et une formation de 4 h offerte à vos équipes. Chez vous.";

/** La condition qui accompagne « offert » — visible, jamais en note de bas de page. */
export const CONDITION_GRATUITE = `Offerts aux entreprises de l’étape, sans frais cachés. ${REGLE_ETAPE}`;

export const META = {
  titre: "Tour de France IA : audit et formation offerts chez vous",
  description:
    "Un audit offert qui chiffre ce que l’IA peut vous rapporter, et 4 h de formation offertes à vos équipes. Étape ouverte dès 5 entreprises confirmées.",
  /** Chemin canonique (sans barre finale : `trailingSlash` est faux sur tout le site). */
  chemin: TOUR_PREFIX,
  /**
   * Image de partage 1200 × 630 : `opengraph-image.jpg` et `twitter-image.jpg` de ce
   * dossier (convention de FICHIER — elle seule l'emporte sur `src/app/opengraph-image.tsx`,
   * qui s'appliquerait sinon à toutes les routes). Texte alternatif : `*.alt.txt`.
   */
  image: `${TOUR_PREFIX}/opengraph-image.jpg`,
  imageAlt:
    "Tour de France IA, organisé par Axion-IA : sur fond sombre aux couleurs d’Axion-IA, « Vous entendez parler d’IA partout et ne savez plus par où commencer ? Nous, si. » Audit offert, formation de 4 h offerte, de la TPE à l’ETI.",
} as const;

/** L'en-tête du tunnel : le logo, et c'est tout (le bouton porte `LIBELLE_CTA_COURT`). */
export const ENTETE = {
  /** Nom accessible du logo (`role="img"` : le tiret dessiné est décoratif, le nom le porte). */
  logo: "Axion-IA",
  marque: "Axion",
  marqueAccent: "IA",
} as const;

export const HEROS = {
  /** Le surtitre : le Tour se nomme, et dit qu'il se déplace. */
  surtitre: "Tour de France IA · de la TPE à l’ETI",
  /**
   * Le H1, accroche imposée par Will, en trois morceaux : seul « Nous, si. » prend
   * l'accent. Le lecteur se reconnaît, puis Axion-IA répond.
   */
  titreAvant: "Vous entendez parler d’IA partout et ne savez plus par où commencer ? ",
  titreAccent: "Nous, si.",
  titreApres: "",
  /** Le sous-titre fort, juste sous le H1 : le Tour VIENT chez le lecteur. */
  accroche: "L’IA vient travailler dans votre entreprise.",
  sousTitre: OFFRE,
  condition: CONDITION_GRATUITE,
  /** Les trois pastilles sous le titre : l'offre en un coup d'œil. */
  pastilles: ["Audit offert", "Formation 4 h offerte", "Tous secteurs"],
} as const;

/** La définition citable, en texte visible (GEO). */
export const DEFINITION =
  "Le Tour de France IA, organisé par Axion-IA et fondé par Williams Jullin, vient dans les entreprises qui le souhaitent, de la TPE à l’ETI, tous secteurs. Chaque entreprise reçoit chez elle un audit offert de son activité, qui chiffre ce que l’IA peut lui apporter en temps, en rentabilité et en chiffre d’affaires, puis une formation de 4 h offerte à ses équipes, qui l’aide à répondre à l’exigence de formation de l’AI Act. Une étape dure une semaine dans une ville : elle s’ouvre dès que 5 entreprises du secteur géographique ont confirmé. Le vendredi soir, une soirée réseau est ouverte à toutes les entreprises de l’étape.";

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
      texte: "Combien cela vaut-il, concrètement, pour votre entreprise ?",
    },
  ],
  chute:
    "Le Tour vient chez vous pour y répondre, chiffres à l’appui, à partir de votre activité réelle.",
} as const;

/** Ce qu'il y a dedans : quatre cartes, dans l'ordre où l'entreprise les vit. */
export const OFFRE_DETAIL = {
  titre: "Ce que le Tour vous apporte",
  cartes: [
    {
      etiquette: "Offert",
      titre: "L’audit de votre activité",
      duree: "2 à 4 h",
      texte:
        "Nous regardons comment votre entreprise travaille : vos tâches qui se répètent, vos documents, votre relation client, vos outils.",
      recu: "Vous recevez ce que l’IA peut changer chez vous, chiffré en temps, en rentabilité et en chiffre d’affaires, avec les priorités.",
    },
    {
      etiquette: "Offerte",
      titre: "La formation de vos équipes",
      duree: "4 h",
      texte:
        "Vos équipes s’exercent sur leurs propres tâches, avec des outils d’IA, dans vos locaux.",
      recu: "Elle vous aide à répondre à l’exigence de formation de l’AI Act : des équipes qui savent se servir de l’IA, et s’en servir bien.",
    },
    {
      etiquette: "Près de chez vous",
      titre: "Une étape dans votre ville",
      duree: "Une semaine",
      texte:
        "Le Tour s’installe une semaine dans votre ville et passe chez chaque entreprise de l’étape.",
      recu: REGLE_ETAPE,
    },
    {
      etiquette: "Le vendredi soir",
      titre: "La soirée réseau",
      duree: "Vendredi",
      texte: "Les entreprises de l’étape se retrouvent pour échanger, entre dirigeants et équipes.",
      recu: "Ouverte à toutes les entreprises de l’étape.",
    },
  ],
} as const;

/** Ce que l'audit chiffre : les trois leviers, en très grands caractères. */
export const LEVIERS = {
  titre: "Ce que l’audit chiffre pour vous",
  intro:
    "Pas une démonstration générale : vos chiffres, vos tâches, vos clients. L’audit met en évidence trois choses.",
  liste: [
    {
      mot: "Temps",
      texte: "Les heures que l’IA peut reprendre sur les tâches qui se répètent, poste par poste.",
    },
    {
      mot: "Rentabilité",
      texte:
        "Ce que ces heures représentent pour votre entreprise, et les coûts qui peuvent baisser.",
    },
    {
      mot: "Chiffre d’affaires",
      texte: "Les ventes que vos équipes peuvent aller chercher avec le temps rendu.",
    },
  ],
} as const;

/** Le bandeau d'accent du milieu de page : la règle d'ouverture, présentée comme une chance. */
export const BANDEAU = {
  titre: "Les premières entreprises ouvrent l’étape de leur ville.",
  texte: REGLE_ETAPE,
} as const;

/** La carte : le principe d'une étape, sans aucune ville nommée. */
export const PRINCIPE = {
  legende: "Illustration du principe. Les points ne représentent pas des villes annoncées.",
  /** Texte alternatif de la carte (la carte elle-même n'a aucun texte). */
  alt: "Carte de France stylisée. Des points marquent des villes possibles. L’un d’eux se remplit jusqu’à 5 entreprises, puis s’ouvre.",
} as const;

export const ETAPES = {
  titre: "Comment ça marche",
  liste: [
    "Vous choisissez un créneau de visio de 30 minutes",
    "Nous découvrons votre entreprise et vous confirmez la venue du Tour chez vous",
    "Dès 5 entreprises confirmées près de chez vous, l’étape s’ouvre et vous êtes prévenu",
    "Nous venons chez vous : l’audit, puis la formation de vos équipes",
  ],
} as const;

export const POUR_QUI = {
  titre: "Pour qui ?",
  phrase: "De la TPE à l’ETI. Tous secteurs.",
  tailles: ["TPE", "PME", "ETI"],
  exemplesTitre: "Quelques exemples de ce que l’audit peut mettre en évidence",
  /** Dans l'ordre des pictogrammes de `PictoSecteur`. Aucun chiffre : l'audit les donne. */
  exemples: [
    { secteur: "Commerce", gain: "Le temps passé à répondre aux mêmes questions de clients." },
    { secteur: "Industrie", gain: "La documentation qualité et le suivi de production." },
    { secteur: "Santé", gain: "La charge administrative autour des rendez-vous." },
    { secteur: "Bâtiment", gain: "Les métrés, les chiffrages et les comptes rendus de chantier." },
    { secteur: "Services", gain: "La préparation des documents qui reviennent chaque mois." },
    { secteur: "Associations", gain: "Les dossiers, les relances et le suivi des adhérents." },
    {
      secteur: "Hôtellerie-restauration",
      gain: "Les plannings, les commandes et les demandes des clients.",
    },
    { secteur: "Transport", gain: "L’organisation des tournées et les documents de livraison." },
  ],
  suite: "Votre secteur n’est pas dans la liste ? Il est concerné aussi.",
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
        "Un tour de France organisé par Axion-IA, qui vient dans les entreprises qui le souhaitent. Chacune reçoit chez elle un audit offert de son activité, puis une formation de 4 h offerte à ses équipes.",
    },
    {
      question: "Qu’est-ce qui est offert ?",
      reponse: `L’audit et la formation sont offerts aux entreprises de l’étape. Aucuns frais cachés. ${REGLE_ETAPE}`,
    },
    {
      question: "Que regarde l’audit, et que recevez-vous ?",
      reponse:
        "Nous regardons comment votre entreprise travaille : tâches répétitives, documents, relation client, outils. Vous recevez ce que l’IA peut changer chez vous, chiffré en temps, en rentabilité et en chiffre d’affaires, avec les priorités.",
    },
    {
      question: "La formation aide-t-elle pour l’AI Act ?",
      reponse:
        "Oui. L’AI Act demande aux entreprises qui utilisent l’IA de veiller à ce que leurs équipes la maîtrisent suffisamment. La formation de 4 h vous aide à répondre à cette exigence de formation. Elle ne remplace pas une analyse complète de votre conformité.",
    },
    {
      question: "Pourquoi 5 entreprises ?",
      reponse:
        "C’est le seuil pour qu’une étape ait lieu : le Tour s’installe une semaine dans la ville. Tant que votre secteur géographique n’atteint pas 5 entreprises, nous vous prévenons dès que l’étape devient possible près de chez vous.",
    },
    {
      question: "Est-ce pour mon entreprise ?",
      reponse:
        "Oui, de la TPE à l’ETI, tous secteurs. L’audit et la formation partent de votre activité réelle.",
    },
    {
      question: "Où cela se passe-t-il ?",
      reponse:
        "Chez vous, dans vos locaux. Le vendredi soir, la soirée réseau a lieu dans la ville de l’étape, ouverte à toutes les entreprises de l’étape.",
    },
    {
      question: "Quel lien avec le Tour de France cycliste ?",
      reponse:
        "Aucun. Le Tour de France IA n’a aucun lien avec le Tour de France cycliste ni avec son organisateur.",
    },
  ],
} as const;

export const APPEL_FINAL = {
  titre: "Faites venir l’IA dans votre entreprise.",
  texte: `Une visio de 30 minutes pour faire connaissance. ${REGLE_ETAPE}`,
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
    META.titre,
    META.description,
    META.imageAlt,
    ...Object.values(ENTETE),
    HEROS.surtitre,
    HEROS.titreAvant,
    HEROS.titreAccent,
    HEROS.titreApres,
    HEROS.accroche,
    HEROS.sousTitre,
    HEROS.condition,
    ...HEROS.pastilles,
    OFFRE,
    CONDITION_GRATUITE,
    REGLE_ETAPE,
    EN_BREF,
    DEFINITION,
    PROBLEME.titre,
    ...PROBLEME.constats.flatMap((c) => [c.titre, c.texte]),
    PROBLEME.chute,
    OFFRE_DETAIL.titre,
    ...OFFRE_DETAIL.cartes.flatMap((c) => [c.etiquette, c.titre, c.duree, c.texte, c.recu]),
    LEVIERS.titre,
    LEVIERS.intro,
    ...LEVIERS.liste.flatMap((l) => [l.mot, l.texte]),
    BANDEAU.titre,
    BANDEAU.texte,
    ...Object.values(PRINCIPE),
    ETAPES.titre,
    ...ETAPES.liste,
    POUR_QUI.titre,
    POUR_QUI.phrase,
    ...POUR_QUI.tailles,
    POUR_QUI.exemplesTitre,
    ...POUR_QUI.exemples.flatMap((e) => [e.secteur, e.gain]),
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
