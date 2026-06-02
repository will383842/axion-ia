// AUTO-GÉNÉRÉ 2026-06-02 — contenu FR DISTINCT + PUNCHY par sous-page /implementation.
// why/benefits/metrics courts & aérés (intro ≤18 mots, descriptions ≤14 mots,
// 0 jargon, métriques à label clair) + why.titleEm (accent terracotta).
// FR uniquement (EN non live, 301→FR).
import type { ImplementationSlug } from "./implementation";

export interface ImplementationFrOverride {
  benefits: ReadonlyArray<{ title: string; description: string }>;
  processSteps: ReadonlyArray<{ title: string; description: string }>;
  metrics: ReadonlyArray<{ number: string; suffix: string; label: string }>;
  faqs: ReadonlyArray<{ id: string; question: string; answer: string }>;
  maturityIntro: string;
  ctaBlockTitle: string;
  ctaBlockDescription: string;
  testimonials: ReadonlyArray<{ id: string; quote: string; author: string; role: string }>;
  why: {
    title: string;
    titleEm: string;
    intro?: string;
    points: ReadonlyArray<{ title: string; description: string }>;
  };
}

export const IMPL_FR_OVERRIDES: Record<ImplementationSlug, ImplementationFrOverride> = {
  "ia-custom": {
    benefits: [
      {
        title: "Conçue pour votre métier",
        description: "Comprend votre langage. Répond juste, sans reformulation.",
      },
      {
        title: "Bâtie sur votre cahier des charges",
        description: "Pensée autour de vos contraintes et objectifs précis.",
      },
      {
        title: "Une équipe dédiée",
        description: "Des experts affectés à votre projet, de la conception à l'exploitation.",
      },
    ],
    processSteps: [
      {
        title: "Cadrage technique et data",
        description:
          "Audit de vos données, de votre SI et de vos contraintes de sécurité pour définir l'architecture cible, le périmètre de fine-tuning et le modèle de déploiement.",
      },
      {
        title: "Build de la brique IA",
        description:
          "Construction du RAG custom, du fine-tuning ciblé et des agents avancés, avec mise en place de la vector DB et des pipelines de données.",
      },
      {
        title: "Déploiement et MLOps",
        description:
          "Mise en production on-premise ou en cloud privé, avec CI/CD des modèles, versioning et observabilité LLM intégrée à votre exploitation.",
      },
      {
        title: "Run, monitoring et évolution",
        description:
          "Suivi des dérives, ré-entraînement et amélioration continue des prompts et des modèles à mesure que vos données et vos besoins évoluent.",
      },
    ],
    metrics: [
      {
        number: "8-16",
        suffix: "sem",
        label: "Mise en production",
      },
      {
        number: "100",
        suffix: "%",
        label: "Adaptée à votre métier",
      },
      {
        number: "0",
        suffix: "",
        label: "Donnée hors de chez vous",
      },
    ],
    faqs: [
      {
        id: "ia-custom-difference",
        question:
          "Quelle différence entre une IA sur-mesure et un chatbot ou une automatisation standard ?",
        answer:
          "Une IA sur-mesure repose sur des modèles ajustés à vos données et une architecture conçue pour votre SI, là où un chatbot ou une automatisation s'appuie sur des briques génériques. On choisit cette voie quand le besoin est complexe, sensible ou stratégique, et qu'un assemblage d'outils existants ne suffit plus.",
      },
      {
        id: "ia-custom-fine-tuning",
        question: "Avez-vous besoin de fine-tuner un modèle ou un RAG suffit-il ?",
        answer:
          "Dans la majorité des cas, un RAG custom bien construit sur vos données couvre le besoin sans fine-tuning. Le fine-tuning ciblé devient pertinent pour un style, un format ou un raisonnement métier très spécifique que le RAG seul ne reproduit pas, et nous l'arbitrons au cadrage.",
      },
      {
        id: "ia-custom-donnees",
        question: "Nos données sensibles sortent-elles de notre infrastructure ?",
        answer:
          "Non, c'est tout l'intérêt de l'approche sur-mesure. Nous déployons on-premise ou en cloud privé, avec une vector DB dédiée, pour que vos données et vos embeddings restent dans votre périmètre. Le choix du modèle sous-jacent, open-weight ou API, est décidé selon votre niveau d'exigence.",
      },
      {
        id: "ia-custom-propriete",
        question: "Sommes-nous propriétaires du code et des modèles produits ?",
        answer:
          "Oui. Le code custom, les pipelines et les modèles fine-tunés vous sont livrés, sans abonnement imposé ni dépendance à une plateforme propriétaire. Vous pouvez exploiter et faire évoluer la solution en interne, ou nous confier le run.",
      },
      {
        id: "ia-custom-mlops",
        question: "Comment maintient-on une IA custom en production dans la durée ?",
        answer:
          "Via le MLOps et le monitoring LLM : versioning des modèles, suivi des coûts et des latences, détection des dérives de qualité et ré-entraînement périodique. Une IA en production se surveille comme un système critique, pas comme un projet figé.",
      },
      {
        id: "ia-custom-delai",
        question: "Combien de temps pour mettre en production une IA sur-mesure ?",
        answer:
          "Comptez généralement 8 à 16 semaines indicatives entre le cadrage et la mise en production, selon la complexité du SI et la qualité des données disponibles. Un premier périmètre restreint peut être livré plus tôt, puis étendu par itérations.",
      },
    ],
    maturityIntro:
      "Une IA sur-mesure se construit par paliers : du premier RAG ancré sur vos données jusqu'à une plateforme fine-tunée, monitorée et intégrée au cœur de votre SI.",
    ctaBlockTitle: "Un besoin IA complexe que les outils standard ne couvrent pas ?",
    ctaBlockDescription:
      "Parlons de votre architecture, de vos données et de vos contraintes de sécurité. Nous concevons une IA sur-mesure, intégrée à votre SI et dont vous gardez la maîtrise complète.",
    testimonials: [
      {
        id: "ia-custom-1",
        quote:
          "Les solutions sur étagère plafonnaient sur notre vocabulaire réglementaire. Un modèle fine-tuné sur nos propres dossiers a enfin donné des réponses exploitables par les équipes métier, sans les reformuler à chaque fois.",
        author: "Bertrand A.",
        role: "Directeur de l'innovation, groupe d'assurance, grand compte",
      },
      {
        id: "ia-custom-2",
        quote:
          "L'hébergement en cloud privé était une condition absolue pour notre direction juridique. Maîtriser toute la chaîne d'indexation, jusqu'au choix de la vector DB, a levé les réticences internes sur la traçabilité.",
        author: "Nadia K.",
        role: "DSI, laboratoire pharmaceutique, ETI",
      },
      {
        id: "ia-custom-3",
        quote:
          "Ce qui a fait la différence, c'est la partie MLOps et l'équipe dédiée : le système ne s'est pas dégradé après la mise en production, il a été suivi et réentraîné au fil de nos évolutions métier.",
        author: "Olivier P.",
        role: "Responsable data, énergéticien, grand compte",
      },
    ],
    why: {
      title: "Quand les outils standard ne suffisent plus, on passe au",
      titleEm: "sur-mesure",
      intro:
        "Besoin complexe, sensible ou stratégique. Une IA conçue pour votre métier, pas l'inverse.",
      points: [
        {
          title: "Pensée pour vous",
          description: "Adaptée à votre vocabulaire, vos règles, vos cas réels.",
        },
        {
          title: "Branchée sur vos données",
          description: "Connectée à vos systèmes, sans tout réécrire.",
        },
        {
          title: "Hébergée chez vous",
          description: "Vos données restent dans votre périmètre. Rien ne sort.",
        },
      ],
    },
  },
  chatbot: {
    benefits: [
      {
        title: "Support de nuit couvert",
        description: "Les questions courantes trouvent réponse hors horaires.",
      },
      {
        title: "Équipes déchargées",
        description: "Vos agents traitent enfin les vrais cas complexes.",
      },
      {
        title: "Mise à jour facile",
        description: "Vous changez un document, l'assistant suit.",
      },
    ],
    processSteps: [
      {
        title: "Cadrage des intentions conversationnelles",
        description:
          "On identifie les questions réelles posées en SAV, helpdesk ou qualification de leads, les sources documentaires à indexer et les moments où l'assistant doit passer la main à un humain.",
      },
      {
        title: "Construction du moteur de recherche-réponse",
        description:
          "Indexation de vos documents dans une vector DB, montage de la base de connaissances, réglage des prompts, des garde-fous et du ton des réponses.",
      },
      {
        title: "Branchement sur vos canaux",
        description:
          "Connexion au site, à Slack, Teams ou la messagerie visée (et à la voix si requis), avec routage des demandes vers vos outils de ticketing ou votre CRM.",
      },
      {
        title: "Suivi conversationnel et enrichissement",
        description:
          "Lecture des échanges, repérage des réponses ratées et complément continu de la base pour réduire les escalades évitables.",
      },
    ],
    metrics: [
      {
        number: "4-8",
        suffix: "sem",
        label: "Mise en service",
      },
      {
        number: "24/7",
        suffix: "",
        label: "Réponses disponibles",
      },
      {
        number: "100",
        suffix: "%",
        label: "Réponses sourcées",
      },
    ],
    faqs: [
      {
        id: "hallucination",
        question: "Comment éviter que le chatbot invente des réponses ?",
        answer:
          "L'assistant travaille en recherche-réponse sur vos documents : il puise uniquement dans votre base de connaissances et cite ses sources. Quand l'information n'y figure pas, il le dit clairement et propose un relais humain plutôt que de combler le vide.",
      },
      {
        id: "escalade",
        question: "Que se passe-t-il quand le bot ne sait pas répondre ?",
        answer:
          "Vous fixez les règles d'escalade au cadrage : transfert vers un agent, ouverture d'un ticket ou collecte du contact pour rappel. L'objectif est de traiter les demandes simples et de router le reste vers la bonne personne, pas de tout automatiser.",
      },
      {
        id: "canaux",
        question: "Sur quels canaux peut-on déployer l'assistant ?",
        answer:
          "Site web, Slack, Teams et les principales messageries selon votre besoin, avec un assistant vocal possible pour le téléphone. Le même moteur de connaissances alimente tous les canaux, vous ne maintenez donc qu'une seule base.",
      },
      {
        id: "maj-base",
        question: "Comment mettre à jour ce que le chatbot sait ?",
        answer:
          "La connaissance vit dans vos documents indexés, pas dans le code : mettez à jour une procédure ou une fiche produit et l'assistant en tient compte après ré-indexation. Vous gardez la main sur le contenu sans dépendre de nous à chaque changement.",
      },
      {
        id: "donnees",
        question: "Nos conversations et documents restent-ils confidentiels ?",
        answer:
          "Oui. Les échanges et les documents indexés sont hébergés dans l'UE par défaut, et le modèle retenu peut être contraint pour exclure toute réutilisation de vos conversations à des fins d'entraînement. L'historique des dialogues reste sous votre contrôle.",
      },
      {
        id: "perimetre",
        question: "Faut-il commencer par le SAV ou le support interne ?",
        answer:
          "On démarre sur un périmètre conversationnel cadré et mesurable — un type de demandes SAV récurrentes ou un helpdesk interne — avant d'élargir. Cela valide la qualité des réponses et les garde-fous sur un cas réel avant d'ouvrir d'autres canaux.",
      },
    ],
    maturityIntro:
      "Le déploiement d'un chatbot suit l'état réel de votre documentation : on démarre sur le périmètre conversationnel que votre base couvre déjà — une poignée de demandes récurrentes — puis on étend canal par canal à mesure que le corpus s'enrichit, plutôt que d'attendre une documentation idéale.",
    ctaBlockTitle: "Un assistant conversationnel qui répond juste, sur vos sources ?",
    ctaBlockDescription:
      "Parlons de vos demandes récurrentes (SAV, helpdesk, qualification de leads) et des canaux à couvrir. Vous repartez avec un périmètre clair pour un premier assistant fiable et monitoré.",
    testimonials: [
      {
        id: "chatbot-1",
        quote:
          "Le chatbot relié à notre base d'articles traite seul la majorité des demandes de niveau 1 et passe la main proprement dès que le sujet sort de son périmètre. Nos agents se concentrent enfin sur les cas complexes.",
        author: "Camille V.",
        role: "Responsable support client, éditeur de logiciel SaaS, ETI",
      },
      {
        id: "chatbot-2",
        quote:
          "Sur notre site et notre app, l'assistant répond aux questions courantes sur les commandes et les retours, avec un renvoi vers la fiche concernée. Les clients obtiennent une réponse immédiate sans attendre un agent.",
        author: "Yann L.",
        role: "DSI, e-commerçant mode, PME",
      },
      {
        id: "chatbot-3",
        quote:
          "L'assistant guide les usagers vers la bonne démarche et reformule en langage clair des informations parfois arides. Quand la question dépasse son cadre, il oriente vers le bon service plutôt que de tenter une réponse approximative.",
        author: "Inès F.",
        role: "Directrice de la relation usagers, collectivité",
      },
    ],
    why: {
      title: "Vos clients attendent une réponse,",
      titleEm: "pas une file d'attente",
      intro: "Un assistant qui répond 24/7, sur vos documents, et passe la main si besoin.",
      points: [
        {
          title: "Répond sur vos sources",
          description: "Il puise dans vos documents et cite l'origine.",
        },
        {
          title: "Sait dire « je passe »",
          description: "Hors sujet, il transfère à un humain.",
        },
        {
          title: "Comprend vos clients",
          description: "Il suit la conversation et garde le contexte.",
        },
      ],
    },
  },
  processus: {
    benefits: [
      {
        title: "Plus d'oublis de relance",
        description: "Chaque échéance part au bon moment, sans rien rouvrir.",
      },
      {
        title: "Devis à facture sans couture",
        description: "Validation, facturation, reporting s'enchaînent de bout en bout.",
      },
      {
        title: "Les exceptions remontent à vous",
        description: "Cas hors règle signalé pour décision. Le reste roule.",
      },
    ],
    processSteps: [
      {
        title: "Cartographie du processus",
        description:
          "On trace le flux réel de bout en bout — étapes, déclencheurs, points de décision, exceptions — et on chiffre le temps passé sur chaque maillon répétitif.",
      },
      {
        title: "Conception du workflow et des embranchements",
        description:
          "On modélise l'enchaînement (validations, branches conditionnelles, relances, escalades) et on fixe les seuils métier où l'IA décide seule et ceux où elle demande un feu vert.",
      },
      {
        title: "Connexion aux outils et mise en production",
        description:
          "On branche le workflow sur votre CRM, ERP, mail et calendrier via API ou connecteurs, on teste sur cas réels, puis on bascule flux par flux sans tout couper d'un coup.",
      },
      {
        title: "Mesure, ajustement et passation",
        description:
          "On suit le volume traité, les taux d'exception et le temps gagné par étape, on affine les seuils, et on vous remet le code et la documentation pour rester autonome.",
      },
    ],
    metrics: [
      {
        number: "4-8",
        suffix: "sem",
        label: "Premier flux en production",
      },
      {
        number: "3-6",
        suffix: "flux",
        label: "Processus enchaînés par projet",
      },
      {
        number: "100",
        suffix: "%",
        label: "Flux tracés bout en bout",
      },
    ],
    faqs: [
      {
        id: "quels-processus",
        question: "Quels processus métier peut-on automatiser en premier ?",
        answer:
          "Commencez par les flux à fort volume et faible valeur de décision : relances de devis et de factures, génération d'ordres de mission, validations internes, reporting récurrent, onboarding client ou collaborateur. Ce sont les tâches les plus répétitives, donc celles où l'orchestration se rentabilise le plus vite et le plus visiblement.",
      },
      {
        id: "difference-rpa",
        question: "Quelle différence avec un simple outil de RPA ?",
        answer:
          "La RPA classique rejoue des clics sur des règles fixes et casse dès qu'un cas sort du script. Ici, l'IA interprète un email mal rédigé, repère une pièce manquante, classe un cas ambigu et escalade quand un seuil métier est franchi, au lieu de bloquer. Vous gardez la robustesse de l'automatisation sans la rigidité du tout-ou-rien.",
      },
      {
        id: "outils-existants",
        question: "Faut-il changer de CRM ou d'ERP pour automatiser ?",
        answer:
          "Non. Le workflow se branche sur vos outils existants (CRM, ERP, messagerie, agenda) via leurs API ou des connecteurs, et lit-écrit là où vos équipes travaillent déjà. L'objectif est d'orchestrer par-dessus votre stack actuelle, pas de la remplacer ni d'ajouter une couche de ressaisie.",
      },
      {
        id: "garde-fous",
        question: "Comment garder le contrôle sur les actions automatisées ?",
        answer:
          "Chaque flux définit explicitement les seuils où l'IA agit seule et ceux qui exigent une validation humaine, par exemple au-dessus d'un certain montant ou sur un client sensible. Toutes les actions sont journalisées et rejouables, ce qui permet d'auditer le flux et d'ajuster les plafonds à tout moment.",
      },
      {
        id: "roi",
        question: "Comment mesure-t-on le gain de l'automatisation ?",
        answer:
          "On chiffre d'abord le temps passé sur chaque étape avant projet, puis on suit après mise en production le volume traité, le temps gagné par flux et le taux d'exceptions nécessitant un humain. Le gain devient lisible étape par étape, sans pourcentage théorique : vous voyez concrètement les heures récupérées sur les tâches répétitives.",
      },
      {
        id: "livraison",
        question: "À qui appartient la logique d'orchestration à la fin ?",
        answer:
          "À vous. Le workflow — enchaînements, règles conditionnelles, seuils et connecteurs — est livré sous forme de code que vous possédez, avec sa documentation, sans abonnement imposé pour le faire tourner. Une fenêtre de support accompagne la prise en main, puis vous restez libre de faire évoluer les flux en interne.",
      },
    ],
    maturityIntro:
      "D'un premier flux isolé à un maillage de processus interconnectés, l'orchestration IA de vos tâches métier se déploie en trois paliers : automatiser un enchaînement unique, puis relier plusieurs flux entre eux, jusqu'à coordonner les processus de plusieurs équipes.",
    ctaBlockTitle: "Quel processus vous coûte le plus d'heures aujourd'hui ?",
    ctaBlockDescription:
      "Décrivez-nous un flux répétitif — relances, validations, devis, reporting, onboarding — et nous identifions ensemble les étapes automatisables, leurs seuils de contrôle et le temps qu'elles vous feraient gagner.",
    testimonials: [
      {
        id: "processus-1",
        quote:
          "Nos relances de factures et nos rappels de paiement partent désormais tout seuls au bon moment, et chaque échéance suit son propre chemin de relance. L'équipe compta a récupéré ses fins de mois.",
        author: "Claire M.",
        role: "DAF, cabinet d'expertise comptable, PME",
      },
      {
        id: "processus-2",
        quote:
          "L'enchaînement réception de commande, planification de tournée et confirmation client se déroule sans qu'on rouvre trois logiciels. Les exceptions remontent toutes seules à la bonne personne.",
        author: "Damien R.",
        role: "Directeur des opérations, transporteur-logisticien, ETI",
      },
      {
        id: "processus-3",
        quote:
          "Le parcours devis-validation-facturation est enchaîné de bout en bout, avec les bons niveaux d'approbation selon le montant. On a arrêté de perdre des dossiers entre deux boîtes mail.",
        author: "Awa S.",
        role: "Responsable ADV, agroalimentaire, ETI",
      },
    ],
    why: {
      title: "Vos relances et factures ne devraient plus",
      titleEm: "vous échapper",
      intro: "Devis, relances, facturation, reporting : enchaînés tout seuls, selon vos règles.",
      points: [
        {
          title: "Un événement, toute la suite",
          description: "Devis accepté ou facture échue déclenche relance et facturation.",
        },
        {
          title: "Vos règles décident",
          description: "Montant, client, échéance : le bon chemin se choisit seul.",
        },
        {
          title: "Branché sur vos outils",
          description: "Lit et écrit dans votre CRM, ERP et messagerie.",
        },
      ],
    },
  },
  structuration: {
    benefits: [
      {
        title: "Des données enfin propres",
        description: "Vos fichiers en vrac deviennent une base claire et fiable.",
      },
      {
        title: "Extraction vérifiée",
        description: "Chaque info contrôlée, les cas douteux passent en relecture.",
      },
      {
        title: "Le socle de vos projets IA",
        description: "Des données saines évitent que vos futurs cas IA déraillent.",
      },
    ],
    processSteps: [
      {
        title: "Cartographie des sources",
        description:
          "On inventorie vos flux non structurés (boîtes mail, dépôts PDF, scans, exports) et on définit le schéma JSON cible champ par champ avec vos équipes.",
      },
      {
        title: "Construction du pipeline de parsing",
        description:
          "On développe les extracteurs IA (LLM, NLP, OCR si besoin) qui transforment chaque document en données structurées selon votre schéma.",
      },
      {
        title: "Contrôle qualité et validation",
        description:
          "On ajoute les règles de cohérence, le scoring de confiance et la file de revue humaine pour les cas ambigus, puis on push le JSON vers vos systèmes downstream.",
      },
      {
        title: "Mise en production et suivi",
        description:
          "On déploie le pipeline sur vos volumes réels, on monitore les taux d'extraction et on ajuste les extracteurs au fil des formats rencontrés.",
      },
    ],
    metrics: [
      {
        number: "3-6",
        suffix: "sem",
        label: "Mise en service",
      },
      {
        number: "95",
        suffix: "%+",
        label: "Taux d'extraction visé",
      },
      {
        number: "0",
        suffix: "",
        label: "Ressaisie manuelle",
      },
    ],
    faqs: [
      {
        id: "q1",
        question:
          "Quelle différence entre structurer mes données et simplement scanner mes documents ?",
        answer:
          "Un scan ou un OCR vous donne du texte brut, encore inexploitable par vos systèmes. La structuration va plus loin : elle identifie chaque information utile (montant, date, partie contractante, référence) et la range dans des champs JSON normalisés que vos applications peuvent lire directement.",
      },
      {
        id: "q2",
        question: "Quels types de documents pouvez-vous transformer en données exploitables ?",
        answer:
          "Emails, PDF, contrats, factures, bons de commande, comptes rendus, formulaires scannés : tout flux non structuré ou semi-structuré. Plus les formats sont variés, plus le pipeline intègre de règles d'extraction et de validation pour garantir un résultat homogène.",
      },
      {
        id: "q3",
        question: "Comment garantissez-vous que les données extraites sont justes ?",
        answer:
          "Chaque champ extrait reçoit un score de confiance et passe des règles de cohérence métier. Les cas en dessous du seuil partent en revue humaine plutôt que d'être validés à l'aveugle, ce qui évite de propager des erreurs dans vos systèmes en aval.",
      },
      {
        id: "q4",
        question: "Faut-il structurer mes données avant de lancer un projet IA ?",
        answer:
          "Dans la grande majorité des cas, oui. Un assistant ou un agent IA qui s'appuie sur des données sales ou incohérentes produit des réponses peu fiables. Structurer en amont est souvent le pré-requis qui rend les cas IA suivants vraiment exploitables.",
      },
      {
        id: "q5",
        question: "Où atterrissent les données une fois structurées, et restent-elles chez vous ?",
        answer:
          "Le JSON est poussé là où vous en avez besoin : votre base, votre CRM, votre ERP, un data warehouse ou une file de messages, via API ou connecteur, sans ressaisie. Les documents sources et les extractions transitent par un parsing hébergé dans votre périmètre ou en UE, et ne sont pas réutilisés en dehors de votre pipeline.",
      },
      {
        id: "q6",
        question: "Le pipeline tient-il quand de nouveaux formats arrivent ?",
        answer:
          "Oui, c'est prévu dès la conception. On monitore les taux d'extraction en production et on ajuste les extracteurs quand un nouveau gabarit de facture ou de contrat apparaît, pour que la qualité reste stable dans le temps.",
      },
    ],
    maturityIntro:
      "Selon l'état de vos données aujourd'hui, la structuration peut couvrir un seul type de document ou l'ensemble de vos flux entrants — voici trois niveaux de maturité possibles.",
    ctaBlockTitle: "Transformons vos documents en données exploitables",
    ctaBlockDescription:
      "Emails, PDF, contrats, factures : on construit le pipeline qui les convertit en JSON propre et validé, prêt à alimenter vos outils et vos cas IA. Parlons de vos sources de données et du schéma cible.",
    testimonials: [
      {
        id: "structuration-1",
        quote:
          "Nos données clients et dossiers étaient éparpillées entre messagerie, tableurs et actes scannés. Disposer enfin d'un référentiel normalisé et vérifié nous a permis d'arrêter de bricoler avant chaque projet.",
        author: "Pierre-Yves G.",
        role: "Associé, cabinet juridique, PME",
      },
      {
        id: "structuration-2",
        quote:
          "Avant, chaque équipe avait sa propre façon de nommer et ranger l'information. Le schéma de données unifié qu'on a posé ensemble sert maintenant de base commune à tout ce qu'on construit.",
        author: "Leïla B.",
        role: "Responsable back-office, courtier en assurance, PME",
      },
      {
        id: "structuration-3",
        quote:
          "On voulait lancer des projets d'IA, mais nos données n'étaient pas exploitables. Mettre le modèle data au carré en amont a tout débloqué pour la suite.",
        author: "Hugo C.",
        role: "Directeur technique, foncière immobilière, ETI",
      },
    ],
    why: {
      title: "Vos données dorment dans des fichiers",
      titleEm: "impossibles à exploiter",
      intro:
        "Emails, PDF, tableurs : l'info utile est là, mais éparpillée et illisible pour vos outils.",
      points: [
        {
          title: "Le vrac bloque tout",
          description: "Tant que c'est en vrac, aucun outil ne peut s'en servir.",
        },
        {
          title: "Rangé selon vos besoins",
          description: "On définit ensemble quelles infos extraire et comment les classer.",
        },
        {
          title: "Une base qui tient",
          description: "Vos données rangées une fois, réutilisables partout ensuite.",
        },
      ],
    },
  },
  "crm-erp": {
    benefits: [
      {
        title: "Commerciaux priorisés",
        description: "Affaires triées. Vos équipes appellent d'abord les bons comptes.",
      },
      {
        title: "Prévisions fiables",
        description: "Probabilité de signature et date estimée par affaire.",
      },
      {
        title: "Moins de saisie",
        description: "Comptes-rendus et fiches générés, réinjectés dans les bons champs.",
      },
    ],
    processSteps: [
      {
        title: "Cadrage de votre instance commerciale",
        description:
          "Audit des objets, champs et droits API de votre CRM/ERP, puis choix du cas prioritaire : scoring de leads, enrichissement de fiches, prévisions de pipeline ou comptes-rendus d'opportunités.",
      },
      {
        title: "Connecteurs API et modèle prédictif",
        description:
          "Développement des connecteurs vers votre CRM/ERP et entraînement du modèle de scoring sur votre historique de ventes gagnées et perdues, avec accès limité aux seuls objets nécessaires.",
      },
      {
        title: "Écriture dans vos champs existants",
        description:
          "Mise en production progressive : scores, enrichissements et synthèses s'écrivent dans vos fiches sans perturber le travail quotidien de vos commerciaux ni dupliquer la donnée.",
      },
      {
        title: "Recalibrage du scoring dans la durée",
        description:
          "Surveillance de la qualité des prévisions et réajustement du modèle à mesure que de nouveaux deals se closent, pour que la pertinence du score ne se dégrade pas avec le temps.",
      },
    ],
    metrics: [
      {
        number: "0",
        suffix: "",
        label: "Migration d'outil",
      },
      {
        number: "4-8",
        suffix: "sem",
        label: "Mise en production",
      },
      {
        number: "100",
        suffix: "%",
        label: "Données dans votre CRM",
      },
    ],
    faqs: [
      {
        id: "crm-erp-migration",
        question: "Devons-nous changer ou migrer notre CRM/ERP pour ajouter de l'IA ?",
        answer:
          "Non. L'IA se branche sur votre instance existante via ses API et écrit dans vos champs actuels. Vos commerciaux continuent à travailler dans le même outil, sans réapprentissage ni reprise de données.",
      },
      {
        id: "crm-erp-compatibilite",
        question:
          "Notre CRM est Salesforce (ou HubSpot, Sage, Cegid, Dynamics), est-ce compatible ?",
        answer:
          "Oui, ces cinq environnements exposent des API que nous utilisons couramment pour le scoring, l'enrichissement et le reporting. Pour un CRM/ERP plus rare ou très personnalisé, nous vérifions au cadrage la disponibilité et les limites de son API.",
      },
      {
        id: "crm-erp-scoring",
        question: "Comment le scoring de leads est-il calculé et reste-t-il fiable ?",
        answer:
          "Le score est entraîné sur votre propre historique de ventes gagnées et perdues, pas sur un modèle générique. Il est recalibré régulièrement à mesure que de nouveaux deals se closent, ce qui maintient sa pertinence dans la durée.",
      },
      {
        id: "crm-erp-previsions",
        question: "Les prévisions de ventes remplacent-elles le jugement de mes commerciaux ?",
        answer:
          "Non, elles l'outillent. L'analyse prédictive fournit une probabilité de closing et une estimation de date par opportunité, que le commercial garde la main d'ajuster. C'est une aide à la priorisation, pas une décision automatisée.",
      },
      {
        id: "crm-erp-donnees",
        question: "Nos données commerciales restent-elles dans notre CRM ?",
        answer:
          "Oui. Le connecteur reçoit des droits API restreints aux seuls objets nécessaires au cas d'usage (par exemple les leads et opportunités), et les scores comme les enrichissements sont réécrits dans vos propres champs. Vos historiques de ventes ne sont pas exposés au-delà de ce périmètre défini avec vous.",
      },
      {
        id: "crm-erp-delai",
        question: "Combien de temps avant de voir le premier cas en production ?",
        answer:
          "Pour un premier cas ciblé (par exemple le scoring de leads ou l'enrichissement de fiches), comptez une fourchette indicative de 4 à 8 semaines selon l'état de votre instance et l'accès aux API. Les cas suivants s'ajoutent ensuite plus rapidement sur la même connexion.",
      },
    ],
    maturityIntro:
      "L'IA s'installe sur un CRM/ERP par paliers : un premier cas commercial isolé, par exemple le scoring des leads entrants, avant d'étendre progressivement scoring et prévisions à l'ensemble du pipeline une fois la fiabilité validée.",
    ctaBlockTitle: "Votre CRM/ERP contient déjà la matière, exploitons-la",
    ctaBlockDescription:
      "Scoring de leads, enrichissement de fiches, prévisions de ventes et comptes-rendus automatiques : nous greffons l'IA sur votre Salesforce, HubSpot, Sage, Cegid ou Dynamics sans migration. Parlons de votre premier cas d'usage.",
    testimonials: [
      {
        id: "crm-erp-1",
        quote:
          "L'enrichissement s'est branché sur notre HubSpot sans rien changer pour les commerciaux : le secteur et l'effectif sont déjà renseignés à l'arrivée du lead, et l'équipe perd moins de temps à se documenter avant un appel.",
        author: "Sandrine T.",
        role: "Directrice commerciale, négoce BtoB, ETI",
      },
      {
        id: "crm-erp-2",
        quote:
          "Le scoring s'appuie sur notre vrai historique Dynamics et pas sur une recette toute faite. On priorise les comptes qui ont réellement une chance d'aboutir, et les prévisions collent enfin à ce que vit le terrain.",
        author: "Mehdi O.",
        role: "DSI, fabricant d'équipements industriels, ETI",
      },
      {
        id: "crm-erp-3",
        quote:
          "Les comptes-rendus de visite se génèrent à partir des notes saisies dans l'outil, et une alerte nous prévient quand un client habituel ralentit ses commandes. On réagit avant de perdre le compte, sans avoir changé de CRM.",
        author: "Florence J.",
        role: "Responsable CRM, distribution spécialisée, grand compte",
      },
    ],
    why: {
      title: "Votre CRM/ERP dort sur une mine de",
      titleEm: "données inexploitées",
      intro: "Greffez l'IA sur votre CRM/ERP actuel. Sans migration. Sans refonte.",
      points: [
        {
          title: "Zéro migration",
          description: "L'IA se branche sur votre outil existant. Rien à changer.",
        },
        {
          title: "Vos vrais cycles",
          description: "Priorisation entraînée sur vos affaires gagnées et perdues.",
        },
        {
          title: "Fiches complétées seules",
          description: "Champs remplis et comptes-rendus écrits sans ressaisie.",
        },
      ],
    },
  },
  documents: {
    benefits: [
      {
        title: "Documents prêts à relire",
        description: "Vos modèles remplis avec vos données. Plus de page blanche.",
      },
      {
        title: "Plus de tri manuel",
        description: "Factures et courriers lus, classés, rattachés au bon dossier.",
      },
      {
        title: "Archives enfin utiles",
        description: "Le bon dossier en quelques secondes, source citée.",
      },
    ],
    processSteps: [
      {
        title: "Cadrage des types de documents",
        description:
          "On identifie les documents à générer et à lire, leurs templates, leurs champs et les sources de données métier à mobiliser.",
      },
      {
        title: "Build génération + extraction",
        description:
          "On développe les modèles de production assistée et les pipelines d'extraction/classification IA, avec schéma JSON cible calibré sur vos documents réels.",
      },
      {
        title: "Indexation du corpus et mise en production",
        description:
          "On indexe votre corpus dans une vector DB pour la recherche sémantique et on déploie les workflows dans vos outils, avec validation humaine sur les sorties sensibles.",
      },
      {
        title: "Calibrage continu des sorties",
        description:
          "On affine les templates, les règles d'extraction et la pertinence de la recherche au fil de vos documents et de vos retours.",
      },
    ],
    metrics: [
      {
        number: "5-8",
        suffix: "sem",
        label: "Mise en production",
      },
      {
        number: "0",
        suffix: "",
        label: "Ressaisie des pièces lues",
      },
      {
        number: "2",
        suffix: "flux",
        label: "Production et lecture couvertes",
      },
    ],
    faqs: [
      {
        id: "templates-existants",
        question: "Peut-on partir de nos modèles de documents actuels ?",
        answer:
          "Oui, on s'appuie sur vos templates existants de devis, contrats ou comptes-rendus. L'IA remplit les sections variables à partir de vos données métier, et vous gardez la main sur la mise en forme et la relecture finale.",
      },
      {
        id: "fiabilite-extraction",
        question: "Quelle fiabilité pour l'extraction des documents entrants ?",
        answer:
          "La fiabilité dépend de la qualité et de la régularité de vos documents ; sur des formats stables comme les factures, l'extraction est très bonne après calibrage. On prévoit toujours une étape de validation humaine sur les champs critiques pour éviter toute erreur silencieuse.",
      },
      {
        id: "documents-confidentiels",
        question: "Nos contrats et dossiers sensibles sont-ils réutilisés ailleurs ?",
        answer:
          "Non. Votre corpus et les documents traités servent uniquement à votre solution : ni les contrats, ni les pièces extraites, ni les index sémantiques ne sont réutilisés pour entraîner un service tiers. Les traitements sont cantonnés au périmètre que vous définissez, avec journalisation des accès aux documents sensibles.",
      },
      {
        id: "recherche-archives",
        question: "Comment fonctionne la recherche dans nos archives ?",
        answer:
          "Vous interrogez votre corpus en langage naturel et le moteur retrouve les passages pertinents par le sens, puis cite les documents sources d'où vient chaque résultat. Vous accédez ainsi à la bonne clause ou au bon dossier sans connaître à l'avance le mot-clé exact ni l'emplacement du fichier.",
      },
      {
        id: "volume-documents",
        question: "Faut-il un gros volume de documents pour que ce soit utile ?",
        answer:
          "Non, la génération assistée est utile dès que vous produisez régulièrement les mêmes types de documents. La recherche sémantique, elle, prend toute sa valeur à partir de quelques centaines de documents archivés à exploiter.",
      },
      {
        id: "formats-pris-en-charge",
        question: "Quels formats de documents sont pris en charge ?",
        answer:
          "On traite couramment les PDF, documents bureautiques et e-mails, en sortie comme en entrée. Les documents scannés sont gérés via une étape de reconnaissance de texte avant extraction, à valider sur vos cas réels.",
      },
    ],
    maturityIntro:
      "D'un premier type de document automatisé jusqu'à un corpus entier exploitable, l'IA documentaire s'installe par paliers : on commence par générer ou lire un document précis, puis on étend l'extraction et la recherche sémantique à l'ensemble de vos archives.",
    ctaBlockTitle: "Faites travailler l'IA sur vos documents",
    ctaBlockDescription:
      "Génération de devis et contrats, lecture automatique des pièces entrantes, recherche dans vos archives : décrivons ensemble vos documents et le flux à automatiser en priorité.",
    testimonials: [
      {
        id: "documents-1",
        quote:
          "Nos PV de chantier et nos comptes-rendus de réunion sont désormais générés depuis nos modèles, avec le bon cadre contractuel. La rédaction qui mobilisait une demi-journée se fait en quelques minutes, et nos conducteurs de travaux se concentrent sur le terrain.",
        author: "Antoine W.",
        role: "Directeur de travaux, groupe BTP, ETI",
      },
      {
        id: "documents-2",
        quote:
          "Les courriers et comptes-rendus entrants sont lus, rattachés au bon dossier patient et routés vers le bon pôle automatiquement. Plus de pile à trier le matin, et rien ne se perd entre les services.",
        author: "Rachida E.",
        role: "Responsable qualité, clinique privée, ETI",
      },
      {
        id: "documents-3",
        quote:
          "Retrouver la bonne clause dans nos milliers de dossiers archivés relevait du casse-tête. La recherche sémantique nous donne le passage exact et le document source, ce qui nous permet de vérifier avant de répondre.",
        author: "Vincent H.",
        role: "Responsable conformité, banque de détail, grand compte",
      },
    ],
    why: {
      title: "Vos documents ne devraient plus être un",
      titleEm: "goulot d'étranglement",
      intro: "Rédiger, trier, retrouver : trop de temps perdu sur le répétitif.",
      points: [
        {
          title: "Production assistée",
          description: "Devis, contrats, comptes-rendus générés depuis vos modèles.",
        },
        {
          title: "Lecture automatique",
          description: "Les pièces entrantes sont lues, classées et routées.",
        },
        {
          title: "Recherche par le sens",
          description: "Retrouvez la bonne clause sans connaître le mot exact.",
        },
      ],
    },
  },
  agents: {
    benefits: [
      {
        title: "La tâche bouclée seul",
        description: "Il va au bout. Pas une réponse isolée.",
      },
      {
        title: "Chaque action consignée",
        description: "Vous voyez ce qu'il a décidé et fait.",
      },
      {
        title: "Démarrage prudent",
        description: "D'abord il suggère. L'autonomie vient une fois vérifié.",
      },
    ],
    processSteps: [
      {
        title: "Cadrage des missions et du périmètre d'accès",
        description:
          "On délimite les tâches confiées à l'agent, les systèmes qu'il peut lire ou modifier, et les actions qui exigent une validation humaine avant exécution.",
      },
      {
        title: "Construction de la boucle de raisonnement et des outils",
        description:
          "On conçoit la logique de décision, les outils que l'agent peut appeler (API, recherche, écriture en base) et les garde-fous qui bornent chaque étape de la boucle.",
      },
      {
        title: "Déploiement en mode suggestion puis autonomie",
        description:
          "L'agent démarre en suggérant ses actions sur vos cas réels, puis bascule en autonomie progressive une fois son comportement vérifié action par action.",
      },
      {
        title: "Traçage des décisions et extension du périmètre",
        description:
          "On journalise chaque décision de l'agent, on corrige les dérives observées et on élargit son champ d'action au rythme de la confiance acquise.",
      },
    ],
    metrics: [
      {
        number: "4-8",
        suffix: "sem",
        label: "Premier agent en production",
      },
      {
        number: "100",
        suffix: "%",
        label: "Décisions de l'agent traçables",
      },
      {
        number: "24",
        suffix: "/7",
        label: "Agent actif sans pause",
      },
    ],
    faqs: [
      {
        id: "agents-faq-1",
        question: "Quelle différence entre un agent IA et un chatbot ?",
        answer:
          "Un chatbot rend une réponse à une question, puis attend la suivante. Un agent enchaîne plusieurs étapes seul : il cherche l'information, la synthétise et déclenche une action sur vos systèmes, comme créer une fiche ou envoyer une relance. C'est cette capacité à agir, et pas seulement à répondre, qui définit un agent.",
      },
      {
        id: "agents-faq-2",
        question: "Comment empêcher un agent de faire n'importe quoi sur nos systèmes ?",
        answer:
          "On pose des garde-fous avant le déploiement : périmètre d'accès limité aux seuls systèmes nécessaires, actions sensibles soumises à validation humaine et journal complet de chaque décision. L'agent démarre en mode suggestion et ne passe en autonomie que sur les actions dont le comportement a été vérifié sur vos cas réels.",
      },
      {
        id: "agents-faq-3",
        question: "Mono-agent ou multi-agents, comment choisir ?",
        answer:
          "Un mono-agent suffit pour une mission cadrée, comme qualifier des prospects ou trier des tickets. On passe au multi-agents quand le workflow mêle des compétences distinctes : un agent qui collecte la veille concurrentielle et un autre qui en rédige la synthèse, par exemple. On commence presque toujours par un agent unique avant d'élargir.",
      },
      {
        id: "agents-faq-4",
        question: "Sur quels cas d'usage un agent est-il pertinent en B2B ?",
        answer:
          "Les meilleurs candidats sont la prospection (recherche et qualification de comptes), le support (résolution de tickets multi-étapes), la veille concurrentielle et certaines opérations répétitives. La règle : une tâche claire, des sources accessibles et un résultat vérifiable. Les décisions floues ou à fort enjeu restent du ressort humain.",
      },
      {
        id: "agents-faq-5",
        question: "Que se passe-t-il si l'agent se trompe ?",
        answer:
          "Chaque action étant journalisée, une erreur est identifiable et corrigeable. Sur les actions à impact, le point de validation humaine bloque l'exécution tant qu'un opérateur n'a pas confirmé. On affine ensuite la boucle de raisonnement et les outils de l'agent pour que le cas ne se reproduise pas.",
      },
      {
        id: "agents-faq-6",
        question: "À qui appartiennent la boucle d'agent et ses prompts ?",
        answer:
          "Le code de l'agent, sa boucle de raisonnement et ses prompts vous sont livrés et s'exécutent sur votre infrastructure ou votre fournisseur de modèle. Vous gardez la main sur le périmètre d'accès, les coûts par appel et l'évolution de l'agent, sans dépendance imposée à une plateforme d'orchestration tierce.",
      },
    ],
    maturityIntro:
      "Un agent IA peut démarrer en assistant qui suggère une action sur une tâche unique, puis monter jusqu'à un système multi-agents autonome supervisé qui coordonne un workflow complet : voici les trois niveaux de maturité.",
    ctaBlockTitle: "Un agent qui agit, pas seulement qui répond",
    ctaBlockDescription:
      "Décrivez-nous une tâche multi-étapes de votre quotidien — prospection, support, veille ou opérations — et nous vous dirons si un agent IA peut la prendre en charge, avec quels garde-fous et dans quel ordre de déploiement.",
    testimonials: [
      {
        id: "agents-1",
        quote:
          "Notre agent de veille concurrentielle décide seul quelles sources approfondir, recoupe les signaux et nous remet une note d'analyse exploitable. On débat des conclusions au lieu d'éplucher les pages nous-mêmes.",
        author: "Julie N.",
        role: "Directrice associée, cabinet de conseil / ESN, ETI",
      },
      {
        id: "agents-2",
        quote:
          "L'agent traite le premier niveau de nos demandes candidats : il va chercher l'info dans nos outils, tranche les cas simples et n'escalade que ce qui mérite un humain. Le journal des actions nous a rassurés avant la mise en production.",
        author: "Karim Z.",
        role: "Responsable recrutement, cabinet RH, PME",
      },
      {
        id: "agents-3",
        quote:
          "Pour le suivi éditorial, plusieurs agents se répartissent la collecte des sujets, la vérification et l'alerte. Chacun garde son périmètre et on reconstitue facilement qui a fait quoi quand un point demande validation.",
        author: "Élodie Q.",
        role: "Rédactrice en chef, groupe de presse, PME",
      },
    ],
    why: {
      title: "Un agent qui agit,",
      titleEm: "pas qui attend",
      intro: "Il cherche, analyse, agit sur vos systèmes. Vous validez.",
      points: [
        {
          title: "Plusieurs étapes, seul",
          description: "Il enchaîne recherche, analyse et action. Sans relance.",
        },
        {
          title: "Vous fixez les limites",
          description: "Périmètre borné. Une action sensible passe par vous.",
        },
        {
          title: "Vos vrais cas",
          description: "Prospection, support, veille, opérations répétitives du quotidien.",
        },
      ],
    },
  },
  integrations: {
    benefits: [
      {
        title: "Zéro changement d'habitude",
        description: "Vos équipes gardent leurs outils, leur quotidien intact.",
      },
      {
        title: "Connexions pilotables",
        description: "Vous voyez où l'IA agit, outil par outil.",
      },
      {
        title: "Branchements évolutifs",
        description: "Un outil de plus se relie sans tout refaire.",
      },
    ],
    processSteps: [
      {
        title: "Cartographie des outils et des points de lecture/écriture",
        description:
          "On recense vos outils (Slack, Teams, Notion, Airtable, Google Workspace, mail, APIs internes) et les endroits exacts où l'IA doit lire et écrire dans chaque flux.",
      },
      {
        title: "Conception des contrats d'API et de l'authentification",
        description:
          "On définit les endpoints, le mode d'auth (OAuth, tokens de service à portée limitée), le schéma JSON des payloads et la politique de retry pour chaque connecteur.",
      },
      {
        title: "Développement des connecteurs et raccordement",
        description:
          "On code les connecteurs custom, on branche webhooks et files d'attente, et on valide les échanges en recette avant la prod, connecteur par connecteur.",
      },
      {
        title: "Mise en production avec monitoring des coûts",
        description:
          "On déploie avec gestion des rate limits, alerting sur les erreurs d'API et tableau de suivi des coûts par flux, puis on assure le support dans la durée.",
      },
    ],
    metrics: [
      {
        number: "6+",
        suffix: "outils",
        label: "Outils reliés au départ",
      },
      {
        number: "3-6",
        suffix: "sem",
        label: "Première connexion active",
      },
      {
        number: "100",
        suffix: "%",
        label: "Branchements documentés",
      },
    ],
    faqs: [
      {
        id: "faq-1",
        question: "Pouvez-vous connecter l'IA à nos APIs internes, pas seulement aux outils SaaS ?",
        answer:
          "Oui. Au-delà des connecteurs standards (Slack, Teams, Google Workspace), on développe des connecteurs sur mesure vers vos APIs internes, votre SI métier ou vos bases. Il nous faut la documentation de vos endpoints et un accès de recette pour cadrer l'authentification et les schémas de données.",
      },
      {
        id: "faq-2",
        question: "Comment évitez-vous les dépassements de coûts liés aux appels API ?",
        answer:
          "Chaque connecteur intègre une gestion des rate limits, un plafond de budget par flux et un suivi des tokens consommés. On met en place un monitoring des coûts avec alerting, pour que vous voyiez la dépense en temps réel et puissiez couper un flux si besoin.",
      },
      {
        id: "faq-3",
        question: "Que se passe-t-il si un outil tiers tombe ou change son API ?",
        answer:
          "Les connecteurs sont conçus avec retries, files d'attente et gestion des erreurs, donc une panne tierce temporaire ne perd pas vos données. Si un fournisseur modifie son API, l'adaptation reste circonscrite au connecteur concerné sans toucher au reste du SI.",
      },
      {
        id: "faq-4",
        question: "Faut-il remplacer nos outils actuels par les vôtres ?",
        answer:
          "Non. On branche l'IA sur les outils que vos équipes utilisent déjà, via des connecteurs invisibles pour les utilisateurs finaux. Il n'y a pas de plateforme à adopter ni d'outil à abandonner : on raccorde l'existant, on ne le remplace pas.",
      },
      {
        id: "faq-5",
        question: "Qui détient les connecteurs et les clés d'accès une fois livrés ?",
        answer:
          "Les connecteurs vous sont livrés en code documenté, et les secrets d'API (OAuth, tokens de service) restent dans votre coffre, jamais en clair dans le code. Chaque accès est réduit aux objets strictement nécessaires au flux, et vous pouvez le révoquer ou le faire évoluer sans dépendre de nous.",
      },
      {
        id: "faq-6",
        question: "Combien de connecteurs peut-on raccorder, et dans quel ordre ?",
        answer:
          "On commence par un ou deux connecteurs à fort usage pour valider la mécanique, puis on étend au reste de votre stack. Un premier connecteur en production prend souvent 3 à 6 semaines selon la complexité de l'API ciblée ; ces fourchettes sont indicatives.",
      },
    ],
    maturityIntro:
      "D'un premier connecteur isolé à un maillage de plusieurs outils synchronisés, le raccordement de l'IA à votre SI se déploie en trois niveaux de maturité.",
    ctaBlockTitle: "Branchez l'IA sur vos outils, sans changer vos habitudes",
    ctaBlockDescription:
      "Slack, Teams, Notion, Airtable, Google Workspace, mail ou APIs internes : on construit les connecteurs qui relient l'IA à votre SI existant, avec contrats d'API documentés, gestion des rate limits, suivi des coûts et code livré chez vous. Parlons de votre stack et des flux à raccorder.",
    testimonials: [
      {
        id: "integrations-1",
        quote:
          "L'IA répond directement dans notre Slack et va chercher l'info dans Notion et nos APIs internes. Personne ne change d'outil, et le réflexe est venu tout seul.",
        author: "Thomas X.",
        role: "DSI, groupe industriel, grand compte",
      },
      {
        id: "integrations-2",
        quote:
          "La liaison avec Google Workspace et notre messagerie tourne sans accroc : les rate limits sont gérés proprement, on n'a jamais subi de blocage côté fournisseur.",
        author: "Sofia M.",
        role: "CTO, fintech, scale-up",
      },
      {
        id: "integrations-3",
        quote:
          "Ce que je retiens, c'est de voir où l'IA est sollicitée, connecteur par connecteur, entre Teams et nos outils internes. Je peux arbitrer en connaissance de cause.",
        author: "Renaud D.",
        role: "Responsable IT, enseigne de retail, ETI",
      },
    ],
    why: {
      title: "Reliez l'IA à vos outils, sans",
      titleEm: "tout chambouler",
      intro: "Votre info est éparpillée. L'IA doit la traverser, là où vous travaillez.",
      points: [
        {
          title: "L'existant relié",
          description: "On branche vos logiciels actuels, sans en changer.",
        },
        {
          title: "Un point central",
          description: "Tous vos outils reliés depuis une base unique.",
        },
        {
          title: "Sans nouvel outil",
          description: "On branche l'existant, on ne remplace rien.",
        },
      ],
    },
  },
  "no-code": {
    benefits: [
      {
        title: "Démarrage rapide",
        description: "On part de l'existant. Pas de refonte, résultats en semaines.",
      },
      {
        title: "Greffe propre",
        description: "Garde-fous, gestion d'erreurs, coûts surveillés. Pas de bricolage fragile.",
      },
      {
        title: "Verdict honnête",
        description: "On dit où le no-code bute et quand basculer sur-mesure.",
      },
    ],
    processSteps: [
      {
        title: "Audit de votre stack no-code",
        description:
          "Nous inventorions vos scénarios n8n/Make/Zapier, vos bases Airtable et vos apps Bubble pour repérer les étapes où une brique IA apporte vraiment de la valeur.",
      },
      {
        title: "Conception des étapes IA",
        description:
          "Nous définissons les modules IA à insérer (extraction, classification, rédaction, décision), le schéma de leurs entrées-sorties et les garde-fous avant tout déploiement.",
      },
      {
        title: "Greffe dans vos scénarios",
        description:
          "Nous ajoutons les modules IA dans vos automatisations existantes, avec gestion des erreurs et respect des quotas de la plateforme éditeur.",
      },
      {
        title: "Transfert à votre équipe",
        description:
          "Nous formons les personnes qui pilotent déjà ces outils à faire évoluer les flows en autonomie, et documentons la logique au cas où vous migreriez plus tard vers du custom.",
      },
    ],
    metrics: [
      {
        number: "2-4",
        suffix: "sem",
        label: "Mise en production",
      },
      {
        number: "5",
        suffix: "",
        label: "Plateformes prises en charge",
      },
      {
        number: "0",
        suffix: "",
        label: "Dépendance verrouillée",
      },
    ],
    faqs: [
      {
        id: "no-code-default",
        question: "Le no-code est-il votre recommandation par défaut ?",
        answer:
          "Non. Par défaut nous livrons du code custom chez vous. Nous greffons l'IA dans le no-code uniquement quand votre équipe utilise déjà ces outils et veut les conserver.",
      },
      {
        id: "no-code-tools",
        question: "Quels outils no-code prenez-vous en charge ?",
        answer:
          "Principalement n8n, Make, Zapier, Bubble et Airtable, qui couvrent l'essentiel des stacks que nous rencontrons en PME et ETI. Si vous utilisez un autre outil doté d'une API ouverte, nous évaluons la faisabilité au cas par cas.",
      },
      {
        id: "no-code-limits",
        question: "Quelles sont les limites de l'IA dans un outil no-code ?",
        answer:
          "Vous restez tributaire des connecteurs, des quotas et des tarifs de l'éditeur, et certaines logiques fines sont difficiles à exprimer dans une interface visuelle. Pour un usage central ou à fort volume, le code custom devient plus robuste et moins coûteux à l'échelle.",
      },
      {
        id: "no-code-migration",
        question: "Pourrai-je migrer ces flows vers du custom plus tard ?",
        answer:
          "Oui, et nous le prévoyons dès la conception. Nous documentons la logique de vos scénarios pour qu'une bascule ultérieure se fasse sans tout reconstruire.",
      },
      {
        id: "no-code-cost",
        question: "Combien coûte ce type de greffe IA ?",
        answer:
          "À titre indicatif, brancher l'IA sur des scénarios no-code existants se chiffre sur quelques semaines, selon le nombre de flows et leur complexité. Nous donnons une fourchette précise après l'audit de votre stack.",
      },
      {
        id: "no-code-data",
        question: "Qui voit mes données quand l'IA passe par le no-code ?",
        answer:
          "Elles transitent par la plateforme éditeur puis par le fournisseur du modèle : deux tiers à cadrer. Nous limitons les champs envoyés à chaque étape IA et, si la sensibilité l'exige, nous orientons plutôt vers une solution custom hébergée chez vous.",
      },
    ],
    maturityIntro:
      "L'IA s'installe dans votre no-code par paliers : d'un premier scénario assisté à un maillage de flows outillés et surveillés, à votre rythme.",
    ctaBlockTitle: "Vous avez déjà n8n, Make, Zapier, Bubble ou Airtable ?",
    ctaBlockDescription:
      "Montrez-nous vos scénarios existants : nous vous dirons honnêtement où l'IA se greffe proprement dans votre no-code et où le code custom serait un meilleur choix.",
    testimonials: [
      {
        id: "no-code-1",
        quote:
          "On voulait tester l'IA sans réécrire nos scénarios Make. Axion-IA a branché le tri et le résumé des demandes dessus en quelques jours, et nous a dit franchement à partir de quel volume il faudrait passer en code custom.",
        author: "Manon B.",
        role: "Directrice, agence marketing, PME",
      },
      {
        id: "no-code-2",
        quote:
          "Notre base Airtable est le coeur de notre suivi bénévoles et dons. Ils ont greffé la qualification IA directement dessus, proprement documentée, sans nous enfermer ni nous forcer à migrer.",
        author: "Cédric L.",
        role: "Responsable des opérations, association d'intérêt général",
      },
      {
        id: "no-code-3",
        quote:
          "Ils ont posé la vraie question dès le départ : no-code ou sur-mesure. Pour cette première brique, la greffe sur nos outils actuels suffisait, et ils ont prévu la sortie au cas où on grandirait.",
        author: "Aurélie P.",
        role: "Gérante, organisme de formation, TPE",
      },
    ],
    why: {
      title: "Gardez vos outils. On y branche",
      titleEm: "l'intelligence",
      intro: "Vous tournez sur n8n, Make, Zapier, Bubble ou Airtable ? On greffe l'IA dessus.",
      points: [
        {
          title: "Sur demande, pas par défaut",
          description: "Notre standard reste le code sur-mesure. Le no-code, si vous le demandez.",
        },
        {
          title: "Vos équipes restent autonomes",
          description: "L'IA vit dans vos outils. Vos pilotes la gardent en main.",
        },
        {
          title: "Pas prisonnier de l'outil",
          description: "L'IA reste extractible. Vous changez de plateforme quand vous voulez.",
        },
      ],
    },
  },
};
