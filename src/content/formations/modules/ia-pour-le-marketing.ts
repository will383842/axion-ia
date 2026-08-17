/**
 * CONTENU RÉDIGÉ — « IA pour le marketing » (1 jour, 7 h, 4 modules au catalogue).
 *
 * ## Le fil rouge
 *
 * Chacun repart avec UN document unique, daté et nominatif : le dossier de
 * marque, le calendrier éditorial du trimestre, les trames de déclinaison et la
 * grille de relecture avant diffusion. Rien n'est produit dans le vide — tout ce
 * qui sort d'un atelier est versé au même document, et c'est ce document qui
 * survit à la journée.
 *
 * La matinée pose la voix de la marque puis la démultiplie : un dossier écrit
 * (module 1), un message décliné sans réécriture et douze semaines planifiées
 * avec un nom par ligne (module 2). L'après-midi encaisse ce que la matinée a
 * produit : commenter des résultats sans exposer ses données et voir comment sa
 * marque est reprise par un assistant (module 3), puis ne plus rien diffuser
 * sans savoir ce qui a été vérifié, et par qui (module 4).
 *
 * ## Le découpage, tel qu'il est au catalogue
 *
 * Quatre modules : « mod-1 » le cadre et la voix de la marque, « mod-2 » la
 * déclinaison et la planification, « mod-3 » image / résultats / visibilité,
 * « mod-4 » la vérification avant diffusion. Chaque module porte SA
 * démonstration avec SON prompt en entier — plus aucun bloc n'agrège deux temps
 * pédagogiques.
 *
 * ## Deux règles que le formateur ne négocie pas
 *
 * **Aucune donnée personnelle réelle n'est déposée dans un outil pendant la
 * journée.** Ni fichier de contacts, ni export de campagne, ni base clients. Les
 * ateliers tournent sur le jeu de contacts fictif du kit et sur des valeurs
 * saisies à la main. Un stagiaire qui colle son export est arrêté, sans
 * discussion : la formation ne peut pas provoquer le manquement qu'elle enseigne
 * à éviter.
 *
 * **Le formateur n'arbitre aucune question juridique.** La formule est écrite,
 * elle se prononce telle quelle : « je ne me prononce pas, notez la question,
 * votre conseil tranchera ». Les trames remises portent un en-tête « Projet — à
 * faire valider par votre conseil avant diffusion » qui n'est pas retirable.
 *
 * ⚠️ Les références juridiques citées dans les blocs `cadre` du catalogue —
 * faux avis, allégations, mention des contenus générés, consentement préalable,
 * droit à l'image — sont fournies au formateur SOURCÉES ET DATÉES dans le kit,
 * et ne se citent jamais de mémoire. Leur formulation reste à faire relire par
 * le conseil de l'organisme.
 */

import type { EnrichissementFormation } from "./types";

/** Date de dernière vérification des captures et sorties d'outils. */
const VERIFIE_LE = "2026-08-06";

export const IA_POUR_LE_MARKETING: EnrichissementFormation = [
  // ───────────────────────────────────────────────────────────────────────────
  // mod-1 — Matin · Module 1 : le cadre et la voix de la marque
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-1",
    objectif: {
      enonce:
        "À la fin de ce module, vous produisez un contenu qui tient la voix de votre marque à partir d'un dossier de marque écrit, testé sur une publication réelle de votre entreprise.",
      // Le dossier de marque sur la trame fournie, la demande structurée par les
      // cinq leviers AXION et la relance avec le persona du voisin sont
      // exactement obj-2. Le régime d'usage et ce qui ne se dépose jamais —
      // fichier de contacts, export nominatif — sont posés ici en ouverture de
      // journée, sans être l'objet du module : obj-1 en secondaire.
      objectifGlobalId: "obj-2",
      objectifsSecondairesIds: ["obj-1"],
      dureeMin: 10,
      notes: {
        script:
          "Tour de table en UNE phrase, pas une par personne qui s'étale : « votre prénom, et ce que vous devez produire chaque semaine ». Notez chaque réponse au tableau, elle servira de matière au calendrier éditorial du module 2. Posez la règle du jour et laissez-la affichée : l'IA fait le premier jet, la marque reste la vôtre. Annoncez le livrable tout de suite — un dossier de marque écrit et douze semaines planifiées, en main ce soir.",
        faq: [
          {
            question: "On va pouvoir se passer de notre agence ?",
            reponse:
              "Ce n'est pas la promesse de la journée. Ce qui change, c'est que vous cessez de sous-traiter les contenus courants et récurrents, et que vous gardez votre budget externe pour ce qui le mérite vraiment.",
          },
          {
            question: "Les moteurs de recherche ne pénalisent-ils pas le contenu généré ?",
            reponse:
              "Ce qui se fait sanctionner, c'est le contenu sans valeur produit en masse, pas l'outil qui l'a écrit. Un contenu générique reste générique qu'il soit tapé à la main ou non — et c'est exactement pourquoi on commence par le dossier de marque.",
          },
          {
            question: "Notre direction a interdit ces outils, on fait quoi de la journée ?",
            reponse:
              "Une interdiction est presque toujours une interdiction de régime, pas d'usage. Notez le nom de l'outil validé chez vous, on travaillera avec celui-là. Si rien n'est validé, la matinée sert justement à écrire ce que vous demanderez.",
          },
        ],
        blocages: [
          {
            situation:
              "Le tour de table dérive en procès du service commercial ou de l'agence en place.",
            parade:
              "Couper avec : « on note, et on regarde à 16 h si l'IA change quelque chose là-dessus » — puis écrire le grief au tableau. Le reprendre en fin de journée fait beaucoup pour la crédibilité.",
          },
          {
            situation:
              "La salle est très inégale : un community manager aguerri et deux débutants.",
            parade:
              "Constituez les binômes tout de suite, un expérimenté avec un débutant, et annoncez-le comme un choix pédagogique. Ne laissez pas les niveaux se regrouper d'eux-mêmes.",
          },
        ],
        planB:
          "Aucun outil n'est nécessaire ici. Vidéoprojecteur en panne : le tour de table, la règle du jour et l'annonce du livrable se tiennent au paperboard sans rien perdre.",
      },
    },
    demonstration: {
      avant:
        "« Écris un post LinkedIn pour annoncer notre nouvelle offre. » La sortie est propre, immédiatement publiable et parfaitement interchangeable : elle conviendrait à n'importe quel concurrent.",
      apres:
        "La même demande structurée par la méthode AXION, avec le dossier de marque fourni en contexte. La sortie porte le ton, la cible et les interdits de langage de l'entreprise — on lit les deux résultats à voix haute et la salle dit ce qui a changé.",
      prompt:
        "Demande spontanée : « Écris un post LinkedIn pour annoncer notre nouvelle offre. »\n\nDemande structurée (méthode AXION) :\nActeur : tu es responsable communication d'un fabricant de menuiseries de 60 personnes en Auvergne-Rhône-Alpes, qui vend à des installateurs professionnels et jamais au particulier.\nConteXte : nous ouvrons un service de pose garanti dix ans, réservé aux installateurs partenaires ; l'annonce sort le 15 septembre.\nIntention : une publication qui fasse demander le dossier partenaire, pas une publication qui fasse plaisir.\nOutput : 150 mots maximum, aucune liste à puces, une seule idée, une question en clôture.\nNormes : applique le dossier de marque ci-joint — ton sobre et factuel, jamais familier. Aucun superlatif, aucun chiffre que je ne t'ai pas donné, aucune promesse de délai. S'il te manque une information, écris [À COMPLÉTER] au lieu de l'inventer.",
      outil: "Un seul outil, celui validé dans la salle (Claude ou ChatGPT selon le groupe).",
      captureEcran:
        "Les deux publications côte à côte — la spontanée et la structurée — avec les cinq leviers AXION annotés en marge sur la seconde.",
      verifieLe: VERIFIE_LE,
      dureeMin: 15,
      notes: {
        script:
          "Écrivez AXION au tableau et laissez-le affiché toute la journée : Acteur, conteXte, Intention, Output, Normes. Lancez d'abord la demande spontanée et LAISSEZ la salle trouver la sortie « pas mal » — c'est le piège, ne le désamorcez pas trop vite. Puis faites lire les deux versions à VOIX HAUTE par deux stagiaires différents, et demandez ce qui a changé avant de commenter quoi que ce soit.",
        faq: [
          {
            question: "Pourquoi interdire les chiffres dans la ligne Normes ?",
            reponse:
              "Parce que l'outil les remplira, de façon plausible et fausse. Un chiffre que vous n'avez pas vérifié dans un document, vous ne le laissez pas écrire — c'est la règle qui tient toute la journée.",
          },
          {
            question: "Le dossier de marque, il faut le recoller à chaque fois ?",
            reponse:
              "Oui, tant que vous travaillez dans un fil de discussion neuf. C'est un fichier d'une page : vous le déposez en pièce jointe, et il devient la ligne Normes de toutes vos demandes.",
          },
        ],
        blocages: [
          {
            situation:
              "La sortie spontanée est très bonne et la salle ne voit pas l'intérêt de la version structurée.",
            parade:
              "Relancez le MÊME prompt spontané trois fois de suite et affichez les trois sorties : elles se ressemblent toutes. « Vos trois concurrents obtiendront celle-ci aussi. » L'argument porte mieux que la qualité.",
          },
        ],
        planB:
          "Quota atteint ou service indisponible : les deux sorties — spontanée et structurée — sont imprimées dans le kit formateur (datées), avec les cinq leviers déjà annotés. La comparaison à voix haute se tient à l'identique sur papier. N'improvisez aucune sortie en direct : celles du kit ont été vérifiées.",
      },
    },
    pratique: {
      consigne:
        "Atelier chronométré : constituez votre dossier de marque sur la trame fournie — trois adjectifs de ton et trois contre-exemples (« jamais ceci »), vos cibles et personas, vos interdits de langage, trois contenus déjà validés qui servent d'étalon — puis testez-le immédiatement en relançant une publication réelle de votre entreprise avec ce dossier en contexte.",
      aEmporter:
        "Le dossier de marque écrit et testé sur une publication réelle — la première pièce du document unique remis en fin de journée.",
      dureeMin: 30,
      notes: {
        script:
          "Les trois CONTRE-exemples sont la partie utile du dossier, et c'est celle qu'on saute. Passez dans les rangs et exigez-les — « donnez-moi une phrase que votre entreprise n'écrirait jamais ». Tant que cette phrase n'est pas écrite, le dossier ne sert à rien. Annoncez le chronomètre à voix haute toutes les cinq minutes, et ne rédigez à la place de personne.",
        faq: [
          {
            question: "Nos trois adjectifs de ton, on ne les a jamais formalisés.",
            reponse:
              "C'est le cas de la plupart des entreprises, et c'est précisément la valeur de l'atelier. Prenez vos trois derniers contenus validés, demandez à l'outil quels adjectifs les décrivent, puis tranchez vous-même. La trame prévoit cet enchaînement.",
          },
          {
            question: "On peut déposer notre brief client réel ?",
            reponse:
              "Un brief n'est pas une donnée personnelle, donc oui — dans le régime d'usage retenu ce matin. Ce qui ne se dépose jamais, c'est un fichier de contacts ou un export nominatif.",
          },
        ],
        blocages: [
          {
            situation: "Le réseau de la salle sature au moment des tests simultanés.",
            parade:
              "Faites démarrer par vagues de cinq, et annoncez-le comme une consigne d'atelier, jamais comme un incident.",
          },
          {
            situation:
              "Un stagiaire n'a aucune publication réelle de son entreprise pour tester son dossier.",
            parade:
              "Le kit fournit un message de secours et sa fiche produit. Ne le laissez pas regarder son voisin travailler pendant trente minutes.",
          },
        ],
        planB:
          "Réseau tombé : le dossier de marque se remplit intégralement à la main sur la trame papier — il ne dépend d'aucun outil. Le test sur publication réelle se remplace par la comparaison des deux sorties imprimées du kit. Ce qui compte est la structure de la demande, pas l'outil qui l'exécute.",
      },
    },
    verification: {
      question:
        "Contrôle croisé en binôme, sur la grille fournie : la publication produite tient-elle les trois adjectifs de ton déclarés au dossier de marque, la promesse qu'elle avance est-elle vérifiable dans un document, la mention de contenu généré est-elle due ? Puis relancez le MÊME brief avec le persona de votre voisin et relevez qui a disparu du texte.",
      reponseAttendue:
        "Chaque écart est relevé et annoté au stylo sur la copie du binôme voisin. Le corrigé projeté liste les deux dérives les plus fréquentes à ce stade : le superlatif réintroduit malgré le dossier, et la promesse chiffrée non sourcée.",
      dureeMin: 10,
      notes: {
        script:
          "Contrôle CROISÉ, jamais auto-correction : chaque binôme relit celui d'à côté. Le changement de persona est le temps fort — faites-le vraiment relancer, et faites dire à voix haute qui a disparu du texte. C'est le biais du BRIEF, avant celui de l'outil, et c'est la seule façon de le rendre visible. Projetez le corrigé après, jamais avant.",
        faq: [
          {
            question: "La mention de contenu généré, on doit vraiment la mettre partout ?",
            reponse:
              "Je ne me prononce pas sur votre cas, notez la question, votre conseil tranchera. Ce que la grille vous demande, c'est de vous POSER la question à chaque diffusion et de tracer votre réponse. La fiche du kit donne le texte de référence, sourcé et daté.",
          },
          {
            question: "On note ? Ça compte quelque part ?",
            reponse:
              "On ne note pas ici. L'évaluation des acquis est en fin de journée, sur dix questions. Ce contrôle sert à repérer ce qui coince pendant qu'on peut encore le corriger.",
          },
        ],
        blocages: [
          {
            situation: "Les binômes se valident mutuellement sans rien relever.",
            parade:
              "Annoncez que chaque binôme devra remonter AU MOINS un écart à l'oral, et que vous en interrogerez trois. La complaisance tombe immédiatement.",
          },
          {
            situation:
              "Le changement de persona ne produit aucune différence visible dans le texte.",
            parade:
              "Faites ajouter au brief une contrainte de format court (« en 60 mots »). La brièveté force les arbitrages et la cible réapparaît. Si rien ne bouge, c'est que le persona du dossier est trop vague — c'est le vrai enseignement, dites-le.",
          },
        ],
        planB:
          "La grille et le corrigé sont imprimés dans le kit. Sans vidéoprojecteur, le corrigé se distribue et se commente à l'oral. Le changement de persona se fait alors sur les deux sorties pré-produites du kit.",
      },
    },
    synthese: {
      acquis: [
        "Je sais où je dépose un brief, et ce que je ne dépose jamais dans un outil grand public.",
        "Je sais ce que je ne peux pas publier, et quand la mention de contenu généré est due.",
        "J'ai un dossier de marque écrit et testé, que je peux rouvrir lundi.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites FORMULER, ne récitez pas : « en une phrase, qu'est-ce que vous ne referez plus à partir de lundi ? ». Deux réponses suffisent avant la pause. Faites nommer le fichier à voix haute — « dossier-de-marque-<entreprise>-<date> » : le dossier existe à partir du moment où il porte un nom.",
        faq: [
          {
            question: "Le dossier de marque, qui le fait vivre après la formation ?",
            reponse:
              "La personne qui sera désignée au montage du livrable, en fin de journée. D'ici là, c'est vous qui le tenez : il servira à tous les ateliers qui suivent.",
          },
        ],
        blocages: [
          {
            situation: "La pause approche, la salle décroche et personne ne formule rien.",
            parade:
              "Ne pas insister : énoncez les trois acquis vous-même et libérez. Un acquis formulé à contrecœur ne s'ancre pas mieux.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // mod-2 — Matin · Module 2 : d'un message unique à la série
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-2",
    objectif: {
      enonce:
        "À la fin de ce module, vous déclinez un message unique sur plusieurs formats sans le réécrire, et vous planifiez douze semaines de contenus avec un nom par ligne.",
      // La déclinaison d'un message réel sur trois formats, avec le relevé de ce
      // que chaque format a obligé à retirer, est obj-3. Le second temps de
      // l'atelier construit le calendrier des douze semaines avec un titulaire
      // par ligne et le confronte aux heures annoncées : obj-4 en secondaire.
      objectifGlobalId: "obj-3",
      objectifsSecondairesIds: ["obj-4"],
      dureeMin: 5,
      notes: {
        script:
          "À la reprise après la pause, ne refaites pas d'introduction : une phrase suffit, « on passe d'un message à une série, et on ne repart plus de zéro chaque lundi ». Rappelez que tout ce module travaille AVEC le dossier de marque écrit au module 1 — il reste en pièce jointe de chaque demande.",
        faq: [
          {
            question: "Décliner, ce n'est pas juste copier-coller en plus court ?",
            reponse:
              "Non, et c'est ce que la démonstration va montrer : chaque format impose ses propres arbitrages, et l'outil sait dire ce qu'il a dû retirer. Ce relevé des renoncements est l'enseignement du module.",
          },
        ],
        blocages: [
          {
            situation: "Des retardataires de pause font redémarrer le module deux fois.",
            parade:
              "Ne redémarrez pas : l'objectif tient en une phrase, écrivez-la au tableau et laissez les retardataires la lire. Le premier atelier les remet dans le rythme.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "Pour chaque format — publication, newsletter, script, communiqué — on repart de zéro et on réécrit tout à la main. Quatre rédactions séparées pour une seule idée, et un dépôt de brief qui échoue une fois sur trois sans qu'on sache pourquoi.",
      apres:
        "On dépose le brief en PDF, la fiche produit et le dossier de marque, et la déclinaison en quatre formats part d'une SEULE idée — chaque format disant lui-même ce qu'il a été obligé de retirer. Les trois causes d'échec du dépôt sont annoncées avant de déposer quoi que ce soit.",
      prompt:
        "« Voici le brief en PDF, la fiche produit et le dossier de marque en pièces jointes. À partir de la SEULE idée « la pose garantie dix ans », produis quatre versions : (1) une publication de 150 mots, (2) l'objet et le corps d'une newsletter de 250 mots adressée aux installateurs déjà clients, (3) un script vidéo de 45 secondes en plans numérotés, (4) un communiqué de 300 mots avec titre, chapeau et une citation attribuée à [NOM DU DIRIGEANT — À COMPLÉTER]. Pour chaque version, indique en une ligne ce que le format t'a obligé à retirer. N'ajoute aucun chiffre, aucune date et aucun nom qui ne figurent pas dans les documents joints. »",
      outil: "Un seul outil, celui validé dans la salle (Claude ou ChatGPT selon le groupe).",
      captureEcran:
        "La déclinaison en quatre formats à l'écran, avec la ligne « ce que ce format m'a obligé à retirer » surlignée sur chacun, et le dépôt du PDF montré en amont.",
      verifieLe: VERIFIE_LE,
      dureeMin: 15,
      notes: {
        script:
          "Annoncez les trois causes d'échec du dépôt AVANT de déposer quoi que ce soit — scan sans texte reconnu, fichier trop lourd, tableau qui se désaligne. Puis, à chaque format produit, faites nommer par la salle ce qui s'est dégradé : c'est l'enseignement, pas le fait que les quatre textes sortent.",
        faq: [
          {
            question: "On peut déposer n'importe quel PDF ?",
            reponse:
              "Tout PDF dont le texte se sélectionne. Un scan sans reconnaissance de texte est une image : l'outil n'y lit rien, ou pire, invente. Le test de la sélection prend deux secondes et évite la panne en réunion.",
          },
          {
            question: "Le communiqué sort avec une citation inventée, c'est normal ?",
            reponse:
              "C'est exactement pourquoi le prompt impose [NOM DU DIRIGEANT — À COMPLÉTER] : la citation est un gabarit à faire valider, jamais une parole réelle. Rien de ce qui est attribué à quelqu'un ne se publie sans son accord.",
          },
        ],
        blocages: [
          {
            situation: "Le dépôt du PDF échoue devant toute la salle.",
            parade:
              "Ne le cachez pas, exploitez-le : c'est la cause d'échec n° 1 annoncée deux minutes plus tôt. Ouvrez le PDF, vérifiez si le texte se sélectionne, et montrez la parade — copier-coller le texte plutôt que le fichier.",
          },
        ],
        planB:
          "Quota atteint ou service indisponible : les quatre formats sont imprimés dans le kit formateur (datés), avec la ligne « ce que ce format m'a obligé à retirer » déjà surlignée. Le relevé de ce qui se dégrade se tient à l'identique sur papier. N'improvisez aucune sortie en direct : celles du kit ont été vérifiées.",
      },
    },
    pratique: {
      consigne:
        "Deux temps chronométrés. Premier temps : déclinez un message réel de votre entreprise sur trois formats, en repartant de votre dossier de marque et non d'une consigne nue. Deuxième temps : construisez le calendrier éditorial du trimestre à partir du tableau de sujets fourni — douze semaines, un sujet et un format par semaine, et le NOM de la personne qui tient chaque ligne.",
      aEmporter:
        "Un message réel décliné sur trois formats, et le calendrier des douze semaines avec un nom par ligne — les deux pièces suivantes du document unique remis en fin de journée.",
      dureeMin: 55,
      notes: {
        script:
          "Sur la déclinaison : personne ne réécrit un format à la main, on relance avec le dossier en contexte, sinon l'atelier n'enseigne rien. Sur le calendrier : la colonne « qui » se remplit avec un PRÉNOM, pas avec « le marketing ». Annoncez le chronomètre à voix haute toutes les cinq minutes, et ne rédigez à la place de personne.",
        faq: [
          {
            question: "Douze semaines, c'est irréaliste chez nous.",
            reponse:
              "Alors le calendrier vient de vous rendre un service : il a rendu visible ce que vous ne pouvez pas tenir. Réduisez le nombre de lignes plutôt que d'inventer des noms — un calendrier tenu à six lignes vaut mieux qu'un calendrier abandonné à douze.",
          },
          {
            question: "Je peux mettre notre fichier de contacts pour cibler la newsletter ?",
            reponse:
              "Non, et c'est la règle du jour. Vous décrivez votre cible en une phrase, vous ne déposez aucun fichier. Le persona suffit à obtenir le bon ton.",
          },
        ],
        blocages: [
          {
            situation: "Un stagiaire n'a aucun message réel à décliner ce jour-là.",
            parade:
              "Le kit fournit un message de secours et sa fiche produit. Ne le laissez pas regarder son voisin travailler pendant trente minutes.",
          },
          {
            situation: "Un binôme remplit le calendrier de sujets tous identiques.",
            parade:
              "Une seule question : « lequel de ces douze contenus donnerait envie à un client de vous appeler ? ». Ils rouvrent le tableau de sujets d'eux-mêmes.",
          },
          {
            situation: "Le réseau de la salle sature au moment des dépôts simultanés.",
            parade:
              "Faites démarrer par vagues de cinq, et annoncez-le comme une consigne d'atelier, jamais comme un incident.",
          },
        ],
        planB:
          "Réseau tombé : le calendrier se remplit intégralement à la main sur la trame papier — il ne dépend d'aucun outil. Pour la déclinaison, utilisez les quatre formats imprimés du kit et faites relever à la main ce que chaque format a retiré. Ce qui compte est la structure de la demande, pas l'outil qui l'exécute.",
      },
    },
    verification: {
      question:
        "Contrôle croisé en binôme, sur la grille fournie : le dossier de marque est-il respecté sur les trois formats, la promesse est-elle vérifiable, l'appel à l'action est-il présent, la mention de contenu généré est-elle due, et les douze semaines sont-elles tenables au vu des effectifs réellement annoncés ?",
      reponseAttendue:
        "Chaque écart est relevé et annoté au stylo sur la copie du binôme voisin. Le corrigé projeté liste les deux dérives les plus fréquentes de ce module : l'appel à l'action absent du format court, et le calendrier dont trois lignes n'ont pas de titulaire.",
      dureeMin: 10,
      notes: {
        script:
          "Même mécanique qu'au module 1 : contrôle CROISÉ, jamais auto-correction. Concentrez le passage dans les rangs sur deux points — le format court, où l'appel à l'action disparaît presque toujours, et la colonne « qui » du calendrier, où les prénoms se transforment en services dès qu'on ne regarde plus.",
        faq: [
          {
            question: "Tenable, ça se juge comment ?",
            reponse:
              "Au regard de ce qui a été dit au tour de table : si la salle a annoncé deux heures par semaine pour le contenu, un calendrier qui en exige six n'est pas tenable. La grille demande de confronter le calendrier aux effectifs annoncés, pas à un idéal.",
          },
        ],
        blocages: [
          {
            situation: "Les binômes valident des calendriers manifestement intenables.",
            parade:
              "Prenez un calendrier au hasard et faites le calcul à voix haute : douze lignes, combien d'heures par ligne, qui les a ? Le chiffre au tableau règle la complaisance mieux qu'un rappel à la rigueur.",
          },
        ],
        planB:
          "La grille et le corrigé sont imprimés dans le kit. Sans vidéoprojecteur, le corrigé se distribue et se commente à l'oral, en se limitant aux deux dérives les plus fréquentes.",
      },
    },
    synthese: {
      acquis: [
        "Je décline un message sur trois formats sans le réécrire, en repartant de mon dossier de marque.",
        "Je planifie mon trimestre en une séance, avec un nom par ligne de calendrier.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites verser au livrable séance tenante : les trois formats et le calendrier rejoignent le dossier de marque dans le même document, avant le déjeuner. Fixez la date de revue du calendrier MAINTENANT, avant de sortir de la salle. Annoncez l'après-midi en une phrase, sans promesse excessive : « on regarde ce que l'image sait faire et ce qu'elle ne sait pas, puis on commente des résultats sans exposer vos données ».",
        faq: [
          {
            question: "Le calendrier, on le révise quand ?",
            reponse:
              "Fixez la date maintenant, avant de sortir de la salle. Un calendrier sans date de revue n'est pas révisé, il est abandonné.",
          },
        ],
        blocages: [
          {
            situation: "Il est 12 h 30, la salle veut déjeuner et personne ne parle.",
            parade:
              "Ne pas insister : énoncez les deux acquis vous-même et libérez. Un acquis formulé à contrecœur ne s'ancre pas mieux.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // mod-3 — Après-midi · Module 3 : image, résultats et visibilité
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-3",
    objectif: {
      enonce:
        "À la fin de ce module, vous commentez les résultats d'une campagne sans exposer vos données, et vous savez comment votre marque est décrite par un assistant — et ce qui se corrige sur vos propres pages.",
      // Le commentaire de campagne écrit à partir de valeurs saisies à la main,
      // sans dépôt d'export ni calcul confié à l'outil, puis l'arbitrage entre
      // trois hypothèses de test à budget constant, sont obj-5. Le second temps
      // de l'atelier — erreurs de l'assistant sur la marque, corrections à
      // porter sur ses pages, veille dégrossie marquée « à vérifier à la
      // source » — sert obj-6 en secondaire.
      objectifGlobalId: "obj-5",
      objectifsSecondairesIds: ["obj-6"],
      dureeMin: 5,
      notes: {
        script:
          "Ouvrez sur le périmètre, pas sur la promesse : « trois usages très attendus cet après-midi, et trois périmètres honnêtes ». Annoncez tout de suite ce que l'IA ne fera pas — elle ne produira pas vos visuels de marque et elle ne calculera pas vos chiffres. Une salle prévenue en début d'après-midi ne se sent pas flouée à 17 h.",
        faq: [
          {
            question: "On va enfin faire des visuels ?",
            reponse:
              "On va regarder ensemble quatre visuels déjà produits et dire honnêtement ce qui tient et ce qui rate. Aucun compte à ouvrir, aucun outil d'image à installer : ce n'est pas la promesse de cette journée, et je préfère vous le dire à 14 h qu'à 17 h.",
          },
          {
            question: "Ma direction me demande de chiffrer le gain, je réponds quoi ?",
            reponse:
              "Sur la production de contenu, vous avez le chiffre de ce matin et il est mesuré. Sur l'image et la veille, il n'y en a pas d'honnête — dites que le gain porte sur le dégrossissage, pas sur le résultat final.",
          },
        ],
        blocages: [
          {
            situation:
              "Un stagiaire attendait un atelier de génération d'images et le fait savoir bruyamment.",
            parade:
              "Reconnaissez-le immédiatement et sans détour : « c'est hors périmètre de cette journée, et le programme le dit ». Proposez de noter la demande pour l'organisme, puis reprenez. Ne négociez pas le périmètre en salle.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "Sur l'image : on promet des visuels de marque générés et la déception s'installe au premier logo raté. Sur les résultats : on demande à l'outil de commenter une campagne en lui collant l'export complet — donc le fichier de contacts avec — et on le laisse recalculer les totaux.",
      apres:
        "Sur l'image : une revue commentée des quatre visuels du kit — ce qui tient (illustration d'ambiance, gabarit, recadrage, texte alternatif), ce qui rate systématiquement (le texte dans l'image, la charte, le logo). Sur les résultats : on décrit la STRUCTURE du tableau sans jamais transmettre l'export, on saisit à la main les quatre valeurs à commenter, et on interdit tout calcul.",
      prompt:
        "« Je te décris la structure de mon tableau de campagne, je ne te le transmets pas. Colonnes : semaine, nombre d'envois, taux d'ouverture, taux de clic, nombre de demandes de devis. Voici les quatre valeurs que je saisis moi-même, semaine 36 : taux d'ouverture 31 %, taux de clic 2,4 %, 7 demandes de devis, contre 4 la semaine précédente. Rédige en 120 mots le commentaire de ces résultats pour un comité de direction : ce qui progresse, ce qui stagne, et la question que ces chiffres ne permettent pas de trancher. Ne calcule rien, ne recalcule aucun pourcentage, n'ajoute aucun chiffre que je ne t'ai pas donné. »",
      outil: "Un seul outil, celui validé dans la salle (Claude ou ChatGPT selon le groupe).",
      captureEcran:
        "Les quatre visuels du kit annotés — ce qui tient, ce qui rate — puis les deux commentaires de campagne côte à côte avec le total recalculé par l'outil entouré en rouge.",
      verifieLe: VERIFIE_LE,
      dureeMin: 20,
      notes: {
        script:
          "Sur les visuels : commentez les quatre images du kit sans ouvrir aucun compte, et nommez les deux colonnes à voix haute — ce qui tient (illustration d'ambiance, déclinaison de gabarit, recadrage, texte alternatif), ce qui rate systématiquement (le texte dans l'image, la charte, le logo, le visuel de marque). Ne survendez rien, la salle vous le rendra. Sur les résultats : demandez d'abord un TOTAL à l'outil et laissez-le se tromper devant tout le monde — c'est la démonstration la plus rentable de l'après-midi. Puis reposez la demande sans calcul, avec le prompt affiché en entier.",
        faq: [
          {
            question: "Pourquoi ne pas simplement coller l'export, il est anonymisé ?",
            reponse:
              "Retirer le nom ne rend pas un fichier anonyme : le code postal, la tranche d'âge et la fonction suffisent souvent à retrouver la personne. C'est ce qu'on a montré ce matin. Vous décrivez la structure, vous saisissez les quatre valeurs à commenter, et vous ne perdez rien.",
          },
          {
            question: "Si je lui donne une calculatrice, il calcule juste ?",
            reponse:
              "Parfois oui, avec les outils qui exécutent réellement du calcul. Mais la règle reste la même : le chiffre qui part en comité de direction est celui de VOTRE tableur, pas celui d'une réponse.",
          },
        ],
        blocages: [
          {
            situation: "L'outil calcule juste et la démonstration tombe à plat.",
            parade:
              "Le dire immédiatement : « il a raison cette fois, et vous n'aviez aucun moyen de le savoir avant de vérifier ». L'enseignement tient tout autant, et il tient même mieux.",
          },
          {
            situation: "Un stagiaire trouve les visuels du kit « moches » et généralise.",
            parade:
              "Recentrez sur le critère, pas sur le goût : « la question n'est pas s'il vous plaît, c'est s'il porte votre charte et votre logo — et la réponse est non ».",
          },
        ],
        planB:
          "Les quatre visuels sont déjà imprimés dans le kit, la revue ne dépend d'aucun outil. Les deux commentaires de campagne — avec et sans calcul — sont imprimés dans le kit, datés, avec le chiffre faux déjà entouré. L'ensemble de la démonstration se tient sur papier sans rien perdre.",
      },
    },
    pratique: {
      consigne:
        "Deux temps chronométrés. Premier temps : rédigez le commentaire de votre dernière campagne à partir de VOS chiffres saisis à la main — jamais de l'export — puis faites proposer trois hypothèses de test à budget constant et tranchez celle que vous retenez. Deuxième temps : vérifiez en direct comment votre marque est décrite par un assistant, avec les trois questions fournies (qui est cette entreprise, que vend-elle, à qui la recommanderiez-vous), relevez les erreurs et listez ce qui se corrige sur vos propres pages ; puis dégrossissez une veille sur deux concurrents et marquez d'une croix tout ce qui reste à vérifier à la source.",
      aEmporter:
        "Un commentaire de campagne prêt pour un comité de direction, le relevé des erreurs d'un assistant sur votre marque avec les corrections à porter sur vos pages, et une veille dégrossie où chaque affirmation porte sa croix « à vérifier à la source ».",
      dureeMin: 55,
      notes: {
        script:
          "Répétez la règle au démarrage de l'atelier, pas seulement à 14 h : AUCUN export, AUCUN fichier de contacts. Les quatre valeurs se saisissent à la main, point. Sur la visibilité de marque : faites relever les erreurs PAR ÉCRIT, et faites écrire en face ce qui se corrige sur leurs propres pages — sans cette seconde colonne, l'atelier n'est qu'un constat vexant. Sur la veille : la croix « à vérifier à la source » n'est pas décorative, exigez-la sur chaque ligne.",
        faq: [
          {
            question: "L'assistant raconte n'importe quoi sur notre entreprise, on porte plainte ?",
            reponse:
              "Je ne me prononce pas, notez la question, votre conseil tranchera. Ce que vous pouvez faire dès lundi est dans la seconde colonne de votre feuille : corriger vos propres pages, celles qui décrivent qui vous êtes et ce que vous vendez.",
          },
          {
            question: "Une veille en dix minutes, ce n'est pas sérieux.",
            reponse:
              "Ce n'est pas une veille, c'est un dégrossissage — le mot est important. Vous obtenez une liste de pistes, chacune marquée à vérifier. Ce qui n'est pas vérifié à la source ne part dans aucune note interne.",
          },
        ],
        blocages: [
          {
            situation: "Un stagiaire colle son export de campagne pour « aller plus vite ».",
            parade:
              "Arrêter immédiatement, sans négocier, et rappeler la règle en une phrase. C'est le seul point de l'après-midi où l'on ne discute pas.",
          },
          {
            situation:
              "Un participant n'a aucune campagne récente à commenter (poste nouveau, structure sans historique).",
            parade:
              "Le kit fournit un jeu de résultats de campagne fictif. Le geste s'apprend sur ces chiffres-là aussi ; ne le laissez pas assister.",
          },
        ],
        planB:
          "Outil indisponible : le commentaire de campagne s'écrit à la main sur la trame fournie et les trois hypothèses de test se listent en binôme — c'est un exercice d'arbitrage, pas de génération. Pour la visibilité de marque, le kit contient trois réponses d'assistant pré-enregistrées sur des entreprises réelles : l'exercice de relevé d'erreurs se tient à l'identique. La veille se dégrossit sur les fiches concurrents imprimées du kit.",
      },
    },
    verification: {
      question:
        "Contrôle croisé en binôme, sur la grille fournie : aucun chiffre calculé par l'outil ne subsiste-t-il dans le commentaire de campagne, aucune donnée client n'a-t-elle été déposée, et chaque affirmation de veille porte-t-elle la mention vérifiée ou à vérifier ?",
      reponseAttendue:
        "Le contrôle croisé se solde par au moins un écart relevé par binôme, annoté sur la copie du voisin. L'écart le plus fréquent est le chiffre recalculé par l'outil qui s'est glissé dans une phrase de conclusion sans s'annoncer.",
      dureeMin: 10,
      notes: {
        script:
          "Le chiffre recalculé par l'outil est ce qui échappe le plus : il ne s'annonce pas, il se glisse dans une phrase de conclusion. Faites-le chercher avant de le nommer. Sur la veille, vérifiez la croix ligne à ligne sur deux copies prises au hasard : si elle manque là, elle manque partout.",
        faq: [
          {
            question: "Un pourcentage que j'ai calculé moi-même dans mon tableur, il passe ?",
            reponse:
              "Oui : la règle interdit les chiffres calculés PAR L'OUTIL, pas les vôtres. Ce qui compte est de savoir d'où vient chaque nombre — le vôtre est traçable, celui de la réponse ne l'est pas.",
          },
        ],
        blocages: [
          {
            situation: "Un binôme ne trouve aucun écart dans les productions du voisin.",
            parade:
              "Donnez-leur la production du kit, qui en contient quatre. S'ils n'en trouvent aucun là non plus, refaites la lecture avec eux : l'œil n'est pas encore réglé.",
          },
        ],
        planB:
          "La grille de contrôle est imprimée dans le kit. Aucune dépendance à un outil, ni à un vidéoprojecteur.",
      },
    },
    synthese: {
      acquis: [
        "Je connais le périmètre réel de l'image générée, et je ne le survends pas à ma direction.",
        "Je commente un résultat de campagne sans jamais déposer mon export, et sans laisser l'outil calculer.",
        "Je sais comment ma marque est décrite par un assistant, et ce que je corrige sur mes propres pages.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Trois acquis, énoncés vite avant la pause — faites-en reformuler un seul, celui du périmètre de l'image : c'est celui que la salle ira répéter à sa direction. À la reprise après la pause, une phrase suffit : « on termine par ce qui vous protège — ne plus rien diffuser sans savoir ce qui a été vérifié, et par qui ».",
        faq: [
          {
            question: "Le relevé d'erreurs sur notre marque, on le refait quand ?",
            reponse:
              "À chaque revue du calendrier éditorial — la date en est fixée depuis ce matin. Les réponses des assistants bougent en quelques semaines ; le relevé se refait au même rythme que le reste.",
          },
        ],
        blocages: [
          {
            situation: "La pause approche et la synthèse menace de sauter.",
            parade:
              "Ne la sacrifiez pas : trois phrases suffisent. C'est le module dont les périmètres se déforment le plus dans les mémoires — sans synthèse, la salle retient « l'IA ne sait pas faire d'images », ce qui est faux.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // mod-4 — Après-midi · Module 4 : rien ne se diffuse sans vérification
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-4",
    objectif: {
      enonce:
        "À la fin de ce module, vous ne diffusez plus un contenu sans savoir ce qui a été vérifié et par qui — votre grille de relecture est écrite, et le document unique du jour a un titulaire et une date de revue.",
      // La grille de relecture construite sur les erreurs relevées en séance,
      // passée sur une production du jour, puis le titulaire et la date de revue
      // du document unique, sont obj-8. Le deuxième temps de l'atelier classe
      // les douze cas de diffusion en « je publie » / « je publie avec
      // mention » / « je ne publie pas » : obj-7 en secondaire.
      objectifGlobalId: "obj-8",
      objectifsSecondairesIds: ["obj-7"],
      dureeMin: 5,
      notes: {
        script:
          "Une phrase d'objectif, pas plus : « ne plus rien diffuser sans savoir ce qui a été vérifié, et par qui ». Annoncez la mécanique du module — une micro-démonstration, une chasse à l'erreur dont la salle tirera SA grille, douze cas à classer, puis le montage du livrable et l'évaluation des acquis. La salle sait ainsi que tout ce qui a été produit depuis 9 h converge ici.",
        faq: [
          {
            question: "On a déjà contrôlé après chaque atelier, pourquoi un module entier ?",
            reponse:
              "Les contrôles croisés vérifiaient une production à la fois. Ici on construit ce qui reste quand la formation est finie : une grille de relecture qui passe sur TOUT ce qui part en diffusion, et quelqu'un qui la tient.",
          },
        ],
        blocages: [
          {
            situation: "La salle fatigue en fin de journée et l'attention retombe.",
            parade:
              "Annoncez la chasse à l'erreur comme un jeu à score — « on compte à voix haute, on affiche le total ». La compétition légère réveille une salle mieux qu'un rappel d'enjeu.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "On demande un paragraphe de tendances sur son marché et on obtient des chiffres précis, sans aucune source, que personne ne saura vérifier — et le texte est si assuré qu'il part tel quel dans une note interne.",
      apres:
        "La même demande avec l'obligation de citer ses sources : chaque affirmation chiffrée porte sa référence entre crochets, ou est remplacée par [AUCUNE SOURCE DISPONIBLE] — et le paragraphe se vide de ce qui n'était pas vérifiable.",
      prompt:
        "Sans contrainte : « Rédige un paragraphe de 120 mots sur les tendances du marché de la menuiserie professionnelle en France. »\n\nAvec contrainte : « Rédige un paragraphe de 120 mots sur les tendances du marché de la menuiserie professionnelle en France. Pour CHAQUE affirmation chiffrée, indique entre crochets la source précise et son année. Si tu ne disposes pas d'une source que tu peux nommer exactement, n'écris pas l'affirmation : écris à sa place [AUCUNE SOURCE DISPONIBLE]. Ne cite aucune étude dont tu n'es pas certain du titre. »",
      outil: "Un seul outil, celui validé dans la salle (Claude ou ChatGPT selon le groupe).",
      captureEcran:
        "Le paragraphe de marché avant / après, les [AUCUNE SOURCE DISPONIBLE] surlignés sur la seconde version.",
      verifieLe: VERIFIE_LE,
      dureeMin: 5,
      notes: {
        script:
          "Cinq minutes, pas plus : lisez la première version à voix haute avec assurance, la salle doit sentir à quel point c'est convaincant, puis affichez la seconde. Le contraste se suffit, ne le commentez pas trop — la chasse à l'erreur qui suit fera le travail.",
        faq: [
          {
            question: "Il a cité une étude, elle existe ?",
            reponse:
              "À vérifier, toujours, en ouvrant la source. Une référence plausible et inexistante est le défaut le plus courant, et c'est exactement l'objet de la chasse à l'erreur qui suit.",
          },
        ],
        blocages: [
          {
            situation:
              "La version contrainte sort avec des sources réelles et exactes, et le contraste tombe à plat.",
            parade:
              "Le dire tel quel : « elles sont justes cette fois — et vous ne le sauriez pas sans les avoir ouvertes ». Puis ouvrez-en une devant la salle : le geste de vérification EST la démonstration, pas l'erreur.",
          },
        ],
        planB:
          "Les deux paragraphes de marché sont imprimés dans le kit, datés, avec les [AUCUNE SOURCE DISPONIBLE] déjà surlignés. La lecture à voix haute puis la comparaison se tiennent à l'identique sur papier.",
      },
    },
    pratique: {
      consigne:
        "Trois temps chronométrés. Premier temps : chasse à l'erreur, sur un texte produit en direct à propos de votre marché — chacun surligne ce qui est faux ou invérifiable, on compte à voix haute, et la salle en tire les quatre contrôles de sa propre grille de relecture avant diffusion. Deuxième temps : classez les douze cas de diffusion du kit (un avis client repris, une photo trouvée en ligne, un témoignage reformulé, une newsletter à un fichier acheté…) en « je publie » / « je publie avec mention » / « je ne publie pas ». Troisième temps : assemblez le document unique, daté et nominatif — dossier de marque, calendrier du trimestre, trames de déclinaison, grille de relecture — et désignez qui le tient à jour et à quelle date il est revu.",
      aEmporter:
        "Le document unique du jour — dossier de marque, calendrier du trimestre, trames de déclinaison, grille de relecture avant diffusion — daté, portant le nom de la personne qui le tient à jour et la date de sa prochaine revue.",
      dureeMin: 50,
      notes: {
        script:
          "Sur la chasse à l'erreur : comptez les repérages À MAIN LEVÉE avant de corriger et notez le score au tableau — la salle sous-estime toujours, et le chiffre affiché vaut mieux qu'un discours sur la vigilance. La grille de relecture se construit à partir de CE que la salle a trouvé, pas d'un modèle projeté. Sur les douze cas : corrigez en salle avec le corrigé du kit, et sur toute question de droit qui déborde, la formule exacte se prononce telle quelle — « je ne me prononce pas, notez la question, votre conseil tranchera ». Sur le montage : faites NOMMER la personne et FIXER la date. Un document sans titulaire n'est pas tenu.",
        faq: [
          {
            question: "Un avis client publié sur notre site, je peux le reformuler ?",
            reponse:
              "Le kit range ce cas parmi les douze, avec la réponse de référence sourcée. Retenez la ligne de conduite : ce qui est présenté comme la parole d'un client doit être sa parole, et un accord écrit se demande. Pour votre situation précise, votre conseil tranchera.",
          },
          {
            question: "Ma grille de relecture n'a que trois contrôles, c'est insuffisant ?",
            reponse:
              "Trois contrôles réellement appliqués valent mieux que huit qui décorent un classeur. Gardez trois lignes, et ajoutez la quatrième le jour où un incident vous la dicte.",
          },
        ],
        blocages: [
          {
            situation: "La salle trouve toutes les erreurs plantées et s'ennuie.",
            parade:
              "Le texte du kit en contient trois de plus, plus fines — dont une qui ne se voit qu'en ouvrant la source citée.",
          },
          {
            situation: "Le montage du livrable est bâclé faute de temps.",
            parade:
              "Coupez le troisième temps à l'essentiel : le nom du fichier, le titulaire, la date de revue. Le reste s'assemble au bureau ; ces trois lignes-là, non.",
          },
        ],
        planB:
          "Outil indisponible : la chasse à l'erreur se fait sur le texte imprimé du kit, qui contient les mêmes erreurs plantées. Les douze cas de diffusion et le montage du livrable ne dépendent d'aucun outil.",
      },
    },
    verification: {
      question:
        "Évaluation des acquis : quiz individuel de dix questions, corrigé en salle question par question, suivi de l'auto-évaluation d'une production du jour sur la grille de relecture construite par la salle.",
      reponseAttendue:
        "Le corrigé du quiz est commenté question par question, sans en passer aucune ; le seuil de réussite est celui déclaré au programme, et un score en dessous déclenche la reprise individuelle prévue au dispositif. L'auto-évaluation passe la grille sur une production réelle du jour, et chaque contrôle est coché ou motivé.",
      dureeMin: 15,
      notes: {
        script:
          "C'est l'évaluation des acquis au sens de l'indicateur 11 — elle se tient, elle se corrige, elle se conserve. Ne la sacrifiez jamais au temps qui manque ; c'est la première chose qu'un auditeur demande. Si vous êtes en retard, coupez ailleurs. L'auto-évaluation se fait sur la grille que la salle vient de construire, pas sur un modèle du kit : c'est la première mise en service de leur propre outil.",
        faq: [
          {
            question: "Le résultat du quiz sera transmis à mon employeur ?",
            reponse:
              "Le résultat individuel ne l'est pas. Ce qui est transmis, c'est l'attestation de fin de formation et le fait que l'évaluation a bien eu lieu.",
          },
        ],
        blocages: [
          {
            situation: "Il est 17 h 15 et le quiz n'est pas commencé.",
            parade:
              "Le tenir quand même, en réduisant le commentaire du corrigé aux questions les plus ratées. On ne remplace jamais l'évaluation des acquis par un tour de table.",
          },
        ],
        planB:
          "Quiz et corrigé sont imprimés dans le kit. Aucune dépendance à un outil, ni à un vidéoprojecteur.",
      },
    },
    synthese: {
      acquis: [
        "Je passe ma grille de relecture avant toute diffusion, et je sais qui a relu et quand.",
        "Je sais qui tient le document unique du jour, et à quelle date il est revu.",
        "J'installe trois usages dès la semaine suivante, chacun avec un responsable nommé.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Chacun nomme à voix haute TROIS usages qu'il installe la semaine suivante, QUI les tient, et à quelle DATE le calendrier éditorial est revu. Sans nom et sans date, une feuille de route ne se réalise pas. Notez au tableau, photographiez, envoyez la photo au groupe avant de quitter la salle. Terminez en rappelant la seule règle qui reste quand tout le reste est oublié : rien ne se diffuse sans être passé par la grille.",
        faq: [
          {
            question: "Par quoi commencer lundi matin ?",
            reponse:
              "Par la ligne du calendrier dont vous êtes le titulaire, avec le dossier de marque en contexte. Une seule ligne, tenue, installe l'habitude ; trois usages lancés en même temps n'en installent aucun.",
          },
        ],
        blocages: [
          {
            situation: "Les engagements restent vagues : « je vais essayer d'utiliser l'IA ».",
            parade:
              "Reformulez en une question : « sur quel contenu, et quel jour ? ». Ne passez pas au suivant tant que la réponse ne porte pas un nom et une date.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },
];
