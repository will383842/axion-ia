/**
 * LISTE FERMÉE DES THÈMES DES VIDÉOS DU SITE (lot W3, plan PLAN-W1-W4 §7, décision D3).
 *
 * Quatre à six thèmes, calqués sur les cinq prestations. Le studio ne peut envoyer qu'un
 * `theme` de cette liste (le contrat de réception le refuse sinon). Une page de thème
 * n'existe qu'à partir de 3 vidéos publiées ; l'intro éditoriale (≥ 150 mots) est ce qui
 * empêche cette page d'être « mince » dès qu'elle apparaît.
 *
 * Les intros ne promettent aucun résultat, ne citent ni client ni financement, et
 * n'affirment aucune certification : elles passent les mêmes gardes que les vidéos
 * (verrouillé par `__tests__/themes.spec.ts`).
 */

export interface PageLieeTheme {
  /** Clé de `routing.pathnames`. */
  readonly href: string;
  readonly libelle: string;
}

export interface ThemeVideo {
  readonly slug: string;
  readonly libelle: string;
  /** Meta description de la page de thème. */
  readonly description: string;
  /** Intro éditoriale visible en tête de la page de thème (≥ 150 mots). */
  readonly intro: string;
  /** Page de service associée (encarts « En vidéo » de W4). */
  readonly service: string;
  readonly pagesLiees: ReadonlyArray<PageLieeTheme>;
}

export const THEMES: ReadonlyArray<ThemeVideo> = [
  {
    slug: "formations-ia",
    libelle: "Formations IA",
    description:
      "Des vidéos courtes pour comprendre ce qu'une formation à l'IA apporte concrètement à une équipe, comment elle se prépare et à quoi s'attendre.",
    intro:
      "Former une équipe à l'intelligence artificielle ne consiste pas à lui montrer un outil de plus. Il s'agit de donner à chacun des repères solides : comprendre ce que ces systèmes savent faire, où ils se trompent, comment formuler une demande utile et comment vérifier une réponse avant de l'utiliser. Les vidéos de ce thème expliquent, avec des exemples tirés du travail quotidien, comment se déroule une formation, ce qu'il faut préparer en amont et comment mesurer ce qui a réellement changé ensuite. Elles s'adressent aux dirigeants qui hésitent sur le bon format, aux responsables d'équipe qui doivent embarquer leurs collaborateurs, et aux personnes qui veulent simplement savoir à quoi s'attendre avant de s'engager. Chaque vidéo est courte, accompagnée d'un résumé écrit, de trois points à retenir et de réponses aux questions les plus fréquentes. Vous pouvez les regarder dans l'ordre ou piocher le sujet qui vous concerne, puis poursuivre sur la page de présentation de nos formations pour comparer les parcours disponibles et poser vos questions à l'équipe.",
    service: "/formations",
    pagesLiees: [
      { href: "/formations", libelle: "Découvrir les formations IA" },
      { href: "/blog", libelle: "Lire les articles du blog" },
    ],
  },
  {
    slug: "coaching-ia",
    libelle: "Coaching IA 1-to-1",
    description:
      "Des vidéos pour comprendre comment un accompagnement individuel aide une personne à intégrer l'IA dans son propre travail, à son rythme.",
    intro:
      "Certaines personnes progressent mieux seules avec un accompagnant qu'en groupe : un dirigeant au calendrier saturé, une indépendante qui veut gagner du temps sur ses tâches répétitives, un responsable qui découvre ces outils et préfère poser ses questions sans témoin. Le coaching individuel part de la situation réelle de la personne, de ses documents, de ses habitudes et de ses contraintes, pour construire pas à pas des pratiques qu'elle saura refaire sans aide. Les vidéos de ce thème montrent comment se déroule une séance, ce qu'il est utile d'apporter, comment fixer un objectif réaliste et comment juger, au bout de quelques semaines, si la méthode porte ses fruits. Vous y trouverez des exemples concrets, des erreurs fréquentes à éviter et des conseils pour garder le contrôle sur ce que produit l'outil. Chaque vidéo est complétée par un résumé écrit, trois points à retenir et des réponses aux questions courantes. Si l'une d'elles résonne avec votre situation, la page du coaching détaille le déroulé et permet de prendre contact.",
    service: "/un-a-un",
    pagesLiees: [
      { href: "/un-a-un", libelle: "Découvrir le coaching IA 1-to-1" },
      { href: "/blog", libelle: "Lire les articles du blog" },
    ],
  },
  {
    slug: "audit-ia",
    libelle: "Audit IA",
    description:
      "Des vidéos pour comprendre ce que regarde un audit IA, comment il se déroule et comment en tirer des priorités claires pour votre entreprise.",
    intro:
      "Avant d'investir dans des outils ou des automatisations, il est utile de savoir où l'intelligence artificielle peut réellement faire gagner du temps dans votre organisation, et où elle ne ferait que compliquer les choses. C'est le rôle d'un audit : observer comment le travail s'organise, repérer les tâches répétitives, évaluer les données disponibles, identifier les risques et classer les pistes par ordre d'intérêt. Les vidéos de ce thème expliquent les grandes étapes d'un audit, les questions que l'on vous posera, les documents à préparer et la manière de lire un rapport pour en faire un plan d'action raisonnable. Elles évoquent aussi les points de vigilance, notamment la confidentialité des informations traitées et la place qui reste aux personnes dans les décisions. Chaque vidéo s'accompagne d'un résumé écrit, de trois points à retenir et de réponses aux questions les plus fréquentes. La page dédiée à l'audit présente ensuite le déroulé complet et permet de demander un échange pour cadrer votre besoin.",
    service: "/audit",
    pagesLiees: [
      { href: "/audit", libelle: "Découvrir l'audit IA" },
      { href: "/blog", libelle: "Lire les articles du blog" },
    ],
  },
  {
    slug: "automatisation",
    libelle: "Automatisation",
    description:
      "Des vidéos pour comprendre comment automatiser des tâches répétitives avec l'IA, par étapes et sans perdre le contrôle de ce qui est envoyé.",
    intro:
      "Relances de clients, tri de messages, comptes rendus de réunion, saisie de données, préparation de documents : une grande partie du temps de travail part dans des tâches qui se ressemblent d'un jour à l'autre. L'automatisation consiste à confier ces tâches à un enchaînement d'outils, tout en gardant la possibilité de relire, corriger et arrêter. Les vidéos de ce thème montrent, étape par étape, comment choisir la première tâche à automatiser, comment la décrire précisément, comment tester sur quelques cas avant de généraliser et comment surveiller ce qui est produit dans la durée. Elles insistent sur les erreurs courantes : vouloir tout automatiser d'un coup, négliger la relecture humaine ou oublier de prévoir ce qui se passe quand l'outil se trompe. Chaque vidéo est accompagnée d'un résumé écrit, de trois points à retenir et de réponses aux questions fréquentes. La page consacrée à l'implémentation explique comment nous mettons ces solutions en place avec vous et comment nous les maintenons ensuite.",
    service: "/implementation",
    pagesLiees: [
      { href: "/implementation", libelle: "Découvrir l'implémentation IA" },
      { href: "/blog", libelle: "Lire les articles du blog" },
    ],
  },
  {
    slug: "sites-web-ia",
    libelle: "Sites web et SaaS IA",
    description:
      "Des vidéos pour comprendre comment l'IA transforme la conception d'un site ou d'une application web, de la maquette à la mise en ligne.",
    intro:
      "Un site web ou une application n'est plus seulement une vitrine : il peut répondre aux questions des visiteurs, aider à trier les demandes, personnaliser un parcours ou alléger le travail de l'équipe qui le fait vivre. Les vidéos de ce thème expliquent comment l'intelligence artificielle s'intègre à chaque étape d'un projet, de la clarification du besoin à la maquette, du développement aux tests, puis à l'exploitation au quotidien. Elles abordent aussi les questions que se posent les décideurs : que faire des données des visiteurs, comment garder la maîtrise du contenu affiché, comment éviter qu'un assistant réponde à côté et comment mesurer l'utilité réelle de ces fonctions. Les exemples sont concrets et les notions techniques sont expliquées simplement. Chaque vidéo s'accompagne d'un résumé écrit, de trois points à retenir et de réponses aux questions courantes. Pour aller plus loin, la page consacrée aux sites web et aux applications présente notre manière de travailler et permet de décrire votre projet afin d'en discuter avec l'équipe.",
    service: "/sites-web-augmentes",
    pagesLiees: [
      { href: "/sites-web-augmentes", libelle: "Découvrir les sites web et SaaS IA" },
      { href: "/blog", libelle: "Lire les articles du blog" },
    ],
  },
];

export const THEME_SLUGS = THEMES.map((t) => t.slug) as ReadonlyArray<string>;

export function themeParSlug(slug: string): ThemeVideo | null {
  return THEMES.find((t) => t.slug === slug) ?? null;
}
