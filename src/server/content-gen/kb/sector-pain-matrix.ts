/**
 * AXION-IA — Sector Pain Matrix
 * 10 secteurs × 5 verticales = ~50 combinaisons
 * Chaque combinaison porte : douleur, bénéfice chiffré, avant/après, objection, lexique métier
 *
 * Usage : injecté dans GeneratorBaseInput.sectorPainContext AVANT le prompt LLM
 * Non seedé en base (KnowledgeBase) — injecté au prompt via prompt-augmentation.ts
 */

export type Verticale =
  "audits" | "interventions_formations" | "implementations" | "un_a_un" | "sites_web_augmentes";

export type Secteur =
  | "comptabilite_finance"
  | "btp_immobilier"
  | "restauration_hotellerie"
  | "sante_medecine"
  | "juridique"
  | "commerce_retail"
  | "industrie_logistique"
  | "artisanat_services"
  | "rh_recrutement"
  | "collectivites_public";

export interface SectorPainContext {
  secteur: Secteur;
  verticale: Verticale;
  painStatement: string; // La douleur nommée dans le langage du client
  benefitMeasured: string; // Le gain CHIFFRÉ (temps, argent, erreurs)
  beforeScenario: string; // Vie d'avant (1-2 phrases concrètes)
  afterScenario: string; // Vie d'après (1-2 phrases concrètes)
  sectorLexicon: string[]; // Mots du MÉTIER, pas de la tech
  objection: string; // "Oui mais..."
  objectionReply: string; // La réponse courte et cash
  kpiLabel: string; // Le KPI qui parle à CE secteur
  typicalBudgetSignal: string; // Signal budget pour calibrer le ROI
}

export const SECTOR_PAIN_MATRIX: SectorPainContext[] = [
  // ─────────────────────────────────────────────
  // COMPTABILITÉ / FINANCE
  // ─────────────────────────────────────────────
  {
    secteur: "comptabilite_finance",
    verticale: "audits",
    painStatement:
      "Vous passez des heures à chercher pourquoi vos chiffres ne tombent pas juste, sans savoir par où commencer avec l'IA.",
    benefitMeasured:
      "Identifier en 1 journée les 3 tâches qui font perdre le plus de temps à votre cabinet — et chiffrer le gain récupérable.",
    beforeScenario:
      "Votre équipe ressaisit des données entre Excel, votre logiciel comptable et les mails clients. Chaque mois, 2 à 3 jours partent en corrections d'erreurs de saisie.",
    afterScenario:
      "L'audit cartographie exactement où l'IA peut prendre le relais : extraction automatique des pièces, rapprochement bancaire, relances clients. Votre équipe valide au lieu de saisir.",
    sectorLexicon: [
      "rapprochement bancaire",
      "lettrage",
      "liasse fiscale",
      "FEC",
      "pièces justificatives",
      "relances clients",
      "clôture mensuelle",
      "TVA déductible",
    ],
    objection:
      "Nos clients nous envoient leurs docs dans tous les formats, l'IA ne peut pas gérer ça.",
    objectionReply:
      "C'est exactement ce que l'audit évalue : quels formats entrent, lesquels sont automatisables maintenant, lesquels dans 6 mois.",
    kpiLabel: "heures/mois récupérées sur la saisie",
    typicalBudgetSignal: "Équivalent à 1 jour de collaborateur/mois",
  },
  {
    secteur: "comptabilite_finance",
    verticale: "implementations",
    painStatement:
      "Vos collaborateurs passent plus de temps à chercher des infos dans les dossiers clients qu'à faire de la vraie comptabilité.",
    benefitMeasured:
      "Réduction de 60 à 70 % du temps de recherche documentaire — retrouver une pièce en 10 secondes au lieu de 8 minutes.",
    beforeScenario:
      "Un client appelle pour une question sur sa liasse N-1. Votre collaborateur cherche 15 minutes dans les mails, les drives et les classeurs.",
    afterScenario:
      "Il tape la question en langage naturel dans votre outil interne. La réponse et la pièce source apparaissent en 10 secondes.",
    sectorLexicon: [
      "dossier client",
      "liasse",
      "bilan",
      "compte de résultat",
      "OEC",
      "expert-comptable",
      "collaborateur",
      "mission",
    ],
    objection: "Nos données sont confidentielles, on ne peut pas les mettre dans une IA.",
    objectionReply:
      "L'implémentation tourne sur votre infrastructure ou en cloud privé — vos données ne quittent pas votre périmètre.",
    kpiLabel: "minutes/requête client économisées",
    typicalBudgetSignal: "ROI visible dès le 1er mois sur 3 collaborateurs",
  },
  {
    secteur: "comptabilite_finance",
    verticale: "interventions_formations",
    painStatement:
      "Vos collaborateurs ont peur de mal utiliser l'IA et de faire des erreurs qui engagent votre responsabilité.",
    benefitMeasured:
      "Une journée de formation suffit pour que vos équipes utilisent l'IA de façon fiable sur 5 tâches comptables concrètes.",
    beforeScenario:
      "Certains collaborateurs testent ChatGPT en cachette, sans méthode. D'autres refusent catégoriquement. Résultat : zéro gain, risque maximal.",
    afterScenario:
      "Chaque collaborateur connaît les 3 usages validés pour son rôle, les limites à ne pas franchir, et comment vérifier les sorties de l'IA.",
    sectorLexicon: [
      "responsabilité de l'expert",
      "vérification",
      "contrôle qualité",
      "revue",
      "validation",
      "conformité",
    ],
    objection: "Une journée de formation, ça ne suffit pas pour changer les habitudes.",
    objectionReply:
      "La formation est suivie de 30 jours d'accompagnement à distance — on ne vous lâche pas après le présentiel.",
    kpiLabel: "tâches IA maîtrisées par collaborateur",
    typicalBudgetSignal: "Une seule erreur de saisie évitée par mois rentabilise la journée",
  },
  {
    secteur: "comptabilite_finance",
    verticale: "un_a_un",
    painStatement:
      "Vous êtes expert-comptable et vous voulez intégrer l'IA dans votre pratique, mais vous ne savez pas par où commencer sans prendre de risque.",
    benefitMeasured:
      "En une journée 1-to-1, définir votre feuille de route IA personnelle et tester les 2 premiers outils sur vos vrais dossiers.",
    beforeScenario:
      "Vous lisez des articles sur l'IA comptable depuis 6 mois. Vous avez testé 2-3 outils mais rien n'a vraiment collé avec votre façon de travailler.",
    afterScenario:
      "Vous avez un plan concret adapté à votre taille de cabinet et vos types de missions — pas un plan générique d'un éditeur qui veut vous vendre sa solution.",
    sectorLexicon: [
      "cabinet",
      "associé",
      "missions récurrentes",
      "CAC",
      "commissariat aux comptes",
      "DSCG",
    ],
    objection: "Je n'ai pas le temps pour du coaching, j'ai déjà trop de travail.",
    objectionReply:
      "Une journée 1-to-1, prolongeable en coaching régulier (une session par mois ou tous les deux mois). La journée identifie déjà les gains les plus rapides — vous récupérez du temps dès le départ.",
    kpiLabel: "heures/semaine récupérées dès le 1er mois",
    typicalBudgetSignal: "Moins cher qu'un logiciel comptable supplémentaire",
  },

  // ─────────────────────────────────────────────
  // BTP / IMMOBILIER
  // ─────────────────────────────────────────────
  {
    secteur: "btp_immobilier",
    verticale: "audits",
    painStatement:
      "Vous refaites vos devis 3 fois parce que les infos chantier changent en permanence et la coordination entre équipes est chaotique.",
    benefitMeasured:
      "Identifier les 4 points de friction qui font exploser vos délais — et estimer le gain en jours par chantier.",
    beforeScenario:
      "Le chef de chantier appelle le bureau pour une info sur les plans. La secrétaire cherche la bonne version dans les mails. 40 minutes perdues, chantier à l'arrêt.",
    afterScenario:
      "L'audit cartographie vos flux d'information réels : qui cherche quoi, combien de fois par jour, sur quel support. La solution sort de ce diagnostic.",
    sectorLexicon: [
      "devis",
      "CCTP",
      "DPGF",
      "appel d'offres",
      "maître d'ouvrage",
      "conducteur de travaux",
      "situation de travaux",
      "réception de chantier",
    ],
    objection: "Sur un chantier, l'IA ça ne marche pas — trop d'imprévu.",
    objectionReply:
      "L'IA ne gère pas l'imprévu, elle libère du temps pour que vous le gériez mieux. L'audit sépare ce que l'IA peut prendre en charge du reste.",
    kpiLabel: "jours de retard évités par chantier",
    typicalBudgetSignal: "1 jour de retard chantier = plusieurs k€ perdus",
  },
  {
    secteur: "btp_immobilier",
    verticale: "implementations",
    painStatement:
      "Vos devis prennent 3 à 4 heures chacun et vos commerciaux passent plus de temps sur les docs que sur le terrain.",
    benefitMeasured:
      "Générer un premier jet de devis en 20 minutes à partir d'une description chantier — vos commerciaux finalisent et ajustent.",
    beforeScenario:
      "Un commercial passe sa soirée à monter un devis de 40 lignes pour un chantier de rénovation. Il recopie les prix du dernier devis similaire, fait des erreurs, recommence.",
    afterScenario:
      "Il décrit le chantier à l'oral ou en quelques lignes. L'outil génère la structure du devis avec les postes standards. Il ajuste en 20 minutes et envoie.",
    sectorLexicon: [
      "devis",
      "bordereau de prix",
      "sous-traitant",
      "avenant",
      "situation mensuelle",
      "retenue de garantie",
      "appel d'offres public",
    ],
    objection: "Chaque chantier est différent, l'IA ne peut pas faire nos devis.",
    objectionReply:
      "L'IA génère la structure et les postes récurrents. Votre expertise ajuste les spécificités — vous gagnez 2h par devis sans perdre la main.",
    kpiLabel: "heures/devis économisées",
    typicalBudgetSignal: "ROI sur 10 devis/mois dès le 1er mois",
  },
  {
    secteur: "btp_immobilier",
    verticale: "sites_web_augmentes",
    painStatement:
      "Votre site web génère des leads non qualifiés — des particuliers qui cherchent un artisan pour un petit dépannage alors que vous faites du chantier d'envergure.",
    benefitMeasured:
      "Un configurateur en ligne qualifie les prospects avant qu'ils vous appellent — vous ne traitez plus que des leads à votre cible.",
    beforeScenario:
      "Vous recevez 20 demandes par mois. 15 sont hors cible. Vous perdez 3h à répondre à des demandes qui n'aboutiront jamais.",
    afterScenario:
      "Le configurateur pose 5 questions (type de chantier, surface, budget estimé, délai). Les leads hors cible sont filtrés. Vous recevez 5 demandes qualifiées.",
    sectorLexicon: [
      "maîtrise d'œuvre",
      "appel d'offres",
      "qualification",
      "prospects",
      "chantier tertiaire",
      "rénovation énergétique",
      "RGE",
    ],
    objection: "Un configurateur en ligne va faire fuir mes clients qui préfèrent appeler.",
    objectionReply:
      "Le configurateur complète le téléphone — ceux qui préfèrent appeler appellent. Les autres qualifient leur projet avant, et vous gagnez du temps sur les deux.",
    kpiLabel: "taux de leads qualifiés sur total demandes",
    typicalBudgetSignal: "1 chantier supplémentaire/an rembourse l'investissement",
  },

  // ─────────────────────────────────────────────
  // RESTAURATION / HÔTELLERIE
  // ─────────────────────────────────────────────
  {
    secteur: "restauration_hotellerie",
    verticale: "audits",
    painStatement:
      "Vos plannings prennent 3h chaque dimanche soir et vous gérez les remplacements de dernière minute par SMS chaotiques.",
    benefitMeasured:
      "Réduire la planification hebdomadaire de 3h à 25 minutes — et anticiper les besoins de remplacement 48h à l'avance.",
    beforeScenario:
      "Dimanche 22h, vous êtes encore sur Excel à faire le planning de la semaine en jonglant avec les dispos, les contrats, les heures sup. Lundi 7h, un serveur appelle malade.",
    afterScenario:
      "L'audit identifie vos patterns de fréquentation, vos contraintes RH et vos points de rupture. La solution sort de là — pas d'un logiciel vendu par un commercial.",
    sectorLexicon: [
      "planning",
      "couverture",
      "taux d'occupation",
      "réservation",
      "service",
      "extras",
      "saisons hautes",
      "ticket moyen",
    ],
    objection: "Mon secteur tourne avec des gens pas des algos.",
    objectionReply:
      "L'IA gère les tâches administratives pour que vous passiez plus de temps avec vos équipes et vos clients — pas l'inverse.",
    kpiLabel: "heures/semaine récupérées sur l'administratif",
    typicalBudgetSignal: "Équivalent à 2h de main d'œuvre par semaine",
  },
  {
    secteur: "restauration_hotellerie",
    verticale: "implementations",
    painStatement:
      "Vos avis Google s'accumulent sans que vous ayez le temps d'y répondre, ce qui plombe votre référencement local.",
    benefitMeasured:
      "Répondre à 100% de vos avis Google en moins de 24h, avec des réponses personnalisées — sans y passer 1 minute de votre temps.",
    beforeScenario:
      "Vous avez 47 avis sans réponse depuis 3 mois. Vous savez que c'est mauvais pour le SEO et l'image mais vous n'avez pas le temps entre les services.",
    afterScenario:
      "L'outil lit chaque avis, génère une réponse personnalisée qui mentionne un détail spécifique, et vous envoie pour validation d'1 clic. Zéro rédaction de votre part.",
    sectorLexicon: [
      "avis Google",
      "TripAdvisor",
      "référencement local",
      "e-réputation",
      "service en salle",
      "cuisine",
      "chef",
      "établissement",
    ],
    objection: "Les réponses générées par IA ça se voit, c'est impersonnel.",
    objectionReply:
      "On l'entraîne sur vos vraies réponses existantes — le ton, le style, les expressions que vous utilisez. Vos clients ne feront pas la différence.",
    kpiLabel: "% d'avis avec réponse sous 24h",
    typicalBudgetSignal: "Impact direct sur le classement Google Maps local",
  },

  // ─────────────────────────────────────────────
  // SANTÉ / MÉDECINE
  // ─────────────────────────────────────────────
  {
    secteur: "sante_medecine",
    verticale: "audits",
    painStatement:
      "Vos praticiens passent autant de temps sur les dossiers administratifs que sur les patients — et l'attente s'allonge.",
    benefitMeasured:
      "Identifier les 3 tâches administratives qui volent le plus de temps de soin — et estimer les créneaux récupérables par semaine.",
    beforeScenario:
      "Un médecin généraliste voit 25 patients par jour. Il passe 45 minutes supplémentaires le soir à compléter des comptes-rendus et courriers.",
    afterScenario:
      "L'audit analyse vos flux administratifs réels (sans toucher aux données patients) et identifie où l'IA peut dicter, rédiger et formater à la place du praticien.",
    sectorLexicon: [
      "compte-rendu",
      "ordonnance",
      "CPAM",
      "cotation CCAM",
      "DMP",
      "téléconsultation",
      "secrétariat médical",
      "agenda",
    ],
    objection: "Nous ne pouvons pas utiliser l'IA avec des données de santé — RGPD.",
    objectionReply:
      "L'audit porte sur les flux et processus, pas les données patients. Les solutions recommandées sont présélectionnées pour la conformité HDS.",
    kpiLabel: "minutes administratives économisées par consultation",
    typicalBudgetSignal: "1 consultation supplémentaire/jour = ROI en semaines",
  },
  {
    secteur: "sante_medecine",
    verticale: "sites_web_augmentes",
    painStatement:
      "Vos patients appellent pour des demandes simples (disponibilités, renouvellements, documents) qui saturent votre secrétariat.",
    benefitMeasured:
      "Dévier 40 à 60% des appels entrants vers un assistant en ligne — votre secrétariat se concentre sur les urgences et cas complexes.",
    beforeScenario:
      "Votre secrétaire reçoit 80 appels par jour. 50 sont pour savoir si vous avez des créneaux ou pour demander une ordonnance de renouvellement.",
    afterScenario:
      "L'assistant en ligne répond 24h/24 aux questions récurrentes, propose les créneaux disponibles et remonte les demandes urgentes à votre secrétariat.",
    sectorLexicon: [
      "prise en charge",
      "créneaux",
      "renouvellement",
      "secrétariat",
      "agenda",
      "Doctolib",
      "urgences",
      "cabinet de groupe",
    ],
    objection: "Mes patients sont âgés, ils ne savent pas utiliser un chatbot.",
    objectionReply:
      "L'assistant s'adapte : les patients à l'aise en ligne l'utilisent, les autres appellent toujours. Votre secrétariat est simplement moins saturé.",
    kpiLabel: "% d'appels simples déviés vers le self-service",
    typicalBudgetSignal: "Équivalent à 0,5 ETP secrétariat",
  },

  // ─────────────────────────────────────────────
  // JURIDIQUE
  // ─────────────────────────────────────────────
  {
    secteur: "juridique",
    verticale: "audits",
    painStatement:
      "Vos collaborateurs passent des heures à chercher de la jurisprudence et à rédiger des actes répétitifs au lieu de conseiller les clients.",
    benefitMeasured:
      "Récupérer 30 à 40% du temps de recherche documentaire — votre équipe conseille plus et cherche moins.",
    beforeScenario:
      "Un collaborateur junior passe 2h à compiler la jurisprudence pour un dossier. Son associé refait partiellement le travail car le format n'est pas le bon.",
    afterScenario:
      "L'audit identifie vos types d'actes les plus répétitifs et vos sources documentaires. La feuille de route IA sort de ce diagnostic — pas d'un vendeur de solution.",
    sectorLexicon: [
      "jurisprudence",
      "acte",
      "contentieux",
      "conseil",
      "rédaction",
      "conclusions",
      "plaidoirie",
      "cabinet d'avocats",
      "barreau",
    ],
    objection: "Le droit ne tolère pas les erreurs — on ne peut pas faire confiance à l'IA.",
    objectionReply:
      "L'IA ne remplace pas le juriste, elle prépare le travail. L'audit identifie les tâches où le risque d'erreur est faible et le gain de temps élevé.",
    kpiLabel: "heures de recherche économisées par dossier",
    typicalBudgetSignal: "Équivalent à 1 jour de collaborateur junior par dossier complexe",
  },
  {
    secteur: "juridique",
    verticale: "implementations",
    painStatement:
      "Vos actes types et modèles sont dispersés, mal versionnés, et vos collaborateurs perdent du temps à retrouver le bon document.",
    benefitMeasured:
      "Un assistant interne qui retrouve, adapte et pré-renseigne n'importe quel modèle d'acte en 30 secondes à partir d'une description.",
    beforeScenario:
      "Un collaborateur cherche 20 minutes le bon modèle de bail commercial dans les dossiers partagés. Il trouve une version de 2019 dont il n'est pas sûr qu'elle soit à jour.",
    afterScenario:
      "Il décrit le contexte en 2 lignes. L'assistant retrouve le modèle valide, le pré-renseigne avec les données du client et l'affiche pour révision finale.",
    sectorLexicon: [
      "modèle d'acte",
      "statuts",
      "bail",
      "convention",
      "cession",
      "mandat",
      "procuration",
      "notification",
    ],
    objection:
      "Nos modèles sont confidentiels et complexes, on ne peut pas les mettre dans un système externe.",
    objectionReply:
      "Le système tourne sur votre infrastructure — vos modèles restent dans votre environnement sécurisé.",
    kpiLabel: "minutes/acte économisées sur la recherche documentaire",
    typicalBudgetSignal: "ROI visible dès le 2ème mois avec 3 collaborateurs",
  },

  // ─────────────────────────────────────────────
  // COMMERCE / RETAIL
  // ─────────────────────────────────────────────
  {
    secteur: "commerce_retail",
    verticale: "audits",
    painStatement:
      "Vous ne savez pas quels produits vont manquer avant qu'ils manquent, et vous avez toujours trop de stock sur ce qui ne se vend pas.",
    benefitMeasured:
      "Réduire les ruptures de stock de 40% et le stock dormant de 25% en 3 mois — sans changer votre logiciel de caisse.",
    beforeScenario:
      "Votre meilleur produit est en rupture depuis mardi. Vous l'avez vu venir trop tard. Pendant ce temps, 8 références prennent la poussière en réserve.",
    afterScenario:
      "L'audit analyse vos historiques de vente, vos saisonnalités et vos patterns de rupture. La recommandation sort du diagnostic — pas d'un vendeur de logiciel.",
    sectorLexicon: [
      "rupture de stock",
      "rotation",
      "réassort",
      "référence",
      "marge",
      "panier moyen",
      "saisonnalité",
      "centrale d'achat",
    ],
    objection: "Mon secteur est trop imprévisible pour qu'une IA prédise quoi que ce soit.",
    objectionReply:
      "L'IA ne prédit pas parfaitement — elle prédit mieux que l'intuition seule, avec vos propres données de vente comme base.",
    kpiLabel: "% de ruptures évitées sur les top références",
    typicalBudgetSignal: "1% de CA récupéré sur les ruptures = ROI immédiat",
  },
  {
    secteur: "commerce_retail",
    verticale: "sites_web_augmentes",
    painStatement:
      "Votre site e-commerce génère des visites mais peu d'achats — vos clients partent sans trouver ce qu'ils cherchent.",
    benefitMeasured:
      "Augmenter le taux de conversion de 15 à 30% avec un assistant produit qui guide l'acheteur vers la bonne référence.",
    beforeScenario:
      "Un client cherche une perceuse pour du béton. Il voit 47 références, ne sait pas laquelle choisir, abandonne son panier et commande ailleurs.",
    afterScenario:
      "L'assistant lui pose 3 questions (usage, fréquence, budget). Il lui recommande les 2 meilleures options avec explication. Il achète en 4 minutes.",
    sectorLexicon: [
      "taux de conversion",
      "panier",
      "fiche produit",
      "cross-sell",
      "upsell",
      "abandon de panier",
      "catalogue",
      "référencement produit",
    ],
    objection: "Un chatbot sur mon site va faire cheap.",
    objectionReply:
      "C'est une question de design et de ton — on cale l'assistant sur l'identité de votre marque. Zara et Sephora en ont. Ça ne fait pas cheap.",
    kpiLabel: "taux de conversion avant/après",
    typicalBudgetSignal: "ROI calculé sur le CA récupéré sur les abandons de panier",
  },

  // ─────────────────────────────────────────────
  // INDUSTRIE / LOGISTIQUE
  // ─────────────────────────────────────────────
  {
    secteur: "industrie_logistique",
    verticale: "audits",
    painStatement:
      "Vos équipes maintenance passent autant de temps à chercher les historiques de pannes qu'à les réparer.",
    benefitMeasured:
      "Réduire le temps de diagnostic de panne de 50% — vos techniciens trouvent l'historique et le bon protocole en 2 minutes au lieu de 20.",
    beforeScenario:
      "Une machine tombe en panne. Le technicien cherche dans les classeurs papier et les tableurs Excel qui n'ont pas été mis à jour depuis 3 mois.",
    afterScenario:
      "Il décrit le symptôme sur sa tablette. L'assistant retrouve les 3 pannes similaires passées, les solutions appliquées et le temps de résolution.",
    sectorLexicon: [
      "maintenance préventive",
      "GMAO",
      "temps d'arrêt",
      "TRS",
      "panne",
      "ordre de travail",
      "technicien",
      "pièces détachées",
    ],
    objection: "Nos techniciens ne vont pas utiliser un outil informatique sur le terrain.",
    objectionReply:
      "L'interface est pensée pour une utilisation en atelier — voix ou 3 clics maximum. L'audit intègre le test terrain dans sa démarche.",
    kpiLabel: "MTTR (Mean Time To Repair) réduit en %",
    typicalBudgetSignal: "1h d'arrêt machine évitée = valeur immédiate calculable",
  },
  {
    secteur: "industrie_logistique",
    verticale: "implementations",
    painStatement:
      "Vos bons de commande et documents fournisseurs arrivent dans tous les formats et votre équipe ADV les ressaisit à la main.",
    benefitMeasured:
      "Automatiser 80% de la saisie des bons de commande entrants — votre ADV traite les exceptions au lieu de tout saisir.",
    beforeScenario:
      "Votre équipe reçoit 50 bons de commande par jour en PDF, Word et mail. Chaque saisie manuelle prend 8 minutes. 400 minutes perdues chaque jour.",
    afterScenario:
      "L'outil extrait automatiquement les données clés (références, quantités, adresses), les contrôle et les injecte dans votre ERP. L'équipe valide les anomalies.",
    sectorLexicon: [
      "ADV",
      "ERP",
      "bon de commande",
      "fournisseur",
      "réception",
      "écart",
      "facture",
      "incoterms",
    ],
    objection: "On a déjà un ERP, on ne va pas tout refaire.",
    objectionReply:
      "L'outil se connecte à votre ERP existant — on n'en change pas. C'est une couche d'automatisation par-dessus votre système actuel.",
    kpiLabel: "bons de commande traités automatiquement en %",
    typicalBudgetSignal: "Équivalent à 1 ETP sur la saisie ADV",
  },

  // ─────────────────────────────────────────────
  // ARTISANAT / SERVICES
  // ─────────────────────────────────────────────
  {
    secteur: "artisanat_services",
    verticale: "audits",
    painStatement:
      "Vous êtes artisan et vous perdez des contrats parce que vos devis arrivent trop tard ou ne sont pas assez professionnels.",
    benefitMeasured:
      "Envoyer un devis professionnel en moins de 2h après la visite client — au lieu de 2 à 3 jours.",
    beforeScenario:
      "Vous visitez un client mardi matin. Vous faites le devis mardi soir, vous le relisez mercredi, vous l'envoyez jeudi. Le client a signé avec quelqu'un d'autre mercredi.",
    afterScenario:
      "L'audit identifie vos frictions : où vous perdez du temps, pourquoi vos devis sont lents, ce qui peut être automatisé. La solution sort de là.",
    sectorLexicon: [
      "devis",
      "facturation",
      "SIRET",
      "auto-entrepreneur",
      "chantier",
      "main d'œuvre",
      "fournitures",
      "acompte",
    ],
    objection: "Je suis artisan, pas informaticien — je ne vais pas gérer un système IA.",
    objectionReply:
      "L'audit débouche sur une recommandation adaptée à votre niveau : parfois c'est un simple outil, pas une implémentation complexe.",
    kpiLabel: "délai moyen de remise de devis réduit",
    typicalBudgetSignal: "1 contrat récupéré grâce à la rapidité = ROI immédiat",
  },
  {
    secteur: "artisanat_services",
    verticale: "interventions_formations",
    painStatement:
      "Vous savez que l'IA pourrait vous faire gagner du temps mais vous ne savez pas par où commencer sans vous tromper d'outil.",
    benefitMeasured:
      "En une demi-journée, identifier les 2 outils qui correspondent à votre métier et les tester sur vos vrais cas.",
    beforeScenario:
      "Vous avez essayé ChatGPT. Vous avez vu des vidéos YouTube. Mais rien de concret sur la création de devis pour un plombier ou les relances pour un électricien.",
    afterScenario:
      "La formation est construite sur votre métier : devis, planning, relances clients, réponses aux avis. Vous repartez avec des outils que vous utilisez le lendemain.",
    sectorLexicon: [
      "devis",
      "planning chantier",
      "relances",
      "facture",
      "client",
      "sous-traitant",
      "artisan",
      "TPE",
    ],
    objection: "Les formations informatiques ce n'est pas pour moi.",
    objectionReply:
      "On travaille sur votre téléphone ou votre PC, avec des outils gratuits ou très peu chers. Aucun prérequis technique.",
    kpiLabel: "outils IA maîtrisés et utilisés le lendemain",
    typicalBudgetSignal: "2 heures de paperasse gagnées par semaine, soit une journée par mois",
  },

  // ─────────────────────────────────────────────
  // RH / RECRUTEMENT
  // ─────────────────────────────────────────────
  {
    secteur: "rh_recrutement",
    verticale: "audits",
    painStatement:
      "Vos recruteurs passent 60% de leur temps sur des tâches administratives et 40% à vraiment recruter.",
    benefitMeasured:
      "Inverser ce ratio en 3 mois : 70% du temps sur les candidats, 30% sur l'admin.",
    beforeScenario:
      "Un recruteur reçoit 200 CVs pour un poste. Il en lit 180 qui ne correspondent pas. Il rédige 180 mails de refus. Il n'a plus le temps de bien qualifier les 20 bons.",
    afterScenario:
      "L'audit cartographie où le temps part réellement. La solution — pré-filtrage, rédaction automatique des refus, génération de questions d'entretien — sort du diagnostic.",
    sectorLexicon: [
      "sourcing",
      "CVthèque",
      "ATS",
      "candidat",
      "onboarding",
      "job board",
      "cooptation",
      "entretien",
    ],
    objection: "Si l'IA filtre les CVs, on va rater des profils atypiques.",
    objectionReply:
      "L'IA pré-trie, vos recruteurs décident. Elle réduit le volume à traiter, pas le pouvoir de décision humain.",
    kpiLabel: "% du temps recruteur sur les candidats vs admin",
    typicalBudgetSignal: "1 recrutement raté coûte 15 à 30k€ en moyenne", // price-exempt: statistique marché (coût d'un mauvais recrutement), pas un tarif Axion-IA
  },
  {
    secteur: "rh_recrutement",
    verticale: "implementations",
    painStatement:
      "Vos fiches de poste sont génériques, vos annonces ne se démarquent pas et votre taux de candidature est en baisse.",
    benefitMeasured:
      "Multiplier par 2 le nombre de candidatures qualifiées avec des annonces différenciées générées en 10 minutes.",
    beforeScenario:
      "Votre RH copie-colle la fiche de poste de l'an dernier, change 3 mots et publie. Le poste reste ouvert 3 mois et vous coûte en intérim.",
    afterScenario:
      "Il décrit le poste, le profil idéal et ce qui différencie votre entreprise. L'outil génère 3 variantes d'annonces optimisées pour chaque job board.",
    sectorLexicon: [
      "fiche de poste",
      "annonce",
      "job board",
      "LinkedIn",
      "Indeed",
      "GPEC",
      "mobilité interne",
      "marque employeur",
    ],
    objection:
      "Nos annonces doivent être validées par la direction — on ne peut pas automatiser ça.",
    objectionReply:
      "L'outil génère, votre direction valide. Vous gagnez du temps sur la rédaction, pas sur la validation.",
    kpiLabel: "candidatures qualifiées reçues par annonce",
    typicalBudgetSignal: "Réduction du délai de recrutement de X semaines",
  },

  // ─────────────────────────────────────────────
  // COLLECTIVITÉS / PUBLIC
  // ─────────────────────────────────────────────
  {
    secteur: "collectivites_public",
    verticale: "audits",
    painStatement:
      "Vos agents passent trop de temps à répondre aux mêmes questions des administrés et à traiter des demandes répétitives.",
    benefitMeasured:
      "Identifier les 5 démarches les plus chronophages et estimer les ETP récupérables sans réduction d'effectifs.",
    beforeScenario:
      "Votre accueil reçoit 80 appels par jour. 55 concernent les mêmes 8 questions (horaires, démarches, documents à fournir). Vos agents sont épuisés et peu disponibles pour les cas complexes.",
    afterScenario:
      "L'audit analyse vos flux d'appels et de demandes. Il identifie ce qui peut être automatisé sans dégrader le service aux administrés.",
    sectorLexicon: [
      "administré",
      "guichet",
      "instruction",
      "délibération",
      "marchés publics",
      "DGFIP",
      "DSI",
      "agent territorial",
    ],
    objection: "Le service public ne peut pas réduire le contact humain avec les administrés.",
    objectionReply:
      "L'objectif est l'inverse : libérer vos agents des questions répétitives pour qu'ils soient plus disponibles pour les cas qui nécessitent une vraie aide humaine.",
    kpiLabel: "ETP libérés sur les tâches répétitives",
    typicalBudgetSignal: "Un demi-ETP d'accueil libéré, réaffecté aux cas complexes",
  },
  {
    secteur: "collectivites_public",
    verticale: "interventions_formations",
    painStatement:
      "Vos agents utilisent l'IA de façon non encadrée, avec des risques de confidentialité et de désinformation que vous ne maîtrisez pas.",
    benefitMeasured:
      "Un cadre d'usage IA validé par votre DSI et vos élus, avec 100% des agents formés sur les règles et les outils autorisés.",
    beforeScenario:
      "Certains agents utilisent ChatGPT pour rédiger des courriers administratifs avec des données sensibles. La collectivité n'a aucune visibilité ni politique officielle.",
    afterScenario:
      "Une charte IA est adoptée. Les agents formés connaissent les outils autorisés, les données qu'on ne met pas dans une IA, et les cas d'usage validés.",
    sectorLexicon: [
      "charte IA",
      "DSI",
      "RGPD",
      "données personnelles",
      "délibération",
      "agent public",
      "service public numérique",
    ],
    objection: "On attend les directives de l'État avant de bouger.",
    objectionReply:
      "La formation prépare vos agents aux directives à venir — celles qui attendent seront en retard. Les premières collectivités formées maîtrisent leur déploiement.",
    kpiLabel: "% d'agents formés et conformes à la charte IA",
    typicalBudgetSignal: "Une journée pour cadrer 100% des agents avant le premier incident RGPD",
  },

  // ─────────────────────────────────────────────
  // Combos complétés 2026-06-21 (Phase 2 — couverture 50/50)
  // ─────────────────────────────────────────────
  {
    secteur: "comptabilite_finance",
    verticale: "sites_web_augmentes",
    painStatement:
      "Votre site cabinet attire des prospects mal qualifiés — des particuliers qui cherchent à déclarer leurs impôts alors que vous visez des dirigeants de PME.",
    benefitMeasured:
      "Filtrer 50 à 70 % des demandes hors cible avant le premier rendez-vous — vous ne recevez plus que des prospects dans votre périmètre de mission.",
    beforeScenario:
      "Votre secrétaire prend 30 appels de prospects par mois via le formulaire du site. La moitié veut une simple déclaration de revenus pour particulier, pas un suivi de TPE. Votre associé perd des rendez-vous découverte sur des dossiers non rentables.",
    afterScenario:
      "L'assistant en ligne qualifie chaque demande (forme juridique, régime fiscal, chiffre d'affaires, type de mission) et oriente. Les particuliers obtiennent une réponse, vous récupérez les prospects à votre cible directement dans votre agenda de rendez-vous.",
    sectorLexicon: [
      "lettre de mission",
      "honoraires",
      "tenue comptable",
      "régime réel",
      "micro-entreprise",
      "rendez-vous bilan",
      "portail client",
      "expertise comptable",
    ],
    objection:
      "Un assistant en ligne va donner une image froide, alors que la comptabilité c'est une relation de confiance.",
    objectionReply:
      "Il pré-qualifie pour que vous consacriez vos rendez-vous aux prospects sérieux — la relation de confiance se construit en face-à-face, pas dans le tri des demandes.",
    kpiLabel: "taux de demandes qualifiées sur total formulaire",
    typicalBudgetSignal: "1 mission récurrente signée/an rembourse le site",
  },
  {
    secteur: "btp_immobilier",
    verticale: "interventions_formations",
    painStatement:
      "Vos équipes bureau perdent un temps fou sur les comptes rendus de chantier, les relances de sous-traitants et la paperasse, sans savoir quels outils IA pourraient les aider.",
    benefitMeasured:
      "En une journée de formation, vos équipes maîtrisent 4 usages IA concrets — compte rendu de réunion de chantier, relances, courriers, synthèse de CCTP.",
    beforeScenario:
      "Votre conducteur de travaux passe ses vendredis après-midi à rédiger les comptes rendus de réunion de chantier de mémoire, et votre assistante relance les sous-traitants un par un par mail recopié à la main.",
    afterScenario:
      "Le conducteur de travaux dicte ses notes de réunion, l'IA structure le compte rendu avec les réserves et les actions. L'assistante génère ses relances en lot. Ils repartent de la formation avec ces réflexes opérationnels dès le lundi.",
    sectorLexicon: [
      "compte rendu de chantier",
      "réunion de chantier",
      "réserves",
      "sous-traitant",
      "CCTP",
      "conducteur de travaux",
      "OPR",
      "PV de réception",
    ],
    objection:
      "Mes gars sont sur le terrain, ils n'ont pas le temps ni l'envie de suivre une formation informatique.",
    objectionReply:
      "La formation est calée sur leurs vraies tâches bureau, pas sur de la théorie. Une seule journée, et ils récupèrent leurs vendredis après-midi.",
    kpiLabel: "heures/semaine récupérées sur la paperasse chantier",
    typicalBudgetSignal: "Un vendredi après-midi récupéré par personne, chaque semaine",
  },
  {
    secteur: "btp_immobilier",
    verticale: "un_a_un",
    painStatement:
      "Vous dirigez votre entreprise du bâtiment et vous sentez que l'IA pourrait vous faire gagner du temps, mais entre les chantiers vous n'avez ni le temps ni le recul pour vous y mettre.",
    benefitMeasured:
      "En une journée 1-to-1, repartir avec votre propre méthode IA sur les 2 tâches qui vous mangent le plus — chiffrage et suivi de vos affaires.",
    beforeScenario:
      "Vous êtes gérant et chef de chantier à la fois. Vous chiffrez vos appels d'offres le soir après les visites, vous suivez vos situations de travaux sur un tableur, et vous n'avancez jamais sur le fond de votre entreprise.",
    afterScenario:
      "Vous avez une méthode taillée pour votre activité : un premier jet de chiffrage à partir de vos métrés, un suivi d'affaires clarifié. Vous reprenez la main sur votre agenda de dirigeant au lieu de tout porter seul.",
    sectorLexicon: [
      "chiffrage",
      "appel d'offres",
      "métré",
      "situation de travaux",
      "gérant",
      "marge de chantier",
      "carnet de commandes",
      "trésorerie",
    ],
    objection:
      "Le coaching c'est pour les start-up parisiennes, pas pour un patron de boîte du bâtiment comme moi.",
    objectionReply:
      "On part de vos chantiers et de vos devis réels, pas de théorie. Une journée 1-to-1 calée sur votre agenda, prolongeable en coaching régulier — et vous gagnez du temps dès la première session.",
    kpiLabel: "heures/semaine de dirigeant récupérées sur le chiffrage",
    typicalBudgetSignal: "Moins cher qu'une journée d'arrêt de chantier",
  },
  {
    secteur: "restauration_hotellerie",
    verticale: "interventions_formations",
    painStatement:
      "Votre équipe perd du temps sur les réservations par téléphone, les réponses aux avis et la communication réseaux sociaux, sans méthode ni outils adaptés au rythme du service.",
    benefitMeasured:
      "En une demi-journée, votre équipe sait utiliser l'IA pour 4 tâches concrètes — réponses aux avis, posts réseaux, fiches plats, mails groupes — entre deux services.",
    beforeScenario:
      "Votre maître d'hôtel rédige les posts Instagram entre le coup de feu du midi et la mise en place du soir, votre responsable de salle répond aux avis quand elle y pense, et la communication reste irrégulière.",
    afterScenario:
      "L'équipe repart avec des réflexes simples : générer un post à partir d'une photo de plat, répondre à un avis dans le ton de la maison, rédiger un mail pour un groupe. La communication tient sans empiéter sur le service.",
    sectorLexicon: [
      "service",
      "coup de feu",
      "mise en place",
      "carte",
      "maître d'hôtel",
      "avis client",
      "réservation de groupe",
      "ticket moyen",
    ],
    objection:
      "En restauration on n'a pas le temps de former le personnel, et le turnover est trop élevé pour que ça serve.",
    objectionReply:
      "Une demi-journée, sur des gestes simples que même un extra reprend vite. La méthode reste, même si l'équipe tourne.",
    kpiLabel: "heures/semaine récupérées sur la communication hors service",
    typicalBudgetSignal: "Rentabilisé dès qu'un avis client bien géré ramène une table",
  },
  {
    secteur: "restauration_hotellerie",
    verticale: "un_a_un",
    painStatement:
      "Vous dirigez votre restaurant ou votre hôtel et vous courez du matin au soir, sans jamais le recul pour voir où l'IA pourrait vous soulager sur la gestion.",
    benefitMeasured:
      "En une journée 1-to-1, repartir avec votre propre méthode IA sur les 2 chantiers qui vous épuisent — planning des équipes et pilotage de la marge.",
    beforeScenario:
      "Vous êtes en cuisine ou en salle toute la journée, puis vous faites le planning de la brigade le dimanche soir et vous calculez vos food cost à la calculatrice en fin de mois. Vous ne sortez jamais la tête du guidon.",
    afterScenario:
      "Vous avez une méthode adaptée à votre établissement : un planning préparé plus vite, un suivi de marge et de ratio matière clarifié. Vous reprenez du temps de dirigeant pour penser votre carte et votre développement.",
    sectorLexicon: [
      "brigade",
      "food cost",
      "ratio matière",
      "planning",
      "couverts",
      "ticket moyen",
      "taux d'occupation",
      "carte",
    ],
    objection: "Je suis un homme de métier, pas de bureau — l'informatique et moi ça fait deux.",
    objectionReply:
      "On part de votre planning et de vos ratios réels, pas d'un logiciel à apprendre. Une journée 1-to-1, ou un coaching régulier à votre rythme (une session par mois) — concret, calé sur vos contraintes de service.",
    kpiLabel: "heures/semaine de dirigeant récupérées sur la gestion",
    typicalBudgetSignal: "Moins cher qu'un soir de service perdu",
  },
  {
    secteur: "restauration_hotellerie",
    verticale: "sites_web_augmentes",
    painStatement:
      "Votre site reçoit des demandes de réservation et de privatisation par mail auxquelles vous répondez tard le soir, et vous perdez des groupes qui réservent ailleurs entre-temps.",
    benefitMeasured:
      "Répondre instantanément 24h/24 aux demandes de réservation et de privatisation — capter 30 à 50 % de demandes groupe en plus sans y passer vos soirées.",
    beforeScenario:
      "Un client envoie une demande de privatisation pour un anniversaire de 20 couverts via votre site. Vous la voyez le lendemain soir après le service. Le client a déjà réservé dans le restaurant qui a répondu dans l'heure.",
    afterScenario:
      "L'assistant en ligne répond aussitôt avec vos disponibilités, votre menu groupe et votre ticket moyen, propose un créneau et remonte la demande qualifiée dans votre boîte. Vous concluez le lendemain au lieu de la perdre.",
    sectorLexicon: [
      "réservation",
      "privatisation",
      "couverts",
      "menu groupe",
      "no-show",
      "ticket moyen",
      "demande de devis",
      "événementiel",
    ],
    objection:
      "Mes clients veulent un contact humain quand ils privatisent, pas un robot qui répond.",
    objectionReply:
      "L'assistant capte la demande et donne les infos clés tout de suite ; c'est vous qui finalisez en personne. Sans lui, le client est déjà parti avant votre réponse.",
    kpiLabel: "% de demandes de privatisation traitées sous 1h",
    typicalBudgetSignal: "1 privatisation de groupe/mois rembourse le site",
  },
  {
    secteur: "sante_medecine",
    verticale: "interventions_formations",
    painStatement:
      "Vos soignants bricolent l'IA en cachette sur leurs comptes-rendus, sans personne pour leur dire ce qui est interdit avec le secret médical.",
    benefitMeasured:
      "En une journée, vos équipes maîtrisent 4 usages validés et la ligne rouge à ne jamais franchir : aucune donnée patient identifiante dans un outil non HDS.",
    beforeScenario:
      "Une infirmière coordinatrice colle des extraits de dossier patient dans ChatGPT pour reformuler une transmission. Personne au cabinet ne sait si c'est légal, ni où s'arrête le secret médical.",
    afterScenario:
      "Chaque soignant connaît les usages autorisés pour son rôle (dictée, reformulation de courrier, synthèse de protocole) et sait pseudonymiser avant tout recours à un outil hors hébergeur agréé.",
    sectorLexicon: [
      "secret médical",
      "compte-rendu",
      "transmission",
      "déontologie",
      "hébergeur HDS",
      "pseudonymisation",
      "dossier patient",
      "données de santé",
    ],
    objection:
      "Former mes équipes à l'IA, c'est leur ouvrir une porte qu'on devrait garder fermée vu le secret médical.",
    objectionReply:
      "C'est l'inverse : la formation pose justement le cadre. Sans elle, vos soignants l'utilisent déjà, mais sans aucune règle ni filet de sécurité.",
    kpiLabel: "% de soignants formés aux usages conformes au secret médical",
    typicalBudgetSignal: "Sans commune mesure avec le coût d'une seule fuite de donnée patient",
  },
  {
    secteur: "sante_medecine",
    verticale: "implementations",
    painStatement:
      "Vos médecins dictent leurs comptes-rendus le soir et votre secrétariat ressaisit tout le lendemain, avec un délai qui retarde les courriers aux confrères.",
    benefitMeasured:
      "Réduire de 50 à 70 % le temps de mise en forme des comptes-rendus — une dictée devient un courrier structuré, relu et signé en quelques minutes.",
    beforeScenario:
      "Un cardiologue dicte 15 comptes-rendus sur dictaphone après ses consultations. La secrétaire médicale les retranscrit le lendemain matin, puis met chaque courrier au format avant envoi au médecin traitant.",
    afterScenario:
      "La dictée est transcrite et structurée automatiquement au bon format (motif, examen, conclusion, conduite à tenir). Le praticien relit, corrige et valide — la ressaisie disparaît.",
    sectorLexicon: [
      "compte-rendu",
      "dictée médicale",
      "courrier au confrère",
      "médecin traitant",
      "secrétariat médical",
      "cotation CCAM",
      "DMP",
      "logiciel métier",
    ],
    objection:
      "La transcription va passer par un serveur externe — c'est incompatible avec des données de santé.",
    objectionReply:
      "L'implémentation se fait sur un hébergeur agréé HDS, dans votre périmètre. Les données patients ne sortent jamais d'un environnement certifié.",
    kpiLabel: "minutes de ressaisie économisées par compte-rendu",
    typicalBudgetSignal: "Équivalent à 0,5 ETP secrétariat médical libéré",
  },
  {
    secteur: "sante_medecine",
    verticale: "un_a_un",
    painStatement:
      "Vous dirigez un cabinet ou une maison de santé et vous voyez l'IA arriver, mais vous ne savez pas par où l'introduire sans risquer le secret médical ni braquer votre équipe.",
    benefitMeasured:
      "En une journée 1-to-1, repartir avec une feuille de route IA adaptée à votre structure et 2 premiers usages testés sur vos propres flux — sans aucune donnée patient exposée.",
    beforeScenario:
      "Vous êtes médecin coordinateur d'une MSP. Vous lisez des articles sur l'IA en santé depuis des mois, deux confrères vous posent des questions, et vous n'avez aucune position claire à leur donner.",
    afterScenario:
      "Vous avez un plan concret calibré pour votre structure : quels usages lancer d'abord, où s'arrête la déontologie, comment embarquer les soignants — pas un discours générique d'éditeur de logiciel.",
    sectorLexicon: [
      "maison de santé",
      "médecin coordinateur",
      "déontologie",
      "Ordre des médecins",
      "secret médical",
      "RPPS",
      "ALD",
      "parcours de soins",
    ],
    objection: "Je n'ai pas le temps pour du coaching, mes consultations débordent déjà.",
    objectionReply:
      "Une journée 1-to-1, en visio si besoin, prolongeable en coaching régulier. Elle vise déjà les gains de temps administratifs les plus rapides — vous en récupérez dès le départ.",
    kpiLabel: "heures administratives/semaine récupérées par le praticien",
    typicalBudgetSignal: "Moins cher qu'un mois de prestation de secrétariat externalisé",
  },
  {
    secteur: "juridique",
    verticale: "interventions_formations",
    painStatement:
      "Vos collaborateurs utilisent déjà l'IA pour dégrossir des actes, mais sans méthode ni contrôle — un risque direct pour votre responsabilité et le secret professionnel.",
    benefitMeasured:
      "En une journée, vos équipes maîtrisent 5 usages fiables (recherche, synthèse, première trame d'acte) et la règle d'or : toujours vérifier la jurisprudence citée par l'IA.",
    beforeScenario:
      "Un collaborateur junior demande à ChatGPT de lui résumer une jurisprudence et la cite telle quelle dans ses conclusions. L'arrêt n'existe pas. L'associé le découvre la veille de l'audience.",
    afterScenario:
      "Chaque collaborateur connaît les usages validés pour sa fonction, les limites à ne pas franchir avec des données clients, et comment systématiquement contrôler toute référence avant de l'intégrer à un acte.",
    sectorLexicon: [
      "acte",
      "jurisprudence",
      "conclusions",
      "secret professionnel",
      "barreau",
      "déontologie",
      "clerc",
      "contentieux",
    ],
    objection:
      "Le droit ne tolère pas l'à-peu-près — former à l'IA, c'est encourager des erreurs qui engagent le cabinet.",
    objectionReply:
      "Vos collaborateurs l'utilisent déjà sans cadre, c'est ça le vrai risque. La formation leur apprend justement à vérifier et à ne jamais citer sans contrôle.",
    kpiLabel: "% de collaborateurs formés au contrôle systématique des sorties IA",
    typicalBudgetSignal: "Une seule jurisprudence inventée évitée vaut bien plus qu'une journée",
  },
  {
    secteur: "juridique",
    verticale: "un_a_un",
    painStatement:
      "Vous êtes avocat ou notaire associé et vous voulez intégrer l'IA à votre pratique, mais pas au prix du secret professionnel ni d'une erreur dans un acte.",
    benefitMeasured:
      "En une journée 1-to-1, définir votre feuille de route IA personnelle et tester 2 outils sur vos vrais dossiers — recherche et rédaction — sans exposer aucune donnée client.",
    beforeScenario:
      "Vous êtes associé d'une étude notariale. Vous avez testé un ou deux outils sur des actes types, mais sans savoir s'ils respectent le secret professionnel ni jusqu'où vous pouvez leur confier un dossier.",
    afterScenario:
      "Vous avez un plan concret adapté à votre activité et à votre niveau d'exigence déontologique : quels usages lancer, quelles données ne jamais transmettre, comment garder la main sur chaque acte.",
    sectorLexicon: [
      "étude notariale",
      "acte authentique",
      "secret professionnel",
      "barreau",
      "clerc",
      "RPVA",
      "déontologie",
      "conseil",
    ],
    objection: "Je n'ai pas le temps pour du coaching, mes dossiers passent avant.",
    objectionReply:
      "Une journée 1-to-1 calée sur vos disponibilités, prolongeable en coaching régulier. Elle vise les tâches les plus chronophages — recherche et trames — pour vous rendre du temps dès le départ.",
    kpiLabel: "heures de recherche et de rédaction récupérées par semaine",
    typicalBudgetSignal: "Moins cher qu'un abonnement annuel à une base documentaire juridique",
  },
  {
    secteur: "juridique",
    verticale: "sites_web_augmentes",
    painStatement:
      "Votre site de cabinet reçoit des demandes de contact mal qualifiées — des particuliers hors de votre domaine — qui font perdre du temps à vos collaborateurs.",
    benefitMeasured:
      "Un assistant en ligne qualifie chaque demande avant le premier rendez-vous — vous ne traitez plus que des prospects dans vos domaines d'intervention.",
    beforeScenario:
      "Votre cabinet reçoit 30 demandes par mois via le formulaire du site. La moitié concerne des matières que vous ne traitez pas. Un collaborateur passe ses matinées à rédiger des réponses de réorientation.",
    afterScenario:
      "L'assistant pose quelques questions (nature du litige, domaine, urgence), oriente les demandes hors périmètre vers la bonne ressource et ne fait remonter que les dossiers relevant de votre expertise — sans jamais donner de conseil juridique.",
    sectorLexicon: [
      "contentieux",
      "domaine d'intervention",
      "première consultation",
      "prise de contact",
      "honoraires",
      "déontologie",
      "secret professionnel",
      "barreau",
    ],
    objection:
      "Un assistant en ligne risque de donner un conseil juridique et d'engager ma responsabilité.",
    objectionReply:
      "L'assistant qualifie et oriente, il ne conseille jamais. Le périmètre est verrouillé en amont : aucune réponse de fond sur un dossier, seulement la mise en relation.",
    kpiLabel: "% de demandes qualifiées dans vos domaines d'intervention",
    typicalBudgetSignal: "1 dossier qualifié supplémentaire/mois rembourse l'investissement",
  },
  {
    secteur: "commerce_retail",
    verticale: "interventions_formations",
    painStatement:
      "Vos vendeurs perdent du temps en réserve et en réassort au lieu d'être en surface de vente avec les clients, et personne ne sait comment l'IA pourrait les soulager.",
    benefitMeasured:
      "En une journée de formation, vos équipes maîtrisent 4 usages IA concrets sur le réassort, les fiches produit et les réponses clients — opérationnels dès le lendemain en magasin.",
    beforeScenario:
      "Votre responsable de magasin passe sa fin de journée à rédiger les étiquettes promo et à corriger les fiches produit du site. Ses vendeurs, eux, attendent les consignes de réassort au lieu de conseiller en rayon.",
    afterScenario:
      "Chaque vendeur sait demander à l'IA une fiche produit cohérente, un argumentaire de vente ou une suggestion de réassort sur ses SKU. Le responsable valide au lieu de tout rédiger, et l'équipe reste en surface de vente.",
    sectorLexicon: [
      "réassort",
      "surface de vente",
      "fiche produit",
      "SKU",
      "étiquetage",
      "vendeur",
      "tête de gondole",
      "ticket moyen",
    ],
    objection:
      "Mes vendeurs ne sont pas devant un écran toute la journée, une formation IA ne sert à rien pour eux.",
    objectionReply:
      "Justement : on travaille sur smartphone, en 5 minutes entre deux clients. La formation est calée sur les vrais gestes du magasin, pas sur de la théorie devant un PC.",
    kpiLabel: "usages IA maîtrisés par vendeur et utilisés en magasin",
    typicalBudgetSignal: "Une journée rentabilisée par le temps rendu à la surface de vente",
  },
  {
    secteur: "commerce_retail",
    verticale: "implementations",
    painStatement:
      "Vous pilotez votre réassort à l'instinct : vous êtes en rupture sur vos best-sellers le week-end et vous croulez sous le stock dormant sur les références qui ne tournent pas.",
    benefitMeasured:
      "Une suggestion de réassort automatique par SKU qui réduit les ruptures sur vos top références de 30 à 50 % et libère 15 à 25 % de stock dormant en quelques mois — branchée sur votre logiciel de caisse existant.",
    beforeScenario:
      "Votre responsable achats remplit ses commandes fournisseurs le lundi matin en recopiant le réassort de la semaine précédente. Résultat : rupture sur la référence vedette dès le samedi, et 12 SKU saisonniers invendus en réserve.",
    afterScenario:
      "L'outil lit vos ventes, votre saisonnalité et vos délais fournisseurs, puis propose chaque jour les quantités à recommander par SKU. Votre responsable achats valide ou ajuste en quelques clics au lieu de tout deviner.",
    sectorLexicon: [
      "réassort",
      "rupture de stock",
      "stock dormant",
      "rotation",
      "SKU",
      "saisonnalité",
      "centrale d'achat",
      "marge",
    ],
    objection: "On a déjà un logiciel de caisse et un ERP, on ne va pas tout changer.",
    objectionReply:
      "On ne remplace rien : l'outil se branche sur votre caisse et lit vos historiques de vente. C'est une couche de suggestion par-dessus votre système, pas un nouveau logiciel à apprendre.",
    kpiLabel: "% de ruptures évitées sur les top SKU + taux de rotation du stock",
    typicalBudgetSignal: "1 % de CA récupéré sur les ruptures couvre l'investissement",
  },
  {
    secteur: "commerce_retail",
    verticale: "un_a_un",
    painStatement:
      "Vous dirigez votre enseigne et vous sentez que l'IA peut vous aider sur le pilotage et le marketing, mais vous n'avez ni le temps ni le recul pour trancher entre tous les outils qu'on vous propose.",
    benefitMeasured:
      "En une journée 1-to-1, repartir avec votre feuille de route IA personnelle et 2 outils testés sur vos vrais chiffres — réassort, ticket moyen ou contenus click & collect.",
    beforeScenario:
      "Vous recevez chaque semaine un commercial qui vous vend « l'IA qui va tout changer pour le retail ». Vous avez signé pour deux outils l'an dernier, aucun n'a vraiment pris dans vos magasins.",
    afterScenario:
      "Vous avez un plan clair, calé sur votre nombre de points de vente et votre saisonnalité, et vous savez exactement quels 2 chantiers IA lancer en premier pour faire bouger votre marge — sans dépendre d'un éditeur.",
    sectorLexicon: [
      "ticket moyen",
      "click & collect",
      "point de vente",
      "marge",
      "saisonnalité",
      "fidélité",
      "réassort",
      "tête de réseau",
    ],
    objection: "Je n'ai pas le temps pour du coaching, je suis sur le terrain toute la semaine.",
    objectionReply:
      "Une journée 1-to-1, en visio entre deux ouvertures de magasin si besoin, prolongeable en coaching régulier. La journée cible les gains les plus rapides — vous récupérez du temps dès le départ.",
    kpiLabel: "chantiers IA prioritaires identifiés et lancés",
    typicalBudgetSignal: "Moins cher qu'un mois d'abonnement à un outil retail mal choisi",
  },
  {
    secteur: "industrie_logistique",
    verticale: "interventions_formations",
    painStatement:
      "Vos équipes ordonnancement et préparation de commande savent que l'IA pourrait les aider, mais elles n'osent pas s'en servir sur la GPAO ou le WMS de peur de tout dérégler.",
    benefitMeasured:
      "En une journée, vos équipes maîtrisent 4 usages IA fiables autour de l'OF, du taux de service et des comptes-rendus de production — avec les limites à ne jamais franchir.",
    beforeScenario:
      "Votre responsable d'atelier teste ChatGPT en cachette pour rédiger ses comptes-rendus d'OF, sans méthode. Vos préparateurs de commande, eux, refusent d'y toucher. Résultat : zéro gain et un vrai risque sur les données de production.",
    afterScenario:
      "Chaque rôle connaît ses 3 usages validés : reformuler un mode opératoire, expliquer un écart de taux de service, préparer un compte-rendu d'OF. Les équipes savent ce qu'on ne met jamais dans une IA et comment vérifier chaque sortie.",
    sectorLexicon: [
      "OF (ordre de fabrication)",
      "GPAO",
      "préparation de commande",
      "taux de service",
      "WMS",
      "cariste",
      "supply chain",
      "mode opératoire",
    ],
    objection:
      "Une journée de formation, ça ne suffit pas pour que mes opérateurs changent leurs habitudes en atelier.",
    objectionReply:
      "La journée est suivie de 30 jours d'accompagnement à distance et travaille sur vos vrais OF, pas sur des exemples génériques. On ne vous lâche pas après le présentiel.",
    kpiLabel: "usages IA maîtrisés par rôle (ordonnancement, prépa, atelier)",
    typicalBudgetSignal: "Moins qu'une heure de ligne arrêtée, pour toute l'équipe formée",
  },
  {
    secteur: "industrie_logistique",
    verticale: "un_a_un",
    painStatement:
      "Vous dirigez un site industriel ou logistique et vous voulez intégrer l'IA dans votre pilotage supply chain, mais vous ne savez pas par où commencer sans embarquer un projet ERP à 18 mois.",
    benefitMeasured:
      "En une journée 1-to-1, définir votre feuille de route IA et tester 2 usages concrets sur vos vraies données — taux de service, prévision de charge ou suivi des OF.",
    beforeScenario:
      "Vous lisez depuis des mois des articles sur « l'usine 4.0 » et « la supply chain prédictive ». Votre DSI vous parle d'un grand projet, vos chefs d'équipe n'y croient pas, et rien ne démarre.",
    afterScenario:
      "Vous avez un plan concret adapté à la taille de votre site et à votre maturité GPAO/WMS, avec 2 chantiers IA à lancer d'abord — pas une cathédrale ERP vendue par un intégrateur.",
    sectorLexicon: [
      "supply chain",
      "taux de service",
      "GPAO",
      "WMS",
      "OF (ordre de fabrication)",
      "prévision de charge",
      "préparation de commande",
      "stock",
    ],
    objection:
      "Dans l'industrie, l'IA c'est de gros projets à plusieurs centaines de milliers d'euros, pas du coaching.",
    objectionReply:
      "C'est exactement la croyance qui bloque tout. En 4 heures, on identifie les 2 chantiers IA légers qui font gagner sur votre taux de service sans toucher à votre GPAO — avant de parler d'un grand projet.",
    kpiLabel: "chantiers IA prioritaires identifiés sur la supply chain",
    typicalBudgetSignal: "Une fraction d'une seule journée de conseil ERP classique",
  },
  {
    secteur: "industrie_logistique",
    verticale: "sites_web_augmentes",
    painStatement:
      "Votre site reçoit des demandes de devis logistiques ou industriels mal renseignées, et votre équipe commerciale perd des heures à rappeler chaque prospect pour obtenir tonnage, palettes et délais.",
    benefitMeasured:
      "Un configurateur en ligne qui qualifie chaque demande (type de flux, volume de palettes, taux de service attendu) et fait remonter 40 à 60 % de leads exploitables sans rappel préalable.",
    beforeScenario:
      "Votre commercial reçoit une demande « j'ai besoin de stockage et de prépa de commande ». Aucune info sur le nombre de palettes, les incoterms ou le taux de service. Il passe 30 minutes au téléphone juste pour pouvoir chiffrer.",
    afterScenario:
      "Le configurateur pose les bonnes questions métier (nature des flux, palettes/mois, taux de service, fenêtres de livraison) et structure la demande. Votre commercial reçoit un dossier exploitable et chiffre directement.",
    sectorLexicon: [
      "palette",
      "taux de service",
      "préparation de commande",
      "flux logistique",
      "tonnage",
      "WMS",
      "incoterms",
      "cariste",
    ],
    objection:
      "Mes clients industriels appellent ou passent par un appel d'offres, ils ne rempliront pas un formulaire en ligne.",
    objectionReply:
      "Le configurateur complète le téléphone et l'appel d'offres : ceux qui veulent appeler appellent. Les autres qualifient leur flux avant le premier contact, et votre commercial ne chiffre plus à l'aveugle.",
    kpiLabel: "taux de demandes qualifiées exploitables sans rappel",
    typicalBudgetSignal: "1 contrat logistique annuel signé rembourse l'investissement",
  },
  {
    secteur: "artisanat_services",
    verticale: "implementations",
    painStatement:
      "Vous courez après vos clients pour vous faire payer, vos relances partent au hasard et votre trésorerie en souffre chaque fin de mois.",
    benefitMeasured:
      "Réduire votre délai d'encaissement de 15 à 25 jours en automatisant les relances de factures impayées — sans y penser une seule fois.",
    beforeScenario:
      "Vous êtes plombier-chauffagiste et vous avez 6 factures en retard. Vous savez qu'il faut relancer, mais le soir vous êtes trop fatigué, et le week-end vous voulez voir vos enfants. Les impayés s'accumulent.",
    afterScenario:
      "L'outil suit chaque facture envoyée, déclenche une relance courtoise à J+8, une ferme à J+21, et vous prévient seulement quand un client ne répond plus. Vos encaissements rentrent sans que vous leviez le petit doigt.",
    sectorLexicon: [
      "facturation",
      "relance",
      "acompte",
      "impayé",
      "trésorerie",
      "échéance",
      "devis signé",
      "intervention",
    ],
    objection:
      "Mes clients sont des habitués, je ne veux pas les braquer avec des relances automatiques.",
    objectionReply:
      "Le ton des relances est calé sur le vôtre, poli et personnalisé — et vous gardez la main : un client fidèle, vous l'appelez, le système gère les autres.",
    kpiLabel: "délai moyen d'encaissement (DSO) en jours",
    typicalBudgetSignal: "Quelques jours de trésorerie regagnés couvrent largement le coût",
  },
  {
    secteur: "artisanat_services",
    verticale: "un_a_un",
    painStatement:
      "Vous dirigez votre TPE de services, vous croulez sous les tâches du quotidien et vous ne savez pas par où l'IA pourrait réellement vous soulager.",
    benefitMeasured:
      "En 1h de coaching, repartir avec les 2 tâches à déléguer à l'IA en premier — celles qui vous rendent 3 à 5 heures par semaine.",
    beforeScenario:
      "Vous gérez une entreprise de nettoyage avec 8 salariés. Vous faites les plannings, les devis, les relances et la paperasse le soir. Vous entendez parler d'IA partout mais aucun conseil n'est taillé pour une boîte comme la vôtre.",
    afterScenario:
      "En une heure ciblée sur votre quotidien réel, vous repartez avec un plan concret : quel outil pour vos devis, lequel pour vos plannings de tournée, et l'ordre dans lequel vous y attaquer sans vous disperser.",
    sectorLexicon: [
      "planning",
      "tournée",
      "devis",
      "fidélisation client",
      "bouche-à-oreille",
      "TPE",
      "dirigeant",
      "marge",
    ],
    objection: "Une heure, c'est trop court pour que ça change quoi que ce soit à mon entreprise.",
    objectionReply:
      "Une heure suffit pour repérer le gros gisement de temps perdu et le premier outil à mettre en place. Vous testez derrière, et on ajuste si besoin — pas de blabla, du concret.",
    kpiLabel: "heures/semaine récupérées sur l'administratif",
    typicalBudgetSignal: "Moins qu'une demi-journée de votre temps facturé client",
  },
  {
    secteur: "artisanat_services",
    verticale: "sites_web_augmentes",
    painStatement:
      "Votre site vitrine ne vous rapporte aucun client — les visiteurs regardent vos photos puis appellent pendant que vous êtes sur le toit, et vous ne rappelez jamais à temps.",
    benefitMeasured:
      "Capter 30 à 50 % de demandes en plus en transformant votre site en preneur de rendez-vous : un assistant qualifie le besoin et propose un créneau pendant que vous travaillez.",
    beforeScenario:
      "Vous êtes couvreur, votre site affiche vos réalisations mais c'est tout. Un prospect visite à 14h, vous êtes en intervention, il n'a pas le réflexe de laisser un message, il appelle le concurrent dont le site répond.",
    afterScenario:
      "L'assistant du site accueille le visiteur, lui pose 3 questions sur son projet de toiture, récupère ses coordonnées et lui propose un créneau de visite. Le soir, vous traitez des demandes déjà qualifiées, classées par urgence.",
    sectorLexicon: [
      "site vitrine",
      "réalisations",
      "demande de devis",
      "prise de contact",
      "intervention",
      "bouche-à-oreille",
      "secteur géographique",
      "disponibilité",
    ],
    objection:
      "Mes clients me trouvent par le bouche-à-oreille, un site amélioré ne me servira à rien.",
    objectionReply:
      "Le bouche-à-oreille amène le visiteur sur votre site, mais s'il ne peut pas vous joindre sur le moment, il file ailleurs. L'assistant rattrape exactement ces demandes-là, celles que vous perdez sans le savoir.",
    kpiLabel: "demandes de devis captées par mois via le site",
    typicalBudgetSignal: "1 à 2 chantiers gagnés par an rentabilisent le site",
  },
  {
    secteur: "rh_recrutement",
    verticale: "interventions_formations",
    painStatement:
      "Vos chargés de recrutement bricolent avec ChatGPT pour trier les CV et rédiger les annonces, sans méthode ni garde-fou, au risque de biais et d'erreurs.",
    benefitMeasured:
      "En une journée, outiller toute votre équipe RH sur 5 usages fiables — du sourcing à la trame d'entretien — avec les limites légales à ne jamais franchir.",
    beforeScenario:
      "Une chargée de recrutement colle 200 CV dans ChatGPT pour faire un tri, sans savoir si elle introduit un biais discriminatoire ni où partent les données candidats. Sa collègue, elle, refuse d'y toucher : aucune cohérence dans l'équipe.",
    afterScenario:
      "Chaque membre de l'équipe maîtrise les usages validés pour son rôle : reformuler une fiche de poste, générer des questions d'entretien, synthétiser un vivier — et connaît les règles RGPD et non-discrimination à respecter.",
    sectorLexicon: [
      "sourcing",
      "fiche de poste",
      "CV",
      "entretien",
      "vivier",
      "ATS",
      "marque employeur",
      "présélection",
    ],
    objection: "Former mes recruteurs à l'IA, c'est leur apprendre à se faire remplacer.",
    objectionReply:
      "L'IA absorbe le tri et la rédaction répétitive, pas l'évaluation humaine d'un candidat. La formation rend vos recruteurs plus présents là où ils font la différence : l'entretien et la décision.",
    kpiLabel: "usages IA maîtrisés par recruteur",
    typicalBudgetSignal: "Une journée face au coût d'un seul tri de CV biaisé",
  },
  {
    secteur: "rh_recrutement",
    verticale: "un_a_un",
    painStatement:
      "Vous êtes DRH ou dirigeant d'un cabinet de recrutement et vous voulez intégrer l'IA dans vos process sans savoir par où démarrer ni quel garde-fou poser.",
    benefitMeasured:
      "En 1h de coaching, clarifier les 2 chantiers IA prioritaires pour votre service RH et les pièges juridiques à anticiper avant de déployer.",
    beforeScenario:
      "Vous pilotez un cabinet de recrutement de 12 consultants. Chacun teste son propre outil IA dans son coin, vous n'avez aucune vision d'ensemble ni de politique, et vous craignez un faux pas sur la protection des données candidats.",
    afterScenario:
      "Vous repartez avec une feuille de route claire : par quel process commencer, comment cadrer l'usage pour vos consultants, et quelles limites poser côté RGPD et non-discrimination avant de généraliser.",
    sectorLexicon: [
      "vivier",
      "ATS",
      "sourcing",
      "consultant",
      "marque employeur",
      "onboarding",
      "fiche de poste",
      "confidentialité candidat",
    ],
    objection:
      "Je n'ai pas besoin de coaching, je peux lire des articles sur l'IA et le recrutement.",
    objectionReply:
      "Les articles décrivent le possible en général ; une heure ciblée sur votre cabinet vous dit quoi faire en premier dans votre contexte précis, et vous évite les erreurs coûteuses que les autres apprennent à leurs dépens.",
    kpiLabel: "chantiers IA priorisés et cadrés pour le service RH",
    typicalBudgetSignal: "Moins cher qu'un abonnement annuel à un outil de sourcing",
  },
  {
    secteur: "rh_recrutement",
    verticale: "sites_web_augmentes",
    painStatement:
      "Votre page carrières attire des visiteurs mais peu de candidatures qualifiées — les candidats lisent l'offre, hésitent, et partent sans postuler.",
    benefitMeasured:
      "Augmenter de 20 à 40 % le taux de candidatures abouties avec un assistant carrière qui répond aux questions du candidat et le guide jusqu'au dépôt de son CV.",
    beforeScenario:
      "Un développeur visite votre page carrières, se demande si le télétravail est possible et à quoi ressemble l'onboarding. Personne pour répondre un dimanche soir, il ferme l'onglet et postule chez un concurrent plus clair.",
    afterScenario:
      "L'assistant carrière répond 24h/24 aux questions sur le poste, la culture et le process, oriente le candidat vers la bonne fiche de poste et l'accompagne jusqu'au dépôt de candidature. Vos recruteurs reçoivent des CV de profils déjà renseignés.",
    sectorLexicon: [
      "page carrières",
      "marque employeur",
      "fiche de poste",
      "candidature",
      "vivier",
      "ATS",
      "onboarding",
      "expérience candidat",
    ],
    objection:
      "Un assistant sur ma page carrières risque de donner une image froide et impersonnelle de mon entreprise.",
    objectionReply:
      "C'est l'inverse : il est calé sur votre ton et votre culture, et il répond quand vos recruteurs dorment. Pour le candidat, c'est une entreprise réactive et attentive — exactement votre marque employeur.",
    kpiLabel: "taux de candidatures abouties sur visiteurs de la page carrières",
    typicalBudgetSignal: "1 recrutement accéléré rembourse l'investissement",
  },
  {
    secteur: "collectivites_public",
    verticale: "implementations",
    painStatement:
      "Vos agents instruisent à la main des centaines de demandes d'état civil et d'urbanisme, recopient les mêmes informations d'un formulaire à l'autre, et les délais d'instruction s'allongent.",
    benefitMeasured:
      "Pré-instruire automatiquement 60 à 75 % des demandes courantes — un acte d'urbanisme ou un dossier d'état civil pré-rempli et contrôlé en 2 minutes au lieu de 20.",
    beforeScenario:
      "Un agent territorial du service urbanisme reçoit une déclaration préalable. Il ressaisit les références cadastrales, vérifie les pièces manquantes, recopie l'adresse de l'administré dans trois logiciels métier différents. Chaque dossier mobilise 25 minutes avant même le début de l'instruction.",
    afterScenario:
      "L'outil extrait les données du dossier déposé sur le guichet unique, contrôle automatiquement les pièces obligatoires, signale les manques à l'administré et pré-renseigne les champs métier. L'agent valide l'instruction au lieu de ressaisir.",
    sectorLexicon: [
      "administré",
      "guichet unique",
      "instruction",
      "déclaration préalable",
      "état civil",
      "références cadastrales",
      "agent territorial",
      "pièces obligatoires",
    ],
    objection:
      "Nos données d'administrés sont sensibles, on ne peut pas les confier à une IA hébergée n'importe où.",
    objectionReply:
      "L'implémentation tourne sur une infrastructure souveraine hébergée en France, dans le respect du RGPD et des avis CNIL — les données d'administrés ne quittent jamais le périmètre de la collectivité.",
    kpiLabel: "délai moyen d'instruction d'une demande réduit en %",
    typicalBudgetSignal: "20 minutes d'instruction ramenées à 2 sur chaque dossier courant",
  },
  {
    secteur: "collectivites_public",
    verticale: "un_a_un",
    painStatement:
      "Vous êtes DGS ou élu et vous devez arbitrer une stratégie IA pour votre collectivité, mais vous craignez de vous engager sur un outil mal cadré qui exposerait la responsabilité de la collectivité.",
    benefitMeasured:
      "En une journée 1-to-1, construire votre feuille de route IA souveraine et conforme — prête à présenter en délibération — et identifier les 2 premiers cas d'usage à faible risque.",
    beforeScenario:
      "Vous lisez des notes de l'AMF et des retours d'autres collectivités depuis des mois. Vos services testent des outils dans leur coin, sans cadre. Vous n'avez ni vision claire, ni argumentaire à porter devant le conseil municipal.",
    afterScenario:
      "Vous disposez d'une feuille de route adaptée à la taille de votre collectivité et à vos compétences réelles, articulée avec le RGAA et le RGPD, que vous pouvez défendre en délibération sans dépendre du discours commercial d'un éditeur.",
    sectorLexicon: [
      "DGS directeur général des services",
      "élu",
      "délibération",
      "conseil municipal",
      "service public",
      "souveraineté des données",
      "compétences",
      "accessibilité RGAA",
    ],
    objection: "Je n'ai pas le temps pour du coaching, mon agenda d'élu est déjà saturé.",
    objectionReply:
      "Une journée 1-to-1, en présentiel ou à distance, prolongeable en coaching régulier. La journée sécurise déjà votre position : vous repartez avec un cadre défendable en conseil.",
    kpiLabel: "cas d'usage IA validés et présentables en délibération",
    typicalBudgetSignal: "Le coût d'un outil mal cadré évité dès la première délibération",
  },
  {
    secteur: "collectivites_public",
    verticale: "sites_web_augmentes",
    painStatement:
      "Votre site de collectivité reçoit en continu des questions d'administrés sur les démarches, les horaires et les pièces à fournir — et votre accueil les répète au téléphone toute la journée.",
    benefitMeasured:
      "Dévier 40 à 60 % des demandes courantes vers un assistant en ligne accessible 24h/24 — votre accueil se recentre sur les administrés qui ont vraiment besoin d'un agent.",
    beforeScenario:
      "Un administré veut renouveler sa carte d'identité. Il ne trouve pas la liste des pièces sur le site, appelle l'accueil, attend, puis se déplace au guichet avec un dossier incomplet. Il repart, revient, et l'agent recommence l'explication pour la dixième fois de la journée.",
    afterScenario:
      "L'assistant en ligne, conforme au RGAA, répond 24h/24 sur les démarches, liste les pièces à fournir selon la situation, oriente vers le bon service et remonte les cas complexes à un agent. L'administré arrive au guichet avec un dossier complet.",
    sectorLexicon: [
      "administré",
      "démarches en ligne",
      "guichet unique",
      "accessibilité RGAA",
      "service public",
      "état civil",
      "accueil",
      "pièces à fournir",
    ],
    objection:
      "Une partie de nos administrés n'est pas à l'aise avec le numérique, on ne peut pas tout digitaliser.",
    objectionReply:
      "L'assistant complète l'accueil, il ne le remplace pas : ceux qui préfèrent le guichet ou le téléphone y vont toujours, et comme il décharge les demandes simples, vos agents sont justement plus disponibles pour les administrés éloignés du numérique.",
    kpiLabel: "% de demandes courantes traitées en self-service",
    typicalBudgetSignal:
      "Inscriptible au marché public via le budget DSI ou les dispositifs de transformation numérique des collectivités en vigueur — à vérifier au cas par cas avec la collectivité",
  },
];

/**
 * Récupère le contexte douleur pour une combinaison secteur × verticale
 */
export function getSectorPainContext(
  secteur: Secteur,
  verticale: Verticale,
): SectorPainContext | undefined {
  return SECTOR_PAIN_MATRIX.find(
    (entry) => entry.secteur === secteur && entry.verticale === verticale,
  );
}

/**
 * Sérialise le contexte douleur pour injection dans le prompt LLM
 * Appelé dans chaque générateur AVANT la construction du prompt
 */
export function serializePainContextForPrompt(ctx: SectorPainContext): string {
  return `
=== CONTEXTE MÉTIER OBLIGATOIRE — À UTILISER, PAS À PARAPHRASER ===

SECTEUR CLIENT : ${ctx.secteur.replace(/_/g, " ")}
OFFRE AXION-IA : ${ctx.verticale.replace(/_/g, " ")}

DOULEUR RÉELLE DU CLIENT :
"${ctx.painStatement}"

BÉNÉFICE CHIFFRÉ À METTRE EN AVANT :
"${ctx.benefitMeasured}"

SCÉNARIO AVANT (vie d'avant — à rendre concret dans le contenu) :
"${ctx.beforeScenario}"

SCÉNARIO APRÈS (vie d'après — à rendre concret dans le contenu) :
"${ctx.afterScenario}"

VOCABULAIRE MÉTIER À UTILISER (jamais le jargon tech) :
${ctx.sectorLexicon.join(", ")}

OBJECTION PRINCIPALE ET RÉPONSE :
Objection : "${ctx.objection}"
Réponse : "${ctx.objectionReply}"

KPI QUI PARLE À CE CLIENT : ${ctx.kpiLabel}

=== RÈGLES RÉDACTIONNELLES ABSOLUES ===
1. Chaque paragraphe doit utiliser au moins 1 mot du vocabulaire métier ci-dessus
2. Mentionner le bénéfice chiffré dans les 150 premiers mots
3. Inclure le scénario avant/après sous forme narrative (pas de liste)
4. Traiter l'objection principale dans le corps du texte
5. JAMAIS : "innovant", "révolutionnaire", "puissant", "solution IA", "intelligence artificielle de pointe"
6. TOUJOURS : nommer la tâche concrète, puis le gain, puis la preuve ou le chiffre
`.trim();
}
