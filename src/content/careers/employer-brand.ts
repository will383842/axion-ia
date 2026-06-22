// Marque employeur Axion-IA.com — texte ORIENTÉ CANDIDAT (page recrutement, pas page
// client). Ton Welcome to the Jungle : parle de ce que le candidat va faire/vivre
// en nous rejoignant. Source unique réutilisée sur le hub /carrieres (complet) ET
// sur chaque page offre (version condensée). FR seul affiché (EN désactivé).

export interface WhyJoinCard {
  icon: string;
  titleFr: string;
  titleEn: string;
  textFr: string;
  textEn: string;
}

export const EMPLOYER_BRAND = {
  /** Eyebrow au-dessus du H1 du hub. */
  eyebrowFr: "Rejoins l'aventure 🚀",
  eyebrowEn: "Join the adventure 🚀",

  /** Intro hero (sous le H1) — accroche candidat, énergique. */
  heroIntroFr:
    "Startup tech IA à taille humaine, ancrée en Isère — on intervient dans toute la France et les pays francophones. On recrute dans plein de métiers (tech & IA, data, design, vidéo, marketing, commercial, RH, administratif, support…) : quel que soit le tien, il y a une place pour toi. 👋",
  heroIntroEn:
    "Human-sized AI tech startup, rooted in Isère — we work across France and French-speaking countries. We're hiring across many roles (tech & AI, data, design, video, marketing, sales, HR, admin, support…): whatever yours is, there's a place for you. 👋",

  /** Qui on est (section « Pourquoi nous rejoindre »), ton startup ambitieux. */
  aboutFr:
    "Axion-IA.com est une startup tech IA qui accompagne les entreprises sur toute la chaîne de l'IA : formations, coaching 1 to 1, audits en entreprise, intégration & implémentation d'IA, et sites web & SaaS augmentés à l'IA. Notre ambition est claire : devenir LA référence française de l'IA appliquée en entreprise. On construit comme une vraie équipe produit — du code en production, pas des promesses — avec l'envie de grandir vite. On voit grand.",
  aboutEn:
    "Axion-IA.com is an AI tech startup supporting businesses across the whole AI chain: training, 1-to-1 coaching, on-site audits, AI integration & implementation, and AI-augmented websites & SaaS. Our ambition is clear: become THE French reference for applied AI in companies. We build like a real product team — code in production, not promises — eager to grow fast. We think big.",

  /** Pourquoi tu vas kiffer bosser ici — bénéfices candidat concrets. */
  whyJoin: [
    {
      icon: "🚀",
      titleFr: "Du code en prod, pas des slides",
      titleEn: "Real code, not slides",
      textFr: "Tes projets servent vraiment, tu vois le résultat tourner chez de vrais clients.",
      textEn: "Your work actually ships — you see it running at real clients.",
    },
    {
      icon: "🎯",
      titleFr: "Tu portes tes sujets de A à Z",
      titleEn: "You own your work end to end",
      textFr:
        "Celui qui audite est celui qui code et qui forme. Pas de silos, pas de junior qui hérite d'un truc bricolé.",
      textEn:
        "Whoever audits is the one who codes and trains. No silos, no junior inheriting a hacked-together project.",
    },
    {
      icon: "🧠",
      titleFr: "Tu montes vite en compétence",
      titleEn: "You level up fast",
      textFr: "IA de pointe au quotidien, et on te forme sur ce que tu ne connais pas encore.",
      textEn: "Cutting-edge AI every day, and we train you on what you don't know yet.",
    },
    {
      icon: "🤝",
      titleFr: "Autonomie + franchise",
      titleEn: "Autonomy + straight talk",
      textFr:
        "Peu de réunions, beaucoup de confiance. On dit ce qui marche, ce qui ne marchera pas, et on livre.",
      textEn: "Few meetings, lots of trust. We say what works, what won't, and we ship.",
    },
  ] as ReadonlyArray<WhyJoinCard>,

  /** Où on bosse — ancrage géographique. */
  hqTitleFr: "Où on bosse 🏔️",
  hqTitleEn: "Where we work 🏔️",
  hqTextFr:
    "Notre siège et nos bureaux sont à Grenoble (Isère). Postes en présentiel ici et autour (Voiron, Voreppe, Crolles) ; beaucoup en remote ou hybride, partout en France. Et nos formateurs interviennent par secteur, partout en France.",
  hqTextEn:
    "Our head office and offices are in Grenoble (Isère). On-site roles here and nearby (Voiron, Voreppe, Crolles); many remote or hybrid, anywhere in France. And our trainers work by sector, across France.",

  /** Version condensée (encart sur chaque page offre). */
  shortAboutFr:
    "Axion-IA.com, startup tech IA qui accompagne les entreprises sur l'IA : formations, 1 to 1, audits, intégration/implémentation d'IA et sites web & SaaS augmentés à l'IA. Ici on code pour de vrai et on voit grand.",
  shortAboutEn:
    "Axion-IA.com, a human-sized tech company in Isère making AI operational. Here you code for real, own your work end to end, and grow fast.",

  /** Bloc « accompagnement » affiché sur chaque offre — 2 parties : formation + intégration. */
  onboardingTitleFr: "Comment on t'accompagne 🤝",
  onboardingTitleEn: "How we support you 🤝",
  formationLabelFr: "🎓 Ta formation",
  formationLabelEn: "🎓 Your training",
  formationFr:
    "Dès ton arrivée, on te forme à nos méthodes et à nos outils. Tu montes en compétence progressivement, accompagné·e par l'équipe — on prend le temps qu'il faut pour que tu sois vraiment à l'aise.",
  formationEn:
    "From day one, we train you on our methods and tools. You ramp up step by step, supported by the team — we take the time you need to get truly comfortable.",
  integrationLabelFr: "🤝 Ton intégration",
  integrationLabelEn: "🤝 Your onboarding",
  integrationFr:
    "Ton intégration est pensée pour que tu sois à l'aise avant d'être autonome : tu n'es jamais lâché·e dans le grand bain, et tu as toujours quelqu'un vers qui te tourner.",
  integrationEn:
    "Onboarding is designed so you feel confident before going solo: you're never thrown in at the deep end, and there's always someone to turn to.",
  /** Spécifique formateurs (catégorie « conseil ») — doublon au début, solo quand prêt. */
  formateurOnboardingFr:
    "Pour les interventions : au début, tu es systématiquement en doublon avec un formateur expérimenté — jamais lancé·e seul·e. Une fois que tu as pris confiance et que tu assures des prestations de haute qualité, tu animes tes propres formations en solo.",
  formateurOnboardingEn:
    "For training sessions: at first you always shadow an experienced trainer — never sent out alone. Once you've built confidence and consistently deliver high-quality sessions, you run your own trainings solo.",
} as const;
