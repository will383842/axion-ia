// SSOT sous-processeurs RGPD — Sprint X.17 / Booking V1.
//
// Tableau public de transparence (RGPD art. 28). Liste exhaustive des
// sous-traitants ayant accès à des données personnelles ou techniques de
// l'app Axion-IA.
//
// Critères inclusion : tout tiers qui PROCESSE des données client (PII ou
// pseudonymisées) côté infrastructure ou logique applicative.
//
// Auto-hébergés (DocuSeal, Mailwizz/PowerMTA, Plausible) : pas des
// sous-traitants externes au sens RGPD (Axion-IA OÜ est seul responsable),
// mais référencés en transparence (Hetzner DE = hébergement physique).

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
  /** Lien DPO / documentation publique du sous-processeur. */
  documentationUrl?: string;
}

export const SUBPROCESSORS: ReadonlyArray<Subprocessor> = [
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
    documentationUrl: "https://www.cloudflare.com/cloudflare-customer-dpa/",
  },
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
    documentationUrl: "https://stripe.com/legal/dpa",
  },
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
    documentationUrl: "https://sentry.io/legal/dpa/",
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
    documentationUrl: "https://wiki.osmfoundation.org/wiki/Privacy_Policy",
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
    documentationUrl: "https://www.docuseal.com",
  },
];
