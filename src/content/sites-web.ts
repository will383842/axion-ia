// Content pack — pages-intention détail de la verticale Sites web & SaaS IA.
// Landings sélectives (anti-doorway) sous /sites-web-augmentes/* rendues par
// SitesWebLandingPage (ProductPageTemplate + hero DetailHeroSchema + SubPageExtras).
//
// Garde-fous : 0 prix hardcodé (projets web = forfait/sur devis, dérivé de
// pricing.ts CODAGE_TIERS si besoin JSON-LD ; pas d'affichage de montant),
// 0 financement, EN = miroir concis (locale 301→FR). Axe siteProjectType aligné
// sur les keywords g3h (augmentation / native / transverse).

export type SitesWebSlug =
  | "chatbot-rag"
  | "recherche-semantique"
  | "sans-refonte"
  | "plateforme-native"
  | "recommandation"
  | "wordpress"
  | "creer-saas-ia"
  | "shopify"
  | "personnalisation"
  | "ux-ui-product-design"
  | "woocommerce"
  | "prestashop";

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
  // ── AUGMENTATION : ajouter l'IA sans refonte ───────────────────────────────
  {
    slug: "sans-refonte",
    projectType: "augmentation",
    pathFr: "/sites-web-augmentes/sans-refonte",
    pathEn: "/sites-web-augmentes/sans-refonte",
    accent: "primary",
    hero: {
      eyebrowFr: "Comment ça marche",
      eyebrowEn: "How it works",
      titleFr: "L'IA greffée sur l'existant",
      titleEn: "AI grafted onto the existing",
      blocks: [
        {
          icon: "Plug",
          prefixFr: "1",
          prefixEn: "1",
          labelFr: "On garde votre site",
          labelEn: "We keep your site",
          detailFr: "Aucune refonte : on greffe l'IA sur ce qui tourne déjà.",
          detailEn: "No rebuild: we graft AI onto what already runs.",
        },
        {
          icon: "Sparkles",
          prefixFr: "2",
          prefixEn: "2",
          labelFr: "On ajoute la brique utile",
          labelEn: "We add the useful brick",
          detailFr: "Chatbot, recherche, automatisation — selon votre vrai besoin.",
          detailEn: "Chatbot, search, automation — per your real need.",
        },
        {
          icon: "Rocket",
          prefixFr: "3",
          prefixEn: "3",
          labelFr: "En ligne vite",
          labelEn: "Live fast",
          detailFr: "Quelques semaines, pas un projet de refonte de plusieurs mois.",
          detailEn: "A few weeks, not a multi-month rebuild.",
        },
      ],
      ariaFr:
        "Schéma : on garde votre site existant, on y greffe la brique IA utile, en ligne en quelques semaines sans refonte.",
      ariaEn:
        "Diagram: we keep your existing site, graft the useful AI brick, live in weeks with no rebuild.",
    },
    fr: {
      eyebrow: "Augmentation · sans refonte",
      title: "Ajoutez l'IA à votre site",
      titleEm: "sans tout refaire",
      answer:
        "Pas besoin de refondre votre site pour profiter de l'IA. On greffe la brique utile (chatbot ancré, recherche sémantique, automatisation) sur votre site existant, quelle que soit votre technologie — en quelques semaines, sans casser ce qui marche déjà.",
      ctaPrimary: "Décrire mon projet · devis 48 h",
      ctaSecondary: "Voir le hub Sites web & SaaS",
      benefitsTitle: "Ce que ça change",
      benefits: [
        {
          title: "Zéro refonte, zéro régression",
          description:
            "On ne touche pas à votre site : on ajoute une couche IA par-dessus. Ce qui marche aujourd'hui continue de marcher.",
        },
        {
          title: "Vite en ligne",
          description:
            "Quelques semaines au lieu d'un projet de refonte de plusieurs mois. Vous mesurez l'impact rapidement.",
        },
        {
          title: "Sur n'importe quelle technologie",
          description:
            "WordPress, Shopify, Webflow, Next.js, Laravel… on s'adapte à votre stack, sans vous imposer la nôtre.",
        },
        {
          title: "Forfait fixe, code à vous",
          description: "Périmètre clair, prix ferme, pas de régie. Le code livré vous appartient.",
        },
      ],
      processTitle: PROCESS_TITLE_FR,
      processSteps: [
        {
          title: "On regarde votre site",
          description: "Stack, contenus, objectifs : ce qui a le plus d'impact pour vous.",
        },
        {
          title: "On choisit la bonne brique",
          description: "Chatbot, recherche, automatisation : une seule chose, bien faite.",
        },
        {
          title: "On greffe sans casser",
          description: "Intégration par-dessus l'existant, testée sur vos vrais cas.",
        },
        {
          title: "On met en ligne et on mesure",
          description: "Impact suivi, itérations selon les retours.",
        },
      ],
      metricsTitle: "Ce qu'on observe",
      metrics: [
        { number: "0", suffix: "refonte", label: "On garde votre site" },
        { number: "≈ sem.", suffix: "", label: "Mise en ligne rapide" },
        { number: "UE", suffix: "", label: "Hébergement conforme RGPD" },
      ],
      faqTitle: "Questions fréquentes",
      faqs: [
        {
          id: "refonte",
          question: "Faut-il refondre mon site ?",
          answer:
            "Non. On greffe l'IA par-dessus votre site existant, sans refonte. C'est tout l'intérêt : profiter de l'IA sans le coût et le risque d'un nouveau site.",
        },
        {
          id: "stack",
          question: "Et si mon site est sur une vieille techno ?",
          answer:
            "On s'adapte à la plupart des stacks (WordPress, Shopify, Webflow, frameworks). On valide la faisabilité au cadrage, avant tout engagement.",
        },
        {
          id: "brique",
          question: "Quelle brique IA choisir ?",
          answer:
            "Celle qui a le plus d'impact pour vous : un chatbot ancré, une recherche sémantique, une automatisation. On vous oriente au cadrage.",
        },
        {
          id: "delai",
          question: "Combien de temps ?",
          answer:
            "Quelques semaines selon la brique. Périmètre et délai fermes sous 48 h après votre description.",
        },
      ],
      ctaBlockTitle: "Profitez de l'IA sans refaire votre site",
      ctaBlockDescription:
        "Décrivez votre site et votre besoin : on revient sous 48 h avec la brique la plus utile, un forfait fixe et un délai.",
      why: {
        title: "Refondre,",
        titleEm: "le faux réflexe",
        intro:
          "On croit souvent qu'il faut « tout refaire » pour avoir de l'IA. C'est faux, lent et risqué.",
        points: [
          {
            title: "Une refonte, c'est long et risqué",
            description:
              "Des mois de chantier, des régressions, un budget lourd — pour au final ajouter ce qu'on peut greffer aujourd'hui.",
          },
          {
            title: "L'augmentation va droit au but",
            description:
              "On ajoute la valeur IA là où elle compte, sur votre site actuel, sans tout remettre en jeu.",
          },
        ],
      },
    },
    en: {
      eyebrow: "Augmentation · no rebuild",
      title: "Add AI to your site",
      titleEm: "without redoing it all",
      answer:
        "You don't need to rebuild your site to benefit from AI. We graft the useful brick (grounded chatbot, semantic search, automation) onto your existing site, whatever your technology — in a few weeks, without breaking what already works.",
      ctaPrimary: "Describe my project · 48 h quote",
      ctaSecondary: "See the Websites & SaaS hub",
      benefitsTitle: "What it changes",
      benefits: [
        {
          title: "Zero rebuild, zero regression",
          description:
            "We don't touch your site: we add an AI layer on top. What works today keeps working.",
        },
        {
          title: "Live fast",
          description: "A few weeks instead of a multi-month rebuild. You measure impact quickly.",
        },
        {
          title: "On any technology",
          description: "WordPress, Shopify, Webflow, Next.js, Laravel… we adapt to your stack.",
        },
        {
          title: "Fixed fee, code yours",
          description: "Clear scope, firm price, no time-and-materials. Delivered code is yours.",
        },
      ],
      processTitle: PROCESS_TITLE_EN,
      processSteps: [
        {
          title: "We look at your site",
          description: "Stack, content, goals: what has the most impact for you.",
        },
        {
          title: "We pick the right brick",
          description: "Chatbot, search, automation: one thing, done well.",
        },
        {
          title: "We graft without breaking",
          description: "Integration on top of the existing, tested on your real cases.",
        },
        { title: "We ship and measure", description: "Impact tracked, iterations from feedback." },
      ],
      metricsTitle: "What we observe",
      metrics: [
        { number: "0", suffix: "rebuild", label: "We keep your site" },
        { number: "≈ wks", suffix: "", label: "Fast go-live" },
        { number: "EU", suffix: "", label: "GDPR-compliant hosting" },
      ],
      faqTitle: "Frequently asked",
      faqs: [
        {
          id: "refonte",
          question: "Do I need to rebuild my site?",
          answer:
            "No. We graft AI on top of your existing site, no rebuild — benefit from AI without the cost and risk of a new site.",
        },
        {
          id: "stack",
          question: "What if my site is on old tech?",
          answer:
            "We adapt to most stacks. We validate feasibility at scoping, before any commitment.",
        },
        {
          id: "brique",
          question: "Which AI brick to choose?",
          answer:
            "The one with the most impact for you: grounded chatbot, semantic search, automation. We guide you at scoping.",
        },
        {
          id: "delai",
          question: "How long?",
          answer: "A few weeks depending on the brick. Firm scope and timeline within 48 h.",
        },
      ],
      ctaBlockTitle: "Benefit from AI without redoing your site",
      ctaBlockDescription:
        "Describe your site and need: we come back within 48 h with the most useful brick, a fixed fee and a timeline.",
      why: {
        title: "Rebuilding,",
        titleEm: "the false reflex",
        intro:
          "People often think they must « redo everything » to get AI. That's false, slow and risky.",
        points: [
          {
            title: "A rebuild is long and risky",
            description:
              "Months of work, regressions, heavy budget — to ultimately add what can be grafted today.",
          },
          {
            title: "Augmentation goes straight to the point",
            description:
              "We add AI value where it matters, on your current site, without putting everything at stake.",
          },
        ],
      },
    },
  },

  // ── NATIVE : plateforme SaaS IA-native ──────────────────────────────────────
  {
    slug: "plateforme-native",
    projectType: "native",
    pathFr: "/sites-web-augmentes/plateforme-native",
    pathEn: "/sites-web-augmentes/plateforme-native",
    accent: "purple",
    hero: {
      eyebrowFr: "Comment on construit",
      eyebrowEn: "How we build",
      titleFr: "Une plateforme pensée IA dès le départ",
      titleEn: "A platform built AI-first",
      blocks: [
        {
          icon: "Layers",
          prefixFr: "1",
          prefixEn: "1",
          labelFr: "Conçue autour de l'IA",
          labelEn: "Designed around AI",
          detailFr: "L'IA n'est pas un ajout : c'est le cœur du produit.",
          detailEn: "AI isn't an add-on: it's the core of the product.",
        },
        {
          icon: "Database",
          prefixFr: "2",
          prefixEn: "2",
          labelFr: "Sur vos données métier",
          labelEn: "On your business data",
          detailFr: "Plateforme sur mesure, branchée sur votre métier réel.",
          detailEn: "Bespoke platform, wired to your real business.",
        },
        {
          icon: "ShieldCheck",
          prefixFr: "3",
          prefixEn: "3",
          labelFr: "À vous, hébergée UE",
          labelEn: "Yours, EU-hosted",
          detailFr: "Code livré, propriété totale, conforme RGPD.",
          detailEn: "Code delivered, full ownership, GDPR-compliant.",
        },
      ],
      ariaFr:
        "Schéma : une plateforme SaaS conçue autour de l'IA, sur vos données métier, dont le code vous appartient et hébergée en UE.",
      ariaEn:
        "Diagram: a SaaS platform designed around AI, on your business data, code yours and EU-hosted.",
    },
    fr: {
      eyebrow: "Native · plateforme SaaS IA",
      title: "Créez une plateforme",
      titleEm: "IA-native",
      answer:
        "Quand l'IA est au cœur de votre produit, on ne la greffe pas : on construit une plateforme sur mesure pensée autour d'elle dès la conception. Branchée sur vos données métier, hébergée en UE, code et propriété intégralement à vous.",
      ctaPrimary: "Décrire mon projet · devis 48 h",
      ctaSecondary: "Voir le hub Sites web & SaaS",
      benefitsTitle: "Ce que ça change",
      benefits: [
        {
          title: "L'IA au cœur, pas en surcouche",
          description:
            "Architecture pensée pour l'IA dès le départ — pas un produit classique avec une fonctionnalité IA collée par-dessus.",
        },
        {
          title: "Sur mesure pour votre métier",
          description:
            "On part de vos vrais flux, vos données, vos utilisateurs. La plateforme épouse votre activité, pas l'inverse.",
        },
        {
          title: "Vous êtes propriétaire",
          description:
            "Code livré, propriété totale, pas de dépendance. Vous pouvez la faire évoluer avec qui vous voulez.",
        },
        {
          title: "Souveraine et conforme",
          description:
            "Hébergement UE, conforme RGPD dès la conception — un argument pour vos propres clients.",
        },
      ],
      processTitle: PROCESS_TITLE_FR,
      processSteps: [
        {
          title: "On cadre le produit",
          description: "Utilisateurs, flux, rôle exact de l'IA, périmètre du premier jalon.",
        },
        {
          title: "On conçoit l'architecture",
          description: "Fondations pensées IA + données, sécurité et conformité intégrées.",
        },
        {
          title: "On construit par jalons",
          description: "Livraisons régulières, testables, pas un tunnel de plusieurs mois.",
        },
        {
          title: "On livre et on transfère",
          description: "Code, documentation, propriété — vous gardez la main.",
        },
      ],
      metricsTitle: "Ce qu'on observe",
      metrics: [
        { number: "IA", suffix: "first", label: "Au cœur du produit" },
        { number: "100%", suffix: "", label: "Propriété du code à vous" },
        { number: "UE", suffix: "", label: "Hébergement conforme RGPD" },
      ],
      faqTitle: "Questions fréquentes",
      faqs: [
        {
          id: "vs-augmentation",
          question: "Quelle différence avec greffer l'IA sur l'existant ?",
          answer:
            "L'augmentation ajoute l'IA à un site existant. Le natif construit une plateforme nouvelle quand l'IA EST le produit. On vous aide à trancher au cadrage.",
        },
        {
          id: "propriete",
          question: "À qui appartient le code ?",
          answer:
            "À vous, intégralement. On livre le code et la documentation — aucune dépendance technique à Axion-IA.",
        },
        {
          id: "perimetre",
          question: "Comment éviter l'effet tunnel ?",
          answer:
            "On livre par jalons testables. Vous voyez le produit grandir et arbitrez en continu, plutôt que d'attendre une livraison finale.",
        },
        {
          id: "rgpd",
          question: "Et la conformité ?",
          answer:
            "RGPD et hébergement UE pensés dès la conception — y compris comme argument vis-à-vis de vos propres clients.",
        },
      ],
      ctaBlockTitle: "Construisez votre plateforme IA-native",
      ctaBlockDescription:
        "Décrivez votre produit : on revient sous 48 h avec un premier jalon cadré, un forfait fixe et un délai garanti.",
      why: {
        title: "Greffer ne suffit pas",
        titleEm: "toujours",
        intro:
          "Quand l'IA est le cœur de la valeur, l'ajouter à un produit classique bride tout. Mieux vaut construire autour d'elle.",
        points: [
          {
            title: "Une surcouche plafonne vite",
            description:
              "Greffer l'IA sur une base non prévue pour elle finit par coincer (données, perfs, UX). Le natif n'a pas ce plafond.",
          },
          {
            title: "Le natif, c'est un produit, pas un patch",
            description:
              "Architecture, données et expérience pensées pour l'IA — un vrai avantage produit, pas une démo.",
          },
        ],
      },
    },
    en: {
      eyebrow: "Native · AI SaaS platform",
      title: "Build an",
      titleEm: "AI-native platform",
      answer:
        "When AI is at the heart of your product, we don't graft it: we build a bespoke platform designed around it from day one. Wired to your business data, EU-hosted, code and ownership fully yours.",
      ctaPrimary: "Describe my project · 48 h quote",
      ctaSecondary: "See the Websites & SaaS hub",
      benefitsTitle: "What it changes",
      benefits: [
        {
          title: "AI at the core, not bolted on",
          description:
            "Architecture designed for AI from the start — not a classic product with an AI feature glued on.",
        },
        {
          title: "Bespoke for your business",
          description:
            "We start from your real flows, data, users. The platform fits your activity, not the other way around.",
        },
        {
          title: "You own it",
          description:
            "Code delivered, full ownership, no lock-in. You can evolve it with whoever you want.",
        },
        {
          title: "Sovereign and compliant",
          description: "EU hosting, GDPR-compliant by design — an argument for your own customers.",
        },
      ],
      processTitle: PROCESS_TITLE_EN,
      processSteps: [
        {
          title: "We scope the product",
          description: "Users, flows, exact AI role, first milestone scope.",
        },
        {
          title: "We design the architecture",
          description: "AI + data foundations, security and compliance built in.",
        },
        {
          title: "We build by milestones",
          description: "Regular, testable deliveries, not a multi-month tunnel.",
        },
        {
          title: "We deliver and hand over",
          description: "Code, documentation, ownership — you keep control.",
        },
      ],
      metricsTitle: "What we observe",
      metrics: [
        { number: "AI", suffix: "first", label: "At the product core" },
        { number: "100%", suffix: "", label: "Code ownership yours" },
        { number: "EU", suffix: "", label: "GDPR-compliant hosting" },
      ],
      faqTitle: "Frequently asked",
      faqs: [
        {
          id: "vs-augmentation",
          question: "How is it different from grafting AI onto the existing?",
          answer:
            "Augmentation adds AI to an existing site. Native builds a new platform when AI IS the product. We help you decide at scoping.",
        },
        {
          id: "propriete",
          question: "Who owns the code?",
          answer: "You, entirely. We deliver code and docs — no technical lock-in to Axion-IA.",
        },
        {
          id: "perimetre",
          question: "How to avoid the tunnel effect?",
          answer:
            "We deliver by testable milestones. You watch the product grow and steer continuously.",
        },
        {
          id: "rgpd",
          question: "What about compliance?",
          answer:
            "GDPR and EU hosting designed from the start — including as an argument toward your own customers.",
        },
      ],
      ctaBlockTitle: "Build your AI-native platform",
      ctaBlockDescription:
        "Describe your product: we come back within 48 h with a scoped first milestone, a fixed fee and a guaranteed timeline.",
      why: {
        title: "Grafting isn't",
        titleEm: "always enough",
        intro:
          "When AI is the core of the value, adding it to a classic product caps everything. Better to build around it.",
        points: [
          {
            title: "An overlay hits a ceiling fast",
            description:
              "Grafting AI onto a base not designed for it eventually jams (data, perf, UX). Native has no such ceiling.",
          },
          {
            title: "Native is a product, not a patch",
            description:
              "Architecture, data and experience designed for AI — a real product edge, not a demo.",
          },
        ],
      },
    },
  },
  // ── BRIQUE : Recommandation produit IA (transverse, e-commerce) ────────────
  {
    slug: "recommandation",
    projectType: "transverse",
    pathFr: "/sites-web-augmentes/recommandation",
    pathEn: "/sites-web-augmentes/recommandation",
    accent: "green",
    hero: {
      eyebrowFr: "Comment ça marche",
      eyebrowEn: "How it works",
      titleFr: "Le bon produit, au bon visiteur",
      titleEn: "The right product, to the right visitor",
      blocks: [
        {
          icon: "Sparkles",
          prefixFr: "1",
          prefixEn: "1",
          labelFr: "Comprend le visiteur",
          labelEn: "Understands the visitor",
          detailFr: "Navigation, panier, historique : l'IA lit l'intention en temps réel.",
          detailEn: "Browsing, cart, history: AI reads intent in real time.",
        },
        {
          icon: "Search",
          prefixFr: "2",
          prefixEn: "2",
          labelFr: "Suggère par le sens",
          labelEn: "Suggests by meaning",
          detailFr: "Produits complémentaires pertinents, pas des « bestsellers » génériques.",
          detailEn: "Relevant complementary products, not generic bestsellers.",
        },
        {
          icon: "Rocket",
          prefixFr: "3",
          prefixEn: "3",
          labelFr: "Augmente le panier",
          labelEn: "Lifts the cart",
          detailFr: "Cross-sell et up-sell automatiques sur chaque page.",
          detailEn: "Automatic cross-sell and up-sell on every page.",
        },
      ],
      ariaFr:
        "Schéma : l'IA comprend l'intention du visiteur et suggère les produits complémentaires pertinents, augmentant le panier moyen.",
      ariaEn:
        "Diagram: AI understands visitor intent and suggests relevant complementary products, lifting average cart.",
    },
    fr: {
      eyebrow: "Brique IA · Recommandation produit",
      title: "Des recommandations",
      titleEm: "qui vendent",
      answer:
        "On ajoute à votre site ou e-commerce un moteur de recommandation IA qui comprend l'intention de chaque visiteur et suggère les bons produits complémentaires — cross-sell et up-sell automatiques. Résultat : un panier moyen plus élevé, sans effort manuel.",
      ctaPrimary: "Décrire mon projet · devis 48 h",
      ctaSecondary: "Voir le hub Sites web & SaaS",
      benefitsTitle: "Ce que ça change",
      benefits: [
        {
          title: "Panier moyen en hausse",
          description:
            "Chaque page propose les produits réellement pertinents pour ce visiteur-là, pas une liste figée de bestsellers.",
        },
        {
          title: "Personnalisé, sans cookie tiers",
          description:
            "La pertinence vient du comportement sur votre site, pas du pistage publicitaire — conforme RGPD.",
        },
        {
          title: "Zéro maintenance manuelle",
          description:
            "Plus de règles « si A alors B » à maintenir : le moteur s'adapte à votre catalogue et à vos ventes en continu.",
        },
      ],
      processTitle: PROCESS_TITLE_FR,
      processSteps: [
        {
          title: "On branche votre catalogue",
          description: "Produits, catégories, historique de ventes : indexés pour le moteur.",
        },
        {
          title: "On définit les emplacements",
          description: "Fiche produit, panier, page d'accueil : où les recommandations comptent.",
        },
        {
          title: "On met en ligne et on mesure",
          description: "Taux de clic sur les reco, impact sur le panier moyen, itérations.",
        },
      ],
      metricsTitle: "Ce qu'on observe",
      metrics: [
        { number: "+", suffix: "panier", label: "Panier moyen en hausse" },
        { number: "0", suffix: "cookie", label: "Sans pistage tiers, RGPD" },
        { number: "UE", suffix: "", label: "Hébergement conforme RGPD" },
      ],
      faqTitle: "Questions fréquentes",
      faqs: [
        {
          id: "ecommerce",
          question: "C'est seulement pour l'e-commerce ?",
          answer:
            "Non. La reco vaut aussi pour un catalogue de services, une base d'articles ou de ressources — partout où orienter le visiteur vers le bon contenu augmente la conversion.",
        },
        {
          id: "cookie",
          question: "Faut-il des cookies tiers ?",
          answer:
            "Non. La pertinence vient du comportement sur votre propre site (pages vues, panier), pas du pistage publicitaire — conforme RGPD.",
        },
        {
          id: "stack",
          question: "Compatible avec ma boutique ?",
          answer:
            "Oui, sur n'importe quelle stack (WordPress/WooCommerce, Shopify, Next.js, Laravel…), sans refonte.",
        },
        {
          id: "maj",
          question: "Et les nouveaux produits ?",
          answer:
            "Ils entrent automatiquement dans le moteur dès qu'ils sont dans votre catalogue — aucune règle à recréer.",
        },
      ],
      ctaBlockTitle: "Des recommandations qui augmentent le panier",
      ctaBlockDescription:
        "Décrivez votre site ou boutique : on revient sous 48 h avec un périmètre, un forfait fixe et un délai.",
      why: {
        title: "Les reco « bestsellers »",
        titleEm: "ne marchent plus",
        intro:
          "Afficher les mêmes « meilleures ventes » à tout le monde ignore l'intention du visiteur — et laisse du chiffre d'affaires sur la table.",
        points: [
          {
            title: "Une liste figée rate la cible",
            description:
              "Le visiteur qui regarde un produit précis n'a pas besoin des bestsellers : il a besoin du complément pertinent.",
          },
          {
            title: "Les règles manuelles ne tiennent pas",
            description:
              "Maintenir des règles de cross-sell produit par produit est intenable. Le moteur IA s'en charge, et s'adapte.",
          },
        ],
      },
    },
    en: {
      eyebrow: "AI brick · Product recommendation",
      title: "Recommendations",
      titleEm: "that sell",
      answer:
        "We add to your site or store an AI recommendation engine that understands each visitor's intent and suggests the right complementary products — automatic cross-sell and up-sell. Result: a higher average cart, with no manual effort.",
      ctaPrimary: "Describe my project · 48 h quote",
      ctaSecondary: "See the Websites & SaaS hub",
      benefitsTitle: "What it changes",
      benefits: [
        {
          title: "Higher average cart",
          description:
            "Every page suggests the products truly relevant to that visitor, not a fixed bestseller list.",
        },
        {
          title: "Personalised, no third-party cookie",
          description:
            "Relevance comes from behaviour on your site, not ad tracking — GDPR-compliant.",
        },
        {
          title: "Zero manual maintenance",
          description:
            "No more « if A then B » rules to maintain: the engine adapts to your catalogue and sales continuously.",
        },
      ],
      processTitle: PROCESS_TITLE_EN,
      processSteps: [
        {
          title: "We connect your catalogue",
          description: "Products, categories, sales history: indexed for the engine.",
        },
        {
          title: "We define the placements",
          description: "Product page, cart, home: where recommendations matter.",
        },
        {
          title: "We ship and measure",
          description: "Click-through on reco, impact on average cart, iterations.",
        },
      ],
      metricsTitle: "What we observe",
      metrics: [
        { number: "+", suffix: "cart", label: "Higher average cart" },
        { number: "0", suffix: "cookie", label: "No third-party tracking, GDPR" },
        { number: "EU", suffix: "", label: "GDPR-compliant hosting" },
      ],
      faqTitle: "Frequently asked",
      faqs: [
        {
          id: "ecommerce",
          question: "Is it only for e-commerce?",
          answer:
            "No. Recommendation also works for a service catalogue or a content/resource base — anywhere guiding visitors to the right item lifts conversion.",
        },
        {
          id: "cookie",
          question: "Are third-party cookies needed?",
          answer:
            "No. Relevance comes from behaviour on your own site, not ad tracking — GDPR-compliant.",
        },
        {
          id: "stack",
          question: "Compatible with my store?",
          answer:
            "Yes, on any stack (WordPress/WooCommerce, Shopify, Next.js, Laravel…), no rebuild.",
        },
        {
          id: "maj",
          question: "What about new products?",
          answer:
            "They enter the engine automatically once in your catalogue — no rules to recreate.",
        },
      ],
      ctaBlockTitle: "Recommendations that lift the cart",
      ctaBlockDescription:
        "Describe your site or store: we come back within 48 h with a scope, fixed fee and timeline.",
      why: {
        title: "Bestseller recommendations",
        titleEm: "no longer work",
        intro:
          "Showing everyone the same « top sellers » ignores visitor intent — and leaves revenue on the table.",
        points: [
          {
            title: "A fixed list misses the target",
            description:
              "A visitor looking at a specific product doesn't need bestsellers: they need the relevant complement.",
          },
          {
            title: "Manual rules don't scale",
            description:
              "Maintaining cross-sell rules product by product is unsustainable. The AI engine handles it, and adapts.",
          },
        ],
      },
    },
  },

  // ── AUGMENTATION : chatbot IA WordPress (stack, fort volume) ────────────────
  {
    slug: "wordpress",
    projectType: "augmentation",
    pathFr: "/sites-web-augmentes/wordpress",
    pathEn: "/sites-web-augmentes/wordpress",
    accent: "orange",
    hero: {
      eyebrowFr: "Comment ça marche",
      eyebrowEn: "How it works",
      titleFr: "L'IA sur votre WordPress, sans refonte",
      titleEn: "AI on your WordPress, no rebuild",
      blocks: [
        {
          icon: "Plug",
          prefixFr: "1",
          prefixEn: "1",
          labelFr: "On garde votre WordPress",
          labelEn: "We keep your WordPress",
          detailFr: "Thème, contenus, extensions : rien n'est cassé.",
          detailEn: "Theme, content, plugins: nothing broken.",
        },
        {
          icon: "MessageSquare",
          prefixFr: "2",
          prefixEn: "2",
          labelFr: "Chatbot ancré sur vos pages",
          labelEn: "Chatbot grounded in your pages",
          detailFr: "Réponses sourcées depuis vos articles et pages, sans invention.",
          detailEn: "Sourced answers from your posts and pages, no invention.",
        },
        {
          icon: "ShieldCheck",
          prefixFr: "3",
          prefixEn: "3",
          labelFr: "Hébergé en UE",
          labelEn: "EU-hosted",
          detailFr: "Données chez vous, conforme RGPD.",
          detailEn: "Data yours, GDPR-compliant.",
        },
      ],
      ariaFr:
        "Schéma : un chatbot IA ancré sur les contenus de votre WordPress, ajouté sans refonte, hébergé en UE.",
      ariaEn:
        "Diagram: an AI chatbot grounded in your WordPress content, added without rebuild, EU-hosted.",
    },
    fr: {
      eyebrow: "Stack · WordPress",
      title: "Un chatbot IA sur votre",
      titleEm: "WordPress",
      answer:
        "Votre site est sur WordPress ? On y greffe un chatbot IA ancré sur vos vrais contenus (articles, pages, FAQ), sans toucher à votre thème ni à vos extensions. Réponses sourcées, hébergement UE, en ligne en quelques semaines.",
      ctaPrimary: "Décrire mon projet · devis 48 h",
      ctaSecondary: "Voir le hub Sites web & SaaS",
      benefitsTitle: "Ce que ça change",
      benefits: [
        {
          title: "Sur votre WordPress actuel",
          description:
            "Pas de migration, pas de refonte : on ajoute l'IA par-dessus votre site et vos extensions existantes.",
        },
        {
          title: "Réponses ancrées, fiables",
          description:
            "Le chatbot répond depuis vos articles et pages, en citant ses sources — il n'invente pas.",
        },
        {
          title: "Léger, sans ralentir le site",
          description:
            "Intégration optimisée : aucune dégradation des performances ni de votre SEO existant.",
        },
      ],
      processTitle: PROCESS_TITLE_FR,
      processSteps: [
        {
          title: "On audite votre WordPress",
          description: "Thème, extensions, contenus : ce qui sert de source au chatbot.",
        },
        {
          title: "On indexe vos contenus",
          description: "Articles, pages, FAQ : transformés en source de réponse.",
        },
        {
          title: "On intègre proprement",
          description: "Widget léger, sans conflit d'extension, testé sur vos vrais cas.",
        },
        {
          title: "On met en ligne et on suit",
          description: "Mesure des réponses, ajustements, relais humain si besoin.",
        },
      ],
      metricsTitle: "Ce qu'on observe",
      metrics: [
        { number: "0", suffix: "refonte", label: "On garde votre WordPress" },
        { number: "0", suffix: "", label: "Réponse inventée (sourcé ou rien)" },
        { number: "UE", suffix: "", label: "Hébergement conforme RGPD" },
      ],
      faqTitle: "Questions fréquentes",
      faqs: [
        {
          id: "theme",
          question: "Faut-il changer de thème ou d'extensions ?",
          answer:
            "Non. On greffe le chatbot par-dessus votre WordPress existant, sans toucher à votre thème ni à vos extensions.",
        },
        {
          id: "perf",
          question: "Ça va ralentir mon site ?",
          answer:
            "Non. L'intégration est optimisée (chargement léger, asynchrone) pour préserver vos performances et votre SEO.",
        },
        {
          id: "woocommerce",
          question: "Et si j'ai WooCommerce ?",
          answer:
            "Le chatbot peut s'appuyer sur vos fiches produit et vos pages pour répondre aux questions clients, en plus du support.",
        },
        {
          id: "rgpd",
          question: "Où sont les données ?",
          answer:
            "En Union européenne, conforme RGPD. Vos contenus ne servent pas à entraîner un modèle tiers.",
        },
      ],
      ctaBlockTitle: "Un chatbot IA sur votre WordPress",
      ctaBlockDescription:
        "Décrivez votre site WordPress : on revient sous 48 h avec un périmètre, un forfait fixe et un délai.",
      why: {
        title: "Refondre un WordPress qui marche,",
        titleEm: "inutile",
        intro:
          "Votre WordPress fonctionne et est référencé ? Le refaire pour ajouter de l'IA serait un risque inutile.",
        points: [
          {
            title: "Une refonte met votre SEO en jeu",
            description:
              "Changer de site, c'est risquer de perdre votre référencement acquis. L'augmentation le préserve.",
          },
          {
            title: "L'IA se greffe, point",
            description:
              "On ajoute la valeur (chatbot ancré) sur l'existant, sans toucher à ce qui marche déjà.",
          },
        ],
      },
    },
    en: {
      eyebrow: "Stack · WordPress",
      title: "An AI chatbot on your",
      titleEm: "WordPress",
      answer:
        "Your site runs on WordPress? We graft an AI chatbot grounded in your real content (posts, pages, FAQ), without touching your theme or plugins. Sourced answers, EU hosting, live in a few weeks.",
      ctaPrimary: "Describe my project · 48 h quote",
      ctaSecondary: "See the Websites & SaaS hub",
      benefitsTitle: "What it changes",
      benefits: [
        {
          title: "On your current WordPress",
          description:
            "No migration, no rebuild: we add AI on top of your existing site and plugins.",
        },
        {
          title: "Grounded, reliable answers",
          description:
            "The chatbot answers from your posts and pages, citing sources — it doesn't invent.",
        },
        {
          title: "Light, no slowdown",
          description: "Optimised integration: no degradation of performance or your existing SEO.",
        },
      ],
      processTitle: PROCESS_TITLE_EN,
      processSteps: [
        {
          title: "We audit your WordPress",
          description: "Theme, plugins, content: what feeds the chatbot.",
        },
        {
          title: "We index your content",
          description: "Posts, pages, FAQ: turned into answer source.",
        },
        {
          title: "We integrate cleanly",
          description: "Light widget, no plugin conflict, tested on your real cases.",
        },
        {
          title: "We ship and monitor",
          description: "Answer measurement, tuning, human handover if needed.",
        },
      ],
      metricsTitle: "What we observe",
      metrics: [
        { number: "0", suffix: "rebuild", label: "We keep your WordPress" },
        { number: "0", suffix: "", label: "Invented answer (sourced or nothing)" },
        { number: "EU", suffix: "", label: "GDPR-compliant hosting" },
      ],
      faqTitle: "Frequently asked",
      faqs: [
        {
          id: "theme",
          question: "Do I need to change theme or plugins?",
          answer:
            "No. We graft the chatbot on top of your existing WordPress, without touching your theme or plugins.",
        },
        {
          id: "perf",
          question: "Will it slow my site?",
          answer:
            "No. The integration is optimised (light, async loading) to preserve your performance and SEO.",
        },
        {
          id: "woocommerce",
          question: "What if I use WooCommerce?",
          answer:
            "The chatbot can draw on your product sheets and pages to answer customer questions, on top of support.",
        },
        {
          id: "rgpd",
          question: "Where is the data?",
          answer:
            "In the EU, GDPR-compliant. Your content is not used to train a third-party model.",
        },
      ],
      ctaBlockTitle: "An AI chatbot on your WordPress",
      ctaBlockDescription:
        "Describe your WordPress site: we come back within 48 h with a scope, fixed fee and timeline.",
      why: {
        title: "Rebuilding a WordPress that works,",
        titleEm: "pointless",
        intro: "Your WordPress works and ranks? Rebuilding it to add AI would be a needless risk.",
        points: [
          {
            title: "A rebuild risks your SEO",
            description:
              "Changing site risks losing your earned ranking. Augmentation preserves it.",
          },
          {
            title: "AI just grafts on",
            description:
              "We add the value (grounded chatbot) on the existing, without touching what already works.",
          },
        ],
      },
    },
  },
  // ── NATIVE : créer un SaaS IA sur mesure (angle produit) ───────────────────
  {
    slug: "creer-saas-ia",
    projectType: "native",
    pathFr: "/sites-web-augmentes/creer-saas-ia",
    pathEn: "/sites-web-augmentes/creer-saas-ia",
    accent: "purple",
    hero: {
      eyebrowFr: "De l'idée au produit",
      eyebrowEn: "From idea to product",
      titleFr: "Votre SaaS IA, conçu et livré",
      titleEn: "Your AI SaaS, designed and delivered",
      blocks: [
        {
          icon: "Layers",
          prefixFr: "1",
          prefixEn: "1",
          labelFr: "On cadre le produit",
          labelEn: "We frame the product",
          detailFr: "Utilisateurs, flux, rôle de l'IA, premier jalon livrable.",
          detailEn: "Users, flows, AI role, first deliverable milestone.",
        },
        {
          icon: "Rocket",
          prefixFr: "2",
          prefixEn: "2",
          labelFr: "On construit par jalons",
          labelEn: "We build by milestones",
          detailFr: "Livraisons régulières testables, pas un tunnel de plusieurs mois.",
          detailEn: "Regular testable deliveries, not a multi-month tunnel.",
        },
        {
          icon: "ShieldCheck",
          prefixFr: "3",
          prefixEn: "3",
          labelFr: "Code et propriété à vous",
          labelEn: "Code and ownership yours",
          detailFr: "Hébergé en UE, conforme RGPD, aucune dépendance.",
          detailEn: "EU-hosted, GDPR-compliant, no lock-in.",
        },
      ],
      ariaFr:
        "Schéma : on cadre le produit, on construit par jalons testables, et on livre un SaaS dont le code et la propriété sont à vous, hébergé en UE.",
      ariaEn:
        "Diagram: we frame the product, build by testable milestones, and deliver a SaaS whose code and ownership are yours, EU-hosted.",
    },
    fr: {
      eyebrow: "Native · créer un SaaS IA",
      title: "Créez votre SaaS IA",
      titleEm: "sur mesure",
      answer:
        "Vous avez une idée de produit où l'IA est centrale ? On conçoit et développe votre SaaS sur mesure, pensé autour de l'IA dès le départ, livré par jalons testables. Code et propriété intégralement à vous, hébergé en UE.",
      ctaPrimary: "Décrire mon projet · devis 48 h",
      ctaSecondary: "Voir le hub Sites web & SaaS",
      benefitsTitle: "Ce que ça change",
      benefits: [
        {
          title: "Un vrai produit, pas un POC jetable",
          description:
            "Architecture pensée pour durer et grandir — pas une démo qu'on jette après le test.",
        },
        {
          title: "Livré par jalons",
          description:
            "Vous voyez le produit grandir et arbitrez en continu, plutôt que d'attendre une livraison finale.",
        },
        {
          title: "Vous en êtes propriétaire",
          description:
            "Code livré, documentation, hébergement UE — vous pouvez le faire évoluer avec qui vous voulez.",
        },
      ],
      processTitle: PROCESS_TITLE_FR,
      processSteps: [
        {
          title: "On cadre le produit",
          description: "Utilisateurs, flux, rôle exact de l'IA, périmètre du premier jalon.",
        },
        {
          title: "On conçoit l'architecture",
          description: "Fondations IA + données, sécurité et conformité intégrées.",
        },
        {
          title: "On construit par jalons",
          description: "Livraisons régulières testables, retours intégrés en continu.",
        },
        {
          title: "On livre et on transfère",
          description: "Code, documentation, propriété — vous gardez la main.",
        },
      ],
      metricsTitle: "Ce qu'on observe",
      metrics: [
        { number: "IA", suffix: "first", label: "Au cœur du produit" },
        { number: "100%", suffix: "", label: "Propriété du code à vous" },
        { number: "UE", suffix: "", label: "Hébergement conforme RGPD" },
      ],
      faqTitle: "Questions fréquentes",
      faqs: [
        {
          id: "vs-plateforme",
          question: "Différence avec « plateforme IA-native » ?",
          answer:
            "C'est le même paradigme (build from scratch autour de l'IA). « Créer un SaaS IA » insiste sur l'angle produit commercialisable ; « plateforme native » sur l'angle outil métier interne. On vous aide à cadrer au démarrage.",
        },
        {
          id: "mvp",
          question: "Peut-on commencer petit (MVP) ?",
          answer:
            "Oui, c'est recommandé : un premier jalon resserré, mis entre les mains d'utilisateurs réels, puis on itère. Pas de tunnel de plusieurs mois.",
        },
        {
          id: "propriete",
          question: "À qui appartient le code ?",
          answer:
            "À vous, intégralement. On livre code et documentation — aucune dépendance technique à Axion-IA.",
        },
        {
          id: "rgpd",
          question: "Et la conformité ?",
          answer:
            "RGPD et hébergement UE pensés dès la conception — y compris comme argument vis-à-vis de vos propres clients.",
        },
      ],
      ctaBlockTitle: "Donnez vie à votre SaaS IA",
      ctaBlockDescription:
        "Décrivez votre idée de produit : on revient sous 48 h avec un premier jalon cadré, un forfait fixe et un délai garanti.",
      why: {
        title: "Un SaaS IA bricolé",
        titleEm: "ne tient pas",
        intro:
          "Assembler vite un produit IA sans architecture finit par coincer dès les premiers vrais utilisateurs.",
        points: [
          {
            title: "Le « vite fait » plafonne",
            description:
              "Sans fondations pensées pour l'IA et la donnée, le produit cale en perfs, en coûts et en évolutivité.",
          },
          {
            title: "Un produit se conçoit",
            description:
              "Architecture, données et expérience pensées dès le départ — un vrai avantage produit, pas une démo.",
          },
        ],
      },
    },
    en: {
      eyebrow: "Native · build an AI SaaS",
      title: "Build your AI SaaS",
      titleEm: "bespoke",
      answer:
        "Have a product idea where AI is central? We design and develop your bespoke SaaS, built around AI from day one, delivered by testable milestones. Code and ownership fully yours, EU-hosted.",
      ctaPrimary: "Describe my project · 48 h quote",
      ctaSecondary: "See the Websites & SaaS hub",
      benefitsTitle: "What it changes",
      benefits: [
        {
          title: "A real product, not a throwaway POC",
          description:
            "Architecture built to last and grow — not a demo you discard after the test.",
        },
        {
          title: "Delivered by milestones",
          description:
            "You watch the product grow and steer continuously, rather than waiting for a final delivery.",
        },
        {
          title: "You own it",
          description:
            "Code delivered, documentation, EU hosting — you can evolve it with whoever you want.",
        },
      ],
      processTitle: PROCESS_TITLE_EN,
      processSteps: [
        {
          title: "We frame the product",
          description: "Users, flows, exact AI role, first milestone scope.",
        },
        {
          title: "We design the architecture",
          description: "AI + data foundations, security and compliance built in.",
        },
        {
          title: "We build by milestones",
          description: "Regular testable deliveries, feedback integrated continuously.",
        },
        {
          title: "We deliver and hand over",
          description: "Code, documentation, ownership — you keep control.",
        },
      ],
      metricsTitle: "What we observe",
      metrics: [
        { number: "AI", suffix: "first", label: "At the product core" },
        { number: "100%", suffix: "", label: "Code ownership yours" },
        { number: "EU", suffix: "", label: "GDPR-compliant hosting" },
      ],
      faqTitle: "Frequently asked",
      faqs: [
        {
          id: "vs-plateforme",
          question: "Difference from « AI-native platform »?",
          answer:
            "Same paradigm (build from scratch around AI). « Build an AI SaaS » stresses the marketable product angle; « native platform » the internal business tool angle. We help you frame it at kickoff.",
        },
        {
          id: "mvp",
          question: "Can we start small (MVP)?",
          answer:
            "Yes, recommended: a tight first milestone, in real users' hands, then iterate. No multi-month tunnel.",
        },
        {
          id: "propriete",
          question: "Who owns the code?",
          answer: "You, entirely. We deliver code and docs — no technical lock-in to Axion-IA.",
        },
        {
          id: "rgpd",
          question: "What about compliance?",
          answer:
            "GDPR and EU hosting designed from the start — including as an argument toward your own customers.",
        },
      ],
      ctaBlockTitle: "Bring your AI SaaS to life",
      ctaBlockDescription:
        "Describe your product idea: we come back within 48 h with a scoped first milestone, a fixed fee and a guaranteed timeline.",
      why: {
        title: "A patched-together AI SaaS",
        titleEm: "won't hold",
        intro:
          "Quickly assembling an AI product without architecture eventually jams with the first real users.",
        points: [
          {
            title: "« Quick and dirty » hits a ceiling",
            description:
              "Without foundations built for AI and data, the product stalls on performance, cost and scalability.",
          },
          {
            title: "A product must be designed",
            description:
              "Architecture, data and experience designed from the start — a real product edge, not a demo.",
          },
        ],
      },
    },
  },

  // ── AUGMENTATION : chatbot/IA sur Shopify (stack e-commerce) ────────────────
  {
    slug: "shopify",
    projectType: "augmentation",
    pathFr: "/sites-web-augmentes/shopify",
    pathEn: "/sites-web-augmentes/shopify",
    accent: "green",
    hero: {
      eyebrowFr: "Comment ça marche",
      eyebrowEn: "How it works",
      titleFr: "L'IA sur votre Shopify, sans refonte",
      titleEn: "AI on your Shopify, no rebuild",
      blocks: [
        {
          icon: "Plug",
          prefixFr: "1",
          prefixEn: "1",
          labelFr: "On garde votre Shopify",
          labelEn: "We keep your Shopify",
          detailFr: "Thème, apps, catalogue : rien n'est cassé.",
          detailEn: "Theme, apps, catalogue: nothing broken.",
        },
        {
          icon: "Sparkles",
          prefixFr: "2",
          prefixEn: "2",
          labelFr: "Chatbot + reco produit",
          labelEn: "Chatbot + product reco",
          detailFr: "Assistant d'achat ancré sur vos fiches + suggestions pertinentes.",
          detailEn: "Shopping assistant grounded in your sheets + relevant suggestions.",
        },
        {
          icon: "Rocket",
          prefixFr: "3",
          prefixEn: "3",
          labelFr: "Panier en hausse",
          labelEn: "Higher cart",
          detailFr: "Moins de questions support, plus de ventes complémentaires.",
          detailEn: "Fewer support questions, more add-on sales.",
        },
      ],
      ariaFr:
        "Schéma : sur votre boutique Shopify existante, on greffe un assistant d'achat IA et des recommandations produit, sans refonte, pour augmenter le panier.",
      ariaEn:
        "Diagram: on your existing Shopify store, we graft an AI shopping assistant and product recommendations, no rebuild, to lift the cart.",
    },
    fr: {
      eyebrow: "Stack · Shopify",
      title: "Boostez votre",
      titleEm: "Shopify avec l'IA",
      answer:
        "Votre boutique est sur Shopify ? On y greffe un assistant d'achat IA (ancré sur vos fiches produit) et des recommandations pertinentes, sans toucher à votre thème ni à vos apps. Moins de questions support, un panier moyen plus élevé.",
      ctaPrimary: "Décrire mon projet · devis 48 h",
      ctaSecondary: "Voir le hub Sites web & SaaS",
      benefitsTitle: "Ce que ça change",
      benefits: [
        {
          title: "Un vendeur IA 24/7",
          description:
            "L'assistant répond aux questions produit (tailles, délais, compatibilités) et oriente vers le bon article — depuis vos fiches, sans inventer.",
        },
        {
          title: "Panier moyen en hausse",
          description:
            "Recommandations pertinentes (cross-sell, up-sell) sur fiche et panier, adaptées à chaque visiteur.",
        },
        {
          title: "Sur votre Shopify actuel",
          description:
            "Pas de migration ni de refonte : on ajoute l'IA par-dessus votre boutique et vos apps existantes.",
        },
      ],
      processTitle: PROCESS_TITLE_FR,
      processSteps: [
        {
          title: "On audite votre boutique",
          description: "Catalogue, fiches, apps, questions clients récurrentes.",
        },
        {
          title: "On indexe votre catalogue",
          description: "Fiches produit transformées en source de réponse + reco.",
        },
        {
          title: "On intègre proprement",
          description: "Sans conflit d'app, testé sur vos vrais parcours d'achat.",
        },
        {
          title: "On met en ligne et on mesure",
          description: "Taux de réponse, impact sur le panier, itérations.",
        },
      ],
      metricsTitle: "Ce qu'on observe",
      metrics: [
        { number: "24/7", suffix: "", label: "Assistant d'achat" },
        { number: "+", suffix: "panier", label: "Cross-sell pertinent" },
        { number: "0", suffix: "refonte", label: "On garde votre Shopify" },
      ],
      faqTitle: "Questions fréquentes",
      faqs: [
        {
          id: "apps",
          question: "Faut-il changer mon thème ou mes apps ?",
          answer:
            "Non. On greffe l'IA par-dessus votre Shopify existant, sans toucher à votre thème ni à vos apps.",
        },
        {
          id: "fiches",
          question: "Sur quoi répond l'assistant ?",
          answer:
            "Sur vos fiches produit, vos pages (livraison, retours) et votre FAQ — sources que vous choisissez. Il cite, ne invente pas.",
        },
        {
          id: "reco",
          question: "Les recommandations, ça marche vraiment ?",
          answer:
            "Elles s'appuient sur le comportement réel sur votre boutique (sans cookie tiers) et votre catalogue — bien plus pertinentes qu'une liste de bestsellers figée.",
        },
        {
          id: "perf",
          question: "Ça ralentit la boutique ?",
          answer:
            "Non : intégration légère et asynchrone, pensée pour préserver les performances et la conversion.",
        },
      ],
      ctaBlockTitle: "Un vendeur IA sur votre Shopify",
      ctaBlockDescription:
        "Décrivez votre boutique Shopify : on revient sous 48 h avec un périmètre, un forfait fixe et un délai.",
      why: {
        title: "Refondre une boutique qui vend,",
        titleEm: "risqué",
        intro:
          "Votre Shopify tourne et convertit ? Le refaire pour ajouter de l'IA serait un risque inutile.",
        points: [
          {
            title: "Une migration met vos ventes en jeu",
            description:
              "Changer de boutique, c'est risquer SEO, apps et tunnel de conversion rodés. L'augmentation préserve tout.",
          },
          {
            title: "L'IA se greffe sur l'existant",
            description:
              "On ajoute la valeur (assistant + reco) sur votre Shopify actuel, sans rien casser.",
          },
        ],
      },
    },
    en: {
      eyebrow: "Stack · Shopify",
      title: "Boost your",
      titleEm: "Shopify with AI",
      answer:
        "Your store runs on Shopify? We graft an AI shopping assistant (grounded in your product sheets) and relevant recommendations, without touching your theme or apps. Fewer support questions, a higher average cart.",
      ctaPrimary: "Describe my project · 48 h quote",
      ctaSecondary: "See the Websites & SaaS hub",
      benefitsTitle: "What it changes",
      benefits: [
        {
          title: "A 24/7 AI seller",
          description:
            "The assistant answers product questions (sizes, delays, compatibility) and guides to the right item — from your sheets, no invention.",
        },
        {
          title: "Higher average cart",
          description:
            "Relevant recommendations (cross-sell, up-sell) on sheet and cart, tailored to each visitor.",
        },
        {
          title: "On your current Shopify",
          description: "No migration or rebuild: we add AI on top of your store and existing apps.",
        },
      ],
      processTitle: PROCESS_TITLE_EN,
      processSteps: [
        {
          title: "We audit your store",
          description: "Catalogue, sheets, apps, recurring customer questions.",
        },
        {
          title: "We index your catalogue",
          description: "Product sheets turned into answer + reco source.",
        },
        {
          title: "We integrate cleanly",
          description: "No app conflict, tested on your real purchase journeys.",
        },
        { title: "We ship and measure", description: "Answer rate, cart impact, iterations." },
      ],
      metricsTitle: "What we observe",
      metrics: [
        { number: "24/7", suffix: "", label: "Shopping assistant" },
        { number: "+", suffix: "cart", label: "Relevant cross-sell" },
        { number: "0", suffix: "rebuild", label: "We keep your Shopify" },
      ],
      faqTitle: "Frequently asked",
      faqs: [
        {
          id: "apps",
          question: "Do I need to change my theme or apps?",
          answer:
            "No. We graft AI on top of your existing Shopify, without touching theme or apps.",
        },
        {
          id: "fiches",
          question: "What does the assistant answer on?",
          answer:
            "Your product sheets, pages (shipping, returns) and FAQ — sources you choose. It cites, doesn't invent.",
        },
        {
          id: "reco",
          question: "Do recommendations really work?",
          answer:
            "They rely on real behaviour on your store (no third-party cookie) and your catalogue — far more relevant than a fixed bestseller list.",
        },
        {
          id: "perf",
          question: "Will it slow the store?",
          answer: "No: light, async integration designed to preserve performance and conversion.",
        },
      ],
      ctaBlockTitle: "An AI seller on your Shopify",
      ctaBlockDescription:
        "Describe your Shopify store: we come back within 48 h with a scope, fixed fee and timeline.",
      why: {
        title: "Rebuilding a store that sells,",
        titleEm: "risky",
        intro: "Your Shopify works and converts? Rebuilding it to add AI would be a needless risk.",
        points: [
          {
            title: "A migration risks your sales",
            description:
              "Changing store risks SEO, apps and a tuned conversion funnel. Augmentation preserves it all.",
          },
          {
            title: "AI grafts onto the existing",
            description:
              "We add the value (assistant + reco) on your current Shopify, without breaking anything.",
          },
        ],
      },
    },
  },

  // ── BRIQUE : Personnalisation dynamique (transverse, sans cookie tiers) ─────
  {
    slug: "personnalisation",
    projectType: "transverse",
    pathFr: "/sites-web-augmentes/personnalisation",
    pathEn: "/sites-web-augmentes/personnalisation",
    accent: "primary",
    hero: {
      eyebrowFr: "Comment ça marche",
      eyebrowEn: "How it works",
      titleFr: "Le bon contenu, à chaque visiteur",
      titleEn: "The right content, to each visitor",
      blocks: [
        {
          icon: "Sparkles",
          prefixFr: "1",
          prefixEn: "1",
          labelFr: "Lit l'intention",
          labelEn: "Reads intent",
          detailFr: "Comportement sur votre site, en temps réel — sans cookie tiers.",
          detailEn: "On-site behaviour, in real time — no third-party cookie.",
        },
        {
          icon: "Layers",
          prefixFr: "2",
          prefixEn: "2",
          labelFr: "Adapte la page",
          labelEn: "Adapts the page",
          detailFr: "Mise en avant, CTA, contenus ajustés au profil du visiteur.",
          detailEn: "Highlights, CTA, content adjusted to visitor profile.",
        },
        {
          icon: "Rocket",
          prefixFr: "3",
          prefixEn: "3",
          labelFr: "Convertit mieux",
          labelEn: "Converts better",
          detailFr: "Un message pertinent au bon moment, plus de conversions.",
          detailEn: "A relevant message at the right time, more conversions.",
        },
      ],
      ariaFr:
        "Schéma : l'IA lit l'intention du visiteur (comportement sur site, sans cookie tiers) et adapte le contenu de la page pour mieux convertir.",
      ariaEn:
        "Diagram: AI reads visitor intent (on-site behaviour, no third-party cookie) and adapts the page content to convert better.",
    },
    fr: {
      eyebrow: "Brique IA · Personnalisation",
      title: "Un site qui s'adapte",
      titleEm: "à chaque visiteur",
      answer:
        "On rend votre site capable d'adapter ses contenus et ses appels à l'action selon l'intention de chaque visiteur, comprise en temps réel — sans cookie tiers ni pistage publicitaire. Un message pertinent au bon moment, donc plus de conversions, conforme RGPD.",
      ctaPrimary: "Décrire mon projet · devis 48 h",
      ctaSecondary: "Voir le hub Sites web & SaaS",
      benefitsTitle: "Ce que ça change",
      benefits: [
        {
          title: "Pertinence en temps réel",
          description:
            "Le site met en avant le contenu, l'offre ou le CTA les plus utiles à CE visiteur, selon son comportement.",
        },
        {
          title: "Sans cookie tiers",
          description:
            "La personnalisation vient du comportement sur votre propre site, pas du pistage publicitaire — conforme RGPD.",
        },
        {
          title: "Plus de conversions",
          description:
            "Un message adapté au bon moment convertit davantage qu'une page identique pour tout le monde.",
        },
      ],
      processTitle: PROCESS_TITLE_FR,
      processSteps: [
        {
          title: "On définit les segments utiles",
          description: "Quels profils, quelles intentions, quels contenus à adapter.",
        },
        {
          title: "On branche les signaux",
          description: "Comportement on-site (pages, parcours) sans cookie tiers.",
        },
        {
          title: "On personnalise les zones clés",
          description: "Hero, mises en avant, CTA : adaptés en temps réel.",
        },
        {
          title: "On mesure et on affine",
          description: "Impact sur la conversion par segment, itérations.",
        },
      ],
      metricsTitle: "Ce qu'on observe",
      metrics: [
        { number: "+", suffix: "conversion", label: "Message pertinent par profil" },
        { number: "0", suffix: "cookie", label: "Sans pistage tiers, RGPD" },
        { number: "UE", suffix: "", label: "Hébergement conforme RGPD" },
      ],
      faqTitle: "Questions fréquentes",
      faqs: [
        {
          id: "cookie",
          question: "Faut-il des cookies tiers ?",
          answer:
            "Non. La personnalisation s'appuie sur le comportement sur votre propre site (pages vues, parcours), pas sur le pistage publicitaire — conforme RGPD.",
        },
        {
          id: "quoi",
          question: "Qu'est-ce qui se personnalise ?",
          answer:
            "Les zones à fort impact : hero, mises en avant, recommandations, CTA. On cible ce qui bouge l'aiguille, pas tout le site.",
        },
        {
          id: "stack",
          question: "Compatible avec mon site ?",
          answer:
            "Oui, sur n'importe quelle stack (WordPress, Shopify, Next.js, Laravel…), sans refonte.",
        },
        {
          id: "mesure",
          question: "Comment mesure-t-on le gain ?",
          answer:
            "Par comparaison avant/après et par segment : taux de conversion, engagement. On affine selon les résultats réels.",
        },
      ],
      ctaBlockTitle: "Un site qui parle à chaque visiteur",
      ctaBlockDescription:
        "Décrivez votre site et vos objectifs : on revient sous 48 h avec un périmètre, un forfait fixe et un délai.",
      why: {
        title: "Une page identique pour tous,",
        titleEm: "une occasion ratée",
        intro:
          "Afficher exactement le même contenu à un primo-visiteur et à un client fidèle laisse de la conversion sur la table.",
        points: [
          {
            title: "Le générique convertit moins",
            description:
              "Un message « moyen » pour tout le monde ne parle vraiment à personne. La pertinence, elle, déclenche l'action.",
          },
          {
            title: "La perso sans pistage est possible",
            description:
              "Pas besoin de cookies tiers : le comportement sur votre site suffit à adapter, en respectant le RGPD.",
          },
        ],
      },
    },
    en: {
      eyebrow: "AI brick · Personalisation",
      title: "A site that adapts",
      titleEm: "to each visitor",
      answer:
        "We make your site able to adapt its content and calls to action to each visitor's intent, understood in real time — without third-party cookies or ad tracking. A relevant message at the right moment, so more conversions, GDPR-compliant.",
      ctaPrimary: "Describe my project · 48 h quote",
      ctaSecondary: "See the Websites & SaaS hub",
      benefitsTitle: "What it changes",
      benefits: [
        {
          title: "Real-time relevance",
          description:
            "The site highlights the content, offer or CTA most useful to THIS visitor, based on behaviour.",
        },
        {
          title: "No third-party cookie",
          description:
            "Personalisation comes from behaviour on your own site, not ad tracking — GDPR-compliant.",
        },
        {
          title: "More conversions",
          description:
            "A message tailored at the right time converts better than the same page for everyone.",
        },
      ],
      processTitle: PROCESS_TITLE_EN,
      processSteps: [
        {
          title: "We define useful segments",
          description: "Which profiles, intents, content to adapt.",
        },
        {
          title: "We wire the signals",
          description: "On-site behaviour (pages, journey) without third-party cookies.",
        },
        {
          title: "We personalise key zones",
          description: "Hero, highlights, CTA: adapted in real time.",
        },
        {
          title: "We measure and refine",
          description: "Conversion impact per segment, iterations.",
        },
      ],
      metricsTitle: "What we observe",
      metrics: [
        { number: "+", suffix: "conversion", label: "Relevant message per profile" },
        { number: "0", suffix: "cookie", label: "No third-party tracking, GDPR" },
        { number: "EU", suffix: "", label: "GDPR-compliant hosting" },
      ],
      faqTitle: "Frequently asked",
      faqs: [
        {
          id: "cookie",
          question: "Are third-party cookies needed?",
          answer:
            "No. Personalisation relies on behaviour on your own site (pages viewed, journey), not ad tracking — GDPR-compliant.",
        },
        {
          id: "quoi",
          question: "What gets personalised?",
          answer:
            "High-impact zones: hero, highlights, recommendations, CTA. We target what moves the needle, not the whole site.",
        },
        {
          id: "stack",
          question: "Compatible with my site?",
          answer: "Yes, on any stack (WordPress, Shopify, Next.js, Laravel…), no rebuild.",
        },
        {
          id: "mesure",
          question: "How do we measure the gain?",
          answer:
            "By before/after and per-segment comparison: conversion rate, engagement. We refine on real results.",
        },
      ],
      ctaBlockTitle: "A site that speaks to each visitor",
      ctaBlockDescription:
        "Describe your site and goals: we come back within 48 h with a scope, fixed fee and timeline.",
      why: {
        title: "One identical page for all,",
        titleEm: "a missed chance",
        intro:
          "Showing the exact same content to a first-time visitor and a loyal customer leaves conversion on the table.",
        points: [
          {
            title: "Generic converts less",
            description:
              "An « average » message for everyone truly speaks to no one. Relevance triggers action.",
          },
          {
            title: "Personalisation without tracking is possible",
            description:
              "No third-party cookies needed: on-site behaviour is enough to adapt, GDPR-compliant.",
          },
        ],
      },
    },
  },
  // ── EXPERTISE : UX/UI & Product Design ─────────────────────────────────────
  {
    slug: "ux-ui-product-design",
    projectType: "transverse",
    pathFr: "/sites-web-augmentes/ux-ui-product-design",
    pathEn: "/sites-web-augmentes/ux-ui-product-design",
    accent: "purple",
    hero: {
      eyebrowFr: "Comment on conçoit",
      eyebrowEn: "How we design",
      titleFr: "Des interfaces pensées pour vos utilisateurs",
      titleEn: "Interfaces designed for your users",
      blocks: [
        {
          icon: "Search",
          prefixFr: "1",
          prefixEn: "1",
          labelFr: "On comprend",
          labelEn: "We understand",
          detailFr:
            "UX research, personas, parcours : on part de l'utilisateur réel, pas d'hypothèses.",
          detailEn:
            "UX research, personas, journeys: we start from the real user, not assumptions.",
        },
        {
          icon: "Layers",
          prefixFr: "2",
          prefixEn: "2",
          labelFr: "On structure",
          labelEn: "We structure",
          detailFr: "Wireframes, design system et maquettes Figma cohérentes avec votre marque.",
          detailEn: "Wireframes, design system and Figma mockups consistent with your brand.",
        },
        {
          icon: "Rocket",
          prefixFr: "3",
          prefixEn: "3",
          labelFr: "On valide",
          labelEn: "We validate",
          detailFr: "Prototype testable et A/B testing avant le développement — on dérisque tôt.",
          detailEn: "Testable prototype and A/B testing before development — we de-risk early.",
        },
      ],
      ariaFr:
        "Schéma : on comprend l'utilisateur (research, personas), on structure l'interface (wireframes, design system, Figma) puis on valide par prototype et A/B testing avant développement.",
      ariaEn:
        "Diagram: we understand the user (research, personas), structure the interface (wireframes, design system, Figma) then validate via prototype and A/B testing before development.",
    },
    fr: {
      eyebrow: "Expertise · UX/UI & Product Design",
      title: "Le design qui",
      titleEm: "convertit",
      answer:
        "On conçoit l'expérience de votre site, application ou plateforme SaaS de bout en bout : recherche utilisateur, parcours, wireframes, design system, maquettes Figma et prototype testable. Une interface claire et fidèle à votre marque, validée avant le développement — du sur-mesure, pas un thème plaqué.",
      ctaPrimary: "Décrire mon projet · devis 48 h",
      ctaSecondary: "Voir le hub Sites web & SaaS",
      benefitsTitle: "Ce que ça change",
      benefits: [
        {
          title: "Partir de l'utilisateur",
          description:
            "Research, personas et parcours : on conçoit pour les besoins réels de vos utilisateurs, pas pour des suppositions.",
        },
        {
          title: "Un design system cohérent",
          description:
            "Composants réutilisables, charte appliquée partout : une interface homogène qui accélère aussi le développement.",
        },
        {
          title: "Validé avant de coder",
          description:
            "Prototype Figma testable et A/B testing : on lève les doutes tôt, avant d'investir dans le développement.",
        },
      ],
      processTitle: PROCESS_TITLE_FR,
      processSteps: [
        {
          title: "Recherche & cadrage",
          description: "Entretiens, personas, user flows, sitemap : on cartographie le besoin.",
        },
        {
          title: "Wireframes",
          description: "Structure et ergonomie des écrans clés, avant tout habillage visuel.",
        },
        {
          title: "Design system & maquettes",
          description: "Charte appliquée, composants, maquettes haute fidélité sur Figma.",
        },
        {
          title: "Prototype & test",
          description:
            "Prototype interactif testable par vos utilisateurs, itérations, A/B testing.",
        },
      ],
      metricsTitle: "Comment on travaille",
      metrics: [
        { number: "Figma", suffix: "", label: "Maquettes & prototype interactif" },
        { number: "48", suffix: "h", label: "Devis ferme après cadrage" },
        { number: "100", suffix: "%", label: "Design & fichiers livrés, à vous" },
      ],
      faqTitle: "Questions fréquentes",
      faqs: [
        {
          id: "scope",
          question: "Vous faites vraiment l'UX/UI, pas seulement l'IA ?",
          answer:
            "Oui. On conçoit l'expérience complète — research, wireframes, design system, maquettes Figma, prototype — pour un site, une app ou une plateforme SaaS, avec ou sans brique IA. C'est un métier à part entière chez nous.",
        },
        {
          id: "refonte",
          question: "Vous designez une nouvelle interface ou vous refondez l'existante ?",
          answer:
            "Les deux. On part d'une page blanche pour une création, ou on audite et refond une interface existante (audit UX/UI, recommandations priorisées, nouvelles maquettes).",
        },
        {
          id: "dev",
          question: "Le design est-il livré prêt à développer ?",
          answer:
            "Oui : design system, maquettes et specs sont livrés exploitables directement, que le développement soit fait par nous ou par vos équipes. Vous gardez tous les fichiers.",
        },
        {
          id: "marque",
          question: "Vous respectez notre charte graphique ?",
          answer:
            "Oui. On part de votre identité de marque (ou on vous aide à la poser si besoin) et on l'applique de façon cohérente sur l'ensemble des écrans.",
        },
      ],
      ctaBlockTitle: "Une interface pensée pour vos utilisateurs",
      ctaBlockDescription:
        "Décrivez votre projet et vos objectifs : on revient sous 48 h avec un périmètre, un forfait fixe et un délai.",
      why: {
        title: "Un beau site ne suffit pas,",
        titleEm: "il doit convertir",
        intro:
          "Une interface séduisante mais confuse fait fuir. Le design, c'est d'abord rendre l'usage évident — l'esthétique sert la conversion, pas l'inverse.",
        points: [
          {
            title: "L'ergonomie avant l'habillage",
            description:
              "On structure les parcours et l'ergonomie d'abord, puis on habille : un design qui guide l'utilisateur vers l'action.",
          },
          {
            title: "Tester coûte moins que se tromper",
            description:
              "Valider une maquette par un prototype testable évite de coder une mauvaise idée — on dérisque avant le développement.",
          },
        ],
      },
    },
    en: {
      eyebrow: "Expertise · UX/UI & Product Design",
      title: "Design that",
      titleEm: "converts",
      answer:
        "We design the experience of your website, app or SaaS platform end to end: user research, journeys, wireframes, design system, Figma mockups and testable prototype. A clear interface true to your brand, validated before development — bespoke, not a slapped-on theme.",
      ctaPrimary: "Describe my project · 48 h quote",
      ctaSecondary: "See the Websites & SaaS hub",
      benefitsTitle: "What it changes",
      benefits: [
        {
          title: "Start from the user",
          description:
            "Research, personas and journeys: we design for your users' real needs, not for assumptions.",
        },
        {
          title: "A consistent design system",
          description:
            "Reusable components, brand applied everywhere: a homogeneous interface that also speeds up development.",
        },
        {
          title: "Validated before coding",
          description:
            "Testable Figma prototype and A/B testing: we clear doubts early, before investing in development.",
        },
      ],
      processTitle: PROCESS_TITLE_EN,
      processSteps: [
        {
          title: "Research & framing",
          description: "Interviews, personas, user flows, sitemap: we map the need.",
        },
        {
          title: "Wireframes",
          description: "Structure and ergonomics of key screens, before any visual styling.",
        },
        {
          title: "Design system & mockups",
          description: "Brand applied, components, high-fidelity Figma mockups.",
        },
        {
          title: "Prototype & test",
          description: "Interactive prototype testable by your users, iterations, A/B testing.",
        },
      ],
      metricsTitle: "How we work",
      metrics: [
        { number: "Figma", suffix: "", label: "Mockups & interactive prototype" },
        { number: "48", suffix: "h", label: "Firm quote after framing" },
        { number: "100", suffix: "%", label: "Design & files delivered, yours" },
      ],
      faqTitle: "Frequently asked questions",
      faqs: [
        {
          id: "scope",
          question: "Do you really do UX/UI, not just AI?",
          answer:
            "Yes. We design the full experience — research, wireframes, design system, Figma mockups, prototype — for a website, app or SaaS platform, with or without an AI brick. It's a discipline in its own right for us.",
        },
        {
          id: "refonte",
          question: "Do you design a new interface or redesign the existing one?",
          answer:
            "Both. We start from a blank page for a new build, or audit and redesign an existing interface (UX/UI audit, prioritised recommendations, new mockups).",
        },
        {
          id: "dev",
          question: "Is the design delivered ready to develop?",
          answer:
            "Yes: design system, mockups and specs are delivered directly usable, whether development is done by us or your teams. You keep all the files.",
        },
        {
          id: "marque",
          question: "Do you respect our brand guidelines?",
          answer:
            "Yes. We start from your brand identity (or help you set one if needed) and apply it consistently across every screen.",
        },
      ],
      ctaBlockTitle: "An interface designed for your users",
      ctaBlockDescription:
        "Describe your project and goals: we come back within 48 h with a scope, a fixed package and a timeline.",
      why: {
        title: "A pretty site is not enough,",
        titleEm: "it must convert",
        intro:
          "An attractive but confusing interface drives people away. Design is first about making usage obvious — aesthetics serve conversion, not the other way around.",
        points: [
          {
            title: "Ergonomics before styling",
            description:
              "We structure journeys and ergonomics first, then style: a design that guides the user toward action.",
          },
          {
            title: "Testing costs less than getting it wrong",
            description:
              "Validating a mockup with a testable prototype avoids coding a bad idea — we de-risk before development.",
          },
        ],
      },
    },
  },
  // ── E-COMMERCE : WooCommerce (auto-hébergé, WordPress) ─────────────────────
  {
    slug: "woocommerce",
    projectType: "augmentation",
    pathFr: "/sites-web-augmentes/woocommerce",
    pathEn: "/sites-web-augmentes/woocommerce",
    accent: "green",
    hero: {
      eyebrowFr: "Comment ça marche",
      eyebrowEn: "How it works",
      titleFr: "L'IA sur votre WooCommerce, sans louer de plateforme",
      titleEn: "AI on your WooCommerce, without renting a platform",
      blocks: [
        {
          icon: "Plug",
          prefixFr: "1",
          prefixEn: "1",
          labelFr: "On reste sur votre boutique",
          labelEn: "We stay on your store",
          detailFr: "Thème, extensions, catalogue WooCommerce : on greffe via hooks et REST API.",
          detailEn: "Theme, plugins, WooCommerce catalogue: we graft via hooks and REST API.",
        },
        {
          icon: "Sparkles",
          prefixFr: "2",
          prefixEn: "2",
          labelFr: "Assistant + reco produit",
          labelEn: "Assistant + product reco",
          detailFr: "Conseiller d'achat ancré sur vos fiches + cross-sell pertinent au panier.",
          detailEn: "Buying advisor grounded in your sheets + relevant cart cross-sell.",
        },
        {
          icon: "Database",
          prefixFr: "3",
          prefixEn: "3",
          labelFr: "Vos données chez vous",
          labelEn: "Your data with you",
          detailFr: "Auto-hébergé, hébergement UE possible : aucune dépendance plateforme.",
          detailEn: "Self-hosted, EU hosting possible: no platform lock-in.",
        },
      ],
      ariaFr:
        "Schéma : on greffe l'IA sur votre WooCommerce via hooks et REST API (assistant d'achat, reco produit), en gardant vos données auto-hébergées sans dépendance plateforme.",
      ariaEn:
        "Diagram: we graft AI onto your WooCommerce via hooks and REST API (buying assistant, product reco), keeping your data self-hosted without platform lock-in.",
    },
    fr: {
      eyebrow: "E-commerce · WooCommerce",
      title: "Votre boutique WooCommerce,",
      titleEm: "augmentée par l'IA",
      answer:
        "On greffe l'IA sur votre boutique WooCommerce sans la refondre ni la migrer vers une plateforme louée : assistant d'achat ancré sur votre catalogue, recommandations cross-sell, génération de fiches produit, recherche sémantique, relance de panier. Tout reste auto-hébergé — vous gardez la propriété de votre boutique, de vos données et du code.",
      ctaPrimary: "Décrire mon projet · devis 48 h",
      ctaSecondary: "Voir le hub Sites web & SaaS",
      benefitsTitle: "Ce que ça change",
      benefits: [
        {
          title: "Pas de dépendance plateforme",
          description:
            "WooCommerce est auto-hébergé : on greffe l'IA via les hooks et la REST API, sans vous enfermer dans un écosystème loué.",
        },
        {
          title: "Plus de panier moyen",
          description:
            "Recommandations cross-sell et up-sell branchées sur votre catalogue réel et le comportement d'achat.",
        },
        {
          title: "Fiches produit en masse",
          description:
            "Génération et enrichissement des descriptions produit à grande échelle, dans votre ton, sans agence de rédaction.",
        },
      ],
      processTitle: PROCESS_TITLE_FR,
      processSteps: [
        {
          title: "Audit de la boutique",
          description: "Thème, extensions, volume catalogue, REST API : on cadre le périmètre.",
        },
        {
          title: "Branchement IA",
          description:
            "Hooks WooCommerce, widget ou extension sur mesure — sans casser l'existant.",
        },
        {
          title: "Catalogue & conversion",
          description: "Assistant d'achat, reco, fiches générées, recherche sémantique produit.",
        },
        {
          title: "Mesure & itération",
          description: "Impact sur panier moyen, taux d'ajout, tickets support — on affine.",
        },
      ],
      metricsTitle: "Comment on travaille",
      metrics: [
        { number: "REST", suffix: "API", label: "Greffe via hooks WooCommerce" },
        { number: "UE", suffix: "", label: "Auto-hébergé, hébergement UE possible" },
        { number: "100", suffix: "%", label: "Boutique & données à vous" },
      ],
      faqTitle: "Questions fréquentes",
      faqs: [
        {
          id: "migration",
          question: "Faut-il migrer ma boutique ?",
          answer:
            "Non. On greffe l'IA sur votre WooCommerce existant via les hooks et la REST API, ou une extension sur mesure. Aucune migration vers une plateforme louée, aucun downtime.",
        },
        {
          id: "shopify",
          question: "Pourquoi WooCommerce plutôt que Shopify ?",
          answer:
            "WooCommerce est auto-hébergé et open-source : vous possédez la boutique, les données et le code, sans abonnement plateforme. C'est le bon choix quand la souveraineté et l'extensibilité priment. On accompagne les deux.",
        },
        {
          id: "fiches",
          question: "Vous générez les fiches produit ?",
          answer:
            "Oui, à l'échelle de votre catalogue : descriptions, attributs, méta SEO, dans votre ton. Conforme HCU 2024 et AI Act, relu avant publication.",
        },
        {
          id: "donnees",
          question: "Où sont hébergées les données IA ?",
          answer:
            "Dans votre infrastructure ou en hébergement UE (Hetzner Frankfurt), conforme RGPD. Vos données client et catalogue ne partent pas hors UE sans DPA.",
        },
      ],
      ctaBlockTitle: "Votre WooCommerce, plus intelligent",
      ctaBlockDescription:
        "Décrivez votre boutique et vos objectifs : on revient sous 48 h avec un périmètre, un forfait fixe et un délai.",
      why: {
        title: "Louer une plateforme,",
        titleEm: "c'est louer vos données",
        intro:
          "Les plateformes SaaS fermées facturent au volume et verrouillent vos données. WooCommerce vous laisse la main — et l'IA s'y greffe parfaitement.",
        points: [
          {
            title: "La propriété change tout",
            description:
              "Code, données, catalogue : tout reste chez vous. Vous décidez de la stack et de l'hébergement, pas la plateforme.",
          },
          {
            title: "Extensible par conception",
            description:
              "Hooks, filtres et REST API WooCommerce permettent de greffer l'IA proprement, là où un SaaS fermé impose ses limites.",
          },
        ],
      },
    },
    en: {
      eyebrow: "E-commerce · WooCommerce",
      title: "Your WooCommerce store,",
      titleEm: "augmented by AI",
      answer:
        "We graft AI onto your WooCommerce store without rebuilding it or migrating to a rented platform: buying assistant grounded in your catalogue, cross-sell recommendations, product sheet generation, semantic search, cart recovery. Everything stays self-hosted — you keep ownership of your store, data and code.",
      ctaPrimary: "Describe my project · 48 h quote",
      ctaSecondary: "See the Websites & SaaS hub",
      benefitsTitle: "What it changes",
      benefits: [
        {
          title: "No platform lock-in",
          description:
            "WooCommerce is self-hosted: we graft AI via hooks and the REST API, without locking you into a rented ecosystem.",
        },
        {
          title: "Higher average cart",
          description:
            "Cross-sell and up-sell recommendations wired to your real catalogue and buying behaviour.",
        },
        {
          title: "Product sheets at scale",
          description:
            "Generating and enriching product descriptions at scale, in your tone, without a copywriting agency.",
        },
      ],
      processTitle: PROCESS_TITLE_EN,
      processSteps: [
        {
          title: "Store audit",
          description: "Theme, plugins, catalogue size, REST API: we scope the work.",
        },
        {
          title: "AI wiring",
          description:
            "WooCommerce hooks, widget or bespoke plugin — without breaking what exists.",
        },
        {
          title: "Catalogue & conversion",
          description: "Buying assistant, reco, generated sheets, semantic product search.",
        },
        {
          title: "Measure & iterate",
          description: "Impact on average cart, add-to-cart rate, support tickets — we refine.",
        },
      ],
      metricsTitle: "How we work",
      metrics: [
        { number: "REST", suffix: "API", label: "Grafted via WooCommerce hooks" },
        { number: "EU", suffix: "", label: "Self-hosted, EU hosting possible" },
        { number: "100", suffix: "%", label: "Store & data yours" },
      ],
      faqTitle: "Frequently asked questions",
      faqs: [
        {
          id: "migration",
          question: "Do I need to migrate my store?",
          answer:
            "No. We graft AI onto your existing WooCommerce via hooks and the REST API, or a bespoke plugin. No migration to a rented platform, no downtime.",
        },
        {
          id: "shopify",
          question: "Why WooCommerce rather than Shopify?",
          answer:
            "WooCommerce is self-hosted and open-source: you own the store, data and code, with no platform subscription. It's the right call when sovereignty and extensibility matter. We support both.",
        },
        {
          id: "fiches",
          question: "Do you generate product sheets?",
          answer:
            "Yes, at the scale of your catalogue: descriptions, attributes, SEO meta, in your tone. HCU 2024 and AI Act compliant, reviewed before publishing.",
        },
        {
          id: "donnees",
          question: "Where is the AI data hosted?",
          answer:
            "In your infrastructure or EU hosting (Hetzner Frankfurt), GDPR-compliant. Your customer and catalogue data does not leave the EU without a DPA.",
        },
      ],
      ctaBlockTitle: "Your WooCommerce, smarter",
      ctaBlockDescription:
        "Describe your store and goals: we come back within 48 h with a scope, a fixed package and a timeline.",
      why: {
        title: "Renting a platform",
        titleEm: "means renting your data",
        intro:
          "Closed SaaS platforms charge by volume and lock your data in. WooCommerce keeps you in control — and AI grafts onto it perfectly.",
        points: [
          {
            title: "Ownership changes everything",
            description:
              "Code, data, catalogue: it all stays with you. You decide the stack and hosting, not the platform.",
          },
          {
            title: "Extensible by design",
            description:
              "WooCommerce hooks, filters and REST API let us graft AI cleanly, where a closed SaaS imposes its limits.",
          },
        ],
      },
    },
  },
  // ── E-COMMERCE : PrestaShop (open-source français) ─────────────────────────
  {
    slug: "prestashop",
    projectType: "augmentation",
    pathFr: "/sites-web-augmentes/prestashop",
    pathEn: "/sites-web-augmentes/prestashop",
    accent: "green",
    hero: {
      eyebrowFr: "Comment ça marche",
      eyebrowEn: "How it works",
      titleFr: "L'IA sur votre PrestaShop, via un module sur mesure",
      titleEn: "AI on your PrestaShop, via a bespoke module",
      blocks: [
        {
          icon: "Plug",
          prefixFr: "1",
          prefixEn: "1",
          labelFr: "Un module dédié",
          labelEn: "A dedicated module",
          detailFr: "On développe un module PrestaShop sur mesure, propre à votre boutique.",
          detailEn: "We develop a bespoke PrestaShop module, specific to your store.",
        },
        {
          icon: "Search",
          prefixFr: "2",
          prefixEn: "2",
          labelFr: "Search & reco",
          labelEn: "Search & reco",
          detailFr: "Recherche produit sémantique + recommandations branchées sur votre catalogue.",
          detailEn: "Semantic product search + recommendations wired to your catalogue.",
        },
        {
          icon: "Sparkles",
          prefixFr: "3",
          prefixEn: "3",
          labelFr: "Multilingue natif",
          labelEn: "Native multilingual",
          detailFr:
            "Fiches et contenus générés et traduits — atout des boutiques à l'international.",
          detailEn:
            "Sheets and content generated and translated — an asset for international stores.",
        },
      ],
      ariaFr:
        "Schéma : on développe un module PrestaShop sur mesure (recherche sémantique, recommandations, génération et traduction de fiches) branché sur votre catalogue pour les boutiques à l'international.",
      ariaEn:
        "Diagram: we build a bespoke PrestaShop module (semantic search, recommendations, sheet generation and translation) wired to your catalogue for international stores.",
    },
    fr: {
      eyebrow: "E-commerce · PrestaShop",
      title: "Votre PrestaShop,",
      titleEm: "augmenté par l'IA",
      answer:
        "On développe un module PrestaShop sur mesure pour greffer l'IA sur votre boutique open-source : recherche produit sémantique, recommandations, génération et traduction de fiches, assistant d'achat. Idéal pour les boutiques multi-langues et internationales, sans quitter l'écosystème PrestaShop ni perdre la maîtrise de votre code.",
      ctaPrimary: "Décrire mon projet · devis 48 h",
      ctaSecondary: "Voir le hub Sites web & SaaS",
      benefitsTitle: "Ce que ça change",
      benefits: [
        {
          title: "Un module sur mesure",
          description:
            "Pas un plugin générique : un module PrestaShop développé pour votre boutique, maintenable et propriété de votre entreprise.",
        },
        {
          title: "Fort à l'international",
          description:
            "Génération et traduction de fiches multi-langues : un vrai levier pour les boutiques PrestaShop qui vendent au-delà de la France.",
        },
        {
          title: "Open-source maîtrisé",
          description:
            "Souveraineté et extensibilité : vous gardez la main sur le code et les données, hébergement UE possible.",
        },
      ],
      processTitle: PROCESS_TITLE_FR,
      processSteps: [
        {
          title: "Audit & version",
          description: "Version PrestaShop, thème, modules, catalogue : on cadre la compatibilité.",
        },
        {
          title: "Module IA sur mesure",
          description: "Développement d'un module dédié, branché sur votre catalogue et vos hooks.",
        },
        {
          title: "Search, reco & contenu",
          description: "Recherche sémantique, recommandations, fiches générées et traduites.",
        },
        {
          title: "Mesure & itération",
          description: "Conversion, panier moyen, marchés à l'international — on affine.",
        },
      ],
      metricsTitle: "Comment on travaille",
      metrics: [
        { number: "Module", suffix: "dédié", label: "Sur mesure, maintenable" },
        { number: "UE", suffix: "", label: "Open-source, hébergement UE possible" },
        { number: "100", suffix: "%", label: "Code & données à vous" },
      ],
      faqTitle: "Questions fréquentes",
      faqs: [
        {
          id: "module",
          question: "C'est un plugin du marketplace ?",
          answer:
            "Non. On développe un module PrestaShop sur mesure, propre à votre boutique et maintenable — pas un module générique du marketplace que vous ne maîtrisez pas.",
        },
        {
          id: "version",
          question: "Compatible avec ma version de PrestaShop ?",
          answer:
            "On vérifie la compatibilité dès l'audit (1.6, 1.7, 8.x). Le module est développé pour votre version et votre thème, sans casser vos modules existants.",
        },
        {
          id: "international",
          question: "Et pour une boutique multi-langues ?",
          answer:
            "C'est un point fort : génération et traduction de fiches dans toutes vos langues, cohérentes avec votre catalogue et conformes HCU + AI Act.",
        },
        {
          id: "donnees",
          question: "Mes données restent-elles en Europe ?",
          answer:
            "Oui. La chaîne IA est hébergeable en UE (Hetzner Frankfurt), conforme RGPD. Vos données catalogue et client restent sous votre contrôle.",
        },
      ],
      ctaBlockTitle: "Votre PrestaShop, plus intelligent",
      ctaBlockDescription:
        "Décrivez votre boutique et vos objectifs : on revient sous 48 h avec un périmètre, un forfait fixe et un délai.",
      why: {
        title: "L'open-source,",
        titleEm: "c'est garder la main",
        intro:
          "PrestaShop vous laisse la propriété du code et des données. L'IA s'y greffe via un module sur mesure, sans renier cette maîtrise.",
        points: [
          {
            title: "Un module, pas une rustine",
            description:
              "Développé pour votre boutique, versionné et maintenable — pas un plugin opaque qui casse à la prochaine mise à jour.",
          },
          {
            title: "Pensé pour l'international",
            description:
              "Multi-langues et multi-boutique : l'IA génère et traduit le contenu là où PrestaShop est déjà fort.",
          },
        ],
      },
    },
    en: {
      eyebrow: "E-commerce · PrestaShop",
      title: "Your PrestaShop,",
      titleEm: "augmented by AI",
      answer:
        "We develop a bespoke PrestaShop module to graft AI onto your open-source store: semantic product search, recommendations, sheet generation and translation, buying assistant. Ideal for multilingual and international stores, without leaving the PrestaShop ecosystem or losing control of your code.",
      ctaPrimary: "Describe my project · 48 h quote",
      ctaSecondary: "See the Websites & SaaS hub",
      benefitsTitle: "What it changes",
      benefits: [
        {
          title: "A bespoke module",
          description:
            "Not a generic plugin: a PrestaShop module built for your store, maintainable and owned by your company.",
        },
        {
          title: "Strong internationally",
          description:
            "Multilingual sheet generation and translation: a real lever for PrestaShop stores selling beyond France.",
        },
        {
          title: "Open-source, mastered",
          description:
            "Sovereignty and extensibility: you keep control of code and data, EU hosting possible.",
        },
      ],
      processTitle: PROCESS_TITLE_EN,
      processSteps: [
        {
          title: "Audit & version",
          description: "PrestaShop version, theme, modules, catalogue: we scope compatibility.",
        },
        {
          title: "Bespoke AI module",
          description: "Developing a dedicated module, wired to your catalogue and hooks.",
        },
        {
          title: "Search, reco & content",
          description: "Semantic search, recommendations, generated and translated sheets.",
        },
        {
          title: "Measure & iterate",
          description: "Conversion, average cart, international markets — we refine.",
        },
      ],
      metricsTitle: "How we work",
      metrics: [
        { number: "Module", suffix: "", label: "Bespoke, maintainable" },
        { number: "EU", suffix: "", label: "Open-source, EU hosting possible" },
        { number: "100", suffix: "%", label: "Code & data yours" },
      ],
      faqTitle: "Frequently asked questions",
      faqs: [
        {
          id: "module",
          question: "Is it a marketplace plugin?",
          answer:
            "No. We develop a bespoke PrestaShop module, specific to your store and maintainable — not a generic marketplace module you don't control.",
        },
        {
          id: "version",
          question: "Compatible with my PrestaShop version?",
          answer:
            "We check compatibility during the audit (1.6, 1.7, 8.x). The module is built for your version and theme, without breaking your existing modules.",
        },
        {
          id: "international",
          question: "What about a multilingual store?",
          answer:
            "That's a strength: generating and translating sheets in all your languages, consistent with your catalogue and HCU + AI Act compliant.",
        },
        {
          id: "donnees",
          question: "Does my data stay in Europe?",
          answer:
            "Yes. The AI chain can be hosted in the EU (Hetzner Frankfurt), GDPR-compliant. Your catalogue and customer data stays under your control.",
        },
      ],
      ctaBlockTitle: "Your PrestaShop, smarter",
      ctaBlockDescription:
        "Describe your store and goals: we come back within 48 h with a scope, a fixed package and a timeline.",
      why: {
        title: "Open-source means",
        titleEm: "staying in control",
        intro:
          "PrestaShop leaves you ownership of code and data. AI grafts onto it via a bespoke module, without giving up that control.",
        points: [
          {
            title: "A module, not a patch",
            description:
              "Built for your store, versioned and maintainable — not an opaque plugin that breaks at the next update.",
          },
          {
            title: "Built for international",
            description:
              "Multilingual and multi-store: AI generates and translates content where PrestaShop is already strong.",
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
