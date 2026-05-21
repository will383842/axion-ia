// Legal content — 6 pages (Sprint 10). Droit français.
// CLAUDE.md v6 §1 + §5 + §22. Source: docs 28 + 31.
// SIREN/SIRET + TVA FR : will fournit plus tard, communiqués sur demande
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
        "Informations légales relatives au site axion-ia.com et à la société Axion-IA, conformes au droit français.",
      sections: [
        {
          title: "Éditeur",
          body: "Axion-IA · société française ([forme juridique à préciser]). Siège social : [Ville — France]. RCS [Ville — France], SIREN [SIREN à compléter]. Numéro de TVA FR communiqué sur demande à contact@axion-ia.com.",
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
          body: "L'ensemble des contenus du site (textes, marques, logos, mises en page) est la propriété d'Axion-IA. Toute reproduction non autorisée est interdite.",
        },
        {
          title: "Loi applicable",
          body: "Le présent site est régi par le droit français. Tout litige relève de la compétence des tribunaux compétents en France.",
        },
      ],
      metaSeo: {
        title: "Mentions légales · Axion-IA",
        description:
          "Mentions légales d'Axion-IA (société de droit français). Hébergement Hetzner Frankfurt UE.",
      },
    },
    en: {
      title: "Legal",
      titleEm: "notice",
      intro: "Legal information about axion-ia.com and Axion-IA, in accordance with French law.",
      sections: [
        {
          title: "Publisher",
          body: "Axion-IA · French company ([forme juridique à préciser]). Registered office: [Ville — France]. RCS [Ville — France], SIREN [SIREN à compléter]. French VAT number available on request at contact@axion-ia.com.",
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
          body: "All content on the site (text, marks, logos, layouts) is the property of Axion-IA. Any unauthorized reproduction is prohibited.",
        },
        {
          title: "Applicable law",
          body: "This site is governed by French law. Any dispute falls within the jurisdiction of the competent courts in France.",
        },
      ],
      metaSeo: {
        title: "Legal notice · Axion-IA",
        description: "Legal notice for Axion-IA (French company). Hetzner Frankfurt EU hosting.",
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
          body: "Les présentes conditions régissent la vente et la prestation des services Axion-IA : interventions sur site, audits IA, implémentations IA. Toute commande implique l'acceptation pleine et entière des présentes conditions.",
        },
        {
          title: "Devis et commande",
          body: "Tout service fait l'objet d'un devis chiffré, valable 30 jours. La commande est ferme à réception du virement bancaire. Aucune mensualité ni abonnement.",
        },
        {
          title: "Tarifs et paiement",
          body: "Les prix sont indiqués en euros HT. La TVA française (20 %) est appliquée selon la résidence du client (B2B intracommunautaire avec n° TVA valide ou TVA FR). Paiement par virement bancaire à la commande pour les prestations < 5 000 € ; échelonnement possible au-delà.",
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
          body: "Les présentes conditions sont régies par le droit français. Tout litige relève des tribunaux compétents en France.",
        },
      ],
      metaSeo: {
        title: "Conditions générales · Axion-IA",
        description:
          "CGV et CGU Axion-IA : devis, paiement, livraison, garanties. Droit français applicable.",
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
          body: "These terms govern the sale and provision of Axion-IA services: on-site sessions, AI audits, AI implementations. Any order implies full acceptance of these terms.",
        },
        {
          title: "Quote and order",
          body: "Each service is subject to a costed quote, valid 30 days. The order becomes firm upon receipt of bank transfer. No subscriptions, no commitments.",
        },
        {
          title: "Pricing and payment",
          body: "Prices are in euros (excl. VAT). French VAT (20%) is applied according to client residence (intra-EU B2B with valid VAT number or FR VAT). Bank transfer at order time for services < €5,000; staged payment possible above.",
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
          body: "These terms are governed by French law. Any dispute falls within the jurisdiction of competent courts in France.",
        },
      ],
      metaSeo: {
        title: "Terms & conditions · Axion-IA",
        description: "Axion-IA T&Cs: quotes, payment, delivery, warranties. French law applies.",
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
        "Comment Axion-IA collecte, traite et protège vos données personnelles, conformément au RGPD (UE) 2016/679.",
      sections: [
        {
          title: "Responsable du traitement",
          body: "Axion-IA, société française. Email DPO : contact@axion-ia.com. Autorité de contrôle compétente : CNIL (Commission Nationale de l'Informatique et des Libertés).",
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
          body: "Données clients : 5 ans après fin de prestation (obligation comptable française). Demandes commerciales : 3 ans. Logs techniques : 12 mois maximum.",
        },
        {
          title: "Vos droits",
          body: "Accès, rectification, effacement, opposition, portabilité, limitation. Contactez contact@axion-ia.com. Vous avez également le droit d'introduire une réclamation auprès de la CNIL.",
        },
        {
          title: "Hébergement et transferts",
          body: "Hébergement principal dans l'UE (Hetzner Frankfurt, Allemagne) et services edge Cloudflare (présence UE prioritaire). Les seuls transferts hors UE concernent les sous-processeurs IA américains (OpenAI, Anthropic, Perplexity) lorsqu'un contenu éditorial est généré ou un fact-check effectué — encadrés par les Clauses Contractuelles Types (SCC) de la Commission européenne et listés exhaustivement sur /sous-processeurs avec leur cadre de transfert international (SCC + DPF le cas échéant). Aucune donnée personnelle de visiteur n'est transmise à ces modèles (helper `pii-safe` + hard gate code).",
        },
        {
          title: "Sous-processeurs et destinataires des données",
          body: "Conformément à l'article 13.1.e du RGPD, Axion-IA tient une liste exhaustive et publique de ses sous-processeurs sur la page /sous-processeurs (catégories : infrastructure principale, paiements & contrats, communications, analytics & observabilité, génération de contenu IA). Cette page indique pour chaque sous-processeur sa finalité, les catégories de données traitées, la localisation des serveurs, la base légale, le statut du DPA et le cadre de transfert international. Toute évolution est notifiée par email aux clients actifs au moins 30 jours avant prise d'effet. Aucune donnée n'est vendue ni partagée à des fins publicitaires.",
        },
        {
          title: "IA générative et transparence (AI Act EU)",
          body: "Certains contenus éditoriaux du site (Articles signés Manon, fiches de villes, FAQ) sont rédigés avec l'assistance de modèles d'IA générative (OpenAI GPT-4o, Anthropic Claude, Perplexity Sonar pour le fact-checking) puis supervisés par l'équipe Axion-IA avant publication. Conformément à l'article 50 du Règlement européen sur l'IA (AI Act 2024/1689), la nature IA-assistée de ces contenus est divulguée publiquement — voir la fiche transparence sur /equipe/manon. Les prompts envoyés à ces modèles ne contiennent aucune donnée personnelle de visiteur (helper `pii-safe` + hard gate code sur la base de connaissances). Vous pouvez vous opposer à tout traitement de vos données par un modèle IA (RGPD art. 21) en écrivant à contact@axion-ia.com.",
        },
      ],
      metaSeo: {
        title: "Politique de confidentialité · Axion-IA",
        description:
          "RGPD + AI Act, données personnelles, droits, CNIL. Hébergement UE Hetzner Frankfurt + sous-processeurs publiés.",
      },
    },
    en: {
      title: "Privacy",
      titleEm: "policy",
      intro:
        "How Axion-IA collects, processes and protects your personal data under GDPR (EU) 2016/679.",
      sections: [
        {
          title: "Data controller",
          body: "Axion-IA, French company. DPO email: contact@axion-ia.com. Competent supervisory authority: CNIL (Commission Nationale de l'Informatique et des Libertés).",
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
          body: "Client data: 5 years after end of service (French accounting obligation). Commercial requests: 3 years. Technical logs: 12 months maximum.",
        },
        {
          title: "Your rights",
          body: "Access, rectification, erasure, objection, portability, limitation. Contact contact@axion-ia.com. You also have the right to lodge a complaint with the CNIL.",
        },
        {
          title: "Hosting and transfers",
          body: "Primary hosting in the EU (Hetzner Frankfurt, Germany) and Cloudflare edge services (EU presence prioritized). The only transfers outside the EU concern US AI sub-processors (OpenAI, Anthropic, Perplexity) when editorial content is generated or fact-checked — covered by the European Commission Standard Contractual Clauses (SCC) and listed exhaustively on /subprocessors with their international transfer framework (SCC + DPF where applicable). No visitor personal data is sent to these models (`pii-safe` helper + code-level hard gate).",
        },
        {
          title: "Sub-processors and data recipients",
          body: "In accordance with GDPR article 13.1.e, Axion-IA maintains an exhaustive public list of its sub-processors at /subprocessors (categories: core infrastructure, payments & contracts, communications, analytics & observability, AI content generation). That page specifies for each sub-processor its purpose, the categories of data processed, server location, legal basis, DPA status and international transfer framework. Any change is notified by email to active clients at least 30 days before taking effect. No data is ever sold or shared for advertising purposes.",
        },
        {
          title: "Generative AI and transparency (EU AI Act)",
          body: "Certain editorial content on the site (articles signed by Manon, city pages, FAQs) is drafted with the assistance of generative AI models (OpenAI GPT-4o, Anthropic Claude, Perplexity Sonar for fact-checking) and then supervised by the Axion-IA team before publication. In accordance with article 50 of the EU AI Act (2024/1689), the AI-assisted nature of this content is publicly disclosed — see the transparency notice at /equipe/manon. Prompts sent to these models contain no visitor personal data (`pii-safe` helper + code-level hard gate on the knowledge base). You may object to any processing of your data by an AI model (GDPR art. 21) by writing to contact@axion-ia.com.",
        },
      ],
      metaSeo: {
        title: "Privacy policy · Axion-IA",
        description:
          "GDPR + AI Act, personal data, rights, CNIL. EU Hetzner Frankfurt hosting + published sub-processors.",
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
          body: "Plausible self-hosted (Hetzner Frankfurt, UE), sans cookie persistant, sans empreinte numérique, conforme à l'avis CNIL 2022. Aucun consentement requis car aucune donnée personnelle.",
        },
        {
          title: "Analytics qualitatifs avec consentement (Microsoft Clarity)",
          body: "Microsoft Clarity est proposé en complément de Plausible pour les heatmaps de clic/scroll et le session replay anonymisé (masquage automatique des champs de formulaire). Il dépose 2 cookies : `_clck` (1 an, identifiant visiteur) et `_clsk` (1 jour, identifiant session). Le transfert UE → USA est encadré par les Clauses Contractuelles Types (SCC). Aucun cookie déposé sans votre consentement explicite via le bandeau cookies (CNIL art. 82 + RGPD art. 7) ; vous pouvez refuser ou retirer votre consentement à tout moment depuis /preferences-cookies. Durée de conservation du choix : 13 mois maximum (recommandation CNIL).",
        },
        {
          title: "Cookies tiers",
          body: "Aucun cookie publicitaire, aucun cookie réseau social, aucun cookie de tracking cross-site.",
        },
        {
          title: "Gérer vos cookies",
          body: "Le bandeau cookies vous permet d'accepter ou refuser les analytics Microsoft Clarity. Votre choix est conservé 13 mois maximum (recommandation CNIL). Tous les navigateurs modernes permettent en plus de bloquer les cookies globalement — le blocage des cookies strictement nécessaires peut empêcher l'usage de la console admin.",
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
          body: "Self-hosted Plausible (Hetzner Frankfurt, EU), without persistent cookies, without digital fingerprinting, compliant with the 2022 CNIL guidance. No consent required as no personal data.",
        },
        {
          title: "Consent-gated qualitative analytics (Microsoft Clarity)",
          body: "Microsoft Clarity is offered alongside Plausible for click/scroll heatmaps and anonymised session replay (automatic form field masking). It drops 2 cookies: `_clck` (1 year, visitor identifier) and `_clsk` (1 day, session identifier). The EU → US transfer is covered by Standard Contractual Clauses (SCC). No cookie is dropped without your explicit consent via the cookie banner (CNIL art. 82 + GDPR art. 7); you may decline or withdraw your consent at any time from /cookie-preferences. Consent retention: 13 months maximum (CNIL recommendation).",
        },
        {
          title: "Third-party cookies",
          body: "No advertising cookies, no social network cookies, no cross-site tracking cookies.",
        },
        {
          title: "Manage your cookies",
          body: "The cookie banner lets you accept or decline Microsoft Clarity analytics. Your choice is kept for 13 months maximum (CNIL recommendation). All modern browsers additionally allow blocking cookies globally — blocking strictly necessary cookies may prevent use of the admin console.",
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
        "Récapitulatif de vos droits RGPD applicables aux données traitées par Axion-IA. Réponse sous 30 jours par notre DPO.",
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
          body: "Email : contact@axion-ia.com. Réponse sous 30 jours. En cas d'insatisfaction, vous pouvez saisir la CNIL (Commission Nationale de l'Informatique et des Libertés) — www.cnil.fr.",
        },
      ],
      metaSeo: {
        title: "RGPD · droits utilisateurs · Axion-IA",
        description:
          "Vos 6 droits RGPD chez Axion-IA : accès, rectification, effacement, opposition, portabilité, limitation.",
      },
    },
    en: {
      title: "GDPR · user rights",
      intro:
        "Summary of your GDPR rights applicable to data processed by Axion-IA. DPO reply within 30 days.",
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
          body: "Email: contact@axion-ia.com. Reply within 30 days. If unsatisfied, you may file a complaint with the CNIL (French DPA) — www.cnil.fr.",
        },
      ],
      metaSeo: {
        title: "GDPR · user rights · Axion-IA",
        description:
          "Your 6 GDPR rights at Axion-IA: access, rectification, erasure, objection, portability, restriction.",
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
