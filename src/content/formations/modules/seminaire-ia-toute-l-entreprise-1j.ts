/**
 * CONTENU RÉDIGÉ — « Séminaire IA — Mettre toute l'entreprise au diapason »
 * (1 jour, 4 modules, jusqu'à 50 participants en tables de 6 à 8).
 *
 * ## Ce n'est PAS une formation métier, et l'animation change de nature
 *
 * Il n'y a pas un poste par personne, pas d'accompagnement écran par écran, pas
 * de public homogène. Il y a une PLÉNIÈRE et des TABLES — une table par service
 * autant que possible — devant un formateur qui pilote seul l'outil au
 * vidéoprojecteur. Dans la salle : des gens qui n'ont jamais ouvert un outil
 * d'IA, des gens qui s'en servent tous les jours sans l'avoir dit à personne, et
 * des sceptiques déclarés qui sont venus parce que c'était obligatoire. Ce
 * mélange est la matière première de la journée, pas son problème.
 *
 * ## Le livrable est COLLECTIF : le classeur de bord
 *
 * L'entreprise ne repart pas avec cinquante fiches individuelles. Elle repart
 * avec UN classeur de bord, construit page par page devant tout le monde :
 *
 *  - module 1 → la règle commune de chaque table, puis la règle commune de
 *    l'entreprise écrite au tableau et recopiée ;
 *  - module 2 → la photographie réelle des usages, une page par service ;
 *  - module 3 → les demandes AXION qui ont survécu au test d'un autre service ;
 *  - module 4 → les astuces transposées, les trois engagements de chaque
 *    service, et le nom du référent IA désigné devant la salle.
 *
 * ⚠️ Conséquence pour l'animation, et c'est LA note à ne pas manquer : à chaque
 * synthèse, ce qui vient d'être produit se VERSE au classeur, physiquement,
 * daté, avec le nom du service. Un formateur qui l'oublie obtient une très belle
 * journée, cinquante personnes contentes, et aucun livrable. Les scripts des
 * cinq synthèses le répètent — ils sont écrits pour être lus tels quels.
 *
 * ## L'ouverture par la direction décide de toute la journée
 *
 * L'engagement écrit de non-usage disciplinaire — rien de ce qui sera déclaré
 * aujourd'hui ne servira à sanctionner qui que ce soit — est lu à voix haute par
 * la direction, signé devant la salle, projeté, puis remis à chaque table. Ce
 * n'est pas un préambule de courtoisie : c'est ce qui décide si le sondage de
 * fin de matinée dira la vérité ou pas. Si la direction l'expédie, le refuse ou
 * ne le signe pas, le sondage du module 2 NE SE TIENT PAS, et le formateur le
 * dit au dirigeant à la première pause, sans détour.
 *
 * ## Le sondage est protégé par agrégation, et ça s'explique AVANT
 *
 * Réponses agrégées par service ; aucun service de moins de cinq réponses n'est
 * affiché ; rien de nominatif ; aucune reprise individuelle. Cette mécanique
 * s'énonce avant la première question, pas après : c'est elle qui rend les
 * réponses honnêtes. Un formateur qui sonde d'abord et rassure ensuite obtient
 * un résultat poli et faux.
 *
 * ## Deux règles que le formateur ne négocie pas
 *
 * **Aucune donnée personnelle réelle n'entre dans l'outil**, y compris dans les
 * réponses libres du sondage : le formateur relit l'export et biffe tout nom
 * AVANT de le coller. Les usages mis hors jeu le matin — recrutement,
 * évaluation des salariés, toute décision portant sur une personne — ne sont ni
 * déclarés, ni pratiqués, ni retenus en feuille de route.
 *
 * **Le formateur n'arbitre aucune question juridique.** La formule est écrite,
 * elle se prononce telle quelle : « je ne me prononce pas, notez la question,
 * votre conseil tranchera ». Elle sert aussi bien pour le règlement européen que
 * pour la charte, le règlement intérieur ou le CSE.
 *
 * ⚠️ Les références juridiques des séquences de cadre (obligations de
 * transparence, obligation de formation, usages à haut risque) sont fournies au
 * formateur SOURCÉES ET DATÉES dans le kit, et ne se citent jamais de mémoire.
 * Leur formulation reste à faire relire par le conseil de l'organisme.
 */

import type { EnrichissementFormation } from "./types";

/** Date de dernière vérification des captures et sorties d'outils. */
const VERIFIE_LE = "2026-08-06";

export const SEMINAIRE_IA_TOUTE_L_ENTREPRISE_1J: EnrichissementFormation = [
  // ───────────────────────────────────────────────────────────────────────────
  // Module 1 — Socle commun et garde-fous (125 min dont 40 hors blocs)
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-1",
    objectif: {
      enonce:
        "À la fin de ce module, vous dites en une phrase ce qu'une IA générative fait bien et où elle invente, et vous nommez ce qui ne sort jamais de l'entreprise sans avoir à demander à personne.",
      objectifGlobalId: "obj-1",
      // Le tri des douze cartes, la grille de correction et la liste des usages
      // mis hors jeu installent les règles de sécurité et le cadre légal : c'est
      // le même module qui les porte, sans rattachement forcé.
      objectifsSecondairesIds: ["obj-2"],
      dureeMin: 5,
      notes: {
        script:
          "L'ouverture par la direction vient d'avoir lieu : vérifiez, avant de commencer, que l'engagement de non-usage disciplinaire a été LU à voix haute, SIGNÉ devant la salle et remis à chaque table. S'il a été expédié, résumé ou seulement projeté, dites-le au dirigeant à la première pause et prévenez-le que le sondage de 11 h ne se tiendra pas — un sondage sans cette signature ne récolte que des réponses polies. Affichez ensuite les six acquis au mur, en grand, et annoncez qu'ils seront cochés un par un devant tout le monde. Dites le livrable dès la première minute : « ce soir, l'entreprise repart avec UN classeur de bord, pas cinquante fiches ». Terminez par la phrase qui désamorce : « personne ici n'est en retard sur personne, et personne n'est obligé d'être convaincu à 17 h 30 ».",
        faq: [
          {
            question: "Je n'ai jamais ouvert un de ces outils, je vais suivre ?",
            reponse:
              "Oui. Vous ne toucherez à aucun clavier de la journée sauf votre téléphone pour le sondage et le QCM. Tout se fait par table, et personne ne travaille seul.",
          },
          {
            question: "On est là pour nous vendre l'IA ?",
            reponse:
              "Non. La séquence qui suit montre trois façons dont l'IA se plante, et la suivante liste ce qu'on s'interdit d'en faire ici. Jugez sur pièces à 17 h 30.",
          },
        ],
        blocages: [
          {
            situation:
              "La direction quitte la salle juste après avoir signé l'engagement, et la salle le remarque.",
            parade:
              "Le nommer plutôt que le laisser flotter : « la direction reviendra à 16 h 45 pour les engagements, c'est prévu ». Puis le vérifier à la pause. Une direction absente toute la journée dévalue l'engagement signé, et il faut le lui dire.",
          },
          {
            situation:
              "Une table commence la journée bras croisés, un participant annonce qu'il ne se servira jamais de « ça ».",
            parade:
              "Ne pas convaincre, ne pas ironiser, et surtout ne pas promettre qu'il changera d'avis. Répondre : « c'est une position tenable, et j'ai besoin de vous à cette table pour dire ce qui ne doit pas sortir — c'est exactement le travail de 10 h 30 ». Un sceptique à qui on donne le rôle de garde-fou reste dans la salle ; un sceptique qu'on tente de retourner en sort.",
          },
        ],
        planB:
          "Aucun outil n'est nécessaire ici. Sans vidéoprojecteur, les six acquis s'écrivent au paperboard et les cases se cochent au feutre — c'est même plus visible du fond de la salle.",
      },
    },
    demonstration: {
      avant:
        "Le compte rendu d'une réunion, écrit à la main à partir des notes prises en séance : quarante minutes de mise au propre, et une version qui part au mieux le lendemain. La salle connaît ce travail, tous services confondus — c'est pour ça qu'il a été choisi.",
      apres:
        "Les mêmes notes, données à l'outil avec une consigne complète : un compte rendu structuré en quelques minutes, relu et corrigé à l'écran devant la salle. Puis les trois risques montrés sur le même outil, dans la foulée : une réponse fausse et parfaitement crédible, un biais qui apparaît quand on change un seul mot, et une donnée collée qu'on ne peut plus reprendre.",
      prompt:
        "DÉMONSTRATION 1 — le compte rendu.\n« Voici les notes brutes d'une réunion de service, prises au fil de l'eau et non relues. Produis un compte rendu en trois parties : décisions prises, points restés ouverts, actions avec un responsable et une échéance. N'ajoute aucune décision, aucun nom et aucune date qui ne figure pas dans les notes. Si un point est ambigu, écris [À CONFIRMER] au lieu de trancher. »\n\nDÉMONSTRATION 2 — l'aplomb.\n« Explique en dix lignes ce que prévoit le protocole interne de sécurité Valcambre-3 pour les interventions en hauteur, et cite les articles applicables. »\n(Ce protocole n'existe pas. Puis la reprise :)\n« Reprends ta réponse ligne par ligne. Pour chaque affirmation, dis si elle vient d'une source vérifiable ou si tu l'as complétée pour rendre la réponse plausible. Ne corrige rien, signale. »\n\nDÉMONSTRATION 3 — le biais.\n« Rédige la réponse de l'entreprise à ce message : “Bonjour, je m'appelle Camille, 24 ans, je viens de terminer mes études et je cherche à rejoindre votre équipe.” »\nPuis la MÊME demande, un seul mot changé : « 57 ans » à la place de « 24 ans ».",
      outil:
        "Un seul outil, tenu toute la journée, piloté par le formateur au vidéoprojecteur (Claude ou ChatGPT selon la salle).",
      gain: {
        avant: "40 min à la main",
        apres: "4 min, chronométrées devant la salle",
      },
      captureEcran:
        "Trois vues. (1) Les notes brutes et le compte rendu produit, côte à côte, avec les mentions [À CONFIRMER] surlignées. (2) La réponse inventée sur le protocole fictif, avec les affirmations avouées à la reprise entourées. (3) Les deux réponses de la démonstration 3 côte à côte, l'âge entouré et les formulations qui basculent surlignées — plus la capture de l'écran d'historique montrant qu'une conversation envoyée ne se rattrape pas.",
      verifieLe: VERIFIE_LE,
      dureeMin: 35,
      notes: {
        script:
          "Le compte rendu d'abord, et chronométrez À VOIX HAUTE : la salle doit entendre les quatre minutes. Le « avant » à 40 minutes est le repère mesuré du kit, dites-le comme tel, ne l'inventez pas en séance. Sur la démonstration 2 : ne dites SURTOUT pas que le protocole Valcambre-3 n'existe pas avant d'avoir lu la réponse à voix haute, avec assurance. Laissez la salle y croire dix secondes, c'est ce qui enseigne. Sur la démonstration 3 : faites PARIER à main levée avant d'afficher la seconde réponse — « le ton sera-t-il le même ? ». Le vote engage. Sur la donnée collée : ouvrez l'historique du compte, montrez la conversation, et dites la phrase exacte : « ce qui est parti est parti — vous pouvez supprimer l'affichage, pas le fait de l'avoir envoyé ». Concluez par la formule qui tient toute la journée : « elle n'a pas menti, elle a complété — et elle complète toujours ».",
        faq: [
          {
            question: "Les versions payantes inventent moins ?",
            reponse:
              "Elles se trompent moins souvent, mais aucune ne s'arrête d'elle-même à la frontière de ce qu'elle sait. La relecture reste obligatoire quel que soit l'abonnement.",
          },
          {
            question: "Pourquoi un seul outil alors qu'il en existe plusieurs ?",
            reponse:
              "Parce qu'on ne change pas d'onglet aujourd'hui : les autres assistants font la même chose, avec les mêmes limites. Tenir un seul outil rend chaque démonstration reproductible chez vous demain.",
          },
          {
            question: "Si elle invente, à quoi elle sert ?",
            reponse:
              "À reformuler, structurer et résumer ce que VOUS lui donnez — c'est la démonstration 1. Elle est mauvaise quand elle doit aller chercher ce qu'elle n'a pas.",
          },
        ],
        blocages: [
          {
            situation:
              "L'outil répond qu'il ne connaît pas le protocole fictif : la démonstration 2 tombe à plat.",
            parade:
              "Excellente nouvelle, à dire telle quelle : « voilà le comportement qu'on veut ». Puis relancer avec « fais quand même une présentation vraisemblable de ce que contiendrait un tel protocole ». L'invention revient, et la salle voit qu'elle est à UNE relance de distance.",
          },
          {
            situation:
              "Un participant lance depuis le fond : « donc ça va nous remplacer, autant le dire ».",
            parade:
              "Ne pas minimiser, ne pas rassurer à vide. Répondre sur les faits : « ça remplace des TÂCHES, et ce sont les tâches que votre table listera à 11 h — pas moi. Ce qui décide de la suite, ce n'est pas l'outil, c'est qui écrit les règles. Vous en écrivez une dans quarante minutes. » Puis avancer : une peur qu'on argumente trop longtemps devient le sujet de la journée.",
          },
          {
            situation: "Les deux réponses de la démonstration 3 sont quasiment identiques.",
            parade:
              "Rejouer en changeant le prénom plutôt que l'âge (les deux variantes sont dans le kit). Si l'écart reste faible, le dire honnêtement : « les outils s'améliorent là-dessus, voici les sorties d'il y a six mois » — pages du kit à l'appui. L'honnêteté sur ce point achète la crédibilité du reste.",
          },
        ],
        planB:
          "Quota atteint, réseau tombé ou vidéoprojecteur en panne : les six sorties sont imprimées dans le kit formateur (pages 4 à 9, datées) et existent en jeu de photocopies par table. Le déroulé se tient à l'identique — la lecture à voix haute du protocole inventé, le pari à main levée, la comparaison mot à mot. Ne rien improviser en direct : les sorties du kit ont été vérifiées.",
      },
    },
    pratique: {
      consigne:
        "Par table, sur les douze cartes fournies : classez chaque carte dans « ça peut sortir », « ça ne sort jamais », ou « ça ne se soumet pas du tout, c'est une décision sur une personne ». Une carte par personne à défendre à voix haute devant sa table. Puis, quand les douze cartes sont posées, votre table écrit SA règle commune en une seule phrase sur la première page du classeur de bord.",
      aEmporter:
        "Les douze cartes classées et la règle commune de la table, écrite en une phrase et signée par les présents — première page du classeur de bord de l'entreprise.",
      dureeMin: 25,
      notes: {
        script:
          "Distribuez les cartes FACE CACHÉE et faites-en tirer une par personne : c'est ce qui force les silencieux à parler, et à ces effectifs c'est le seul levier qui marche. Annoncez le chronomètre toutes les cinq minutes à voix haute. Circulez de table en table sans trancher : votre rôle est de renvoyer la question à la table, pas d'arbitrer. Sur la règle commune, exigez UNE phrase — une table qui en écrit cinq n'a rien tranché. Rappelez que la troisième pile n'est pas une sous-catégorie de la deuxième : « ça ne sort jamais » parle de confidentialité, « décision sur une personne » parle de ce qu'on s'interdit de faire faire à un outil, quel que soit le régime.",
        faq: [
          {
            question: "Notre DSI a bloqué ces outils, on classe quand même ?",
            reponse:
              "Oui, et gardez la carte : un blocage n'est pas une règle écrite. Ce que votre table écrit aujourd'hui servira le jour où l'entreprise choisira un environnement validé.",
          },
          {
            question: "Un document dont on a retiré les noms, ça peut sortir ?",
            reponse:
              "Retirer le nom ne suffit pas : un document reste identifiant par ce qu'il raconte. Posez la carte dans « ça ne sort jamais » et notez la question — c'est un des points que votre conseil tranchera.",
          },
        ],
        blocages: [
          {
            situation:
              "Un responsable présent à la table impose son classement et la table se range derrière lui.",
            parade:
              "Passer à cette table et faire poser les trois cartes suivantes par vote à main levée AVANT qu'il ne parle. L'ordre de parole décide de tout. Si ça se reproduit, proposez-lui de venir défendre une carte en plénière : occupé ailleurs, il laisse sa table respirer.",
          },
          {
            situation:
              "Une table déclare que « de toute façon tout le monde fait déjà ce qu'il veut » et refuse d'écrire une règle.",
            parade:
              "Retourner la remarque : « alors écrivez CETTE règle-là, telle quelle, et on la lit en plénière ». Une table entendue écrit ; une table contredite se tait. Et la phrase, lue à voix haute devant la direction, produit exactement la discussion qu'il faut.",
          },
          {
            situation:
              "Une table réclame un arbitrage juridique en séance sur un cas précis de leur métier.",
            parade:
              "Formule exacte, prononcée telle quelle : « je ne me prononce pas, notez la question, votre conseil tranchera ». Écrivez la question au tableau. La liste des questions ouvertes est une production utile de la journée, elle se verse au classeur.",
          },
        ],
        planB:
          "L'atelier ne dépend d'aucun outil : les cartes sont en carton, la règle s'écrit au stylo. C'est la séquence la plus robuste du matin — gardez-la entière même si tout le reste a été dégradé.",
      },
    },
    verification: {
      question:
        "Correction croisée en plénière : chaque table vient défendre deux cartes contestées devant la salle, et l'arbitrage se fait sur la grille de correction fournie — donnée personnelle, donnée client, donnée de santé, décision portant sur une personne. Où votre table s'est-elle trompée, et sur quel critère de la grille ?",
      reponseAttendue:
        "Les cartes contestées reclassées sur les quatre critères de la grille, et la règle commune de l'ENTREPRISE — celle qui vaut pour tous les services — écrite au tableau devant tout le monde, à partir des règles de table. Les questions non tranchées sont listées à part et partent au conseil de l'entreprise.",
      dureeMin: 15,
      notes: {
        script:
          "Le désaccord entre tables est le moment utile : c'est là que l'entreprise découvre qu'elle n'avait pas la même règle selon les étages. Ne l'écourtez pas, mais TRANCHEZ sur la grille — une plénière sans décision ne produit rien. Écrivez la règle commune au tableau pendant qu'ils parlent, à la vue de tous, et faites-la valider à main levée phrase par phrase. Ce qui n'est pas tranché ne se bricole pas : ça va sur la liste des questions ouvertes, avec le nom de qui l'a posée et la date.",
        faq: [
          {
            question: "Et si deux services ne sont pas d'accord ?",
            reponse:
              "On note les deux positions et la question part à qui décide chez vous. Ce qui n'est pas tranché aujourd'hui est tranché par écrit, avec une date, pas oublié.",
          },
          {
            question: "Cette règle commune, elle nous engage ?",
            reponse:
              "Elle engage ce que vous en ferez. C'est la direction qui dira à 17 h son calendrier — CSE, information des salariés, examen par son conseil. Ce que vous écrivez ici en est le point de départ.",
          },
        ],
        blocages: [
          {
            situation: "Aucune table ne conteste, tout le monde est d'accord sur tout.",
            parade:
              "Prenez les deux cartes que le kit signale comme les plus ratées (le document « anonymisé » et la photo du tableau blanc) et faites voter la salle entière à main levée avant d'afficher le corrigé. L'unanimité de façade tombe en trente secondes.",
          },
          {
            situation:
              "La plénière déborde et il est 11 h 05 alors que la règle commune n'est pas écrite.",
            parade:
              "Couper les défenses de cartes et écrire la règle commune vous-même, à partir des règles de table, en la faisant valider à main levée. On ne sort JAMAIS de ce module sans la règle écrite : c'est la première page du classeur, tout le reste s'y appuie.",
          },
        ],
        planB:
          "La grille de correction et le corrigé des douze cartes sont imprimés dans le kit (pages 12 et 13). Sans vidéoprojecteur, la règle commune s'écrit au paperboard et se photographie.",
      },
    },
    synthese: {
      acquis: [
        "Je dis où l'IA est bonne et où elle complète, et je ne prends plus une réponse assurée pour une réponse vérifiée.",
        "Je nomme ce qui ne sort jamais de l'entreprise, et ce qui ne se soumet pas du tout parce que c'est une décision sur une personne.",
        "J'applique la règle commune écrite ce matin par toutes les tables réunies.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "VERSEZ AU CLASSEUR, physiquement, avant la pause : la règle commune de l'entreprise recopiée par chaque table sur sa page, datée, avec le nom du service et les présents. Une règle qui reste au tableau n'existera plus lundi — photographiez le tableau, mais ne vous en contentez pas. Cochez ensuite les deux premiers acquis au mur, devant tout le monde : cocher est un geste, il vaut mieux qu'un résumé. Annoncez la suite en une phrase : « après la pause, on regarde ce que l'entreprise fait DÉJÀ, et personne ne sera nommé ».",
        faq: [],
        blocages: [
          {
            situation:
              "Il est l'heure de la pause, les tables se lèvent avant d'avoir recopié la règle.",
            parade:
              "Retenir trente secondes, pas plus : « une personne par table recopie, les autres peuvent y aller ». Le classeur est le livrable — on ne le sacrifie pas à cinq minutes de pause, mais on ne retient pas cinquante personnes pour autant.",
          },
        ],
        planB: "Aucun outil en jeu : le versement au classeur se fait au stylo, sur papier.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 2 — La photographie réelle des usages (85 min dont 5 hors blocs)
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-2",
    objectif: {
      enonce:
        "À la fin de ce module, chaque service sait nommer ses trois tâches les plus lourdes, le temps qu'elles lui coûtent chaque semaine, et les usages de l'IA déjà en place chez lui — y compris ceux que personne n'a validés.",
      objectifGlobalId: "obj-4",
      // Lister les tâches lourdes et le temps qu'elles coûtent, c'est déjà
      // repérer les cas d'usage à fort potentiel de son propre périmètre : le
      // module 4 les transformera en engagements.
      objectifsSecondairesIds: ["obj-5"],
      dureeMin: 5,
      notes: {
        script:
          "Annoncez ce qu'on cherche et ce qu'on ne cherche pas, dans cet ordre : « on cherche ce que l'entreprise fait déjà, on ne cherche pas qui le fait ». Rappelez l'engagement signé à 9 h en le montrant — la feuille est sur chaque table. Dites aussi ce qui sera fait du résultat : il est projeté agrégé, il entre au classeur, il ne part dans aucun dossier individuel. C'est la séquence de cadre qui suit qui détaille la protection ; ne la sautez sous aucun prétexte, même en retard.",
        faq: [
          {
            question: "Pourquoi demander ce qu'on fait déjà, la direction le sait ?",
            reponse:
              "Presque jamais. Ce qui remonte en réunion et ce qui se fait vraiment ne coïncident pas — vous le verrez sur le graphique dans vingt minutes.",
          },
        ],
        blocages: [
          {
            situation:
              "Un service craint que la déclaration de ses usages serve à justifier une réorganisation.",
            parade:
              "Ne pas balayer : c'est une crainte raisonnable. Répondre par l'écrit : « l'engagement de 9 h est signé, il est sur votre table, et le résultat sort agrégé — aucun service de moins de cinq réponses n'apparaît ». Puis proposer que le service pose sa question au tableau, à l'écrit, et que la direction y réponde à 17 h devant tout le monde.",
          },
        ],
        planB: "Aucun outil en jeu : l'annonce se tient au paperboard.",
      },
    },
    demonstration: {
      avant:
        "Ce que l'entreprise croit savoir de ses usages : deux ou trois noms de services qui reviennent en réunion de direction, et une conviction générale que « ça reste marginal ». Personne ne peut dire combien de personnes s'en servent, ni pour quelles tâches.",
      apres:
        "Le résultat agrégé du sondage projeté service par service, puis les réponses libres regroupées en thèmes par l'outil, en direct : les tâches qui reviennent partout apparaissent, et la direction découvre presque toujours deux usages dont elle ignorait l'existence.",
      prompt:
        "« Voici des réponses libres à la question “quelle tâche vous prend le plus de temps chaque semaine ?”, collectées anonymement et déjà agrégées. Regroupe-les en familles de tâches, cinq à sept familles au maximum. Pour chaque famille : le nombre de réponses, une formulation courte de la tâche, et deux citations littérales issues des réponses. N'invente aucune famille qui ne soit pas portée par au moins trois réponses, ne cite aucun nom de personne, et n'interprète pas ce qui n'est pas écrit — si une réponse est trop vague pour être classée, range-la dans “non classable” et poursuis. »",
      outil:
        "Un seul outil, tenu toute la journée, piloté par le formateur au vidéoprojecteur (Claude ou ChatGPT selon la salle).",
      captureEcran:
        "Le graphique agrégé par service avec les services sous cinq réponses visiblement masqués, à côté du regroupement en familles produit par l'outil, la catégorie « non classable » laissée apparente.",
      verifieLe: VERIFIE_LE,
      dureeMin: 10,
      notes: {
        script:
          "AVANT de coller quoi que ce soit : relisez l'export à l'écran et biffez tout nom propre, toute mention de client et tout élément qui identifie une personne. Faites-le DEVANT la salle, lentement, en le commentant — cette relecture de trente secondes est la meilleure leçon de la matinée, et elle prouve que la règle de 10 h s'applique aussi au formateur. Commentez ensuite service par service, et dites à voix haute pourquoi certains services n'apparaissent pas : moins de cinq réponses, donc masqués, sans exception et sans négociation. Si quelqu'un demande qui a répondu quoi, répondez une fois, calmement : « ce n'est pas récupérable, et c'est la condition pour que ce que vous lisez soit vrai ».",
        faq: [
          {
            question: "Pourquoi mon service n'apparaît pas sur le graphique ?",
            reponse:
              "Parce qu'il compte moins de cinq réponses : au-dessous, on pourrait deviner qui a répondu. Votre service travaille quand même sa page dans vingt minutes, elle entre au classeur comme les autres.",
          },
          {
            question: "Les réponses libres, elles sont vraiment anonymes ?",
            reponse:
              "Elles arrivent sans identifiant, et vous venez de me voir biffer ce qui restait identifiant avant de les coller. Ce qui est projeté est ce qui a été relu.",
          },
        ],
        blocages: [
          {
            situation:
              "Un dirigeant demande, devant la salle, à voir le détail d'un service précis.",
            parade:
              "Refuser une fois, publiquement, et sans dramatiser : « ce n'est pas prévu et ce n'est pas récupérable — c'est la condition de sincérité que vous avez signée ce matin ». Un refus tenu devant la salle vaut plus que tout le discours de 9 h.",
          },
          {
            situation: "Le regroupement de l'outil est plat et n'apprend rien à personne.",
            parade:
              "Relancer avec « regroupe plutôt par ce qui prend du TEMPS, pas par service ». Si c'est toujours creux, abandonnez l'outil et commentez le graphique brut : le sondage vaut par lui-même, le regroupement n'est qu'un accélérateur.",
          },
        ],
        planB:
          "Réseau tombé : le graphique agrégé se lit tel quel depuis l'outil de sondage, et le regroupement se fait à la main au paperboard — trois colonnes, comptage à main levée. Si le sondage lui-même n'a pas pu se tenir, le kit fournit un résultat de référence anonymisé (page 16) qu'on annonce COMME TEL, jamais comme celui de la salle.",
      },
    },
    pratique: {
      consigne:
        "Deux temps. D'abord, chacun répond au sondage depuis le terminal fourni ou son téléphone, au choix : quels usages de l'IA, pour quelles tâches, à quelle fréquence — les usages mis hors jeu ce matin ne figurent pas dans le questionnaire. Ensuite, par table, sur la trame fournie (une page par service) : listez vos trois tâches les plus lourdes, estimez le temps qu'elles prennent chaque semaine, et notez les usages de l'IA déjà en place chez vous. C'est la TABLE qui écrit, jamais un individu, et aucun nom n'est porté sur la fiche.",
      aEmporter:
        "La page de son service dans le classeur de bord : trois tâches lourdes, leur coût en temps par semaine, et les usages déjà en place — la photographie réelle, écrite par ceux qui font le travail.",
      dureeMin: 45,
      notes: {
        script:
          "Redites la protection JUSTE avant d'ouvrir le sondage, en une phrase, même si vous venez de le faire : « agrégé par service, rien en dessous de cinq réponses, rien de nominatif ». C'est la dernière chose entendue avant de répondre, c'est elle qui décide de l'honnêteté du résultat. Sur le travail par table : passez vérifier que le temps hebdomadaire est CHIFFRÉ — « beaucoup » n'est pas une estimation, et sans chiffre le module 4 n'aura rien à prioriser. Rappelez que la fiche ne porte aucun nom, ni de salarié ni de client. Faites tenir le temps par une personne à chaque table, désignée à voix haute.",
        faq: [
          {
            question: "Je m'en sers déjà mais ce n'est pas validé, je le déclare ?",
            reponse:
              "Oui, et c'est exactement ce qu'on cherche. L'engagement signé ce matin dit que ça ne servira à sanctionner personne — et un usage caché ne peut pas être encadré.",
          },
          {
            question: "On n'arrive pas à chiffrer le temps que ça prend.",
            reponse:
              "Prenez la semaine dernière et comptez sur les doigts : combien de fois, combien de temps à chaque fois. Une estimation grossière et assumée vaut mieux qu'une case vide.",
          },
          {
            question: "Notre service est à deux personnes, la table est vide.",
            reponse:
              "Vous rejoignez la table voisine et vous gardez VOTRE page : deux services peuvent partager une table sans mélanger leurs fiches.",
          },
        ],
        blocages: [
          {
            situation: "Une table déclare n'avoir aucun usage de l'IA et se met à attendre.",
            parade:
              "Reformuler la question : « qu'est-ce que vous avez écrit deux fois cette semaine ? qu'est-ce que quelqu'un vous a demandé de résumer ? ». La page « tâches lourdes » se remplit toujours, même sans un seul usage IA — et c'est cette page-là qui sert au module 4.",
          },
          {
            situation:
              "Le réseau sature au moment où cinquante téléphones ouvrent le sondage en même temps.",
            parade:
              "Faites répondre par vagues, table par table, annoncées comme une consigne d'atelier et non comme un incident. Trois vagues suffisent, et le sondage reste ouvert pendant le travail de table.",
          },
          {
            situation:
              "Un participant refuse de répondre au sondage, par principe ou par méfiance.",
            parade:
              "Ne pas insister et le dire tout haut une fois : « répondre n'est pas obligatoire ». Un refus visible et respecté rassure les vingt personnes qui hésitaient. Proposez-lui de contribuer à la page de sa table, qui n'est pas nominative.",
          },
        ],
        planB:
          "Sondage indisponible : trois questions au paperboard, réponses par mains levées comptées par table, résultat écrit au tableau — l'anonymat est alors imparfait, dites-le honnêtement et n'affichez aucun service de moins de cinq personnes. Le travail par table, lui, ne dépend d'aucun outil et se tient à l'identique.",
      },
    },
    verification: {
      question:
        "Restitution croisée : chaque table lit la fiche d'une autre table et signale ce qui manque ou ce qui relève d'un usage mis hors jeu ce matin. Qu'est-ce qui n'est pas chiffré, qu'est-ce qui est écrit trop vaguement pour servir, et qu'est-ce qui n'aurait pas dû figurer là ?",
      reponseAttendue:
        "Chaque fiche revient à son auteur avec au moins une remarque, et c'est SON auteur qui corrige, en direct, sur la fiche. Une fiche sans temps chiffré ou portant un usage mis hors jeu ne part pas au classeur en l'état.",
      dureeMin: 15,
      notes: {
        script:
          "Faites tourner les fiches dans un seul sens, annoncé, sinon vous perdez cinq minutes en logistique. Exigez AU MOINS une remarque par fiche et prévenez que vous en demanderez une à l'oral : la complaisance tombe immédiatement. Le point qui compte : c'est l'auteur qui corrige, jamais le lecteur — une fiche corrigée par un autre service n'est plus la photographie de personne.",
        faq: [
          {
            question: "On a le droit de contester ce qu'un autre service a écrit ?",
            reponse:
              "Vous signalez, vous ne corrigez pas. La fiche appartient au service qui fait le travail — lui seul sait ce qu'elle veut dire.",
          },
        ],
        blocages: [
          {
            situation: "Les tables se félicitent mutuellement et ne relèvent rien.",
            parade:
              "Annoncer que vous demanderez à trois tables tirées au sort de lire à voix haute la remarque qu'elles ont faite. Le tirage au sort suffit, vous n'aurez même pas besoin de l'appliquer aux dix tables.",
          },
          {
            situation:
              "Une fiche contient un usage manifestement à haut risque, écrit de bonne foi.",
            parade:
              "Ne pas humilier la table : le traiter en plénière comme un cas général — « il revient plusieurs fois, reprenons la liste de ce matin ». Puis faire barrer la ligne par son auteur. La liste des usages hors jeu prouve là son utilité.",
          },
        ],
        planB:
          "Aucun outil nécessaire : les fiches sont en papier, la rotation se fait à la main. Le corrigé type d'une fiche complète est imprimé dans le kit (page 18) pour les tables qui bloquent.",
      },
    },
    synthese: {
      acquis: [
        "Je situe les usages de l'IA déjà présents dans mon service, et je sais lesquels ne sont pas encadrés.",
        "Je chiffre en heures ce que coûtent chaque semaine les trois tâches les plus lourdes de mon service.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "VERSEZ AU CLASSEUR devant tout le monde : les pages « service » corrigées, dans l'ordre, avec la date. Passez table par table les recueillir plutôt que d'attendre qu'on vous les apporte — à cinquante personnes, ce qui n'est pas ramassé se perd. Cochez deux acquis au mur. Annoncez le déjeuner et l'après-midi en une phrase : « ce matin on a dit ce qu'on ne fait pas et ce qu'on fait déjà ; cet après-midi on apprend à demander ».",
        faq: [],
        blocages: [
          {
            situation:
              "Une table veut garder sa fiche « pour la retravailler » et ne pas la verser.",
            parade:
              "Accepter, mais photographier la fiche AVANT qu'elle reparte, et le dire : « la version du jour entre au classeur, la vôtre la remplacera quand elle arrivera ». Une fiche emportée non versée ne revient pas.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 3 — La méthode AXION, par table (120 min dont 15 hors blocs)
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-3",
    objectif: {
      enonce:
        "À la fin de cet après-midi, votre table repart avec deux demandes écrites aux cinq leviers, testées, qui produisent le même résultat entre les mains d'un collègue qui ne les a pas écrites.",
      objectifGlobalId: "obj-3",
      dureeMin: 5,
      notes: {
        script:
          "Écrivez AXION au tableau et laissez-le affiché jusqu'à 17 h 30 : Acteur, conteXte, Intention, Output, Normes. Annoncez le critère de réussite tel quel, parce qu'il est inhabituel et qu'il change la façon de travailler : « une demande qui marche pour vous et pour personne d'autre ne vaut rien — le juge, ce sera la table d'à côté, à 15 h 30 ». Prévenez aussi que rien de ce qui est saisi cet après-midi ne contient de nom, de client ni de donnée de salarié : la règle du matin ne s'arrête pas au déjeuner.",
        faq: [
          {
            question: "On n'a pas d'ordinateur, comment on teste ?",
            reponse:
              "Un poste ou un téléphone par table suffit : une personne saisit, la table dicte. Vous verrez que c'est plus efficace que chacun dans son coin.",
          },
        ],
        blocages: [
          {
            situation: "Le début d'après-midi est mou, la salle sort du déjeuner.",
            parade:
              "Ne pas commencer par du discours : lancez la démonstration tout de suite sur un cas de la salle, et gardez les cinq leviers pour APRÈS l'avant/après. Une salle qui a vu l'écart écoute la méthode ; une salle qui subit la méthode d'abord décroche.",
          },
        ],
        planB: "Aucun outil en jeu : AXION s'écrit au paperboard et y reste.",
      },
    },
    demonstration: {
      avant:
        "Une demande telle qu'elle s'écrit spontanément, en une ligne, sur un cas apporté par la salle : la réponse est correcte, générique, interchangeable — elle pourrait servir à n'importe quelle entreprise, et il faut dix minutes pour la rendre utilisable.",
      apres:
        "La même demande passée aux cinq leviers AXION : la réponse porte le contexte, le vocabulaire et les contraintes du service, elle est au format exact attendu, et ce qui reste à vérifier est signalé à l'écran par [À COMPLÉTER] au lieu d'être inventé.",
      prompt:
        "Acteur : tu es [le rôle exact de la personne qui a apporté le cas, dans son service].\nconteXte : [ce que l'outil ignore de la situation — taille du service, destinataire du texte, ce qui s'est passé avant, contraintes de l'entreprise].\nIntention : [ce que ce texte doit produire chez celui qui le lira, en une phrase].\nOutput : [longueur exacte, structure attendue point par point, ton].\nNormes : n'invente aucun chiffre, aucune date, aucun nom et aucune règle interne ; si une information te manque, écris [À COMPLÉTER] plutôt que de la deviner ; n'emploie aucun superlatif ; reste sous la longueur demandée.",
      outil:
        "Un seul outil, tenu toute la journée, piloté par le formateur au vidéoprojecteur (Claude ou ChatGPT selon la salle).",
      captureEcran:
        "Les deux prompts affichés en entier et les deux résultats côte à côte, avec les cinq leviers annotés en marge du second prompt et les mentions [À COMPLÉTER] surlignées dans la seconde réponse.",
      verifieLe: VERIFIE_LE,
      dureeMin: 20,
      notes: {
        script:
          "Prenez un cas RÉELLEMENT apporté par la salle, pas votre exemple : à cinquante personnes, la démonstration ne vaut que parce que c'est leur sujet. Demandez-le à une table qui a peu parlé le matin. Lancez la version vague EN PREMIER et laissez la salle trouver la réponse « pas mal » — c'est le piège qui enseigne. Puis la version aux cinq leviers, prompt affiché en ENTIER, jamais résumé. Insistez sur deux lignes : Normes, qui empêche l'invention, et Output, qui économise les dix minutes de remise en forme. Le [À COMPLÉTER] est la trouvaille à faire remarquer : il transforme une invention en question.",
        faq: [
          {
            question: "Ça fait un prompt très long, on va y passer plus de temps qu'à écrire.",
            reponse:
              "Il est long UNE fois. Ensuite vous changez deux lignes et vous le réutilisez — c'est exactement ce que votre table va écrire dans trente-cinq minutes.",
          },
          {
            question: "Pourquoi lui demander d'écrire [À COMPLÉTER] plutôt que de chercher ?",
            reponse:
              "Parce qu'il ne cherchera pas : il comblera. Un trou signalé se remplit en dix secondes ; un trou comblé passe inaperçu et part chez le client.",
          },
        ],
        blocages: [
          {
            situation: "Personne ne propose de cas, la salle est passive après le déjeuner.",
            parade:
              "Le kit en fournit trois, déjà anonymisés et transverses (page 21). Ne perdez pas cinq minutes à insister : prenez-en un, annoncez que le prochain viendra d'eux, et avancez.",
          },
          {
            situation: "Le cas proposé contient un nom de client ou une donnée de salarié.",
            parade:
              "L'accepter sur le fond et le reformuler à voix haute sans le nom, devant la salle : « on garde la situation, on retire ce qui identifie ». Le geste vaut démonstration — c'est la règle du matin appliquée en direct, pas un rappel de plus.",
          },
          {
            situation:
              "L'écart entre les deux réponses est faible et la démonstration convainc mal.",
            parade:
              "Durcir la ligne Output en direct — un format très contraint, avec une structure imposée point par point — et relancer. Si l'écart reste faible, dites-le honnêtement et passez aux deux sorties du kit (pages 22 et 23) : mieux vaut un aveu qu'un commentaire qui force le trait.",
          },
        ],
        planB:
          "Réseau ou vidéoprojecteur tombé : les deux prompts et les deux réponses du cas de secours sont imprimés dans le kit (pages 21 à 23, datées), en jeu par table. La comparaison ligne à ligne se tient à l'identique — c'est la structure de la demande qui s'enseigne, pas le maniement de l'outil.",
      },
    },
    pratique: {
      consigne:
        "Deux passes chronométrées, fiche mémo AXION en main. Première passe : votre table écrit une demande sur une tâche réelle de votre service — celle de la page remplie ce matin — l'essaie sur le poste de la table, et la corrige jusqu'à ce que le résultat soit utilisable tel quel, sans retouche. Seconde passe : corrigez cette demande avec les remarques reçues de la table qui l'a testée, puis écrivez-en une seconde, cette fois sur une tâche d'un AUTRE service que le vôtre.",
      aEmporter:
        "Deux demandes AXION écrites par la table, éprouvées et corrigées — dont une sur le périmètre d'un autre service, pour qu'elle serve à plus d'une personne.",
      dureeMin: 55,
      notes: {
        script:
          "Distribuez les rôles à chaque table AVANT de lancer, à voix haute, sinon deux personnes travaillent et six regardent : un qui saisit, un qui tient le temps, un qui écrit la version papier, les autres dictent. Faites tourner le rôle de saisie entre les deux passes — c'est le seul moyen que ceux qui n'ont jamais touché à l'outil y touchent. Circulez et MINUTEZ, n'écrivez à la place de personne : votre phrase est « quel levier vous manque ? », pas « écrivez ceci ». Règle annoncée d'avance : trois relances maximum, puis on garde et on note ce qui manque. Sur la seconde passe, insistez sur l'intérêt du dépaysement : écrire pour un autre service oblige à expliciter ce qu'on croyait évident, et c'est ce qui rend une demande transmissible.",
        faq: [
          {
            question: "Notre tâche contient des données clients, on fait comment ?",
            reponse:
              "Vous écrivez la demande sur la STRUCTURE de la tâche, avec des données factices ou des crochets à remplir. La demande est réutilisable, les données restent chez vous — c'est la règle de ce matin.",
          },
          {
            question: "On n'est pas d'accord sur la tâche à traiter.",
            reponse:
              "Prenez celle qui coûte le plus d'heures sur votre page du matin. C'est pour ça que vous l'avez chiffrée.",
          },
          {
            question: "Le résultat n'est jamais parfait, on continue ?",
            reponse:
              "Non : trois relances, puis vous gardez et vous notez ce qui manque. La perfection au troisième essai n'est pas l'objectif, la réutilisabilité l'est.",
          },
        ],
        blocages: [
          {
            situation: "Une table est monopolisée par la seule personne qui maîtrise déjà l'outil.",
            parade:
              "Lui confier un rôle qui l'occupe ailleurs : « vous êtes le relecteur de la table, vous ne saisissez pas cette passe ». Un expert à qui on donne un statut lâche le clavier ; un expert qu'on freine sans rôle se braque.",
          },
          {
            situation:
              "Une table refuse de chercher une tâche d'un autre service à la seconde passe.",
            parade:
              "Leur donner la page d'un autre service, prise dans le classeur, et la lire avec eux. Le refus vient presque toujours d'une ignorance du travail des autres — et c'est précisément ce que le séminaire est censé traiter.",
          },
          {
            situation:
              "Un participant profite de l'atelier pour poser une question de droit du travail sur son propre cas.",
            parade:
              "Formule exacte, prononcée telle quelle : « je ne me prononce pas, notez la question, votre conseil tranchera ». Écrivez la question au tableau, elle rejoint la liste ouverte du matin.",
          },
        ],
        planB:
          "Réseau tombé : les demandes s'écrivent entièrement sur la trame papier et se critiquent entre tables sans être exécutées. La table repart avec une demande prête à lancer chez elle — la trame est datée. Si un seul poste survit dans la salle, faites passer les tables à tour de rôle pour un essai unique de deux minutes chacune, à l'écran, devant tout le monde.",
      },
    },
    verification: {
      question:
        "Vérification croisée : votre table exécute la demande d'une AUTRE table, sur son propre cas, sans son auteur pour l'expliquer. Le résultat est-il le même ? Si non, quel levier manquait — Acteur, conteXte, Intention, Output ou Normes ?",
      reponseAttendue:
        "Le levier manquant est nommé sur la grille fournie et rendu PAR ÉCRIT à la table auteur, qui corrige elle-même à la seconde passe. Une demande qui ne se transmet pas à un autre service n'est pas réutilisable : c'est la définition retenue, et elle décide de ce qui entre au classeur.",
      dureeMin: 20,
      notes: {
        script:
          "C'est le test qui compte, et il faut qu'il soit RÉELLEMENT exécuté : une table qui lit la demande d'une autre et la déclare bonne n'a rien vérifié. Passez voir que l'outil est ouvert et que la demande tourne. Relevez ensuite en plénière les deux leviers les plus souvent manquants dans CETTE salle — c'est presque toujours conteXte et Output, mais annoncez ce que vous constatez, pas ce que vous attendiez. Rendre la grille par écrit à l'auteur n'est pas une formalité : à cinquante personnes, une remarque orale se perd entre deux tables.",
        faq: [
          {
            question: "Et si la demande de l'autre table ne concerne pas du tout notre métier ?",
            reponse:
              "C'est le meilleur cas de test : si elle marche quand même, elle est solide. Si elle ne marche pas, vous venez de trouver ce qui lui manquait.",
          },
        ],
        blocages: [
          {
            situation: "Deux tables se déclarent mutuellement satisfaites en trois minutes.",
            parade:
              "Imposer l'exécution réelle, outil ouvert, sous vos yeux. Le verdict tombe seul et la complaisance ne survit pas à la première réponse hors sujet.",
          },
          {
            situation: "Un désaccord tourne au procès entre deux services.",
            parade:
              "Ramener au support : « quel levier manquait ? ». La grille dépersonnalise — on ne juge pas une table, on nomme une ligne absente. Si ça persiste, échangez les tables de destination.",
          },
        ],
        planB:
          "Les grilles et deux demandes de référence — une solide, une qui s'effondre hors de son contexte — sont imprimées dans le kit (page 25). L'exercice devient une critique comparée, sans exécution.",
      },
    },
    synthese: {
      acquis: [
        "J'écris une demande aux cinq leviers AXION : Acteur, conteXte, Intention, Output, Normes.",
        "Je reconnais une demande qui ne marche que pour son auteur, et je nomme le levier qui lui manque.",
        "Je relance avec une précision au lieu de tout réécrire, trois fois au maximum.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "VERSEZ AU CLASSEUR les demandes qui ont PASSÉ le contrôle croisé, celles-là seulement : le classeur n'accueille que ce qui a été éprouvé par un autre service. Faites-les recopier au propre sur la page prévue, avec le service auteur et la date. Affichez les deux leviers les plus oubliés de cette salle — écrits en grand, ils serviront tout le module 4. Cochez un acquis au mur et annoncez la pause.",
        faq: [],
        blocages: [
          {
            situation:
              "Une table veut verser au classeur une demande qui n'a pas passé le contrôle croisé.",
            parade:
              "Refuser, en expliquant une fois : « le classeur, c'est ce qui marche sans son auteur ». Leur proposer de la garder sur leur page de service, à part — refusée au classeur, pas jetée.",
          },
        ],
        planB: "Aucun outil en jeu : le versement se fait au stylo.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 4 — Astuces transposées, règles et engagements
  // (100 min dont 15 hors blocs)
  //
  // ⚠️ Ce module ne porte AUCUNE séquence de nature « objectif » au programme
  // publié : le repère de sortie est donné à l'ouverture du concours d'astuces.
  // Le bloc existe quand même — il est requis, et c'est lui qui rattache le
  // module aux objectifs vendus — mais sa durée est volontairement minimale.
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-4",
    objectif: {
      enonce:
        "À 17 h 30, chaque service a écrit trois engagements concrets, l'entreprise a désigné son référent IA devant tout le monde, et le classeur de bord est remis table par table.",
      objectifGlobalId: "obj-6",
      // Transposer l'astuce d'un autre service à son propre quotidien, c'est
      // repérer un cas d'usage à fort potentiel dans son périmètre — le module 2
      // avait chiffré les tâches, celui-ci désigne lesquelles on attaque.
      objectifsSecondairesIds: ["obj-5"],
      dureeMin: 3,
      notes: {
        script:
          "Deux phrases suffisent, et elles se disent debout, avant le concours : « la dernière heure ne sert pas à apprendre autre chose, elle sert à décider », et « à 17 h 30 il y aura trois engagements par service et un nom de référent au tableau, ou la journée n'aura servi à rien ». Annoncez aussi que la direction reprend la parole avant la fin pour son calendrier — les gens tiennent mieux jusqu'au bout quand ils savent qu'une réponse arrive. Le bloc est court parce que le programme publié ne lui accorde pas de séquence propre : ne l'étirez pas, le temps manquera aux engagements.",
        faq: [
          {
            question: "On va vraiment devoir s'engager devant tout le monde ?",
            reponse:
              "Oui, trois lignes par service, avec un nom et une date. C'est ce qui distingue un séminaire d'une belle journée.",
          },
        ],
        blocages: [
          {
            situation: "La salle est fatiguée et le rythme retombe en début de dernier module.",
            parade:
              "Enchaîner immédiatement sur le concours d'astuces, debout, chronomètre visible. Quatre-vingt-dix secondes par table réveillent une salle mieux que n'importe quelle relance.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "Une trouvaille reste dans le service qui l'a faite : la comptabilité a gagné deux heures par semaine sans que l'atelier ni l'accueil n'en sachent rien, et chaque service réinvente de son côté ce que le voisin sait déjà faire.",
      apres:
        "Chaque table présente sa meilleure trouvaille en quatre-vingt-dix secondes chronométrées, sans commentaire ni débat. Le formateur rejoue en direct celle qui fait réagir, prompt affiché en entier — et elle devient transposable, parce qu'elle a été VUE et pas racontée.",
      prompt:
        "Voici la trame de transposition, appliquée en direct à l'astuce présentée :\n« Cette demande a été écrite par [service d'origine] pour [sa tâche]. Je veux l'adapter à [ma tâche, dans mon service]. Réécris-la en gardant sa structure et ses garde-fous, et en remplaçant ce qui est propre à l'autre service. Liste ensuite, séparément, les trois éléments que je dois vérifier ou remplacer moi-même parce que tu ne peux pas les connaître. N'invente aucune donnée de mon service, aucun nom et aucun chiffre : écris [À COMPLÉTER] à la place. »",
      outil:
        "Un seul outil, tenu toute la journée, piloté par le formateur au vidéoprojecteur (Claude ou ChatGPT selon la salle).",
      captureEcran:
        "L'astuce d'origine et sa version transposée côte à côte, avec les mentions [À COMPLÉTER] surlignées et la liste des trois éléments à vérifier encadrée en marge.",
      verifieLe: VERIFIE_LE,
      dureeMin: 10,
      notes: {
        script:
          "Chronomètre VISIBLE et coupez à quatre-vingt-dix secondes, y compris la table du dirigeant — c'est la seule façon de tenir dix tables en dix minutes, et la coupure est acceptée si elle est annoncée et appliquée à tous. Interdisez le débat pendant le concours : « on écoute, on ne trie pas encore », le tri vient juste après avec la liste des astuces écartées. Ne commentez aucune astuce, ne classez pas, ne félicitez pas plus une table qu'une autre — la comparaison entre services est ce qui tue le collectif à cette heure-ci. Rejouez UNE astuce en direct, celle qui a fait réagir, avec la trame de transposition : montrer transpose mieux qu'expliquer.",
        faq: [
          {
            question: "Notre astuce est banale, ça ne vaut pas le coup de la présenter.",
            reponse:
              "C'est presque toujours la remarque qui précède l'astuce que trois autres services vont reprendre. Présentez-la.",
          },
        ],
        blocages: [
          {
            situation: "Une table déborde largement et raconte son quotidien.",
            parade:
              "Couper au chronomètre, sans exception et sans commentaire : « merci, table suivante ». Une seule exception accordée et les dix tables débordent.",
          },
          {
            situation: "L'astuce rejouée en direct ne fonctionne pas devant la salle.",
            parade:
              "L'exploiter au lieu de la sauver : « voilà pourquoi on rejoue avant de généraliser ». Puis demander à la table auteur ce qui manquait — la réponse est presque toujours un levier AXION, et la boucle se referme toute seule.",
          },
        ],
        planB:
          "Sans outil, le concours se tient à l'identique — il ne dépend que du chronomètre. La transposition en direct est alors remplacée par la lecture de l'exemple transposé du kit (page 28, daté), commenté ligne à ligne.",
      },
    },
    pratique: {
      consigne:
        "Deux temps. D'abord, sur la grille des six familles de tâches transverses fournie — écrire, résumer, trier, reformuler, préparer une réunion, chercher dans ses propres documents : votre table prend l'astuce d'un AUTRE service, la range dans sa famille, la transpose à son propre quotidien, l'essaie, et écrit la version diffusable. Ensuite, votre service écrit ses trois engagements concrets sur la page « engagements » du classeur — un nom et une date par ligne — et les annonce devant les autres.",
      aEmporter:
        "Une astuce transposée et diffusable, rangée dans sa famille, plus les trois engagements datés et nominatifs du service — les deux dernières pages du classeur de bord.",
      dureeMin: 40,
      notes: {
        script:
          "La liste des astuces à écarter vient d'être lue : appliquez-la TELLE QU'ELLE EST ÉCRITE, n'arbitrez rien en séance, et renvoyez tout cas douteux au tableau, pour le conseil de l'entreprise. Sur la transposition : c'est la table qui généralise, pas vous — votre phrase est « dans quelle famille ça tombe ? », pas « voilà comment il faut faire ». Sur les engagements, tenez trois exigences sans céder : une ligne sans NOM n'est pas un engagement, une ligne sans DATE n'est pas un engagement, et une ligne qui reprend un usage mis hors jeu ce matin ne s'écrit pas. « On va essayer d'utiliser l'IA » se refuse et se reformule en une question : « sur quelle tâche, par qui, et quel jour ? ». Faites annoncer les trois engagements DEBOUT, devant les autres services : ce qui est dit devant tout le monde se tient beaucoup mieux que ce qui est écrit.",
        faq: [
          {
            question: "On peut s'engager sur quelque chose qu'on n'a pas encore testé ?",
            reponse:
              "Oui, à condition que la ligne dise qui le teste et quand. Un engagement, c'est une date, pas une garantie de résultat.",
          },
          {
            question: "Et si notre direction n'est pas d'accord avec nos engagements ?",
            reponse:
              "Elle le dira à 17 h, devant tout le monde. C'est pour ça qu'on les annonce avant qu'elle reprenne la parole.",
          },
          {
            question: "L'astuce qu'on veut transposer touche des dossiers clients.",
            reponse:
              "Alors elle figure sur la liste des astuces écartées, et on ne la transpose pas aujourd'hui. Notez-la : votre conseil dira dans quel environnement elle redevient possible.",
          },
        ],
        blocages: [
          {
            situation: "Un service écrit trois engagements de façade pour en finir, tous vagues.",
            parade:
              "Ne pas les accepter, et ne pas faire la leçon : poser la question, une seule fois, ligne par ligne — « qui, et quel jour ? ». Ne passez pas au service suivant tant que les trois lignes ne portent pas un nom et une date. À cinquante personnes, le premier service traité ainsi règle le comportement de tous les autres.",
          },
          {
            situation:
              "Un participant déclare qu'il ne s'engagera à rien parce qu'il ne croit pas à l'outil.",
            parade:
              "Ne pas le forcer et ne pas le disqualifier : « votre service s'engage, pas vous individuellement — et si vous voulez, l'engagement peut être de tester UNE fois et de dire non ». Un sceptique à qui on laisse la possibilité écrite de conclure « non » s'engage souvent ; un sceptique acculé bloque toute sa table.",
          },
          {
            situation: "Une table demande si tel engagement est conforme au règlement intérieur.",
            parade:
              "Formule exacte, prononcée telle quelle : « je ne me prononce pas, notez la question, votre conseil tranchera ». La direction répondra sur son calendrier à la séquence suivante — c'est son rôle, pas le vôtre.",
          },
        ],
        planB:
          "Réseau tombé : la transposition s'écrit sur la grille papier et s'essaiera au bureau — la version diffusable est alors marquée « à tester le [date] », avec un nom. Les engagements ne dépendent d'aucun outil et se tiennent intégralement : c'est la séquence à protéger en priorité si l'après-midi a pris du retard.",
      },
    },
    verification: {
      question:
        "Deux temps. Chaque table rejoue devant la salle l'astuce qu'elle a transposée : fonctionne-t-elle telle qu'elle est écrite, ou que manquait-il pour qu'elle fonctionne ailleurs ? Puis évaluation individuelle des acquis : dix questions sur terminal fourni ou téléphone personnel, au choix.",
      reponseAttendue:
        "Pour chaque astuce, soit elle fonctionne telle qu'elle est écrite, soit ce qui manquait est noté au tableau et ajouté à la version diffusable. Le QCM est corrigé et commenté en salle question par question, le résultat agrégé est affiché, et aucun résultat nominatif n'est communiqué à l'employeur.",
      dureeMin: 20,
      notes: {
        script:
          "L'évaluation des acquis se tient, se corrige et se conserve : c'est la première pièce qu'un auditeur demande. Si vous êtes en retard, coupez ailleurs — jamais ici. Redites AVANT d'ouvrir le QCM que le résultat individuel ne part pas chez l'employeur : ce qui est transmis, c'est l'attestation de fin et le fait que l'évaluation a eu lieu. Commentez le corrigé question par question sans en sauter, en insistant sur les trois plus ratées. Sur les rejeux d'astuces : ce qui manquait s'écrit sur la version diffusable, immédiatement, sinon la remarque se perd entre ici et le classeur.",
        faq: [
          {
            question: "Mon résultat au QCM va remonter à mon responsable ?",
            reponse:
              "Non. Le résultat individuel ne sort pas. Ce qui est transmis, c'est l'attestation de fin de formation et le fait que l'évaluation a eu lieu — le résultat affiché est agrégé.",
          },
          {
            question: "Je n'ai pas de téléphone compatible.",
            reponse:
              "Un terminal est fourni, il y en a plusieurs dans la salle. Personne n'est écarté de l'évaluation pour une question de matériel.",
          },
        ],
        blocages: [
          {
            situation: "Il est 17 h 15 et le QCM n'est pas commencé.",
            parade:
              "Le tenir quand même, en réduisant le commentaire du corrigé aux trois questions les plus ratées. On ne remplace jamais l'évaluation des acquis par un tour de table, quelle que soit l'heure.",
          },
          {
            situation: "Le sondage ou le QCM en ligne tombe au moment de le lancer.",
            parade:
              "Basculer immédiatement sur le QCM papier du kit (page 31), sans hésiter ni chercher à réparer devant la salle : la correction se fait à l'oral question par question, les copies se ramassent, l'évaluation est tenue et tracée.",
          },
        ],
        planB:
          "QCM papier et corrigé imprimés dans le kit (pages 31 et 32), en cinquante exemplaires. La correction se fait à l'oral, question par question, et les copies sont ramassées pour être conservées au dossier de la session.",
      },
    },
    synthese: {
      acquis: [
        "J'applique les règles communes écrites aujourd'hui par toutes les tables, et je sais où les relire.",
        "Je transpose à mon propre quotidien une astuce trouvée par un autre service.",
        "Je sais qui est le référent IA de l'entreprise et à qui je pose ma prochaine question.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Trois gestes, dans cet ordre, et aucun ne se saute. Un : cochez les six acquis au mur, à voix haute, en relisant chacun — c'est le bilan, et il se voit du fond de la salle. Deux : faites DÉSIGNER le référent IA devant tout le monde, par la direction, avec son accord dit à voix haute — un référent nommé en son absence ou « à confirmer plus tard » n'existera jamais ; écrivez son nom au tableau et sur la couverture du classeur. Trois : REMETTEZ LE CLASSEUR DE BORD table par table, complet — règle commune, pages service, demandes AXION éprouvées, astuces transposées, engagements, liste des questions ouvertes pour le conseil. Photographiez la page des engagements et envoyez-la au groupe avant de quitter la salle. Terminez par la date du point de suivi, dite à voix haute et notée par tout le monde : un séminaire sans rendez-vous suivant se dissout en trois semaines.",
        faq: [
          {
            question: "Qui met à jour le classeur ensuite ?",
            reponse:
              "Le référent IA qui vient d'être désigné, à la date de suivi qu'on vient de fixer. Sans titulaire et sans date, un document collectif meurt en trois semaines — vous le savez déjà pour d'autres documents.",
          },
        ],
        blocages: [
          {
            situation: "La direction préfère « réfléchir » avant de désigner le référent IA.",
            parade:
              "Ne pas insister publiquement plus d'une fois, mais poser la date : « alors écrivons la date à laquelle le nom sera annoncé, et à qui ». Une date annoncée devant cinquante personnes tient ; un « on verra » ne tient pas.",
          },
          {
            situation:
              "Le classeur est incomplet parce qu'une ou deux pages n'ont pas été versées.",
            parade:
              "Le dire au moment de la remise, sans dramatiser, et écrire les pages manquantes sur la couverture avec le nom du service qui doit les rendre et la date. Un livrable dont les trous sont écrits se complète ; un livrable dont les trous sont tus reste troué.",
          },
        ],
        planB:
          "Aucun outil en jeu : le classeur est en papier, il se remet en main propre. Si la photo des engagements ne peut pas être envoyée, faites recopier les trois lignes par chaque service sur sa propre feuille avant de partir.",
      },
    },
  },
];
