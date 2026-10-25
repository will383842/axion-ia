// Tour de France IA — TOUT le texte de la landing, en un seul endroit (2026-10-25).
//
// Pourquoi un module à part : le test des mots interdits
// (`__tests__/le-tour-est-ouvert.spec.ts`) lit CE fichier et la page ; un
// texte écrit ailleurs échapperait à la garde.
//
// Règles de rédaction : vouvoiement, phrases courtes, apostrophe typographique
// (’), espace insécable ( ) avant « : ; ? ! » et à l'intérieur des
// guillemets. Aucun montant, aucun chiffre inventé, aucune promesse de résultat.
// L'offre est dite en clair : audit et formation GRATUITS pour les entreprises de
// l'étape, soirée à la charge de chacun, visio gratuite. Condition toujours visible
// (DGCCRF) : gratuit, la ville s'ouvre dès 5 entreprises confirmées, sans frais
// cachés. Le texte ne parle jamais de transaction à conclure : un test le garde.

import { TOUR_PREFIX } from "@/features/tour-de-france/visibilite";

/** Le nom de l'événement. */
export const NOM_DU_TOUR = "Tour de France IA";

/** Le seuil d'ouverture d'une ville — un fait du concept, pas un compteur. */
export const SEUIL_OUVERTURE = 5;

/** La page de rendez-vous visio de 30 minutes (type `tour` de `types-reservables.ts`). */
export const CHEMIN_RENDEZ_VOUS = "/fr/appel/tour-de-france-ia";

/** Le libellé unique du bouton principal. */
export const LIBELLE_CTA = "Je veux le Tour dans mon entreprise";

/** Le micro-texte sous chaque bouton principal. */
export const MICRO_TEXTE_CTA = "Visio de 30 minutes · gratuite et sans engagement";

/**
 * L'adresse du bouton, avec l'emplacement cliqué (`depuis`, mesuré en `utm_content`
 * chez Calendly). Les `utm_*` de l'arrivée sont ajoutés côté navigateur
 * (`PiloteCta.tsx`), pour que la page reste statique une fois ouverte.
 */
export function lienRendezVous(depuis: string): string {
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
    "Tour de France IA, organisé par Axion-IA\u00a0: un tracé en pointillé relie cinq étapes.",
} as const;

export const HEROS = {
  surtitre: "Tour de France IA · organisé par Axion-IA",
  /** Le H1 en trois morceaux : seul « tour » prend l'accent terracotta. */
  titreAvant: "L’IA fait le ",
  titreAccent: "tour",
  titreApres: " de France.",
  sousTitre: OFFRE,
  condition: CONDITION_GRATUITE,
} as const;

/** La définition citable, en texte visible (GEO). */
export const DEFINITION =
  "Le Tour de France IA est un événement organisé par Axion-IA, fondé par Williams Jullin. Une ville s’ouvre dès que 5 entreprises ont confirmé leur participation. Chaque entreprise reçoit alors sa journée chez elle : un audit gratuit le matin (2 à 4 h), la formation gratuite de ses équipes l’après-midi (4 h). Le vendredi soir, une soirée réseau réunit les entreprises de l’étape, chacun règle sa part.";

export const JOURNEE = {
  titre: "Votre journée",
  moments: [
    {
      moment: "Temps 1",
      titre: "Audit gratuit le matin",
      duree: "2 à 4 h",
      texte:
        "Nous regardons comment votre entreprise travaille et repérons où l’IA vous fait gagner du temps.",
    },
    {
      moment: "Temps 2",
      titre: "Formation gratuite l’après-midi",
      duree: "4 h",
      texte: "Vos équipes repartent avec des usages concrets, pour leurs propres tâches.",
    },
    {
      moment: "Temps 3",
      titre: "Soirée réseau, chacun règle sa part",
      duree: "Vendredi soir",
      texte: "Retrouvez les autres entreprises de l’étape, au restaurant.",
    },
  ],
} as const;

export const ETAPES = {
  titre: "Comment ça marche",
  liste: [
    "Vous choisissez un créneau de visio (30 min)",
    "Nous faisons connaissance et vous confirmez votre participation",
    "À 5 entreprises confirmées, la ville s’ouvre et vous êtes prévenu",
    "Nous venons chez vous : votre journée",
  ],
} as const;

export const POUR_QUI = {
  titre: "Pour qui ?",
  phrase: "De l’indépendant au grand groupe. Tous secteurs.",
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
} as const;

export const BENEFICES = {
  titre: "Ce que vous en retirez",
  liste: [
    "Un regard extérieur sur votre organisation",
    "Des cas d’usage adaptés à votre métier",
    "Des équipes formées sur leurs propres tâches",
    "Un plan d’action pour la suite",
  ],
  mention: "Sans engagement de résultat.",
} as const;

export const FONDATEUR = {
  titre: "Qui organise ?",
  ligne1: "Williams Jullin, fondateur du Tour de France IA et d’Axion-IA.",
  ligne2: "Il a imaginé le Tour pour faire venir l’IA dans les entreprises, chez elles.",
  lien: "Découvrir Williams",
  /** La fiche d'équipe d'Axion (`FOUNDER.pagePath`, servie en FR). */
  chemin: "/fr/equipe/williams",
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
        "L’audit et la formation sont gratuits pour les entreprises de l’étape. La soirée réseau est à la charge de chacun. La visio de 30 minutes est gratuite. La ville s’ouvre dès que 5 entreprises ont confirmé. Aucuns frais cachés.",
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
      reponse: "Chez vous, dans vos locaux.",
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
    DEFINITION,
    JOURNEE.titre,
    ...JOURNEE.moments.flatMap((m) => [m.moment, m.titre, m.duree, m.texte]),
    ETAPES.titre,
    ...ETAPES.liste,
    POUR_QUI.titre,
    POUR_QUI.phrase,
    ...POUR_QUI.secteurs,
    BENEFICES.titre,
    ...BENEFICES.liste,
    BENEFICES.mention,
    FONDATEUR.titre,
    FONDATEUR.ligne1,
    FONDATEUR.ligne2,
    FONDATEUR.lien,
    FAQ.titre,
    ...FAQ.questions.flatMap((q) => [q.question, q.reponse]),
    APPEL_FINAL.titre,
    PIED.organise,
    PIED.nonAffiliation,
    ...PIED.liens.map((l) => l.libelle),
  ].join("\n");
}
