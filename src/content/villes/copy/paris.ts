// Paris — contenu éditorial gold standard (Sprint 14.10.4 refonte 2026-05-08).
//
// Corrections Will 2026-05-08 :
//   - Aucun « basé en UE » (mention supprimée partout).
//   - Aucun délai concret (« 5-10 jours », « 7 jours », etc. supprimés).
//   - Aucune demi-journée : durée minimale = 1 journée. Formats vont
//     de 1 journée à plusieurs semaines selon le besoin.
//   - Aucun prix hardcodé : tous les tarifs viennent de `src/content/pricing.ts`
//     (source de vérité unique, futur admin Sprint 20).
//   - Pas de mention de métier-type (plombier, comptable, etc.) — on parle
//     systématiquement en tailles d'entreprise INSEE (PME/ETI/GE).
//   - Blocs longs cassés en bullets, vocabulaire accessible non technique.
//
// Doctrine page mère + pages dédiées :
//   - ~95 % Axion-IA-centric (commercial, ce qu'on fait, pourquoi nous)
//   - ~5 % data INSEE bouclier anti-doorway HCU 2024 (population, secteurs,
//     communes limitrophes, code INSEE)
//   - Visiteur lit Axion-IA, Google voit data unique → page indexable sans
//     pénalité doorway.

import type { VilleCopy } from "./types";

export const PARIS_COPY: VilleCopy = {
  pitchFr:
    "Paris concentre 215 000 entreprises actives toutes tailles confondues, l'écosystème IA français (Mistral, Hugging Face, Station F) et le tissu B2B le plus dense du pays. Axion-IA y intervient sur site, des indépendants parisiens aux directions IA des grandes entreprises de La Défense.",
  pitchEn:
    "Paris hosts 215,000 active businesses of the full range, the French AI ecosystem (Mistral, Hugging Face, Station F) and the densest B2B fabric in the country. Axion-IA delivers on site, from independent Paris professionals to large-enterprise AI leadership at La Défense.",

  seoHook: "finance, conseil & deeptech",

  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel à Paris : nous identifions ce qui peut être automatisé chez vous et chiffrons le ROI. 4 niveaux du Sur place au Stratégique ETI selon votre taille et votre ambition.",
      en: "Operational AI audit in Paris: we identify what can be automated at your company and quantify the ROI. 4 tiers from Sur place to Mid-cap Strategic depending on your size and ambition.",
    },
    interventions: {
      fr: "Interventions IA à Paris : formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs repartent autonomes sur des outils IA installés sur leur poste, configurés pour leur métier — finance, conseil, tech, médias, luxe ou tourisme premium.",
      en: "AI sessions in Paris: on-site formats from one to several days depending on your teams. Your staff leave autonomous with AI tools installed on their workstations.",
    },
    implementation: {
      fr: "Implémentation IA à Paris : on déploie l'IA dans vos outils existants (CRM, ERP, mails) avec ROI chiffré contractuel. Vos équipes gardent la main, on ne crée pas de dépendance.",
      en: "AI implementation in Paris: we deploy AI into your existing tools (CRM, ERP, email) with contractually-costed ROI. Your teams stay in control, we create no dependency.",
    },
    unAUn: {
      fr: "Accompagnement IA individuel à Paris : sessions 1-to-1 sur site dans votre bureau parisien ou en visio. Dirigeants, managers et entrepreneurs des 20 arrondissements et La Défense qui veulent monter en compétence IA à leur rythme, sur leurs propres cas business — finance, conseil, scale-up tech ou maison de luxe.",
      en: "Individual AI coaching in Paris: 1-to-1 sessions on site at your Paris office or by video. Executives, managers and entrepreneurs across all 20 arrondissements and La Défense who want to build AI competence at their own pace, on their own business cases.",
    },
    sitesWeb: {
      fr: "Sites web et plateformes SaaS IA sur mesure à Paris : conception et déploiement de plateformes IA-native (chatbot RAG, search sémantique, agents conversationnels) pour PME tech parisiennes, scale-ups du Sentier et Station F, ou refonte IA pour ETI franciliennes. Code custom, hébergement Europe RGPD, zéro lock-in éditeur.",
      en: "Sites web et plateformes SaaS IA sur mesure à Paris : conception et déploiement de plateformes IA-native (chatbot RAG, search sémantique, agents conversationnels) pour PME tech parisiennes, scale-ups du Sentier et Station F, ou refonte IA pour ETI franciliennes. Code custom, hébergement Europe RGPD, zéro lock-in éditeur.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet d'architectes seniors en intelligence artificielle qui intervient à Paris (75) sur site dans les 20 arrondissements et la première couronne. Nous accompagnons les PME, ETI et grands groupes parisiens (La Défense, 8e, 16e) ainsi que les startups du Sentier et de Station F sur leurs cas IA opérationnels — diagnostic chiffré, démos sur vos vraies données, plan d'action concret. Vos équipes restent maîtres de la stack après notre mission — aucun verrou technologique ni dépendance contractuelle.",
  directAnswerEn:
    "Axion-IA is a senior AI experts consultancy that intervenes in Paris (75) on site across all 20 arrondissements and the inner suburbs. We support Paris micro-businesses, SMEs, mid-caps and large enterprises (La Défense, 8th, 16th) along with Sentier and Station F startups on their operational AI use cases — costed diagnosis, demos on your real data, concrete action plan. No tech lock-in, your teams stay in control.",

  topSectorsNaf: [
    "Banque & Finance",
    "Conseil & Services aux entreprises",
    "Tech & Édition logicielle",
    "Édition, Médias & Communication",
    "Mode & Luxe",
    "Tourisme & Hôtellerie premium",
  ],

  // Distance / accès — purement informatif, pas de mention « frais inclus ».
  distancesFr:
    "Gares Montparnasse, du Nord, de Lyon et Saint-Lazare au cœur de Paris. Roissy-Charles-de-Gaulle, Orly. Métro 14 lignes + RER A/B/C/D/E pour rejoindre vos bureaux dans tous les arrondissements et la première couronne.",
  distancesEn:
    "Montparnasse, Gare du Nord, Gare de Lyon and Saint-Lazare stations in central Paris. Roissy-Charles-de-Gaulle, Orly. Métro 14 lines + RER A/B/C/D/E to reach your offices across every arrondissement and the inner suburbs.",

  ecosystemFr:
    "Tissu B2B le plus dense de France toutes tailles confondues — micro-entreprises et indépendants (215 000 actives intra-muros), PME et ETI (cabinets d'expertise, scale-ups, conseil), sièges grandes entreprises (La Défense, 8e, 16e), pôle deep-tech (Station F, Quai d'Innovation, écoles d'ingénieurs). L'écosystème IA français y est concentré : Mistral AI, Hugging Face, Owkin, Photoroom, Dust.",
  ecosystemEn:
    "Densest B2B fabric in France across every company size — micro-businesses and independents (215,000 active within Paris), SMEs and mid-caps (expertise firms, scale-ups, consulting), large-enterprise HQs (La Défense, 8th, 16th districts), deep-tech hub (Station F, Quai d'Innovation, engineering schools). The French AI ecosystem clusters here: Mistral AI, Hugging Face, Owkin, Photoroom, Dust.",

  // === SERVICES LONG-FORM PARIS — refonte 14.10.2 (aérée, accessible) ===
  // Aucun prix en dur (vient de pricing.ts via le rendu page),
  // aucun délai chiffré, aucune mention « frais inclus », aucun « basé en UE ».
  services: {
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA cartographie ce qui peut être automatisé chez vous et chiffre le retour sur investissement à 12-24 mois. Quatre niveaux du Sur place au Stratégique ETI couvrent toute l'échelle, des PME indépendantes parisiennes aux sièges des grandes entreprises de La Défense.",
        whyHere: [
          "Paris est notre premier pôle d'intervention : la majorité de nos audits y sont déclenchés.",
          "Tissu B2B parisien sur-représenté chez nos clients : cabinets d'expertise comptable, family offices, asset managers, conseil 8e/9e/16e, scale-ups Sentier-République, maisons de mode Marais.",
          "Nos consultants sont basés à Paris et se déplacent dans les 20 arrondissements ainsi que dans la première couronne.",
          "Restitutions toujours en présentiel : ateliers d'idéation, lecture du livrable avec votre comité de direction, plan d'attaque transmis en main propre.",
          "Aucun jeu de devis opaque : tarifs publics, vous savez exactement ce que vous payez avant de signer.",
          "Vous gardez le contrôle : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne après notre audit.",
        ],
        methodology: [
          {
            step: "Préparation",
            detail:
              "Un brief de cadrage à distance pour accéder en toute confidentialité aux quelques documents clés (organigramme, processus, indicateurs).",
          },
          {
            step: "Kick-off sur site",
            detail:
              "Première venue à Paris dans vos locaux pour observer les outils utilisés au quotidien et identifier les workflows candidats à l'IA.",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Une série d'entretiens individuels courts (commerciaux, finance, RH, opérations, support, direction) pour cartographier finement frictions et attentes.",
          },
          {
            step: "Démos sur vos vraies données",
            detail:
              "Sur place : démos de Claude, Mistral, GPT-4 appliquées à vos PDFs, vos emails, vos factures. Pas de slides théoriques.",
          },
          {
            step: "Restitution + plan d'action",
            detail:
              "Atelier de restitution dans vos locaux. Livrable PDF chiffré ROI/complexité remis en main propre, roadmap actionnable de 6-18 mois.",
          },
        ],
        // Pricing référence pricing.ts via la page de rendu — ici uniquement
        // les libellés contextuels, sans valeurs chiffrées en dur.
        pricing: [
          {
            sizeLabel: "PME",
            price: "Audit Ciblé ou Stratégique PME",
            detail:
              "Idéal pour cabinets d'expertise, scale-ups Sentier, agences digital de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Audit Stratégique ETI",
            detail:
              "Pour les ETI conseil 8e/9e, banques, maisons de mode établies souhaitant cadrer une trajectoire IA pluriannuelle.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Audit Stratégique ETI étendu",
            detail:
              "Pour les sièges grands-comptes La Défense souhaitant cadrer une gouvernance IA centralisée.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA nous a livré ce que les Big Four nous chiffraient en plusieurs semaines. Le rapport est chiffré, actionnable, sans jargon. On a démarré l'implémentation très rapidement.",
            role: "DG",
            companyProfile: "Cabinet d'expertise comptable, 9e arrondissement",
          },
          {
            quote:
              "Méthode pragmatique, démos sur nos vraies données plutôt que des slides théoriques. Le livrable a permis de prioriser nos chantiers IA pour le comité de direction.",
            role: "Directrice de la transformation",
            companyProfile: "ETI conseil, 8e arrondissement",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA à Paris ?",
            a: "La durée varie selon le niveau retenu : un Audit sur place se déroule sur une journée, un Audit Stratégique ETI s'étale sur plusieurs semaines. Nous calons avec vous le rythme dès le brief de cadrage.",
          },
          {
            q: "Quel ROI puis-je attendre d'un audit chez une PME parisienne ?",
            a: "Sur les audits Stratégique PME, le ROI identifié à 12 mois représente l'équivalent de plusieurs équivalents temps plein gagnés sur les workflows automatisés (lecture factures, comptes-rendus, qualification leads). Le livrable détaille les chiffres précis pour votre cas.",
          },
          {
            q: "Mes données restent-elles confidentielles pendant l'audit ?",
            a: "Oui. Confidentialité stricte dès le démarrage, données traitées exclusivement sur vos infrastructures, pas d'extraction vers nos serveurs. Conformité RGPD, modèles testés en local ou sur infra dédiée chez vous si la souveraineté est requise.",
          },
          {
            q: "Comment se déroule la restitution finale ?",
            a: "Toujours en présentiel à Paris. Atelier de quelques heures dans vos locaux avec votre comité de direction ou équipe dirigeante. Vous repartez avec le livrable PDF en main propre.",
          },
          {
            q: "Différence avec un audit Big Four ou un cabinet de conseil traditionnel ?",
            a: "Nos consultants sont d'anciens praticiens IA, pas des MBA. Tarifs publics affichés, pas de devis à six chiffres à négocier. Méthode condensée plutôt que de longues missions. Et surtout : aucun lock-in, vous repartez avec votre plan, libre de l'exécuter avec qui vous voulez.",
          },
          {
            q: "Faut-il être déjà mature sur l'IA pour vous solliciter ?",
            a: "Non. Une grande partie de nos audits parisiens sont commandés par des dirigeants ou DG qui n'ont jamais lancé de chantier IA. L'audit est précisément fait pour ne pas vous engager dans la mauvaise direction.",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les délais convenus à la signature. Conformité RGPD, hébergement données en UE par défaut, DPO sur demande. Le plan d'action remis est exécutable par vos équipes en interne ou par tout prestataire de votre choix — pas de verrou Axion-IA, pas de prestation continue obligatoire.",
      },
      en: {
        hero: "Axion-IA's AI audit maps what can be automated at your company and quantifies the 12-24 month return on investment. Four tiers from Sur place to Mid-cap Strategic cover the full range, from independent Paris micro-businesses to large-enterprise La Défense HQs.",
        whyHere: [
          "Paris is our top engagement hub: most of our audits originate there.",
          "Paris B2B fabric over-represented in our cases: accounting firms, family offices, asset managers, 8th/9th/16th consulting, Sentier-République scale-ups, Marais fashion houses.",
          "Our consultants are Paris-based and travel across all 20 arrondissements and the inner suburbs.",
          "Read-outs always in person: ideation workshops, deliverable walk-through with your leadership, action plan handed over face to face.",
          "No opaque quote game: public pricing, you know exactly what you pay before signing.",
          "You keep control: your action plan is executable with any vendor or in-house after our audit.",
        ],
        methodology: [
          {
            step: "Preparation",
            detail:
              "Remote framing brief to access under full confidentiality a few key documents (org chart, processes, KPIs).",
          },
          {
            step: "On-site kick-off",
            detail:
              "First visit to Paris at your offices to observe daily tools and identify AI candidate workflows.",
          },
          {
            step: "Employee interviews",
            detail:
              "Series of short individual interviews (sales, finance, HR, operations, support, leadership) to map frictions and expectations.",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site: demos of Claude, Mistral, GPT-4 applied to your PDFs, emails, invoices. No theoretical slides.",
          },
          {
            step: "Read-out + action plan",
            detail:
              "Read-out workshop at your offices. Costed PDF deliverable handed over, actionable 6-18 month roadmap.",
          },
        ],
        pricing: [
          {
            sizeLabel: "SME",
            price: "Targeted or SME Strategic audit",
            detail:
              "Ideal for accounting firms, Sentier scale-ups, digital agencies from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap Strategic audit",
            detail:
              "For 8th/9th mid-cap consulting, banks, established fashion houses framing a multi-year AI trajectory.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Extended Mid-cap Strategic audit",
            detail: "For La Défense large-corporate HQs framing centralized AI governance.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA delivered what the Big Four were quoting over several weeks. The report is costed, actionable, jargon-free. We started implementation very quickly.",
            role: "CEO",
            companyProfile: "Accounting firm, 9th arrondissement",
          },
          {
            quote:
              "Pragmatic method, demos on our real data rather than theoretical slides. The deliverable helped prioritize our AI initiatives for the executive committee.",
            role: "Head of Transformation",
            companyProfile: "Mid-cap consulting, 8th arrondissement",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Paris?",
            a: "Duration varies by tier: a Sur place audit runs over a day, a Mid-cap Strategic audit spans several weeks. We agree on the cadence at the framing brief.",
          },
          {
            q: "What ROI can I expect for a Paris SME?",
            a: "On SME Strategic audits, identified 12-month ROI represents the equivalent of several FTEs saved on automated workflows (invoice reading, meeting minutes, lead qualification). The deliverable details exact figures for your case.",
          },
          {
            q: "Does my data stay confidential during the audit?",
            a: "Yes. Confidentiality ensured from kick-off, data processed exclusively on your infrastructure, no extraction to our servers. GDPR compliance, models tested locally or on dedicated infra at your premises if sovereignty is required.",
          },
          {
            q: "How does the final read-out work?",
            a: "Always in person in Paris. Workshop of a few hours at your offices with your leadership or executive committee. You leave with the PDF deliverable in hand.",
          },
          {
            q: "Difference with a Big Four audit or traditional consulting?",
            a: "Our consultants are former AI practitioners, not MBAs. Public pricing, no six-figure quote to negotiate. Condensed method rather than long missions. And above all: no lock-in, you leave with your plan, free to execute with whoever you want.",
          },
          {
            q: "Do I need AI maturity to engage you?",
            a: "No. A large share of our Paris audits are ordered by executives who have never launched an AI initiative. The audit exists precisely to avoid going in the wrong direction.",
          },
        ],
        guarantees:
          "Contractual commitment: deliverable handed over within the timeline agreed at signature. GDPR compliance, EU data hosting by default, DPO on request. No tech lock-in: your action plan is executable with any vendor or in-house. If after the read-out you feel the deliverable lacks actionable value, audit fully refunded (clause available but never triggered to date on our Paris missions).",
      },
    },
    interventions: {
      fr: {
        hero: "Les interventions IA Axion-IA à Paris se déclinent en formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs ne repartent pas avec des slides : ils repartent avec des outils IA installés sur leur poste, configurés pour leur travail réel — finance 9e/8e, cabinet conseil 16e, tech Sentier, scale-up Station F ou direction ETI La Défense.",
        whyHere: [
          "Paris est notre premier terrain d'intervention : nous y déroulons une part importante de nos sessions chaque mois.",
          "Tous les arrondissements couverts en présentiel ainsi que la première couronne (Levallois, Boulogne, Issy, Neuilly, Saint-Denis, Vincennes, Montreuil).",
          "Le format collectif (1 journée) est calibré pour les structures parisiennes de quelques personnes à une centaine de collaborateurs.",
          "Le format Conférence convient aux grandes plénières d'entreprise (auditoriums La Défense, lofts Sentier, espaces collaboratifs Station F).",
          "Le format Dirigeants permet un cadrage en huis-clos pour les comités de direction parisiens.",
          "Vocabulaire ajusté à votre secteur dominant : finance, conseil, tech, mode, retail. Pas de session générique recyclée.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Un échange à distance avec votre RH ou votre direction pour cibler le profil des participants, votre secteur métier, les cas d'usage prioritaires.",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs de votre activité (factures, emails, RH, contrats) pour calibrer les démos sur VOS données.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux pour vérifier matériel, projection, accès Wi-Fi. Pas d'aléa technique le jour J.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Selon le format choisi, alternance de théorie courte et de démos longues sur VOS données, suivies d'ateliers participatifs.",
          },
          {
            step: "Outils installés et debrief",
            detail:
              "Chaque participant repart avec les outils IA installés et configurés pour son cas d'usage personnel. Utilisables le lendemain matin sans aide extérieure.",
          },
        ],
        pricing: [
          {
            sizeLabel: "PME",
            price: "Formation collective ou Équipes",
            detail:
              "Formation collective pour le groupe entier ou Équipes pour focaliser sur un département (commerciaux, finance, RH, opérations).",
          },
          {
            sizeLabel: "ETI",
            price: "Format Conférence ou Dirigeants",
            detail:
              "Plénière pour grandes audiences ou huis-clos comité de direction selon votre objectif.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Format personnalisé multi-formats",
            detail:
              "Combinaisons sur-mesure pour les sièges parisiens : roadshow multi-sites, séminaires CODIR + cascade équipes.",
          },
        ],
        testimonials: [
          {
            quote:
              "Formation collective parfaitement calibrée : nos collaborateurs sont repartis avec leurs outils IA installés et configurés. Le lendemain, une partie significative les utilisaient déjà sur leur travail réel.",
            role: "DRH",
            companyProfile: "Cabinet conseil parisien, 8e arrondissement",
          },
          {
            quote:
              "La conférence dirigeants nous a alignés en quelques heures sur la trajectoire IA. Aucun consultant traditionnel n'avait su cadrer aussi vite avec autant de pragmatisme.",
            role: "Président",
            companyProfile: "ETI familiale, siège La Défense",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA à Paris ?",
            a: "Cela dépend du format choisi. Le format collectif se déroule sur une journée, le format approfondi sur deux journées consécutives. La Conférence et le format Dirigeants tiennent sur une journée. Pour un programme multi-formats, le rythme est défini ensemble en cadrage.",
          },
          {
            q: "Quelle taille de groupe pouvez-vous accueillir ?",
            a: "Le format collectif accueille jusqu'à une centaine de collaborateurs en interaction. Au-delà, le format Conférence est plus adapté avec un schéma plénière + ateliers en sous-groupes.",
          },
          {
            q: "Les outils installés sur les postes restent-ils utilisables après la session ?",
            a: "Oui, ce sont des comptes individuels (gratuits ou avec abonnement employé) sur ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity selon le profil. Vous gardez le contrôle complet des comptes IA installés — pas de licence Axion-IA, pas de dépendance technique.",
          },
          {
            q: "Pouvez-vous adapter le contenu à notre secteur ?",
            a: "Oui systématiquement. Le brief de cadrage en amont nous permet d'ajuster vocabulaire, exemples, démos. Une session pour un cabinet d'expertise comptable n'a rien à voir avec une session pour une maison de mode.",
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
          "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain matin sur les outils installés, séance de remédiation offerte. Vocabulaire ajusté à votre secteur, aucune session générique recyclée.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Paris come in on-site formats from one to several days depending on your teams. Your staff don't leave with slides: they leave with AI tools installed on their workstations, configured for their real work.",
        whyHere: [
          "Paris is our top engagement ground: a significant share of our sessions take place there each month.",
          "All arrondissements covered in person plus the inner suburbs (Levallois, Boulogne, Issy, Neuilly, Saint-Denis, Vincennes, Montreuil).",
          "The group format is calibrated for Paris structures from a few people to about a hundred staff.",
          "The Talk format suits large corporate plenaries (La Défense auditoriums, Sentier lofts, Station F collaborative spaces).",
          "The Executives format enables in-camera framing for Paris executive committees.",
          "Vocabulary adjusted to your dominant sector: finance, consulting, tech, fashion, retail. No recycled generic session.",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange with your HR or leadership to target participant profile, sector, priority use cases.",
          },
          {
            step: "Demo preparation",
            detail:
              "We collect a few anonymized documents representative of your activity (invoices, emails, HR, contracts) to calibrate demos on YOUR data.",
          },
          {
            step: "Arrival and setup",
            detail:
              "Our consultants arrive ahead of time at your offices to check equipment, projection, Wi-Fi access. No technical hiccup on D-day.",
          },
          {
            step: "Pedagogical session",
            detail:
              "Depending on the chosen format, alternation of short theory and longer demos on YOUR data, followed by participatory workshops.",
          },
          {
            step: "Tools installed and debrief",
            detail:
              "Each participant leaves with AI tools installed and configured for their personal use case. Usable next morning without external help.",
          },
        ],
        pricing: [
          {
            sizeLabel: "SME",
            price: "Group or Teams format",
            detail:
              "Group format for the whole group or Teams to focus on one department (sales, finance, HR, operations).",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Talk or Executives format",
            detail:
              "Plenary for large audiences or in-camera executive committee depending on your objective.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Custom multi-format program",
            detail:
              "Custom combinations for Paris HQs: multi-site roadshows, exec committee + cascade team seminars.",
          },
        ],
        testimonials: [
          {
            quote:
              "Group format perfectly calibrated: our staff left with their AI tools installed and configured. The next day, a significant share were already using them on real work.",
            role: "Head of HR",
            companyProfile: "Paris consulting firm, 8th arrondissement",
          },
          {
            quote:
              "The executive talk aligned us within hours on the AI trajectory. No traditional consultant had been able to frame this fast with so much pragmatism.",
            role: "President",
            companyProfile: "Family-owned mid-cap, La Défense HQ",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Paris take?",
            a: "It depends on the chosen format. The one-day format runs over a day, the two-day format over two consecutive days. The Talk and Executives format fit in a day. For a multi-format program, the rhythm is defined together at framing.",
          },
          {
            q: "What group size can you handle?",
            a: "The group format handles up to about a hundred staff in interaction. Beyond that, the Talk format is more suitable with a plenary + sub-group workshops.",
          },
          {
            q: "Do the tools installed on workstations remain usable after the session?",
            a: "Yes, they are individual accounts (free or with employee subscription) on ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity per profile. No Axion-IA lock-in, you keep control.",
          },
          {
            q: "Can you adapt content to our sector?",
            a: "Yes systematically. The upstream framing brief lets us adjust vocabulary, examples, demos. A session for an accounting firm has nothing to do with one for a fashion house.",
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
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning on installed tools, free remediation session offered. Vocabulary adjusted to your sector, no recycled generic session.",
      },
    },
    implementation: {
      fr: {
        hero: "L'implémentation IA Axion-IA à Paris met vos cas IA en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Le mode est hybride sur site / distance, avec un kick-off obligatoire à Paris.",
        whyHere: [
          "Paris concentre une part importante de nos missions d'implémentation, principalement sur les directions IA des grands groupes et les scale-ups en croissance.",
          "Le kick-off se passe systématiquement en présentiel à Paris dans vos locaux : alignement des équipes, accès aux données, validation des intégrations CRM/ERP/email.",
          "Itérations à distance ensuite avec un point quotidien court en visio et une visite mensuelle pour démos d'avancement avec votre comité de direction.",
          "Recette finale toujours en présentiel à Paris : passation de pouvoir, formation des équipes installées sur leur poste, documentation runbook remise.",
          "Formation incluse pour vos collaborateurs identifiés clés : ils deviennent les ambassadeurs IA internes, autonomes après la fin de mission.",
          "Cas typiques parisiens : cabinets d'expertise (lecture de factures), conseil 8e/9e (qualification de leads), scale-ups SaaS Sentier (agents support), maisons de mode Marais (génération de copy produit).",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site Paris : revue de l'architecture cible (CRM, ERP, mails, stockage), validation des contraintes RGPD/sécurité, sélection finale des modèles IA, signature du SOW chiffré.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site Paris : installation des accès, déploiement de l'environnement de dev, première intégration end-to-end fonctionnelle (POC), validation visuelle avec votre équipe.",
          },
          {
            step: "Itérations",
            detail:
              "Travail à distance avec un point quotidien court : enrichissement progressif des cas, intégration aux outils existants, tests sur volumes réels, ajustements UX.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site Paris : tests d'acceptation utilisateurs, formation des ambassadeurs internes, livraison du runbook documentation, plan de monitoring de quelques semaines.",
          },
          {
            step: "Suivi post-go-live",
            detail:
              "À distance : surveillance des métriques de production, ajustements fins, mesure du ROI réel par rapport à la prédiction du SOW. Rapport final remis à clôture, mission close.",
          },
        ],
        pricing: [
          {
            sizeLabel: "PME",
            price: "Mission PME",
            detail:
              "Déploiement de plusieurs cas d'usage, formation d'ambassadeurs internes, intégration CRM/ERP. Pour cabinets d'expertise, scale-ups, agences digital de quelques dizaines à 250 collaborateurs.",
          },
          {
            sizeLabel: "ETI",
            price: "Mission ETI",
            detail:
              "Déploiement transverse, gouvernance IA, intégrations avancées (legacy ERP, datalake), formation d'ambassadeurs cross-département.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Grand programme multi-déploiement",
            detail:
              "Programmes annuels pour grands comptes parisiens : cas d'usage cascadés, gouvernance IA centralisée, équipe dédiée Axion-IA en mode régie.",
          },
        ],
        testimonials: [
          {
            quote:
              "Implémentation lecture factures + comptes-rendus livrée comme promis. ROI réel mesuré : équivalents temps plein libérés sur les tâches admin, gain annuel net significatif. Aucun lock-in, on a la main sur les modèles.",
            role: "DAF",
            companyProfile: "ETI conseil parisien, 9e arrondissement",
          },
          {
            quote:
              "Méthode hybride parfaite : kick-off intense sur site, puis itérations à distance avec points courts. Notre équipe IT n'a jamais été perdue. Les ambassadeurs internes prennent le relais de façon autonome.",
            role: "CTO",
            companyProfile: "Scale-up SaaS Sentier, 11e arrondissement",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implémentation Axion-IA à Paris ?",
            a: "Cela dépend de l'ampleur. Un POC pour PME peut tenir en quelques semaines, une mission PME standard sur quelques mois, une mission ETI transverse sur plusieurs mois, un grand programme multi-déploiement sur une année. Le SOW signé en cadrage fixe le calendrier précis.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour la grande majorité de nos missions parisiennes. SOW signé au début avec scope précis et livrables définis. Si le scope change en cours, avenant explicite + nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Qui maintient la solution après la mission ?",
            a: "Vos ambassadeurs internes, formés pendant la mission. Documentation runbook complète remise. Si maintenance externalisée souhaitée, contrat de support optionnel chez nous ou chez tout prestataire francilien — vous restez libre de votre choix.",
          },
          {
            q: "Mes données restent-elles chez moi ou partent-elles chez Axion-IA ?",
            a: "Toujours chez vous. Modèles IA déployés sur votre infra (cloud privé, on-premise, serveur dédié) ou sur infra dédiée si vous préférez (souveraineté UE). Confidentialité assurée dès le cadrage, RGPD strict, DPO sur demande.",
          },
          {
            q: "Quels modèles IA utilisez-vous ?",
            a: "Mix selon le cas : open-source (Mistral, Llama) pour la souveraineté ou le coût ; propriétaires (GPT, Claude, Gemini) pour la qualité top ; parfois fine-tuning sur vos données si le volume le justifie. Choix justifié dans le SOW, jamais imposé.",
          },
          {
            q: "Que se passe-t-il si l'IA hallucine ou produit des erreurs ?",
            a: "Tous nos déploiements incluent une couche de validation : seuils de confiance, double-check humain pour les cas sensibles (factures importantes, contrats, RH), monitoring continu des métriques. Le ROI chiffré au SOW intègre la marge d'erreur réaliste, pas un scénario parfait.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : pas de dérive horaire cachée. Livraison dans les délais convenus à la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après une année de production le ROI réel mesuré reste très en deçà de la prédiction du SOW, audit gratuit pour identifier la cause + ajustement déploiement offert. Votre runbook, vos modèles, vos données : tout reste chez vous, transférable à tout prestataire externe ou repris en interne. Vos ambassadeurs internes formés sont autonomes après go-live.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Paris brings your AI cases to production with contractually-costed ROI, team training included. Mode is hybrid on-site / remote, with a mandatory Paris kick-off.",
        whyHere: [
          "Paris hosts a significant share of our implementation missions, mostly with large-group AI leadership and growing scale-ups.",
          "Kick-off always happens in person in Paris at your offices: team alignment, data access, CRM/ERP/email integration validation.",
          "Remote iterations afterwards with a short daily on video and a monthly on-site visit for progress demos with your executive committee.",
          "Final acceptance always in person in Paris: handover, training of installed teams, runbook documentation delivered.",
          "Training included for your identified key staff: they become internal AI ambassadors, autonomous after mission end.",
          "Typical Paris cases: accounting firms (invoice reading), 8th/9th consulting (lead qualification), Sentier SaaS scale-ups (support agents), Marais fashion houses (product copy generation).",
        ],
        methodology: [
          {
            step: "Technical framing",
            detail:
              "On-site Paris workshop: target architecture review (CRM, ERP, emails, storage), GDPR/security constraints validation, AI model final selection, costed SOW signed.",
          },
          {
            step: "Kick-off + initial sprint",
            detail:
              "Several days on site Paris: access install, dev environment deployment, first end-to-end functional integration (POC), visual validation with your team.",
          },
          {
            step: "Iterations",
            detail:
              "Remote work with a short daily: progressive case enrichment, integration with existing tools, real-volume testing, UX adjustments.",
          },
          {
            step: "Acceptance + training",
            detail:
              "On site Paris: user acceptance tests, training of internal ambassadors, runbook documentation delivery, multi-week monitoring plan.",
          },
          {
            step: "Post-go-live follow-up",
            detail:
              "Remote: production metrics monitoring, fine adjustments, real ROI vs SOW prediction measurement. Final report delivered at closure, mission closed.",
          },
        ],
        pricing: [
          {
            sizeLabel: "SME",
            price: "SME mission",
            detail:
              "Deployment of several use cases, training of internal ambassadors, CRM/ERP integration. For accounting firms, scale-ups, digital agencies from a few dozen to 250 staff.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations (legacy ERP, datalake), training of cross-department ambassadors.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Multi-deployment large program",
            detail:
              "Annual programs for Paris large accounts: cascaded use cases, centralized AI governance, dedicated Axion-IA team in retainer mode.",
          },
        ],
        testimonials: [
          {
            quote:
              "Invoice reading + meeting minutes implementation delivered as promised. Real ROI measured: FTEs freed on admin tasks, significant net annual gain. No lock-in, we control our models.",
            role: "CFO",
            companyProfile: "Paris mid-cap consulting, 9th arrondissement",
          },
          {
            quote:
              "Perfect hybrid method: intense on-site kick-off, then remote iterations with short check-ins. Our IT team was never lost. Internal ambassadors take over autonomously.",
            role: "CTO",
            companyProfile: "Sentier SaaS scale-up, 11th arrondissement",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA implementation in Paris take?",
            a: "It depends on scope. A micro-business POC fits in a few weeks, a standard SME mission spans a few months, a transverse mid-cap mission spans several months, a multi-deployment large program spans a year. The SOW signed at framing fixes the precise schedule.",
          },
          {
            q: "Is the price fixed or time-based?",
            a: "Fixed flat-rate for the vast majority of our Paris missions. SOW signed at the start with precise scope and defined deliverables. If scope changes mid-mission, explicit amendment + new estimate. No hidden hourly drift.",
          },
          {
            q: "Who maintains the solution after the mission?",
            a: "Your internal ambassadors, trained during the mission. Complete runbook documentation handed over. If outsourced maintenance desired, optional support contract. No lock-in: you can also outsource elsewhere.",
          },
          {
            q: "Does my data stay with me or move to Axion-IA?",
            a: "Always with you. AI models deployed on your infra (private cloud, on-premise, dedicated server) or on dedicated infra if you prefer (EU sovereignty). Strict confidentiality at framing, strict GDPR, DPO on request.",
          },
          {
            q: "Which AI models do you use?",
            a: "Mix per case: open-source (Mistral, Llama) for sovereignty or cost; proprietary (GPT, Claude, Gemini) for top quality; sometimes fine-tuning on your data if volume justifies. Choice justified in SOW, never imposed.",
          },
          {
            q: "What happens if the AI hallucinates or produces errors?",
            a: "All our deployments include a validation layer: confidence thresholds, human double-check for sensitive cases (large invoices, contracts, HR), continuous metrics monitoring. The costed ROI in SOW includes realistic margin of error, not a perfect scenario.",
          },
        ],
        guarantees:
          "Fixed flat-rate on SOW: no hidden hourly drift. Delivery within the timeline agreed at signature, with contractual compensation in case of our delay. Contractual costed ROI: if after a year of production the real measured ROI stays significantly below the SOW prediction, free audit to identify the cause + offered deployment adjustment. No tech lock-in: your models, your data, your runbook. Your trained internal ambassadors are autonomous after go-live.",
      },
    },
    unAUn: {
      fr: {
        hero: "L'accompagnement 1-to-1 Axion-IA à Paris est conçu pour les dirigeants, managers et entrepreneurs qui veulent progresser sur l'IA à leur propre rythme, sur leurs vrais cas business — pas sur des exercices génériques. Sessions sur site dans vos bureaux (Station F, PME 8e/9e, ETI La Défense, startups Sentier) ou en visio selon vos contraintes. Pas de contrat récurrent imposé, pas de suite logicielle propriétaire, zéro jargon — résultats applicables le lendemain.",
        whyHere: [
          "Paris est l'épicentre décisionnel français : dirigeants de PME du 8e, DG de startups du Sentier, CEOs d'ETI à La Défense — tous nos profils 1-to-1 y sont surreprésentés.",
          "Tissu B2B parisien multi-sectoriel sans équivalent : chaque session est calibrée sur votre secteur réel (finance, conseil, tech, mode, retail) et vos propres données.",
          "Déplacements intra-muros ou visio selon votre agenda : nos consultants se rendent directement dans vos bureaux, sans que vous ayez à vous déplacer.",
          "Liberté totale de stack après les sessions : ChatGPT, Claude, Mistral, Notion AI — vos choix, votre rythme, sans contrat récurrent ni suite logicielle propriétaire imposée.",
          "Cas réels uniquement : on travaille sur vos emails, vos documents, vos processus métier du moment, pas sur des cas d'école.",
          "Ecosystème IA parisien à portée de main : Station F, Mistral AI, Hugging Face — nous vous aidons aussi à vous y positionner stratégiquement.",
        ],
        methodology: [
          {
            step: "Diagnostic individuel",
            detail:
              "Un entretien de cadrage à distance pour cerner votre niveau de maturité IA, vos cas d'usage prioritaires et vos objectifs business concrets. On part de là où vous en êtes, sans présupposé.",
          },
          {
            step: "Sessions sur cas réels",
            detail:
              "Chaque session travaille sur un cas business que vous apportez : un email à rédiger, un contrat à analyser, un rapport à synthétiser, un process à automatiser. Apprentissage immédiatement transférable.",
          },
          {
            step: "Outillage IA personnalisé",
            detail:
              "Nous sélectionnons avec vous les outils les mieux adaptés à votre profil et votre secteur (Claude, ChatGPT, Mistral, Perplexity, Notion AI…) et les configurons pour votre usage réel.",
          },
          {
            step: "Plan d'autonomie",
            detail:
              "À mi-parcours, nous posons un plan structuré de montée en compétence : quels outils maîtriser en priorité, quels cas d'usage adresser dans les semaines suivantes, comment ancrer les bonnes pratiques.",
          },
          {
            step: "Suivi optionnel",
            detail:
              "Après les sessions principales, un suivi léger est disponible sur demande : relecture de vos prompts, ajustement de vos workflows, questions ponctuelles entre sessions. Sans engagement récurrent.",
          },
        ],
        pricing: [
          {
            sizeLabel: "PME",
            price: "Forfait PME 1-to-1",
            detail:
              "Pour les dirigeants et managers de PME (quelques dizaines à 250 collaborateurs) des arrondissements 8e/9e/16e ou Sentier souhaitant cadrer leur stratégie IA personnelle avant de la déployer en équipe.",
          },
          {
            sizeLabel: "ETI",
            price: "Forfait ETI Dirigeants",
            detail:
              "Pour les membres de comité de direction d'ETI ou les responsables de transformation IA souhaitant monter en compétence avant de piloter un déploiement transverse.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Forfait Grande entreprise sur mesure",
            detail:
              "Pour les DG, CDO ou Chief AI Officers de grands groupes parisiens (La Défense, 8e) souhaitant un accompagnement personnalisé en parallèle d'un programme IA interne.",
          },
        ],
        testimonials: [
          {
            quote:
              "On a travaillé sur mes vrais emails clients et mes devis. En deux sessions, j'avais un workflow IA opérationnel. Rien à voir avec les formations génériques que j'avais essayées avant.",
            role: "Dirigeant",
            companyProfile: "PME conseil, 8e arrondissement",
          },
          {
            quote:
              "Session en visio, très dense, on est allé directement sur mes cas business. J'ai appris plus en trois heures qu'en plusieurs semaines de tuto en ligne.",
            role: "DG",
            companyProfile: "Startup B2B SaaS, Sentier",
          },
        ],
        faq: [
          {
            q: "Les sessions se déroulent-elles en présentiel ou en visio ?",
            a: "Les deux formats sont disponibles. En présentiel, nous nous déplaçons dans vos bureaux parisiens (tous arrondissements, La Défense, première couronne) ; sinon en visio. Le choix dépend de votre préférence et de votre type de cas.",
          },
          {
            q: "À quelle fréquence se déroulent les sessions ?",
            a: "La fréquence est définie avec vous selon votre agenda et vos objectifs. Certains dirigeants préfèrent une session intensive par semaine sur quelques semaines ; d'autres espacent davantage pour intégrer entre chaque session. Aucune cadence imposée.",
          },
          {
            q: "Quelle est la différence avec une formation IA collective ?",
            a: "Dans une formation collective, le contenu est mutualisé et forcément générique. En 1-to-1, on travaille uniquement sur vos cas, votre secteur, vos contraintes. Le temps est dense, sans concession à des niveaux différents dans le groupe. La progression est habituellement beaucoup plus rapide.",
          },
          {
            q: "Dans quels secteurs intervenez-vous en 1-to-1 à Paris ?",
            a: "Tous les secteurs B2B parisiens : finance (asset management, banque, conseil), tech (SaaS, édition logicielle), mode et luxe, retail, services aux entreprises, juridique, communication. Le 1-to-1 s'adapte à n'importe quel métier car on part de vos propres documents et processus.",
          },
          {
            q: "Comment la confidentialité est-elle garantie ?",
            a: "Confidentialité stricte dès le démarrage des sessions. Les documents que vous partagez ne quittent pas le périmètre de la session. Nous ne conservons aucun contenu métier après la fin de la mission. Aucune mention de votre identité ou de votre entreprise sans autorisation explicite.",
          },
          {
            q: "En quoi est-ce différent d'un audit IA ou d'une implémentation ?",
            a: "L'audit IA cartographie ce qui peut être automatisé chez vous et produit un livrable PDF chiffré ROI. L'implémentation met des cas IA en production dans vos outils. Le 1-to-1 est différent : c'est vous qui montez en compétence personnellement, sur vos propres cas, pour devenir autonome. Les trois formats sont complémentaires, pas substituables.",
          },
        ],
        guarantees:
          "Engagement séance par séance : vous interrompez le programme quand vous voulez sans pénalité contractuelle. Confidentialité stricte dès le démarrage, documents jamais exportés hors de vos systèmes sans accord explicite. Sessions orientées résultats applicables immédiatement : si après la première session vous estimez n'avoir rien de directement utilisable, séance remboursée.",
      },
      en: {
        hero: "Axion-IA's 1-to-1 AI coaching in Paris is designed for executives, managers and entrepreneurs who want to progress on AI at their own pace, on their real business cases — not on generic exercises. Sessions on site at your Paris offices (Station F, 8th/9th SMEs, La Défense mid-caps, Sentier startups) or by video depending on your schedule. No lock-in, no jargon, results applicable the next day.",
        whyHere: [
          "Paris is France's decision-making epicentre: 8th-arrondissement SME executives, Sentier startup CEOs, La Défense mid-cap leaders — all our 1-to-1 profiles are over-represented there.",
          "Unmatched multi-sector Paris B2B fabric: every session is calibrated to your real sector (finance, consulting, tech, fashion, retail) and your own data.",
          "Intra-city travel or video depending on your schedule: our consultants come directly to your offices, no commute required on your side.",
          "No lock-in of any kind: no imposed software suite, no compulsory recurring contract — you advance at the pace you decide.",
          "Real cases only: we work on your actual emails, documents and business processes, not textbook exercises.",
          "Paris AI ecosystem at your fingertips: Station F, Mistral AI, Hugging Face — we also help you position yourself strategically within this landscape.",
        ],
        methodology: [
          {
            step: "Individual diagnosis",
            detail:
              "A remote framing interview to assess your AI maturity, priority use cases and concrete business objectives. We start from where you are, with no assumptions.",
          },
          {
            step: "Sessions on real cases",
            detail:
              "Each session works on a business case you bring: an email to draft, a contract to analyse, a report to summarise, a process to automate. Immediately transferable learning.",
          },
          {
            step: "Personalised AI tooling",
            detail:
              "We select with you the tools best suited to your profile and sector (Claude, ChatGPT, Mistral, Perplexity, Notion AI…) and configure them for your real use.",
          },
          {
            step: "Autonomy plan",
            detail:
              "At mid-course we establish a structured competence-building plan: which tools to master first, which use cases to address in the coming weeks, how to anchor best practices.",
          },
          {
            step: "Optional follow-up",
            detail:
              "After the main sessions, lightweight follow-up is available on request: prompt review, workflow adjustment, ad-hoc questions between sessions. No recurring commitment.",
          },
        ],
        pricing: [
          {
            sizeLabel: "SME",
            price: "SME 1-to-1 package",
            detail:
              "For SME executives and managers (a few dozen to 250 staff) in the 8th/9th/16th arrondissements or Sentier who want to frame their personal AI strategy before rolling it out team-wide.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap Executives package",
            detail:
              "For executive committee members or AI transformation leads who want to build competence before steering a transverse deployment.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Large enterprise bespoke package",
            detail:
              "For CEOs, CDOs or Chief AI Officers at Paris large groups (La Défense, 8th) seeking personalised coaching alongside an internal AI programme.",
          },
        ],
        testimonials: [
          {
            quote:
              "We worked on my real client emails and quotes. Within two sessions I had an operational AI workflow. Nothing like the generic training courses I had tried before.",
            role: "Managing Director",
            companyProfile: "Consulting SME, 8th arrondissement",
          },
          {
            quote:
              "Video session, very dense, we went straight to my business cases. I learned more in three hours than in several weeks of online tutorials.",
            role: "CEO",
            companyProfile: "B2B SaaS startup, Sentier",
          },
        ],
        faq: [
          {
            q: "Do sessions take place in person or by video?",
            a: "Both formats are available. In person, we travel to your Paris offices (all arrondissements, La Défense, inner suburbs); otherwise by video. The choice depends on your preference and the type of case.",
          },
          {
            q: "How often do sessions take place?",
            a: "Frequency is agreed with you based on your schedule and objectives. Some executives prefer one intensive session per week over a few weeks; others space them out to integrate between sessions. No imposed cadence.",
          },
          {
            q: "What is the difference with a group AI training?",
            a: "In a group training, content is pooled and necessarily generic. In 1-to-1, we work exclusively on your cases, your sector, your constraints. Time is dense, with no concession to different levels within the group. Progress is usually much faster.",
          },
          {
            q: "Which sectors do you cover in 1-to-1 sessions in Paris?",
            a: "All Paris B2B sectors: finance (asset management, banking, consulting), tech (SaaS, software publishing), fashion and luxury, retail, business services, legal, communications. The 1-to-1 adapts to any profession because we start from your own documents and processes.",
          },
          {
            q: "How is confidentiality guaranteed?",
            a: "Strict confidentiality ensured before sessions begin. Documents you share do not leave the session perimeter. We retain no business content after the mission ends. No mention of your identity or company without explicit consent.",
          },
          {
            q: "How is this different from an AI audit or an implementation?",
            a: "The AI audit maps what can be automated at your company and produces a costed PDF deliverable. The implementation brings AI cases to production in your tools. The 1-to-1 is different: it is you who build personal competence, on your own cases, to become autonomous. The three formats are complementary, not substitutes.",
          },
        ],
        guarantees:
          "No lock-in: no imposed recurring contract, you can stop after each session. Strict confidentiality ensured from kick-off. Results-oriented sessions with immediate applicability: if after the first session you feel you have nothing directly usable, session fully refunded.",
      },
    },
    sitesWeb: {
      fr: {
        hero: "Axion-IA conçoit et augmente à Paris des sites web, applications et plateformes SaaS avec l'IA intégrée : UX/UI sur mesure, chatbot RAG ancré sur vos contenus, recherche sémantique, agents et automatisations. Devis à partir de 24-48 h selon la complexité du projet, hébergement UE, code et données à vous. Kick-off en présentiel à Paris, itérations à distance.",
        whyHere: [
          "Projets web & SaaS parisiens : éditeurs de logiciel, scale-ups du Sentier, conseil 8e/9e, e-commerce et mode du Marais.",
          "Conception UX/UI complète si besoin — research, wireframes, design system, prototype Figma — pas seulement la brique IA.",
          "Augmentation de l'existant (widget, API, plugin) ou plateforme IA-native sur mesure, selon le meilleur ROI à 18 mois.",
          "De la PME qui greffe un chatbot à l'ETI qui refond sa plateforme métier : on s'adapte à votre échelle.",
        ],
        methodology: [
          {
            step: "Cadrage à Paris",
            detail:
              "Atelier sur site : objectifs, parcours, audit de la stack et des contenus. Devis ferme à partir de 24-48 h selon la complexité.",
          },
          {
            step: "Conception UX/UI",
            detail:
              "Wireframes, design system et maquettes Figma à votre marque ; prototype testé avant tout développement.",
          },
          {
            step: "Développement par sprints",
            detail:
              "Greffe IA sur l'existant ou build IA-native : chatbot RAG, search, agents, e-commerce. Démos hebdomadaires.",
          },
          {
            step: "Recette + mise en ligne",
            detail:
              "Tests d'acceptation, Web Vitals et SEO/AEO validés, mise en production sans downtime.",
          },
          {
            step: "Livraison + autonomie",
            detail:
              "Code, bases et modèles livrés chez vous (hébergement UE possible). Aucun abonnement imposé : c'est à vous.",
          },
        ],
        pricing: [
          {
            sizeLabel: "PME",
            price: "Site / application sur mesure",
            detail:
              "Conception ou refonte d'un site ou d'une application avec UX/UI et IA intégrée, pour scale-ups, e-commerce et cabinets parisiens.",
          },
          {
            sizeLabel: "ETI",
            price: "Plateforme SaaS IA-native",
            detail:
              "Plateforme métier ou portail client sur mesure, IA intégrée dès la conception, branchée sur votre SI (CRM, ERP, datalake).",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Programme produit",
            detail:
              "Programmes pluriannuels : refonte de plateformes, design system d'entreprise, équipe dédiée Axion-IA en mode produit.",
          },
        ],
        faq: [
          {
            q: "Faites-vous l'UX/UI et le design, ou seulement l'IA ?",
            a: "Les deux. On conçoit l'expérience complète à Paris — recherche utilisateur, wireframes, design system, maquettes Figma, prototype — pour un site, une application ou une plateforme SaaS, avec ou sans brique IA. C'est un métier à part entière chez nous.",
          },
          {
            q: "Peut-on augmenter un site parisien existant sans le refondre ?",
            a: "Oui, dans la grande majorité des cas. On greffe les briques IA via une API, un widget ou un plugin, sans toucher au design ni à la structure, dès lors que votre CMS expose une API ou un flux de données. Aucune refonte ni downtime.",
          },
          {
            q: "Le devis est-il ferme et le tarif fixe ?",
            a: "Oui. Après le cadrage, on remet un devis ferme en forfait fixe : périmètre, modules, prix et délai. Le délai de remise dépend de la complexité — à partir de 24-48 h pour un projet simple, davantage pour une plateforme étendue. Pas de régie, pas de dérive horaire cachée ; tout changement de périmètre fait l'objet d'un avenant explicite.",
          },
          {
            q: "Qui est propriétaire du code et des données ?",
            a: "Vous, intégralement. Code source, bases et modèles sont livrés dans votre infrastructure, avec hébergement UE possible (Hetzner Frankfurt), conforme RGPD. Aucun abonnement imposé : si vous nous quittez, la plateforme continue de fonctionner.",
          },
          {
            q: "Avec quelles technologies travaillez-vous ?",
            a: "Toute stack moderne exposant une API : WordPress, Shopify, WooCommerce, PrestaShop, Magento, Next.js, Laravel, Django, Vue, React, Angular. On choisit la meilleure stack selon vos objectifs et on s'adapte à votre existant, jamais l'inverse.",
          },
        ],
        guarantees:
          "Devis ferme en forfait fixe (à partir de 24-48 h selon la complexité du projet) : pas de dérive horaire cachée. Mise en ligne sans downtime quand on augmente l'existant. Web Vitals et accessibilité contrôlés à la livraison. Code source, bases et modèles livrés dans votre infrastructure (hébergement UE possible), conformes RGPD : propriété totale, aucun abonnement imposé, transférable à tout prestataire francilien ou repris en interne.",
      },
      en: {
        hero: "In Paris, Axion-IA designs and augments websites, applications and SaaS platforms with built-in AI: bespoke UX/UI, RAG chatbot grounded in your content, semantic search, agents and automations. Quote from 24-48 h depending on project complexity, EU hosting, code and data yours. On-site Paris kick-off, remote iterations.",
        whyHere: [
          "Paris web & SaaS projects: software vendors, Sentier scale-ups, 8th/9th consulting, Marais e-commerce and fashion.",
          "Full UX/UI design if needed — research, wireframes, design system, Figma prototype — not just the AI brick.",
          "Augment the existing site (widget, API, plugin) or a bespoke AI-native platform, whichever pays off best at 18 months.",
          "From a micro-business grafting a chatbot to a mid-cap rebuilding its business platform: we adapt to your scale.",
        ],
        methodology: [
          {
            step: "Scoping in Paris",
            detail:
              "On-site workshop: goals, journeys, audit of the existing stack and content. Firm quote from 24-48 h depending on complexity.",
          },
          {
            step: "UX/UI design",
            detail:
              "Wireframes, design system and Figma mockups in your brand; prototype tested before any development.",
          },
          {
            step: "Development in sprints",
            detail:
              "AI grafted onto the existing site or AI-native build: RAG chatbot, search, agents, e-commerce. Weekly demos.",
          },
          {
            step: "Acceptance + go-live",
            detail:
              "Acceptance tests, Web Vitals and SEO/AEO validated, production release without downtime.",
          },
          {
            step: "Delivery + autonomy",
            detail:
              "Code, databases and models delivered into your infra (EU hosting possible). No imposed subscription: it's yours.",
          },
        ],
        pricing: [
          {
            sizeLabel: "SME",
            price: "Bespoke site / app",
            detail:
              "Design or rebuild of a site or app with UX/UI and built-in AI, for Paris scale-ups, e-commerce and firms.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "AI-native SaaS platform",
            detail:
              "Bespoke business platform or customer portal, AI built in from day one, wired into your IS (CRM, ERP, datalake).",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Product programme",
            detail:
              "Multi-year programmes: platform rebuilds, enterprise design system, dedicated Axion-IA product team.",
          },
        ],
        faq: [
          {
            q: "Do you do UX/UI and design, or only AI?",
            a: "Both. We design the full experience in Paris — user research, wireframes, design system, Figma mockups, prototype — for a website, app or SaaS platform, with or without an AI brick. It's a discipline in its own right for us.",
          },
          {
            q: "Can you augment an existing Paris site without rebuilding it?",
            a: "Yes, in the vast majority of cases. We graft the AI bricks via an API, a widget or a plugin, without touching the design or structure, as long as your CMS exposes an API or data feed. No rebuild, no downtime.",
          },
          {
            q: "Is the quote firm and the price fixed?",
            a: "Yes. After scoping, we deliver a firm quote on a fixed package: scope, modules, price and timeline. Turnaround depends on complexity — from 24-48 h for a simple project, more for an extended platform. No time-and-materials, no hidden hourly drift; any scope change is an explicit amendment.",
          },
          {
            q: "Who owns the code and the data?",
            a: "You, entirely. Source code, databases and models are delivered into your infrastructure, with EU hosting possible (Hetzner Frankfurt), GDPR-compliant. No imposed subscription: if you leave us, the platform keeps working.",
          },
          {
            q: "Which technologies do you work with?",
            a: "Any modern stack exposing an API: WordPress, Shopify, WooCommerce, PrestaShop, Magento, Next.js, Laravel, Django, Vue, React, Angular. We pick the best stack for your goals and adapt to your existing setup, never the other way around.",
          },
        ],
        guarantees:
          "Firm quote on a fixed package (from 24-48 h depending on project complexity): no hidden hourly drift. Go-live without downtime when augmenting the existing site. Web Vitals and accessibility checked at delivery. Source code, databases and models delivered into your infrastructure (EU hosting possible), GDPR-compliant: full ownership, no imposed subscription, transferable to any Paris-region provider or taken in-house.",
      },
    },
  },

  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel à Paris ?",
      a: "Quatre paliers tarifaires publics couvrent toutes les configurations parisiennes — Sur place pour les PME indépendantes du 9e ou du Sentier, Ciblé pour les PME du 8e/16e, Stratégique PME pour les cabinets de conseil et finance, Stratégique ETI pour La Défense et les groupes du CAC 40. Tarifs identiques en intra-muros et en première couronne — aucune majoration spécifique à l'Île-de-France.",
    },
    {
      q: "Avez-vous des cas clients à Paris ?",
      a: "Oui. Plusieurs cas concrets dans nos références sont basés à Paris ou en proche couronne : cabinet comptable Boulogne-Billancourt, ETI conseil 9e arrondissement, scale-up SaaS Sentier. Les cas clients récents sont consultables dans la rubrique Cas concrets, filtrables par ville d'intervention.",
    },
    {
      q: "Quels secteurs sont prioritaires à Paris ?",
      a: "Nos déploiements parisiens couvrent en priorité la finance (cabinets d'expertise, family offices, asset managers), le conseil (cabinets stratégie, audit, juridique), la tech (scale-ups B2B SaaS, éditeurs logiciels), et le luxe (maisons de mode, cosmétique). Tout secteur B2B est éligible à un audit.",
    },
    {
      q: "Pouvez-vous intervenir sur site dans nos bureaux parisiens ?",
      a: "Oui. Toutes nos interventions à Paris sont par défaut sur site, dans vos bureaux. Nos consultants sont mobiles sur l'ensemble des arrondissements, La Défense, et la première couronne. Les ateliers d'idéation et les restitutions clés se tiennent toujours en présentiel.",
    },
    {
      q: "En combien de temps pouvez-vous démarrer une mission à Paris ?",
      a: "Pour les structures parisiennes en cycle court (PME du Sentier, scale-ups Station F), le démarrage suit le brief de cadrage initial sous quelques semaines en général. Pour les missions ETI à La Défense ou multi-sites, le calendrier intègre votre fenêtre d'achat et la disponibilité de votre comité de pilotage. La date contractuelle est fixée à la signature et tenue.",
    },
    {
      q: "Travaillez-vous avec les startups parisiennes (Station F, French Tech) ?",
      a: "Oui. Nous accompagnons régulièrement les scale-ups séries A-B issues de Station F, du Quai d'Innovation et des programmes French Tech. Notre formation collective est calibrée pour les structures avec un product-market fit établi qui veulent passer du POC IA à un déploiement opérationnel.",
    },
  ],
};
