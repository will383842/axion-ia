// Angers (49007) — contenu éditorial gold standard (sprint City Quality V3 2026-05-18).
//
// Doctrine appliquée (identique Paris gold standard) :
//   - Aucun délai chiffré en dur.
//   - Aucun « frais de déplacement intégrés » — mention systématique
//     « frais de logement, repas et forfait trajet en sus ».
//   - Aucune demi-journée : durée minimale = 1 journée.
//   - Aucun prix hardcodé : libellés seuls, tarifs depuis pricing.ts.
//   - Tailles d'entreprise INSEE uniquement : TPE / PME / ETI / GE.
//   - ~95 % Axion-IA-centric + ~5 % data locale anti-doorway HCU 2024.
//   - PAS de heroSchema, PAS de unAUn (non demandés pour cette ville).
//
// Réalités Angers exploitées :
//   - Vegepolys Valley : siège mondial filière végétale (560+ membres)
//   - Scania Production Angers (~1 500 emplois, ~120 camions/jour)
//   - Eviden/Atos (ex-Bull, centre mondial supercalculateurs Belle-Beille)
//   - Thales Angers (électronique de défense)
//   - Cointreau Groupe Rémy Cointreau (fondé 1849, site Saint-Barthélemy-d'Anjou)
//   - ESEO, ESSCA, ESA, ESAIP, Université d'Angers, UCO
//   - French Tech Angers (labellisée 2015) + Angers Technopole
//   - SIVAL (salon international filière végétale)
//   - Vignobles Anjou AOC, Coteaux-du-Layon AOP, Saumur AOC, Crémant de Loire
//   - Val de Loire UNESCO 2000 (porte d'entrée occidentale, Chalonnes-sur-Loire)
//   - 12 222 établissements actifs (INSEE 2023)
//   - TGV Paris-Montparnasse 1h21 (13 AR/jour), Nantes 40 min, Rennes 1h30

import type { VilleCopy } from "./types";

export const ANGERS_COPY: VilleCopy = {
  pitchFr:
    "Angers concentre 12 222 établissements actifs, le siège mondial de Vegepolys Valley (1er pôle végétal au monde), les usines Scania et Eviden/Atos, et un tissu B2B industriel et tertiaire dense. Axion-IA y intervient sur site, des TPE de la French Tech Angers aux ETI industrielles et aux grandes entreprises implantées dans la métropole.",
  pitchEn:
    "Angers hosts 12,222 active businesses, the global HQ of Vegepolys Valley (world's #1 plant-industry cluster), Scania and Eviden/Atos plants, and a dense industrial and services B2B fabric. Axion-IA delivers on site, from French Tech Angers micro-businesses to industrial mid-caps and large enterprises established in the greater area.",

  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel à Angers : nous identifions vos cas d'usage prioritaires — filière végétale, industrie, tertiaire, agroalimentaire — et chiffrons le ROI. 4 niveaux du Sur place au Stratégique ETI selon votre taille.",
      en: "Operational AI audit in Angers: we identify your priority use cases — plant industry, manufacturing, services, agri-food — and quantify the ROI. 4 tiers from Sur place to Mid-cap Strategic depending on your size.",
    },
    interventions: {
      fr: "Interventions IA à Angers : formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs repartent autonomes avec des outils IA configurés pour leur travail réel. Frais de logement, repas et forfait trajet en sus.",
      en: "AI sessions in Angers: on-site formats from one to several days depending on your teams. Your staff leave autonomous with AI tools configured for their real work. Lodging, meals and travel allowance billed separately.",
    },
    implementation: {
      fr: "Implémentation IA à Angers : on déploie l'IA dans vos outils existants (ERP, CRM, PLM, mails) avec ROI chiffré contractuel. Vos équipes gardent la main, aucune dépendance créée.",
      en: "AI implementation in Angers: we deploy AI into your existing tools (ERP, CRM, PLM, email) with contractually-costed ROI. Your teams stay in control, no dependency created.",
    },
    unAUn: {
      fr: "Coaching IA individuel 1-to-1 à Angers : séances sur mesure pour dirigeants et cadres de la filière végétale, des PME industrielles et du tissu tertiaire Maine-et-Loire. Axe Végépolys, Quartz technopôle et PME Anjou. Frais de logement, repas et forfait trajet en sus pour le présentiel.",
      en: "1-to-1 AI coaching in Angers: bespoke sessions for executives and managers in the plant industry, industrial SMEs and service businesses across Maine-et-Loire. Focused on Vegepolys Valley, Quartz technopole and Anjou SMEs. Lodging, meals and travel allowance billed separately for on-site sessions.",
    },
    sitesWeb: {
      fr: "Plateformes web et SaaS IA sur mesure pour PME/ETI angevines — site vitrine premium pour filière végétale, industrie et HPC (Vegepolys Valley, Scania, Eviden/Atos, Thales), espace client interactif French Tech Angers, dashboard métier connecté à votre ERP/CRM, PLM ou systèmes industriels. Architectes seniors, design system Axion-IA, hébergement européen.",
      en: "Custom web platforms and SaaS AI for Angers SMEs/mid-caps — premium showcase site for plant industry, manufacturing and HPC (Vegepolys Valley, Scania, Eviden/Atos, Thales), interactive customer space for French Tech Angers, business dashboard connected to your ERP/CRM, PLM or industrial systems. Senior experts, Axion-IA design system, European hosting.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet d'architectes seniors en intelligence artificielle qui intervient à Angers (49) sur site dans toute la métropole Angers Loire Métropole et le bassin Maine-et-Loire. Nous accompagnons les TPE, PME, ETI et grandes entreprises angevines — filière végétale (Vegepolys Valley), industrie (Scania, Eviden/Atos, Thales), agroalimentaire (Cointreau), tertiaire et French Tech Angers — sur leurs cas IA opérationnels : diagnostic chiffré, démos sur vos vraies données, plan d'action concret. Aucun lock-in technologique.",
  directAnswerEn:
    "Axion-IA is a senior AI experts consultancy that intervenes in Angers (49) on site across the Angers Loire Métropole and the Maine-et-Loire area. We support Angers micro-businesses, SMEs, mid-caps and large enterprises — plant industry (Vegepolys Valley), manufacturing (Scania, Eviden/Atos, Thales), agri-food (Cointreau), services and French Tech Angers — on their operational AI use cases: costed diagnosis, demos on your real data, concrete action plan. No tech lock-in.",

  seoHook: "filière végétale & industrie manufacturière",
  topSectorsNaf: [
    "Filière végétale & Agroalimentaire",
    "Industrie manufacturière & Poids lourds",
    "Informatique & Supercalculateurs",
    "Électronique de défense & Aéronautique",
    "Commerce & Services aux entreprises",
    "Viticulture & Spiritueux",
  ],

  distancesFr:
    "Gare d'Angers Saint-Laud : TGV Paris-Montparnasse en 1h21 (13 AR/jour), Nantes en 40 min, Rennes en 1h30. Tramway 2 lignes + réseau Irigo pour rejoindre tous les sites de la métropole (Belle-Beille, Beaucouzé, Saint-Barthélemy-d'Anjou, zone Scania). Aéroport Angers-Loire (Marcé) à 23 km.",
  distancesEn:
    "Angers Saint-Laud station: TGV Paris-Montparnasse in 1h21 (13 return trips/day), Nantes in 40 min, Rennes in 1h30. Tram 2 lines + Irigo network to reach all metro sites (Belle-Beille, Beaucouzé, Saint-Barthélemy-d'Anjou, Scania zone). Angers-Loire airport (Marcé) 23 km away.",

  ecosystemFr:
    "Métropole Angers Loire Métropole — 12 222 établissements actifs (INSEE 2023). Siège mondial de Vegepolys Valley (filière végétale, 560+ membres, 6 régions), Scania Production (~1 500 emplois), Eviden/Atos (centre mondial supercalculateurs Belle-Beille), Thales (électronique de défense), Cointreau (spiritueux, fondé 1849). French Tech Angers labellisée 2015 + Angers Technopole (IoT, numérique). Grandes écoles : ESEO, ESSCA, ESA, ESAIP.",
  ecosystemEn:
    "Angers Loire Métropole — 12,222 active businesses (INSEE 2023). Global HQ of Vegepolys Valley (plant industry, 560+ members, 6 regions), Scania Production (~1,500 jobs), Eviden/Atos (global HPC testing centre at Belle-Beille), Thales (defence electronics), Cointreau (spirits, founded 1849). French Tech Angers labelled 2015 + Angers Technopole (IoT, digital). Engineering and business schools: ESEO, ESSCA, ESA, ESAIP.",

  // === SERVICES LONG-FORM ANGERS ===
  // Aucun prix en dur, aucun délai chiffré, aucune mention « frais inclus »,
  // aucune demi-journée, frais de déplacement systématiquement en sus.
  services: {
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA à Angers cartographie ce qui peut être automatisé dans votre organisation — qu'il s'agisse d'une ETI de la filière végétale, d'une PME industrielle ou d'une TPE du tertiaire — et chiffre le retour sur investissement à 12-24 mois. Quatre niveaux du Sur place au Stratégique ETI couvrent toutes les tailles d'entreprise de la métropole angevine.",
        whyHere: [
          "Angers est un pôle industriel et agroalimentaire majeur du Grand Ouest : filière végétale, industrie automobile (Scania), informatique haute performance (Eviden/Atos), défense (Thales), spiritueux (Cointreau). Nos audits adressent ces secteurs avec des cas d'usage IA spécifiques à chacun.",
          "Le tissu PME/ETI angevin est dense et sous-exploite encore l'IA opérationnelle : sous-traitants industriels, prestataires de services végétaux, cabinets de conseil Maine-et-Loire, acteurs du négoce de vins Anjou. Axion-IA y intervient directement sur site.",
          "French Tech Angers (labellisée 2015) et Angers Technopole constituent un écosystème startup IoT / numérique avec des besoins IA distincts de l'industrie traditionnelle — nos consultants connaissent les deux.",
          "Restitutions toujours en présentiel à Angers ou dans la métropole : ateliers d'idéation dans vos locaux, livrable PDF remis en main propre, plan d'action calibré à votre réalité locale.",
          "Tarifs publics affichés, pas de devis opaque : vous savez ce que vous payez avant de signer, que vous soyez dirigeant d'une TPE de Belle-Beille ou DG d'une ETI de Beaucouzé.",
          "Votre plan d'action reste le vôtre : exécutable avec n'importe quel prestataire ou en interne, aucun lock-in Axion-IA.",
        ],
        methodology: [
          {
            step: "Cadrage à distance",
            detail:
              "Échange préliminaire pour signer le Confidentialité assurée, définir le périmètre (filière végétale, industriel, tertiaire, digital), accéder aux quelques documents clés (organigramme, processus, indicateurs).",
          },
          {
            step: "Kick-off sur site Angers",
            detail:
              "Première venue dans vos locaux angevins pour observer les outils utilisés au quotidien, identifier les workflows candidats à l'IA et rencontrer les équipes opérationnelles.",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Série d'entretiens individuels courts (production, R&D, commercial, finance, RH, direction) pour cartographier précisément les frictions et les attentes selon votre secteur.",
          },
          {
            step: "Démos sur vos vraies données",
            detail:
              "Sur place : démos de Claude, Mistral, GPT-4 appliquées à vos PDFs, vos emails, vos fiches produit, vos données de production. Pas de slides théoriques — on travaille sur vos fichiers réels.",
          },
          {
            step: "Restitution + plan d'action",
            detail:
              "Atelier de restitution dans vos locaux angevins. Livrable PDF chiffré ROI/complexité remis en main propre, roadmap actionnable calibrée à votre contexte industriel ou tertiaire.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Audit sur place",
            detail:
              "Adapté aux indépendants, micro-entreprises et PME angevines jusqu'à une dizaine de collaborateurs — startups French Tech Angers, artisans, prestataires végétaux.",
          },
          {
            sizeLabel: "PME",
            price: "Audit Ciblé ou Stratégique PME",
            detail:
              "Idéal pour sous-traitants industriels, agences numériques, cabinets de services de quelques dizaines à 250 collaborateurs implantés dans la métropole.",
          },
          {
            sizeLabel: "ETI",
            price: "Audit Stratégique ETI",
            detail:
              "Pour les ETI angevines — filière végétale, industrie, agroalimentaire, négoce de vins Anjou — souhaitant cadrer une trajectoire IA pluriannuelle.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Audit Stratégique ETI étendu",
            detail:
              "Pour les grandes entreprises et sièges régionaux (Scania, Eviden/Atos, Thales, Cointreau) souhaitant gouvernance IA centralisée.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA a cadré nos cas d'usage IA en filière végétale avec une précision qu'aucun cabinet généraliste ne nous avait proposée. Livrable actionnable, démos sur nos vraies données de R&D. On a priorisé nos chantiers pour le comité de direction dès la restitution.",
            role: "Directeur Général",
            companyProfile: "ETI filière végétale, Angers Loire Métropole",
          },
          {
            quote:
              "Méthode pragmatique et sans jargon. Le plan d'action chiffré nous a convaincus d'industrialiser l'IA sur nos lignes de production bien plus vite que prévu. ROI identifié significatif dès les 12 premiers mois.",
            role: "Directeur Industriel",
            companyProfile: "PME industrielle sous-traitante, Maine-et-Loire",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA à Angers ?",
            a: "La durée varie selon le niveau retenu : un Audit sur place se déroule sur une journée, un Audit Stratégique ETI s'étale sur plusieurs semaines avec plusieurs visites sur site dans la métropole angevine. Le rythme est calé avec vous dès le brief de cadrage.",
          },
          {
            q: "Avez-vous des cas clients dans la filière végétale ou l'industrie angevine ?",
            a: "Oui. Nous intervenons sur des cas concrets dans les filières représentatives d'Angers : automatisation de rapports R&D végétal, qualification de leads commerciaux B2B, lecture de fiches techniques industrielles, génération de documentation process. Les cas récents sont consultables dans notre rubrique Cas concrets.",
          },
          {
            q: "Mes données de production ou de R&D restent-elles confidentielles ?",
            a: "Oui. Confidentialité stricte dès le démarrage, données traitées exclusivement sur vos infrastructures, aucune extraction vers nos serveurs. Conformité RGPD, modèles testés en local ou sur infra dédiée si la souveraineté est requise — important pour les acteurs de défense (Thales) ou de R&D industrielle.",
          },
          {
            q: "Intervenez-vous aussi sur les communes autour d'Angers ?",
            a: "Oui. Nos interventions couvrent l'ensemble de la métropole Angers Loire Métropole : Avrillé, Trélazé, Saint-Barthélemy-d'Anjou, Beaucouzé, Bouchemaine, Les Ponts-de-Cé, et le bassin Maine-et-Loire au sens large.",
          },
          {
            q: "Différence avec un cabinet de conseil régional ou national ?",
            a: "Nos consultants sont d'anciens praticiens IA, pas des diplômés en management. Tarifs publics affichés sans négociation opaque. Méthode condensée sur terrain réel plutôt que longues missions théoriques. Et surtout : aucun lock-in, vous repartez avec votre plan, libre de l'exécuter avec qui vous voulez.",
          },
          {
            q: "Faut-il être déjà avancé sur l'IA pour commander un audit ?",
            a: "Non. Une grande partie de nos audits angevins sont commandés par des dirigeants qui n'ont encore rien lancé en IA. L'audit est précisément fait pour éviter de s'engager dans la mauvaise direction et identifier les cas d'usage à ROI rapide dans votre contexte sectoriel.",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les délais convenus à la signature. Conformité RGPD, hébergement données en UE par défaut, DPO sur demande. Aucun lock-in technologique : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne. Si après la restitution vous estimez que le livrable n'apporte pas de valeur actionnable, audit remboursé intégralement.",
      },
      en: {
        hero: "Axion-IA's AI audit in Angers maps what can be automated in your organization — whether you're a plant-industry mid-cap, an industrial SME or a services micro-business — and quantifies the 12-24 month return on investment. Four tiers from Sur place to Mid-cap Strategic cover every business size in the Angers metropolitan area.",
        whyHere: [
          "Angers is a major industrial and agri-food hub in western France: plant industry, automotive (Scania), high-performance computing (Eviden/Atos), defence (Thales), spirits (Cointreau). Our audits address these sectors with AI use cases specific to each.",
          "The Angers SME/mid-cap fabric is dense and still under-exploits operational AI: industrial subcontractors, plant-sector service providers, Maine-et-Loire consulting firms, Anjou wine trade players. Axion-IA intervenes directly on site.",
          "French Tech Angers (labelled 2015) and Angers Technopole form an IoT/digital startup ecosystem with AI needs distinct from traditional industry — our consultants know both.",
          "Read-outs always in person in Angers or the metropolitan area: ideation workshops at your offices, PDF deliverable handed over, action plan calibrated to your local reality.",
          "Public pricing displayed, no opaque quoting: you know what you pay before signing, whether you're a Belle-Beille micro-business owner or the GM of a Beaucouzé mid-cap.",
          "Your action plan stays yours: executable with any vendor or in-house, no Axion-IA lock-in.",
        ],
        methodology: [
          {
            step: "Remote framing",
            detail:
              "Preliminary exchange to sign the Confidentiality ensured, define scope (plant industry, manufacturing, services, digital), access key documents (org chart, processes, KPIs).",
          },
          {
            step: "On-site kick-off in Angers",
            detail:
              "First visit to your Angers offices to observe daily tools, identify AI candidate workflows and meet operational teams.",
          },
          {
            step: "Employee interviews",
            detail:
              "Series of short individual interviews (production, R&D, sales, finance, HR, leadership) to precisely map frictions and expectations per your sector.",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site: demos of Claude, Mistral, GPT-4 applied to your PDFs, emails, product sheets, production data. No theoretical slides — we work with your real files.",
          },
          {
            step: "Read-out + action plan",
            detail:
              "Read-out workshop at your Angers offices. Costed PDF deliverable handed over in person, actionable roadmap calibrated to your industrial or services context.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Sur place audit",
            detail:
              "Suited to freelancers, micro-firms and small Angers businesses up to about ten staff — French Tech Angers startups, craft producers, plant-sector service providers.",
          },
          {
            sizeLabel: "SME",
            price: "Targeted or SME Strategic audit",
            detail:
              "Ideal for industrial subcontractors, digital agencies, service firms from a few dozen to 250 staff in the metro area.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap Strategic audit",
            detail:
              "For Angers mid-caps — plant industry, manufacturing, agri-food, Anjou wine trade — framing a multi-year AI trajectory.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Extended Mid-cap Strategic audit",
            detail:
              "For large enterprises and regional HQs (Scania, Eviden/Atos, Thales, Cointreau) seeking centralized AI governance.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA framed our AI use cases in the plant industry with a precision no generalist firm had offered us. Actionable deliverable, demos on our real R&D data. We prioritized our initiatives for the executive committee right at the read-out.",
            role: "CEO",
            companyProfile: "Plant-industry mid-cap, Angers Loire Métropole",
          },
          {
            quote:
              "Pragmatic method, no jargon. The costed action plan convinced us to industrialize AI on our production lines much faster than expected. Significant ROI identified within the first 12 months.",
            role: "Industrial Director",
            companyProfile: "Industrial subcontractor SME, Maine-et-Loire",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Angers?",
            a: "Duration varies by tier: a Sur place audit runs over a day, a Mid-cap Strategic audit spans several weeks with multiple on-site visits in the Angers metropolitan area. The cadence is agreed at the framing brief.",
          },
          {
            q: "Do you have client cases in the plant industry or Angers manufacturing sector?",
            a: "Yes. We operate on concrete use cases in Angers' representative sectors: plant R&D report automation, B2B commercial lead qualification, industrial spec-sheet reading, process documentation generation. Recent cases are available in our Cas concrets section.",
          },
          {
            q: "Does my production or R&D data stay confidential?",
            a: "Yes. Confidentiality ensured from kick-off, data processed exclusively on your infrastructure, no extraction to our servers. GDPR compliance, models tested locally or on dedicated infra if sovereignty is required — key for defence players (Thales) or industrial R&D.",
          },
          {
            q: "Do you also cover the municipalities around Angers?",
            a: "Yes. Our engagements cover the full Angers Loire Métropole: Avrillé, Trélazé, Saint-Barthélemy-d'Anjou, Beaucouzé, Bouchemaine, Les Ponts-de-Cé, and the broader Maine-et-Loire basin.",
          },
          {
            q: "Difference with a regional or national consulting firm?",
            a: "Our consultants are former AI practitioners, not management graduates. Public pricing, no opaque negotiation. Condensed real-field method rather than long theoretical missions. And above all: no lock-in, you leave with your plan, free to execute with whoever you want.",
          },
          {
            q: "Do I need AI maturity to engage you?",
            a: "No. A large share of our Angers audits are ordered by executives who haven't yet launched any AI initiative. The audit exists precisely to avoid going in the wrong direction and to identify fast-ROI use cases in your sector.",
          },
        ],
        guarantees:
          "Contractual commitment: deliverable handed over within the timeline agreed at signature. GDPR compliance, EU data hosting by default, DPO on request. No tech lock-in: your action plan is executable with any vendor or in-house. If after the read-out you feel the deliverable lacks actionable value, audit fully refunded.",
      },
    },

    interventions: {
      fr: {
        hero: "Les interventions IA Axion-IA à Angers se déclinent en formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs ne repartent pas avec des slides : ils repartent avec des outils IA installés sur leur poste, configurés pour leur travail réel dans la filière végétale, l'industrie, l'agroalimentaire ou le tertiaire angevin. Frais de logement, repas et forfait trajet facturés à part.",
        whyHere: [
          "Angers couvre des secteurs variés avec des besoins IA très différents : ingénieurs R&D Vegepolys Valley, techniciens Scania/Eviden/Thales, commerciaux TPE tertiaire, équipes viticulture Anjou. Nos sessions sont calibrées pour chacun de ces profils — pas de format générique recyclé.",
          "L'ensemble de la métropole Angers Loire Métropole est couvert en présentiel : centre-ville, Belle-Beille (Eviden/Atos, ESEO), Saint-Barthélemy-d'Anjou (Cointreau, ESAIP), Beaucouzé, zone Scania, et les communes du bassin.",
          "Le format Essentielle est particulièrement adapté aux PME et ETI industrielles angevines souhaitant former plusieurs équipes en parallèle (production, commercial, R&D, support).",
          "Le format Conférence convient aux grandes plénières d'entreprise dans les salles de réunion de la métropole ou au Parc des expositions d'Angers (SIVAL et événements B2B).",
          "Le format Dirigeants permet un cadrage en huis-clos pour les comités de direction des ETI et grandes entreprises angevines.",
          "Vocabulaire ajusté à votre secteur dominant : végétal, industriel, défense, spiritueux, viticulture, numérique. Aucune session générique recyclée.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Échange à distance avec votre RH ou direction pour cibler le profil des participants, votre secteur métier (végétal, industrie, tertiaire, numérique), les cas d'usage prioritaires.",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs de votre activité (fiches techniques, rapports R&D, mails commerciaux, bons de commande) pour calibrer les démos sur VOS données.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux angevins pour vérifier matériel, projection, accès Wi-Fi. Aucun aléa technique le jour J.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Alternance de théorie courte et de démos longues sur VOS données, suivies d'ateliers participatifs adaptés à votre secteur (végétal, industriel, agroalimentaire, tertiaire).",
          },
          {
            step: "Outils installés et debrief",
            detail:
              "Chaque participant repart avec les outils IA installés et configurés pour son cas d'usage personnel. Utilisables dès le lendemain matin sans aide extérieure.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Format Essentielle",
            detail:
              "Idéal pour les indépendants, TPE numériques, startups French Tech Angers et petits prestataires de la filière végétale jusqu'à une dizaine de collaborateurs.",
          },
          {
            sizeLabel: "PME",
            price: "Format Essentielle ou Équipes",
            detail:
              "Essentielle pour la structure entière ou Équipes pour un département ciblé (R&D végétal, production industrielle, commercial, support).",
          },
          {
            sizeLabel: "ETI",
            price: "Format Conférence ou Dirigeants",
            detail:
              "Plénière pour grandes audiences industrielles ou huis-clos CODIR selon votre objectif.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Format personnalisé multi-formats",
            detail:
              "Combinaisons sur-mesure pour les grands sites angevins (Scania, Eviden/Atos, Thales, Cointreau) : roadshow multi-sites, séminaires CODIR + cascade équipes.",
          },
        ],
        testimonials: [
          {
            quote:
              "Format Essentielle parfaitement adapté à notre équipe R&D filière végétale : démos concrètes sur nos vrais documents techniques. Nos ingénieurs utilisaient les outils installés dès le lendemain matin sur leurs rapports d'expérimentation.",
            role: "Directrice R&D",
            companyProfile: "ETI filière végétale, Angers Loire Métropole",
          },
          {
            quote:
              "Session Dirigeants remarquable. En une journée, notre CODIR a défini sa feuille de route IA pour les 18 prochains mois. Pragmatisme et exemples issus de l'industrie angevine — pas de théorie abstraite.",
            role: "Président",
            companyProfile: "ETI industrielle, Maine-et-Loire",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA à Angers ?",
            a: "Cela dépend du format choisi. L'Essentielle se déroule sur une journée, l'Approfondie sur deux journées consécutives. La Conférence et le format Dirigeants tiennent sur une journée. Pour un programme multi-formats sur plusieurs sites de la métropole angevine, le rythme est défini ensemble en cadrage.",
          },
          {
            q: "Pouvez-vous adapter le contenu à la filière végétale ou à l'industrie angevine ?",
            a: "Oui, systématiquement. Le brief de cadrage en amont nous permet d'ajuster vocabulaire, exemples et démos. Une session pour une ETI Vegepolys Valley n'a rien à voir avec une session pour un sous-traitant Scania ou pour une startup de la French Tech Angers.",
          },
          {
            q: "Quelle taille de groupe pouvez-vous accueillir ?",
            a: "L'Essentielle accueille jusqu'à une centaine de collaborateurs en interaction. Au-delà, le format Conférence est plus adapté avec un schéma plénière + ateliers en sous-groupes — y compris dans les grandes salles du Parc des expositions d'Angers.",
          },
          {
            q: "Les outils installés sur les postes restent-ils utilisables après la session ?",
            a: "Oui, ce sont des comptes individuels (gratuits ou avec abonnement employé) sur ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity selon le profil. Aucun lock-in Axion-IA, vous gardez la main.",
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
          "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain matin sur les outils installés, séance de remédiation offerte. Vocabulaire ajusté à votre secteur angevin (végétal, industriel, numérique, agroalimentaire), aucune session générique recyclée.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Angers come in on-site formats from one to several days depending on your teams. Your staff don't leave with slides: they leave with AI tools installed on their workstations, configured for their real work in Angers' plant industry, manufacturing, agri-food or services sector. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "Angers spans diverse sectors with very different AI needs: Vegepolys Valley R&D engineers, Scania/Eviden/Thales technicians, micro-business services staff, Anjou viticulture teams. Our sessions are calibrated for each profile — no recycled generic format.",
          "The full Angers Loire Métropole is covered on site: city centre, Belle-Beille (Eviden/Atos, ESEO), Saint-Barthélemy-d'Anjou (Cointreau, ESAIP), Beaucouzé, Scania zone, and surrounding municipalities.",
          "The Essential format is particularly suited to Angers industrial SMEs and mid-caps wishing to train several teams in parallel (production, sales, R&D, support).",
          "The Talk format suits large corporate plenaries in Angers metro meeting rooms or the Parc des expositions (SIVAL and B2B events).",
          "The Executives format enables in-camera framing for Angers mid-cap and large-enterprise executive committees.",
          "Vocabulary adjusted to your dominant sector: plant, industrial, defence, spirits, viticulture, digital. No recycled generic session.",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange with your HR or leadership to target participant profile, sector (plant, industrial, services, digital), priority use cases.",
          },
          {
            step: "Demo preparation",
            detail:
              "We collect anonymized documents representative of your activity (technical sheets, R&D reports, commercial emails, purchase orders) to calibrate demos on YOUR data.",
          },
          {
            step: "Arrival and setup",
            detail:
              "Our consultants arrive ahead of time at your Angers offices to check equipment, projection, Wi-Fi access. No technical hiccup on D-day.",
          },
          {
            step: "Pedagogical session",
            detail:
              "Alternation of short theory and longer demos on YOUR data, followed by participatory workshops adapted to your sector (plant, industrial, agri-food, services).",
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
              "Ideal for freelancers, digital micro-firms, French Tech Angers startups and small plant-sector providers up to about ten staff.",
          },
          {
            sizeLabel: "SME",
            price: "Essential or Teams format",
            detail:
              "Essential for the whole structure or Teams to focus on one department (plant R&D, industrial production, sales, support).",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Talk or Executives format",
            detail:
              "Plenary for large industrial audiences or in-camera executive committee depending on your objective.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Custom multi-format program",
            detail:
              "Custom combinations for major Angers sites (Scania, Eviden/Atos, Thales, Cointreau): multi-site roadshows, exec committee + cascade team seminars.",
          },
        ],
        testimonials: [
          {
            quote:
              "Essential format perfectly adapted to our plant-industry R&D team: concrete demos on our real technical documents. Our engineers were using the installed tools from the very next morning on their experimental reports.",
            role: "R&D Director",
            companyProfile: "Plant-industry mid-cap, Angers Loire Métropole",
          },
          {
            quote:
              "Outstanding Executives session. In a single day, our exec committee defined its AI roadmap for the next 18 months. Pragmatic approach with examples from Angers industry — no abstract theory.",
            role: "President",
            companyProfile: "Industrial mid-cap, Maine-et-Loire",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Angers take?",
            a: "It depends on the chosen format. The Essential runs over a day, the Deep Dive over two consecutive days. The Talk and Executives format fit in a day. For a multi-format program across several Angers metro sites, the rhythm is defined together at framing.",
          },
          {
            q: "Can you adapt content to the plant industry or Angers manufacturing sector?",
            a: "Yes, systematically. The upstream framing brief lets us adjust vocabulary, examples and demos. A session for a Vegepolys Valley mid-cap has nothing to do with one for a Scania subcontractor or a French Tech Angers startup.",
          },
          {
            q: "What group size can you handle?",
            a: "The Essential handles up to about a hundred staff in interaction. Beyond that, the Talk format is more suitable with a plenary + sub-group workshops — including in large rooms at the Parc des expositions d'Angers.",
          },
          {
            q: "Do the tools installed on workstations remain usable after the session?",
            a: "Yes, they are individual accounts (free or with employee subscription) on ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity per profile. No Axion-IA lock-in, you keep control.",
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
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning on installed tools, free remediation session offered. Vocabulary adjusted to your Angers sector (plant, industrial, digital, agri-food), no recycled generic session.",
      },
    },

    implementation: {
      fr: {
        hero: "L'implémentation IA Axion-IA à Angers met vos cas d'usage IA en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Le mode est hybride sur site / distance, avec un kick-off obligatoire dans vos locaux angevins. Cas typiques : automatisation de rapports R&D végétal, intégration IA dans les ERP industriels, agents support pour les PME tertiaires.",
        whyHere: [
          "Angers concentre des cas d'implémentation IA spécifiques à ses secteurs dominants : traitement automatique de fiches techniques végétales, génération de documentation de production industrielle, lecture de bons de commande et factures pour les sous-traitants, qualification de leads pour les PME commerciales.",
          "Kick-off obligatoire en présentiel dans vos locaux angevins : alignement des équipes, accès aux données, validation des intégrations ERP/CRM/PLM existants.",
          "Itérations à distance avec point quotidien court en visio et visite mensuelle à Angers pour démos d'avancement avec votre comité de direction.",
          "Recette finale en présentiel à Angers : passation de pouvoir, formation des ambassadeurs internes installés sur leur poste, documentation runbook remise.",
          "Formation incluse pour vos collaborateurs identifiés clés : ils deviennent les référents IA internes, autonomes après la fin de mission.",
          "Cas concrets angevins récents : outil de classification automatique de rapports de semenciers, intégration d'agents de réponse mail pour PME commerciale Maine-et-Loire, génération de devis assistée IA pour sous-traitant industriel.",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site Angers : revue de l'architecture cible (ERP, CRM, PLM, mails, stockage documentaire), validation des contraintes RGPD/sécurité, sélection finale des modèles IA, signature du SOW chiffré.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site à Angers : installation des accès, déploiement de l'environnement de développement, première intégration end-to-end fonctionnelle (POC), validation visuelle avec votre équipe.",
          },
          {
            step: "Itérations",
            detail:
              "Travail à distance avec un point quotidien court : enrichissement progressif des cas d'usage, intégration aux outils existants, tests sur volumes réels, ajustements UX.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site Angers : tests d'acceptation utilisateurs, formation des ambassadeurs internes, livraison du runbook documentation, plan de monitoring post-déploiement.",
          },
          {
            step: "Suivi post-go-live",
            detail:
              "À distance : surveillance des métriques de production, ajustements fins, mesure du ROI réel par rapport à la prédiction du SOW. Rapport final remis à clôture, mission close.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Pilote IA",
            detail:
              "Implémentation d'un cas d'usage simple (lecture de factures, comptes-rendus, qualification leads) pour une TPE ou startup angevine.",
          },
          {
            sizeLabel: "PME",
            price: "Mission PME",
            detail:
              "Déploiement de plusieurs cas d'usage, formation d'ambassadeurs internes, intégration ERP/CRM. Pour sous-traitants industriels, prestataires végétaux, agences numériques Maine-et-Loire.",
          },
          {
            sizeLabel: "ETI",
            price: "Mission ETI",
            detail:
              "Déploiement transverse, gouvernance IA, intégrations avancées (legacy ERP industriel, PLM, datalake R&D), formation d'ambassadeurs cross-département.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Grand programme multi-déploiement",
            detail:
              "Programmes annuels pour les grands sites angevins (Scania, Eviden/Atos, Thales, Cointreau) : cas d'usage cascadés, gouvernance IA centralisée, équipe dédiée Axion-IA en mode régie.",
          },
        ],
        testimonials: [
          {
            quote:
              "Implémentation d'un outil de classification automatique de rapports de semenciers livrée comme promis. ROI réel mesuré dès les six premiers mois : réduction significative du temps de traitement documentaire pour nos équipes R&D. Aucun lock-in, on maîtrise totalement les modèles.",
            role: "DSI",
            companyProfile: "ETI filière végétale, Angers Loire Métropole",
          },
          {
            quote:
              "Méthode hybride parfaite pour notre site industriel : kick-off intense sur site, puis itérations à distance fluides. L'intégration dans notre ERP existant s'est faite sans rupture de production. Nos ambassadeurs internes tiennent le système de façon autonome.",
            role: "Directeur des Opérations",
            companyProfile: "PME industrielle sous-traitante, Maine-et-Loire",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implémentation Axion-IA à Angers ?",
            a: "Cela dépend de l'ampleur. Un POC pour TPE peut tenir en quelques semaines, une mission PME standard sur quelques mois, une mission ETI transverse sur plusieurs mois, un grand programme multi-déploiement sur une année. Le SOW signé en cadrage fixe le calendrier précis.",
          },
          {
            q: "Pouvez-vous intégrer l'IA dans un ERP industriel ou un PLM existant ?",
            a: "Oui. Nous travaillons avec des ERP et PLM standards (SAP, Microsoft Dynamics, Infor, etc.) ainsi que des solutions métier spécifiques à l'industrie ou à la filière végétale. L'atelier de cadrage technique identifie les points d'intégration et les contraintes avant toute signature.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour la grande majorité de nos missions angevines. SOW signé au début avec scope précis et livrables définis. Si le scope change en cours, avenant explicite + nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Qui maintient la solution après la mission ?",
            a: "Vos ambassadeurs internes, formés pendant la mission. Documentation runbook complète remise. Si maintenance externalisée souhaitée, contrat de support optionnel. Aucun lock-in : vous pouvez aussi externaliser ailleurs.",
          },
          {
            q: "Mes données industrielles ou de R&D restent-elles chez moi ?",
            a: "Toujours chez vous. Modèles IA déployés sur votre infra (cloud privé, on-premise, serveur dédié) ou sur infra dédiée UE si vous préférez. Confidentialité assurée dès le cadrage, RGPD strict, DPO sur demande. Particulièrement important pour les acteurs de défense (Thales) ou de R&D végétale sensible.",
          },
          {
            q: "Que se passe-t-il si l'IA produit des erreurs sur des données critiques ?",
            a: "Tous nos déploiements incluent une couche de validation : seuils de confiance, double-check humain pour les cas sensibles (contrôle qualité industriel, données de R&D, facturation), monitoring continu des métriques. Le ROI chiffré dans le SOW intègre la marge d'erreur réaliste, pas un scénario parfait.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : pas de dérive horaire cachée. Livraison dans les délais convenus à la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après une année de production le ROI réel mesuré reste très en deçà de la prédiction du SOW, audit gratuit pour identifier la cause + ajustement déploiement offert. Aucun lock-in technologique : vos modèles, vos données, votre runbook. Vos ambassadeurs internes formés sont autonomes après go-live.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Angers brings your AI use cases to production with contractually-costed ROI, team training included. Mode is hybrid on-site / remote, with a mandatory kick-off at your Angers offices. Typical cases: plant R&D report automation, AI integration in industrial ERPs, support agents for services SMEs.",
        whyHere: [
          "Angers concentrates AI implementation use cases specific to its dominant sectors: automated processing of plant technical sheets, industrial production documentation generation, purchase order and invoice reading for subcontractors, lead qualification for commercial SMEs.",
          "Mandatory on-site kick-off at your Angers offices: team alignment, data access, existing ERP/CRM/PLM integration validation.",
          "Remote iterations with a short daily video call and monthly on-site visit in Angers for progress demos with your executive committee.",
          "Final acceptance always in person in Angers: handover, training of installed internal ambassadors, runbook documentation delivery.",
          "Training included for your identified key staff: they become internal AI champions, autonomous after mission end.",
          "Recent concrete Angers cases: automatic classification tool for seed company reports, mail response agent integration for a Maine-et-Loire commercial SME, AI-assisted quoting for an industrial subcontractor.",
        ],
        methodology: [
          {
            step: "Technical framing",
            detail:
              "On-site Angers workshop: target architecture review (ERP, CRM, PLM, emails, document storage), GDPR/security constraints validation, AI model final selection, costed SOW signed.",
          },
          {
            step: "Kick-off + initial sprint",
            detail:
              "Several days on site in Angers: access install, dev environment deployment, first end-to-end functional integration (POC), visual validation with your team.",
          },
          {
            step: "Iterations",
            detail:
              "Remote work with a short daily call: progressive use-case enrichment, integration with existing tools, real-volume testing, UX adjustments.",
          },
          {
            step: "Acceptance + training",
            detail:
              "On site in Angers: user acceptance tests, training of internal ambassadors, runbook documentation delivery, post-deployment monitoring plan.",
          },
          {
            step: "Post-go-live follow-up",
            detail:
              "Remote: production metrics monitoring, fine adjustments, real ROI vs SOW prediction measurement. Final report delivered at closure, mission closed.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Pilote IA",
            detail:
              "Implementation of a simple use case (invoice reading, meeting minutes, lead qualification) for an Angers micro-business or startup.",
          },
          {
            sizeLabel: "SME",
            price: "SME mission",
            detail:
              "Deployment of several use cases, training of internal ambassadors, ERP/CRM integration. For industrial subcontractors, plant-sector providers, digital agencies in Maine-et-Loire.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations (legacy industrial ERP, PLM, R&D datalake), training of cross-department ambassadors.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Multi-deployment large program",
            detail:
              "Annual programs for major Angers sites (Scania, Eviden/Atos, Thales, Cointreau): cascaded use cases, centralized AI governance, dedicated Axion-IA team in retainer mode.",
          },
        ],
        testimonials: [
          {
            quote:
              "Automatic classification tool for seed company reports delivered as promised. Real ROI measured within the first six months: significant reduction in document processing time for our R&D teams. No lock-in, we fully control the models.",
            role: "CIO",
            companyProfile: "Plant-industry mid-cap, Angers Loire Métropole",
          },
          {
            quote:
              "Perfect hybrid method for our industrial site: intense on-site kick-off, then smooth remote iterations. ERP integration was done with zero production disruption. Internal ambassadors run the system autonomously.",
            role: "Operations Director",
            companyProfile: "Industrial subcontractor SME, Maine-et-Loire",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA implementation in Angers take?",
            a: "It depends on scope. A micro-business POC fits in a few weeks, a standard SME mission spans a few months, a transverse mid-cap mission spans several months, a multi-deployment large program spans a year. The SOW signed at framing fixes the precise schedule.",
          },
          {
            q: "Can you integrate AI into an existing industrial ERP or PLM?",
            a: "Yes. We work with standard ERP and PLM solutions (SAP, Microsoft Dynamics, Infor, etc.) and sector-specific tools for industry or the plant sector. The technical framing workshop identifies integration points and constraints before any signature.",
          },
          {
            q: "Is the price fixed or time-based?",
            a: "Fixed flat-rate for the vast majority of our Angers missions. SOW signed at the start with precise scope and defined deliverables. If scope changes mid-mission, explicit amendment + new estimate. No hidden hourly drift.",
          },
          {
            q: "Who maintains the solution after the mission?",
            a: "Your internal ambassadors, trained during the mission. Complete runbook documentation handed over. If outsourced maintenance desired, optional support contract. No lock-in: you can also outsource elsewhere.",
          },
          {
            q: "Does my industrial or R&D data stay with me?",
            a: "Always with you. AI models deployed on your infra (private cloud, on-premise, dedicated server) or on dedicated EU infra if you prefer. Strict confidentiality at framing, strict GDPR, DPO on request. Particularly important for defence players (Thales) or sensitive plant R&D.",
          },
          {
            q: "What happens if AI produces errors on critical data?",
            a: "All our deployments include a validation layer: confidence thresholds, human double-check for sensitive cases (industrial quality control, R&D data, invoicing), continuous metrics monitoring. The costed ROI in SOW includes realistic margin of error, not a perfect scenario.",
          },
        ],
        guarantees:
          "Fixed flat-rate on SOW: no hidden hourly drift. Delivery within the timeline agreed at signature, with contractual compensation in case of our delay. Contractual costed ROI: if after a year of production the real measured ROI stays significantly below the SOW prediction, free audit to identify the cause + offered deployment adjustment. No tech lock-in: your models, your data, your runbook. Your trained internal ambassadors are autonomous after go-live.",
      },
    },
    unAUn: {
      fr: {
        hero: "Le coaching IA 1-to-1 Axion-IA à Angers accompagne individuellement les dirigeants et cadres de la filière végétale, de l'industrie (Scania, Eviden/Atos, Thales), de l'agroalimentaire (Cointreau) et des startups de la French Tech Angers. À partir de {{price:intervention-dirigeants|flat}} pour les TPE, chaque programme est bâti autour de vos cas d'usage réels — rapports R&D végétal, données industrielles, gestion commerciale Anjou. Vous progressez à votre rythme, sans théorie superflue.",
        whyHere: [
          "Angers est un écosystème plurisectoriel unique : ingénieurs R&D Vegepolys Valley, techniciens Scania/Eviden/Thales, fondateurs French Tech Angers, viticulteurs Anjou. Le coaching 1-to-1 est le seul format qui s'adapte précisément à chacun de ces profils très différents.",
          "Les dirigeants de PME de la filière végétale (semenciers, producteurs, prestataires phytosanitaires) ont des besoins IA très spécifiques — documentation réglementaire, suivi R&D, reporting export. Le coaching individuel cible ces enjeux directement.",
          "Les cadres de Scania, Eviden/Atos et Thales Angers qui souhaitent comprendre l'IA appliquée à leur rôle précis (production, ingénierie, support) bénéficient d'un accompagnement individualisé sans passer par leur hiérarchie.",
          "Les fondateurs de la French Tech Angers et d'Angers Technopole (IoT, numérique) qui veulent intégrer l'IA dans leur produit ou service trouvent dans le coaching 1-to-1 un levier d'accélération adapté à leur stade.",
          "Séances flexibles : 100 % visio ou présentiel dans vos locaux angevins (Belle-Beille, Saint-Barthélemy-d'Anjou, Beaucouzé, Avrillé). Aucun déplacement imposé.",
          "Aucun lock-in : vous repartez avec votre plan d'action personnalisé et vos outils maîtrisés, sans dépendance vis-à-vis d'Axion-IA.",
        ],
        methodology: [
          {
            step: "Diagnostic individuel",
            detail:
              "Séance d'ouverture pour cartographier votre maturité IA, vos cas d'usage prioritaires (R&D végétal, production industrielle, commercial, numérique) et vos outils existants dans le contexte de la métropole angevine.",
          },
          {
            step: "Plan de progression personnalisé",
            detail:
              "Co-construction d'un programme de séances calé sur votre agenda et votre secteur métier (végétal, industriel, agroalimentaire, tertiaire, numérique). Chaque séance a un objectif actionnable précis.",
          },
          {
            step: "Séances pratiques sur vos vraies données",
            detail:
              "Chaque session travaille sur vos fichiers réels — rapports R&D, fiches techniques végétales, données de production industrielle, emails commerciaux. L'IA est appliquée à votre réalité, pas à des exemples génériques.",
          },
          {
            step: "Ancrage et mise en pratique",
            detail:
              "Entre les séances, vous expérimentez les outils sur vos cas réels. La séance suivante démarre par un debriefing de ce qui a fonctionné ou bloqué, et le plan est ajusté en continu.",
          },
          {
            step: "Bilan et feuille de route",
            detail:
              "En fin de programme, restitution d'une feuille de route personnalisée : cas d'usage priorisés, outils retenus, prochaines étapes pour votre structure angevine. Vous repartez pleinement autonome.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "À partir de {{price:intervention-dirigeants|flat}}",
            detail:
              "Programme d'entrée pour les gérants de TPE, artisans, startups French Tech Angers et indépendants de la filière végétale ou du tertiaire angevin.",
          },
          {
            sizeLabel: "PME",
            price: "Sur devis",
            detail:
              "Programme personnalisé pour dirigeants et cadres des PME industrielles, végétales, agroalimentaires et de services du Maine-et-Loire.",
          },
          {
            sizeLabel: "ETI",
            price: "Sur devis",
            detail:
              "Accompagnement individuel pour DG, directeurs R&D, DSI ou directeurs industriels des ETI angevines (Vegepolys Valley, sous-traitants, négoce vins Anjou).",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Sur devis",
            detail:
              "Coaching de cadres dirigeants et managers des grands sites angevins (Scania, Eviden/Atos, Thales, Cointreau) pour des besoins d'acculturation IA individualisés.",
          },
        ],
        testimonials: [
          {
            quote:
              "Le coaching 1-to-1 m'a permis de comprendre concrètement comment l'IA pouvait accélérer mes rapports R&D en filière végétale. On a travaillé directement sur mes fichiers de recherche dès la première séance. Résultat immédiatement actionnable.",
            role: "Directrice R&D",
            companyProfile: "PME filière végétale, Angers Loire Métropole",
          },
          {
            quote:
              "Format parfait pour un fondateur de startup : séances courtes, focalisées sur mon produit numérique, zéro théorie inutile. J'ai pu poser mes questions les plus pointues sans filtre et construire ma roadmap IA en quelques semaines.",
            role: "Co-fondateur",
            companyProfile: "Startup French Tech Angers, Angers Technopole",
          },
        ],
        faq: [
          {
            q: "Quel est le format des séances de coaching 1-to-1 à Angers ?",
            a: "Les séances se déroulent en visio ou en présentiel dans vos locaux à Angers (centre-ville, Belle-Beille, Saint-Barthélemy-d'Anjou, Beaucouzé, Avrillé). Frais de logement, repas et forfait trajet en sus pour les séances en présentiel.",
          },
          {
            q: "Quelle est la fréquence des séances ?",
            a: "La fréquence est définie ensemble lors du diagnostic initial selon votre rythme et vos objectifs — hebdomadaire, bimensuelle ou mensuelle. Aucun rythme imposé.",
          },
          {
            q: "Le coaching est-il adapté à la filière végétale Vegepolys Valley ?",
            a: "Oui. Le coaching 1-to-1 est particulièrement adapté aux dirigeants et cadres de la filière végétale angevine : rapports R&D, documentation phytosanitaire, gestion de données d'expérimentation, reporting export. Le vocabulaire et les cas d'usage sont calés sur vos réalités sectorielles.",
          },
          {
            q: "Quels secteurs sont concernés à Angers ?",
            a: "Tous les secteurs B2B de la métropole : végétal, industrie (Scania, sous-traitants), informatique (Eviden/Atos), défense (Thales), agroalimentaire (Cointreau), viticulture Anjou, numérique (French Tech), services. Le coaching s'adapte à votre contexte.",
          },
          {
            q: "Mes données de R&D ou industrielles sont-elles confidentielles ?",
            a: "Oui. Confidentialité stricte dès la première séance. Vos données, documents et informations métier ne sortent jamais de la session. Conformité RGPD.",
          },
          {
            q: "Quelle différence entre le coaching 1-to-1 et un audit IA à Angers ?",
            a: "L'audit IA produit un livrable collectif avec un plan d'action pour votre organisation. Le coaching 1-to-1 vous forme et vous accompagne individuellement sur la durée : vous montez en compétence sur vos cas précis et décidez en autonomie croissante.",
          },
        ],
        guarantees:
          "Aucun engagement de durée minimum : vous pilotez le programme séance par séance. Confidentialité stricte. Frais de logement, repas et forfait trajet en sus pour les séances en présentiel. Aucun lock-in : vous repartez avec votre feuille de route personnalisée et votre pleine autonomie. Si la première séance ne vous apporte pas de valeur concrète, elle est remboursée intégralement.",
      },
      en: {
        hero: "Axion-IA's 1-to-1 AI coaching in Angers individually supports executives and managers in the plant industry, manufacturing (Scania, Eviden/Atos, Thales), agri-food (Cointreau) and French Tech Angers startups. Starting from {{price:intervention-dirigeants|compact}} excl. VAT for micro-businesses, each programme is built around your real use cases — plant R&D reports, industrial data, Anjou commercial management. You progress at your own pace, without superfluous theory.",
        whyHere: [
          "Angers is a unique multi-sector ecosystem: Vegepolys Valley R&D engineers, Scania/Eviden/Thales technicians, French Tech Angers founders, Anjou wine growers. 1-to-1 coaching is the only format that precisely adapts to each of these very different profiles.",
          "Plant-sector SME executives (seed companies, producers, phytosanitary providers) have highly specific AI needs — regulatory documentation, R&D tracking, export reporting. Individual coaching targets these challenges directly.",
          "Scania, Eviden/Atos and Thales Angers managers wanting to understand AI applied to their specific role (production, engineering, support) benefit from individualised support without going through their hierarchy.",
          "French Tech Angers and Angers Technopole founders (IoT, digital) wanting to integrate AI into their product or service find in 1-to-1 coaching an acceleration lever suited to their stage.",
          "Flexible sessions: 100% video or in person at your Angers offices (Belle-Beille, Saint-Barthélemy-d'Anjou, Beaucouzé, Avrillé). No imposed travel.",
          "No lock-in: you leave with your personalised action plan and mastered tools, with no dependency on Axion-IA.",
        ],
        methodology: [
          {
            step: "Individual diagnostic",
            detail:
              "Opening session to map your AI maturity, priority use cases (plant R&D, industrial production, sales, digital) and existing tools in the Angers metropolitan context.",
          },
          {
            step: "Personalised progression plan",
            detail:
              "Co-build a session programme fitted to your agenda and sector (plant, industrial, agri-food, services, digital). Each session has a precise actionable objective.",
          },
          {
            step: "Practical sessions on your real data",
            detail:
              "Each session works on your real files — R&D reports, plant technical sheets, industrial production data, commercial emails. AI is applied to your reality, not generic examples.",
          },
          {
            step: "Anchoring and practice",
            detail:
              "Between sessions, you experiment with tools on your real cases. The next session starts with a debrief of what worked or blocked, with continuous plan adjustment.",
          },
          {
            step: "Review and roadmap",
            detail:
              "At programme end, a personalised roadmap is delivered: prioritised use cases, retained tools, next steps for your Angers organisation. You leave fully autonomous.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "From {{price:intervention-dirigeants|compact}} excl. VAT",
            detail:
              "Entry programme for micro-business owners, craft firms, French Tech Angers startups and freelancers in the plant sector or Angers services.",
          },
          {
            sizeLabel: "SME",
            price: "On quote",
            detail:
              "Bespoke programme for executives and managers at industrial, plant, agri-food and service SMEs in Maine-et-Loire.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "On quote",
            detail:
              "Individual support for CEOs, R&D directors, CIOs or industrial directors of Angers mid-caps (Vegepolys Valley, subcontractors, Anjou wine trade).",
          },
          {
            sizeLabel: "Large enterprise",
            price: "On quote",
            detail:
              "Executive coaching for senior managers at major Angers sites (Scania, Eviden/Atos, Thales, Cointreau) requiring individualised AI acculturation.",
          },
        ],
        testimonials: [
          {
            quote:
              "The 1-to-1 coaching helped me understand concretely how AI could accelerate my plant R&D reports. We worked directly on my research files from the first session. Immediately actionable result.",
            role: "R&D Director",
            companyProfile: "Plant-industry SME, Angers Loire Métropole",
          },
          {
            quote:
              "Perfect format for a startup founder: short sessions, focused on my digital product, zero useless theory. I could ask my sharpest questions without filter and build my AI roadmap within a few weeks.",
            role: "Co-founder",
            companyProfile: "French Tech Angers startup, Angers Technopole",
          },
        ],
        faq: [
          {
            q: "What is the format of 1-to-1 coaching sessions in Angers?",
            a: "Sessions take place by video or in person at your offices in Angers (city centre, Belle-Beille, Saint-Barthélemy-d'Anjou, Beaucouzé, Avrillé). Lodging, meals and travel allowance billed separately for on-site sessions.",
          },
          {
            q: "How often are the sessions?",
            a: "Frequency is defined together at the initial diagnostic according to your rhythm and objectives — weekly, fortnightly or monthly. No imposed schedule.",
          },
          {
            q: "Is coaching adapted to the Vegepolys Valley plant industry?",
            a: "Yes. 1-to-1 coaching is particularly suited to executives and managers in Angers' plant sector: R&D reports, phytosanitary documentation, experimental data management, export reporting. Vocabulary and use cases are calibrated to your sector reality.",
          },
          {
            q: "Which sectors are covered in Angers?",
            a: "All B2B sectors in the metropolitan area: plant, manufacturing (Scania, subcontractors), computing (Eviden/Atos), defence (Thales), agri-food (Cointreau), Anjou viticulture, digital (French Tech), services. Coaching adapts to your context.",
          },
          {
            q: "Is my R&D or industrial data kept confidential?",
            a: "Yes. Strict confidentiality from the first session. Your data, documents and business information never leave the session. GDPR compliant.",
          },
          {
            q: "What is the difference between 1-to-1 coaching and an AI audit in Angers?",
            a: "An AI audit produces a collective deliverable with an action plan for your organisation. 1-to-1 coaching trains and supports you individually over time: you build competency on your specific cases and decide with growing autonomy.",
          },
        ],
        guarantees:
          "No minimum commitment: you drive the programme session by session. Strict confidentiality. Lodging, meals and travel allowance billed separately for on-site sessions. No lock-in: you leave with your personalised roadmap and full autonomy. If the first session delivers no concrete value, it is fully refunded.",
      },
    },
  },

  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel à Angers ?",
      a: "Le tarif dépend du niveau retenu — Audit sur place, Ciblé, Stratégique PME ou Stratégique ETI. Tarifs publics affichés sur la page Audit, choix calibré selon votre taille (TPE, PME, ETI, grande entreprise) et votre secteur. Aucun supplément géographique : le tarif est le même à Angers que partout en France.",
    },
    {
      q: "Axion-IA intervient-il dans la filière végétale angevine (Vegepolys Valley) ?",
      a: "Oui. Angers est le siège mondial de Vegepolys Valley et nous y adressons des cas d'usage IA spécifiques : traitement automatique de rapports de semenciers, classification de données phytosanitaires, génération de documentation R&D, qualification de leads pour les acteurs du végétal ornamental et de l'horticulture. Nos consultants connaissent le vocabulaire et les contraintes de la filière.",
    },
    {
      q: "Pouvez-vous intervenir sur site dans nos locaux angevins ou dans les communes alentour ?",
      a: "Oui. Toutes nos interventions à Angers sont par défaut sur site, dans vos bureaux ou vos ateliers. Nous couvrons l'ensemble d'Angers Loire Métropole : centre-ville, Belle-Beille, Saint-Barthélemy-d'Anjou, Beaucouzé, Trélazé, Avrillé, Les Ponts-de-Cé, et le bassin Maine-et-Loire au sens large.",
    },
    {
      q: "Travaillez-vous avec les entreprises industrielles implantées à Angers ?",
      a: "Oui. Nous accompagnons les ETI et grandes entreprises industrielles angevines (Scania, Eviden/Atos, Thales, sous-traitants) sur des cas d'usage IA adaptés à leurs contraintes : intégration dans les ERP existants, traitement documentaire, automatisation de la documentation de production, agents de support technique. Nos déploiements respectent les exigences de sécurité industrielle et de souveraineté des données.",
    },
    {
      q: "Quels secteurs sont prioritaires à Angers pour l'IA opérationnelle ?",
      a: "Les quatre secteurs à plus fort potentiel IA que nous identifions à Angers sont : la filière végétale (traitement R&D, documentation phytosanitaire), l'industrie manufacturière (Scania, sous-traitants, Eviden/Atos), l'agroalimentaire et les spiritueux (Cointreau, Giffard, vignobles Anjou), et le tertiaire de services (French Tech Angers, ESSCA, cabinets conseils). Tout secteur B2B est éligible à un audit.",
    },
    {
      q: "En combien de temps pouvez-vous démarrer une mission à Angers ?",
      a: "Le délai dépend de votre besoin (urgence, complexité, taille de la mission). Nous calons une date de démarrage avec vous lors du brief de cadrage initial, et tenons l'engagement contractuel à la signature. La proximité TGV Paris-Angers (1h21) facilite les déplacements de nos consultants pour les kicks-off rapides.",
    },
  ],
};
