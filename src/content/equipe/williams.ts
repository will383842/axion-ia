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
import type { CleIcone, ReponseDirecte, ChiffreCle, LienFiche } from "@/lib/equipe/contenu";
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

/** Fonction affichée sous le H1 et dans la figcaption : exactement `Person.jobTitle` (JSON-LD). */
export const WILLIAMS_FONCTION = FOUNDER.jobTitleFr;

/** Ce que l'équipe apporte, en une ligne. */
export const WILLIAMS_TAGLINE = "Rentabilité et productivité des TPE et PME grâce à l'IA";

/** Ligne sous le H1. */
export const WILLIAMS_SOUS_TITRE = `${WILLIAMS_FONCTION} · ${WILLIAMS_TAGLINE}`;

/** Titre SEO (balise `<title>`, sans suffixe de marque) : 58 caractères. */
export const WILLIAMS_TITRE_SEO = `${FOUNDER.fullName}, dirigeant d'Axion-IA · IA pour TPE et PME`;

/** Meta description. */
export const WILLIAMS_META_DESCRIPTION = `${FOUNDER.fullName} dirige Axion-IA : l'équipe aide les TPE et PME à gagner du temps et en rentabilité grâce à l'IA, sans recruter, partout en France.`;

/**
 * Réponse de tête (AEO). Phrase auto-portante : nom + fonction + entité +
 * périmètre, puis la porte d'entrée. Aucune référence à « cette page » : une
 * citation extraite du contexte doit rester vraie.
 */
export const WILLIAMS_LEAD = `${FOUNDER.fullName} dirige Axion-IA, la ${NATURE_AXION_IA} française qui aide les dirigeants de TPE et de PME à gagner du temps et en rentabilité grâce à l'IA, avec l'équipe qu'ils ont déjà. L'équipe chiffre d'abord ce que chaque tâche coûte, puis installe tout, de A à Z, partout en France.`;

/**
 * Description de l'entité Person (JSON-LD) : même sens que la réponse de tête, mais à la 3e
 * personne et sans « nous », pour rester vraie hors contexte.
 */
export const WILLIAMS_DESCRIPTION_PERSON = `${FOUNDER.fullName} dirige Axion-IA, la ${NATURE_AXION_IA} française qui aide les dirigeants de TPE et de PME à gagner du temps et en rentabilité grâce à l'IA, avec l'équipe qu'ils ont déjà. L'équipe d'Axion-IA chiffre d'abord ce que chaque tâche coûte, puis installe tout, de A à Z, partout en France.`;

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
export const WILLIAMS_IDENTITE: ReadonlyArray<{
  terme: string;
  valeur: string;
  icone?: CleIcone;
}> = [
  { terme: "Nom", valeur: FOUNDER.fullName, icone: "personne" },
  { terme: "Fonction", valeur: WILLIAMS_FONCTION, icone: "fonction" },
  {
    terme: "Entreprise",
    valeur: `Axion-IA, ${NATURE_AXION_IA} française`,
    icone: "entreprise",
  },
  {
    terme: "Résultat visé",
    valeur: "Plus de rentabilité et de temps, avec la même équipe",
    icone: "resultat",
  },
  { terme: "Pour qui", valeur: "Dirigeants de TPE et PME", icone: "cible" },
  {
    terme: "Ce que fait l'équipe",
    valeur: "Journée IA, mise en place, automatisation, formation, coaching",
    icone: "services",
  },
  { terme: "Zone", valeur: "Partout en France, outre-mer compris", icone: "zone" },
  { terme: "Expérience", valeur: "Plus de trente ans de direction", icone: "experience" },
  { terme: "Méthode", valeur: "Chiffrer, Essayer, Trancher", icone: "methode" },
  { terme: "Données", valeur: "Hébergées dans l'Union européenne", icone: "donnees" },
  { terme: "Premier contact", valeur: "Diagnostic IA de 45 minutes", icone: "contact" },
];

/** Pastilles du héros (faits, sans promesse, sans répéter les chiffres clés). */
export const WILLIAMS_PASTILLES: ReadonlyArray<string> = [
  "TPE et PME, tous secteurs",
  "Chiffrer, Essayer, Trancher",
  "Données hébergées dans l'UE",
];

/** Pastilles détaillées du héros : même contenu, avec une clé d'icône. */
export const WILLIAMS_PASTILLES_DETAILLEES: ReadonlyArray<{ libelle: string; icone?: CleIcone }> = [
  { libelle: "TPE et PME, tous secteurs", icone: "entreprise" },
  { libelle: "Chiffrer, Essayer, Trancher", icone: "methode" },
  { libelle: "Données hébergées dans l'UE", icone: "donnees" },
];

/** Chiffres clés du héros : uniquement des faits vérifiés de cette fiche. */
export const WILLIAMS_CHIFFRES_CLES: ReadonlyArray<ChiffreCle> = [
  { valeur: "30+", libelle: "ans de direction d'entreprises", icone: "experience" },
  { valeur: "2023", libelle: "l'IA appliquée à l'entreprise, à plein temps", icone: "competences" },
  { valeur: "France", libelle: "partout, outre-mer compris", icone: "zone" },
  { valeur: "45 min", libelle: "de Diagnostic IA pour commencer", icone: "contact" },
];

/** Liens internes de la fiche (chaque `href` est déclaré dans `i18n/routing.ts`). */
export const WILLIAMS_LIENS_INTERNES: ReadonlyArray<LienFiche> = [
  { href: "/journee-ia", libelle: "La Journée IA" },
  { href: "/implementation", libelle: "La mise en place de l'IA" },
  { href: "/implementation/processus", libelle: "Automatiser un processus" },
  { href: "/formations", libelle: "Les formations en entreprise" },
  { href: "/formations/secteurs", libelle: "Les formations par secteur" },
  { href: "/un-a-un", libelle: "Le coaching individuel" },
  { href: "/equipe", libelle: "L'équipe d'Axion-IA" },
  { href: "/appel", libelle: "Réserver un Diagnostic IA" },
  { href: "/contact", libelle: "Écrire à Axion-IA" },
];

/** @deprecated Remplacée par `WILLIAMS_CHIFFRES_CLES` (retrait en R2d). */
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
      avant: "Les devis refaits le soir, à la main.",
      apres: "Devis prêts en quelques minutes ; vous relisez.",
    },
    {
      avant: "Les mêmes informations ressaisies trois fois.",
      apres: "Saisie une fois, partagée partout.",
    },
    {
      avant: "Les relances, quand quelqu'un y pense.",
      apres: "Relances envoyées au bon moment.",
    },
    {
      avant: "Des heures d'e-mails et de comptes rendus.",
      apres: "Brouillons prêts ; l'équipe ajuste.",
    },
    {
      avant: "Recruter pour suivre la charge.",
      apres: "Savoir d'abord ce que l'équipe peut absorber.",
    },
    {
      avant: "L'IA partout, sans savoir par où commencer.",
      apres: "Un plan chiffré, des premiers gains.",
    },
  ],
  phrase: "Mêmes outils, même métier, mêmes clients. Moins de temps perdu.",
} as const;

/** « Une transformation sans chamboulement ». */
export const WILLIAMS_RASSURANCE = {
  titre: "Une transformation sans chamboulement",
  accroche: "Transformer votre entreprise avec l'IA ne veut pas dire tout casser.",
  points: [
    {
      titre: "Vos outils restent",
      texte: "L'IA se branche sur ce que vous utilisez déjà.",
    },
    {
      titre: "Une étape à la fois",
      texte: "La suivante démarre si la précédente rapporte.",
    },
    {
      titre: "Vous décidez",
      texte: "Coût et gain connus avant chaque oui.",
    },
    {
      titre: "Équipes embarquées",
      texte: "Formées sur leurs propres dossiers.",
    },
    {
      titre: "Zéro technique pour vous",
      texte: "L'équipe d'Axion-IA s'en occupe.",
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
  /** Nom d'une icône lucide (table de correspondance côté composant). */
  readonly icone?: string;
  /** Carte mise en avant (pleine largeur). */
  readonly enAvant?: boolean;
}

export const WILLIAMS_SERVICES = {
  titre: "Que fait l'équipe d'Axion-IA après la Journée IA ?",
  intro:
    "La Journée IA vous dit quoi faire. L'équipe d'Axion-IA le fait pour vous, de A à Z. Chaque service peut aussi se prendre seul.",
  items: [
    {
      id: "mise-en-place",
      icone: "Wrench",
      nom: "Mise en place et solutions IA sur mesure",
      texte:
        "Devis plus rapides, réponses clients prêtes, un assistant qui connaît vos documents. Installés dans vos outils.",
      liens: [
        { href: "/implementation", libelle: "Les implémentations IA" },
        { href: "/implementation/ia-custom", libelle: "IA sur mesure" },
      ],
    },
    {
      id: "automatisation",
      icone: "Workflow",
      nom: "Automatisation des tâches répétitives",
      texte:
        "Ressaisies, relances et classements tournent seuls. Le temps repart vers vos clients.",
      liens: [
        { href: "/implementation/processus", libelle: "Automatiser un processus" },
        { href: "/implementation/integrations", libelle: "Les intégrations" },
      ],
    },
    {
      id: "formation",
      icone: "GraduationCap",
      nom: "Formation des équipes à l'IA",
      texte: "Vos équipes produisent plus dès les premiers jours, sur leurs propres dossiers.",
      liens: [{ href: "/formations", libelle: "Les formations en entreprise" }],
    },
    {
      id: "coaching",
      icone: "Compass",
      nom: "Coaching IA du dirigeant",
      texte: "Quoi automatiser, quel budget, et ce qu'il ne faut surtout pas acheter.",
      liens: [{ href: "/un-a-un", libelle: "Le coaching individuel" }],
    },
    {
      id: "transformation",
      icone: "Sparkles",
      enAvant: true,
      nom: "Transformation de l'entreprise avec l'IA",
      texte:
        "Un plan d'ensemble, appliqué tâche après tâche : une entreprise qui travaille mieux avec la même équipe.",
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
      texte: "Ce que chaque tâche vous coûte, et ce que l'IA peut vous rendre.",
      obtenu: "Vos gains possibles, en euros",
    },
    {
      numero: "2",
      titre: "Essayer",
      texte: "Un test sur vos vrais dossiers, avec vos équipes, à petite échelle.",
      obtenu: "La preuve sur votre terrain",
    },
    {
      numero: "3",
      titre: "Trancher",
      texte: "Vous gardez ce qui rapporte, vous arrêtez le reste.",
      obtenu: "Une installation de A à Z",
    },
  ],
} as const;

/** Parcours : faits fournis pour cette version, aucun nombre de collaborateurs. */
export const WILLIAMS_PARCOURS = {
  titre: `Parcours de ${FOUNDER.fullName}`,
  blocs: [
    {
      titre: "Plus de trente ans de direction d'entreprises.",
      texte: `${FOUNDER.fullName} dirige des entreprises depuis plus de trente ans. Il a dirigé plusieurs entités et de grandes équipes, en France et à l'international. C'est ce qu'il apporte à chaque mission d'Axion-IA : il connaît de l'intérieur les contraintes d'un dirigeant, la rentabilité à protéger, le temps qui manque, les équipes à embarquer sans les brusquer. Les solutions que nous installons doivent rapporter, pas impressionner.`,
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
  titre: "Parlons de votre entreprise",
  texte:
    "En 45 minutes, vous savez où votre entreprise perd du temps et de l'argent, et ce que l'équipe d'Axion-IA peut prendre en charge. Sans engagement, en visio ou par téléphone.",
  bouton: "Réserver mon Diagnostic IA",
  boutonSecondaire: "Écrire à Axion-IA",
} as const;

/**
 * Réponses directes de section (H2 en question + 40 à 60 mots, vérifiées par un test).
 * Chaque réponse nomme l'entité et reste vraie hors de la page.
 */
export const WILLIAMS_ENTETES = {
  "en-bref": {
    surTitre: "En bref",
    question: `Qui est ${FOUNDER.fullName}, en bref ?`,
    reponse: `${FOUNDER.fullName} est le fondateur et dirigeant d'Axion-IA, une ${NATURE_AXION_IA} française spécialisée dans l'IA pour les TPE et les PME. Dirigeant d'entreprises depuis plus de trente ans et consacré à l'IA depuis 2023, il pilote une équipe qui chiffre, teste puis installe l'IA dans les outils existants, partout en France.`,
  },
  "pour-qui": {
    surTitre: "Pour qui",
    question: "Votre entreprise ressemble-t-elle à l'une de celles-ci ?",
    reponse: `L'équipe de ${FOUNDER.fullName} travaille avec des TPE et des PME de tous secteurs, de l'artisan du bâtiment au cabinet comptable. Le point commun n'est pas le métier : c'est une équipe qui perd des heures en ressaisies, devis, relances et comptes rendus, et un dirigeant qui veut récupérer ce temps sans recruter.`,
  },
  "avant-apres": {
    surTitre: "Avant et après",
    question: "Que change l'IA dans le quotidien d'une PME ?",
    reponse:
      "Après l'arrivée de l'IA, une PME fait les mêmes métiers avec moins de tâches répétitives. Les devis se préparent en quelques minutes, la donnée n'est saisie qu'une fois, les relances partent au bon moment et le dirigeant sait ce que son équipe peut absorber avant de recruter. Les outils et les clients ne changent pas.",
  },
  rassurance: {
    surTitre: "Sans chamboulement",
    question: "Comment Axion-IA transforme-t-elle une PME sans tout chambouler ?",
    reponse:
      "Transformer une entreprise avec l'IA ne veut pas dire tout casser. Axion-IA branche l'IA sur les outils déjà en place, avance une tâche à la fois en commençant par la plus rentable, forme les équipes sur leurs propres dossiers et laisse le dirigeant décider à chaque étape. Il n'a rien de technique à piloter.",
  },
  methode: {
    surTitre: "Méthode",
    question: "Quelle méthode suit Axion-IA pour installer l'IA ?",
    reponse:
      "Axion-IA suit une méthode en trois temps : Chiffrer, Essayer, Trancher. L'équipe mesure d'abord ce que chaque tâche coûte en heures et en euros, teste l'IA à petite échelle sur de vrais dossiers, puis le dirigeant décide : ce qui rapporte est installé de A à Z, le reste est abandonné.",
  },
  "journee-ia": {
    surTitre: "Journée IA",
    question: "Que se passe-t-il pendant une Journée IA ?",
    reponse:
      "La Journée IA d'Axion-IA se déroule en une journée dans l'entreprise. Le matin, l'équipe repère service par service les trois à cinq tâches qui coûtent le plus. L'après-midi, jusqu'à quinze personnes sont formées sur leurs propres dossiers. Le dirigeant reçoit ensuite un rapport chiffré, puis choisit librement la suite.",
  },
  services: {
    surTitre: "Services",
    question: WILLIAMS_SERVICES.titre,
    reponse:
      "Après la Journée IA, l'équipe d'Axion-IA met en place ce qui a été décidé : solutions IA sur mesure dans vos outils, automatisation des tâches répétitives, formation des équipes et coaching du dirigeant. Chaque service peut aussi se prendre seul. Ensemble, ils transforment l'entreprise tâche après tâche, avec la même équipe.",
  },
  parcours: {
    surTitre: "Parcours",
    question: `Quel est le parcours de ${FOUNDER.fullName} ?`,
    reponse: `${FOUNDER.fullName} dirige des entreprises depuis plus de trente ans, en France et à l'international, à la tête de plusieurs entités et de grandes équipes. Depuis 2023, il se consacre entièrement à l'intelligence artificielle appliquée à l'entreprise. Il a fondé Axion-IA pour offrir aux TPE et PME une équipe qui chiffre, teste et installe l'IA.`,
  },
  constats: {
    surTitre: "Sur le terrain",
    question: `Que constate ${FOUNDER.fullName} sur le terrain ?`,
    reponse: `${FOUNDER.fullName} constate que l'argent d'une PME se perd rarement dans les grandes décisions : il se perd dans les ressaisies, les relances et les devis refaits à la main. Pour lui, un dirigeant ne veut pas de l'IA ; il veut vendre plus sans recruter, et l'IA n'est qu'un moyen d'y arriver.`,
  },
  faq: {
    surTitre: "Questions",
    question: `Questions fréquentes sur ${FOUNDER.fullName}`,
    reponse: `${FOUNDER.fullName} dirige Axion-IA, startup française qui aide les TPE et PME à gagner en rentabilité grâce à l'IA. Le premier pas est un Diagnostic IA de 45 minutes, sans engagement, en visio ou par téléphone. Les questions les plus posées portent sur la méthode, la Journée IA, les équipes et la mise en place.`,
  },
} as const satisfies Record<string, ReponseDirecte>;

/**
 * Secteurs d'activité sous les cartes « Vous êtes… » : pastilles (icône lucide) ; la phrase
 * renvoie aux autres secteurs. Aucun chiffre.
 */
export const WILLIAMS_POUR_QUI = {
  secteurs: [
    { libelle: "BTP et artisanat", icone: "HardHat" },
    { libelle: "Commerce et distribution", icone: "Store" },
    { libelle: "Industrie", icone: "Factory" },
    { libelle: "Transport et logistique", icone: "Truck" },
    { libelle: "Santé et médico-social", icone: "Stethoscope" },
    { libelle: "Cabinets comptables et juridiques", icone: "Scale" },
    { libelle: "Immobilier", icone: "House" },
    { libelle: "Hôtellerie et restauration", icone: "UtensilsCrossed" },
    { libelle: "Services aux entreprises", icone: "Handshake" },
    { libelle: "Associations et organismes", icone: "HeartHandshake" },
  ],
  phrase: "Et tous les autres secteurs : la méthode part de vos tâches, pas de votre code NAF.",
  lien: { href: "/formations/secteurs", libelle: "Les formations par secteur" },
} as const;

/** Carte « Vous êtes… » : trois temps courts (coût, action, gain qualitatif), sans chiffre. */
export interface CarteVousEtes {
  readonly cle: string;
  readonly titre: string;
  readonly cout: string;
  readonly action: string;
  readonly gain: string;
  /** Nom d'une icône lucide (table de correspondance côté composant). */
  readonly icone: string;
}

/**
 * Bloc « Vous êtes… » : le dirigeant se reconnaît par la taille de son entreprise, puis par son
 * métier. Textes en « vous », tâches réelles du métier, gains concrets sans chiffre inventé.
 */
export const WILLIAMS_VOUS_ETES: {
  readonly tailles: ReadonlyArray<CarteVousEtes>;
  readonly metiers: ReadonlyArray<CarteVousEtes>;
} = {
  tailles: [
    {
      cle: "dirigeant-seul",
      titre: "Dirigeant seul ou petite équipe",
      cout: "Vous faites tout vous-même : devis, relances, e-mails, et le soir la gestion à rattraper.",
      action:
        "Nous installons un assistant qui prépare vos devis, rédige vos réponses et relance vos clients, dans les outils que vous avez déjà.",
      gain: "Vous reprenez vos soirées et vous répondez à vos clients le jour même.",
      icone: "UserRound",
    },
    {
      cle: "tpe",
      titre: "TPE, moins de 10 salariés",
      cout: "Chacun ressaisit les mêmes informations, et personne n'a le temps de s'occuper de l'organisation.",
      action:
        "Nous repérons les tâches répétitives, nous les automatisons une à une et nous formons l'équipe sur ses propres dossiers.",
      gain: "Votre équipe garde son temps pour vos clients, sans recruter.",
      icone: "Users",
    },
    {
      cle: "pme",
      titre: "PME, de 10 à 249 salariés",
      cout: "Plusieurs services, plusieurs outils, et des comptes rendus ou des relances qui dépendent de chacun.",
      action:
        "Nous chiffrons service par service où part le temps, nous testons à petite échelle, puis nous installons ce qui rapporte.",
      gain: "Vous décidez avec des chiffres sous les yeux, et vos services travaillent de la même façon.",
      icone: "Building2",
    },
  ],
  metiers: [
    {
      cle: "artisan-btp",
      titre: "Vous êtes artisan du BTP",
      cout: "Vos devis se rédigent le soir après le chantier, et les relances de devis passent après tout le reste.",
      action:
        "Nous préparons vos devis à partir de vos métrés et de vos références habituelles, puis nous relançons vos clients au bon moment.",
      gain: "Vos devis partent le jour même, et vos soirées vous appartiennent.",
      icone: "HardHat",
    },
    {
      cle: "commercant",
      titre: "Vous êtes commerçant",
      cout: "Les questions des clients, les fiches produits et les commandes fournisseurs avalent vos journées.",
      action:
        "Nous rédigeons les fiches produits, préparons les réponses aux questions courantes et automatisons le suivi des commandes.",
      gain: "Vous passez plus de temps en boutique, face à vos clients.",
      icone: "Store",
    },
    {
      cle: "industriel",
      titre: "Vous êtes industriel",
      cout: "Les plannings de production, les rapports et la saisie des données de l'atelier se font à la main.",
      action:
        "Nous relions vos plannings, vos relevés et vos rapports pour que l'information soit saisie une seule fois.",
      gain: "Vos équipes consacrent leur temps à produire, pas à recopier.",
      icone: "Factory",
    },
    {
      cle: "transporteur",
      titre: "Vous êtes transporteur",
      cout: "Les plannings de tournées, les documents de transport et les appels de suivi occupent votre exploitation.",
      action:
        "Nous automatisons les confirmations aux clients, le classement des documents et la préparation des plannings.",
      gain: "Vos clients sont prévenus sans que personne ne décroche le téléphone.",
      icone: "Truck",
    },
    {
      cle: "cabinet",
      titre: "Vous êtes cabinet comptable ou juridique",
      cout: "La collecte des pièces, la saisie, les relances de dossiers et les comptes rendus de rendez-vous prennent le temps du conseil.",
      action:
        "Nous classons les pièces, préparons les saisies, rédigeons les comptes rendus et relançons les clients à votre place.",
      gain: "Vous gardez votre temps pour conseiller, et vos clients voient leur dossier avancer.",
      icone: "Scale",
    },
    {
      cle: "immobilier",
      titre: "Vous êtes agence immobilière",
      cout: "Les annonces, les comptes rendus de visite et les relances d'acquéreurs se rédigent après les rendez-vous.",
      action:
        "Nous rédigeons les annonces à partir de vos notes, préparons les comptes rendus de visite et relançons les prospects.",
      gain: "Vos acquéreurs reçoivent une réponse le jour de la visite.",
      icone: "House",
    },
    {
      cle: "hotel-restaurant",
      titre: "Vous êtes hôtel-restaurant",
      cout: "Les demandes de réservation, les avis clients et les plannings du personnel arrivent par tous les canaux à la fois.",
      action:
        "Nous préparons les réponses aux demandes, rédigeons les réponses aux avis et simplifions les plannings du personnel.",
      gain: "Votre équipe se consacre à l'accueil, pas à la messagerie.",
      icone: "UtensilsCrossed",
    },
    {
      cle: "services-entreprises",
      titre: "Vous êtes dans les services aux entreprises",
      cout: "Les propositions commerciales, les comptes rendus de réunion et le suivi des prospects se refont à chaque fois.",
      action:
        "Nous préparons vos propositions à partir de vos modèles, rédigeons les comptes rendus et déclenchons les relances.",
      gain: "Vos propositions partent plus vite, et aucun prospect n'est oublié.",
      icone: "Handshake",
    },
  ],
};

/**
 * Bloc « Partout en France » : H2 en question et réponse directe (40 à 60 mots). Les villes et
 * les régions ne sont pas écrites ici : elles viennent des données des pages de ville.
 */
export const WILLIAMS_PARTOUT_EN_FRANCE: { readonly question: string; readonly reponse: string } = {
  question: `${FOUNDER.fullName} intervient-il dans ma ville ?`,
  reponse: `Oui. L'équipe d'Axion-IA, que dirige ${FOUNDER.fullName}, intervient sur place partout en France, outre-mer compris, et à distance par visio ou par téléphone. La Journée IA se déroule dans les locaux de l'entreprise, quelle que soit sa ville. Le Diagnostic IA de 45 minutes, lui, se fait entièrement à distance.`,
};

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
      answer: WILLIAMS_ENTETES["en-bref"].reponse,
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
    {
      id: "premiers-effets",
      question: "Combien de temps faut-il pour voir les premiers effets de l'IA dans une PME ?",
      answer:
        "Les premiers effets se voient dès la Journée IA : l'après-midi, chaque participant produit un résultat utilisable sur ses propres dossiers. Les gains plus larges dépendent des tâches retenues ; ils sont chiffrés avant tout achat, puis vérifiés à petite échelle avant d'être étendus.",
    },
    {
      id: "toute-la-france",
      question: "Axion-IA intervient-elle dans toute la France ?",
      answer:
        "Oui. L'équipe d'Axion-IA intervient partout en France, outre-mer compris : la Journée IA se déroule dans vos locaux, le Diagnostic IA de 45 minutes se fait en visio ou par téléphone.",
    },
    {
      id: "hebergement-des-donnees",
      question: "Où sont hébergées les données de mon entreprise ?",
      answer:
        "Dans l'Union européenne. Les données de votre entreprise ne servent qu'au projet qui les concerne, et le RGPD s'applique à chaque mission.",
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
        "En réservant un Diagnostic IA de 45 minutes depuis le site, ou par le formulaire de contact. L'équipe d'Axion-IA répond partout en France, outre-mer compris.",
    },
  ];
}
