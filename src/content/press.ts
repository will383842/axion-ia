// Press room fixtures (Sprint correctif 14.6 — page presse).
// Doctrine éditoriale v3 : ton factuel, anti-marketing. Anti-formation strict.
// FR canonical · EN miroir. Parité enforced via tests/content/press.test.ts.

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
export const PRESS_PITCH = {
  fr: {
    eyebrow: "Espace presse",
    short:
      "AxionIA est un cabinet IA opérationnel pour entreprises de toutes tailles — de l'artisan à l'ETI. Nous intervenons sur site ou à distance pour identifier, démontrer et implémenter des usages IA générant un retour sur investissement mesurable. Trois modules : interventions terrain (à partir de 490 €), audits IA en 4 niveaux (Flash 490 € → Stratégique ETI dès 12 000 €) et implémentations sur mesure (à partir de 990 €). Hébergement UE par défaut, RGPD strict.",
    boilerplate:
      "AxionIA OÜ est un cabinet de conseil IA opérationnel fondé en 2024. Le cabinet accompagne les entreprises de toutes tailles — de l'artisan à l'ETI — dans l'identification, la démonstration et l'implémentation d'usages d'intelligence artificielle générant un retour sur investissement mesurable. Méthode : démos sur données réelles, plan d'action chiffré, hébergement UE. Contact presse : presse@axion-ia.com.",
  },
  en: {
    eyebrow: "Press room",
    short:
      "AxionIA is an operational AI consultancy for companies of all sizes — from sole traders to mid-caps. We work on site or remotely to identify, demonstrate and implement AI use cases generating measurable return on investment. Three modules: on-site sessions (from €490), AI audits in 4 tiers (Flash €490 → Strategic Mid-cap from €12,000) and custom implementations (from €990). EU hosting by default, strict GDPR.",
    boilerplate:
      "AxionIA OÜ is an operational AI consultancy founded in 2024. The firm helps companies of all sizes — from sole traders to mid-caps — identify, demonstrate and implement artificial intelligence use cases that deliver measurable return on investment. Method: demos on real data, costed action plan, EU hosting. Press contact: presse@axion-ia.com.",
  },
} as const;

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
    fr: { label: "Prix d'entrée", value: "490 € · 1 journée" },
    en: { label: "Starting price", value: "€490 · 1 day" },
  },
  {
    id: "response-time",
    fr: { label: "Délai de réponse presse", value: "48 h ouvrées" },
    en: { label: "Press response time", value: "48 business hours" },
  },
] as const;

// ─────────────────────────────────────────────────────────────────
// PRESS KIT — assets téléchargeables. `fileUrl: null` = placeholder UI disabled.
// Phase 1 : tous placeholders, Will fournit les binaires en suite.
// ─────────────────────────────────────────────────────────────────
export const PRESS_KIT_ASSETS: ReadonlyArray<PressKitAsset> = [
  {
    id: "logo-primary",
    kind: "logo",
    fileUrl: null,
    format: "SVG",
    fr: {
      title: "Logo principal",
      description: "Wordmark Axion-IA, version couleur, format vectoriel.",
    },
    en: {
      title: "Primary logo",
      description: "Axion-IA wordmark, color version, vector format.",
    },
  },
  {
    id: "logo-monochrome",
    kind: "logo",
    fileUrl: null,
    format: "SVG",
    fr: {
      title: "Logo monochrome",
      description: "Version monochrome pour fonds clairs ou sombres.",
    },
    en: {
      title: "Monochrome logo",
      description: "Monochrome version for light or dark backgrounds.",
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
    fileUrl: null,
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
    fileUrl: null,
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
      title: "AxionIA lance sa plateforme de cabinet IA opérationnel",
      dek: "Le cabinet ouvre axion-ia.com, un point d'entrée unique pour les entreprises souhaitant identifier et déployer des usages IA à ROI mesurable.",
      body: "AxionIA OÜ, cabinet IA opérationnel, annonce le lancement de sa plateforme axion-ia.com. Le site présente trois modules d'intervention — sessions terrain à partir de 490 €, audits IA chiffrés en 4 niveaux (Flash 490 €, Ciblé 1 900 à 3 900 €, Stratégique PME 4 900 à 9 900 €, Stratégique ETI à partir de 12 000 €), et implémentations sur mesure à partir de 990 € — avec une promesse mesurable : un retour sur investissement chiffré dès la mise en production. Hébergée en UE, la plateforme cible les entreprises de toutes tailles, de l'artisan à l'ETI.",
    },
    en: {
      title: "AxionIA launches its operational AI consultancy platform",
      dek: "The firm opens axion-ia.com, a single entry point for companies looking to identify and deploy AI use cases with measurable ROI.",
      body: "AxionIA OÜ, an operational AI consultancy, announces the launch of its platform axion-ia.com. The site presents three service modules — on-site sessions from €490, AI audits in 4 tiers (Flash €490, Targeted €1,900 to €3,900, Strategic SME €4,900 to €9,900, Strategic Mid-cap from €12,000), and custom implementations from €990 — with one measurable promise: a costed return on investment from the moment of go-live. Hosted in the EU, the platform targets companies of all sizes, from sole traders to mid-caps.",
    },
  },
  {
    slug: "methode-axionia-quatre-etapes",
    publishedAt: "2026-05-07",
    tag: "milestone",
    fr: {
      title: "AxionIA publie sa méthode en quatre étapes",
      dek: "Cadrage, démonstration, plan chiffré, mise en production — pour passer de l'idée IA au déploiement opérationnel sans POC perdu.",
      body: "AxionIA détaille pour la presse sa méthode propriétaire en quatre étapes. Étape 1 : cadrage 30 minutes gratuit pour qualifier le besoin. Étape 2 : démonstration sur site ou à distance, sur les vraies données du client. Étape 3 : plan chiffré priorisé livré sous 5 jours. Étape 4 : mise en production avec 30 jours de support inclus. Cette approche élimine les POC théoriques sans suite, traditionnellement responsables de 80 % des échecs IA en entreprise.",
    },
    en: {
      title: "AxionIA publishes its four-step method",
      dek: "Scoping, demonstration, costed plan, production — to go from AI idea to operational deployment without abandoned POCs.",
      body: "AxionIA details its proprietary four-step method for the press. Step 1: free 30-minute scoping call to qualify the need. Step 2: on-site or remote demonstration on the client's real data. Step 3: prioritized costed plan delivered within 5 days. Step 4: production deployment with 30 days of support included. This approach eliminates the abandoned theoretical POCs traditionally responsible for 80% of enterprise AI failures.",
    },
  },
  {
    slug: "souverainete-ue-hebergement-axionia",
    publishedAt: "2026-05-07",
    tag: "study",
    fr: {
      title: "Souveraineté IA : AxionIA confirme l'hébergement UE par défaut",
      dek: "Tous les workloads clients sont hébergés sur Hetzner Frankfurt. Aucun envoi de données sensibles à des tiers sans consentement explicite.",
      body: "Face aux préoccupations croissantes des dirigeants européens sur la souveraineté des données IA, AxionIA confirme une politique d'hébergement UE par défaut. Toute donnée client transite et reste sur Hetzner CX32 à Frankfurt. Les modèles IA peuvent être hébergés on-premise ou sur infrastructure dédiée si requis. La politique RGPD est strictement appliquée : exercice des droits sous 30 jours, anonymisation systématique des échantillons utilisés en démos, DPO joignable à dpo@axion-ia.com.",
    },
    en: {
      title: "AI sovereignty: AxionIA confirms EU hosting by default",
      dek: "All client workloads are hosted on Hetzner Frankfurt. No sensitive data sent to third parties without explicit consent.",
      body: "Faced with growing concerns from European executives about AI data sovereignty, AxionIA confirms a default EU hosting policy. All client data transits through and remains on Hetzner CX32 in Frankfurt. AI models can be hosted on-premise or on dedicated infrastructure if required. GDPR policy is strictly enforced: rights exercise within 30 days, systematic anonymization of samples used in demos, DPO reachable at dpo@axion-ia.com.",
    },
  },
] as const;

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
      name: "Will",
      role: "Fondateur · lead consultant AxionIA",
      bio: "Dix ans en transformation digitale, opérationnel terrain. Will dirige les interventions AxionIA en entreprise et incarne l'approche opérationnelle du cabinet — démos sur données réelles, plans chiffrés, mise en production rapide. Disponible pour interviews FR + EN, réponse sous 48 h ouvrées.",
    },
    en: {
      name: "Will",
      role: "Founder · lead consultant AxionIA",
      bio: "Ten years in digital transformation, hands-on field practice. Will leads AxionIA enterprise engagements and embodies the firm's operational approach — demos on real data, costed plans, fast go-live. Available for FR + EN interviews, response within 48 business hours.",
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
      question: "Quelle est la structure juridique d'AxionIA ?",
      answer:
        "AxionIA OÜ est une société de droit européen. La facturation est émise selon le régime TVA UE applicable à la résidence du client (autoliquidation B2B intracommunautaire avec n° TVA valide).",
    },
    en: {
      question: "What is AxionIA's legal structure?",
      answer:
        "AxionIA OÜ is a European-law company. Invoicing is issued under the EU VAT regime applicable to the client's residence (intracommunity B2B reverse charge with valid VAT number).",
    },
  },
  {
    id: "clients",
    fr: {
      question: "Qui sont vos clients types ?",
      answer:
        "AxionIA accompagne tous types d'entreprises — artisans, TPE, PME, ETI, grandes organisations. La méthode s'adapte à l'échelle, mais reste identique : démo sur données réelles, plan chiffré, mise en production rapide.",
    },
    en: {
      question: "Who are your typical clients?",
      answer:
        "AxionIA serves companies of all sizes — sole traders, small businesses, SMEs, mid-caps, large organizations. The method adapts to scale but remains identical: demo on real data, costed plan, fast production deployment.",
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
        "Oui. Will, fondateur, est disponible pour interviews écrites, vocales (téléphone, Zoom, Google Meet), vidéo (studio ou visio HD) et podcast. Langues : FR et EN. Délai de coordination : 48 h ouvrées.",
    },
    en: {
      question: "Do you accept video and podcast interviews?",
      answer:
        "Yes. Will, founder, is available for written, voice (phone, Zoom, Google Meet), video (studio or HD video call) and podcast interviews. Languages: FR and EN. Coordination lead time: 48 business hours.",
    },
  },
  {
    id: "data-policy",
    fr: {
      question: "Comment AxionIA traite-t-elle les données clients ?",
      answer:
        "Hébergement UE par défaut sur Hetzner Frankfurt. Aucun envoi de données sensibles à des tiers sans consentement explicite. Politique RGPD complète, exercice des droits sous 30 jours, anonymisation systématique des échantillons utilisés en démos.",
    },
    en: {
      question: "How does AxionIA handle client data?",
      answer:
        "EU hosting by default on Hetzner Frankfurt. No sensitive data sent to third parties without explicit consent. Full GDPR policy, rights exercise within 30 days, systematic anonymization of samples used in demos.",
    },
  },
  {
    id: "exclusives",
    fr: {
      question: "Proposez-vous des exclusivités presse ?",
      answer:
        "Oui, sous réserve de réciprocité éditoriale. Pour les annonces produits ou études sectorielles, AxionIA peut accorder une fenêtre d'embargo de 24 à 72 h à un média lead. Contact : presse@axion-ia.com avec sujet « Exclusivité ».",
    },
    en: {
      question: "Do you offer press exclusives?",
      answer:
        'Yes, subject to editorial reciprocity. For product announcements or sector studies, AxionIA can grant a 24 to 72-hour embargo window to a lead media outlet. Contact: presse@axion-ia.com with subject "Exclusive".',
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
