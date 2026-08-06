/**
 * CONTENU RÉDIGÉ — « IA pour l'automatisation » (2 jours, 14 h, 4 demi-journées).
 *
 * ## Le fil rouge
 *
 * Chacun repart avec UN prototype qui tourne : un cas réel de son activité,
 * cadré le jour 1, construit et testé le jour 2, fiabilisé et documenté avant
 * de partir. Rien n'est démontré qui ne soit ensuite monté par les stagiaires
 * eux-mêmes. La formule se répète telle quelle dans les ateliers : ce qui n'a
 * pas été testé sur des cas réels n'est pas un prototype, c'est une intention.
 *
 * ## Le format 2 jours change la conduite
 *
 * La fin du jour 1 doit produire un ÉTAT STABLE ET NOMMÉ — la fiche de cadrage,
 * enregistrée sous un nom, avec son outil et son régime de données arrêtés.
 * Sans cet état, le jour 2 redémarre à froid et la construction déborde sur le
 * temps de fiabilisation. C'est écrit dans les scripts des modules 2 et 3, et
 * ce n'est pas négociable au motif qu'il est 17 h 45.
 *
 * ## Trois règles que le formateur ne négocie pas
 *
 * **Toute chaîne porte un point de relecture humaine et un moyen de l'arrêter.**
 * Une automatisation qui tourne sans surveillance n'a pas moins d'erreurs, elle
 * les répète : la même sortie fausse part chaque semaine, sans que personne la
 * relise. Le point de relecture et le bouton d'arrêt sont des ENTRÉES de la
 * fiche de cadrage, pas des options ajoutées à la fin.
 *
 * **Le régime d'usage se décide AVANT de brancher quoi que ce soit.** Une
 * automatisation touche à des données en flux, pas à un document qu'on relit :
 * ce qui entre entre à chaque exécution. Rien de nominatif ne transite sans
 * décision explicite, et les ateliers tournent sur les jeux fournis dans le kit
 * tant que cette décision n'est pas prise.
 *
 * **Le formateur n'arbitre aucune question juridique ni de sécurité.** La
 * formule est écrite et se prononce telle quelle : « je ne me prononce pas,
 * notez la question, votre conseil tranchera ». Les grilles et trames remises
 * portent un en-tête « Projet — à faire valider par votre conseil avant
 * diffusion » qui n'est pas retirable.
 *
 * ⚠️ Les références réglementaires citées dans les séquences de cadre sont
 * fournies au formateur SOURCÉES ET DATÉES dans le kit, et ne se citent jamais
 * de mémoire. Leur formulation reste à faire relire par le conseil de
 * l'organisme.
 */

import type { EnrichissementFormation } from "./types";

/** Date de dernière vérification des captures et sorties d'outils. */
const VERIFIE_LE = "2026-08-06";

export const IA_POUR_L_AUTOMATISATION: EnrichissementFormation = [
  // ───────────────────────────────────────────────────────────────────────────
  // Module 1 — Matin J1 : ce qu'on peut automatiser, ce qu'on n'automatise jamais
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-1",
    objectif: {
      enonce:
        "À la fin de ce module, vous classez chacune de vos tâches répétitives en feu vert, feu orange ou feu rouge, et vous nommez le régime d'usage dans lequel vous travaillez réellement aujourd'hui.",
      objectifGlobalId: "obj-5",
      // L'atelier des 4 questions fait passer en revue les tâches répétitives de
      // chacun : c'est le premier tri de ce qui est automatisable (obj-1), même
      // si la cartographie complète n'arrive qu'au module 2.
      objectifsSecondairesIds: ["obj-1"],
      dureeMin: 10,
      notes: {
        script:
          "Tour de table en UNE phrase : « votre prénom, et la tâche que vous refaites le plus souvent à la main ». Notez chaque réponse au tableau, elle servira de vivier de cas cet après-midi. Annoncez le livrable des deux jours sans le sur-vendre : un prototype qui tourne sur VOTRE cas, testé, documenté, reprenable. Et annoncez tout de suite la règle qui tient les deux jours : toute chaîne a un point où un humain relit, et un moyen de l'arrêter.",
        faq: [
          {
            question: "On repart vraiment avec quelque chose qui fonctionne ?",
            reponse:
              "Oui, sur un cas que vous cadrez cet après-midi. Petit, testé, à vous. Pas sur le processus le plus lourd de votre service, on en reparlera à la feuille de route de demain soir.",
          },
          {
            question: "Notre informatique a tout bloqué, on va faire quoi de la journée ?",
            reponse:
              "Exactement ce qu'on commence dans vingt minutes : les trois régimes d'usage. Un blocage n'est pas une interdiction, c'est un régime. Notez le nom de l'outil validé chez vous, on travaillera avec celui-là.",
          },
        ],
        blocages: [
          {
            situation: "Le tour de table dérive en griefs contre l'outil de gestion maison.",
            parade:
              "Couper avec : « on note, et on regarde demain si une automatisation change quelque chose là-dessus » — puis écrire le grief au tableau. Le reprendre à la feuille de route du jour 2 achète beaucoup de crédit.",
          },
          {
            situation: "Un participant annonce d'emblée qu'il vient « pour voir », sans cas.",
            parade:
              "Lui attribuer dès maintenant le cas de repli commun pré-monté du kit. Ne pas le laisser arriver à l'après-midi sans matière : il perdrait la journée 2.",
          },
        ],
        planB:
          "Aucun outil n'est nécessaire ici. Vidéoprojecteur en panne : le tour de table et l'annonce des règles se tiennent au paperboard sans rien perdre.",
      },
    },
    demonstration: {
      avant:
        "La compilation hebdomadaire d'un tableau de suivi, faite à la main : on ouvre l'export, on recopie les lignes en écart, on reformule les commentaires, on relit, on envoie. Une heure et demie, tous les lundis, et le résultat n'est jamais deux fois pareil.",
      apres:
        "La même compilation pilotée par une instruction écrite une fois pour toutes. La sortie est identique d'une semaine à l'autre, les lignes incomplètes sont signalées au lieu d'être complétées, et ce qui reste à vérifier est listé en bas.",
      prompt:
        "Voici l'extrait de tableau de suivi ci-joint (jeu de démonstration, aucune donnée réelle).\nProduis la synthèse hebdomadaire en respectant exactement ce format :\n1. Un tableau à trois colonnes — dossier, état, écart par rapport à la semaine précédente.\n2. Sous le tableau, trois lignes au maximum sur ce qui a bougé.\n3. Une dernière ligne intitulée « à vérifier avant envoi ».\nN'ajoute aucun commentaire, aucune recommandation, aucune donnée absente du fichier. Si une ligne est incomplète, écris « à vérifier » dans la colonne concernée au lieu de la compléter toi-même.",
      outil:
        "Un seul outil, celui validé dans la salle — et c'est le même pendant les deux journées.",
      gain: { avant: "1 h 30", apres: "12 min" },
      captureEcran:
        "Les deux sorties côte à côte, avec surlignage des trois lignes que la version manuelle a reformulées différemment d'une semaine à l'autre, et de la mention « à vérifier » que la version pilotée fait apparaître.",
      verifieLe: VERIFIE_LE,
      dureeMin: 20,
      notes: {
        script:
          "Chronométrez la version manuelle DEVANT la salle, au moins sur trois lignes, et extrapolez à voix haute — le chiffre du kit a été mesuré, ne l'inventez pas. Faites remarquer que la sortie manuelle change de formulation chaque semaine : c'est ce défaut-là que l'automatisation corrige, pas la vitesse. Dites dès maintenant que le fichier projeté est un jeu de démonstration et qu'aucune donnée réelle ne sera collée avant que le régime d'usage soit décidé.",
        faq: [
          {
            question: "Pourquoi toujours le même outil sur les deux jours ?",
            reponse:
              "Parce qu'une instruction qui marche ici ne marche pas identiquement ailleurs. On apprend à choisir l'outil cet après-midi ; en attendant, on garde une seule référence pour que tout le monde compare la même chose.",
          },
          {
            question: "Et si l'outil change son interface la semaine prochaine ?",
            reponse:
              "L'instruction, elle, ne change pas — c'est ce que vous emportez. Les captures du kit sont datées pour qu'on sache quand elles sont à refaire.",
          },
        ],
        blocages: [
          {
            situation: "La sortie pilotée invente une valeur malgré la consigne.",
            parade:
              "Ne le cachez pas, gardez-le à l'écran : c'est la première preuve, dès la vingtième minute, que le point de relecture humaine n'est pas une précaution mais une pièce de la chaîne.",
          },
          {
            situation: "Quelqu'un propose de rejouer la démonstration sur son propre export.",
            parade:
              "Refuser en une phrase : « on ne colle rien de réel avant d'avoir décidé le régime, et c'est la séquence suivante ». Lui proposer de le noter comme candidat pour l'après-midi.",
          },
        ],
        planB:
          "Quota atteint ou service indisponible : les deux sorties sont imprimées dans le kit formateur, datées, avec le chronométrage de la version manuelle. La comparaison se tient à l'identique sur papier, et le chiffre affiché reste vrai puisqu'il a été mesuré.",
      },
    },
    pratique: {
      consigne:
        "Deux temps. D'abord, chacun situe le régime dans lequel il travaille RÉELLEMENT aujourd'hui — compte grand public, offre entreprise avec engagement de non-réutilisation, ou environnement validé par votre informatique — puis écrit ce qu'il faudrait obtenir, et de qui nommément, pour passer au régime supérieur. Ensuite, chacun passe ses propres tâches répétitives au test des 4 questions et remplit la grille fournie : une ligne par tâche, avec la conséquence tirée en clair — information des salariés, consultation du CSE, analyse d'impact, ou arrêt.",
      aEmporter:
        "La fiche de régime d'usage complétée, avec le nom de la personne à qui demander le passage au régime supérieur, et la grille des 4 questions remplie ligne par ligne sur vos propres tâches.",
      dureeMin: 65,
      notes: {
        script:
          "Ouvrez l'atelier par la règle et répétez-la mot pour mot : le régime d'usage se décide AVANT de brancher quoi que ce soit, parce qu'une automatisation ne relit pas un document, elle avale un flux — ce qui entre entre à chaque exécution. Rien de nominatif ne transite sans décision explicite ; tant que la décision n'est pas prise, on travaille sur les jeux du kit. Sur la grille : exigez la CONSÉQUENCE écrite en clair, pas seulement la case cochée — une case cochée ne se relit pas dans six mois. Vous n'arbitrez aucune question juridique ni de sécurité : « je ne me prononce pas, notez la question, votre conseil tranchera ».",
        faq: [
          {
            question: "On peut coller un extrait de notre fichier clients pour tester ?",
            reponse:
              "Non, pas aujourd'hui. Le kit fournit un jeu équivalent en structure. Quand vous aurez arrêté votre régime et obtenu ce qu'il faut, vous rejouerez la même chose chez vous.",
          },
          {
            question: "Si je retire les noms, ce n'est plus une donnée personnelle ?",
            reponse:
              "Non — on le montre juste après, on ré-identifie en direct un fichier « anonymisé » du kit. Retirer les noms ne fait pas sortir un fichier du champ du règlement, et un document sous clause de confidentialité reste confidentiel.",
          },
          {
            question: "Ma tâche ressort en feu orange, je fais quoi concrètement ?",
            reponse:
              "Vous l'écrivez sur la ligne « conséquence » : ce qu'il faut déclencher, et auprès de qui. Le feu orange n'est pas un refus, c'est une étape à franchir avant de brancher.",
          },
        ],
        blocages: [
          {
            situation: "Un participant colle un export nominatif réel dans l'outil.",
            parade:
              "Arrêter immédiatement, sans négocier, faire fermer la conversation et rappeler la règle en une phrase. C'est le seul point des deux jours où l'on ne discute pas.",
          },
          {
            situation:
              "La salle veut savoir si tel usage précis est autorisé dans leur entreprise.",
            parade:
              "Formule exacte, prononcée telle quelle : « je ne me prononce pas, notez la question, votre conseil tranchera ». Écrivez la question au tableau — la liste des questions ouvertes est une production utile des deux jours.",
          },
          {
            situation: "Quelqu'un ne trouve aucune tâche répétitive à inscrire.",
            parade:
              "Reprendre sa réponse du tour de table, écrite au tableau, et la lui rendre : « vous avez dit que vous refaisiez ça toutes les semaines, commençons par là ».",
          },
        ],
        planB:
          "Aucun outil n'est nécessaire : la fiche de régime et la grille des 4 questions se remplissent au stylo sur les imprimés du kit. Le seul repli à prévoir est le fichier « anonymisé » de la ré-identification, fourni en version papier avec les trois recoupements déjà entourés.",
      },
    },
    verification: {
      question:
        "Par table : classez les six automatisations fournies dans le kit en feu vert, feu orange ou feu rouge, et justifiez chaque classement par la question du test qui l'a décidé. Correction en plénière au corrigé écrit du guide d'animation.",
      reponseAttendue:
        "Chaque table rend six classements JUSTIFIÉS par une des 4 questions, pas par une impression. Le corrigé donne la couleur attendue de chacune et la question déterminante ; les écarts entre tables sont commentés, et c'est là que se joue l'apprentissage.",
      dureeMin: 35,
      notes: {
        script:
          "Vous LISEZ le corrigé, vous ne tranchez rien en direct : il est écrit mot pour mot dans le guide, précisément pour que vous n'ayez pas à arbitrer devant la salle. Faites justifier AVANT d'annoncer la couleur — une table qui a la bonne couleur pour la mauvaise raison n'a rien acquis. Les deux cas volontairement discutables du kit servent à montrer que la couleur dépend de la mise en œuvre, pas de l'intitulé.",
        faq: [
          {
            question: "Deux tables ont classé la même automatisation différemment, qui a raison ?",
            reponse:
              "Souvent les deux, parce qu'elles n'ont pas supposé la même mise en œuvre. Faites-leur dire leur hypothèse : c'est elle qui change la couleur, et c'est l'enseignement du cas.",
          },
          {
            question: "On aura une correction écrite à emporter ?",
            reponse:
              "Oui, le corrigé est remis en fin de séquence, avec la fiche du feu tricolore qui fait règle pendant les deux jours.",
          },
        ],
        blocages: [
          {
            situation: "Une table conteste le corrigé sur un point de droit.",
            parade:
              "Ne pas argumenter : « je ne me prononce pas, notez la question, votre conseil tranchera ». Noter la question au tableau et passer au cas suivant.",
          },
          {
            situation: "Les six cas sont expédiés en dix minutes, sans justification.",
            parade:
              "Reprendre le premier cas et exiger la question déterminante à l'oral. Le rythme retombe immédiatement, et la salle comprend que la couleur seule ne vaut rien.",
          },
        ],
        planB:
          "Les six cas et le corrigé sont imprimés dans le kit. Sans vidéoprojecteur, la correction se fait au paperboard, une colonne par couleur.",
      },
    },
    synthese: {
      acquis: [
        "Je décide le régime d'usage avant de brancher quoi que ce soit, et rien de nominatif ne transite sans décision explicite.",
        "Je passe une tâche au test des 4 questions et j'écris la conséquence qu'elle déclenche.",
        "Je classe une automatisation au feu tricolore avant d'y consacrer une heure de travail.",
      ],
      dureeMin: 10,
      notes: {
        script:
          "Faites-les FORMULER, ne récitez pas : « en une phrase, quelle tâche venez-vous de faire passer au feu rouge, et pourquoi ? ». Trois réponses suffisent. Remettez la fiche du feu tricolore en main propre et annoncez qu'elle fait règle jusqu'à demain soir. Annoncez l'après-midi : on cartographie, on choisit l'outil, et on sort avec un cas cadré.",
        faq: [
          {
            question: "Le feu rouge, c'est définitif ?",
            reponse:
              "Non, c'est une couleur pour aujourd'hui. Elle change le jour où la mise en œuvre change — un contrôle humain ajouté fait passer bien des rouges en orange.",
          },
        ],
        blocages: [
          {
            situation: "Personne ne parle, la salle a faim et il est midi passé.",
            parade:
              "Ne pas insister : énoncer les trois acquis vous-même, remettre la fiche et libérer. Un acquis formulé à contrecœur ne s'ancre pas mieux.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 2 — Après-midi J1 : cartographier ses tâches et cadrer son cas
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-2",
    objectif: {
      enonce:
        "À la fin de ce module, vous avez trié vos tâches répétitives sur quatre critères, retenu un cas, et produit sa fiche de cadrage nommée — entrée, étapes, sortie, point de relecture humaine, régime de données et outil.",
      objectifGlobalId: "obj-1",
      // La fiche de cadrage EST la conception du processus (obj-2), et la
      // séquence de comparaison des trois familles d'outils fait réellement
      // choisir l'outil de la journée du lendemain (obj-3).
      objectifsSecondairesIds: ["obj-2", "obj-3"],
      dureeMin: 10,
      notes: {
        script:
          "Annoncez la sortie de l'après-midi comme un état, pas comme une activité : à 17 h 45, chacun a une fiche de cadrage écrite, nommée, enregistrée, et passée au feu vert du matin. Dites pourquoi : demain matin on construit, et une construction qui commence par « alors, qu'est-ce que j'automatise déjà ? » perd la matinée. Précisez que le tri se fait sur quatre critères et pas sur l'envie : volume, répétition, stabilité des règles, coût de l'erreur.",
        faq: [
          {
            question: "Je peux cadrer deux cas au lieu d'un ?",
            reponse:
              "Non. Un seul, terminé, vaut mieux que deux esquissés — vous n'en construirez qu'un demain de toute façon. Notez le second sur la feuille de route de demain soir.",
          },
        ],
        blocages: [
          {
            situation: "La salle veut passer directement à la construction.",
            parade:
              "Une phrase : « demain matin, ceux qui n'ont pas de fiche passeront la matinée à en écrire une pendant que les autres construisent ». Personne n'insiste.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "Une fiche de cadrage bâclée tient en trois mots : « automatiser le reporting ». Donnée telle quelle à l'IA, elle produit un plan générique, plausible, qui ne tient devant aucune de vos données réelles — et on ne s'en aperçoit qu'en essayant de le monter.",
      apres:
        "La même demande, décrite entrée par entrée : d'où viennent les données, quelles étapes dans quel ordre, quelle sortie attendue, où un humain relit, à quel signal on arrête. L'IA cesse de deviner et rend la liste numérotée de ce qui lui manque encore.",
      prompt:
        "Je vais te décrire un processus que je répète chaque semaine. Reformule-le en fiche de cadrage, entrée par entrée, sans rien inventer, et signale explicitement chaque information qui te manque.\nEntrée : d'où viennent les données, sous quel format, qui les produit, à quelle fréquence.\nÉtapes : ce que je fais, dans l'ordre, avec la règle appliquée à chacune.\nSortie : ce qui doit être produit, pour qui, sous quel format.\nPoint de relecture humaine : à quel endroit un humain doit lire avant que la sortie parte, et ce qu'il regarde exactement.\nArrêt : à quel signal la chaîne doit s'arrêter, et qui peut l'arrêter.\nTermine par la liste numérotée des informations qui te manquent pour que cette fiche soit exécutable. N'invente aucune valeur par défaut.",
      outil: "Un seul outil, celui validé dans la salle — le même que ce matin.",
      captureEcran:
        "Les deux sorties côte à côte, avec en marge de la version bâclée les six éléments que l'IA a inventés faute de description, et en marge de la version cadrée la liste numérotée des informations manquantes qu'elle réclame.",
      verifieLe: VERIFIE_LE,
      dureeMin: 20,
      notes: {
        script:
          "Lancez la version bâclée en premier et laissez la salle trouver le plan « pas mal » — c'est le piège, et il faut qu'ils y tombent. Puis demandez : « combien de ces lignes tiennent devant vos vraies données ? ». Sur la version cadrée, insistez sur les deux entrées que personne n'écrit spontanément : le point de relecture humaine et l'arrêt. Dites-le tel quel : ce sont des entrées de la fiche, au même titre que la sortie attendue, pas des précautions qu'on ajoute à la fin.",
        faq: [
          {
            question: "La liste des informations manquantes, c'est l'IA qui la trouve ?",
            reponse:
              "Elle la trouve parce que la structure de la demande l'y oblige. Sans les cinq entrées, elle comble les trous silencieusement — c'est exactement ce que fait la version bâclée.",
          },
          {
            question: "On peut réutiliser ce prompt tel quel chez nous ?",
            reponse:
              "Oui, il est dans votre support et c'est fait pour. Les cinq lignes se remplacent une par une, processus par processus.",
          },
        ],
        blocages: [
          {
            situation: "La version bâclée rend un plan tellement générique que la salle décroche.",
            parade:
              "L'exploiter : demandez à quelqu'un de lire l'étape 3 à voix haute et de dire si elle correspond à son service. Le silence fait la démonstration mieux que vous.",
          },
          {
            situation: "L'IA remplit d'elle-même le point de relecture avec une phrase creuse.",
            parade:
              "Montrez-la et faites-la corriger en direct par la salle : « qui relit, et il regarde quoi ? ». Une relecture sans titulaire et sans critère n'est pas un contrôle.",
          },
        ],
        planB:
          "Les deux sorties sont imprimées dans le kit, datées, avec les annotations de marge déjà appliquées. La comparaison se tient à l'identique sur papier.",
      },
    },
    pratique: {
      consigne:
        "Trois temps. D'abord, cartographiez sur la trame fournie les tâches que vous refaites chaque semaine, notées sur quatre critères — volume, répétition, stabilité des règles, coût de l'erreur — et retenez-en trois candidates. Ensuite, confrontez ces trois candidates à la fiche comparative des trois familles d'outils (assistant conversationnel, espace de travail persistant, chaînage entre applications) et retenez l'outil de votre journée de demain — ou basculez sur le cas de repli commun pré-monté si aucun de vos cas n'est accessible depuis la salle. Enfin, rédigez la fiche de cadrage de votre cas : entrée, étapes, sortie attendue, point de relecture humaine, qui relit, régime de données retenu, outil visé, couleur au feu tricolore.",
      aEmporter:
        "Votre cartographie notée sur quatre critères, la fiche comparative des trois familles annotée de votre choix et de son motif, et LA fiche de cadrage de votre cas — nommée, enregistrée, prête à être ouverte demain matin.",
      dureeMin: 115,
      notes: {
        script:
          "Enseignez les trois familles pour de vrai, elles ne sont pas un décor. UN — l'assistant conversationnel : rien ne persiste, vous recollez le contexte à chaque fois ; excellent pour apprendre et pour les cas mensuels, mauvais pour ce qui revient chaque lundi. DEUX — l'espace de travail persistant : les fichiers de référence et l'instruction restent en place, vous rejouez sans tout recoller ; c'est là que se monte la majorité des cas de la salle. TROIS — le chaînage entre applications : ça part tout seul, sans que personne ouvre quoi que ce soit — donc c'est la famille qui exige impérativement un point d'arrêt et un contrôle, et c'est pour ça qu'on la montre sans la monter en salle. Faites écrire le MOTIF du choix sur la fiche comparative, pas seulement le nom retenu : un choix sans motif ne se défend pas devant son informatique. Sur la fiche de cadrage : passez dans les rangs, relancez sur les deux entrées qu'on saute toujours — qui relit, et comment on arrête. Ne rédigez à la place de personne.",
        faq: [
          {
            question:
              "Le chaînage entre applications est justement ce qui nous intéresse, pourquoi ne pas le monter ?",
            reponse:
              "Parce qu'un chaînage monté à la va-vite en salle repart chez vous et tourne sans surveillance — c'est exactement le scénario qu'on apprend à ne pas produire. Vous le voyez en démonstration, et vous repartez avec la fiche de cadrage qui permettra à votre informatique de le monter proprement.",
          },
          {
            question: "Comment je choisis entre les deux premières familles ?",
            reponse:
              "Par la fréquence et par le volume de contexte. Si vous devez recoller les mêmes trois fichiers à chaque exécution, l'espace persistant a déjà gagné. Sinon l'assistant suffit, et il coûte moins cher à mettre en place.",
          },
          {
            question:
              "Aucun de mes cas n'est accessible depuis la salle, mes fichiers sont bloqués.",
            reponse:
              "Prenez le cas de repli commun pré-monté du kit. Vous apprendrez la même chose, et vous rejouerez chez vous avec vos fichiers — votre fiche de cadrage, elle, reste la vôtre.",
          },
        ],
        blocages: [
          {
            situation:
              "Quelqu'un cadre un cas manifestement trop gros pour être monté en une matinée.",
            parade:
              "Ne pas refuser le cas : lui faire entourer UNE étape sur sa fiche et cadrer celle-là. « Vous montez cette étape demain, le reste est votre feuille de route. » Un cas amputé qui tourne enseigne plus qu'un cas entier qui échoue.",
          },
          {
            situation: "Les cases « qui relit » et « comment on arrête » restent vides.",
            parade:
              "Une seule question, posée fiche en main : « la sortie est fausse, elle part au client, qui s'en aperçoit et à quel moment ? ». La case se remplit seule.",
          },
          {
            situation:
              "Un binôme choisit son outil par habitude, sans ouvrir la fiche comparative.",
            parade:
              "Leur demander de justifier par un critère de la fiche. S'ils n'en trouvent aucun, c'est que le choix n'est pas fait — le leur dire et les renvoyer à la comparaison.",
          },
        ],
        planB:
          "Réseau tombé : la cartographie, la fiche comparative et la fiche de cadrage sont toutes des imprimés du kit et se remplissent au stylo. Seule la démonstration de reformulation par l'IA saute, et elle n'est pas nécessaire à l'atelier — ce qui compte est la structure de la fiche, pas l'outil qui l'a reformulée. Prévenez alors que la fiche devra être ressaisie ce soir ou demain à l'ouverture, sinon la matinée 2 démarre sans support numérique.",
      },
    },
    verification: {
      question:
        "Passage en binôme avec la grille de faille fournie : dans la fiche de l'autre, cherchez une donnée personnelle oubliée, un contrôle absent, une sortie invérifiable, un salarié suivi sans le savoir, une règle instable. Chaque fiche repart annotée de la main du binôme.",
      reponseAttendue:
        "Les cinq failles passées en revue sur chaque fiche, et au moins une annotation portée par le relecteur. Une fiche rendue vierge est refusée : le corrigé montre que les cinq failles se trouvent dans plus de la moitié des fiches d'une session.",
      dureeMin: 25,
      notes: {
        script:
          "Contrôle CROISÉ, jamais auto-correction : chacun relit la fiche du voisin, stylo en main. Exigez au moins une annotation par fiche et annoncez que vous en demanderez une à l'oral — la complaisance tombe immédiatement. La faille la plus fréquente est la quatrième : un tableau de suivi d'activité contient des personnes, et personne ne le voit avant qu'on le dise.",
        faq: [
          {
            question: "Ma fiche est annotée partout, c'est mauvais signe ?",
            reponse:
              "C'est exactement l'inverse : une fiche annotée ce soir est une automatisation qui ne dérapera pas demain. Les fiches vierges sont celles qui inquiètent.",
          },
        ],
        blocages: [
          {
            situation: "Les binômes se valident mutuellement sans rien relever.",
            parade:
              "Distribuer la fiche piégée du kit, qui contient les cinq failles, et faire chercher trois minutes. L'œil se règle, et le passage croisé reprend sérieusement.",
          },
          {
            situation: "Un désaccord de binôme porte sur un point de sécurité informatique.",
            parade:
              "Ne pas trancher : « je ne me prononce pas, notez la question, votre conseil ou votre informatique tranchera ». Porter la question sur la fiche comme point ouvert.",
          },
        ],
        planB:
          "Grille de faille, fiche piégée et corrigé sont imprimés dans le kit. Aucun outil nécessaire.",
      },
    },
    synthese: {
      acquis: [
        "Je note une tâche répétitive sur quatre critères avant de décider de l'automatiser.",
        "Je choisis une famille d'outil et j'écris le motif de ce choix, défendable devant mon informatique.",
        "J'écris le point de relecture humaine et le moyen d'arrêter dès le cadrage, pas après.",
      ],
      dureeMin: 10,
      notes: {
        script:
          "Faites NOMMER le fichier à voix haute, tous ensemble : « cadrage-<votre cas>-<date> », enregistré, et pas seulement écrit. Dites pourquoi sans l'atténuer : demain matin on ouvre cette fiche et on construit ; ceux qui repartent avec une intention dans la tête au lieu d'un fichier nommé recommenceront à froid et perdront la construction. Faites lister à voix haute ce que chacun rapporte demain — fichiers d'entrée, accès, au moins trois jeux d'entrées dont un bancal. Et dites ce qui se passe si la journée 2 est reportée : la fiche de cadrage reste valable, elle se rejoue telle quelle, c'est justement pourquoi on la nomme.",
        faq: [
          {
            question: "Si je ne peux pas apporter mes vrais fichiers demain ?",
            reponse:
              "Dites-le maintenant, pas demain matin : on vous bascule ce soir sur le cas de repli pré-monté. Un participant sans entrées demain matin immobilise sa matinée.",
          },
          {
            question: "Combien de jeux d'entrées faut-il apporter ?",
            reponse:
              "Trois au minimum, dont un volontairement bancal — une ligne vide, une date au mauvais format, une colonne manquante. C'est celui-là qui fera le plus travailler demain.",
          },
        ],
        blocages: [
          {
            situation: "Il est 17 h 45 et trois fiches ne sont pas terminées.",
            parade:
              "Faire terminer les deux entrées critiques — sortie attendue et point de relecture — et enregistrer sous un nom, même incomplet. Une fiche nommée à 80 % s'ouvre demain ; une fiche parfaite restée dans la tête, non.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 3 — Matin J2 : construire le prototype
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-3",
    objectif: {
      enonce:
        "À la fin de ce module, votre automatisation tourne sur trois jeux d'entrées réels, dont un bancal, et vous avez consigné chaque écart dans un journal de tests.",
      objectifGlobalId: "obj-4",
      // L'instruction qui pilote la chaîne est la mise en oeuvre de la
      // conception cadrée la veille : construire, c'est finir de concevoir.
      objectifsSecondairesIds: ["obj-2"],
      dureeMin: 10,
      notes: {
        script:
          "Ouvrez la journée en faisant OUVRIR la fiche de cadrage, physiquement, sur chaque écran, avant tout autre geste. Dix minutes de reprise ici évitent une matinée à la dérive. Annoncez le critère de fin de matinée sans l'adoucir : à midi, ça tourne sur un vrai jeu d'entrées, pas sur un exemple inventé. Répétez la formule qui tient la journée : ce qui n'a pas été testé sur des cas réels n'est pas un prototype, c'est une intention.",
        faq: [
          {
            question: "J'ai retravaillé ma fiche hier soir, je peux changer de cas ?",
            reponse:
              "Changer d'étape à l'intérieur du même cas, oui. Changer de cas, non : vous repartiriez sans cadrage et vous perdriez la matinée. Notez le nouveau cas pour la feuille de route de ce soir.",
          },
        ],
        blocages: [
          {
            situation: "Deux personnes arrivent sans fichier d'entrée.",
            parade:
              "Les basculer immédiatement sur le cas de repli commun pré-monté, sans commentaire ni reproche. Le temps passé à improviser une entrée est du temps volé à toute la salle.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "On écrit l'instruction qui pilote l'automatisation « au feeling », en une phrase, et on la relance en la retouchant à chaque essai. Elle finit par marcher sur l'exemple du jour, et elle casse sur le fichier de la semaine suivante sans qu'on sache ce qui a changé.",
      apres:
        "La même instruction écrite avec les cinq leviers AXION, montée devant la salle de bout en bout. Les deux premiers essais échouent, on montre pourquoi et on corrige à l'écran — c'est cette correction, et pas la version finale, qui est l'enseignement.",
      prompt:
        "Acteur : tu es l'assistant qui exécute cette tâche hebdomadaire à ma place, toujours de la même façon.\nConteXte : je reçois chaque lundi un export de suivi au format tableur, produit par notre outil de gestion, une ligne par dossier et cinq colonnes fixes.\nIntention : produire la synthèse envoyée au comité de pilotage.\nOutput : d'abord un tableau des dossiers en écart, puis trois puces au maximum sur ce qui a bougé, puis une ligne « points à vérifier avant envoi ».\nNormes : n'ajoute aucun chiffre absent de l'export ; si une colonne manque ou si une ligne est vide, ne devine pas — écris « donnée manquante » et poursuis ; ne formule aucune recommandation ; termine toujours par la ligne « relu par : ______ le ______ », que je remplis à la main avant tout envoi.",
      outil: "Un seul outil, celui validé dans la salle — le même depuis hier matin.",
      captureEcran:
        "Les trois états successifs à l'écran : le premier essai qui invente deux chiffres absents de l'export, le deuxième qui les remplace par « donnée manquante » mais perd le tableau, et la version finale conforme aux cinq leviers.",
      verifieLe: VERIFIE_LE,
      dureeMin: 25,
      notes: {
        script:
          "Écrivez AXION au tableau et laissez-le affiché toute la journée : Acteur, conteXte, Intention, Output, Normes. MONTREZ LES DEUX ESSAIS RATÉS, ne les escamotez pas : la salle doit voir qu'une automatisation qui marche est une automatisation qui a échoué deux fois devant témoin. Insistez sur la ligne Normes, c'est elle qui empêche l'outil de combler les trous ; et sur la dernière phrase de l'Output — « relu par », qui matérialise le point de relecture humaine dans la sortie elle-même.",
        faq: [
          {
            question: "Pourquoi faire écrire « relu par » par l'outil, on peut le mettre après ?",
            reponse:
              "Parce qu'une ligne vide dans la sortie se voit, et qu'une bonne intention ne se voit pas. Tant que la ligne n'est pas remplie, tout le monde sait que le document n'est pas diffusable.",
          },
          {
            question: "Les cinq leviers, c'est obligatoire à chaque fois ?",
            reponse:
              "Pour une instruction qu'on rejoue chaque semaine, oui. C'est ce qui la rend stable d'une exécution à l'autre — et la stabilité est tout l'intérêt d'automatiser.",
          },
        ],
        blocages: [
          {
            situation:
              "Les deux essais ratés réussissent, l'outil rend directement une bonne sortie.",
            parade:
              "Le dire franchement : « il a bien travaillé cette fois, et vous n'aviez aucun moyen de le savoir à l'avance » — puis afficher les deux essais ratés du kit, capturés et datés. L'enseignement tient entier.",
          },
          {
            situation: "La salle recopie l'instruction au lieu de l'adapter à son cas.",
            parade:
              "Faire remplacer les cinq lignes une par une, à voix haute, sur le cas d'un volontaire. La transposition se comprend en trois minutes et pas en la décrivant.",
          },
        ],
        planB:
          "Quota atteint : les trois états de la démonstration sont imprimés dans le kit, datés, y compris les deux essais ratés avec leurs annotations. Le montage se commente à l'identique sur papier, et l'instruction reste recopiable.",
      },
    },
    pratique: {
      consigne:
        "Deux temps. D'abord, construisez votre prototype pas à pas sur le cas cadré hier — ou sur le cas de repli commun pré-monté du kit si le vôtre bloque, afin que personne n'immobilise la salle. Ensuite, faites-le tourner sur TROIS jeux d'entrées différents, dont un volontairement bancal (ligne vide, date au mauvais format, colonne manquante), et consignez chaque écart dans le journal de tests : quel jeu, quel écart constaté, ce que vous avez changé dans l'instruction.",
      aEmporter:
        "Votre prototype qui tourne, l'instruction AXION qui le pilote enregistrée à part, et le journal de tests renseigné sur les trois jeux d'entrées.",
      dureeMin: 100,
      notes: {
        script:
          "Répétez la formule en ouvrant le second temps, elle est le cœur de la journée : ce qui n'a pas été testé sur des cas réels n'est pas un prototype, c'est une intention. Le jeu bancal n'est pas une punition — c'est le seul des trois qui vous dise comment la chaîne se comporte quand elle ne comprend pas, et c'est ce comportement-là qu'on emportera cet après-midi dans les contrôles. Faites CONSIGNER pendant, jamais après : un écart reconstitué de mémoire à midi est un écart perdu. Passez dans les rangs, dépannez, ne construisez à la place de personne — un prototype monté par le formateur n'est pas reprenable par son propriétaire.",
        faq: [
          {
            question: "Mon PDF ressort vide quand je le dépose.",
            reponse:
              "C'est un scan sans texte reconnu, la première des trois causes vues avant l'atelier. Photographiez-le page par page ou récupérez l'export d'origine ; le contournement est sur votre support.",
          },
          {
            question: "Mon tableau se désaligne totalement à la copie.",
            reponse:
              "Recollez colonne par colonne, ou exportez en valeurs séparées. Puis redemandez « reconstitue ce tableau, une ligne par ligne, sans rien fusionner ».",
          },
          {
            question: "Ça marche sur mes trois jeux, je fais quoi du temps restant ?",
            reponse:
              "Un quatrième jeu, plus méchant : deux lignes en double, un montant en texte. Ce que vous trouvez maintenant, vous ne le découvrirez pas en production.",
          },
        ],
        blocages: [
          {
            situation: "Un participant s'acharne quarante minutes sur un accès qui ne s'ouvre pas.",
            parade:
              "Trancher à sa place : bascule sur le cas de repli pré-monté, tout de suite. Il apprendra la même chose et rejouera chez lui. Fixez-vous une limite de dix minutes par blocage d'accès.",
          },
          {
            situation: "Le journal de tests reste vide, tout le monde construit sans consigner.",
            parade:
              "Arrêter la salle deux minutes et faire écrire la ligne du dernier écart, tout de suite, à voix haute. Sans ce journal, la chasse à l'erreur de tout à l'heure n'a rien à mordre.",
          },
          {
            situation: "Quelqu'un veut passer directement à un chaînage entre applications.",
            parade:
              "Rappeler la règle des ateliers, sans négocier : le chaînage reste en démonstration et ne se monte pas en salle. Sa fiche de cadrage permettra à son informatique de le monter proprement.",
          },
        ],
        planB:
          "Service indisponible : le kit fournit les sorties du cas de repli pour les trois jeux d'entrées, imprimées et datées, y compris celle du jeu bancal. L'atelier se poursuit sur papier — repérer les écarts, écrire ce qu'on changerait dans l'instruction, remplir le journal de tests. C'est moins satisfaisant, mais le journal reste vrai et se rejouera chez eux à l'identique.",
      },
    },
    verification: {
      question:
        "Chasse à l'erreur sur votre PROPRE sortie : surlignez tout ce qui est faux, inventé ou invérifiable, et comptez. Les comptes sont mis en commun au tableau, puis la salle nomme les trois erreurs les plus fréquentes de la matinée.",
      reponseAttendue:
        "Un compte écrit par personne, reporté au tableau, et trois erreurs nommées collectivement — le plus souvent une valeur comblée à la place de « donnée manquante », un total recalculé au lieu d'être repris, et une reformulation qui change le sens d'un commentaire.",
      dureeMin: 30,
      notes: {
        script:
          "Faites compter AVANT de commenter, et écrivez tous les comptes au tableau, y compris les zéros. La salle sous-estime toujours, et un tableau où l'on lit « 0, 0, 4, 7, 2 » enseigne plus que n'importe quel discours sur la vigilance : les zéros sont ceux qui n'ont pas encore regardé. C'est ici que la règle des deux jours devient évidente — une chaîne qui tourne sans relecture ne fait pas moins d'erreurs, elle en refait les mêmes chaque semaine. Dites-le à ce moment précis, la salle vient de le constater sur sa propre sortie.",
        faq: [
          {
            question: "Je n'ai trouvé aucune erreur, c'est bon signe ?",
            reponse:
              "Pas encore. Échangez votre sortie avec votre voisin et cherchez dans la sienne : on repère mal ce qu'on a produit soi-même. Si vous n'en trouvez toujours aucune, la sortie est probablement trop courte pour être utile.",
          },
        ],
        blocages: [
          {
            situation: "Personne ne veut afficher son compte, la salle craint le jugement.",
            parade:
              "Commencer par le vôtre, sur la démonstration du matin, et annoncer un chiffre non nul. Les comptes suivent.",
          },
          {
            situation: "Un participant conteste qu'une valeur soit « inventée ».",
            parade:
              "Une seule question : « elle figure où, exactement, dans le fichier d'entrée ? ». Ouvrir le fichier avec lui. La contestation tombe ou la valeur est validée, dans les deux cas c'est réglé.",
          },
        ],
        planB:
          "Sans outil, la chasse se fait sur les sorties imprimées du cas de repli, qui contiennent des erreurs plantées et vérifiées. Le comptage au tableau et la mise en commun sont identiques.",
      },
    },
    synthese: {
      acquis: [
        "J'écris une instruction d'automatisation avec les cinq leviers AXION, rejouable sans être réécrite.",
        "Je fais tourner mon prototype sur un jeu d'entrées bancal avant de le croire fiable.",
        "Je consigne chaque écart dans un journal de tests pendant le test, pas après.",
      ],
      dureeMin: 15,
      notes: {
        script:
          "Trois colonnes au tableau et faites-les remplir par la salle : ce qui a marché du premier coup, ce qui a demandé trois essais, ce qui ne passera jamais. La troisième colonne est la plus utile et la plus vite expédiée — creusez-la, elle nourrit la feuille de route de ce soir. Annoncez l'après-midi en une phrase : « ça tourne, mais personne d'autre que vous ne sait le reprendre, ni l'arrêter — c'est ce qu'on règle après le déjeuner ».",
        faq: [
          {
            question: "Ce qui n'a pas marché ce matin, on l'abandonne ?",
            reponse:
              "Non, il passe dans la troisième colonne et il ressort ce soir sur votre feuille de route, avec un porteur et une échéance. Ce n'est pas un échec, c'est un cas qui demande autre chose que deux heures d'atelier.",
          },
        ],
        blocages: [
          {
            situation: "La troisième colonne reste vide, tout le monde dit que tout a marché.",
            parade:
              "Reprendre les comptes de la chasse à l'erreur, affichés juste avant. Ils contredisent la colonne vide et la conversation redémarre seule.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 4 — Après-midi J2 : fiabiliser, mettre en service, décider de la suite
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-4",
    objectif: {
      enonce:
        "À la fin de ce module, votre automatisation est reprenable par quelqu'un d'autre que vous : quatre contrôles posés, une fiche d'usage contresignée, et une feuille de route où chaque prochaine automatisation porte un porteur et une échéance.",
      objectifGlobalId: "obj-5",
      dureeMin: 10,
      notes: {
        script:
          "Posez le critère de la demi-journée sous forme d'épreuve, pas de promesse : à 17 h, votre voisin fera tourner votre automatisation sans vous, avec votre seule fiche. Tout ce qu'il devra vous demander est un manque. Annoncez aussi que rien de ce qui a été construit ce matin ne part en production cet après-midi : on rend reprenable, on ne met pas en service dans la salle.",
        faq: [
          {
            question: "On va vraiment mettre ça en production en sortant ?",
            reponse:
              "Pas en sortant. Vous sortez avec un prototype fiabilisé, une fiche d'usage et l'information due identifiée. La mise en service se décide chez vous, avec les personnes qui doivent en être informées.",
          },
        ],
        blocages: [
          {
            situation: "Un participant considère que son prototype est déjà fini.",
            parade:
              "Lui proposer d'être le premier au test de reprise à blanc de 17 h. Il redemande une heure de travail dans les cinq minutes.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "La même automatisation que ce matin, sans point de relecture : une ligne vide dans l'entrée, un total recalculé de travers, et la synthèse fausse part au destinataire. Personne ne s'en aperçoit, et elle repartira fausse la semaine suivante, à l'identique.",
      apres:
        "La même chaîne avec l'instruction de contrôle en tête de sortie. L'écart de volume est détecté, la synthèse n'est pas affichée, et la ligne « relu par » reste vide tant qu'un humain n'a pas signé — le document n'est pas diffusable et cela se voit.",
      prompt:
        "Avant de me rendre la sortie, exécute ce contrôle et écris-en le résultat en tête de réponse :\n1. Compte les lignes de l'entrée et celles de la sortie. Si les deux nombres diffèrent, écris « ÉCART DE VOLUME » et n'affiche pas la synthèse.\n2. Relève toute valeur que tu as complétée, déduite ou reformulée, et liste-la sous « à confirmer par un humain ».\n3. Si une date, un montant ou un nom ne figure pas tel quel dans l'entrée, écris « NON VÉRIFIÉ » juste à côté.\n4. Termine par la ligne « relu par : ______ le ______ ». Tant que cette ligne est vide, la sortie n'est pas diffusable.",
      outil: "Un seul outil, celui validé dans la salle — le même depuis hier matin.",
      captureEcran:
        "Les deux sorties côte à côte, avec en rouge le total faux parti au destinataire dans la première, et dans la seconde le bandeau « ÉCART DE VOLUME » qui a bloqué l'affichage de la synthèse.",
      verifieLe: VERIFIE_LE,
      dureeMin: 20,
      notes: {
        script:
          "Faites la version sans contrôle d'abord, et LAISSEZ PARTIR la sortie fausse à l'écran sans la commenter. Attendez que quelqu'un dise ce qui cloche. C'est le moment le plus utile des deux jours et il ne se force pas. Puis énoncez la règle telle quelle : une automatisation qui tourne sans surveillance ne fait pas moins d'erreurs, elle amplifie les siennes — la même erreur repart chaque semaine, à l'identique, sans que personne la relise. D'où deux pièces obligatoires dans toute chaîne : un point de relecture humaine, et un moyen de l'arrêter.",
        faq: [
          {
            question: "Le contrôle, c'est encore l'IA qui le fait — on ne tourne pas en rond ?",
            reponse:
              "En partie, et c'est pour ça qu'il n'est pas suffisant. Il attrape les écarts mécaniques, volume et valeurs comblées ; la ligne « relu par » attrape le reste, et elle n'est signable que par un humain.",
          },
          {
            question: "Un contrôle qui bloque l'affichage, ça ne va pas bloquer tout le service ?",
            reponse:
              "Il bloque la diffusion, pas le travail. Et une sortie bloquée qu'on regarde coûte infiniment moins cher qu'une sortie fausse qu'on envoie.",
          },
        ],
        blocages: [
          {
            situation: "Personne ne repère l'erreur dans la sortie non contrôlée.",
            parade:
              "Ne pas la désigner tout de suite : afficher l'entrée à côté et laisser trente secondes de plus. Quand quelqu'un la trouve enfin, le silence qui précède vaut toute la démonstration.",
          },
          {
            situation: "L'instruction de contrôle est jugée trop longue à écrire.",
            parade:
              "Rappeler qu'elle s'écrit UNE fois et se rejoue chaque semaine, et qu'elle est dans le support, recopiable telle quelle.",
          },
        ],
        planB:
          "Les deux sorties sont imprimées dans le kit, datées, avec le total faux entouré et le bandeau de blocage visible. La démonstration se tient à l'identique sur papier.",
      },
    },
    pratique: {
      consigne:
        "Trois temps. D'abord, posez les quatre contrôles sur votre propre prototype à partir de la grille fournie : le point de relecture humaine, le comportement en cas de sortie anormale, le signal d'alerte, et la trace de qui a validé quoi et quand. Ensuite, rédigez la fiche d'usage sur la trame fournie — à quoi ça sert, sur quelles données, qui relit, quand on l'arrête — et complétez les champs variables de l'information due aux personnes concernées. Enfin, la feuille de route : classez vos prochaines automatisations au feu tricolore, mettez-les en ordre, nommez un porteur et une échéance pour chacune, et isolez celles qui doivent remonter à la direction ou au CSE avant d'être lancées.",
      aEmporter:
        "Votre prototype avec ses quatre contrôles posés, la fiche d'usage complétée, les trames d'information renseignées en projet, et la feuille de route où chaque ligne porte un nom et une date.",
      dureeMin: 100,
      notes: {
        script:
          "Sur les quatre contrôles, le troisième est celui qu'on saute : le signal d'alerte. Posez la question à chacun : « la chaîne s'arrête à 6 h du matin, qui l'apprend, comment, et en combien de temps ? ». Sur la fiche d'usage : seuls les champs variables se remplissent, l'en-tête « Projet — à faire valider par votre conseil avant diffusion » reste apparent et ne se retire pas. Vous n'arbitrez AUCUNE question juridique ni de sécurité : « je ne me prononce pas, notez la question, votre conseil tranchera ». Sur la feuille de route, refusez toute ligne sans porteur et sans date — une automatisation sans porteur ne se fait pas, elle se raconte.",
        faq: [
          {
            question: "Cette information, on peut l'envoyer aux salariés dès lundi ?",
            reponse:
              "Non. C'est un projet, l'en-tête le dit. Votre conseil la valide, puis vous la diffusez. Notez sur votre feuille de route la date à laquelle vous la lui envoyez.",
          },
          {
            question: "Qui doit tenir la trace des validations ?",
            reponse:
              "Celui qui exploite, pas celui qui contrôle. Une ligne par exécution diffusée : qui a relu, quand, ce qui a été corrigé avant envoi.",
          },
          {
            question:
              "Ma chaîne ne touche aucune donnée de salarié, la fiche est quand même utile ?",
            reponse:
              "Oui, et pour une autre raison : c'est elle qui rend la chaîne reprenable quand vous êtes absent. Le test de tout à l'heure le montrera.",
          },
        ],
        blocages: [
          {
            situation: "Le champ « quand on l'arrête » est rempli par « si ça ne marche plus ».",
            parade:
              "Faire préciser un critère observable : combien d'écarts, sur combien d'exécutions, constatés par qui. Une condition d'arrêt qu'on ne peut pas constater n'arrête rien.",
          },
          {
            situation: "Un participant veut que vous validiez son analyse de conformité.",
            parade:
              "Formule exacte : « je ne me prononce pas, notez la question, votre conseil tranchera ». Porter la question sur sa feuille de route comme un point bloquant avant lancement.",
          },
          {
            situation: "La feuille de route se remplit de dix lignes sans priorité.",
            parade:
              "Faire barrer tout ce qui dépasse trois lignes pour le trimestre. Une feuille de route à dix lignes est une liste d'envies, pas un plan.",
          },
        ],
        planB:
          "Grille des quatre contrôles, trame de fiche d'usage, trames d'information et trame de feuille de route sont toutes imprimées dans le kit et se remplissent au stylo. Seule la pose effective du contrôle dans l'outil saute : elle se décrit alors par écrit sur la fiche, et se rejoue chez soi en dix minutes.",
      },
    },
    verification: {
      question:
        "Deux temps. Test de reprise à blanc : votre binôme fait tourner VOTRE automatisation avec votre seule fiche d'usage, sans vous — toute question qu'il doit vous poser est notée comme un manque à combler, puis la fiche est contresignée. Puis l'évaluation des acquis : quiz individuel de dix questions et grille d'auto-évaluation de votre prototype — contrôle humain, traçabilité, régime de données, reprenabilité, couleur au feu tricolore.",
      reponseAttendue:
        "Une fiche d'usage contresignée par le binôme, avec la liste écrite des questions qu'il a dû poser et le complément apporté à chacune. Puis le quiz corrigé question par question en salle ; le seuil de réussite est celui déclaré au programme, et un score en dessous déclenche la reprise individuelle prévue au dispositif.",
      dureeMin: 50,
      notes: {
        script:
          "Sur la reprise à blanc, tenez la règle : l'auteur se TAIT. S'il parle, l'épreuve ne vaut rien et la fiche ressort creuse. Faites écrire chaque question posée sur la fiche elle-même — c'est la liste des manques, et elle est plus précieuse que la fiche. Sur le quiz : c'est l'évaluation des acquis au sens de l'indicateur 11, elle se tient, se corrige et se conserve. Ne la sacrifiez jamais au temps qui manque ; si vous êtes en retard, coupez sur la feuille de route, pas ici.",
        faq: [
          {
            question: "Mon binôme n'a pas réussi à faire tourner mon automatisation.",
            reponse:
              "Alors vous venez d'apprendre la chose la plus utile de la journée, et vous savez exactement quoi compléter. Une chaîne que vous seul savez lancer n'existe que tant que vous êtes là.",
          },
          {
            question: "Le résultat du quiz est transmis à mon employeur ?",
            reponse:
              "Le résultat individuel, non. Ce qui est transmis, c'est l'attestation de fin de formation et le fait que l'évaluation a eu lieu.",
          },
        ],
        blocages: [
          {
            situation: "L'auteur souffle les réponses à son binôme pendant la reprise.",
            parade:
              "Le faire changer de place, sans dramatiser : « allez voir la table d'à côté cinq minutes ». La fiche parle enfin d'elle-même.",
          },
          {
            situation: "Il est 17 h 15 et le quiz n'est pas commencé.",
            parade:
              "Le tenir quand même, en réduisant le commentaire du corrigé aux questions les plus ratées. On ne remplace jamais l'évaluation des acquis par un tour de table.",
          },
        ],
        planB:
          "Quiz papier et corrigé sont dans le kit. Si l'outil est indisponible, la reprise à blanc se fait « à la lecture » : le binôme énonce à voix haute chaque geste qu'il ferait à partir de la fiche, et bute exactement aux mêmes endroits.",
      },
    },
    synthese: {
      acquis: [
        "Je pose un point de relecture humaine et un moyen d'arrêter dans toute chaîne que je monte.",
        "Je rends une automatisation reprenable par un tiers, et je le vérifie en la lui faisant lancer sans moi.",
        "Je classe mes prochaines automatisations au feu tricolore, avec un porteur et une échéance.",
      ],
      dureeMin: 15,
      notes: {
        script:
          "Reprenez le tableau du tour de table d'hier matin, celui des tâches refaites à la main, et montrez ce que les deux jours ont couvert ET ce qu'ils n'ont pas couvert — l'honnêteté sur le second point achète la crédibilité du premier. Remettez le dossier d'exploitation en main propre, pièce par pièce, en les nommant : fiche de cadrage, instruction, journal de tests, grille des quatre contrôles, fiche d'usage contresignée, feuille de route. Terminez par un engagement à voix haute par personne : quelle automatisation, quel porteur, quelle date. Notez au tableau, photographiez, envoyez la photo au groupe.",
        faq: [
          {
            question: "On peut vous rappeler si ça casse dans trois semaines ?",
            reponse:
              "Le dossier d'exploitation est fait pour que vous n'ayez pas à le faire : le journal de tests dit ce qui avait été essayé, et la fiche d'usage dit qui relit. Commencez toujours par les rouvrir.",
          },
        ],
        blocages: [
          {
            situation: "Les engagements restent vagues : « je vais continuer à creuser ».",
            parade:
              "Reformuler en une question : « quelle automatisation, et quel jour ? ». Ne pas passer au suivant tant que la réponse ne porte pas un nom et une date.",
          },
          {
            situation: "La salle veut prolonger sur les cas non traités et il est 18 h.",
            parade:
              "Les renvoyer à la troisième colonne du tableau de ce matin et à leur feuille de route. Tout y est déjà écrit, avec un porteur — c'est précisément à ça qu'elle sert.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },
];
