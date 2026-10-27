// Tour France IA — TOUT le texte de la landing, en un seul endroit (2026-10-25,
// refonte « landing de conversion » le 2026-10-26, refonte VISUELLE le 2026-10-27,
// nouveau modèle « 5 journées offertes par ville, sur sélection » le 2026-10-27).
//
// Pourquoi un module à part : le test des mots interdits
// (`__tests__/le-tour-est-ouvert.spec.ts`) lit CE fichier et la page ; un
// texte écrit ailleurs échapperait à la garde. Les composants visuels
// (`_composants/`) ne portent AUCUN texte visible : ils le reçoivent d'ici. Les
// conditions générales ont leur propre module (`conditions-generales/conditions.ts`),
// hors de cette garde : elles seules disent le tarif et le détail juridique.
//
// Le modèle, du point de vue de l'entreprise : une ville s'ouvre dès 5 demandes.
// Chaque ville a 5 journées OFFERTES (un audit, puis une formation de 4 h de
// l'équipe, en intra-entreprise et en présentiel), attribuées sur sélection (une
// visio, puis un court questionnaire), EN ÉCHANGE d'un podcast tourné chez
// l'entreprise. Sinon, la même journée existe à un tarif Tour (convenu avec
// l'entreprise, sans montant publié : voir les conditions générales). Le dîner du
// vendredi soir est facultatif et n'est PAS compris dans la journée offerte : il
// n'apparaît jamais dans la frise du héros.
//
// 🔑 La contrepartie est dite sur la page, en un mot doux (« podcast ») : sous
// chaque grand bouton, dans la même boîte que lui. Elle n'est jamais tue (ce
// serait une publicité trompeuse), et jamais dite en mots qui font peur près du
// bouton : « filmé » n'apparaît que dans la FAQ (et les conditions générales).
//
// 🔑 Très peu de texte : 200 mots visibles maximum hors FAQ, conditions et pied
// de page, des titres de 6 mots maximum. Ajouter une phrase ici, c'est la retirer
// ailleurs.
//
// Règles de rédaction : vouvoiement, phrases courtes, apostrophe typographique
// (’), espace insécable ( ) avant « : ; ? ! ». Aucun montant sur la landing,
// aucun chiffre inventé, aucune promesse de résultat : l'audit « chiffre », il ne
// promet pas. « Offert » ne qualifie QUE la journée (l'audit et la formation) :
// jamais la visio (« sans engagement », `MICRO_TEXTE_CTA`), jamais le dîner.
// Jamais de vocabulaire de salon, de guichet ou de transaction : un test le garde.
//
// Les seuls chiffres de la page sont ceux du CONCEPT (3 étapes, 4 h, 5 demandes,
// 5 entreprises, 15 personnes, 30 minutes, 1 minute) : aucun compteur par ville,
// aucune statistique, aucun horaire.

import { TOUR_PREFIX } from "@/features/tour-de-france/visibilite";

/** Le nom du Tour. */
export const NOM_DU_TOUR = "Tour France IA";

/** Le seuil qui OUVRE une ville, et le nombre de journées offertes par ville. Jamais un compteur. */
export const SEUIL_PAR_VILLE = 5;

/** La page de rendez-vous visio de 30 minutes (type `tour` de `types-reservables.ts`). */
export const CHEMIN_RENDEZ_VOUS = "/fr/appel/tour-france-ia";

/** Les conditions générales du Tour (`conditions-generales/page.tsx`). */
export const CHEMIN_CONDITIONS = `${TOUR_PREFIX}/conditions-generales`;

/** Le libellé des grands boutons : ce que l'entreprise demande. Une seule action sur la page. */
export const LIBELLE_CTA = "Demander ma journée offerte";

/** Le même, en court : l'en-tête, le bloc « gains » et la barre collante. */
export const LIBELLE_CTA_COURT = "Ma journée offerte";

/**
 * Le micro-texte sous chaque grand bouton — la SEULE phrase qui décrit la visio.
 * Sans « gratuite » ni « offerte » : ces mots ne qualifient que la journée.
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
 * jamais repliées, dans la même boîte que le bouton du héros : qui est retenu,
 * comment, en échange de quoi, et quand une ville s'ouvre.
 */
export const CONDITIONS =
  "Offerte aux 5 entreprises retenues par ville, après une visio, en échange d’un podcast chez vous. Votre ville s’ouvre dès 5 demandes.";

/** Le lien qui suit les conditions, partout où elles sont dites. */
export const LIEN_CONDITIONS = {
  libelle: "Conditions générales",
  chemin: CHEMIN_CONDITIONS,
} as const;

/**
 * La vidéo du héros : elle viendra. Tant qu'elle vaut `null`, l'emplacement
 * (`_composants/EmplacementVideo.tsx`) montre la frise dessinée, et la page ne
 * porte AUCUNE balise `video`. Le jour venu : un MP4, son affiche, ses
 * sous-titres en français — jamais de lecteur tiers.
 */
export const VIDEO_HEROS: null | { mp4: string; poster: string; vtt: string } = null;

/** La promesse, juste sous le H1 : ce qu'il faut retenir de la page. */
export const PROMESSE =
  "Une journée offerte dans votre entreprise : audit + formation IA de votre équipe.";

export const META = {
  titre: "Tour France IA dans votre ville : une journée offerte",
  description:
    "Une journée offerte dans votre entreprise : audit + formation IA de votre équipe. 5 entreprises retenues par ville.",
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
    "Tour France IA, organisé par Axion-IA : sur fond sombre aux couleurs d’Axion-IA, « Vous entendez parler d’IA partout et ne savez plus par où commencer ? Nous, si. » Audit offert, formation de 4 h offerte, de la TPE à l’ETI.",
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
  surtitre: "Le Tour France IA arrive dans votre ville",
  /**
   * Le H1, accroche validée (inchangée), en trois morceaux : seul « Nous, si. » prend
   * l'accent. Le lecteur se reconnaît, puis Axion-IA répond.
   */
  titreAvant: "Vous entendez parler d’IA partout et ne savez plus par où commencer ? ",
  titreAccent: "Nous, si.",
  titreApres: "",
  promesse: PROMESSE,
  /** La frise du premier écran : trois disques dessinés. Le vendredi soir n'y est JAMAIS. */
  friseTitre: "Votre journée offerte",
  frise: ["Audit", "Formation", "4 h chez vous"],
  conditions: CONDITIONS,
} as const;

/**
 * La définition citable — NON affichée (la page est visuelle) : elle nourrit la
 * description du `Service` du JSON-LD, et `llms.txt` dit la même chose.
 * Elle ne dit rien que la page visible, sa FAQ et ses conditions ne disent.
 */
export const DEFINITION =
  "Le Tour France IA, organisé par Axion-IA et fondé par Williams Jullin, offre une journée à des entreprises de la TPE à l’ETI, tous secteurs : un audit de leur activité, qui chiffre ce que l’IA peut leur apporter, puis une formation de 4 h de leur équipe, en intra-entreprise et en présentiel, qui les aide à répondre à l’exigence de formation de l’AI Act. Le Tour va de ville en ville : une ville s’ouvre dès 5 demandes, puis une semaine, une entreprise par jour. La journée est offerte aux 5 entreprises retenues par ville, après une visio et un court questionnaire, en échange d’un podcast tourné chez elles ; les autres peuvent recevoir la même journée à un tarif Tour. Le vendredi soir, un dîner des dirigeants, facultatif et non compris dans la journée offerte.";

/** La ville : le seuil, la semaine, et la carte — sans aucune ville nommée. */
export const VILLE = {
  titre: "Votre ville s’ouvre dès 5 demandes",
  semaine: "Puis une semaine : une entreprise par jour, du lundi au vendredi.",
  legende: "Illustration : aucune ville n’est encore annoncée.",
  /** Texte alternatif de la carte (la carte elle-même n'a aucun texte). */
  alt: "Carte de France stylisée. Des points marquent des villes possibles. L’un d’eux reçoit 5 demandes, puis la ville s’ouvre.",
} as const;

/** Ce que l'entreprise gagne : trois cartes, un dessin chacune. */
export const GAINS = {
  titre: "Ce que vous gagnez",
  cartes: [
    { titre: "On trouve vos heures perdues.", texte: "L’audit du matin, chiffré." },
    { titre: "On vous montre votre première automatisation.", texte: "Sur vos propres tâches." },
    {
      titre: "Votre équipe formée à l’IA.",
      texte:
        "4 h chez vous, jusqu’à 15 personnes. Elle aide à répondre à l’exigence de formation de l’AI Act.",
    },
  ],
} as const;

/** Les 5 entreprises retenues : ce qu'elles reçoivent en plus. Aucun logo, aucune personne inventée. */
export const AMBASSADEURS = {
  titre: "5 entreprises, visages de leur ville",
  avantages: [
    "Votre page sur notre site, avec un lien vers le vôtre",
    "Votre dirigeant dans notre podcast",
    "Le dîner des dirigeants, vendredi soir (facultatif)",
  ],
} as const;

/** En 3 étapes : une pastille dessinée et une ligne chacune. */
export const ETAPES = {
  titre: "En 3 étapes",
  liste: ["Votre demande, en 1 minute", "Une visio de 30 minutes", "Retenu ? Votre jour est fixé"],
} as const;

/**
 * Qui vient chez vous : la photo du fondateur, une phrase, sa fiche. La phrase est
 * dite par l'ÉQUIPE (« on ») : celui qui vient peut être le fondateur ou l'un de
 * ses équipiers, et la légende le dit (`legende`). Jamais de « je ».
 */
export const FONDATEUR = {
  titre: "Qui vient chez vous",
  /** Illustration existante du site (1000 × 1000), servie telle quelle à 96 px, en différé. */
  photo: "/illustrations/william-fondateur-axion-ia.webp",
  alt: "Williams Jullin, fondateur d’Axion-IA",
  citation:
    "On vient chez vous, on regarde comment vous travaillez, et on vous montre ce que l’IA peut faire dès demain.",
  /** Sous la citation : qui la dit, en vrai (le fondateur OU un membre de son équipe). */
  legende: "Williams Jullin, fondateur d’Axion-IA, ou un membre de son équipe",
  /** La fiche d'équipe d'Axion (`FOUNDER.pagePath`, servie en FR). */
  lien: { libelle: "Découvrir Williams", chemin: "/fr/equipe/williams" },
} as const;

type QuestionReponse = { question: string; reponse: string };

export const FAQ: { titre: string; questions: readonly QuestionReponse[] } = {
  titre: "Questions fréquentes",
  questions: [
    {
      question: "C’est vraiment offert ?",
      reponse: "Oui : l’audit et la formation, pour les 5 entreprises retenues par ville.",
    },
    {
      question: "Y a-t-il une contrepartie ?",
      reponse:
        "Un podcast avec le dirigeant, et quelques mots de salariés volontaires, tournés pendant la journée. Rien de confidentiel n’est filmé, et la journée reste possible sans tournage (voir les conditions générales).",
    },
    {
      question: "Et si je ne suis pas retenu ?",
      reponse:
        "Nous vous proposons la même journée à un tarif Tour, convenu avec vous (voir les conditions générales). C’est aussi possible si vous préférez ne pas être filmé.",
    },
    {
      question: "Comment les entreprises sont-elles choisies ?",
      reponse:
        "Après la visio et un court questionnaire, selon des critères publiés dans les conditions générales, pas selon l’ordre d’arrivée.",
    },
    {
      question: "Combien de temps, et qui participe ?",
      reponse:
        "Une journée : l’audit le matin avec le dirigeant ou un responsable, la formation l’après-midi pour jusqu’à 15 personnes.",
    },
    {
      question: "Le dîner du vendredi est-il compris ?",
      reponse:
        "Non. Le repas réseau du vendredi soir est facultatif et n’est pas compris dans la journée offerte.",
    },
  ],
};

export const APPEL_FINAL = {
  titre: "5 journées offertes par ville.",
  /** Sous le bouton final : les conditions, en court, puis le lien vers les conditions générales. */
  conditions: "5 entreprises retenues par ville, en échange d’un podcast.",
} as const;

export const PIED = {
  organise: "Organisé par Axion-IA",
  nonAffiliation:
    "Le Tour France IA n’a aucun lien avec le Tour de France cycliste ni avec son organisateur.",
  liens: [
    { libelle: "Conditions générales du Tour", href: CHEMIN_CONDITIONS },
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
 * Le texte RÉDIGÉ visible hors FAQ, hors conditions et hors pied de page, dans
 * l'ordre de la page — celui dont on tient le budget (200 mots maximum). Les
 * libellés des boutons, leurs micro-textes et le logo sont comptés à part
 * (`texteDesBoutons`) : ils se répètent à chaque emplacement.
 */
export function texteVisibleHorsFaq(): string {
  return [
    HEROS.surtitre,
    HEROS.titreAvant,
    HEROS.titreAccent,
    HEROS.promesse,
    ...HEROS.frise,
    VILLE.titre,
    VILLE.semaine,
    VILLE.legende,
    GAINS.titre,
    ...GAINS.cartes.flatMap((c) => [c.titre, c.texte]),
    AMBASSADEURS.titre,
    ...AMBASSADEURS.avantages,
    ETAPES.titre,
    ...ETAPES.liste,
    FONDATEUR.titre,
    FONDATEUR.citation,
    FONDATEUR.legende,
    FONDATEUR.lien.libelle,
    APPEL_FINAL.titre,
  ].join("\n");
}

/** Le logo, puis chaque bouton et son micro-texte, à chaque affichage (en-tête, héros, gains, appel final). */
export function texteDesBoutons(): string {
  return [
    ENTETE.logo,
    LIBELLE_CTA_COURT,
    LIBELLE_CTA,
    MICRO_TEXTE_CTA,
    LIBELLE_CTA_COURT,
    LIBELLE_CTA,
    MICRO_TEXTE_CTA,
  ].join("\n");
}

/** Les conditions telles qu'affichées sur la landing : sous le bouton du héros, puis sous le bouton final. */
export function texteDesConditions(): string {
  return [
    HEROS.conditions,
    LIEN_CONDITIONS.libelle,
    APPEL_FINAL.conditions,
    LIEN_CONDITIONS.libelle,
  ].join("\n");
}

/** Tout le texte, à plat (visible, alternatif, méta, JSON-LD) — pour le test des mots interdits. */
export function toutLeTexte(): string {
  return [
    texteVisibleHorsFaq(),
    texteDesBoutons(),
    texteDesConditions(),
    META.titre,
    META.description,
    META.imageAlt,
    ...Object.values(ENTETE),
    HEROS.friseTitre,
    DEFINITION,
    VILLE.alt,
    FONDATEUR.alt,
    FAQ.titre,
    ...FAQ.questions.flatMap((q) => [q.question, q.reponse]),
    PIED.organise,
    PIED.nonAffiliation,
    ...PIED.liens.map((l) => l.libelle),
  ].join("\n");
}
