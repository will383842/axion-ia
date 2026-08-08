/**
 * CONTENU RÉDIGÉ — « IA pour les équipes » (1 jour, 7 h, 4 modules).
 *
 * ## Ce qui distingue cette formation des formations métier
 *
 * Le livrable n'est pas individuel : c'est un MODE D'EMPLOI COMMUN, écrit par
 * le service et validé par chacun. Toute la journée y converge — la liste de ce
 * qui ne sort jamais au module 1, les demandes éprouvées au module 2, la
 * méthode de série au module 3, les points de contrôle au module 4.
 *
 * Conséquence pour l'animation : ce qui est produit individuellement doit être
 * VERSÉ au mode d'emploi à la fin de chaque module. Un formateur qui l'oublie
 * obtient quatre modules réussis et aucun livrable d'équipe.
 *
 * ## Le repère de temps du module 1
 *
 * Chacun refait sans IA une tâche récurrente, en notant son temps. Ce chiffre
 * n'est pas un exercice : c'est la référence contre laquelle le module 2 se
 * mesure. Sans lui, « on gagne du temps » reste une impression.
 */

import type { EnrichissementFormation } from "./types";

/** Date de dernière vérification des captures et sorties d'outils. */
const VERIFIE_LE = "2026-08-06";

export const IA_POUR_LES_EQUIPES: EnrichissementFormation = [
  // ───────────────────────────────────────────────────────────────────────────
  // Module 1 — Le cadre commun
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-1",
    objectif: {
      enonce:
        "À midi, vous nommez le régime d'usage de chacun de vos documents, vous appliquez la liste commune du service, et vous savez ce qui ne sort jamais.",
      objectifGlobalId: "obj-5",
      dureeMin: 5,
      notes: {
        script:
          "Annoncez le livrable de la journée dès la première minute : le service repart avec UN mode d'emploi écrit, pas avec sept méthodes personnelles. C'est ce qui distingue cette formation d'une formation individuelle, et ça change la façon dont la salle travaille.",
        faq: [
          {
            question: "On va tous devoir faire pareil ?",
            reponse:
              "Non. Vous allez écrire ensemble ce qui doit être commun — ce qui ne sort jamais, ce qui se relit — et garder vos façons de faire pour le reste.",
          },
        ],
        blocages: [
          {
            situation: "Une partie de l'équipe pense être là « en observateur ».",
            parade:
              "Le dire tout de suite : le mode d'emploi de ce soir engage le service, donc il se signe par tout le monde. Personne ne regarde travailler.",
          },
        ],
        planB: "Aucun outil en jeu : l'annonce du livrable se tient au paperboard.",
      },
    },
    demonstration: {
      avant:
        "Un cas apporté par la salle, traité par une demande vague : la sortie est correcte, générique, et ne reflète ni le service ni son vocabulaire.",
      apres:
        "Le même cas, avec le contexte du service et ses contraintes : la sortie devient utilisable telle quelle, et ce qui reste à vérifier devient visible.",
      prompt:
        "Tu es [le rôle exact de la personne qui a apporté le cas]. Contexte : [ce que l'outil ignore de la situation — taille du service, destinataire, historique]. Objectif : [ce que le texte doit produire chez le lecteur]. Format : [longueur, structure, ton]. Interdits : n'invente aucun chiffre, aucune date, aucun nom ; si une information te manque, écris [À COMPLÉTER] plutôt que de la deviner.",
      outil: "L'outil unique tenu toute la journée.",
      captureEcran:
        "Les deux sorties côte à côte, avec les mentions [À COMPLÉTER] surlignées dans la seconde.",
      verifieLe: VERIFIE_LE,
      dureeMin: 15,
      notes: {
        script:
          "Prenez un cas RÉELLEMENT apporté par la salle, pas votre exemple. La démonstration vaut par le fait que c'est leur sujet. Faites remarquer les [À COMPLÉTER] : c'est la ligne la plus utile du prompt, elle transforme une invention en question.",
        faq: [
          {
            question: "Pourquoi lui demander d'écrire [À COMPLÉTER] plutôt que de chercher ?",
            reponse:
              "Parce qu'il ne cherchera pas : il comblera. Un trou signalé se remplit ; un trou comblé passe inaperçu.",
          },
        ],
        blocages: [
          {
            situation: "Personne ne propose de cas.",
            parade:
              "Le kit en fournit trois, déjà anonymisés. Ne perdez pas cinq minutes à insister — reprenez-en un et avancez.",
          },
        ],
        planB:
          "Les deux sorties du cas de secours sont imprimées dans le kit (datées). La comparaison se tient à l'identique.",
      },
    },
    pratique: {
      consigne:
        "Chacun réalise une tâche récurrente de sa semaine COMME D'HABITUDE, sans IA — en notant son temps et le nombre d'allers-retours. Ce chiffre est votre repère personnel : c'est contre lui que vous mesurerez l'après-midi.",
      aEmporter:
        "Votre temps de référence sur une tâche réelle, noté — la seule mesure honnête du gain.",
      dureeMin: 15,
      notes: {
        script:
          "Insistez sur « comme d'habitude ». La tentation est de bien faire, donc de faire plus lentement. Chronométrez à voix haute et notez les temps au tableau : le module 2 s'y réfère explicitement, et un tableau vide rendrait le gain invérifiable.",
        faq: [
          {
            question: "Ma tâche prend deux heures, je ne peux pas la faire en quinze minutes.",
            reponse:
              "Faites-en le début, et notez le temps du début. On compare des morceaux comparables, pas des totaux.",
          },
        ],
        blocages: [
          {
            situation: "Quelqu'un dit ne pas avoir de tâche récurrente.",
            parade:
              "Poser une seule question : « qu'avez-vous écrit deux fois cette semaine ? ». Il y a toujours une réponse.",
          },
        ],
        planB: "Aucun outil : c'est justement l'exercice sans IA.",
      },
    },
    verification: {
      question:
        "Arbitrage collectif des dix situations fournies, tranchées une par une : ce qui peut sortir, ce qui ne sort qu'en régime entreprise, ce qui ne sort jamais.",
      reponseAttendue:
        "Les dix situations tranchées et INSCRITES sur la liste commune du service — c'est la première pièce du mode d'emploi, elle ne reste pas au tableau.",
      dureeMin: 25,
      notes: {
        script:
          "Tranchez une par une, à main levée, et écrivez la décision. Le désaccord est le moment utile : c'est là que le service découvre qu'il n'avait pas la même règle. Ne l'écourtez pas, mais tranchez — une liste sans décision ne sert à rien.",
        faq: [
          {
            question: "Et si on n'est pas d'accord ?",
            reponse:
              "On note les deux positions et la question part à qui décide chez vous. Ce qui n'est pas tranché ce soir est tranché par écrit la semaine prochaine.",
          },
        ],
        blocages: [
          {
            situation: "Un responsable présent impose sa réponse et la salle se tait.",
            parade:
              "Faire voter à main levée AVANT qu'il ne parle, sur les trois situations suivantes. L'ordre de parole décide de tout.",
          },
        ],
        planB: "Les dix situations et leur corrigé sont imprimés dans le kit.",
      },
    },
    synthese: {
      acquis: [
        "Je nomme le régime d'usage de chacun de mes documents.",
        "J'applique la liste commune du service, écrite ce matin.",
        "Je repère une demande qui introduit un biais avant de la lancer.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites verser la liste au mode d'emploi, physiquement : une feuille nommée, avec la date et les présents. Un livrable d'équipe qui reste au tableau n'existera plus lundi.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 2 — AXION poussé
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-2",
    objectif: {
      enonce:
        "En sortant de ce module, vous obtenez un résultat au format exact attendu, sans passer dix minutes à le retoucher.",
      objectifGlobalId: "obj-1",
      objectifsSecondairesIds: ["obj-3"],
      dureeMin: 3,
      notes: {
        script:
          "Rappelez le temps noté au module 1 et annoncez que c'est contre lui qu'on se mesure dans trente-cinq minutes. Sans ce rappel, l'atelier redevient un exercice.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "Une demande AXION correcte, mais qui laisse le format libre : la sortie est bonne et demande dix minutes de remise en forme.",
      apres:
        "La même demande avec un exemple de sortie fourni et des critères de refus : le format est juste du premier coup, et il est reproductible.",
      prompt:
        "Même demande que précédemment, avec en plus :\nFORMAT ATTENDU — reproduis exactement cette structure :\n« Objet : … | Contexte en une phrase : … | Trois points, un par ligne, commençant par un verbe : … | Prochaine étape avec une date : … »\nCRITÈRES DE REFUS — ne rends pas ta réponse si elle contient un superlatif, un chiffre que je ne t'ai pas donné, ou plus de 180 mots.",
      outil: "L'outil unique tenu toute la journée.",
      captureEcran:
        "Les deux sorties, avec la structure imposée surlignée dans la seconde pour montrer qu'elle est suivie littéralement.",
      verifieLe: VERIFIE_LE,
      dureeMin: 15,
      notes: {
        script:
          "Le levier qui surprend le plus est l'EXEMPLE DE SORTIE : montrez qu'un modèle vaut mieux qu'une description. Les critères de refus viennent ensuite — ils sont ce qui rend la demande transmissible à un collègue.",
        faq: [
          {
            question: "Ça fait un prompt très long.",
            reponse:
              "Il est long une fois. Vous le réutilisez ensuite en changeant deux lignes — c'est exactement l'objectif « construire et réutiliser » que vous avez acheté.",
          },
        ],
        blocages: [
          {
            situation: "L'outil ne respecte pas le format imposé.",
            parade:
              "Ne pas réécrire tout : relancer avec « ta réponse ne suit pas la structure demandée, refais-la en la suivant littéralement ». C'est la démonstration du principe de relance.",
          },
        ],
        planB: "Les deux sorties sont imprimées dans le kit (datées).",
      },
    },
    pratique: {
      consigne:
        "Deux tours. D'abord, refaites la tâche chronométrée du module 1 avec une demande AXION complète, et retouchez jusqu'au format exact attendu — puis notez votre nouveau temps. Ensuite, ajoutez les critères de refus, faites critiquer la sortie par l'outil lui-même, et corrigez vous-même ce que la critique a laissé passer.",
      aEmporter:
        "Votre demande AXION éprouvée, au format exact, réutilisable telle quelle — et votre nouveau temps en face de l'ancien.",
      dureeMin: 55,
      notes: {
        script:
          "Faites écrire le nouveau temps À CÔTÉ de l'ancien, au tableau, nom par nom. C'est le seul moment de la journée où le gain devient un chiffre, et c'est ce chiffre qui sera cité à la direction. Sur le second tour : insistez pour que la critique de l'outil soit RELUE, pas appliquée telle quelle — il critique aussi mal qu'il rédige.",
        faq: [
          {
            question: "Mon temps n'a pas baissé.",
            reponse:
              "Alors la tâche n'était pas la bonne, ou la demande n'est pas encore réutilisable. Les deux se corrigent — dites-moi laquelle et on regarde ensemble.",
          },
          {
            question: "Faire critiquer par l'outil, ce n'est pas se mordre la queue ?",
            reponse:
              "En partie, oui. C'est pour ça qu'on corrige nous-mêmes ce que la critique a laissé passer — elle sert à faire un premier tri, pas à valider.",
          },
        ],
        blocages: [
          {
            situation: "Quelqu'un retouche indéfiniment sans jamais s'arrêter.",
            parade:
              "Une règle annoncée d'avance : trois relances maximum, puis on garde et on note ce qui manque. La perfection au troisième essai n'est pas l'objectif.",
          },
        ],
        planB:
          "Réseau tombé : les cinq leviers s'appliquent à la main sur la trame papier, et chacun relancera chez lui. La structure de la demande est ce qui compte, pas l'outil qui l'exécute.",
      },
    },
    verification: {
      question:
        "Contrôle croisé en binôme : votre voisin rejoue VOTRE demande sur son propre cas, sans connaître votre contexte. Qu'est-ce qui ne tient pas une fois sorti de votre tête ?",
      reponseAttendue:
        "Tout ce qui supposait un contexte implicite est réécrit sur place. Une demande qui ne se transmet pas à un collègue n'est pas réutilisable — c'est la définition retenue.",
      dureeMin: 17,
      notes: {
        script:
          "C'est le test qui compte : une demande qui marche pour son auteur et pour personne d'autre n'est pas un actif du service. Faites réécrire sur place, pas « plus tard ».",
        faq: [],
        blocages: [
          {
            situation: "Les binômes se déclarent mutuellement satisfaits en deux minutes.",
            parade:
              "Imposer de rejouer RÉELLEMENT la demande sur le cas du voisin, outil ouvert. Le verdict tombe seul.",
          },
        ],
        planB:
          "L'échange se tient sur papier : la demande se lit et se critique sans être exécutée.",
      },
    },
    synthese: {
      acquis: [
        "J'impose un format et je fournis un exemple de sortie.",
        "Je reconnais une demande qui ne se transmet pas à un collègue.",
        "Je relance avec une précision au lieu de tout recommencer.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites verser au mode d'emploi les demandes qui ont passé le contrôle croisé — celles-là seulement. Le mode d'emploi n'accueille que ce qui a été éprouvé par quelqu'un d'autre que son auteur.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 3 — Passer d'un cas à toute une série
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-3",
    objectif: {
      enonce:
        "En sortant, vous produisez une série de documents homogènes à partir d'un tableau, au lieu de les écrire un par un — et vous savez la contrôler.",
      objectifGlobalId: "obj-2",
      objectifsSecondairesIds: ["obj-3"],
      dureeMin: 3,
      notes: {
        script:
          "Annoncez le renversement : jusqu'ici on a amélioré un document, maintenant on change d'échelle. Et annoncez le risque dans la même phrase : une erreur qui se duplique quinze fois.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "Le même document écrit une fois à la main, correctement — puis quatorze fois de plus, à la main, avec les variations de formulation que cela produit.",
      apres:
        "Le tableau fourni devient quinze documents homogènes en une passe : même structure, mêmes mentions, seules les données varient.",
      prompt:
        "Voici un tableau de quinze lignes. Pour CHAQUE ligne, produis un document suivant exactement ce modèle :\n[coller ici le document validé au module 2]\nRègles : ne modifie la structure sur aucune ligne ; n'ajoute aucune information absente du tableau ; si une cellule est vide, écris [DONNÉE MANQUANTE] et poursuis ; numérote chaque document par la valeur de la première colonne.",
      outil: "L'outil unique tenu toute la journée.",
      captureEcran:
        "La sortie de série, avec deux documents mis côte à côte pour montrer que la structure est identique.",
      verifieLe: VERIFIE_LE,
      dureeMin: 15,
      notes: {
        script:
          "Montrez d'abord ce que le [DONNÉE MANQUANTE] produit : c'est le garde-fou de la série. Sans lui, une cellule vide devient une invention, répétée autant de fois qu'il y a de lignes.",
        faq: [
          {
            question: "Et si le tableau contient des noms de clients ?",
            reponse:
              "Alors il ne sort pas — c'est la liste de ce matin. Le kit fournit un tableau neutre pour l'atelier, et vous appliquerez chez vous dans le régime que vous avez retenu.",
          },
        ],
        blocages: [
          {
            situation: "La sortie s'arrête à la cinquième ligne.",
            parade:
              "Normal sur les longues séries : relancer avec « poursuis à partir de la ligne 6, même modèle ». Le montrer est utile — la salle le rencontrera.",
          },
        ],
        planB: "La série de démonstration est imprimée dans le kit (datées).",
      },
    },
    pratique: {
      consigne:
        "Deux temps. En binôme : produisez une série de quinze documents à partir du tableau fourni — ou du vôtre s'il ne contient aucune donnée personnelle — en partant du document validé au module 2. Puis, seul : les trois exercices de tableur fournis avec leur corrigé — faire écrire une formule, faire expliquer un croisement, décrire une structure de données.",
      aEmporter:
        "Une série de quinze documents homogènes, et vos trois formules commentées — versées au mode d'emploi comme méthode du service.",
      dureeMin: 52,
      notes: {
        script:
          "Sur la série : passez vérifier que le document de base vient bien du module 2. Ceux qui repartent d'une demande improvisée obtiennent une série improvisée quinze fois. Sur le tableur : les corrigés sont fournis, votre rôle est de faire EXPLIQUER la formule obtenue, pas de la valider.",
        faq: [
          {
            question: "Je ne sais pas si la formule est juste.",
            reponse:
              "Demandez-lui de l'expliquer ligne à ligne, puis testez-la sur trois cas dont vous connaissez le résultat. C'est la méthode, et elle vaut pour toutes vos formules.",
          },
        ],
        blocages: [
          {
            situation: "Un binôme veut utiliser son vrai fichier client.",
            parade:
              "Refuser, sans négocier, en renvoyant à la liste écrite ce matin par eux-mêmes. C'est le moment où le mode d'emploi prouve son utilité.",
          },
        ],
        planB:
          "Le tableau et la série attendue sont imprimés : l'exercice devient une lecture critique de la série fournie, ce qui prépare le contrôle par échantillon.",
      },
    },
    verification: {
      question:
        "Contrôle par échantillon : trois exemplaires tirés au hasard dans la série du binôme voisin — même format ? mêmes mentions obligatoires ? Puis une erreur est glissée dans une série, à retrouver.",
      reponseAttendue:
        "Les trois exemplaires validés sur les mêmes critères, et l'erreur glissée retrouvée. Le point à retenir : sur une série, on ne relit pas tout — on tire au sort, et on cherche ce qui se répète.",
      dureeMin: 25,
      notes: {
        script:
          "Glissez l'erreur vous-même, discrètement, dans une seule série. Le moment où la salle comprend qu'elle a validé quinze documents sans la voir vaut tous les discours sur la relecture.",
        faq: [
          {
            question: "Il faut donc tout relire ?",
            reponse:
              "Non — c'est impossible et vous ne le ferez pas. Vous tirez trois exemplaires au sort et vous cherchez ce qui se RÉPÈTE. Une erreur unique coûte peu ; une erreur systématique coûte quinze fois.",
          },
        ],
        blocages: [
          {
            situation: "Personne ne trouve l'erreur glissée.",
            parade:
              "Ne pas la donner tout de suite : dire dans quel exemplaire elle se trouve et laisser trente secondes. La trouver soi-même change le souvenir.",
          },
        ],
        planB: "Les séries et l'erreur glissée sont dans le kit.",
      },
    },
    synthese: {
      acquis: [
        "Je produis une série homogène à partir d'un tableau.",
        "Je contrôle par échantillon au lieu de tout relire.",
        "Je repère l'erreur qui se duplique quinze fois.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Versez au mode d'emploi la méthode de contrôle par échantillon — c'est la pièce que le service oubliera le plus vite s'il ne l'écrit pas.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 4 — Le mode d'emploi commun
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-4",
    objectif: {
      enonce:
        "En sortant, le service dispose d'un mode d'emploi écrit que chacun a validé, et sait qui relit quoi.",
      objectifGlobalId: "obj-4",
      dureeMin: 3,
      notes: {
        script:
          "Sortez les pièces versées depuis ce matin et posez-les sur la table : la liste, les demandes éprouvées, la méthode de série. Le module 4 n'ajoute pas, il assemble — dites-le, ça change le rythme.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "La même demande envoyée seule : la sortie ignore le vocabulaire du service, ses formats et ses interdits.",
      apres:
        "La même demande accompagnée des documents de référence du service et des consignes communes : la sortie parle comme le service et respecte ses règles.",
      prompt:
        "Voici trois documents de référence de notre service et notre liste de consignes communes. Prends-les comme seule source de vocabulaire, de format et d'interdits. Produis maintenant [la demande éprouvée au module 2] en t'y conformant strictement, et signale par [HORS RÉFÉRENTIEL] tout ce que tu dois ajouter sans y trouver d'appui.",
      outil: "L'outil unique tenu toute la journée.",
      captureEcran:
        "Les deux sorties, avec les mentions [HORS RÉFÉRENTIEL] visibles dans la seconde.",
      verifieLe: VERIFIE_LE,
      dureeMin: 12,
      notes: {
        script:
          "C'est la démonstration qui justifie le mode d'emploi : sans référentiel fourni, l'outil invente un vocabulaire. Avec, il emprunte le vôtre. Le [HORS RÉFÉRENTIEL] montre exactement ce que votre documentation ne couvre pas encore.",
        faq: [
          {
            question: "On doit lui donner nos documents à chaque fois ?",
            reponse:
              "Oui, et c'est pourquoi le mode d'emploi liste LESQUELS. Trois bien choisis suffisent ; c'est ce que vous allez écrire dans trente minutes.",
          },
        ],
        blocages: [
          {
            situation: "Le service n'a aucun document de référence à fournir.",
            parade:
              "C'est une découverte utile, pas un échec : notez-la, elle devient la première ligne de leur feuille de route.",
          },
        ],
        planB: "Les deux sorties sont imprimées dans le kit (datées).",
      },
    },
    pratique: {
      consigne:
        "Deux temps. L'équipe rédige son mode d'emploi commun : la liste « ce qui ne sort jamais » du matin, les trois demandes AXION éprouvées par un autre que leur auteur, la méthode de contrôle par échantillon, et les quatre points de relecture. Puis la feuille de route : les trois usages que l'équipe tient la semaine prochaine, ce qu'elle ne fera pas, qui relance, et à quelle date on refait le point.",
      aEmporter:
        "Le mode d'emploi commun du service, signé par les présents — et la feuille de route avec un nom et une date par ligne.",
      dureeMin: 50,
      notes: {
        script:
          "Faites ÉCRIRE, pas discuter. Donnez la trame et un rôle à chacun : un rédacteur, un lecteur, un qui tient le temps. Sur la feuille de route : refusez toute ligne sans nom et sans date — « on va essayer » n'est pas un engagement. Faites signer, photographiez, envoyez au groupe avant de partir.",
        faq: [
          {
            question: "Qui met à jour ce document ensuite ?",
            reponse:
              "C'est une des lignes à écrire. Sans titulaire, un mode d'emploi meurt en trois semaines — et vous le savez déjà pour d'autres documents.",
          },
        ],
        blocages: [
          {
            situation: "La rédaction tourne au débat de principe sur l'IA.",
            parade:
              "Recentrer sur une question factuelle : « quelle ligne écrivez-vous ? ». Le débat se note à part, il ne bloque pas le livrable.",
          },
          {
            situation: "Le responsable veut emporter le document pour « le finaliser ».",
            parade:
              "Le laisser faire, mais faire signer la VERSION DU JOUR avant. Un document emporté non signé ne revient pas.",
          },
        ],
        planB: "La rédaction se fait entièrement sur papier — c'est même préférable.",
      },
    },
    verification: {
      question:
        "Évaluation des acquis : quiz individuel de dix questions corrigé en salle, puis relecture croisée d'une production du jour à la grille commune — exactitude, ton, mentions dues, réutilisabilité.",
      reponseAttendue:
        "Le corrigé est commenté question par question, sans en sauter. La relecture croisée se fait sur la grille que l'équipe vient d'écrire — c'est son premier usage réel.",
      dureeMin: 15,
      notes: {
        script:
          "L'évaluation des acquis se tient, se corrige et se conserve : c'est la première pièce qu'un auditeur demande. Si vous êtes en retard, coupez ailleurs — jamais ici.",
        faq: [],
        blocages: [
          {
            situation: "Il est 17 h 15 et le quiz n'est pas commencé.",
            parade:
              "Le tenir quand même, en réduisant le commentaire aux questions les plus ratées. On ne remplace jamais l'évaluation par un tour de table.",
          },
        ],
        planB: "Quiz et corrigé imprimés dans le kit.",
      },
    },
    synthese: {
      acquis: [
        "J'applique la règle commune écrite par le service.",
        "Je fais relire par la bonne personne avant de diffuser.",
        "Je relance un usage sans attendre une nouvelle formation.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Terminez par la date du point de suivi, dite à voix haute et notée par tout le monde. Une formation d'équipe sans rendez-vous suivant se dissout en quinze jours.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
  },
];
