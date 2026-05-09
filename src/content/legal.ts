// Legal content — 6 pages (Sprint 10). Estonian OÜ jurisdiction.
// CLAUDE.md v6 §1 + §5 + §22. Source: docs 28 + 31.
// registrikood + EU VAT : will fournit plus tard, communiqués sur demande
// dans l'intervalle (cf. /mentions-legales section "Éditeur").

export type LegalSlug =
  | "mentions-legales"
  | "conditions-generales"
  | "politique-confidentialite"
  | "cookies"
  | "rgpd"
  | "politique-deplacement";

interface LegalContent {
  slug: LegalSlug;
  pathFr: string;
  pathEn: string;
  fr: PageCopy;
  en: PageCopy;
}

interface PageCopy {
  title: string;
  /** Optional emphasized portion rendered in serif italic terracotta (parity v3). */
  titleEm?: string;
  intro: string;
  sections: ReadonlyArray<{ title: string; body: string }>;
  metaSeo: { title: string; description: string };
}

export const LEGAL_PAGES: ReadonlyArray<LegalContent> = [
  {
    slug: "mentions-legales",
    pathFr: "/mentions-legales",
    pathEn: "/legal-notice",
    fr: {
      title: "Mentions",
      titleEm: "légales",
      intro:
        "Informations légales relatives au site axion-ia.com et à la société Axion-IA OÜ, conformes au droit estonien.",
      sections: [
        {
          title: "Éditeur",
          body: "Axion-IA OÜ · société à responsabilité limitée de droit estonien (Eesti). Siège social : Tallinn, Estonie. Numéro d'enregistrement (registrikood) et numéro de TVA EE communiqués sur demande à contact@axion-ia.com.",
        },
        {
          title: "Directeur de publication",
          body: "Will (gérant). Email : contact@axion-ia.com.",
        },
        {
          title: "Hébergeur",
          body: "Hetzner Online GmbH · Industriestr. 25 · 91710 Gunzenhausen · Allemagne · UE. Données stockées et traitées dans l'UE (datacenter Frankfurt).",
        },
        {
          title: "Propriété intellectuelle",
          body: "L'ensemble des contenus du site (textes, marques, logos, mises en page) est la propriété d'Axion-IA OÜ. Toute reproduction non autorisée est interdite.",
        },
        {
          title: "Loi applicable",
          body: "Le présent site est régi par le droit estonien. Tout litige relève de la compétence des tribunaux compétents en Estonie.",
        },
      ],
      metaSeo: {
        title: "Mentions légales · Axion-IA OÜ",
        description:
          "Mentions légales d'Axion-IA OÜ (société de droit estonien). Hébergement Hetzner Frankfurt UE.",
      },
    },
    en: {
      title: "Legal",
      titleEm: "notice",
      intro:
        "Legal information about axion-ia.com and Axion-IA OÜ, in accordance with Estonian law.",
      sections: [
        {
          title: "Publisher",
          body: "Axion-IA OÜ · Estonian limited liability company. Registered office: Tallinn, Estonia. Registration code (registrikood) and EU VAT number available on request at contact@axion-ia.com.",
        },
        {
          title: "Publication director",
          body: "Will (manager). Email: contact@axion-ia.com.",
        },
        {
          title: "Hosting provider",
          body: "Hetzner Online GmbH · Industriestr. 25 · 91710 Gunzenhausen · Germany · EU. Data stored and processed in the EU (Frankfurt datacenter).",
        },
        {
          title: "Intellectual property",
          body: "All content on the site (text, marks, logos, layouts) is the property of Axion-IA OÜ. Any unauthorized reproduction is prohibited.",
        },
        {
          title: "Applicable law",
          body: "This site is governed by Estonian law. Any dispute falls within the jurisdiction of the competent courts in Estonia.",
        },
      ],
      metaSeo: {
        title: "Legal notice · Axion-IA OÜ",
        description:
          "Legal notice for Axion-IA OÜ (Estonian company). Hetzner Frankfurt EU hosting.",
      },
    },
  },
  {
    slug: "conditions-generales",
    pathFr: "/conditions-generales",
    pathEn: "/terms",
    fr: {
      title: "Conditions",
      titleEm: "générales",
      intro:
        "Conditions générales de vente et d'utilisation des services Axion-IA. Règles applicables aux interventions, audits, implémentations IA.",
      sections: [
        {
          title: "Objet",
          body: "Les présentes conditions régissent la vente et la prestation des services Axion-IA OÜ : interventions sur site, audits IA, implémentations IA. Toute commande implique l'acceptation pleine et entière des présentes conditions.",
        },
        {
          title: "Devis et commande",
          body: "Tout service fait l'objet d'un devis chiffré, valable 30 jours. La commande est ferme à réception du virement bancaire. Aucune mensualité ni abonnement.",
        },
        {
          title: "Tarifs et paiement",
          body: "Les prix sont indiqués en euros HT. La TVA estonienne (EE) est appliquée selon la résidence du client (B2B intracommunautaire ou TVA EE). Paiement par virement bancaire à la commande pour les prestations < 5 000 € ; échelonnement possible au-delà.",
        },
        {
          title: "Livraison",
          body: "Les délais sont indiqués dans chaque devis. Axion-IA s'engage à respecter les délais sauf cas de force majeure ou retard imputable au client (accès données, disponibilité équipe).",
        },
        {
          title: "Garanties et limites de responsabilité",
          body: "Axion-IA fournit ses prestations selon les standards de l'art. La responsabilité d'Axion-IA est limitée au montant facturé pour la prestation concernée. Aucune garantie de résultat n'est donnée — les ROI estimés sont indicatifs.",
        },
        {
          title: "Annulation et remboursement",
          body: "Annulation par le client > 7 j avant l'intervention : 100 % remboursement. Entre 7 et 2 j : 50 %. Moins de 2 j : aucun remboursement, créneau reportable une fois sans frais.",
        },
        {
          title: "Loi applicable et juridiction",
          body: "Les présentes conditions sont régies par le droit estonien. Tout litige relève des tribunaux compétents en Estonie.",
        },
      ],
      metaSeo: {
        title: "Conditions générales · Axion-IA",
        description:
          "CGV et CGU Axion-IA OÜ : devis, paiement, livraison, garanties. Droit estonien applicable.",
      },
    },
    en: {
      title: "Terms &",
      titleEm: "conditions",
      intro:
        "Terms of sale and use for Axion-IA services. Rules applicable to AI sessions, audits and implementations.",
      sections: [
        {
          title: "Purpose",
          body: "These terms govern the sale and provision of Axion-IA OÜ services: on-site sessions, AI audits, AI implementations. Any order implies full acceptance of these terms.",
        },
        {
          title: "Quote and order",
          body: "Each service is subject to a costed quote, valid 30 days. The order becomes firm upon receipt of bank transfer. No subscriptions, no commitments.",
        },
        {
          title: "Pricing and payment",
          body: "Prices are in euros (excl. VAT). Estonian VAT (EE) is applied according to client residence (intra-EU B2B or EE VAT). Bank transfer at order time for services < €5,000; staged payment possible above.",
        },
        {
          title: "Delivery",
          body: "Lead times are stated in each quote. Axion-IA commits to delivery times except in case of force majeure or delay attributable to the client (data access, team availability).",
        },
        {
          title: "Warranties and liability limits",
          body: "Axion-IA delivers per industry standards. Axion-IA's liability is limited to the amount billed for the relevant service. No outcome guarantee — estimated ROI are indicative.",
        },
        {
          title: "Cancellation and refund",
          body: "Client cancellation > 7 days before the session: 100% refund. Between 7 and 2 days: 50%. Less than 2 days: no refund, slot reschedulable once at no extra charge.",
        },
        {
          title: "Applicable law and jurisdiction",
          body: "These terms are governed by Estonian law. Any dispute falls within the jurisdiction of competent courts in Estonia.",
        },
      ],
      metaSeo: {
        title: "Terms & conditions · Axion-IA",
        description:
          "Axion-IA OÜ T&Cs: quotes, payment, delivery, warranties. Estonian law applies.",
      },
    },
  },
  {
    slug: "politique-confidentialite",
    pathFr: "/politique-confidentialite",
    pathEn: "/privacy-policy",
    fr: {
      title: "Politique de",
      titleEm: "confidentialité",
      intro:
        "Comment Axion-IA OÜ collecte, traite et protège vos données personnelles, conformément au RGPD (UE) 2016/679.",
      sections: [
        {
          title: "Responsable du traitement",
          body: "Axion-IA OÜ, société de droit estonien. Email DPO : dpo@axion-ia.com. Autorité de contrôle compétente : AKI (Andmekaitse Inspektsioon, autorité estonienne de protection des données).",
        },
        {
          title: "Données collectées",
          body: "Email, nom, raison sociale, contenu des messages, métadonnées techniques (user-agent, langue), pages visitées (Plausible self-hosted, anonymisé). Aucun cookie publicitaire, aucun tracker tiers.",
        },
        {
          title: "Finalités",
          body: "Réponse aux demandes commerciales, suivi des prestations, sécurité du site, statistiques d'audience anonymes. Pas de profilage, pas de revente de données.",
        },
        {
          title: "Base légale",
          body: "Exécution contractuelle (RGPD art. 6.1.b) pour les clients ; intérêt légitime (RGPD art. 6.1.f) pour la sécurité ; consentement (RGPD art. 6.1.a) pour la newsletter.",
        },
        {
          title: "Durée de conservation",
          body: "Données clients : 5 ans après fin de prestation (obligation comptable estonienne). Demandes commerciales : 3 ans. Logs techniques : 12 mois maximum.",
        },
        {
          title: "Vos droits",
          body: "Accès, rectification, effacement, opposition, portabilité, limitation. Contactez dpo@axion-ia.com. Vous avez également le droit d'introduire une réclamation auprès de l'AKI.",
        },
        {
          title: "Hébergement et transferts",
          body: "Toutes les données sont hébergées dans l'UE (Hetzner Frankfurt). Aucun transfert hors UE sauf consentement explicite (ex : appel à un modèle IA tiers américain pour une démonstration, signalé en amont).",
        },
        {
          title: "Sous-processeurs et destinataires des données",
          body: "Conformément à l'article 13.1.e du RGPD, voici la liste des sous-processeurs auxquels Axion-IA OÜ recourt : Hetzner Online GmbH (hébergement VPS + Storage Box pour les backups offsite chiffrés AES-256, Allemagne Frankfurt — DPA signé, ISO 27001) ; Cloudflare, Inc. (CDN + protection DDoS + Turnstile captcha, États-Unis avec transferts encadrés par SCC + EU-US Data Privacy Framework — DPA online + clauses contractuelles types) ; Telegram FZ-LLC (notifications administratives via Bot API à destination du gérant, Émirats Arabes Unis — pas de DPA standard, minimisation PII appliquée : identifiants partiels uniquement). Aucune donnée n'est vendue ni partagée à des fins publicitaires.",
        },
      ],
      metaSeo: {
        title: "Politique de confidentialité · Axion-IA",
        description:
          "RGPD, données personnelles, droits, AKI estonienne. Hébergement UE Hetzner Frankfurt + sous-processeurs déclarés.",
      },
    },
    en: {
      title: "Privacy",
      titleEm: "policy",
      intro:
        "How Axion-IA OÜ collects, processes and protects your personal data under GDPR (EU) 2016/679.",
      sections: [
        {
          title: "Data controller",
          body: "Axion-IA OÜ, Estonian company. DPO email: dpo@axion-ia.com. Competent supervisory authority: AKI (Andmekaitse Inspektsioon, Estonian data protection authority).",
        },
        {
          title: "Data collected",
          body: "Email, name, company name, message content, technical metadata (user-agent, language), pages visited (self-hosted Plausible, anonymized). No advertising cookies, no third-party trackers.",
        },
        {
          title: "Purposes",
          body: "Reply to commercial requests, service follow-up, site security, anonymous audience statistics. No profiling, no data resale.",
        },
        {
          title: "Legal basis",
          body: "Contractual performance (GDPR art. 6.1.b) for clients; legitimate interest (GDPR art. 6.1.f) for security; consent (GDPR art. 6.1.a) for the newsletter.",
        },
        {
          title: "Retention period",
          body: "Client data: 5 years after end of service (Estonian accounting obligation). Commercial requests: 3 years. Technical logs: 12 months maximum.",
        },
        {
          title: "Your rights",
          body: "Access, rectification, erasure, objection, portability, limitation. Contact dpo@axion-ia.com. You also have the right to lodge a complaint with AKI.",
        },
        {
          title: "Hosting and transfers",
          body: "All data is hosted in the EU (Hetzner Frankfurt). No transfers outside the EU except with explicit consent (e.g., calling a third-party US AI model for a demo, flagged in advance).",
        },
        {
          title: "Sub-processors and data recipients",
          body: "In accordance with GDPR article 13.1.e, the sub-processors used by Axion-IA OÜ are: Hetzner Online GmbH (VPS hosting + Storage Box for AES-256 encrypted offsite backups, Germany Frankfurt — DPA signed, ISO 27001); Cloudflare, Inc. (CDN + DDoS protection + Turnstile captcha, United States with transfers framed by SCC + EU-US Data Privacy Framework — online DPA + standard contractual clauses); Telegram FZ-LLC (admin notifications via Bot API to the manager, United Arab Emirates — no standard DPA, PII minimisation applied: partial identifiers only). No data is ever sold or shared for advertising purposes.",
        },
      ],
      metaSeo: {
        title: "Privacy policy · Axion-IA",
        description:
          "GDPR, personal data, rights, Estonian AKI. EU Hetzner Frankfurt hosting + declared sub-processors.",
      },
    },
  },
  {
    slug: "cookies",
    pathFr: "/cookies",
    pathEn: "/cookies",
    fr: {
      title: "Politique de cookies",
      intro:
        "Cookies utilisés sur axion-ia.com — minimum strict, aucun cookie publicitaire ni cookie de profilage.",
      sections: [
        {
          title: "Cookies strictement nécessaires",
          body: "Cookies de session pour l'authentification admin (durée de session) et préférence de langue (12 mois). Aucun consentement requis (RGPD art. 5.3 exception).",
        },
        {
          title: "Statistiques anonymes",
          body: "Plausible self-hosted, sans cookie persistant, sans empreinte numérique, conforme à l'avis CNIL/AKI 2022. Aucun consentement requis car aucune donnée personnelle.",
        },
        {
          title: "Cookies tiers",
          body: "Aucun cookie publicitaire, aucun cookie réseau social, aucun cookie de tracking cross-site.",
        },
        {
          title: "Gérer vos cookies",
          body: "Tous les navigateurs modernes permettent de bloquer les cookies. Le blocage des cookies strictement nécessaires peut empêcher l'usage de la console admin.",
        },
      ],
      metaSeo: {
        title: "Politique de cookies · Axion-IA",
        description:
          "Cookies Axion-IA : strictement nécessaires + Plausible anonyme. Aucun cookie publicitaire.",
      },
    },
    en: {
      title: "Cookie policy",
      intro:
        "Cookies used on axion-ia.com — strict minimum, no advertising cookies, no profiling cookies.",
      sections: [
        {
          title: "Strictly necessary cookies",
          body: "Session cookies for admin authentication (session duration) and language preference (12 months). No consent required (GDPR art. 5.3 exception).",
        },
        {
          title: "Anonymous statistics",
          body: "Self-hosted Plausible, without persistent cookies, without digital fingerprinting, compliant with the 2022 CNIL/AKI guidance. No consent required as no personal data.",
        },
        {
          title: "Third-party cookies",
          body: "No advertising cookies, no social network cookies, no cross-site tracking cookies.",
        },
        {
          title: "Manage your cookies",
          body: "All modern browsers allow blocking cookies. Blocking strictly necessary cookies may prevent use of the admin console.",
        },
      ],
      metaSeo: {
        title: "Cookie policy · Axion-IA",
        description:
          "Axion-IA cookies: strictly necessary + anonymous Plausible. No advertising cookies.",
      },
    },
  },
  {
    slug: "rgpd",
    pathFr: "/rgpd",
    pathEn: "/rgpd",
    fr: {
      title: "RGPD · droits utilisateurs",
      intro:
        "Récapitulatif de vos droits RGPD applicables aux données traitées par Axion-IA OÜ. Réponse sous 30 jours par notre DPO.",
      sections: [
        {
          title: "Droit d'accès (art. 15)",
          body: "Obtenir la confirmation que vos données sont traitées et en recevoir une copie.",
        },
        {
          title: "Droit de rectification (art. 16)",
          body: "Faire corriger des données inexactes ou incomplètes vous concernant.",
        },
        {
          title: "Droit à l'effacement (art. 17)",
          body: "Demander la suppression de vos données, sous réserve des obligations légales (comptabilité 5 ans).",
        },
        {
          title: "Droit d'opposition (art. 21)",
          body: "Vous opposer au traitement basé sur l'intérêt légitime ou aux fins de prospection.",
        },
        {
          title: "Droit à la portabilité (art. 20)",
          body: "Recevoir vos données dans un format structuré (JSON) ou demander leur transmission directe à un autre responsable.",
        },
        {
          title: "Droit à la limitation (art. 18)",
          body: "Faire suspendre le traitement de vos données dans des cas spécifiques (contestation d'exactitude, etc.).",
        },
        {
          title: "Comment exercer vos droits",
          body: "Email : dpo@axion-ia.com. Réponse sous 30 jours. En cas d'insatisfaction, vous pouvez saisir l'AKI (autorité estonienne de protection des données) — www.aki.ee.",
        },
      ],
      metaSeo: {
        title: "RGPD · droits utilisateurs · Axion-IA",
        description:
          "Vos 6 droits RGPD chez Axion-IA OÜ : accès, rectification, effacement, opposition, portabilité, limitation.",
      },
    },
    en: {
      title: "GDPR · user rights",
      intro:
        "Summary of your GDPR rights applicable to data processed by Axion-IA OÜ. DPO reply within 30 days.",
      sections: [
        {
          title: "Right of access (art. 15)",
          body: "Confirm that your data is being processed and receive a copy.",
        },
        {
          title: "Right to rectification (art. 16)",
          body: "Have inaccurate or incomplete data about you corrected.",
        },
        {
          title: "Right to erasure (art. 17)",
          body: "Request deletion of your data, subject to legal obligations (5-year accounting).",
        },
        {
          title: "Right to object (art. 21)",
          body: "Object to processing based on legitimate interest or for direct marketing purposes.",
        },
        {
          title: "Right to portability (art. 20)",
          body: "Receive your data in a structured format (JSON) or have it transmitted directly to another controller.",
        },
        {
          title: "Right to restriction (art. 18)",
          body: "Have processing suspended in specific cases (dispute over accuracy, etc.).",
        },
        {
          title: "How to exercise your rights",
          body: "Email: dpo@axion-ia.com. Reply within 30 days. If unsatisfied, you may file a complaint with AKI (Estonian DPA) — www.aki.ee.",
        },
      ],
      metaSeo: {
        title: "GDPR · user rights · Axion-IA",
        description:
          "Your 6 GDPR rights at Axion-IA OÜ: access, rectification, erasure, objection, portability, restriction.",
      },
    },
  },
  {
    slug: "politique-deplacement",
    pathFr: "/politique-deplacement",
    pathEn: "/travel-policy",
    fr: {
      title: "Politique de",
      titleEm: "déplacement",
      intro:
        "Frais et conditions de déplacement applicables aux interventions sur site (Module 1) et audits sur site (Module 2).",
      sections: [
        {
          title: "Périmètre standard",
          body: "France métropolitaine, Belgique, Luxembourg, Suisse romande : frais de déplacement inclus dans le tarif catalogue. Au-delà, devis personnalisé.",
        },
        {
          title: "Tarification au-delà du périmètre",
          body: "Train : 2e classe SNCF/Thalys au tarif réel. Avion : économique au tarif réel. Hébergement : 3 étoiles au tarif réel. Repas : forfait 50 €/jour.",
        },
        {
          title: "Validation préalable",
          body: "Tout déplacement hors périmètre standard fait l'objet d'un devis chiffré et accepté par le client avant départ.",
        },
        {
          title: "Annulation pour cas de force majeure",
          body: "Grève transports, conditions météo extrêmes, pandémie : réorganisation à distance ou nouveau créneau sans frais.",
        },
      ],
      metaSeo: {
        title: "Politique de déplacement · Axion-IA",
        description:
          "Frais et conditions de déplacement Axion-IA pour interventions sur site. Périmètre France/BE/LU/CH.",
      },
    },
    en: {
      title: "Travel",
      titleEm: "policy",
      intro:
        "Travel fees and conditions applicable to on-site sessions (Module 1) and on-site audits (Module 2).",
      sections: [
        {
          title: "Standard area",
          body: "France, Belgium, Luxembourg, French-speaking Switzerland: travel costs included in catalogue prices. Beyond, personalized quote.",
        },
        {
          title: "Pricing beyond standard area",
          body: "Train: 2nd-class SNCF/Thalys at actual cost. Flight: economy at actual cost. Accommodation: 3-star at actual cost. Meals: €50/day flat rate.",
        },
        {
          title: "Prior validation",
          body: "Any travel outside the standard area is subject to a costed quote accepted by the client before departure.",
        },
        {
          title: "Force majeure cancellation",
          body: "Transport strikes, extreme weather, pandemic: remote rescheduling or new slot at no extra charge.",
        },
      ],
      metaSeo: {
        title: "Travel policy · Axion-IA",
        description:
          "Axion-IA travel fees and conditions for on-site sessions. France/BE/LU/CH standard area.",
      },
    },
  },
];

export function getLegal(slug: LegalSlug): LegalContent {
  const found = LEGAL_PAGES.find((p) => p.slug === slug);
  if (!found) throw new Error(`Unknown legal slug: ${slug}`);
  return found;
}
