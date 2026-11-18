import type { TermeSource } from "./types";

/** Usages concrets en entreprise, outils du quotidien et visibilité dans les moteurs. */
export const TERMES_USAGES_VISIBILITE: readonly TermeSource[] = [
  {
    slug: "automatisation",
    term: "Automatisation",
    category: "usages",
    aliases: ["automatisation des tâches", "automation", "automatisation des processus"],
    related: ["workflow", "rpa", "no-code", "api", "ia-agentique"],
    definition:
      "L'automatisation consiste à confier à un logiciel l'exécution de tâches répétitives qui étaient faites à la main, selon des règles définies à l'avance, comme recopier des informations, envoyer un message ou créer une fiche.",
    fonctionnement:
      "On part d'un déclencheur, par exemple l'arrivée d'un e-mail ou d'une commande, puis on enchaîne des étapes : lire, classer, enregistrer, notifier. L'IA ajoute la capacité de traiter des contenus peu structurés, comme un texte libre. Une automatisation bien conçue prévoit les cas d'erreur et laisse une trace de ce qu'elle a fait.",
    exemple:
      "Un cabinet de kinésithérapie envoie automatiquement un rappel la veille de chaque rendez-vous et signale à la secrétaire les patients qui répondent par une demande de report.",
    limite:
      "Automatiser un processus mal conçu ne fait que l'accélérer. Il vaut mieux clarifier la tâche d'abord, commencer par un cas simple et fréquent, puis surveiller les résultats, car une règle oubliée peut répéter la même erreur cent fois.",
    offre: "automatisations",
  },
  {
    slug: "rpa",
    term: "RPA (automatisation robotisée des processus)",
    category: "usages",
    aliases: ["RPA", "Robotic Process Automation", "robot logiciel"],
    related: ["automatisation", "workflow", "no-code", "ocr"],
    definition:
      "La RPA (Robotic Process Automation) est une technologie qui reproduit les gestes qu'une personne fait sur un écran, comme cliquer, copier ou saisir, pour automatiser des tâches dans des logiciels qui n'offrent pas de connexion directe.",
    fonctionnement:
      "Un « robot » logiciel suit un scénario enregistré : il ouvre une application, lit une information, la saisit dans une autre, valide. Il suit des règles strictes et ne s'adapte pas seul aux imprévus. L'IA peut le compléter pour lire des documents ou comprendre un message avant de lui confier l'étape suivante.",
    exemple:
      "Une entreprise de maintenance recopie chaque soir les bons d'intervention de son outil de terrain vers son logiciel de facturation, une opération longue que le robot réalise sans erreur de frappe.",
    limite:
      "Ce type de robot casse dès que l'écran change, par exemple après une mise à jour. Quand le logiciel propose une connexion directe, mieux vaut l'utiliser. La RPA reste une solution de dépannage pour les outils fermés.",
    offre: "automatisations",
  },
  {
    slug: "no-code",
    term: "No-code (sans code)",
    category: "usages",
    aliases: ["no-code", "low-code", "sans code", "outils sans programmation"],
    related: ["automatisation", "workflow", "api", "webhook"],
    definition:
      "Le no-code (ou « sans code ») désigne les outils qui permettent de créer une application ou une automatisation en assemblant des blocs visuels, sans écrire de programme, ce qui les rend accessibles aux équipes non techniques.",
    fonctionnement:
      "On relie par glisser-déposer des déclencheurs, des actions et des conditions : « quand un formulaire est rempli, créer une fiche, envoyer un e-mail, prévenir l'équipe ». Ces plateformes se branchent à de nombreux logiciels par des connecteurs prêts à l'emploi. Le low-code laisse en plus la possibilité d'ajouter quelques lignes de code.",
    exemple:
      "Une gérante de boutique relie son site de vente, son tableur de stock et sa messagerie : chaque commande met à jour le stock et prévient automatiquement le fournisseur quand un article manque.",
    limite:
      "Ces outils séduisent par leur rapidité, mais un assemblage non documenté devient vite difficile à maintenir. Le coût peut monter avec le volume, et l'on dépend de la plateforme. Il faut garder une description claire de chaque scénario.",
    offre: "automatisations",
  },
  {
    slug: "workflow",
    term: "Flux de travail (workflow)",
    category: "usages",
    aliases: ["workflow", "processus automatisé", "enchaînement d'étapes"],
    related: ["automatisation", "no-code", "webhook", "human-in-the-loop"],
    definition:
      "Un flux de travail (workflow) est la suite ordonnée d'étapes, avec leurs responsables et leurs conditions, par laquelle passe une tâche pour être menée à bien, de son déclenchement jusqu'à son résultat.",
    fonctionnement:
      "On le représente comme un schéma : une demande arrive, on la classe, une personne ou un outil la traite, on contrôle, on envoie le résultat. Chaque étape peut être manuelle ou automatique, et certaines exigent une validation. Dessiner le flux avant d'automatiser permet de repérer les doublons, les attentes inutiles et les points de blocage.",
    exemple:
      "Dans une société de travaux, une demande de devis passe par la réception, le chiffrage, la validation par le gérant, puis l'envoi au client. L'IA prépare le brouillon, le gérant garde la validation.",
    limite:
      "Un flux trop rigide ne gère pas les exceptions, et un flux trop complexe n'est plus compris de personne. On vise des étapes peu nombreuses, un responsable clair pour chacune et une voie de sortie pour les cas inhabituels.",
    offre: "automatisations",
  },
  {
    slug: "chatbot",
    term: "Chatbot (agent conversationnel)",
    category: "usages",
    aliases: ["chatbot", "agent conversationnel", "robot de discussion", "bot"],
    related: ["assistant-ia", "rag", "system-prompt", "guardrails", "base-de-connaissances"],
    definition:
      "Un chatbot est un programme qui dialogue avec une personne par écrit, ou parfois à l'oral, pour répondre à ses questions ou l'aider à accomplir une démarche, en général sur un site web, une application de messagerie ou un téléphone.",
    fonctionnement:
      "Les premiers chatbots suivaient des scénarios fixes, avec des boutons et des réponses prévues d'avance. Les chatbots récents s'appuient sur un modèle de langage et, souvent, sur les documents de l'entreprise pour répondre en langage libre. Ils transmettent à un humain les demandes qu'ils ne savent pas traiter.",
    exemple:
      "Le site d'une auto-école répond aux questions sur les horaires, les formules et les pièces à fournir, puis propose de laisser ses coordonnées pour être rappelé par une secrétaire.",
    limite:
      "Un chatbot qui invente une réponse engage l'image de l'entreprise, parfois sa responsabilité. Il faut le limiter à des sujets qu'il maîtrise, indiquer qu'il s'agit d'une IA et toujours proposer un contact humain.",
    offre: "automatisations",
  },
  {
    slug: "assistant-ia",
    term: "Assistant IA",
    category: "usages",
    aliases: ["assistant virtuel", "assistant intelligent", "AI assistant"],
    related: ["chatbot", "copilote", "prompt", "agent", "llm"],
    definition:
      "Un assistant IA est un outil fondé sur l'intelligence artificielle qui aide une personne dans son travail en répondant à ses demandes : rédiger, résumer, chercher, traduire, analyser ou préparer des documents.",
    fonctionnement:
      "On lui écrit ou on lui parle en langage courant, il produit une proposition que l'utilisateur relit et corrige. Selon sa configuration, il peut avoir accès à des documents ou à des outils de l'entreprise. Il reste sous le contrôle de la personne, qui décide de ce qui est utilisé, envoyé ou enregistré.",
    exemple:
      "Une responsable d'un cabinet d'architecture demande à son assistant de résumer un long courrier de la mairie et de lister les pièces à fournir, puis vérifie la liste avec le courrier original.",
    limite:
      "Un assistant gagne du temps sur les premiers jets, mais il ne remplace pas la responsabilité de la personne. Il faut relire, vérifier les faits et rester vigilant sur les données que l'on lui confie.",
    offre: "formations",
  },
  {
    slug: "copilote",
    term: "Copilote IA",
    category: "usages",
    aliases: ["copilot", "copilote", "assistant intégré aux logiciels"],
    related: ["assistant-ia", "gemini-google", "agent", "shadow-ai"],
    definition:
      "Un copilote IA est un assistant intégré directement dans un logiciel du quotidien, comme un traitement de texte, un tableur, une messagerie ou un outil de gestion, qui aide l'utilisateur sans qu'il quitte son application.",
    fonctionnement:
      "Il a accès au contenu du logiciel dans lequel il se trouve, et parfois à d'autres documents de l'entreprise, selon les droits de l'utilisateur. Il propose de résumer un fil de messages, de rédiger une réponse ou d'analyser un tableau. Le terme « copilote » rappelle que c'est la personne qui reste aux commandes.",
    exemple:
      "Dans une entreprise de services, une assistante de direction demande au copilote de sa messagerie de résumer les échanges de la semaine avec un fournisseur avant une réunion.",
    limite:
      "Un copilote voit tout ce que l'utilisateur voit : si les droits d'accès aux documents sont mal réglés, il peut faire remonter des informations qui ne devraient pas circuler. Il faut revoir les permissions avant de l'activer.",
    offre: "formations",
  },
  {
    slug: "ocr",
    term: "OCR (reconnaissance de caractères)",
    category: "usages",
    aliases: ["OCR", "reconnaissance optique de caractères", "lecture de documents"],
    related: ["vision-par-ordinateur", "automatisation", "pii-detection", "vision-multimodal"],
    definition:
      "L'OCR (reconnaissance optique de caractères) est une technologie qui lit le texte présent sur une image ou un document scanné, comme une facture, une carte d'identité ou un formulaire, et le transforme en texte utilisable par un logiciel.",
    fonctionnement:
      "Le logiciel repère les zones de texte, identifie les lettres et les chiffres, puis restitue le contenu. Les outils actuels s'appuient sur l'IA pour mieux lire les écritures variées, les mises en page complexes et les photos prises de travers. Ils peuvent ensuite extraire les champs utiles : date, montant, fournisseur.",
    exemple:
      "Un cabinet d'expertise comptable photographie les tickets et les factures de ses clients, et l'outil en extrait automatiquement la date, le fournisseur et le total, que la collaboratrice contrôle.",
    limite:
      "Une lecture n'est jamais parfaite : un 5 peut devenir un 6 sur une photo floue. Pour les montants et les identifiants, un contrôle, au moins par échantillon, reste nécessaire, et les documents contenant des données personnelles sont à protéger.",
    offre: "automatisations",
  },
  {
    slug: "transcription",
    term: "Transcription automatique",
    category: "usages",
    aliases: ["reconnaissance vocale", "speech-to-text", "voix vers texte", "dictée"],
    related: ["synthese-vocale", "nlp", "donnee-personnelle", "assistant-ia"],
    definition:
      "La transcription automatique est la conversion d'un enregistrement audio ou vidéo en texte écrit par un logiciel de reconnaissance vocale, sans saisie manuelle.",
    fonctionnement:
      "Le logiciel découpe le son en petits segments, reconnaît les mots puis reconstitue des phrases ponctuées. Certains outils distinguent aussi les interlocuteurs et ajoutent des horodatages. Le texte obtenu peut ensuite être résumé par un modèle de langage pour produire un compte rendu structuré de la réunion.",
    exemple:
      "Un syndic de copropriété enregistre ses assemblées, obtient la retranscription puis un projet de procès-verbal, qu'un gestionnaire corrige avant diffusion aux copropriétaires.",
    limite:
      "Les accents, le bruit de fond et les termes techniques provoquent des erreurs. Enregistrer des personnes demande de les informer, et parfois leur accord. Le texte produit est à relire avant toute diffusion.",
    offre: "automatisations",
  },
  {
    slug: "synthese-vocale",
    term: "Synthèse vocale",
    category: "usages",
    aliases: ["text-to-speech", "voix de synthèse", "TTS", "voix artificielle"],
    related: ["transcription", "hypertrucage", "chatbot", "ia-generative"],
    definition:
      "La synthèse vocale est la production automatique d'une voix parlée à partir d'un texte écrit, par un logiciel capable d'imiter le rythme et l'intonation d'une voix humaine.",
    fonctionnement:
      "Les voix actuelles, fondées sur l'IA, sont beaucoup plus naturelles que les anciennes voix robotiques. On peut choisir une langue, un ton et un débit. Certains services sont capables de reproduire une voix précise à partir d'un court enregistrement, ce qui exige le consentement de la personne concernée.",
    exemple:
      "Un office de tourisme local ajoute à son site une version audio de ses pages d'information pour les visiteurs malvoyants, et prévient clairement qu'il s'agit d'une voix artificielle.",
    limite:
      "Imiter la voix de quelqu'un sans son accord est risqué, sur le plan juridique comme sur celui de la confiance. Il faut aussi relire le texte, car la voix prononce les erreurs avec la même assurance que le reste.",
    offre: "automatisations",
  },
  {
    slug: "vision-par-ordinateur",
    term: "Vision par ordinateur",
    category: "usages",
    aliases: ["computer vision", "reconnaissance d'images", "analyse d'images"],
    related: ["ocr", "vision-multimodal", "deep-learning", "edge-deployment"],
    definition:
      "La vision par ordinateur est le domaine de l'IA qui permet à une machine d'analyser des images ou des vidéos pour y reconnaître des objets, des personnes, des textes, des défauts ou des situations.",
    fonctionnement:
      "Des modèles entraînés sur de nombreux exemples apprennent à repérer des formes et des motifs : un défaut de peinture, un produit sur un rayon, une plaque d'immatriculation. Ils attribuent à chaque image une étiquette ou une position. Les usages vont du contrôle qualité à la lecture de documents et à la surveillance.",
    exemple:
      "Un atelier de fabrication de meubles photographie chaque pièce en fin de ligne, et l'outil signale les rayures visibles, qu'un opérateur vient ensuite vérifier.",
    limite:
      "Analyser des personnes, notamment par reconnaissance faciale, soulève de lourds enjeux juridiques et éthiques. Même pour les objets, les conditions de lumière ou d'angle différentes de l'entraînement dégradent les résultats : il faut tester sur place.",
    offre: "cartographie",
  },
  {
    slug: "geo",
    term: "GEO (optimisation pour les moteurs génératifs)",
    category: "visibilite",
    aliases: ["GEO", "Generative Engine Optimization", "optimisation pour les moteurs génératifs"],
    related: ["aeo", "ia-et-seo", "llm", "rag"],
    definition:
      "Le GEO (Generative Engine Optimization) est l'ensemble des pratiques qui visent à rendre le contenu d'une entreprise compréhensible, fiable et citable par les assistants d'IA, comme ChatGPT, Perplexity ou Le Chat de Mistral, lorsqu'ils répondent à une question.",
    fonctionnement:
      "Ces assistants lisent le web, puis résument et citent quelques sources. Pour être retenu, un contenu doit répondre clairement à une question précise, être daté, signé, factuel et structuré, avec des définitions courtes et des données vérifiables. Les données structurées et un site rapide et accessible aident à être bien lu.",
    exemple:
      "Un cabinet de conseil local publie une page claire qui explique, en quelques phrases, ce qu'il fait, pour qui et comment, avec ses coordonnées et sa date de mise à jour, afin d'être cité correctement.",
    limite:
      "Personne ne contrôle ce que répondent les assistants, et aucun procédé ne garantit d'y être cité. Les recettes évoluent. La meilleure approche reste de produire un contenu utile, exact et à jour, plutôt que de chercher à manipuler les résultats.",
    offre: "cartographie",
  },
  {
    slug: "aeo",
    term: "AEO (optimisation pour les moteurs de réponse)",
    category: "visibilite",
    aliases: ["AEO", "Answer Engine Optimization", "optimisation pour les réponses directes"],
    related: ["geo", "ia-et-seo", "nlp", "base-de-connaissances"],
    definition:
      "L'AEO (Answer Engine Optimization) est la pratique qui consiste à structurer un contenu pour qu'il fournisse directement la réponse à une question, afin d'être repris par les moteurs de réponse, les assistants vocaux et les encadrés de résultats.",
    fonctionnement:
      "On formule la question telle qu'un internaute la poserait, puis on y répond dès les premières lignes, en une ou deux phrases autonomes. On développe ensuite avec des explications, des exemples et, si besoin, une liste. Un balisage adapté, comme les questions-réponses ou les définitions, aide les robots à repérer ces passages.",
    exemple:
      "Un magasin de bricolage rédige sur son site une page qui répond en deux phrases à la question « comment choisir une perceuse », puis détaille les critères avec des exemples d'usage.",
    limite:
      "L'AEO et le GEO se recoupent beaucoup, et leurs frontières restent floues. Répondre dans les premières lignes ne suffit pas : un contenu pauvre ou inexact ne sera pas retenu longtemps. L'AEO complète le travail de fond sur le contenu, il ne le remplace pas.",
    offre: "cartographie",
  },
  {
    slug: "ia-et-seo",
    term: "IA et référencement (SEO)",
    category: "visibilite",
    aliases: ["SEO et IA", "référencement et intelligence artificielle", "SEO"],
    related: ["geo", "aeo", "ia-generative", "hallucination"],
    definition:
      "L'IA en référencement naturel (SEO) désigne à la fois l'usage de l'IA pour produire et améliorer les contenus d'un site, et l'effet des réponses générées par IA sur la façon dont les internautes trouvent une entreprise.",
    fonctionnement:
      "Les moteurs de recherche affichent désormais des synthèses générées par IA au-dessus des résultats classiques. Ils valorisent les contenus utiles, fiables et rédigés pour les lecteurs, qu'ils soient écrits par une personne ou aidés par une IA. Publier en masse du texte automatique et sans valeur ajoutée est un risque pour la réputation du site.",
    exemple:
      "Une plombière-chauffagiste utilise l'IA pour structurer ses pages de services, mais ajoute elle-même ses photos de chantiers, ses zones d'intervention réelles et ses réponses aux questions fréquentes de ses clients.",
    limite:
      "L'IA accélère la rédaction, pas la crédibilité. Un site qui répète des généralités ou des contenus inventés perd la confiance des lecteurs comme des moteurs. Relecture, exactitude et expérience réelle restent décisives.",
    offre: "cartographie",
  },
];
