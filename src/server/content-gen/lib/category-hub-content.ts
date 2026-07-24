/**
 * Contenu éditorial des hubs de catégorie blog — schéma de héro (orbital) + FAQ.
 *
 * SSOT pour :
 *   • le graphique de héro (schéma orbital `ServiceHero`/`ImplementationHeroSchema`,
 *     comme /audit et /un-a-un) — 8 satellites par catégorie ;
 *   • la FAQ visible + le JSON-LD FAQPage (AEO / featured snippets / AI Overviews).
 *
 * Les 5 slugs content-gen sont couverts ; `getCategoryHubContent` retombe sur un
 * preset générique pour les catégories FS legacy hors content-gen.
 */

import type { Locale } from "@/i18n/routing";

type Accent = "terracotta" | "primary" | "sage" | "mocha";

export interface HeroSchemaNode {
  readonly label: string;
  readonly benefit: string;
  readonly accent: Accent;
}

export interface CategoryFaqItem {
  readonly question: string;
  readonly answer: string;
}

export interface CategoryHubContent {
  /** Label central du schéma orbital (ex « Formations IA »). */
  readonly centerLabel: string;
  /** 8 satellites — un par dimension de la thématique. */
  readonly nodes: ReadonlyArray<HeroSchemaNode>;
  /** aria-label complet du schéma (a11y). */
  readonly schemaAriaLabel: string;
  /** 4-6 questions/réponses (FAQ visible + FAQPage JSON-LD). */
  readonly faq: ReadonlyArray<CategoryFaqItem>;
}

const ACCENTS: readonly Accent[] = ["terracotta", "primary", "sage", "mocha"];

/** Construit 8 nodes en alternant les accents, à partir de paires label/benefit. */
function buildNodes(pairs: ReadonlyArray<readonly [string, string]>): HeroSchemaNode[] {
  return pairs.map(([label, benefit], i) => ({
    label,
    benefit,
    accent: ACCENTS[i % ACCENTS.length] as Accent,
  }));
}

type Catalog = Record<string, Record<Locale, CategoryHubContent>>;

const CATALOG: Catalog = {
  "blog-formations-ia": {
    fr: {
      centerLabel: "Formations IA",
      nodes: buildNodes([
        ["Fondamentaux", "Comprendre l'IA"],
        ["Prompt engineering", "Prompts efficaces"],
        ["Cas pratiques", "Mise en application"],
        ["Outils", "Stack adaptée"],
        ["Sécurité", "Usage maîtrisé"],
        ["Méthode", "Cadre éprouvé"],
        ["ROI", "Gains mesurés"],
        ["Suivi", "Ancrage durable"],
      ]),
      schemaAriaLabel:
        "Schéma : « Formations IA » au centre, entouré des 8 dimensions de la montée en compétences.",
      faq: [
        {
          question: "À qui s'adressent les formations IA Axion-IA ?",
          answer:
            "Les formations IA Axion-IA s'adressent aux dirigeants, équipes et indépendants de TPE et PME, sans aucun prérequis technique. L'objectif est de passer de la théorie à un usage concret de l'IA dans votre métier, en partant directement de vos cas d'usage réels.",
        },
        {
          question: "Les formations IA sont-elles finançables ?",
          answer:
            "Oui, les formations IA Axion-IA sont finançables car Axion-IA est un organisme de formation déclaré. Selon votre situation, le parcours peut être pris en charge par votre OPCO ou via le plan de développement des compétences de l'entreprise.",
        },
        {
          question: "Combien de temps pour être autonome sur l'IA ?",
          answer:
            "La plupart des participants appliquent leurs premiers cas d'usage dès la première session de formation. L'autonomie sur un workflow complet se construit ensuite sur quelques semaines de pratique régulière, accompagnée d'un suivi pour ancrer durablement les bons réflexes.",
        },
        {
          question: "Les formations IA sont-elles en présentiel ou à distance ?",
          answer:
            "Les formations IA Axion-IA se déroulent en présentiel, à distance ou en format hybride, selon vos contraintes d'organisation. Quel que soit le format choisi, le contenu reste centré sur vos cas d'usage métier réels plutôt que sur de la théorie générique.",
        },
        {
          question: "Quels outils IA apprend-on concrètement ?",
          answer:
            "Vous apprenez les outils réellement utiles à votre activité, comme ChatGPT, Claude ou des automatisations adaptées. Ils sont sélectionnés selon vos besoins métier plutôt que présentés comme un catalogue générique, pour un transfert directement applicable à votre poste.",
        },
      ],
    },
    en: {
      centerLabel: "AI training",
      nodes: buildNodes([
        ["Fundamentals", "Understand AI"],
        ["Prompt engineering", "Effective prompts"],
        ["Hands-on", "Real practice"],
        ["Tooling", "Right stack"],
        ["Security", "Safe usage"],
        ["Method", "Proven framework"],
        ["ROI", "Measured gains"],
        ["Follow-up", "Lasting habits"],
      ]),
      schemaAriaLabel:
        "Diagram: “AI training” at the center, surrounded by the 8 dimensions of upskilling.",
      faq: [
        {
          question: "Who are Axion-IA's AI trainings for?",
          answer:
            "Axion-IA's AI trainings are for leaders, teams and freelancers in small and mid-sized companies, with no technical prerequisite. The goal is to move from theory to concrete AI use in your work, starting directly from your own real-world use cases.",
        },
        {
          question: "Can the AI trainings be funded?",
          answer:
            "Yes, the AI trainings can be funded because Axion-IA is a registered training provider. Depending on your situation, the program may be covered through your training fund or the company's skills development plan, easing the financial side of upskilling.",
        },
        {
          question: "How long until I'm autonomous with AI?",
          answer:
            "Most participants apply their first use cases in the very first training session. Full-workflow autonomy then builds over a few weeks of regular practice, supported by follow-up so the right reflexes become lasting habits in your daily work.",
        },
        {
          question: "Are the trainings in person or remote?",
          answer:
            "Axion-IA's AI trainings run in person, remotely or in a hybrid format, depending on your organizational constraints. Whichever format you choose, the content stays focused on your real business use cases rather than generic theory, so it applies directly to your work.",
        },
        {
          question: "Which AI tools do we actually learn?",
          answer:
            "You learn the tools genuinely useful to your work, such as ChatGPT, Claude or tailored automations. They are selected for your business needs rather than presented as a generic catalog, so the skills transfer directly to your role.",
        },
      ],
    },
  },

  "blog-coaching-1-to-1": {
    fr: {
      centerLabel: "Coaching 1-to-1",
      nodes: buildNodes([
        ["Diagnostic", "Point de départ"],
        ["Objectifs", "Cap clair"],
        ["Outils IA", "Sélection ciblée"],
        ["Productivité", "Temps gagné"],
        ["Décision", "Mieux arbitrer"],
        ["Posture", "Confiance IA"],
        ["Suivi", "Accompagnement"],
        ["Résultats", "Impact concret"],
      ]),
      schemaAriaLabel:
        "Schéma : « Coaching 1-to-1 » au centre, entouré des 8 dimensions de l'accompagnement individuel.",
      faq: [
        {
          question: "Comment se déroule un coaching IA individuel ?",
          answer:
            "Un coaching IA individuel se déroule en séances personnalisées centrées sur vos cas réels. On diagnostique d'abord vos besoins, puis on sélectionne les bons outils IA et on les met en place directement sur votre poste, avec un suivi pour ancrer l'usage.",
        },
        {
          question: "Le coaching 1-to-1 est-il finançable (AFEST) ?",
          answer:
            "Oui, le coaching 1-to-1 peut être finançable lorsqu'il est structuré en AFEST, l'action de formation en situation de travail. Dans ce cadre, il peut être pris en charge par votre OPCO selon votre éligibilité, comme un véritable parcours de formation.",
        },
        {
          question: "Faut-il des connaissances techniques ?",
          answer:
            "Non, aucune connaissance technique préalable n'est requise pour suivre un coaching IA individuel. L'accompagnement part de votre métier et des outils que vous utilisez déjà au quotidien, puis avance à votre rythme vers des usages IA concrets et utiles.",
        },
        {
          question: "Combien de séances de coaching faut-il ?",
          answer:
            "En général, quelques séances ciblées suffisent pour ancrer un usage concret de l'IA sur votre poste. Le nombre exact et le rythme s'adaptent à votre objectif et à votre disponibilité, l'idée étant d'aller à l'essentiel plutôt que de multiplier les rendez-vous.",
        },
        {
          question: "Le coaching 1-to-1 se fait-il à distance ?",
          answer:
            "Oui, le coaching 1-to-1 peut se faire à distance en visio comme en présentiel, selon ce qui vous convient le mieux. L'essentiel est de travailler directement sur vos propres outils et vos cas réels, afin que chaque séance produise un résultat immédiatement applicable.",
        },
      ],
    },
    en: {
      centerLabel: "1-to-1 coaching",
      nodes: buildNodes([
        ["Diagnosis", "Starting point"],
        ["Goals", "Clear direction"],
        ["AI tools", "Targeted picks"],
        ["Productivity", "Time saved"],
        ["Decisions", "Better calls"],
        ["Mindset", "AI confidence"],
        ["Follow-up", "Ongoing support"],
        ["Results", "Concrete impact"],
      ]),
      schemaAriaLabel:
        "Diagram: “1-to-1 coaching” at the center, surrounded by the 8 dimensions of individual support.",
      faq: [
        {
          question: "How does individual AI coaching work?",
          answer:
            "Individual AI coaching works through one-on-one sessions focused on your real cases. We first diagnose your needs, then pick the right AI tools and set them up directly in your role, with follow-up to make sure the new usage actually sticks.",
        },
        {
          question: "Can 1-to-1 coaching be funded?",
          answer:
            "Yes, 1-to-1 coaching can be funded when it is structured as on-the-job training. In that setup it may be covered through your training provider depending on your eligibility, just like a formal upskilling program rather than a one-off service.",
        },
        {
          question: "Do I need technical skills?",
          answer:
            "No, no prior technical skill is required to follow individual AI coaching. The coaching starts from your job and the tools you already use every day, then progresses at your own pace toward concrete, genuinely useful AI usage.",
        },
        {
          question: "How many coaching sessions are needed?",
          answer:
            "Usually a few targeted sessions are enough to embed concrete AI usage in your role. The exact number and pace adapt to your goal and availability, with the aim of getting to the essentials rather than multiplying meetings.",
        },
        {
          question: "Is 1-to-1 coaching available remotely?",
          answer:
            "Yes, 1-to-1 coaching is available remotely by video as well as in person, whichever suits you best. What matters is working directly on your own tools and real cases, so each session produces a result you can apply right away.",
        },
      ],
    },
  },

  "blog-audits-ia": {
    fr: {
      centerLabel: "Audit IA",
      nodes: buildNodes([
        ["Processus", "Cartographie"],
        ["Données", "Qualité & accès"],
        ["Outils", "État des lieux"],
        ["Risques", "Conformité"],
        ["Quick-wins", "Gains rapides"],
        ["Priorisation", "Roadmap"],
        ["ROI", "Chiffrage"],
        ["Feuille de route", "Plan d'action"],
      ]),
      schemaAriaLabel:
        "Schéma : « Audit IA » au centre, entouré des 8 dimensions de l'audit d'opportunités IA.",
      faq: [
        {
          question: "Qu'est-ce qu'un audit IA Axion-IA ?",
          answer:
            "Un audit IA Axion-IA est un état des lieux de vos processus, données et outils visant à identifier les cas d'usage IA à plus fort ROI. Il aboutit à une feuille de route priorisée, qui distingue les quick-wins immédiats des chantiers de fond à planifier.",
        },
        {
          question: "Combien de temps dure un audit IA ?",
          answer:
            "Selon le périmètre étudié, un audit IA se mène en quelques jours à quelques semaines. Il reste volontairement court pour aboutir rapidement à des quick-wins activables, tout en posant une feuille de route claire pour les chantiers suivants.",
        },
        {
          question: "Que livre concrètement l'audit ?",
          answer:
            "L'audit livre une cartographie des opportunités IA et une priorisation par ROI et effort. Il y ajoute une analyse des risques de conformité, notamment RGPD et IA Act, ainsi qu'un plan d'action chiffré que vous pouvez suivre étape par étape.",
        },
        {
          question: "À qui s'adresse un audit IA ?",
          answer:
            "Un audit IA s'adresse aux TPE et PME qui veulent savoir où l'IA apporte un ROI réel avant d'investir. Il aide à concentrer le budget sur les cas d'usage à fort impact plutôt que de se disperser sur des outils à la mode et peu utiles.",
        },
        {
          question: "Combien coûte un audit IA ?",
          answer:
            "Le coût d'un audit IA dépend du périmètre à étudier et de vos objectifs. Un appel de cadrage gratuit permet de définir le bon format puis d'obtenir un devis clair, sans engagement, adapté à la taille et à la maturité de votre organisation.",
        },
      ],
    },
    en: {
      centerLabel: "AI audit",
      nodes: buildNodes([
        ["Process", "Mapping"],
        ["Data", "Quality & access"],
        ["Tools", "Current state"],
        ["Risks", "Compliance"],
        ["Quick wins", "Fast gains"],
        ["Prioritization", "Roadmap"],
        ["ROI", "Quantified"],
        ["Roadmap", "Action plan"],
      ]),
      schemaAriaLabel:
        "Diagram: “AI audit” at the center, surrounded by the 8 dimensions of an AI opportunity audit.",
      faq: [
        {
          question: "What is an Axion-IA AI audit?",
          answer:
            "An Axion-IA AI audit is a review of your processes, data and tools to identify the highest-ROI AI use cases. It results in a prioritized roadmap that separates immediate quick wins from the deeper projects you should plan for later.",
        },
        {
          question: "How long does an AI audit take?",
          answer:
            "Depending on the scope studied, an AI audit runs from a few days to a few weeks. It is deliberately kept short to surface quick wins you can act on immediately, while still laying out a clear roadmap for the next projects.",
        },
        {
          question: "What does the audit deliver?",
          answer:
            "The audit delivers an opportunity map and a prioritization by ROI and effort. It also includes a compliance risk analysis, notably GDPR and the AI Act, plus a costed action plan you can follow step by step.",
        },
        {
          question: "Who is an AI audit for?",
          answer:
            "An AI audit is for small and mid-sized companies that want to know where AI delivers real ROI before investing. It helps focus the budget on high-impact use cases instead of spreading thin on trendy, low-value tools.",
        },
        {
          question: "How much does an AI audit cost?",
          answer:
            "The cost of an AI audit depends on the scope to be studied and your objectives. A free scoping call defines the right format and then gives you a clear, no-commitment quote, sized to the maturity and needs of your organization.",
        },
      ],
    },
  },

  "blog-implementations-ia": {
    fr: {
      centerLabel: "Automatisation IA",
      nodes: buildNodes([
        ["Cas d'usage", "Bien choisir"],
        ["Intégration", "Vos outils"],
        ["Données", "Pipeline fiable"],
        ["Workflow", "Bout en bout"],
        ["Sécurité", "Conformité"],
        ["Adoption", "Équipe embarquée"],
        ["Mesure", "Suivi des gains"],
        ["Support", "Pérennité"],
      ]),
      schemaAriaLabel:
        "Schéma : « Automatisation IA » au centre, entouré des 8 dimensions de l'implémentation IA.",
      faq: [
        {
          question: "Qu'est-ce qu'une implémentation IA réussie ?",
          answer:
            "Une implémentation IA réussie est une automatisation intégrée à vos outils existants, fiable sur la durée et réellement adoptée par les équipes. Ses gains sont mesurés concrètement, ce qui permet de prouver l'impact et de décider sereinement des étapes suivantes.",
        },
        {
          question: "Mes outils actuels sont-ils compatibles ?",
          answer:
            "Le plus souvent oui, vos outils actuels sont compatibles avec une implémentation IA. On s'intègre à votre stack existante, comme votre CRM, votre ERP ou votre suite bureautique, plutôt que de tout remplacer, ce qui limite les coûts et la conduite du changement.",
        },
        {
          question: "Comment garantir l'adoption par l'équipe ?",
          answer:
            "L'adoption par l'équipe se garantit par un cadrage précis des cas d'usage et une mise en place progressive. On y ajoute un accompagnement au changement et une mesure des gains, pour que chacun voie l'intérêt concret de l'outil dans son travail quotidien.",
        },
        {
          question: "Combien de temps prend une implémentation IA ?",
          answer:
            "Une implémentation IA prend de quelques jours à quelques semaines selon le périmètre visé. On privilégie des quick-wins livrés tôt pour créer de la valeur rapidement, avant d'industrialiser progressivement les workflows une fois leur intérêt prouvé sur le terrain.",
        },
        {
          question: "Faut-il remplacer mes outils existants ?",
          answer:
            "Non, il n'est pas nécessaire de remplacer vos outils existants pour déployer l'IA. On s'intègre d'abord à votre stack actuelle, et un outil n'est remplacé que si le gain le justifie clairement, jamais par principe ni par effet de mode.",
        },
      ],
    },
    en: {
      centerLabel: "AI automation",
      nodes: buildNodes([
        ["Use cases", "Right picks"],
        ["Integration", "Your tools"],
        ["Data", "Reliable pipeline"],
        ["Workflow", "End to end"],
        ["Security", "Compliance"],
        ["Adoption", "Team on board"],
        ["Measurement", "Track gains"],
        ["Support", "Longevity"],
      ]),
      schemaAriaLabel:
        "Diagram: “AI automation” at the center, surrounded by the 8 dimensions of AI implementation.",
      faq: [
        {
          question: "What is a successful AI implementation?",
          answer:
            "A successful AI implementation is an automation integrated into your existing tools, reliable over time and genuinely adopted by teams. Its gains are measured concretely, which proves the impact and makes it easy to decide on the next steps with confidence.",
        },
        {
          question: "Are my current tools compatible?",
          answer:
            "Usually yes, your current tools are compatible with an AI implementation. We integrate with your existing stack, such as your CRM, ERP or office suite, rather than replacing everything, which keeps costs and change management to a minimum.",
        },
        {
          question: "How do you ensure team adoption?",
          answer:
            "Team adoption is ensured by carefully scoping the use cases and rolling them out gradually. We add change-management support and measured gains, so everyone can see the concrete value of the tool in their day-to-day work.",
        },
        {
          question: "How long does an AI implementation take?",
          answer:
            "An AI implementation takes from a few days to a few weeks depending on the targeted scope. We favor quick wins delivered early to create value fast, then gradually industrialize the workflows once their value has been proven in the field.",
        },
        {
          question: "Do I have to replace my existing tools?",
          answer:
            "No, you do not have to replace your existing tools to deploy AI. We first integrate with your current stack, and a tool is replaced only when the gain clearly justifies it, never on principle or to follow a trend.",
        },
      ],
    },
  },

  "blog-sites-web-augmentes": {
    fr: {
      centerLabel: "Sites web & SaaS",
      nodes: buildNodes([
        ["SEO", "Visibilité Google"],
        ["AEO / GEO", "Cité par les IA"],
        ["Performance", "Web Vitals"],
        ["Contenu IA", "À l'échelle"],
        ["Conversion", "Plus de leads"],
        ["Accessibilité", "Pour tous"],
        ["Analytics", "Pilotage"],
        ["Maintenance", "Site vivant"],
      ]),
      schemaAriaLabel:
        "Schéma : « Site augmenté » au centre, entouré des 8 dimensions d'un site web augmenté par l'IA.",
      faq: [
        {
          question: "Qu'est-ce qu'un site web « augmenté par l'IA » ?",
          answer:
            "Un site web augmenté par l'IA est pensé pour être trouvé par Google (SEO) et cité par les IA (AEO/GEO). Il est rapide au sens des Web Vitals, alimenté par du contenu produit à l'échelle et optimisé pour transformer ses visiteurs en leads.",
        },
        {
          question: "Quelle différence entre SEO et AEO/GEO ?",
          answer:
            "Le SEO vise le classement de votre site dans les résultats Google, tandis que l'AEO/GEO vise à le faire citer dans les réponses des IA comme AI Overviews, ChatGPT ou Claude. Les deux approches sont complémentaires et se renforcent mutuellement.",
        },
        {
          question: "Faut-il refaire tout mon site ?",
          answer:
            "Non, il n'est pas nécessaire de refaire tout votre site dans la plupart des cas. Quand c'est possible, on augmente l'existant en travaillant la structure, le contenu, les données structurées et la performance, plutôt que de repartir d'une page blanche.",
        },
        {
          question: "Combien de temps pour voir des résultats SEO/AEO ?",
          answer:
            "Les gains techniques comme la vitesse et les données structurées sont immédiats après la mise en place. La visibilité SEO/AEO, elle, se construit sur quelques semaines à quelques mois selon la concurrence de votre marché et la fréquence de publication.",
        },
        {
          question: "L'IA peut-elle produire le contenu à ma place ?",
          answer:
            "Oui, l'IA peut produire votre contenu à l'échelle, mais toujours avec une relecture humaine. Chaque texte est généré puis vérifié pour rester exact, réellement utile à vos lecteurs et aligné sur le ton et le positionnement de votre marque.",
        },
      ],
    },
    en: {
      centerLabel: "Websites & SaaS",
      nodes: buildNodes([
        ["SEO", "Google visibility"],
        ["AEO / GEO", "Cited by AIs"],
        ["Performance", "Web Vitals"],
        ["AI content", "At scale"],
        ["Conversion", "More leads"],
        ["Accessibility", "For everyone"],
        ["Analytics", "Steering"],
        ["Maintenance", "Living site"],
      ]),
      schemaAriaLabel:
        "Diagram: “Augmented site” at the center, surrounded by the 8 dimensions of an AI-augmented website.",
      faq: [
        {
          question: "What is an “AI-augmented” website?",
          answer:
            "An AI-augmented website is built to be found by Google (SEO) and cited by AIs (AEO/GEO). It is fast in terms of Web Vitals, fed by content produced at scale, and optimized to turn its visitors into qualified leads.",
        },
        {
          question: "What's the difference between SEO and AEO/GEO?",
          answer:
            "SEO targets your site's ranking in Google's search results, while AEO/GEO targets getting it cited in AI answers such as AI Overviews, ChatGPT or Claude. The two approaches are complementary and reinforce each other.",
        },
        {
          question: "Do I need to rebuild my whole site?",
          answer:
            "No, in most cases you do not need to rebuild your whole site. When possible, we augment what already exists by improving the structure, content, structured data and performance, rather than starting again from a blank page.",
        },
        {
          question: "How long before SEO/AEO results show?",
          answer:
            "Technical gains such as speed and structured data are immediate once they are in place. SEO/AEO visibility, however, builds over a few weeks to a few months depending on your market's competition and how often you publish.",
        },
        {
          question: "Can AI produce the content for me?",
          answer:
            "Yes, AI can produce your content at scale, but always with human review. Each piece is generated and then checked to stay accurate, genuinely useful to your readers, and aligned with your brand's tone and positioning.",
        },
      ],
    },
  },
};

const GENERIC: Record<Locale, CategoryHubContent> = {
  fr: {
    centerLabel: "Thématique",
    nodes: buildNodes([
      ["Méthode", "Cadre éprouvé"],
      ["Cas d'usage", "Concrets"],
      ["Outils", "Sélection"],
      ["Résultats", "Mesurés"],
      ["ROI", "Chiffré"],
      ["Sécurité", "Maîtrisée"],
      ["Ressources", "Complètes"],
      ["Support", "Dédié"],
    ]),
    schemaAriaLabel:
      "Schéma : la thématique au centre, entourée de ses 8 dimensions (méthode, cas d'usage, outils, résultats…).",
    faq: [
      {
        question: "Que trouve-t-on dans cette catégorie ?",
        answer:
          "Cette catégorie rassemble des articles concrets sur l'IA appliquée à votre métier. Vous y trouvez de la méthodologie, des cas d'usage et des retours de terrain, pensés pour passer rapidement de la lecture à l'action plutôt que de rester dans la théorie.",
      },
      {
        question: "Les contenus sont-ils mis à jour ?",
        answer:
          "Oui, les contenus de cette catégorie sont mis à jour régulièrement. Les articles existants sont revus pour rester exacts et alignés sur les meilleures pratiques IA du moment, car les outils et les usages évoluent vite dans ce domaine.",
      },
    ],
  },
  en: {
    centerLabel: "Topic",
    nodes: buildNodes([
      ["Method", "Proven framework"],
      ["Use cases", "Concrete"],
      ["Tools", "Selection"],
      ["Results", "Measured"],
      ["ROI", "Quantified"],
      ["Security", "Controlled"],
      ["Resources", "Complete"],
      ["Support", "Dedicated"],
    ]),
    schemaAriaLabel:
      "Diagram: the topic at the center, surrounded by its 8 dimensions (method, use cases, tools, results…).",
    faq: [
      {
        question: "What's in this category?",
        answer:
          "This category gathers concrete articles about AI applied to your work. You will find methodology, use cases and field feedback, designed to help you move quickly from reading to action rather than staying in the theory.",
      },
      {
        question: "Is the content kept up to date?",
        answer:
          "Yes, the content in this category is kept up to date. Existing articles are reviewed regularly to stay accurate and aligned with current AI best practices, since tools and usage evolve quickly in this field.",
      },
    ],
  },
};

/** Contenu du hub pour un slug donné (fallback générique si hors catalogue). */
export function getCategoryHubContent(slug: string, locale: Locale): CategoryHubContent {
  return CATALOG[slug]?.[locale] ?? GENERIC[locale];
}

/**
 * CTA de conversion ADAPTÉ à l'activité de chaque catégorie (vers la page service
 * correspondante) — au lieu d'un « Voir nos formations » générique sur les 5.
 */
const CATEGORY_CTA: Record<
  string,
  { readonly href: string; readonly labelFr: string; readonly labelEn: string }
> = {
  "blog-formations-ia": {
    href: "/formations",
    labelFr: "Voir nos formations IA",
    labelEn: "See our AI trainings",
  },
  "blog-coaching-1-to-1": {
    href: "/un-a-un",
    labelFr: "Découvrir le coaching 1-to-1",
    labelEn: "Discover 1-to-1 coaching",
  },
  "blog-audits-ia": {
    href: "/audit",
    labelFr: "Demander un audit IA",
    labelEn: "Request an AI audit",
  },
  "blog-implementations-ia": {
    href: "/implementation",
    labelFr: "Voir l'implémentation IA",
    labelEn: "See AI implementation",
  },
  "blog-sites-web-augmentes": {
    href: "/sites-web-augmentes",
    labelFr: "Créer un site augmenté",
    labelEn: "Build an augmented site",
  },
};

export function getCategoryCta(slug: string, locale: Locale): { href: string; label: string } {
  const c = CATEGORY_CTA[slug];
  if (!c) {
    return {
      // `/appel` (funnel unifié 2026-06-26). `/reserver` est supprimée et ne
      // survit qu'en 301 edge pour les liens entrants — jamais pour un lien interne.
      href: "/appel",
      label: locale === "fr" ? "Réserver un appel" : "Book a call",
    };
  }
  return { href: c.href, label: locale === "fr" ? c.labelFr : c.labelEn };
}

export interface BlogHubHero {
  readonly centerLabel: string;
  readonly nodes: ReadonlyArray<HeroSchemaNode>;
  readonly schemaAriaLabel: string;
}

/**
 * Schéma orbital du hub /blog/categorie — 8 satellites = les 5 catégories +
 * 3 fils transverses. Centre « Blog IA ».
 */
export function getBlogHubHero(locale: Locale): BlogHubHero {
  if (locale === "fr") {
    return {
      centerLabel: "Blog IA",
      nodes: buildNodes([
        ["Formations IA", "Monter en compétences"],
        ["Coaching 1-to-1", "Accompagnement"],
        ["Audits IA", "Opportunités"],
        ["Implémentation", "Automatisation"],
        ["Sites web", "SEO & AEO"],
        ["Quick-wins", "Gains rapides"],
        ["ROI", "Impact chiffré"],
        ["Méthode", "Cadre éprouvé"],
      ]),
      schemaAriaLabel:
        "Schéma : « Blog IA » au centre, entouré des 5 thématiques et 3 fils transverses du blog.",
    };
  }
  return {
    centerLabel: "AI blog",
    nodes: buildNodes([
      ["AI training", "Upskilling"],
      ["1-to-1 coaching", "Guidance"],
      ["AI audits", "Opportunities"],
      ["Implementation", "Automation"],
      ["Websites", "SEO & AEO"],
      ["Quick wins", "Fast gains"],
      ["ROI", "Measured impact"],
      ["Method", "Proven framework"],
    ]),
    schemaAriaLabel:
      "Diagram: “AI blog” at the center, surrounded by the 5 topics and 3 cross-cutting threads of the blog.",
  };
}

/** FAQ du hub /blog/categorie (orientée organisation des thématiques). */
export function getBlogHubFaq(locale: Locale): ReadonlyArray<CategoryFaqItem> {
  if (locale === "fr") {
    return [
      {
        question: "Comment le blog Axion-IA est-il organisé ?",
        answer:
          "Le blog Axion-IA est organisé en 5 thématiques : Formations IA, Coaching 1-to-1, Audits IA, Implémentation & automatisation, et Sites web augmentés. Chaque thématique regroupe de la méthodologie et des cas d'usage concrets issus de missions réelles.",
      },
      {
        question: "Par où commencer si je débute avec l'IA ?",
        answer:
          "Si vous débutez avec l'IA, commencez par la thématique « Formations IA » pour acquérir les fondamentaux. Enchaînez ensuite avec « Audits IA » pour identifier, dans votre propre activité, les opportunités à plus fort retour sur investissement.",
      },
      {
        question: "Les articles sont-ils mis à jour ?",
        answer:
          "Oui, les articles du blog Axion-IA sont mis à jour régulièrement. Les contenus existants sont revus pour rester exacts et alignés sur les meilleures pratiques IA du moment, l'IA évoluant trop vite pour se contenter de textes figés.",
      },
      {
        question: "À qui s'adresse le blog Axion-IA ?",
        answer:
          "Le blog Axion-IA s'adresse aux dirigeants, équipes et indépendants de TPE et PME qui cherchent des usages concrets de l'IA, sans jargon. Chaque thématique part de cas réels testés en mission, pour offrir des repères directement applicables à votre activité.",
      },
      {
        question: "Le blog Axion-IA est-il gratuit ?",
        answer:
          "Oui, le blog Axion-IA est entièrement gratuit : tous les articles sont en accès libre, sans inscription. Vous pouvez ensuite passer à l'action quand vous le souhaitez, via un audit, une formation ou un coaching individuel.",
      },
    ];
  }
  return [
    {
      question: "How is the Axion-IA blog organized?",
      answer:
        "The Axion-IA blog is organized into 5 topics: AI training, 1-to-1 coaching, AI audits, Implementation & automation, and AI-augmented websites. Each topic gathers methodology and concrete use cases drawn from real client engagements.",
    },
    {
      question: "Where should I start if I'm new to AI?",
      answer:
        "If you're new to AI, start with the “AI training” topic to build the fundamentals. Then move on to “AI audits” to spot, within your own business, the opportunities that offer the highest return on investment.",
    },
    {
      question: "Are the articles kept up to date?",
      answer:
        "Yes, the Axion-IA blog articles are kept up to date. Existing content is reviewed regularly to stay accurate and aligned with current AI best practices, since AI evolves too fast to rely on fixed, never-updated articles.",
    },
    {
      question: "Who is the Axion-IA blog for?",
      answer:
        "The Axion-IA blog is for leaders, teams and freelancers in small and mid-sized companies who want concrete AI usage, with no jargon. Each topic starts from real, field-tested cases, giving you guidance you can apply directly to your business.",
    },
    {
      question: "Is the Axion-IA blog free?",
      answer:
        "Yes, the Axion-IA blog is completely free: every article is freely accessible, with no signup required. You can then move to action whenever you want, through an audit, a training program or individual coaching.",
    },
  ];
}

/** FAQ de l'accueil /blog (orientée ligne éditoriale & confiance). */
export function getBlogHomeFaq(locale: Locale): ReadonlyArray<CategoryFaqItem> {
  if (locale === "fr") {
    return [
      {
        question: "Qui écrit les articles du blog Axion-IA ?",
        answer:
          "Les articles du blog Axion-IA sont produits et relus par l'équipe Axion-IA, dont Manon et Williams, à partir de missions réelles. La méthodologie partagée est testée sur le terrain, plutôt que tirée d'une théorie générique éloignée du quotidien des entreprises.",
      },
      {
        question: "À quelle fréquence publiez-vous ?",
        answer:
          "Nous publions régulièrement de nouveaux articles sur le blog Axion-IA. Nous mettons aussi à jour les contenus existants pour qu'ils restent exacts et alignés sur les meilleures pratiques IA du moment, l'objectif étant la justesse autant que la fraîcheur.",
      },
      {
        question: "Comment passer de la lecture à l'action ?",
        answer:
          "Pour passer de la lecture à l'action, chaque thématique du blog mène vers un format concret. Vous pouvez choisir un audit IA pour cadrer les opportunités, une formation pour monter en compétences, ou un coaching individuel pour avancer sur vos propres cas.",
      },
    ];
  }
  return [
    {
      question: "Who writes the Axion-IA blog?",
      answer:
        "The Axion-IA blog is written and reviewed by the Axion-IA team, including Manon and Williams, based on real client engagements. The methodology shared is field-tested rather than drawn from generic theory disconnected from everyday business reality.",
    },
    {
      question: "How often do you publish?",
      answer:
        "We publish new articles on the Axion-IA blog regularly. We also update existing content so it stays accurate and aligned with current AI best practices, because we care as much about correctness as about freshness.",
    },
    {
      question: "How do I move from reading to action?",
      answer:
        "To move from reading to action, each blog topic leads to a concrete format. You can choose an AI audit to frame your opportunities, a training program to upskill your team, or 1-to-1 coaching to progress on your own real cases.",
    },
  ];
}
