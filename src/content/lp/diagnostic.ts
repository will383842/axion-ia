// Page d'atterrissage publicitaire du diagnostic (`/diagnostic`) — contenu.
//
// Séparé du rendu pour que la copie se retouche sans toucher au code : sur une
// page qui reçoit du trafic payant, le texte se teste et se change souvent,
// la mise en page presque jamais.
//
// ⚠️ RÈGLE ABSOLUE DE CETTE PAGE : tout ce qui est affirmé ici doit être VRAI.
// Les pages de ce format affichent d'ordinaire « +12 000 clients nous font
// confiance » ou des témoignages de complaisance. Inventer ces chiffres serait
// une pratique commerciale trompeuse (art. L121-2 du Code de la consommation)
// — devant une audience de dirigeants qui vérifient, ce serait aussi la pire
// décision commerciale possible.
//
// Depuis le 2026-08-14, la page porte AUSSI des preuves sociales — mais lues
// en base au rendu (note agrégée, avis vérifiés, comptes par secteur), jamais
// posées dans la copie où elles mentiraient dès le prochain avis. Ce fichier
// ne contient QUE le texte statique.

import { AUTOMATABLE_TASKS } from "@/content/roi/model/tasks";

/**
 * Vidéo de la page. `null` tant qu'aucune vidéo n'est publiée : le bloc n'est
 * alors pas rendu du tout, et la page reste cohérente (titre → preuves → CTA).
 *
 * 🔴 NE PAS pointer vers un domaine externe (R2, CDN, YouTube, Vimeo) sans
 * modifier la CSP : `src/lib/csp.ts` ne déclare aucune directive `media-src`,
 * donc `default-src 'self'` s'applique et le navigateur bloquerait la lecture
 * SANS message d'erreur visible. Deux chemins possibles :
 *   • fichier servi depuis `public/videos/` → même origine, rien à changer ;
 *   • hébergement externe → ajouter `media-src 'self' https://<domaine>` dans
 *     `csp.ts`, et l'y documenter.
 *
 * Format conseillé : MP4 H.264 720p, poids ≤ 25 Mo, avec une affiche AVIF. Le
 * `poster` est obligatoire — sans lui la vidéo affiche un rectangle noir tant
 * que rien n'est chargé, ce qui ruine l'effet d'une page construite autour
 * d'elle.
 */
export const VSL_VIDEO: {
  readonly src: string;
  readonly poster: string;
  readonly durationLabel: string;
} | null = null;

export const VSL_CONTENT = {
  /** Slug de la page — sert de dimension d'analyse pour comparer des variantes. */
  slug: "diagnostic",

  eyebrow: "Pour les dirigeants qui n'ont plus une heure à perdre",

  /**
   * Titre en trois fragments, pour que le rendu puisse souligner le milieu et
   * mettre la chute en italique. Découper la phrase ici plutôt que d'insérer
   * du balisage dans une chaîne : la copie reste lisible et traduisible.
   */
  title: {
    lead: "Découvrez quelles tâches votre entreprise",
    underlined: "peut arrêter de faire à la main",
    tail: "et ce que ça vous rapporte",
    accent: "en moins de 3 minutes",
  },

  /** Formule « sans X, sans Y » — les objections levées avant d'être formulées. */
  subtitle: {
    strong: "Sans",
    rest: "installer de logiciel, sans créer de compte, et sans rendez-vous commercial.",
  },

  videoLabel: "Regardez cette vidéo",
  videoFallbackLabel: "Ce que vous allez obtenir",

  ctaPrimary: "Lancer mon diagnostic gratuit",
  ctaHint: "Une dizaine de questions. Vous voyez votre rapport à la fin, sans rien laisser.",

  /**
   * ── Qu'est-ce que c'est + la méthode en trois temps ──────────────────────
   * Répond à la question que le visiteur se pose après la vidéo : « il se
   * passe quoi, concrètement, si je clique ? ». Le format de référence vend
   * ici sa méthode ; nous décrivons la nôtre — telle qu'elle fonctionne.
   */
  what: {
    title: "Qu'est-ce que le diagnostic Axion-IA ?",
    intro:
      "Un questionnaire qui reconstruit, à partir de vos volumes réels, le temps que vos tâches répétitives coûtent chaque année — et ce que l'IA peut en rendre. Pas de promesse générique : un chiffrage tâche par tâche, avec chaque hypothèse affichée.",
    steps: [
      {
        tag: "TEMPS 1 · RÉPONDEZ",
        name: "Une dizaine de questions, de tête",
        text: "Combien de devis par semaine, de factures par mois, d'appels par jour. Tout se répond par tranches, en un appui — et « je ne sais pas » est une réponse valable.",
      },
      {
        tag: "TEMPS 2 · LE MODÈLE CALCULE",
        name: `${AUTOMATABLE_TASKS.length} tâches de référence, hypothèses publiées`,
        text: "Chaque tâche porte son temps unitaire, la part réellement supprimable — jamais 100 % — et son délai de mise en œuvre. Rien n'est agrégé sans être justifié.",
      },
      {
        tag: "TEMPS 3 · REPARTEZ AVEC LE PLAN",
        name: "Votre rapport, à l'écran, immédiatement",
        text: "Vos cinq premières tâches à automatiser, le gain annuel de chacune, et la feuille de route à 30 jours, 3 mois et 6 mois. Sans laisser d'e-mail.",
      },
    ],
  },

  /** ── Ce qui change pour vous ──────────────────────────────────────────── */
  outcomes: {
    title: "Concrètement, voici ce qui change pour vous",
    items: [
      "Vous savez enfin quelles tâches automatiser en premier — et lesquelles laisser tranquilles",
      "Vous mettez un chiffre annuel sur un temps que tout le monde sentait partir sans le mesurer",
      "Vous arrivez face à un prestataire — nous ou un autre — avec un plan, pas une intuition",
    ],
    kicker: "Votre seule décision restante : par laquelle des cinq tâches commencer.",
  },

  /**
   * ── Ce que le rapport contient, en détail ────────────────────────────────
   * Remplace l'ancienne liste `deliverables` à quatre lignes sèches : chaque
   * livrable gagne un titre et le détail de ce qu'il contient réellement.
   */
  deliverablesDetailed: [
    {
      name: "Vos 5 premières tâches à automatiser",
      text: "Classées par rapport entre le gain et l'effort — pas par gain brut, sinon la liste recommanderait toujours le chantier le plus lourd en premier. Chacune avec son volume constaté chez vous et son délai de mise en œuvre.",
    },
    {
      name: "Le temps et l'argent récupérables sur l'année",
      text: "En heures et en euros, avec une fourchette basse et haute selon votre niveau de confiance dans vos réponses. Jamais un chiffre unique présenté comme une certitude.",
    },
    {
      name: "La feuille de route en trois vagues",
      text: "Ce qui est lançable sous 30 jours, ce qui demande de la préparation à 3 mois, et les chantiers de fond à 6 mois — avec le montant associé à chaque vague.",
    },
    {
      name: "Ce qui ne s'automatise pas chez vous",
      text: "La partie que les autres calculateurs taisent : les tâches qui engagent votre responsabilité, celles où il restera toujours la relecture et la décision. Un outil qui sait dire non est le seul qu'on croit quand il dit oui.",
    },
    {
      name: "Une adresse permanente pour votre rapport",
      text: "Transmettez-le à votre associé ou à votre expert-comptable d'un simple lien. Le rapport reste consultable, rien n'expire.",
    },
  ],

  /** Titre du mur d'avis — les avis eux-mêmes sont lus en base au rendu. */
  reviewsTitle: "Ce qu'en disent les dirigeants",

  /** ── Secteurs ─────────────────────────────────────────────────────────── */
  sectorsBlock: {
    title: "Est-ce que ça marche dans mon secteur ?",
    intro:
      "Le questionnaire s'adapte à votre métier dès la première question : un cabinet comptable et un artisan ne perdent pas leur temps sur les mêmes tâches. Et dans chaque secteur couvert, des clients ont laissé leur avis.",
  },

  /**
   * ── Engagements ──────────────────────────────────────────────────────────
   * À la place du « satisfait ou remboursé » du format de référence — qui n'a
   * aucun sens sur un diagnostic gratuit et contredirait les CGV (obligation
   * de moyens). Chaque ligne est tenable et vérifiable séance tenante.
   */
  commitments: {
    title: "Nos engagements — pas de garantie inventée",
    items: [
      {
        name: "Gratuit, vraiment",
        text: "Aucune carte bancaire, aucun paiement caché, aucun « essai » qui se transforme en abonnement.",
      },
      {
        name: "Le rapport s'affiche sans e-mail",
        text: "Vous voyez tout à l'écran. L'e-mail n'est demandé que si vous voulez recevoir le rapport — jamais pour le voir.",
      },
      {
        name: "Rien n'est transmis sans votre demande",
        text: "Le questionnaire et le calcul tournent entièrement dans votre navigateur. Aucune réponse ne nous parvient tant que vous ne l'avez pas explicitement demandé.",
      },
      {
        name: "Aucun rendez-vous commercial imposé",
        text: "Personne ne vous rappellera parce que vous avez fait le diagnostic. Si vous voulez qu'on vous rappelle, c'est un bouton — que vous cliquez ou pas.",
      },
    ],
  },

  /** ── FAQ ──────────────────────────────────────────────────────────────── */
  faq: {
    title: "Questions fréquentes",
    items: [
      {
        id: "vraiment-gratuit",
        question: "C'est vraiment gratuit ? Où est le piège ?",
        answer:
          "Le diagnostic est gratuit et le rapport s'affiche à l'écran sans rien laisser. Notre intérêt est simple et assumé : une partie des dirigeants qui voient leur rapport veulent ensuite un chiffrage mesuré sur leurs process réels — c'est l'audit Axion-IA, payant. Le diagnostic n'est pas bridé pour vous y pousser.",
      },
      {
        id: "secteur",
        question: "Est-ce que ça fonctionne dans mon secteur ?",
        answer:
          "Le questionnaire couvre dix secteurs — comptabilité, juridique, BTP, santé, commerce, restauration-hôtellerie, industrie, RH, artisanat et services, secteur public — et s'adapte à votre métier dès la première question. Les tâches examinées ne sont pas les mêmes pour un cabinet comptable et pour un artisan.",
      },
      {
        id: "duree",
        question: "Combien de temps ça prend ?",
        answer:
          "Entre deux et quatre minutes. Le questionnaire s'adapte à la taille de votre entreprise : un indépendant répond à huit questions, un cabinet de quarante personnes à seize. Tout se répond par tranches, au pouce, sans jamais taper un chiffre.",
      },
      {
        id: "contenu-rapport",
        question: "Qu'est-ce que je reçois exactement ?",
        answer:
          "Vos cinq premières tâches à automatiser avec le gain annuel et le délai de chacune, le temps et l'argent récupérables sur l'année en fourchette, la feuille de route à 30 jours, 3 mois et 6 mois, et la liste de ce qui ne s'automatise pas chez vous. Le tout à l'écran, immédiatement, avec une adresse permanente pour le partager.",
      },
      {
        id: "fiabilite",
        question: "Les chiffres sont-ils fiables ?",
        answer: `Ce sont des ordres de grandeur produits par un modèle dont toutes les hypothèses sont publiées — ${AUTOMATABLE_TASKS.length} tâches de référence, chacune avec son temps unitaire et la justification de son taux. Ce n'est ni un devis, ni un audit, ni un engagement de résultat : pour un chiffrage mesuré sur vos process réels, c'est l'objet de l'audit.`,
      },
      {
        id: "donnees",
        question: "Mes réponses sont-elles enregistrées ?",
        answer:
          "Non. Le questionnaire et le calcul se déroulent entièrement dans votre navigateur. Aucune réponse ne nous est transmise tant que vous ne demandez pas explicitement à recevoir le rapport par e-mail — et le rapport complet reste visible à l'écran sans rien saisir.",
      },
      {
        id: "apres",
        question: "Qu'est-ce qui se passe après le diagnostic ?",
        answer:
          "Vous repartez avec votre rapport, point. Personne ne vous rappelle. Si vous voulez aller plus loin, deux boutons existent dans le rapport : demander un audit sur vos process réels, ou réserver un appel. Les deux sont à votre initiative.",
      },
      {
        id: "qui",
        question: "Qui est derrière ce diagnostic ?",
        answer:
          "Axion-IA, cabinet français d'implémentation et de formation IA pour les entreprises, fondé par Williams — l'auteur du modèle d'estimation. Les avis publiés sur le site sont déposés par des clients et vérifiés avant publication.",
      },
    ],
  },

  /** Titre du bloc final, au-dessus du dernier bouton. */
  finalTitle:
    "Voyez ce que vos tâches répétitives vous coûtent — et ce qu'elles peuvent vous rendre",

  /**
   * Preuves. Chacune est vérifiable sur le site : pas de chiffre de notoriété,
   * pas de logo client. Cf. l'avertissement en tête de fichier.
   */
  proofs: [
    { label: "Gratuit", detail: "Aucune carte, aucun engagement" },
    { label: "Sans inscription", detail: "Le rapport s'affiche sans e-mail" },
    {
      label: `${AUTOMATABLE_TASKS.length} tâches de référence`,
      detail: "Chaque chiffre est justifié, ligne par ligne",
    },
  ],

  founder: {
    name: "Williams",
    role: "Fondateur d'Axion-IA, auteur du modèle d'estimation",
    quote:
      "La plupart des calculateurs vous font inventer le chiffre qui sert ensuite à vous impressionner. Le nôtre ne demande que ce que vous savez déjà, et vous dit aussi ce qui ne s'automatise pas.",
    photo: "/illustrations/william-fondateur-formateur-ia-axion-ia.avif",
    photoAlt: "Williams, fondateur d'Axion-IA",
  },

  legal:
    "Estimation issue d'un modèle dont toutes les hypothèses sont publiées. Ni un devis, ni un audit, ni un engagement de résultat.",
} as const;
