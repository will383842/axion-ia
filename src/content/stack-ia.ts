// Content pack — page /stack-ia (FR) · /ai-stack (EN).
// La doctrine AxionIA en 2026 : 11 outils retenus parmi 2000+, organisés par
// fonction métier. Choix assumés, pas catalogue neutre. Aucun partenariat
// commercial avec les éditeurs cités. Source : usage terrain cabinet AxionIA.
//
// Will, 2026-05-07 : page créée pour répondre à la question "quelles IA sont
// vraiment utilisées au quotidien par les entreprises". Frame = arsenal
// AxionIA, pas catalogue.

/** Accent visuel — aligné sur la palette éditoriale (interventions). */
export type StackAccent = "terracotta" | "primary" | "sage" | "mocha";

export type StackCategoryId = "think" | "produce" | "capture" | "build" | "orchestrate";

export interface StackCategory {
  id: StackCategoryId;
  accent: StackAccent;
  /** Tone de la Section qui la contient (alterné pour rythme visuel). */
  tone: "paper" | "sand" | "halo-warm" | "halo-cool" | "canvas";
  numberLabel: string;
  fr: { eyebrow: string; title: string; titleEm: string; description: string };
  en: { eyebrow: string; title: string; titleEm: string; description: string };
}

export interface StackTool {
  id: string;
  /** Nom commercial. */
  name: string;
  /** Éditeur (Anthropic, OpenAI, Microsoft…). */
  vendor: string;
  /** Site officiel — pour le rel="nofollow noreferrer" external link. */
  url: string;
  /** Monogramme 1-2 caractères affiché dans la tile (ex "C", "GP", "n8"). */
  monogram: string;
  category: StackCategoryId;
  /** Maturité d'adoption : standard / montant / niche. */
  maturity: "standard" | "rising" | "niche";
  fr: ToolCopy;
  en: ToolCopy;
}

interface ToolCopy {
  /** Pitch en 1 phrase. */
  tagline: string;
  /** Comment AxionIA s'en sert concrètement (1 paragraphe ~3 phrases). */
  useCase: string;
  /** Quand on le sort (3-4 bullets). */
  whenToUse: ReadonlyArray<string>;
  /** Quand on l'évite (1-2 bullets, courts). */
  whenToAvoid: ReadonlyArray<string>;
  /** Combo gagnant — phrase courte. */
  combo: string;
}

// ============================================================================
// 5 catégories par fonction métier — ordre = parcours de la valeur :
// penser → produire → capter → construire → orchestrer.
// ============================================================================

export const STACK_CATEGORIES: ReadonlyArray<StackCategory> = [
  {
    id: "think",
    accent: "terracotta",
    tone: "paper",
    numberLabel: "01",
    fr: {
      eyebrow: "01 · Penser & raisonner",
      title: "Le moteur",
      titleEm: "qui réfléchit pour vous",
      description:
        "Une IA-pivot qu'on confie aux tâches qui demandent de la nuance : analyse longue, conception, arbitrages, code orchestré. Pas un assistant — un coéquipier.",
    },
    en: {
      eyebrow: "01 · Think & reason",
      title: "The engine",
      titleEm: "that thinks with you",
      description:
        "A pivot AI for nuanced work: long-form analysis, design decisions, code orchestration. Not an assistant — a teammate.",
    },
  },
  {
    id: "produce",
    accent: "primary",
    tone: "halo-cool",
    numberLabel: "02",
    fr: {
      eyebrow: "02 · Produire au quotidien",
      title: "Les IA-réflexes",
      titleEm: "que vos équipes ouvrent en premier",
      description:
        "Les outils universels, déjà câblés à votre suite bureautique. Adoption immédiate, friction nulle. Le socle qui tourne tous les jours.",
    },
    en: {
      eyebrow: "02 · Produce day to day",
      title: "The reflex AIs",
      titleEm: "your teams open first",
      description:
        "Universal tools, already wired into your office suite. Instant adoption, zero friction. The bedrock that runs every day.",
    },
  },
  {
    id: "capture",
    accent: "sage",
    tone: "sand",
    numberLabel: "03",
    fr: {
      eyebrow: "03 · Capter le terrain",
      title: "Capturer la matière",
      titleEm: "avant qu'elle s'évapore",
      description:
        "Les outils qui ramassent ce que disent vos clients, ce que fait le marché, ce que produisent vos réunions — pour le transformer ensuite en livrable.",
    },
    en: {
      eyebrow: "03 · Capture the field",
      title: "Capture the matter",
      titleEm: "before it fades",
      description:
        "Tools that grab what your clients say, what the market does, what your meetings produce — so you can turn it into a deliverable later.",
    },
  },
  {
    id: "build",
    accent: "mocha",
    tone: "halo-warm",
    numberLabel: "04",
    fr: {
      eyebrow: "04 · Construire & livrer",
      title: "L'atelier",
      titleEm: "des ingénieurs IA-augmentés",
      description:
        "Les outils dev qu'on déploie chez nos clients tech-forward et qu'on utilise nous-mêmes pour livrer plus vite, plus sûr.",
    },
    en: {
      eyebrow: "04 · Build & ship",
      title: "The workshop",
      titleEm: "of AI-augmented engineers",
      description:
        "The dev tools we roll out at tech-forward clients — and use ourselves to ship faster, safer.",
    },
  },
  {
    id: "orchestrate",
    accent: "terracotta",
    tone: "canvas",
    numberLabel: "05",
    fr: {
      eyebrow: "05 · Orchestrer & visualiser",
      title: "Les liaisons",
      titleEm: "qui font tenir l'ensemble",
      description:
        "Câbler les IA à votre stack métier, embarquer une IA dans votre produit, donner une identité visuelle à vos contenus. Là où la valeur se compose.",
    },
    en: {
      eyebrow: "05 · Orchestrate & visualise",
      title: "The links",
      titleEm: "that hold it all together",
      description:
        "Wiring AI into your business stack, embedding AI in your product, giving your content a visual identity. Where value is composed.",
    },
  },
];

// ============================================================================
// 11 outils — choix assumés AxionIA. Aucun partenariat commercial avec ces
// éditeurs. Si un outil est retiré, c'est qu'il est sorti de notre usage
// terrain, pas qu'il est mauvais en soi.
// ============================================================================

export const STACK_TOOLS: ReadonlyArray<StackTool> = [
  // --- 01 · Penser & raisonner ---
  {
    id: "claude",
    name: "Claude",
    vendor: "Anthropic",
    url: "https://claude.com",
    monogram: "C",
    category: "think",
    maturity: "standard",
    fr: {
      tagline: "Le moteur de raisonnement le plus profond de notre stack.",
      useCase:
        "Notre IA-pivot. On lui confie tout ce qui demande de la nuance : analyse de documents complexes, structuration de rapports clients, conception d'agents, avis stratégique. 1 million de tokens de contexte = on lui donne un dossier client entier d'un coup, sans découper.",
      whenToUse: [
        "Documents longs (>50 pages) à synthétiser",
        "Code et architecture logicielle",
        "Réflexion stratégique nuancée",
        "Agents autonomes via Agent SDK",
      ],
      whenToAvoid: [
        "Recherche web temps réel — préférer Perplexity",
        "Interactions vocales en direct",
      ],
      combo: "Claude + Granola : du verbatim client à la note stratégique en deux prompts.",
    },
    en: {
      tagline: "The deepest reasoning engine in our stack.",
      useCase:
        "Our pivot AI. We hand it everything that needs nuance: long document analysis, client report structuring, agent design, strategic takes. 1M tokens of context = you can hand over a full client dossier in one shot, no chunking.",
      whenToUse: [
        "Long documents (>50 pages) to synthesise",
        "Code and software architecture",
        "Nuanced strategic reasoning",
        "Autonomous agents via Agent SDK",
      ],
      whenToAvoid: ["Live web research — Perplexity wins there", "Real-time voice interactions"],
      combo: "Claude + Granola: from client verbatim to strategic memo in two prompts.",
    },
  },

  // --- 02 · Produire au quotidien ---
  {
    id: "chatgpt",
    name: "ChatGPT",
    vendor: "OpenAI",
    url: "https://chatgpt.com",
    monogram: "GP",
    category: "produce",
    maturity: "standard",
    fr: {
      tagline: "L'IA-réflexe que vos collaborateurs ouvrent en premier.",
      useCase:
        "Le couteau suisse quotidien : reformulation, brainstorming, recherche d'idées, génération d'images via DALL-E. Adoption interne très facile car interface familière. C'est la première IA qu'on installe quand on déploie une équipe non technique.",
      whenToUse: [
        "Tâches courtes et variées",
        "Onboarding IA d'une équipe non technique",
        "Génération d'images intégrée (DALL-E)",
        "Voice mode pour brainstorming verbal",
      ],
      whenToAvoid: [
        "Documents très longs — Claude tient mieux le contexte",
        "Sorties critiques en production sans relecture humaine",
      ],
      combo: "ChatGPT pour le 1ᵉʳ jet, Claude pour la version finale qui passe en prod.",
    },
    en: {
      tagline: "The reflex AI your team opens first.",
      useCase:
        "The daily Swiss Army knife: rewording, brainstorming, idea search, image generation via DALL-E. Adoption is frictionless because the interface is familiar. It's the first AI we roll out when onboarding a non-technical team.",
      whenToUse: [
        "Short, varied tasks",
        "Onboarding a non-technical team to AI",
        "Built-in image generation (DALL-E)",
        "Voice mode for verbal brainstorming",
      ],
      whenToAvoid: [
        "Very long documents — Claude holds context better",
        "Production-critical outputs without human review",
      ],
      combo: "ChatGPT for the rough cut, Claude for the version that ships.",
    },
  },
  {
    id: "copilot-365",
    name: "Microsoft Copilot 365",
    vendor: "Microsoft",
    url: "https://www.microsoft.com/microsoft-365/copilot",
    monogram: "M",
    category: "produce",
    maturity: "standard",
    fr: {
      tagline: "L'IA déjà câblée à votre suite bureautique.",
      useCase:
        "Pour toute entreprise sur Microsoft 365 : Copilot dans Outlook, Word, Excel, Teams, PowerPoint. Friction d'adoption nulle car c'est dans les outils que vos équipes ouvrent déjà. Compromis assumé : moins puissant que Claude en raisonnement brut, imbattable sur l'intégration native.",
      whenToUse: [
        "Stack Microsoft 365 déjà déployée",
        "Résumés automatiques de réunions Teams",
        "Excel : analyse de données via prompts",
        "Rédaction d'emails Outlook contextualisés",
      ],
      whenToAvoid: [
        "Stack Google Workspace — basculer sur Gemini",
        "Tâches qui demandent du raisonnement profond",
      ],
      combo: "Copilot 365 capte la matière brute, Claude la transforme en livrable client.",
    },
    en: {
      tagline: "The AI already wired into your office suite.",
      useCase:
        "For any company on Microsoft 365: Copilot inside Outlook, Word, Excel, Teams, PowerPoint. Zero adoption friction because it lives where your team already works. Acknowledged trade-off: weaker raw reasoning than Claude, unbeatable native integration.",
      whenToUse: [
        "Microsoft 365 stack already in place",
        "Automatic Teams meeting summaries",
        "Excel: prompt-based data analysis",
        "Context-aware Outlook email drafting",
      ],
      whenToAvoid: ["Google Workspace stack — switch to Gemini", "Tasks that need deep reasoning"],
      combo: "Copilot 365 grabs raw matter, Claude turns it into a client deliverable.",
    },
  },

  // --- 03 · Capter le terrain ---
  {
    id: "granola",
    name: "Granola",
    vendor: "Granola AI",
    url: "https://www.granola.ai",
    monogram: "Gr",
    category: "capture",
    maturity: "rising",
    fr: {
      tagline: "L'enregistreur invisible qui transforme vos calls en compte-rendu structuré.",
      useCase:
        "Tourne en fond pendant Zoom, Meet ou Teams sans bot dans la réunion. Vous prenez 3 ou 4 notes manuelles, Granola fusionne avec la transcription IA et livre un CR (décisions, action items, citations) trente secondes après le call. Indispensable dès trois calls clients par semaine.",
      whenToUse: [
        "Calls clients à fort enjeu commercial",
        "Réunions internes longues",
        "Interviews terrain (audit, recherche utilisateur)",
      ],
      whenToAvoid: [
        "Conversations RGPD-sensibles sans consentement explicite",
        "Calls très courts (<15 min) où la friction de lancement n'en vaut pas la peine",
      ],
      combo: "Granola → Claude : du verbatim au plan de mission en deux minutes.",
    },
    en: {
      tagline: "The invisible recorder that turns your calls into structured minutes.",
      useCase:
        "Runs in the background during Zoom, Meet or Teams with no bot in the meeting. You jot 3-4 manual notes, Granola merges them with the AI transcript and ships structured minutes (decisions, action items, quotes) thirty seconds after the call. Essential past three client calls a week.",
      whenToUse: [
        "High-stakes client calls",
        "Long internal meetings",
        "Field interviews (audit, user research)",
      ],
      whenToAvoid: [
        "GDPR-sensitive conversations without explicit consent",
        "Very short calls (<15 min) where launch friction isn't worth it",
      ],
      combo: "Granola → Claude: from verbatim to mission plan in two minutes.",
    },
  },
  {
    id: "perplexity",
    name: "Perplexity",
    vendor: "Perplexity AI",
    url: "https://www.perplexity.ai",
    monogram: "Px",
    category: "capture",
    maturity: "standard",
    fr: {
      tagline: "Le remplaçant naturel de Google pour la recherche pro.",
      useCase:
        "Réponses sourcées, à jour, citables. Veille concurrentielle, analyse de marché, briefs commerciaux. Le mode Pro sert pour les requêtes profondes, les Spaces pour collaborer sur un sujet récurrent (un secteur, un compte client).",
      whenToUse: [
        "Veille concurrentielle hebdomadaire",
        "Préparation de RDV : « qui est cette boîte ? »",
        "Faits vérifiables avec sources citables",
      ],
      whenToAvoid: [
        "Raisonnement long sans recherche externe — Claude",
        "Génération créative pure",
      ],
      combo: "Perplexity sourçe les faits, Claude les transforme en mémo stratégique.",
    },
    en: {
      tagline: "The natural Google replacement for professional research.",
      useCase:
        "Sourced, up-to-date, citable answers. Competitive watch, market analysis, sales briefings. Pro mode for deep queries, Spaces to collaborate on a recurring topic (an industry, a key account).",
      whenToUse: [
        "Weekly competitive watch",
        "Sales prep: 'who is this company?'",
        "Verifiable facts with citable sources",
      ],
      whenToAvoid: ["Long reasoning without external search — Claude", "Pure creative generation"],
      combo: "Perplexity sources the facts, Claude turns them into a strategic memo.",
    },
  },

  // --- 04 · Construire & livrer ---
  {
    id: "cursor",
    name: "Cursor",
    vendor: "Anysphere",
    url: "https://cursor.com",
    monogram: "Cu",
    category: "build",
    maturity: "standard",
    fr: {
      tagline: "L'IDE IA qui a remplacé VS Code chez les équipes tech-forward.",
      useCase:
        "Fork de VS Code avec autocomplétion IA, chat contextuel, refactoring multi-fichiers. Adopté par les seniors qui veulent du contrôle plutôt que la complétion brute de GitHub Copilot. Productivité dev observée : 30 à 50 % de tâches répétitives en moins.",
      whenToUse: [
        "Équipes dev internes (5+ personnes)",
        "Refactoring de codebase mature",
        "Onboarding rapide sur un projet inconnu",
      ],
      whenToAvoid: [
        "Équipes purement no-code",
        "Investissement déjà important dans Copilot Enterprise",
      ],
      combo: "Cursor pour le code in-IDE, Claude Code pour les chantiers agentiques en CLI.",
    },
    en: {
      tagline: "The AI IDE that replaced VS Code at tech-forward teams.",
      useCase:
        "VS Code fork with AI autocomplete, contextual chat, multi-file refactoring. Adopted by senior engineers who want control rather than GitHub Copilot's raw completion. Observed dev productivity: 30-50% fewer repetitive tasks.",
      whenToUse: [
        "Internal dev teams (5+ people)",
        "Refactoring a mature codebase",
        "Fast onboarding on an unknown project",
      ],
      whenToAvoid: ["Pure no-code teams", "Heavy existing investment in Copilot Enterprise"],
      combo: "Cursor for in-IDE code, Claude Code for agentic CLI marathons.",
    },
  },
  {
    id: "claude-code",
    name: "Claude Code",
    vendor: "Anthropic",
    url: "https://claude.com/claude-code",
    monogram: "Cc",
    category: "build",
    maturity: "rising",
    fr: {
      tagline: "L'agent CLI qui fait le sale boulot dev en autonomie.",
      useCase:
        "CLI Anthropic qui pilote votre repo : il lit, écrit, teste, débugge, ouvre des PR. On l'utilise pour les tâches longues — audit sécurité, migration, gros chantier d'archi. Pas un autocomplete : un coéquipier autonome supervisé.",
      whenToUse: [
        "Migrations longues (framework, base de données)",
        "Audits sécurité ou dette technique",
        "Génération de tests et de documentation",
      ],
      whenToAvoid: [
        "Code critique sans review humaine systématique",
        "Tâches < 10 min — Cursor reste plus rapide",
      ],
      combo: "Cursor + Claude Code : l'un pour la micro-itération, l'autre pour les marathons.",
    },
    en: {
      tagline: "The CLI agent that handles the dev grunt work on its own.",
      useCase:
        "Anthropic CLI that drives your repo: it reads, writes, tests, debugs, opens PRs. We use it for long-running work — security audits, migrations, large architecture chantiers. Not autocomplete: a supervised autonomous teammate.",
      whenToUse: [
        "Long migrations (framework, database)",
        "Security or tech-debt audits",
        "Test and documentation generation",
      ],
      whenToAvoid: [
        "Mission-critical code without systematic human review",
        "Tasks < 10 min — Cursor is faster",
      ],
      combo: "Cursor + Claude Code: one for micro-iteration, the other for marathons.",
    },
  },
  {
    id: "v0",
    name: "v0",
    vendor: "Vercel",
    url: "https://v0.app",
    monogram: "v0",
    category: "build",
    maturity: "rising",
    fr: {
      tagline: "Du prompt au composant React déployable en 30 secondes.",
      useCase:
        "Prototypage UI radicalement rapide. On y dessine en langage naturel les pages, puis on copie le code React/Tailwind/shadcn dans le repo Next.js. Excellent pour les MVP, les landing pages, les pitches visuels devant un client.",
      whenToUse: [
        "MVP et prototypes rapides",
        "Landing pages éphémères ou A/B tests",
        "Maquettes interactives pour pitch client",
      ],
      whenToAvoid: [
        "Codebase complexe avec design system maison strict",
        "Production critique sans relecture",
      ],
      combo: "v0 prototype d'abord, Cursor finalise dans le repo.",
    },
    en: {
      tagline: "From prompt to deployable React component in 30 seconds.",
      useCase:
        "Radically fast UI prototyping. You sketch pages in natural language, then copy React/Tailwind/shadcn code into your Next.js repo. Excellent for MVPs, landing pages, visual pitches in front of a client.",
      whenToUse: [
        "MVPs and rapid prototypes",
        "Throwaway landing pages or A/B tests",
        "Interactive mockups for client pitches",
      ],
      whenToAvoid: [
        "Complex codebase with a strict in-house design system",
        "Production-critical without review",
      ],
      combo: "v0 prototypes, Cursor finalises in the repo.",
    },
  },

  // --- 05 · Orchestrer & visualiser ---
  {
    id: "n8n",
    name: "n8n",
    vendor: "n8n GmbH",
    url: "https://n8n.io",
    monogram: "n8",
    category: "orchestrate",
    maturity: "standard",
    fr: {
      tagline: "L'orchestrateur d'automatisations IA, auto-hébergeable.",
      useCase:
        "L'outil qu'on déploie chez nos clients pour câbler leurs IA à leur stack métier (CRM, mail, ERP, Slack, base interne). Auto-hébergeable = aucune fuite de données vers Make ou Zapier. Le standard 2026 chez les entreprises qui prennent leur souveraineté au sérieux.",
      whenToUse: [
        "Câbler une IA à un CRM ou un ERP",
        "Automatisations multi-étapes (capture → enrichissement → notification)",
        "Tout flux qui doit rester sur vos serveurs",
      ],
      whenToAvoid: [
        "Entreprise sans IT pour héberger — basculer sur Make ou Zapier",
        "Workflow ultra-simple (1-2 étapes)",
      ],
      combo: "n8n appelle Claude par API, la donnée enrichie revient dans le CRM.",
    },
    en: {
      tagline: "The AI automation orchestrator — self-hostable.",
      useCase:
        "The tool we deploy at clients to wire their AI into their business stack (CRM, mail, ERP, Slack, internal DB). Self-hostable = no data leaks to Make or Zapier. The 2026 standard for companies that take sovereignty seriously.",
      whenToUse: [
        "Wiring AI into a CRM or ERP",
        "Multi-step automations (capture → enrich → notify)",
        "Any flow that must stay on your servers",
      ],
      whenToAvoid: [
        "Company without IT to host — fall back on Make or Zapier",
        "Ultra-simple workflow (1-2 steps)",
      ],
      combo: "n8n calls Claude via API, enriched data flows back into the CRM.",
    },
  },
  {
    id: "vercel-ai-sdk",
    name: "Vercel AI SDK",
    vendor: "Vercel",
    url: "https://ai-sdk.dev",
    monogram: "AI",
    category: "orchestrate",
    maturity: "rising",
    fr: {
      tagline: "Le SDK qui transforme une app Next.js en produit IA.",
      useCase:
        "Quand un client veut son propre chatbot, agent ou copilote intégré dans son produit, on construit avec Vercel AI SDK : streaming, tool calls, RAG, multi-modèle (Claude / GPT / Gemini avec failover). Plus rapide à shipper qu'un wrapper LangChain custom.",
      whenToUse: [
        "Chatbot ou copilote dans une app Next.js",
        "Multi-modèle avec failover automatique",
        "Streaming de réponses dans une UI produit",
      ],
      whenToAvoid: [
        "Pas une app Next.js — préférer LangChain ou LlamaIndex",
        "Workflow batch — scripts directs plus simples",
      ],
      combo: "Vercel AI SDK + n8n : l'un pour le front, l'autre pour les jobs de fond.",
    },
    en: {
      tagline: "The SDK that turns a Next.js app into an AI product.",
      useCase:
        "When a client wants their own chatbot, agent or copilot embedded in their product, we build with Vercel AI SDK: streaming, tool calls, RAG, multi-model (Claude / GPT / Gemini with failover). Faster to ship than a custom LangChain wrapper.",
      whenToUse: [
        "Chatbot or copilot inside a Next.js app",
        "Multi-model with automatic failover",
        "Streaming responses in a product UI",
      ],
      whenToAvoid: [
        "Not a Next.js app — go LangChain or LlamaIndex",
        "Batch workflows — direct scripts are simpler",
      ],
      combo: "Vercel AI SDK + n8n: one for the front, the other for background jobs.",
    },
  },
  {
    id: "midjourney",
    name: "Midjourney",
    vendor: "Midjourney Inc.",
    url: "https://www.midjourney.com",
    monogram: "Mj",
    category: "orchestrate",
    maturity: "standard",
    fr: {
      tagline: "L'outil image que choisissent les marques qui se respectent.",
      useCase:
        "Pour tout besoin visuel premium : campagnes, presse, illustrations éditoriales, moodboards client. Qualité supérieure à DALL-E et Imagen sur le rendu artistique. Workflow Discord historique ou interface web V7 plus récente.",
      whenToUse: [
        "Visuels marketing à fort enjeu de marque",
        "Moodboards pour pitch ou kick-off client",
        "Illustrations éditoriales (blog, livre blanc, presse)",
      ],
      whenToAvoid: [
        "Génération in-app produit — préférer Flux ou DALL-E via API",
        "Photos de personnes réalistes — limites éthiques + risques juridiques",
      ],
      combo: "Midjourney pour le visuel, Claude pour le copywriting → carrousel social complet.",
    },
    en: {
      tagline: "The image tool chosen by brands that take themselves seriously.",
      useCase:
        "For premium visual work: campaigns, press, editorial illustrations, client moodboards. Superior artistic quality vs DALL-E and Imagen. Historical Discord workflow or newer V7 web interface.",
      whenToUse: [
        "High-stakes brand-grade marketing visuals",
        "Moodboards for client pitches or kick-offs",
        "Editorial illustrations (blog, whitepaper, press)",
      ],
      whenToAvoid: [
        "In-product image generation — prefer Flux or DALL-E via API",
        "Realistic photos of people — ethical limits + legal risk",
      ],
      combo: "Midjourney for the image, Claude for the copy → full social carousel.",
    },
  },
];

// ============================================================================
// FAQ AEO — questions vraies que les prospects se posent. Réponses tirées
// directement des positions assumées dans la copy. Optimisé pour citations
// dans Perplexity / ChatGPT / Google AI Overviews.
// ============================================================================

export interface StackFaqItem {
  id: string;
  fr: { question: string; answer: string };
  en: { question: string; answer: string };
}

export const STACK_FAQS: ReadonlyArray<StackFaqItem> = [
  {
    id: "why-eleven",
    fr: {
      question: "Pourquoi seulement 11 outils alors qu'il en existe des milliers ?",
      answer:
        "Parce que la valeur n'est pas dans le catalogue, elle est dans l'orchestration. 80 % des entreprises utilisent quotidiennement 2 ou 3 IA, pas 50. AxionIA déploie chez ses clients la stack la plus courte qui tient — 11 outils maximum, choisis pour leur complémentarité, leur maturité d'adoption en 2026, et leur capacité à se câbler entre eux.",
    },
    en: {
      question: "Why only 11 tools when there are thousands?",
      answer:
        "Because value lives in orchestration, not catalogues. 80% of companies use 2 or 3 AIs daily, not 50. AxionIA deploys the shortest stack that stands up — 11 tools max, picked for complementarity, 2026 adoption maturity, and how well they wire together.",
    },
  },
  {
    id: "no-partnership",
    fr: {
      question: "AxionIA est-il partenaire commercial des éditeurs cités ?",
      answer:
        "Non. Aucun des choix présentés sur cette page ne fait l'objet d'un partenariat, d'une commission, ou d'un programme d'affiliation. Les outils sont retenus uniquement sur la base de l'usage terrain quotidien du cabinet et des résultats observés chez nos clients.",
    },
    en: {
      question: "Is AxionIA a commercial partner of the vendors listed?",
      answer:
        "No. None of the choices on this page involve a partnership, commission, or affiliate programme. Tools are picked solely on the consultancy's daily field usage and the results observed at clients.",
    },
  },
  {
    id: "claude-vs-chatgpt",
    fr: {
      question: "Faut-il choisir entre Claude et ChatGPT ?",
      answer:
        "Non, on déploie les deux. ChatGPT pour la culture interne et la production quotidienne (interface familière, adoption massive). Claude pour les tâches qui demandent du raisonnement profond — analyse de documents longs, conception, code. Chez nos clients, les deux abonnements sont systématiquement présents dans la stack 2026.",
    },
    en: {
      question: "Do you have to choose between Claude and ChatGPT?",
      answer:
        "No, we deploy both. ChatGPT for internal culture and daily output (familiar interface, mass adoption). Claude for work that needs deep reasoning — long documents, design, code. At our clients, both subscriptions are systematically present in the 2026 stack.",
    },
  },
  {
    id: "granola-needed",
    fr: {
      question: "Granola est-il indispensable si on a déjà Claude ?",
      answer:
        "Oui, dès qu'on dépasse trois calls clients par semaine. Claude n'écoute pas vos réunions. Granola tourne en fond, transcrit, structure et livre le compte-rendu trente secondes après le call. La friction d'un call sans Granola — enregistrer, transcrire, copier-coller — fait perdre 20 minutes par réunion.",
    },
    en: {
      question: "Is Granola essential if you already have Claude?",
      answer:
        "Yes, past three client calls a week. Claude doesn't listen to your meetings. Granola runs in the background, transcribes, structures and ships the minutes thirty seconds after the call. Friction without it — record, transcribe, paste — costs 20 minutes per meeting.",
    },
  },
  {
    id: "update-frequency",
    fr: {
      question: "À quelle fréquence cette stack est-elle mise à jour ?",
      answer:
        "Tous les trimestres au minimum, et à chaque sortie majeure d'un éditeur cité. La stack reflète l'usage terrain réel : si un outil sort de notre quotidien, il sort de la page. Si un nouveau s'impose, il y entre — quitte à en faire descendre un autre. La promesse est la cohérence, pas l'exhaustivité.",
    },
    en: {
      question: "How often is this stack updated?",
      answer:
        "Quarterly at minimum, and on every major release from a listed vendor. The stack reflects actual field usage: if a tool drops out of our daily flow, it leaves the page. If a new one breaks through, it goes in — even if that means dropping another. The promise is coherence, not exhaustiveness.",
    },
  },
];
