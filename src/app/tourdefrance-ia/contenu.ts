// Tour de France IA — TOUT le texte de la landing, en un seul endroit (2026-10-25,
// refonte « landing de conversion » le 2026-10-26, refonte VISUELLE « une journée
// offerte » le 2026-10-27).
//
// Pourquoi un module à part : le test des mots interdits
// (`__tests__/le-tour-est-ouvert.spec.ts`) lit CE fichier et la page ; un
// texte écrit ailleurs échapperait à la garde. Les composants visuels
// (`_composants/`) ne portent AUCUN texte visible : ils le reçoivent d'ici.
//
// Ce que la page dit, du point de vue de l'entreprise, et RIEN d'autre : le Tour
// lui offre UNE JOURNÉE chez elle — un audit de son activité, puis une formation
// de 4 h de son équipe, en intra-entreprise et en présentiel, qui l'aide à
// répondre à l'exigence de formation de l'AI Act (formule prudente : ni
// obligation, ni attestation, ni promesse de conformité). Le Tour va de ville en
// ville ; une ville se déclenche à partir de 5 entreprises, et aucune date n'est
// fixée avant. Le vendredi soir : un repas réseau entre entrepreneurs de la ville,
// sans un mot de plus (ni qui règle, ni montant).
//
// 🔑 La condition (`CONDITIONS`) est écrite UNE fois, en toutes lettres, sans
// astérisque : sous le bouton du premier écran, dans la même boîte que lui, sous
// le bouton de l'appel final, et dans la FAQ. Aucun chiffre de plafond : « quelques
// places par ville ». Le 5 est un seuil de déclenchement, jamais un maximum.
//
// 🔑 Très peu de texte (refonte du 2026-10-27, la page était jugée bien trop
// textuelle sur téléphone) : ~150 mots visibles hors FAQ, un dessin par bloc,
// des titres de 6 mots maximum, une ligne de soutien. Ajouter une phrase ici, c'est
// la retirer ailleurs.
//
// Règles de rédaction : vouvoiement, phrases courtes, apostrophe typographique
// (’), espace insécable ( ) avant « : ; ? ! » et à l'intérieur des
// guillemets. Aucun montant, aucun chiffre inventé, aucune promesse de résultat :
// l'audit « chiffre », il ne promet pas. « Offert » ne qualifie QUE la journée,
// c'est-à-dire l'audit et la formation : jamais la visio (« sans engagement »,
// `MICRO_TEXTE_CTA`), jamais le repas. Jamais de vocabulaire de salon, de
// guichet ou de transaction : un test le garde (liste dans les tests).
//
// Les seuls chiffres de la page sont ceux du CONCEPT (3 étapes, 4 h, 5 entreprises,
// 30 minutes) : aucun compteur, aucune statistique, aucun horaire.

import { TOUR_PREFIX } from "@/features/tour-de-france/visibilite";

/** Le nom du Tour. */
export const NOM_DU_TOUR = "Tour de France IA";

/** Le seuil qui DÉCLENCHE une ville — un fait du concept, jamais un maximum ni un compteur. */
export const SEUIL_PAR_VILLE = 5;

/** La page de rendez-vous visio de 30 minutes (type `tour` de `types-reservables.ts`). */
export const CHEMIN_RENDEZ_VOUS = "/fr/appel/tour-de-france-ia";

/** Le libellé des grands boutons : ce que l'entreprise obtient. Une seule action sur la page. */
export const LIBELLE_CTA = "Je veux ma journée offerte";

/** Le même, en court : l'en-tête, le bloc « journée » et la barre collante. */
export const LIBELLE_CTA_COURT = "Ma journée offerte";

/**
 * Le micro-texte sous le bouton de l'appel final — la SEULE phrase qui décrit la
 * visio. Sans « gratuite » ni « offerte » : ces mots ne qualifient que la journée.
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

/**
 * Les conditions, en petit mais lisibles (13 px, contraste AA), sans astérisque,
 * jamais repliées : dans le même champ visuel que la promesse et le bouton.
 */
export const CONDITIONS =
  "Limité à quelques places par ville. Une ville se déclenche à partir de 5 entreprises ; aucune date n’est fixée avant.";

/** La promesse, juste sous le H1 : ce qu'il faut retenir de la page. */
export const PROMESSE =
  "Une journée offerte dans votre entreprise : audit + formation IA de votre équipe.";

export const META = {
  titre: "Tour de France IA : une journée offerte chez vous",
  description:
    "Une journée offerte dans votre entreprise : audit + formation IA de votre équipe, en présentiel. Limité à quelques places par ville.",
  /** Chemin canonique (sans barre finale : `trailingSlash` est faux sur tout le site). */
  chemin: TOUR_PREFIX,
  /**
   * Image de partage 1200 × 630 : `opengraph-image.jpg` et `twitter-image.jpg` de ce
   * dossier (convention de FICHIER — elle seule l'emporte sur `src/app/opengraph-image.tsx`,
   * qui s'appliquerait sinon à toutes les routes). Texte alternatif : `*.alt.txt`,
   * qui décrit l'image telle qu'elle est (le H1 et « audit offert, formation offerte »).
   */
  image: `${TOUR_PREFIX}/opengraph-image.jpg`,
  imageAlt:
    "Tour de France IA, organisé par Axion-IA : sur fond sombre aux couleurs d’Axion-IA, « Vous entendez parler d’IA partout et ne savez plus par où commencer ? Nous, si. » Audit offert, formation de 4 h offerte, de la TPE à l’ETI.",
} as const;

/** L'en-tête du tunnel : le logo, et c'est tout (le bouton porte `LIBELLE_CTA_COURT`). */
export const ENTETE = {
  /** Nom accessible du logo (`role="img"` : le tiret dessiné est décoratif, le nom le porte). */
  logo: "Axion-IA",
  marque: "Axion",
  marqueAccent: "IA",
} as const;

export const HEROS = {
  /** La puce au-dessus du titre (Manrope : jamais d'Inconsolata au-dessus du pli). */
  surtitre: NOM_DU_TOUR,
  /**
   * Le H1, accroche validée (inchangée), en trois morceaux : seul « Nous, si. » prend
   * l'accent. Le lecteur se reconnaît, puis Axion-IA répond.
   */
  titreAvant: "Vous entendez parler d’IA partout et ne savez plus par où commencer ? ",
  titreAccent: "Nous, si.",
  titreApres: "",
  promesse: PROMESSE,
  /** La frise du premier écran : trois disques dessinés, un mot chacun. */
  friseTitre: "Votre journée offerte, puis le vendredi soir",
  frise: ["Audit", "Formation d’équipe", "Puis, vendredi soir"],
  conditions: CONDITIONS,
} as const;

/**
 * La définition citable — NON affichée (la page est visuelle) : elle nourrit la
 * description du `Service` du JSON-LD, et `llms.txt` dit la même chose.
 * Elle ne dit rien que la page visible ne dise.
 */
export const DEFINITION =
  "Le Tour de France IA, organisé par Axion-IA et fondé par Williams Jullin, offre une journée aux entreprises qui le souhaitent, de la TPE à l’ETI, tous secteurs : un audit de leur activité, qui chiffre ce que l’IA peut leur apporter, puis une formation de 4 h de leur équipe, en intra-entreprise et en présentiel, qui les aide à répondre à l’exigence de formation de l’AI Act. Le Tour va de ville en ville. Limité à quelques places par ville : une ville se déclenche à partir de 5 entreprises, et aucune date n’est fixée avant. Le vendredi soir, un repas réseau entre entrepreneurs de la ville.";

/** La carte : le principe, sans aucune ville nommée. */
export const PRINCIPE = {
  legende: "Illustration\u00a0: les points ne représentent pas des villes annoncées.",
  /** Texte alternatif de la carte (la carte elle-même n'a aucun texte). */
  alt: "Carte de France stylisée. Des points marquent des villes possibles. L’un d’eux se remplit jusqu’à 5 entreprises, puis la ville se déclenche.",
} as const;

/** En 3 étapes : une pastille dessinée et une ligne chacune. */
export const ETAPES = {
  titre: "En 3 étapes",
  liste: [
    "Une visio de 30 minutes",
    "Votre ville se déclenche",
    "Votre journée offerte, chez vous",
  ],
} as const;

/** La journée : le matin l'audit, l'après-midi la formation. Aucun horaire chiffré. */
export const JOURNEE = {
  titre: "Votre journée offerte",
  moments: [
    { moment: "Matin", titre: "L’audit", texte: "Ce que l’IA peut vous apporter, chiffré." },
    {
      moment: "Après-midi",
      titre: "La formation",
      texte: "Votre équipe s’exerce sur ses propres tâches.",
    },
  ],
  /** Sous l'audit : ce qu'il chiffre, en trois mots dessinés. */
  leviers: ["Temps", "Rentabilité", "Chiffre d’affaires"],
  /** Sous la formation : sa forme, puis l'AI Act, dit avec prudence. */
  forme: "4 h, en intra-entreprise et en présentiel.",
  aiAct: "Elle vous aide à répondre à l’exigence de formation de l’AI Act.",
} as const;

/** Le vendredi soir : un fait, sans aucune promesse (ni qui règle, ni montant). */
export const VENDREDI = {
  titre: "Le vendredi soir",
  texte: "Un repas réseau entre entrepreneurs de la ville.",
} as const;

type QuestionReponse = {
  question: string;
  reponse: string;
  /** Un lien sous la réponse (la fiche du fondateur). */
  lien?: { libelle: string; chemin: string };
};

export const FAQ: { titre: string; questions: readonly QuestionReponse[] } = {
  titre: "Questions fréquentes",
  questions: [
    {
      question: "Qu’est-ce qui est offert ?",
      reponse: `Une journée dans votre entreprise : l’audit de votre activité, puis une formation de 4 h de votre équipe, en intra-entreprise et en présentiel. ${CONDITIONS}`,
    },
    {
      question: "Pour quelles entreprises ?",
      reponse:
        "De la TPE à l’ETI, tous secteurs. L’audit et la formation partent de votre activité.",
    },
    {
      question: "Et si ma ville n’a pas encore 5 entreprises ?",
      reponse:
        "Votre ville se déclenche à partir de 5 entreprises. Aucune date n’est fixée avant.",
    },
    {
      question: "La formation aide-t-elle pour l’AI Act ?",
      reponse:
        "Elle vous aide à répondre à l’exigence de formation de l’AI Act. Elle ne remplace pas une analyse de votre conformité.",
    },
    {
      question: "Qui organise ?",
      reponse: "Axion-IA, fondée par Williams Jullin.",
      /** La fiche d'équipe d'Axion (`FOUNDER.pagePath`, servie en FR). */
      lien: { libelle: "Découvrir Williams", chemin: "/fr/equipe/williams" },
    },
    {
      question: "Quel lien avec le Tour de France cycliste ?",
      reponse:
        "Aucun. Le Tour de France IA n’a aucun lien avec le Tour de France cycliste ni avec son organisateur.",
    },
  ],
};

export const APPEL_FINAL = {
  titre: "Faites venir l’IA chez vous.",
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

/**
 * Le texte VISIBLE hors FAQ et hors pied de page, dans l'ordre de la page — celui
 * dont on tient le budget (~150 mots). Les conditions y comptent deux fois : elles
 * sont affichées deux fois (premier écran, appel final).
 */
export function texteVisibleHorsFaq(): string {
  return [
    ENTETE.logo,
    LIBELLE_CTA_COURT,
    HEROS.surtitre,
    HEROS.titreAvant,
    HEROS.titreAccent,
    HEROS.promesse,
    ...HEROS.frise,
    LIBELLE_CTA,
    HEROS.conditions,
    PRINCIPE.legende,
    ETAPES.titre,
    ...ETAPES.liste,
    JOURNEE.titre,
    ...JOURNEE.moments.flatMap((m) => [m.moment, m.titre, m.texte]),
    ...JOURNEE.leviers,
    JOURNEE.forme,
    JOURNEE.aiAct,
    LIBELLE_CTA_COURT,
    VENDREDI.titre,
    VENDREDI.texte,
    APPEL_FINAL.titre,
    LIBELLE_CTA,
    MICRO_TEXTE_CTA,
    CONDITIONS,
  ].join("\n");
}

/** Tout le texte, à plat (visible, alternatif, méta, JSON-LD) — pour le test des mots interdits. */
export function toutLeTexte(): string {
  return [
    texteVisibleHorsFaq(),
    META.titre,
    META.description,
    META.imageAlt,
    ...Object.values(ENTETE),
    HEROS.friseTitre,
    DEFINITION,
    PRINCIPE.alt,
    FAQ.titre,
    ...FAQ.questions.flatMap((q) => [q.question, q.reponse, q.lien?.libelle ?? ""]),
    PIED.organise,
    PIED.nonAffiliation,
    ...PIED.liens.map((l) => l.libelle),
  ].join("\n");
}
