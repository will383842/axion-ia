// Données détaillées pour les pages `/stack-ia/[tool]` — 1 fiche détail par
// outil de `STACK_TOOLS` (cf. `@/content/stack-ia`).
//
// Pourquoi un fichier séparé : `stack-ia.ts` reste compact (hub-friendly :
// tagline, useCase, whenToUse, whenToAvoid, combo). Les fiches détail
// ajoutent ~50 lignes/outil (pros, cons, useCases longs, pricing, hosting,
// mesh, axionVerdict). Garde la lecture du hub claire et permet d'étendre
// les détails sans alourdir la page index.
//
// Sprint S+4-B (2026-05-18) — audit P1-17 `_AUDIT/CONTENT-GEN-DEEP-AUDIT-
// 2026-05-18/20-TYPE-9-STACK-IA.md` : combler le gap « hub /stack-ia OK
// mais aucune page détail [tool] → AEO 0 sur queries `claude pricing axion`
// / `notre avis sur cursor`. Cible : +11 URLs indexées Product JSON-LD.

import { STACK_TOOLS, type StackTool } from "@/content/stack-ia";

/** Tier de pricing — affichage public minimaliste sans afficher de prix
 * (les prix éditeurs bougent trop souvent pour qu'on s'engage sur un
 * chiffre exact ici). On positionne le tier + on renvoie vers le site
 * officiel pour la grille à jour. */
export type StackPricingTier = "free" | "freemium" | "paid" | "enterprise";

/** Région d'hébergement principale — utile pour conformité RGPD côté client. */
export type StackHostingRegion = "US" | "EU" | "France" | "On-prem";

interface StackToolDetailCopy {
  /** Résumé long pour AnswerCard AEO (50-80 mots cible). */
  summary: string;
  /** 3 points forts — bullets courts. */
  pros: ReadonlyArray<string>;
  /** 3 limites assumées — bullets courts. */
  cons: ReadonlyArray<string>;
  /** 3 à 5 cas d'usage observés chez nos clients. Placeholder éditorial
   *  V1 — Will/Manon enrichiront en S+5 avec des verbatims clients réels. */
  useCases: ReadonlyArray<string>;
  /** 1 à 2 phrases — verdict opérationnel Axion-IA, ton assumé. */
  axionVerdict: string;
}

export interface StackToolDetail {
  /** Doit matcher un `id` de `STACK_TOOLS`. */
  id: string;
  /** Tier pricing. Affichage label, pas de montant. */
  pricingTier: StackPricingTier;
  /** Régions d'hébergement principales (peut être multi). */
  hostingRegions: ReadonlyArray<StackHostingRegion>;
  /** 2-3 outils comparables (par `id`) — pour mesh interne. Doivent matcher
   *  `STACK_TOOLS` également. */
  comparableSlugs: ReadonlyArray<string>;
  fr: StackToolDetailCopy;
  en: StackToolDetailCopy;
}

// ============================================================================
// 11 fiches détail — alignées 1:1 avec `STACK_TOOLS`. Order = hub.
// ============================================================================

export const STACK_TOOL_DETAILS: ReadonlyArray<StackToolDetail> = [
  // ---- 01 · Penser & raisonner ----
  {
    id: "claude",
    pricingTier: "freemium",
    hostingRegions: ["US", "EU"],
    comparableSlugs: ["chatgpt", "perplexity"],
    fr: {
      summary:
        "Claude est l'IA-pivot d'Axion-IA depuis 2024. Son moteur de raisonnement profond, sa fenêtre de contexte de 1 million de tokens et son ton naturel en font le coéquipier par défaut pour tout travail qui demande nuance, structure et fiabilité.",
      pros: [
        "Contexte 1M tokens — un dossier client entier d'un coup",
        "Raisonnement nuancé supérieur sur sujets complexes",
        "Excellente discipline de sécurité (refus assumés, pas d'hallucination de sources)",
      ],
      cons: [
        "Pas de recherche web temps réel native",
        "Pas de voice mode interactif comparable à ChatGPT",
        "API plus chère par token que GPT-4o-mini sur volume bas",
      ],
      useCases: [
        "Analyser un appel d'offres de 80 pages et produire la note d'arbitrage",
        "Structurer un audit IA en 4 livrables homogènes",
        "Concevoir et déboguer des agents autonomes via Agent SDK",
        "Réécrire un rapport client mal structuré sans perdre le sens",
      ],
      axionVerdict:
        "Notre choix par défaut quand le raisonnement compte plus que la vitesse. À déployer dès qu'une équipe manipule des documents longs ou des décisions à fort enjeu.",
    },
    en: {
      summary:
        "Claude has been Axion-IA's pivot AI since 2024. Its deep reasoning engine, 1M-token context window and natural tone make it the default teammate for any work that demands nuance, structure and reliability.",
      pros: [
        "1M-token context — a whole client dossier in one shot",
        "Superior nuanced reasoning on complex topics",
        "Strong safety discipline (assumed refusals, no source hallucination)",
      ],
      cons: [
        "No native real-time web search",
        "No voice mode comparable to ChatGPT",
        "API more expensive per token than GPT-4o-mini at low volume",
      ],
      useCases: [
        "Analyse an 80-page RFP and produce the decision memo",
        "Structure a 4-deliverable AI audit consistently",
        "Design and debug autonomous agents via Agent SDK",
        "Rewrite a poorly structured client report without losing meaning",
      ],
      axionVerdict:
        "Our default pick when reasoning matters more than speed. Deploy as soon as a team handles long documents or high-stakes decisions.",
    },
  },

  // ---- 02 · Produire au quotidien ----
  {
    id: "chatgpt",
    pricingTier: "freemium",
    hostingRegions: ["US", "EU"],
    comparableSlugs: ["claude", "copilot-365"],
    fr: {
      summary:
        "ChatGPT reste l'IA grand public la plus reconnue. Interface familière, plugins riches, voice mode performant et génération d'images intégrée via DALL-E : c'est l'outil que vos collaborateurs ouvrent en premier, et celui qu'on installe en priorité sur une équipe non technique.",
      pros: [
        "Adoption interne immédiate, courbe d'apprentissage nulle",
        "Voice mode et génération d'images intégrés (DALL-E)",
        "Plugins / Custom GPTs pour automatisations légères",
      ],
      cons: [
        "Tient moins bien les documents longs (>50 pages) que Claude",
        "Réponses parfois moins nuancées sur sujets sensibles",
        "Historique des incidents data privacy plus fourni",
      ],
      useCases: [
        "Reformuler un email Outlook ou un brief commercial en 30 s",
        "Brainstormer 10 angles d'article en mode voice pendant un trajet",
        "Générer une image DALL-E pour illustrer un livrable rapide",
        "Onboarder une équipe non technique sur l'usage IA quotidien",
      ],
      axionVerdict:
        "Indispensable pour la culture interne et la production quotidienne — mais on enchaîne presque toujours sur Claude pour la version qui passe en prod.",
    },
    en: {
      summary:
        "ChatGPT remains the most recognised consumer AI. Familiar interface, rich plugins, strong voice mode and built-in DALL-E image generation: it's the tool your teammates open first, and the one we install first on a non-technical team.",
      pros: [
        "Instant internal adoption, near-zero learning curve",
        "Voice mode and built-in image generation (DALL-E)",
        "Plugins / Custom GPTs for lightweight automations",
      ],
      cons: [
        "Holds long documents (>50 pages) less well than Claude",
        "Sometimes less nuanced on sensitive topics",
        "Heavier record of data privacy incidents",
      ],
      useCases: [
        "Reword an Outlook email or a sales brief in 30 s",
        "Brainstorm 10 article angles in voice mode during a commute",
        "Generate a DALL-E image to illustrate a quick deliverable",
        "Onboard a non-technical team on daily AI usage",
      ],
      axionVerdict:
        "Essential for internal culture and daily output — but we almost always chain with Claude for the version that ships.",
    },
  },
  {
    id: "copilot-365",
    pricingTier: "paid",
    hostingRegions: ["EU", "US"],
    comparableSlugs: ["chatgpt", "claude"],
    fr: {
      summary:
        "Microsoft Copilot 365 est l'IA déjà câblée à Outlook, Word, Excel, Teams et PowerPoint. Pour toute entreprise déjà sur la suite Microsoft, c'est le moyen le plus rapide d'introduire de l'IA dans les outils du quotidien — sans onboarding séparé.",
      pros: [
        "Friction d'adoption nulle dans une stack Microsoft 365",
        "Résumés Teams + assistance Excel/Word natives",
        "Hébergement européen disponible, conforme RGPD entreprise",
      ],
      cons: [
        "Moins puissant que Claude en raisonnement brut",
        "Coût par siège élevé (~30 €/mois HT) à grande échelle",
        "Inutile si l'organisation est sur Google Workspace",
      ],
      useCases: [
        "Résumé automatique d'une réunion Teams d'1 h",
        "Analyse de données Excel via prompts en langage naturel",
        "Rédaction d'emails Outlook contextualisés au thread",
        "Génération d'une trame PowerPoint depuis un brief Word",
      ],
      axionVerdict:
        "À déployer immédiatement si vous êtes déjà sur Microsoft 365 — la valeur vient de l'intégration native, pas du moteur IA. Sinon Gemini ou Claude couvrent mieux.",
    },
    en: {
      summary:
        "Microsoft Copilot 365 is the AI already wired into Outlook, Word, Excel, Teams and PowerPoint. For any company already on Microsoft 365, it's the fastest way to bring AI into daily tools — without a separate onboarding.",
      pros: [
        "Zero adoption friction in a Microsoft 365 stack",
        "Native Teams summaries and Excel/Word assistance",
        "European hosting available, GDPR-compliant for enterprise",
      ],
      cons: [
        "Weaker raw reasoning than Claude",
        "Steep per-seat cost (~€30/month) at scale",
        "Pointless if the org runs on Google Workspace",
      ],
      useCases: [
        "Auto-summary of a 1 h Teams meeting",
        "Excel data analysis via natural-language prompts",
        "Thread-aware Outlook email drafting",
        "Generate a PowerPoint deck from a Word brief",
      ],
      axionVerdict:
        "Deploy immediately if you're already on Microsoft 365 — the value lies in native integration, not the AI engine. Otherwise Gemini or Claude cover the gap better.",
    },
  },

  // ---- 03 · Capter le terrain ----
  {
    id: "granola",
    pricingTier: "paid",
    hostingRegions: ["US"],
    comparableSlugs: ["chatgpt", "claude"],
    fr: {
      summary:
        "Granola enregistre vos calls Zoom, Meet ou Teams en local, sans bot dans la réunion. Il fusionne vos notes manuelles à la transcription IA et livre un compte-rendu structuré (décisions, action items, citations) trente secondes après le call.",
      pros: [
        "Pas de bot dans la réunion (capture locale)",
        "Compte-rendu structuré 30 s après le call",
        "Intégrations Notion / Slack / Linear natives",
      ],
      cons: [
        "Hébergement US — vigilance RGPD pour calls sensibles",
        "Pas encore d'auto-host enterprise",
        "Friction lancement < 15 min de réunion",
      ],
      useCases: [
        "Capter un call commercial à fort enjeu sans prise de notes",
        "Documenter une interview audit terrain",
        "Récupérer les action items d'une réunion projet hebdo",
        "Préparer un mémo de suivi client immédiatement après le call",
      ],
      axionVerdict:
        "Indispensable dès trois calls clients par semaine. La friction d'un call sans Granola — enregistrer, transcrire, copier-coller — fait perdre 20 minutes par réunion.",
    },
    en: {
      summary:
        "Granola records your Zoom, Meet or Teams calls locally, without a bot in the meeting. It merges your manual notes with the AI transcript and ships structured minutes (decisions, action items, quotes) thirty seconds after the call.",
      pros: [
        "No bot in the meeting (local capture)",
        "Structured minutes 30 s after the call",
        "Native Notion / Slack / Linear integrations",
      ],
      cons: [
        "US hosting — caution for sensitive calls under GDPR",
        "No enterprise self-hosting yet",
        "Launch friction below 15 min meetings",
      ],
      useCases: [
        "Capture a high-stakes sales call without note-taking",
        "Document a field audit interview",
        "Recover action items from a weekly project meeting",
        "Prep a client follow-up memo immediately after the call",
      ],
      axionVerdict:
        "Essential past three client calls a week. Without it — record, transcribe, paste — you lose 20 minutes per meeting.",
    },
  },
  {
    id: "perplexity",
    pricingTier: "freemium",
    hostingRegions: ["US"],
    comparableSlugs: ["claude", "chatgpt"],
    fr: {
      summary:
        "Perplexity remplace Google pour la recherche pro : réponses sourcées, à jour, citables, adossées à des crawls transparents du web ouvert. Le mode Pro déclenche des recherches profondes multi-pages avec traces de raisonnement, et les Spaces permettent de capitaliser une veille récurrente (un secteur, un compte clé, un thème réglementaire) sur plusieurs mois sans perdre le contexte.",
      pros: [
        "Sources citables systématiques sur chaque réponse",
        "Recherche profonde Pro multi-pages avec traces",
        "Spaces persistent une veille longue durée par thème",
      ],
      cons: [
        "Moins doué que Claude ou GPT pour la création pure",
        "Quelques sources de basse qualité passent encore le filtre",
        "Hébergement US uniquement — vigilance sujets régulés",
      ],
      useCases: [
        "Veille concurrentielle hebdomadaire sur un secteur",
        "Préparation RDV : « qui est cette boîte, qui dirige, quel CA »",
        "Fact-checking d'un argumentaire commercial ou pricing",
        "Synthèse multi-sources d'un sujet réglementaire ou compliance",
        "Créer un Space pour monitorer un compte stratégique sur un trimestre",
      ],
      axionVerdict:
        "Le réflexe à installer pour toute fonction qui doit citer ses sources : commercial, conseil, comms, recherche. Claude prend la suite pour la mise en forme stratégique quand la synthèse doit partir en livrable client.",
    },
    en: {
      summary:
        "Perplexity replaces Google for professional research: sourced, up-to-date, citable answers backed by transparent crawls of the open web. Pro mode triggers multi-page deep searches with intermediate reasoning, and Spaces let you capitalise on recurring monitoring of an industry, a key account or a regulatory theme over months without losing context.",
      pros: [
        "Systematic citable sources on every answer",
        "Multi-page Pro deep search with reasoning traces",
        "Spaces persist long-running monitoring contexts",
      ],
      cons: [
        "Weaker than Claude or GPT for pure creative output",
        "Some low-quality sources still leak through the filter",
        "US-only hosting — caution for sensitive regulated topics",
      ],
      useCases: [
        "Weekly competitive watch on an industry vertical",
        "Sales prep: 'who runs this company, what is their revenue'",
        "Fact-check a sales pitch or pricing claim",
        "Multi-source synthesis on a regulatory or compliance topic",
        "Build a Space to monitor a strategic account over a quarter",
      ],
      axionVerdict:
        "The reflex to install for any function that must cite its sources: sales, consulting, comms, research. Claude then takes over for strategic shaping when the synthesis must ship to the client.",
    },
  },

  // ---- 04 · Construire & livrer ----
  {
    id: "cursor",
    pricingTier: "paid",
    hostingRegions: ["US"],
    comparableSlugs: ["claude-code", "v0"],
    fr: {
      summary:
        "Cursor est un fork de VS Code dopé à l'IA : autocomplétion contextuelle, chat avec la codebase entière, refactoring multi-fichiers. Adopté par les seniors qui veulent du contrôle plutôt que la complétion brute. Productivité observée : 30 à 50 % de tâches répétitives en moins.",
      pros: [
        "Chat contextuel sur la codebase entière",
        "Refactoring multi-fichiers fiable",
        "Tab-complete IA supérieure à GitHub Copilot",
      ],
      cons: [
        "Coût par siège plus élevé que Copilot",
        "Risque vendor lock-in si on délègue trop",
        "Pas open source",
      ],
      useCases: [
        "Refactoring d'une codebase mature (Next.js, Rails, Laravel)",
        "Onboarding rapide d'un dev sur un projet inconnu",
        "Génération de tests unitaires couvrants",
        "Documentation inline d'une lib custom",
      ],
      axionVerdict:
        "Le standard 2026 chez les équipes tech-forward. À pairer avec Claude Code pour les chantiers longue durée.",
    },
    en: {
      summary:
        "Cursor is a VS Code fork on AI steroids: contextual autocomplete grounded in your entire codebase, conversational chat with file references, and reliable multi-file refactoring. Adopted by senior engineers who want fine-grained control rather than the raw completion of GitHub Copilot. Observed productivity at our clients: 30-50 % fewer repetitive tasks per sprint.",
      pros: [
        "Contextual chat over the whole codebase, not just the current file",
        "Reliable multi-file refactoring with diff preview",
        "AI tab-complete consistently superior to GitHub Copilot",
      ],
      cons: [
        "Per-seat cost higher than GitHub Copilot at scale",
        "Vendor lock-in risk if engineers over-delegate to AI",
        "Not open source — fork stays proprietary",
      ],
      useCases: [
        "Refactor a mature codebase across frameworks (Next.js, Rails, Laravel)",
        "Fast onboarding of a senior developer on an unknown project",
        "Generate covering unit tests on a legacy module",
        "Inline documentation of a custom lib or internal API",
      ],
      axionVerdict:
        "The 2026 standard at tech-forward teams. Pair with Claude Code for the long-running work that exceeds a coffee break.",
    },
  },
  {
    id: "claude-code",
    pricingTier: "paid",
    hostingRegions: ["US"],
    comparableSlugs: ["cursor", "v0"],
    fr: {
      summary:
        "Claude Code est le CLI agentique d'Anthropic : il lit, écrit, teste, débugge et ouvre des PR sur votre repo en autonomie supervisée. On l'utilise pour les chantiers longs — audit sécurité, migration framework, refactoring d'archi — là où Cursor reste plus rapide pour la micro-itération.",
      pros: [
        "Agentique : exécute des chantiers de plusieurs heures",
        "S'intègre nativement aux hooks Git, CI/CD",
        "Skills + memory permettent du capital de connaissance par projet",
      ],
      cons: [
        "Code review humaine systématique indispensable",
        "Coût élevé sur sessions longues sans cache prompt",
        "Pas de GUI — uniquement CLI / éditeur",
      ],
      useCases: [
        "Migration d'un framework majeur (Next 14 → 16)",
        "Audit sécurité d'une codebase Node.js",
        "Génération massive de tests sur un module legacy",
        "Documentation auto d'un repo de 200 fichiers",
      ],
      axionVerdict:
        "L'arme lourde dev de notre stack. À réserver aux chantiers > 2 h ; Cursor reste plus efficace pour les micro-itérations en IDE.",
    },
    en: {
      summary:
        "Claude Code is Anthropic's agentic CLI: it reads, writes, tests, debugs and opens PRs on your repo under supervised autonomy. We use it for long-running work — security audits, framework migrations, architecture refactors — where Cursor stays faster for micro-iteration.",
      pros: [
        "Agentic: runs multi-hour chantiers",
        "Native integration with Git hooks and CI/CD",
        "Skills + memory build per-project knowledge capital",
      ],
      cons: [
        "Systematic human code review required",
        "Costly on long sessions without prompt caching",
        "No GUI — CLI / editor only",
      ],
      useCases: [
        "Migrate a major framework (Next 14 → 16)",
        "Security audit of a Node.js codebase",
        "Bulk test generation on a legacy module",
        "Auto-documentation of a 200-file repo",
      ],
      axionVerdict:
        "The heavy-duty dev tool in our stack. Reserve for chantiers > 2 h; Cursor stays sharper for in-IDE micro-iteration.",
    },
  },
  {
    id: "v0",
    pricingTier: "freemium",
    hostingRegions: ["US"],
    comparableSlugs: ["cursor", "claude-code"],
    fr: {
      summary:
        "v0 transforme un prompt en composant React/Tailwind/shadcn déployable en 30 secondes. Excellent pour les MVP, les landing pages éphémères et les maquettes interactives à présenter en pitch client. Le code généré est copiable directement dans un repo Next.js.",
      pros: [
        "Du prompt au composant React en 30 s",
        "Output Tailwind / shadcn idiomatique",
        "Deploy Vercel intégré pour pitch live",
      ],
      cons: [
        "Pas adapté à un design system maison strict",
        "Composants à harmoniser ensuite par un dev senior",
        "Vendor lock-in Vercel pour le deploy intégré",
      ],
      useCases: [
        "Prototyper une landing page A/B test en 1 h",
        "Maquette interactive pour pitch investor",
        "Génération de pages CRUD admin rapides",
        "Démonstration UI dans un workshop client",
      ],
      axionVerdict:
        "L'outil idéal pour fluidifier les premières heures d'un projet ou bluffer un client en pitch. Toujours repasser ensuite par Cursor pour intégrer proprement dans le repo.",
    },
    en: {
      summary:
        "v0 turns a natural-language prompt into a deployable React/Tailwind/shadcn component in 30 seconds. Excellent for MVPs, throwaway landing pages and interactive mockups for client pitches. Generated code can be copied directly into a Next.js repo, and the integrated Vercel deploy lets you share a live URL within seconds for live design feedback rounds.",
      pros: [
        "Prompt to working React component in 30 seconds flat",
        "Idiomatic Tailwind / shadcn output ready to drop in",
        "Built-in Vercel deploy for live pitch URLs",
      ],
      cons: [
        "Not suited to a strict in-house design system",
        "Generated components need senior dev harmonisation",
        "Vercel vendor lock-in for the built-in deploy step",
      ],
      useCases: [
        "Prototype an A/B landing page in a single hour",
        "Interactive mockup for an investor or client pitch",
        "Fast admin CRUD page generation for an MVP",
        "UI demo built live in a client workshop",
      ],
      axionVerdict:
        "The ideal tool for the first hours of a project or to wow a client in a pitch. Always finish in Cursor to integrate cleanly into the repo.",
    },
  },

  // ---- 05 · Orchestrer & visualiser ----
  {
    id: "n8n",
    pricingTier: "freemium",
    hostingRegions: ["EU", "On-prem"],
    comparableSlugs: ["vercel-ai-sdk", "claude-code"],
    fr: {
      summary:
        "n8n est l'orchestrateur d'automatisations IA auto-hébergeable de référence en 2026. On le déploie chez nos clients pour câbler leurs IA à leur stack métier (CRM, mail, ERP, Slack, base interne) sans fuite de données vers Make ou Zapier.",
      pros: [
        "Auto-hébergeable, souveraineté de la donnée garantie",
        "Bibliothèque de connecteurs riche (300+ apps)",
        "Workflows visuels lisibles par un PM non-dev",
      ],
      cons: [
        "Demande une équipe IT pour héberger en prod",
        "UI plus dense que Make ou Zapier",
        "Pas adapté aux workflows ultra-simples (1-2 étapes)",
      ],
      useCases: [
        "Enrichissement de leads CRM via Claude + Perplexity",
        "Pipeline RSS → triage IA → Slack équipe contenu",
        "Synchronisation bi-directionnelle ERP ↔ Notion",
        "Génération automatique de comptes-rendus depuis Granola",
      ],
      axionVerdict:
        "Notre standard pour câbler l'IA dans une stack métier. À éviter pour 1-2 étapes simples : un Zapier suffit. À adopter dès qu'il y a 5+ étapes ou des données sensibles.",
    },
    en: {
      summary:
        "n8n is the 2026 reference self-hostable AI automation orchestrator. We deploy it at clients to wire their AI into their business stack (CRM, mail, ERP, Slack, internal DB) without data leakage to Make or Zapier.",
      pros: [
        "Self-hostable, full data sovereignty",
        "Rich connector library (300+ apps)",
        "Visual workflows readable by a non-dev PM",
      ],
      cons: [
        "Requires an IT team to host in prod",
        "Denser UI than Make or Zapier",
        "Overkill for ultra-simple workflows (1-2 steps)",
      ],
      useCases: [
        "CRM lead enrichment via Claude + Perplexity",
        "RSS → AI triage → Slack content team pipeline",
        "Bi-directional ERP ↔ Notion sync",
        "Auto-generate minutes from Granola",
      ],
      axionVerdict:
        "Our standard for wiring AI into a business stack. Skip for 1-2 simple steps: Zapier suffices. Adopt as soon as you have 5+ steps or sensitive data.",
    },
  },
  {
    id: "vercel-ai-sdk",
    pricingTier: "free",
    hostingRegions: ["US", "EU"],
    comparableSlugs: ["n8n", "claude-code"],
    fr: {
      summary:
        "Le Vercel AI SDK est la couche TypeScript de référence pour embarquer un agent, un chatbot ou un copilote dans une app Next.js : streaming, tool calls, RAG, multi-modèle (Claude / GPT / Gemini avec failover automatique). Plus rapide à shipper qu'un wrapper LangChain custom.",
      pros: [
        "Streaming + tool calls multi-modèle natifs",
        "Failover automatique entre fournisseurs",
        "DX TypeScript idiomatique Next.js",
      ],
      cons: [
        "Optimal seulement sur stack Next.js",
        "Pas de UI prête, à coder",
        "Documentation parfois en retard sur les versions",
      ],
      useCases: [
        "Embarquer un copilote IA dans une app Next.js produit",
        "Failover Claude → GPT-4o si quota dépassé",
        "Streaming de réponses LLM dans un dashboard analytics",
        "Chatbot RAG sur une base de connaissance interne",
      ],
      axionVerdict:
        "Notre choix par défaut pour tout produit Next.js qui embarque de l'IA. Hors Next.js, LangChain ou LlamaIndex restent plus pertinents.",
    },
    en: {
      summary:
        "The Vercel AI SDK is the reference TypeScript layer for embedding an agent, chatbot or copilot in a Next.js app: streaming, tool calls, RAG, multi-model (Claude / GPT / Gemini with automatic failover). Faster to ship than a custom LangChain wrapper.",
      pros: [
        "Native multi-model streaming + tool calls",
        "Automatic failover between providers",
        "Idiomatic Next.js TypeScript DX",
      ],
      cons: [
        "Optimal only on a Next.js stack",
        "No prebuilt UI — you code it",
        "Docs sometimes lag behind versions",
      ],
      useCases: [
        "Embed an AI copilot in a Next.js product",
        "Failover Claude → GPT-4o if quota exceeded",
        "Stream LLM responses in an analytics dashboard",
        "RAG chatbot on an internal knowledge base",
      ],
      axionVerdict:
        "Our default pick for any Next.js product embedding AI. Outside Next.js, LangChain or LlamaIndex remain more relevant.",
    },
  },
  {
    id: "midjourney",
    pricingTier: "paid",
    hostingRegions: ["US"],
    comparableSlugs: ["chatgpt", "v0"],
    fr: {
      summary:
        "Midjourney reste l'outil image préféré des marques qui se respectent en 2026. Qualité artistique supérieure à DALL-E et Imagen, contrôle stylistique fin via prompts et paramètres, workflow Discord historique ou interface web V7 plus récente.",
      pros: [
        "Qualité artistique supérieure aux concurrents",
        "Contrôle stylistique fin (--style raw, sref, cref)",
        "Communauté éditoriale active, références accessibles",
      ],
      cons: [
        "Pas d'API publique stable (vs DALL-E, Flux)",
        "Workflow Discord ou web encore peu adapté au batch",
        "Limites éthiques fortes sur photos réalistes de personnes",
      ],
      useCases: [
        "Visuels presse pour une campagne premium",
        "Moodboard kick-off projet client",
        "Illustration éditoriale d'un livre blanc",
        "Hero image d'une landing page de marque",
      ],
      axionVerdict:
        "L'arme visuelle quand l'enjeu de marque est élevé. Pour la génération in-app produit, basculer sur Flux ou DALL-E via API.",
    },
    en: {
      summary:
        "Midjourney remains the image tool of choice for brands that take themselves seriously in 2026. Superior artistic quality compared to DALL-E and Imagen, fine stylistic control via prompts and structured parameters, plus the historical Discord workflow or the newer V7 web interface for teams who never opened Discord and never will.",
      pros: [
        "Superior artistic quality compared to its direct competitors",
        "Fine stylistic control (--style raw, sref, cref parameters)",
        "Active editorial community with accessible reference packs",
      ],
      cons: [
        "No stable public API (unlike DALL-E or Flux)",
        "Discord or web workflow still poorly suited to batch generation",
        "Strong ethical limits on realistic photos of identifiable people",
      ],
      useCases: [
        "Press visuals for a premium brand campaign",
        "Client project kick-off moodboard or brand exploration",
        "Editorial illustration of a whitepaper or long-form article",
        "Brand landing-page hero image for a product launch",
      ],
      axionVerdict:
        "The visual weapon to reach for when brand stakes are high. For in-product image generation at scale, switch to Flux or DALL-E via API.",
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers — lookup + dérivation slug list pour generateStaticParams.
// ---------------------------------------------------------------------------

/** Retourne toutes les fiches détail dans l'ordre canonique du hub. */
export function getAllStackToolDetails(): ReadonlyArray<StackToolDetail> {
  return STACK_TOOL_DETAILS;
}

/** Liste plate des slugs (= `id` de StackTool) — pour `generateStaticParams`. */
export function getAllStackToolSlugs(): ReadonlyArray<string> {
  return STACK_TOOL_DETAILS.map((d) => d.id);
}

/** Cherche un outil + sa fiche détail par slug. `undefined` si introuvable. */
export function getStackToolByDetailSlug(
  slug: string,
): { tool: StackTool; detail: StackToolDetail } | undefined {
  const detail = STACK_TOOL_DETAILS.find((d) => d.id === slug);
  if (!detail) return undefined;
  const tool = STACK_TOOLS.find((t) => t.id === slug);
  if (!tool) return undefined;
  return { tool, detail };
}

/** Pour mesh : retourne les fiches comparables résolues (filtre les ids
 *  introuvables). */
export function getComparableStackTools(
  detail: StackToolDetail,
): ReadonlyArray<{ tool: StackTool; detail: StackToolDetail }> {
  const out: Array<{ tool: StackTool; detail: StackToolDetail }> = [];
  for (const id of detail.comparableSlugs) {
    const resolved = getStackToolByDetailSlug(id);
    if (resolved) out.push(resolved);
  }
  return out;
}
