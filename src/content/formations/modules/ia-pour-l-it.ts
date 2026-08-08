/**
 * CONTENU RÉDIGÉ — « IA pour l'IT » (2 jours, 14 h, 4 modules de 210 min).
 *
 * ## Le fil rouge
 *
 * Chacun repart avec UN runbook d'usage de l'IA dans son équipe, en six
 * sections versées au fil des quatre demi-journées : §1 règle de soumission,
 * §2 propriété des sorties, §3 taux d'erreur mesuré sur son propre
 * environnement, §4 tâches qualifiées, §5 écrits d'astreinte, §6 articles de
 * charte retenus. Aucun module ne se suffit à lui-même : la règle du matin J1
 * est ce qui autorise l'atelier de débogage de l'après-midi, et le taux
 * d'erreur mesuré au matin J2 est ce qui interdit l'automatisation aveugle de
 * l'après-midi.
 *
 * ## Trois règles que le formateur ne négocie pas
 *
 * **Le code produit par l'IA n'est jamais exécuté en production sans revue ET
 * sans test.** C'est la règle centrale des deux jours, et elle est vérifiable :
 * chaque atelier qui produit du code produit aussi le test qui le juge. Une
 * commande destructive suggérée par un outil n'est pas une aide maladroite,
 * c'est un incident — on l'affiche, on la nomme, on ne la corrige pas en
 * silence.
 *
 * **Rien de secret ne sort.** Mots de passe, clés d'API, jetons, chaînes de
 * connexion, fichiers de configuration réels, extraits de journaux. Un extrait
 * de journal porte presque toujours une adresse IP, un identifiant de compte
 * ou un nom d'utilisateur : c'est une donnée personnelle avant d'être une
 * donnée technique, et c'est à ce titre qu'on l'enseigne — pas comme une
 * formalité administrative.
 *
 * **Le formateur n'arbitre aucune question de sécurité ni de conformité propre
 * à l'entreprise.** La formule est écrite et se prononce telle quelle : « je ne
 * me prononce pas, notez la question, votre RSSI tranchera ». Les trames
 * remises (charte-type, grille des régimes, grille haut risque) portent un
 * en-tête « Projet — à faire valider par votre RSSI et votre conseil avant
 * diffusion » qui n'est pas retirable.
 *
 * ⚠️ La salle sait lire du code et repérera toute approximation. Les références
 * réglementaires citées dans les blocs `cadre` sont fournies au formateur
 * SOURCÉES ET DATÉES dans le kit, et ne se citent jamais de mémoire. Leur
 * formulation reste à faire relire par le conseil de l'organisme.
 */

import type { EnrichissementFormation } from "./types";

/** Date de dernière vérification des captures et sorties d'outils. */
const VERIFIE_LE = "2026-08-06";

export const IA_POUR_L_IT: EnrichissementFormation = [
  // ───────────────────────────────────────────────────────────────────────────
  // Module 1 — Matin J1 : ce qui se soumet, avec quel outil, sous quel régime
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-1",
    objectif: {
      enonce:
        "À la fin de ce module, vous écrivez votre règle de soumission — quel extrait, sur quel outil, sous quel régime — et vous la faites tenir sur trois extraits pièges sans laisser passer un secret.",
      objectifGlobalId: "obj-5",
      dureeMin: 5,
      notes: {
        script:
          "Tour de table en UNE phrase : « votre prénom, votre environnement, et l'outil d'IA que vous utilisez déjà — y compris si personne ne vous a dit que vous aviez le droit ». Cette dernière incise fait sortir l'usage clandestin dès la première minute, et c'est la matière du module. Notez les outils cités au tableau, ils resteront affichés deux jours. Annoncez la règle qui tient la formation : le code produit par l'IA n'est jamais exécuté en production sans revue et sans test. Annoncez le livrable : le runbook en six sections.",
        faq: [
          {
            question: "On va coder avec l'IA ou parler de conformité toute la matinée ?",
            reponse:
              "Vous coderez cet après-midi, et vous générerez vos propres tests. La matinée décide de ce que vous avez le droit de coller dans l'outil — sans quoi l'après-midi se fait à l'aveugle.",
          },
          {
            question: "Notre DSI a bloqué ces outils, à quoi ça sert ?",
            reponse:
              "Un blocage n'est pas une interdiction de l'IA, c'est un régime d'usage par défaut. On va nommer les trois régimes, et vous saurez quoi demander pour en changer — ou pourquoi ne pas le demander.",
          },
        ],
        blocages: [
          {
            situation:
              "Le tour de table dérive en comparaison d'outils (« le nôtre est meilleur que le vôtre »).",
            parade:
              "Couper avec : « on travaille sur UN outil aujourd'hui, celui qui est validé chez vous ; la méthode se transpose, pas la démonstration ». Écrire au tableau la liste des outils cités et passer.",
          },
        ],
        planB:
          "Aucun outil n'est nécessaire ici. Sans vidéoprojecteur, le tour de table et les trois règles se tiennent au paperboard sans rien perdre.",
      },
    },
    demonstration: {
      avant:
        "On pose une question à l'outil et on lit la réponse. Personne ne regarde ce qui est PARTI : le chat n'a reçu que l'extrait collé, l'assistant intégré à l'éditeur a lu des fichiers ouverts que personne n'a choisis, l'agent a parcouru le dépôt entier avant de répondre.",
      apres:
        "Le MÊME prompt, mot pour mot, passé dans les trois modes du même outil. Trois réponses différentes, et surtout trois contextes envoyés différents. La réponse la plus assurée est celle du mode qui en savait le moins — c'est l'enseignement, et il tient en une capture.",
      prompt:
        "Voici une fonction extraite d'un service interne. Explique ce qu'elle fait, ligne par ligne, puis liste les cas d'entrée qu'elle ne traite pas. N'invente aucune valeur : si une constante ou une fonction appelée ici n'est pas sous tes yeux, écris « non résolu » et continue.\n\nfunction resoudreRemise(client, panier) {\n  const seuil = SEUILS[client.segment] ?? SEUILS.defaut;\n  if (panier.total < seuil) return 0;\n  const taux = TAUX[client.segment] ?? 0;\n  return Math.min(panier.total * taux, PLAFOND);\n}",
      outil:
        "Un seul outil, celui validé dans la salle, passé successivement dans ses trois modes : chat, assistant intégré à l'éditeur, agent.",
      captureEcran:
        "Les trois sorties côte à côte, et SOUS chacune le panneau « contexte envoyé » de l'outil — nombre de fichiers lus, noms des fichiers. Encadrer en rouge, dans la sortie du mode chat, la phrase qui affirme une valeur de SEUILS ou de PLAFOND que l'outil n'a jamais vue.",
      verifieLe: VERIFIE_LE,
      dureeMin: 20,
      notes: {
        script:
          "Faites PARIER par écrit avant d'afficher : « lequel des trois modes va vous dire ce que vaut PLAFOND ? ». La salle parie sur l'agent, et le mode chat le dit aussi — sauf qu'il l'invente. Lisez la sortie du chat à voix haute, sans commentaire : elle est plausible, bien écrite, et fausse. Attendez que quelqu'un le dise. C'est le moment qui installe la vigilance des deux jours : l'outil écrit du code, il ne comprend pas votre système. Montrez ENSUITE les panneaux de contexte, pas avant.",
        faq: [
          {
            question:
              "Le mode agent a la bonne réponse, donc il suffit de toujours utiliser le mode agent ?",
            reponse:
              "Il a la bonne réponse parce qu'il a lu le dépôt. C'est exactement ce qui pose problème quand le dépôt contient un fichier de configuration ou une clé. La bonne réponse et le risque viennent du même geste.",
          },
          {
            question: "Comment je sais ce que l'assistant de mon éditeur envoie vraiment ?",
            reponse:
              "Vous ne le déduisez pas, vous le lisez : panneau de contexte, documentation de l'outil, page de paramètres. C'est l'exercice de la séquence suivante, sur votre propre poste.",
          },
        ],
        blocages: [
          {
            situation:
              "Le mode chat respecte la consigne et écrit « non résolu » partout : la démonstration tombe à plat.",
            parade:
              "Relancer le même prompt en retirant la dernière phrase (« N'invente aucune valeur… »). Sans la garde, l'invention revient presque toujours — et la salle vient de voir, en direct, ce qu'une seule ligne de consigne change. C'est un meilleur enseignement que le premier.",
          },
          {
            situation: "Un stagiaire propose de coller un fichier de son vrai dépôt « pour voir ».",
            parade:
              "Refuser sans négocier : « on ne soumet rien avant d'avoir écrit la règle, c'est précisément l'objet de la matinée ». Noter sa proposition au tableau, elle deviendra un cas du tri de 11 h.",
          },
        ],
        planB:
          "Quota atteint ou service indisponible : les trois sorties et les trois panneaux de contexte sont imprimés dans le kit formateur (datées). Le pari écrit, la lecture à voix haute et la comparaison se tiennent à l'identique sur papier. Ne rien improviser en direct sur un autre outil : les sorties du kit ont été vérifiées.",
      },
    },
    pratique: {
      consigne:
        "Trois temps. (1) Sur votre propre poste et SANS RIEN SOUMETTRE, ouvrez les pages de paramètres de votre outil : relevez ce qui est journalisé, ce qui est retenu pour l'entraînement, ce qui est effaçable et sous quel délai — puis cochez votre régime réel sur la grille des trois régimes. (2) Tri des cas limites : les 12 situations fournies au kit, chacune tranchée « soumettable / à neutraliser d'abord / jamais », puis confrontation en binôme sur le corrigé. (3) Bac à sable : montez votre environnement conforme — dépôt de test, extrait neutralisé de votre vrai code, outil paramétré au régime retenu — et rédigez les sections 1 et 2 de votre runbook : votre règle de soumission, et la propriété des sorties.",
      aEmporter:
        "Un environnement de travail conforme monté sur votre poste, la grille des trois régimes cochée, et les sections 1 et 2 de votre runbook — règle de soumission et propriété des sorties.",
      dureeMin: 90,
      notes: {
        script:
          "Sur les paramètres : exigez la CAPTURE ou la citation exacte, pas le souvenir. « L'outil ne garde rien, il paraît » n'est pas une réponse ; la page de paramètres en est une. Sur le tri des 12 cas : ne donnez pas le corrigé avant la confrontation en binôme, le désaccord est l'apprentissage. Sur le bac à sable : le mot « neutralisé » se définit au tableau AVANT l'atelier — on remplace les valeurs, on ne les masque pas, et on vérifie le résultat avec une recherche sur les motifs de secrets fournie au kit. Passez dans les rangs et regardez les écrans : c'est le seul moment de la formation où vous pouvez attraper une clé en clair avant qu'elle ne parte.",
        faq: [
          {
            question: "Remplacer les noms par des lettres, ça suffit ?",
            reponse:
              "Non. Un extrait de journal garde ses adresses IP, ses identifiants de session, ses horodatages — de la donnée personnelle. Pseudonymiser n'est pas anonymiser, et la clause de confidentialité de votre contrat client ne parle pas de noms, elle parle d'informations.",
          },
          {
            question: "Le code que l'outil me rend, il est à qui ?",
            reponse:
              "C'est la section 2 de votre runbook et la grille du kit y répond point par point : titularité, contamination possible par une licence copyleft si l'outil restitue un fragment reconnaissable, cession au client. Sur votre contrat précis, je ne me prononce pas : notez la question, votre conseil tranchera.",
          },
          {
            question: "Et si j'utilise un compte personnel pour aller plus vite ?",
            reponse:
              "C'est le régime 1 de la grille, et il a une conséquence écrite : aucun engagement de non-réutilisation. Ce n'est pas moi qui l'interdis, c'est votre contrat client qui le dit ou non — notez la question pour votre RSSI.",
          },
        ],
        blocages: [
          {
            situation:
              "Un stagiaire n'a aucun accès administrateur et ne peut pas ouvrir les paramètres de l'outil.",
            parade:
              "Le kit fournit les trois pages de paramètres imprimées. Il fait l'exercice dessus et note en marge « à vérifier auprès de la DSI le … ». Une ligne de plus dans sa feuille de route, pas une exclusion de l'atelier.",
          },
          {
            situation:
              "La salle veut trancher un cas réel de son entreprise (« notre code client, on peut ou pas ? »).",
            parade:
              "Formule exacte, prononcée telle quelle : « je ne me prononce pas, notez la question, votre RSSI tranchera ». Écrire la question au tableau — la liste des questions ouvertes est une production utile des deux jours.",
          },
          {
            situation: "Un binôme finit le tri des 12 cas en dix minutes.",
            parade:
              "Leur donner les 4 cas supplémentaires du kit, plus fins — dont un extrait de configuration qui ne contient aucun secret mais révèle l'architecture — et leur demander de préparer la restitution.",
          },
        ],
        planB:
          "Réseau tombé : la grille des régimes, le tri des 12 cas et la rédaction des sections 1 et 2 ne dépendent d'aucun outil, ils se font sur le support papier. Seul le montage du bac à sable est reporté — annoncez-le comme premier geste du retour au bureau et faites-le écrire dans la feuille de route.",
      },
    },
    verification: {
      question:
        "Contrôle croisé : chaque binôme applique la RÈGLE DE L'AUTRE aux 3 extraits pièges du kit (une trace applicative contenant une adresse IP et un identifiant, un fichier de configuration sans secret mais révélant l'architecture, un extrait sous licence copyleft) et relève ce qui passerait à tort. Puis 6 questions corrigées collectivement, et chacun rectifie sa section 1.",
      reponseAttendue:
        "Les trois extraits sont bloqués ou neutralisés par la règle de l'autre, et l'écart est nommé quand ils ne le sont pas. Le corrigé montre les trois formulations de règle qui laissent systématiquement passer un secret : celle qui liste ce qui est interdit au lieu d'autoriser ce qui est permis, celle qui parle de « données sensibles » sans les définir, et celle qui n'a pas de vérification avant collage.",
      dureeMin: 25,
      notes: {
        script:
          "Contrôle CROISÉ, jamais auto-correction : une règle qu'on relit soi-même paraît toujours claire. Faites appliquer la règle de l'autre littéralement, sans interpréter — c'est ce qui révèle les trous. Projetez le corrigé après. Commentez deux ou trois écarts seulement, ceux qui reviennent dans la salle. Puis faites RECTIFIER la section 1 séance tenante, stylo en main : une règle qu'on corrige le lendemain n'est jamais corrigée.",
        faq: [
          {
            question: "On note ? Ça compte pour l'attestation ?",
            reponse:
              "Non. L'évaluation des acquis est demain à 16 h, sur dix questions. Ceci sert à repérer ce qui coince pendant qu'on peut encore le corriger.",
          },
          {
            question: "Ma règle interdit tout, elle est forcément bonne ?",
            reponse:
              "Elle est inapplicable, donc elle sera contournée dès lundi. Une règle qui n'autorise rien produit exactement l'usage clandestin qu'on a listé ce matin.",
          },
        ],
        blocages: [
          {
            situation: "Les binômes se valident mutuellement sans rien relever.",
            parade:
              "Annoncer que chaque binôme doit remonter AU MOINS un écart et que vous en demanderez un à l'oral. La complaisance tombe immédiatement.",
          },
          {
            situation: "Un désaccord technique s'installe et mange le temps du corrigé.",
            parade:
              "Le trancher par le kit, pas par l'autorité : les trois extraits pièges sont accompagnés de la raison écrite pour laquelle ils sont pièges. Si le désaccord porte sur leur entreprise, il part au tableau des questions ouvertes.",
          },
        ],
        planB:
          "Extraits pièges, grille et corrigé sont imprimés dans le kit. Aucun outil nécessaire.",
      },
    },
    synthese: {
      acquis: [
        "Je lis ce que mon outil envoie avant de lire ce qu'il répond — mode par mode.",
        "J'applique une règle de soumission écrite, qui autorise explicitement plutôt qu'elle n'interdit vaguement.",
        "Je neutralise un extrait avant tout collage, et je vérifie la neutralisation au lieu de la supposer.",
      ],
      dureeMin: 15,
      notes: {
        script:
          "Faites-les FORMULER, ne récitez pas : « en une phrase, qu'est-ce que vous ne collerez plus à partir de ce soir ? ». Trois réponses suffisent. Faites ensuite nommer la règle que chacun applique dès ce soir, à voix haute — une règle qu'on n'a pas prononcée ne tient pas devant un collègue. Annoncez l'après-midi en une phrase : on écrit du code avec l'outil, et c'est le test qui dira s'il a raison.",
        faq: [
          {
            question: "Ma règle vaut pour toute l'équipe ou juste pour moi ?",
            reponse:
              "Pour vous aujourd'hui. Elle deviendra un article de charte demain après-midi, et c'est là qu'on regardera qui la valide et ce qui relève de l'information-consultation.",
          },
        ],
        blocages: [
          {
            situation: "Personne ne parle, il est 12 h 25 et la salle veut déjeuner.",
            parade:
              "Ne pas insister : énoncer les trois acquis vous-même, faire écrire la règle du soir en silence, libérer. Un acquis récité à contrecœur ne s'ancre pas mieux.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 2 — Après-midi J1 : code, tests et débogage
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-2",
    objectif: {
      enonce:
        "À la fin de ce module, vous faites générer les tests d'une de vos fonctions et vous les passez au vert, et vous chiffrez ce qu'une revue assistée signale à tort.",
      objectifGlobalId: "obj-2",
      // Ce module sert aussi l'assistance au code proprement dite : la methode
      // AXION appliquee a une demande technique et la generation de tests.
      objectifsSecondairesIds: ["obj-1"],
      dureeMin: 5,
      notes: {
        script:
          "Annoncez le contrat de l'après-midi en deux phrases, sans emballage : l'outil va écrire du code, et rien de ce qu'il écrit ne sera cru sur parole. Ce qui juge, c'est le test qui tourne, pas le formateur et pas la salle. Précisez que les deux parcours du kit existent — développement et exploitation — pour que personne ne passe l'après-midi à regarder les autres travailler.",
        faq: [
          {
            question: "Je fais de l'exploitation, je ne code pas. Je fais quoi pendant les tests ?",
            reponse:
              "Le parcours exploitation du kit : script d'inventaire ou de collecte, et son jeu d'essai. Même geste, même règle — ce qui juge, c'est l'exécution sur un jeu connu.",
          },
        ],
        blocages: [
          {
            situation: "La salle revient du déjeuner et le premier atelier démarre à froid.",
            parade:
              "Faire relire à voix basse la règle de soumission écrite le matin avant d'ouvrir quoi que ce soit. Trente secondes, et l'après-midi démarre sur la bonne règle.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "Une demande technique écrite comme elle s'écrit vraiment : « refais cette fonction proprement ». La sortie compile, adopte un style qui n'est pas le nôtre, ajoute une dépendance qu'on n'utilise pas, supprime un cas qui paraissait mort et ne rend aucun test. Elle a l'air meilleure — c'est tout le piège.",
      apres:
        "La même demande au format AXION, dont la ligne Normes porte l'interdiction d'ajouter une dépendance, l'obligation de préserver les cas traités et l'obligation de rendre les tests. Puis la même exigence retournée contre du code : une revue assistée d'un changement fourni au kit, qui contient trois défauts connus.",
      prompt:
        "DEMANDE SPONTANÉE — « Refais cette fonction proprement. »\n\nMÊME DEMANDE AU FORMAT AXION —\nActeur : tu es un développeur qui reprend un service hérité, sans son auteur et sans sa documentation.\nConteXte : la fonction ci-jointe est appelée depuis trois endroits que je ne te montre pas ; la suite de tests existante tourne avec le lanceur intégré au langage, sans framework maison.\nIntention : proposer une réécriture à ISO-COMPORTEMENT, pas une amélioration fonctionnelle.\nOutput : d'abord le code réécrit, puis les tests qui prouvent l'iso-comportement, puis la liste des comportements que tu n'as pas pu préserver faute d'information.\nNormes : n'ajoute AUCUNE dépendance ; ne change aucune signature publique ; ne supprime aucun cas traité, même s'il te paraît mort ; n'écris aucune commande à exécuter ; si un comportement est ambigu, écris « ambigu » et n'arbitre pas.\n\nREVUE ASSISTÉE, 2e séquence — « Voici un changement au format diff unifié. Pour chaque bloc modifié, donne trois lignes : ce qui change en une phrase, le risque de régression, et la présence éventuelle en clair d'un secret, d'un identifiant ou d'une adresse. N'évalue pas le style et ne propose aucune réécriture. Si tu ne peux pas juger sans voir un fichier absent du diff, écris « hors diff » et ne suppose rien. »",
      outil: "Un seul outil, celui validé dans la salle.",
      captureEcran:
        "Les deux sorties de la réécriture côte à côte, avec en marge du prompt AXION les cinq leviers annotés, et surlignage dans la sortie spontanée de la dépendance ajoutée et du cas supprimé. Pour la revue : la sortie avec les trois défauts réels cochés en vert et les alertes injustifiées barrées en rouge.",
      verifieLe: VERIFIE_LE,
      dureeMin: 40,
      notes: {
        script:
          "Écrivez AXION au tableau et laissez-le affiché deux jours : Acteur, conteXte, Intention, Output, Normes. Lancez d'abord la demande spontanée et laissez la salle trouver la sortie « plutôt propre » — c'est le piège, une salle technique tombe dedans comme les autres. Faites chercher la dépendance ajoutée et le cas supprimé AVANT de les montrer. Sur la ligne Normes : c'est la seule qui protège, insistez. Sur la revue assistée : le changement du kit contient exactement trois défauts (une régression, un secret en clair, un cas limite non traité) et l'outil en signale toujours plus — faites COMPTER les alertes injustifiées à voix haute, le chiffre vaut tous les discours sur la relecture.",
        faq: [
          {
            question: "Pourquoi lui interdire d'écrire les commandes à exécuter ?",
            reponse:
              "Parce qu'une commande écrite est une commande que quelqu'un collera dans un terminal sans la lire. Ce que l'outil propose s'exécute après revue, jamais parce que c'était écrit.",
          },
          {
            question: "Si la revue signale trop de faux positifs, elle ne sert à rien ?",
            reponse:
              "Elle sert exactement à ce que vous mesurez cet après-midi : elle attrape le secret en clair, qui est le défaut le plus coûteux, au prix d'alertes que vous écartez en dix secondes. C'est un rapport, pas un verdict.",
          },
          {
            question:
              "L'outil ne voit pas les appelants, comment peut-il juger l'iso-comportement ?",
            reponse:
              "Il ne le peut pas, et c'est pour ça que la ligne Output lui demande la liste de ce qu'il n'a pas pu préserver. Cette liste est la partie utile de la sortie.",
          },
        ],
        blocages: [
          {
            situation:
              "La sortie AXION ajoute quand même une dépendance, malgré la ligne Normes explicite.",
            parade:
              "Excellent incident : gardez-le à l'écran. C'est la preuve vivante que la consigne réduit le risque sans le supprimer, et que la revue reste obligatoire. Ne le cachez pas, exploitez-le.",
          },
          {
            situation: "Un stagiaire veut faire la revue sur un vrai changement de son dépôt.",
            parade:
              "Refuser : le changement du kit est fourni précisément pour que la correction soit vérifiable sans lire le code d'aucun client. « On compte des défauts connus, sinon on ne compte rien. »",
          },
        ],
        planB:
          "Les deux sorties de réécriture et la sortie de revue sont imprimées dans le kit (datées), la sortie de revue déjà annotée. La comparaison, le comptage des faux positifs et la mise en commun se tiennent à l'identique sur papier.",
      },
    },
    pratique: {
      consigne:
        "Quatre temps. (1) Réécrivez deux de vos demandes techniques au format AXION, passez-les à l'outil, et notez PAR ÉCRIT ce que la ligne Normes a changé dans la sortie. (2) Faites générer les tests d'une de vos fonctions existantes, exécutez-les, corrigez jusqu'au vert — c'est le test qui corrige, pas le formateur. (3) Passez le changement du kit en revue assistée : relevez les trois défauts et comptez les alertes injustifiées. (4) Débogage : d'une trace d'erreur réelle NEUTRALISÉE selon votre règle du matin, tirez trois hypothèses testables, et vérifiez-en au moins une dans votre environnement.",
      aEmporter:
        "Deux demandes techniques au format AXION réutilisables, une suite de tests au vert sur une de vos fonctions, votre comptage personnel d'alertes injustifiées, et trois hypothèses de débogage dont une vérifiée.",
      dureeMin: 125,
      notes: {
        script:
          "Annoncez les trois causes d'échec AVANT que quiconque échoue : le test généré teste la fonction telle que l'outil l'a IMAGINÉE et pas telle qu'elle est ; l'outil propose une commande d'installation qu'il ne faut pas exécuter ; la trace collée n'a pas été neutralisée. Les parades sont sur le support. Un technicien qui échoue sans avoir été prévenu se referme pour la journée ; prévenu, il vous appelle. Sur le débogage : « on ne colle jamais une trace de production telle quelle » se répète au démarrage de l'atelier, pas seulement le matin — une trace porte des adresses et des identifiants. Faites vérifier au moins une hypothèse dans l'environnement réel : une hypothèse non testée n'est pas un acquis, c'est une opinion.",
        faq: [
          {
            question: "Les tests générés passent tous du premier coup, c'est bon signe ?",
            reponse:
              "C'est le contraire. Vérifiez qu'ils échouent quand vous cassez volontairement la fonction. Un test qui ne rougit jamais ne teste rien.",
          },
          {
            question: "L'outil me propose une commande d'installation, je la lance ?",
            reponse:
              "Non, et c'est la règle des deux jours : on lit, on comprend, on décide. Une commande suggérée par un outil et exécutée sans lecture, c'est un incident en attente.",
          },
          {
            question: "Ma trace d'erreur fait 400 lignes, je la neutralise comment ?",
            reponse:
              "Vous n'en collez pas 400 : vous collez le message et la pile d'appels, sans les adresses, sans les identifiants et sans les valeurs métier. Le support donne le motif de recherche à passer avant collage.",
          },
        ],
        blocages: [
          {
            situation:
              "Un stagiaire n'a pas d'environnement de développement utilisable sur son poste.",
            parade:
              "Le parcours exploitation du kit ne demande qu'un interpréteur de commandes et un fichier d'exemple. Ne le laissez pas regarder son voisin travailler pendant deux heures.",
          },
          {
            situation:
              "L'outil suggère une commande destructive dans une réponse (suppression, écrasement, réinitialisation).",
            parade:
              "Arrêter l'atelier trente secondes et l'AFFICHER à toute la salle. Ce n'est pas une maladresse à corriger discrètement, c'est l'incident que la formation enseigne à voir. Puis reprendre : « voilà pourquoi rien ne s'exécute sans lecture ».",
          },
          {
            situation: "Un binôme finit l'atelier tests en vingt minutes.",
            parade:
              "Leur demander de casser volontairement la fonction de trois manières et de vérifier que la suite rougit à chaque fois. S'ils y arrivent, ils passent à la revue en avance et prépareront la mise en commun.",
          },
        ],
        planB:
          "Sans réseau : les demandes AXION s'écrivent à la main sur la trame (ce qui compte est la structure, pas l'exécution), et la revue se fait sur la sortie imprimée du kit — le comptage des faux positifs reste identique. L'atelier tests devient une lecture critique d'une suite de tests fournie page 26, avec la question « qu'est-ce que cette suite ne teste pas ? ». Le débogage se tient sur la trace neutralisée du kit.",
      },
    },
    verification: {
      question:
        "5 questions corrigées collectivement, puis chacun annonce à voix haute l'hypothèse de débogage que l'IA a proposée et qui s'est révélée FAUSSE après vérification — en disant ce qui l'a rendue plausible.",
      reponseAttendue:
        "Chacun a au moins une hypothèse fausse à annoncer, et sait dire pourquoi elle tenait : elle collait au message d'erreur sans rien savoir de l'architecture. Le corrigé des 5 questions porte sur la neutralisation, la commande jamais exécutée, le test qui doit pouvoir rougir, la dépendance ajoutée et le faux positif de revue.",
      dureeMin: 15,
      notes: {
        script:
          "Le tour d'hypothèses fausses est le cœur de la vérification, pas les 5 questions. Faites-le à voix haute et notez les hypothèses au tableau : la salle découvre qu'elles se ressemblent toutes — elles expliquent le message d'erreur et ignorent le système. Quelqu'un qui n'a rien à annoncer n'a pas vérifié : renvoyez-le à sa vérification plutôt que de le laisser passer.",
        faq: [
          {
            question: "Et si l'IA avait raison sur mes trois hypothèses ?",
            reponse:
              "Alors dites-le, et dites comment vous l'avez su : vous avez vérifié. C'est la vérification qui compte, pas le score de l'outil.",
          },
        ],
        blocages: [
          {
            situation: "Personne ne veut annoncer son hypothèse fausse devant la salle.",
            parade:
              "Commencez par la vôtre, une vraie, avec la manière dont vous vous êtes fait avoir. La salle suit dans les trente secondes.",
          },
        ],
        planB: "Les 5 questions et leur corrigé sont imprimés dans le kit.",
      },
    },
    synthese: {
      acquis: [
        "Je structure une demande technique avec les cinq leviers AXION, et j'écris ce que la ligne Normes doit interdire.",
        "Je ne fais confiance qu'au test qui tourne — et je vérifie qu'il sait rougir.",
        "Je n'exécute aucune commande suggérée par un outil sans l'avoir lue et comprise.",
      ],
      dureeMin: 10,
      notes: {
        script:
          "Faites-les FORMULER, puis annoncez le geste à essayer avant demain : une seule chose, écrite, avec l'endroit où elle sera faite. « Je ferai générer les tests de la fonction X du service Y » et pas « j'essaierai les tests ». Annoncez le jour 2 en une phrase : demain matin, on mesure ce que l'outil se trompe sur VOTRE environnement, et le chiffre décidera de ce qu'on automatise l'après-midi.",
        faq: [],
        blocages: [
          {
            situation: "Le geste annoncé reste vague (« je vais utiliser l'IA plus souvent »).",
            parade:
              "Une seule question : « sur quel fichier, et quel jour ? ». Ne pas passer au suivant tant que la réponse ne porte pas un nom et une date.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 3 — Matin J2 : vérifier, spécifier, documenter l'incident
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-3",
    objectif: {
      enonce:
        "À la fin de ce module, vous avez chiffré le taux d'erreur d'une production IA sur votre propre environnement, et vous transformez une demande floue en spécification testable.",
      objectifGlobalId: "obj-3",
      // Ce module produit aussi la documentation technique proprement dite :
      // runbook d'astreinte et compte rendu d'incident.
      objectifsSecondairesIds: ["obj-1"],
      dureeMin: 5,
      notes: {
        script:
          "Reprenez en une phrase le tour d'hypothèses fausses d'hier soir. Annoncez la matinée sans la vendre : on ne va pas discuter de la fiabilité de l'IA, on va la MESURER, chacun sur son propre environnement, et le chiffre obtenu sera écrit en section 3 du runbook. Prévenez que le chiffre sera plus élevé que ce que la salle croit — et qu'il variera d'un environnement à l'autre, ce qui est précisément l'enseignement.",
        faq: [
          {
            question: "On va encore parler des limites de l'IA toute la matinée ?",
            reponse:
              "Un quart d'heure, mesuré, et le reste de la matinée produit vos écrits : spécification, runbook, compte rendu d'incident. Le chiffre sert à savoir combien vous relisez, pas à conclure que ça ne marche pas.",
          },
        ],
        blocages: [
          {
            situation: "Deux participants manquent à l'appel au démarrage du jour 2.",
            parade:
              "Démarrer à l'heure et leur donner la chasse à l'erreur en rattrapage à la pause : c'est l'exercice le plus autonome de la matinée, il se refait seul avec le support.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "Une demande métier arrive par écrit, floue, et part directement en développement : chacun l'interprète, personne n'écrit ce qu'elle suppose, et l'écart se découvre à la recette. Côté astreinte, les notes d'intervention restent dans un carnet et le compte rendu n'est jamais écrit.",
      apres:
        "La même demande passée en spécification : ce qu'elle dit, ce qu'elle suppose sans le dire, des critères d'acceptation vérifiables par un test, et un hors-périmètre explicite. Puis les mêmes notes brutes d'astreinte, neutralisées, transformées en compte rendu d'incident et en runbook exécutable par un collègue réveillé à 3 h.",
      prompt:
        "SPÉCIFICATION — « Voici une demande reçue par écrit d'un utilisateur métier, telle quelle : “Il faudrait qu'on puisse exporter les commandes pour la compta, comme avant mais en mieux, et que ça marche aussi pour les avoirs.”\nTransforme-la en spécification, en exactement quatre sections : (1) ce que la demande dit explicitement ; (2) ce qu'elle suppose sans le dire, sous forme de questions à poser au demandeur, sans aucune réponse inventée ; (3) des critères d'acceptation rédigés en « étant donné / quand / alors », chacun vérifiable par un test ; (4) le hors-périmètre explicite. N'écris aucune estimation de charge, aucune solution technique, aucun nom de table ni de fichier. Si une section ne peut pas être remplie à partir de la demande, écris « à instruire » plutôt qu'une hypothèse. »\n\nÉCRITS D'ASTREINTE — « Voici mes notes brutes d'intervention, NEUTRALISÉES (aucun nom d'hôte réel, aucune adresse, aucun identifiant, aucun extrait de journal) : “02h14 alerte lenteur appli. 02h20 file d'attente qui monte. 02h31 redémarré le service intermédiaire, ça repart 10 min puis rebelote. 02h55 vidé le cache, stable depuis. Pas compris pourquoi.”\nProduis deux écrits distincts à partir de CES SEULES NOTES. (1) Un compte rendu d'incident : déroulé horodaté, ce qui a été constaté, ce qui a été fait, ce qui reste inexpliqué ; la partie « cause » ne contient que ce que les notes établissent, tout le reste va dans une section « hypothèses non vérifiées ». (2) Un runbook pour un collègue réveillé à 3 h : étapes numérotées, une action par étape, et pour chaque étape la manière de vérifier qu'elle a fonctionné et la manière de revenir en arrière. N'invente aucun horaire, aucun composant, aucune métrique absente des notes. »",
      outil: "Un seul outil, celui validé dans la salle.",
      captureEcran:
        "Pour la spécification : la sortie avec la section 2 (« ce qu'elle suppose ») surlignée — c'est la seule qui n'existait dans aucune version manuelle. Pour l'astreinte : le compte rendu avec la section « hypothèses non vérifiées » encadrée, et à côté la version où l'outil avait été laissé libre et affirmait une cause.",
      verifieLe: VERIFIE_LE,
      dureeMin: 35,
      notes: {
        script:
          "Sur la spécification : lisez la demande métier à voix haute et demandez à la salle de dire, en dix secondes, ce qu'elle a compris. Trois lectures différentes sortent toujours. C'est ce désaccord que la section 2 rend visible — insistez, c'est là qu'est la valeur, pas dans les critères d'acceptation que tout le monde sait écrire. Sur les écrits d'astreinte : montrez d'abord la sortie où l'outil, laissé libre, AFFIRME une cause qu'aucune note n'établit. La salle la reconnaîtra comme plausible. Puis la version contrainte, où la même chose est rangée en « hypothèses non vérifiées ». La différence n'est pas cosmétique : un compte rendu qui affirme une cause fausse oriente toute la suite de l'analyse.",
        faq: [
          {
            question: "Écrire la spécification, c'est le travail du chef de projet, pas le mien.",
            reponse:
              "La section 2 est la vôtre : elle liste ce qu'il faut demander avant de coder. C'est le seul document qui vous protège d'une recette perdue.",
          },
          {
            question: "Pourquoi lui interdire de proposer une solution technique ?",
            reponse:
              "Parce qu'une solution proposée dans la spécification devient la solution imposée en réunion, sans que personne n'ait instruit les alternatives.",
          },
          {
            question: "Le runbook généré, on peut le mettre dans notre base de connaissance ?",
            reponse:
              "Après l'avoir exécuté, pas avant. C'est exactement la vérification de 12 h : votre binôme l'exécute pas à pas et signale la première étape infaisable.",
          },
        ],
        blocages: [
          {
            situation:
              "L'outil produit une spécification impeccable et la salle conclut qu'elle n'a plus rien à faire.",
            parade:
              "Faire lire la section 2 ligne à ligne : chaque question qui s'y trouve est une décision que personne n'a prise. « L'outil a écrit les questions, il n'a répondu à aucune. »",
          },
          {
            situation:
              "L'outil respecte la consigne et n'affirme aucune cause dans le compte rendu.",
            parade:
              "Relancer sans la phrase « la partie cause ne contient que ce que les notes établissent ». La cause inventée revient presque toujours — et la salle voit ce qu'une seule ligne de contrainte a évité.",
          },
        ],
        planB:
          "Les deux jeux de sorties (spécification libre / contrainte, compte rendu libre / contraint) sont imprimés dans le kit (datées). La comparaison se tient à l'identique sur papier.",
      },
    },
    pratique: {
      consigne:
        "Trois temps. (1) Chasse à l'erreur, chronométrée : faites produire une procédure d'installation ou de migration sur VOTRE environnement — vos versions, votre système, vos contraintes — surlignez tout ce qui est faux (version inexistante, option qui n'existe pas, chemin erroné, commande inventée, ordre impossible), comptez, et versez le décompte en section 3 de votre runbook. Rien n'est exécuté. (2) Transformez une vraie demande métier en spécification, critères d'acceptation et tickets, puis faites-la relire en binôme sur la grille fournie — testable, borné, hors-périmètre explicite. (3) Produisez un runbook d'astreinte ou un compte rendu d'incident réel à partir de vos notes brutes neutralisées, relu en binôme sur la grille — exactitude, réversibilité, ce qu'un collègue comprend à 3 h du matin.",
      aEmporter:
        "Votre taux d'erreur chiffré sur votre propre environnement (section 3 du runbook), une spécification avec ses critères d'acceptation et ses tickets, et un runbook d'astreinte ou un compte rendu d'incident relu (section 5).",
      dureeMin: 115,
      notes: {
        script:
          "Sur la chasse à l'erreur : ANNONCEZ QUE RIEN NE S'EXÉCUTE, deux fois, avant et pendant. Une procédure d'installation générée est exactement le genre de texte qu'un technicien colle par réflexe. Faites relever le décompte à main levée et écrivez les chiffres au tableau, prénom par prénom — la dispersion entre environnements est l'enseignement, pas la moyenne. Sur la spécification : les binômes relisent sur la grille, ils ne réécrivent pas. Sur les écrits d'astreinte : rappelez la neutralisation au démarrage de l'atelier, pas seulement hier — les notes d'astreinte contiennent presque toujours un nom d'hôte et un identifiant. Passez dans les rangs et regardez les écrans.",
        faq: [
          {
            question: "Mon décompte est de zéro erreur, l'outil connaît bien mon environnement.",
            reponse:
              "Alors durcissez : demandez la procédure sur votre version exacte, la plus récente ou la plus ancienne que vous exploitez. Le taux d'erreur monte avec la précision de la question, et c'est le vrai enseignement.",
          },
          {
            question:
              "On peut lui donner la documentation officielle pour qu'il arrête d'inventer ?",
            reponse:
              "Oui, et c'est la bonne réponse : fournir le texte plutôt que d'espérer qu'il s'en souvienne. Notez-le, c'est un geste à installer dès lundi.",
          },
          {
            question: "Mes notes d'astreinte sont sur un outil interne, je peux les copier ?",
            reponse:
              "Après neutralisation, selon votre règle d'hier. Si votre règle ne tranche pas ce cas, c'est qu'elle est incomplète : rectifiez-la maintenant, c'est le bon moment.",
          },
        ],
        blocages: [
          {
            situation:
              "Un stagiaire lance la procédure générée sur une machine réelle « pour voir ».",
            parade:
              "Arrêter immédiatement, sans négocier. C'est le seul point de la matinée où l'on ne discute pas : on ne teste pas une procédure non relue sur une machine qui compte.",
          },
          {
            situation:
              "Un stagiaire n'a aucune note d'astreinte ni aucun incident récent à documenter.",
            parade:
              "Le kit fournit un jeu de notes brutes neutralisées. L'exercice est identique et la grille de relecture aussi.",
          },
          {
            situation: "La salle veut savoir si un runbook généré peut valoir preuve en audit.",
            parade:
              "Formule exacte : « je ne me prononce pas, notez la question, votre RSSI tranchera ». Écrire la question au tableau des questions ouvertes.",
          },
        ],
        planB:
          "Sans réseau : la chasse à l'erreur se fait sur les deux procédures pré-générées du kit, erreurs non signalées — le comptage et le débat sur la dispersion restent entiers. La spécification et les écrits d'astreinte s'écrivent à la main sur les trames, et les grilles de relecture en binôme ne dépendent d'aucun outil.",
      },
    },
    verification: {
      question:
        "Chaque binôme EXÉCUTE le runbook de l'autre pas à pas, sur son environnement de bac à sable, et signale la première étape infaisable — celle où il ne sait pas quoi taper, ou celle qu'il ne saurait pas annuler. Puis 5 questions corrigées collectivement.",
      reponseAttendue:
        "La première étape infaisable est nommée sur chaque runbook, et son auteur la corrige séance tenante. Un runbook qui passe entièrement est suspect : le corrigé montre les trois formes de l'étape qui paraît exécutable et ne l'est pas — celle qui suppose un accès non dit, celle qui ne donne aucun moyen de vérifier qu'elle a réussi, celle qui ne peut pas être annulée.",
      dureeMin: 25,
      notes: {
        script:
          "Exécution RÉELLE sur le bac à sable, pas lecture : un runbook se juge en le suivant, pas en le relisant. Interdisez à l'auteur de commenter pendant que l'autre exécute — c'est tout l'intérêt, personne ne sera là à 3 h du matin pour expliquer. Faites corriger l'étape séance tenante. Puis les 5 questions, corrigées collectivement, sans en sauter aucune.",
        faq: [
          {
            question: "Mon binôme ne connaît pas mon environnement, il va bloquer partout.",
            reponse:
              "C'est exactement le test. Un collègue d'astreinte ne connaît pas votre environnement non plus. Ce qui bloque votre binôme bloquera l'astreinte.",
          },
        ],
        blocages: [
          {
            situation: "Un binôme déclare le runbook de l'autre parfait en trois minutes.",
            parade:
              "Exiger qu'il désigne l'étape qu'il ne saurait pas ANNULER. Il y en a toujours une, et c'est celle qui compte.",
          },
          {
            situation: "L'exécution déborde et les 5 questions passent à la trappe.",
            parade:
              "Couper l'exécution à l'heure annoncée et tenir les 5 questions : elles préparent l'évaluation des acquis de l'après-midi. Le runbook non fini part en feuille de route.",
          },
        ],
        planB:
          "Sans environnement disponible, l'exécution devient une lecture à voix haute par le binôme, qui s'arrête à la première étape qu'il ne saurait pas exécuter. Le kit fournit les 5 questions et leur corrigé.",
      },
    },
    synthese: {
      acquis: [
        "Je chiffre ce que l'outil se trompe sur mon environnement, au lieu d'en discuter.",
        "Je transforme une demande floue en critères d'acceptation vérifiables par un test.",
        "J'écris un runbook qui dit comment vérifier chaque étape et comment revenir en arrière.",
      ],
      dureeMin: 15,
      notes: {
        script:
          "Faites-les FORMULER. Puis faites verser les sections 3 et 5 au runbook, stylo en main, ici et maintenant : le taux d'erreur mesuré, et l'écrit d'astreinte relu. Une section qu'on remplira « en rentrant » ne se remplit pas. Annoncez l'après-midi en une phrase : on automatise, et le taux que vous venez d'écrire décide de ce qu'on s'autorise à automatiser.",
        faq: [
          {
            question: "Le taux d'erreur, on le remesure quand ?",
            reponse:
              "Au prochain changement de version de vos outils ou de votre environnement. Écrivez la date dans votre runbook, sinon elle n'arrivera jamais.",
          },
        ],
        blocages: [
          {
            situation:
              "La salle veut prolonger le débat sur la fiabilité au lieu de remplir le runbook.",
            parade:
              "Renvoyer au chiffre écrit au tableau : « le débat est tranché par vos décomptes, remplissez la section 3 ». Puis libérer pour le déjeuner.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 4 — Après-midi J2 : automatiser une tâche IT et gouverner l'usage
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-4",
    objectif: {
      enonce:
        "À la fin de ce module, vous avez qualifié deux tâches, éprouvé une automatisation avec sa procédure de retour arrière, et retenu les articles de charte que vous soumettrez à validation.",
      objectifGlobalId: "obj-4",
      // La gouvernance de l'usage (charte, journalisation, filtrage, revue
      // humaine) prolonge directement la regle de confidentialite du jour 1.
      objectifsSecondairesIds: ["obj-5"],
      dureeMin: 5,
      notes: {
        script:
          "Annoncez l'ordre et défendez-le : on qualifie AVANT de prototyper. La salle veut construire tout de suite, et c'est précisément l'erreur qui produit une automatisation qu'il faudra démonter. Rappelez le chiffre du matin : « avec le taux que vous venez de mesurer, qu'est-ce que vous vous autorisez à laisser tourner sans regarder ? ». Annoncez la clôture du runbook à 17 h — six sections, un porteur, une échéance.",
        faq: [
          {
            question: "On va enfin construire quelque chose ?",
            reponse:
              "Oui, cinquante minutes, avec son jeu d'essai et sa procédure de retour arrière. Les vingt-cinq minutes de qualification servent à ce que ce ne soit pas la mauvaise tâche.",
          },
        ],
        blocages: [
          {
            situation:
              "Un participant veut sauter la qualification pour gagner du temps d'atelier.",
            parade:
              "Une question : « si votre automatisation touche une décision qui concerne une personne, vous le saurez quand ? ». La qualification prend quatre questions, la remise en cause en prend six mois.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "Une tâche IT récurrente faite à la main chaque semaine : on ouvre la console, on relève les chiffres, on recopie dans un tableau, on envoie. Personne ne l'a jamais écrite, elle vit dans la tête de deux personnes, et elle saute dès qu'elles sont absentes.",
      apres:
        "La même tâche automatisée sur un script qui LIT et AFFICHE, sans rien modifier, accompagnée d'un jeu d'essai qui contient volontairement un cas faux. Le script est lu ligne à ligne avant d'être lancé, et il est lancé sur le jeu d'essai avant tout environnement réel.",
      prompt:
        "Voici la sortie brute d'une commande d'occupation disque et un fichier de seuils que je te donne ci-dessous (les deux sont des exemples fabriqués, aucun hôte réel).\nÉcris un script POSIX sh qui, pour chaque point de montage dépassant son seuil, écrit UNE ligne sur la sortie standard au format « AAAA-MM-JJ HH:MM point_de_montage pourcentage seuil ».\nContraintes strictes : le script ne supprime rien, ne déplace rien, n'écrit dans aucun fichier, n'installe rien, et n'appelle aucune commande d'envoi de courrier ou de notification. Il lit et il affiche, rien d'autre.\nS'il te manque une information, écris-la en commentaire en tête du script et n'invente aucune valeur par défaut. Ajoute en fin de réponse la liste des entrées qui feraient échouer ce script.",
      outil: "Un seul outil, celui validé dans la salle.",
      captureEcran:
        "Le script rendu, avec surlignage des trois contraintes respectées et, à côté, la sortie d'une première tentative où l'outil avait ajouté un appel de notification non demandé. Encadrer en rouge la ligne ajoutée.",
      verifieLe: VERIFIE_LE,
      dureeMin: 15,
      notes: {
        script:
          "Lisez le script rendu LIGNE À LIGNE à voix haute devant la salle avant de le lancer. C'est la démonstration du geste, pas du résultat : une salle technique retient ce qu'elle voit faire. Insistez sur « lit et affiche » — c'est la forme d'automatisation qu'on s'autorise le premier jour, et celle qui ne peut rien casser. Montrez ensuite la tentative où l'outil avait ajouté une notification non demandée : il ne suit pas les contraintes par obéissance, il les suit statistiquement. Terminez sur la liste des entrées qui feraient échouer le script — c'est la partie que personne ne demande jamais et qui sert le plus.",
        faq: [
          {
            question: "Pourquoi s'interdire d'écrire dans un fichier ?",
            reponse:
              "Parce qu'un script qui écrit peut écraser. Tant que vous n'avez pas relu et testé, vous restez en lecture seule — c'est réversible par construction.",
          },
          {
            question: "Un script généré peut aller en production directement ?",
            reponse:
              "Non. Revue, jeu d'essai, procédure de retour arrière écrite avant la mise en service. C'est la règle des deux jours et elle ne s'assouplit pas parce que le script est court.",
          },
        ],
        blocages: [
          {
            situation:
              "L'outil rend un script qui contient une commande destructive ou une élévation de privilèges.",
            parade:
              "L'afficher et le nommer devant la salle : c'est un incident, pas une aide maladroite. Puis demander à la salle ce qui, dans la formulation, a pu l'amener là. La réponse est presque toujours une contrainte manquante.",
          },
          {
            situation: "Le script rendu ne fonctionne pas au premier lancement.",
            parade:
              "Tant mieux, et gardez-le à l'écran : c'est le jeu d'essai qui vient de faire son travail. Corriger devant la salle, en disant ce que vous cherchez.",
          },
        ],
        planB:
          "Le script rendu, la tentative avec notification ajoutée et la sortie sur jeu d'essai sont imprimés dans le kit (datées). La lecture ligne à ligne se tient à l'identique sur papier — c'est même l'exercice le plus fidèle au geste enseigné.",
      },
    },
    pratique: {
      consigne:
        "Trois temps. (1) Qualification : passez deux tâches candidates au test des 4 questions et à la grille haut risque, confrontez en binôme, puis classez au tableau — automatisable / à instruire (biais, analyse d'impact) / écartée — et versez le classement en section 4 de votre runbook. (2) Automatisation : construisez et éprouvez votre automatisation — jeu d'essai, un cas limite volontairement faux, journal d'exécution, et la procédure de retour arrière écrite AVANT toute mise en service. (3) Gouvernance : à partir de la charte-type et de la grille de déclenchement de l'information-consultation du CSE, retenez en binôme les articles applicables à votre entreprise et cochez ce qui relève de la consultation — section 6 du runbook.",
      aEmporter:
        "Deux tâches qualifiées et classées, une automatisation éprouvée sur jeu d'essai avec sa procédure de retour arrière écrite, et une sélection d'articles de charte — en projet, à faire valider par votre RSSI et votre conseil.",
      dureeMin: 105,
      notes: {
        script:
          "Sur la qualification : le test des 4 questions se passe à l'écrit, pas de tête. Une tâche qui touche une décision produisant un effet sur une personne — accès, sanction — ou le suivi d'activité d'un salarié part en « à instruire », sans discussion et sans que vous ayez à trancher quoi que ce soit : la grille du kit le dit, sourcée et datée. Sur l'automatisation : la procédure de retour arrière s'écrit AVANT la mise en service, et vous vérifiez qu'elle est écrite en passant dans les rangs. Le cas limite volontairement faux est obligatoire — une automatisation qui n'a jamais échoué devant son auteur ne sera jamais surveillée. Sur la gouvernance : c'est une SÉLECTION, pas un exposé. Vous ne commentez aucun article, vous faites cocher. L'en-tête « Projet — à faire valider » ne se retire pas.",
        faq: [
          {
            question: "Le tri de journaux, c'est du suivi d'activité de salarié ?",
            reponse:
              "Ça peut le devenir dès que le journal porte des identifiants nominatifs et que la sortie est lue par un responsable. La grille du kit pose la question en quatre points ; si le doute persiste, notez-la, votre RSSI et votre conseil trancheront.",
          },
          {
            question: "On doit vraiment consulter le CSE pour un script ?",
            reponse:
              "La grille de déclenchement fournie répond point par point, et je ne me prononce pas sur votre cas : notez-le. Ce qui est certain, c'est que la question se pose avant la mise en service, pas après.",
          },
          {
            question: "Ma procédure de retour arrière, c'est juste « on remet l'ancien script » ?",
            reponse:
              "Alors écrivez ce que vous faites des données produites entre-temps, et comment vous savez que le retour a marché. C'est ça, une procédure.",
          },
        ],
        blocages: [
          {
            situation:
              "Un participant veut mettre son automatisation en service depuis la salle, « elle marche ».",
            parade:
              "Refuser : elle a tourné sur un jeu d'essai, pas sur un environnement réel, et personne d'autre ne l'a relue. La mise en service est la première ligne de sa feuille de route, avec un relecteur nommé.",
          },
          {
            situation:
              "Un binôme veut faire trancher par le formateur si sa tâche est à haut risque.",
            parade:
              "Formule exacte, prononcée telle quelle : « je ne me prononce pas, notez la question, votre RSSI tranchera ». Puis reprendre la grille avec eux question par question — vous animez la grille, vous ne rendez pas d'avis.",
          },
          {
            situation: "L'atelier gouvernance dérive en débat sur le règlement européen.",
            parade:
              "Couper : « la grille est sourcée et datée dans le kit, on coche, on ne réinterprète pas ». Les désaccords partent au tableau des questions ouvertes.",
          },
        ],
        planB:
          "Sans réseau : la qualification et la gouvernance ne dépendent d'aucun outil. L'automatisation devient une lecture critique du script fourni au kit — chacun écrit son jeu d'essai, son cas limite faux et sa procédure de retour arrière sur ce script-là. Le livrable reste complet, seul le prototype personnel est reporté.",
      },
    },
    verification: {
      question:
        "Évaluation des acquis : quiz individuel de 10 questions, corrigé en salle question par question. Puis évaluation croisée des productions d'atelier sur la grille fournie — exactitude, sécurité (aucun secret, aucune commande destructive), réversibilité, documentation, et mention du haut risque le cas échéant.",
      reponseAttendue:
        "Le corrigé est commenté question par question, sans en sauter aucune. Sur l'évaluation croisée, chaque production reçoit au moins un écart nommé sur les cinq critères. Le seuil de réussite est celui déclaré au programme ; un score en dessous déclenche la reprise individuelle prévue au dispositif.",
      dureeMin: 30,
      notes: {
        script:
          "C'est l'évaluation des acquis au sens de l'indicateur 11 : elle se tient, elle se corrige, et elle se conserve. Ne la sacrifiez jamais au temps qui manque — c'est la première chose qu'un auditeur demande. Si vous êtes en retard, coupez dans la mise en commun de l'atelier gouvernance, pas ici. Sur l'évaluation croisée : le critère « sécurité » se vérifie en cherchant un secret dans la production, pas en demandant s'il y en a un.",
        faq: [
          {
            question: "Le résultat sera transmis à mon employeur ?",
            reponse:
              "Le résultat individuel ne l'est pas. Ce qui est transmis, c'est l'attestation de fin de formation et le fait que l'évaluation a eu lieu.",
          },
          {
            question: "On est évalués sur du code ?",
            reponse:
              "Sur les cinq critères de la grille, dont un seul touche à l'exactitude. La réversibilité et l'absence de secret pèsent autant.",
          },
        ],
        blocages: [
          {
            situation: "Il est 16 h 45 et le quiz n'est pas commencé.",
            parade:
              "Le tenir quand même, en réduisant le commentaire du corrigé aux questions les plus ratées. On ne remplace jamais l'évaluation par un tour de table.",
          },
          {
            situation: "Une production contient encore un secret en clair.",
            parade:
              "Le traiter comme un incident, calmement et sans humilier : on le retire, on note que la règle de la section 1 n'a pas tenu, et on la rectifie. C'est le dernier moment où c'est gratuit.",
          },
        ],
        planB: "Quiz papier dans le kit et corrigé page 48. Aucune dépendance à un outil.",
      },
    },
    synthese: {
      acquis: [
        "Je qualifie une tâche avant de l'automatiser, et je sais laquelle part en « à instruire ».",
        "J'écris la procédure de retour arrière avant la mise en service, jamais après.",
        "Je fais valider mes articles de charte par mon RSSI avant de les diffuser.",
      ],
      dureeMin: 20,
      notes: {
        script:
          "Clôture du runbook : les six sections sont passées en revue à voix haute, dans l'ordre, et chacun dit ce qui manque encore chez lui. Puis la feuille de route : trois usages et UNE automatisation à installer, une règle d'usage à faire valider — et pour CHAQUE ligne un porteur nommé et une échéance datée. Sans nom et sans date, une feuille de route ne se réalise pas. Relisez enfin le tableau des questions ouvertes accumulées sur deux jours : il part chez le RSSI et chez le conseil, c'est une production de la formation à part entière. Notez au tableau, prenez une photo, envoyez-la au groupe.",
        faq: [
          {
            question: "Le runbook, on le partage à toute l'équipe ?",
            reponse:
              "Après validation des sections qui portent l'en-tête « Projet ». Les autres sections — votre règle, votre taux d'erreur, vos tâches qualifiées — se partagent dès demain.",
          },
        ],
        blocages: [
          {
            situation: "Les engagements restent vagues : « je vais automatiser des trucs ».",
            parade:
              "Reformuler en une question : « quelle tâche, qui la relit, et quel jour ? ». Ne pas passer au suivant tant que la réponse ne porte pas un nom et une date.",
          },
          {
            situation:
              "Le tableau des questions ouvertes est long et la salle le vit comme un échec.",
            parade:
              "Le retourner : « vous repartez avec la liste exacte de ce qu'il faut faire trancher, écrite par ceux qui savent de quoi il s'agit. Personne ne l'avait avant-hier. »",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },
];
