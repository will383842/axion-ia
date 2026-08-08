/**
 * CONTENU RÉDIGÉ — « IA pour les RH » (1 jour, 7 h, 4 modules).
 *
 * Formation PILOTE du Standard de contenu pédagogique. Elle sert de référence
 * aux 21 autres : ce qui est écrit ici définit le niveau attendu ailleurs.
 *
 * ## Le fil rouge
 *
 * Chacun repart avec UN dossier de poste défendable, construit pièce par pièce
 * au fil des quatre modules. Le module 1 pose ce qu'on a le droit de faire, le
 * module 2 produit les écrits sans donnée personnelle, le module 3 traite les
 * candidatures sous grille imposée, le module 4 ancre et assemble. Aucun module
 * ne se suffit à lui-même, et c'est voulu : l'ordre est l'enseignement.
 *
 * ## Deux règles que le formateur ne négocie pas
 *
 * **Aucun document réel de candidat n'est déposé dans un outil pendant la
 * journée.** Les ateliers tournent sur le jeu de candidatures fourni. Un
 * stagiaire qui ouvre un vrai CV pendant l'atelier est arrêté, sans discussion :
 * la formation ne peut pas provoquer le manquement qu'elle enseigne à éviter.
 *
 * **Le formateur n'arbitre aucune question juridique.** La formule est écrite,
 * elle se prononce telle quelle : « je ne me prononce pas, notez la question,
 * votre conseil tranchera ». Les trames remises portent un en-tête « Projet — à
 * faire valider par votre conseil avant diffusion » qui n'est pas retirable.
 *
 * ⚠️ Les références juridiques citées dans les blocs `cadre` sont fournies au
 * formateur SOURCÉES ET DATÉES dans le kit, et ne se citent jamais de mémoire.
 * Leur formulation reste à faire relire par le conseil de l'organisme.
 */

import type { EnrichissementFormation } from "./types";

/** Date de dernière vérification des captures et sorties d'outils. */
const VERIFIE_LE = "2026-08-06";

export const IA_POUR_LES_RH: EnrichissementFormation = [
  // ───────────────────────────────────────────────────────────────────────────
  // Module 1 — Le cadre avant les CV
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-1",
    objectif: {
      enonce:
        "À la fin de ce module, vous nommez le régime d'usage adapté à chaque document RH, et vous repérez un critère interdit dans une demande AVANT de la lancer.",
      objectifGlobalId: "obj-4",
      dureeMin: 10,
      notes: {
        script:
          "Tour de table en UNE phrase, pas une par personne qui s'étale : « votre prénom, et la tâche RH qui vous prend le plus de temps ». Notez chaque réponse au tableau — vous y reviendrez au module 4 pour montrer ce que la journée a couvert. Annoncez tout de suite la règle qui tient la journée : l'IA prépare, l'humain décide. Et annoncez le livrable : chacun repart avec son dossier de poste.",
        faq: [
          {
            question: "On va vraiment pouvoir trier les CV plus vite ?",
            reponse:
              "Non, et c'est le sujet de la journée. Trier et classer des candidatures est classé à haut risque par le règlement européen. Ce qu'on va faire est plus utile et sans risque : présynthétiser sous votre propre grille, sans classement.",
          },
          {
            question: "Notre DSI a bloqué ChatGPT, on va faire quoi ?",
            reponse:
              "Exactement ce qu'on va voir dans quinze minutes : les trois régimes d'usage. Un blocage n'est pas une interdiction de l'IA, c'est un choix de régime. Notez le nom de l'outil validé chez vous, on travaillera avec.",
          },
        ],
        blocages: [
          {
            situation: "Le tour de table dérive en plaintes sur l'outil de recrutement maison.",
            parade:
              "Couper avec : « on note, et on regarde à 16 h si l'IA change quelque chose là-dessus » — puis écrire la plainte au tableau. La reprendre au module 4 fait beaucoup pour la crédibilité.",
          },
        ],
        planB:
          "Aucun outil n'est nécessaire ici. Si le vidéoprojecteur est en panne, le tour de table et la règle du jour se tiennent au paperboard sans rien perdre.",
      },
    },
    demonstration: {
      avant:
        "On demande à l'outil de « classer ces trois candidatures » avec un prompt qui paraît anodin, et on lit la sortie comme un avis. Personne ne voit passer le critère qui a fait le classement, parce qu'il n'est écrit nulle part.",
      apres:
        "On pose la MÊME demande deux fois, avec deux formulations, et on compare ligne à ligne. Le classement change. Le critère qui l'a fait changer devient visible, et c'est lui qu'on apprend à repérer.",
      prompt:
        "PROMPT A, neutre — « Voici trois candidatures anonymisées. Pour chacune, relève uniquement les éléments qui répondent aux exigences de la fiche de poste jointe. Ne classe pas, ne recommande pas, n'ajoute aucun élément absent des documents. »\n\nPROMPT B, orienté — « Voici trois candidatures anonymisées. Dis-moi laquelle correspond le mieux à un profil dynamique, capable de tenir le rythme, et qui s'intégrera bien dans une équipe jeune. »",
      outil: "Un seul outil, celui validé dans la salle (Claude ou ChatGPT selon le groupe).",
      captureEcran:
        "Les deux sorties côte à côte, avec surlignage des formulations du prompt B qui réapparaissent dans la réponse — « rythme », « jeune », « intégration ».",
      verifieLe: VERIFIE_LE,
      dureeMin: 20,
      notes: {
        script:
          "Faites PARIER par écrit avant d'afficher : chacun note sur son support quel candidat sortira en tête avec le prompt B. Le pari est ce qui rend la suite mémorable — sans lui, la salle regarde une démonstration ; avec lui, elle s'est trompée elle-même. Affichez ensuite les deux sorties côte à côte et lisez ligne à ligne. Ne commentez pas avant que quelqu'un l'ait dit.",
        faq: [
          {
            question: "Ce n'est pas l'outil qui est biaisé, c'est le prompt, non ?",
            reponse:
              "Oui. Et c'est exactement la mauvaise nouvelle : le biais vient de vous, il est donc dans toutes vos demandes, pas seulement dans celle-ci.",
          },
          {
            question: "Si on écrit toujours des prompts neutres, c'est réglé ?",
            reponse:
              "Non. « Dynamique » n'est pas un critère qu'on retire, c'est un critère qu'on remplace par ce qu'on mesure vraiment. On le fera à l'atelier.",
          },
        ],
        blocages: [
          {
            situation:
              "L'outil rend deux sorties presque identiques, la démonstration tombe à plat.",
            parade:
              "Relancer le prompt B en ajoutant « en une seule phrase, dis lequel tu recommandes ». La contrainte de brièveté force la hiérarchisation et le biais ressort. Si ça ne suffit toujours pas, passer au plan B.",
          },
          {
            situation: "Un stagiaire veut tester avec ses propres CV.",
            parade:
              "Refuser fermement et expliquer pourquoi en une phrase : « on ne dépose aucun document réel aujourd'hui, c'est précisément la règle que la journée installe ».",
          },
        ],
        planB:
          "Quota atteint ou outil indisponible : les deux sorties sont imprimées dans le kit formateur (datées). L'exercice se tient à l'identique sur papier — le pari écrit, la comparaison ligne à ligne, le repérage à main levée. Ne rien improviser en direct : les sorties du kit ont été vérifiées.",
      },
    },
    pratique: {
      consigne:
        "En binôme, chronométré : vous recevez trois demandes de tri irrecevables, telles qu'elles s'écrivent vraiment. Réécrivez-les en demandes défendables. Pour CHACUNE, écrivez trois choses : le critère interdit qu'elle contenait, le régime d'usage que vous retenez, et la trace de décision humaine que vous conserverez.",
      aEmporter:
        "Les trois demandes réécrites, avec leur critère interdit nommé — première pièce du dossier de poste.",
      dureeMin: 25,
      notes: {
        script:
          "Distribuez le support avec les trois demandes DÉJÀ ÉCRITES : « classe-moi ces CV du meilleur au moins bon », « écarte ceux qui ont eu des trous dans leur parcours », « dis-moi lesquels s'intégreront le mieux ». Ne les faites pas inventer, ils en écriraient de trop propres. Annoncez le chronomètre à voix haute toutes les cinq minutes. Passez dans les rangs, relancez, ne rédigez à la place de personne.",
        faq: [
          {
            question: "« Trous dans le parcours », c'est vraiment interdit ?",
            reponse:
              "Ce n'est pas le mot qui est interdit, c'est ce qu'il capte : congé maternité, maladie, situation familiale. Vous n'avez pas le droit de les demander, donc pas le droit de les déduire.",
          },
        ],
        blocages: [
          {
            situation: "Un binôme réécrit la demande sans supprimer le classement.",
            parade:
              "Une seule question : « qui décide, à la fin, l'outil ou vous ? ». Ils corrigent seuls. Ne donnez pas la réponse.",
          },
          {
            situation: "Un binôme finit en dix minutes.",
            parade:
              "Leur donner la quatrième demande du support (« repère les candidats surqualifiés ») et leur demander de préparer la restitution du groupe.",
          },
        ],
        planB:
          "L'atelier ne dépend d'aucun outil : il s'écrit à la main sur le support fourni. Aucun repli nécessaire.",
      },
    },
    verification: {
      question:
        "Vous faites valider vos trois réécritures par un autre binôme, sur la grille fournie : le critère interdit est-il nommé ? l'information due au candidat et au CSE est-elle prévue ? la trace de décision humaine est-elle décrite ? tout classement a-t-il disparu ?",
      reponseAttendue:
        "Les quatre cases cochées sur les trois demandes. Le corrigé est ensuite projeté et les écarts commentés en salle — c'est là que se joue l'apprentissage, pas dans la note.",
      dureeMin: 15,
      notes: {
        script:
          "Contrôle CROISÉ, pas auto-correction : chaque binôme relit celui d'à côté. Projetez le corrigé après, jamais avant. Commentez deux ou trois écarts seulement, ceux qui se répètent dans la salle — le reste se lit sur le corrigé.",
        faq: [
          {
            question: "On note ? Ça compte ?",
            reponse:
              "On ne note pas ici. L'évaluation des acquis est à 16 h, sur dix questions. Ceci sert à repérer ce qui coince pendant qu'on peut encore le corriger.",
          },
        ],
        blocages: [
          {
            situation: "Les binômes se valident mutuellement sans rien relever.",
            parade:
              "Annoncer que chaque binôme doit remonter AU MOINS un écart, et que vous en demanderez un à l'oral. La complaisance tombe immédiatement.",
          },
        ],
        planB:
          "Le corrigé est imprimé dans le kit. Sans vidéoprojecteur, il se distribue et se commente à l'oral.",
      },
    },
    synthese: {
      acquis: [
        "Je nomme le régime d'usage adapté à chaque document RH — et je sais pourquoi retirer le nom ne suffit pas.",
        "Je repère un critère interdit dans une demande avant de la lancer.",
        "Je fais informer le candidat et le CSE avant la première utilisation.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites-les FORMULER, ne récitez pas. « En une phrase, qu'est-ce que vous ne ferez plus à partir de demain ? » Trois réponses suffisent. Annoncez la pause et ce qui suit : on passe aux écrits qui ne contiennent aucune donnée de candidat.",
        faq: [],
        blocages: [
          {
            situation: "Personne ne parle, il est 10 h 40 et la salle veut sa pause.",
            parade:
              "Ne pas insister : énoncer les trois acquis vous-même et libérer. Un acquis mal formulé à contrecœur ne s'ancre pas mieux.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 2 — Les écrits RH sans donnée personnelle
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-2",
    objectif: {
      enonce:
        "À la fin de ce module, vous produisez un écrit RH publiable et vous le déclinez en trois formats, en barrant toute affirmation que vous n'avez pas vérifiée dans un document.",
      objectifGlobalId: "obj-1",
      // Ce module produit aussi les ecrits de communication interne :
      // publication interne, support d'onboarding, trame d'entretien.
      objectifsSecondairesIds: ["obj-3"],
      dureeMin: 5,
      notes: {
        script:
          "Annoncez pourquoi on commence par là : ces écrits ne contiennent AUCUNE donnée de candidat, donc aucun risque, et c'est le volume le plus lourd du métier. C'est le meilleur rapport gain/risque de la journée, dites-le tel quel.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "« Rédige une offre pour un comptable. » La sortie est correcte et interchangeable : elle pourrait être celle de n'importe quelle entreprise, et elle ne dit rien du poste réel.",
      apres:
        "La même demande structurée par les cinq leviers AXION. La sortie porte le contexte, le ton et les contraintes de l'entreprise — et ce qui reste à vérifier saute aux yeux.",
      prompt:
        "Acteur : tu es responsable RH d'une PME industrielle de 40 personnes en Isère.\nConteXte : je recrute un comptable unique, rattaché au dirigeant, qui reprend un poste occupé neuf ans par la même personne.\nIntention : produire une offre d'emploi publiable sur notre site et en multidiffusion.\nOutput : 300 mots, titre, missions en cinq puces, profil en trois puces, une phrase de clôture avec la marche à suivre pour postuler.\nNormes : aucun superlatif, aucune promesse de rémunération ou d'avantage, aucune mention de convention collective ou de période d'essai — je les vérifierai moi-même dans nos documents et je les ajouterai.",
      outil: "Un seul outil, celui validé dans la salle.",
      captureEcran:
        "Les deux sorties côte à côte, avec les cinq leviers AXION annotés en marge du prompt structuré.",
      verifieLe: VERIFIE_LE,
      dureeMin: 15,
      notes: {
        script:
          "Écrivez AXION au tableau et laissez-le affiché toute la journée : Acteur, conteXte, Intention, Output, Normes. Lancez d'abord la demande spontanée, laissez la salle trouver la sortie « pas mal » — c'est le piège. Puis la version structurée. Insistez sur la ligne Normes : c'est elle qui empêche l'outil d'inventer une convention collective.",
        faq: [
          {
            question: "Pourquoi interdire de mentionner la rémunération dans le prompt ?",
            reponse:
              "Parce que l'outil la remplira, plausiblement et faux. Ce que vous n'avez pas vérifié dans un document, vous ne le laissez pas écrire.",
          },
          {
            question: "On peut réutiliser ce prompt tel quel ?",
            reponse:
              "Oui, c'est fait pour. Il est dans votre support, les cinq lignes sont à remplacer une par une.",
          },
        ],
        blocages: [
          {
            situation: "La sortie structurée mentionne quand même une convention collective.",
            parade:
              "Excellent incident : montrez-le. C'est la preuve vivante que la ligne Normes ne suffit pas et que la relecture reste obligatoire. Ne le cachez pas, exploitez-le.",
          },
        ],
        planB:
          "Les deux sorties sont imprimées dans le kit (datées). La comparaison se tient à l'identique sur papier.",
      },
    },
    pratique: {
      consigne:
        "Deux temps. D'abord les trois gestes qui débloquent tout, chacun sur SON poste, chronométré : déposer une fiche de poste en PDF, dicter deux minutes depuis son téléphone, photographier un tableau ou une note manuscrite. Puis l'atelier, au choix selon votre quotidien : produire l'offre d'un poste réel et la décliner en trois formats — annonce courte de multidiffusion, message d'approche, publication interne — OU un support d'onboarding, OU une trame d'entretien professionnel.",
      aEmporter:
        "Un écrit RH publiable, décliné en trois formats, plus la fiche mémo des cinq leviers AXION. Deuxième versement au dossier de poste.",
      dureeMin: 50,
      notes: {
        script:
          "Annoncez les trois causes d'échec AVANT que quiconque échoue : scan sans texte reconnu, fichier trop lourd, tableau désaligné. La parade de chacune est sur le support. Un stagiaire qui échoue sans avoir été prévenu se referme pour la journée ; prévenu, il vous appelle. Sur l'atelier : les trois consignes sont écrites et remises, ne les dictez pas. Passez, relancez sur AXION, ne rédigez rien à la place de personne.",
        faq: [
          {
            question: "Ma photo de tableau ressort illisible.",
            reponse:
              "Cadrez colonne par colonne plutôt que le tableau entier, et redemandez « reconstitue ce tableau en texte, une ligne par ligne ». C'est la parade n° 3 de votre support.",
          },
          {
            question: "Je peux déposer une fiche de poste réelle ?",
            reponse:
              "Oui — une fiche de poste n'est pas une donnée personnelle. C'est un CV qui ne se dépose pas.",
          },
        ],
        blocages: [
          {
            situation: "Un stagiaire n'a rien à déposer, il n'a pas de poste ouvert.",
            parade:
              "Le support fournit une fiche de poste de secours. Ne le laissez pas regarder son voisin travailler pendant trente-cinq minutes.",
          },
          {
            situation: "Le réseau de la salle sature au moment des dépôts simultanés.",
            parade:
              "Faites démarrer par vagues de cinq. Annoncez-le comme une consigne d'atelier, pas comme un incident.",
          },
        ],
        planB:
          "Réseau tombé : l'atelier se fait à la main sur la trame papier, et les cinq leviers AXION s'appliquent à l'identique. Ce qui compte est la structure de la demande, pas l'outil qui l'exécute. Chacun relancera chez lui, la trame est datée et réutilisable.",
      },
    },
    verification: {
      question:
        "Contrôle croisé en binôme sur la grille fournie : qu'est-ce que cette offre affirme sans que ce soit vérifié dans un document source ? Passez en revue convention collective applicable, durée de période d'essai, rémunération, avantages, statut cadre — puis les formulations discriminantes que l'outil aurait réintroduites, puis le ton.",
      reponseAttendue:
        "Chaque affirmation non sourcée est BARRÉE sur la copie du binôme. Le corrigé fourni liste les cinq affirmations que l'outil ajoute le plus souvent sans qu'on les lui demande.",
      dureeMin: 15,
      notes: {
        script:
          "Faites barrer physiquement, au stylo, sur la copie de l'autre. Le geste vaut le discours : une page rendue avec quatre phrases barrées se retient mieux qu'une consigne de vigilance.",
        faq: [
          {
            question: "L'outil a écrit « statut cadre », c'est vrai chez nous.",
            reponse:
              "Alors gardez-le — mais vous venez de le VÉRIFIER, ce n'est plus l'outil qui l'affirme. C'est toute la différence.",
          },
        ],
        blocages: [
          {
            situation: "Les copies sont trop propres, rien n'est barré.",
            parade:
              "Projetez une sortie du kit volontairement chargée et faites barrer collectivement. L'œil se règle en trois minutes.",
          },
        ],
        planB: "Grille et corrigé sont imprimés dans le kit. Aucun outil nécessaire.",
      },
    },
    synthese: {
      acquis: [
        "Je structure une demande d'écrit avec les cinq leviers AXION.",
        "Je fais entrer un document dans l'outil par dépôt, dictée ou photo — et je connais la parade des trois échecs classiques.",
        "Je barre toute affirmation que je n'ai pas vérifiée dans un document.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites nommer le fichier à voix haute : « dossier-de-poste-<intitulé>-<date> ». Le dossier existe à partir du moment où il a un nom. Annoncez ce qui vient après le déjeuner : les candidatures, sous grille, sans classement.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 3 — Candidatures et entretiens : présynthétiser, jamais classer
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-3",
    objectif: {
      enonce:
        "À la fin de ce module, vous produisez une présynthèse de candidature sous votre propre grille, et vous savez prouver après coup que la décision est restée humaine.",
      objectifGlobalId: "obj-2",
      dureeMin: 5,
      notes: {
        script:
          "Reprenez le classement à haut risque vu le matin, en une phrase. Le module 3 est celui où la salle attend « enfin les CV » : annoncez tout de suite qu'on ne classera pas, et que ce qu'on fait à la place est plus défendable ET plus rapide.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "« Résume-moi cette candidature. » La sortie hiérarchise d'elle-même, ajoute des qualités que le document ne porte pas, et bascule dans le filtrage sans le dire.",
      apres:
        "La même candidature sous une grille imposée, champ par champ. La sortie ne dit plus que ce qui est dans le document, et les cases vides sont visibles — ce qui manque devient une information.",
      prompt:
        "Remplis la grille ci-dessous à partir du SEUL document joint. N'ajoute aucun élément qui n'y figure pas. N'évalue pas, ne recommande pas, ne classe pas. Si un champ n'est pas renseigné dans le document, écris « non renseigné ».\nChamps : diplôme le plus élevé · nombre d'années sur un poste équivalent · logiciels de paie cités · langues et niveau déclaré · disponibilité annoncée.",
      outil: "Un seul outil, celui validé dans la salle.",
      captureEcran:
        "Les deux sorties côte à côte, avec surlignage de ce que la version libre AJOUTE, INVENTE et HIÉRARCHISE de son propre chef.",
      verifieLe: VERIFIE_LE,
      dureeMin: 15,
      notes: {
        script:
          "Surlignez à l'écran en trois couleurs, et nommez-les : ce qui est ajouté, ce qui est inventé, ce qui est hiérarchisé. C'est la troisième catégorie qui fait basculer dans le haut risque, et c'est la moins visible — insistez là.",
        faq: [
          {
            question: "« Non renseigné » partout, ça ne sert à rien.",
            reponse:
              "Au contraire : une grille pleine de cases vides vous dit que la candidature ne répond pas à vos exigences, et vous pouvez le prouver. C'est exactement ce qu'un classement vous cache.",
          },
        ],
        blocages: [
          {
            situation: "L'outil remplit un champ absent du document, malgré la consigne.",
            parade:
              "Montrez-le et gardez-le à l'écran. C'est la démonstration la plus utile de la journée : la grille réduit le risque, elle ne le supprime pas, et c'est pour ça que la relecture humaine est obligatoire.",
          },
        ],
        planB:
          "Les deux sorties sont imprimées dans le kit (datées), avec le surlignage déjà appliqué.",
      },
    },
    pratique: {
      consigne:
        "Trois temps. D'abord, chacun construit SA grille de lecture à partir de la seule fiche de poste, sur la trame à trous fournie — en inscrivant en en-tête les champs volontairement interdits : âge, photo, situation familiale, adresse, nationalité, état de santé, appartenance syndicale. Ensuite, présynthétisez les trois candidatures du jeu fourni sous votre grille, dans le régime d'usage retenu le matin. Enfin, complétez les champs variables de la mention d'information des candidats et de la note au CSE, sur les trames pré-rédigées et datées.",
      aEmporter:
        "Votre grille de lecture avec ses champs interdits en en-tête, trois présynthèses, la réponse au candidat non retenu, et les deux trames d'information complétées — en projet, à faire valider.",
      dureeMin: 65,
      notes: {
        script:
          "AUCUN document réel de candidat n'est déposé : le jeu fourni sert à tout. Répétez-le au démarrage de l'atelier, pas seulement le matin. Sur les trames d'information : seuls les champs variables se remplissent — raison sociale, poste, outil utilisé, finalité, destinataire, durée de conservation, contact. L'en-tête « Projet — à faire valider par votre conseil avant diffusion » reste apparent et ne se retire pas. Vous n'arbitrez AUCUNE question juridique : « je ne me prononce pas, notez la question, votre conseil tranchera ».",
        faq: [
          {
            question: "On peut vraiment envoyer cette mention aux candidats demain ?",
            reponse:
              "Non. C'est un projet, l'en-tête le dit. Votre conseil la valide, puis vous la diffusez. Notez la date à laquelle vous la lui envoyez, c'est votre feuille de route de 16 h.",
          },
          {
            question: "Répondre aux candidats non retenus avec l'IA, ce n'est pas impersonnel ?",
            reponse:
              "Comparez à ce qui se passe vraiment aujourd'hui : la plupart ne reçoivent rien. Une réponse relue vaut mieux qu'un silence.",
          },
        ],
        blocages: [
          {
            situation: "Un stagiaire ouvre un vrai CV pour « aller plus vite ».",
            parade:
              "Arrêter immédiatement, sans négocier, et rappeler la règle en une phrase. C'est le seul point de la journée où l'on ne discute pas.",
          },
          {
            situation: "La salle veut absolument savoir si tel usage précis est légal chez eux.",
            parade:
              "Formule exacte, prononcée telle quelle : « je ne me prononce pas, notez la question, votre conseil tranchera ». Écrivez la question au tableau — la liste des questions ouvertes est une production utile de la journée.",
          },
        ],
        planB:
          "Outil indisponible : la grille se construit à la main, et les trois présynthèses se font sur les sorties imprimées du kit. Les trames d'information ne dépendent d'aucun outil.",
      },
    },
    verification: {
      question:
        "Contrôle croisé en binôme, grille fournie : dans les productions de l'autre, repérez les informations sans lien direct avec l'emploi, les affirmations non vérifiables, tout reste de classement ou de score, et l'absence de trace de relecture humaine.",
      reponseAttendue:
        "Les quatre catégories passées en revue sur chaque production, écarts relevés à l'oral. Le corrigé fourni montre les trois formes que prend un classement résiduel — un ordre d'affichage, un adjectif comparatif, une recommandation en fin de réponse.",
      dureeMin: 15,
      notes: {
        script:
          "Le classement résiduel est ce qui échappe le plus : il ne dit jamais « je classe », il ordonne. Faites chercher les trois formes du corrigé avant de les nommer.",
        faq: [],
        blocages: [
          {
            situation: "Un binôme ne trouve aucun écart.",
            parade:
              "Leur donner la production du kit, qui en contient quatre. S'ils n'en trouvent aucun là non plus, refaire la lecture avec eux — l'œil n'est pas encore réglé.",
          },
        ],
        planB: "Grille et corrigé imprimés dans le kit.",
      },
    },
    synthese: {
      acquis: [
        "Je présynthétise sous une grille que j'ai posée, jamais sous celle de l'outil.",
        "Je réponds à un candidat non retenu sans avoir à le formuler moi-même à chaque fois.",
        "Je fais informer candidats et CSE avant la première utilisation.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Annoncez la pause et le dernier module en une phrase : « on va voir à quel moment l'IA vous ment dans votre propre domaine, et vous repartez avec le dossier assemblé ».",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 4 — Droit social, fiabilité et ancrage
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-4",
    objectif: {
      enonce:
        "À la fin de ce module, vous savez à quel moment l'IA vous ment dans votre propre domaine, et vous repartez avec un dossier de poste utilisable dès demain.",
      objectifGlobalId: "obj-5",
      dureeMin: 5,
      notes: {
        script:
          "Reprenez le tableau du matin, celui du tour de table. Montrez ce que la journée a couvert et ce qu'elle n'a pas couvert — l'honnêteté sur ce dernier point achète toute la crédibilité du reste.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "« Quelle est la durée de préavis pour un cadre dans ma convention collective ? » L'outil répond avec assurance, cite un article et un délai. Rien n'est vérifiable, et la réponse est plausible — c'est ce qui la rend dangereuse.",
      apres:
        "La même question, posée en fournissant à l'outil l'extrait de texte que le formateur ouvre à l'écran. La réponse cesse d'inventer, cite ce qu'on lui a donné, et devient vérifiable en trois secondes.",
      prompt:
        "Voici l'extrait de convention collective ci-joint. En te limitant STRICTEMENT à ce texte, réponds : quelle durée de préavis s'applique à un cadre démissionnaire après trois ans d'ancienneté ? Cite la phrase exacte du texte sur laquelle tu t'appuies. Si le texte ne permet pas de répondre, dis-le et n'invente rien.",
      outil: "Un seul outil, celui validé dans la salle.",
      captureEcran:
        "Les deux réponses côte à côte, avec l'article inventé de la première entouré en rouge et la citation exacte de la seconde surlignée.",
      verifieLe: VERIFIE_LE,
      dureeMin: 10,
      notes: {
        script:
          "Posez la question SANS rien fournir en premier, et lisez la réponse à voix haute avec assurance — la salle doit sentir à quel point c'est convaincant. Puis ouvrez le texte et refaites. Le contraste est l'enseignement ; ne le commentez pas trop, il se suffit.",
        faq: [
          {
            question: "Comment on sait que la première réponse est fausse ?",
            reponse:
              "On ne le sait pas, et c'est exactement le problème. C'est pour ça que la règle n'est pas « vérifiez », mais « fournissez le texte ».",
          },
        ],
        blocages: [
          {
            situation: "La première réponse est correcte par hasard.",
            parade:
              "Le dire immédiatement : « elle a raison cette fois, et vous n'aviez aucun moyen de le savoir avant de vérifier ». L'enseignement tient tout autant.",
          },
        ],
        planB:
          "Les deux réponses sont imprimées dans le kit (datées), avec l'article inventé déjà entouré.",
      },
    },
    pratique: {
      consigne:
        "Trois temps. Chasse à l'erreur chronométrée sur le document fourni : une réponse de droit social produite par l'IA, avec des erreurs plantées — surlignez ce que vous croyez faux, on compte les repérages à main levée. Puis, en binôme, écrivez la règle applicable dans votre service en une phrase, et la formule de refus à tenir devant un collègue. Enfin, assemblez et nommez LE DOSSIER DE POSTE, et ouvrez le journal de relecture humaine.",
      aEmporter:
        "Le dossier de poste complet — fiche de poste, grille de lecture, trames d'écrits, mention candidat, note CSE, règle de droit social — et le journal de relecture humaine, partagé à la personne qui le tiendra à jour.",
      dureeMin: 50,
      notes: {
        script:
          "Sur la chasse à l'erreur : comptez les repérages à main levée AVANT de corriger, et notez le score au tableau. La salle sous-estime toujours, et le chiffre affiché vaut mieux qu'un discours sur la vigilance. Les deux phrases du binôme se lisent à VOIX HAUTE — une règle qu'on n'a pas prononcée ne se tient pas devant un collègue. Sur le dossier : faites-le nommer, et faites nommer la personne qui tient le journal. Un journal sans titulaire n'est pas tenu.",
        faq: [
          {
            question: "La formule de refus, ça va passer pour de l'incompétence.",
            reponse:
              "« Je ne me prononce pas, je vous réponds après vérification » est la phrase de quelqu'un qui sait où sont les limites. C'est l'inverse de l'incompétence, et vos juristes vous le confirmeront.",
          },
          {
            question: "Qui doit tenir le journal de relecture ?",
            reponse:
              "Celui qui produit, pas celui qui contrôle. Une ligne par production : qui a relu, quand, ce qui a été modifié.",
          },
        ],
        blocages: [
          {
            situation: "La salle trouve toutes les erreurs plantées et s'ennuie.",
            parade:
              "Le document du kit en contient trois de plus, plus fines — dont une qui ne se voit qu'en ouvrant le texte source.",
          },
          {
            situation:
              "Un stagiaire refuse d'ouvrir un journal de relecture, « c'est de la paperasse ».",
            parade:
              "Une question : « le jour où un candidat conteste, avec quoi montrez-vous que vous avez décidé ? ». Ne pas argumenter davantage.",
          },
        ],
        planB:
          "Aucun outil nécessaire : la chasse à l'erreur, les deux phrases et l'assemblage du dossier se font sur papier. C'est l'atelier le plus robuste de la journée, gardez-le complet même si tout le reste a été dégradé.",
      },
    },
    verification: {
      question:
        "Évaluation des acquis : quiz individuel de dix questions, corrigé en salle question par question. Puis auto-évaluation par chacun d'une production réelle du jour, sur la grille de relecture — exactitude des affirmations, informations interdites, mentions dues, ton, réutilisabilité.",
      reponseAttendue:
        "Le corrigé est commenté question par question, sans passer aucune question. Le seuil de réussite de la formation est celui déclaré au programme ; un score en dessous déclenche la reprise individuelle prévue au dispositif.",
      dureeMin: 15,
      notes: {
        script:
          "C'est l'évaluation des acquis au sens de l'indicateur 11 : elle se tient, elle se corrige, et elle se conserve. Ne la sacrifiez jamais au temps qui manque — c'est la première chose qu'un auditeur demande. Si vous êtes en retard, coupez ailleurs.",
        faq: [
          {
            question: "Le résultat va être transmis à mon employeur ?",
            reponse:
              "Le résultat individuel ne l'est pas. Ce qui est transmis, c'est l'attestation de fin de formation et le fait que l'évaluation a eu lieu.",
          },
        ],
        blocages: [
          {
            situation: "Il est 17 h 15, le quiz n'est pas commencé.",
            parade:
              "Le tenir quand même, en réduisant le commentaire du corrigé aux questions les plus ratées. On ne remplace jamais l'évaluation par un tour de table.",
          },
        ],
        planB: "Quiz papier et corrigé imprimés dans le kit. Aucune dépendance à un outil.",
      },
    },
    synthese: {
      acquis: [
        "J'ouvre un dossier de poste AVANT toute utilisation de l'IA sur un recrutement.",
        "Je fais informer le CSE avant la première utilisation, et je sais à quelle date je l'envoie.",
        "Je consigne chaque relecture humaine au journal, avec qui a relu et ce qui a été modifié.",
      ],
      dureeMin: 10,
      notes: {
        script:
          "Chacun nomme à voix haute TROIS usages qu'il installe la semaine suivante, QUI les tient, et à quelle DATE la mention candidat et la note CSE partent chez le conseil. Sans nom et sans date, une feuille de route ne se réalise pas. Notez au tableau, prenez une photo, envoyez-la au groupe.",
        faq: [],
        blocages: [
          {
            situation: "Les engagements restent vagues : « je vais essayer d'utiliser l'IA ».",
            parade:
              "Reformuler en une question : « sur quel poste, et quel jour ? ». Ne pas passer au suivant tant que la réponse ne porte pas un nom et une date.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },
];
