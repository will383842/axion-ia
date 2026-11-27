/**
 * Contenu SSOT de la fiche d'autorité `/fr/equipe/williams`.
 *
 * Pourquoi un fichier de contenu séparé du composant : la fiche fondateur est
 * une page d'ENTITÉ (E-E-A-T + AEO/GEO). Les mêmes phrases servent trois
 * consommateurs différents — le HTML visible, le JSON-LD `Person` /
 * `ProfilePage`, et la meta description. Les laisser recopiées dans le JSX
 * garantissait qu'elles divergent.
 *
 * Angle de la page : la transformation de l'entreprise avec l'IA, simple et
 * rassurante. Rien ne casse, l'équipe garde ses outils, on avance étape par
 * étape, le dirigeant décide. Le résultat visé est celui du dirigeant (plus de
 * chiffre d'affaires, de marge et de temps, sans recruter) ; l'IA n'est que le
 * moyen.
 *
 * 🔴 DOCTRINE FINANCEMENT — les entrées OPCO / France Travail de ce fichier
 * ne sont JAMAIS émises telles quelles : elles passent par
 * `buildWilliamsFaq({ certificationObtenue })` et par le drapeau
 * `isQualiopiCertificationObtenue()`. Afficher « finançable OPCO » avant la
 * délivrance du certificat est illégal (cf. `server/qualiopi/config/flag.ts`).
 *
 * 🔴 RÈGLES DE LANGUE
 *  - Axion-IA est une équipe : « nous », « l'équipe d'Axion-IA ». Williams en
 *    est le dirigeant, jamais un indépendant.
 *  - « startup » est le mot principal pour Axion-IA (`NATURE_AXION_IA`),
 *    « entreprise » en alternance ; jamais « agence ».
 *  - « aide à », jamais « garantit ». La seule garantie citée est celle de la
 *    Journée IA, injectée depuis `journee-ia-commun.ts`, jamais retapée.
 *  - Aucun prix, aucun gain chiffré promis, aucune ville, aucun mot de succès.
 */

import { FOUNDER } from "@/lib/brand";
import { CONDITION_GARANTIE, GARANTIE_PHRASE, RAPPORT_COMPLET } from "@/content/journee-ia-commun";

/**
 * Date de dernière révision ÉDITORIALE de la fiche — `dateModified` du
 * `ProfilePage` et du `FAQPage`, et date visible « Mis à jour le ».
 *
 * Volontairement constante : un timestamp de build avance à chaque déploiement
 * et transforme un signal de fraîcheur en bruit.
 *
 * ⚠️ À BOUGER À LA MAIN quand le contenu de la fiche change réellement — et
 * seulement dans ce cas.
 */
export const WILLIAMS_REVISION_DATE = "2026-11-27T00:00:00.000Z";

/** Mot principal pour désigner Axion-IA (une seule source pour les trois endroits clés). */
export const NATURE_AXION_IA = "startup";

/** Fonction affichée sous le H1 et dans la figcaption. */
export const WILLIAMS_FONCTION = "Fondateur et dirigeant d'Axion-IA";

/** Ce que l'équipe apporte, en une ligne. */
export const WILLIAMS_TAGLINE = "Rentabilité et productivité des TPE et PME grâce à l'IA";

/** Ligne sous le H1. */
export const WILLIAMS_SOUS_TITRE = `${WILLIAMS_FONCTION} · ${WILLIAMS_TAGLINE}`;

/** Titre SEO (balise `<title>`, sans suffixe de marque). */
export const WILLIAMS_TITRE_SEO = `${FOUNDER.fullName} · Plus de chiffre d'affaires, même équipe`;

/** Meta description. */
export const WILLIAMS_META_DESCRIPTION = `${FOUNDER.fullName} dirige Axion-IA : nous aidons les TPE et PME à gagner en rentabilité avec la même équipe, grâce à l'IA mise en place de A à Z, pas à pas.`;

/**
 * Réponse de tête (AEO). Phrase auto-portante : nom + fonction + entité +
 * périmètre, puis la porte d'entrée. Aucune référence à « cette page » : une
 * citation extraite du contexte doit rester vraie.
 */
export const WILLIAMS_LEAD = `${FOUNDER.fullName} dirige Axion-IA, la ${NATURE_AXION_IA} française qui aide les TPE et PME à gagner en rentabilité avec l'équipe qu'elles ont déjà : moins de ressaisies, des devis et des relances plus rapides, plus de temps pour vendre. Nous chiffrons d'abord, puis nous installons tout, sans que le dirigeant touche à la technique. La porte d'entrée est la Journée IA ; ensuite, l'équipe d'Axion-IA prend en charge tout le reste : mise en place, automatisations, formation des équipes et coaching du dirigeant, étape par étape.`;

/**
 * Doctrine en une phrase — reprise en `abstract` du `ProfilePage`.
 */
export const WILLIAMS_DOCTRINE =
  "Nous chiffrons ce que chaque tâche coûte, nous essayons à petite échelle sur de vrais dossiers, puis le dirigeant tranche : ce qui rapporte est installé de A à Z, le reste est abandonné.";

/**
 * Fiche d'identité — rendue en `<dl>` et reprise en `Person` JSON-LD.
 * Un fait par ligne ; les valeurs restent STRICTEMENT vérifiables (aucun
 * SIREN, RCS ou capital tant que `content/legal.ts` ne les porte pas).
 */
export const WILLIAMS_IDENTITE: ReadonlyArray<{ terme: string; valeur: string }> = [
  { terme: "Nom", valeur: FOUNDER.fullName },
  { terme: "Fonction", valeur: WILLIAMS_FONCTION },
  { terme: "Entreprise", valeur: `Axion-IA, ${NATURE_AXION_IA} française` },
  {
    terme: "Ce que nous apportons",
    valeur: "Plus de rentabilité et de temps avec la même équipe, grâce à l'IA",
  },
  { terme: "Pour qui", valeur: "Dirigeants de TPE et PME, tous secteurs" },
  {
    terme: "Ce que fait l'équipe",
    valeur:
      "Journée IA, mise en place et solutions sur mesure, automatisation, formation des équipes, coaching des dirigeants",
  },
  { terme: "Zone d'intervention de l'équipe", valeur: "Partout en France, outre-mer compris" },
  { terme: "Expérience", valeur: "Plus de trente ans de direction d'entreprises" },
  { terme: "Méthode", valeur: "Chiffrer, Essayer, Trancher" },
  { terme: "Données", valeur: "Hébergées dans l'Union européenne" },
  {
    terme: "Premier contact",
    valeur: "Diagnostic IA de 45 minutes, en visio ou par téléphone",
  },
];

/** Pastilles du héros (faits, sans promesse). */
export const WILLIAMS_PASTILLES: ReadonlyArray<string> = [
  "Partout en France",
  "TPE et PME",
  "Plus de trente ans de direction",
  "Données hébergées dans l'UE",
];

/** Bandeau de faits : uniquement des faits vérifiables, aucun chiffre de succès. */
export const WILLIAMS_PREUVES: ReadonlyArray<{ chiffre: string; libelle: string }> = [
  { chiffre: "TPE et PME", libelle: "Tous secteurs d'activité" },
  { chiffre: "Partout en France", libelle: "Outre-mer compris" },
  { chiffre: "Plus de 30 ans", libelle: "De direction d'entreprises" },
  {
    chiffre: "Chiffrer, Essayer, Trancher",
    libelle: "Une seule méthode, pour toutes les missions",
  },
];

/** « Votre entreprise avant et après l'IA » : des situations, aucun chiffre. */
export const WILLIAMS_AVANT_APRES = {
  titre: "Votre entreprise avant et après l'IA",
  lignes: [
    {
      avant: "Le soir, vous refaites des devis à la main.",
      apres: "Les devis sont préparés en quelques minutes ; vous les relisez et les envoyez.",
    },
    {
      avant: "Vos équipes ressaisissent les mêmes informations dans plusieurs outils.",
      apres: "La donnée est saisie une fois, puis passe seule d'un outil à l'autre.",
    },
    {
      avant: "Les relances clients se font quand quelqu'un y pense.",
      apres: "Les relances partent au bon moment ; votre équipe traite les réponses.",
    },
    {
      avant: "Les e-mails et les comptes rendus prennent des heures chaque semaine.",
      apres: "Les brouillons sont prêts ; vos équipes relisent et ajustent.",
    },
    {
      avant: "Pour suivre la charge, vous pensez à recruter.",
      apres: "Vous savez d'abord ce que votre équipe actuelle peut absorber, puis vous décidez.",
    },
    {
      avant: "Vous entendez parler d'IA partout, sans savoir par où commencer.",
      apres: "Vous avez un plan chiffré, et les premières tâches sont déjà allégées.",
    },
  ],
  phrase:
    "Vos équipes gardent leurs outils, leur métier et leurs clients. Elles passent simplement moins de temps sur ce qui ne rapporte rien.",
} as const;

/** « Une transformation sans chamboulement ». */
export const WILLIAMS_RASSURANCE = {
  titre: "Une transformation sans chamboulement",
  accroche: "Transformer votre entreprise avec l'IA ne veut pas dire tout casser.",
  points: [
    {
      titre: "Vos outils restent en place.",
      texte: "Nous branchons l'IA sur ce que vous utilisez déjà ; personne ne réapprend tout.",
    },
    {
      titre: "Une étape à la fois.",
      texte:
        "Nous commençons par les tâches qui rapportent le plus, le plus vite. La suivante ne démarre que si la précédente a fait ses preuves.",
    },
    {
      titre: "Vous décidez à chaque étape.",
      texte: "Vous savez ce que cela coûte et ce que cela rapporte avant de dire oui.",
    },
    {
      titre: "Vos équipes sont embarquées, pas bousculées.",
      texte: "Elles sont formées sur leurs propres dossiers et voient le gain par elles-mêmes.",
    },
    {
      titre: "Vous n'avez rien à piloter côté technique.",
      texte: "L'équipe d'Axion-IA s'en occupe, de A à Z.",
    },
  ],
} as const;

/**
 * « La Journée IA : la porte d'entrée » — sans prix. Le délai du rapport, la
 * garantie et sa condition viennent de `journee-ia-commun.ts` : jamais tapés ici.
 */
export const WILLIAMS_JOURNEE_IA = {
  titre: "La Journée IA : la porte d'entrée",
  accroche:
    "En une journée, vous savez où votre entreprise perd du temps et de l'argent, ce qu'elle peut récupérer, et vos équipes ont déjà commencé.",
  points: [
    {
      titre: "Le matin, dans vos locaux : nous trouvons où part votre argent.",
      texte:
        "De 2 à 4 heures, service par service, avec vous et les personnes prévues. Nous retenons les 3 à 5 tâches qui vous rapporteront le plus, le plus vite.",
    },
    {
      titre: "L'après-midi : vos équipes deviennent plus productives.",
      texte:
        "Quatre heures de formation, jusqu'à 15 personnes, sur leurs propres dossiers. Chaque participant produit un résultat utilisable le jour même et repart avec son attestation. Cette formation pratique contribue à développer la maîtrise de l'IA de vos équipes, comme le demande l'article 4 du règlement européen sur l'IA.",
    },
    {
      titre: "Ensuite : vous avez vos chiffres.",
      // Le délai exact vient de RAPPORT_COMPLET (art. 47.1 c des CGV).
      texte: RAPPORT_COMPLET,
    },
    {
      titre: "Le risque est pour nous.",
      texte: `${GARANTIE_PHRASE} ${CONDITION_GARANTIE}`,
    },
    {
      titre: "Ensuite, vous choisissez.",
      texte:
        "Vous repartez avec votre plan, ou nous le mettons en place pour vous. La journée n'oblige jamais à acheter la suite, et elle n'est pas obligatoire : si vous savez déjà où vous perdez du temps, nous pouvons commencer directement par la mise en place.",
    },
  ],
  bouton: "Réserver mon Diagnostic IA de 45 minutes",
  lien: { href: "/journee-ia", libelle: "Tout savoir sur la Journée IA" },
} as const;

/**
 * « Après la Journée IA : l'équipe d'Axion-IA fait tout le reste ».
 * Chaque `href` est déclaré dans `i18n/routing.ts` (vérifié par un test : le
 * rendu passe par `as never`, qui désarme le typage des routes).
 */
export interface ServiceWilliams {
  readonly id: string;
  readonly nom: string;
  readonly texte: string;
  readonly liens: ReadonlyArray<{ href: string; libelle: string }>;
}

export const WILLIAMS_SERVICES = {
  titre: "Après la Journée IA : l'équipe d'Axion-IA fait tout le reste",
  intro:
    "La Journée IA vous dit quoi faire. L'équipe d'Axion-IA le fait pour vous, de A à Z. Chaque service peut aussi se prendre seul.",
  items: [
    {
      id: "mise-en-place",
      nom: "Mise en place et solutions IA sur mesure",
      texte:
        "Une aide pour préparer les devis plus vite, des réponses clients prêtes à relire, un assistant qui connaît vos documents. Conçus, installés et testés par l'équipe d'Axion-IA, dans vos outils. Vendus en une fois ou en mise en service avec abonnement, au choix.",
      liens: [
        { href: "/implementation", libelle: "Les implémentations IA" },
        { href: "/implementation/ia-custom", libelle: "IA sur mesure" },
      ],
    },
    {
      id: "automatisation",
      nom: "Automatisation des tâches répétitives",
      texte:
        "Les ressaisies, relances et classements tournent seuls ; ce temps repart vers vos clients.",
      liens: [
        { href: "/implementation/processus", libelle: "Automatiser un processus" },
        { href: "/implementation/integrations", libelle: "Les intégrations" },
      ],
    },
    {
      id: "formation",
      nom: "Formation des équipes à l'IA",
      texte:
        "Vos équipes apprennent à produire plus, dès les premiers jours, sur leurs propres devis, e-mails et comptes rendus.",
      liens: [{ href: "/formations", libelle: "Les formations en entreprise" }],
    },
    {
      id: "coaching",
      nom: "Coaching IA du dirigeant",
      texte:
        "Vous décidez en connaissance de cause : quoi automatiser, quel budget, et ce qu'il ne faut surtout pas acheter.",
      liens: [{ href: "/un-a-un", libelle: "Le coaching individuel" }],
    },
    {
      id: "transformation",
      nom: "Transformation de l'entreprise avec l'IA",
      texte:
        "C'est ce que produisent ensemble ces services, guidés par un plan d'ensemble : votre organisation s'adapte, tâche après tâche, pour que chacun passe plus de temps sur ce qui rapporte. Pas d'outils achetés brique par brique, pas de bouleversement : une entreprise qui travaille mieux avec la même équipe.",
      liens: [{ href: "/journee-ia", libelle: "Commencer par la Journée IA" }],
    },
  ] satisfies ReadonlyArray<ServiceWilliams>,
} as const;

/** La méthode, en trois temps. */
export const WILLIAMS_METHODE = {
  titre: "La méthode : Chiffrer, Essayer, Trancher",
  etapes: [
    {
      numero: "1",
      titre: "Chiffrer",
      texte:
        "Avant tout achat, nous mesurons ce que chaque tâche vous coûte et ce que l'IA peut vous rendre, en heures et en euros.",
    },
    {
      numero: "2",
      titre: "Essayer",
      texte:
        "Nous testons sur vos vrais dossiers, avec vos équipes, à petite échelle. Rien n'est déployé partout avant d'avoir fait ses preuves.",
    },
    {
      numero: "3",
      titre: "Trancher",
      texte:
        "Vous gardez ce qui rapporte, vous arrêtez le reste. Ce qui est gardé, nous l'installons de A à Z.",
    },
  ],
} as const;

/** Parcours : faits fournis pour cette version, aucun nombre de collaborateurs. */
export const WILLIAMS_PARCOURS = {
  titre: `Parcours de ${FOUNDER.fullName}`,
  blocs: [
    {
      titre: "Plus de trente ans de direction d'entreprises.",
      texte: `${FOUNDER.fullName} dirige des entreprises depuis plus de trente ans. Il a dirigé plusieurs entités et de grandes équipes, en France et à l'international. C'est ce qu'il apporte à chaque mission d'Axion-IA : il connaît de l'intérieur les contraintes d'un dirigeant, la marge à protéger, le temps qui manque, les équipes à embarquer sans les brusquer. Les solutions que nous installons doivent rapporter, pas impressionner.`,
    },
    {
      titre: "L'intelligence artificielle depuis 2023.",
      texte:
        "Depuis 2023, il se consacre entièrement à l'intelligence artificielle appliquée à l'entreprise : assistants, agents, automatisation, intégration de l'IA dans les outils existants.",
    },
    {
      titre: "Fondateur et dirigeant d'Axion-IA.",
      texte:
        "Il a fondé Axion-IA pour donner aux TPE et PME ce qu'il aurait voulu avoir comme dirigeant : une équipe qui dit où l'IA rapporte, chiffre ce gain, puis s'occupe de tout. Axion-IA applique d'abord à elle-même ce qu'elle installe chez ses clients.",
    },
  ],
} as const;

/** Constats de terrain de Williams ; l'action, elle, est en « nous ». */
export const WILLIAMS_CITATIONS = {
  titre: `Ce que ${FOUNDER.fullName} constate sur le terrain`,
  items: [
    "Un dirigeant ne veut pas de l'IA. Il veut vendre plus sans recruter. L'IA n'est qu'un moyen d'y arriver.",
    "En plus de trente ans de direction, j'ai vu que l'argent ne se perd presque jamais dans les grandes décisions. Il se perd dans les ressaisies, les relances et les devis refaits à la main.",
    "Avant d'ouvrir un poste, un dirigeant devrait toujours se demander combien d'heures son équipe actuelle perd chaque semaine sur des tâches qu'une machine ferait.",
    "Une transformation réussie ne se remarque pas le premier jour. On la remarque le jour où l'équipe ne voudrait plus revenir en arrière.",
    "Le dirigeant n'a pas à devenir technicien. Son travail, c'est de décider. Le nôtre, c'est de tout mettre en place.",
  ],
} as const;

/** Appel final. */
export const WILLIAMS_APPEL_FINAL = {
  titre: `Parler de votre entreprise avec ${FOUNDER.fullName}`,
  texte:
    "En 45 minutes, vous savez où votre entreprise perd du temps et de l'argent, et ce que nous pouvons prendre en charge pour le récupérer, étape par étape. Sans engagement, en visio ou par téléphone.",
  bouton: "Réserver mon Diagnostic IA",
  boutonSecondaire: "Écrire à Axion-IA",
} as const;

/**
 * FAQ de la fiche — questions posées telles qu'un moteur génératif les reçoit.
 *
 * `certificationObtenue` gate les seules Q/R financement (OPCO / France
 * Travail). Tant que le certificat Qualiopi n'est pas délivré, elles ne sont
 * PAS émises — ni en HTML, ni en `FAQPage` JSON-LD.
 */
export function buildWilliamsFaq({
  certificationObtenue,
}: {
  certificationObtenue: boolean;
}): ReadonlyArray<{ id: string; question: string; answer: string }> {
  return [
    {
      id: "qui-est-williams-jullin",
      question: `Qui est ${FOUNDER.fullName} ?`,
      answer: `${FOUNDER.fullName} est le fondateur et dirigeant d'Axion-IA, la ${NATURE_AXION_IA} française qui aide les TPE et PME à gagner en rentabilité avec l'équipe qu'elles ont déjà. Dirigeant d'entreprises depuis plus de trente ans, il pilote l'équipe d'Axion-IA, qui chiffre les gains, puis met l'IA en place de A à Z.`,
    },
    {
      id: "qui-a-fonde-axion-ia",
      question: "Qui a fondé Axion-IA ?",
      answer: `Axion-IA a été fondée par ${FOUNDER.fullName}, qui la dirige. L'équipe aide les TPE et PME à gagner en rentabilité et en productivité grâce à l'IA : Journée IA, mise en place et solutions sur mesure, automatisation, formation des équipes et coaching des dirigeants.`,
    },
    {
      id: "chiffre-d-affaires-sans-recruter",
      question: "Comment augmenter son chiffre d'affaires sans recruter ?",
      answer:
        "En rendant à l'équipe actuelle le temps qu'elle perd sur des tâches répétitives : ressaisies, devis, relances, comptes rendus. L'IA peut en prendre une partie. La Journée IA chiffre ce temps et ce qu'il représente en euros, tâche par tâche, pour savoir où agir en premier.",
    },
    {
      id: "transformation-sans-tout-bouleverser",
      question: "Transformer son entreprise avec l'IA, est-ce que ça bouleverse tout ?",
      answer:
        "Non. Vos équipes gardent leurs outils et leur métier ; nous avançons une tâche à la fois, en commençant par celles qui rapportent le plus. Vous décidez à chaque étape, et rien n'est déployé avant d'avoir fait ses preuves sur vos dossiers.",
    },
    {
      id: "faut-il-s-y-connaitre",
      question: "Faut-il s'y connaître en IA pour travailler avec Axion-IA ?",
      answer:
        "Non. Vous parlez de votre métier et de vos clients ; l'équipe d'Axion-IA s'occupe des outils, des réglages et de la mise en place. Vous gardez seulement les décisions.",
    },
    {
      id: "remplacer-les-salaries",
      question: "L'IA va-t-elle remplacer mes salariés ?",
      answer:
        "Non. L'objectif est de retirer à vos équipes les tâches qui ne rapportent rien, pour qu'elles passent leur temps sur vos clients, vos ventes et votre production.",
    },
    {
      id: "apres-la-journee-ia",
      question: "Qui s'occupe de la mise en place après la Journée IA ?",
      answer:
        "L'équipe d'Axion-IA, si vous le souhaitez : solutions sur mesure, automatisations, raccordement à vos logiciels, formation et coaching. Vous pouvez aussi repartir avec votre plan : la journée n'oblige à rien.",
    },
    ...(certificationObtenue
      ? [
          {
            id: "financement",
            question: "Les formations IA d'Axion-IA sont-elles finançables par un OPCO ?",
            answer:
              "Selon votre situation, une formation IA peut être prise en charge, en tout ou partie, par votre OPCO pour les salariés, ou par France Travail pour les demandeurs d'emploi. Axion-IA étudie l'éligibilité et monte le dossier avec vous, partout en France. Le versement dépend de l'accord de l'organisme financeur.",
          },
        ]
      : []),
    {
      id: "contact",
      question: `Comment contacter ${FOUNDER.fullName} ?`,
      answer:
        "En réservant un Diagnostic IA de 45 minutes depuis le site, ou par le formulaire de contact. L'équipe d'Axion-IA intervient partout en France, outre-mer compris.",
    },
  ];
}
