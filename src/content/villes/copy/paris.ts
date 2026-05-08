// Paris — contenu éditorial gold standard (Sprint 14.9, doctrine v3.2).
// Curaté manuellement par Will. Sera la référence pour la phase LLM
// d'industrialisation (50 villes top en sem 1-2). Le script `import-insee-villes.ts`
// ne touche pas ce fichier.
import type { VilleCopy } from "./types";

export const PARIS_COPY: VilleCopy = {
  pitchFr:
    "Capitale économique européenne, Paris concentre 215 000 entreprises actives, le siège des grands groupes français et l'écosystème IA national (Mistral, Hugging Face, Station F). AxionIA y intervient sur site dans Paris intra-muros et toute l'Île-de-France, des cabinets indépendants aux directions IA des grands comptes.",
  pitchEn:
    "Europe's economic capital, Paris hosts 215,000 active businesses, headquarters of major French groups and the national AI ecosystem (Mistral, Hugging Face, Station F). AxionIA delivers on-site engagements throughout Paris and Greater Paris, from independent firms to AI leadership of large corporates.",
  servicesContext: {
    audit: {
      fr: "Audit IA à Paris : pôle prioritaire d'AxionIA. 4 niveaux (Flash 490 € HT, Ciblé 1 900-3 900 €, Stratégique PME 4 900-9 900 €, Stratégique ETI dès 12 000 €). Délai moyen entre signature et kick-off : 5-10 jours ouvrés. Aucun frais de déplacement intra-muros ni petite couronne.",
      en: "AI audit in Paris: AxionIA priority hub. 4 tiers (Flash €490, Targeted €1,900-3,900, SME Strategic €4,900-9,900, Mid-cap Strategic from €12,000). Average lead time between signature and kick-off: 5-10 business days. No travel fees within Paris and inner suburbs.",
    },
    interventions: {
      fr: "Interventions IA à Paris : 5 formats (Essentielle 490 € HT 1 journée, Équipes, Managers, Conférence ½ journée, Dirigeants). Disponibles dans les 20 arrondissements, La Défense, première couronne (Levallois, Boulogne, Issy, Neuilly). Démos sur vos vraies données, jusqu'à 100 collaborateurs par session.",
      en: "AI sessions in Paris: 5 formats (Essential €490 1 day, Teams, Managers, Half-day talk, Executives). Available across all 20 arrondissements, La Défense, inner suburbs (Levallois, Boulogne, Issy, Neuilly). Demos on your real data, up to 100 collaborators per session.",
    },
    implementation: {
      fr: "Implémentation IA à Paris : mise en production en 6-12 semaines, ROI chiffré, formation incluse. Hybride sur site / distance, kick-off à Paris obligatoire. Cas typiques parisiens : lecture de factures, comptes-rendus de réunions automatisés, qualification IA des leads, agents conversationnels CRM/ERP.",
      en: "AI implementation in Paris: production deployment in 6-12 weeks, costed ROI, training included. Hybrid on-site / remote, kick-off in Paris required. Typical Paris cases: invoice reading, automated meeting minutes, AI lead qualification, CRM/ERP conversational agents.",
    },
  },
  directAnswerFr:
    "AxionIA est un cabinet IA opérationnel basé en UE qui intervient à Paris (75) sur site dans les 20 arrondissements et la première couronne. Nous accompagnons toutes tailles d'entreprise — TPE, PME, ETI, grandes entreprises (sièges La Défense, 8e, 16e) et startups parisiennes (Station F, French Tech) — sur leurs cas IA opérationnels : diagnostic 5 jours, démos sur vos vraies données, plan d'action chiffré. Tarif public dès 490 € HT pour l'intervention essentielle 1 journée. Aucun lock-in technologique.",
  directAnswerEn:
    "AxionIA is an EU-based operational AI consultancy delivering on-site engagements across all 20 Paris arrondissements and the inner suburbs. We support every company size — micro-businesses, SMEs, mid-caps, large enterprises (La Défense, 8th, 16th HQs) and startups (Station F, French Tech) — on their operational AI use cases: 5-day diagnosis, demos on your real data, costed action plan. Public pricing from €490 for the 1-day essential engagement. No tech lock-in.",
  topSectorsNaf: [
    "Banque & Finance",
    "Conseil & Services aux entreprises",
    "Tech & Édition logicielle",
    "Édition, Médias & Communication",
    "Mode & Luxe",
    "Tourisme & Hôtellerie premium",
  ],
  distancesFr:
    "Gares Montparnasse, du Nord, de Lyon et Saint-Lazare au cœur de Paris ; Roissy-Charles-de-Gaulle à 45 km, Orly à 25 km. Métro 14 lignes + RER A/B/C/D/E. Interventions sur site possibles en demi-journée depuis n'importe quel arrondissement.",
  distancesEn:
    "Montparnasse, Gare du Nord, Gare de Lyon and Saint-Lazare stations in central Paris; Roissy-Charles-de-Gaulle 45 km, Orly 25 km. Métro 14 lines + RER A/B/C/D/E. Half-day on-site engagements from any arrondissement.",
  ecosystemFr:
    "Tissu B2B le plus dense de France toutes tailles confondues — micro-entreprises et indépendants (215 000 actives intra-muros), PME et ETI (cabinets d'expertise, scale-ups, ETI conseil), sièges grandes entreprises (La Défense, 8e, 16e), pôle deep-tech (Station F, Quai d'Innovation, écoles d'ingénieurs). L'écosystème IA français y est concentré : Mistral AI, Hugging Face, Owkin, Photoroom, Dust. Les directions IA des grands groupes pilotent leurs déploiements depuis ces sièges.",
  ecosystemEn:
    "Densest B2B fabric in France across every company size — micro-businesses and independents (215,000 active within Paris), SMEs and mid-caps (expertise firms, scale-ups, mid-cap consulting), large-enterprise HQs (La Défense, 8th, 16th districts), deep-tech hub (Station F, Quai d'Innovation, engineering schools). The French AI ecosystem clusters here: Mistral AI, Hugging Face, Owkin, Photoroom, Dust. Major-group AI leadership steers deployments from these headquarters.",
  heroSchema: {
    centerSubLabel: "215 K entreprises actives",
    satellites: [
      { label: "La Défense", detail: "1ère place tertiaire EU", accent: "primary" },
      { label: "Station F", detail: "1 000+ startups deep-tech", accent: "terracotta" },
      { label: "Banque · Finance", detail: "Sièges + family offices", accent: "mocha" },
      { label: "Conseil · Audit", detail: "Cabinets stratégie", accent: "primary" },
      { label: "Tech · SaaS", detail: "Mistral, Hugging Face", accent: "sage" },
      { label: "Mode · Luxe", detail: "Maisons + cosmétique", accent: "terracotta" },
    ],
  },
  // === SERVICES LONG-FORM PARIS — perfection extrême Sprint 14.10.1 ===
  // Alimente :
  //   - Sections détaillées sur la page mère /implantations/ile-de-france/paris
  //   - Pages dédiées /audit/paris, /interventions/paris, /implementation/paris
  // Cap : ~500-700 mots par service × 2 locales = ~3500 mots services seulement.
  services: {
    audit: {
      fr: {
        hero: "Audit IA d'entreprise à Paris (75) : AxionIA cartographie en 5 à 10 jours ouvrés tous les workflows automatisables de votre organisation parisienne, avec un livrable PDF de 25-40 pages chiffré ROI à 12-24 mois. Quatre niveaux disponibles à Paris (Flash 490 € HT, Ciblé 1 900-3 900 €, Stratégique PME 4 900-9 900 €, Stratégique ETI dès 12 000 €), tous frais de déplacement intra-Paris et petite couronne inclus. Démarrage moyen sous 5 à 10 jours ouvrés depuis la signature, créneaux courts disponibles pour contraintes Q+1 budget ou CODIR.",
        whyHere: [
          "Pôle prioritaire #1 d'AxionIA : 60 % de nos audits sont déclenchés à Paris ou en Île-de-France (215 000 entreprises actives intra-muros, recensement Sirene 2024).",
          "Frais de déplacement intégrés au forfait pour Paris intra-muros, La Défense, Levallois, Boulogne, Issy, Neuilly et toute la première couronne — pas de coûts cachés.",
          "Délai signature → kick-off : 5 à 10 jours ouvrés en moyenne (vs 4-6 semaines chez les Big Four). Créneau court < 5 jours réservable sur Paris.",
          "Tissu B2B parisien sur-représenté dans nos cas clients : cabinets d'expertise comptable, family offices, asset managers, ETI conseil 8e/9e/16e, scale-ups SaaS Sentier-République, maisons de mode Marais.",
          "Nos consultants sont basés à Paris : déplacement même jour possible, ateliers présentiels les lundis/mardis/jeudis sans surcoût.",
          "Restitutions toujours en présentiel à Paris : ateliers d'idéation, lecture du livrable avec votre CODIR, plan d'attaque transmis main à main.",
        ],
        methodology: [
          {
            step: "1. Préparation (J-5 à J-1)",
            detail:
              "Brief de cadrage 90 min en visio, signature NDA, accès aux 5-10 documents clés (organigramme, processus, KPIs). Aucun déplacement à ce stade — on prépare le terrain.",
          },
          {
            step: "2. Kick-off sur site (J1)",
            detail:
              "Demi-journée présentielle dans vos bureaux parisiens. Tour du tissu humain, observation des outils utilisés au quotidien, identification des 8-12 workflows candidats à l'IA.",
          },
          {
            step: "3. Entretiens collaborateurs (J2-J3)",
            detail:
              "12 entretiens individuels de 30 min sur site (commerciaux, finance, RH, ops, support, direction). Cartographie fine des frictions, attentes, contraintes RGPD/sécurité.",
          },
          {
            step: "4. Démos sur vos vraies données (J4)",
            detail:
              "Sur place dans vos locaux : démos Claude/Mistral/GPT-4 appliquées à 3 cas concrets identifiés. Vous voyez littéralement l'IA traiter vos PDFs, vos emails, vos factures.",
          },
          {
            step: "5. Restitution + plan d'action (J5)",
            detail:
              "Atelier de restitution 3 h dans vos locaux, livrable PDF 25-40 pages remis main à main : 5-10 quick-wins priorisés ROI/complexité, budget chiffré à 6-18 mois, roadmap actionnable.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE (< 10 collab)",
            price: "Audit Flash 490 € HT",
            detail:
              "1 journée sur site, 6 entretiens, 3 quick-wins identifiés, livrable PDF 12-15 pages. Démarrage moyen J+5. Adapté aux indépendants, micro-entreprises et cabinets parisiens 1-9 collab.",
          },
          {
            sizeLabel: "PME (10-249 collab)",
            price: "Audit Ciblé 1 900 - 3 900 € HT",
            detail:
              "3 jours sur site, 1 département/fonction (commercial OU comptable OU RH), 12 entretiens, 5-8 cas d'usage chiffrés. Idéal pour cabinets d'expertise, scale-ups Sentier, agences digital 25-150 collab.",
          },
          {
            sizeLabel: "PME enrichie (50-249)",
            price: "Audit Stratégique PME 4 900 - 9 900 € HT",
            detail:
              "5 jours sur site, audit complet multi-départements, 18-24 entretiens, 10-15 quick-wins + plan 12 mois. Pour PME parisiennes ambitieuses préparant un palier ETI.",
          },
          {
            sizeLabel: "ETI (250-4999) & Grande entreprise (5000+)",
            price: "Audit Stratégique ETI dès 12 000 € HT",
            detail:
              "10 jours sur site répartis sur 4-6 semaines, audit transverse, 30+ entretiens, gouvernance IA + plan 24 mois. Adapté aux ETI conseil 9e, banques, sièges grands-comptes La Défense.",
          },
        ],
        testimonials: [
          {
            quote:
              "L'audit AxionIA nous a livré en 5 jours ce que les Big Four nous chiffraient en 8 semaines à 60 000 €. Le rapport est chiffré, actionnable, sans jargon. On a démarré l'implémentation 3 semaines après.",
            role: "DG",
            companyProfile: "Cabinet d'expertise comptable, 9e arrondissement, 38 collaborateurs",
          },
          {
            quote:
              "Méthode pragmatique, démos sur nos vraies données plutôt que des slides théoriques. Le livrable a permis de prioriser nos 4 chantiers IA prioritaires sur 18 mois pour notre Comex.",
            role: "Directrice de la transformation",
            companyProfile: "ETI conseil, 8e arrondissement, 240 collaborateurs",
          },
        ],
        faq: [
          {
            q: "Quel est le délai de démarrage moyen pour un audit IA à Paris ?",
            a: "5 à 10 jours ouvrés entre la signature du devis et le kick-off sur site. Si votre besoin est urgent (Q+1 budget, contrainte calendaire CODIR ou comité d'investissement), nous réservons des créneaux courts à 5 jours ouvrés sur Paris en priorité absolue.",
          },
          {
            q: "Le tarif inclut-il les frais de déplacement à Paris ?",
            a: "Oui, intégralement. Aucun supplément pour Paris intra-muros, La Défense, et toute la première couronne (Levallois, Boulogne-Billancourt, Issy-les-Moulineaux, Neuilly-sur-Seine, Saint-Denis, Vincennes, Montreuil). Pour la grande couronne (>30 km) un forfait journalier transparent peut s'appliquer.",
          },
          {
            q: "Mes données restent-elles confidentielles pendant l'audit ?",
            a: "NDA signé avant le kick-off, données traitées exclusivement sur vos infrastructures (pas d'extraction vers nos serveurs). Hébergement UE par défaut, conformité RGPD stricte. Modèles IA testés en local ou sur infra dédiée chez vous si requis (souveraineté).",
          },
          {
            q: "Quel ROI est généralement chiffré pour un audit à Paris ?",
            a: "Sur nos audits Stratégique PME (4 900-9 900 €) parisiens, le ROI moyen identifié à 12 mois représente 8 à 15 ETP gagnés sur les workflows automatisés (lecture factures, comptes-rendus, qualification leads). Soit 250 000 à 600 000 € de gain annuel pour une PME 50-150 collab.",
          },
          {
            q: "Quels secteurs parisiens sont les plus matures pour un audit IA ?",
            a: "Cabinets d'expertise comptable et juridique (très matures, ROI immédiat sur la saisie), conseil et audit Big Four challengers, asset managers et family offices, scale-ups SaaS Sentier-République, agences digital 9e-10e. Les maisons de mode du Marais commencent à s'intéresser aux IA générative pour leur pôle créa.",
          },
          {
            q: "Différence avec un audit Big Four ou un cabinet de conseil traditionnel ?",
            a: "AxionIA est un cabinet IA opérationnel : on cartographie ET on déploie. Nos consultants sont d'anciens praticiens IA, pas des MBA. Tarifs publics affichés, pas de devis à 30 K€ à négocier. Méthode 5 jours plutôt que 6 semaines. ROI chiffré et engageant. Aucun lock-in technologique : vous repartez avec votre plan, libre de l'exécuter avec qui vous voulez.",
          },
        ],
        guarantees:
          "Engagement AxionIA à Paris : livrable remis sous 7 jours ouvrés post-kick-off (si retard de notre fait, audit offert). Conformité RGPD totale (DPO sur demande), hébergement données 100 % UE (Hetzner Frankfurt). Aucun lock-in technologique : votre plan d'action est exécutable avec n'importe quel prestataire ou en interne. Satisfaction garantie : si après la restitution vous estimez que le livrable n'apporte pas de valeur actionnable, audit remboursé intégralement (clause activée 0 fois sur 47 missions Paris à ce jour).",
      },
      en: {
        hero: "Corporate AI audit in Paris (75): AxionIA maps in 5 to 10 business days every automatable workflow in your Paris organization, delivering a 25-40 page costed PDF with 12-24 month ROI. Four tiers available in Paris (Flash €490, Targeted €1,900-3,900, SME Strategic €4,900-9,900, Mid-cap Strategic from €12,000), all travel fees within Paris and inner suburbs included. Average lead time signature to kick-off: 5 to 10 business days, short slots available for Q+1 budget or board constraints.",
        whyHere: [
          "AxionIA's #1 priority hub: 60% of our audits are triggered in Paris or Greater Paris (215,000 active businesses within Paris, Sirene 2024 census).",
          "Travel fees included for inner Paris, La Défense, Levallois, Boulogne, Issy, Neuilly and all inner suburbs — no hidden costs.",
          "Signature → kick-off lead time: 5 to 10 business days average (vs 4-6 weeks at Big Four). Sub-5-day rush slots reservable in Paris.",
          "Paris B2B fabric over-represented in our cases: accounting firms, family offices, asset managers, mid-cap consulting 8th/9th/16th, Sentier-République SaaS scale-ups, Marais fashion houses.",
          "Our consultants are Paris-based: same-day on-site visits possible, in-person workshops Mondays/Tuesdays/Thursdays at no surcharge.",
          "Read-outs always in person in Paris: ideation workshops, deliverable walk-through with your leadership, action plan handed over face-to-face.",
        ],
        methodology: [
          {
            step: "1. Preparation (D-5 to D-1)",
            detail:
              "90-min remote framing brief, NDA signed, access to 5-10 key documents (org chart, processes, KPIs). No travel yet — we set the stage.",
          },
          {
            step: "2. On-site kick-off (D1)",
            detail:
              "Half-day in your Paris offices. Walk-through of human fabric, observation of daily tools, identification of 8-12 AI candidate workflows.",
          },
          {
            step: "3. Employee interviews (D2-D3)",
            detail:
              "12 individual 30-min interviews on site (sales, finance, HR, ops, support, leadership). Detailed mapping of frictions, expectations, GDPR/security constraints.",
          },
          {
            step: "4. Demos on your real data (D4)",
            detail:
              "On site in your offices: Claude/Mistral/GPT-4 demos applied to 3 identified concrete cases. You literally see AI processing your PDFs, emails, invoices.",
          },
          {
            step: "5. Read-out + action plan (D5)",
            detail:
              "3-hour read-out workshop in your offices, 25-40 page PDF deliverable handed over: 5-10 quick-wins prioritized by ROI/complexity, costed 6-18 month budget, actionable roadmap.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business (< 10)",
            price: "Flash audit €490",
            detail:
              "1 day on site, 6 interviews, 3 quick-wins, 12-15 page PDF. Average start D+5. Suited to Paris freelancers, micro-firms, 1-9 person practices.",
          },
          {
            sizeLabel: "SME (10-249)",
            price: "Targeted audit €1,900-3,900",
            detail:
              "3 days on site, 1 department, 12 interviews, 5-8 costed use cases. Ideal for accounting firms, Sentier scale-ups, digital agencies 25-150 staff.",
          },
          {
            sizeLabel: "Enriched SME (50-249)",
            price: "SME Strategic audit €4,900-9,900",
            detail:
              "5 days on site, full multi-department audit, 18-24 interviews, 10-15 quick-wins + 12-month plan. For ambitious Paris SMEs preparing a mid-cap step.",
          },
          {
            sizeLabel: "Mid-cap (250-4999) & Large enterprise (5000+)",
            price: "Mid-cap Strategic audit from €12,000",
            detail:
              "10 days on site over 4-6 weeks, transverse audit, 30+ interviews, AI governance + 24-month plan. Fits 9th mid-cap consulting, banks, La Défense HQs.",
          },
        ],
        testimonials: [
          {
            quote:
              "AxionIA's audit delivered in 5 days what the Big Four were quoting at €60,000 over 8 weeks. The report is costed, actionable, jargon-free. We started implementation 3 weeks after.",
            role: "CEO",
            companyProfile: "Accounting firm, 9th arrondissement, 38 staff",
          },
          {
            quote:
              "Pragmatic method, demos on our real data rather than theoretical slides. The deliverable helped prioritize our 4 priority AI initiatives over 18 months for our exec committee.",
            role: "Head of Transformation",
            companyProfile: "Mid-cap consulting, 8th arrondissement, 240 staff",
          },
        ],
        faq: [
          {
            q: "What is the average lead time for an AI audit in Paris?",
            a: "5 to 10 business days between signed quote and on-site kick-off. For urgent needs (Q+1 budget, board calendar constraints), we reserve sub-5-day rush slots in Paris on absolute priority.",
          },
          {
            q: "Are travel fees included in the Paris price?",
            a: "Yes, fully. No surcharge for inner Paris, La Défense and all inner suburbs (Levallois, Boulogne-Billancourt, Issy-les-Moulineaux, Neuilly-sur-Seine, Saint-Denis, Vincennes, Montreuil). For outer suburbs (>30 km) a transparent daily flat-rate may apply.",
          },
          {
            q: "Does my data stay confidential during the audit?",
            a: "NDA signed before kick-off, data processed exclusively on your infrastructure (no extraction to our servers). EU hosting by default, strict GDPR compliance. AI models tested locally or on dedicated infra at your premises if required (sovereignty).",
          },
          {
            q: "What ROI is typically costed for a Paris audit?",
            a: "On our SME Strategic audits (€4,900-9,900) in Paris, the average 12-month ROI represents 8 to 15 FTEs saved on automated workflows (invoice reading, meeting minutes, lead qualification). That's €250K to €600K annual gain for a 50-150 staff SME.",
          },
          {
            q: "Which Paris sectors are most mature for an AI audit?",
            a: "Accounting and legal firms (very mature, immediate ROI on data entry), consulting and Big Four challengers, asset managers and family offices, Sentier-République SaaS scale-ups, 9th-10th digital agencies. Marais fashion houses are starting to look at generative AI for their creative teams.",
          },
          {
            q: "Difference with a Big Four audit or traditional consulting?",
            a: "AxionIA is an operational AI consultancy: we map AND deploy. Our consultants are former AI practitioners, not MBAs. Public pricing, no €30K quote to negotiate. 5-day method rather than 6 weeks. Costed and committed ROI. No tech lock-in: you leave with your plan, free to execute with whoever you want.",
          },
        ],
        guarantees:
          "AxionIA's commitment in Paris: deliverable handed over within 7 business days post-kick-off (if delayed by us, audit comped). Full GDPR compliance (DPO on request), 100% EU data hosting (Hetzner Frankfurt). No tech lock-in: your action plan is executable with any vendor or in-house. Satisfaction guarantee: if after the read-out you feel the deliverable lacks actionable value, audit fully refunded (clause triggered 0 times across 47 Paris missions to date).",
      },
    },
    interventions: {
      fr: {
        hero: "Interventions IA en entreprise à Paris (75) : AxionIA délivre 5 formats sur site dans toute l'Île-de-France — Essentielle 1 journée 490 € HT (jusqu'à 100 collab), Équipes (1 département), Managers (CODIR), Conférence ½ journée (plénières), Dirigeants (board). Démos sur vos vraies données, méthode de prompting hands-on, vos équipes repartent avec des outils opérationnels installés sur leurs postes le soir même. Disponibles dans les 20 arrondissements, La Défense et la première couronne, frais de déplacement IDF intégrés.",
        whyHere: [
          "Premier pôle d'intervention AxionIA : ~40 % des sessions Essentielle se tiennent à Paris ou IDF, créneaux disponibles 3-5 jours après réservation.",
          "Tous les arrondissements couverts en présentiel : 1er au 20e + La Défense + petite couronne (Levallois, Boulogne, Issy, Neuilly, Saint-Denis, Vincennes, Montreuil).",
          "Format Essentielle 490 € HT calibré pour les TPE/PME parisiennes 5-100 collab : 1 journée, jusqu'à 100 personnes par session, démos sur vos workflows réels.",
          "Format Conférence ½ journée parfait pour les plénières d'entreprise IDF (auditoriums La Défense, lofts Sentier, espaces collaboratifs Station F) : 200-500 collab.",
          "Format Dirigeants spécifiquement adapté aux comités de direction parisiens : 3 h en huis-clos, cadrage stratégique 12-24 mois, gouvernance IA.",
          "Vocabulaire ajusté au secteur dominant de votre entreprise (finance, conseil, tech, mode, retail) — pas de session générique.",
        ],
        methodology: [
          {
            step: "1. Cadrage de la session (J-7)",
            detail:
              "30 min visio avec votre RH ou DG : profil des participants, secteurs métier dominants, 3-5 cas d'usage prioritaires identifiés ensemble. Pas de session générique.",
          },
          {
            step: "2. Préparation des démos (J-5 à J-3)",
            detail:
              "Nous récupérons 5-10 documents anonymisés représentatifs de votre activité (factures, emails, RH, contrats). Nous calibrons les démos pour qu'elles parlent à VOS équipes.",
          },
          {
            step: "3. Arrivée et installation (J0 matin)",
            detail:
              "Nos consultants arrivent 30 min avant le début dans vos locaux parisiens. Vérification matériel, projection, accès Wi-Fi. Pas d'aléa technique.",
          },
          {
            step: "4. Session pédagogique (J0)",
            detail:
              "1 journée (Essentielle) ou ½ journée (Conférence) ou 3 h (Dirigeants) : alternance théorie courte + démos longues sur VOS données + ateliers hands-on participants.",
          },
          {
            step: "5. Outils installés et debrief (J0 soir)",
            detail:
              "Chaque participant Essentielle repart avec 3-5 outils IA installés sur son poste, configurés pour son cas d'usage personnel. Outils utilisables dès le lendemain matin sans aide.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE (< 10 collab)",
            price: "Essentielle 490 € HT",
            detail:
              "1 journée sur site, jusqu'à 100 personnes (intra ou inter-entreprises), démos sur vos données. Idéal indépendants, cabinets, agences parisiennes 1-9 collab.",
          },
          {
            sizeLabel: "PME (10-249 collab)",
            price: "Essentielle 490 € HT ou Équipes 1 900 € HT",
            detail:
              "Essentielle : 1 journée groupe entier (max 100). Équipes : 1 journée focalisée sur 1 département (commerciaux, finance, RH...) avec démos métier dédiées.",
          },
          {
            sizeLabel: "ETI (250-4999) & Grande entreprise (5000+)",
            price: "Conférence ½ journée 2 900 € HT ou Dirigeants 4 900 € HT",
            detail:
              "Conférence : plénière 200-500 collab (auditoriums La Défense, espaces Sentier). Dirigeants : huis-clos CODIR 3 h, cadrage stratégique IA 12-24 mois.",
          },
          {
            sizeLabel: "Personnalisée multi-formats",
            price: "Sur devis (forfait journée + frais)",
            detail:
              "Combinaisons sur-mesure pour grands comptes parisiens : roadshow 5 sites La Défense, formation programmée trimestrielle, séminaires CODIR + équipes en cascade.",
          },
        ],
        testimonials: [
          {
            quote:
              "Format Essentielle parfaitement calibré : nos 80 collab sont repartis avec ChatGPT, Claude et Notion AI installés et configurés. Le lendemain, 60 % les utilisaient déjà sur leur travail réel.",
            role: "DRH",
            companyProfile: "Cabinet conseil parisien, 8e arrondissement, 80 collaborateurs",
          },
          {
            quote:
              "La conférence dirigeants nous a alignés en 3 h sur la trajectoire IA 18 mois. Aucun consultant traditionnel n'avait su cadrer aussi vite avec autant de pragmatisme.",
            role: "Président",
            companyProfile: "ETI familiale, siège La Défense, 350 collaborateurs",
          },
        ],
        faq: [
          {
            q: "Quel délai pour réserver une intervention à Paris ?",
            a: "Réservation directe sur le calendrier en ligne, créneaux disponibles 3 à 7 jours ouvrés après confirmation. Pour les périodes denses (rentrée septembre, janvier post-fêtes), réserver 2-3 semaines à l'avance.",
          },
          {
            q: "Quelle taille maximale de groupe pour Essentielle 490 € ?",
            a: "Jusqu'à 100 collaborateurs par session Essentielle (capacité audio + interaction). Pour 100-300 personnes, format Conférence ½ journée plus adapté. Au-delà de 300, format Conférence + ateliers en sous-groupes.",
          },
          {
            q: "Les outils installés sur les postes restent-ils utilisables ?",
            a: "Oui — les outils installés sont des comptes individuels (gratuits ou avec abonnement employé) sur ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity selon le profil. Aucun lock-in AxionIA, vous gardez la main.",
          },
          {
            q: "Peut-on adapter le contenu à notre secteur (finance, conseil, retail...) ?",
            a: "Oui systématiquement. Le brief de cadrage J-7 nous permet d'ajuster vocabulaire, exemples, démos. Une session pour un cabinet d'expertise comptable parisien n'a strictement rien à voir avec une session pour une maison de mode du Marais.",
          },
          {
            q: "Faites-vous du Qualiopi ou des intitulés financables CPF ?",
            a: "Pas en V1 (organisme de formation Qualiopi non encore certifié, en cours d'instruction Q1 2026). Les interventions sont facturables sur OPCO via votre fonds de formation continue selon les modalités de votre branche, devis détaillé disponible.",
          },
          {
            q: "Que se passe-t-il si on annule au dernier moment ?",
            a: "Annulation ≥ 7 jours ouvrés avant J0 : remboursement intégral. Annulation 3-7 jours : 50 % retenu (frais consultant déjà bloqué). Annulation < 3 jours : 100 % retenu, mais session reportable une fois sans frais sur les 6 mois suivants.",
          },
        ],
        guarantees:
          "Engagement AxionIA à Paris : créneau garanti si réservation > 7 jours ouvrés à l'avance. Si problème technique de notre fait (consultant absent, matériel défaillant), session reportée + 50 % remboursés. Outils opérationnels le soir même : si vos collaborateurs ne sont pas autonomes le lendemain matin sur les 3 outils installés, séance de remédiation de 90 min offerte. Vocabulaire ajusté à votre secteur (cadrage J-7), aucune session générique recyclée.",
      },
      en: {
        hero: "Corporate AI sessions in Paris (75): AxionIA delivers 5 on-site formats across Greater Paris — Essential 1-day €490 (up to 100 staff), Teams (1 department), Managers (leadership), Half-day Talk (plenaries), Executives (board). Demos on your real data, hands-on prompting methodology, your teams leave with operational tools installed on their workstations the same evening. Available across all 20 arrondissements, La Défense and inner suburbs, Greater-Paris travel fees included.",
        whyHere: [
          "AxionIA's top engagement hub: ~40% of Essential sessions take place in Paris or Greater Paris, slots available 3-5 days after booking.",
          "All arrondissements covered in person: 1st to 20th + La Défense + inner suburbs (Levallois, Boulogne, Issy, Neuilly, Saint-Denis, Vincennes, Montreuil).",
          "Essential €490 format calibrated for Paris micro/SMEs 5-100 staff: 1 day, up to 100 people per session, demos on your real workflows.",
          "Half-day Talk format perfect for Greater-Paris corporate plenaries (La Défense auditoriums, Sentier lofts, Station F collaborative spaces): 200-500 staff.",
          "Executives format specifically tailored to Paris boards: 3 hours in camera, 12-24 month strategic framing, AI governance.",
          "Vocabulary adjusted to your dominant sector (finance, consulting, tech, fashion, retail) — no generic session.",
        ],
        methodology: [
          {
            step: "1. Session framing (D-7)",
            detail:
              "30-min remote with your HR or CEO: participant profile, dominant sector, 3-5 priority use cases identified together. No generic session.",
          },
          {
            step: "2. Demo preparation (D-5 to D-3)",
            detail:
              "We collect 5-10 anonymized documents representative of your activity (invoices, emails, HR, contracts). We calibrate demos to speak to YOUR teams.",
          },
          {
            step: "3. Arrival and setup (D0 morning)",
            detail:
              "Our consultants arrive 30 min before start in your Paris offices. Equipment check, projection, Wi-Fi access. No technical hiccup.",
          },
          {
            step: "4. Pedagogical session (D0)",
            detail:
              "1 day (Essential) or half-day (Talk) or 3 hours (Executives): alternation of short theory + long demos on YOUR data + hands-on participant workshops.",
          },
          {
            step: "5. Tools installed and debrief (D0 evening)",
            detail:
              "Each Essential participant leaves with 3-5 AI tools installed on their workstation, configured for their personal use case. Tools usable next morning without help.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business (< 10)",
            price: "Essential €490",
            detail:
              "1 day on site, up to 100 people (intra or inter-company), demos on your data. Ideal for Paris freelancers, firms, agencies 1-9 staff.",
          },
          {
            sizeLabel: "SME (10-249)",
            price: "Essential €490 or Teams €1,900",
            detail:
              "Essential: 1 day whole group (max 100). Teams: 1 day focused on 1 department (sales, finance, HR...) with dedicated business demos.",
          },
          {
            sizeLabel: "Mid-cap (250-4999) & Large enterprise (5000+)",
            price: "Half-day Talk €2,900 or Executives €4,900",
            detail:
              "Talk: 200-500 staff plenary (La Défense auditoriums, Sentier spaces). Executives: 3-hour board in camera, 12-24 month AI strategic framing.",
          },
          {
            sizeLabel: "Custom multi-format",
            price: "On quote (day rate + fees)",
            detail:
              "Custom combinations for Paris large accounts: 5-site La Défense roadshow, programmed quarterly training, exec + cascade team seminars.",
          },
        ],
        testimonials: [
          {
            quote:
              "Essential format perfectly calibrated: our 80 staff left with ChatGPT, Claude and Notion AI installed and configured. The next day, 60% were already using them on real work.",
            role: "Head of HR",
            companyProfile: "Paris consulting firm, 8th arrondissement, 80 staff",
          },
          {
            quote:
              "The executive talk aligned us in 3 hours on the 18-month AI trajectory. No traditional consultant had been able to frame this fast with so much pragmatism.",
            role: "President",
            companyProfile: "Family-owned mid-cap, La Défense HQ, 350 staff",
          },
        ],
        faq: [
          {
            q: "What lead time to book a session in Paris?",
            a: "Direct booking on the online calendar, slots available 3 to 7 business days after confirmation. For dense periods (September back-to-school, January post-holidays), book 2-3 weeks ahead.",
          },
          {
            q: "Maximum group size for Essential €490?",
            a: "Up to 100 staff per Essential session (audio + interaction capacity). For 100-300 people, Half-day Talk format more suitable. Above 300, Talk + sub-group workshops.",
          },
          {
            q: "Do the installed tools remain usable?",
            a: "Yes — installed tools are individual accounts (free or with employee subscription) on ChatGPT, Claude, Mistral, Notion AI, Gamma, Perplexity depending on profile. No AxionIA lock-in, you keep control.",
          },
          {
            q: "Can content be adapted to our sector (finance, consulting, retail...)?",
            a: "Yes systematically. The D-7 framing brief lets us adjust vocabulary, examples, demos. A session for a Paris accounting firm has strictly nothing to do with one for a Marais fashion house.",
          },
          {
            q: "Do you offer Qualiopi or CPF-fundable formats?",
            a: "Not in V1 (Qualiopi-certified training body not yet, under Q1 2026 review). Sessions are billable to OPCO via your continuing education fund per your sector terms, detailed quote available.",
          },
          {
            q: "What if we cancel at the last minute?",
            a: "Cancellation ≥ 7 business days before D0: full refund. Cancellation 3-7 days: 50% retained (consultant slot already blocked). Cancellation < 3 days: 100% retained, but session rebookable once free of charge in the next 6 months.",
          },
        ],
        guarantees:
          "AxionIA's commitment in Paris: slot guaranteed if booked > 7 business days ahead. If our technical issue (absent consultant, faulty equipment), session rebooked + 50% refunded. Operational tools same evening: if your staff aren't autonomous next morning on the 3 installed tools, 90-min remediation session offered. Vocabulary adjusted to your sector (D-7 framing), no recycled generic session.",
      },
    },
    implementation: {
      fr: {
        hero: "Implémentation IA opérationnelle à Paris (75) : AxionIA met en production vos cas IA en 6 à 12 semaines avec ROI chiffré, formation équipes incluse, hybride sur site / distance avec kick-off obligatoire à Paris. Tarif fixe dès 990 € HT (POC), montant standard 8 000-25 000 € pour un déploiement PME, 25-80 K€ pour ETI. Cas typiques parisiens livrés : lecture automatisée de factures fournisseurs, génération de comptes-rendus de réunions, qualification IA des leads entrants, agents conversationnels CRM/ERP, automatisation back-office RH.",
        whyHere: [
          "Pôle d'implémentation #1 AxionIA : 50 % de nos missions de déploiement sont initiées à Paris ou IDF (215 000 entreprises actives intra-muros).",
          "Kick-off obligatoire en présentiel à Paris (3-5 jours sur site dans vos locaux) : alignement équipes, accès aux données, validation des intégrations CRM/ERP/email.",
          "Itérations à distance ensuite (4-8 semaines) avec daily 15 min en visio + visite mensuelle sur site pour démos d'avancement avec votre Comex.",
          "Recette finale toujours en présentiel à Paris : passation de pouvoir, formation équipes installées sur leur poste, documentation runbook remise.",
          "Formation incluse pour 5-15 collaborateurs identifiés clés : ils deviennent les ambassadeurs IA internes, autonomes 30 jours après la fin de mission.",
          "Cas typiques parisiens : cabinets d'expertise (lecture factures), ETI conseil 8e/9e (qualification leads), scale-ups SaaS Sentier (agents support), maisons de mode Marais (génération copy produit).",
        ],
        methodology: [
          {
            step: "1. Cadrage technique (S0, 2 jours)",
            detail:
              "Atelier sur site Paris : revue architecture cible (CRM, ERP, mails, stockage), validation des contraintes RGPD/sécurité, sélection finale des modèles IA, signature SOW chiffré.",
          },
          {
            step: "2. Kick-off + sprint 1 (S1-S2)",
            detail:
              "3 jours sur site Paris : install accès, déploiement environnement de dev, première intégration end-to-end fonctionnelle (POC), validation visuelle avec votre équipe.",
          },
          {
            step: "3. Itérations (S3-S8)",
            detail:
              "Travail à distance avec daily 15 min : enrichissement progressif des cas, intégration aux outils existants, tests sur volumes réels, ajustements UX.",
          },
          {
            step: "4. Recette + formation (S9-S10)",
            detail:
              "Sur site Paris : tests d'acceptation utilisateurs, formation des 5-15 ambassadeurs internes, livraison du runbook documentation, plan de monitoring 90 j.",
          },
          {
            step: "5. Suivi post-go-live (S11-S12)",
            detail:
              "À distance : surveillance des métriques de production, ajustements fins, mesure ROI réel vs prédit. Rapport final remis à 90 jours, mission close.",
          },
        ],
        pricing: [
          {
            sizeLabel: "TPE (< 10 collab)",
            price: "POC 990 € HT - 4 900 € HT",
            detail:
              "Implémentation d'1 cas d'usage simple en 2-3 semaines (lecture factures OU comptes-rendus OU qualif leads). Idéal cabinets parisiens, indépendants, agences 1-9 collab.",
          },
          {
            sizeLabel: "PME (10-249 collab)",
            price: "Mission 8 000 € HT - 25 000 € HT",
            detail:
              "Déploiement 2-4 cas d'usage en 6-12 semaines, formation 5-10 ambassadeurs internes, intégration CRM/ERP. Pour cabinets d'expertise, scale-ups, agences digital 25-150 collab.",
          },
          {
            sizeLabel: "ETI (250-4999) & Grande entreprise (5000+)",
            price: "Mission 25 000 € HT - 80 000 € HT",
            detail:
              "Déploiement transverse 5-10 cas d'usage en 10-16 semaines, gouvernance IA, intégrations avancées (legacy ERP, datalake), formation 15-30 ambassadeurs cross-département.",
          },
          {
            sizeLabel: "Grand programme multi-déploiement",
            price: "Sur devis (80 K€+)",
            detail:
              "Programmes annuels pour grands comptes parisiens : 10-30 cas d'usage cascadés, gouvernance IA centralisée, équipe dédiée 1-3 ETP AxionIA en mode régie.",
          },
        ],
        testimonials: [
          {
            quote:
              "L'implémentation lecture factures + comptes-rendus a été livrée en 8 semaines comme promis. ROI réel mesuré 18 mois : 6 ETP libérés sur les tâches admin, soit 280 K€ de gain annuel net. Aucun lock-in, on a la main sur les modèles.",
            role: "DAF",
            companyProfile: "ETI conseil parisien, 9e arrondissement, 240 collaborateurs",
          },
          {
            quote:
              "Méthode hybride parfaite : kick-off intense 5 jours sur site, puis itérations distance avec dailies courts. Notre équipe IT n'a jamais été perdue. Les ambassadeurs internes prennent le relais de façon autonome.",
            role: "CTO",
            companyProfile: "Scale-up SaaS Sentier, 11e arrondissement, 95 collaborateurs",
          },
        ],
        faq: [
          {
            q: "Quelle durée moyenne pour une implémentation IA à Paris ?",
            a: "6 à 12 semaines pour une mission PME standard (2-4 cas d'usage), 10 à 16 semaines pour ETI (5-10 cas), 4-6 mois pour grand programme transverse. Le kick-off à Paris dure toujours 3-5 jours sur site, le reste hybride.",
          },
          {
            q: "Le tarif est-il fixe ou au temps passé ?",
            a: "Forfait fixe pour 95 % de nos missions Paris. SOW signé en S0 avec scope précis et livrables définis. Si scope change en cours, avenant explicite + nouvelle estimation. Aucune dérive horaire cachée.",
          },
          {
            q: "Qui maintient la solution après la mission ?",
            a: "Vos ambassadeurs internes, formés pendant la mission. Documentation runbook complète remise. Si maintenance externalisée souhaitée, contrat de support optionnel (9-15 % du coût mission/an). Aucun lock-in : vous pouvez aussi externaliser ailleurs.",
          },
          {
            q: "Mes données restent-elles chez moi ou partent-elles chez AxionIA ?",
            a: "Toujours chez vous. Modèles IA déployés sur votre infra (cloud privé, on-prem, serveur dédié) ou sur infra dédiée AxionIA Hetzner Frankfurt si vous préférez (souveraineté UE). NDA signé S0, RGPD strict, DPO sur demande.",
          },
          {
            q: "Quels modèles IA utilisez-vous ? Open-source ou propriétaires ?",
            a: "Mix selon le cas : Mistral / Llama (open-source pour souveraineté ou coût), GPT-4 / Claude / Gemini (propriétaires pour qualité top), parfois fine-tuning sur vos données si volume > 10 K exemples. Choix justifié dans le SOW, jamais imposé.",
          },
          {
            q: "Que se passe-t-il si l'IA hallucine ou produit des erreurs ?",
            a: "Tous nos déploiements incluent une couche de validation : seuils de confiance, double-check humain pour les cas sensibles (factures > 5 000 €, contrats, RH), monitoring continu des métriques. Le ROI chiffré au SOW intègre la marge d'erreur réaliste, pas un scénario parfait.",
          },
        ],
        guarantees:
          "Engagement AxionIA à Paris : forfait fixe sur SOW (pas de dérive horaire), livraison dans les délais (si retard de notre fait > 2 semaines, pénalité 5 % du forfait par semaine de retard). ROI chiffré contractuel : si après 12 mois le ROI réel mesuré < 50 % du ROI prédit au SOW, audit gratuit pour identifier la cause + ajustement déploiement offert. Aucun lock-in technologique : vos modèles, vos données, votre runbook. Vos ambassadeurs internes formés sont autonomes 30 jours après go-live (sinon remédiation 90 min offerte).",
      },
      en: {
        hero: "Operational AI implementation in Paris (75): AxionIA deploys your AI cases to production in 6 to 12 weeks with costed ROI, team training included, hybrid on-site / remote with mandatory Paris kick-off. Fixed price from €990 (POC), standard range €8,000-25,000 for an SME deployment, €25-80K for mid-cap. Typical Paris cases delivered: automated supplier invoice reading, meeting minutes generation, AI lead qualification, CRM/ERP conversational agents, HR back-office automation.",
        whyHere: [
          "AxionIA's #1 implementation hub: 50% of our deployment missions are initiated in Paris or Greater Paris (215,000 active businesses within Paris).",
          "Mandatory Paris in-person kick-off (3-5 days on site at your offices): team alignment, data access, CRM/ERP/email integration validation.",
          "Remote iterations afterwards (4-8 weeks) with 15-min daily on video + monthly on-site visit for progress demos with your exec committee.",
          "Final acceptance always in person in Paris: handover, training of installed teams, runbook documentation handed over.",
          "Training included for 5-15 identified key staff: they become internal AI ambassadors, autonomous 30 days after mission end.",
          "Typical Paris cases: accounting firms (invoice reading), 8th/9th mid-cap consulting (lead qualification), Sentier SaaS scale-ups (support agents), Marais fashion houses (product copy generation).",
        ],
        methodology: [
          {
            step: "1. Technical framing (W0, 2 days)",
            detail:
              "Paris on-site workshop: target architecture review (CRM, ERP, emails, storage), GDPR/security constraints validation, AI model final selection, costed SOW signed.",
          },
          {
            step: "2. Kick-off + sprint 1 (W1-W2)",
            detail:
              "3 days on site Paris: access install, dev environment deployment, first end-to-end functional integration (POC), visual validation with your team.",
          },
          {
            step: "3. Iterations (W3-W8)",
            detail:
              "Remote work with 15-min daily: progressive case enrichment, integration with existing tools, real-volume testing, UX adjustments.",
          },
          {
            step: "4. Acceptance + training (W9-W10)",
            detail:
              "On site Paris: user acceptance tests, training of 5-15 internal ambassadors, runbook documentation delivery, 90-day monitoring plan.",
          },
          {
            step: "5. Post-go-live follow-up (W11-W12)",
            detail:
              "Remote: production metrics monitoring, fine adjustments, real ROI vs predicted measurement. Final 90-day report delivered, mission closed.",
          },
        ],
        pricing: [
          {
            sizeLabel: "Micro-business (< 10)",
            price: "POC €990 - €4,900",
            detail:
              "Implementation of 1 simple use case in 2-3 weeks (invoice reading OR meeting minutes OR lead qualif). Ideal Paris firms, freelancers, 1-9 staff agencies.",
          },
          {
            sizeLabel: "SME (10-249)",
            price: "Mission €8,000 - €25,000",
            detail:
              "Deployment of 2-4 use cases in 6-12 weeks, training of 5-10 internal ambassadors, CRM/ERP integration. For accounting firms, scale-ups, digital agencies 25-150 staff.",
          },
          {
            sizeLabel: "Mid-cap (250-4999) & Large enterprise (5000+)",
            price: "Mission €25,000 - €80,000",
            detail:
              "Transverse deployment 5-10 use cases in 10-16 weeks, AI governance, advanced integrations (legacy ERP, datalake), training 15-30 cross-department ambassadors.",
          },
          {
            sizeLabel: "Multi-deployment large program",
            price: "On quote (€80K+)",
            detail:
              "Annual programs for Paris large accounts: 10-30 cascaded use cases, centralized AI governance, dedicated AxionIA team 1-3 FTE in retainer mode.",
          },
        ],
        testimonials: [
          {
            quote:
              "Invoice reading + meeting minutes implementation was delivered in 8 weeks as promised. Real 18-month ROI measured: 6 FTEs freed on admin tasks, i.e. €280K net annual gain. No lock-in, we control our models.",
            role: "CFO",
            companyProfile: "Paris mid-cap consulting, 9th arrondissement, 240 staff",
          },
          {
            quote:
              "Perfect hybrid method: intense 5-day on-site kick-off, then remote iterations with short dailies. Our IT team was never lost. Internal ambassadors take over autonomously.",
            role: "CTO",
            companyProfile: "Sentier SaaS scale-up, 11th arrondissement, 95 staff",
          },
        ],
        faq: [
          {
            q: "What is the average duration for an AI implementation in Paris?",
            a: "6 to 12 weeks for a standard SME mission (2-4 use cases), 10 to 16 weeks for mid-cap (5-10 cases), 4-6 months for transverse large program. Paris kick-off always lasts 3-5 days on site, the rest hybrid.",
          },
          {
            q: "Is the price fixed or time-based?",
            a: "Fixed flat-rate for 95% of our Paris missions. SOW signed in W0 with precise scope and defined deliverables. If scope changes mid-mission, explicit amendment + new estimate. No hidden hourly drift.",
          },
          {
            q: "Who maintains the solution after the mission?",
            a: "Your internal ambassadors, trained during the mission. Complete runbook documentation handed over. If outsourced maintenance desired, optional support contract (9-15% of mission cost/year). No lock-in: you can also outsource elsewhere.",
          },
          {
            q: "Does my data stay with me or move to AxionIA?",
            a: "Always with you. AI models deployed on your infra (private cloud, on-prem, dedicated server) or on dedicated AxionIA Hetzner Frankfurt infra if you prefer (EU sovereignty). NDA signed W0, strict GDPR, DPO on request.",
          },
          {
            q: "Which AI models do you use? Open-source or proprietary?",
            a: "Mix per case: Mistral / Llama (open-source for sovereignty or cost), GPT-4 / Claude / Gemini (proprietary for top quality), sometimes fine-tuning on your data if volume > 10K examples. Choice justified in SOW, never imposed.",
          },
          {
            q: "What happens if the AI hallucinates or produces errors?",
            a: "All our deployments include a validation layer: confidence thresholds, human double-check for sensitive cases (invoices > €5,000, contracts, HR), continuous metrics monitoring. The costed ROI in SOW includes realistic margin of error, not a perfect scenario.",
          },
        ],
        guarantees:
          "AxionIA's commitment in Paris: fixed flat-rate on SOW (no hourly drift), on-time delivery (if our delay > 2 weeks, 5% penalty per week of delay). Contractual costed ROI: if after 12 months the real measured ROI < 50% of the predicted SOW ROI, free audit to identify cause + offered deployment adjustment. No tech lock-in: your models, your data, your runbook. Your trained internal ambassadors are autonomous 30 days post go-live (otherwise 90-min remediation offered).",
      },
    },
  },
  faqGeolocalisee: [
    {
      q: "Combien coûte un audit IA opérationnel à Paris ?",
      a: "Notre audit Essentiel (5 jours, 12 entretiens, 3 cas d'usage chiffrés) est facturé 9 800 € HT à Paris comme partout en France. Aucun supplément géographique : nos consultants sont basés à Paris, les frais de déplacement sont intégrés dans le forfait pour toute mission en Île-de-France.",
    },
    {
      q: "Avez-vous des cas clients à Paris ?",
      a: "Oui — plusieurs cas concrets dans nos références sont basés à Paris ou en proche couronne (cabinet comptable Boulogne-Billancourt, ETI conseil 9e arrondissement, scale-up SaaS Sentier). Les cas clients récents sont consultables dans la rubrique Cas concrets, filtrables par ville d'intervention.",
    },
    {
      q: "Quels secteurs sont prioritaires à Paris ?",
      a: "Nos déploiements parisiens couvrent en priorité la finance (cabinets d'expertise, family offices, asset managers), le conseil (cabinets stratégie, audit, juridique), la tech (scale-ups B2B SaaS, éditeurs logiciels), et le luxe (maisons de mode, cosmétique). Tout secteur B2B avec >20 collaborateurs est éligible à un audit.",
    },
    {
      q: "Pouvez-vous intervenir sur site dans nos bureaux parisiens ?",
      a: "Oui — toutes nos interventions Paris sont par défaut sur site, dans vos bureaux. Nos consultants sont mobiles sur l'ensemble des arrondissements, La Défense, et la première couronne (Levallois, Boulogne, Issy, Neuilly). Les ateliers d'idéation et restitutions clés se tiennent toujours en présentiel.",
    },
    {
      q: "En combien de temps pouvez-vous démarrer une mission à Paris ?",
      a: "Pour un audit Essentiel à Paris, le délai moyen entre signature et kick-off est de 10 jours ouvrés. Si votre besoin est urgent (Q+1 budget, contrainte calendaire CODIR), nous réservons des créneaux courts à 5 jours sur Paris en priorité absolue.",
    },
    {
      q: "Travaillez-vous avec les startups parisiennes (Station F, French Tech) ?",
      a: "Oui — nous accompagnons régulièrement les scale-ups séries A-B issues de Station F, du Quai d'Innovation et des programmes French Tech. Notre offre Essentielle est calibrée pour les structures 20-150 collaborateurs avec un product-market fit établi qui veulent passer du POC IA à un déploiement opérationnel.",
    },
  ],
};
