import type { TermeSource } from "./types";

/** Modèles, fournisseurs, déploiement et exploitation. */
export const TERMES_MODELES_INFRA: readonly TermeSource[] = [
  {
    slug: "inference",
    term: "Inférence",
    category: "infra",
    aliases: ["inference", "exécution du modèle", "phase d'utilisation"],
    related: ["llm", "latency-p95", "quantification", "throughput", "tokens"],
    definition:
      "L'inférence est le moment où un modèle d'IA déjà entraîné est utilisé pour répondre à une demande : chaque question posée à un assistant déclenche une inférence.",
    fonctionnement:
      "Il faut distinguer deux phases. L'entraînement, long et coûteux, a lieu une fois chez le concepteur du modèle. L'inférence, elle, se répète à chaque requête et mobilise des processeurs spécialisés. C'est elle qui explique la facturation à l'usage des interfaces de programmation et le temps d'attente avant une réponse.",
    exemple:
      "Une entreprise de transport qui branche un assistant sur son suivi de colis déclenche une inférence chaque fois qu'un client interroge l'état de sa livraison : le coût suit donc le volume de questions.",
    limite:
      "On sous-estime souvent le coût d'exploitation, qui vient de l'usage répété plus que de la mise en place. Avant de généraliser un outil, il faut estimer le nombre de requêtes et choisir un modèle proportionné au besoin.",
    offre: "automatisations",
  },
  {
    slug: "quantification",
    term: "Quantification",
    category: "infra",
    aliases: ["quantization", "compression de modèle", "allègement de modèle"],
    related: ["slm", "inference", "on-premise-ai", "open-source-open-weight", "edge-deployment"],
    definition:
      "La quantification est une technique qui allège un modèle d'IA en réduisant la précision des nombres qui le composent, pour qu'il occupe moins de mémoire et tourne plus vite sur un matériel modeste.",
    fonctionnement:
      "Un modèle stocke ses paramètres sous forme de nombres très précis. En les arrondissant, par exemple de seize à quatre bits, on divise fortement la place nécessaire. Le modèle devient utilisable sur un ordinateur ordinaire, au prix d'une légère perte de finesse. Cette méthode est très répandue pour les modèles ouverts installés localement.",
    exemple:
      "Un cabinet de géomètres qui souhaite garder ses relevés chez lui fait tourner un modèle quantifié sur un poste puissant du bureau, plutôt que d'acheter un serveur coûteux.",
    limite:
      "Plus on compresse, plus la qualité peut baisser, notamment sur le raisonnement et les langues moins courantes. Il faut comparer le modèle allégé au modèle d'origine sur ses propres tâches avant de l'adopter.",
    offre: "automatisations",
  },
  {
    slug: "streaming",
    term: "Réponse en flux (streaming)",
    category: "infra",
    aliases: ["streaming", "affichage progressif", "réponse progressive"],
    related: ["inference", "latency-p95", "chatbot", "llm"],
    definition:
      "Le streaming est un mode d'affichage où la réponse d'un modèle de langage apparaît mot après mot, au fil de sa production, au lieu d'être livrée d'un bloc à la fin.",
    fonctionnement:
      "Le modèle produit sa réponse élément par élément. Plutôt que d'attendre la fin, le serveur envoie chaque morceau dès qu'il est prêt. L'utilisateur commence donc à lire au bout d'un instant, ce qui rend l'outil plus agréable, même si le temps total de génération reste le même.",
    exemple:
      "Sur le site d'un cabinet de conseil, l'assistant d'accueil écrit sa réponse en direct. Le visiteur lit déjà les premières lignes pendant que la suite se construit, au lieu de fixer un écran vide.",
    limite:
      "Le streaming améliore la perception de rapidité, pas la qualité. Il complique aussi les contrôles : une réponse déjà affichée est difficile à retirer si un filtre détecte un problème. On prévoit donc des vérifications en amont.",
    offre: "automatisations",
  },
  {
    slug: "hallucination",
    term: "Hallucination",
    category: "security",
    aliases: ["confabulation", "réponse inventée", "invention de l'IA"],
    related: ["rag", "prompt-engineering", "llm-as-judge", "eval-suite", "guardrails"],
    definition:
      "Une hallucination est une réponse fausse, inventée ou non fondée qu'un modèle d'IA présente avec assurance, comme une citation inexistante, un chiffre erroné ou une loi qui n'a jamais été votée.",
    fonctionnement:
      "Un modèle de langage choisit les mots les plus plausibles, sans vérifier qu'ils sont vrais. Quand il manque d'informations ou quand la question sort de ce qu'il connaît, il comble les trous de façon vraisemblable. On réduit le risque en lui fournissant les bons documents, en lui demandant de citer ses sources et en relisant les points importants.",
    exemple:
      "Une responsable des ressources humaines d'une PME demande à un assistant un rappel sur une règle de congés. Elle vérifie la réponse dans la convention collective avant de l'envoyer aux salariés.",
    limite:
      "On ne peut pas supprimer complètement les hallucinations. Plus la question est précise et sensible, juridique, médicale ou financière, plus la vérification humaine est nécessaire. Une réponse bien rédigée n'est pas une réponse exacte.",
    offre: "formations",
  },
  {
    slug: "fine-tuning",
    term: "Réglage fin (fine-tuning)",
    category: "foundational",
    aliases: ["fine-tuning", "ajustement fin", "spécialisation de modèle"],
    related: ["llm", "rag", "prompt-engineering", "donnees-entrainement", "modele-de-fondation"],
    definition:
      "Le réglage fin (fine-tuning) consiste à poursuivre l'entraînement d'un modèle existant sur un ensemble d'exemples propres à une entreprise, pour qu'il adopte un style, un format ou un vocabulaire particuliers.",
    fonctionnement:
      "On prépare des paires « demande et réponse idéale », souvent plusieurs centaines. Le modèle ajuste légèrement ses paramètres pour s'en rapprocher. Il est ensuite plus constant sur cette tâche. En revanche, le réglage fin n'est pas un bon moyen d'ajouter des connaissances changeantes : pour cela, on préfère lui fournir les documents à la demande.",
    exemple:
      "Un éditeur de revues techniques régional veut que l'IA rédige toujours des chapeaux dans son ton maison. Il fait régler un modèle sur des centaines de chapeaux validés par sa rédaction.",
    limite:
      "Le réglage fin demande des données propres, du temps et un budget, et il est à refaire quand le modèle de base évolue. Beaucoup de besoins se règlent d'abord avec une bonne consigne ou des documents fournis au modèle.",
    offre: "cartographie",
  },
  {
    slug: "chain-of-thought",
    term: "Raisonnement pas à pas",
    category: "foundational",
    aliases: ["chain of thought", "CoT", "chaîne de raisonnement"],
    related: ["extended-thinking", "prompt-engineering", "few-shot", "hallucination"],
    definition:
      "Le raisonnement pas à pas (chain of thought) est une façon de faire travailler un modèle de langage en lui demandant de détailler les étapes intermédiaires de sa réflexion avant de donner sa conclusion.",
    fonctionnement:
      "Poser la consigne « raisonne étape par étape » incite le modèle à décomposer un problème. Il écrit d'abord un calcul, une comparaison ou une liste de critères, puis déduit la réponse. Cette décomposition améliore souvent les résultats sur les tâches de logique, de calcul ou d'analyse de plusieurs documents.",
    exemple:
      "Une gestionnaire de PME qui compare deux offres de contrats d'assurance demande à l'assistant de lister garanties, exclusions et franchises de chacune, puis de conclure, ce qui lui permet de contrôler chaque étape.",
    limite:
      "Les étapes affichées sont plausibles, mais pas toujours le reflet exact de ce que le modèle a calculé. Elles rassurent plus qu'elles ne prouvent. Elles allongent aussi la réponse et la facture, d'où un usage réservé aux problèmes qui le méritent.",
    offre: "formations",
  },
  {
    slug: "extended-thinking",
    term: "Réflexion étendue",
    category: "foundational",
    aliases: ["extended thinking", "modèle de raisonnement", "mode réflexion"],
    related: ["chain-of-thought", "inference", "llm", "latency-p95"],
    definition:
      "La réflexion étendue est un mode dans lequel un modèle de langage consacre plus de temps et de calcul à réfléchir en interne avant de répondre, ce qui améliore ses résultats sur les problèmes complexes.",
    fonctionnement:
      "Le modèle commence par produire un long brouillon de raisonnement, qu'il explore, vérifie et corrige, puis il rédige sa réponse finale. Ce mode est proposé par plusieurs fournisseurs sous forme de modèles dits « de raisonnement » ou d'une option à activer. Il est plus lent et consomme davantage de jetons qu'une réponse directe.",
    exemple:
      "Un cabinet de conseil en gestion utilise ce mode pour analyser un tableau de trésorerie compliqué, mais garde le mode rapide pour les courriers simples du quotidien.",
    limite:
      "Réfléchir plus longtemps ne rend pas le modèle infaillible. Le surcoût et l'attente se justifient pour une analyse difficile, pas pour une reformulation. Le résultat reste à relire, surtout quand il sert à décider.",
    offre: "formations",
  },
  {
    slug: "vision-multimodal",
    term: "Modèle multimodal",
    category: "models",
    aliases: ["multimodal", "vision multimodale", "VLM", "modèle texte et image"],
    related: ["vision-par-ordinateur", "ocr", "transcription", "ia-generative", "llm"],
    definition:
      "Un modèle multimodal est un modèle d'IA capable de traiter plusieurs types de contenus à la fois, comme le texte, les images, le son ou la vidéo, et de les relier dans une même réponse.",
    fonctionnement:
      "Là où un modèle de langage classique ne lit que du texte, un modèle multimodal convertit aussi les images ou les sons dans une forme qu'il sait manipuler. On peut alors lui montrer une photo, un schéma ou un tableau et lui poser une question en langage courant, ou lui demander un résumé d'enregistrement.",
    exemple:
      "Un garagiste photographie le tableau de bord d'un véhicule avec un voyant allumé et demande à l'assistant ce que ce symbole peut signifier, avant de confirmer avec la documentation constructeur.",
    limite:
      "La lecture d'images reste imparfaite : petits caractères, écriture manuscrite ou plans détaillés sont parfois mal interprétés. Il faut aussi se méfier d'envoyer des photos contenant des visages ou des données de clients à un service non maîtrisé.",
    offre: "journee-ia",
  },
  {
    slug: "claude-anthropic",
    term: "Claude (Anthropic)",
    category: "models",
    aliases: ["Claude", "Anthropic", "famille de modèles Claude"],
    related: ["llm", "gpt-openai", "mistral-model", "gemini-google", "mcp"],
    definition:
      "Claude est une famille de modèles de langage conçue par la société américaine Anthropic, utilisable par une application de discussion ou par interface de programmation, et reconnue pour ses capacités de rédaction, d'analyse de documents longs et de programmation.",
    fonctionnement:
      "Anthropic propose plusieurs tailles de modèles, des plus rapides aux plus puissantes, et les met à jour régulièrement. On les utilise soit en discutant directement avec l'outil, soit en les intégrant à un logiciel. L'éditeur publie ses conditions d'usage, dont l'utilisation ou non des conversations pour entraîner ses modèles.",
    exemple:
      "Une agence de communication de quelques personnes utilise Claude pour résumer de longs comptes rendus de réunion client et préparer un plan d'actions que l'équipe relit.",
    limite:
      "Aucun modèle n'est le meilleur pour tout. Le choix dépend de la tâche, du coût et de la confidentialité des données. Il vaut mieux tester plusieurs fournisseurs sur ses propres cas plutôt que de se fier à un classement général.",
    offre: "formations",
  },
  {
    slug: "gpt-openai",
    term: "GPT (OpenAI)",
    category: "models",
    aliases: ["GPT", "ChatGPT", "OpenAI", "Generative Pre-trained Transformer"],
    related: ["llm", "claude-anthropic", "mistral-model", "gemini-google", "ia-generative"],
    definition:
      "GPT est une famille de modèles de langage créée par la société américaine OpenAI, connue du grand public par l'application ChatGPT, qui a popularisé l'IA générative à partir de fin 2022.",
    fonctionnement:
      "Le sigle signifie « transformeur génératif pré-entraîné ». Un modèle de ce type est d'abord entraîné sur de très grands corpus, puis affiné pour dialoguer. OpenAI propose ses modèles dans une application grand public et par interface de programmation, avec des offres et des conditions d'usage différentes pour les particuliers et les entreprises.",
    exemple:
      "Un commerçant en ligne de petit format utilise ChatGPT pour rédiger des fiches produit, en y précisant ses contraintes de ton, puis il corrige lui-même les caractéristiques techniques.",
    limite:
      "ChatGPT n'est qu'un produit parmi d'autres, et la version gratuite ne présente pas les mêmes garanties de confidentialité qu'une offre professionnelle. Avant d'y saisir des données de clients, il faut lire les conditions et régler les options.",
    offre: "journee-ia",
  },
  {
    slug: "mistral-model",
    term: "Mistral",
    category: "models",
    aliases: ["Mistral AI", "Le Chat", "modèles Mistral"],
    related: ["ia-souveraine", "open-source-open-weight", "llm", "claude-anthropic", "gpt-openai"],
    definition:
      "Mistral AI est une entreprise française, fondée en 2023, qui conçoit des modèles de langage, dont certains sont publiés en poids ouverts, et propose un assistant grand public appelé Le Chat.",
    fonctionnement:
      "Ses modèles existent en plusieurs tailles, des plus compacts, installables chez soi, aux plus puissants, accessibles par interface de programmation. Parce que l'éditeur est européen, certaines entreprises le choisissent pour des raisons de souveraineté ou de localisation des données, après avoir lu ses conditions et vérifié l'hébergement réel.",
    exemple:
      "Une clinique vétérinaire sensible à l'hébergement de ses données teste un assistant fondé sur un modèle français pour résumer ses dossiers, et compare ses résultats à ceux d'un autre fournisseur.",
    limite:
      "Origine européenne ne veut pas dire conformité automatique : l'hébergement, le contrat et l'usage des données doivent être vérifiés pour chaque offre. Et le meilleur modèle dépend du besoin, pas du pays de l'éditeur.",
    offre: "cartographie",
  },
  {
    slug: "llama-model",
    term: "Llama (Meta)",
    category: "models",
    aliases: ["Llama", "LLaMA", "modèles Llama de Meta"],
    related: ["open-source-open-weight", "slm", "on-premise-ai", "llm"],
    definition:
      "Llama est une famille de modèles de langage publiée par l'entreprise américaine Meta, dont les poids sont téléchargeables, ce qui permet de les faire fonctionner sur ses propres machines sous les conditions d'une licence.",
    fonctionnement:
      "Meta distribue plusieurs tailles de modèles. Une entreprise ou un prestataire peut les télécharger, les installer sur son serveur et même les adapter. Cela donne la maîtrise des données, mais impose de gérer l'infrastructure, les mises à jour et la sécurité. La licence comporte des conditions qu'il faut lire.",
    exemple:
      "Un cabinet de notaires, tenu au secret professionnel, fait installer un modèle ouvert sur un serveur interne pour résumer des actes, sans transmettre ces documents à un fournisseur externe.",
    limite:
      "« Ouvert » ne signifie pas « libre de toute règle » : la licence impose des conditions. L'installation locale demande aussi des compétences et du matériel. Il faut comparer ce coût d'exploitation à celui d'un service en ligne.",
    offre: "automatisations",
  },
  {
    slug: "gemini-google",
    term: "Gemini (Google)",
    category: "models",
    aliases: ["Gemini", "Google Gemini", "modèles Gemini"],
    related: ["vision-multimodal", "llm", "claude-anthropic", "gpt-openai", "copilote"],
    definition:
      "Gemini est une famille de modèles d'IA conçue par Google, nativement multimodale, qui traite le texte, l'image, le son et la vidéo, et que l'on retrouve dans l'application Gemini ainsi que dans plusieurs services de l'écosystème Google.",
    fonctionnement:
      "Les modèles Gemini sont proposés en plusieurs tailles. Ils servent à discuter, à résumer des documents et des messages et à analyser des images. Ils sont intégrés à des outils de bureautique en ligne et aux résultats de recherche. Les conditions de confidentialité dépendent de l'offre grand public ou professionnelle souscrite.",
    exemple:
      "Une association de quartier qui gère ses documents dans une suite bureautique en ligne utilise l'assistant intégré pour résumer un long compte rendu et préparer l'ordre du jour de la prochaine réunion.",
    limite:
      "Un assistant intégré à vos outils voit potentiellement vos documents : il faut vérifier quels contenus il peut lire et qui y a accès. Les réglages de partage doivent être revus avant l'activation, pas après.",
    offre: "journee-ia",
  },
  {
    slug: "sonnet-model",
    term: "Modèle de gamme intermédiaire",
    category: "models",
    aliases: ["Sonnet", "modèle équilibré", "modèle polyvalent"],
    related: ["opus-model", "haiku-model", "claude-anthropic", "inference"],
    definition:
      "Un modèle de gamme intermédiaire est un modèle de langage qui offre un bon équilibre entre qualité, vitesse et coût ; chez Anthropic, c'est le rôle de la gamme appelée Sonnet.",
    fonctionnement:
      "Les fournisseurs proposent en général trois niveaux : un petit modèle rapide, un modèle intermédiaire polyvalent et un grand modèle plus puissant mais plus lent et plus cher. Le niveau intermédiaire convient à la majorité des tâches d'une entreprise : rédaction, synthèse, tri de messages, aide à la programmation.",
    exemple:
      "Une agence de formation de petite taille utilise un modèle intermédiaire pour rédiger des programmes de stage et des mails de relance, et réserve le plus puissant aux rares analyses complexes.",
    limite:
      "Choisir le plus gros modèle par réflexe coûte plus cher et ralentit les réponses sans toujours améliorer le résultat. Il faut tester sur des cas réels et passer au niveau supérieur seulement si l'écart est visible.",
    offre: "automatisations",
  },
  {
    slug: "opus-model",
    term: "Grand modèle haut de gamme",
    category: "models",
    aliases: ["Opus", "modèle le plus puissant", "modèle premium"],
    related: ["sonnet-model", "haiku-model", "extended-thinking", "claude-anthropic"],
    definition:
      "Un grand modèle haut de gamme est le niveau le plus puissant d'une gamme de modèles de langage, plus apte au raisonnement et aux tâches complexes, mais plus lent et plus coûteux à l'usage ; chez Anthropic, la gamme s'appelle Opus.",
    fonctionnement:
      "Plus un modèle est grand, plus il a de paramètres et plus chaque réponse demande de calcul. Il excelle sur l'analyse de situations compliquées, la relecture critique ou la conception d'un plan. Une bonne organisation lui confie les tâches difficiles et laisse les tâches simples à des modèles plus modestes.",
    exemple:
      "Un cabinet de gestion de patrimoine local emploie le modèle le plus puissant pour relire la cohérence d'un dossier complexe, et un modèle plus léger pour classer les e-mails entrants.",
    limite:
      "Plus puissant ne veut pas dire plus fiable sur tout : il peut aussi se tromper. Le prix et la lenteur imposent de réserver ce niveau aux cas où l'écart de qualité compte vraiment.",
    offre: "formations",
  },
  {
    slug: "haiku-model",
    term: "Modèle d'entrée de gamme, rapide",
    category: "models",
    aliases: ["Haiku", "modèle léger", "modèle économique"],
    related: ["sonnet-model", "opus-model", "slm", "throughput"],
    definition:
      "Un modèle d'entrée de gamme, rapide, est un modèle de langage conçu pour répondre vite et à faible coût sur des tâches simples et répétitives ; chez Anthropic, c'est le rôle de la gamme appelée Haiku.",
    fonctionnement:
      "Moins gourmand en calcul, il traite un grand nombre de demandes en peu de temps. Il convient à des opérations bien cadrées : classer un message, extraire une date ou un montant d'un e-mail, reformuler une phrase. On l'emploie volontiers comme premier étage d'une chaîne, les cas difficiles étant transmis à un modèle plus puissant.",
    exemple:
      "Un cabinet d'expertise comptable utilise un modèle d'entrée de gamme pour trier chaque matin les e-mails reçus par type de demande, puis un collaborateur traite ceux qui sont signalés comme complexes.",
    limite:
      "Sur des questions ouvertes, ambiguës ou longues, un petit modèle perd en finesse. Son usage suppose des tâches bien définies et un échantillon de contrôle, pour s'assurer que la vitesse ne se paie pas en erreurs.",
    offre: "automatisations",
  },
  {
    slug: "open-source-open-weight",
    term: "Open source et poids ouverts",
    category: "models",
    aliases: ["open source", "open weight", "modèle ouvert", "poids ouverts"],
    related: ["llama-model", "mistral-model", "on-premise-ai", "slm", "ia-souveraine"],
    definition:
      "Un modèle à poids ouverts (open weight) est un modèle d'IA dont les paramètres sont publiés et téléchargeables, ce qui permet de l'installer et de l'adapter soi-même ; on parle d'open source au sens strict quand la licence permet librement d'utiliser, d'étudier, de modifier et de partager le modèle, avec son code et une description détaillée des données d'entraînement.",
    fonctionnement:
      "Les deux expressions sont souvent confondues. Beaucoup de modèles « ouverts » ne publient que les poids, sous une licence qui fixe des conditions d'usage. L'avantage est la maîtrise : on choisit où le modèle tourne et qui voit les données. Le prix à payer est la charge technique d'installation et de maintenance.",
    exemple:
      "Un laboratoire d'analyses médicales local, attentif à la confidentialité, fait héberger un modèle à poids ouverts sur un serveur dédié pour automatiser la rédaction de courriers aux médecins prescripteurs.",
    limite:
      "Ouvert ne signifie ni gratuit à exploiter ni sans risque. Il faut lire la licence, assurer la sécurité du serveur et comparer la qualité avec celle des modèles fermés, parfois supérieure sur les tâches difficiles.",
    offre: "cartographie",
  },
  {
    slug: "ia-souveraine",
    term: "IA souveraine",
    category: "gouvernance",
    aliases: ["souveraineté numérique", "IA de confiance", "IA européenne"],
    related: [
      "mistral-model",
      "on-premise-ai",
      "open-source-open-weight",
      "rgpd-gdpr",
      "gouvernance-ia",
    ],
    definition:
      "L'IA souveraine désigne une approche où un pays, une organisation ou une entreprise garde la maîtrise des modèles, des données et de l'hébergement qu'elle utilise, sans dépendre d'un fournisseur ou d'une juridiction étrangère.",
    fonctionnement:
      "Concrètement, on vérifie où sont stockées les données, qui peut y accéder, sous quel droit le fournisseur est soumis et quelles sorties sont possibles. Selon le besoin, cela passe par un éditeur européen, un hébergement en France, un modèle installé en interne ou un contrat qui limite l'usage des données.",
    exemple:
      "Un cabinet comptable qui traite des données financières de ses clients choisit un service hébergé en Europe et demande par écrit où sont stockées les conversations et combien de temps.",
    limite:
      "Le mot est employé de manière très large, parfois comme argument commercial. Un label « souverain » ne remplace pas la lecture du contrat. La question utile est toujours : où vont mes données, et que devient mon service si le fournisseur change ?",
    offre: "cartographie",
  },
  {
    slug: "on-premise-ai",
    term: "IA installée sur ses propres machines",
    category: "infra",
    aliases: ["on-premise", "IA locale", "déploiement sur site", "IA en local"],
    related: [
      "open-source-open-weight",
      "slm",
      "ia-souveraine",
      "quantification",
      "edge-deployment",
    ],
    definition:
      "Une IA installée sur ses propres machines (on-premise) est un modèle qui fonctionne sur les serveurs ou les ordinateurs de l'entreprise, et non chez un fournisseur en ligne, de sorte que les données ne quittent pas son périmètre.",
    fonctionnement:
      "On télécharge un modèle ouvert, souvent allégé, et on l'installe sur une machine suffisamment puissante. Les demandes sont traitées en interne, sans envoi vers l'extérieur. L'entreprise, ou son prestataire, assure alors l'installation, les mises à jour, la sauvegarde et la sécurité, ce qui représente un vrai travail.",
    exemple:
      "Un cabinet d'avocats d'affaires fait installer un assistant sur un serveur du bureau pour résumer des pièces de dossier confidentielles, accessible uniquement depuis son réseau interne.",
    limite:
      "Garder les données chez soi ne règle pas tout : un serveur mal protégé est aussi un risque. Les modèles locaux sont souvent moins puissants que les meilleurs services en ligne. Il faut évaluer le besoin réel avant d'investir dans du matériel.",
    offre: "cartographie",
  },
  {
    slug: "edge-deployment",
    term: "IA embarquée (edge)",
    category: "infra",
    aliases: ["edge AI", "IA en périphérie", "edge deployment", "IA sur appareil"],
    related: ["slm", "quantification", "on-premise-ai", "vision-par-ordinateur"],
    definition:
      "L'IA embarquée, ou edge, est une IA qui s'exécute directement sur l'appareil qui capte l'information, comme un téléphone, une caméra ou une machine d'atelier, plutôt que dans un centre de données distant.",
    fonctionnement:
      "Un modèle réduit est installé sur l'appareil. Il traite l'image ou le son sur place et n'envoie, au besoin, que le résultat. On gagne en rapidité, on peut fonctionner sans connexion et l'on évite de transmettre des contenus bruts. En contrepartie, les ressources de l'appareil limitent la taille et la puissance du modèle.",
    exemple:
      "Un atelier de fabrication de pièces mécaniques équipe un poste de contrôle d'une caméra qui repère sur place les défauts visibles, sans envoyer les images hors de l'usine.",
    limite:
      "Les modèles embarqués sont plus modestes et plus difficiles à mettre à jour sur de nombreux appareils. Ce choix a du sens pour des besoins de rapidité ou de confidentialité précis, pas comme solution par défaut.",
    offre: "automatisations",
  },
  {
    slug: "latency-p95",
    term: "Latence",
    category: "infra",
    aliases: ["latency", "temps de réponse", "p95", "délai de réponse"],
    related: ["throughput", "streaming", "inference", "rate-limit"],
    definition:
      "La latence est le temps qui s'écoule entre l'envoi d'une demande à un service d'IA et la réception de la réponse ; on la suit souvent au « p95 », valeur que 95 % des demandes ne dépassent pas.",
    fonctionnement:
      "La latence dépend de la taille du modèle, de la longueur de la consigne et de la réponse, de la charge du serveur et du réseau. La moyenne cache les mauvais jours : le p95 montre ce que vit l'utilisateur dans les moments difficiles. Réduire la latence passe par un modèle plus petit, des réponses plus courtes ou l'affichage progressif.",
    exemple:
      "Un cabinet de conseil qui branche un assistant sur son standard en ligne constate que certaines réponses mettent beaucoup plus de temps que d'habitude aux heures chargées, et ajuste donc le modèle utilisé.",
    limite:
      "Optimiser la vitesse au détriment de la qualité est une fausse économie. L'objectif est un délai acceptable pour l'usage : quelques secondes pour un chat, davantage pour une analyse que personne n'attend en direct.",
    offre: "automatisations",
  },
  {
    slug: "throughput",
    term: "Débit",
    category: "infra",
    aliases: ["throughput", "capacité de traitement", "volume traité"],
    related: ["latency-p95", "batching", "rate-limit", "inference"],
    definition:
      "Le débit est la quantité de travail qu'un service d'IA peut traiter dans un temps donné, par exemple le nombre de demandes ou de jetons produits par minute.",
    fonctionnement:
      "Latence et débit sont deux mesures différentes : l'une dit la rapidité d'une réponse, l'autre le volume traité en parallèle. Un système peut répondre vite à une personne mais saturer avec cent demandes simultanées. Le débit dépend du matériel, du modèle et des limites imposées par le fournisseur.",
    exemple:
      "Une entreprise de vente à distance qui fait résumer des milliers d'avis clients en fin de mois a besoin d'un débit élevé, alors que la rapidité de chaque résumé compte peu.",
    limite:
      "Les besoins de pointe sont facilement sous-estimés : une opération ponctuelle peut dépasser les limites du forfait. On planifie les traitements volumineux la nuit ou par lots, et l'on prévoit une marge.",
    offre: "automatisations",
  },
  {
    slug: "batching",
    term: "Traitement par lots",
    category: "infra",
    aliases: ["batching", "batch", "traitement groupé"],
    related: ["throughput", "rate-limit", "latency-p95", "automatisation"],
    definition:
      "Le traitement par lots (batching) consiste à regrouper de nombreuses demandes d'IA pour les traiter ensemble, de façon différée, plutôt que de les envoyer une à une en attendant chaque réponse.",
    fonctionnement:
      "On prépare un fichier contenant toutes les demandes, on l'envoie au fournisseur, puis on récupère les résultats plus tard, parfois au bout de plusieurs heures. Cette méthode est souvent moins chère et évite de buter sur les limites de débit. Elle convient aux tâches qui n'ont pas besoin d'une réponse immédiate.",
    exemple:
      "Un cabinet de gestion locative fait classer pendant la nuit les quelques centaines de courriers reçus dans la journée, et retrouve le matin chaque courrier rattaché au bon dossier.",
    limite:
      "Le résultat n'est pas instantané, donc ce mode est inadapté à un service client en direct. Il faut aussi prévoir la gestion des erreurs : une demande échouée dans le lot doit être repérée et relancée.",
    offre: "automatisations",
  },
  {
    slug: "rate-limit",
    term: "Limite de débit",
    category: "infra",
    aliases: ["rate limit", "quota", "plafond de requêtes"],
    related: ["throughput", "batching", "api", "tokens"],
    definition:
      "Une limite de débit (rate limit) est le plafond de demandes ou de jetons qu'un fournisseur d'IA autorise par minute ou par jour pour un compte, afin de protéger son service et d'éviter les abus.",
    fonctionnement:
      "Quand le plafond est atteint, le fournisseur refuse temporairement les demandes suivantes et renvoie un message d'erreur. Les logiciels bien conçus attendent puis réessayent automatiquement, ou répartissent la charge dans le temps. Les limites varient selon l'offre souscrite et peuvent être relevées sur demande ou en changeant de forfait.",
    exemple:
      "Une agence immobilière qui lance l'analyse de toutes ses annonces d'un coup voit l'outil ralentir, puis reprendre : le fournisseur a freiné l'envoi de demandes trop nombreuses en peu de temps.",
    limite:
      "Ignorer ces limites provoque des pannes visibles au pire moment. Prévoir une file d'attente, des relances automatiques et un mode dégradé évite qu'un service qui dépend de l'IA ne s'arrête brutalement.",
    offre: "automatisations",
  },
  {
    slug: "prompt-caching",
    term: "Mémoire de consigne (prompt caching)",
    category: "infra",
    aliases: ["prompt caching", "cache de prompt", "mise en cache"],
    related: ["context-window", "tokens", "inference", "system-prompt"],
    definition:
      "La mémoire de consigne (prompt caching) est une technique par laquelle un fournisseur conserve temporairement la partie répétitive d'une demande, comme un long document ou des instructions fixes, pour ne pas la retraiter à chaque fois.",
    fonctionnement:
      "Quand vous interrogez plusieurs fois un même document, la partie commune est calculée une première fois, puis réutilisée. Les demandes suivantes sont alors plus rapides et moins chères. Le cache expire au bout d'un délai court, et la réutilisation ne fonctionne que si le début de la demande reste identique.",
    exemple:
      "Un cabinet de conseil pose une série de questions sur un même rapport de plusieurs dizaines de pages : le rapport est lu une fois, puis réutilisé pour chaque question suivante.",
    limite:
      "Ce mécanisme dépend du fournisseur et de sa configuration, il n'est pas disponible partout. Il ne change pas la qualité des réponses. Par ailleurs, il faut vérifier combien de temps les contenus mis en cache sont conservés.",
    offre: "automatisations",
  },
  {
    slug: "mlops",
    term: "MLOps",
    category: "infra",
    aliases: [
      "MLOps",
      "LLMOps",
      "exploitation des modèles",
      "opérations d'apprentissage automatique",
    ],
    related: ["inference", "eval-suite", "gouvernance-ia", "poc"],
    definition:
      "Le MLOps est l'ensemble des pratiques qui permettent de déployer, surveiller, mettre à jour et maintenir un modèle d'IA en production de façon fiable, comme on le fait pour n'importe quel logiciel professionnel.",
    fonctionnement:
      "Il couvre le suivi des versions du modèle, les tests avant chaque changement, la mesure de la qualité en situation réelle, la gestion des coûts, les sauvegardes et les alertes en cas de dérive. Un modèle qui marchait bien peut se dégrader quand les données ou les usages évoluent : il faut donc le surveiller.",
    exemple:
      "Un éditeur de logiciels de facturation qui a intégré un assistant à son produit vérifie chaque semaine un échantillon de réponses, afin de repérer une baisse de qualité après une mise à jour du fournisseur.",
    limite:
      "Pour une petite structure qui utilise des outils du marché, ce n'est pas un chantier à part entière. Mais dès qu'une IA fait partie d'un service rendu aux clients, il faut une personne désignée pour la surveiller.",
    offre: "cartographie",
  },
];
