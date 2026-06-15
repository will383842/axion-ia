/**
 * AXION-IA — Sector Pain Matrix
 * 10 secteurs × 5 verticales = ~50 combinaisons
 * Chaque combinaison porte : douleur, bénéfice chiffré, avant/après, objection, lexique métier
 * 
 * Usage : injecté dans GeneratorBaseInput.sectorPainContext AVANT le prompt LLM
 * Seedé dans KnowledgeBase via kb/sector-pain-matrix.ts
 */

export type Verticale =
  | "audits"
  | "interventions_formations"
  | "implementations"
  | "un_a_un"
  | "sites_web_augmentes";

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
  painStatement: string;         // La douleur nommée dans le langage du client
  benefitMeasured: string;       // Le gain CHIFFRÉ (temps, argent, erreurs)
  beforeScenario: string;        // Vie d'avant (1-2 phrases concrètes)
  afterScenario: string;         // Vie d'après (1-2 phrases concrètes)
  sectorLexicon: string[];       // Mots du MÉTIER, pas de la tech
  objection: string;             // "Oui mais..."
  objectionReply: string;        // La réponse courte et cash
  kpiLabel: string;              // Le KPI qui parle à CE secteur
  typicalBudgetSignal: string;   // Signal budget pour calibrer le ROI
}

export const SECTOR_PAIN_MATRIX: SectorPainContext[] = [

  // ─────────────────────────────────────────────
  // COMPTABILITÉ / FINANCE
  // ─────────────────────────────────────────────
  {
    secteur: "comptabilite_finance",
    verticale: "audits",
    painStatement: "Vous passez des heures à chercher pourquoi vos chiffres ne tombent pas juste, sans savoir par où commencer avec l'IA.",
    benefitMeasured: "Identifier en 1 journée les 3 tâches qui font perdre le plus de temps à votre cabinet — et chiffrer le gain récupérable.",
    beforeScenario: "Votre équipe ressaisit des données entre Excel, votre logiciel comptable et les mails clients. Chaque mois, 2 à 3 jours partent en corrections d'erreurs de saisie.",
    afterScenario: "L'audit cartographie exactement où l'IA peut prendre le relais : extraction automatique des pièces, rapprochement bancaire, relances clients. Votre équipe valide au lieu de saisir.",
    sectorLexicon: ["rapprochement bancaire", "lettrage", "liasse fiscale", "FEC", "pièces justificatives", "relances clients", "clôture mensuelle", "TVA déductible"],
    objection: "Nos clients nous envoient leurs docs dans tous les formats, l'IA ne peut pas gérer ça.",
    objectionReply: "C'est exactement ce que l'audit évalue : quels formats entrent, lesquels sont automatisables maintenant, lesquels dans 6 mois.",
    kpiLabel: "heures/mois récupérées sur la saisie",
    typicalBudgetSignal: "Équivalent à 1 jour de collaborateur/mois",
  },
  {
    secteur: "comptabilite_finance",
    verticale: "implementations",
    painStatement: "Vos collaborateurs passent plus de temps à chercher des infos dans les dossiers clients qu'à faire de la vraie comptabilité.",
    benefitMeasured: "Réduction de 60 à 70 % du temps de recherche documentaire — retrouver une pièce en 10 secondes au lieu de 8 minutes.",
    beforeScenario: "Un client appelle pour une question sur sa liasse N-1. Votre collaborateur cherche 15 minutes dans les mails, les drives et les classeurs.",
    afterScenario: "Il tape la question en langage naturel dans votre outil interne. La réponse et la pièce source apparaissent en 10 secondes.",
    sectorLexicon: ["dossier client", "liasse", "bilan", "compte de résultat", "OEC", "expert-comptable", "collaborateur", "mission"],
    objection: "Nos données sont confidentielles, on ne peut pas les mettre dans une IA.",
    objectionReply: "L'implémentation tourne sur votre infrastructure ou en cloud privé — vos données ne quittent pas votre périmètre.",
    kpiLabel: "minutes/requête client économisées",
    typicalBudgetSignal: "ROI visible dès le 1er mois sur 3 collaborateurs",
  },
  {
    secteur: "comptabilite_finance",
    verticale: "interventions_formations",
    painStatement: "Vos collaborateurs ont peur de mal utiliser l'IA et de faire des erreurs qui engagent votre responsabilité.",
    benefitMeasured: "Une journée de formation suffit pour que vos équipes utilisent l'IA de façon fiable sur 5 tâches comptables concrètes.",
    beforeScenario: "Certains collaborateurs testent ChatGPT en cachette, sans méthode. D'autres refusent catégoriquement. Résultat : zéro gain, risque maximal.",
    afterScenario: "Chaque collaborateur connaît les 3 usages validés pour son rôle, les limites à ne pas franchir, et comment vérifier les sorties de l'IA.",
    sectorLexicon: ["responsabilité de l'expert", "vérification", "contrôle qualité", "revue", "validation", "conformité"],
    objection: "Une journée de formation, ça ne suffit pas pour changer les habitudes.",
    objectionReply: "La formation est suivie de 30 jours d'accompagnement à distance — on ne vous lâche pas après le présentiel.",
    kpiLabel: "tâches IA maîtrisées par collaborateur",
    typicalBudgetSignal: "Finançable OPCO sur code CPF formation numérique",
  },
  {
    secteur: "comptabilite_finance",
    verticale: "un_a_un",
    painStatement: "Vous êtes expert-comptable et vous voulez intégrer l'IA dans votre pratique, mais vous ne savez pas par où commencer sans prendre de risque.",
    benefitMeasured: "En 4 sessions d'1h, définir votre feuille de route IA personnelle et tester les 2 premiers outils sur vos vrais dossiers.",
    beforeScenario: "Vous lisez des articles sur l'IA comptable depuis 6 mois. Vous avez testé 2-3 outils mais rien n'a vraiment collé avec votre façon de travailler.",
    afterScenario: "Vous avez un plan concret adapté à votre taille de cabinet et vos types de missions — pas un plan générique d'un éditeur qui veut vous vendre sa solution.",
    sectorLexicon: ["cabinet", "associé", "missions récurrentes", "CAC", "commissariat aux comptes", "DSCG"],
    objection: "Je n'ai pas le temps pour du coaching, j'ai déjà trop de travail.",
    objectionReply: "4 sessions d'1h sur 2 mois. La 1ère session identifie les gains les plus rapides — vous récupérez du temps avant la fin du coaching.",
    kpiLabel: "heures/semaine récupérées dès le 1er mois",
    typicalBudgetSignal: "Moins cher qu'un logiciel comptable supplémentaire",
  },

  // ─────────────────────────────────────────────
  // BTP / IMMOBILIER
  // ─────────────────────────────────────────────
  {
    secteur: "btp_immobilier",
    verticale: "audits",
    painStatement: "Vous refaites vos devis 3 fois parce que les infos chantier changent en permanence et la coordination entre équipes est chaotique.",
    benefitMeasured: "Identifier les 4 points de friction qui font exploser vos délais — et estimer le gain en jours par chantier.",
    beforeScenario: "Le chef de chantier appelle le bureau pour une info sur les plans. La secrétaire cherche la bonne version dans les mails. 40 minutes perdues, chantier à l'arrêt.",
    afterScenario: "L'audit cartographie vos flux d'information réels : qui cherche quoi, combien de fois par jour, sur quel support. La solution sort de ce diagnostic.",
    sectorLexicon: ["devis", "CCTP", "DPGF", "appel d'offres", "maître d'ouvrage", "conducteur de travaux", "situation de travaux", "réception de chantier"],
    objection: "Sur un chantier, l'IA ça ne marche pas — trop d'imprévu.",
    objectionReply: "L'IA ne gère pas l'imprévu, elle libère du temps pour que vous le gériez mieux. L'audit sépare ce que l'IA peut prendre en charge du reste.",
    kpiLabel: "jours de retard évités par chantier",
    typicalBudgetSignal: "1 jour de retard chantier = plusieurs k€ perdus",
  },
  {
    secteur: "btp_immobilier",
    verticale: "implementations",
    painStatement: "Vos devis prennent 3 à 4 heures chacun et vos commerciaux passent plus de temps sur les docs que sur le terrain.",
    benefitMeasured: "Générer un premier jet de devis en 20 minutes à partir d'une description chantier — vos commerciaux finalisent et ajustent.",
    beforeScenario: "Un commercial passe sa soirée à monter un devis de 40 lignes pour un chantier de rénovation. Il recopie les prix du dernier devis similaire, fait des erreurs, recommence.",
    afterScenario: "Il décrit le chantier à l'oral ou en quelques lignes. L'outil génère la structure du devis avec les postes standards. Il ajuste en 20 minutes et envoie.",
    sectorLexicon: ["devis", "bordereau de prix", "sous-traitant", "avenant", "situation mensuelle", "retenue de garantie", "appel d'offres public"],
    objection: "Chaque chantier est différent, l'IA ne peut pas faire nos devis.",
    objectionReply: "L'IA génère la structure et les postes récurrents. Votre expertise ajuste les spécificités — vous gagnez 2h par devis sans perdre la main.",
    kpiLabel: "heures/devis économisées",
    typicalBudgetSignal: "ROI sur 10 devis/mois dès le 1er mois",
  },
  {
    secteur: "btp_immobilier",
    verticale: "sites_web_augmentes",
    painStatement: "Votre site web génère des leads non qualifiés — des particuliers qui cherchent un artisan pour 500€ alors que vous faites du chantier à 50k€ minimum.",
    benefitMeasured: "Un configurateur en ligne qualifie les prospects avant qu'ils vous appellent — vous ne traitez plus que des leads à votre cible.",
    beforeScenario: "Vous recevez 20 demandes par mois. 15 sont hors cible. Vous perdez 3h à répondre à des demandes qui n'aboutiront jamais.",
    afterScenario: "Le configurateur pose 5 questions (type de chantier, surface, budget estimé, délai). Les leads hors cible sont filtrés. Vous recevez 5 demandes qualifiées.",
    sectorLexicon: ["maîtrise d'œuvre", "appel d'offres", "qualification", "prospects", "chantier tertiaire", "rénovation énergétique", "RGE"],
    objection: "Un configurateur en ligne va faire fuir mes clients qui préfèrent appeler.",
    objectionReply: "Le configurateur complète le téléphone — ceux qui préfèrent appeler appellent. Les autres qualifient leur projet avant, et vous gagnez du temps sur les deux.",
    kpiLabel: "taux de leads qualifiés sur total demandes",
    typicalBudgetSignal: "1 chantier supplémentaire/an rembourse l'investissement",
  },

  // ─────────────────────────────────────────────
  // RESTAURATION / HÔTELLERIE
  // ─────────────────────────────────────────────
  {
    secteur: "restauration_hotellerie",
    verticale: "audits",
    painStatement: "Vos plannings prennent 3h chaque dimanche soir et vous gérez les remplacements de dernière minute par SMS chaotiques.",
    benefitMeasured: "Réduire la planification hebdomadaire de 3h à 25 minutes — et anticiper les besoins de remplacement 48h à l'avance.",
    beforeScenario: "Dimanche 22h, vous êtes encore sur Excel à faire le planning de la semaine en jonglant avec les dispos, les contrats, les heures sup. Lundi 7h, un serveur appelle malade.",
    afterScenario: "L'audit identifie vos patterns de fréquentation, vos contraintes RH et vos points de rupture. La solution sort de là — pas d'un logiciel vendu par un commercial.",
    sectorLexicon: ["planning", "couverture", "taux d'occupation", "réservation", "service", "extras", "saisons hautes", "ticket moyen"],
    objection: "Mon secteur tourne avec des gens pas des algos.",
    objectionReply: "L'IA gère les tâches administratives pour que vous passiez plus de temps avec vos équipes et vos clients — pas l'inverse.",
    kpiLabel: "heures/semaine récupérées sur l'administratif",
    typicalBudgetSignal: "Équivalent à 2h de main d'œuvre par semaine",
  },
  {
    secteur: "restauration_hotellerie",
    verticale: "implementations",
    painStatement: "Vos avis Google s'accumulent sans que vous ayez le temps d'y répondre, ce qui plombe votre référencement local.",
    benefitMeasured: "Répondre à 100% de vos avis Google en moins de 24h, avec des réponses personnalisées — sans y passer 1 minute de votre temps.",
    beforeScenario: "Vous avez 47 avis sans réponse depuis 3 mois. Vous savez que c'est mauvais pour le SEO et l'image mais vous n'avez pas le temps entre les services.",
    afterScenario: "L'outil lit chaque avis, génère une réponse personnalisée qui mentionne un détail spécifique, et vous envoie pour validation d'1 clic. Zéro rédaction de votre part.",
    sectorLexicon: ["avis Google", "TripAdvisor", "référencement local", "e-réputation", "service en salle", "cuisine", "chef", "établissement"],
    objection: "Les réponses générées par IA ça se voit, c'est impersonnel.",
    objectionReply: "On l'entraîne sur vos vraies réponses existantes — le ton, le style, les expressions que vous utilisez. Vos clients ne feront pas la différence.",
    kpiLabel: "% d'avis avec réponse sous 24h",
    typicalBudgetSignal: "Impact direct sur le classement Google Maps local",
  },

  // ─────────────────────────────────────────────
  // SANTÉ / MÉDECINE
  // ─────────────────────────────────────────────
  {
    secteur: "sante_medecine",
    verticale: "audits",
    painStatement: "Vos praticiens passent autant de temps sur les dossiers administratifs que sur les patients — et l'attente s'allonge.",
    benefitMeasured: "Identifier les 3 tâches administratives qui volent le plus de temps de soin — et estimer les créneaux récupérables par semaine.",
    beforeScenario: "Un médecin généraliste voit 25 patients par jour. Il passe 45 minutes supplémentaires le soir à compléter des comptes-rendus et courriers.",
    afterScenario: "L'audit analyse vos flux administratifs réels (sans toucher aux données patients) et identifie où l'IA peut dicter, rédiger et formater à la place du praticien.",
    sectorLexicon: ["compte-rendu", "ordonnance", "CPAM", "cotation CCAM", "DMP", "téléconsultation", "secrétariat médical", "agenda"],
    objection: "Nous ne pouvons pas utiliser l'IA avec des données de santé — RGPD.",
    objectionReply: "L'audit porte sur les flux et processus, pas les données patients. Les solutions recommandées sont présélectionnées pour la conformité HDS.",
    kpiLabel: "minutes administratives économisées par consultation",
    typicalBudgetSignal: "1 consultation supplémentaire/jour = ROI en semaines",
  },
  {
    secteur: "sante_medecine",
    verticale: "sites_web_augmentes",
    painStatement: "Vos patients appellent pour des demandes simples (disponibilités, renouvellements, documents) qui saturent votre secrétariat.",
    benefitMeasured: "Dévier 40 à 60% des appels entrants vers un assistant en ligne — votre secrétariat se concentre sur les urgences et cas complexes.",
    beforeScenario: "Votre secrétaire reçoit 80 appels par jour. 50 sont pour savoir si vous avez des créneaux ou pour demander une ordonnance de renouvellement.",
    afterScenario: "L'assistant en ligne répond 24h/24 aux questions récurrentes, propose les créneaux disponibles et remonte les demandes urgentes à votre secrétariat.",
    sectorLexicon: ["prise en charge", "créneaux", "renouvellement", "secrétariat", "agenda", "Doctolib", "urgences", "cabinet de groupe"],
    objection: "Mes patients sont âgés, ils ne savent pas utiliser un chatbot.",
    objectionReply: "L'assistant s'adapte : les patients à l'aise en ligne l'utilisent, les autres appellent toujours. Votre secrétariat est simplement moins saturé.",
    kpiLabel: "% d'appels simples déviés vers le self-service",
    typicalBudgetSignal: "Équivalent à 0,5 ETP secrétariat",
  },

  // ─────────────────────────────────────────────
  // JURIDIQUE
  // ─────────────────────────────────────────────
  {
    secteur: "juridique",
    verticale: "audits",
    painStatement: "Vos collaborateurs passent des heures à chercher de la jurisprudence et à rédiger des actes répétitifs au lieu de conseiller les clients.",
    benefitMeasured: "Récupérer 30 à 40% du temps de recherche documentaire — votre équipe conseille plus et cherche moins.",
    beforeScenario: "Un collaborateur junior passe 2h à compiler la jurisprudence pour un dossier. Son associé refait partiellement le travail car le format n'est pas le bon.",
    afterScenario: "L'audit identifie vos types d'actes les plus répétitifs et vos sources documentaires. La feuille de route IA sort de ce diagnostic — pas d'un vendeur de solution.",
    sectorLexicon: ["jurisprudence", "acte", "contentieux", "conseil", "rédaction", "conclusions", "plaidoirie", "cabinet d'avocats", "barreau"],
    objection: "Le droit ne tolère pas les erreurs — on ne peut pas faire confiance à l'IA.",
    objectionReply: "L'IA ne remplace pas le juriste, elle prépare le travail. L'audit identifie les tâches où le risque d'erreur est faible et le gain de temps élevé.",
    kpiLabel: "heures de recherche économisées par dossier",
    typicalBudgetSignal: "Équivalent à 1 jour de collaborateur junior par dossier complexe",
  },
  {
    secteur: "juridique",
    verticale: "implementations",
    painStatement: "Vos actes types et modèles sont dispersés, mal versionnés, et vos collaborateurs perdent du temps à retrouver le bon document.",
    benefitMeasured: "Un assistant interne qui retrouve, adapte et pré-renseigne n'importe quel modèle d'acte en 30 secondes à partir d'une description.",
    beforeScenario: "Un collaborateur cherche 20 minutes le bon modèle de bail commercial dans les dossiers partagés. Il trouve une version de 2019 dont il n'est pas sûr qu'elle soit à jour.",
    afterScenario: "Il décrit le contexte en 2 lignes. L'assistant retrouve le modèle valide, le pré-renseigne avec les données du client et l'affiche pour révision finale.",
    sectorLexicon: ["modèle d'acte", "statuts", "bail", "convention", "cession", "mandat", "procuration", "notification"],
    objection: "Nos modèles sont confidentiels et complexes, on ne peut pas les mettre dans un système externe.",
    objectionReply: "Le système tourne sur votre infrastructure — vos modèles restent dans votre environnement sécurisé.",
    kpiLabel: "minutes/acte économisées sur la recherche documentaire",
    typicalBudgetSignal: "ROI visible dès le 2ème mois avec 3 collaborateurs",
  },

  // ─────────────────────────────────────────────
  // COMMERCE / RETAIL
  // ─────────────────────────────────────────────
  {
    secteur: "commerce_retail",
    verticale: "audits",
    painStatement: "Vous ne savez pas quels produits vont manquer avant qu'ils manquent, et vous avez toujours trop de stock sur ce qui ne se vend pas.",
    benefitMeasured: "Réduire les ruptures de stock de 40% et le stock dormant de 25% en 3 mois — sans changer votre logiciel de caisse.",
    beforeScenario: "Votre meilleur produit est en rupture depuis mardi. Vous l'avez vu venir trop tard. Pendant ce temps, 8 références prennent la poussière en réserve.",
    afterScenario: "L'audit analyse vos historiques de vente, vos saisonnalités et vos patterns de rupture. La recommandation sort du diagnostic — pas d'un vendeur de logiciel.",
    sectorLexicon: ["rupture de stock", "rotation", "réassort", "référence", "marge", "panier moyen", "saisonnalité", "centrale d'achat"],
    objection: "Mon secteur est trop imprévisible pour qu'une IA prédise quoi que ce soit.",
    objectionReply: "L'IA ne prédit pas parfaitement — elle prédit mieux que l'intuition seule, avec vos propres données de vente comme base.",
    kpiLabel: "% de ruptures évitées sur les top références",
    typicalBudgetSignal: "1% de CA récupéré sur les ruptures = ROI immédiat",
  },
  {
    secteur: "commerce_retail",
    verticale: "sites_web_augmentes",
    painStatement: "Votre site e-commerce génère des visites mais peu d'achats — vos clients partent sans trouver ce qu'ils cherchent.",
    benefitMeasured: "Augmenter le taux de conversion de 15 à 30% avec un assistant produit qui guide l'acheteur vers la bonne référence.",
    beforeScenario: "Un client cherche une perceuse pour du béton. Il voit 47 références, ne sait pas laquelle choisir, abandonne son panier et commande ailleurs.",
    afterScenario: "L'assistant lui pose 3 questions (usage, fréquence, budget). Il lui recommande les 2 meilleures options avec explication. Il achète en 4 minutes.",
    sectorLexicon: ["taux de conversion", "panier", "fiche produit", "cross-sell", "upsell", "abandon de panier", "catalogue", "référencement produit"],
    objection: "Un chatbot sur mon site va faire cheap.",
    objectionReply: "C'est une question de design et de ton — on cale l'assistant sur l'identité de votre marque. Zara et Sephora en ont. Ça ne fait pas cheap.",
    kpiLabel: "taux de conversion avant/après",
    typicalBudgetSignal: "ROI calculé sur le CA récupéré sur les abandons de panier",
  },

  // ─────────────────────────────────────────────
  // INDUSTRIE / LOGISTIQUE
  // ─────────────────────────────────────────────
  {
    secteur: "industrie_logistique",
    verticale: "audits",
    painStatement: "Vos équipes maintenance passent autant de temps à chercher les historiques de pannes qu'à les réparer.",
    benefitMeasured: "Réduire le temps de diagnostic de panne de 50% — vos techniciens trouvent l'historique et le bon protocole en 2 minutes au lieu de 20.",
    beforeScenario: "Une machine tombe en panne. Le technicien cherche dans les classeurs papier et les tableurs Excel qui n'ont pas été mis à jour depuis 3 mois.",
    afterScenario: "Il décrit le symptôme sur sa tablette. L'assistant retrouve les 3 pannes similaires passées, les solutions appliquées et le temps de résolution.",
    sectorLexicon: ["maintenance préventive", "GMAO", "temps d'arrêt", "TRS", "panne", "ordre de travail", "technicien", "pièces détachées"],
    objection: "Nos techniciens ne vont pas utiliser un outil informatique sur le terrain.",
    objectionReply: "L'interface est pensée pour une utilisation en atelier — voix ou 3 clics maximum. L'audit intègre le test terrain dans sa démarche.",
    kpiLabel: "MTTR (Mean Time To Repair) réduit en %",
    typicalBudgetSignal: "1h d'arrêt machine évitée = valeur immédiate calculable",
  },
  {
    secteur: "industrie_logistique",
    verticale: "implementations",
    painStatement: "Vos bons de commande et documents fournisseurs arrivent dans tous les formats et votre équipe ADV les ressaisit à la main.",
    benefitMeasured: "Automatiser 80% de la saisie des bons de commande entrants — votre ADV traite les exceptions au lieu de tout saisir.",
    beforeScenario: "Votre équipe reçoit 50 bons de commande par jour en PDF, Word et mail. Chaque saisie manuelle prend 8 minutes. 400 minutes perdues chaque jour.",
    afterScenario: "L'outil extrait automatiquement les données clés (références, quantités, adresses), les contrôle et les injecte dans votre ERP. L'équipe valide les anomalies.",
    sectorLexicon: ["ADV", "ERP", "bon de commande", "fournisseur", "réception", "écart", "facture", "incoterms"],
    objection: "On a déjà un ERP, on ne va pas tout refaire.",
    objectionReply: "L'outil se connecte à votre ERP existant — on n'en change pas. C'est une couche d'automatisation par-dessus votre système actuel.",
    kpiLabel: "bons de commande traités automatiquement en %",
    typicalBudgetSignal: "Équivalent à 1 ETP sur la saisie ADV",
  },

  // ─────────────────────────────────────────────
  // ARTISANAT / SERVICES
  // ─────────────────────────────────────────────
  {
    secteur: "artisanat_services",
    verticale: "audits",
    painStatement: "Vous êtes artisan et vous perdez des contrats parce que vos devis arrivent trop tard ou ne sont pas assez professionnels.",
    benefitMeasured: "Envoyer un devis professionnel en moins de 2h après la visite client — au lieu de 2 à 3 jours.",
    beforeScenario: "Vous visitez un client mardi matin. Vous faites le devis mardi soir, vous le relisez mercredi, vous l'envoyez jeudi. Le client a signé avec quelqu'un d'autre mercredi.",
    afterScenario: "L'audit identifie vos frictions : où vous perdez du temps, pourquoi vos devis sont lents, ce qui peut être automatisé. La solution sort de là.",
    sectorLexicon: ["devis", "facturation", "SIRET", "auto-entrepreneur", "chantier", "main d'œuvre", "fournitures", "acompte"],
    objection: "Je suis artisan, pas informaticien — je ne vais pas gérer un système IA.",
    objectionReply: "L'audit débouche sur une recommandation adaptée à votre niveau : parfois c'est un simple outil, pas une implémentation complexe.",
    kpiLabel: "délai moyen de remise de devis réduit",
    typicalBudgetSignal: "1 contrat récupéré grâce à la rapidité = ROI immédiat",
  },
  {
    secteur: "artisanat_services",
    verticale: "interventions_formations",
    painStatement: "Vous savez que l'IA pourrait vous faire gagner du temps mais vous ne savez pas par où commencer sans vous tromper d'outil.",
    benefitMeasured: "En une demi-journée, identifier les 2 outils qui correspondent à votre métier et les tester sur vos vrais cas.",
    beforeScenario: "Vous avez essayé ChatGPT. Vous avez vu des vidéos YouTube. Mais rien de concret sur la création de devis pour un plombier ou les relances pour un électricien.",
    afterScenario: "La formation est construite sur votre métier : devis, planning, relances clients, réponses aux avis. Vous repartez avec des outils que vous utilisez le lendemain.",
    sectorLexicon: ["devis", "planning chantier", "relances", "facture", "client", "sous-traitant", "artisan", "TPE"],
    objection: "Les formations informatiques ce n'est pas pour moi.",
    objectionReply: "On travaille sur votre téléphone ou votre PC, avec des outils gratuits ou très peu chers. Aucun prérequis technique.",
    kpiLabel: "outils IA maîtrisés et utilisés le lendemain",
    typicalBudgetSignal: "Finançable OPCO pour les artisans en AGEFICE/FIFPL",
  },

  // ─────────────────────────────────────────────
  // RH / RECRUTEMENT
  // ─────────────────────────────────────────────
  {
    secteur: "rh_recrutement",
    verticale: "audits",
    painStatement: "Vos recruteurs passent 60% de leur temps sur des tâches administratives et 40% à vraiment recruter.",
    benefitMeasured: "Inverser ce ratio en 3 mois : 70% du temps sur les candidats, 30% sur l'admin.",
    beforeScenario: "Un recruteur reçoit 200 CVs pour un poste. Il en lit 180 qui ne correspondent pas. Il rédige 180 mails de refus. Il n'a plus le temps de bien qualifier les 20 bons.",
    afterScenario: "L'audit cartographie où le temps part réellement. La solution — pré-filtrage, rédaction automatique des refus, génération de questions d'entretien — sort du diagnostic.",
    sectorLexicon: ["sourcing", "CVthèque", "ATS", "candidat", "onboarding", "job board", "cooptation", "entretien"],
    objection: "Si l'IA filtre les CVs, on va rater des profils atypiques.",
    objectionReply: "L'IA pré-trie, vos recruteurs décident. Elle réduit le volume à traiter, pas le pouvoir de décision humain.",
    kpiLabel: "% du temps recruteur sur les candidats vs admin",
    typicalBudgetSignal: "1 recrutement raté coûte 15 à 30k€ en moyenne",
  },
  {
    secteur: "rh_recrutement",
    verticale: "implementations",
    painStatement: "Vos fiches de poste sont génériques, vos annonces ne se démarquent pas et votre taux de candidature est en baisse.",
    benefitMeasured: "Multiplier par 2 le nombre de candidatures qualifiées avec des annonces différenciées générées en 10 minutes.",
    beforeScenario: "Votre RH copie-colle la fiche de poste de l'an dernier, change 3 mots et publie. Le poste reste ouvert 3 mois et vous coûte en intérim.",
    afterScenario: "Il décrit le poste, le profil idéal et ce qui différencie votre entreprise. L'outil génère 3 variantes d'annonces optimisées pour chaque job board.",
    sectorLexicon: ["fiche de poste", "annonce", "job board", "LinkedIn", "Indeed", "GPEC", "mobilité interne", "marque employeur"],
    objection: "Nos annonces doivent être validées par la direction — on ne peut pas automatiser ça.",
    objectionReply: "L'outil génère, votre direction valide. Vous gagnez du temps sur la rédaction, pas sur la validation.",
    kpiLabel: "candidatures qualifiées reçues par annonce",
    typicalBudgetSignal: "Réduction du délai de recrutement de X semaines",
  },

  // ─────────────────────────────────────────────
  // COLLECTIVITÉS / PUBLIC
  // ─────────────────────────────────────────────
  {
    secteur: "collectivites_public",
    verticale: "audits",
    painStatement: "Vos agents passent trop de temps à répondre aux mêmes questions des administrés et à traiter des demandes répétitives.",
    benefitMeasured: "Identifier les 5 démarches les plus chronophages et estimer les ETP récupérables sans réduction d'effectifs.",
    beforeScenario: "Votre accueil reçoit 80 appels par jour. 55 concernent les mêmes 8 questions (horaires, démarches, documents à fournir). Vos agents sont épuisés et peu disponibles pour les cas complexes.",
    afterScenario: "L'audit analyse vos flux d'appels et de demandes. Il identifie ce qui peut être automatisé sans dégrader le service aux administrés.",
    sectorLexicon: ["administré", "guichet", "instruction", "délibération", "marchés publics", "DGFIP", "DSI", "agent territorial"],
    objection: "Le service public ne peut pas réduire le contact humain avec les administrés.",
    objectionReply: "L'objectif est l'inverse : libérer vos agents des questions répétitives pour qu'ils soient plus disponibles pour les cas qui nécessitent une vraie aide humaine.",
    kpiLabel: "ETP libérés sur les tâches répétitives",
    typicalBudgetSignal: "Finançable via DETR, fonds européens, ou budget DSI",
  },
  {
    secteur: "collectivites_public",
    verticale: "interventions_formations",
    painStatement: "Vos agents utilisent l'IA de façon non encadrée, avec des risques de confidentialité et de désinformation que vous ne maîtrisez pas.",
    benefitMeasured: "Un cadre d'usage IA validé par votre DSI et vos élus, avec 100% des agents formés sur les règles et les outils autorisés.",
    beforeScenario: "Certains agents utilisent ChatGPT pour rédiger des courriers administratifs avec des données sensibles. La collectivité n'a aucune visibilité ni politique officielle.",
    afterScenario: "Une charte IA est adoptée. Les agents formés connaissent les outils autorisés, les données qu'on ne met pas dans une IA, et les cas d'usage validés.",
    sectorLexicon: ["charte IA", "DSI", "RGPD", "données personnelles", "délibération", "agent public", "service public numérique"],
    objection: "On attend les directives de l'État avant de bouger.",
    objectionReply: "La formation prépare vos agents aux directives à venir — celles qui attendent seront en retard. Les premières collectivités formées maîtrisent leur déploiement.",
    kpiLabel: "% d'agents formés et conformes à la charte IA",
    typicalBudgetSignal: "Finançable CNFPT pour les agents territoriaux",
  },
];

/**
 * Récupère le contexte douleur pour une combinaison secteur × verticale
 */
export function getSectorPainContext(
  secteur: Secteur,
  verticale: Verticale
): SectorPainContext | undefined {
  return SECTOR_PAIN_MATRIX.find(
    (entry) => entry.secteur === secteur && entry.verticale === verticale
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
