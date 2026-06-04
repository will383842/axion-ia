// MANUAL-REWRITE 2026-05-28 — Audit Will batch 100 (qs moyen → premium).
// Alès (30, Gard) — ancien bassin minier reconverti, porte des Cévennes, industrie & PME.

import type { VilleCopy } from "./types";

export const ALES_COPY: VilleCopy = {
  pitchFr:
    "Axion-IA, cabinet d'architectes seniors en intelligence artificielle, accompagne les TPE et PME d'Alès, ancien bassin minier devenu pôle industriel et porte des Cévennes. Industrie, sous-traitance, BTP, commerce et tourisme vert : nous transformons l'IA en gains concrets, sans jargon ni dépendance technique.",
  pitchEn:
    "Axion-IA, cabinet d'architectes seniors en intelligence artificielle, accompagne les TPE et PME d'Alès, ancien bassin minier devenu pôle industriel et porte des Cévennes. Industrie, sous-traitance, BTP, commerce et tourisme vert : nous transformons l'IA en gains concrets, sans jargon ni dépendance technique.",
  directAnswerFr:
    "Axion-IA est un cabinet d'architectes seniors en intelligence artificielle qui intervient à Alès auprès des TPE et PME en priorité, des PME ensuite. Nous ciblons l'industrie et la sous-traitance issues de la reconversion du bassin minier, le BTP, le commerce et le tourisme cévenol. Audit sur place sur mesure avec ROI chiffré, puis interventions sur site, vos équipes restant autonomes.",
  directAnswerEn:
    "Axion-IA est un cabinet d'architectes seniors en intelligence artificielle qui intervient à Alès auprès des TPE et PME en priorité, des PME ensuite. Nous ciblons l'industrie et la sous-traitance issues de la reconversion du bassin minier, le BTP, le commerce et le tourisme cévenol. Audit sur place sur mesure avec ROI chiffré, puis interventions sur site, vos équipes restant autonomes.",
  seoHook: "industrie & Cévennes",
  ecosystemFr:
    "Alès, ancien coeur du bassin houiller cévenol, s'est reconvertie en pôle industriel et technologique appuyé par l'École des Mines d'Alès (IMT Mines Alès) et le parc scientifique de l'Arche. Le tissu mêle PME industrielles et de sous-traitance, BTP, mécanique, plasturgie, commerce et tourisme vert au pied des Cévennes, avec un fort besoin de modernisation des process.",
  ecosystemEn:
    "Alès, ancien coeur du bassin houiller cévenol, s'est reconvertie en pôle industriel et technologique appuyé par l'École des Mines d'Alès (IMT Mines Alès) et le parc scientifique de l'Arche. Le tissu mêle PME industrielles et de sous-traitance, BTP, mécanique, plasturgie, commerce et tourisme vert au pied des Cévennes, avec un fort besoin de modernisation des process.",
  distancesFr:
    "Alès est reliée à Nîmes (gare TGV) en environ 45 km par la N106. L'aéroport de Nîmes-Garons et l'A9 sont accessibles via Nîmes ; Montpellier est à environ 1h.",
  distancesEn:
    "Alès est reliée à Nîmes (gare TGV) en environ 45 km par la N106. L'aéroport de Nîmes-Garons et l'A9 sont accessibles via Nîmes ; Montpellier est à environ 1h.",
  topSectorsNaf: [
    "Industrie et sous-traitance mécanique",
    "Plasturgie et matériaux",
    "BTP et travaux spécialisés",
    "Commerce de détail et de gros",
    "Tourisme vert et activités de plein air (Cévennes)",
  ],
  servicesContext: {
    audit: {
      fr: "Audit IA à Alès pour PME industrielles, sous-traitants et acteurs du BTP : nous cartographions vos process (maintenance, contrôle qualité, planification, devis) et chiffrons un ROI réaliste. Audit sur place sur mesure dès {{price:audit-flash|flat}}.",
      en: "Audit IA à Alès pour PME industrielles, sous-traitants et acteurs du BTP : nous cartographions vos process (maintenance, contrôle qualité, planification, devis) et chiffrons un ROI réaliste. Audit sur place sur mesure dès {{price:audit-flash|flat}}.",
    },
    interventions: {
      fr: "Interventions IA sur site à Alès : formats adaptés à l'atelier industriel, au chantier ou au commerce. Vos collaborateurs prennent ensuite la main sur les outils en autonomie.",
      en: "Interventions IA sur site à Alès : formats adaptés à l'atelier industriel, au chantier ou au commerce. Vos collaborateurs prennent ensuite la main sur les outils en autonomie.",
    },
    implementation: {
      fr: "Implémentation IA à Alès : maintenance prédictive, contrôle qualité visuel, optimisation de production et de planning, chiffrage automatisé de devis et agents conversationnels B2B pour les PME industrielles.",
      en: "Implémentation IA à Alès : maintenance prédictive, contrôle qualité visuel, optimisation de production et de planning, chiffrage automatisé de devis et agents conversationnels B2B pour les PME industrielles.",
    },
    unAUn: {
      fr: "Coaching 1-to-1 à Alès pour dirigeants de TPE et PME industrielles, BTP ou commerce : sessions dans vos locaux ou en visio pour piloter votre feuille de route IA sans dépendre d'un prestataire.",
      en: "Coaching 1-to-1 à Alès pour dirigeants de TPE et PME industrielles, BTP ou commerce : sessions dans vos locaux ou en visio pour piloter votre feuille de route IA sans dépendre d'un prestataire.",
    },
    sitesWeb: {
      fr: "Sites web augmentés à Alès : portails B2B, configurateurs et outils IA sur mesure pour l'industrie, la sous-traitance et le tourisme vert cévenol.",
      en: "Sites web augmentés à Alès : portails B2B, configurateurs et outils IA sur mesure pour l'industrie, la sous-traitance et le tourisme vert cévenol.",
    },
  },
  services: {
    sitesWeb: {
      fr: {
        hero: "Axion-IA conçoit des sites web et plateformes SaaS augmentés par l'IA pour les entreprises d'Alès, ancien bassin houiller cévenol devenu pôle de catalyse industrielle (Axens à Salindres, Plateforme chimique), de sous-traitance mécanique et de sports mécaniques (Pôle Mécanique Alès-Cévennes). Portails B2B, configurateurs de devis, espaces clients et moteurs de recherche documentaire pour fabricants, sous-traitants et acteurs du tourisme vert cévenol — code sur mesure, chatbot RAG sur vos données, hébergement en Union européenne conforme RGPD, sans verrou éditeur. Nous couvrons l'UX/UI, le mobile, l'e-commerce multi-CMS et l'intégration IA de bout en bout.",
        whyHere: [
          "Le tissu alésien est dominé par l'industrie de procédé et la sous-traitance : Axens à Salindres (seul site français du groupe, catalyseurs et adsorbants), la Plateforme chimique de Salindres et des PME mécaniques comme SNR Cévennes à Saint-Privat-des-Vieux ont besoin de portails B2B, catalogues techniques filtrables et configurateurs reliés à l'ERP.",
          "IMT Mines Alès et son incubateur (créé en 1984, ~230 startups, centres CERIS / SyCoIA sur l'IA et l'industrie du futur) alimentent un vivier de jeunes pousses : nous construisons leurs SaaS IA-native (search sémantique, agents conversationnels) en code maîtrisé, sans dette technique.",
          "Le Pôle Mécanique Alès-Cévennes (95 ha, circuit réversible unique en Europe, ~60 PME des sports mécaniques) et les ZI PIST, Synerpôle et Lacoste-Lavabreille concentrent des entreprises industrielles à équiper de sites vitrines techniques, espaces revendeurs et réservation d'essais en ligne.",
          "Le tourisme vert cévenol — Train à Vapeur des Cévennes, Bambouseraie de Prafrance, Grotte de Trabuc, hébergeurs et producteurs locaux — réclame des sites e-commerce et de billetterie multilingues, rapides sur mobile et optimisés pour la saisonnalité.",
        ],
        methodology: [
          {
            step: "Cadrage à Alès",
            detail:
              "Kick-off dans vos locaux à Alès ou sur votre site (ZI PIST, Salindres, Pôle Mécanique de Saint-Martin-de-Valgalgues) : nous cartographions vos parcours utilisateurs, vos référentiels produits et vos intégrations existantes (ERP, CRM, catalogue catalyseurs ou pièces mécaniques).",
          },
          {
            step: "Architecture & maquettes UX/UI",
            detail:
              "Conception de l'arborescence, des wireframes et du design system. Pour un sous-traitant mécanique ou un acteur de la Plateforme chimique : fiches techniques structurées, configurateur de devis, espace client. Pour le tourisme cévenol : parcours de réservation et billetterie mobile-first.",
          },
          {
            step: "Développement & couche IA",
            detail:
              "Front et back en code sur mesure, e-commerce sur le CMS adapté à votre cas (headless, WooCommerce, Shopify, PrestaShop), puis intégration IA : chatbot RAG entraîné sur vos documents, recherche sémantique du catalogue, génération de descriptifs produits et tri intelligent des demandes entrantes.",
          },
          {
            step: "Recette & performance",
            detail:
              "Tests sur vos vraies données et vos volumes réels, optimisation Web Vitals (chargement mobile, Core Web Vitals), accessibilité et SEO local Alès-Cévennes. Hébergement provisionné en Union européenne, conforme RGPD, avec sauvegardes.",
          },
          {
            step: "Mise en ligne & transfert",
            detail:
              "Déploiement, formation de vos équipes à l'administration du site et des outils IA, remise de la documentation runbook. Vous gardez le code, les accès et la maîtrise complète — aucune dépendance contractuelle à Axion-IA.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Site vitrine ou e-commerce augmenté",
            detail:
              "Pour les indépendants, artisans, producteurs cévenols et commerces du centre-ville d'Alès : site vitrine ou boutique en ligne avec assistant IA de réponse aux clients et descriptifs produits générés. Devis à partir de 24-48 h selon la complexité.",
          },
          {
            sizeLabel: "PME",
            price: "Portail B2B & configurateur IA",
            detail:
              "Pour les PME industrielles et sous-traitants des ZI PIST, Synerpôle et du Pôle Mécanique Alès-Cévennes : portail revendeurs, catalogue technique filtrable, configurateur de devis relié à l'ERP et recherche sémantique documentaire.",
          },
          {
            sizeLabel: "ETI",
            price: "Plateforme SaaS IA-native sur mesure",
            detail:
              "Pour les ETI de la catalyse et de la chimie (écosystème Axens / Plateforme chimique de Salindres) et les éditeurs issus de l'incubateur IMT Mines Alès : SaaS multi-tenant, agents conversationnels, RAG sur bases documentaires réglementaires et industrielles.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Programme multi-sites & gouvernance",
            detail:
              "Pour les groupes ayant un site majeur dans le bassin alésien : refonte multi-sites, design system commun, intégrations data, gouvernance IA centralisée et couche de validation humaine pour les contenus sensibles (sécurité de procédé, conformité).",
          },
        ],
        faq: [
          {
            q: "Pouvez-vous construire un portail B2B ou un configurateur pour un sous-traitant industriel d'Alès ?",
            a: "Oui. C'est un cas central pour le bassin alésien : pour les PME mécaniques (type SNR Cévennes à Saint-Privat-des-Vieux), les acteurs de la Plateforme chimique de Salindres ou les entreprises des ZI PIST et Synerpôle, nous développons catalogues techniques filtrables, espaces revendeurs et configurateurs de devis reliés à votre ERP, avec recherche sémantique IA sur vos documentations.",
          },
          {
            q: "Accompagnez-vous les startups issues de l'incubateur IMT Mines Alès ?",
            a: "Oui. L'incubateur de l'IMT Mines Alès (créé en 1984, environ 230 startups) et les travaux des centres CERIS / SyCoIA sur l'IA produisent un vivier de jeunes pousses. Nous construisons leur SaaS IA-native — search sémantique, chatbot RAG, agents conversationnels — en code maîtrisé et hébergé en UE, pour éviter la dette technique et le verrou éditeur dès le MVP.",
          },
          {
            q: "Faites-vous de l'e-commerce et de la billetterie pour le tourisme cévenol ?",
            a: "Oui. Pour les acteurs du tourisme vert autour d'Alès — Train à Vapeur des Cévennes, Bambouseraie de Prafrance, hébergeurs, producteurs locaux — nous concevons des sites e-commerce et de billetterie mobile-first, multilingues, rapides et calibrés pour la forte saisonnalité, avec un assistant IA pour les questions des visiteurs.",
          },
          {
            q: "Sur quels CMS et technologies travaillez-vous ?",
            a: "Nous sommes multi-CMS : headless (Next.js), WooCommerce, Shopify ou PrestaShop selon votre besoin réel, plus du code sur mesure quand c'est justifié. Nous couvrons l'UX/UI, le mobile et l'e-commerce, et nous ajoutons la couche IA (RAG, recherche sémantique, génération de contenu). Le choix technique est justifié, jamais imposé.",
          },
          {
            q: "Où sont hébergées les données et qui garde le contrôle du site ?",
            a: "Hébergement provisionné en Union européenne, conforme RGPD, avec sauvegardes. À la livraison, vous récupérez le code source, les accès et la documentation : vos équipes administrent le site et les outils IA en autonomie, et la maintenance peut être reprise en interne ou confiée à tout prestataire. Aucun verrou Axion-IA.",
          },
        ],
        guarantees:
          "Devis remis à partir de 24-48 h selon la complexité, sur scope écrit et tarifs clairs. Hébergement en Union européenne conforme RGPD par défaut, sauvegardes incluses. À la livraison, le code source, les accès et la documentation runbook vous appartiennent : vos équipes alésiennes administrent le site et les outils IA en autonomie, sans dépendance contractuelle ni verrou éditeur. Les performances (Web Vitals, mobile) et l'accessibilité sont contractualisées à la recette. Pour les contenus IA sensibles — fiches techniques de procédé, documentation réglementaire — une couche de validation humaine est intégrée.",
      },
      en: {
        hero: "Axion-IA designs AI-augmented websites and SaaS platforms for businesses in Alès, a former Cévennes coal-mining basin reconverted into a hub for industrial catalysis (Axens at Salindres, the Salindres chemical platform), mechanical subcontracting and motorsport (Pôle Mécanique Alès-Cévennes). B2B portals, quote configurators, customer areas and document search engines for manufacturers, subcontractors and Cévennes green-tourism operators — custom code, RAG chatbot on your data, European Union hosting compliant with GDPR, no vendor lock-in. We cover UX/UI, mobile, multi-CMS e-commerce and end-to-end AI integration.",
        whyHere: [
          "The Alès fabric is dominated by process industry and subcontracting: Axens at Salindres (the group's only French site, catalysts and adsorbents), the Salindres chemical platform and mechanical SMEs such as SNR Cévennes in Saint-Privat-des-Vieux need B2B portals, filterable technical catalogues and ERP-connected configurators.",
          "IMT Mines Alès and its incubator (created in 1984, ~230 startups, CERIS / SyCoIA centres focused on AI and the industry of the future) feed a startup pipeline: we build their AI-native SaaS (semantic search, conversational agents) in controlled code, with no technical debt.",
          "The Pôle Mécanique Alès-Cévennes (95 ha, a reversible speed track unique in Europe, ~60 motorsport SMEs) and the PIST, Synerpôle and Lacoste-Lavabreille industrial zones concentrate firms needing technical showcase sites, reseller areas and online test booking.",
          "Cévennes green tourism — the Train à Vapeur des Cévennes, the Bambouseraie de Prafrance, the Grotte de Trabuc, lodgings and local producers — calls for multilingual e-commerce and ticketing sites that are fast on mobile and optimised for seasonality.",
        ],
        methodology: [
          {
            step: "Kick-off in Alès",
            detail:
              "Kick-off at your offices in Alès or on your site (PIST industrial zone, Salindres, Pôle Mécanique in Saint-Martin-de-Valgalgues): we map your user journeys, product references and existing integrations (ERP, CRM, catalyst or mechanical-parts catalogue).",
          },
          {
            step: "Architecture & UX/UI mockups",
            detail:
              "Information architecture, wireframes and design system. For a mechanical subcontractor or a Salindres chemical-platform player: structured technical sheets, quote configurator, customer area. For Cévennes tourism: mobile-first booking and ticketing journeys.",
          },
          {
            step: "Development & AI layer",
            detail:
              "Front and back in custom code, e-commerce on the CMS suited to your case (headless, WooCommerce, Shopify, PrestaShop), then AI integration: RAG chatbot trained on your documents, semantic catalogue search, product-description generation and intelligent sorting of inbound requests.",
          },
          {
            step: "Acceptance & performance",
            detail:
              "Testing on your real data and real volumes, Web Vitals optimisation (mobile loading, Core Web Vitals), accessibility and Alès-Cévennes local SEO. Hosting provisioned in the European Union, GDPR-compliant, with backups.",
          },
          {
            step: "Go-live & handover",
            detail:
              "Deployment, training of your teams to administer the site and AI tools, runbook documentation handed over. You keep the code, the access and full control — no contractual dependency on Axion-IA.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Showcase site or augmented e-commerce",
            detail:
              "For freelancers, craftspeople, Cévennes producers and Alès town-centre shops: showcase site or online store with an AI customer-response assistant and generated product descriptions. Quote from 24-48 h depending on complexity.",
          },
          {
            sizeLabel: "PME",
            price: "B2B portal & AI configurator",
            detail:
              "For industrial SMEs and subcontractors in the PIST and Synerpôle zones and the Pôle Mécanique Alès-Cévennes: reseller portal, filterable technical catalogue, ERP-connected quote configurator and semantic document search.",
          },
          {
            sizeLabel: "ETI",
            price: "Custom AI-native SaaS platform",
            detail:
              "For mid-caps in catalysis and chemistry (Axens / Salindres chemical-platform ecosystem) and publishers from the IMT Mines Alès incubator: multi-tenant SaaS, conversational agents, RAG over regulatory and industrial document bases.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Multi-site programme & governance",
            detail:
              "For groups with a major site in the Alès basin: multi-site rebuild, shared design system, data integrations, centralised AI governance and a human-validation layer for sensitive content (process safety, compliance).",
          },
        ],
        faq: [
          {
            q: "Can you build a B2B portal or configurator for an industrial subcontractor in Alès?",
            a: "Yes. It is a core case for the Alès basin: for mechanical SMEs (such as SNR Cévennes in Saint-Privat-des-Vieux), Salindres chemical-platform players or firms in the PIST and Synerpôle zones, we develop filterable technical catalogues, reseller areas and ERP-connected quote configurators, with AI semantic search across your documentation.",
          },
          {
            q: "Do you support startups from the IMT Mines Alès incubator?",
            a: "Yes. The IMT Mines Alès incubator (created in 1984, around 230 startups) and the work of the CERIS / SyCoIA centres on AI produce a startup pipeline. We build their AI-native SaaS — semantic search, RAG chatbot, conversational agents — in controlled, EU-hosted code, to avoid technical debt and vendor lock-in from the MVP onward.",
          },
          {
            q: "Do you do e-commerce and ticketing for Cévennes tourism?",
            a: "Yes. For green-tourism operators around Alès — the Train à Vapeur des Cévennes, the Bambouseraie de Prafrance, lodgings, local producers — we build mobile-first, multilingual e-commerce and ticketing sites that are fast and calibrated for strong seasonality, with an AI assistant for visitor questions.",
          },
          {
            q: "Which CMS and technologies do you work with?",
            a: "We are multi-CMS: headless (Next.js), WooCommerce, Shopify or PrestaShop depending on your real need, plus custom code where justified. We cover UX/UI, mobile and e-commerce, and we add the AI layer (RAG, semantic search, content generation). The technical choice is justified, never imposed.",
          },
          {
            q: "Where is data hosted and who keeps control of the site?",
            a: "Hosting provisioned in the European Union, GDPR-compliant, with backups. At delivery you receive the source code, the access and the documentation: your teams administer the site and AI tools autonomously, and maintenance can be brought in-house or given to any provider. No Axion-IA lock-in.",
          },
        ],
        guarantees:
          "Quote delivered from 24-48 h depending on complexity, on a written scope with clear pricing. European Union hosting, GDPR-compliant by default, backups included. At delivery, the source code, access and runbook documentation are yours: your Alès teams administer the site and AI tools autonomously, with no contractual dependency or vendor lock-in. Performance (Web Vitals, mobile) and accessibility are contractualised at acceptance. For sensitive AI content — process technical sheets, regulatory documentation — a human-validation layer is built in.",
      },
    },
  },

  faqGeolocalisee: [
    {
      q: "Axion-IA accompagne-t-il les PME industrielles d'Alès ?",
      a: "Oui, l'industrie et la sous-traitance issues de la reconversion du bassin minier sont au coeur de notre cible alésienne, ainsi que le BTP et le commerce. Nous travaillons en priorité avec les TPE et PME, l'accompagnement des ETI restant marginal.",
    },
    {
      q: "Quels gains IA pour un sous-traitant ou industriel alésien ?",
      a: "Maintenance prédictive des machines, contrôle qualité visuel, optimisation de planning et chiffrage automatisé des devis. Chaque piste est chiffrée en ROI dans l'Audit sur place avant toute implémentation.",
    },
    {
      q: "Quel est le tarif d'une intervention IA à Alès ?",
      a: "L'Audit sur place sur mesure démarre à {{price:audit-flash|flat}} et la Formation 4 h à {{price:intervention-4h|flat}}. Tous nos tarifs sont publics et sans devis opaque ; chaque chantier d'implémentation est ensuite chiffré selon le ROI.",
    },
    {
      q: "Intervenez-vous dans les Cévennes autour d'Alès ?",
      a: "Oui, nous couvrons le bassin alésien et les Cévennes : Saint-Christol-lès-Alès, Saint-Privat-des-Vieux, La Grand-Combe et les communes du Gard nord. Frais de déplacement facturés à part, tarifs publics.",
    },
    {
      q: "Vos solutions IA sont-elles conformes au RGPD ?",
      a: "Oui, chaque solution déployée à Alès respecte le RGPD et l'AI Act. Vos données de production et données clients restent maîtrisées, sans verrou technologique ni dépendance à un prestataire unique.",
    },
  ],
};
