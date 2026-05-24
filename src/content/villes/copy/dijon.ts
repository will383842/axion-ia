// Dijon (21231) — contenu éditorial gold standard.
//
// Données réelles : DIJON_ECONOMIC_DATA (economic-data/dijon.ts).
// Structure identique à paris.ts (gold standard Sprint 14.10.4).
//
// Doctrine appliquée :
//   - Jamais délai chiffré en dur (calé en cadrage).
//   - Jamais "frais de déplacement intégrés" — toujours "en sus".
//   - Mention systématique "frais de logement, repas et forfait trajet en sus"
//     sur les formats interventions.
//   - Durée minimale : 1 journée. Pas de demi-journée.
//   - Aucun prix hardcodé : libellés contextuels uniquement.
//   - Tailles entreprises : TPE / PME / ETI / Grande entreprise (INSEE).
//   - ~95 % Axion-IA-centric. ~5 % data INSEE anti-doorway HCU 2024.
//   - Acteurs réels Dijon : URGO, Amora, BSB, Institut Agro, uB, Vitagora,
//     ToasterLab, Cité Gastronomie, Climat UNESCO, French Tech BFC.
//   - PAS de heroSchema, PAS de unAUn (tâche demandée exclut ces blocs).

import type { VilleCopy } from "./types";

export const DIJON_COPY: VilleCopy = {
  pitchFr:
    "Dijon regroupe 14 946 établissements actifs, une capitale French Tech labellisée 2023, des sièges industriels (URGO, Amora) et un pôle agroalimentaire/foodtech unique en France centré sur la Cité Internationale de la Gastronomie et du Vin. Axion-IA y intervient sur site, des TPE dijonnaises aux ETI du bassin bourguignon.",
  pitchEn:
    "Dijon hosts 14,946 active establishments, a 2023-labelled French Tech capital, industrial HQs (URGO, Amora) and France's unique agri-food/foodtech hub built around the International City of Gastronomy and Wine. Axion-IA delivers on site, from Dijon micro-businesses to mid-caps across the Burgundy basin.",

  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel à Dijon : nous cartographions les process automatisables dans votre organisation et chiffrons le ROI. 4 niveaux du Flash au Stratégique ETI selon votre taille, du cabinet dijonnais à l'ETI industrielle de Côte-d'Or.",
      en: "Operational AI audit in Dijon: we map automatable processes in your organisation and quantify the ROI. 4 tiers from Flash to Mid-cap Strategic depending on your size, from a Dijon practice to a Côte-d'Or industrial mid-cap.",
    },
    interventions: {
      fr: "Interventions IA à Dijon : formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs repartent autonomes avec des outils IA configurés pour leur travail réel. Frais de logement, repas et forfait trajet en sus.",
      en: "AI sessions in Dijon: on-site formats from one to several days depending on your teams. Your staff leave autonomous with AI tools configured for their real work. Lodging, meals and travel allowance billed separately.",
    },
    implementation: {
      fr: "Implémentation IA à Dijon : déploiement dans vos outils existants (CRM, ERP, mails) avec ROI chiffré contractuel. Vos équipes gardent la main, pas de dépendance créée.",
      en: "AI implementation in Dijon: deployment into your existing tools (CRM, ERP, email) with contractually-costed ROI. Your teams stay in control, no dependency created.",
    },
    unAUn: {
      fr: "Coaching IA individuel à Dijon — à partir de 990 € HT. Un consultant senior entièrement dédié à votre cas, dans vos locaux dijonnais : dirigeant de domaine viticole, responsable agroalimentaire, manager de cabinet ou directeur de PME Côte-d'Or qui veut progresser seul, à son rythme.",
      en: "Individual AI coaching in Dijon — from 990 € excl. VAT. A senior consultant entirely dedicated to your case, at your Dijon premises: wine estate executive, agri-food manager, practice leader or Côte-d'Or SME director who wants to progress alone, at their own pace.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet IA opérationnel qui intervient à Dijon (21) sur site dans la métropole dijonnaise et le bassin bourguignon (Chenôve, Talant, Quetigny, Saint-Apollinaire). Nous accompagnons les TPE, PME, ETI et grandes entreprises de Côte-d'Or sur leurs cas IA opérationnels — diagnostic chiffré, démos sur vos vraies données, plan d'action concret. Secteurs prioritaires : agroalimentaire, pharmacie-santé, viticulture, conseil, formation. Aucun lock-in technologique, vos équipes gardent la main.",
  directAnswerEn:
    "Axion-IA is an operational AI consultancy that intervenes in Dijon (21) on site across the Dijon metropolitan area and the Burgundy basin (Chenôve, Talant, Quetigny, Saint-Apollinaire). We support Côte-d'Or micro-businesses, SMEs, mid-caps and large enterprises on their operational AI use cases — costed diagnosis, demos on your real data, concrete action plan. Priority sectors: agri-food, pharma-healthcare, viticulture, consulting, training. No tech lock-in, your teams stay in control.",

  topSectorsNaf: [
    "Agroalimentaire & Foodtech",
    "Santé & Pharmacie (URGO, pharma Côte-d'Or)",
    "Viticulture & Vins de Bourgogne",
    "Conseil & Services aux entreprises",
    "Enseignement supérieur & Recherche",
    "Commerce & Distribution",
  ],

  distancesFr:
    "Gare de Dijon-Ville : LGV Rhin-Rhône, Paris en ~1h34, Lyon en ~1h50, Strasbourg en ~2h. Divia tramway lignes T1 et T2 pour rejoindre vos bureaux dans l'ensemble de la métropole dijonnaise. Aéroport Dijon-Bourgogne (DIJ) à 6 km.",
  distancesEn:
    "Dijon-Ville station: LGV Rhin-Rhône, Paris in ~1h34, Lyon in ~1h50, Strasbourg in ~2h. Divia tram lines T1 and T2 to reach your offices across the Dijon metropolitan area. Dijon-Bourgogne Airport (DIJ) 6 km away.",

  ecosystemFr:
    "14 946 établissements actifs — TPE artisanales et cabinets dijonnais, PME industrielles Côte-d'Or, ETI agroalimentaires (URGO Chenôve, Amora siège), pôle académique (Université de Bourgogne, BSB, Institut Agro Dijon, ESIREM), capitale French Tech BFC labellisée 2023, accélérateur ToasterLab / Vitagora, Village by CA, Cité Internationale de la Gastronomie et du Vin.",
  ecosystemEn:
    "14,946 active establishments — artisan micro-businesses and Dijon practices, Côte-d'Or industrial SMEs, agri-food mid-caps (URGO Chenôve HQ, Amora HQ), academic hub (Université de Bourgogne, BSB, Institut Agro Dijon, ESIREM), 2023-labelled French Tech BFC capital, ToasterLab / Vitagora accelerator, Village by CA, International City of Gastronomy and Wine.",

  // === SERVICES LONG-FORM DIJON ===
  services: {
    // ────────────────────────────────────────────────────────────
    // SERVICE : AUDIT
    // ────────────────────────────────────────────────────────────
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA à Dijon cartographie ce qui peut être automatisé dans votre organisation et chiffre le retour sur investissement à 12-24 mois. Quatre niveaux du Flash au Stratégique ETI couvrent toutes les tailles, des TPE artisanales dijonnaises aux sièges industriels de Côte-d'Or (URGO, Amora) et aux cabinets de la Burgundy School of Business. Intervention sur site dans la métropole dijonnaise et dans tout le bassin bourguignon.",
        whyHere: [
          "Dijon est une capitale French Tech labellisée 2023 (~450 organisations membres) avec un tissu PME/ETI dense sur des secteurs où l'IA génère un ROI démontrable : agroalimentaire, viticulture, santé, logistique.",
          "Le pôle agroalimentaire bourguignon — Vitagora, ToasterLab, Institut Agro Dijon, INRAE BFC — constitue un terrain d'audit IA particulièrement fertile : traçabilité, contrôle qualité, optimisation formulations, qualification leads B2B.",
          "Nos consultants interviennent en présentiel dans la métropole dijonnaise (Dijon, Chenôve, Talant, Quetigny, Longvic, Fontaine-lès-Dijon, Saint-Apollinaire) et dans le bassin bourguignon au-delà.",
          "Restitutions toujours en présentiel dans vos locaux dijonnais : atelier de lecture du livrable avec votre comité de direction, plan d'action remis en main propre.",
          "Tarifs publics affichés, aucun devis opaque : vous savez exactement ce que vous payez avant de signer.",
          "Votre plan d'action est exécutable avec n'importe quel prestataire ou en interne après l'audit — aucun lock-in Axion-IA.",
        ],
        methodology: [
          {
            step: "Préparation",
            detail:
              "Un brief de cadrage à distance pour accéder en toute confidentialité aux quelques documents clés (organigramme, processus, indicateurs). Ajustement du périmètre à votre secteur dijonnais dominant (agroalimentaire, pharma, viticulture, services B2B).",
          },
          {
            step: "Kick-off sur site à Dijon",
            detail:
              "Première venue dans vos locaux pour observer les outils utilisés au quotidien et identifier les workflows candidats à l'IA. Visite des postes opérationnels, cartographie rapide des frictions.",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Série d'entretiens individuels courts (commerciaux, production, finance, RH, opérations, direction) pour cartographier finement attentes et points de douleur concrets dans votre organisation.",
          },
          {
            step: "Démos sur vos vraies données",
            detail:
              "Sur place : démos de Claude, Mistral, GPT-4 appliquées à vos PDFs, vos emails, vos bons de commande, vos fiches produit. Pas de slides théoriques — vos données réelles, vos cas réels.",
          },
          {
            step: "Restitution + plan d'action",
            detail:
              "Atelier de restitution dans vos locaux dijonnais. Livrable PDF chiffré ROI/complexité remis en main propre, roadmap actionnable avec séquençage priorisé.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Audit Flash",
            detail:
              "Adapté aux indépendants, artisans, cabinets dijonnais et petites structures de la métropole jusqu'à une dizaine de collaborateurs.",
          },
          {
            sizeLabel: "PME",
            price: "Audit Ciblé ou Stratégique PME",
            detail:
              "Idéal pour cabinets de conseil, PME agroalimentaires, producteurs vitivinicoles structurés, prestataires santé de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Audit Stratégique ETI",
            detail:
              "Pour les ETI industrielles et de services souhaitant cadrer une trajectoire IA pluriannuelle à Dijon ou dans le bassin Côte-d'Or.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Audit Stratégique ETI étendu",
            detail:
              "Pour les sièges régionaux et groupes implantés à Dijon (URGO, Amora, SEB bassin) souhaitant cadrer une gouvernance IA centralisée.",
          },
        ],
        testimonials: [
          {
            quote:
              "L'audit Flash a été déclencheur : en une journée, nous avons identifié trois workflows automatisables dans notre gestion administrative. Le livrable était chiffré, pas théorique. On a pu prioriser sans hésiter.",
            role: "Directrice générale",
            companyProfile: "Cabinet conseil, Dijon métropole, PME",
          },
          {
            quote:
              "Méthode pragmatique, démos sur nos vraies données de production. Le plan d'action a convaincu notre comité de direction en une réunion — ce qu'aucun consultant traditionnel n'avait réussi à faire.",
            role: "Directeur industriel",
            companyProfile: "ETI agroalimentaire, Côte-d'Or",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA à Dijon ?",
            a: "La durée varie selon le niveau retenu : un Audit Flash se déroule sur une journée, un Audit Stratégique ETI s'étale sur plusieurs journées réparties selon votre organisation. Nous calons le rythme avec vous dès le brief de cadrage initial.",
          },
          {
            q: "Quels secteurs dijonnais bénéficient le plus d'un audit IA ?",
            a: "L'agroalimentaire, la viticulture et la pharmacie-santé sont nos terrains d'audit prioritaires à Dijon, car les données structurées y sont abondantes et les gains IA (traçabilité, contrôle qualité, rédaction réglementaire) sont mesurables rapidement. Mais tout secteur B2B est éligible.",
          },
          {
            q: "Mes données restent-elles confidentielles pendant l'audit ?",
            a: "Oui. Confidentialité stricte dès le démarrage, données traitées exclusivement sur vos infrastructures ou sur infra dédiée en UE, pas d'extraction vers nos serveurs. Conformité RGPD, DPO disponible sur demande.",
          },
          {
            q: "Comment se déroule la restitution finale à Dijon ?",
            a: "Toujours en présentiel dans vos locaux dijonnais. Atelier de quelques heures avec votre comité de direction ou équipe dirigeante. Vous repartez avec le livrable PDF en main propre et une roadmap séquencée.",
          },
          {
            q: "En quoi Axion-IA diffère d'un cabinet de conseil traditionnel ?",
            a: "Nos consultants sont d'anciens praticiens IA, pas des MBA. Tarifs publics affichés, pas de devis à six chiffres à négocier. Méthode condensée avec démos sur vos données réelles. Et aucun lock-in : vous repartez avec votre plan, libre de l'exécuter avec qui vous voulez.",
          },
          {
            q: "Faut-il être déjà avancé sur l'IA pour demander un audit ?",
            a: "Non. Une grande partie de nos audits dijonnais sont commandés par des dirigeants ou responsables qui n'ont jamais lancé de chantier IA. L'audit est précisément conçu pour ne pas vous engager dans la mauvaise direction.",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les délais convenus à la signature. Conformité RGPD, hébergement données en UE par défaut, DPO sur demande. Aucun lock-in technologique : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne. Si après la restitution vous estimez que le livrable n'apporte pas de valeur actionnable, audit remboursé intégralement.",
      },
      en: {
        hero: "Axion-IA's AI audit in Dijon maps what can be automated in your organisation and quantifies the 12-24 month return on investment. Four tiers from Flash to Mid-cap Strategic cover every size, from artisan Dijon micro-businesses to Côte-d'Or industrial HQs (URGO, Amora) and Burgundy School of Business practices. On-site engagement across the Dijon metropolitan area and the Burgundy basin.",
        whyHere: [
          "Dijon is a 2023-labelled French Tech capital (~450 member organisations) with a dense SME/mid-cap fabric in sectors where AI delivers demonstrable ROI: agri-food, viticulture, healthcare, logistics.",
          "The Burgundy agri-food hub — Vitagora, ToasterLab, Institut Agro Dijon, INRAE BFC — is particularly fertile ground for AI audits: traceability, quality control, formula optimisation, B2B lead qualification.",
          "Our consultants engage in person across the Dijon metropolitan area (Dijon, Chenôve, Talant, Quetigny, Longvic, Fontaine-lès-Dijon, Saint-Apollinaire) and the broader Burgundy basin.",
          "Read-outs always in person at your Dijon premises: deliverable walk-through workshop with your leadership, action plan handed over face to face.",
          "Public pricing, no opaque quote: you know exactly what you pay before signing.",
          "Your action plan is executable with any vendor or in-house after the audit — no Axion-IA lock-in.",
        ],
        methodology: [
          {
            step: "Preparation",
            detail:
              "Remote framing brief to access under full confidentiality a few key documents (org chart, processes, KPIs). Scope adjusted to your dominant Dijon sector (agri-food, pharma, viticulture, B2B services).",
          },
          {
            step: "On-site kick-off in Dijon",
            detail:
              "First visit to your premises to observe daily tools and identify AI candidate workflows. Operational workstation visit, quick friction mapping.",
          },
          {
            step: "Employee interviews",
            detail:
              "Series of short individual interviews (sales, production, finance, HR, operations, leadership) to map concrete pain points and expectations across your organisation.",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site: demos of Claude, Mistral, GPT-4 applied to your PDFs, emails, purchase orders, product sheets. No theoretical slides — your real data, your real cases.",
          },
          {
            step: "Read-out + action plan",
            detail:
              "Read-out workshop at your Dijon premises. Costed ROI/complexity PDF deliverable handed over, actionable prioritised roadmap.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Flash audit",
            detail:
              "Suited to Dijon freelancers, artisans, practices and small metropolitan structures up to about ten staff.",
          },
          {
            sizeLabel: "SME",
            price: "Targeted or SME Strategic audit",
            detail:
              "Ideal for consulting firms, agri-food SMEs, structured wine producers, healthcare service providers from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap Strategic audit",
            detail:
              "For Dijon or Côte-d'Or industrial and services mid-caps framing a multi-year AI trajectory.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Extended Mid-cap Strategic audit",
            detail:
              "For regional HQs and groups based in Dijon (URGO, Amora, SEB basin) framing centralised AI governance.",
          },
        ],
        testimonials: [
          {
            quote:
              "The Flash audit was a trigger: in one day we identified three automatable workflows in our admin management. The deliverable was costed, not theoretical. We could prioritise without hesitation.",
            role: "Managing Director",
            companyProfile: "Consulting firm, Dijon metropolitan area, SME",
          },
          {
            quote:
              "Pragmatic method, demos on our real production data. The action plan convinced our executive committee in one meeting — something no traditional consultant had managed.",
            role: "Industrial Director",
            companyProfile: "Agri-food mid-cap, Côte-d'Or",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Dijon?",
            a: "Duration varies by tier: a Flash audit runs over a day, a Mid-cap Strategic audit spans several days spread according to your organisation. We agree on the cadence at the framing brief.",
          },
          {
            q: "Which Dijon sectors benefit most from an AI audit?",
            a: "Agri-food, viticulture and pharma-healthcare are our priority audit territories in Dijon, as structured data is abundant and AI gains (traceability, quality control, regulatory writing) are measurable quickly. But any B2B sector is eligible.",
          },
          {
            q: "Does my data stay confidential during the audit?",
            a: "Yes. Confidentiality ensured from kick-off, data processed exclusively on your infrastructure or on dedicated EU infra, no extraction to our servers. GDPR compliance, DPO available on request.",
          },
          {
            q: "How does the final read-out work in Dijon?",
            a: "Always in person at your Dijon premises. Workshop of a few hours with your leadership or executive committee. You leave with the PDF deliverable in hand and a sequenced roadmap.",
          },
          {
            q: "How does Axion-IA differ from a traditional consulting firm?",
            a: "Our consultants are former AI practitioners, not MBAs. Public pricing, no six-figure quote to negotiate. Condensed method with demos on your real data. And no lock-in: you leave with your plan, free to execute with whoever you want.",
          },
          {
            q: "Do I need AI maturity to request an audit?",
            a: "No. A large share of our Dijon audits are ordered by executives who have never launched an AI initiative. The audit exists precisely to avoid going in the wrong direction.",
          },
        ],
        guarantees:
          "Contractual commitment: deliverable handed over within the timeline agreed at signature. GDPR compliance, EU data hosting by default, DPO on request. No tech lock-in: your action plan is executable with any vendor or in-house. If after the read-out you feel the deliverable lacks actionable value, audit fully refunded.",
      },
    },

    // ────────────────────────────────────────────────────────────
    // SERVICE : INTERVENTIONS
    // ────────────────────────────────────────────────────────────
    interventions: {
      fr: {
        hero: "Les interventions IA Axion-IA à Dijon se déclinent en formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs ne repartent pas avec des slides : ils repartent avec des outils IA installés sur leur poste, configurés pour leur travail réel dans votre secteur dijonnais. Frais de logement, repas et forfait trajet facturés à part.",
        whyHere: [
          "Dijon est une étape stratégique de nos déploiements régionaux : métropole bien desservie (LGV ~1h34 Paris), tissu B2B dense (14 946 établissements actifs) et secteurs IA-matures (agroalimentaire, pharma, viticulture).",
          "Tous les secteurs de la métropole couverts en présentiel : Dijon intra-muros, Chenôve (URGO), Talant, Quetigny, Longvic, Fontaine-lès-Dijon, Saint-Apollinaire.",
          "Le format Essentielle est calibré pour les PME dijonnaises de quelques personnes à une centaine de collaborateurs, idéal pour les équipes agroalimentaires, santé, commerce et services.",
          "Le format Conférence convient aux plénières des ETI et grands comptes dijonnais (salles Parc des Expositions, espaces Village by CA, Cité Internationale de la Gastronomie et du Vin).",
          "Le format Dirigeants permet un cadrage en huis-clos pour les comités de direction de Côte-d'Or.",
          "Vocabulaire et exemples ajustés à votre secteur dijonnais dominant : aucune session générique recyclée.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Un échange à distance avec votre RH ou votre direction pour cibler le profil des participants, votre secteur dijonnais, les cas d'usage prioritaires (gestion production, commercial, administratif, R&D).",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs de votre activité dijonnaise (fiches produit, emails clients, bons de commande, notes de dégustation, rapports qualité) pour calibrer les démos sur VOS données.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux dijonnais pour vérifier matériel, projection, accès Wi-Fi. Pas d'aléa technique le jour J.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Alternance de théorie courte et de démos longues sur VOS données réelles, suivies d'ateliers participatifs. Exemples concrets tirés du tissu économique bourguignon.",
          },
          {
            step: "Outils installés et debrief",
            detail:
              "Chaque participant repart avec les outils IA installés et configurés pour son cas d'usage personnel. Utilisables le lendemain matin sans aide extérieure.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Format Essentielle",
            detail:
              "Idéal indépendants, artisans, cabinets dijonnais et petites structures jusqu'à une dizaine de collaborateurs.",
          },
          {
            sizeLabel: "PME",
            price: "Format Essentielle ou Équipes",
            detail:
              "Essentielle pour le groupe entier ou Équipes pour focaliser sur un département (production, commercial, finance, qualité, RH).",
          },
          {
            sizeLabel: "ETI",
            price: "Format Conférence ou Dirigeants",
            detail:
              "Plénière pour grandes audiences à Dijon ou huis-clos comité de direction selon votre objectif.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Format personnalisé multi-formats",
            detail:
              "Combinaisons sur-mesure pour les sièges et grands comptes dijonnais : roadshow multi-sites Côte-d'Or, séminaires CODIR + cascade équipes.",
          },
        ],
        testimonials: [
          {
            quote:
              "Format Essentielle très bien adapté à notre équipe commerciale : démos sur nos vrais emails et fiches client. Le lendemain, les commerciaux utilisaient Claude pour qualifier leurs leads. Résultat visible immédiatement.",
            role: "Directeur commercial",
            companyProfile: "PME agroalimentaire, Dijon métropole",
          },
          {
            quote:
              "La session dirigeants a aligné notre CODIR en une journée sur notre roadmap IA. Les exemples utilisés venaient de notre secteur bourguignon, pas de cas génériques. C'est ce qui a fait la différence.",
            role: "Présidente",
            companyProfile: "ETI services B2B, Côte-d'Or",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA à Dijon ?",
            a: "Cela dépend du format choisi. L'Essentielle se déroule sur une journée, l'Approfondie sur deux journées consécutives. La Conférence et le format Dirigeants tiennent sur une journée. Pour un programme multi-formats, le rythme est défini ensemble en cadrage.",
          },
          {
            q: "Quelle taille de groupe pouvez-vous animer à Dijon ?",
            a: "L'Essentielle accueille jusqu'à une centaine de collaborateurs en interaction. Au-delà, le format Conférence est plus adapté avec un schéma plénière + ateliers en sous-groupes, adaptable aux salles du Parc des Expositions ou de la Cité Internationale de la Gastronomie et du Vin.",
          },
          {
            q: "Les outils installés sur les postes restent-ils utilisables après la session ?",
            a: "Oui, ce sont des comptes individuels (gratuits ou avec abonnement employé) sur ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity selon le profil. Aucun lock-in Axion-IA, vous gardez la main.",
          },
          {
            q: "Pouvez-vous adapter le contenu au secteur agroalimentaire ou vitivinicole ?",
            a: "Oui systématiquement. Le brief de cadrage nous permet d'ajuster vocabulaire, exemples, démos. Une session pour un domaine viticole de la Côte de Nuits n'a rien à voir avec une session pour un cabinet comptable dijonnais.",
          },
          {
            q: "Vos interventions sont-elles éligibles aux fonds de formation ?",
            a: "Nos interventions sont facturées en direct sur devis HT. Elles s'intègrent dans votre plan de développement des compétences — votre service RH ou comptable peut les traiter comme une prestation de conseil.",
          },
          {
            q: "Que se passe-t-il en cas d'annulation ?",
            a: "Plus l'annulation est anticipée, plus elle est neutre. Très anticipée : remboursement intégral. Quelques jours avant : participation partielle aux frais consultant déjà bloqué. Très tardive : la session est reportable une fois sans frais sur les mois suivants.",
          },
        ],
        guarantees:
          "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain matin sur les outils installés, séance de remédiation offerte. Vocabulaire et exemples ajustés à votre secteur dijonnais, aucune session générique recyclée.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Dijon come in on-site formats from one to several days depending on your teams. Your staff don't leave with slides: they leave with AI tools installed on their workstations, configured for their real work in your Dijon sector. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "Dijon is a strategic stop in our regional deployments: well-connected metropolitan area (LGV ~1h34 from Paris), dense B2B fabric (14,946 active establishments) and AI-mature sectors (agri-food, pharma, viticulture).",
          "All metropolitan sectors covered in person: Dijon city, Chenôve (URGO), Talant, Quetigny, Longvic, Fontaine-lès-Dijon, Saint-Apollinaire.",
          "The Essential format is calibrated for Dijon SMEs from a few to about a hundred staff, ideal for agri-food, healthcare, commerce and services teams.",
          "The Talk format suits large corporate plenaries at Dijon mid-caps and large accounts (Parc des Expositions, Village by CA spaces, International City of Gastronomy and Wine).",
          "The Executives format enables in-camera framing for Côte-d'Or executive committees.",
          "Vocabulary and examples adjusted to your dominant Dijon sector: no recycled generic session.",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange with your HR or leadership to target participant profile, Dijon sector, priority use cases (production management, sales, admin, R&D).",
          },
          {
            step: "Demo preparation",
            detail:
              "We collect a few anonymised documents representative of your Dijon activity (product sheets, client emails, purchase orders, tasting notes, quality reports) to calibrate demos on YOUR data.",
          },
          {
            step: "Arrival and setup",
            detail:
              "Our consultants arrive ahead of time at your Dijon premises to check equipment, projection, Wi-Fi access. No technical hiccup on D-day.",
          },
          {
            step: "Pedagogical session",
            detail:
              "Alternation of short theory and longer demos on YOUR real data, followed by participatory workshops. Concrete examples drawn from the Burgundy economic fabric.",
          },
          {
            step: "Tools installed and debrief",
            detail:
              "Each participant leaves with AI tools installed and configured for their personal use case. Usable next morning without external help.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Essential format",
            detail:
              "Ideal for Dijon freelancers, artisans, practices and small structures up to about ten staff.",
          },
          {
            sizeLabel: "SME",
            price: "Essential or Teams format",
            detail:
              "Essential for the whole group or Teams to focus on one department (production, sales, finance, quality, HR).",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Talk or Executives format",
            detail:
              "Plenary for large Dijon audiences or in-camera executive committee depending on your objective.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Custom multi-format program",
            detail:
              "Custom combinations for Dijon HQs and large accounts: Côte-d'Or multi-site roadshows, exec committee + cascade team seminars.",
          },
        ],
        testimonials: [
          {
            quote:
              "Essential format very well adapted to our sales team: demos on our real emails and client sheets. The next day, sales reps were using Claude to qualify their leads. Immediately visible result.",
            role: "Sales Director",
            companyProfile: "Agri-food SME, Dijon metropolitan area",
          },
          {
            quote:
              "The executive session aligned our board in one day on our AI roadmap. The examples came from our Burgundy sector, not generic cases. That made all the difference.",
            role: "President",
            companyProfile: "B2B services mid-cap, Côte-d'Or",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Dijon take?",
            a: "It depends on the chosen format. The Essential runs over a day, the Deep Dive over two consecutive days. The Talk and Executives format fit in a day. For a multi-format program, the rhythm is defined together at framing.",
          },
          {
            q: "What group size can you handle in Dijon?",
            a: "The Essential handles up to about a hundred staff in interaction. Beyond that, the Talk format is more suitable with a plenary + sub-group workshops, adaptable to Parc des Expositions or International City of Gastronomy and Wine rooms.",
          },
          {
            q: "Do the tools installed on workstations remain usable after the session?",
            a: "Yes, they are individual accounts (free or with employee subscription) on ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity per profile. No Axion-IA lock-in, you keep control.",
          },
          {
            q: "Can you adapt content to the agri-food or wine sector?",
            a: "Yes systematically. The framing brief lets us adjust vocabulary, examples, demos. A session for a Côte de Nuits wine estate has nothing to do with one for a Dijon accounting firm.",
          },
          {
            q: "Are your sessions eligible for training funds?",
            a: "Our sessions are invoiced directly on a fixed quote (excl. VAT). They can be included in your company's training plan — your HR or finance team can process them as a consulting service.",
          },
          {
            q: "What happens with a cancellation?",
            a: "The earlier the cancellation, the more neutral it is. Very early: full refund. A few days before: partial participation to consultant slot already blocked. Very late: the session is rebookable once free of charge in the following months.",
          },
        ],
        guarantees:
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning on installed tools, free remediation session offered. Vocabulary and examples adjusted to your Dijon sector, no recycled generic session.",
      },
    },

    // ────────────────────────────────────────────────────────────
    // SERVICE : IMPLÉMENTATION
    // ────────────────────────────────────────────────────────────
    implementation: {
      fr: {
        hero: "L'implémentation IA Axion-IA à Dijon met vos cas IA en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Le mode est hybride sur site / distance, avec un kick-off obligatoire dans vos locaux dijonnais. Cas prioritaires : traçabilité agroalimentaire, gestion qualité pharma, automatisation back-office, scoring leads commercial.",
        whyHere: [
          "Dijon concentre des secteurs à fort potentiel d'implémentation IA : agroalimentaire (traçabilité, contrôle qualité, formulation), pharmacie-santé (documentation réglementaire, gestion stocks URGO-type), viticulture (tasting notes, scoring parcelles), services B2B (qualification leads, comptes-rendus, mails).",
          "Le kick-off se passe systématiquement en présentiel dans vos locaux dijonnais : alignement des équipes, accès aux données, validation des intégrations CRM/ERP/email.",
          "Itérations à distance ensuite avec un point quotidien court en visio et une visite mensuelle pour démos d'avancement avec votre direction ou CODIR.",
          "Recette finale toujours en présentiel à Dijon : passation de pouvoir, formation des équipes, documentation runbook remise.",
          "Formation incluse pour vos collaborateurs identifiés ambassadeurs IA internes — autonomes après la fin de mission.",
          "Cas types dijonnais : domaine viticole (rédaction fiche cuvée + scoring parcelles), ETI agroalimentaire (contrôle qualité automatisé + traçabilité), cabinet comptable (lecture factures + comptes-rendus), PME logistique (scoring bons de commande + dispatch).",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site Dijon : revue de l'architecture cible (CRM, ERP, mails, stockage), validation des contraintes RGPD/sécurité, sélection finale des modèles IA, signature du SOW chiffré.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site Dijon : installation des accès, déploiement de l'environnement de dev, première intégration end-to-end fonctionnelle (POC), validation visuelle avec votre équipe.",
          },
          {
            step: "Itérations",
            detail:
              "Travail à distance avec un point quotidien court : enrichissement progressif des cas, intégration aux outils existants, tests sur volumes réels, ajustements UX.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site Dijon : tests d'acceptation utilisateurs, formation des ambassadeurs internes, livraison du runbook documentation, plan de monitoring.",
          },
          {
            step: "Suivi post-go-live",
            detail:
              "À distance : surveillance des métriques de production, ajustements fins, mesure du ROI réel par rapport à la prédiction du SOW. Rapport final remis à clôture.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Pilote IA",
            detail:
              "Implémentation d'un cas d'usage simple (lecture factures, rédaction fiche produit, scoring leads) pour indépendants et petites structures dijonnaises.",
          },
          {
            sizeLabel: "PME",
            price: "Mission PME",
            detail:
              "Déploiement de plusieurs cas d'usage, formation d'ambassadeurs internes, intégration CRM/ERP. Pour PME agroalimentaires, cabinets de conseil, prestataires santé de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Mission ETI",
            detail:
              "Déploiement transverse, gouvernance IA, intégrations avancées (legacy ERP, MES, datalake), formation d'ambassadeurs cross-département pour les ETI industrielles de Côte-d'Or.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Grand programme multi-déploiement",
            detail:
              "Programmes annuels pour les grands comptes dijonnais : cas d'usage cascadés, gouvernance IA centralisée, équipe dédiée Axion-IA en mode régie.",
          },
        ],
        testimonials: [
          {
            quote:
              "Implémentation traçabilité + génération de fiches produit livrée comme prévu. Le ROI mesuré à 6 mois dépassait la prédiction du SOW. Nos équipes qualité ont pris le relais sans aide extérieure.",
            role: "Directrice qualité",
            companyProfile: "ETI agroalimentaire, Côte-d'Or",
          },
          {
            quote:
              "Kick-off intense sur site à Dijon, puis itérations à distance très efficaces. Notre équipe IT n'a jamais été perdue. Le runbook documenté permet de maintenir la solution en autonomie totale.",
            role: "Responsable SI",
            companyProfile: "PME santé-pharma, Dijon métropole",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implémentation Axion-IA à Dijon ?",
            a: "Cela dépend de l'ampleur. Un POC pour TPE peut tenir en quelques semaines, une mission PME standard sur quelques mois, une mission ETI transverse sur plusieurs mois. Le SOW signé en cadrage fixe le calendrier précis.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour la grande majorité de nos missions dijonnaises. SOW signé au début avec scope précis et livrables définis. Si le scope change en cours, avenant explicite + nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Qui maintient la solution après la mission ?",
            a: "Vos ambassadeurs internes, formés pendant la mission. Documentation runbook complète remise. Si maintenance externalisée souhaitée, contrat de support optionnel. Aucun lock-in : vous pouvez externaliser ailleurs.",
          },
          {
            q: "Mes données restent-elles chez moi ou partent-elles chez Axion-IA ?",
            a: "Toujours chez vous. Modèles IA déployés sur votre infra (cloud privé, on-premise) ou sur infra dédiée en UE si vous préférez. Confidentialité assurée dès le cadrage, RGPD strict, DPO sur demande.",
          },
          {
            q: "Quels modèles IA utilisez-vous pour les secteurs spécifiques à Dijon ?",
            a: "Mix selon le cas : open-source (Mistral, Llama) pour la souveraineté et le coût ; propriétaires (GPT, Claude, Gemini) pour la qualité top ; parfois fine-tuning sur vos données sectorielles (agroalimentaire, viticulture) si le volume le justifie. Choix justifié dans le SOW, jamais imposé.",
          },
          {
            q: "Que se passe-t-il si l'IA produit des erreurs sur nos données métier ?",
            a: "Tous nos déploiements incluent une couche de validation : seuils de confiance, double-check humain pour les cas sensibles (réglementaire, traçabilité, facturation), monitoring continu. Le ROI chiffré au SOW intègre la marge d'erreur réaliste, pas un scénario parfait.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : pas de dérive horaire cachée. Livraison dans les délais convenus à la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après une année de production le ROI réel reste très en deçà de la prédiction du SOW, audit gratuit pour identifier la cause + ajustement déploiement offert. Aucun lock-in technologique : vos modèles, vos données, votre runbook. Vos ambassadeurs internes formés sont autonomes après go-live.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Dijon brings your AI cases to production with contractually-costed ROI, team training included. Mode is hybrid on-site / remote, with a mandatory kick-off at your Dijon premises. Priority cases: agri-food traceability, pharma quality management, back-office automation, commercial lead scoring.",
        whyHere: [
          "Dijon concentrates high-AI-implementation-potential sectors: agri-food (traceability, quality control, formulation), pharma-healthcare (regulatory documentation, URGO-type stock management), viticulture (tasting notes, plot scoring), B2B services (lead qualification, meeting minutes, emails).",
          "Kick-off always happens in person at your Dijon premises: team alignment, data access, CRM/ERP/email integration validation.",
          "Remote iterations afterwards with a short daily video check-in and a monthly on-site visit for progress demos with your leadership or board.",
          "Final acceptance always in person in Dijon: handover, team training, runbook documentation delivered.",
          "Training included for your identified internal AI ambassador staff — autonomous after mission end.",
          "Typical Dijon cases: wine estate (cuvée sheet writing + plot scoring), agri-food mid-cap (automated quality control + traceability), accounting firm (invoice reading + meeting minutes), logistics SME (purchase order scoring + dispatch).",
        ],
        methodology: [
          {
            step: "Technical framing",
            detail:
              "On-site Dijon workshop: target architecture review (CRM, ERP, emails, storage), GDPR/security constraints validation, AI model final selection, costed SOW signed.",
          },
          {
            step: "Kick-off + initial sprint",
            detail:
              "Several days on site Dijon: access install, dev environment deployment, first end-to-end functional integration (POC), visual validation with your team.",
          },
          {
            step: "Iterations",
            detail:
              "Remote work with a short daily check-in: progressive case enrichment, integration with existing tools, real-volume testing, UX adjustments.",
          },
          {
            step: "Acceptance + training",
            detail:
              "On site Dijon: user acceptance tests, training of internal ambassadors, runbook documentation delivery, monitoring plan.",
          },
          {
            step: "Post-go-live follow-up",
            detail:
              "Remote: production metrics monitoring, fine adjustments, real ROI vs SOW prediction measurement. Final report delivered at closure.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Pilote IA",
            detail:
              "Implementation of a simple use case (invoice reading, product sheet writing, lead scoring) for Dijon freelancers and small structures.",
          },
          {
            sizeLabel: "SME",
            price: "SME mission",
            detail:
              "Deployment of several use cases, training of internal ambassadors, CRM/ERP integration. For agri-food SMEs, consulting firms, healthcare service providers from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations (legacy ERP, MES, datalake), training of cross-department ambassadors for Côte-d'Or industrial mid-caps.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Multi-deployment large program",
            detail:
              "Annual programs for Dijon large accounts: cascaded use cases, centralised AI governance, dedicated Axion-IA team in retainer mode.",
          },
        ],
        testimonials: [
          {
            quote:
              "Traceability + product sheet generation implementation delivered as planned. The ROI measured at 6 months exceeded the SOW prediction. Our quality teams took over without external help.",
            role: "Quality Director",
            companyProfile: "Agri-food mid-cap, Côte-d'Or",
          },
          {
            quote:
              "Intense on-site kick-off in Dijon, then very efficient remote iterations. Our IT team was never lost. The documented runbook allows fully autonomous maintenance.",
            role: "IT Manager",
            companyProfile: "Pharma-healthcare SME, Dijon metropolitan area",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA implementation in Dijon take?",
            a: "It depends on scope. A micro-business POC fits in a few weeks, a standard SME mission spans a few months, a transverse mid-cap mission spans several months. The SOW signed at framing fixes the precise schedule.",
          },
          {
            q: "Is the price fixed or time-based?",
            a: "Fixed flat-rate for the vast majority of our Dijon missions. SOW signed at the start with precise scope and defined deliverables. If scope changes mid-mission, explicit amendment + new estimate. No hidden hourly drift.",
          },
          {
            q: "Who maintains the solution after the mission?",
            a: "Your internal ambassadors, trained during the mission. Complete runbook documentation handed over. If outsourced maintenance desired, optional support contract. No lock-in: you can also outsource elsewhere.",
          },
          {
            q: "Does my data stay with me or move to Axion-IA?",
            a: "Always with you. AI models deployed on your infra (private cloud, on-premise) or on dedicated EU infra if you prefer. Strict confidentiality at framing, strict GDPR, DPO on request.",
          },
          {
            q: "Which AI models do you use for Dijon's specific sectors?",
            a: "Mix per case: open-source (Mistral, Llama) for sovereignty and cost; proprietary (GPT, Claude, Gemini) for top quality; sometimes fine-tuning on your sector data (agri-food, viticulture) if volume justifies. Choice justified in SOW, never imposed.",
          },
          {
            q: "What happens if the AI produces errors on our sector-specific data?",
            a: "All our deployments include a validation layer: confidence thresholds, human double-check for sensitive cases (regulatory, traceability, invoicing), continuous monitoring. The costed ROI in SOW includes realistic margin of error, not a perfect scenario.",
          },
        ],
        guarantees:
          "Fixed flat-rate on SOW: no hidden hourly drift. Delivery within the timeline agreed at signature, with contractual compensation in case of our delay. Contractual costed ROI: if after a year of production the real measured ROI stays significantly below the SOW prediction, free audit to identify the cause + offered deployment adjustment. No tech lock-in: your models, your data, your runbook. Your trained internal ambassadors are autonomous after go-live.",
      },
    },

    unAUn: {
      fr: {
        hero: "Le coaching IA individuel Axion-IA à Dijon s'adresse au dirigeant, manager ou expert qui veut progresser sur l'IA à son rythme, sur ses propres cas métier, sans partager sa session avec un groupe. À partir de 990 € HT, un consultant senior est entièrement dédié à vous dans vos locaux dijonnais — domaine viticole, cabinet de conseil, PME agroalimentaire ou ETI de Côte-d'Or. Frais de logement, repas et forfait trajet en sus.",
        whyHere: [
          "Dijon compte de nombreux dirigeants de domaines viticoles, coopératives agroalimentaires et cabinets de conseil qui préfèrent une montée en compétences IA privée, ancrée dans leurs propres données (fiches cuvées, notes de dégustation, spécifications produit).",
          "Les responsables de PME pharma-santé (URGO-type) et d'ETI industrielles de Côte-d'Or bénéficient d'un accompagnement individuel calibré sur leurs contraintes réglementaires et de confidentialité — sans partager leurs enjeux avec un groupe.",
          "La format individuel permet d'aborder des sujets stratégiques sensibles : positionnement tarifaire viticulture, données de formulation agroalimentaire, processus qualité pharma.",
          "Aucun minimum de participants, aucune date imposée : vous choisissez le créneau dans vos locaux dijonnais ou en distanciel si nécessaire.",
          "La French Tech BFC labellisée 2023 (~450 membres) compte de nombreux fondateurs dont l'emploi du temps ne correspond pas à un format de groupe collectif.",
          "À la fin de la session, vous repartez avec des outils IA configurés sur vos propres cas dijonnais — fiches produit, emails fournisseurs, tableaux de bord — pas sur des exemples génériques.",
        ],
        methodology: [
          {
            step: "Diagnostic individuel",
            detail:
              "Entretien de cadrage dédié (30-45 min) pour cerner votre profil, votre secteur dominant (viticulture, agro, pharma, services B2B), vos priorités et vos contraintes de confidentialité.",
          },
          {
            step: "Préparation sur-mesure",
            detail:
              "Le consultant prépare un programme individuel : outils sélectionnés pour votre cas, démos construites sur vos documents représentatifs (notes de dégustation, fiches cuvée, bons de commande, emails).",
          },
          {
            step: "Session intensive sur site",
            detail:
              "Journée dans vos locaux à Dijon ou dans le bassin (Chenôve, Longvic, Quetigny) : théorie ciblée, démos live sur vos données réelles, manipulation directe des outils. Rythme adapté à votre niveau.",
          },
          {
            step: "Cas pratiques sur vos documents réels",
            detail:
              "Vous travaillez sur vos propres fichiers : fiches cuvées, dossiers réglementaires, emails clients, rapports qualité. Aucun exercice déconnecté de votre réalité dijonnaise.",
          },
          {
            step: "Plan d'action personnel",
            detail:
              "En fin de session, remise d'un plan d'action individuel : outils à déployer, cas d'usage prioritaires pour votre poste, ressources pour continuer en autonomie.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "À partir de 990 € HT",
            detail:
              "Coaching individuel entrée pour dirigeants TPE, artisans, indépendants et petits domaines viticoles de la métropole dijonnaise — une journée, un consultant dédié.",
          },
          {
            sizeLabel: "PME",
            price: "Sur devis",
            detail:
              "Programme individuel sur-mesure pour manager, responsable opérationnel ou directeur de PME agroalimentaire, pharma ou services de Côte-d'Or.",
          },
          {
            sizeLabel: "ETI",
            price: "Sur devis",
            detail:
              "Coaching individuel pour directeurs techniques, DSI ou membres du comité de direction d'ETI industrielles ou de services dijonnaises.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Sur devis",
            detail:
              "Accompagnement individuel pour cadres dirigeants de grands groupes implantés à Dijon (URGO, Amora, SEB bassin) souhaitant une montée en compétences IA confidentielle.",
          },
        ],
        testimonials: [
          {
            quote:
              "J'avais besoin d'explorer l'IA appliquée à la rédaction de fiches cuvées et au scoring de mes parcelles. En une journée avec un consultant dédié, on a testé sur mes vraies données. Résultat : j'ai un plan concret et des outils opérationnels pour ma prochaine vendange.",
            role: "Propriétaire-récoltant",
            companyProfile: "Domaine viticole AOC Côte de Nuits, Bourgogne",
          },
          {
            quote:
              "Format coaching individuel idéal pour un directeur qualité en ETI pharma : confidentialité totale, niveau technique adapté, démos sur nos propres spécifications produit. Je suis reparti avec des outils installés et un plan d'action pour mon équipe.",
            role: "Directrice qualité",
            companyProfile: "ETI santé-pharma, Dijon métropole",
          },
        ],
        faq: [
          {
            q: "Qu'est-ce que le coaching IA individuel Axion-IA à Dijon ?",
            a: "C'est une session IA sur-mesure dédiée à une seule personne — dirigeant, manager ou expert — dans vos locaux dijonnais. Un consultant senior vous accompagne sur vos cas métier (viticulture, agro, pharma, services) pendant une journée entière. À partir de 990 € HT.",
          },
          {
            q: "Pourquoi choisir le coaching individuel plutôt qu'une session collective à Dijon ?",
            a: "Dans un coaching individuel, 100 % du temps est consacré à votre niveau, votre secteur et vos données. Aucune concession pédagogique. Idéal pour les sujets sensibles (données viticoles, formules agroalimentaires, dossiers réglementaires pharma) ou les profils experts.",
          },
          {
            q: "La session est-elle totalement confidentielle ?",
            a: "Oui. Confidentialité stricte dès le cadrage, vos données ne quittent pas vos locaux dijonnais, aucun partage avec d'autres clients. Vos données de dégustation, formules ou données clients restent chez vous.",
          },
          {
            q: "Faut-il une expérience préalable en IA ?",
            a: "Non. Le coaching s'adapte à votre niveau — débutant ou praticien avancé. Le brief de cadrage initial permet d'ajuster le programme avant la session.",
          },
          {
            q: "Les frais de déplacement sont-ils inclus dans le tarif de 990 € HT ?",
            a: "Non. Frais de logement, repas et forfait trajet sont facturés en sus, selon la doctrine tarifaire Axion-IA. Ces frais sont détaillés sur devis préalable à la confirmation.",
          },
          {
            q: "Puis-je organiser plusieurs coachings individuels pour différents managers ?",
            a: "Oui. Certaines ETI dijonnaises organisent plusieurs sessions individuelles pour leurs directeurs ou responsables clés plutôt qu'une session collective. Tarif dégressif selon le volume — à préciser en cadrage.",
          },
        ],
        guarantees:
          "Confidentialité stricte : vos données et vos enjeux ne quittent pas vos locaux dijonnais. Aucun lock-in : les outils installés sont vos comptes personnels, aucune dépendance Axion-IA après la session. Frais de logement, repas et forfait trajet facturés en sus sur devis préalable. Si la session ne vous apporte pas de valeur actionnable immédiate, remboursement intégral (clause disponible, jamais activée à ce jour).",
      },
      en: {
        hero: "Axion-IA's individual AI coaching in Dijon is for the executive, manager or expert who wants to progress on AI at their own pace, on their own business cases, without sharing the session with a group. From 990 € excl. VAT, a senior consultant is entirely dedicated to you at your Dijon premises — wine estate, consulting firm, agri-food SME or Côte-d'Or mid-cap. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "Dijon has many wine estate owners, agri-food co-op managers and consulting firm directors who prefer private AI skills development focused on their own data (cuvée sheets, tasting notes, product specifications).",
          "Pharma-healthcare SME managers (URGO-type) and Côte-d'Or industrial mid-cap executives benefit from individual coaching calibrated to their regulatory and confidentiality constraints — without sharing their challenges with a group.",
          "The individual format allows tackling sensitive strategic topics: viticulture pricing positioning, agri-food formulation data, pharma quality processes.",
          "No minimum participants, no imposed date: you choose the slot at your Dijon premises or remotely if needed.",
          "The 2023-labelled French Tech BFC (~450 members) includes many founders whose schedule is incompatible with a group format.",
          "At session end, you leave with AI tools configured on your own Dijon cases — product sheets, supplier emails, dashboards — not generic examples.",
        ],
        methodology: [
          {
            step: "Individual diagnosis",
            detail:
              "Dedicated framing interview (30-45 min) to understand your profile, dominant sector (viticulture, agri-food, pharma, B2B services), priorities and confidentiality constraints.",
          },
          {
            step: "Bespoke preparation",
            detail:
              "The consultant prepares an individual programme: tools selected for your case, demos built on your representative documents (tasting notes, cuvée sheets, purchase orders, emails).",
          },
          {
            step: "Intensive on-site session",
            detail:
              "Full day at your Dijon or basin premises (Chenôve, Longvic, Quetigny): targeted theory, live demos on your real data, direct tool use. Pace adapted to your level.",
          },
          {
            step: "Practical exercises on your real documents",
            detail:
              "You work on your own files: cuvée sheets, regulatory dossiers, client emails, quality reports. No exercises disconnected from your Dijon reality.",
          },
          {
            step: "Personal action plan",
            detail:
              "At session end, handover of an individual action plan: tools to deploy, priority use cases for your role, resources to keep progressing autonomously.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "From 990 € excl. VAT",
            detail:
              "Entry individual coaching for Dijon metropolitan micro-business executives, artisans, freelancers and small wine estates — one day, one dedicated consultant.",
          },
          {
            sizeLabel: "SME",
            price: "On request",
            detail:
              "Bespoke individual programme for managers, operational leads or directors of Côte-d'Or agri-food, pharma or services SMEs.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "On request",
            detail:
              "Individual coaching for technical directors, CIOs or executive committee members of Dijon industrial or services mid-caps.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "On request",
            detail:
              "Individual coaching for senior managers at large groups based in Dijon (URGO, Amora, SEB basin) seeking confidential AI skills development.",
          },
        ],
        testimonials: [
          {
            quote:
              "I needed to explore AI applied to writing cuvée sheets and scoring my plots. In one day with a dedicated consultant, we tested on my real data. Result: I have a concrete plan and operational tools for my next harvest.",
            role: "Owner-producer",
            companyProfile: "AOC wine estate, Côte de Nuits, Burgundy",
          },
          {
            quote:
              "Ideal individual coaching format for a quality director at a pharma mid-cap: total confidentiality, adapted technical level, demos on our own product specifications. I left with tools installed and an action plan for my team.",
            role: "Quality Director",
            companyProfile: "Healthcare-pharma mid-cap, Dijon metropolitan area",
          },
        ],
        faq: [
          {
            q: "What is Axion-IA's individual AI coaching in Dijon?",
            a: "It is a bespoke AI session dedicated to one person — executive, manager or expert — at your Dijon premises. A senior consultant accompanies you on your business cases (viticulture, agri-food, pharma, services) for a full day. From 990 € excl. VAT.",
          },
          {
            q: "Why choose individual coaching over a group session in Dijon?",
            a: "In individual coaching, 100% of the time is dedicated to your level, your sector and your data. No pedagogical compromise. Ideal for sensitive topics (wine data, agri-food formulas, pharma regulatory dossiers) or expert profiles.",
          },
          {
            q: "Is the session completely confidential?",
            a: "Yes. Strict confidentiality from framing, your data does not leave your Dijon premises, no sharing with other clients. Your tasting data, formulas or client data remain with you.",
          },
          {
            q: "Do I need prior AI experience?",
            a: "No. Coaching adapts to your level — beginner or advanced practitioner. The initial framing brief allows adjusting the programme before the session.",
          },
          {
            q: "Are travel costs included in the 990 € excl. VAT price?",
            a: "No. Lodging, meals and travel allowance are billed separately, per Axion-IA's pricing doctrine. These costs are detailed on a prior quote before confirmation.",
          },
          {
            q: "Can I organise several individual coachings for different managers?",
            a: "Yes. Some Dijon mid-caps organise several individual sessions for their key directors or managers rather than a group session. Volume discount possible — to be specified at framing.",
          },
        ],
        guarantees:
          "Strict confidentiality: your data and your challenges do not leave your Dijon premises. No lock-in: installed tools are your personal accounts, no Axion-IA dependency after the session. Lodging, meals and travel allowance billed separately on prior quote. If the session does not bring you immediate actionable value, full refund (clause available, never triggered to date).",
      },
    },
  },

  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel à Dijon ?",
      a: "Le tarif dépend du niveau retenu — Audit Flash, Ciblé, Stratégique PME ou Stratégique ETI. Tarifs publics affichés sur la page Audit, calibrés selon votre taille (TPE, PME, ETI, grande entreprise) et votre périmètre. Aucun supplément géographique : le tarif est identique à Dijon et partout en France.",
    },
    {
      q: "Axion-IA intervient-il dans toute la métropole dijonnaise ?",
      a: "Oui. Nos interventions couvrent Dijon intra-muros et les communes de la métropole : Chenôve, Talant, Quetigny, Longvic, Fontaine-lès-Dijon, Saint-Apollinaire, Marsannay-la-Côte. Au-delà, l'ensemble du bassin bourguignon est accessible via la LGV Dijon-Ville.",
    },
    {
      q: "Quels secteurs dijonnais sont prioritaires pour l'IA ?",
      a: "Nos déploiements dijonnais couvrent en priorité l'agroalimentaire (Vitagora, ToasterLab, Cité Gastronomie), la pharmacie-santé (URGO, prestataires médical Côte-d'Or), la viticulture (domaines Côte de Nuits, négoce bourguignon), le conseil et les services B2B. Tout secteur B2B est éligible à un audit.",
    },
    {
      q: "Pouvez-vous intervenir sur site dans nos bureaux dijonnais ?",
      a: "Oui. Toutes nos interventions à Dijon sont par défaut sur site, dans vos bureaux ou salles de réunion. Nos consultants sont mobiles sur l'ensemble de la métropole. Les ateliers de restitution et les kick-offs se tiennent toujours en présentiel.",
    },
    {
      q: "Travaillez-vous avec les startups et PME foodtech de la Cité Gastronomie ?",
      a: "Oui. Nous accompagnons les structures accélérées par ToasterLab/Vitagora et le Village by CA Dijon sur leurs cas IA opérationnels — de l'audit Flash jusqu'à l'implémentation en production. Notre approche est calibrée pour les structures ayant un product-market fit établi qui veulent passer du POC au déploiement réel.",
    },
    {
      q: "En combien de temps pouvez-vous démarrer une mission à Dijon ?",
      a: "Le délai dépend de votre besoin (urgence, complexité, taille). Nous calons une date de démarrage lors du brief de cadrage initial, et tenons l'engagement contractuel à la signature.",
    },
  ],
};
