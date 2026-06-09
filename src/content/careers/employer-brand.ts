// Marque employeur Axion-IA — contenu PLACEHOLDER soigné (ton fun / Welcome to
// the Jungle). À affiner par Will. Source unique réutilisée sur le hub /carrieres
// (version complète) ET sur chaque page offre (version condensée).

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

  /** Intro hero (sous le H1), ton direct et énergique. */
  heroIntroFr:
    "Chez Axion-IA, on ne fait pas de l'IA pour faire joli — on la rend opérationnelle, celle qui fait gagner des heures aux entreprises. On cherche des gens curieux, qui avancent vite et qui n'ont pas peur de mettre les mains dans le cambouis. Ça te parle ? On a hâte de te lire.",
  heroIntroEn:
    "At Axion-IA, we don't do AI to look cool — we make it operational, the kind that saves companies real hours. We're after curious people who move fast and aren't afraid to get their hands dirty. Sounds like you? We can't wait to hear from you.",

  /** Qui sommes-nous (section « Pourquoi nous rejoindre » du hub). */
  aboutFr:
    "Axion-IA, c'est le cabinet IA opérationnel des dirigeants qui avancent. On audite, on forme, on implémente et on intègre l'IA concrètement pour les TPE, PME et ETI — sans bullshit, avec des résultats mesurables. Une équipe à taille humaine, ancrée en Isère, qui voit grand.",
  aboutEn:
    "Axion-IA is the operational AI firm for leaders who move. We audit, train, implement and integrate AI concretely for small and mid-sized companies — no bullshit, measurable results. A human-sized team, rooted in Isère, thinking big.",

  /** Pourquoi nous rejoindre — cartes valeurs/avantages. */
  whyJoin: [
    {
      icon: "🎯",
      titleFr: "Du concret, pas du PowerPoint",
      titleEn: "Real work, not slides",
      textFr: "Tes projets servent vraiment — des clients, des résultats, du mesurable.",
      textEn: "Your work actually ships — real clients, real results, measurable impact.",
    },
    {
      icon: "🚀",
      titleFr: "On va vite",
      titleEn: "We move fast",
      textFr: "Peu de réunions, beaucoup d'autonomie. Tu proposes, on teste, on apprend.",
      textEn: "Few meetings, lots of autonomy. You suggest, we test, we learn.",
    },
    {
      icon: "🧠",
      titleFr: "Tu montes en compétence",
      titleEn: "You level up",
      textFr: "IA de pointe au quotidien, et on te forme à ce que tu ne connais pas encore.",
      textEn: "Cutting-edge AI every day, and we train you on what you don't know yet.",
    },
    {
      icon: "🤝",
      titleFr: "Une équipe qui se serre les coudes",
      titleEn: "A team that has your back",
      textFr: "À taille humaine, bienveillante, ambitieuse. On avance ensemble.",
      textEn: "Human-sized, supportive, ambitious. We grow together.",
    },
  ] as ReadonlyArray<WhyJoinCard>,

  /** Siège / ancrage géographique. */
  hqTitleFr: "Notre camp de base 🏔️",
  hqTitleEn: "Our home base 🏔️",
  hqTextFr:
    "Notre siège est à Saint-Marcellin, en Isère. Nos postes en présentiel sont ici (et alentours : Grenoble, Valence, Romans, Voiron) — et beaucoup de rôles sont ouverts en remote ou hybride, partout en France.",
  hqTextEn:
    "Our HQ is in Saint-Marcellin, Isère. Our on-site roles are here (and nearby: Grenoble, Valence, Romans, Voiron) — and many roles are open remote or hybrid, anywhere in France.",

  /** Version condensée (encart sur chaque page offre). */
  shortAboutFr:
    "Axion-IA rend l'IA concrète et opérationnelle pour les entreprises. Équipe à taille humaine, ancrée en Isère, qui voit grand.",
  shortAboutEn:
    "Axion-IA makes AI concrete and operational for companies. A human-sized team, rooted in Isère, thinking big.",
} as const;
