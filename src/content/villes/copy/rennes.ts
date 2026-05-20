// Rennes — contenu éditorial gold standard (Sprint City Quality V3 2026-05-20).
//
// Sources économiques : economic-data/rennes.ts (V3 2026-05-18).
// Doctrine Will (corrections 2026-05-08) :
//   - Aucun délai chiffré.
//   - Aucun « frais de déplacement intégrés ».
//   - Durée minimale = 1 journée.
//   - Mention systématique « frais de logement, repas et forfait trajet en sus »
//     sur les formats interventions.
//   - Aucun prix en dur (source de vérité = pricing.ts).
//   - Tailles INSEE : TPE / PME / ETI / Grande entreprise.
//   - ~95 % Axion-IA-centric + ~5 % data unique anti-doorway HCU 2024.
//   - PAS heroSchema, PAS unAUn.
//
// Réalités Rennes utilisées :
//   - Capitale historique du numérique français (héritage CNET / Orange Innovation)
//   - IRISA UMR 6074 (850 pers.) + Inria Rennes (600 pers.) — 1er pôle IA public hors IDF
//   - Rennes Atalante (technopole 270 ha, ~120 entreprises, 10 000 emplois)
//   - French Tech Rennes Saint-Malo — capitale labellisée
//   - Stellantis La Janais + reconversion Pôle d'Excellence Industrielle (Safran)
//   - Canon CRF, Orange Innovation, Crédit Mutuel Arkéa
//   - INSA, CentraleSupélec, Rennes SB, ENSAI, Université de Rennes
//   - Pôles Valorial (agroalimentaire) et Images & Réseaux (numérique / cybersécurité)
//   - Salons SPACE et CFIA (agroalimentaire)
//   - Métro 2 lignes (A + B Ligne B 2022), TGV Paris 1h25

import type { VilleCopy } from "./types";

export const RENNES_COPY: VilleCopy = {
  pitchFr:
    "Rennes concentre 8 400 établissements actifs, le premier pôle public IA de France hors Île-de-France (IRISA + Inria, 1 400 chercheurs), la French Tech Rennes Saint-Malo et une industrie de transformation en plein virage (Stellantis → Safran, agroalimentaire). Axion-IA y intervient sur site, des TPE du centre historique aux ETI high-tech de Rennes Atalante.",
  pitchEn:
    "Rennes hosts 8,400 active businesses, France's top public AI hub outside Île-de-France (IRISA + Inria, 1,400 researchers), the French Tech Rennes Saint-Malo label, and an industry undergoing deep transformation (Stellantis → Safran, agri-food). Axion-IA delivers on site, from Rennes city-centre micro-businesses to Rennes Atalante high-tech mid-caps.",

  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel à Rennes : nous identifions vos cas d'usage réels dans le numérique (Atalante), l'agroalimentaire (Valorial, SPACE) ou l'industrie (Stellantis, Safran) et chiffrons le ROI. 4 niveaux du Flash au Stratégique ETI selon votre taille.",
      en: "Operational AI audit in Rennes: we identify your real use cases across digital (Atalante), agri-food (Valorial, SPACE) or industry (Stellantis, Safran) and quantify the ROI. 4 tiers from Flash to Mid-cap Strategic depending on your size.",
    },
    interventions: {
      fr: "Interventions IA à Rennes : formats sur site d'une à plusieurs journées dans vos locaux (Atalante Beaulieu, ViaSilva, centre-ville, La Janais). Vos collaborateurs repartent autonomes sur les outils IA installés sur leur poste. Frais de logement, repas et forfait trajet en sus.",
      en: "AI sessions in Rennes: on-site formats from one to several days at your offices (Atalante Beaulieu, ViaSilva, city centre, La Janais). Your staff leave autonomous with AI tools installed on their workstations. Lodging, meals and travel allowance billed separately.",
    },
    implementation: {
      fr: "Implémentation IA à Rennes : on déploie l'IA dans vos outils existants (CRM, ERP, plateformes agronomiques, MES industriel) avec ROI chiffré contractuel. Kick-off sur site obligatoire, itérations à distance ensuite. Vos équipes gardent la main.",
      en: "AI implementation in Rennes: we deploy AI into your existing tools (CRM, ERP, agronomy platforms, industrial MES) with contractually-costed ROI. Mandatory on-site kick-off, remote iterations thereafter. Your teams stay in control.",
    },
    unAUn: {
      fr: "Coaching IA individuel à Rennes : accompagnement 1-to-1 ancré dans votre réalité — numérique, agroalimentaire, industrie ou télécoms. À partir de 990 € HT. Frais de logement, repas et forfait trajet en sus.",
      en: "Individual AI coaching in Rennes: 1-to-1 support rooted in your reality — digital, agri-food, industry or telecoms. From €990 excl. VAT. Lodging, meals and travel allowance billed separately.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet IA opérationnel qui intervient à Rennes (35) sur site — technopole Atalante Beaulieu, ZAC ViaSilva, centre historique, zone La Janais. Nous accompagnons les TPE, PME, ETI et grandes entreprises du bassin rennais (numérique, agroalimentaire, industrie, banque) ainsi que les scale-ups de la French Tech Rennes Saint-Malo sur leurs cas IA opérationnels — diagnostic chiffré, démos sur vos vraies données, plan d'action concret. Aucun lock-in technologique, vos équipes gardent la main.",
  directAnswerEn:
    "Axion-IA is an operational AI consultancy that intervenes in Rennes (35) on site — Atalante Beaulieu technopole, ZAC ViaSilva, historic city centre, La Janais zone. We support micro-businesses, SMEs, mid-caps and large enterprises in the Rennes basin (digital, agri-food, industry, banking) along with French Tech Rennes Saint-Malo scale-ups on their operational AI use cases — costed diagnosis, demos on your real data, concrete action plan. No tech lock-in, your teams stay in control.",

  topSectorsNaf: [
    "Numérique & Édition logicielle",
    "Cybersécurité & Télécoms",
    "Agroalimentaire & Bioéconomie",
    "Industrie automobile & Aéronautique",
    "Banque & Assurance mutualiste",
    "Conseil & Services aux entreprises",
    "Recherche & Développement",
  ],

  distancesFr:
    "Gare de Rennes : TGV Paris-Montparnasse en 1h25 (LGV Bretagne-Pays de la Loire). Aéroport Rennes-Saint-Jacques (RNS) à 8 km. Métro ligne A (nord-sud) + ligne B automatique (est-ouest, Cesson-Sévigné ↔ Saint-Jacques) pour rejoindre Atalante Beaulieu, ViaSilva et le centre-ville.",
  distancesEn:
    "Rennes station: TGV Paris-Montparnasse in 1h25 (LGV Bretagne-Pays de la Loire). Rennes-Bretagne Airport (RNS) 8 km away. Metro line A (north-south) + line B automatic (east-west, Cesson-Sévigné ↔ Saint-Jacques) to reach Atalante Beaulieu, ViaSilva and the city centre.",

  ecosystemFr:
    "Rennes est la capitale historique du numérique français (héritage CNET puis Orange Innovation) et le premier pôle public IA hors Île-de-France : IRISA (850 chercheurs, UMR 6074) + Inria Rennes (600 personnes, 28 équipes). Technopole Rennes Atalante (270 ha, 10 000 emplois), French Tech Rennes Saint-Malo labellisée, industries en reconversion (Stellantis → Safran, La Janais) et filière agroalimentaire d'envergure (Valorial, SPACE, CFIA). Canon CRF, Orange Innovation et Crédit Mutuel Arkéa animent le pôle R&D tertiaire.",
  ecosystemEn:
    "Rennes is the historical capital of French digital infrastructure (CNET heritage then Orange Innovation) and France's top public AI hub outside Île-de-France: IRISA (850 researchers, UMR 6074) + Inria Rennes (600 people, 28 teams). Rennes Atalante technopole (270 ha, 10,000 jobs), French Tech Rennes Saint-Malo label, industries in transition (Stellantis → Safran, La Janais) and a strong agri-food sector (Valorial, SPACE, CFIA). Canon CRF, Orange Innovation and Crédit Mutuel Arkéa anchor the R&D and service hub.",

  // === SERVICES LONG-FORM RENNES ===
  // Doctrine : aucun prix en dur, aucun délai chiffré, aucune mention « frais inclus »,
  // frais logement/repas/trajet en sus systématique pour interventions.
  services: {
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA à Rennes cartographie ce qui peut être automatisé dans votre organisation et chiffre le retour sur investissement à 12-24 mois. Quatre niveaux du Flash au Stratégique ETI couvrent toutes les tailles, des TPE du centre-ville aux ETI du numérique installées sur Rennes Atalante Beaulieu. Nos consultants interviennent directement dans vos locaux — centre historique, technopoles, zones La Janais et ViaSilva.",
        whyHere: [
          "Rennes est notre pôle d'ancrage breton : nous y intervenons régulièrement pour les structures du numérique (Atalante), de l'agroalimentaire (Valorial, CFIA), de l'industrie (Stellantis, Safran) et des services tertiaires (banque, conseil, santé).",
          "Tissu économique rennais dense et contrasté : TPE du centre historique, PME en croissance à ViaSilva, ETI numériques à Atalante Beaulieu, sites GE comme Canon CRF et Orange Innovation à Cesson-Sévigné.",
          "Présence forte de l'écosystème French Tech Rennes Saint-Malo : scale-ups deep-tech et IA nées de l'IRISA et de l'Inria, souvent en phase de passage du POC à la production.",
          "Restitutions toujours en présentiel à Rennes : ateliers d'idéation dans vos locaux, lecture du livrable avec votre comité de direction, plan d'action remis en main propre.",
          "Aucun devis opaque : tarifs publics affichés, vous savez exactement ce que vous engagez avant de signer. Même grille tarifaire qu'à Paris ou Lyon.",
          "Vous gardez le contrôle : votre plan d'action est exécutable avec n'importe quel prestataire rennais ou en interne après notre audit.",
        ],
        methodology: [
          {
            step: "Brief de cadrage",
            detail:
              "Un échange à distance pour accéder en toute confidentialité aux quelques documents clés (organigramme, processus, indicateurs). Identification de votre secteur dominant et des cas candidats prioritaires.",
          },
          {
            step: "Kick-off sur site Rennes",
            detail:
              "Première venue dans vos locaux (Atalante, ViaSilva, centre-ville ou La Janais) pour observer les outils utilisés au quotidien et identifier les workflows les plus pertinents pour l'IA.",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Entretiens individuels courts avec vos équipes (commerciaux, finance, production, R&D, support, direction) pour cartographier finement les frictions opérationnelles et les attentes métier.",
          },
          {
            step: "Démos sur vos vraies données",
            detail:
              "Sur place : démos de Claude, Mistral, GPT-4 appliquées à vos PDFs, vos emails, vos données de production ou vos fiches produits. Pas de slides théoriques, toujours sur votre contexte réel.",
          },
          {
            step: "Restitution + plan d'action",
            detail:
              "Atelier de restitution dans vos locaux rennais. Livrable PDF chiffré ROI/complexité remis en main propre. Roadmap actionnable avec priorisation 6-18 mois adaptée à votre secteur.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE (< 10 collab)",
            price: "Audit Flash",
            detail:
              "Pour indépendants, micro-entreprises et cabinets rennais ou bas-bretons du centre-ville jusqu'à quelques collaborateurs.",
          },
          {
            sizeLabel: "PME (10-249 collab)",
            price: "Audit Ciblé ou Stratégique PME",
            detail:
              "Idéal pour PME numériques (Atalante ViaSilva), entreprises agroalimentaires (filière Valorial) ou cabinets de quelques dizaines à 249 collaborateurs.",
          },
          {
            sizeLabel: "ETI (250-4 999 collab)",
            price: "Audit Stratégique ETI",
            detail:
              "Pour ETI du numérique (Atalante Beaulieu), groupes industriels en transition (La Janais), banque mutualiste souhaitant cadrer une trajectoire IA pluriannuelle.",
          },
          {
            sizeLabel: "Grande entreprise (5 000+)",
            price: "Audit Stratégique ETI étendu",
            detail:
              "Pour les sites grands comptes rennais (Canon CRF, Orange Innovation, Stellantis / Safran) souhaitant cadrer une gouvernance IA centralisée multi-sites.",
          },
        ],
        testimonials: [
          {
            quote:
              "L'audit Axion-IA a mis le doigt sur trois cas d'automatisation que nos équipes n'avaient pas identifiés. Le livrable chiffré nous a permis d'arbitrer rapidement et de démarrer l'implémentation avec un plan clair.",
            role: "Directeur général",
            companyProfile: "PME numérique, Rennes Atalante Beaulieu",
          },
          {
            quote:
              "Méthode terrain et pragmatique : démos sur nos vrais documents de production, pas de présentation générique. Le ROI identifié sur nos processus de contrôle qualité agroalimentaire est concret et mesurable.",
            role: "Directrice industrielle",
            companyProfile: "ETI agroalimentaire, bassin rennais",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA à Rennes ?",
            a: "La durée varie selon le niveau : un Audit Flash se déroule sur une journée, un Audit Stratégique ETI s'étale sur plusieurs semaines. Le rythme est calé avec vous dès le brief de cadrage initial.",
          },
          {
            q: "Mes données industrielles ou agroalimentaires restent-elles confidentielles ?",
            a: "Oui. Confidentialité stricte dès le démarrage, données traitées exclusivement sur vos infrastructures, aucune extraction vers nos serveurs. Conformité RGPD stricte. Pour les secteurs avec contraintes réglementaires spécifiques (agroalimentaire, santé), nous adaptons le protocole.",
          },
          {
            q: "Quel ROI puis-je attendre pour une PME numérique à Rennes Atalante ?",
            a: "Sur les audits Stratégique PME, le ROI identifié à 12 mois représente typiquement l'équivalent de plusieurs équivalents temps plein économisés sur les workflows automatisés (génération de documentation technique, qualification de leads, revue de code, rédaction d'offres). Le livrable détaille les chiffres précis pour votre cas.",
          },
          {
            q: "Comment se déroule la restitution finale à Rennes ?",
            a: "Toujours en présentiel dans vos locaux. Atelier de quelques heures avec votre comité de direction ou équipe dirigeante. Vous repartez avec le livrable PDF en main propre et un plan d'action chiffré.",
          },
          {
            q: "Intervenez-vous aussi sur les communes du bassin rennais (Cesson-Sévigné, Bruz, La Janais) ?",
            a: "Oui. Nous couvrons l'ensemble du bassin rennais : Atalante Beaulieu et ViaSilva (Cesson-Sévigné), Ker-Lann (Bruz / ENSAI), Pôle d'Excellence Industrielle La Janais (Chartres-de-Bretagne), Saint-Grégoire et Pacé. Distance parcourue dans les faits de 0 à 15 km du centre-ville.",
          },
          {
            q: "Avez-vous de l'expérience dans l'écosystème French Tech Rennes ?",
            a: "Oui. Nous accompagnons régulièrement des scale-ups issues de l'écosystème IRISA / Inria ainsi que des entreprises accélérées via Le Poool ou Station B. Notre méthode est calibrée pour les structures en phase de passage du POC IA à un déploiement opérationnel.",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les délais convenus à la signature. Conformité RGPD, hébergement données en UE par défaut, DPO sur demande. Aucun lock-in technologique : votre plan d'action est exécutable avec n'importe quel prestataire rennais ou en interne. Si après la restitution vous estimez que le livrable n'apporte pas de valeur actionnable, audit remboursé intégralement.",
      },
      en: {
        hero: "Axion-IA's AI audit in Rennes maps what can be automated at your organization and quantifies the 12-24 month return on investment. Four tiers from Flash to Mid-cap Strategic cover every size, from Rennes city-centre micro-businesses to Rennes Atalante Beaulieu digital mid-caps. Our consultants intervene directly at your premises — historic centre, technopoles, La Janais and ViaSilva zones.",
        whyHere: [
          "Rennes is our Brittany anchor hub: we intervene regularly for digital (Atalante), agri-food (Valorial, CFIA), industrial (Stellantis, Safran) and business services (banking, consulting, health) organizations.",
          "Dense and varied Rennes economic fabric: city-centre micro-businesses, growing SMEs at ViaSilva, digital mid-caps at Atalante Beaulieu, major GE sites such as Canon CRF and Orange Innovation in Cesson-Sévigné.",
          "Strong French Tech Rennes Saint-Malo ecosystem presence: deep-tech and AI scale-ups born from IRISA and Inria, often transitioning from POC to production.",
          "Read-outs always in person in Rennes: ideation workshops at your offices, deliverable walk-through with your leadership, action plan handed over face to face.",
          "No opaque quote game: public pricing, you know exactly what you commit to before signing. Same rate card as Paris or Lyon.",
          "You keep control: your action plan is executable with any Rennes-based vendor or in-house after our audit.",
        ],
        methodology: [
          {
            step: "Framing brief",
            detail:
              "Remote exchange to access under full confidentiality a few key documents (org chart, processes, KPIs). Identification of your dominant sector and priority candidate use cases.",
          },
          {
            step: "On-site kick-off Rennes",
            detail:
              "First visit to your offices (Atalante, ViaSilva, city centre or La Janais) to observe daily tools and identify the most relevant AI candidate workflows.",
          },
          {
            step: "Employee interviews",
            detail:
              "Short individual interviews with your teams (sales, finance, production, R&D, support, leadership) to finely map operational frictions and business expectations.",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site: demos of Claude, Mistral, GPT-4 applied to your PDFs, emails, production data or product sheets. No theoretical slides, always in your real context.",
          },
          {
            step: "Read-out + action plan",
            detail:
              "Read-out workshop at your Rennes offices. Costed PDF deliverable handed over. Actionable roadmap with sector-tailored 6-18 month prioritization.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business (< 10 staff)",
            price: "Flash audit",
            detail:
              "For freelancers, micro-firms and Rennes or Brittany city-centre practices up to a few staff.",
          },
          {
            sizeLabel: "SME (10-249 staff)",
            price: "Targeted or SME Strategic audit",
            detail:
              "Ideal for digital SMEs (Atalante ViaSilva), agri-food companies (Valorial sector) or practices from a few dozen to 249 staff.",
          },
          {
            sizeLabel: "Mid-cap (250-4,999 staff)",
            price: "Mid-cap Strategic audit",
            detail:
              "For digital mid-caps (Atalante Beaulieu), transitioning industrial groups (La Janais), mutual banks framing a multi-year AI trajectory.",
          },
          {
            sizeLabel: "Large enterprise (5,000+)",
            price: "Extended Mid-cap Strategic audit",
            detail:
              "For Rennes large-account sites (Canon CRF, Orange Innovation, Stellantis / Safran) framing centralized multi-site AI governance.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA pinpointed three automation use cases our teams had not identified. The costed deliverable let us arbitrate quickly and start implementation with a clear plan.",
            role: "CEO",
            companyProfile: "Digital SME, Rennes Atalante Beaulieu",
          },
          {
            quote:
              "Field-oriented and pragmatic approach: demos on our real production documents, no generic presentation. The identified ROI on our agri-food quality control processes is concrete and measurable.",
            role: "Industrial Director",
            companyProfile: "Agri-food mid-cap, Rennes basin",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Rennes?",
            a: "Duration varies by tier: a Flash audit runs over a day, a Mid-cap Strategic audit spans several weeks. We agree on the cadence at the initial framing brief.",
          },
          {
            q: "Does my industrial or agri-food data stay confidential?",
            a: "Yes. Confidentiality ensured from kick-off, data processed exclusively on your infrastructure, no extraction to our servers. Strict GDPR compliance. For sectors with specific regulatory constraints (agri-food, health), we adapt the protocol.",
          },
          {
            q: "What ROI can I expect for a digital SME at Rennes Atalante?",
            a: "On SME Strategic audits, identified 12-month ROI typically represents the equivalent of several FTEs saved on automated workflows (technical documentation generation, lead qualification, code review, proposal writing). The deliverable details exact figures for your case.",
          },
          {
            q: "How does the final read-out work in Rennes?",
            a: "Always in person at your offices. Workshop of a few hours with your leadership or executive committee. You leave with the PDF deliverable in hand and a costed action plan.",
          },
          {
            q: "Do you also cover Rennes basin communes (Cesson-Sévigné, Bruz, La Janais)?",
            a: "Yes. We cover the full Rennes basin: Atalante Beaulieu and ViaSilva (Cesson-Sévigné), Ker-Lann (Bruz / ENSAI), Pôle d'Excellence Industrielle La Janais (Chartres-de-Bretagne), Saint-Grégoire and Pacé. In practice 0 to 15 km from the city centre.",
          },
          {
            q: "Do you have experience in the French Tech Rennes ecosystem?",
            a: "Yes. We regularly support scale-ups from the IRISA / Inria ecosystem and companies accelerated through Le Poool or Station B. Our method is calibrated for organizations transitioning from AI POC to operational deployment.",
          },
        ],
        guarantees:
          "Contractual commitment: deliverable handed over within the timeline agreed at signature. GDPR compliance, EU data hosting by default, DPO on request. No tech lock-in: your action plan is executable with any Rennes vendor or in-house. If after the read-out you feel the deliverable lacks actionable value, audit fully refunded.",
      },
    },

    interventions: {
      fr: {
        hero: "Les interventions IA Axion-IA à Rennes se déclinent en formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs ne repartent pas avec des slides : ils repartent avec des outils IA installés sur leur poste, configurés pour leur activité réelle — numérique, agroalimentaire, industrie ou services. Frais de logement, repas et forfait trajet facturés à part.",
        whyHere: [
          "Rennes couvre un tissu diversifié que nous animons régulièrement : ingénieurs Atalante, équipes industrielles La Janais, commerciaux Crédit Mutuel Arkéa, chercheurs Canon CRF, agronomes Valorial.",
          "Tous les sites du bassin rennais sont couverts en présentiel : Atalante Beaulieu et ViaSilva (Cesson-Sévigné), Ker-Lann (Bruz), La Janais (Chartres-de-Bretagne), centre historique et enceinte universitaire.",
          "Le format Essentielle est calibré pour les structures rennaises de quelques personnes à une centaine de collaborateurs, qu'elles soient numériques, industrielles ou tertiaires.",
          "Le format Conférence convient aux plénières d'entreprise (auditorium Canon, salles Couvent des Jacobins, espaces Atalante ou Rennes School of Business).",
          "Le format Dirigeants permet un cadrage en huis-clos pour les comités de direction du bassin rennais.",
          "Vocabulaire ajusté à votre secteur dominant : numérique / IA, agroalimentaire, automobile / industrie décarbonée, télécoms ou banque. Pas de session générique recyclée.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Un échange à distance avec votre RH ou votre direction pour cibler le profil des participants, votre secteur métier rennais, les cas d'usage prioritaires.",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs de votre activité (cahiers des charges, comptes-rendus, fiches produits agroalimentaires, tickets support) pour calibrer les démos sur VOS données.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux pour vérifier matériel, projection, accès Wi-Fi. Pas d'aléa technique le jour J, quel que soit le site du bassin rennais.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Selon le format choisi, alternance de théorie courte et de démos longues sur VOS données, suivies d'ateliers participatifs adaptés à votre réalité métier.",
          },
          {
            step: "Outils installés et debrief",
            detail:
              "Chaque participant repart avec les outils IA installés et configurés pour son cas d'usage personnel. Utilisables le lendemain matin sans aide extérieure.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE (< 10 collab)",
            price: "Format Essentielle",
            detail:
              "Idéal indépendants, cabinets, micro-structures numériques ou agro rennaises jusqu'à une dizaine de collaborateurs.",
          },
          {
            sizeLabel: "PME (10-249 collab)",
            price: "Format Essentielle ou Équipes",
            detail:
              "Essentielle pour le groupe entier ou Équipes pour focaliser sur un département (R&D, commercial, finance, production) dans une PME Atalante ou Valorial.",
          },
          {
            sizeLabel: "ETI (250-4 999 collab)",
            price: "Format Conférence ou Dirigeants",
            detail:
              "Plénière pour grandes audiences (auditoriums Canon CRF, Atalante) ou huis-clos CODIR selon votre objectif.",
          },
          {
            sizeLabel: "Grande entreprise (5 000+)",
            price: "Format personnalisé multi-formats",
            detail:
              "Combinaisons sur-mesure pour les sites grands comptes du bassin (Orange Innovation, Stellantis / Safran) : roadshow multi-sites, séminaires CODIR + cascade équipes.",
          },
        ],
        testimonials: [
          {
            quote:
              "Format Essentielle parfaitement ciblé sur notre secteur : nos développeurs et chefs de projet sont repartis avec leurs outils IA installés et testés sur de vrais fichiers. Productivité mesurée dès la semaine suivante.",
            role: "Directeur des opérations",
            companyProfile: "ETI numérique, Rennes Atalante Beaulieu",
          },
          {
            quote:
              "La session Dirigeants nous a alignés en quelques heures sur notre stratégie IA agroalimentaire. Aucun cabinet généraliste n'avait su cadrer aussi vite avec une connaissance aussi précise de nos contraintes métier.",
            role: "Président-directeur général",
            companyProfile: "ETI agroalimentaire, filière Valorial, bassin rennais",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA à Rennes ?",
            a: "Selon le format : l'Essentielle se déroule sur une journée, l'Approfondie sur deux journées consécutives. La Conférence et le format Dirigeants tiennent sur une journée. Pour un programme multi-formats (CODIR + cascade équipes), le rythme est défini ensemble en cadrage.",
          },
          {
            q: "Quelle taille de groupe pouvez-vous accueillir à Rennes ?",
            a: "L'Essentielle accueille jusqu'à une centaine de collaborateurs en interaction. Au-delà, le format Conférence est plus adapté, avec plénière + ateliers en sous-groupes dans les espaces Atalante ou le Couvent des Jacobins.",
          },
          {
            q: "Les outils IA installés restent-ils utilisables après la session ?",
            a: "Oui, ce sont des comptes individuels (gratuits ou avec abonnement employé) sur ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity selon le profil. Aucun lock-in Axion-IA, vos équipes gardent la main.",
          },
          {
            q: "Pouvez-vous adapter le contenu à notre secteur rennais spécifique ?",
            a: "Oui systématiquement. Nous distinguons les sessions numérique / IA (Atalante, scale-ups), industrie (La Janais, Safran), agroalimentaire (Valorial, SPACE) et banque / assurance (Crédit Mutuel Arkéa). Chaque brief de cadrage en amont produit une session dédiée, jamais générique.",
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
          "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain matin sur les outils installés, séance de remédiation offerte. Vocabulaire ajusté à votre secteur (numérique, agroalimentaire, industrie, banque), aucune session générique recyclée.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Rennes come in on-site formats from one to several days depending on your teams. Your staff don't leave with slides: they leave with AI tools installed on their workstations, configured for their real activity — digital, agri-food, industry or services. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "Rennes covers a diverse fabric we regularly animate: Atalante engineers, La Janais industrial teams, Crédit Mutuel Arkéa commercial staff, Canon CRF researchers, Valorial agronomists.",
          "All Rennes basin sites covered in person: Atalante Beaulieu and ViaSilva (Cesson-Sévigné), Ker-Lann (Bruz), La Janais (Chartres-de-Bretagne), historic centre and university precinct.",
          "The Essential format is calibrated for Rennes organizations from a few people to about a hundred staff, whether digital, industrial or service-oriented.",
          "The Talk format suits corporate plenaries (Canon auditorium, Couvent des Jacobins rooms, Atalante or Rennes School of Business spaces).",
          "The Executives format enables in-camera framing for Rennes basin executive committees.",
          "Vocabulary adjusted to your dominant sector: digital / AI, agri-food, automotive / decarbonized industry, telecom or banking. No recycled generic session.",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange with your HR or leadership to target participant profile, your Rennes sector, priority use cases.",
          },
          {
            step: "Demo preparation",
            detail:
              "We collect a few anonymized documents representative of your activity (specifications, minutes, agri-food product sheets, support tickets) to calibrate demos on YOUR data.",
          },
          {
            step: "Arrival and setup",
            detail:
              "Our consultants arrive ahead of time at your offices to check equipment, projection, Wi-Fi access. No technical hiccup on D-day, whatever the Rennes basin site.",
          },
          {
            step: "Pedagogical session",
            detail:
              "Depending on the chosen format, alternation of short theory and longer demos on YOUR data, followed by participatory workshops adapted to your business reality.",
          },
          {
            step: "Tools installed and debrief",
            detail:
              "Each participant leaves with AI tools installed and configured for their personal use case. Usable next morning without external help.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business (< 10 staff)",
            price: "Essential format",
            detail:
              "Ideal freelancers, firms, digital or agri-food micro-structures in Rennes up to about ten staff.",
          },
          {
            sizeLabel: "SME (10-249 staff)",
            price: "Essential or Teams format",
            detail:
              "Essential for the whole group or Teams to focus on one department (R&D, sales, finance, production) in an Atalante or Valorial SME.",
          },
          {
            sizeLabel: "Mid-cap (250-4,999 staff)",
            price: "Talk or Executives format",
            detail:
              "Plenary for large audiences (Canon CRF or Atalante auditoriums) or in-camera exec committee depending on your objective.",
          },
          {
            sizeLabel: "Large enterprise (5,000+)",
            price: "Custom multi-format program",
            detail:
              "Custom combinations for large-account Rennes basin sites (Orange Innovation, Stellantis / Safran): multi-site roadshows, exec committee + cascade team seminars.",
          },
        ],
        testimonials: [
          {
            quote:
              "Essential format perfectly targeted at our sector: our developers and project managers left with their AI tools installed and tested on real files. Productivity gains measured from the following week.",
            role: "Head of Operations",
            companyProfile: "Digital mid-cap, Rennes Atalante Beaulieu",
          },
          {
            quote:
              "The Executives session aligned us within hours on our agri-food AI strategy. No generalist consultancy had been able to frame this fast with such precise knowledge of our business constraints.",
            role: "CEO",
            companyProfile: "Agri-food mid-cap, Valorial sector, Rennes basin",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Rennes take?",
            a: "By format: the Essential runs over a day, the Deep Dive over two consecutive days. The Talk and Executives format fit in a day. For a multi-format program (exec committee + cascade teams), the cadence is defined together at framing.",
          },
          {
            q: "What group size can you handle in Rennes?",
            a: "The Essential handles up to about a hundred staff in interaction. Beyond that, the Talk format is more suitable with a plenary + sub-group workshops in Atalante spaces or the Couvent des Jacobins.",
          },
          {
            q: "Do the AI tools installed remain usable after the session?",
            a: "Yes, they are individual accounts (free or with employee subscription) on ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity per profile. No Axion-IA lock-in, your teams stay in control.",
          },
          {
            q: "Can you adapt content to our specific Rennes sector?",
            a: "Yes systematically. We distinguish digital / AI sessions (Atalante, scale-ups), industry (La Janais, Safran), agri-food (Valorial, SPACE) and banking / insurance (Crédit Mutuel Arkéa). Each upstream framing brief produces a dedicated session, never generic.",
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
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning on installed tools, free remediation session offered. Vocabulary adjusted to your sector (digital, agri-food, industry, banking), no recycled generic session.",
      },
    },

    implementation: {
      fr: {
        hero: "L'implémentation IA Axion-IA à Rennes met vos cas IA en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Mode hybride sur site / distance avec un kick-off obligatoire dans vos locaux rennais — Atalante, ViaSilva, La Janais ou centre-ville.",
        whyHere: [
          "Rennes concentre des cas d'usage IA variés que nous déployons régulièrement : traitement de données agronomiques (Inrae + Valorial), automatisation documentaire (Canon CRF), qualification de leads (scale-ups French Tech), optimisation production (La Janais).",
          "Le kick-off se passe systématiquement en présentiel dans vos locaux rennais : alignement des équipes, accès aux données, validation des intégrations CRM / ERP / SI industriel.",
          "Itérations à distance ensuite avec un point quotidien court en visio et une visite de suivi pour démos d'avancement avec votre comité de direction.",
          "Recette finale toujours en présentiel à Rennes : passation de pouvoir, formation des équipes installées sur leur poste, documentation runbook remise.",
          "Formation incluse pour vos collaborateurs identifiés clés : ils deviennent les ambassadeurs IA internes, autonomes après la fin de mission.",
          "Cas typiques rennais : scale-ups Atalante (agents support, génération de documentation), industrie La Janais (inspection qualité assistée IA, maintenance prédictive), agroalimentaire (analyse sensorielle, traçabilité), banque Arkéa (qualification prospects, conformité documentaire).",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site Rennes : revue de l'architecture cible (CRM, ERP, MES, SI agro), validation des contraintes RGPD / sécurité industrielle, sélection finale des modèles IA, signature du SOW chiffré.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site Rennes : installation des accès, déploiement de l'environnement de dev, première intégration end-to-end fonctionnelle (POC), validation visuelle avec votre équipe.",
          },
          {
            step: "Itérations",
            detail:
              "Travail à distance avec un point quotidien court : enrichissement progressif des cas, intégration aux outils existants, tests sur volumes réels (données agronomiques, industrielles ou tertiaires), ajustements UX.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site Rennes : tests d'acceptation utilisateurs, formation des ambassadeurs internes, livraison du runbook documentation, plan de monitoring post-go-live.",
          },
          {
            step: "Suivi post-go-live",
            detail:
              "À distance : surveillance des métriques de production, ajustements fins, mesure du ROI réel par rapport à la prédiction du SOW. Rapport final remis à clôture de mission.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE (< 10 collab)",
            price: "POC",
            detail:
              "Implémentation d'un cas d'usage simple (lecture factures, comptes-rendus de réunion, génération de fiches produits) pour une micro-structure rennaise.",
          },
          {
            sizeLabel: "PME (10-249 collab)",
            price: "Mission PME",
            detail:
              "Déploiement de plusieurs cas d'usage, formation d'ambassadeurs internes, intégration CRM / ERP. Pour PME numériques (Atalante), agroalimentaires (Valorial) ou tertiaires de quelques dizaines à 249 collaborateurs.",
          },
          {
            sizeLabel: "ETI (250-4 999 collab)",
            price: "Mission ETI",
            detail:
              "Déploiement transverse, gouvernance IA, intégrations avancées (MES industriel, datalake agro, legacy ERP), formation d'ambassadeurs cross-département.",
          },
          {
            sizeLabel: "Grande entreprise (5 000+)",
            price: "Grand programme multi-déploiement",
            detail:
              "Programmes annuels pour grands comptes rennais (Orange Innovation, Canon CRF, Stellantis / Safran) : cas d'usage cascadés multi-sites, gouvernance IA centralisée, équipe dédiée Axion-IA en mode régie.",
          },
        ],
        testimonials: [
          {
            quote:
              "Implémentation agents support + génération de documentation technique livrée comme promis. ROI réel mesuré : temps de traitement divisé par trois, documentation toujours à jour, équipe autonome. Aucun lock-in, on maîtrise nos modèles.",
            role: "CTO",
            companyProfile: "Scale-up SaaS, French Tech Rennes Saint-Malo",
          },
          {
            quote:
              "Méthode hybride efficace sur notre site industriel : kick-off intense, itérations à distance, recette sur site. Nos opérateurs qualité utilisent l'outil au quotidien. La courbe d'apprentissage a été très courte grâce aux ambassadeurs formés en fin de mission.",
            role: "Responsable industrialisation",
            companyProfile: "ETI industrielle, Pôle La Janais, bassin rennais",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implémentation Axion-IA à Rennes ?",
            a: "Cela dépend de l'ampleur. Un POC pour TPE peut tenir en quelques semaines, une mission PME standard sur quelques mois, une mission ETI transverse sur plusieurs mois, un grand programme multi-déploiement sur une année. Le SOW signé en cadrage fixe le calendrier précis.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour la grande majorité de nos missions rennaises. SOW signé au début avec scope précis et livrables définis. Si le scope change en cours, avenant explicite et nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Qui maintient la solution après la mission ?",
            a: "Vos ambassadeurs internes, formés pendant la mission. Documentation runbook complète remise. Si maintenance externalisée souhaitée, contrat de support optionnel. Aucun lock-in : vous pouvez aussi externaliser auprès d'un partenaire local rennais.",
          },
          {
            q: "Mes données industrielles ou agronomiques restent-elles dans mon SI ?",
            a: "Toujours dans votre périmètre. Modèles IA déployés sur votre infra (cloud privé, on-premise, serveur dédié) ou sur infra dédiée si vous préférez (souveraineté UE). Confidentialité assurée dès le cadrage, RGPD strict, DPO sur demande. Conformité sectorielle (IFS Food, ISO 27001, etc.) prise en compte dès le cadrage.",
          },
          {
            q: "Quels modèles IA utilisez-vous ?",
            a: "Mix selon le cas : open-source (Mistral, Llama) pour la souveraineté ou le coût ; propriétaires (GPT, Claude, Gemini) pour la qualité top ; parfois fine-tuning sur vos données si le volume le justifie. Choix justifié dans le SOW, jamais imposé. Pour les données agronomiques sensibles, priorité aux modèles hébergés en UE.",
          },
          {
            q: "Que se passe-t-il si l'IA produit des erreurs sur des données critiques (qualité industrielle, conformité alimentaire) ?",
            a: "Tous nos déploiements incluent une couche de validation : seuils de confiance, double-check humain pour les cas sensibles (contrôle qualité, conformité réglementaire), monitoring continu des métriques. Le ROI chiffré au SOW intègre la marge d'erreur réaliste, pas un scénario parfait.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : pas de dérive horaire cachée. Livraison dans les délais convenus à la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après une année de production le ROI réel mesuré reste très en deçà de la prédiction du SOW, audit gratuit pour identifier la cause et ajustement déploiement offert. Aucun lock-in technologique : vos modèles, vos données, votre runbook. Vos ambassadeurs internes formés sont autonomes après go-live.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Rennes brings your AI cases to production with contractually-costed ROI, team training included. Hybrid on-site / remote mode with a mandatory kick-off at your Rennes offices — Atalante, ViaSilva, La Janais or city centre.",
        whyHere: [
          "Rennes concentrates varied AI use cases we regularly deploy: agronomic data processing (Inrae + Valorial), document automation (Canon CRF), lead qualification (French Tech scale-ups), production optimization (La Janais).",
          "Kick-off always happens in person at your Rennes offices: team alignment, data access, CRM / ERP / industrial IS integration validation.",
          "Remote iterations afterwards with a short daily on video and a follow-up on-site visit for progress demos with your executive committee.",
          "Final acceptance always in person in Rennes: handover, training of installed teams, runbook documentation delivered.",
          "Training included for your identified key staff: they become internal AI ambassadors, autonomous after mission end.",
          "Typical Rennes cases: Atalante scale-ups (support agents, documentation generation), La Janais industry (AI-assisted quality inspection, predictive maintenance), agri-food (sensory analysis, traceability), Arkéa banking (prospect qualification, document compliance).",
        ],
        methodology: [
          {
            step: "Technical framing",
            detail:
              "On-site Rennes workshop: target architecture review (CRM, ERP, MES, agri IS), GDPR / industrial security constraints validation, AI model final selection, costed SOW signed.",
          },
          {
            step: "Kick-off + initial sprint",
            detail:
              "Several days on site Rennes: access install, dev environment deployment, first end-to-end functional integration (POC), visual validation with your team.",
          },
          {
            step: "Iterations",
            detail:
              "Remote work with a short daily: progressive case enrichment, integration with existing tools, real-volume testing (agronomic, industrial or service data), UX adjustments.",
          },
          {
            step: "Acceptance + training",
            detail:
              "On site Rennes: user acceptance tests, training of internal ambassadors, runbook documentation delivery, post-go-live monitoring plan.",
          },
          {
            step: "Post-go-live follow-up",
            detail:
              "Remote: production metrics monitoring, fine adjustments, real ROI vs SOW prediction measurement. Final report delivered at mission closure.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business (< 10 staff)",
            price: "POC",
            detail:
              "Implementation of a simple use case (invoice reading, meeting minutes, product sheet generation) for a Rennes micro-structure.",
          },
          {
            sizeLabel: "SME (10-249 staff)",
            price: "SME mission",
            detail:
              "Deployment of several use cases, training of internal ambassadors, CRM / ERP integration. For digital (Atalante), agri-food (Valorial) or service SMEs from a few dozen to 249 staff.",
          },
          {
            sizeLabel: "Mid-cap (250-4,999 staff)",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations (industrial MES, agro datalake, legacy ERP), training of cross-department ambassadors.",
          },
          {
            sizeLabel: "Large enterprise (5,000+)",
            price: "Multi-deployment large program",
            detail:
              "Annual programs for Rennes large accounts (Orange Innovation, Canon CRF, Stellantis / Safran): cascaded multi-site use cases, centralized AI governance, dedicated Axion-IA team in retainer mode.",
          },
        ],
        testimonials: [
          {
            quote:
              "Support agents + technical documentation generation delivered as promised. Real ROI measured: processing time cut by three, documentation always up to date, autonomous team. No lock-in, we control our models.",
            role: "CTO",
            companyProfile: "SaaS scale-up, French Tech Rennes Saint-Malo",
          },
          {
            quote:
              "Effective hybrid method at our industrial site: intense kick-off, remote iterations, on-site acceptance. Our quality operators use the tool daily. The learning curve was very short thanks to the ambassadors trained at mission end.",
            role: "Industrialization Manager",
            companyProfile: "Industrial mid-cap, La Janais Pôle, Rennes basin",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA implementation in Rennes take?",
            a: "It depends on scope. A micro-business POC fits in a few weeks, a standard SME mission spans a few months, a transverse mid-cap mission spans several months, a multi-deployment large program spans a year. The SOW signed at framing fixes the precise schedule.",
          },
          {
            q: "Is the price fixed or time-based?",
            a: "Fixed flat-rate for the vast majority of our Rennes missions. SOW signed at the start with precise scope and defined deliverables. If scope changes mid-mission, explicit amendment and new estimate. No hidden hourly drift.",
          },
          {
            q: "Who maintains the solution after the mission?",
            a: "Your internal ambassadors, trained during the mission. Complete runbook documentation handed over. If outsourced maintenance desired, optional support contract. No lock-in: you can also outsource to a local Rennes partner.",
          },
          {
            q: "Does my industrial or agronomic data stay within my IS?",
            a: "Always within your perimeter. AI models deployed on your infra (private cloud, on-premise, dedicated server) or on dedicated infra if you prefer (EU sovereignty). Strict confidentiality at framing, strict GDPR, DPO on request. Sector compliance (IFS Food, ISO 27001, etc.) taken into account from framing.",
          },
          {
            q: "Which AI models do you use?",
            a: "Mix per case: open-source (Mistral, Llama) for sovereignty or cost; proprietary (GPT, Claude, Gemini) for top quality; sometimes fine-tuning on your data if volume justifies. Choice justified in SOW, never imposed. For sensitive agronomic data, priority given to EU-hosted models.",
          },
          {
            q: "What if the AI produces errors on critical data (industrial quality, food compliance)?",
            a: "All our deployments include a validation layer: confidence thresholds, human double-check for sensitive cases (quality control, regulatory compliance), continuous metrics monitoring. The costed ROI in SOW includes realistic margin of error, not a perfect scenario.",
          },
        ],
        guarantees:
          "Fixed flat-rate on SOW: no hidden hourly drift. Delivery within the timeline agreed at signature, with contractual compensation in case of our delay. Contractual costed ROI: if after a year of production the real measured ROI stays significantly below the SOW prediction, free audit to identify the cause and offered deployment adjustment. No tech lock-in: your models, your data, your runbook. Your trained internal ambassadors are autonomous after go-live.",
      },
    },

    unAUn: {
      fr: {
        hero: "Le coaching IA 1-to-1 Axion-IA à Rennes est un accompagnement individuel sur mesure : vous progressez à votre rythme, sur vos propres cas métier, avec un consultant dédié. À partir de 990 € HT. Adapté aux ingénieurs, managers et dirigeants des secteurs numérique, agroalimentaire, industrie et télécoms du bassin rennais. Frais de logement, repas et forfait trajet en sus.",
        whyHere: [
          "Rennes concentre des profils très spécialisés — développeur ou chef de projet à Atalante, directrice qualité chez Valorial, responsable de produit dans une scale-up French Tech — qui ont besoin d'un coaching ancré dans leurs contraintes sectorielles précises, pas d'un cours généraliste.",
          "L'écosystème IRISA/Inria produit des profils deep-tech qui veulent maîtriser les intégrations avancées (fine-tuning, RAG, agents) : le 1-to-1 adapte le niveau de complexité séance par séance.",
          "Les scale-ups French Tech Rennes Saint-Malo ont des roadmaps produit serrées : le coaching calé sur votre backlog réel produit des gains opérationnels immédiats sans perturber votre sprint.",
          "Les industries en reconversion à La Janais (Safran) et dans l'agroalimentaire (Valorial, SPACE) ont des référents IA à former en priorité avant toute cascade équipe : le 1-to-1 est la voie la plus rapide.",
          "Séances sur site dans vos locaux rennais (Atalante, ViaSilva, La Janais, centre-ville) ou à distance selon votre disponibilité — rythme calé à la signature.",
          "Confidentialité sans accord de confidentialité imposé : vos données, vos codes, vos données agronomiques ou industrielles restent dans votre environnement.",
        ],
        methodology: [
          {
            step: "Diagnostic individuel",
            detail:
              "Un entretien de cadrage approfondi pour identifier votre niveau IA actuel, vos cas métier prioritaires (numérique, agro, industrie, télécoms) et l'objectif précis du coaching.",
          },
          {
            step: "Plan de progression personnalisé",
            detail:
              "Construction d'un plan séance par séance calé sur vos outils (Claude, Mistral, GPT-4, outils dev), vos livrables réels et les réalités du bassin rennais.",
          },
          {
            step: "Séances pratiques sur vos vrais cas",
            detail:
              "Chaque séance travaille directement sur vos documents, vos prompts, votre workflow : documentation technique, analyse qualité agroalimentaire, qualification de leads, rapports industriels.",
          },
          {
            step: "Exercices entre séances",
            detail:
              "Micro-missions à réaliser en autonomie entre deux séances pour ancrer les apprentissages dans votre contexte rennais réel et accélérer la progression.",
          },
          {
            step: "Bilan + feuille de route autonomie",
            detail:
              "En fin de coaching, un bilan chiffré de vos gains et une feuille de route pour continuer à progresser sans dépendance envers Axion-IA.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "À partir de 990 € HT",
            detail:
              "Entrée coaching 1-to-1 — indépendant, développeur, consultant ou dirigeant TPE du numérique ou de l'agro rennais.",
          },
          {
            sizeLabel: "PME",
            price: "Sur devis",
            detail:
              "Programme multi-séances pour référents IA ou managers de PME numériques (Atalante), agroalimentaires (Valorial) ou de services du bassin rennais.",
          },
          {
            sizeLabel: "ETI",
            price: "Sur devis",
            detail:
              "Accompagnement cadres dirigeants ETI rennaises (industrie La Janais, Arkéa, Canon CRF) — programme structuré avec bilan intermédiaire.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Sur devis",
            detail:
              "Coaching des profils pilotes d'un grand groupe implanté à Rennes (Orange Innovation, Stellantis/Safran) avant déploiement large.",
          },
        ],
        testimonials: [
          {
            quote:
              "Le coaching 1-to-1 m'a permis de maîtriser les agents IA sur nos cas de documentation technique Atalante en quelques séances. Niveau de complexité ajusté à ma réalité de CTO. Je suis pleinement autonome.",
            role: "CTO",
            companyProfile: "Scale-up SaaS, French Tech Rennes Saint-Malo",
          },
          {
            quote:
              "En tant que directrice qualité dans l'agroalimentaire, mes cas étaient très spécifiques (IFS Food, traçabilité). Le coaching 1-to-1 a travaillé sur mes vrais documents dès la première séance. Résultat immédiat et mesurable.",
            role: "Directrice qualité",
            companyProfile: "ETI agroalimentaire, filière Valorial, bassin rennais",
          },
        ],
        faq: [
          {
            q: "En quoi le coaching 1-to-1 diffère-t-il d'une intervention collective à Rennes ?",
            a: "Le format collectif forme tout un groupe sur les mêmes cas. Le 1-to-1 travaille exclusivement sur VOS cas, votre vitesse, vos contraintes rennaises (deep-tech, agro, industrie, banque). Gains opérationnels mesurables dès la première séance.",
          },
          {
            q: "Combien de séances faut-il pour être autonome sur l'IA à Rennes ?",
            a: "Cela dépend de votre niveau de départ et de vos objectifs. Un développeur Atalante atteint une autonomie avancée en quelques séances. Un manager ETI cherchant à maîtriser des workflows industriels complexes aura un programme plus étendu. Le plan est cadré à la première séance.",
          },
          {
            q: "Le coaching peut-il se tenir dans mes locaux rennais ?",
            a: "Oui. Séances sur site dans vos locaux (Atalante, ViaSilva, La Janais, centre-ville) ou en visio selon votre disponibilité. Frais de logement, repas et forfait trajet en sus pour les séances sur site.",
          },
          {
            q: "Mes données industrielles ou agronomiques restent-elles confidentielles ?",
            a: "Oui. Confidentialité stricte dès le démarrage : vos données, vos prompts, vos cas restent dans votre environnement. Aucune extraction vers nos serveurs. Conformité RGPD stricte.",
          },
          {
            q: "Puis-je commencer sans aucune base IA ?",
            a: "Oui. Le diagnostic initial évalue votre niveau réel et calibre le plan en conséquence. Beaucoup de profils rennais débutent sans avoir jamais utilisé Claude ou GPT de façon professionnelle.",
          },
          {
            q: "Y a-t-il un engagement minimum de durée ou de nombre de séances ?",
            a: "Non. Pas de lock-in, pas de contrat d'abonnement. Vous commencez par la première séance à 990 € HT. La suite se décide à l'issue de chaque séance selon votre progression.",
          },
        ],
        guarantees:
          "Pas de lock-in : aucun engagement de durée imposé. Confidentialité stricte sans accord de confidentialité requis — vos données restent dans votre environnement. Conformité RGPD et secteur (IFS Food, ISO 27001 sur demande). Frais de logement, repas et forfait trajet en sus pour les séances sur site. Si à l'issue de la première séance vous estimez que le coaching ne correspond pas à vos attentes, première séance remboursée.",
      },
      en: {
        hero: "Axion-IA's 1-to-1 AI coaching in Rennes is an individual, bespoke engagement: you progress at your own pace, on your own business cases, with a dedicated consultant. From €990 excl. VAT. Suited to engineers, managers and executives in digital, agri-food, industry and telecoms across the Rennes basin. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "Rennes brings together highly specialised profiles — a developer or project manager at Atalante, a quality director at Valorial, a product manager at a French Tech scale-up — who need coaching rooted in their precise sector constraints, not a generic course.",
          "The IRISA/Inria ecosystem produces deep-tech profiles seeking to master advanced integrations (fine-tuning, RAG, agents): 1-to-1 adapts the complexity level session by session.",
          "French Tech Rennes Saint-Malo scale-ups have tight product roadmaps: coaching aligned with your real backlog produces immediate operational gains without disrupting your sprint.",
          "Industries transitioning at La Janais (Safran) and in agri-food (Valorial, SPACE) have AI champions to train before any team cascade: 1-to-1 is the fastest route.",
          "Sessions on site at your Rennes offices (Atalante, ViaSilva, La Janais, city centre) or remote depending on availability — cadence agreed at sign-up.",
          "Confidentiality without imposed accord de confidentialité: your data, code, agronomic or industrial data stays in your environment.",
        ],
        methodology: [
          {
            step: "Individual diagnostic",
            detail:
              "An in-depth framing interview to identify your AI level, priority business cases (digital, agri-food, industry, telecoms) and the precise coaching objective.",
          },
          {
            step: "Personalized progression plan",
            detail:
              "Building a session-by-session plan aligned with your tools (Claude, Mistral, GPT-4, dev tools), your real deliverables and the realities of the Rennes basin.",
          },
          {
            step: "Practical sessions on your real cases",
            detail:
              "Each session works directly on your documents, prompts, workflow: technical documentation, agri-food quality analysis, lead qualification, industrial reports.",
          },
          {
            step: "Between-session exercises",
            detail:
              "Micro-missions to complete autonomously between sessions to embed learnings in your real Rennes context and accelerate progress.",
          },
          {
            step: "Debrief + autonomy roadmap",
            detail:
              "At coaching end, a costed gains summary and an autonomy roadmap to keep progressing without dependence on Axion-IA.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "From €990 excl. VAT",
            detail:
              "Entry-level 1-to-1 coaching — freelancer, developer, consultant or Rennes digital or agri-food micro-business executive.",
          },
          {
            sizeLabel: "SME",
            price: "On quote",
            detail:
              "Multi-session programme for AI champions or managers of Rennes digital (Atalante), agri-food (Valorial) or service SMEs.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "On quote",
            detail:
              "Executive coaching for Rennes mid-cap managers (La Janais industry, Arkéa, Canon CRF) — structured programme with interim review.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "On quote",
            detail:
              "Coaching of pilot profiles at a major Rennes-based group (Orange Innovation, Stellantis/Safran) before broad rollout.",
          },
        ],
        testimonials: [
          {
            quote:
              "The 1-to-1 coaching let me master AI agents on our Atalante technical documentation cases within a few sessions. Complexity level adjusted to my CTO reality. Fully autonomous.",
            role: "CTO",
            companyProfile: "SaaS scale-up, French Tech Rennes Saint-Malo",
          },
          {
            quote:
              "As quality director in agri-food, my cases were very specific (IFS Food, traceability). The 1-to-1 coaching worked on my real documents from the first session. Immediate and measurable result.",
            role: "Quality Director",
            companyProfile: "Agri-food mid-cap, Valorial sector, Rennes basin",
          },
        ],
        faq: [
          {
            q: "How does 1-to-1 coaching differ from a group session in Rennes?",
            a: "Group format trains a whole team on the same cases. 1-to-1 works exclusively on YOUR cases, your pace, your Rennes constraints (deep-tech, agri-food, industry, banking). Measurable operational gains from the first session.",
          },
          {
            q: "How many sessions are needed to become AI-autonomous in Rennes?",
            a: "It depends on your starting level and objectives. An Atalante developer reaches advanced autonomy in a few sessions. A mid-cap manager seeking to master complex industrial workflows will have a longer programme. The plan is framed in the first session.",
          },
          {
            q: "Can coaching sessions be held at my Rennes premises?",
            a: "Yes. On-site sessions at your offices (Atalante, ViaSilva, La Janais, city centre) or via video depending on availability. Lodging, meals and travel allowance billed separately for on-site sessions.",
          },
          {
            q: "Does my industrial or agronomic data stay confidential?",
            a: "Yes. Strict confidentiality from day one: your data, prompts and cases stay in your environment. No extraction to our servers. Strict GDPR compliance.",
          },
          {
            q: "Can I start with no AI background?",
            a: "Yes. The initial diagnostic assesses your real level and calibrates the plan accordingly. Many Rennes profiles start without ever having used Claude or GPT professionally.",
          },
          {
            q: "Is there a minimum duration or session commitment?",
            a: "No. No lock-in, no subscription contract. You start with the first session at €990 excl. VAT. Continuation is decided after each session based on your progress.",
          },
        ],
        guarantees:
          "No lock-in: no imposed duration commitment. Strict confidentiality without required accord de confidentialité — your data stays in your environment. GDPR compliance and sector (IFS Food, ISO 27001 on request). Lodging, meals and travel allowance billed separately for on-site sessions. If after the first session you feel the coaching does not meet your expectations, first session fully refunded.",
      },
    },
  },

  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel à Rennes ?",
      a: "Le tarif dépend du niveau retenu — Audit Flash, Ciblé, Stratégique PME ou Stratégique ETI. Tarifs publics affichés sur la page Audit, calibrés selon votre taille (TPE, PME, ETI, grande entreprise) et votre périmètre. Aucun supplément géographique : le tarif est le même à Rennes qu'à Paris ou Lyon.",
    },
    {
      q: "Avez-vous de l'expérience dans l'écosystème numérique de Rennes Atalante ?",
      a: "Oui. Nous accompagnons régulièrement des entreprises et scale-ups implantées sur Atalante Beaulieu, ViaSilva et Ker-Lann, notamment des structures issues de l'écosystème IRISA / Inria et de la French Tech Rennes Saint-Malo. Notre méthode est calibrée pour les structures qui passent du POC IA au déploiement opérationnel.",
    },
    {
      q: "Pouvez-vous intervenir sur le secteur agroalimentaire breton à Rennes ?",
      a: "Oui. Nous connaissons les spécificités du secteur : données de traçabilité, contrôle qualité, conformité IFS Food, cycles SPACE et CFIA. Nos démos s'appuient sur des données du secteur IAA (analyse sensorielle, étiquetage, fiches techniques). Valorial et la filière agroalimentaire bretonne font partie de nos secteurs prioritaires.",
    },
    {
      q: "Intervenez-vous aussi sur les sites industriels du bassin rennais (La Janais, Safran) ?",
      a: "Oui. Nous couvrons les sites industriels du bassin : Pôle d'Excellence Industrielle La Janais (Chartres-de-Bretagne), Bruz / Ker-Lann et les zones tertiaires périphériques. Nos consultants maîtrisent les contraintes des SI industriels (MES, SCADA) et les exigences de conformité sectorielle (aéronautique, automobile).",
    },
    {
      q: "Pouvez-vous démarrer rapidement une mission à Rennes ?",
      a: "Nous calons une date de démarrage avec vous lors du brief de cadrage initial. Le délai dépend de votre besoin (urgence, complexité, taille de la mission). Une fois l'engagement signé, nous respectons le calendrier contractuel.",
    },
    {
      q: "Travaillez-vous avec les grands groupes implantés à Rennes (Orange Innovation, Canon CRF, Crédit Mutuel Arkéa) ?",
      a: "Oui. Nous accompagnons des entités de grands groupes implantés dans le bassin rennais sur leurs cas d'usage IA internes : centres R&D (Canon CRF, Orange Innovation Cesson-Sévigné), fonctions support et commerciales (Crédit Mutuel Arkéa). Le format retenu (Audit, Intervention ou Implémentation) est cadré selon les objectifs spécifiques de chaque entité.",
    },
  ],
};
