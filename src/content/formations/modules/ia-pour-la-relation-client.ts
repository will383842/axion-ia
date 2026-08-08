/**
 * CONTENU RÉDIGÉ — « IA pour la relation client » (1 jour, 7 h, 4 modules).
 *
 * ## Le fil rouge
 *
 * Chacun repart avec SON référentiel de réponses : deux réponses types
 * réutilisables, une réclamation traitée, une fiche de reprise de dossier et
 * trois fiches de base de connaissances — le tout relu sur la même grille de
 * quatre contrôles. Le module 1 pose le cadre et constitue la matière, le
 * module 2 produit les réponses, le module 3 reprend les dossiers en cours, le
 * module 4 range ce qui marche et contrôle ce qui part au client. Aucun des
 * quatre ne se suffit à lui-même.
 *
 * ## Trois règles que le formateur ne négocie pas
 *
 * **Aucune donnée réelle de client n'est déposée dans un outil pendant la
 * journée.** Les tickets, historiques et verbatims viennent du kit, et les cas
 * personnels des stagiaires passent d'abord par l'atelier de neutralisation du
 * module 1. Un conseiller qui ouvre son outil de ticketing et colle un dossier
 * réel est arrêté, sans discussion.
 *
 * **Le formateur n'arbitre aucune question juridique.** La formule est écrite
 * et se prononce telle quelle : « je ne me prononce pas, notez la question,
 * votre conseil tranchera ». Elle sert en particulier sur les réponses
 * publiques aux avis, sur les mentions d'information et sur tout ce qui touche
 * à une garantie ou à un délai contractuel.
 *
 * **Rien ne se fabrique.** On ne fait jamais écrire un avis, un témoignage ou
 * une satisfaction client par l'outil, même « pour l'exemple ». Et dans une
 * réponse publique à un avis, on ne confirme jamais qu'une personne est
 * cliente : la trame remise le dit, et cette ligne n'est pas retirable.
 *
 * ⚠️ Les mentions d'information et les trames de réponse publique remises aux
 * stagiaires portent un en-tête « Projet — à faire valider par votre conseil
 * avant diffusion » qui reste apparent. Leur formulation est à faire relire par
 * le conseil de l'organisme.
 */

import type { EnrichissementFormation } from "./types";

/** Date de dernière vérification des captures et sorties d'outils. */
const VERIFIE_LE = "2026-08-06";

export const IA_POUR_LA_RELATION_CLIENT: EnrichissementFormation = [
  // ───────────────────────────────────────────────────────────────────────────
  // Module 1 — Le cadre du ticket : ce que l'IA prend en charge, ce qu'elle
  // ne décide jamais
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-1",
    objectif: {
      enonce:
        "À la fin de ce module, vous classez l'outil de votre équipe dans son régime d'usage, vous neutralisez un ticket réel avant de le confier à un outil, et vous disposez du jeu de travail de votre journée.",
      objectifGlobalId: "obj-5",
      dureeMin: 10,
      notes: {
        script:
          "La première question de la salle est toujours la même, et elle n'est jamais posée à voix haute : « est-ce qu'on va nous remplacer ? ». Posez-la vous-même, dès la deuxième minute, et répondez par le partage de tâches, pas par une promesse : l'IA propose un brouillon, le conseiller vérifie le fait, autorise l'engagement et signe. Tracez deux colonnes au tableau, « ce que la machine prépare » et « ce que je garde », et faites-les remplir en tour de table d'une phrase par personne. Gardez ce tableau affiché toute la journée. Annoncez enfin le livrable du matin : deux réponses types réutilisables et une réclamation traitée avant midi — et le préalable de ce module-ci, qui conditionne tout le reste : savoir ce qui a le droit d'entrer dans un outil, et dans quel état.",
        faq: [
          {
            question: "Concrètement, on va supprimer des postes au support ?",
            reponse:
              "Ce n'est pas à moi de répondre pour votre entreprise, et je ne le ferai pas. Ce que je constate : la journée porte sur le brouillon et la synthèse, jamais sur l'envoi. Tout ce qu'on produit aujourd'hui doit passer par quelqu'un avant de partir.",
          },
          {
            question: "On a déjà des réponses types dans l'outil, à quoi ça sert de plus ?",
            reponse:
              "Vos réponses types répondent à un motif. Ce qui prend du temps, c'est de les adapter à un client précis sans casser le ton ni les mentions. C'est exactement là que la journée intervient.",
          },
        ],
        blocages: [
          {
            situation:
              "Un responsable présent dans la salle répond à la place de l'équipe sur la question du remplacement.",
            parade:
              "Le remercier, puis reposer la question aux conseillers en la reformulant : « et vous, qu'est-ce que vous voudriez ne plus faire à la main ? ». La parole revient à ceux qui feront le travail.",
          },
        ],
        planB:
          "Aucun outil n'est nécessaire : les deux colonnes se tracent au paperboard et le tour de table se tient tel quel.",
      },
    },
    demonstration: {
      avant:
        "Le même ticket traité comme aujourd'hui : le conseiller relit l'historique, retrouve le motif, cherche la réponse type la plus proche, la recolle et la retouche — et selon la personne qui répond, la formulation, les mentions et l'engagement pris ne sont pas les mêmes.",
      apres:
        "Le même ticket confié à un outil avec une consigne qui borne ce qu'il a le droit d'écrire. Le brouillon arrive en une passe, avec les mentions obligatoires, et surtout SANS aucune garantie ni délai que personne n'a autorisés — parce que la consigne l'interdit explicitement.",
      prompt:
        "« Voici la demande d'un client, reproduite ci-dessous. Rédige un brouillon de réponse. Réponds uniquement à partir de ce qui est écrit dans la demande et dans la fiche produit jointe. N'annonce aucun délai, aucun remboursement, aucun geste commercial et aucune garantie : si l'un d'eux te paraît nécessaire, écris à la place [À ARBITRER PAR LE CONSEILLER] et poursuis. Termine par la question qu'il me reste à poser au client pour clore le dossier. »",
      outil: "Un seul outil, celui validé dans la salle (Claude ou ChatGPT selon le groupe).",
      captureEcran:
        "Le brouillon obtenu, avec chaque mention [À ARBITRER PAR LE CONSEILLER] entourée et la phrase d'interdiction de la consigne surlignée en regard.",
      verifieLe: VERIFIE_LE,
      dureeMin: 20,
      notes: {
        script:
          "Chronométrez le traitement « comme aujourd'hui » en direct, montre en main, et annoncez le temps à voix haute : c'est le seul chiffre que la salle retiendra du matin. Puis lancez la consigne et montrez ce que le [À ARBITRER PAR LE CONSEILLER] produit dans le brouillon — c'est la trace visible de la décision qui reste humaine : l'outil prépare, le conseiller arbitre. Insistez une seule fois, en la nommant, sur la phrase d'interdiction : c'est elle qui empêche l'outil d'inventer un délai de remboursement. La méthode complète de structuration viendra au module suivant ; ici, on installe le partage des rôles.",
        faq: [
          {
            question: "Pourquoi interdire à l'outil d'écrire un délai ? Il connaît nos délais.",
            reponse:
              "Non. Il produit un délai plausible, parce qu'un délai est ce qui vient à cet endroit d'une phrase. Un délai écrit dans une réponse envoyée engage l'entreprise, même s'il est faux. C'est à vous de l'écrire, après vérification.",
          },
          {
            question: "On doit vraiment dire au client qu'on a utilisé un outil ?",
            reponse:
              "Je ne me prononce pas sur ce que votre entreprise doit faire, et la mention du kit est un projet à faire valider par votre conseil. Ce que je peux dire : cette question se pose, elle est dans le kit, notez-la pour votre conseil.",
          },
        ],
        blocages: [
          {
            situation:
              "L'outil respecte la consigne dès la version « avant », le contraste ne se voit pas.",
            parade:
              "Relancer la consigne en retirant la phrase d'interdiction, et en ajoutant « rassure le client ». Le délai et le geste commercial réapparaissent presque toujours. Si ce n'est toujours pas le cas, passer au plan B sans commenter l'échec.",
          },
          {
            situation: "Un stagiaire propose de tester avec un ticket ouvert dans son outil.",
            parade:
              "Refuser en une phrase : « aucune donnée réelle de client aujourd'hui, et l'atelier qui suit vous apprend précisément à préparer vos vrais tickets pour ça ».",
          },
        ],
        planB:
          "Quota atteint, réseau tombé ou réponse aberrante : les deux sorties de cette démonstration sont imprimées dans le kit formateur (datées). La comparaison se tient à l'identique sur papier, y compris le chronométrage du traitement « comme aujourd'hui », qui ne dépend d'aucun outil. Ne rien improviser en direct : les sorties du kit ont été vérifiées.",
      },
    },
    pratique: {
      consigne:
        "Constituez VOTRE jeu de travail de la journée : prenez trois demandes réellement reçues — une simple, une réclamation, une hors périmètre — et neutralisez-les sur la trame fournie, en appliquant la liste rouge (nom, adresse, numéro de dossier, pièce d'identité, moyen de paiement, et tout détail qui permettrait de reconnaître la personne). Ces trois demandes neutralisées serviront à tous les ateliers de la journée.",
      aEmporter:
        "Le jeu de trois demandes neutralisées et la trame de neutralisation avec sa liste rouge, datée et réutilisable au poste — première pièce de votre référentiel.",
      dureeMin: 25,
      notes: {
        script:
          "Ne laissez personne se dispenser d'écrire à la main : c'est le geste qui compte, pas le résultat. Passez dans les rangs et cherchez UNE chose, toujours la même — le détail qui reste identifiant après le retrait du nom. « Le client de la mairie de Voiron qui a commandé trois palettes en janvier » est encore identifiable, et le stagiaire ne le voit pas seul. Montrez-le une fois à voix haute, la salle corrige ses propres copies dans la minute.",
        faq: [
          {
            question: "Si je retire le nom, c'est bon ?",
            reponse:
              "Non, et c'est le point du matin. Retirer le nom, c'est pseudonymiser ; ce n'est pas anonymiser. Un numéro de dossier, une commune et une date de commande suffisent souvent à retrouver la personne. La liste rouge est sur votre trame, passez les six lignes.",
          },
          {
            question: "Je n'ai pas de réclamation en cours à apporter.",
            reponse:
              "Le kit en fournit trois. Prenez-en une, elle fera aussi bien l'affaire — ce que vous emportez, c'est la méthode, pas le dossier.",
          },
        ],
        blocages: [
          {
            situation:
              "Un stagiaire neutralise en remplaçant les noms par « Monsieur X » et perd le sens de la demande.",
            parade:
              "Lui faire remplacer par un rôle plutôt que par une lettre : « le gestionnaire du parc », « le service comptable du client ». Le sens revient, l'identification disparaît.",
          },
        ],
        planB:
          "L'atelier de neutralisation ne dépend d'aucun outil : il s'écrit à la main sur la trame fournie. Rien à replier — c'est déjà la version papier.",
      },
    },
    verification: {
      question:
        "Deux contrôles corrigés en salle. Premier : chacun classe l'outil réellement utilisé par son équipe dans l'un des trois régimes d'usage — compte grand public, offre entreprise avec engagement de non-réutilisation, environnement validé par la direction — et écrit en une phrase ce qu'il a le droit d'y coller. Deuxième, cinq questions sur les cinq extraits fournis : qu'est-ce qui peut être collé tel quel, qu'est-ce qui doit être neutralisé, qu'est-ce qui ne sort jamais ?",
      reponseAttendue:
        "L'outil de chaque stagiaire est nommé et classé, avec sa phrase de périmètre. Les cinq extraits sont classés conformément au corrigé — l'extrait 3, un historique où le nom a été retiré mais dont la commune et le numéro de commande subsistent, est celui qui se rate le plus.",
      dureeMin: 18,
      notes: {
        script:
          "Sur le classement des régimes : faites écrire le NOM de l'outil, pas sa catégorie. « Un compte gratuit ouvert avec l'adresse professionnelle » est une réponse, « une IA » n'en est pas une. Si personne ne sait ce que l'entreprise a validé, c'est déjà un résultat utile : notez-le comme question ouverte au tableau, elle partira dans la feuille de route de 17 h. Sur les cinq extraits, corrigez les deux erreurs les plus fréquentes seulement, le reste se lit sur le corrigé.",
        faq: [
          {
            question: "Notre outil n'entre dans aucune des trois cases.",
            reponse:
              "Alors écrivez-le tel quel et notez la question. Un outil dont personne dans la salle ne sait sous quel régime il tourne est en soi l'information la plus utile de la matinée.",
          },
          {
            question: "On est notés ?",
            reponse:
              "Pas ici. L'évaluation des acquis se tient en fin de journée, sur dix questions et trois productions. Ceci sert à repérer ce qui coince pendant qu'on peut encore le corriger.",
          },
        ],
        blocages: [
          {
            situation:
              "Un stagiaire conteste qu'un extrait doive être neutralisé, « il n'y a pas de nom ».",
            parade:
              "Une seule question : « avec ces trois éléments, combien de clients cela peut-il désigner chez vous ? ». La réponse est presque toujours « un seul ».",
          },
        ],
        planB:
          "Les cinq extraits et leur corrigé sont imprimés dans le kit. Sans vidéoprojecteur, le corrigé se distribue et se commente à l'oral, et les classements s'écrivent au paperboard.",
      },
    },
    synthese: {
      acquis: [
        "Je sais dans quel régime d'usage tourne l'outil de mon équipe, et ce que j'ai le droit d'y coller.",
        "Je neutralise une demande client avant de la confier à un outil, en passant les six lignes de la liste rouge.",
        "Je sais que retirer le nom ne suffit pas : pseudonymiser n'est pas anonymiser.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Deux minutes avant la pause, pas plus. Faites énoncer par la salle la seule question à se poser avant de coller un ticket — « dans quel régime tourne cet outil, et qu'est-ce que j'ai le droit d'y mettre ? » — puis annoncez la suite en une phrase : au retour de la pause, on produit les réponses, et c'est un pair qui les valide sur grille, pas le formateur.",
        faq: [],
        blocages: [
          {
            situation: "La salle est déjà debout pour la pause, personne n'écoute.",
            parade:
              "Ne pas insister : énoncer les trois acquis vous-même en trente secondes et libérer. Un acquis récité à contrecœur ne s'ancre pas mieux.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 2 — Réponses types et réclamations
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-2",
    objectif: {
      enonce:
        "À la fin de ce module, vous produisez une réponse type réutilisable et une réclamation traitée, l'une et l'autre validées par un pair sur grille.",
      objectifGlobalId: "obj-1",
      // Le module traite aussi une réclamation de bout en bout (démonstration
      // AXION + atelier + chasse à l'erreur).
      objectifsSecondairesIds: ["obj-2"],
      dureeMin: 5,
      notes: {
        script:
          "Au retour de la pause, reprenez cinq minutes pour poser le contrat du module : ce qu'on produit maintenant sera validé par un pair sur grille, pas par le formateur — exactitude du fait, engagement pris, ton, réutilisabilité. Annoncez les deux livrables sans les commenter : une réponse type réutilisable et une réclamation traitée. Rappelez en une phrase l'acquis du module 1 : tout ce qui entre dans l'outil est passé par la trame de neutralisation.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "Une réclamation agressive reçue en deuxième relance : aucune réponse type ne convient, le conseiller écrit de zéro — et le ton de la réponse dépend de son humeur du moment, la mention obligatoire saute une fois sur deux.",
      apres:
        "La même réclamation confiée à l'outil avec une consigne structurée par les cinq leviers AXION. Le brouillon arrive dans le ton de la maison, reconnaît le fait sans discuter le ton du client, porte la mention d'information — et aucun délai ni geste commercial que personne n'a autorisés : la ligne Normes l'interdit.",
      prompt:
        "Consigne structurée par AXION —\nActeur : tu es conseiller au service client d'une entreprise de vente d'équipement professionnel.\nConteXte : le client écrit pour la deuxième fois au sujet d'une livraison incomplète, son message est agressif et met en cause la personne qui lui a répondu la première fois. Le message et l'historique neutralisés sont ci-dessous.\nIntention : produire un brouillon de réponse qui reconnaît le fait, ne discute pas le ton, et propose la prochaine étape concrète.\nOutput : 150 mots maximum, sans liste à puces, une seule question au client à la fin.\nNormes : vouvoiement, pas d'excuse formulée plus d'une fois, aucune mise en cause d'un collègue, aucun délai ni geste commercial chiffré — écris [À ARBITRER PAR LE CONSEILLER] à leur place. Ajoute en dernière ligne la mention d'information sur l'usage d'un outil d'assistance, telle qu'elle est fournie dans le kit.",
      outil: "Un seul outil, celui validé dans la salle (Claude ou ChatGPT selon le groupe).",
      captureEcran:
        "Le brouillon obtenu à côté de la consigne, les cinq leviers AXION annotés en marge, et la mention [À ARBITRER PAR LE CONSEILLER] entourée dans le brouillon.",
      verifieLe: VERIFIE_LE,
      dureeMin: 15,
      notes: {
        script:
          "Écrivez AXION au tableau — Acteur, conteXte, Intention, Output, Normes — et laissez-le affiché jusqu'au soir. Faites lire le message du client à voix haute par un stagiaire volontaire avant de lancer quoi que ce soit : le ton se ressent, il ne se décrit pas. Insistez sur la ligne Normes, et une seule fois, en la nommant : le ton de la maison et les mentions obligatoires ne sont pas une option de l'outil, ce sont des Normes de votre consigne. Montrez que le [À ARBITRER PAR LE CONSEILLER] du module 1 vit maintenant DANS la ligne Normes : la méthode a absorbé le garde-fou.",
        faq: [
          {
            question: "Le brouillon est trop froid, ça ne ressemble pas à notre ton.",
            reponse:
              "Alors le ton n'est pas dans la ligne Normes. Écrivez-le en trois mots concrets — « vouvoiement, phrases courtes, jamais d'exclamation » — et relancez. Le ton n'est pas une qualité de l'outil, c'est une contrainte de votre consigne.",
          },
          {
            question: "Réécrire ces cinq lignes à chaque ticket, c'est plus long que répondre.",
            reponse:
              "Vous ne les réécrivez pas : Acteur, Output et Normes sont fixes pour votre poste et se collent depuis la fiche mémo. Seul le conteXte change avec le client — c'est précisément ce qui doit rester singulier.",
          },
        ],
        blocages: [
          {
            situation:
              "L'outil produit un brouillon correct mais sans la mention d'information en dernière ligne.",
            parade:
              "Le montrer sans le corriger à la main : relancer en remontant la mention au début de la ligne Normes. La salle voit qu'une consigne qui relègue une exigence en fin de liste la perd — c'est une leçon sur les consignes, pas sur l'outil.",
          },
        ],
        planB:
          "Quota atteint, réseau tombé ou réponse aberrante : les deux sorties de cette démonstration sont imprimées dans le kit formateur (datées). La comparaison avant / après se tient à l'identique sur papier, la consigne AXION s'annote au paperboard. Ne rien improviser en direct : les sorties du kit ont été vérifiées.",
      },
    },
    pratique: {
      consigne:
        "Traitez les trois demandes de votre jeu de travail — la simple, la réclamation, la hors périmètre — avec la méthode AXION, puis faites contrôler vos trois réponses par votre binôme sur la grille fournie : exactitude du fait, engagement pris, ton, réutilisabilité.",
      aEmporter:
        "Les trois réponses correspondant à votre jeu de travail, dont deux réponses types réutilisables, et la fiche mémo des cinq leviers AXION — votre référentiel s'étoffe.",
      dureeMin: 35,
      notes: {
        script:
          "Les trois consignes sont écrites et remises, ne les dictez pas. Rappelez que la réponse hors périmètre est la plus difficile — c'est celle où l'on doit dire non sans fermer la porte. Le contrôle croisé se fait sur la grille, au stylo, sur la copie de l'autre. Rappelez la règle de la journée au démarrage : les demandes traitées sont celles neutralisées au module 1, aucune autre.",
        faq: [
          {
            question: "Une réponse type par l'IA, tous mes collègues auront la même ?",
            reponse:
              "C'est le but pour la partie fixe, et c'est ce qui rend la qualité indépendante de la personne qui répond. Ce qui doit rester singulier, c'est ce qui concerne ce client-là : c'est le rôle du levier conteXte.",
          },
        ],
        blocages: [
          {
            situation:
              "Un binôme valide les trois réponses de l'autre sans rien relever, en cinq minutes.",
            parade:
              "Annoncer que chaque binôme devra citer à l'oral un engagement non autorisé trouvé chez l'autre. La complaisance tombe immédiatement.",
          },
          {
            situation: "Le réseau de la salle sature au moment où tout le monde lance sa consigne.",
            parade:
              "Faire démarrer par vagues de cinq, en annonçant que c'est une consigne d'atelier et non un incident.",
          },
        ],
        planB:
          "Outil indisponible : les stagiaires rédigent leur consigne AXION en entier sur le support — c'est la consigne qui s'apprend, pas la manipulation — et le contrôle croisé porte sur les consignes plutôt que sur les réponses. Chacun relancera chez lui : la trame est datée et réutilisable.",
      },
    },
    verification: {
      question:
        "La chasse à l'erreur, corrigée par la salle : dans les réponses produites à l'atelier, repérez la garantie, le délai ou le geste commercial que personne n'a autorisés — on compte, chaque binôme annonce son score.",
      reponseAttendue:
        "Chaque binôme annonce son score à voix haute et le total de la salle est écrit au tableau. Les erreurs relevées sont presque toujours des engagements « de politesse » — un « sous 48 h » glissé pour rassurer, un avoir promis sans autorisation — exactement ceux que la ligne Normes devait bloquer.",
      dureeMin: 20,
      notes: {
        script:
          "Comptez AVANT de corriger, et écrivez le total au tableau. Le chiffre affiché vaut mieux que n'importe quel discours sur la vigilance : la salle sous-estime toujours. Corrigez ensuite les deux erreurs les plus fréquentes seulement, le reste se lit sur le corrigé.",
        faq: [
          {
            question: "Si l'erreur vient de l'outil, ce n'est pas de ma faute.",
            reponse:
              "La signature est la vôtre. C'est tout l'objet du partage de tâches affiché depuis ce matin : l'outil prépare, vous autorisez. Une erreur envoyée est une erreur du signataire, jamais de l'outil.",
          },
        ],
        blocages: [
          {
            situation: "La salle trouve toutes les erreurs plantées en trois minutes et s'ennuie.",
            parade:
              "Passer aux réponses réellement produites à l'atelier plutôt qu'à celles du kit : elles contiennent presque toujours un délai non autorisé que personne n'avait vu.",
          },
        ],
        planB:
          "Le jeu de réponses pour la chasse à l'erreur et son corrigé sont imprimés dans le kit. Sans vidéoprojecteur, les scores s'écrivent au paperboard.",
      },
    },
    synthese: {
      acquis: [
        "Je structure une réponse avec les cinq leviers AXION, et j'écris les Normes qui interdisent délai et geste commercial.",
        "Je repère dans un brouillon l'engagement que personne n'a autorisé.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites-les FORMULER, ne récitez pas : « en une phrase, quel geste vous appliquez au prochain ticket ? ». Trois réponses suffisent. Faites nommer le fichier à voix haute — « referentiel-reponses-<équipe>-<date> » — parce qu'un référentiel existe à partir du moment où il a un nom. Annoncez l'après-midi en une phrase : on reprend des dossiers en cours, on range ce qui marche, et on regarde ce qui part vraiment au client.",
        faq: [],
        blocages: [
          {
            situation: "Il est 12 h 30 et la salle veut déjeuner, personne ne parle.",
            parade:
              "Ne pas insister : énoncer les deux acquis vous-même, faire nommer le fichier, libérer. Un acquis récité à contrecœur ne s'ancre pas mieux.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 3 — Reprendre un dossier en cours et tenir la troisième relance
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-3",
    objectif: {
      enonce:
        "À la fin de ce module, vous reprenez un dossier en cours en cinq minutes à partir de son historique, et vous conduisez une troisième relance jusqu'à l'escalade rédigée.",
      objectifGlobalId: "obj-3",
      // Le jeu de rôle conduit une réclamation de troisième relance jusqu'à
      // l'escalade vers le niveau 2.
      objectifsSecondairesIds: ["obj-2"],
      dureeMin: 5,
      notes: {
        script:
          "Reprenez le tableau des deux colonnes tracé le matin, et montrez ce que la matinée a déplacé de la colonne droite vers la gauche. Annoncez les livrables de l'après-midi sans les commenter : une fiche de reprise de dossier ce module-ci, puis trois fiches de base de connaissances et une réponse passée aux quatre contrôles au module suivant. Dites aussi ce que l'après-midi ne fera pas — on ne branchera rien sur votre outil de ticketing aujourd'hui, et on ne publiera aucune réponse. L'honnêteté sur ce point achète la crédibilité du reste.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "Un fil de vingt échanges à reprendre : le conseiller déroule le fil du haut vers le bas, cherche ce qui a été promis, et rate presque toujours un engagement pris au douzième message.",
      apres:
        "Le même historique rendu en trois blocs — les faits, les engagements déjà pris, la prochaine action — dont chaque ligne renvoie au numéro du message qui la porte. Vérifiable en dix secondes, ce qui le distingue d'un résumé.",
      prompt:
        "« Voici l'historique complet d'un dossier client, messages numérotés de 1 à 20, reproduit ci-dessous. Produis trois blocs et rien d'autre. Bloc FAITS : ce qui s'est passé, une ligne par fait, avec le numéro du message qui l'établit. Bloc ENGAGEMENTS PRIS PAR NOUS : chaque promesse faite au client, avec le numéro du message et la date annoncée si elle y figure ; écris « aucun » si le fil n'en contient pas. Bloc PROCHAINE ACTION : la seule chose qu'il reste à faire, et qui doit la faire. N'ajoute aucun élément absent de l'historique. Si un point est ambigu, écris « à vérifier » plutôt que de trancher. »",
      outil: "Un seul outil, celui validé dans la salle (Claude ou ChatGPT selon le groupe).",
      captureEcran:
        "La fiche de reprise en trois blocs avec les renvois de numéros de messages surlignés, et l'engagement du message 12 entouré.",
      verifieLe: VERIFIE_LE,
      dureeMin: 15,
      notes: {
        script:
          "Faites PARIER avant d'afficher : « combien d'engagements ont été pris dans ce fil de vingt messages ? », chacun écrit un chiffre sur son support. L'historique du kit en contient quatre, dont un formulé de façon si anodine que presque personne ne le compte. Le pari est ce qui rend la suite mémorable. Sur les renvois de numéros, insistez : c'est ce qui rend la fiche vérifiable en dix secondes, et c'est ce qui la distingue d'un résumé.",
        faq: [
          {
            question: "Pourquoi ne pas lui demander directement de rédiger la réponse ?",
            reponse:
              "Parce qu'une réponse rédigée cache ce sur quoi elle s'appuie. La fiche de reprise vous rend les engagements visibles, et c'est vous qui décidez ensuite ce qu'on en fait.",
          },
        ],
        blocages: [
          {
            situation: "L'outil manque un engagement du fil, malgré la consigne.",
            parade:
              "Le montrer et le garder à l'écran. C'est la démonstration la plus utile de l'après-midi : la fiche réduit l'oubli, elle ne le supprime pas, et c'est pour ça que la relecture reste obligatoire.",
          },
        ],
        planB:
          "La sortie est imprimée dans le kit (datée), avec les renvois de numéros déjà surlignés. Le pari écrit et le comptage des engagements se tiennent à l'identique sur papier.",
      },
    },
    pratique: {
      consigne:
        "Deux temps, tous deux sur du matériel neutralisé. Un : reprenez un dossier en cours neutralisé et produisez sa fiche de reprise en trois blocs ; votre binôme vérifie qu'aucun engagement n'a été perdu ni inventé. Deux : jeu de rôle, l'outil joue le client mécontent qui revient une troisième fois — conduisez l'échange sur l'un des trois scénarios du kit, puis rédigez l'escalade vers le niveau 2 sur la trame fournie.",
      aEmporter:
        "Une fiche de reprise de dossier vérifiée par un pair, et une escalade rédigée sur la trame — deux pièces de plus au référentiel.",
      dureeMin: 55,
      notes: {
        script:
          "Sur le jeu de rôle, la consigne donnée à l'outil est fournie au kit et se colle telle quelle : ne la laissez pas improviser, un client simulé trop poli n'apprend rien et un client simulé insultant fait sortir un stagiaire de la salle. Annoncez le cadre avant de lancer : c'est un exercice, on l'arrête quand on veut, et personne ne commente la performance d'un autre. Rappelez la règle de la journée au démarrage de chaque temps, pas seulement le matin : aucune donnée réelle de client ne part dans l'outil.",
        faq: [
          {
            question: "Le client simulé est beaucoup plus dur que dans la vraie vie.",
            reponse:
              "Tant mieux. Un exercice calibré sur la moyenne ne vous prépare pas au dossier qui vous fera passer une mauvaise soirée. Et vous pouvez l'arrêter quand vous voulez.",
          },
        ],
        blocages: [
          {
            situation:
              "Un stagiaire est visiblement affecté par le jeu de rôle, le scénario touche un dossier réel qu'il a vécu.",
            parade:
              "Arrêter l'exercice pour lui immédiatement, sans le commenter devant le groupe, et lui confier la rédaction de l'escalade pendant que les autres poursuivent.",
          },
          {
            situation:
              "La salle veut savoir si une clause de garantie précise s'applique dans un cas donné.",
            parade:
              "Formule exacte, prononcée telle quelle : « je ne me prononce pas, notez la question, votre conseil tranchera ». Écrivez la question au tableau — la liste des questions ouvertes est une production utile de la journée.",
          },
          {
            situation:
              "Un stagiaire ouvre son outil de ticketing pour prendre un dossier « plus parlant ».",
            parade:
              "Arrêter immédiatement, sans négocier, et rappeler la règle en une phrase. C'est le seul point de la journée où l'on ne discute pas.",
          },
        ],
        planB:
          "Outil indisponible : le jeu de rôle se tient à deux, un stagiaire jouant le client à partir du scénario imprimé — c'est même la version la plus riche, gardez-la en réserve. La fiche de reprise se rédige à la main depuis l'historique imprimé du kit ; seule la vitesse change.",
      },
    },
    verification: {
      question:
        "Contrôle oral corrigé en salle, sur le fil de vingt messages du kit : combien d'engagements le fil contient-il, lequel est le plus facile à rater et pourquoi, et qui porte la prochaine action ? Chacun répond depuis sa fiche de reprise, pas de mémoire.",
      reponseAttendue:
        "Quatre engagements, dont celui du message 12 formulé de façon anodine — il se rate parce qu'il ne contient ni date ni chiffre, juste un « on s'en occupe » qui engage pourtant. La prochaine action est portée par l'entreprise, pas par le client, et la fiche doit le dire nommément.",
      dureeMin: 3,
      notes: {
        script:
          "Faites répondre FICHE EN MAIN : la question n'évalue pas la mémoire, elle évalue si la fiche produite permet de répondre en dix secondes. Un stagiaire qui doit relire le fil pour répondre a une fiche qui ne renvoie pas aux numéros de messages — c'est ça qu'on corrige, séance tenante.",
        faq: [
          {
            question: "Ma fiche dit « à vérifier » sur un des engagements, c'est faux ?",
            reponse:
              "Non, c'est exactement ce que la consigne demande : un point ambigu s'écrit « à vérifier », il ne se tranche pas. Une fiche qui avoue son doute vaut mieux qu'une fiche qui invente.",
          },
        ],
        blocages: [
          {
            situation:
              "Deux stagiaires annoncent des comptes d'engagements différents et s'accrochent.",
            parade:
              "Ne pas arbitrer à l'oral : projeter le fil, aller au message contesté, lire la phrase. Le texte tranche, pas le formateur — c'est le réflexe qu'on installe.",
          },
        ],
        planB:
          "Le fil et son corrigé sont imprimés dans le kit. Le contrôle se tient à l'oral, corrigé papier en main.",
      },
    },
    synthese: {
      acquis: [
        "Je reprends un dossier en cours par ses faits, ses engagements et sa prochaine action, avec le renvoi au message qui l'établit.",
        "Je conduis une troisième relance sans discuter le ton du client, et je rédige l'escalade vers le niveau 2 sur la trame.",
      ],
      dureeMin: 2,
      notes: {
        script:
          "Deux minutes avant la pause. Faites formuler l'acquis par un stagiaire qui a raté un engagement au comptage — c'est lui qui le dira le mieux. Annoncez le dernier module en une phrase : on range ce qui marche dans une base qui survivra à la journée, et on contrôle ce qui part vraiment au client.",
        faq: [],
        blocages: [
          {
            situation: "La salle part en pause avant la synthèse.",
            parade:
              "Énoncer les deux acquis vous-même en trente secondes au retour de pause, en ouverture du module 4. L'ordre compte moins que l'ancrage.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 4 — La base de connaissances et ce qui part au client
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-4",
    objectif: {
      enonce:
        "À la fin de ce module, vous transformez vos réponses du matin en fiches de base de connaissances opposables, et vous n'envoyez aucune réponse qui n'ait passé les quatre contrôles.",
      objectifGlobalId: "obj-4",
      // Le module applique aussi la mention d'information et les règles sur ce
      // qui part au client — la confidentialité jusqu'à l'envoi.
      objectifsSecondairesIds: ["obj-5"],
      dureeMin: 5,
      notes: {
        script:
          "Le module s'ouvre sur le cadre, et c'est voulu : ce qui rend une fiche opposable — un motif et un seul, une réponse validée, une date de revue, un propriétaire nommé — se pose AVANT de produire quoi que ce soit, parce qu'un garde-fou ne protège que ce qui vient après lui. Tout ce que la salle écrira dans ce module se tiendra à ces quatre exigences, y compris la note au responsable. Annoncez les livrables : la note d'une page sur les causes racines, trois fiches de base de connaissances, et votre réponse la plus fréquente passée aux quatre contrôles — le référentiel complet.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "Avant envoi, le conseiller se relit « en diagonale » — c'est-à-dire qu'il vérifie le ton et rien d'autre. L'engagement non autorisé et la mention manquante passent, surtout à 17 h avec quarante tickets en attente.",
      apres:
        "La même réponse — produite le matin — passée aux quatre contrôles nommés, un par un, dans l'ordre : le fait, l'engagement, le ton, les mentions. L'outil relève, il ne réécrit pas ; la décision d'envoyer reste au conseiller.",
      prompt:
        "« Voici un brouillon de réponse client et, en dessous, le dossier sur lequel il s'appuie. Passe les quatre contrôles suivants, dans cet ordre, et rends un tableau à deux colonnes : contrôle, ce que tu relèves. 1. LE FAIT : chaque affirmation du brouillon est-elle établie par le dossier ? Cite le passage qui l'établit, ou signale-la comme non établie. 2. L'ENGAGEMENT : le brouillon annonce-t-il un délai, un remboursement, un geste commercial ou une garantie ? Liste-les tous, même s'ils te paraissent évidents. 3. LE TON : relève les formulations qui mettent en cause le client, un collègue ou un tiers. 4. LES MENTIONS : la mention d'information et la formule de clôture prévues sont-elles présentes et intactes ? Ne réécris pas le brouillon, relève seulement. »",
      outil: "Un seul outil, celui validé dans la salle (Claude ou ChatGPT selon le groupe).",
      captureEcran:
        "Le tableau des quatre contrôles rendu par l'outil, avec la ligne « engagement » entourée et le brouillon d'origine en regard.",
      verifieLe: VERIFIE_LE,
      dureeMin: 10,
      notes: {
        script:
          "Prenez une réponse réellement produite le matin, pas un exemple du kit : la salle doit reconnaître sa propre production. Dites les quatre contrôles dans l'ordre et faites-les répéter — le fait, l'engagement, le ton, les mentions. Un ordre qu'on récite est un ordre qu'on tient sous pression, à 17 h, avec quarante tickets en attente.",
        faq: [
          {
            question: "Le contrôle des quatre points, on ne peut pas le faire de tête ?",
            reponse:
              "Vous pouvez, et vous le ferez la plupart du temps. Le passer à l'outil sert aux dossiers longs et aux fins de journée — les deux moments où l'on rate un engagement.",
          },
        ],
        blocages: [
          {
            situation: "L'outil réécrit le brouillon au lieu de relever.",
            parade:
              "Relancer en ajoutant « ne produis aucune phrase de réponse, uniquement le tableau ». Et le dire à la salle : une consigne qui n'interdit pas explicitement se fait déborder.",
          },
        ],
        planB:
          "La sortie est imprimée dans le kit (datée). La démonstration se tient sur papier, les quatre contrôles se cochent au stylo sur le brouillon projeté ou distribué.",
      },
    },
    pratique: {
      consigne:
        "Trois temps, dans cet ordre, tous sur du matériel neutralisé. Un : ce que disent 200 demandes — regroupez le jeu de verbatims neutralisés fourni au kit en causes racines, cinq maximum, et écrivez la note d'une page au responsable. Deux : rédigez vos trois premières fiches de base de connaissances à partir de vos réponses du matin, en tenant les quatre exigences posées en ouverture du module — un motif et un seul, une réponse validée, une date de revue, un propriétaire nommé. Trois, l'atelier de clôture : appliquez les quatre contrôles à vos fiches et à votre réponse la plus fréquente, et posez-y la mention d'information du client vue le matin.",
      aEmporter:
        "La note d'une page sur les causes racines, trois fiches de base de connaissances datées et attribuées, et votre réponse la plus fréquente passée aux quatre contrôles — le référentiel complet, rangé et nommé.",
      dureeMin: 70,
      notes: {
        script:
          "Sur les verbatims, imposez la contrainte qui fait tout le travail : cinq causes racines maximum. Sans plafond, la salle produit trente catégories et n'en tire rien. Sur les fiches, tenez la règle du motif unique — une fiche qui traite deux motifs ne sera jamais retrouvée par la bonne recherche — et faites écrire le NOM d'un propriétaire, pas « le service ». Une fiche sans titulaire n'est pas maintenue. Le cadre a été posé AVANT l'atelier : ne le re-expliquez pas, exigez-le. Sur le dernier temps, faites appliquer les quatre contrôles dans l'ordre, à voix basse, en cochant : c'est la répétition qui installe le réflexe. Rappelez enfin la règle de la journée au démarrage de chaque temps : aucune donnée réelle de client ne part dans l'outil.",
        faq: [
          {
            question:
              "On nous demande de répondre aux avis en ligne. On peut faire pareil avec l'IA ?",
            reponse:
              "Le brouillon, oui, mais la trame publique est différente et elle est dans votre kit. Deux lignes n'y sont pas retirables : on ne confirme jamais qu'une personne est cliente, et on ne donne aucun élément de son dossier. Pour tout le reste, notez la question : je ne me prononce pas, votre conseil tranchera.",
          },
          {
            question: "On peut lui faire générer des témoignages clients pour le site ?",
            reponse:
              "Non. Jamais, sous aucune forme, même en exemple d'atelier. Un avis ou un témoignage qui n'a pas été écrit par un client est une pratique commerciale trompeuse. C'est la seule interdiction absolue de la journée.",
          },
          {
            question: "Qui doit tenir la base de connaissances ?",
            reponse:
              "Une personne nommée, pas une équipe. Elle relit les fiches à leur date de revue et refuse celles qui traitent deux motifs. Sans elle, la base a six mois d'espérance de vie.",
          },
        ],
        blocages: [
          {
            situation:
              "Les fiches produites recopient la réponse du matin telle quelle, sans motif.",
            parade:
              "Une question : « quelqu'un qui cherche cette fiche, il tape quoi ? ». Le motif s'écrit tout seul dans la minute qui suit.",
          },
          {
            situation:
              "Un stagiaire propose de coller dans une fiche un exemple tiré d'un dossier réel « pour être concret ».",
            parade:
              "Refuser en une phrase : une fiche de base de connaissances est lue par toute l'équipe, rien du dossier d'un client ne s'y range. L'exemple se neutralise sur la trame du module 1, comme le reste.",
          },
        ],
        planB:
          "Outil indisponible : les verbatims se regroupent à la main sur les fiches cartonnées du kit, la note d'une page s'écrit au stylo, les fiches de base de connaissances se rédigent sur la trame papier, et les quatre contrôles se cochent au stylo. Aucun des trois temps ne dépend réellement d'un accès IA, seule la vitesse change.",
      },
    },
    verification: {
      question:
        "Deux contrôles. Le premier, croisé : deux fiches par binôme passées à la grille — motif unique, réponse exacte et vérifiable, date de revue renseignée, propriétaire nommé. Le second, l'évaluation des acquis : quiz individuel de dix questions corrigé en salle, puis notation sur grille de trois productions du jour — une réponse type, une réclamation traitée, une fiche de base de connaissances.",
      reponseAttendue:
        "Sur les fiches, les quatre cases cochées ou l'écart nommé ; le corrigé montre les trois défauts qui reviennent — deux motifs dans une même fiche, une date de revue au conditionnel, un propriétaire écrit « le support ». Sur l'évaluation, le corrigé est commenté question par question sans en passer aucune, et la grille de notation est remplie pour chaque stagiaire. Le seuil de réussite est celui déclaré au programme ; un score en dessous déclenche la reprise individuelle prévue au dispositif.",
      dureeMin: 25,
      notes: {
        script:
          "C'est l'évaluation des acquis au sens de l'indicateur 11 : elle se tient, elle se corrige, elle se conserve. Ne la sacrifiez jamais au temps qui manque — c'est la première chose qu'un auditeur demande. Si vous êtes en retard, coupez sur le contrôle croisé des fiches, pas sur le quiz. Sur la notation des trois productions, notez pendant l'atelier précédent et pas après : à 17 h vous n'aurez plus le temps, et une grille remplie de mémoire ne vaut rien.",
        faq: [
          {
            question: "Ma note va être transmise à mon responsable ?",
            reponse:
              "Le résultat individuel ne l'est pas. Ce qui est transmis, c'est l'attestation de fin de formation et le fait que l'évaluation a eu lieu.",
          },
          {
            question: "On peut mettre « à revoir dans un an » comme date de revue ?",
            reponse:
              "Non, mettez une date. « Dans un an » ne déclenche rien ; le 3 septembre déclenche quelque chose.",
          },
        ],
        blocages: [
          {
            situation: "Il est 17 h 10 et le quiz n'est pas commencé.",
            parade:
              "Le tenir quand même, en réduisant le commentaire du corrigé aux trois questions les plus ratées. On ne remplace jamais l'évaluation par un tour de table.",
          },
          {
            situation: "Les binômes valident toutes les fiches sans relever un seul écart.",
            parade:
              "Projeter la fiche du kit, qui cumule les trois défauts, et faire relever collectivement. L'œil se règle en trois minutes.",
          },
        ],
        planB:
          "Quiz papier et corrigé imprimés dans le kit, grille de notation imprimée. Aucune dépendance à un outil.",
      },
    },
    synthese: {
      acquis: [
        "J'écris une fiche de base de connaissances opposable : un motif, une réponse validée, une date de revue, un propriétaire nommé.",
        "J'applique les quatre contrôles avant envoi — le fait, l'engagement, le ton, les mentions.",
        "Je sais ce qui ne part jamais au client : un engagement non autorisé, un élément de dossier dans une réponse publique, un contenu fabriqué.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Chacun nomme à voix haute TROIS usages qu'il installe dans l'équipe la semaine suivante, QUI les tient, et à quelle DATE. Faites désigner le propriétaire de la base devant tout le monde, et faites dire où le référentiel est rangé et comment on y ajoute une fiche : un dossier partagé sans chemin connu n'est pas un rangement. Notez au tableau, photographiez, envoyez au groupe. Sans nom et sans date, une feuille de route ne se réalise pas.",
        faq: [],
        blocages: [
          {
            situation: "Les engagements restent vagues : « on va s'y mettre progressivement ».",
            parade:
              "Reformuler en une question : « sur quel motif, et quel jour ? ». Ne pas passer au suivant tant que la réponse ne porte pas un nom et une date.",
          },
          {
            situation:
              "Personne ne veut être propriétaire de la base de connaissances devant son responsable.",
            parade:
              "Proposer un propriétaire par motif plutôt qu'un pour toute la base. Trois personnes acceptent toujours ce qu'une seule refuse.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },
];
