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

function pressPitchShort(loc: "fr" | "en"): string {
  const interventionsEntry = getEntryLabel(INTERVENTION_TIERS, loc, { compact: true });
  const flash = formatAmount(auditFlash.priceFlat!, loc, { compact: true });
  const etiFrom = formatAmount(auditEti.priceMin!, loc, { compact: true });
  const implEntry = getEntryLabel(IMPLEMENTATION_TIERS, loc, { compact: true });
  if (loc === "fr") {
    return `Axion-IA est un cabinet IA opérationnel pour entreprises de toutes tailles — de l'artisan à l'ETI. Nous intervenons sur site ou à distance pour identifier, démontrer et implémenter des usages IA générant un retour sur investissement mesurable. Trois modules : interventions terrain (à partir de ${formatAmount(interventionEssentielle.priceFlat!, "fr", { compact: true })}, ${interventionsEntry}), audits IA en 4 niveaux (Flash ${flash} → Stratégique ETI dès ${etiFrom}) et implémentations sur mesure (${implEntry}). Hébergement UE par défaut, RGPD strict.`;
  }
  return `Axion-IA is an operational AI consultancy for companies of all sizes — from sole traders to mid-caps. We work on site or remotely to identify, demonstrate and implement AI use cases generating measurable return on investment. Three modules: on-site sessions (from ${formatAmount(interventionEssentielle.priceFlat!, "en", { compact: true })}, ${interventionsEntry}), AI audits in 4 tiers (Flash ${flash} → Strategic Mid-cap from ${etiFrom}) and custom implementations (${implEntry}). EU hosting by default, strict GDPR.`;
}

function pressReleaseLaunchBody(loc: "fr" | "en"): string {
  const interventionsEntry = getEntryLabel(INTERVENTION_TIERS, loc, { compact: true });
  const flash = formatAmount(auditFlash.priceFlat!, loc, { compact: true });
  const cibleMin = formatAmount(auditCible.priceMin!, loc, { compact: true });
  const cibleMax = formatAmount(auditCible.priceMax!, loc, { compact: true });
  const pmeMin = formatAmount(auditPme.priceMin!, loc, { compact: true });
  const pmeMax = formatAmount(auditPme.priceMax!, loc, { compact: true });
  const etiFrom = formatAmount(auditEti.priceMin!, loc, { compact: true });
  const implEntry = getEntryLabel(IMPLEMENTATION_TIERS, loc, { compact: true });
  if (loc === "fr") {
    return `Axion-IA, cabinet IA opérationnel, annonce le lancement de sa plateforme axion-ia.com. Le site présente trois modules d'intervention — sessions terrain ${interventionsEntry}, audits IA chiffrés en 4 niveaux (Flash ${flash}, Ciblé ${cibleMin} à ${cibleMax}, Stratégique PME ${pmeMin} à ${pmeMax}, Stratégique ETI à partir de ${etiFrom}), et implémentations sur mesure ${implEntry} — avec une promesse mesurable : un retour sur investissement chiffré dès la mise en production. Hébergée en UE, la plateforme cible les entreprises de toutes tailles, de l'artisan à l'ETI.`;
  }
  return `Axion-IA, an operational AI consultancy, announces the launch of its platform axion-ia.com. The site presents three service modules — on-site sessions ${interventionsEntry}, AI audits in 4 tiers (Flash ${flash}, Targeted ${cibleMin} to ${cibleMax}, Strategic SME ${pmeMin} to ${pmeMax}, Strategic Mid-cap from ${etiFrom}), and custom implementations ${implEntry} — with one measurable promise: a costed return on investment from the moment of go-live. Hosted in the EU, the platform targets companies of all sizes, from sole traders to mid-caps.`;
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
  fr: { name: string; role: string; bio: string };
  en: { name: string; role: string; bio: string };
}

export interface PressKitAsset {
  id: string;
  /** Asset category — drives card icon + group. */
  kind: "logo" | "wordmark" | "photo" | "brand-book" | "boilerplate";
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

export const PRESS_PITCH: { fr: PressPitchLocale; en: PressPitchLocale } = {
  fr: {
    eyebrow: "Espace presse",
    short: pressPitchShort("fr"),
    boilerplate:
      "Axion-IA est un cabinet de conseil IA opérationnel fondé en 2024. Le cabinet accompagne les entreprises de toutes tailles — de l'artisan à l'ETI — dans l'identification, la démonstration et l'implémentation d'usages d'intelligence artificielle générant un retour sur investissement mesurable. Méthode : démos sur données réelles, plan d'action chiffré, hébergement UE. Contact presse : presse@axion-ia.com.",
  },
  en: {
    eyebrow: "Press room",
    short: pressPitchShort("en"),
    boilerplate:
      "Axion-IA is an operational AI consultancy founded in 2024. The firm helps companies of all sizes — from sole traders to mid-caps — identify, demonstrate and implement artificial intelligence use cases that deliver measurable return on investment. Method: demos on real data, costed action plan, EU hosting. Press contact: presse@axion-ia.com.",
  },
};

// ─────────────────────────────────────────────────────────────────
// FAITS clés — chiffres factuels pour journalistes (carte fact-sheet).
// ─────────────────────────────────────────────────────────────────
export const PRESS_FACTS: ReadonlyArray<PressFact> = [
  {
    id: "founded",
    fr: { label: "Année de fondation", value: "2024" },
    en: { label: "Year founded", value: "2024" },
  },
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
    fr: { label: "Modules d'intervention", value: "3 (sessions · audit · implémentation)" },
    en: { label: "Service modules", value: "3 (sessions · audit · implementation)" },
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
// PRESS KIT — assets téléchargeables. `fileUrl: null` = placeholder UI disabled.
// Phase 1 : tous placeholders, Will fournit les binaires en suite.
// ─────────────────────────────────────────────────────────────────
export const PRESS_KIT_ASSETS: ReadonlyArray<PressKitAsset> = [
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
    id: "wordmark-dark",
    kind: "wordmark",
    fileUrl: null,
    format: "PNG",
    fr: {
      title: "Wordmark dark",
      description: "Wordmark sur fond mocha — usage éditorial premium.",
    },
    en: {
      title: "Wordmark dark",
      description: "Wordmark on mocha background — premium editorial use.",
    },
  },
  {
    id: "brand-book",
    kind: "brand-book",
    fileUrl: null,
    format: "PDF",
    fr: {
      title: "Brand book synthétique",
      description: "Palette, typographie, ton de voix, règles d'usage du logo.",
    },
    en: {
      title: "Brand book summary",
      description: "Palette, typography, tone of voice, logo usage rules.",
    },
  },
  {
    id: "founder-photo",
    kind: "photo",
    fileUrl: "/images/axion-ia-fondateur-williams-jullin-portrait-professionnel.jpg",
    format: "JPG",
    fr: {
      title: "Photo fondateur",
      description: "Portrait haute définition, format 1:1 et 16:9.",
    },
    en: {
      title: "Founder photo",
      description: "High-resolution portrait, 1:1 and 16:9 formats.",
    },
  },
  {
    id: "boilerplate",
    kind: "boilerplate",
    fileUrl: "/press/axion-ia-boilerplate-fr-en.txt",
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
      body: "Axion-IA détaille pour la presse sa méthode propriétaire en quatre étapes. Étape 1 : cadrage 30 minutes gratuit pour qualifier le besoin. Étape 2 : démonstration sur site ou à distance, sur les vraies données du client. Étape 3 : plan chiffré priorisé livré sous 5 jours. Étape 4 : mise en production avec 30 jours de support inclus. Cette approche élimine les POC théoriques sans suite, traditionnellement responsables de 80 % des échecs IA en entreprise.",
    },
    en: {
      title: "Axion-IA publishes its four-step method",
      dek: "Scoping, demonstration, costed plan, production — to go from AI idea to operational deployment without abandoned POCs.",
      body: "Axion-IA details its proprietary four-step method for the press. Step 1: free 30-minute scoping call to qualify the need. Step 2: on-site or remote demonstration on the client's real data. Step 3: prioritized costed plan delivered within 5 days. Step 4: production deployment with 30 days of support included. This approach eliminates the abandoned theoretical POCs traditionally responsible for 80% of enterprise AI failures.",
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
    linkedinUrl: "https://www.linkedin.com/company/axion-ia",
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
    },
    en: {
      name: "Williams",
      role: "Founder · lead consultant Axion-IA",
      bio: "Ten years in digital transformation, hands-on field practice. Williams leads Axion-IA enterprise engagements and embodies the firm's operational approach — demos on real data, costed plans, fast go-live. Available for FR + EN interviews, response within 48 business hours.",
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
        "Axion-IA accompagne tous types d'entreprises — artisans, TPE, PME, ETI, grandes organisations. La méthode s'adapte à l'échelle, mais reste identique : démo sur données réelles, plan chiffré, mise en production rapide.",
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
        "Oui. Plusieurs cas documentés sont disponibles sur axion-ia.com/cas-concrets — industrie, retail, juridique, banque, TPE — avec contexte, problème, solution et chiffres post-livraison. Sur demande, nous mettons en relation avec des clients prêts à témoigner.",
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
