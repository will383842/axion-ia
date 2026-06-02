// Content pack — pages-intention détail de la verticale Sites web & SaaS IA.
// Landings sélectives (anti-doorway) sous /sites-web-augmentes/* rendues par
// SitesWebLandingPage (ProductPageTemplate + hero DetailHeroSchema + SubPageExtras).
//
// Garde-fous : 0 prix hardcodé (projets web = forfait/sur devis, dérivé de
// pricing.ts CODAGE_TIERS si besoin JSON-LD ; pas d'affichage de montant),
// 0 financement, EN = miroir concis (locale 301→FR). Axe siteProjectType aligné
// sur les keywords g3h (augmentation / native / transverse).

export type SitesWebSlug = "chatbot-rag" | "recherche-semantique";

export type SitesWebProjectType = "augmentation" | "native" | "transverse";

/** Copy compatible avec le slot `copy` de ProductPageTemplate (sous-ensemble utilisé). */
export interface SitesWebCopy {
  eyebrow: string;
  title: string;
  titleEm?: string;
  titleTail?: string;
  answer: string;
  ctaPrimary: string;
  ctaSecondary: string;
  benefitsTitle: string;
  benefits: ReadonlyArray<{ title: string; description: string }>;
  processTitle: string;
  processSteps: ReadonlyArray<{ title: string; description: string }>;
  metricsTitle: string;
  metrics: ReadonlyArray<{ number: string; suffix: string; label: string }>;
  faqTitle: string;
  faqs: ReadonlyArray<{ id: string; question: string; answer: string }>;
  ctaBlockTitle: string;
  ctaBlockDescription: string;
  why?: {
    title: string;
    titleEm?: string;
    intro?: string;
    points: ReadonlyArray<{ title: string; description: string }>;
  };
}

export interface SitesWebContent {
  slug: SitesWebSlug;
  projectType: SitesWebProjectType;
  pathFr: string;
  pathEn: string;
  /** Accent ProductPageTemplate. */
  accent: "primary" | "purple" | "orange" | "green";
  /** Variante DetailHeroSchema (3 blocs). */
  hero: {
    eyebrowFr: string;
    eyebrowEn: string;
    titleFr: string;
    titleEn: string;
    /** Clés d'icône résolues côté composant (Lucide). */
    blocks: ReadonlyArray<{
      icon:
        | "MessageSquare"
        | "Search"
        | "Plug"
        | "Layers"
        | "Rocket"
        | "ShieldCheck"
        | "Sparkles"
        | "Database";
      prefixFr: string;
      prefixEn: string;
      labelFr: string;
      labelEn: string;
      detailFr: string;
      detailEn: string;
    }>;
    ariaFr: string;
    ariaEn: string;
  };
  fr: SitesWebCopy;
  en: SitesWebCopy;
}

const PROCESS_TITLE_FR = "Comment on s'y prend";
const PROCESS_TITLE_EN = "How we go about it";

const SITES_WEB: ReadonlyArray<SitesWebContent> = [
  // ── BRIQUE : Chatbot RAG (transverse) ──────────────────────────────────────
  {
    slug: "chatbot-rag",
    projectType: "transverse",
    pathFr: "/sites-web-augmentes/chatbot-rag",
    pathEn: "/sites-web-augmentes/chatbot-rag",
    accent: "orange",
    hero: {
      eyebrowFr: "Comment ça marche",
      eyebrowEn: "How it works",
      titleFr: "Un assistant qui répond juste",
      titleEn: "An assistant that answers right",
      blocks: [
        {
          icon: "Database",
          prefixFr: "1",
          prefixEn: "1",
          labelFr: "Ancré sur vos contenus",
          labelEn: "Grounded in your content",
          detailFr: "Vos pages, docs, fiches produit deviennent la seule source de réponse.",
          detailEn: "Your pages, docs and product sheets become the only answer source.",
        },
        {
          icon: "MessageSquare",
          prefixFr: "2",
          prefixEn: "2",
          labelFr: "Répond, cite, sait dire « je ne sais pas »",
          labelEn: "Answers, cites, says « I don't know »",
          detailFr: "Réponses sourcées, sans invention. Hors-sujet → relais humain.",
          detailEn: "Sourced answers, no invention. Off-topic → human handover.",
        },
        {
          icon: "ShieldCheck",
          prefixFr: "3",
          prefixEn: "3",
          labelFr: "Hébergé en UE",
          labelEn: "EU-hosted",
          detailFr: "Vos données restent chez vous, conforme RGPD.",
          detailEn: "Your data stays yours, GDPR-compliant.",
        },
      ],
      ariaFr:
        "Schéma : un chatbot ancré sur vos contenus, qui répond de façon sourcée ou passe la main à un humain, hébergé en UE.",
      ariaEn:
        "Diagram: a chatbot grounded in your content, answering with sources or handing over to a human, EU-hosted.",
    },
    fr: {
      eyebrow: "Brique IA · Chatbot RAG",
      title: "Un chatbot qui répond",
      titleEm: "sans inventer",
      answer:
        "On greffe sur votre site un assistant conversationnel ancré sur vos vrais contenus : il répond aux visiteurs avec des réponses sourcées, sait dire « je ne sais pas » et passe la main à un humain hors de son périmètre. Hébergé en UE, vos données restent chez vous.",
      ctaPrimary: "Décrire mon projet · devis 48 h",
      ctaSecondary: "Voir le hub Sites web & SaaS",
      benefitsTitle: "Ce que ça change pour vous",
      benefits: [
        {
          title: "Réponses fiables, pas d'hallucination",
          description:
            "Le chatbot ne répond que depuis vos contenus, en citant ses sources. Si l'info n'existe pas, il le dit — il n'invente jamais.",
        },
        {
          title: "Moins de tickets répétitifs",
          description:
            "Les questions récurrentes (livraison, tarifs, fonctionnement) sont traitées 24/7. Vos équipes se concentrent sur les vrais sujets.",
        },
        {
          title: "Des leads mieux qualifiés",
          description:
            "L'assistant oriente le visiteur, comprend son besoin et transmet une demande déjà cadrée à votre équipe.",
        },
        {
          title: "Vos données, votre hébergement",
          description:
            "Hébergement en Union européenne, conforme RGPD. Le code et la base de connaissance vous appartiennent.",
        },
      ],
      processTitle: PROCESS_TITLE_FR,
      processSteps: [
        {
          title: "On cadre le périmètre",
          description: "Quelles questions, quels contenus sources, quel ton, quels garde-fous.",
        },
        {
          title: "On connecte vos contenus",
          description: "Site, documentation, fiches : indexés pour devenir la source de réponse.",
        },
        {
          title: "On teste sur vos vrais cas",
          description: "Jeux de questions réelles, ajustement des réponses et des relais humains.",
        },
        {
          title: "On met en ligne et on suit",
          description: "Intégration sur votre site, mesure des réponses, itérations.",
        },
      ],
      metricsTitle: "Ce qu'on observe",
      metrics: [
        { number: "24/7", suffix: "", label: "Réponses aux questions courantes" },
        { number: "0", suffix: "", label: "Réponse inventée (sourcé ou rien)" },
        { number: "UE", suffix: "", label: "Hébergement, conforme RGPD" },
      ],
      faqTitle: "Questions fréquentes",
      faqs: [
        {
          id: "hallucination",
          question: "Comment éviter que le chatbot invente des réponses ?",
          answer:
            "Il ne répond que depuis vos contenus indexés et cite ses sources. Hors de son périmètre, il l'indique et propose un relais humain — il ne complète jamais par de l'invention.",
        },
        {
          id: "contenus",
          question: "Sur quels contenus s'appuie-t-il ?",
          answer:
            "Vos pages, votre documentation, vos fiches produit, vos FAQ internes — ce que vous choisissez. On cadre les sources ensemble au démarrage.",
        },
        {
          id: "rgpd",
          question: "Où sont hébergées les données ?",
          answer:
            "En Union européenne, conforme RGPD. Vos contenus et les échanges ne servent pas à entraîner de modèle tiers.",
        },
        {
          id: "integration",
          question: "Comment s'intègre-t-il à mon site ?",
          answer:
            "Par un widget léger ou une intégration native, sur n'importe quelle stack (WordPress, Shopify, Next.js, Laravel…). Sans refonte de votre site.",
        },
        {
          id: "delai",
          question: "Combien de temps pour le mettre en ligne ?",
          answer:
            "Quelques semaines selon le volume de contenus et le niveau d'intégration. On vous donne un périmètre et un délai fermes sous 48 h.",
        },
      ],
      ctaBlockTitle: "Un chatbot fiable, ancré sur vos contenus",
      ctaBlockDescription:
        "Décrivez votre site et vos contenus : on revient sous 48 h avec un périmètre précis, un forfait fixe et un délai garanti.",
      why: {
        title: "Le problème d'un",
        titleEm: "chatbot classique",
        intro:
          "La plupart des chatbots répondent « à côté » ou inventent — et détruisent la confiance dès la première réponse fausse.",
        points: [
          {
            title: "Ils inventent",
            description:
              "Un chatbot non ancré improvise des réponses plausibles mais fausses. Sur un site d'entreprise, c'est un risque direct de crédibilité.",
          },
          {
            title: "Ils ne connaissent pas votre métier",
            description:
              "Sans vos contenus, ils répondent du générique. Le vôtre répond sur VOS produits, VOS process, VOS conditions.",
          },
        ],
      },
    },
    en: {
      eyebrow: "AI brick · RAG chatbot",
      title: "A chatbot that answers",
      titleEm: "without making things up",
      answer:
        "We graft onto your site a conversational assistant grounded in your real content: it answers visitors with sourced replies, knows how to say « I don't know » and hands over to a human outside its scope. EU-hosted, your data stays yours.",
      ctaPrimary: "Describe my project · 48 h quote",
      ctaSecondary: "See the Websites & SaaS hub",
      benefitsTitle: "What it changes for you",
      benefits: [
        {
          title: "Reliable answers, no hallucination",
          description:
            "The chatbot only answers from your content, citing sources. If the info doesn't exist, it says so — it never invents.",
        },
        {
          title: "Fewer repetitive tickets",
          description: "Recurring questions are handled 24/7. Your teams focus on the real topics.",
        },
        {
          title: "Better qualified leads",
          description:
            "The assistant guides visitors, understands their need and forwards a scoped request to your team.",
        },
        {
          title: "Your data, your hosting",
          description: "EU hosting, GDPR-compliant. The code and knowledge base are yours.",
        },
      ],
      processTitle: PROCESS_TITLE_EN,
      processSteps: [
        {
          title: "We scope it",
          description: "Which questions, which source content, which tone, which guardrails.",
        },
        {
          title: "We connect your content",
          description: "Site, docs, sheets indexed to become the answer source.",
        },
        {
          title: "We test on your real cases",
          description: "Real question sets, tuning of answers and human handovers.",
        },
        {
          title: "We ship and monitor",
          description: "Integration on your site, answer measurement, iterations.",
        },
      ],
      metricsTitle: "What we observe",
      metrics: [
        { number: "24/7", suffix: "", label: "Answers to common questions" },
        { number: "0", suffix: "", label: "Invented answer (sourced or nothing)" },
        { number: "EU", suffix: "", label: "Hosting, GDPR-compliant" },
      ],
      faqTitle: "Frequently asked",
      faqs: [
        {
          id: "hallucination",
          question: "How do you prevent the chatbot from inventing answers?",
          answer:
            "It only answers from your indexed content and cites sources. Outside its scope, it says so and offers a human handover.",
        },
        {
          id: "contenus",
          question: "What content does it rely on?",
          answer:
            "Your pages, docs, product sheets, internal FAQs — what you choose. We scope sources together at kickoff.",
        },
        {
          id: "rgpd",
          question: "Where is the data hosted?",
          answer:
            "In the European Union, GDPR-compliant. Your content and chats are not used to train third-party models.",
        },
        {
          id: "integration",
          question: "How does it integrate with my site?",
          answer: "Via a lightweight widget or native integration, on any stack — no site rebuild.",
        },
        {
          id: "delai",
          question: "How long to go live?",
          answer:
            "A few weeks depending on content volume and integration depth. We give a firm scope and timeline within 48 h.",
        },
      ],
      ctaBlockTitle: "A reliable chatbot, grounded in your content",
      ctaBlockDescription:
        "Describe your site and content: we come back within 48 h with a precise scope, fixed fee and guaranteed timeline.",
      why: {
        title: "The problem with a",
        titleEm: "classic chatbot",
        intro:
          "Most chatbots answer « off-topic » or invent — destroying trust on the first wrong answer.",
        points: [
          {
            title: "They invent",
            description:
              "An ungrounded chatbot improvises plausible but false answers. On a company site, that's a direct credibility risk.",
          },
          {
            title: "They don't know your business",
            description:
              "Without your content, they answer generic. Yours answers on YOUR products, processes and terms.",
          },
        ],
      },
    },
  },

  // ── BRIQUE : Recherche sémantique (transverse) ─────────────────────────────
  {
    slug: "recherche-semantique",
    projectType: "transverse",
    pathFr: "/sites-web-augmentes/recherche-semantique",
    pathEn: "/sites-web-augmentes/recherche-semantique",
    accent: "primary",
    hero: {
      eyebrowFr: "Comment ça marche",
      eyebrowEn: "How it works",
      titleFr: "Une recherche qui comprend l'intention",
      titleEn: "Search that understands intent",
      blocks: [
        {
          icon: "Search",
          prefixFr: "1",
          prefixEn: "1",
          labelFr: "Comprend la demande",
          labelEn: "Understands the query",
          detailFr: "Le visiteur écrit comme il parle — pas besoin du bon mot-clé exact.",
          detailEn: "Visitors type as they speak — no need for the exact keyword.",
        },
        {
          icon: "Sparkles",
          prefixFr: "2",
          prefixEn: "2",
          labelFr: "Trouve par le sens",
          labelEn: "Finds by meaning",
          detailFr: "Résultats pertinents même sans correspondance de mots exacte.",
          detailEn: "Relevant results even without exact word match.",
        },
        {
          icon: "Rocket",
          prefixFr: "3",
          prefixEn: "3",
          labelFr: "Convertit mieux",
          labelEn: "Converts better",
          detailFr: "Moins d'abandons, plus de pages et de produits trouvés.",
          detailEn: "Fewer bounces, more pages and products found.",
        },
      ],
      ariaFr:
        "Schéma : une recherche qui comprend l'intention du visiteur et trouve par le sens, pas par mot-clé exact.",
      ariaEn:
        "Diagram: search that understands visitor intent and finds by meaning, not exact keyword.",
    },
    fr: {
      eyebrow: "Brique IA · Recherche sémantique",
      title: "Une recherche qui",
      titleEm: "comprend vraiment",
      answer:
        "On remplace la recherche « mot-clé exact » de votre site ou e-commerce par une recherche sémantique : elle comprend l'intention du visiteur et trouve le bon contenu ou le bon produit, même formulé autrement. Résultat : moins d'abandons, plus de conversions.",
      ctaPrimary: "Décrire mon projet · devis 48 h",
      ctaSecondary: "Voir le hub Sites web & SaaS",
      benefitsTitle: "Ce que ça change",
      benefits: [
        {
          title: "Le visiteur trouve, même mal formulé",
          description:
            "« chaussure pour courir sous la pluie » trouve vos trail imperméables, sans correspondance de mots exacte.",
        },
        {
          title: "Moins d'abandons de recherche",
          description:
            "Une recherche qui ne renvoie « aucun résultat » fait fuir. La sémantique récupère ces visiteurs.",
        },
        {
          title: "Plus de produits / contenus vus",
          description:
            "En comprenant l'intention, elle remonte des résultats pertinents qu'un moteur classique rate.",
        },
        {
          title: "S'adapte à votre catalogue",
          description: "Indexée sur vos vrais contenus et produits, mise à jour avec votre site.",
        },
      ],
      processTitle: PROCESS_TITLE_FR,
      processSteps: [
        {
          title: "On analyse vos recherches actuelles",
          description: "Ce que cherchent vraiment vos visiteurs, et ce qui échoue aujourd'hui.",
        },
        {
          title: "On indexe vos contenus",
          description: "Pages, produits, documentation transformés pour la recherche par le sens.",
        },
        {
          title: "On branche sur votre barre de recherche",
          description: "Intégration sur votre stack, sans refonte du site.",
        },
        {
          title: "On mesure et on affine",
          description: "Taux de recherches abouties, suivi des requêtes sans résultat.",
        },
      ],
      metricsTitle: "Ce qu'on observe",
      metrics: [
        { number: "+", suffix: "conversions", label: "Plus de produits/contenus trouvés" },
        { number: "0", suffix: "résultat", label: "Bien moins de « aucun résultat »" },
        { number: "UE", suffix: "", label: "Hébergement conforme RGPD" },
      ],
      faqTitle: "Questions fréquentes",
      faqs: [
        {
          id: "diff",
          question: "Quelle différence avec la recherche de mon site ?",
          answer:
            "La recherche classique compare des mots. La sémantique compare le SENS : elle trouve même si le visiteur n'emploie pas vos mots exacts.",
        },
        {
          id: "ecommerce",
          question: "Ça marche pour un e-commerce ?",
          answer:
            "Oui — c'est un des cas les plus rentables : le visiteur trouve le bon produit même avec une formulation approximative, ce qui augmente les ventes.",
        },
        {
          id: "stack",
          question: "Compatible avec ma technologie ?",
          answer:
            "Oui, sur n'importe quelle stack (WordPress, Shopify, Next.js, Laravel…), sans refonte.",
        },
        {
          id: "maj",
          question: "Et quand mon catalogue change ?",
          answer:
            "L'index se met à jour avec votre site. Les nouveaux produits/contenus deviennent cherchables automatiquement.",
        },
      ],
      ctaBlockTitle: "Une recherche qui convertit",
      ctaBlockDescription:
        "Décrivez votre site ou e-commerce : on revient sous 48 h avec un périmètre, un forfait fixe et un délai.",
      why: {
        title: "Le problème de la",
        titleEm: "recherche par mot-clé",
        intro:
          "La recherche classique échoue dès que le visiteur n'emploie pas le mot exact de votre fiche — et il part.",
        points: [
          {
            title: "« Aucun résultat » fait fuir",
            description:
              "Un visiteur qui ne trouve pas abandonne. Chaque recherche ratée est une vente ou un contact perdu.",
          },
          {
            title: "Vos visiteurs ne parlent pas votre jargon",
            description:
              "Ils cherchent avec leurs mots. La sémantique fait le pont entre leur langage et votre catalogue.",
          },
        ],
      },
    },
    en: {
      eyebrow: "AI brick · Semantic search",
      title: "Search that",
      titleEm: "truly understands",
      answer:
        "We replace your site's exact-keyword search with semantic search: it understands visitor intent and finds the right content or product, even phrased differently. Result: fewer bounces, more conversions.",
      ctaPrimary: "Describe my project · 48 h quote",
      ctaSecondary: "See the Websites & SaaS hub",
      benefitsTitle: "What it changes",
      benefits: [
        {
          title: "Visitors find, even when poorly phrased",
          description:
            "« shoe for running in the rain » finds your waterproof trail shoes, with no exact word match.",
        },
        {
          title: "Fewer abandoned searches",
          description:
            "A search returning « no results » drives people away. Semantic search recovers them.",
        },
        {
          title: "More products / content seen",
          description:
            "By understanding intent, it surfaces relevant results a classic engine misses.",
        },
        {
          title: "Adapts to your catalogue",
          description: "Indexed on your real content and products, updated with your site.",
        },
      ],
      processTitle: PROCESS_TITLE_EN,
      processSteps: [
        {
          title: "We analyse current searches",
          description: "What your visitors really look for, and what fails today.",
        },
        {
          title: "We index your content",
          description: "Pages, products, docs transformed for meaning-based search.",
        },
        {
          title: "We wire your search bar",
          description: "Integration on your stack, no site rebuild.",
        },
        {
          title: "We measure and refine",
          description: "Successful-search rate, monitoring of no-result queries.",
        },
      ],
      metricsTitle: "What we observe",
      metrics: [
        { number: "+", suffix: "conversions", label: "More products/content found" },
        { number: "0", suffix: "result", label: "Far fewer « no results »" },
        { number: "EU", suffix: "", label: "GDPR-compliant hosting" },
      ],
      faqTitle: "Frequently asked",
      faqs: [
        {
          id: "diff",
          question: "How is it different from my site search?",
          answer:
            "Classic search compares words. Semantic compares MEANING: it finds even if the visitor doesn't use your exact words.",
        },
        {
          id: "ecommerce",
          question: "Does it work for e-commerce?",
          answer:
            "Yes — one of the most profitable cases: visitors find the right product even with approximate phrasing, increasing sales.",
        },
        {
          id: "stack",
          question: "Compatible with my tech?",
          answer: "Yes, on any stack, no rebuild.",
        },
        {
          id: "maj",
          question: "What when my catalogue changes?",
          answer: "The index updates with your site. New items become searchable automatically.",
        },
      ],
      ctaBlockTitle: "Search that converts",
      ctaBlockDescription:
        "Describe your site or store: we come back within 48 h with a scope, fixed fee and timeline.",
      why: {
        title: "The problem with",
        titleEm: "keyword search",
        intro:
          "Classic search fails as soon as the visitor doesn't use the exact word on your sheet — and they leave.",
        points: [
          {
            title: "« No results » drives people away",
            description:
              "A visitor who can't find, abandons. Every failed search is a lost sale or contact.",
          },
          {
            title: "Visitors don't speak your jargon",
            description:
              "They search with their words. Semantic search bridges their language and your catalogue.",
          },
        ],
      },
    },
  },
];

const SITES_WEB_BY_SLUG: ReadonlyMap<SitesWebSlug, SitesWebContent> = new Map(
  SITES_WEB.map((s) => [s.slug, s]),
);

export function getSitesWeb(slug: SitesWebSlug): SitesWebContent {
  const found = SITES_WEB_BY_SLUG.get(slug);
  if (!found) throw new Error(`[sites-web] landing introuvable : "${slug}"`);
  return found;
}

export function allSitesWebSlugs(): ReadonlyArray<SitesWebSlug> {
  return SITES_WEB.map((s) => s.slug);
}

export { SITES_WEB };
