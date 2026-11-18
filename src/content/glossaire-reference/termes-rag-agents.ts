import type { TermeSource } from "./types";

/** Connaissance de l'entreprise (RAG) et agents. */
export const TERMES_RAG_AGENTS: readonly TermeSource[] = [
  {
    slug: "rag",
    term: "RAG (génération augmentée par la recherche)",
    category: "rag",
    aliases: ["Retrieval-Augmented Generation", "génération augmentée par récupération", "RAG"],
    related: ["embedding", "vector-database", "chunking", "hallucination", "base-de-connaissances"],
    definition:
      "Le RAG (Retrieval-Augmented Generation, ou génération augmentée par la recherche) est une méthode qui consiste à retrouver d'abord les passages utiles dans les documents d'une entreprise, puis à les fournir à un modèle de langage pour qu'il réponde en s'appuyant sur eux.",
    fonctionnement:
      "Vos documents sont découpés en extraits, transformés en représentations numériques et rangés dans une base de recherche. Quand une question arrive, le système retrouve les extraits les plus proches, les ajoute à la consigne, puis le modèle rédige une réponse en citant ces passages. Les documents restent chez vous et peuvent être mis à jour sans réentraîner le modèle.",
    exemple:
      "Une entreprise d'installation de panneaux solaires met ses notices, ses conditions de garantie et ses fiches techniques à disposition d'un assistant interne : un technicien pose une question et reçoit la réponse avec le document source.",
    limite:
      "Le RAG réduit les inventions mais ne les supprime pas. Si les documents sont périmés, contradictoires ou mal découpés, la réponse le sera aussi. La qualité de la base documentaire compte autant que le modèle.",
    offre: "automatisations",
  },
  {
    slug: "embedding",
    term: "Plongement (embedding)",
    category: "rag",
    aliases: ["embedding", "plongement lexical", "représentation vectorielle"],
    related: ["vectorisation", "vector-database", "semantic-search", "rag"],
    definition:
      "Un plongement (embedding) est une suite de nombres qui représente le sens d'un texte, d'une image ou d'un son, de telle sorte que deux contenus proches par le sens aient des suites de nombres proches.",
    fonctionnement:
      "Un modèle spécialisé lit un texte et le traduit en un long vecteur de nombres, comme des coordonnées dans un espace à très grand nombre de dimensions. « Facture impayée » et « règlement en retard » se retrouvent voisins, alors qu'ils ne partagent aucun mot. Cette propriété permet de chercher par le sens plutôt que par les mots exacts.",
    exemple:
      "Un cabinet d'architectes retrouve dans ses anciens dossiers ceux qui ressemblent à un nouveau projet de rénovation, même quand les documents n'emploient pas les mêmes termes que la demande.",
    limite:
      "Un plongement résume le sens de façon approximative : il peut rapprocher des textes qui se ressemblent mais qui disent l'inverse, comme une règle et son exception. Les cas critiques demandent un contrôle ou une recherche complémentaire par mots.",
    offre: "automatisations",
  },
  {
    slug: "vectorisation",
    term: "Vectorisation",
    category: "rag",
    aliases: ["vectorization", "encodage vectoriel", "calcul d'embeddings"],
    related: ["embedding", "vector-database", "chunking", "rag"],
    definition:
      "La vectorisation est l'opération qui transforme des documents en plongements numériques, afin de les enregistrer dans une base de recherche par le sens, préalable indispensable à un système de type RAG.",
    fonctionnement:
      "On découpe d'abord les documents en extraits, puis un modèle de plongement convertit chaque extrait en vecteur, enregistré avec son texte d'origine. L'opération se fait une fois, puis à chaque modification d'un document. Elle représente en général un coût modeste comparé au reste du projet, mais elle doit être refaite si l'on change de modèle de plongement.",
    exemple:
      "Un bureau d'études vectorise ses notes de calcul et ses comptes rendus de chantier pour que ses ingénieurs puissent ensuite poser des questions en langage courant sur cette base documentaire.",
    limite:
      "Vectoriser des documents confidentiels revient à les envoyer au fournisseur du modèle, sauf si on le fait en local. On vérifie donc les conditions d'usage, et l'on exclut les documents qui contiennent des données personnelles inutiles.",
    offre: "automatisations",
  },
  {
    slug: "vector-database",
    term: "Base vectorielle",
    category: "rag",
    aliases: ["base de données vectorielle", "vector database", "vector store"],
    related: ["embedding", "semantic-search", "rag", "hybrid-search", "chunking"],
    definition:
      "Une base vectorielle est une base de données spécialisée dans le stockage de plongements numériques et dans la recherche rapide des contenus dont le sens est le plus proche d'une question.",
    fonctionnement:
      "Chaque extrait de document y est conservé avec son vecteur. Lorsqu'une question arrive, elle est convertie en vecteur à son tour, et la base renvoie les extraits les plus proches en quelques instants, même parmi des millions. Cette recherche par proximité est la brique centrale des assistants qui répondent à partir de vos documents.",
    exemple:
      "Une entreprise de maintenance industrielle y range ses manuels d'équipements : un technicien décrit une panne avec ses propres mots et obtient les paragraphes de manuel les plus pertinents.",
    limite:
      "Une base vectorielle ne se suffit pas à elle-même : sans bon découpage des documents ni gestion des droits d'accès, elle peut remonter un contenu que la personne n'a pas à voir. La sécurité des accès fait partie du projet.",
    offre: "automatisations",
  },
  {
    slug: "semantic-search",
    term: "Recherche sémantique",
    category: "rag",
    aliases: ["semantic search", "recherche par le sens", "recherche vectorielle"],
    related: ["embedding", "vector-database", "hybrid-search", "bm25", "re-ranking"],
    definition:
      "La recherche sémantique est une méthode de recherche qui retrouve des contenus à partir de leur sens et non des seuls mots tapés, ce qui permet de trouver une réponse même si elle est formulée autrement que la question.",
    fonctionnement:
      "La question et les documents sont convertis en plongements. Le système calcule leur proximité et classe les documents du plus proche au plus éloigné. Une personne qui cherche « annuler un abonnement » peut ainsi retrouver une page titrée « résiliation de contrat ». C'est la base des moteurs de recherche internes modernes.",
    exemple:
      "Une mutuelle locale améliore la recherche de son site : un adhérent tape « rembourser lunettes » et obtient la page sur l'optique, même si le mot « lunettes » n'y figure pas.",
    limite:
      "La recherche par le sens est moins sûre pour les noms propres, les références ou les codes précis. On la combine donc avec une recherche classique par mots, ce qui donne une recherche hybride plus robuste.",
    offre: "automatisations",
  },
  {
    slug: "chunking",
    term: "Découpage en extraits (chunking)",
    category: "rag",
    aliases: ["chunking", "segmentation de documents", "découpage de documents"],
    related: ["rag", "embedding", "vector-database", "context-window"],
    definition:
      "Le découpage en extraits (chunking) consiste à diviser de longs documents en morceaux de taille raisonnable, afin de pouvoir les indexer et retrouver précisément le passage utile pour répondre à une question.",
    fonctionnement:
      "On découpe selon la structure du document, par titres ou paragraphes plutôt qu'à longueur fixe, et l'on garde un léger chevauchement pour ne pas couper une idée en deux. Chaque extrait est conservé avec son contexte, comme le titre du document ou sa date. Un bon découpage améliore nettement la pertinence des réponses.",
    exemple:
      "Un cabinet de conseil en ressources humaines découpe son règlement intérieur par article : l'assistant retrouve alors exactement l'article sur les congés, au lieu de ressortir tout le document.",
    limite:
      "Des extraits trop courts perdent leur contexte, trop longs ils noient l'information. Il n'existe pas de taille idéale universelle : on la règle en testant avec de vraies questions d'utilisateurs, et l'on y revient quand les documents changent.",
    offre: "automatisations",
  },
  {
    slug: "re-ranking",
    term: "Reclassement des résultats",
    category: "rag",
    aliases: ["re-ranking", "reranking", "réordonnancement"],
    related: ["semantic-search", "hybrid-search", "rag", "vector-database"],
    definition:
      "Le reclassement (re-ranking) est une étape qui réordonne les résultats d'une première recherche à l'aide d'un modèle plus fin, afin de placer en tête les extraits qui répondent le mieux à la question posée.",
    fonctionnement:
      "La première recherche, rapide, remonte par exemple une cinquantaine d'extraits plausibles. Un second modèle examine chaque couple « question et extrait », attribue une note de pertinence et ne garde que les meilleurs. Cette deuxième passe, plus lente mais plus précise, améliore la qualité des réponses d'un assistant documentaire.",
    exemple:
      "Un cabinet d'avocats qui interroge sa base de jurisprudence interne voit remonter en premier l'arrêt réellement lié à sa question, plutôt que dix décisions qui contiennent seulement les mêmes mots.",
    limite:
      "Cette étape ajoute un délai et un coût à chaque recherche. Elle ne corrige pas un mauvais corpus : si la bonne information n'est pas dans la première sélection, aucun reclassement ne pourra la retrouver.",
    offre: "automatisations",
  },
  {
    slug: "hybrid-search",
    term: "Recherche hybride",
    category: "rag",
    aliases: ["hybrid search", "recherche mixte", "recherche combinée"],
    related: ["semantic-search", "bm25", "re-ranking", "rag"],
    definition:
      "La recherche hybride combine une recherche par mots-clés et une recherche par le sens, puis fusionne leurs résultats, pour profiter de la précision de l'une et de la souplesse de l'autre.",
    fonctionnement:
      "La recherche par mots retrouve très bien les références exactes, comme un numéro de contrat ou un nom propre. La recherche sémantique retrouve les contenus de même sens, quels que soient les mots. Le système lance les deux, additionne leurs scores et propose une liste unifiée, souvent suivie d'un reclassement.",
    exemple:
      "Un fournisseur de pièces détachées permet à ses clients de chercher par référence exacte ou en décrivant la pièce avec leurs mots : les deux types de requêtes aboutissent à la bonne fiche.",
    limite:
      "La fusion demande des réglages : donner trop de poids à l'une des deux méthodes dégrade le résultat. On les ajuste sur un jeu de vraies questions, et l'on contrôle régulièrement que la qualité se maintient.",
    offre: "automatisations",
  },
  {
    slug: "bm25",
    term: "Recherche par mots-clés (BM25)",
    category: "rag",
    aliases: ["BM25", "recherche lexicale", "recherche par mots"],
    related: ["hybrid-search", "semantic-search", "rag", "vector-database"],
    definition:
      "BM25 est un algorithme classique de recherche par mots-clés qui classe les documents selon la présence et la rareté des mots de la question, et reste très utilisé, notamment dans les systèmes de recherche hybride.",
    fonctionnement:
      "Il compte combien de fois chaque mot de la requête apparaît dans un document, donne plus de poids aux mots rares, et tient compte de la longueur du texte. Il ne comprend pas le sens, mais il est rapide, simple et très fiable pour retrouver un nom, un code ou une expression exacte.",
    exemple:
      "Un cabinet comptable retrouve immédiatement tous les documents qui mentionnent un numéro de dossier précis, là où une recherche par le sens pourrait ramener des dossiers voisins.",
    limite:
      "BM25 rate les synonymes et les reformulations : chercher « voiture » ne retrouve pas « véhicule ». C'est pour cela qu'on l'associe à une recherche sémantique plutôt que de s'y limiter.",
    offre: "automatisations",
  },
  {
    slug: "base-de-connaissances",
    term: "Base de connaissances",
    category: "rag",
    aliases: ["knowledge base", "base documentaire", "corpus d'entreprise"],
    related: ["rag", "chunking", "vector-database", "assistant-ia", "chatbot"],
    definition:
      "Une base de connaissances est l'ensemble organisé des documents de référence d'une entreprise, comme procédures, fiches produits, réponses types et contrats, que l'on met à disposition des équipes ou d'un assistant IA.",
    fonctionnement:
      "Pour qu'un assistant s'en serve, les contenus doivent être à jour, clairs et sans doublons. On y associe une date, un propriétaire et un niveau d'accès. Un système de type RAG les interroge ensuite pour répondre aux questions. Le travail de tri et de mise à jour compte plus que l'outil lui-même.",
    exemple:
      "Une entreprise de services à la personne rassemble ses procédures d'intervention et ses réponses aux questions fréquentes : une nouvelle recrue obtient la bonne marche à suivre sans déranger sa responsable.",
    limite:
      "Une base laissée sans entretien devient trompeuse : l'IA répond avec assurance à partir d'un document périmé. Il faut désigner un responsable de la mise à jour et retirer ce qui n'est plus valable.",
    offre: "cartographie",
  },
  {
    slug: "agent",
    term: "Agent IA",
    category: "agents",
    aliases: ["AI agent", "agent autonome", "agent d'IA"],
    related: ["ia-agentique", "mcp", "tool-use", "function-calling", "human-in-the-loop"],
    definition:
      "Un agent IA est un programme qui s'appuie sur un modèle de langage pour poursuivre un objectif : il planifie des étapes, utilise des outils comme une messagerie, un agenda ou un logiciel de gestion, vérifie le résultat puis recommence si nécessaire.",
    fonctionnement:
      "Contrairement à un simple assistant qui répond à une question, un agent enchaîne plusieurs actions. Il reçoit un but, décide quel outil employer, observe ce qui se passe et ajuste sa suite. On lui donne des droits limités et des règles claires. Plus il agit seul, plus il faut prévoir de contrôles.",
    exemple:
      "Un agent d'un cabinet de dentistes lit les demandes de rendez-vous, propose des créneaux libres dans l'agenda et prépare la réponse, que la secrétaire valide avant l'envoi.",
    limite:
      "Un agent peut mal comprendre un but ou répéter une erreur à grande vitesse. Il faut limiter ses droits, journaliser ses actions et garder une validation humaine pour tout acte engageant, comme un paiement ou un envoi au client.",
    offre: "automatisations",
  },
  {
    slug: "ia-agentique",
    term: "IA agentique",
    category: "agents",
    aliases: ["agentic AI", "IA à base d'agents", "systèmes agentiques"],
    related: ["agent", "multi-agent", "mcp", "human-in-the-loop", "automatisation"],
    definition:
      "L'IA agentique désigne les systèmes d'IA conçus pour agir de façon autonome sur plusieurs étapes afin d'atteindre un objectif, en combinant raisonnement, outils et mémoire, plutôt que de se contenter de répondre à une question isolée.",
    fonctionnement:
      "On distingue un degré d'autonomie croissant : l'IA suggère, puis prépare, puis exécute avec validation, puis exécute seule dans un cadre défini. Chaque palier suppose des garde-fous plus solides : droits limités, journal des actions, seuils de validation humaine et possibilité d'arrêter le processus à tout moment.",
    exemple:
      "Une entreprise de négoce de matériaux laisse un système agentique traiter les commandes simples, de la lecture du bon à la création de la facture, et lui fait transmettre à une personne les cas inhabituels.",
    limite:
      "Le terme est très à la mode et recouvre des réalités variées, parfois de simples automatisations rebaptisées. Avant de confier des actions à une IA, on définit le périmètre, les droits et le niveau de contrôle humain.",
    offre: "automatisations",
  },
  {
    slug: "mcp",
    term: "MCP (Model Context Protocol)",
    category: "agents",
    aliases: ["Model Context Protocol", "protocole de contexte de modèle", "MCP"],
    related: ["agent", "tool-use", "function-calling", "api", "ia-agentique"],
    definition:
      "Le MCP (Model Context Protocol) est un standard ouvert qui permet à un assistant IA de se connecter de manière uniforme à des outils et à des sources de données externes, comme un agenda, une base de clients ou un dossier de documents.",
    fonctionnement:
      "Au lieu de développer une connexion sur mesure pour chaque outil et chaque IA, on installe un « serveur MCP » qui expose les fonctions d'un outil de façon standardisée. N'importe quel assistant compatible peut alors s'y brancher et les utiliser. On peut le comparer à une prise normalisée qui évite de refaire le câblage à chaque appareil.",
    exemple:
      "Un cabinet de gestion de patrimoine relie son assistant à son agenda et à son carnet de contacts par ce protocole, pour préparer le résumé des rendez-vous de la semaine.",
    limite:
      "Chaque connexion ouvre une porte sur vos données : il faut accorder le minimum de droits, vérifier la source des connecteurs que l'on installe et surveiller ce que l'assistant lit ou modifie. Une connexion installée sans contrôle est un risque.",
    offre: "automatisations",
  },
  {
    slug: "tool-use",
    term: "Utilisation d'outils",
    category: "agents",
    aliases: ["tool use", "appel d'outils", "usage d'outils par l'IA"],
    related: ["function-calling", "agent", "mcp", "api"],
    definition:
      "L'utilisation d'outils (tool use) est la capacité d'un modèle de langage à demander l'exécution d'une action extérieure, comme une recherche, un calcul ou la lecture d'un agenda, puis à se servir du résultat pour formuler sa réponse.",
    fonctionnement:
      "Le modèle ne fait pas lui-même l'action : il indique quel outil il souhaite appeler et avec quels paramètres. Le logiciel qui l'entoure l'exécute, puis lui renvoie le résultat. Le modèle poursuit ensuite son raisonnement. C'est ce mécanisme qui lui permet de dépasser la simple conversation et d'agir sur les systèmes de l'entreprise.",
    exemple:
      "Un assistant d'un garage consulte le planning de l'atelier pour répondre à un client qui demande la prochaine disponibilité, au lieu de deviner une date.",
    limite:
      "Un outil mal borné donne trop de pouvoir : un assistant qui peut supprimer des fichiers finira par en supprimer. On limite donc chaque outil à ce qui est nécessaire, et l'on exige une confirmation pour les actions irréversibles.",
    offre: "automatisations",
  },
  {
    slug: "function-calling",
    term: "Appel de fonctions",
    category: "agents",
    aliases: ["function calling", "appel de fonction", "sortie structurée"],
    related: ["tool-use", "api", "agent", "mcp"],
    definition:
      "L'appel de fonctions (function calling) est un mécanisme par lequel un modèle de langage, au lieu de répondre par du texte libre, produit une demande structurée destinée à un logiciel, avec le nom de la fonction à lancer et ses paramètres.",
    fonctionnement:
      "Le développeur décrit au modèle les fonctions disponibles, par exemple « créer un rendez-vous » avec une date et un nom. À la lecture d'une demande, le modèle renvoie une instruction précise, comme « créer un rendez-vous au nom de Martin mardi à dix heures ». Le logiciel la vérifie puis l'exécute.",
    exemple:
      "Dans une boutique en ligne, un client écrit « je veux changer l'adresse de ma commande ». Le modèle prépare l'instruction correspondante, que le logiciel valide avant de modifier la commande.",
    limite:
      "Le modèle peut se tromper de fonction ou de paramètre. Le logiciel doit donc vérifier chaque demande avant de l'exécuter, et ne jamais accorder au modèle plus de droits que nécessaire, surtout pour les montants et les données de clients.",
    offre: "automatisations",
  },
  {
    slug: "react-pattern",
    term: "Boucle raisonner-agir (ReAct)",
    category: "agents",
    aliases: ["ReAct", "Reason and Act", "boucle d'agent"],
    related: ["agent", "chain-of-thought", "tool-use", "ia-agentique"],
    definition:
      "ReAct (Reason and Act) est une méthode de conception d'agents où le modèle alterne explicitement entre une phase de réflexion et une phase d'action, en observant le résultat de chaque action avant de décider de la suivante.",
    fonctionnement:
      "À chaque tour, le modèle écrit ce qu'il pense devoir faire, choisit un outil, l'utilise, puis lit le retour. Il décide ensuite s'il a assez d'éléments pour répondre ou s'il doit poursuivre. Cette alternance limite les erreurs de planification et rend la démarche plus lisible pour la personne qui contrôle.",
    exemple:
      "Un assistant de cabinet de recrutement cherche d'abord une offre dans la base interne, constate qu'elle est incomplète, interroge alors l'agenda du consultant, puis rédige un message de relance au candidat.",
    limite:
      "Plus la boucle compte d'étapes, plus les erreurs peuvent s'accumuler, et plus le coût augmente. On fixe donc un nombre maximal d'étapes et l'on journalise chaque tour pour comprendre ce qui s'est passé en cas de problème.",
    offre: "automatisations",
  },
  {
    slug: "multi-agent",
    term: "Système multi-agents",
    category: "agents",
    aliases: ["multi-agent", "équipe d'agents", "agents collaboratifs"],
    related: ["agent", "swarm", "ia-agentique", "human-in-the-loop"],
    definition:
      "Un système multi-agents est une organisation où plusieurs agents IA, chacun spécialisé dans un rôle, collaborent pour accomplir une tâche trop vaste ou trop variée pour un seul agent.",
    fonctionnement:
      "Un agent coordinateur répartit le travail : l'un cherche l'information, un autre rédige, un troisième relit. Chacun dispose de consignes et d'outils propres, ce qui limite les erreurs de chacun. En contrepartie, le système est plus complexe à surveiller et consomme davantage de ressources qu'un agent unique.",
    exemple:
      "Une agence de communication utilise un agent qui rassemble les informations sur un client, un deuxième qui propose un plan de contenus et un troisième qui relit le ton, le tout supervisé par la chargée de projet.",
    limite:
      "Multiplier les agents multiplie aussi les points de panne et les coûts. Pour beaucoup de besoins de PME, un agent unique ou une simple automatisation suffit. On complexifie seulement quand le gain est démontré.",
    offre: "cartographie",
  },
  {
    slug: "swarm",
    term: "Essaim d'agents (swarm)",
    category: "agents",
    aliases: ["swarm", "essaim", "agents en parallèle"],
    related: ["multi-agent", "agent", "throughput", "ia-agentique"],
    definition:
      "Un essaim d'agents (swarm) est un type de système multi-agents où de nombreux agents travaillent en parallèle sur des parties indépendantes d'une même tâche, avant que leurs résultats soient rassemblés.",
    fonctionnement:
      "On découpe un gros chantier en petites unités, par exemple une centaine de documents à analyser, et chaque agent en traite une. Les résultats sont ensuite fusionnés par un agent de synthèse. Cette parallélisation accélère fortement le traitement, au prix d'une facture proportionnelle au nombre d'agents lancés.",
    exemple:
      "Un cabinet d'audit qui doit examiner de nombreux contrats de fournisseurs en fait lire chacun par un agent distinct, puis un collaborateur contrôle la synthèse des points d'attention.",
    limite:
      "L'essaim convient aux tâches vraiment indépendantes. Sinon, les agents se contredisent ou refont le même travail. Il faut aussi plafonner le nombre d'agents et le budget, pour qu'une erreur de lancement ne devienne pas une grosse dépense.",
    offre: "automatisations",
  },
  {
    slug: "human-in-the-loop",
    term: "Humain dans la boucle",
    category: "agents",
    aliases: ["human in the loop", "validation humaine", "contrôle humain"],
    related: ["agent", "ia-agentique", "gouvernance-ia", "guardrails", "hallucination"],
    definition:
      "L'humain dans la boucle est un principe de conception selon lequel une personne vérifie, corrige ou valide les productions et les décisions d'un système d'IA avant qu'elles aient des conséquences.",
    fonctionnement:
      "On décide, pour chaque tâche, à quel moment la personne intervient : avant l'envoi d'un message, avant un paiement, en cas de doute du système ou par contrôle d'un échantillon. Ce contrôle suppose que la personne dispose du temps, de la compétence et du pouvoir de dire non, sinon il n'est que de façade.",
    exemple:
      "Dans une entreprise de transport, l'IA prépare les réponses aux réclamations clients, et la responsable du service les relit avant envoi lorsqu'un remboursement ou une faute est en cause.",
    limite:
      "Un contrôle trop systématique finit par être fait en survolant, et il n'apporte plus rien. Mieux vaut cibler les validations sur les décisions importantes et former les personnes à repérer les erreurs typiques de l'IA.",
    offre: "formations",
  },
  {
    slug: "guardrails",
    term: "Garde-fous",
    category: "security",
    aliases: ["guardrails", "barrières de sécurité", "filtres de sécurité"],
    related: ["system-prompt", "prompt-injection", "human-in-the-loop", "pii-detection", "charte-ia"],
    definition:
      "Les garde-fous (guardrails) sont l'ensemble des règles et des contrôles, techniques ou organisationnels, qui encadrent ce qu'un système d'IA peut dire ou faire : sujets interdits, données masquées, validations et plafonds d'action.",
    fonctionnement:
      "Ils agissent à plusieurs niveaux : consignes données au modèle, filtres qui vérifient les entrées et les sorties, droits d'accès restreints aux outils et aux données, journal des actions et alertes. Aucun garde-fou n'est parfait seul : leur combinaison réduit le risque sans l'annuler.",
    exemple:
      "Un assistant de site pour un cabinet de conseil refuse de donner un avis juridique, ne communique jamais de prix et oriente toute demande sensible vers un conseiller humain.",
    limite:
      "Les garde-fous donnent un faux sentiment de sécurité s'ils ne sont jamais testés. Il faut les éprouver régulièrement avec des demandes piégées, et les mettre à jour quand l'outil ou les usages changent.",
    offre: "automatisations",
  },
  {
    slug: "api",
    term: "API (interface de programmation)",
    category: "agents",
    aliases: ["API", "interface de programmation", "application programming interface"],
    related: ["webhook", "automatisation", "function-calling", "mcp", "rate-limit"],
    definition:
      "Une API (interface de programmation) est une porte d'entrée normalisée par laquelle un logiciel peut en solliciter un autre : lui envoyer une demande et recevoir une réponse, sans passer par un écran.",
    fonctionnement:
      "Le fournisseur publie les demandes possibles et le format attendu. Le logiciel appelant s'identifie avec une clé secrète, envoie sa demande puis lit la réponse. C'est ainsi qu'un site peut afficher la météo, qu'un outil de facturation envoie une écriture à la comptabilité ou qu'une application interroge un modèle d'IA.",
    exemple:
      "Une boutique en ligne relie son outil de commandes à son logiciel de livraison par une API : chaque nouvelle commande crée automatiquement l'étiquette d'expédition, sans ressaisie.",
    limite:
      "La clé d'accès est un secret : si elle fuit, d'autres peuvent utiliser le service à vos frais. Elle ne se place jamais dans un message, un document partagé ou un site public, et l'on prévoit sa rotation en cas de doute.",
    offre: "automatisations",
  },
  {
    slug: "webhook",
    term: "Webhook",
    category: "agents",
    aliases: ["webhook", "rappel web", "notification automatique"],
    related: ["api", "automatisation", "workflow", "rpa"],
    definition:
      "Un webhook est un mécanisme par lequel un logiciel prévient automatiquement un autre logiciel dès qu'un événement se produit, comme un paiement reçu ou un formulaire rempli, sans que celui-ci ait besoin de le demander sans cesse.",
    fonctionnement:
      "On indique au premier logiciel une adresse web à appeler. Quand l'événement survient, il y envoie un court message contenant les informations utiles. Le second logiciel réagit aussitôt : il crée une fiche, envoie un e-mail ou lance un traitement. C'est le déclencheur le plus courant des automatisations.",
    exemple:
      "Un cabinet d'ostéopathes relie son formulaire de prise de rendez-vous à son agenda et à son logiciel de rappel : dès qu'un patient réserve, tout se met à jour sans intervention.",
    limite:
      "Un webhook non protégé peut être déclenché par n'importe qui qui connaît l'adresse. On vérifie donc l'expéditeur par une signature, et l'on prévoit le cas où le message est reçu deux fois ou n'arrive pas.",
    offre: "automatisations",
  },
];
