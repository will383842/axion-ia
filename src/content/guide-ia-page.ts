/**
 * LES TEXTES DE LA PAGE `/guide-ia` — source unique (lot L1, 2026-09-25).
 *
 * POURQUOI CE FICHIER
 *
 * La page vendait le guide sans le montrer : formulaire à 3,2 écrans du haut
 * sur mobile, aucun visuel du guide, du jargon interne (« Lead magnet »,
 * « pSEO », « quick-wins »), une sortie vers `/formations` que le guide
 * lui-même ne propose pas (audit `page-guide-ux.md`, 2026-09-24).
 *
 * Tout ce qui est écrit ici vient du guide lui-même (PDF, pages citées) :
 * sommaire p. 3, parcours p. 4, « une seule chose à faire lundi matin » p. 5,
 * fiche du guide p. 2, « Et maintenant ? » p. 40. Aucune preuve inventée :
 * ni nombre de téléchargements, ni témoignage, ni logo client.
 *
 * ⛔ Tout texte de ce fichier est PUBLIC : il ne part en production qu'après
 * validation de Will (règle du chantier). `guide-ia-page.spec.ts` y interdit
 * téléphone, Zoom, « mensuel » et le jargon retiré.
 *
 * ⚠️ Module PUR, sans dépendance : lu par la page (serveur) et par les tests.
 */

import { GUIDE_IA_PAGES } from "@/content/guide-ia";

export type LocalePageGuide = "fr" | "en";

/** Nom UNIQUE du guide, partout (menu, pied de page, fil d'Ariane, llms.txt). */
export const NOM_GUIDE: Record<LocalePageGuide, string> = {
  fr: "Guide IA entreprise",
  en: "Enterprise AI guide",
};

/** Un chapitre du sommaire (PDF p. 3), avec sa page de début et ses sous-parties. */
export interface ChapitreGuide {
  numero: string;
  titre: string;
  /** Page de début (PDF). */
  page: number;
  /** Dernière page du chapitre (pour `Chapter.pagination`). */
  fin: number;
  parties: ReadonlyArray<readonly [string, number]>;
}

/** Une page intérieure montrée en aperçu (fichier AVIF tiré du rendu du PDF). */
export interface ApercuGuide {
  page: number;
  src: string;
  titre: string;
  legende: string;
  alt: string;
}

export interface TextesPageGuide {
  meta: { title: string; description: string };
  filAriane: string;
  hero: {
    surtitre: string;
    /** Sur-titre du premier écran mobile (une ligne, à côté de la couverture). */
    surtitreCourt: string;
    /** 🔒 Figé par `le-guide-promis-existe.spec.ts` (40 pages = le PDF). */
    titre: string;
    promesse: string;
    /** 🔒 Figé par `le-guide-promis-existe.spec.ts` (L2 : envoi immédiat). */
    envoi: string;
    reperes: readonly string[];
    altCouverture: string;
  };
  ensuite: {
    titre: string;
    etapes: ReadonlyArray<readonly [string, string]>;
    lettre: string;
  };
  apercu: { surtitre: string; titre: string; intro: string; pages: readonly ApercuGuide[] };
  outils: {
    surtitre: string;
    titre: string;
    intro: string;
    liste: ReadonlyArray<readonly [string, number]>;
  };
  sommaire: {
    surtitre: string;
    titre: string;
    avant: ReadonlyArray<readonly [string, number]>;
    chapitres: readonly ChapitreGuide[];
    pageAbrege: string;
  };
  pourQui: {
    surtitre: string;
    titre: string;
    intro: string;
    lundi: string;
    cartes: ReadonlyArray<{ taille: string; effectif: string; duree: string; lundi: string }>;
    tpe: string;
  };
  croire: {
    surtitre: string;
    titre: string;
    points: ReadonlyArray<readonly [string, string]>;
    fiche: ReadonlyArray<readonly [string, string]>;
    ficheTitre: string;
    sourcesTitre: string;
    sources: ReadonlyArray<{ libelle: string; href?: string }>;
  };
  second: { titre: string; texte: string };
  faq: {
    surtitre: string;
    titre: string;
    items: ReadonlyArray<{ question: string; answer: string }>;
  };
  suite: {
    surtitre: string;
    titre: string;
    intro: string;
    diagnostic: { titre: string; texte: string; cta: string };
    appel: { titre: string; texte: string; cta: string };
  };
  barre: { libelle: string; cta: string };
}

const APERCUS_SRC = {
  5: "/illustrations/guide-ia/guide-ia-entreprise-2026-page-05-essentiel.avif",
  15: "/illustrations/guide-ia/guide-ia-entreprise-2026-page-15-usages-par-fonction.avif",
  27: "/illustrations/guide-ia/guide-ia-entreprise-2026-page-27-gouvernance.avif",
  38: "/illustrations/guide-ia/guide-ia-entreprise-2026-page-38-check-list.avif",
} as const;

/** Couverture du guide (rendu de la page 1 du PDF). */
export const COUVERTURE_GUIDE = {
  src: "/illustrations/guide-ia/guide-ia-entreprise-2026-couverture.avif",
  width: 720,
  height: 1019,
} as const;

/** Dimensions des aperçus (rendu 909 × 1287 réduit à 720 de large, ratio conservé). */
export const APERCU_DIMENSIONS = { width: 720, height: 1019 } as const;

// Sommaire réel du PDF (p. 3). Titres recopiés tels quels.
const CHAPITRES_FR: readonly ChapitreGuide[] = [
  {
    numero: "01",
    titre: "Comprendre l'IA générative en 2026",
    page: 6,
    fin: 9,
    parties: [
      ["Un modèle de langage, sans jargon", 7],
      ["La frontière irrégulière", 7],
      ["Hallucinations : deux cas réels", 8],
      ["Les familles d'outils en 2026", 8],
      ["Où en sont les entreprises", 9],
      ["Votre point de départ réaliste", 9],
    ],
  },
  {
    numero: "02",
    titre: "Usages B2B prouvés (chatbot, OCR, RAG, agents)",
    page: 10,
    fin: 16,
    parties: [
      ["Assistants et chatbots", 11],
      ["OCR et documents", 12],
      ["RAG : interroger vos documents", 13],
      ["Agents et automatisation", 14],
      ["Matrice des usages par fonction", 15],
      ["Ce qui change selon votre taille", 16],
    ],
  },
  {
    numero: "03",
    titre: "Coûts réels : OpenAI vs open-source vs custom",
    page: 17,
    fin: 21,
    parties: [
      ["Trois modèles de coût et les abonnements", 18],
      ["L'API : payer à l'usage", 19],
      ["Open-weight et sur mesure", 20],
      ["Le coût total de possession", 20],
      ["Acheter, assembler ou construire", 21],
      ["Dix questions avant de signer", 21],
    ],
  },
  {
    numero: "04",
    titre: "Gouvernance données + souveraineté UE",
    page: 22,
    fin: 27,
    parties: [
      ["Données et RGPD en pratique", 23],
      ["Souveraineté : CLOUD Act, hébergement UE", 24],
      ["L'AI Act en clair", 25],
      ["Charte d'usage de l'IA", 26],
      ["Gouvernance selon votre taille", 27],
    ],
  },
  {
    numero: "05",
    titre: "ROI : comment mesurer, par quoi commencer",
    page: 28,
    fin: 33,
    parties: [
      ["La formule du ROI", 29],
      ["Indicateurs et base de référence", 30],
      ["Prioriser : matrice impact / effort", 31],
      ["Feuille de route 90 jours", 32],
      ["Former, financer, adapter à sa taille", 33],
    ],
  },
  {
    numero: "06",
    titre: "Écueils fréquents (8 anti-patterns à éviter)",
    page: 34,
    fin: 37,
    parties: [
      ["Cadrer : écueils 1 à 3", 35],
      ["Déployer : écueils 4 à 6", 36],
      ["Piloter : écueils 7 et 8", 37],
      ["Votre auto-diagnostic", 37],
    ],
  },
  {
    numero: "+",
    titre: "Boîte à outils",
    page: 38,
    fin: 40,
    parties: [
      ["Check-list « Prêt à déployer »", 38],
      ["Glossaire et ressources officielles", 39],
      ["Et maintenant ?", 40],
    ],
  },
];

const CHAPITRES_EN: readonly ChapitreGuide[] = [
  { ...CHAPITRES_FR[0]!, titre: "Understanding generative AI in 2026", parties: [] },
  { ...CHAPITRES_FR[1]!, titre: "Proven B2B uses (chatbot, OCR, RAG, agents)", parties: [] },
  { ...CHAPITRES_FR[2]!, titre: "Real costs: OpenAI vs open-source vs custom", parties: [] },
  { ...CHAPITRES_FR[3]!, titre: "Data governance + EU sovereignty", parties: [] },
  { ...CHAPITRES_FR[4]!, titre: "ROI: how to measure, where to start", parties: [] },
  { ...CHAPITRES_FR[5]!, titre: "Common pitfalls (8 anti-patterns to avoid)", parties: [] },
  { ...CHAPITRES_FR[6]!, titre: "Toolbox", parties: [] },
];

// Les 13 « outils à recopier » (encadré du sommaire, p. 3).
const OUTILS_FR: ReadonlyArray<readonly [string, number]> = [
  ["La consigne en 5 éléments", 7],
  ["Exercice d'une heure : tracer votre frontière", 9],
  ["Grille du coût total sur 3 ans", 20],
  ["10 questions à poser à un fournisseur", 21],
  ["Feu tricolore des données", 23],
  ["Charte d'usage de l'IA en 12 règles", 26],
  ["Registre des usages de l'IA", 27],
  ["Fiche de mesure", 30],
  ["Grille de priorisation à 5 critères", 31],
  ["Fiche projet d'une page", 32],
  ["Qui relit quoi", 36],
  ["Auto-diagnostic des 8 écueils", 37],
  ["Check-list en 30 points", 38],
];

const OUTILS_EN: ReadonlyArray<readonly [string, number]> = [
  ["The 5-part prompt", 7],
  ["One-hour exercise: map your frontier", 9],
  ["3-year total cost grid", 20],
  ["10 questions to ask a vendor", 21],
  ["Data traffic light", 23],
  ["AI usage charter in 12 rules", 26],
  ["AI use register", 27],
  ["Measurement sheet", 30],
  ["5-criteria prioritisation grid", 31],
  ["One-page project sheet", 32],
  ["Who reviews what", 36],
  ["Self-assessment of the 8 pitfalls", 37],
  ["30-point checklist", 38],
];

const FR: TextesPageGuide = {
  meta: {
    title: `Guide IA entreprise 2026 · PDF gratuit de ${GUIDE_IA_PAGES} pages`,
    description:
      "Le guide gratuit pour décider avant de déployer l'IA : usages qui marchent, coûts réels, données, AI Act, retour sur investissement, et 13 outils à recopier. Envoyé par e-mail.",
  },
  filAriane: NOM_GUIDE.fr,
  hero: {
    surtitre: "Guide gratuit · édition septembre 2026",
    surtitreCourt: "Guide gratuit",
    titre: `Guide IA entreprise · ${GUIDE_IA_PAGES} pages`,
    promesse:
      "Ce qu'un dirigeant doit savoir avant de déployer l'IA : usages, coûts réels, données, AI Act, retour sur investissement.",
    envoi: "Envoyé par e-mail dans les minutes qui suivent, gratuitement.",
    reperes: ["13 outils à recopier", "Sources publiques citées", "PME, ETI, grands groupes"],
    altCouverture:
      "Couverture du Guide IA entreprise d'Axion-IA, édition septembre 2026 : tout ce qu'un dirigeant doit savoir avant de déployer l'intelligence artificielle, pour les PME, ETI et grands groupes.",
  },
  ensuite: {
    titre: "Ce qui se passe ensuite",
    etapes: [
      ["Vous indiquez votre e-mail.", "Toute adresse convient, professionnelle ou personnelle."],
      [
        "Le guide arrive dans votre boîte.",
        "Dans les minutes qui suivent, avec votre lien de téléchargement. Pensez aux indésirables.",
      ],
      [
        "Vous le lisez, et vous le partagez.",
        "Commencez par la page 5. La diffusion est libre, en citant la source.",
      ],
    ],
    lettre:
      "Avec une adresse professionnelle, ou si vous cochez la case, vous recevrez ensuite quelques lettres par an, à chaque nouveauté utile. Désinscription en un clic, à tout moment. Quand vous ouvrez le guide depuis l'e-mail, votre adresse est aussi enregistrée dans notre outil de suivi de la relation client ; vous pouvez vous y opposer à tout moment.",
  },
  apercu: {
    surtitre: "Aperçu",
    titre: "Feuilletez le guide",
    intro: "Quatre des 40 pages, telles que vous les recevrez.",
    pages: [
      {
        page: 5,
        src: APERCUS_SRC[5],
        titre: "L'essentiel en une page",
        legende: "10 idées clés, et une seule chose à faire lundi matin selon votre taille.",
        alt: "Page 5 du guide : les 10 idées clés à retenir avant de déployer l'IA, et une seule chose à faire lundi matin pour une PME, une ETI ou un grand groupe.",
      },
      {
        page: 15,
        src: APERCUS_SRC[15],
        titre: "La matrice des usages par fonction",
        legende: "Par où commencer, service par service, avec la couleur des données.",
        alt: "Page 15 du guide : tableau des usages éprouvés de l'IA par fonction de l'entreprise, avec la sensibilité des données et la difficulté de chaque usage.",
      },
      {
        page: 27,
        src: APERCUS_SRC[27],
        titre: "La gouvernance selon votre taille",
        legende: "Qui décide quoi, du référent de PME au comité de groupe.",
        alt: "Page 27 du guide : la gouvernance de l'IA selon la taille de l'entreprise, ce qui se décide au niveau du groupe et dans chaque filiale, et un modèle de registre des usages.",
      },
      {
        page: 38,
        src: APERCUS_SRC[38],
        titre: "La check-list « Prêt à déployer »",
        legende: "30 points à cocher avant d'ouvrir un outil à vos équipes.",
        alt: "Page 38 du guide : check-list de 30 points à cocher avant d'ouvrir un outil d'IA à ses équipes, avec la lecture du score.",
      },
    ],
  },
  outils: {
    surtitre: "Boîte à outils",
    titre: "13 outils à recopier",
    intro: "Des grilles et des fiches prêtes à remplir, avec leur page dans le guide.",
    liste: OUTILS_FR,
  },
  sommaire: {
    surtitre: "Sommaire",
    titre: "Au sommaire",
    avant: [
      ["Édito et comment lire ce guide", 4],
      ["L'essentiel en une page : 10 idées clés", 5],
    ],
    chapitres: CHAPITRES_FR,
    pageAbrege: "p.",
  },
  pourQui: {
    surtitre: "Pour qui",
    titre: "Pour qui, et en combien de temps",
    intro:
      "Pour les dirigeants et les responsables (opérations, finance, RH, systèmes d'information, commercial) de PME, d'ETI et de grands groupes. Trois parcours de lecture :",
    lundi: "Une seule chose à faire lundi matin",
    cartes: [
      {
        taille: "PME",
        effectif: "10 à 249 salariés",
        duree: "L'essentiel en 45 minutes",
        lundi:
          "Chronométrez trois tâches répétitives d'une même équipe, testez-les en une heure, puis lancez un pilote de 90 jours sur la meilleure.",
      },
      {
        taille: "ETI",
        effectif: "250 à 4 999 salariés",
        duree: "Structurer en 1 h 30",
        lundi:
          "Faites l'inventaire de l'IA de l'ombre (les usages non déclarés), direction par direction, puis chiffrez deux cas d'usage.",
      },
      {
        taille: "Grand groupe",
        effectif: "5 000 salariés et plus",
        duree: "Structurer à l'échelle en 2 h",
        lundi:
          "Triez vos pilotes : indicateur, valeur de départ, date de décision, coût complet. Arrêtez ceux qui n'ont ni indicateur ni date de décision.",
      },
    ],
    tpe: "Moins de 10 salariés : mêmes pages, en 30 minutes ; le feu des données et la charte suffisent pour commencer.",
  },
  croire: {
    surtitre: "Pourquoi s'y fier",
    titre: "Un guide écrit pour décider",
    points: [
      [
        "Des chiffres sourcés.",
        "Chaque chiffre renvoie à sa source publique, en bas de page : Insee, études publiées, textes officiels européens.",
      ],
      [
        "Daté, et mis à jour.",
        "Informations à jour au 23 septembre 2026. Le guide est revu tous les six mois.",
      ],
      [
        "Honnête sur ses limites.",
        "Des informations générales, pas un conseil juridique. Les exemples de calcul sont illustratifs : ni références clients, ni résultats garantis.",
      ],
      [
        "Libre de diffusion.",
        "Reproduction et diffusion autorisées, en tout ou partie, à condition de citer la source.",
      ],
    ],
    ficheTitre: "Fiche du guide",
    fiche: [
      ["Titre", "Guide IA entreprise 2026"],
      ["Édition", "Septembre 2026 · version 1"],
      ["Rythme", "Mise à jour semestrielle"],
      ["Éditeur", "Axion-IA · Grenoble"],
      ["Format", `PDF · ${GUIDE_IA_PAGES} pages · en français`],
      ["Accès", "Gratuit, envoyé par e-mail"],
    ],
    sourcesTitre: "Quelques sources citées",
    sources: [
      {
        libelle: "Insee, Insee Première n° 2120, juillet 2026 (données 2025)",
        href: "https://www.insee.fr/fr/statistiques/9025878",
      },
      {
        libelle: "Règlement (UE) 2024/1689 sur l'intelligence artificielle (AI Act)",
        href: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj",
      },
      { libelle: "Dell'Acqua et al., Harvard Business School / BCG, 2023" },
      {
        libelle:
          "Brynjolfsson et al., « Generative AI at Work », Quarterly Journal of Economics, 2025",
      },
      { libelle: "MIT NANDA, « The GenAI Divide », juillet 2025 (résultats préliminaires)" },
    ],
  },
  second: {
    titre: "Recevoir le guide",
    texte: `${GUIDE_IA_PAGES} pages, 13 outils à recopier. Envoyé par e-mail dans les minutes qui suivent, gratuitement.`,
  },
  faq: {
    surtitre: "Questions fréquentes",
    titre: "Vos questions sur le guide",
    items: [
      {
        question: "Le guide est-il vraiment gratuit ?",
        answer:
          "Oui. Il vous est envoyé par e-mail dès que vous indiquez votre adresse. Avec une adresse professionnelle, vous recevez aussi quelques lettres par an, dont vous pouvez vous désinscrire en un clic ; avec une adresse personnelle, seulement si vous cochez la case.",
      },
      {
        question: "Faut-il une adresse e-mail professionnelle ?",
        answer: "Non. Toute adresse convient, professionnelle ou personnelle.",
      },
      {
        question: "Pourquoi demander mon e-mail ?",
        answer:
          "Pour vous envoyer le guide : l'e-mail contient votre lien de téléchargement. Avec une adresse professionnelle, vous recevez aussi quelques lettres par an, à chaque nouveauté utile ; avec une adresse personnelle, seulement si vous cochez la case. Désinscription en un clic, à tout moment. Quand vous ouvrez le guide depuis l'e-mail, votre adresse est aussi enregistrée dans notre outil de suivi de la relation client ; vous pouvez vous y opposer à tout moment. Détails dans notre politique de confidentialité.",
      },
      {
        question: "Je n'ai rien reçu. Que faire ?",
        answer:
          "Regardez dans les indésirables et dans l'onglet Promotions : l'e-mail part dans les minutes qui suivent votre demande. Toujours rien ? Vérifiez l'adresse saisie et refaites la demande sur cette page, ou écrivez à contact@axion-ia.com.",
      },
      {
        question: "Puis-je le partager avec mes équipes ?",
        answer:
          "Oui. La reproduction et la diffusion sont autorisées, en tout ou partie, à condition de citer la source : « Axion-IA, Guide IA entreprise 2026 ».",
      },
      {
        question: "Le guide est-il mis à jour ?",
        answer:
          "Oui, tous les six mois. Cette édition date de septembre 2026 ; ses informations sont à jour au 23 septembre 2026.",
      },
    ],
  },
  suite: {
    surtitre: "Et après la lecture ?",
    titre: "Passer de la lecture à l'action",
    intro: "Deux étapes, reprises de la dernière page du guide.",
    diagnostic: {
      titre: "Faire le point en ligne",
      texte:
        "Un questionnaire gratuit, sans inscription, pour situer votre maturité et repérer vos premiers usages.",
      cta: "Faire le point en ligne",
    },
    appel: {
      titre: "Parler de votre projet",
      texte:
        "Un diagnostic de 45 minutes, par téléphone ou en visio, gratuit et sans engagement, sur votre situation, vos priorités ou vos pilotes en cours.",
      cta: "Demander un appel",
    },
  },
  barre: { libelle: `Guide gratuit · ${GUIDE_IA_PAGES} pages`, cta: "Recevoir le guide" },
};

const EN: TextesPageGuide = {
  meta: {
    title: `Enterprise AI guide 2026 · free ${GUIDE_IA_PAGES}-page PDF`,
    description:
      "The free guide to decide before deploying AI: uses that work, real costs, data, the AI Act, return on investment, and 13 ready-to-use tools. Sent by email.",
  },
  filAriane: NOM_GUIDE.en,
  hero: {
    surtitre: "Free guide · September 2026 edition",
    surtitreCourt: "Free guide",
    titre: `Enterprise AI guide · ${GUIDE_IA_PAGES} pages`,
    promesse:
      "What an executive must know before deploying AI: uses, real costs, data, the AI Act, return on investment.",
    envoi: "Sent to you by email within minutes, free.",
    reperes: ["13 ready-to-use tools", "Public sources cited", "SMEs, mid-caps, large groups"],
    altCouverture:
      "Cover of Axion-IA's Enterprise AI guide, September 2026 edition, for SMEs, mid-caps and large groups (in French).",
  },
  ensuite: {
    titre: "What happens next",
    etapes: [
      ["You enter your email.", "Any address works, business or personal."],
      [
        "The guide reaches your inbox.",
        "Within a few minutes, with your download link. Check your spam folder.",
      ],
      [
        "You read it, and share it.",
        "Start with page 5. Sharing is free, with credit to the source.",
      ],
    ],
    lettre:
      "With a business address, or if you tick the box, you will then receive a few emails a year, only when there is something new and useful. One-click unsubscribe, at any time. When you open the guide from the email, your address is also recorded in our customer relationship tool; you can object at any time.",
  },
  apercu: {
    surtitre: "Preview",
    titre: "Leaf through the guide",
    intro: "Four of the 40 pages, as you will receive them (in French).",
    pages: [
      {
        page: 5,
        src: APERCUS_SRC[5],
        titre: "Everything on one page",
        legende: "10 key ideas, and one thing to do on Monday morning.",
        alt: "Page 5 of the guide: 10 key ideas before deploying AI, and one thing to do on Monday morning.",
      },
      {
        page: 15,
        src: APERCUS_SRC[15],
        titre: "Uses by business function",
        legende: "Where to start, department by department.",
        alt: "Page 15 of the guide: proven AI uses by business function, with data sensitivity and difficulty.",
      },
      {
        page: 27,
        src: APERCUS_SRC[27],
        titre: "Governance by company size",
        legende: "Who decides what, from SME lead to group committee.",
        alt: "Page 27 of the guide: AI governance by company size, and a model register of AI uses.",
      },
      {
        page: 38,
        src: APERCUS_SRC[38],
        titre: "The “ready to deploy” checklist",
        legende: "30 points to tick before opening a tool to your teams.",
        alt: "Page 38 of the guide: a 30-point checklist before opening an AI tool to your teams.",
      },
    ],
  },
  outils: {
    surtitre: "Toolbox",
    titre: "13 ready-to-use tools",
    intro: "Grids and sheets ready to fill in, with their page in the guide.",
    liste: OUTILS_EN,
  },
  sommaire: {
    surtitre: "Contents",
    titre: "What's inside",
    avant: [
      ["Foreword and how to read this guide", 4],
      ["Everything on one page: 10 key ideas", 5],
    ],
    chapitres: CHAPITRES_EN,
    pageAbrege: "p.",
  },
  pourQui: {
    surtitre: "Who it is for",
    titre: "Who it is for, and how long it takes",
    intro:
      "For executives and managers (operations, finance, HR, IT, sales) of SMEs, mid-caps and large groups. Three reading paths:",
    lundi: "One thing to do on Monday morning",
    cartes: [
      {
        taille: "SME",
        effectif: "10 to 249 employees",
        duree: "The essentials in 45 minutes",
        lundi:
          "Time three repetitive tasks of one team, test them in one hour, then run a 90-day pilot on the best one.",
      },
      {
        taille: "Mid-cap",
        effectif: "250 to 4,999 employees",
        duree: "Structure in 1 h 30",
        lundi:
          "Inventory shadow AI (undeclared uses), department by department, then cost two use cases.",
      },
      {
        taille: "Large group",
        effectif: "5,000 employees and more",
        duree: "Structure at scale in 2 h",
        lundi:
          "Sort your pilots: indicator, baseline, decision date, full cost. Stop those with neither indicator nor decision date.",
      },
    ],
    tpe: "Under 10 employees: same pages, in 30 minutes.",
  },
  croire: {
    surtitre: "Why trust it",
    titre: "A guide written to help you decide",
    points: [
      ["Sourced figures.", "Every figure points to its public source, in a footnote."],
      ["Dated, and updated.", "Up to date as of 23 September 2026. Reviewed every six months."],
      [
        "Honest about its limits.",
        "General information, not legal advice. Worked examples are illustrative: neither client references nor guaranteed results.",
      ],
      ["Free to share.", "Reproduction allowed, in whole or in part, with credit to the source."],
    ],
    ficheTitre: "About the guide",
    fiche: [
      ["Title", "Guide IA entreprise 2026"],
      ["Edition", "September 2026 · version 1"],
      ["Updates", "Every six months"],
      ["Publisher", "Axion-IA · Grenoble"],
      ["Format", `PDF · ${GUIDE_IA_PAGES} pages · in French`],
      ["Access", "Free, sent by email"],
    ],
    sourcesTitre: "Some of the sources cited",
    sources: [
      {
        libelle: "Insee, Insee Première no. 2120, July 2026 (2025 data)",
        href: "https://www.insee.fr/fr/statistiques/9025878",
      },
      {
        libelle: "Regulation (EU) 2024/1689 on artificial intelligence (AI Act)",
        href: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj",
      },
      { libelle: "Dell'Acqua et al., Harvard Business School / BCG, 2023" },
      {
        libelle:
          "Brynjolfsson et al., “Generative AI at Work”, Quarterly Journal of Economics, 2025",
      },
      { libelle: "MIT NANDA, “The GenAI Divide”, July 2025 (preliminary results)" },
    ],
  },
  second: {
    titre: "Get the guide",
    texte: `${GUIDE_IA_PAGES} pages, 13 ready-to-use tools. Sent to you by email within minutes, free.`,
  },
  faq: {
    surtitre: "FAQ",
    titre: "Your questions about the guide",
    items: [
      {
        question: "Is the guide really free?",
        answer:
          "Yes. It is sent to you by email as soon as you enter your address. With a business address, you also receive a few emails a year, which you can unsubscribe from in one click; with a personal address, only if you tick the box.",
      },
      {
        question: "Do I need a business email address?",
        answer: "No. Any address works, business or personal.",
      },
      {
        question: "Why do you ask for my email?",
        answer:
          "To send you the guide: the email holds your download link. With a business address, you also receive a few emails a year, only when there is something new and useful; with a personal address, only if you tick the box. One-click unsubscribe, at any time. When you open the guide from the email, your address is also recorded in our customer relationship tool; you can object at any time. Details in our privacy policy.",
      },
      {
        question: "I received nothing. What should I do?",
        answer:
          "Check your spam and Promotions folders: the email leaves a few minutes after your request. Still nothing? Check the address and request it again on this page, or write to contact@axion-ia.com.",
      },
      {
        question: "Can I share it with my teams?",
        answer:
          "Yes. Reproduction and sharing are allowed, in whole or in part, with credit to the source: “Axion-IA, Guide IA entreprise 2026”.",
      },
      {
        question: "Is the guide updated?",
        answer: "Yes, every six months. This edition dates from September 2026.",
      },
    ],
  },
  suite: {
    surtitre: "After reading",
    titre: "From reading to action",
    intro: "Two steps, taken from the last page of the guide.",
    diagnostic: {
      titre: "Take stock online",
      texte: "A free questionnaire, no sign-up, to assess your maturity and spot your first uses.",
      cta: "Take stock online",
    },
    appel: {
      titre: "Talk about your project",
      texte:
        "A 45-minute diagnosis, by phone or video, free and without commitment, on your situation, your priorities or your current pilots.",
      cta: "Request a call",
    },
  },
  barre: { libelle: `Free guide · ${GUIDE_IA_PAGES} pages`, cta: "Get the guide" },
};

/**
 * Typographie française : espace INSÉCABLE avant « ? ! : ; » et à l'intérieur
 * des guillemets. Sans elle, le « ? » d'une question de la FAQ tombait seul sur
 * une ligne à 390 px (capture du lot L1).
 */
export function insecables(texte: string): string {
  // Espace insécable écrite par son code : un caractère invisible dans la source
  // ne se relit pas.
  const nbsp = String.fromCharCode(0xa0);
  return texte.replace(/ ([?!:;»])/g, `${nbsp}$1`).replace(/« /g, `«${nbsp}`);
}

function typographier<T>(v: T): T {
  if (typeof v === "string") return insecables(v) as T;
  if (Array.isArray(v)) return v.map((x) => typographier(x)) as T;
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v).map(([k, x]) => [k, k === "src" ? x : typographier(x)]),
    ) as T;
  }
  return v;
}

const FR_TYPO = typographier(FR);

export function textesPageGuide(locale: LocalePageGuide): TextesPageGuide {
  return locale === "en" ? EN : FR_TYPO;
}
