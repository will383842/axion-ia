// SSOT sous-processeurs RGPD — Sprint X.17 / Booking V1 + Audit B5 RGPD 2026-05-15.
//
// Tableau public de transparence (RGPD art. 28 + 30 + 13.1.e). Liste exhaustive
// des sous-traitants ayant accès à des données personnelles, techniques OU
// éditoriales (content-gen prompts + KB chunks publics) de l'app Axion-IA.
//
// Critères inclusion : tout tiers qui PROCESSE des données client (PII ou
// pseudonymisées) OU des données éditoriales (prompts content-gen, queries
// research), que ce soit côté infrastructure, côté logique applicative, ou
// DANS LE NAVIGATEUR DU VISITEUR (script tiers, iframe, embed, preconnect).
//
// ⚠️ Ce critère n'a jamais été le problème — Clarity et Turnstile, tous deux
// 100 % navigateur, y figurent depuis toujours. La VRAIE cause de l'omission de
// Calendly est chronologique : cette SSOT a été figée le 2026-05-15, et toute
// la chaîne Calendly a atterri le 2026-05-26, onze jours plus tard. Rien ne
// forçait la mise à jour. C'est
// `src/content/__tests__/subprocessors-coherence.spec.ts` qui empêche désormais
// la récidive — pas la formulation ci-dessus. Il est adossé à `src/lib/csp.ts`,
// seul goulot qu'un tiers ne peut pas contourner pour charger.
//
// Auto-hébergés (DocuSeal, Mailwizz/PowerMTA, Plausible, Uptime Kuma) : pas
// des sous-traitants externes au sens RGPD (Axion-IA est seule responsable),
// mais référencés en transparence (Hetzner DE = hébergement physique).
//
// Cette SSOT est la SOURCE UNIQUE de vérité publique sous-processeurs. La page
// `politique-confidentialite` (`src/content/legal.ts`) en cite seulement un
// résumé court avec un lien vers `/sous-processeurs` — fin de la divergence
// historique entre les 2 sources (audit B5 P0-1).
//
// Pour le registre interne RGPD art. 30 avec statut signature DPA, voir
// `axionia/_AUDIT/DPA-REGISTER.md`.

/**
 * Date de dernière mise à jour de la SSOT sous-processeurs (RGPD art. 13.1.e
 * — bonne pratique transparence). Affichée en haut de `/sous-processeurs`.
 * Update à chaque ajout/modification d'entrée.
 */
export const SUBPROCESSORS_LAST_UPDATED = "2026-07-26" as const;

export type TransferFramework = "intra_eu" | "scc" | "adequacy_decision" | "self_hosted_eu";

export interface Subprocessor {
  /** Nom commercial. */
  name: string;
  /** Localisation siège social. */
  location: string;
  /** Localisation des serveurs / traitement effectif. */
  serversLocation: string;
  /** Finalité du traitement (1 phrase). */
  purposeFr: string;
  purposeEn: string;
  /** Catégories de données traitées. */
  dataCategoriesFr: string;
  dataCategoriesEn: string;
  /** Base légale RGPD (art. 6 §1). */
  legalBasis: "6.1.b_contract" | "6.1.f_legitimate_interest" | "6.1.a_consent";
  /** DPA signé / disponible. */
  dpaStatus: "signed" | "auto_signable_dashboard" | "self_hosted_no_dpa" | "pending";
  /** Cadre transfert international. */
  transferFramework: TransferFramework;
  /**
   * Catégorie fonctionnelle. Affichée en regroupement visuel sur la page
   * publique pour distinguer infrastructure CORE vs services applicatifs vs
   * content-gen IA.
   */
  category: "core_infra" | "payments" | "communications" | "analytics_obs" | "content_gen_ai";
  /**
   * Statut d'activation effectif en prod. `active` = le code envoie
   * effectivement des données au provider aujourd'hui. `pending_activation` =
   * intégration codée mais clé API absente de Coolify env → aucun flux data
   * réel (cas content-gen IA tant que Will n'a pas signé les DPA).
   */
  activationStatus: "active" | "pending_activation";
  /** Lien DPO / documentation publique du sous-processeur. */
  documentationUrl?: string;
}

export const SUBPROCESSORS: ReadonlyArray<Subprocessor> = [
  // ───────────────────────────── core infrastructure
  {
    name: "Hetzner Online GmbH",
    location: "Gunzenhausen, Allemagne (UE)",
    serversLocation: "Frankfurt + Nuremberg, Allemagne (UE)",
    purposeFr:
      "Hébergement applicatif (VPS), base PostgreSQL, Redis, stockage objet et back-up chiffrés.",
    purposeEn:
      "Application hosting (VPS), PostgreSQL database, Redis, encrypted object storage and backups.",
    dataCategoriesFr:
      "Toutes les données techniques et personnelles transitant par l'app (Submissions, Bookings, Payments, Invoices…).",
    dataCategoriesEn:
      "All technical and personal data flowing through the app (Submissions, Bookings, Payments, Invoices…).",
    legalBasis: "6.1.b_contract",
    dpaStatus: "signed",
    transferFramework: "intra_eu",
    category: "core_infra",
    activationStatus: "active",
    documentationUrl: "https://www.hetzner.com/legal/data-privacy-faq",
  },
  {
    name: "Cloudflare Inc.",
    location: "San Francisco, USA",
    serversLocation: "Réseau global edge, traitement EU pour zone UE",
    purposeFr: "CDN, protection anti-DDoS, Bot Fight, DNS, Turnstile (anti-bot, sans cookie).",
    purposeEn: "CDN, anti-DDoS protection, Bot Fight, DNS, Turnstile (no-cookie anti-bot).",
    dataCategoriesFr:
      "Adresses IP visiteur, user-agent, requêtes HTTP. Pas de cookie publicitaire.",
    dataCategoriesEn: "Visitor IP addresses, user-agent, HTTP requests. No advertising cookies.",
    legalBasis: "6.1.f_legitimate_interest",
    dpaStatus: "auto_signable_dashboard",
    transferFramework: "scc",
    category: "core_infra",
    activationStatus: "active",
    documentationUrl: "https://www.cloudflare.com/cloudflare-customer-dpa/",
  },
  // ───────────────────────────── paiements & contrats
  {
    name: "Stripe Payments Europe Ltd",
    location: "Dublin, Irlande (UE)",
    serversLocation: "UE (Dublin, Frankfurt) + USA (réplication)",
    purposeFr:
      "Traitement des paiements (Stripe Checkout, webhooks), Stripe Radar anti-fraude, gestion des remboursements.",
    purposeEn: "Payment processing (Stripe Checkout, webhooks), Stripe Radar anti-fraud, refunds.",
    dataCategoriesFr:
      "Email, nom, montants facturés/payés, numéro de facture, métadonnées booking. PAS de numéro de carte (Stripe-hosted).",
    dataCategoriesEn:
      "Email, name, billed/paid amounts, invoice number, booking metadata. NO card number (Stripe-hosted).",
    legalBasis: "6.1.b_contract",
    dpaStatus: "auto_signable_dashboard",
    transferFramework: "scc",
    category: "payments",
    // 🔴 « active » ÉTAIT FAUX, dans un document juridique PUBLIÉ (2026-08-04).
    //
    // Cette page déclare aux personnes concernées qui traite leurs données.
    // Stripe y figurait comme sous-traitant ACTIF « traitement des paiements,
    // Radar anti-fraude, remboursements » — alors qu'il ne traite rien :
    //   · `STRIPE_ENABLED` n'est pas posé en production → `isStripeConfigured()`
    //     renvoie false, aucun paiement ni remboursement n'est émis ;
    //   · le flux qu'il servait a été remplacé par Calendly ;
    //   · 0 ligne dans `payments`, `bookings` et `stripe_webhook_events`.
    // Aucune donnée personnelle ne lui a jamais été transmise.
    //
    // Sur-déclarer un sous-traitant n'expose personne, mais c'est une
    // affirmation fausse dans une notice publique : elle égare une personne qui
    // exerce ses droits et un auditeur qui vérifie le registre. Le statut
    // `pending_activation` dit exactement la situation — son propre libellé
    // affiché est « intégration codée ; activation conditionnée à la signature
    // du DPA et à l'ajout de la clé API ».
    //
    // ⚠️ À repasser à « active » en même temps que `STRIPE_ENABLED=true`.
    activationStatus: "pending_activation",
    documentationUrl: "https://stripe.com/legal/dpa",
  },
  {
    name: "DocuSeal Community (self-hosted)",
    location: "Hébergement Hetzner Allemagne (UE)",
    serversLocation: "Frankfurt, Allemagne (UE)",
    purposeFr:
      "Signature électronique des contrats et devis (Sprint X.3+). Auto-hébergé sur notre infrastructure — pas de SaaS tiers.",
    purposeEn:
      "E-signature for contracts and quotes (Sprint X.3+). Self-hosted on our infra — no third-party SaaS.",
    dataCategoriesFr:
      "Nom et email des signataires, contenu signé du contrat, horodatage cryptographique, hash PDF.",
    dataCategoriesEn:
      "Signers' name and email, signed contract content, cryptographic timestamp, PDF hash.",
    legalBasis: "6.1.b_contract",
    dpaStatus: "self_hosted_no_dpa",
    transferFramework: "self_hosted_eu",
    category: "payments",
    activationStatus: "active",
    documentationUrl: "https://www.docuseal.com",
  },
  // ───────────────────────────── communications & géo
  {
    name: "Telegram FZ-LLC",
    location: "Dubaï, Émirats Arabes Unis (hors UE)",
    serversLocation: "Émirats Arabes Unis + edge global",
    purposeFr:
      "Notifications administratives via Bot API à destination du gérant (alertes opérations).",
    purposeEn: "Admin notifications via Bot API to the manager (operations alerts).",
    dataCategoriesFr:
      "PII minimisée (cf. ADR 0010) : email partiel `j****@acme.com`, initiales `J. D.`, téléphone partiel, sociétés en clair, dates/prix/IDs UUID.",
    dataCategoriesEn:
      "Minimised PII (ADR 0010): partial email `j****@acme.com`, initials `J. D.`, partial phone, company names in clear, dates/prices/UUIDs.",
    legalBasis: "6.1.f_legitimate_interest",
    dpaStatus: "self_hosted_no_dpa",
    transferFramework: "scc",
    category: "communications",
    activationStatus: "active",
    documentationUrl: "https://telegram.org/privacy",
  },
  {
    // Omis de cette liste du 2026-05-26 au 2026-07-26 pendant que
    // /sous-processeurs se déclarait « exhaustive » (RGPD art. 13.1.e).
    name: "Calendly LLC",
    location: "Atlanta, Géorgie, États-Unis",
    serversLocation: "États-Unis (AWS) + edge Cloudflare",
    purposeFr:
      "Prise de rendez-vous en ligne — calendrier embarqué sur la page /appel, affiché uniquement après une action explicite du visiteur (art. 82 loi Informatique et Libertés). Les événements de réservation sont reçus côté navigateur puis enregistrés (cf. ADR 0030).",
    purposeEn:
      "Online appointment booking — calendar embedded on the /appel page, displayed only after an explicit visitor action (art. 82 French Data Protection Act). Booking events are received client-side then stored (see ADR 0030).",
    dataCategoriesFr:
      "Nom, adresse email, téléphone et message saisis dans le formulaire de réservation ; adresse IP, user-agent et page référente ; cookies déposés sur le domaine calendly.com, dont certains le sont par l'infrastructure edge de l'éditeur et non par l'éditeur lui-même.",
    dataCategoriesEn:
      "Name, email address, phone and message entered in the booking form; IP address, user-agent and referring page; cookies set on the calendly.com domain, some of which come from the publisher's edge infrastructure rather than from the publisher itself.",
    // 6.1.b et NON 6.1.a : réserver un appel de découverte relève des mesures
    // précontractuelles. Le consentement en jeu ici est celui de l'art. 82
    // (accès au terminal), instrument distinct — déclarer 6.1.a ouvrirait un
    // droit de retrait art. 7.3 sur les réservations déjà enregistrées.
    legalBasis: "6.1.b_contract",
    // `auto_signable_dashboard` = MÉCANISME (« DPA auto-signable »), pas
    // achèvement — même traitement que Cloudflare, Stripe et Sentry, dont le
    // DPA s'accepte aussi au dashboard. Le geste restant de Will est tracé là
    // où il doit l'être : ligne 16 de _AUDIT/DPA-REGISTER.md, « 🟡 à accepter ».
    // NE PAS passer à "pending" : dans cette SSOT, "pending" n'est employé que
    // conjointement à `pending_activation`, or Calendly est bel et bien actif.
    dpaStatus: "auto_signable_dashboard",
    transferFramework: "scc",
    category: "communications",
    activationStatus: "active",
    documentationUrl: "https://calendly.com/dpa",
  },
  {
    name: "OpenStreetMap Foundation (Nominatim)",
    location: "Cambridge, Royaume-Uni",
    serversLocation: "UE et Royaume-Uni",
    purposeFr: "Géocodage des villes saisies par les visiteurs pour calcul buffer trajet.",
    purposeEn: "City geocoding submitted by visitors, used to compute travel buffer.",
    dataCategoriesFr: "Nom de ville en clair + code pays (pas d'IP visiteur transmise).",
    dataCategoriesEn: "City name in plain text + country code (no visitor IP transmitted).",
    legalBasis: "6.1.f_legitimate_interest",
    dpaStatus: "self_hosted_no_dpa",
    transferFramework: "adequacy_decision",
    category: "communications",
    activationStatus: "active",
    documentationUrl: "https://wiki.osmfoundation.org/wiki/Privacy_Policy",
  },
  // ───────────────────────────── analytics & observabilité
  {
    name: "Sentry (Functional Software Inc.)",
    location: "San Francisco, USA",
    serversLocation: "UE (Frankfurt) — option configurée",
    purposeFr:
      "Surveillance technique des erreurs applicatives (PII scrubbing actif côté serveur).",
    purposeEn: "Application error monitoring (server-side PII scrubbing active).",
    dataCategoriesFr:
      "Stack traces, URLs, identifiants techniques (pseudonymisés). Emails et corps de requête masqués.",
    dataCategoriesEn:
      "Stack traces, URLs, technical identifiers (pseudonymised). Emails and request bodies redacted.",
    legalBasis: "6.1.f_legitimate_interest",
    dpaStatus: "auto_signable_dashboard",
    transferFramework: "scc",
    category: "analytics_obs",
    activationStatus: "active",
    documentationUrl: "https://sentry.io/legal/dpa/",
  },
  {
    name: "Plausible Community (self-hosted)",
    location: "Hébergement Hetzner Allemagne (UE)",
    serversLocation: "Frankfurt, Allemagne (UE)",
    purposeFr:
      "Analytics agrégés sans cookie. Pas de tracking individuel. Auto-hébergé sur notre infrastructure.",
    purposeEn:
      "Aggregate analytics without cookies. No individual tracking. Self-hosted on our infra.",
    dataCategoriesFr: "Vues de pages anonymisées, referrers, navigateur agrégé.",
    dataCategoriesEn: "Anonymous page views, referrers, aggregated browser stats.",
    legalBasis: "6.1.f_legitimate_interest",
    dpaStatus: "self_hosted_no_dpa",
    transferFramework: "self_hosted_eu",
    category: "analytics_obs",
    activationStatus: "active",
  },
  {
    name: "Microsoft Clarity (Microsoft Corporation)",
    location: "Redmond, Washington, USA",
    serversLocation: "USA (Azure global)",
    purposeFr:
      "Analytics qualitatifs UX — heatmaps clics/scroll, session replay anonymisé (masquage automatique des champs de formulaire), détection de frustration (rage clicks, dead clicks, quick backs). Gating consent CMP obligatoire (`CookieConsent` banner). Plausible self-hosted couvre l'analytics quantitatif sans cookie en parallèle.",
    purposeEn:
      "Qualitative UX analytics — click/scroll heatmaps, anonymised session replay (automatic form field masking), frustration detection (rage clicks, dead clicks, quick backs). Mandatory CMP consent gating (`CookieConsent` banner). Plausible self-hosted handles quantitative cookie-less analytics in parallel.",
    dataCategoriesFr:
      "Cookies `_clck` (1 an, identifiant visiteur unique) + `_clsk` (1 jour, identifiant session). Adresse IP, user-agent, URL visitées, comportement de navigation (clics, scroll, mouvement souris, focus formulaire avec masquage des valeurs). Pas de PII en clair grâce au masquage Clarity par défaut.",
    dataCategoriesEn:
      "Cookies `_clck` (1 year, unique visitor ID) + `_clsk` (1 day, session ID). IP address, user-agent, URLs visited, navigation behavior (clicks, scroll, mouse movement, form focus with value masking). No cleartext PII thanks to Clarity default masking.",
    legalBasis: "6.1.a_consent",
    dpaStatus: "pending",
    transferFramework: "scc",
    category: "analytics_obs",
    activationStatus: "pending_activation",
    documentationUrl:
      "https://www.microsoft.com/licensing/docs/view/Microsoft-Products-and-Services-Data-Protection-Addendum-DPA",
  },
  // ───────────────────────────── content-gen IA (audit B5 2026-05-15)
  // Code intégré (`src/server/content-gen/providers/*.ts`) — clés API non
  // encore présentes dans Coolify env → `pending_activation` jusqu'à
  // signature DPA + ajout `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` /
  // `PERPLEXITY_API_KEY` / `UNSPLASH_ACCESS_KEY` / `VOYAGE_API_KEY`.
  {
    name: "OpenAI, LLC",
    location: "San Francisco, USA",
    serversLocation: "USA (option EU data residency Tier 4+ Enterprise)",
    purposeFr:
      "Génération de contenu éditorial (GPT-4o text + GPT-image-1 V2) pour les Articles signés Manon. Prompts éditoriaux uniquement — aucune donnée client n'est transmise dans les prompts (cf. doctrine § 0.5 master prompt content-gen + helper `pii-safe.ts`). Option Zero Data Retention (ZDR) activée en prod.",
    purposeEn:
      "Editorial content generation (GPT-4o text + GPT-image-1 V2) for articles signed by Manon. Editorial prompts only — no client data sent in prompts (master prompt § 0.5 + `pii-safe.ts` helper). Zero Data Retention (ZDR) enabled in prod.",
    dataCategoriesFr:
      "Prompts éditoriaux (titre, intent SEO, ville/région cible) + chunks KB `public` uniquement. Refus dur sur chunks `confidential`/`secret` (`EmbeddingConfidentialityRefusal`).",
    dataCategoriesEn:
      "Editorial prompts (title, SEO intent, target city/region) + `public` KB chunks only. Hard refusal on `confidential`/`secret` chunks.",
    legalBasis: "6.1.f_legitimate_interest",
    dpaStatus: "pending",
    transferFramework: "scc",
    category: "content_gen_ai",
    activationStatus: "pending_activation",
    documentationUrl: "https://openai.com/policies/data-processing-addendum",
  },
  {
    name: "Anthropic PBC",
    location: "San Francisco, USA",
    serversLocation: "USA (option AWS Bedrock EU `eu-central-1` à l'étude)",
    purposeFr:
      "Génération de contenu éditorial via Claude (Sonnet/Opus/Haiku) — fallback OpenAI + multi-modèles V2 + prompt caching. Opt-out training par défaut (Commercial DPA).",
    purposeEn:
      "Editorial content generation via Claude (Sonnet/Opus/Haiku) — fallback OpenAI + multi-model V2 + prompt caching. Default opt-out training (Commercial DPA).",
    dataCategoriesFr:
      "Idem OpenAI : prompts éditoriaux uniquement, pas de PII client. Chunks KB `public` only.",
    dataCategoriesEn:
      "Same as OpenAI: editorial prompts only, no client PII. `public` KB chunks only.",
    legalBasis: "6.1.f_legitimate_interest",
    dpaStatus: "pending",
    transferFramework: "scc",
    category: "content_gen_ai",
    activationStatus: "pending_activation",
    documentationUrl: "https://www.anthropic.com/legal/commercial-dpa",
  },
  {
    name: "Perplexity AI, Inc.",
    location: "San Francisco, USA",
    serversLocation: "USA",
    purposeFr:
      "Recherche temps-réel et citations sources via Sonar API pour fact-checking et veille RSS éditoriale (sans PII visiteur).",
    purposeEn:
      "Real-time search and source citations via Sonar API for fact-checking and editorial RSS curation (no visitor PII).",
    dataCategoriesFr: "Queries de recherche éditoriales (villes, secteurs, intent SEO).",
    dataCategoriesEn: "Editorial search queries (cities, sectors, SEO intent).",
    legalBasis: "6.1.f_legitimate_interest",
    dpaStatus: "pending",
    transferFramework: "scc",
    category: "content_gen_ai",
    activationStatus: "pending_activation",
    documentationUrl: "https://www.perplexity.ai/hub/legal/data-processing-addendum",
  },
  {
    name: "Unsplash Inc.",
    location: "Montréal, Canada",
    serversLocation: "Canada + USA (CDN global)",
    purposeFr:
      "Recherche d'images stock libres de droits (attribution photographe) pour illustrations Articles. Aucune donnée visiteur transmise — uniquement les mots-clés de recherche image.",
    purposeEn:
      "Royalty-free stock image search (photographer attribution) for article illustrations. No visitor data transmitted — only image search keywords.",
    dataCategoriesFr: "Mots-clés de recherche image (FR/EN).",
    dataCategoriesEn: "Image search keywords (FR/EN).",
    legalBasis: "6.1.f_legitimate_interest",
    dpaStatus: "pending",
    transferFramework: "adequacy_decision", // Canada : décision d'adéquation UE 2001
    category: "content_gen_ai",
    activationStatus: "pending_activation",
    documentationUrl: "https://unsplash.com/privacy",
  },
  {
    name: "Voyage AI, Inc.",
    location: "Palo Alto, USA",
    serversLocation: "USA",
    purposeFr:
      "Embeddings vectoriels (`voyage-3-lite`, 1024 dim) pour la base de connaissances éditoriale Axion-IA (recherche hybride dedup factory). Hard gate code : seules les entrées `public` sont envoyées — refus dur sur `confidential`/`secret`.",
    purposeEn:
      "Vector embeddings (`voyage-3-lite`, 1024 dim) for the Axion-IA editorial knowledge base (hybrid dedup factory search). Code hard gate: only `public` entries are sent — hard refusal on `confidential`/`secret`.",
    dataCategoriesFr: "Texte éditorial public à embedder (jamais de PII client, hard gate).",
    dataCategoriesEn: "Public editorial text to embed (never client PII, hard gate).",
    legalBasis: "6.1.f_legitimate_interest",
    dpaStatus: "pending",
    transferFramework: "scc",
    category: "content_gen_ai",
    activationStatus: "pending_activation",
    documentationUrl: "https://www.voyageai.com/privacy",
  },
];
