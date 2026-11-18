import type { TermeSource } from "./types";

/** Fondamentaux : vocabulaire de base de l'IA et des modèles de langage. */
export const TERMES_FONDAMENTAUX: readonly TermeSource[] = [
  {
    slug: "intelligence-artificielle",
    term: "Intelligence artificielle",
    category: "foundational",
    aliases: ["IA", "AI", "artificial intelligence"],
    related: ["machine-learning", "ia-generative", "llm", "deep-learning"],
    definition:
      "L'intelligence artificielle (IA) est un ensemble de techniques qui permettent à un logiciel d'accomplir des tâches que l'on associait à l'intelligence humaine : comprendre un texte, reconnaître une image, prévoir, recommander ou rédiger.",
    fonctionnement:
      "Une IA ne « pense » pas comme une personne. Elle repose le plus souvent sur des modèles mathématiques entraînés sur de très grandes quantités d'exemples. Ils repèrent des régularités, puis les appliquent à de nouvelles situations. Selon les cas, le résultat est une prédiction, une classification ou un texte produit en réponse à une consigne.",
    exemple:
      "Dans une entreprise de plomberie, une IA peut trier les demandes de dépannage reçues par e-mail, repérer les urgences et proposer un brouillon de réponse que la secrétaire relit avant l'envoi.",
    limite:
      "L'erreur fréquente consiste à croire qu'une IA comprend ou sait. Elle produit des réponses plausibles, parfois fausses. Mieux vaut la traiter comme un assistant rapide dont on vérifie le travail, surtout quand une décision engage l'entreprise.",
    offre: "journee-ia",
  },
  {
    slug: "machine-learning",
    term: "Apprentissage automatique",
    category: "foundational",
    aliases: ["machine learning", "ML", "apprentissage machine"],
    related: [
      "intelligence-artificielle",
      "deep-learning",
      "donnees-entrainement",
      "reseau-de-neurones",
    ],
    definition:
      "L'apprentissage automatique (machine learning) est une branche de l'IA où un programme apprend à partir d'exemples plutôt que de suivre des règles écrites une à une par un informaticien.",
    fonctionnement:
      "On fournit au programme beaucoup de cas déjà résolus, par exemple des factures avec leur catégorie. Il ajuste ses paramètres internes pour retrouver la bonne réponse, puis il applique ce qu'il a appris à des cas nouveaux. Plus les exemples sont nombreux et fiables, plus les résultats sont utiles.",
    exemple:
      "Un cabinet d'expertise comptable peut entraîner un modèle à classer automatiquement les justificatifs scannés par ses clients en familles de dépenses, puis faire contrôler les cas douteux par un collaborateur.",
    limite:
      "Un modèle d'apprentissage reproduit ce que contiennent ses exemples, y compris leurs erreurs et leurs oublis. Si les données de départ sont pauvres ou biaisées, le résultat le sera aussi. La qualité des données compte plus que la sophistication de l'outil.",
    offre: "cartographie",
  },
  {
    slug: "deep-learning",
    term: "Apprentissage profond",
    category: "foundational",
    aliases: ["deep learning", "apprentissage profond"],
    related: ["machine-learning", "reseau-de-neurones", "llm", "vision-par-ordinateur"],
    definition:
      "L'apprentissage profond (deep learning) est une famille de méthodes d'apprentissage automatique qui utilisent des réseaux de neurones à de nombreuses couches, capables d'apprendre seuls des représentations complexes à partir de textes, d'images ou de sons.",
    fonctionnement:
      "Chaque couche du réseau transforme l'information reçue de la précédente. Les premières couches repèrent des éléments simples, comme des contours ou des syllabes. Les suivantes les assemblent en notions plus riches, comme un visage ou le sens d'une phrase. Cet empilement demande beaucoup de données et de puissance de calcul.",
    exemple:
      "Un atelier de menuiserie peut utiliser un outil fondé sur l'apprentissage profond pour lire les cotes manuscrites d'un croquis photographié sur le chantier et les reporter dans son logiciel de devis.",
    limite:
      "On confond souvent apprentissage profond et IA en général. Il n'en est qu'une partie, très efficace pour le langage et l'image, mais coûteuse et peu explicable : il est difficile de dire pourquoi le modèle a donné telle réponse.",
    offre: "formations",
  },
  {
    slug: "reseau-de-neurones",
    term: "Réseau de neurones",
    category: "foundational",
    aliases: ["réseau neuronal", "neural network", "réseau de neurones artificiels"],
    related: ["deep-learning", "machine-learning", "llm", "donnees-entrainement"],
    definition:
      "Un réseau de neurones est un modèle mathématique, inspiré très librement du cerveau, composé de petites unités de calcul reliées entre elles qui transforment des données d'entrée en une réponse.",
    fonctionnement:
      "Chaque unité reçoit des nombres, les pondère, les additionne puis transmet le résultat à la suivante. Pendant l'entraînement, le réseau compare sa réponse à la bonne et corrige légèrement ces pondérations, des milliers ou des millions de fois. À la fin, ce sont ces pondérations, appelées paramètres, qui contiennent ce qu'il a appris.",
    exemple:
      "Une pharmacie d'officine peut s'appuyer sur un outil à réseau de neurones pour lire des ordonnances scannées et préremplir la saisie, la pharmacienne gardant la validation finale.",
    limite:
      "Le mot « neurones » prête à confusion : il s'agit de calcul, pas de biologie. Un réseau ne comprend rien au sens où nous l'entendons, et son fonctionnement interne reste difficile à expliquer à un client ou à un contrôleur.",
    offre: "journee-ia",
  },
  {
    slug: "ia-generative",
    term: "IA générative",
    category: "foundational",
    aliases: ["generative AI", "GenAI", "IA qui génère du contenu"],
    related: ["llm", "prompt", "hallucination", "modele-de-fondation", "assistant-ia"],
    definition:
      "L'IA générative est un type d'intelligence artificielle capable de produire un contenu nouveau, comme du texte, une image, un son, une vidéo ou du code, à partir d'une consigne écrite en langage courant.",
    fonctionnement:
      "Le modèle a été entraîné sur d'immenses volumes de contenus. Il y a appris les formes habituelles du langage ou de l'image. Quand on lui donne une consigne, il construit sa réponse pas à pas, en choisissant à chaque étape un élément parmi les plus probables (pour une image, en affinant progressivement un brouillon). Le résultat est calculé et, en général, pas recopié, même si des reprises très proches d'un contenu existant restent possibles.",
    exemple:
      "Une agence immobilière indépendante peut demander à un outil génératif un premier jet d'annonce à partir de la fiche du bien, puis le conseiller l'ajuste, corrige les détails et le publie.",
    limite:
      "Un contenu généré peut contenir des erreurs présentées avec assurance. Il faut donc relire, vérifier les faits et ne jamais déposer de données confidentielles dans un outil dont on ne connaît pas les conditions d'usage.",
    offre: "journee-ia",
  },
  {
    slug: "llm",
    term: "LLM (grand modèle de langage)",
    category: "foundational",
    aliases: ["Large Language Model", "modèle de langage", "grand modèle de langage"],
    related: ["tokens", "context-window", "inference", "fine-tuning", "slm"],
    definition:
      "Un LLM (Large Language Model, ou grand modèle de langage) est un modèle d'intelligence artificielle entraîné sur d'énormes quantités de textes pour comprendre une consigne et produire une réponse rédigée, comme le font ChatGPT, Claude ou Mistral.",
    fonctionnement:
      "Le modèle découpe le texte en petits morceaux appelés jetons, puis prédit le morceau suivant le plus probable, encore et encore, jusqu'à former une réponse complète. Il n'a pas de base de faits consultable : il s'appuie sur des régularités apprises. On y accède par une application de discussion ou, pour l'intégrer à un logiciel, par une interface de programmation.",
    exemple:
      "Un restaurateur peut demander à un LLM de reformuler poliment une réponse à un avis client mécontent, puis de la traduire en anglais pour un touriste, en la relisant avant publication.",
    limite:
      "Un LLM ignore les événements postérieurs à son entraînement et vos documents internes, sauf s'il dispose d'un outil de recherche ou si on les lui fournit. Il peut inventer un fait ou une source. On le complète donc par des documents de l'entreprise et par une relecture humaine.",
    offre: "formations",
  },
  {
    slug: "slm",
    term: "SLM (petit modèle de langage)",
    category: "models",
    aliases: ["Small Language Model", "petit modèle de langage", "modèle compact"],
    related: [
      "llm",
      "quantification",
      "on-premise-ai",
      "edge-deployment",
      "open-source-open-weight",
    ],
    definition:
      "Un SLM (Small Language Model, ou petit modèle de langage) est un modèle de langage de taille réduite, conçu pour fonctionner avec peu de ressources, parfois sur un ordinateur de bureau ou un téléphone, et pour une gamme de tâches limitée.",
    fonctionnement:
      "Il suit le même principe qu'un grand modèle, mais avec bien moins de paramètres. Il est donc plus rapide, moins coûteux à faire tourner et plus simple à installer chez soi. En contrepartie, il raisonne moins finement et connaît moins de sujets. On le choisit pour un usage précis plutôt que pour tout faire.",
    exemple:
      "Un cabinet de kinésithérapie peut installer un petit modèle sur un poste interne pour résumer des comptes rendus, sans que les notes de patients quittent le cabinet.",
    limite:
      "Petit ne veut pas dire fiable pour tout. Sur des questions ouvertes ou complexes, un petit modèle se trompe plus vite. Il faut le tester sur ses propres cas avant de le déployer, et prévoir un modèle plus puissant en renfort.",
    offre: "automatisations",
  },
  {
    slug: "modele-de-fondation",
    term: "Modèle de fondation",
    category: "models",
    aliases: ["foundation model", "modèle de base", "modèle généraliste"],
    related: ["llm", "ia-generative", "fine-tuning", "vision-multimodal", "donnees-entrainement"],
    definition:
      "Un modèle de fondation est un grand modèle d'IA entraîné sur des données très variées, qui sert de socle commun à de nombreux usages : rédiger, résumer, traduire, analyser des images ou écrire du code.",
    fonctionnement:
      "Son entraînement initial est très long et très coûteux, ce qui le réserve à quelques grands acteurs. Les entreprises ne le refont pas : elles l'utilisent tel quel, ou l'adaptent par des consignes, par leurs documents ou, plus rarement, par un réglage fin. C'est cette base partagée qui rend l'IA accessible à une petite structure.",
    exemple:
      "Un bureau d'études en bâtiment peut employer le même modèle de fondation pour résumer des comptes rendus de chantier le matin et préparer un courrier à un maître d'ouvrage l'après-midi.",
    limite:
      "Un modèle de fondation reflète les données et les choix de son concepteur. Il n'est pas neutre, ni adapté d'office à votre métier. Il faut vérifier où il est hébergé, quelles données il conserve et ce que prévoit le contrat.",
    offre: "formations",
  },
  {
    slug: "donnees-entrainement",
    term: "Données d'entraînement",
    category: "foundational",
    aliases: ["jeu de données d'entraînement", "training data", "corpus d'entraînement"],
    related: [
      "machine-learning",
      "biais",
      "fine-tuning",
      "donnee-personnelle",
      "modele-de-fondation",
    ],
    definition:
      "Les données d'entraînement sont l'ensemble des textes, images, sons ou chiffres à partir desquels un modèle d'IA apprend à produire ses réponses.",
    fonctionnement:
      "Pendant l'apprentissage, le modèle examine ces exemples et ajuste ses paramètres pour reproduire les régularités qu'il y trouve. Ce qu'il sait de lui-même vient de là ; le reste doit lui être fourni dans la consigne ou par des documents. Une fois l'entraînement terminé, le modèle n'a plus accès aux données elles-mêmes, seulement à ce qu'il en a retenu sous forme de paramètres.",
    exemple:
      "Une entreprise de transport régionale qui veut prévoir ses retards rassemble ses plannings des dernières années : ces historiques propres et bien étiquetés deviennent les données d'entraînement de son outil.",
    limite:
      "Des données mal choisies donnent un modèle décevant, voire injuste. Autre vigilance : ce que vous saisissez dans un outil en ligne peut, selon ses conditions, servir à l'entraîner. Vérifiez l'option de refus avant d'y déposer des informations sensibles.",
    offre: "cartographie",
  },
  {
    slug: "nlp",
    term: "Traitement du langage naturel",
    category: "foundational",
    aliases: ["NLP", "TAL", "natural language processing", "traitement automatique des langues"],
    related: ["llm", "chatbot", "transcription", "ocr"],
    definition:
      "Le traitement du langage naturel (TAL, ou NLP en anglais) est le domaine de l'informatique qui apprend aux machines à lire, comprendre et produire le langage humain, à l'écrit comme à l'oral.",
    fonctionnement:
      "Il regroupe des tâches variées : classer un message, repérer des noms ou des dates, résumer, traduire, répondre à une question. Autrefois fondé sur des règles de grammaire, il s'appuie aujourd'hui surtout sur des modèles de langage entraînés sur de grands corpus, qui gèrent plusieurs tâches avec un même outil.",
    exemple:
      "Un syndic de copropriété peut utiliser le traitement du langage pour classer les e-mails des copropriétaires par sujet, par exemple fuite, ascenseur ou charges, et les orienter vers le bon gestionnaire.",
    limite:
      "La langue reste pleine d'ironie, d'implicite et d'expressions locales que les outils saisissent mal. Un message écrit avec humour ou colère peut être mal classé. Un contrôle humain reste utile pour les échanges sensibles.",
    offre: "automatisations",
  },
  {
    slug: "prompt",
    term: "Prompt (consigne)",
    category: "foundational",
    aliases: ["prompt", "consigne", "instruction", "requête à l'IA"],
    related: ["prompt-engineering", "system-prompt", "few-shot", "context-window", "ia-generative"],
    definition:
      "Un prompt est la consigne écrite que l'on donne à une IA générative pour obtenir une réponse : une question, une demande de texte, un contexte, des exemples ou des contraintes de forme.",
    fonctionnement:
      "Le modèle lit le prompt comme un texte à poursuivre. Plus la consigne précise le rôle, l'objectif, le public visé, le format souhaité et les informations utiles, plus la réponse est pertinente. On peut aussi y coller des extraits de documents. Le même modèle donne des résultats très différents selon la façon dont on lui parle.",
    exemple:
      "Une gérante de salon de coiffure demande : « Rédige un message de rappel de rendez-vous chaleureux, en deux phrases, sans promotion, pour une cliente régulière. » Le résultat est bien plus utile qu'un simple « écris un SMS ».",
    limite:
      "Un bon prompt ne garantit pas une réponse exacte. Et tout ce que l'on y colle peut sortir de l'entreprise : évitez d'y inclure des données personnelles ou confidentielles dans un outil non maîtrisé.",
    offre: "formations",
  },
  {
    slug: "prompt-engineering",
    term: "Ingénierie de prompt",
    category: "foundational",
    aliases: ["prompt engineering", "rédaction de consignes", "ingénierie de consignes"],
    related: ["prompt", "system-prompt", "few-shot", "chain-of-thought", "hallucination"],
    definition:
      "L'ingénierie de prompt (prompt engineering) est la pratique qui consiste à rédiger, tester et améliorer les consignes données à une IA pour obtenir des réponses plus fiables, plus régulières et mieux adaptées à un besoin.",
    fonctionnement:
      "On précise le rôle de l'IA, la tâche, le format attendu et les limites à respecter. On ajoute parfois des exemples de bonnes réponses, puis on compare plusieurs versions de la consigne sur quelques cas réels. Une fois la formulation stabilisée, on la conserve comme modèle réutilisable par toute l'équipe.",
    exemple:
      "Un cabinet de recrutement local rédige une consigne type pour reformuler les offres d'emploi de ses clients : même structure, même ton, mêmes rubriques, quel que soit le collaborateur qui l'utilise.",
    limite:
      "L'erreur courante est de chercher la formule magique. Une consigne ne remplace ni de bonnes données ni une relecture. Elle règle une grande partie des cas courants, mais pas les besoins qui exigent des documents internes ou un outil connecté.",
    offre: "formations",
  },
  {
    slug: "system-prompt",
    term: "Prompt système",
    category: "foundational",
    aliases: ["system prompt", "consigne système", "instructions système"],
    related: ["prompt", "prompt-engineering", "guardrails", "chatbot", "prompt-injection"],
    definition:
      "Le prompt système est une consigne de fond, rédigée une fois par le concepteur d'un assistant IA, qui fixe son rôle, son ton et ses limites avant même que l'utilisateur ne pose sa première question.",
    fonctionnement:
      "Il est transmis au modèle en début de conversation, de façon invisible pour l'utilisateur. Il peut dire : « Tu es l'assistant du service client, tu réponds en vouvoyant, tu ne donnes jamais de prix, tu renvoies vers un conseiller en cas de doute. » Le modèle tient compte de ces règles pour chaque réponse.",
    exemple:
      "Une agence de voyages locale configure son assistant de site avec un prompt système qui impose le vouvoiement, interdit de promettre une disponibilité et renvoie toute demande de réservation vers un conseiller.",
    limite:
      "Le prompt système n'est pas une barrière absolue : un utilisateur habile peut parfois le contourner. Il se combine donc avec des contrôles techniques, des droits d'accès limités et des tests réguliers.",
    offre: "automatisations",
  },
  {
    slug: "few-shot",
    term: "Apprentissage par l'exemple (few-shot)",
    category: "foundational",
    aliases: ["few-shot prompting", "prompt avec exemples", "apprentissage en contexte"],
    related: ["prompt", "prompt-engineering", "chain-of-thought", "context-window"],
    definition:
      "L'apprentissage par l'exemple, dit few-shot, consiste à glisser quelques exemples de réponses attendues dans la consigne pour montrer à l'IA le format, le ton et la logique à reproduire, sans avoir à la ré-entraîner.",
    fonctionnement:
      "Au lieu de seulement décrire la tâche, on présente deux ou trois paires « entrée puis sortie souhaitée ». Le modèle repère le schéma commun et l'applique à la nouvelle demande. C'est rapide et économique, et cela suffit souvent à obtenir un style cohérent sans passer par un réglage fin plus lourd.",
    exemple:
      "Une boulangerie qui répond à des commandes de traiteur montre à l'assistant trois anciens devis rédigés comme elle aime. L'IA propose ensuite un nouveau devis dans le même ton et la même présentation.",
    limite:
      "Les exemples occupent de la place dans la fenêtre de contexte, et un exemple maladroit peut être imité tel quel. Choisissez-en de variés et corrects, et testez le résultat sur des cas que l'IA n'a pas vus.",
    offre: "formations",
  },
  {
    slug: "tokens",
    term: "Jeton (token)",
    category: "foundational",
    aliases: ["token", "jeton", "tokens"],
    related: ["tokenization", "context-window", "llm", "inference"],
    definition:
      "Un jeton (token en anglais) est le petit morceau de texte, souvent une syllabe ou un mot court, que manipule un modèle de langage ; c'est aussi l'unité servant à mesurer la longueur d'une conversation et à facturer l'usage d'une interface de programmation.",
    fonctionnement:
      "Avant de traiter un message, le modèle le découpe en jetons. Il en lit un certain nombre en entrée et en produit d'autres en sortie. La longueur de l'échange se compte donc en jetons, pas en pages. Un texte en français en utilise généralement un peu plus qu'en anglais, car les découpeurs de la plupart des modèles ont été conçus surtout à partir de textes anglais.",
    exemple:
      "Un cabinet d'avocats qui fait résumer un long contrat par un assistant doit vérifier que le document, une fois découpé en jetons, tient dans la limite du modèle, sinon il le fournit en plusieurs morceaux.",
    limite:
      "On estime souvent mal la consommation : une longue conversation, relue en entier à chaque réponse, coûte plus qu'on ne le pense. Suivre l'usage et fixer un plafond de dépense évite les mauvaises surprises.",
    offre: "automatisations",
  },
  {
    slug: "tokenization",
    term: "Tokenisation",
    category: "foundational",
    aliases: ["tokenization", "découpage en jetons", "tokenizer"],
    related: ["tokens", "llm", "context-window", "embedding"],
    definition:
      "La tokenisation est l'étape qui découpe un texte en jetons avant que le modèle de langage ne le traite, selon un dictionnaire de morceaux propre à chaque modèle.",
    fonctionnement:
      "Le découpeur, appelé tokenizer, cherche les morceaux les plus fréquents : un mot courant devient un seul jeton, un mot rare ou long en plusieurs. Chaque jeton reçoit ensuite un numéro, que le modèle transforme en suite de nombres. Comme chaque modèle a son propre dictionnaire, un même texte ne fait pas le même nombre de jetons partout.",
    exemple:
      "Un cabinet médical qui prépare des comptes rendus pleins de termes techniques constate qu'un mot spécialisé est coupé en plusieurs jetons : le même courrier consomme donc plus de capacité qu'un texte courant.",
    limite:
      "La tokenisation explique certaines bizarreries : un modèle compte mal les lettres d'un mot ou lit parfois mal des nombres longs. Ce défaut tient au découpage, pas à un manque d'attention de sa part.",
    offre: "formations",
  },
  {
    slug: "context-window",
    term: "Fenêtre de contexte",
    category: "foundational",
    aliases: ["context window", "contexte", "fenêtre contextuelle"],
    related: ["tokens", "llm", "rag", "prompt-caching", "chunking"],
    definition:
      "La fenêtre de contexte est la quantité maximale de texte, mesurée en jetons, qu'un modèle de langage peut prendre en compte en une seule fois : votre consigne, les documents fournis, l'historique de la conversation et sa propre réponse.",
    fonctionnement:
      "Tout ce qui sort de cette fenêtre est oublié : le modèle n'a aucune mémoire cachée en dehors de ce qu'on lui montre. Les modèles récents acceptent des fenêtres très larges, parfois l'équivalent de plusieurs livres. Plus la fenêtre est remplie, plus le calcul est lent et coûteux, et plus l'attention portée à chaque détail peut baisser.",
    exemple:
      "Un cabinet d'architectes colle le cahier des charges d'un appel d'offres dans la conversation pour poser des questions précises ; si le document dépasse la fenêtre, il doit le découper ou utiliser une recherche documentaire.",
    limite:
      "Une grande fenêtre ne garantit pas que tout soit bien exploité. Les informations placées au milieu d'un très long texte sont parfois négligées. Mieux vaut fournir peu de contenu, bien choisi, que beaucoup de contenu brut.",
    offre: "formations",
  },
  {
    slug: "temperature",
    term: "Température",
    category: "foundational",
    aliases: ["temperature", "paramètre de créativité", "température du modèle"],
    related: ["top-k-top-p", "llm", "prompt-engineering", "hallucination"],
    definition:
      "La température est un réglage qui contrôle le degré de variété et de créativité des réponses d'un modèle de langage : basse, il reste prudent et régulier ; haute, il se permet des formulations plus inattendues.",
    fonctionnement:
      "À chaque étape, le modèle dispose de plusieurs mots possibles, chacun avec une probabilité. Une température basse l'incite à choisir presque toujours le plus probable, donc à répondre de façon stable. Une température élevée donne plus de chances aux choix moins probables, ce qui diversifie les tournures mais augmente aussi le risque d'écart.",
    exemple:
      "Un cabinet de gestion de paie règle une température basse pour que l'assistant classe les demandes des salariés de la même manière à chaque fois, et une température plus élevée pour proposer des idées d'intitulés de lettre d'information.",
    limite:
      "Baisser la température ne supprime pas les erreurs : le modèle peut répéter la même fausseté avec constance. Ce réglage n'est d'ailleurs pas accessible dans toutes les applications grand public, seulement dans certaines interfaces avancées.",
    offre: "automatisations",
  },
  {
    slug: "top-k-top-p",
    term: "Top-k et top-p",
    category: "foundational",
    aliases: ["top-k", "top-p", "nucleus sampling", "échantillonnage"],
    related: ["temperature", "llm", "inference", "prompt-engineering"],
    definition:
      "Top-k et top-p sont deux réglages d'échantillonnage qui limitent le nombre de mots parmi lesquels un modèle de langage peut choisir le suivant, afin de garder des réponses cohérentes tout en laissant de la variété.",
    fonctionnement:
      "Avec top-k, le modèle ne considère que les k mots les plus probables, par exemple les dix premiers. Avec top-p, il retient les mots les plus probables jusqu'à ce que leur probabilité cumulée atteigne un seuil, par exemple quatre-vingt-dix pour cent. Écarter les choix improbables évite les phrases incohérentes, sans figer entièrement le texte.",
    exemple:
      "Un éditeur de logiciels de gestion qui intègre un assistant dans son produit demande à son prestataire de restreindre ces réglages, pour que les réponses d'aide restent sobres et ne partent pas dans des tournures fantaisistes.",
    limite:
      "Ces paramètres relèvent du réglage technique et dépendent de l'outil utilisé. Pour un usage courant en entreprise, on les laisse presque toujours à leur valeur par défaut, et on agit plutôt sur la qualité de la consigne.",
    offre: "formations",
  },
];
