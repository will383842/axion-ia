// Marque employeur Axion-IA — texte ORIENTÉ CANDIDAT (page recrutement, pas page
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
    "Tu veux faire de l'IA qui finit vraiment en production — pas dans un slide ? Chez Axion-IA, tu codes, tu déploies, et tu vois l'impact direct chez de vraies boîtes. Équipe à taille humaine, autonomie réelle, sujets IA de pointe au quotidien. Si tu aimes résoudre des problèmes concrets et livrer, on devrait bien s'entendre. 👋",
  heroIntroEn:
    "Want to build AI that actually ships — not another slide? At Axion-IA, you code, you deploy, and you see the impact straight away at real companies. Human-sized team, real autonomy, cutting-edge AI every day. If you like solving concrete problems and shipping, we'll get along. 👋",

  /** Qui on est (section « Pourquoi nous rejoindre »), angle candidat. */
  aboutFr:
    "Axion-IA, c'est une boîte tech à taille humaine, ancrée en Isère, qui rend l'IA opérationnelle pour les entreprises (audits, implémentation, web/SaaS). On construit comme une vraie équipe produit : du code en prod, pas des promesses. L'objectif : devenir LA référence française de l'IA appliquée — la plus utile, pas la plus grosse.",
  aboutEn:
    "Axion-IA is a human-sized tech company, rooted in Isère, making AI operational for businesses (audits, implementation, web/SaaS). We build like a real product team: code in production, not promises. The goal: become THE French reference in applied AI — the most useful, not the biggest.",

  /** Pourquoi tu vas kiffer bosser ici — bénéfices candidat concrets. */
  whyJoin: [
    {
      icon: "🚀",
      titleFr: "Du code en prod, pas des slides",
      titleEn: "Real code, not slides",
      textFr:
        "Tes projets servent vraiment, tu vois le résultat tourner chez de vrais clients.",
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
      textFr:
        "IA de pointe au quotidien, et on te forme sur ce que tu ne connais pas encore.",
      textEn:
        "Cutting-edge AI every day, and we train you on what you don't know yet.",
    },
    {
      icon: "🤝",
      titleFr: "Autonomie + franchise",
      titleEn: "Autonomy + straight talk",
      textFr:
        "Peu de réunions, beaucoup de confiance. On dit ce qui marche, ce qui ne marchera pas, et on livre.",
      textEn:
        "Few meetings, lots of trust. We say what works, what won't, and we ship.",
    },
  ] as ReadonlyArray<WhyJoinCard>,

  /** Où on bosse — ancrage géographique. */
  hqTitleFr: "Où on bosse 🏔️",
  hqTitleEn: "Where we work 🏔️",
  hqTextFr:
    "Notre QG est à Saint-Marcellin, en Isère. Les postes en présentiel sont ici et autour (Grenoble, Valence, Romans, Voiron), et plein de rôles sont ouverts en remote ou hybride, partout en France.",
  hqTextEn:
    "Our HQ is in Saint-Marcellin, Isère. On-site roles are here and nearby (Grenoble, Valence, Romans, Voiron), and many roles are open remote or hybrid, anywhere in France.",

  /** Version condensée (encart sur chaque page offre). */
  shortAboutFr:
    "Axion-IA, boîte tech à taille humaine ancrée en Isère, qui rend l'IA opérationnelle. Ici on code pour de vrai, on porte ses sujets de bout en bout, et on monte vite.",
  shortAboutEn:
    "Axion-IA, a human-sized tech company in Isère making AI operational. Here you code for real, own your work end to end, and grow fast.",
} as const;
