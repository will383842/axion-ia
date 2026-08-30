// Press room fixtures (Sprint correctif 14.6 — page presse).
// Doctrine éditoriale v3 : ton factuel, anti-marketing. Anti-formation strict.
// FR canonical · EN miroir. Parité enforced via tests/content/press.test.ts.

import {
  AUDIT_TIERS,
  IMPLEMENTATION_TIERS,
  INTERVENTION_TIERS,
  formatAmount,
  getEntryLabel,
  getTierById,
} from "@/content/pricing";

// ─────────────────────────────────────────────────────────────────
// Helpers prix dérivés (zéro hardcode — Sprint 14.10.5).
// ─────────────────────────────────────────────────────────────────
const auditFlash = getTierById(AUDIT_TIERS, "audit-flash");
const auditCible = getTierById(AUDIT_TIERS, "audit-cible");
const auditPme = getTierById(AUDIT_TIERS, "audit-strategique-pme");
const auditEti = getTierById(AUDIT_TIERS, "audit-strategique-eti");
const interventionEssentielle = getTierById(INTERVENTION_TIERS, "intervention-essentielle");

function pressReleaseLaunchBody(loc: "fr" | "en"): string {
  const interventionsEntry = getEntryLabel(INTERVENTION_TIERS, loc, { compact: true });
  const flash = formatAmount(auditFlash.priceFlat!, loc, { compact: true });
  // Ciblé / PME / ETI = « à partir de 1 900 € · sur devis » (Will 2026-06-03,
  // bornes hautes supprimées) → prix d'entrée uniquement (l'ancien « à ${max} »
  // rendait « NaN », priceMax étant absent).
  const cibleMin = formatAmount(auditCible.priceMin!, loc, { compact: true });
  const pmeMin = formatAmount(auditPme.priceMin!, loc, { compact: true });
  const etiFrom = formatAmount(auditEti.priceMin!, loc, { compact: true });
  const implEntry = getEntryLabel(IMPLEMENTATION_TIERS, loc, { compact: true });
  if (loc === "fr") {
    return `Axion-IA, cabinet IA opérationnel, annonce le lancement de sa plateforme axion-ia.com. Le site présente trois modules d'intervention — sessions terrain ${interventionsEntry}, audits IA chiffrés en 4 niveaux (Flash dès ${flash}, Ciblé dès ${cibleMin}, Stratégique PME dès ${pmeMin}, Stratégique ETI à partir de ${etiFrom}), et implémentations sur mesure ${implEntry} — avec une promesse mesurable : un retour sur investissement chiffré dès la mise en production. Hébergée en UE, la plateforme cible les entreprises de toutes tailles, de l'artisan à l'ETI.`;
  }
  return `Axion-IA, an operational AI consultancy, announces the launch of its platform axion-ia.com. The site presents three service modules — on-site sessions ${interventionsEntry}, AI audits in 4 tiers (Flash from ${flash}, Targeted from ${cibleMin}, Strategic SME from ${pmeMin}, Strategic Mid-cap from ${etiFrom}), and custom implementations ${implEntry} — with one measurable promise: a costed return on investment from the moment of go-live. Hosted in the EU, the platform targets companies of all sizes, from sole traders to mid-caps.`;
}

export type PressReleaseTag = "launch" | "partnership" | "study" | "product" | "milestone";

export interface PressRelease {
  slug: string;
  /** ISO date string — used for `datePublished` JSON-LD + sitemap. */
  publishedAt: string;
  tag: PressReleaseTag;
  fr: { title: string; dek: string; body: string };
  en: { title: string; dek: string; body: string };
}

export interface MediaCoverageItem {
  id: string;
  /** Outlet name — displayed as logo placeholder + caption. */
  outlet: string;
  /** External URL to the article (https). */
  url: string;
  publishedAt: string;
  fr: { title: string };
  en: { title: string };
}

export interface PressSpokesperson {
  id: string;
  /** LinkedIn pro URL — used for JSON-LD `sameAs`. */
  linkedinUrl: string;
  /** Languages spoken (interview-ready). */
  languages: ReadonlyArray<"fr" | "en">;
  /** Topical expertise areas — used for JSON-LD `knowsAbout`. */
  knowsAbout: ReadonlyArray<string>;
  /** `bio` = factual 3-line backgrounder (copy-paste). `quote` = an attributable,
   *  ready-to-cite pull quote for journalists (no recontact needed). */
  fr: { name: string; role: string; bio: string; quote: string };
  en: { name: string; role: string; bio: string; quote: string };
}

/**
 * Types de pièces que le kit presse sait servir.
 *
 * 🔑 C'est la LISTE qui fait foi, et le type qui en découle — pas l'inverse. Un
 * test vérifiait l'appartenance à une liste recopiée à la main : elle a péri au
 * premier type ajouté (`color-charter`), en rougissant sur une fixture pourtant
 * légitime. Dérivée d'ici, elle ne peut plus se périmer.
 *
 * Ajouter un type ici oblige aussi à le mapper dans `FIXTURE_KIND_TO_PRISMA`
 * (`src/server/press/queries.ts`) : ce `Record` est exhaustif, donc `tsc` refuse
 * l'oubli.
 */
export const PRESS_KIT_KINDS = [
  "logo",
  "wordmark",
  "photo",
  "brand-book",
  "color-charter",
  "boilerplate",
] as const;

export type PressKitKind = (typeof PRESS_KIT_KINDS)[number];

export interface PressKitAsset {
  id: string;
  /** Asset category — drives card icon + group. */
  kind: PressKitKind;
  /** Public path under `/press-kit/...`. `null` = placeholder, button disabled. */
  fileUrl: string | null;
  /** Format label shown in the badge (e.g. SVG, PNG, PDF). */
  format: string;
  fr: { title: string; description: string };
  en: { title: string; description: string };
}

export interface PressFact {
  id: string;
  fr: { label: string; value: string };
  en: { label: string; value: string };
}

export interface PressFaqEntry {
  id: string;
  fr: { question: string; answer: string };
  en: { question: string; answer: string };
}

// ─────────────────────────────────────────────────────────────────
// PITCH presse — bloc direct-answer 40-80 mots citable LLMs (signal AEO).
// ─────────────────────────────────────────────────────────────────
export interface PressPitchLocale {
  eyebrow: string;
  short: string;
  boilerplate: string;
}

// Le pitch visible sur la page = `short` (paragraphe punchy orienté journalistes,
// ~60 mots, citable AEO/Speakable). `boilerplate` = la version « copier-coller »
// téléchargeable (asset kit presse), volontairement distincte. AUCUNE date de
// création (choix Will 2026-06-23 : ne pas surfacer l'année de fondation).
export const PRESS_PITCH: { fr: PressPitchLocale; en: PressPitchLocale } = {
  fr: {
    eyebrow: "Pitch presse",
    short:
      "Axion-IA est un cabinet de conseil en intelligence artificielle opérationnelle. Il aide les entreprises de toutes tailles — de l'artisan à l'ETI — à passer de l'idée IA à des usages concrets à retour sur investissement mesurable, en quelques semaines : démonstration sur leurs données réelles, plan d'action chiffré, mise en production accompagnée, hébergement en Union européenne conforme au RGPD.",
    boilerplate:
      "Axion-IA est un cabinet de conseil en intelligence artificielle opérationnelle qui accompagne les entreprises de toutes tailles, de l'artisan à l'ETI. Le cabinet identifie, démontre puis déploie des usages d'IA à retour sur investissement mesurable — démonstrations sur données réelles, plan d'action chiffré, mise en production rapide, hébergement en Union européenne conforme au RGPD. Contact presse : presse@axion-ia.com.",
  },
  en: {
    eyebrow: "Press pitch",
    short:
      "Axion-IA is an operational artificial intelligence consultancy. It helps companies of all sizes — from sole traders to mid-caps — move from the AI idea to concrete use cases with measurable return on investment, in a matter of weeks: demonstration on their real data, costed action plan, supported go-live, hosting in the European Union compliant with the GDPR.",
    boilerplate:
      "Axion-IA is an operational artificial intelligence consultancy serving companies of all sizes, from sole traders to mid-caps. The firm identifies, demonstrates and deploys AI use cases with measurable return on investment — demos on real data, costed action plan, fast go-live, hosting in the European Union compliant with the GDPR. Press contact: presse@axion-ia.com.",
  },
};

// ─────────────────────────────────────────────────────────────────
// FAITS clés — chiffres factuels pour journalistes (carte fact-sheet).
// ─────────────────────────────────────────────────────────────────
export const PRESS_FACTS: ReadonlyArray<PressFact> = [
  {
    id: "scope",
    fr: { label: "Périmètre", value: "Entreprises FR + UE" },
    en: { label: "Scope", value: "FR + EU companies" },
  },
  {
    id: "languages",
    fr: { label: "Langues opérationnelles", value: "FR · EN" },
    en: { label: "Operating languages", value: "FR · EN" },
  },
  {
    id: "hosting",
    fr: { label: "Hébergement", value: "UE (Hetzner Frankfurt)" },
    en: { label: "Hosting", value: "EU (Hetzner Frankfurt)" },
  },
  {
    id: "modules",
    fr: {
      label: "Activités",
      value: "5 — formations, 1-to-1, audit, implémentation, sites web",
    },
    en: {
      label: "Activities",
      value: "5 — training, 1-to-1, audit, implementation, websites",
    },
  },
  {
    id: "starting-price",
    fr: {
      label: "Prix d'entrée",
      value: `${formatAmount(interventionEssentielle.priceFlat!, "fr", { compact: true })} · ${interventionEssentielle.durationFr ?? "1 journée"}`,
    },
    en: {
      label: "Starting price",
      value: `${formatAmount(interventionEssentielle.priceFlat!, "en", { compact: true })} · ${interventionEssentielle.durationEn ?? "1 day"}`,
    },
  },
  {
    id: "response-time",
    fr: { label: "Délai de réponse presse", value: "48 h ouvrées" },
    en: { label: "Press response time", value: "48 business hours" },
  },
];

// ─────────────────────────────────────────────────────────────────
// CHARTE COULEUR — source unique, partagée par la page presse ET la route
// `/api/presse/charte-couleur` qui la sert en téléchargement.
//
// 🔴 Elle vivait dans `PressImages.tsx`, donc invisible depuis une route. Un
// fichier de charte écrit à la main à côté aurait divergé des pastilles
// affichées — exactement le défaut que le boilerplate figé a payé (il
// annonçait « fondé en 2024 » quand le JSON-LD publiait 2026). La charte
// téléchargeable est donc GÉNÉRÉE d'ici, jamais recopiée.
//
// `className` peint réellement la pastille (token CSS de `globals.css`, SSOT
// couleur) ; `hex` est l'information destinée aux journalistes et maquettistes
// — c'est la raison d'être d'une charte. Direction « ivoire chaud + sand +
// mocha + terracotta » (ADR 0002).
// ─────────────────────────────────────────────────────────────────
export interface BrandColor {
  /** Nom affiché aux journalistes. */
  name: string;
  /** Code HEX officiel, miroir du token `globals.css`. */
  hex: string;
  /** Classe Tailwind qui peint la pastille (la couleur vient du token, pas du hex). */
  className: string;
  /** Teinte très claire → pastille cerclée pour rester visible sur fond ivoire. */
  ring?: boolean;
}

export const BRAND_PALETTE: ReadonlyArray<BrandColor> = [
  // hex-ok: charte couleur presse — HEX officiels affichés aux journalistes, miroir des tokens globals.css (la COULEUR du swatch vient de className).
  { name: "Terracotta", hex: "#C24A1B", className: "bg-terracotta" }, // hex-ok: charte presse
  { name: "Mocha", hex: "#2A2520", className: "bg-mocha" }, // hex-ok: charte presse
  { name: "Bleu éditorial", hex: "#1A4DD9", className: "bg-primary" }, // hex-ok: charte presse
  { name: "Sauge", hex: "#5E6C54", className: "bg-sage" }, // hex-ok: charte presse
  { name: "Sable", hex: "#F0E9DA", className: "bg-sand", ring: true }, // hex-ok: charte presse
  { name: "Ivoire", hex: "#FAF8F3", className: "bg-canvas", ring: true }, // hex-ok: charte presse
  { name: "Anthracite", hex: "#1A1815", className: "bg-fg" }, // hex-ok: charte presse
];

// ─────────────────────────────────────────────────────────────────
// PRESS KIT — assets téléchargeables. `fileUrl: null` = placeholder UI disabled.
//
// Plus aucun placeholder ici : une fixture affichée « bientôt disponible » sur une
// page publique est une promesse non tenue faite à la presse. Un test le verrouille
// (`queries.spec.ts`), et vérifie en plus que chaque `fileUrl` existe sur le disque.
//
// Les deux SVG viennent en tête : c'est le format que demande la presse print, et le
// seul qui ne se dégrade pas à l'agrandissement (affiche, kakémono, 4e de couverture).
// ─────────────────────────────────────────────────────────────────
export const PRESS_KIT_ASSETS: ReadonlyArray<PressKitAsset> = [
  {
    id: "logo-vector-color",
    kind: "logo",
    fileUrl: "/images/axion-ia-logo-vectoriel-couleur.svg",
    format: "SVG",
    fr: {
      title: "Logo vectoriel couleur",
      description:
        "Format vectoriel, sans perte à toute taille — impression, affichage grand format, découpe.",
    },
    en: {
      title: "Vector logo, color",
      description: "Vector format, lossless at any size — print, large-format display, cutting.",
    },
  },
  {
    id: "logo-vector-reversed",
    kind: "logo",
    fileUrl: "/images/axion-ia-logo-vectoriel-blanc-fond-sombre.svg",
    format: "SVG",
    fr: {
      title: "Logo vectoriel blanc (fonds sombres)",
      description:
        "Version monochrome blanche, intérieur transparent — à poser sur photo ou fond foncé.",
    },
    en: {
      title: "Vector logo, white (dark backgrounds)",
      description:
        "White monochrome version, transparent interior — for photos or dark backgrounds.",
    },
  },
  {
    id: "logo-primary",
    kind: "logo",
    fileUrl: "/images/axion-ia-logo-horizontal-fond-blanc.webp",
    format: "WebP",
    fr: {
      title: "Logo principal",
      description: "Wordmark Axion-IA, version couleur fond blanc.",
    },
    en: {
      title: "Primary logo",
      description: "Axion-IA wordmark, color version, white background.",
    },
  },
  {
    id: "logo-monochrome",
    kind: "logo",
    fileUrl: "/images/axion-ia-logo-horizontal-transparent.webp",
    format: "WebP",
    fr: {
      title: "Logo fond transparent",
      description: "Version fond transparent pour intégrations éditorielles.",
    },
    en: {
      title: "Transparent background logo",
      description: "Transparent background version for editorial use.",
    },
  },
  {
    id: "logo-square",
    kind: "logo",
    fileUrl: "/images/axion-ia-logo-full-transparent-toutes-couleurs-fond-versatile.webp",
    format: "WebP",
    fr: {
      title: "Logo carré",
      description: "Format carré fond transparent — vignettes, encadrés, réseaux sociaux.",
    },
    en: {
      title: "Square logo",
      description: "Square format, transparent background — thumbnails, sidebars, social.",
    },
  },
  {
    id: "logo-avatar",
    kind: "logo",
    fileUrl: "/images/axion-ia-logo-format-cercle-avatar-profil-linkedin-reseaux.webp",
    format: "WebP",
    fr: {
      title: "Logo rond (avatar)",
      description: "Version circulaire — avatars, profils, pastilles de crédit.",
    },
    en: {
      title: "Round logo (avatar)",
      description: "Circular version — avatars, profiles, credit badges.",
    },
  },
  {
    id: "founder-photo",
    kind: "photo",
    fileUrl: "/images/axion-ia-fondateur-williams-jullin-portrait-professionnel.jpg",
    format: "JPG",
    fr: {
      title: "Photo fondateur",
      description: "Portrait carré 2048 × 2048 px, libre pour usage éditorial presse.",
    },
    en: {
      title: "Founder photo",
      description: "Square portrait, 2048 × 2048 px, free for editorial press use.",
    },
  },
  {
    id: "color-charter",
    kind: "color-charter",
    // Générée depuis `BRAND_PALETTE` ci-dessus : le fichier téléchargé ne peut
    // pas contredire les pastilles affichées sur la page.
    fileUrl: "/api/presse/charte-couleur",
    format: "TXT",
    fr: {
      title: "Charte couleur (HEX + RGB)",
      description:
        "Les sept couleurs officielles, codes HEX et RGB — générés depuis les tokens du site.",
    },
    en: {
      title: "Color charter (HEX + RGB)",
      description: "The seven official colors, HEX and RGB codes — generated from the site tokens.",
    },
  },
  {
    id: "boilerplate",
    kind: "boilerplate",
    // Généré au runtime depuis `PRESS_PITCH` + l'identité légale (SSOT), et non
    // servi comme fichier statique : le TXT figé avait divergé du site (il
    // annonçait « fondé en 2024 » quand le JSON-LD publiait `foundingDate: 2026`).
    fileUrl: "/api/presse/boilerplate",
    format: "TXT",
    fr: {
      title: "Boilerplate FR + EN",
      description: "Paragraphe descriptif copy-paste pour articles et dépêches.",
    },
    en: {
      title: "Boilerplate FR + EN",
      description: "Descriptive paragraph for copy-paste in articles and wires.",
    },
  },
] as const;

// ─────────────────────────────────────────────────────────────────
// COMMUNIQUÉS de presse — fixtures Phase 1.
// Inclut au minimum 1 release réelle datée (lancement plateforme).
// ─────────────────────────────────────────────────────────────────
export const PRESS_RELEASES: ReadonlyArray<PressRelease> = [
  {
    slug: "lancement-plateforme-axion-ia-2026",
    publishedAt: "2026-05-07",
    tag: "launch",
    fr: {
      title: "Axion-IA lance sa plateforme de cabinet IA opérationnel",
      dek: "Le cabinet ouvre axion-ia.com, un point d'entrée unique pour les entreprises souhaitant identifier et déployer des usages IA à ROI mesurable.",
      body: pressReleaseLaunchBody("fr"),
    },
    en: {
      title: "Axion-IA launches its operational AI consultancy platform",
      dek: "The firm opens axion-ia.com, a single entry point for companies looking to identify and deploy AI use cases with measurable ROI.",
      body: pressReleaseLaunchBody("en"),
    },
  },
  {
    slug: "methode-axionia-quatre-etapes",
    publishedAt: "2026-05-07",
    tag: "milestone",
    fr: {
      title: "Axion-IA publie sa méthode en quatre étapes",
      dek: "Cadrage, démonstration, plan chiffré, mise en production — pour passer de l'idée IA au déploiement opérationnel sans POC perdu.",
      body: "Axion-IA détaille pour la presse sa méthode propriétaire en quatre étapes. Étape 1 : cadrage 45 minutes gratuit pour qualifier le besoin. Étape 2 : démonstration sur site ou à distance, sur les vraies données du client. Étape 3 : plan chiffré priorisé livré sous 5 jours. Étape 4 : mise en production avec 30 jours de support inclus. Cette approche élimine les POC théoriques sans suite, traditionnellement responsables de 80 % des échecs IA en entreprise.",
    },
    en: {
      title: "Axion-IA publishes its four-step method",
      dek: "Scoping, demonstration, costed plan, production — to go from AI idea to operational deployment without abandoned POCs.",
      body: "Axion-IA details its proprietary four-step method for the press. Step 1: free 45-minute scoping call to qualify the need. Step 2: on-site or remote demonstration on the client's real data. Step 3: prioritized costed plan delivered within 5 days. Step 4: production deployment with 30 days of support included. This approach eliminates the abandoned theoretical POCs traditionally responsible for 80% of enterprise AI failures.",
    },
  },
  {
    slug: "souverainete-ue-hebergement-axionia",
    publishedAt: "2026-05-07",
    tag: "study",
    fr: {
      title: "Souveraineté IA : Axion-IA confirme l'hébergement UE par défaut",
      dek: "Tous les workloads clients sont hébergés sur Hetzner Frankfurt. Aucun envoi de données sensibles à des tiers sans consentement explicite.",
      body: "Face aux préoccupations croissantes des dirigeants européens sur la souveraineté des données IA, Axion-IA confirme une politique d'hébergement UE par défaut. Toute donnée client transite et reste sur Hetzner CPX32 à Frankfurt. Les modèles IA peuvent être hébergés on-premise ou sur infrastructure dédiée si requis. La politique RGPD est strictement appliquée : exercice des droits sous 30 jours, anonymisation systématique des échantillons utilisés en démos, DPO joignable à contact@axion-ia.com.",
    },
    en: {
      title: "AI sovereignty: Axion-IA confirms EU hosting by default",
      dek: "All client workloads are hosted on Hetzner Frankfurt. No sensitive data sent to third parties without explicit consent.",
      body: "Faced with growing concerns from European executives about AI data sovereignty, Axion-IA confirms a default EU hosting policy. All client data transits through and remains on Hetzner CPX32 in Frankfurt. AI models can be hosted on-premise or on dedicated infrastructure if required. GDPR policy is strictly enforced: rights exercise within 30 days, systematic anonymization of samples used in demos, DPO reachable at contact@axion-ia.com.",
    },
  },
];

// ─────────────────────────────────────────────────────────────────
// COUVERTURE médias — Phase 1 vide. Premières mentions à venir.
// Anti-pattern E-E-A-T : ne JAMAIS fabriquer de couverture inexistante.
// ─────────────────────────────────────────────────────────────────
export const PRESS_MEDIA_COVERAGE: ReadonlyArray<MediaCoverageItem> = [] as const;

// ─────────────────────────────────────────────────────────────────
// PORTE-PAROLE — interview-ready. Photo réelle à fournir Phase 2.
// ─────────────────────────────────────────────────────────────────
export const PRESS_SPOKESPERSONS: ReadonlyArray<PressSpokesperson> = [
  {
    id: "will",
    linkedinUrl: "https://www.linkedin.com/in/williamsjullin/",
    languages: ["fr", "en"],
    knowsAbout: [
      "Operational artificial intelligence",
      "AI implementation in SMEs",
      "AI audit methodology",
      "AI ROI measurement",
      "EU data sovereignty",
    ],
    fr: {
      name: "Williams",
      role: "Fondateur · lead consultant Axion-IA",
      bio: "Dix ans en transformation digitale, opérationnel terrain. Williams dirige les interventions Axion-IA en entreprise et incarne l'approche opérationnelle du cabinet — démos sur données réelles, plans chiffrés, mise en production rapide. Disponible pour interviews FR + EN, réponse sous 48 h ouvrées.",
      quote:
        "L'IA en entreprise ne se joue pas sur la technologie, mais sur l'exécution. La plupart des projets échouent parce qu'ils ne dépassent jamais le stade du POC. Notre rôle, c'est de prouver la valeur sur les vraies données du client, puis de la mettre en production — avec un retour sur investissement chiffré, pas une promesse.",
    },
    en: {
      name: "Williams",
      role: "Founder · lead consultant Axion-IA",
      bio: "Ten years in digital transformation, hands-on field practice. Williams leads Axion-IA enterprise engagements and embodies the firm's operational approach — demos on real data, costed plans, fast go-live. Available for FR + EN interviews, response within 48 business hours.",
      // EN = miroir FR (locale EN désactivée, aucun travail de traduction — Will).
      quote:
        "L'IA en entreprise ne se joue pas sur la technologie, mais sur l'exécution. La plupart des projets échouent parce qu'ils ne dépassent jamais le stade du POC. Notre rôle, c'est de prouver la valeur sur les vraies données du client, puis de la mettre en production — avec un retour sur investissement chiffré, pas une promesse.",
    },
  },
] as const;

// ─────────────────────────────────────────────────────────────────
// FAQ presse — questions journalistes (FAQPage JSON-LD via FaqAccordion).
// ─────────────────────────────────────────────────────────────────
export const PRESS_FAQ: ReadonlyArray<PressFaqEntry> = [
  {
    id: "company",
    fr: {
      question: "Quelle est la structure juridique d'Axion-IA ?",
      answer:
        "Axion-IA est une société par actions simplifiée (SAS) française. La facturation est émise en euros, hors taxes, avec la TVA applicable selon le régime en vigueur et la résidence du client.",
    },
    en: {
      question: "What is Axion-IA's legal structure?",
      answer:
        "Axion-IA is a French simplified joint-stock company (SAS). Invoicing is in euros, excluding tax, with VAT applied according to the applicable regime and the client's residence.",
    },
  },
  {
    id: "clients",
    fr: {
      question: "Qui sont vos clients types ?",
      answer:
        "Axion-IA accompagne tous types d'entreprises — artisans, PME, ETI et grands groupes, grandes organisations. La méthode s'adapte à l'échelle, mais reste identique : démo sur données réelles, plan chiffré, mise en production rapide.",
    },
    en: {
      question: "Who are your typical clients?",
      answer:
        "Axion-IA serves companies of all sizes — sole traders, small businesses, SMEs, mid-caps, large organizations. The method adapts to scale but remains identical: demo on real data, costed plan, fast production deployment.",
    },
  },
  {
    id: "case-studies",
    fr: {
      question: "Pouvez-vous fournir des cas concrets pour articles ?",
      answer:
        "Oui. Plusieurs cas documentés sont disponibles sur axion-ia.com/cas-concrets — industrie, retail, juridique, banque, PME — avec contexte, problème, solution et chiffres post-livraison. Sur demande, nous mettons en relation avec des clients prêts à témoigner.",
    },
    en: {
      question: "Can you provide concrete cases for articles?",
      answer:
        "Yes. Several documented cases are available on axion-ia.com/case-studies — industry, retail, legal, banking, small business — with context, problem, solution and post-delivery figures. Upon request, we connect journalists with clients willing to speak.",
    },
  },
  {
    id: "interview-format",
    fr: {
      question: "Acceptez-vous les interviews vidéo et podcast ?",
      answer:
        "Oui. Williams, fondateur, est disponible pour interviews écrites, vocales (téléphone, Zoom, Google Meet), vidéo (studio ou visio HD) et podcast. Langues : FR et EN. Délai de coordination : 48 h ouvrées.",
    },
    en: {
      question: "Do you accept video and podcast interviews?",
      answer:
        "Yes. Williams, founder, is available for written, voice (phone, Zoom, Google Meet), video (studio or HD video call) and podcast interviews. Languages: FR and EN. Coordination lead time: 48 business hours.",
    },
  },
  {
    id: "data-policy",
    fr: {
      question: "Comment Axion-IA traite-t-elle les données clients ?",
      answer:
        "Hébergement UE par défaut sur Hetzner Frankfurt. Aucun envoi de données sensibles à des tiers sans consentement explicite. Politique RGPD complète, exercice des droits sous 30 jours, anonymisation systématique des échantillons utilisés en démos.",
    },
    en: {
      question: "How does Axion-IA handle client data?",
      answer:
        "EU hosting by default on Hetzner Frankfurt. No sensitive data sent to third parties without explicit consent. Full GDPR policy, rights exercise within 30 days, systematic anonymization of samples used in demos.",
    },
  },
  {
    id: "exclusives",
    fr: {
      question: "Proposez-vous des exclusivités presse ?",
      answer:
        "Oui, sous réserve de réciprocité éditoriale. Pour les annonces produits ou études sectorielles, Axion-IA peut accorder une fenêtre d'embargo de 24 à 72 h à un média lead. Contact : presse@axion-ia.com avec sujet « Exclusivité ».",
    },
    en: {
      question: "Do you offer press exclusives?",
      answer:
        'Yes, subject to editorial reciprocity. For product announcements or sector studies, Axion-IA can grant a 24 to 72-hour embargo window to a lead media outlet. Contact: presse@axion-ia.com with subject "Exclusive".',
    },
  },
] as const;

// ─────────────────────────────────────────────────────────────────
// HELPERS — accès slug pour /presse/[slug] (Phase 2, sprint suivant).
// ─────────────────────────────────────────────────────────────────
export function getPressRelease(slug: string): PressRelease | undefined {
  return PRESS_RELEASES.find((r) => r.slug === slug);
}

export function getAllPressReleaseSlugs(): string[] {
  return PRESS_RELEASES.map((r) => r.slug);
}
