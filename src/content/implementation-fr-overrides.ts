// AUTO-GÉNÉRÉ 2026-06-02 — contenu FR DISTINCT par sous-page /implementation.
// Source : workflow impl-subpages-fr-content (9 rédacteurs FR + critique
// anti-duplication + passe de révision des chevauchements). Dé-duplique les
// blocs partagés de makeFr (benefits/process/metrics/faqs/maturity/cta).
// FR uniquement : l'EN (non live, 301→FR) garde les défauts de makeEn jusqu'à
// sa traduction (prévue dans plusieurs mois).
import type { ImplementationSlug } from "./implementation";

export interface ImplementationFrOverride {
  benefits: ReadonlyArray<{ title: string; description: string }>;
  processSteps: ReadonlyArray<{ title: string; description: string }>;
  metrics: ReadonlyArray<{ number: string; suffix: string; label: string }>;
  faqs: ReadonlyArray<{ id: string; question: string; answer: string }>;
  maturityIntro: string;
  ctaBlockTitle: string;
  ctaBlockDescription: string;
}

export const IMPL_FR_OVERRIDES: Record<ImplementationSlug, ImplementationFrOverride> = {
  "ia-custom": {
    benefits: [
      {
        title: "Modèles entraînés sur vos données",
        description:
          "Fine-tuning ciblé et RAG construit sur votre propre corpus métier, pour des réponses ancrées dans votre vocabulaire, vos référentiels et vos cas d'usage internes.",
      },
      {
        title: "Intégration profonde dans votre SI",
        description:
          "Déploiement on-premise ou cloud privé, vector DB dédiée et connexion directe à vos bases, API et systèmes critiques sans exfiltration de données vers un tiers.",
      },
      {
        title: "Équipe dédiée et code livré",
        description:
          "Une équipe IA affectée à votre projet livre un code custom dont vous êtes propriétaire, avec MLOps et monitoring LLM pour le tenir en production dans la durée.",
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
        label: "Du cadrage à la mise en production",
      },
      {
        number: "100",
        suffix: "%",
        label: "Code et modèles livrés au client",
      },
      {
        number: "On-prem",
        suffix: "/cloud privé",
        label: "Options de déploiement souverain",
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
  },
  chatbot: {
    benefits: [
      {
        title: "Réponses sourcées dans votre documentation",
        description:
          "L'assistant répond à partir de votre base de connaissances (procédures, contrats, fiches produits) et cite le document d'où vient l'information, au lieu de la formuler de mémoire.",
      },
      {
        title: "Une conversation, plusieurs canaux",
        description:
          "Le même assistant dialogue sur votre site, Slack, Teams ou votre messagerie, avec une variante vocale pour le standard et le support téléphonique — toujours alimenté par une seule base.",
      },
      {
        title: "Périmètre de réponse cadré",
        description:
          "Vous délimitez les sujets que l'assistant traite et ceux qu'il refuse, avec passage de relais à un humain dès que la demande sort du corpus documentaire prévu.",
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
        label: "Premier assistant en ligne",
      },
      {
        number: "3+",
        suffix: "canaux",
        label: "Site, Slack, Teams, messagerie, voix",
      },
      {
        number: "24/7",
        suffix: "",
        label: "Disponibilité des réponses, avec relais humain",
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
  },
  processus: {
    benefits: [
      {
        title: "Vos tâches répétitives tournent seules",
        description:
          "Relances de devis impayés, validations de congés, génération d'ordres de mission ou de reporting hebdo s'exécutent sans intervention manuelle, déclenchées par les bons événements métier.",
      },
      {
        title: "Branché sur vos outils, pas à côté",
        description:
          "Le workflow lit et écrit directement dans votre CRM, votre ERP, vos boîtes mail et vos calendriers existants, sans ressaisie ni double saisie entre logiciels.",
      },
      {
        title: "Des seuils conditionnels que l'IA sait arbitrer",
        description:
          "Au-delà du si-alors rigide, le workflow applique vos règles métier — montant au-dessus d'un plafond, client sensible, pièce manquante, écart hors tolérance — et bascule sur le bon embranchement sans figer le flux.",
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
        label: "Premier flux orchestré en production",
      },
      {
        number: "3-6",
        suffix: "flux",
        label: "Processus orchestrés par projet typique",
      },
      {
        number: "100",
        suffix: "%",
        label: "Étapes journalisées et auditables",
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
  },
  structuration: {
    benefits: [
      {
        title: "Des données prêtes à exploiter",
        description:
          "Vos emails, PDF, contrats et factures deviennent du JSON propre et normalisé, directement consommable par vos outils et vos cas IA.",
      },
      {
        title: "Extraction fiable, pas approximative",
        description:
          "Chaque champ extrait passe un contrôle qualité (règles métier, scoring de confiance, revue humaine sur les cas douteux) avant d'être validé.",
      },
      {
        title: "Le socle data de vos futurs projets IA",
        description:
          "En structurant vos données en amont, vous évitez l'effet « garbage in, garbage out » qui fait dérailler la plupart des projets IA mal préparés.",
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
        label: "Pipeline de parsing opérationnel",
      },
      {
        number: "100%",
        suffix: "",
        label: "Champs sortis en JSON normalisé et documenté",
      },
      {
        number: "95%+",
        suffix: "",
        label: "Taux d'extraction visé sur formats stables",
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
  },
  "crm-erp": {
    benefits: [
      {
        title: "Aucune migration de votre CRM/ERP",
        description:
          "L'IA se greffe sur Salesforce, HubSpot, Sage, Cegid ou Microsoft Dynamics via leurs API, sans refonte ni changement d'outil pour vos commerciaux. Votre instance et vos process restent en place.",
      },
      {
        title: "Scoring et prévisions à partir de votre historique",
        description:
          "Leads scorés, probabilité de closing et estimation de date calculées sur vos propres deals gagnés et perdus, pas sur un modèle générique. La matière commerciale est déjà dans votre système, on l'exploite.",
      },
      {
        title: "Fiches enrichies et synthèses sans ressaisie",
        description:
          "Champs contacts complétés automatiquement et comptes-rendus d'opportunités générés puis réinjectés dans les bons champs, pour que vos commerciaux passent moins de temps à documenter le pipeline.",
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
        number: "4-8",
        suffix: "sem",
        label: "Du cadrage au premier cas commercial branché",
      },
      {
        number: "5",
        suffix: "CRM/ERP",
        label: "Salesforce, HubSpot, Sage, Cegid, Dynamics",
      },
      {
        number: "0",
        suffix: "migration",
        label: "Votre instance commerciale est conservée",
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
  },
  documents: {
    benefits: [
      {
        title: "Documents produits à partir de vos données",
        description:
          "Devis, contrats et comptes-rendus générés à partir de vos templates et de vos données métier, prêts à relire au lieu d'être rédigés de zéro.",
      },
      {
        title: "Lecture automatique des pièces entrantes",
        description:
          "Factures, formulaires et courriers reçus sont lus par l'IA pour en extraire les champs clés et les classer sans ressaisie manuelle.",
      },
      {
        title: "Recherche par le sens dans vos archives",
        description:
          "Un moteur sémantique interroge votre corpus interne par l'intention, pas par mots-clés, pour retrouver la bonne clause ou le bon dossier en quelques secondes.",
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
        label: "Génération + extraction en production",
      },
      {
        number: "2",
        suffix: "flux",
        label: "Production et lecture documentaire couvertes",
      },
      {
        number: "PDF",
        suffix: "+ bureautique",
        label: "Formats lus en entrée et produits en sortie",
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
  },
  agents: {
    benefits: [
      {
        title: "Plusieurs étapes enchaînées en autonomie",
        description:
          "Un agent recherche, synthétise puis agit sur vos systèmes sans relance, là où un assistant rend une réponse et s'arrête.",
      },
      {
        title: "Garde-fous explicites sur chaque action",
        description:
          "Périmètre d'accès borné, actions sensibles soumises à validation, point d'arrêt humain : vous définissez ce que l'agent peut déclencher seul avant tout déploiement.",
      },
      {
        title: "Mono ou multi-agents selon le workflow",
        description:
          "Un agent unique pour une tâche cadrée, ou plusieurs agents spécialisés qui se coordonnent sur la prospection, le support ou la veille.",
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
        label: "Du cadrage au premier agent en production",
      },
      {
        number: "100",
        suffix: "%",
        label: "Décisions de l'agent journalisées et auditables",
      },
      {
        number: "1-N",
        suffix: "agents",
        label: "Architecture mono ou multi-agents coordonnée",
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
  },
  integrations: {
    benefits: [
      {
        title: "L'IA arrive dans vos canaux de travail existants",
        description:
          "Vos modèles et automatisations s'invoquent directement depuis Slack, Teams, Notion, Airtable ou Google Workspace, sans imposer un nouvel outil ni changer les habitudes des équipes.",
      },
      {
        title: "Des connecteurs en code clair, pas une boîte noire",
        description:
          "Chaque intégration est un connecteur custom raccordé à vos APIs, avec endpoints, authentification et logs documentés : la plomberie reste lisible et maintenable côté SI.",
      },
      {
        title: "Rate limits et budget de tokens sous contrôle",
        description:
          "Gestion native des limites de taux des APIs, du quota par flux et du budget de tokens, avec alerting, pour éviter les dépassements et les factures surprises.",
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
        label: "Connecteurs courants branchés (Slack, Teams, Notion, Airtable, Workspace, mail)",
      },
      {
        number: "3-6",
        suffix: "sem",
        label: "Premier connecteur en production (indicatif)",
      },
      {
        number: "100",
        suffix: "%",
        label: "Contrats d'API et code des connecteurs documentés côté client",
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
  },
  "no-code": {
    benefits: [
      {
        title: "L'IA greffée sur vos scénarios existants",
        description:
          "Nous insérons des étapes IA dans vos automatisations n8n, Make, Zapier, Bubble ou Airtable déjà en place, sans reconstruire vos scénarios ni bousculer les habitudes de votre équipe.",
      },
      {
        title: "Des appels modèle cadrés dans l'éditeur",
        description:
          "Prompts versionnés, garde-fous et gestion d'erreurs directement dans vos modules no-code : l'IA reste lisible et modifiable par les personnes qui pilotent déjà ces outils.",
      },
      {
        title: "Une porte de sortie quand l'éditeur coince",
        description:
          "Le jour où les quotas ou les tarifs de la plateforme deviennent un frein, nous avons documenté la logique de vos flows pour la basculer en code custom sans tout réécrire.",
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
        number: "5",
        suffix: "outils",
        label: "n8n, Make, Zapier, Bubble, Airtable",
      },
      {
        number: "2-4",
        suffix: "sem",
        label: "Flows no-code outillés en IA",
      },
      {
        number: "0",
        suffix: "réécriture",
        label: "Logique documentée et reprenable",
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
  },
};
