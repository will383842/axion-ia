// Le Havre (76351) — contenu éditorial gold standard.
//
// Doctrine (identique à paris.ts) :
//   - Aucun délai concret chiffré.
//   - Aucun « frais de déplacement intégrés » — frais logement, repas et
//     forfait trajet facturés à part pour les interventions sur site.
//   - Aucune demi-journée : durée minimale = 1 journée.
//   - Aucun prix hardcodé : libellés uniquement, tarifs viennent de pricing.ts.
//   - Pas de mention de métier-type : tailles INSEE (TPE / PME / ETI / GE).
//   - ~95 % Axion-IA-centric, ~5 % data INSEE anti-doorway HCU 2024.
//   - PAS de heroSchema, PAS de unAUn.
//
// Réalités Le Havre sourcées economic-data/le-havre.ts :
//   - HAROPA Port (1er port français à conteneurs, 3,1 M EVP 2024)
//   - TotalEnergies (raffinerie Normandie, plus grande de France, 12 Mt/an)
//   - Safran Nacelles (siège Gonfreville-l'Orcher, ~4000 salariés)
//   - Renault Sandouville, CMA CGM, Sidel, Yara France
//   - Nov@log (unique pôle de compétitivité logistique en France, siège Le Havre)
//   - ISEL (seule école ingénieur logistique publique en France)
//   - EM Normandie (fondée 1871 au Havre), Sciences Po Le Havre
//   - French Tech Normandie, CRIANN (calcul HPC/IA régional)
//   - UNESCO Perret 2005, 10 876 établissements actifs (INSEE 2023)

import type { VilleCopy } from "./types";

export const LE_HAVRE_COPY: VilleCopy = {
  pitchFr:
    "Le Havre concentre 10 876 entreprises actives, le 1er port français à conteneurs (HAROPA Port, 3,1 M EVP) et un tissu industriel unique — logistique, pétrochimie, aéronautique, automobile. Axion-IA intervient sur site auprès des TPE havraises comme des ETI et grandes entreprises de la ZIP.",
  pitchEn:
    "Le Havre hosts 10,876 active businesses, France's leading container port (HAROPA Port, 3.1 M TEU) and a unique industrial fabric — logistics, petrochemicals, aeronautics, automotive. Axion-IA delivers on site from Le Havre micro-businesses to mid-caps and large enterprises in the industrial port zone.",

  servicesContext: {
    audit: {
      fr: "Audit IA opérationnel au Havre : nous identifions les automatisations rentables dans votre organisation — supply chain, production, maintenance prédictive, documentation — et chiffrons le ROI. 4 niveaux du Flash au Stratégique ETI selon votre taille.",
      en: "Operational AI audit in Le Havre: we identify profitable automations in your organisation — supply chain, production, predictive maintenance, documentation — and quantify the ROI. 4 tiers from Flash to Mid-cap Strategic depending on your size.",
    },
    interventions: {
      fr: "Interventions IA au Havre : formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs repartent autonomes sur des outils IA installés sur leur poste. Frais de logement, repas et forfait trajet en sus.",
      en: "AI sessions in Le Havre: on-site formats from one to several days depending on your teams. Your staff leave autonomous with AI tools installed on their workstations. Lodging, meals and travel allowance billed separately.",
    },
    implementation: {
      fr: "Implémentation IA au Havre : on intègre l'IA dans vos outils existants (ERP industriel, TMS, CRM, emails) avec ROI chiffré contractuel. Vos équipes gardent la main, sans dépendance technologique.",
      en: "AI implementation in Le Havre: we integrate AI into your existing tools (industrial ERP, TMS, CRM, emails) with contractually-costed ROI. Your teams stay in control, no tech dependency created.",
    },
  },

  directAnswerFr:
    "Axion-IA est un cabinet IA opérationnel qui intervient au Havre (76) sur site dans la ville et le bassin Seine Estuaire (Gonfreville-l'Orcher, Montivilliers, Harfleur, Sandouville). Nous accompagnons les TPE et PME havraises du commerce et des services, les ETI industrielles de la Zone Industrialo-Portuaire (logistique, pétrochimie, aéronautique) et les grandes entreprises du cluster HAROPA sur leurs cas IA opérationnels — diagnostic chiffré, démos sur vos vraies données, plan d'action concret. Aucun lock-in technologique, vos équipes gardent la main.",
  directAnswerEn:
    "Axion-IA is an operational AI consultancy that intervenes in Le Havre (76) on site across the city and the Seine Estuaire basin (Gonfreville-l'Orcher, Montivilliers, Harfleur, Sandouville). We support Le Havre micro-businesses and SMEs in trade and services, industrial mid-caps in the Port Industrial Zone (logistics, petrochemicals, aeronautics) and large enterprises in the HAROPA cluster on their operational AI use cases — costed diagnosis, demos on your real data, concrete action plan. No tech lock-in, your teams stay in control.",

  topSectorsNaf: [
    "Logistique & Supply Chain maritime",
    "Pétrochimie & Énergie industrielle",
    "Transport maritime & Armateurs",
    "Aéronautique & Défense",
    "Automobile & Équipementiers",
    "Commerce & Services B2B",
  ],

  distancesFr:
    "Gare du Havre (intercité direct Paris Saint-Lazare ~2h10). Aéroport du Havre-Octeville à 7 km. 2 lignes de tramway + réseau LIA pour rejoindre la ZIP, le centre-ville reconstruit Perret et les communes du bassin (Gonfreville-l'Orcher 7 km, Montivilliers 8 km, Harfleur 6 km). Rouen à 90 km (1h route), Caen à 90 km (1h10).",
  distancesEn:
    "Le Havre station (direct inter-city Paris Saint-Lazare ~2h10). Le Havre-Octeville Airport 7 km away. 2 tram lines + LIA network to reach the industrial port zone, the Perret UNESCO city centre and basin communes (Gonfreville-l'Orcher 7 km, Montivilliers 8 km, Harfleur 6 km). Rouen 90 km (1h drive), Caen 90 km (1h10).",

  ecosystemFr:
    "Premier port français à conteneurs — HAROPA Port (3,1 M EVP, axe Seine), cluster pétrochimique nord-européen (TotalEnergies raffinerie 12 Mt/an, Yara, Chevron Oronite), aéronautique (Safran Nacelles siège), automobile (Renault Sandouville), emballage (Sidel siège). Nov@log, unique pôle de compétitivité logistique français (152 membres). French Tech Normandie, ISEL, EM Normandie, Sciences Po campus euro-asiatique. Centre-ville UNESCO Perret 2005.",
  ecosystemEn:
    "France's leading container port — HAROPA Port (3.1 M TEU, Seine axis), North European petrochemical cluster (TotalEnergies refinery 12 Mt/yr, Yara, Chevron Oronite), aeronautics (Safran Nacelles HQ), automotive (Renault Sandouville), packaging (Sidel HQ). Nov@log, France's only dedicated logistics competitiveness cluster (152 members). French Tech Normandie, ISEL engineering school, EM Normandie, Sciences Po Euro-Asian campus. UNESCO Perret city centre 2005.",

  // === SERVICES LONG-FORM LE HAVRE ===
  services: {
    audit: {
      fr: {
        hero: "L'audit IA Axion-IA au Havre cartographie ce qui peut être automatisé dans votre organisation et chiffre le retour sur investissement à 12-24 mois. Quatre niveaux du Flash au Stratégique ETI couvrent toutes les tailles, des TPE du commerce havrais aux grandes entreprises industrielles de la Zone Industrialo-Portuaire (ZIP). Le tissu économique havrais — logistique maritime, pétrochimie, aéronautique, automobile — présente des opportunités IA spécifiques : automatisation documentaire portuaire, maintenance prédictive, optimisation supply chain. Notre diagnostic les quantifie pour vous.",
        whyHere: [
          "Le Havre concentre un tissu industriel B2B rare en France : logistique maritime (HAROPA Port, CMA CGM), pétrochimie (TotalEnergies, Yara, Chevron Oronite), aéronautique (Safran Nacelles), automobile (Renault Sandouville), emballage (Sidel) — autant de secteurs où l'IA apporte des gains mesurables sur documentation, maintenance prédictive et optimisation de flux.",
          "Nov@log, unique pôle de compétitivité logistique en France, est basé au Havre. Ses 152 membres TPE/PME/ETI sont précisément le cœur de cible de nos audits IA : automatisation des processus logistiques, traitement documentaire portuaire, optimisation TMS.",
          "Le CRIANN (Centre Régional Informatique et Numérique de Normandie) offre une infrastructure calcul HPC/IA régionale — contexte favorable aux déploiements IA exigeants pour les ETI et GE du bassin.",
          "Nos consultants se déplacent en présentiel au Havre et dans le bassin Seine Estuaire (Gonfreville-l'Orcher, Montivilliers, Harfleur, Octeville-sur-Mer, Sainte-Adresse), avec kick-off et restitution toujours sur site.",
          "Aucun jeu de devis opaque : tarifs publics affichés, vous savez exactement ce que vous payez avant de signer.",
          "Vous gardez le contrôle : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne après notre audit.",
        ],
        methodology: [
          {
            step: "Préparation",
            detail:
              "Un brief de cadrage à distance pour signer le NDA et accéder aux documents clés (organigramme, processus, indicateurs). Identification préalable des cas IA probables selon votre secteur havrais (logistique portuaire, industrie, services).",
          },
          {
            step: "Kick-off sur site",
            detail:
              "Venue dans vos locaux (ville du Havre ou ZIP) pour observer les outils et flux au quotidien : TMS, ERP industriel, gestion documentaire portuaire, CRM, outils bureautiques. Identification des workflows candidats à l'IA.",
          },
          {
            step: "Entretiens collaborateurs",
            detail:
              "Entretiens individuels courts avec vos équipes clés (opérations logistiques, maintenance, finance, RH, direction) pour cartographier frictions, volumes traités et attentes concrètes.",
          },
          {
            step: "Démos sur vos vraies données",
            detail:
              "Sur place : démos de Claude, Mistral, GPT-4 appliquées à vos documents réels (bons de livraison, rapports de maintenance, emails fournisseurs, contrats d'affrètement). Pas de slides théoriques.",
          },
          {
            step: "Restitution + plan d'action",
            detail:
              "Atelier de restitution dans vos locaux. Livrable PDF chiffré ROI/complexité remis en main propre, roadmap actionnable de 6-18 mois calibrée à votre secteur industriel et à votre taille.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE",
            price: "Audit Flash",
            detail:
              "Adapté aux indépendants, micro-entreprises et petits commerces havrais jusqu'à une dizaine de collaborateurs.",
          },
          {
            sizeLabel: "PME",
            price: "Audit Ciblé ou Stratégique PME",
            detail:
              "Idéal pour les PME logistiques, prestataires portuaires, agences, cabinets de quelques dizaines à 250 collaborateurs dans le bassin Seine Estuaire.",
          },
          {
            sizeLabel: "ETI",
            price: "Audit Stratégique ETI",
            detail:
              "Pour les ETI industrielles et de services havraises souhaitant cadrer une trajectoire IA pluriannuelle (logistique, pétrochimie, aéronautique, sous-traitance GE).",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Audit Stratégique ETI étendu",
            detail:
              "Pour les sièges ou sites majeurs grands-comptes de la ZIP (TotalEnergies, Safran Nacelles, Sidel, Renault, CMA CGM) souhaitant cadrer une gouvernance IA centralisée.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA a identifié des automatisations concrètes dans nos processus documentaires portuaires que nous n'aurions pas trouvées seuls. Le livrable est chiffré, actionnable, sans jargon technique. Nous avons pu prioriser nos chantiers IA avec notre direction.",
            role: "Directeur des opérations",
            companyProfile: "PME logistique portuaire, bassin Le Havre, 80 collaborateurs",
          },
          {
            quote:
              "Méthode pragmatique, démos sur nos vrais documents industriels plutôt que des slides génériques. Le plan d'action a directement nourri notre comité de direction sur la maintenance prédictive.",
            role: "Responsable transformation digitale",
            companyProfile: "ETI industrie lourde, Zone Industrialo-Portuaire du Havre",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure un audit IA Axion-IA au Havre ?",
            a: "La durée varie selon le niveau retenu : un Audit Flash se déroule sur une journée, un Audit Stratégique ETI s'étale sur plusieurs semaines. Nous calons avec vous le rythme dès le brief de cadrage, sans imposer un planning prédéfini.",
          },
          {
            q: "Quel ROI identifier pour une PME logistique havraise ?",
            a: "Sur les audits Stratégique PME dans le secteur logistique, les gains les plus fréquents portent sur le traitement documentaire (bons de livraison, CMR, liasses douanières), la qualification de leads transporteurs et la rédaction d'offres. Le livrable chiffre précisément les équivalents temps plein récupérables pour votre cas.",
          },
          {
            q: "Mes données industrielles restent-elles confidentielles pendant l'audit ?",
            a: "Oui. NDA signé avant tout démarrage, données traitées exclusivement sur vos infrastructures, aucune extraction vers nos serveurs. Conformité RGPD, modèles testés en local ou sur infra dédiée chez vous si souveraineté ou secret industriel requis.",
          },
          {
            q: "Pouvez-vous auditer des cas IA spécifiques à la logistique maritime ?",
            a: "Oui. Traitement automatisé de liasses douanières, extraction de données sur manifestes de cargaison, classification de colis non conformes, optimisation de documents d'affrètement — ces cas sont courants dans le tissu portuaire havrais et font partie de nos spécialités sectorielles.",
          },
          {
            q: "Différence avec un audit Big Four ou un cabinet de conseil industriel classique ?",
            a: "Nos consultants sont d'anciens praticiens IA, pas des MBA. Tarifs publics affichés, aucun devis à six chiffres à négocier. Méthode condensée, démos sur vos vraies données industrielles. Et surtout : aucun lock-in — vous repartez avec votre plan, libre de l'exécuter avec qui vous voulez.",
          },
          {
            q: "Faut-il être déjà avancé sur l'IA pour vous solliciter ?",
            a: "Non. La majorité de nos audits au Havre sont commandés par des dirigeants industriels ou des DG de PME qui n'ont jamais lancé de chantier IA. L'audit est précisément fait pour ne pas vous engager dans la mauvaise direction.",
          },
        ],
        guarantees:
          "Engagement contractuel : livrable remis dans les délais convenus à la signature. Conformité RGPD, hébergement données en UE par défaut, DPO sur demande. Aucun lock-in technologique : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne. Si après la restitution vous estimez que le livrable n'apporte pas de valeur actionnable, audit remboursé intégralement (clause activable, jamais activée à ce jour sur nos missions Normandie).",
      },
      en: {
        hero: "Axion-IA's AI audit in Le Havre maps what can be automated in your organisation and quantifies the 12-24 month return on investment. Four tiers from Flash to Mid-cap Strategic cover every size, from Le Havre micro-businesses to large industrial enterprises in the Port Industrial Zone (ZIP). Le Havre's economic fabric — maritime logistics, petrochemicals, aeronautics, automotive — presents specific AI opportunities: port document automation, predictive maintenance, supply chain optimisation. Our diagnosis quantifies these for you.",
        whyHere: [
          "Le Havre hosts a rare B2B industrial fabric: maritime logistics (HAROPA Port, CMA CGM), petrochemicals (TotalEnergies, Yara, Chevron Oronite), aeronautics (Safran Nacelles), automotive (Renault Sandouville), packaging (Sidel) — sectors where AI delivers measurable gains on documentation, predictive maintenance and flow optimisation.",
          "Nov@log, France's only dedicated logistics competitiveness cluster, is headquartered in Le Havre. Its 152 SME/mid-cap members are precisely the core target of our AI audits: logistics process automation, port document processing, TMS optimisation.",
          "CRIANN (Normandy Regional Computing and Digital Centre) provides a regional HPC/AI computing infrastructure — a favourable context for demanding AI deployments for mid-caps and large enterprises in the basin.",
          "Our consultants travel in person to Le Havre and the Seine Estuaire basin (Gonfreville-l'Orcher, Montivilliers, Harfleur, Octeville-sur-Mer, Sainte-Adresse), with kick-off and read-out always on site.",
          "No opaque quote game: public pricing displayed, you know exactly what you pay before signing.",
          "You keep control: your action plan is executable with any vendor or in-house after our audit.",
        ],
        methodology: [
          {
            step: "Preparation",
            detail:
              "Remote framing brief to sign the NDA and access key documents (org chart, processes, KPIs). Prior identification of probable AI cases per your Le Havre sector (port logistics, industry, services).",
          },
          {
            step: "On-site kick-off",
            detail:
              "Visit to your premises (Le Havre city or ZIP) to observe daily tools and flows: TMS, industrial ERP, port document management, CRM, office tools. Identification of AI candidate workflows.",
          },
          {
            step: "Employee interviews",
            detail:
              "Short individual interviews with your key teams (logistics ops, maintenance, finance, HR, leadership) to map frictions, processed volumes and concrete expectations.",
          },
          {
            step: "Demos on your real data",
            detail:
              "On site: demos of Claude, Mistral, GPT-4 applied to your real documents (delivery notes, maintenance reports, supplier emails, charter contracts). No theoretical slides.",
          },
          {
            step: "Read-out + action plan",
            detail:
              "Read-out workshop at your premises. Costed PDF deliverable handed over, actionable 6-18 month roadmap calibrated to your industrial sector and size.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business",
            price: "Flash audit",
            detail:
              "Suited to Le Havre freelancers, micro-firms and small traders up to about ten staff.",
          },
          {
            sizeLabel: "SME",
            price: "Targeted or SME Strategic audit",
            detail:
              "Ideal for logistics SMEs, port service providers, agencies and firms from a few dozen to 250 staff in the Seine Estuaire basin.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap Strategic audit",
            detail:
              "For Le Havre industrial and service mid-caps framing a multi-year AI trajectory (logistics, petrochemicals, aeronautics, large-company subcontracting).",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Extended Mid-cap Strategic audit",
            detail:
              "For ZIP large-account HQs or major sites (TotalEnergies, Safran Nacelles, Sidel, Renault, CMA CGM) framing centralised AI governance.",
          },
        ],
        testimonials: [
          {
            quote:
              "Axion-IA identified concrete automations in our port document processes that we would not have found alone. The deliverable is costed, actionable, jargon-free. We were able to prioritise our AI initiatives with our leadership.",
            role: "Head of Operations",
            companyProfile: "Port logistics SME, Le Havre basin, 80 staff",
          },
          {
            quote:
              "Pragmatic method, demos on our real industrial documents rather than generic slides. The action plan directly fed our executive committee on predictive maintenance.",
            role: "Digital Transformation Manager",
            companyProfile: "Heavy industry mid-cap, Le Havre Port Industrial Zone",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA AI audit take in Le Havre?",
            a: "Duration varies by tier: a Flash audit runs over a day, a Mid-cap Strategic audit spans several weeks. We agree on the cadence at the framing brief, without imposing a preset schedule.",
          },
          {
            q: "What ROI to expect for a Le Havre logistics SME?",
            a: "On SME Strategic audits in the logistics sector, the most frequent gains relate to document processing (delivery notes, CMR, customs dossiers), carrier lead qualification and tender writing. The deliverable quantifies precisely the FTEs recoverable for your case.",
          },
          {
            q: "Does my industrial data stay confidential during the audit?",
            a: "Yes. NDA signed before kick-off, data processed exclusively on your infrastructure, no extraction to our servers. GDPR compliance, models tested locally or on dedicated infra at your premises if sovereignty or trade secret is required.",
          },
          {
            q: "Can you audit AI cases specific to maritime logistics?",
            a: "Yes. Automated processing of customs dossiers, data extraction from cargo manifests, classification of non-compliant shipments, optimisation of chartering documents — these cases are common in the Le Havre port fabric and are among our sector specialities.",
          },
          {
            q: "Difference with a Big Four audit or a traditional industrial consultancy?",
            a: "Our consultants are former AI practitioners, not MBAs. Public pricing displayed, no six-figure quote to negotiate. Condensed method, demos on your real industrial data. And above all: no lock-in — you leave with your plan, free to execute with whoever you want.",
          },
          {
            q: "Do I need AI maturity to engage you?",
            a: "No. Most of our Le Havre audits are ordered by industrial executives or SME managers who have never launched an AI initiative. The audit exists precisely to avoid going in the wrong direction.",
          },
        ],
        guarantees:
          "Contractual commitment: deliverable handed over within the timeline agreed at signature. GDPR compliance, EU data hosting by default, DPO on request. No tech lock-in: your action plan is executable with any vendor or in-house. If after the read-out you feel the deliverable lacks actionable value, audit fully refunded (clause available but never triggered to date on our Normandy missions).",
      },
    },

    interventions: {
      fr: {
        hero: "Les interventions IA Axion-IA au Havre se déclinent en formats sur site d'une à plusieurs journées selon vos équipes. Vos collaborateurs ne repartent pas avec des slides : ils repartent avec des outils IA installés sur leur poste, configurés pour leur travail réel — gestion documentaire portuaire, rédaction d'offres logistiques, comptes-rendus de réunion, qualification de leads. Frais de logement, repas et forfait trajet facturés à part.",
        whyHere: [
          "Le Havre est un pôle industriel B2B à fort potentiel IA : les équipes logistiques, opérationnelles et administratives des entreprises de la ZIP et du tissu PME havrais sont régulièrement sollicitées sur des tâches documentaires chronophages (CMR, manifestes, offres de prix, reporting ERP).",
          "Toutes les zones couvertes en présentiel : ville du Havre, Zone Industrialo-Portuaire, Gonfreville-l'Orcher, Montivilliers, Harfleur, Octeville-sur-Mer, Sainte-Adresse, Saint-Romain-de-Colbosc.",
          "Le format Essentielle est calibré pour les TPE et PME havraises de quelques personnes à une centaine de collaborateurs.",
          "Le format Équipes permet de focaliser sur un département clé : équipe logistique, service commercial, ADV, RH, bureau d'études technique.",
          "Le format Dirigeants permet un cadrage IA en huis-clos pour les comités de direction d'ETI et grandes entreprises industrielles.",
          "Vocabulaire ajusté à votre secteur dominant : logistique maritime, pétrochimie, aéronautique, services B2B portuaires. Pas de session générique recyclée.",
        ],
        methodology: [
          {
            step: "Cadrage de la session",
            detail:
              "Un échange à distance avec votre RH ou direction pour cibler le profil des participants, votre secteur métier (logistique, industrie, services), et les cas d'usage prioritaires pour vos équipes havraises.",
          },
          {
            step: "Préparation des démos",
            detail:
              "Nous récupérons quelques documents anonymisés représentatifs de votre activité (bons de livraison, offres commerciales, comptes-rendus, emails clients/fournisseurs) pour calibrer les démos sur VOS données réelles.",
          },
          {
            step: "Arrivée et installation",
            detail:
              "Nos consultants arrivent en avance dans vos locaux pour vérifier matériel, projection, accès Wi-Fi. Pas d'aléa technique le jour J, que ce soit dans la ville du Havre ou dans la ZIP.",
          },
          {
            step: "Session pédagogique",
            detail:
              "Selon le format choisi, alternance de théorie courte et de démos longues sur VOS données, suivies d'ateliers participatifs adaptés aux métiers de vos équipes (logistique, commercial, technique, administratif).",
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
              "Idéal pour les indépendants, petites agences et PME havraises jusqu'à une dizaine de collaborateurs.",
          },
          {
            sizeLabel: "PME",
            price: "Format Essentielle ou Équipes",
            detail:
              "Essentielle pour le groupe entier ou Équipes pour focaliser sur un département (logistique, commercial, ADV, RH, technique).",
          },
          {
            sizeLabel: "ETI",
            price: "Format Conférence ou Dirigeants",
            detail:
              "Plénière pour grandes audiences industrielles ou huis-clos comité de direction selon votre objectif.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Format personnalisé multi-formats",
            detail:
              "Combinaisons sur-mesure pour les grandes entreprises de la ZIP : roadshow multi-sites, séminaires CODIR + cascade équipes opérationnelles.",
          },
        ],
        testimonials: [
          {
            quote:
              "Format Équipes parfaitement calibré pour notre service logistique : nos collaborateurs repartent avec des outils IA installés sur leurs postes et des automatisations concrètes pour le traitement de leurs documents quotidiens. Le lendemain, ils les utilisaient déjà.",
            role: "Responsable logistique",
            companyProfile: "PME transport et logistique portuaire, Le Havre, 60 collaborateurs",
          },
          {
            quote:
              "La session dirigeants nous a permis d'aligner notre comité de direction sur les priorités IA en quelques heures. Pragmatique, ancré dans nos réalités industrielles havraises, sans discours théorique.",
            role: "Directeur général",
            companyProfile: "ETI industrie et services, bassin Seine Estuaire",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une intervention Axion-IA au Havre ?",
            a: "Cela dépend du format choisi. L'Essentielle se déroule sur une journée, l'Approfondie sur deux journées consécutives. La Conférence et le format Dirigeants tiennent sur une journée. Pour un programme multi-formats, le rythme est défini ensemble en cadrage.",
          },
          {
            q: "Quelle taille de groupe pouvez-vous accueillir ?",
            a: "L'Essentielle accueille jusqu'à une centaine de collaborateurs en interaction. Au-delà, le format Conférence est plus adapté avec un schéma plénière + ateliers en sous-groupes.",
          },
          {
            q: "Les outils installés restent-ils utilisables après la session ?",
            a: "Oui, ce sont des comptes individuels (gratuits ou avec abonnement employé) sur ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity selon le profil. Aucun lock-in Axion-IA, vous gardez la main.",
          },
          {
            q: "Pouvez-vous adapter le contenu aux métiers portuaires et logistiques ?",
            a: "Oui systématiquement. Le brief de cadrage nous permet d'ajuster vocabulaire, exemples et démos. Une session pour un prestataire logistique maritime n'a rien à voir avec une session pour un cabinet de services. Nous travaillons sur vos vrais documents de travail.",
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
          "Créneau garanti dès la confirmation de réservation. En cas de problème technique de notre fait, session reportée et compensation. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain matin sur les outils installés, séance de remédiation offerte. Vocabulaire ajusté à votre secteur industriel havrais, aucune session générique recyclée.",
      },
      en: {
        hero: "Axion-IA's AI sessions in Le Havre come in on-site formats from one to several days depending on your teams. Your staff don't leave with slides: they leave with AI tools installed on their workstations, configured for their real work — port document management, logistics tender writing, meeting minutes, lead qualification. Lodging, meals and travel allowance billed separately.",
        whyHere: [
          "Le Havre is a high-potential B2B industrial hub for AI: logistics, operational and administrative teams in ZIP enterprises and the Le Havre SME fabric regularly face time-consuming document tasks (CMR, manifests, price offers, ERP reporting).",
          "All zones covered in person: Le Havre city, Port Industrial Zone, Gonfreville-l'Orcher, Montivilliers, Harfleur, Octeville-sur-Mer, Sainte-Adresse, Saint-Romain-de-Colbosc.",
          "The Essential format is calibrated for Le Havre micro-businesses and SMEs from a few people to about a hundred staff.",
          "The Teams format focuses on a key department: logistics team, sales department, customer service, HR, technical office.",
          "The Executives format enables an AI framing in-camera for industrial mid-cap and large enterprise executive committees.",
          "Vocabulary adjusted to your dominant sector: maritime logistics, petrochemicals, aeronautics, port B2B services. No recycled generic session.",
        ],
        methodology: [
          {
            step: "Session framing",
            detail:
              "Remote exchange with your HR or leadership to target participant profile, sector (logistics, industry, services), and priority use cases for your Le Havre teams.",
          },
          {
            step: "Demo preparation",
            detail:
              "We collect a few anonymized documents representative of your activity (delivery notes, commercial offers, meeting minutes, client/supplier emails) to calibrate demos on YOUR real data.",
          },
          {
            step: "Arrival and setup",
            detail:
              "Our consultants arrive ahead of time at your premises to check equipment, projection, Wi-Fi access. No technical hiccup on D-day, whether in Le Havre city or the ZIP.",
          },
          {
            step: "Pedagogical session",
            detail:
              "Depending on the chosen format, alternation of short theory and longer demos on YOUR data, followed by participatory workshops adapted to your teams' roles (logistics, commercial, technical, administrative).",
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
            detail: "Ideal for Le Havre freelancers, small agencies and SMEs up to about ten staff.",
          },
          {
            sizeLabel: "SME",
            price: "Essential or Teams format",
            detail:
              "Essential for the whole group or Teams to focus on a department (logistics, sales, customer service, HR, technical).",
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
              "Custom combinations for ZIP large enterprises: multi-site roadshows, exec committee + operational team cascade seminars.",
          },
        ],
        testimonials: [
          {
            quote:
              "Teams format perfectly calibrated for our logistics department: our staff left with AI tools installed on their workstations and concrete automations for their daily document processing. The next day, they were already using them.",
            role: "Head of Logistics",
            companyProfile: "Port logistics and transport SME, Le Havre, 60 staff",
          },
          {
            quote:
              "The executive session aligned our leadership committee on AI priorities within hours. Pragmatic, grounded in our Le Havre industrial realities, no theoretical discourse.",
            role: "General Manager",
            companyProfile: "Industry and services mid-cap, Seine Estuaire basin",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA session in Le Havre take?",
            a: "It depends on the chosen format. The Essential runs over a day, the Deep Dive over two consecutive days. The Talk and Executives format fit in a day. For a multi-format program, the rhythm is defined together at framing.",
          },
          {
            q: "What group size can you handle?",
            a: "The Essential handles up to about a hundred staff in interaction. Beyond that, the Talk format is more suitable with a plenary + sub-group workshops.",
          },
          {
            q: "Do the tools installed remain usable after the session?",
            a: "Yes, they are individual accounts (free or with employee subscription) on ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity per profile. No Axion-IA lock-in, you keep control.",
          },
          {
            q: "Can you adapt content to port and logistics professions?",
            a: "Yes systematically. The framing brief lets us adjust vocabulary, examples and demos. A session for a maritime logistics provider has nothing to do with one for a service firm. We work on your actual work documents.",
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
          "Slot guaranteed upon booking confirmation. In case of our technical issue, session rebooked and compensation provided. Operational tools same evening: if your staff aren't autonomous next morning on installed tools, free remediation session offered. Vocabulary adjusted to your Le Havre industrial sector, no recycled generic session.",
      },
    },

    implementation: {
      fr: {
        hero: "L'implémentation IA Axion-IA au Havre met vos cas IA en production avec un retour sur investissement chiffré contractuellement, formation de vos équipes incluse. Le mode est hybride sur site / distance, avec un kick-off obligatoire dans vos locaux havrais ou de la ZIP. Cas typiques havrais : automatisation documentaire portuaire, maintenance prédictive sur équipements industriels, optimisation des flux supply chain, génération d'offres commerciales logistiques.",
        whyHere: [
          "Le Havre concentre des cas IA à fort ROI potentiel : traitement automatisé de liasses douanières et CMR (logistique), analyse de données capteurs pour maintenance prédictive (industrie lourde, aéronautique), génération d'offres de fret (armateurs, commissionnaires), extraction d'informations sur contrats d'affrètement.",
          "Le kick-off se passe systématiquement en présentiel dans vos locaux (ville du Havre ou ZIP) : alignement des équipes, accès aux données industrielles, validation des intégrations ERP/TMS/CRM.",
          "Itérations à distance avec un point quotidien court en visio et une visite mensuelle pour démos d'avancement avec votre comité de direction ou direction technique.",
          "Recette finale toujours en présentiel : passation de pouvoir, formation des ambassadeurs internes sur leur poste, documentation runbook remise.",
          "Formation incluse pour vos collaborateurs identifiés clés : ils deviennent les ambassadeurs IA internes, autonomes après la fin de mission.",
          "Cas validés dans le tissu industriel normand : optimisation de reporting ERP pour PME industrielles, automatisation de la documentation qualité, agents support pour services clients logistiques.",
        ],
        methodology: [
          {
            step: "Cadrage technique",
            detail:
              "Atelier sur site au Havre : revue de l'architecture cible (ERP industriel, TMS, WMS, CRM, emails, stockage), validation des contraintes RGPD/sécurité industrielle, sélection finale des modèles IA, signature du SOW chiffré.",
          },
          {
            step: "Kick-off + sprint initial",
            detail:
              "Plusieurs jours sur site : installation des accès, déploiement de l'environnement de développement, première intégration end-to-end fonctionnelle (POC), validation avec votre équipe technique ou opérationnelle.",
          },
          {
            step: "Itérations",
            detail:
              "Travail à distance avec un point quotidien court : enrichissement progressif des cas, intégration aux outils existants (ERP industriel, TMS, WMS), tests sur volumes réels de données industrielles, ajustements métier.",
          },
          {
            step: "Recette + formation",
            detail:
              "Sur site au Havre : tests d'acceptation utilisateurs, formation des ambassadeurs internes (équipe logistique, maintenance, ADV selon cas), livraison du runbook documentation, plan de monitoring.",
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
            price: "POC",
            detail:
              "Implémentation d'un cas d'usage simple (traitement de documents, automatisation emails, qualification leads) pour les TPE et petites PME havraises.",
          },
          {
            sizeLabel: "PME",
            price: "Mission PME",
            detail:
              "Déploiement de plusieurs cas d'usage, formation d'ambassadeurs internes, intégration ERP/TMS. Pour les PME logistiques, industrielles et de services du bassin Seine Estuaire.",
          },
          {
            sizeLabel: "ETI",
            price: "Mission ETI",
            detail:
              "Déploiement transverse, gouvernance IA, intégrations avancées (ERP industriel legacy, SCADA, datalake), formation cross-département. Pour les ETI de la ZIP et du tissu industriel normand.",
          },
          {
            sizeLabel: "Grande entreprise",
            price: "Grand programme multi-déploiement",
            detail:
              "Programmes annuels pour les grands comptes havrais (TotalEnergies, Safran, Renault, CMA CGM, Sidel) : cas d'usage cascadés, gouvernance IA centralisée, équipe dédiée Axion-IA en mode régie.",
          },
        ],
        testimonials: [
          {
            quote:
              "Implémentation automatisation documentaire livrée comme promis. ROI mesuré dès les premiers mois : notre équipe ADV a récupéré du temps sur le traitement des bons de livraison et des CMR. Aucun lock-in, on a la main sur les modèles.",
            role: "Directeur administratif et financier",
            companyProfile: "ETI logistique portuaire, bassin Le Havre, 350 collaborateurs",
          },
          {
            quote:
              "Méthode hybride adaptée à nos contraintes industrielles : kick-off sur site, puis itérations à distance. Notre équipe maintenance utilise maintenant les alertes prédictives au quotidien. Les ambassadeurs internes ont pris le relais de façon autonome.",
            role: "Directeur technique",
            companyProfile: "Site industriel ZIP Le Havre, grande entreprise",
          },
        ],
        faq: [
          {
            q: "Combien de temps dure une implémentation Axion-IA au Havre ?",
            a: "Cela dépend de l'ampleur. Un POC pour TPE peut tenir en quelques semaines, une mission PME standard sur quelques mois, une mission ETI transverse sur plusieurs mois, un grand programme multi-déploiement sur une année ou plus. Le SOW signé en cadrage fixe le calendrier précis.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour la grande majorité de nos missions havraises. SOW signé au début avec scope précis et livrables définis. Si le scope change en cours, avenant explicite + nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Qui maintient la solution après la mission ?",
            a: "Vos ambassadeurs internes, formés pendant la mission. Documentation runbook complète remise. Si maintenance externalisée souhaitée, contrat de support optionnel. Aucun lock-in : vous pouvez aussi externaliser ailleurs.",
          },
          {
            q: "Mes données industrielles restent-elles chez nous ou partent-elles chez Axion-IA ?",
            a: "Toujours chez vous. Modèles IA déployés sur votre infra (cloud privé, on-premise, serveur dédié) ou sur infra dédiée UE si vous préférez. NDA signé en cadrage, RGPD strict, confidentialité industrielle garantie, DPO sur demande.",
          },
          {
            q: "Quels modèles IA utilisez-vous ?",
            a: "Mix selon le cas : open-source (Mistral, Llama) pour la souveraineté ou le coût ; propriétaires (GPT, Claude, Gemini) pour la qualité ; parfois fine-tuning sur vos données industrielles si le volume le justifie. Choix justifié dans le SOW, jamais imposé.",
          },
          {
            q: "Que se passe-t-il si l'IA produit des erreurs sur des documents critiques ?",
            a: "Tous nos déploiements incluent une couche de validation : seuils de confiance, double-check humain pour les cas sensibles (douane, contrats d'affrètement, maintenance critique), monitoring continu des métriques. Le ROI chiffré au SOW intègre une marge d'erreur réaliste, pas un scénario parfait.",
          },
        ],
        guarantees:
          "Forfait fixe sur SOW : pas de dérive horaire cachée. Livraison dans les délais convenus à la signature, avec compensation contractuelle en cas de retard de notre fait. ROI chiffré contractuel : si après une année de production le ROI réel mesuré reste très en deçà de la prédiction du SOW, audit gratuit pour identifier la cause + ajustement déploiement offert. Aucun lock-in technologique : vos modèles, vos données, votre runbook. Vos ambassadeurs internes formés sont autonomes après go-live.",
      },
      en: {
        hero: "Axion-IA's AI implementation in Le Havre brings your AI cases to production with contractually-costed ROI, team training included. Mode is hybrid on-site / remote, with a mandatory kick-off at your Le Havre or ZIP premises. Typical Le Havre cases: port document automation, predictive maintenance on industrial equipment, supply chain flow optimisation, logistics commercial offer generation.",
        whyHere: [
          "Le Havre concentrates AI cases with high potential ROI: automated processing of customs dossiers and CMR (logistics), sensor data analysis for predictive maintenance (heavy industry, aeronautics), freight offer generation (ship owners, freight forwarders), information extraction from charter contracts.",
          "Kick-off always happens in person at your premises (Le Havre city or ZIP): team alignment, industrial data access, ERP/TMS/CRM integration validation.",
          "Remote iterations with a short daily video and a monthly on-site visit for progress demos with your executive committee or technical leadership.",
          "Final acceptance always in person: handover, training of internal ambassadors on their workstations, runbook documentation delivered.",
          "Training included for your identified key staff: they become internal AI ambassadors, autonomous after mission end.",
          "Validated cases in the Normandy industrial fabric: ERP reporting optimisation for industrial SMEs, quality documentation automation, support agents for logistics customer services.",
        ],
        methodology: [
          {
            step: "Technical framing",
            detail:
              "On-site Le Havre workshop: target architecture review (industrial ERP, TMS, WMS, CRM, emails, storage), GDPR/industrial security constraints validation, AI model final selection, costed SOW signed.",
          },
          {
            step: "Kick-off + initial sprint",
            detail:
              "Several days on site: access install, dev environment deployment, first end-to-end functional integration (POC), validation with your technical or operational team.",
          },
          {
            step: "Iterations",
            detail:
              "Remote work with a short daily: progressive case enrichment, integration with existing tools (industrial ERP, TMS, WMS), real industrial data volume testing, business adjustments.",
          },
          {
            step: "Acceptance + training",
            detail:
              "On site in Le Havre: user acceptance tests, training of internal ambassadors (logistics, maintenance, customer service teams per case), runbook documentation delivery, monitoring plan.",
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
            price: "POC",
            detail:
              "Implementation of a simple use case (document processing, email automation, lead qualification) for Le Havre micro-businesses and small SMEs.",
          },
          {
            sizeLabel: "SME",
            price: "SME mission",
            detail:
              "Deployment of several use cases, training of internal ambassadors, ERP/TMS integration. For logistics, industrial and service SMEs in the Seine Estuaire basin.",
          },
          {
            sizeLabel: "Mid-cap",
            price: "Mid-cap mission",
            detail:
              "Transverse deployment, AI governance, advanced integrations (legacy industrial ERP, SCADA, datalake), cross-department training. For ZIP and Normandy industrial mid-caps.",
          },
          {
            sizeLabel: "Large enterprise",
            price: "Multi-deployment large program",
            detail:
              "Annual programs for Le Havre large accounts (TotalEnergies, Safran, Renault, CMA CGM, Sidel): cascaded use cases, centralised AI governance, dedicated Axion-IA team in retainer mode.",
          },
        ],
        testimonials: [
          {
            quote:
              "Document automation implementation delivered as promised. ROI measured from the first months: our customer service team recovered time on delivery note and CMR processing. No lock-in, we control our models.",
            role: "CFO",
            companyProfile: "Port logistics mid-cap, Le Havre basin, 350 staff",
          },
          {
            quote:
              "Hybrid method adapted to our industrial constraints: on-site kick-off, then remote iterations. Our maintenance team now uses predictive alerts daily. Internal ambassadors took over autonomously.",
            role: "Technical Director",
            companyProfile: "ZIP Le Havre industrial site, large enterprise",
          },
        ],
        faq: [
          {
            q: "How long does an Axion-IA implementation in Le Havre take?",
            a: "It depends on scope. A micro-business POC fits in a few weeks, a standard SME mission spans a few months, a transverse mid-cap mission spans several months, a multi-deployment large program spans a year or more. The SOW signed at framing fixes the precise schedule.",
          },
          {
            q: "Is the price fixed or time-based?",
            a: "Fixed flat-rate for the vast majority of our Le Havre missions. SOW signed at the start with precise scope and defined deliverables. If scope changes mid-mission, explicit amendment + new estimate. No hidden hourly drift.",
          },
          {
            q: "Who maintains the solution after the mission?",
            a: "Your internal ambassadors, trained during the mission. Complete runbook documentation handed over. If outsourced maintenance desired, optional support contract. No lock-in: you can also outsource elsewhere.",
          },
          {
            q: "Does my industrial data stay with us or move to Axion-IA?",
            a: "Always with you. AI models deployed on your infra (private cloud, on-premise, dedicated server) or on dedicated EU infra if you prefer. NDA signed at framing, strict GDPR, industrial confidentiality guaranteed, DPO on request.",
          },
          {
            q: "Which AI models do you use?",
            a: "Mix per case: open-source (Mistral, Llama) for sovereignty or cost; proprietary (GPT, Claude, Gemini) for top quality; sometimes fine-tuning on your industrial data if volume justifies. Choice justified in SOW, never imposed.",
          },
          {
            q: "What happens if the AI produces errors on critical documents?",
            a: "All our deployments include a validation layer: confidence thresholds, human double-check for sensitive cases (customs, charter contracts, critical maintenance), continuous metrics monitoring. The costed ROI in SOW includes realistic margin of error, not a perfect scenario.",
          },
        ],
        guarantees:
          "Fixed flat-rate on SOW: no hidden hourly drift. Delivery within the timeline agreed at signature, with contractual compensation in case of our delay. Contractual costed ROI: if after a year of production the real measured ROI stays significantly below the SOW prediction, free audit to identify the cause + offered deployment adjustment. No tech lock-in: your models, your data, your runbook. Your trained internal ambassadors are autonomous after go-live.",
      },
    },
  },

  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel au Havre ?",
      a: "Le tarif dépend du niveau retenu — Audit Flash, Ciblé, Stratégique PME ou Stratégique ETI. Tarifs publics affichés sur la page Audit, choix calibré selon votre taille (TPE, PME, ETI, grande entreprise) et votre périmètre industriel. Aucun supplément géographique : le tarif est le même au Havre qu'en Île-de-France.",
    },
    {
      q: "Avez-vous des références clients au Havre ou en Seine Estuaire ?",
      a: "Oui. Nous accompagnons des PME logistiques portuaires, des prestataires industriels de la ZIP et des ETI de services du bassin Seine Estuaire. Les cas concrets sont consultables dans la rubrique Cas concrets, filtrables par secteur et zone d'intervention.",
    },
    {
      q: "Quels secteurs prioritaires au Havre pour l'IA ?",
      a: "Nos déploiements havrais couvrent en priorité la logistique maritime (traitement documentaire portuaire, TMS, CMR), l'industrie lourde (maintenance prédictive, documentation qualité), les services aux entreprises (juridique, RH, ADV) et le négoce (génération d'offres, qualification leads). Tout secteur B2B est éligible à un audit.",
    },
    {
      q: "Pouvez-vous intervenir sur site dans la Zone Industrialo-Portuaire du Havre ?",
      a: "Oui. Toutes nos interventions au Havre sont par défaut sur site, dans vos locaux — ville du Havre, ZIP, Gonfreville-l'Orcher, Montivilliers, Harfleur ou communes voisines du bassin. Nos consultants se déplacent dans l'ensemble du bassin Seine Estuaire.",
    },
    {
      q: "Travaillez-vous avec les entreprises du pôle Nov@log au Havre ?",
      a: "Oui. Nov@log — unique pôle de compétitivité logistique en France, basé au Havre — regroupe 152 membres PME et ETI dont plusieurs font partie de nos références dans la logistique et la supply chain. Nos audits et implémentations adressent directement les cas IA prioritaires du secteur : automatisation documentaire, optimisation TMS, traçabilité.",
    },
    {
      q: "En combien de temps pouvez-vous démarrer une mission au Havre ?",
      a: "Le délai dépend de votre besoin (urgence, complexité, taille de la mission) et de notre disponibilité calendaire. Nous calons une date de démarrage avec vous lors du brief de cadrage initial et tenons l'engagement contractuel à la signature.",
    },
  ],
};
