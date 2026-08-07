/**
 * CONTENU RÉDIGÉ — « IA pour bien commencer — journée complète » (1 jour, 7 h,
 * 4 modules).
 *
 * ## Ce que cette journée est — et n'est pas
 *
 * C'est la version JOURNÉE de la découverte : même public de débutants complets
 * que le format 4 h, mais avec le temps d'INSTALLER les usages au lieu de les
 * montrer. La différence se joue l'après-midi : chacun repart avec du concret à
 * son nom — deux demandes AXION testées sur ses propres tâches, une synthèse de
 * document vérifiée ligne à ligne, deux notes dictées, et un protocole de poste
 * rempli. Le formateur le dit explicitement en salle : ici, rien ne reste à
 * l'état de démonstration.
 *
 * ⚠️ Ce n'est PAS la 4 h étirée : le programme au catalogue est différent, les
 * séquences sont différentes, et ce fichier suit CES séquences-là.
 *
 * ## Le fil rouge
 *
 * Le protocole de poste se construit pièce par pièce : le module 1 pose le
 * régime d'usage et la liste de ce qui ne sort jamais, le module 2 produit les
 * demandes AXION conservées, le module 3 ajoute la synthèse vérifiée et les
 * notes dictées, le module 4 assemble le tout dans le protocole écrit et la
 * feuille de route.
 *
 * ## Trois règles que le formateur ne négocie pas
 *
 * **Un seul outil toute la journée** — celui validé dans la salle. En changer
 * en cours de route perd les débutants et rend les démonstrations
 * irreproductibles.
 *
 * **Aucune donnée personnelle réelle n'entre dans l'outil.** Les ateliers
 * tournent sur les tâches réelles des stagiaires, MAIS reformulées sans nom, et
 * sur les pièces de secours du kit. Un stagiaire qui colle un fichier client
 * nominatif est arrêté, sans discussion.
 *
 * **Le formateur n'arbitre aucune question juridique.** La formule est écrite
 * et se prononce telle quelle : « je ne me prononce pas, notez la question,
 * votre conseil tranchera ».
 *
 * ## Le public
 *
 * Des débutants complets. Leur blocage n° 1 n'est pas technique, c'est la peur
 * de mal faire — chaque parade de ce fichier rassure par le GESTE, jamais par
 * le discours. La lenteur réelle est budgétée : comptes à ouvrir, mots de passe
 * perdus, premier prompt tapé à deux doigts. C'est prévu dans les minutages,
 * et le formateur l'annonce pour désamorcer la honte.
 */

import type { EnrichissementFormation } from "./types";

/** Date de dernière vérification des captures et sorties d'outils. */
const VERIFIE_LE = "2026-08-06";

export const IA_POUR_BIEN_COMMENCER_JOURNEE: EnrichissementFormation = [
  // ───────────────────────────────────────────────────────────────────────────
  // Module 1 — Le cadre avant les mains sur le clavier
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-1",
    objectif: {
      enonce:
        "À la fin de ce module, vous décrivez ce qu'une IA générative fait bien et où elle invente, et vous dites, AVANT chaque usage, où vont les informations que vous lui donnez et ce qui ne sort jamais.",
      objectifGlobalId: "obj-1",
      // Les régimes d'usage, la liste de ce qui ne sort jamais et le tri
      // « ça part / ça ne part pas » installent les règles de confidentialité.
      objectifsSecondairesIds: ["obj-6"],
      dureeMin: 3,
      notes: {
        script:
          "Tour de table en UNE phrase : « votre prénom, et ce que vous espérez ne plus faire à la main dans six mois ». Notez les réponses au tableau, vous y reviendrez au module 4. Puis dites la phrase qui désamorce la peur de mal faire, mot pour mot : « vous ne pouvez rien casser aujourd'hui — le seul vrai risque est d'y mettre ce qui ne doit pas sortir, et c'est une règle qu'on apprend, pas une manipulation ». Annoncez le livrable de la journée : un protocole de poste rempli et des usages déjà testés sur SES tâches, pas des notes.",
        faq: [
          {
            question: "Je n'ai jamais ouvert un de ces outils, je vais suivre ?",
            reponse:
              "Oui — la formation est écrite pour vous. La première demande de la journée est fournie mot pour mot, personne ne démarre sur une page blanche.",
          },
          {
            question: "L'IA va remplacer nos postes ?",
            reponse:
              "Ce qu'on constate en entreprise : elle remplace des TÂCHES, pas des postes — et ceux qui savent s'en servir choisissent lesquelles. C'est précisément l'objet de la journée.",
          },
        ],
        blocages: [
          {
            situation: "Le tour de table dérive en débat sur les dangers de l'IA.",
            parade:
              "Couper avec : « toutes ces questions ont leur place à 9 h 30, le module qui vient est exactement là-dessus » — et tenir parole : les régimes d'usage et le règlement européen arrivent dans la demi-heure.",
          },
        ],
        planB:
          "Aucun outil n'est nécessaire ici. Sans vidéoprojecteur, le tour de table et l'annonce du livrable se tiennent au paperboard sans rien perdre.",
      },
    },
    demonstration: {
      avant:
        "On demande à l'outil de présenter une entreprise, et on lit la réponse comme un article fiable : assurée, structurée, convaincante. Personne dans la salle ne peut dire ce qui y est inventé — et c'est ce qui la rend dangereuse.",
      apres:
        "La même réponse reprise ligne à ligne avec une demande de justification : l'outil avoue ce qu'il a déduit et ce qu'il a inventé — l'entreprise n'existe pas. Puis une demande anodine rejouée en changeant UN seul mot, l'âge du candidat, et le ton de la réponse qui change de camp.",
      prompt:
        "DÉMONSTRATION 1 — l'aplomb. « Présente en dix lignes l'entreprise Menuiserie Valloire à Voiron : son histoire, ses effectifs et ses trois principaux clients. » Puis la reprise : « Reprends ta réponse ligne par ligne. Pour chaque affirmation, dis si elle vient d'une information vérifiable ou si tu l'as inventée pour compléter. Ne corrige rien, signale. »\n\nDÉMONSTRATION 2 — le biais. « Rédige la réponse de la boulangerie à ce message : “Bonjour, je m'appelle Théo, j'ai 19 ans, j'habite le quartier, je cherche un travail pour l'été.” » Puis la MÊME demande, un seul mot changé : « Bonjour, je m'appelle Théo, j'ai 58 ans, j'habite le quartier, je cherche un travail pour l'été. »",
      outil: "Un seul outil, celui validé dans la salle (tenu toute la journée).",
      captureEcran:
        "Démonstration 1 : la présentation inventée avec les affirmations avouées surlignées. Démonstration 2 : les deux réponses côte à côte, le mot changé entouré, les formulations qui basculent surlignées.",
      verifieLe: VERIFIE_LE,
      dureeMin: 18,
      notes: {
        script:
          "Ne dites PAS que la Menuiserie Valloire n'existe pas avant de lancer : laissez la salle lire la réponse et y croire, c'est le piège qui enseigne. Révélez ensuite, puis lancez la reprise ligne à ligne. Sur le biais : faites voter à main levée AVANT d'afficher la seconde réponse — « le ton sera-t-il le même ? ». Le vote engage, l'écart marque. Concluez les deux démonstrations par la même phrase : « elle n'a pas menti, elle a complété — et elle complète TOUJOURS ».",
        faq: [
          {
            question: "Pourquoi elle invente au lieu de dire qu'elle ne sait pas ?",
            reponse:
              "Parce qu'elle produit le texte le plus PLAUSIBLE, pas le plus vrai. Dire « je ne sais pas » est rarement la suite la plus plausible d'une question — sauf si vous le lui demandez explicitement, et c'est un des gestes de la journée.",
          },
          {
            question: "Les versions payantes inventent moins ?",
            reponse:
              "Elles se trompent moins souvent, mais aucune ne s'arrête d'elle-même à la frontière de ce qu'elle sait. La relecture reste obligatoire quel que soit l'abonnement.",
          },
        ],
        blocages: [
          {
            situation:
              "L'outil répond qu'il ne trouve pas d'information sur l'entreprise fictive, la démonstration 1 tombe à plat.",
            parade:
              "Excellente nouvelle à dire telle quelle : « voilà le comportement qu'on veut ». Puis relancer avec « fais quand même une présentation vraisemblable » — l'invention revient, et la salle voit qu'elle est à UNE relance de distance.",
          },
          {
            situation: "Les deux réponses de la démonstration 2 sont quasiment identiques.",
            parade:
              "Rejouer en changeant le quartier plutôt que l'âge (les deux variantes sont dans le kit). Si l'écart reste faible, le dire honnêtement : « les outils s'améliorent là-dessus, et voici les sorties d'il y a six mois » — pages du kit à l'appui.",
          },
        ],
        planB:
          "Quota atteint ou service en panne : les quatre sorties sont imprimées dans le kit formateur (datées). Le déroulé est identique sur papier — la révélation de l'entreprise fictive, le vote à main levée, la comparaison mot à mot. Ne rien improviser : les sorties du kit ont été vérifiées.",
      },
    },
    pratique: {
      consigne:
        "Trois temps, chronométrés. D'abord, connectez-vous et tapez votre toute première demande — celle du support, mot pour mot, pour que personne ne parte d'une page blanche. Ensuite, faites produire un texte de dix lignes sur VOTRE domaine, surlignez tout ce qui est faux ou invérifiable, comptez, puis exigez de l'outil qu'il justifie chaque affirmation une par une. Enfin, rejouez votre demande en changeant UN seul mot et notez ce qui bascule dans la réponse.",
      aEmporter:
        "Son premier texte annoté, avec le décompte de ce qui était faux ou invérifiable — la preuve personnelle, datée, que la relecture n'est pas une option. Première pièce du protocole de poste.",
      dureeMin: 40,
      notes: {
        script:
          "Annoncez d'emblée, à voix haute : « les dix premières minutes vont partir en comptes et en mots de passe, c'est prévu, personne n'est en retard ». Cette phrase seule évite qu'un tiers de la salle se referme. Circulez pendant la connexion : c'est là que les décrocheurs se repèrent. Pendant l'exercice, ne corrigez jamais un texte — demandez « qu'est-ce que vous n'avez pas pu vérifier ? » et laissez surligner. Écrivez les décomptes au tableau à la fin : cinq erreurs par texte en moyenne, affiché, vaut tous les discours sur la vigilance.",
        faq: [
          {
            question: "Je vais casser quelque chose si je me trompe ?",
            reponse:
              "Non. Une conversation ratée se ferme et s'oublie, il n'y a aucun bouton dangereux. Le seul vrai risque est d'y coller ce qui ne sort jamais — et c'est une règle qu'on vient d'apprendre, pas une manipulation.",
          },
          {
            question: "Ma demande est trop simple, ça marche pour de vrai comme ça ?",
            reponse:
              "Oui — et c'est le constat utile du matin : une demande simple produit un texte plausible. L'après-midi sert à passer de plausible à utilisable.",
          },
        ],
        blocages: [
          {
            situation: "Un stagiaire ne parvient pas à créer son compte (mail pro filtré, 2FA).",
            parade:
              "Ne pas laisser 40 minutes se perdre là-dessus : le mettre en binôme sur le poste du voisin, et lui prêter le poste de secours du formateur à la pause pour finaliser SON compte. Il doit repartir avec un accès qui marche.",
          },
          {
            situation: "Un stagiaire n'ose pas taper et regarde son voisin faire.",
            parade:
              "S'asseoir à côté, lui faire DICTER sa demande à voix haute et la taper avec lui — pas à sa place. La peur tombe au premier résultat obtenu ; c'est le geste qui rassure, pas l'explication.",
          },
          {
            situation: "Un stagiaire teste sur son domaine et ne trouve AUCUNE erreur.",
            parade:
              "Lui faire resserrer la demande sur du chiffrable : « donne les chiffres clés, les dates et les noms propres de mon domaine ». L'invention se niche dans le précis, pas dans le général.",
          },
        ],
        planB:
          "Réseau tombé : l'exercice de repérage se fait sur les trois textes pré-générés du kit (datées), chacun portant des erreurs plantées dans un domaine différent. Le surlignage, le décompte et le tableau des scores se tiennent à l'identique sur papier.",
      },
    },
    verification: {
      question:
        "Jeu de cartes en binôme : douze situations réelles à classer « ça part / ça ne part pas / ça ne part qu'en environnement validé » — un compte rendu avec des noms, une question technique générale, un fichier de paie, une photo de tableau blanc, un texte déjà public…",
      reponseAttendue:
        "Le corrigé du jeu de cartes, projeté carte par carte. Les trois cartes les plus ratées sont commentées en salle — habituellement le document « anonymisé » (pseudonymiser reste un traitement de données personnelles), la photo de tableau et le fichier envoyé « juste pour reformuler ».",
      dureeMin: 10,
      notes: {
        script:
          "Faites classer TOUTES les cartes avant de corriger quoi que ce soit — corriger au fil de l'eau tue le débat dans les binômes, et c'est le débat qui enseigne. Au corrigé, demandez le classement à main levée carte par carte, puis affichez. Sur les cartes ratées, faites dire POURQUOI par un binôme qui a juste avant de donner la règle.",
        faq: [
          {
            question: "Et si mon entreprise n'a pas d'environnement validé ?",
            reponse:
              "Alors la colonne du milieu est votre frontière : ce qui ne part qu'en environnement validé ne part pas du tout, tant que votre entreprise n'en a pas désigné un. Notez-le tel quel dans votre protocole cet après-midi.",
          },
        ],
        blocages: [
          {
            situation:
              "La salle veut savoir si un usage précis est légal dans SON entreprise (contrat client, clause de confidentialité).",
            parade:
              "Formule exacte, prononcée telle quelle : « je ne me prononce pas, notez la question, votre conseil tranchera ». Écrire la question au tableau — la liste des questions ouvertes est une production utile de la journée, elle entre dans la feuille de route.",
          },
        ],
        planB:
          "Le jeu de cartes est physique et le corrigé est imprimé dans le kit. Aucune dépendance à un outil ni au vidéoprojecteur.",
      },
    },
    synthese: {
      acquis: [
        "Je nomme le régime d'usage de mon poste avant d'ouvrir l'outil.",
        "Je repère une affirmation inventée et je la fais justifier.",
        "J'applique la liste de ce qui ne sort jamais — y compris aux photos et aux pièces jointes.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites FORMULER, ne récitez pas : « en une phrase, qu'est-ce que vous ne collerez plus jamais dans l'outil ? ». Trois réponses suffisent. Annoncez la pause, puis la suite en une phrase : « au retour, on apprend à formuler pour obtenir du premier coup un texte qui s'envoie — et tout ce que vous produirez à partir de maintenant se garde ».",
        faq: [],
        blocages: [
          {
            situation: "Il est l'heure de la pause et personne ne se lance.",
            parade:
              "Ne pas insister : énoncer les trois acquis vous-même et libérer. Un acquis arraché à contrecœur ne s'ancre pas mieux — la salle aura l'après-midi entier pour parler.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 2 — Formuler et relancer jusqu'au résultat utilisable (AXION)
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-2",
    objectif: {
      enonce:
        "À la fin de ce module, vous obtenez au premier ou au deuxième essai, sur une tâche réelle de votre poste, un texte que vous pouvez envoyer après relecture.",
      objectifGlobalId: "obj-3",
      // L'atelier fait choisir les tâches qui se prêtent à l'IA (obj-2) et les
      // réalise réellement sur le poste de chacun (obj-4).
      objectifsSecondairesIds: ["obj-2", "obj-4"],
      dureeMin: 3,
      notes: {
        script:
          "Annoncez le contrat du module tel quel : « à midi, vous aurez produit un texte que vous pouvez réellement envoyer — pas un exemple, le vôtre ». Puis posez la règle des ateliers du jour : on travaille sur de vraies tâches, reformulées SANS aucun nom ni donnée qui ne sort pas. C'est la mise en pratique immédiate de la liste du module 1, dites ce lien à voix haute.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "Un besoin réel apporté par la salle, formulé comme tout le monde le fait : une ligne spontanée. La sortie est correcte et générique — elle pourrait venir de n'importe qui, et il faudrait la réécrire entièrement pour l'envoyer.",
      apres:
        "Le même besoin structuré par les cinq leviers AXION : la sortie porte le contexte et les contraintes réelles. Puis une imperfection restante traitée par UNE des quatre relances, affichée en entier — relancer, pas recommencer.",
      prompt:
        "LA DEMANDE AXION (cas du kit si la salle n'apporte rien) :\nActeur : tu es assistant de direction dans une PME de services de vingt-cinq personnes.\nConteXte : je dois annoncer à un client fidèle un report de livraison d'une semaine, causé par un fournisseur.\nIntention : obtenir un e-mail que je peux envoyer après relecture, et qui préserve la relation.\nOutput : un e-mail de cent vingt mots maximum — objet, un paragraphe d'explication, une proposition de nouvelle date, une phrase de clôture.\nNormes : aucun jargon, aucune promesse de compensation, ne pas rejeter la faute sur le fournisseur.\n\nLES QUATRE RELANCES QUI DÉBLOQUENT, affichées en entier :\n1. Préciser la contrainte — « Reprends en tenant compte de ceci : le client a déjà subi un report le mois dernier. »\n2. Donner un exemple — « Voici un e-mail dont j'aime le ton : [collez-le]. Reprends dans cet esprit. »\n3. Imposer le format — « Reprends exactement le même contenu en dix lignes maximum, une idée par phrase. »\n4. Faire critiquer — « Relis ta propre réponse comme un lecteur pressé : qu'est-ce qui manque ou sonne faux ? Corrige. »",
      outil: "Un seul outil, celui validé dans la salle (tenu toute la journée).",
      captureEcran:
        "La demande d'une ligne et sa sortie générique, puis la demande AXION annotée en marge des cinq leviers et sa sortie, puis la relance n° 4 et ce qu'elle a corrigé — trois écrans en séquence.",
      verifieLe: VERIFIE_LE,
      dureeMin: 23,
      notes: {
        script:
          "Demandez un besoin réel à la salle AVANT d'écrire quoi que ce soit — « qui a un e-mail difficile à écrire cette semaine ? ». S'il n'en vient pas, prenez le cas du kit sans insister. Écrivez AXION au tableau et laissez-le affiché jusqu'à 17 h 30 : Acteur, conteXte, Intention, Output, Normes. Construisez la demande levier par levier EN posant les questions au porteur du besoin — la salle doit voir la demande s'écrire, pas apparaître. Sur les relances : n'en montrez qu'UNE en direct, les quatre sont sur le support ; dites la devise du module : « on relance, on ne recommence pas ».",
        faq: [
          {
            question: "Il faut vraiment écrire les cinq leviers à chaque fois ?",
            reponse:
              "Au début, oui — la trame est sur votre support, ça prend deux minutes. Avec l'habitude, ils viennent naturellement, mais quand une sortie déçoit, le réflexe reste : regarder lequel des cinq manque.",
          },
          {
            question: "Pourquoi ma version spontanée donne un résultat correct quand même ?",
            reponse:
              "Correct pour être lu, pas pour être envoyé. La question à se poser n'est pas « est-ce bien écrit ? » mais « combien de temps me faut-il encore pour pouvoir l'envoyer ? ». AXION réduit CE temps-là.",
          },
        ],
        blocages: [
          {
            situation:
              "Le besoin apporté par la salle contient des noms et des détails d'un client réel.",
            parade:
              "Le reformuler à voix haute AVANT de taper : « un client fidèle », « un report d'une semaine » — et faire remarquer le geste : « voilà exactement comment on travaille sur du réel sans faire sortir ce qui ne sort pas ».",
          },
          {
            situation:
              "La sortie AXION est excellente du premier coup, la relance n'a rien à corriger.",
            parade:
              "Utiliser la relance n° 4 quand même — « fais-toi critiquer » trouve toujours quelque chose, et c'est la démonstration que la relance sert aussi quand on est content du résultat.",
          },
        ],
        planB:
          "Outil indisponible : la construction de la demande AXION levier par levier se fait au tableau — c'est même meilleur pédagogiquement — et les sorties (spontanée, AXION, après relance) sont imprimées dans le kit (datées) sur le cas du report de livraison.",
      },
    },
    pratique: {
      consigne:
        "Deux ateliers chronométrés. Atelier 1 : listez trois tâches d'écriture ou de reformulation de votre semaine, barrez celles qui feraient sortir des données interdites ou qui engagent une décision — entourez celle qui se prête le mieux à l'IA. Écrivez votre demande AXION sur la trame, lancez-la, relancez DEUX fois avec deux relances différentes, conservez la version qui marche et notez en une ligne ce qui l'a débloquée. Atelier 2, en autonomie : même méthode sur une seconde tâche, sans accompagnement au tableau — le formateur ne répond qu'aux blocages.",
      aEmporter:
        "Deux demandes AXION écrites, testées et conservées avec, pour chacune, la relance qui l'a débloquée — relançables telles quelles lundi matin. Deuxième pièce du protocole de poste.",
      dureeMin: 60,
      notes: {
        script:
          "Le tri des trois tâches N'EST PAS du remplissage : c'est là que chacun apprend à reconnaître ce qui se prête à l'IA et ce qui ne s'y prête pas. Passez dans les rangs PENDANT le tri, pas seulement pendant la rédaction, et faites justifier les barrages : « pourquoi celle-là ne part pas ? ». Sur l'atelier 2, tenez la consigne d'autonomie : ne répondez qu'aux blocages, pas aux demandes de validation — « lancez, on regarde le résultat » est la seule réponse. C'est ce que la version 4 h de cette formation n'a pas le temps de faire : ici chacun teste sur SES tâches jusqu'à ce que ça marche, dites-le à la salle.",
        faq: [
          {
            question: "Je n'ai pas de tâches d'écriture dans mon poste.",
            reponse:
              "Reformuler, résumer, répondre, expliquer une procédure, préparer un point d'équipe : tout cela en est. La page 18 du support liste douze tâches par famille de poste — prenez-y la plus proche de votre quotidien.",
          },
          {
            question: "Ma relance a donné un résultat pire qu'avant.",
            reponse:
              "Ça arrive, et le geste existe : dites « reviens à ta version précédente » et choisissez une autre relance. On ne repart jamais de zéro.",
          },
        ],
        blocages: [
          {
            situation:
              "Un stagiaire colle dans l'outil un e-mail réel reçu d'un client, nominatif.",
            parade:
              "Arrêter immédiatement, sans négocier : c'est la règle du matin. Lui faire réécrire la situation en trois lignes neutres — et faire remarquer que la sortie est aussi bonne : l'outil n'avait pas besoin du nom.",
          },
          {
            situation: "Un binôme a fini l'atelier 1 en quinze minutes.",
            parade:
              "Leur donner la contrainte bonus du support : rejouer leur demande pour un destinataire opposé (un client mécontent au lieu d'un client fidèle) et comparer ce qui change. Personne n'attend sans consigne.",
          },
          {
            situation: "Un stagiaire lent n'a produit qu'une demande à la fin de l'atelier 2.",
            parade:
              "UNE demande testée et conservée suffit pour la suite de la journée — le lui dire pour désamorcer, et lui faire finir la seconde au début de la pause déjeuner seulement s'il le propose lui-même.",
          },
        ],
        planB:
          "Réseau tombé : la demande AXION s'écrit à la main sur la trame papier — c'est la structure qui s'apprend, pas le clavier. Les relances se préparent par écrit, prêtes à être lancées le soir même ; le formateur joue l'outil à l'oral sur deux ou trois demandes pour montrer ce qu'elles produiraient.",
      },
    },
    verification: {
      question:
        "Vérification croisée en binôme : le voisin rejoue votre demande TELLE QU'ELLE EST ÉCRITE, sans rien vous demander. Obtient-il un résultat comparable au vôtre ? Puis chacun coche la grille des cinq leviers sur la demande de l'autre : lesquels sont présents, lesquels manquent ?",
      reponseAttendue:
        "Un résultat comparable à la relecture des deux binômes, et les cinq leviers cochés — ou les manques nommés. Une demande qui ne marche que si son auteur l'explique à voix haute n'est pas finie : c'est le critère, dit tel quel.",
      dureeMin: 12,
      notes: {
        script:
          "Énoncez le critère avant l'échange : « une bonne demande marche sans vous ». C'est la première fois de la journée que quelqu'un d'autre exécute leur travail — dites que c'est exactement ce qui arrivera quand ils partageront leurs demandes à leurs collègues. Au corrigé oral, demandez quel levier manquait le plus souvent : c'est presque toujours le conteXte, et le dire prépare le module 3.",
        faq: [
          {
            question: "Nos deux résultats sont différents, qui a bon ?",
            reponse:
              "Différents mais tous deux utilisables : la demande est bonne. Différents et un seul utilisable : cherchez le levier qui manque — c'est lui qui laissait l'outil libre de choisir.",
          },
        ],
        blocages: [
          {
            situation: "Un binôme coche tout sans vraiment relire.",
            parade:
              "Annoncer que chaque binôme doit nommer À L'ORAL le levier le plus faible de la demande de l'autre — même excellente, une demande a un levier plus faible. La complaisance tombe.",
          },
        ],
        planB:
          "Sans outil, le voisin fait la relecture à froid : « est-ce que je saurais exécuter cette demande sans poser de question ? » — et coche la même grille des cinq leviers. Le test de rejeu se fera au retour au poste, la grille dit déjà l'essentiel.",
      },
    },
    synthese: {
      acquis: [
        "Je structure une demande en cinq leviers AXION sur la trame de mon support.",
        "Je choisis la relance qui débloque plutôt que de tout réécrire.",
        "Je reconnais une demande qui ne marchera jamais — et une tâche qui ne se prête pas à l'IA.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites lever la main : « qui a une demande conservée qu'il relancera lundi telle quelle ? ». Comptez à voix haute — le chiffre est la preuve du matin. Annoncez l'après-midi en une phrase : « on passe aux documents : déposer les vôtres, en tirer des synthèses que vous savez vérifier, et dicter au lieu de taper — tout se garde ».",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 3 — Travailler sur ses documents, dicter, vérifier contre la source
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-3",
    objectif: {
      enonce:
        "À la fin de ce module, vous déposez un document autorisé dans l'outil, vous en tirez une synthèse que vous vérifiez ligne à ligne contre la source, et vous produisez une note propre à partir d'une dictée de deux minutes.",
      objectifGlobalId: "obj-5",
      // La dictée et le travail sur ses propres pièces réalisent des tâches du
      // poste (obj-4) ; le filtre « quels documents ont le droit d'entrer »
      // applique les règles de confidentialité (obj-6).
      objectifsSecondairesIds: ["obj-4", "obj-6"],
      dureeMin: 3,
      notes: {
        script:
          "Ouvrez l'après-midi par la promesse qui distingue cette journée : « ce matin vous avez appris les gestes ; cet après-midi, tout ce qui se produit se GARDE — une synthèse vérifiée d'un de VOS documents, deux notes dictées, puis votre protocole ». Puis le garde-fou du module, en une phrase : avant de déposer quoi que ce soit, la question n'est plus « est-ce que l'outil sait le lire ? » mais « est-ce que ce document a le DROIT d'entrer ? ».",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "Un rapport d'une vingtaine de pages, déposé avec « résume ce document » : la synthèse est plate, mélange l'essentiel et l'accessoire, et se termine par une recommandation que le document ne contient pas. Personne ne s'en apercevrait sans ouvrir la source.",
      apres:
        "Le même rapport sous une demande AXION : la synthèse répond aux questions posées, chaque chiffre porte sa page, et la ligne « ce que le document ne dit pas » apparaît. Puis les trois échecs silencieux du dépôt, montrés un par un : le scan sans texte reconnu, le fichier trop lourd tronqué sans prévenir, le tableau qui se désaligne.",
      prompt:
        "Acteur : tu es un analyste chargé de préparer une synthèse pour quelqu'un qui n'a pas le temps de lire.\nConteXte : le document joint est un rapport interne d'une vingtaine de pages ; je dois en restituer l'essentiel à mon responsable.\nIntention : produire une synthèse fidèle et vérifiable, sans aucune interprétation ajoutée.\nOutput : dix lignes maximum — trois points clés, deux chiffres importants avec la page où chacun figure, puis une ligne « ce que le document ne dit pas ».\nNormes : appuie-toi UNIQUEMENT sur le document joint. Si une information n'y figure pas, écris « le document ne le dit pas ». N'ajoute aucune recommandation.",
      outil: "Un seul outil, celui validé dans la salle (tenu toute la journée).",
      captureEcran:
        "Les deux synthèses côte à côte : la recommandation inventée de la version vague entourée en rouge, les numéros de page de la version AXION surlignés — puis le scan illisible et le tableau désaligné, un écran chacun.",
      verifieLe: VERIFIE_LE,
      dureeMin: 12,
      notes: {
        script:
          "Utilisez le rapport du kit, jamais un document improvisé : les sorties sont connues et les échecs sont rejouables. Après la synthèse vague, demandez à la salle « qu'est-ce qui vous gêne ? » AVANT de montrer la version AXION — quelqu'un trouvera la recommandation inventée, et c'est mieux que si vous la montrez. Sur les trois échecs silencieux : montrez-les vite, sans en faire un cours — le but est que chacun les reconnaisse quand ils lui arriveront à l'atelier dans dix minutes, et ils arriveront.",
        faq: [
          {
            question: "Comment je sais si mon fichier a été lu en entier ?",
            reponse:
              "Demandez-lui : « quelle est la dernière section du document que tu as reçue ? ». Si la réponse ne correspond pas à la fin de votre fichier, il a été tronqué — coupez le document en deux et déposez les moitiés.",
          },
          {
            question: "Elle lit aussi les tableaux et les photos de documents ?",
            reponse:
              "Oui, avec les trois pièges qu'on vient de voir : un scan sans texte reconnu, un fichier trop lourd, un tableau qui se désaligne. Les trois parades sont sur votre support, on les pratique tout de suite.",
          },
        ],
        blocages: [
          {
            situation:
              "La synthèse vague du kit ressort étonnamment bonne, sans invention visible.",
            parade:
              "Poser à l'outil la question piège fournie dans le kit : « que recommande le document sur le budget ? » — le rapport ne recommande rien, et l'outil complète presque toujours. L'invention se provoque quand elle ne vient pas seule.",
          },
        ],
        planB:
          "Les deux synthèses et les trois échecs sont imprimés dans le kit (datées). La comparaison, l'entourage de la recommandation inventée et le repérage des pages se tiennent à l'identique sur papier.",
      },
    },
    pratique: {
      consigne:
        "Deux ateliers chronométrés. Atelier 1 : déposez un document de votre poste AUTORISÉ par le régime identifié ce matin — au moindre doute, prenez le rapport de secours du support. Tirez-en une synthèse avec la demande du support, puis posez TROIS questions précises au document et notez chaque réponse avec sa page. Atelier 2, téléphone en main : dictez deux minutes sans vous arrêter sur un sujet de votre poste, faites transformer la dictée en note propre ; puis second passage sur le compte rendu de la réunion fictive fournie. Vous repartez avec deux notes produites sans clavier.",
      aEmporter:
        "Une synthèse d'un document de son poste avec ses réponses sourcées page par page, et deux notes produites à la voix — troisième pièce du protocole de poste, à rejouer telles quelles au bureau.",
      dureeMin: 50,
      notes: {
        script:
          "Le contrôle du dépôt se fait AVANT le dépôt : passez dans les rangs et faites dire à chacun pourquoi son document a le droit d'entrer — c'est l'application vivante du jeu de cartes du matin. Sur la dictée : faites dicter TOUT LE MONDE en même temps, le brouhaha lève la gêne de parler à son téléphone devant les autres — personne ne s'écoute. Annoncez que la première dictée sera hésitante et que c'est prévu : « euh », reprises et blancs disparaissent dans la note propre, c'est précisément ce que la démonstration a montré. Rappelez le geste de vérification : chaque affirmation de la synthèse doit se retrouver dans la source — c'est l'objet de la vérification qui suit.",
        faq: [
          {
            question: "Je n'ai aucun document autorisé sur mon poste, tout est confidentiel.",
            reponse:
              "Alors c'est une vraie information sur votre poste — notez-la pour votre protocole. Pour l'atelier, prenez le rapport de secours du support : le geste s'apprend pareil, vous le rejouerez au bureau sur ce que votre entreprise aura validé.",
          },
          {
            question: "Dicter devant les autres, très peu pour moi.",
            reponse:
              "Tout le monde dicte en même temps, personne ne vous écoute. Et si vraiment non : tapez trois phrases en style télégraphique et faites-en produire la note propre — le geste de transformation est le même.",
          },
        ],
        blocages: [
          {
            situation: "Un stagiaire dépose un document avec des noms de clients ou de salariés.",
            parade:
              "Arrêter immédiatement, faire supprimer la conversation, et repartir sur le rapport de secours. Puis dire à la salle, sans désigner personne : « c'est l'erreur la plus fréquente en entreprise, et vous venez de voir qu'elle se rattrape en dix secondes si on la voit tout de suite ».",
          },
          {
            situation: "Le dépôt échoue en silence (scan, poids, tableau) — c'était annoncé.",
            parade:
              "Renvoyer au support : « c'est l'échec n° 1, 2 ou 3 ? appliquez sa parade ». Le stagiaire qui diagnostique lui-même son échec vient de gagner son autonomie — ne pas le faire à sa place.",
          },
          {
            situation:
              "La dictée téléphone ne marche pas (micro refusé, appareil verrouillé par la DSI).",
            parade:
              "Basculer sur le micro de l'ordinateur ; à défaut, style télégraphique tapé puis transformé. Le livrable reste deux notes propres — le canal d'entrée n'a jamais été le sujet.",
          },
        ],
        planB:
          "Réseau tombé : la synthèse se vérifie sur le couple document/synthèse imprimé du kit — chercher chaque affirmation dans la source est un exercice papier complet. La dictée se remplace par la trame « note télégraphique → note propre » à la main, et se rejoue au poste dès le retour.",
      },
    },
    verification: {
      question:
        "Sur la synthèse de votre voisin : retrouvez dans le document source CHAQUE affirmation, une par une. Combien tiennent ? Lesquelles ont été ajoutées par l'outil — et reportez le décompte sur la grille remise.",
      reponseAttendue:
        "Chaque affirmation pointée vers sa page ou marquée « introuvable dans la source ». Le décompte est reporté sur la grille — la découverte attendue est qu'une synthèse propre peut contenir une affirmation introuvable, et qu'on ne le voit qu'en la cherchant.",
      dureeMin: 15,
      notes: {
        script:
          "Faites l'exercice sur la synthèse du VOISIN, jamais la sienne : on ne relit pas bien ce qu'on vient de produire. Collectez les décomptes à main levée — « qui a trouvé au moins une affirmation introuvable ? » — et écrivez le nombre de mains au tableau. Concluez sur la règle qui part dans le protocole : une synthèse ne se transmet qu'après ce contrôle, et le contrôle prend cinq minutes, pas une heure.",
        faq: [
          {
            question: "L'affirmation est vraie, je le sais, mais elle n'est pas dans le document.",
            reponse:
              "Alors elle est introuvable dans la source, et c'est ça qui compte : celui qui recevra la synthèse croira qu'elle vient du document. Soit vous la sourcez ailleurs, soit vous la retirez.",
          },
        ],
        blocages: [
          {
            situation: "Les binômes survolent au lieu de chercher dans la source.",
            parade:
              "Imposer le geste : chaque affirmation reçoit un numéro de page écrit à côté, ou la mention « introuvable ». Une case à remplir force la recherche qu'une consigne orale n'obtient pas.",
          },
        ],
        planB:
          "L'exercice est déjà un exercice papier si les synthèses ont été imprimées ; sinon, il se fait sur le couple document/synthèse du kit, qui contient trois affirmations introuvables à découvrir.",
      },
    },
    synthese: {
      acquis: [
        "Je dépose un document autorisé et je l'interroge — pages à l'appui.",
        "Je vérifie une synthèse contre sa source avant de la transmettre.",
        "Je produis un écrit propre à partir d'une dictée de deux minutes.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites compter ce qui est déjà dans les mains : deux demandes AXION du matin, une synthèse vérifiée, deux notes dictées. Dites-le tel quel : « voilà la différence avec une formation d'une demi-journée — tout ceci existe et il est 16 h ». Annoncez la pause puis le dernier module : « on assemble tout dans VOTRE protocole, et vous repartez avec ».",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 4 — Ce qui sort de vos mains : protocole de vérification et diffusion
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-4",
    objectif: {
      enonce:
        "À la fin de ce module, vous repartez avec un protocole de poste écrit à votre nom : ce que vous confiez à l'IA, ce que vous ne lui confiez pas, et ce que vous vérifiez avant d'envoyer.",
      objectifGlobalId: "obj-6",
      // Le protocole écrit « ce que je confie / ce que je ne confie pas » est
      // la formalisation d'obj-2 : les tâches qui se prêtent à l'IA et celles
      // qui ne s'y prêtent pas, arrêtées poste par poste.
      objectifsSecondairesIds: ["obj-2"],
      dureeMin: 3,
      notes: {
        script:
          "Reprenez le tableau du matin — le tour de table « ce que vous espérez ne plus faire à la main ». Pointez ce que la journée a couvert et ce qu'elle n'a pas couvert : l'honnêteté sur le second point achète la crédibilité du reste. Puis annoncez le module en une phrase : « il reste une heure et demie, et elle sert à une seule chose — que tout ça tienne encore dans trois semaines, écrit, à votre nom ».",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "Une production du jour relue « à l'œil » : trente secondes, rien à signaler, on enverrait. C'est la relecture que tout le monde pratique — elle valide le ton et laisse passer le reste.",
      apres:
        "La même production passée à la grille en cinq points — exactitude, ton, format, source, réutilisable tel quel : deux défauts sortent en deux minutes, dont un chiffre invérifiable. Et la règle qui accompagne l'envoi : ce qu'on indique au destinataire quand un écrit a été produit avec l'IA — l'IA prépare, l'humain décide et signe.",
      prompt:
        "Relis le texte ci-dessous comme un relecteur exigeant, à la grille en cinq points : 1. exactitude — chiffres, noms, dates, chaque affirmation est-elle vérifiable ; 2. ton — adapté au destinataire indiqué ; 3. format — celui demandé est-il respecté ; 4. source — d'où vient chaque information engageante ; 5. réutilisable tel quel — qu'est-ce qui doit être personnalisé avant envoi. Pour chaque point, réponds « tenu » ou « à corriger », en citant la ligne concernée. Ne réécris pas le texte, ne corrige rien toi-même.\n\n[Coller ici la production à relire.]",
      outil: "Un seul outil, celui validé dans la salle (tenu toute la journée).",
      captureEcran:
        "La production affichée deux fois : vierge après la relecture « à l'œil », puis annotée des cinq points de la grille avec les deux défauts entourés — et la mention au destinataire affichée en dernier.",
      verifieLe: VERIFIE_LE,
      dureeMin: 8,
      notes: {
        script:
          "Prenez une production RÉELLE du jour, avec l'accord de son auteur — demandez un volontaire, il y en a toujours un après une journée entière. Chronométrez la relecture à l'œil devant la salle : trente secondes, « ça part ». Puis la grille, point par point. La chute à dire telle quelle : « la grille n'est pas plus intelligente que vous — elle est juste plus régulière, et c'est exactement ce qu'on demande à une relecture ». Terminez sur la signature : celui qui envoie signe, donc celui qui envoie vérifie.",
        faq: [
          {
            question: "On doit vraiment dire au destinataire que c'est fait avec l'IA ?",
            reponse:
              "Certains contenus doivent l'indiquer, et votre entreprise peut l'exiger plus largement — c'est une ligne de votre protocole, à faire arbitrer chez vous. Ce qui ne se discute pas : c'est vous qui signez, donc vous qui répondez du contenu.",
          },
        ],
        blocages: [
          {
            situation: "Aucun volontaire ne veut prêter sa production du jour.",
            parade:
              "Ne forcer personne : la production de secours du kit contient les deux défauts calibrés. La démonstration perd un peu de chair mais rien de sa mécanique.",
          },
        ],
        planB:
          "La production de secours et sa relecture aux cinq points sont imprimées dans le kit (datées). La comparaison œil contre grille se fait au paperboard, chronomètre en main.",
      },
    },
    pratique: {
      consigne:
        "Deux temps sur la trame fournie. D'abord, remplissez votre protocole de poste : votre régime d'usage, votre liste « ce qui ne sort jamais » écrite sur VOS dossiers à vous, votre grille de relecture en cinq points calibrée sur ce que vous avez produit aujourd'hui, et la mention au destinataire. Ensuite, la feuille de route, au verso : les trois usages que vous relancez cette semaine et à quel moment de la journée, ce que vous ne ferez PAS, et à qui vous posez vos questions quand vous bloquez.",
      aEmporter:
        "Le protocole de poste complet, rempli et signé de son nom — régime d'usage, liste personnelle de ce qui ne sort jamais, grille de relecture, mention au destinataire — et la feuille de route de la semaine au verso. C'est LE document qui rentre au bureau.",
      dureeMin: 45,
      notes: {
        script:
          "Le piège de cet atelier est la généralité : « je ferai attention » n'est pas une ligne de protocole. Passez derrière chaque stagiaire et exigez du NOMMÉ : quels dossiers, quels fichiers, quel moment de la semaine. Sur la feuille de route, la question qui force le concret : « lundi matin, vous ouvrez quoi en premier ? ». Chaque usage porte un moment précis, sinon il n'aura pas lieu. La ligne « ce que je ne ferai pas » se remplit avec ce qui a été barré ce matin à l'atelier des trois tâches — le lien est sur leur support, faites-le faire.",
        faq: [
          {
            question: "Mon entreprise a peut-être déjà des règles là-dessus, je fais quoi ?",
            reponse:
              "Votre protocole s'écrit quand même, et il porte une ligne « à vérifier contre la charte interne ». S'il existe une règle plus stricte que la vôtre, c'est elle qui gagne — notez qui la connaît dans votre entreprise, c'est votre premier interlocuteur de la feuille de route.",
          },
          {
            question: "Trois usages par semaine, c'est peu, non ?",
            reponse:
              "Trois usages TENUS valent mieux que dix intentions. Ceux qui installent durablement l'IA dans leur poste sont ceux qui ont commencé petit et régulier — vous élargirez à la deuxième semaine.",
          },
        ],
        blocages: [
          {
            situation:
              "Un stagiaire recopie la liste générique du support au lieu d'écrire la sienne.",
            parade:
              "Une question suffit : « citez-moi UN fichier précis de votre poste qui est dans cette liste ». S'il ne peut pas, la liste n'est pas la sienne — le faire repartir de ses vrais dossiers, ceux qu'il a ouverts cette semaine.",
          },
          {
            situation:
              "Un stagiaire veut faire remplir son protocole par l'outil « pour aller plus vite ».",
            parade:
              "Refuser avec le sourire et l'argument du jour : le protocole est précisément ce qui doit venir de lui — c'est la partie « l'humain décide ». L'outil peut en relire la clarté à la fin, pas en choisir le contenu.",
          },
        ],
        planB:
          "L'atelier est entièrement papier : trame, protocole, feuille de route. Aucun outil nécessaire — c'est l'atelier le plus robuste de la journée, il se tient intégralement même si tout le reste a été dégradé.",
      },
    },
    verification: {
      question:
        "Évaluation des acquis en deux temps. Quiz individuel de douze questions, corrigé en salle question par question. Puis vérification par la production : chacun relit UNE de ses productions du jour à SA propre grille en cinq points, note les points corrigés — et le voisin contrôle que la grille a réellement été appliquée, point par point.",
      reponseAttendue:
        "Le corrigé du quiz est commenté question par question, sans en passer aucune ; le seuil de réussite est celui déclaré au programme, et un score en dessous déclenche la reprise individuelle prévue au dispositif. Sur la relecture : au moins un point marqué « à corriger » par production — une grille qui ne trouve jamais rien n'a pas été appliquée.",
      dureeMin: 23,
      notes: {
        script:
          "C'est l'évaluation des acquis au sens de l'indicateur 11 : elle se tient, elle se corrige, elle se conserve. Si la journée a pris du retard, coupez ailleurs — jamais ici. Annoncez avant le quiz que le résultat individuel n'est pas transmis à l'employeur : la salle se détend et répond mieux. Sur la vérification par la production, le contrôle du voisin porte sur l'APPLICATION de la grille, pas sur la qualité du texte — cinq points regardés, cinq cases cochées ou commentées.",
        faq: [
          {
            question: "Le résultat du quiz est transmis à mon employeur ?",
            reponse:
              "Le résultat individuel, non. Ce qui est transmis : l'attestation de fin de formation et le fait que l'évaluation a eu lieu.",
          },
        ],
        blocages: [
          {
            situation: "Il est 17 h 10 et le quiz n'est pas commencé.",
            parade:
              "Le tenir quand même, en réduisant le commentaire du corrigé aux questions les plus ratées. On ne remplace jamais l'évaluation par un tour de table — c'est la première pièce qu'un auditeur demande.",
          },
          {
            situation: "Un stagiaire relit sa production et ne trouve rien à corriger.",
            parade:
              "Lui faire échanger sa production avec le voisin : l'œil externe trouve en deux minutes ce que l'auteur ne voit plus. Le point trouvé entre alors dans SA grille comme exemple calibré.",
          },
        ],
        planB:
          "Quiz papier dans le kit et corrigé page 34. La relecture à la grille est déjà un exercice papier. Aucune dépendance à un outil.",
      },
    },
    synthese: {
      acquis: [
        "J'écris ce que je confie à l'IA et ce que je ne lui confie pas — c'est dans mon protocole.",
        "Je relis toute production à ma grille en cinq points avant de l'envoyer.",
        "Je relance trois usages seul dès lundi, à un moment que j'ai fixé.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Chacun lit à voix haute UNE ligne de sa feuille de route — l'usage de lundi et son moment. Un engagement prononcé devant le groupe tient mieux qu'une ligne écrite. Puis la remise du protocole, en le nommant : ce n'est pas un support de cours, c'est LEUR document de travail. Fermez sur la différence assumée avec le format court : « une demi-journée donne les réflexes ; aujourd'hui vous partez avec vos demandes testées, votre synthèse vérifiée, vos notes dictées et votre protocole — tout est déjà à votre nom ».",
        faq: [],
        blocages: [
          {
            situation: "Les engagements restent vagues : « je vais essayer d'utiliser l'IA ».",
            parade:
              "Reformuler en une question : « sur quelle tâche, et à quel moment de lundi ? ». Ne pas passer au suivant tant que la réponse ne porte pas une tâche et un moment.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },
];
