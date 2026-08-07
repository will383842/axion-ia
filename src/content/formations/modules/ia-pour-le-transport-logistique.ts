/**
 * CONTENU RÉDIGÉ — « IA pour le transport et la logistique » (1 jour, 7 h, 4 modules).
 *
 * ## Le fil rouge
 *
 * Chacun repart avec UN classeur d'exploitation diffusable à son service,
 * construit pièce par pièce : le module 1 pose ce qui sort et ce qui ne sort
 * jamais, le module 2 produit les écrits de litige, le module 3 les écrits qui
 * accompagnent une tournée, le module 4 le suivi d'activité et l'assemblage.
 * L'ordre est l'enseignement : aucun module ne se suffit à lui-même.
 *
 * ## L'interdit structurant de la journée
 *
 * **L'assistant ne construit JAMAIS un plan de tournée, un chargement ni une
 * affectation de conducteur.** Temps de conduite et de repos, ADR, poids et
 * gabarits relèvent d'un texte réglementaire et d'outils métier — jamais d'une
 * génération. Une règle de sécurité ou de réglementation sociale se recopie
 * depuis le texte OUVERT à l'écran, jamais de mémoire et jamais depuis une
 * réponse d'assistant. C'est la borne que le formateur redit à chaque module,
 * et qu'il ne négocie pas.
 *
 * **Aucune donnée personnelle de conducteur n'entre dans un outil** — relevé de
 * temps de conduite nominatif, incident, suivi disciplinaire. Ni les données
 * clients, ni les tarifs négociés. Tout le matériel des ateliers vient du kit
 * ou est substitué avant dépôt.
 *
 * **Le formateur n'arbitre aucune question juridique ni réglementaire.** La
 * formule est écrite et se prononce telle quelle : « je ne me prononce pas,
 * notez la question, votre conseil tranchera ».
 *
 * ## Le rythme d'un bureau d'exploitation
 *
 * Le public passe peu de temps devant un écran et beaucoup au téléphone. La
 * DICTÉE et le DÉPÔT de document sont donc les deux gestes centraux de la
 * journée : personne, dans un bureau d'exploitation, ne tape un prompt de douze
 * lignes entre deux appels. Les ateliers sont calibrés pour être interrompus —
 * un exploitant appelé par son bureau reprend là où il s'était arrêté.
 *
 * ⚠️ Les références réglementaires citées dans les séquences de `cadre` sont
 * fournies au formateur SOURCÉES ET DATÉES dans le kit. Leur formulation reste
 * à faire relire par le conseil de l'organisme.
 */

import type { EnrichissementFormation } from "./types";

/** Date de dernière vérification des captures et sorties d'outils. */
const VERIFIE_LE = "2026-08-06";

export const IA_POUR_LE_TRANSPORT_LOGISTIQUE: EnrichissementFormation = [
  // ───────────────────────────────────────────────────────────────────────────
  // Module 1 — L'exploitation et l'IA : ce qui peut sortir, ce qui ne sort jamais
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-1",
    objectif: {
      enonce:
        "À la fin de ce module, vous classez n'importe quelle pièce de l'exploitation avant de la déposer — dans quel environnement, ou pas du tout — et vous traitez un dossier privé de son nom comme une donnée personnelle.",
      objectifGlobalId: "obj-5",
      dureeMin: 5,
      notes: {
        script:
          "Tour de table en UNE phrase, pas une par personne qui s'étale : « votre prénom, et l'écrit qui vous prend le plus de temps dans la semaine ». Notez chaque réponse au tableau, vous y reviendrez à 16 h. Annoncez la règle qui tient la journée : l'assistant rédige, l'exploitant tranche, le TMS et le texte réglementaire décident. Annoncez le livrable : chacun repart avec le classeur d'exploitation de son service.",
        faq: [
          {
            question: "On va enfin pouvoir faire optimiser nos tournées ?",
            reponse:
              "Non, et c'est la borne de la journée. L'ordonnancement reste dans votre TMS. Ce qu'on va faire est plus rentable et sans risque : tout ce qui s'écrit AUTOUR de la tournée, et qui vous prend vos soirées.",
          },
          {
            question: "Notre direction a bloqué ChatGPT, on fait quoi ?",
            reponse:
              "Exactement ce qu'on voit dans dix minutes : les trois régimes d'usage. Un blocage n'est pas une interdiction de l'IA, c'est un choix de régime. Notez le nom de l'outil validé chez vous, on travaillera avec.",
          },
        ],
        blocages: [
          {
            situation: "Le tour de table dérive en plaintes sur le TMS maison.",
            parade:
              "Couper avec : « on note, et on regarde à 16 h si l'assistant change quelque chose là-dessus » — puis écrire la plainte au tableau. La reprendre au module 4 fait beaucoup pour la crédibilité.",
          },
        ],
        planB:
          "Aucun outil n'est nécessaire ici. Vidéoprojecteur en panne, le tour de table et la règle du jour se tiennent au paperboard sans rien perdre.",
      },
    },
    demonstration: {
      avant:
        "Un conducteur appelle, on note trois lignes en vrac sur un coin de bureau, et la consigne repart au suivant avec une heure approximative et un contact incomplet. Plus tard, le même dossier d'incident est « anonymisé » en retirant les noms, et tout le monde considère qu'il est devenu neutre.",
      apres:
        "La note d'appel est DICTÉE au téléphone, quarante secondes en vrac, et ressort en consigne de livraison ordonnée où tout ce qui manque porte la mention « à confirmer ». Puis le dossier privé de ses noms est relu par la salle : trois questions suffisent à retrouver le conducteur, et la pièce redevient ce qu'elle n'avait jamais cessé d'être.",
      prompt:
        "PROMPT 1 — la note d'appel devient une consigne de livraison\nActeur : tu es exploitant transport dans une entreprise de vingt-cinq véhicules.\nConteXte : je te dicte au téléphone ce qu'un conducteur vient de me signaler, en vrac et sans ponctuation.\nIntention : produire la consigne de livraison à transmettre au conducteur suivant.\nOutput : dix lignes maximum, une information par ligne, dans cet ordre — lieu, créneau, contact sur place, contrainte de quai, marchandise, point de vigilance.\nNormes : n'ajoute aucune heure, aucune adresse et aucun numéro absents de ma dictée ; écris « à confirmer » partout où l'information manque ; ne propose aucun itinéraire et n'organise pas la tournée.\n\nPROMPT 2 — « retirer le nom n'anonymise pas »\nVoici un compte rendu d'incident de livraison. Réécris-le en retirant toute donnée personnelle : plus aucun nom, plus aucun matricule, plus aucune immatriculation. Conserve tout le reste du texte à l'identique.",
      outil: "Un seul outil, celui validé dans la salle (Claude ou ChatGPT selon le groupe).",
      captureEcran:
        "Deux captures : à gauche la consigne obtenue par dictée, avec les mentions « à confirmer » surlignées ; à droite le compte rendu prétendument anonymisé, avec la date, le lieu de livraison et la nature de la marchandise entourés en rouge.",
      verifieLe: VERIFIE_LE,
      dureeMin: 30,
      notes: {
        script:
          "Dictez vous-même, à voix haute et depuis votre téléphone, devant la salle — quarante secondes en vrac, avec les hésitations et les reprises. C'est le geste du métier, pas un exercice de saisie : personne dans un bureau d'exploitation ne tape un prompt de douze lignes entre deux appels. Affichez la sortie, puis faites chercher les « à confirmer » : ce sont eux qui prouvent que l'assistant n'a rien inventé. Enchaînez sur le PROMPT 2 sans commenter — lancez-le, affichez le résultat, et posez les trois questions à la salle : quel jour, quelle livraison, quelle marchandise. Laissez quelqu'un prononcer le prénom du conducteur. Ne le dites pas à sa place.",
        faq: [
          {
            question: "On peut vraiment dicter plutôt que taper ?",
            reponse:
              "Oui, et c'est le geste à retenir pour ce métier. La dictée du téléphone alimente l'assistant aussi bien qu'un clavier, et elle tient dans le rythme d'un bureau d'exploitation.",
          },
          {
            question: "Si on retire aussi la date et le lieu, c'est anonyme ?",
            reponse:
              "Il ne reste alors plus rien d'exploitable. C'est exactement le point : dans un service où chacun connaît les tournées, un dossier d'incident n'est pas anonymisable. Il se traite comme une donnée personnelle.",
          },
        ],
        blocages: [
          {
            situation:
              "La dictée ressort truffée d'erreurs de transcription sur les noms de communes et les immatriculations.",
            parade:
              "Ne corrigez pas en douce : montrez-les et faites-les corriger à la main devant la salle. Une transcription approximative sur un nom de commune est la première cause de consigne fausse, et c'est mieux appris ici que sur une tournée.",
          },
          {
            situation: "Un stagiaire propose de tester avec un vrai dossier de litige en cours.",
            parade:
              "Refuser sans négocier, en une phrase : « aucune pièce touchant un contentieux ne sort du service aujourd'hui ». C'est le seul point de la matinée qui ne se discute pas.",
          },
        ],
        planB:
          "Quota atteint ou réseau tombé : les deux sorties sont imprimées dans le kit formateur (pages 3 et 4, datées), avec la transcription de la note d'appel en regard. La démonstration se tient à l'identique — on lit la dictée à voix haute, on distribue les sorties, on pose les trois questions de ré-identification. Ne rien improviser en direct.",
      },
    },
    pratique: {
      consigne:
        "Par table, vingt minutes chronométrées : écrivez la liste rouge de VOTRE exploitation, ce qui ne part dans aucun assistant quel qu'il soit. Partez de la liste de référence du kit — tarifs et taux d'affrètement, contrats clients, données personnelles et positions des conducteurs, pièces touchant un contentieux en cours — ajoutez ce qui vous manque, barrez ce qui ne vous concerne pas, et nommez à la fin le cas que votre table n'a pas su trancher.",
      aEmporter:
        "La liste rouge de votre exploitation, signée de la table, avec son cas litigieux nommé — première page du classeur d'exploitation.",
      dureeMin: 20,
      notes: {
        script:
          "Ne les faites pas partir de la page blanche : la liste de référence est imprimée, elle se corrige, elle ne se réinvente pas. Vingt minutes ne suffisent qu'à cette condition. Annoncez le chrono toutes les cinq minutes à voix haute. Passez de table en table et posez une seule question quand ça bloque : « cette pièce, vous l'enverriez à un sous-traitant que vous ne connaissez pas ? ». Le cas litigieux est obligatoire — une table qui n'en trouve pas n'a pas cherché.",
        faq: [
          {
            question: "Les taux d'affrètement, c'est vraiment confidentiel ?",
            reponse:
              "C'est ce que vous avez négocié, et c'est ce qui fait votre marge. Ce n'est pas une donnée personnelle, c'est un secret d'affaires — et il ne se dépose pas plus qu'un contrat client.",
          },
          {
            question: "Et une lettre de voiture, je peux la faire résumer ?",
            reponse:
              "Elle porte le nom du destinataire et le détail de la marchandise. Dans un environnement validé par votre direction, oui ; sur un compte personnel, non. C'est précisément le tri qu'on vient de faire.",
          },
        ],
        blocages: [
          {
            situation: "Une table recopie la liste de référence mot pour mot sans rien y ajouter.",
            parade:
              "Leur demander de citer trois pièces qu'ils ont eues en main cette semaine, et de les placer. La liste se remplit toute seule à partir de là.",
          },
          {
            situation: "Le débat glisse sur « a-t-on le droit de géolocaliser nos conducteurs ? ».",
            parade:
              "Formule exacte, prononcée telle quelle : « je ne me prononce pas, notez la question, votre conseil tranchera ». Écrivez la question au tableau, elle sera reprise au module 4.",
          },
        ],
        planB:
          "L'atelier ne dépend d'aucun outil : la liste de référence est imprimée et se corrige au stylo. Aucun repli nécessaire.",
      },
    },
    verification: {
      question:
        "Dix pièces de l'exploitation projetées une par une — ordre de transport, contrat client, relevé de temps de conduite nominatif, cahier des charges d'appel d'offres, CMR, note d'incident, tableau de tarifs, réclamation client, fiche de données de sécurité, dossier de contentieux : pour chacune, écrivez individuellement « je la dépose, dans quel environnement, ou pas du tout ».",
      reponseAttendue:
        "Le corrigé du kit donne le classement attendu pour les dix pièces, avec les deux cas volontairement discutables — la CMR et le cahier des charges — signalés comme tels. C'est sur ces deux-là que se joue la correction en salle.",
      dureeMin: 10,
      notes: {
        script:
          "Réponse individuelle et ÉCRITE, pas à main levée : chacun s'engage sur sa copie avant d'entendre son voisin. Corrigez ensuite pièce par pièce, sans en sauter une seule. Sur les deux cas discutables, ne tranchez pas à leur place : donnez le critère — « qui figure nommément dedans, et à qui appartient l'information » — et laissez la salle conclure.",
        faq: [
          {
            question: "Ça compte comme évaluation ?",
            reponse:
              "Non. L'évaluation des acquis est le quiz de fin d'après-midi. Ceci sert à repérer ce qui coince pendant qu'on peut encore le corriger.",
          },
        ],
        blocages: [
          {
            situation: "La salle classe tout en « pas du tout » par prudence.",
            parade:
              "Rappeler ce que ça coûte : si rien ne peut être déposé, la journée n'a plus d'objet et le service n'aura rien gagné. Reprendre l'ordre de transport et la note d'incident, qui sont les deux cas les plus fréquents et les plus traitables.",
          },
        ],
        planB:
          "Pièces et corrigé sont imprimés dans le kit (pages 6 à 8). Sans vidéoprojecteur, ils se distribuent et se corrigent à l'oral, dans le même temps.",
      },
    },
    synthese: {
      acquis: [
        "Je classe chaque pièce de l'exploitation avant de la déposer : environnement autorisé, ou pas du tout.",
        "Je traite un dossier privé de son nom comme une donnée personnelle — un incident daté et localisé désigne son conducteur.",
        "Je dicte au lieu de taper, et j'exige un « à confirmer » partout où l'information manque.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites-les FORMULER, ne récitez pas : « en une phrase, qu'est-ce que vous ne déposerez plus à partir de lundi ? ». Trois réponses suffisent. Annoncez la pause et la suite : les litiges et les réserves, c'est-à-dire les écrits qui coûtent le plus cher quand ils sont mal faits.",
        faq: [],
        blocages: [
          {
            situation: "Il est l'heure de la pause et la salle décroche.",
            parade:
              "Ne pas insister : énoncer les trois acquis vous-même et libérer. Un acquis récité à contrecœur ne s'ancre pas mieux.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 2 — Litiges, réserves et réclamations clients
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-2",
    objectif: {
      enonce:
        "À la fin de ce module, vous produisez un courrier de réserve ou de réclamation qui expose les faits datés sans admettre de responsabilité, et vous supprimez tout délai que vous n'avez pas retrouvé au contrat.",
      objectifGlobalId: "obj-4",
      // L'atelier se tient sur pièces reconstituées dès qu'un dossier ne peut
      // pas sortir du service : la règle du module 1 s'applique ici en acte.
      objectifsSecondairesIds: ["obj-5"],
      dureeMin: 5,
      notes: {
        script:
          "Dites pourquoi on commence par là : le litige est l'écrit le plus coûteux de l'exploitation, celui qu'on rédige en urgence entre deux appels, et celui qu'on relit devant un assureur six mois plus tard. Meilleur rapport gain/risque de la journée, dites-le tel quel. Annoncez la règle du module : l'assistant rédige, l'exploitant tranche, le contrat fait foi.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "Une avarie signalée à 18 h 40, un courrier écrit dans la foulée entre deux appels. Il est long, il s'excuse, il cite de mémoire un délai de réclamation — et il concède par écrit ce que personne n'avait encore établi.",
      apres:
        "La même avarie dictée en quarante secondes, structurée par les cinq leviers AXION. Le courrier expose les faits datés, ne concède rien, et laisse visibles entre crochets les deux mentions que l'exploitant doit retrouver au contrat avant d'envoyer.",
      prompt:
        "Acteur : tu es exploitant transport et tu écris au nom de l'entreprise.\nConteXte : je te dicte les faits d'une avarie constatée à la livraison ; tout ce que je ne dicte pas n'existe pas.\nIntention : produire un courrier de réserve adressé au client, destiné à être relu puis envoyé par l'exploitant.\nOutput : une page maximum, les faits datés et horodatés en premier, une phrase par fait, puis la demande, puis la formule de clôture.\nNormes : n'admets aucune responsabilité, même implicitement ; n'écris aucune excuse ; ne cite aucun délai, aucun article et aucune clause — écris à la place « [délai à retrouver au contrat] » et je le remplirai moi-même ; n'ajoute aucun fait, aucune heure et aucun montant absents de ma dictée.",
      outil: "Un seul outil, celui validé dans la salle.",
      gain: { avant: "35 min", apres: "8 min" },
      captureEcran:
        "Les deux courriers côte à côte : à gauche l'improvisé, avec les trois formules d'excuse et le délai inventé entourés en rouge ; à droite le structuré, avec les crochets « [délai à retrouver au contrat] » surlignés.",
      verifieLe: VERIFIE_LE,
      dureeMin: 15,
      notes: {
        script:
          "Faites PARIER par écrit avant d'afficher : chacun note ce que le courrier improvisé concède sans le vouloir. Puis affichez et lisez à voix haute, lentement — les trois formules qui coûtent (« nous sommes désolés du désagrément », « nous reconnaissons que », « nous vous rembourserons ») s'entendent mieux qu'elles ne se lisent. Insistez sur la ligne Normes et sur les crochets : c'est le seul dispositif de la journée qui empêche l'assistant d'inventer une clause. Et redites la borne telle quelle : un délai, un article ou une règle se recopient depuis le document OUVERT à l'écran, jamais de mémoire et jamais depuis une réponse d'assistant.",
        faq: [
          {
            question: "Pourquoi lui interdire de citer le délai de réclamation ?",
            reponse:
              "Parce qu'il le remplira, plausiblement et faux. Un délai se recopie depuis le contrat que vous ouvrez, pas depuis une réponse d'assistant.",
          },
          {
            question: "Un courrier sans un mot d'excuse, ça ne passera pas auprès du client.",
            reponse:
              "La politesse n'est pas l'aveu. « Nous avons bien reçu votre signalement et nous l'instruisons » est courtois et ne concède rien. La formule est dans votre support.",
          },
        ],
        blocages: [
          {
            situation: "L'assistant cite quand même un délai malgré la ligne Normes.",
            parade:
              "Incident précieux : gardez-le à l'écran. Il prouve que la consigne réduit le risque sans le supprimer, et que la relecture humaine reste obligatoire. Ne le cachez pas, exploitez-le.",
          },
          {
            situation: "La salle veut savoir quel délai s'applique vraiment à son cas.",
            parade:
              "« Je ne me prononce pas, notez la question, votre conseil tranchera. » Écrire la question au tableau et passer, sans laisser le débat s'installer.",
          },
        ],
        planB:
          "Les deux courriers sont imprimés dans le kit (pages 11 et 12, datés), annotations déjà portées. La comparaison se tient à l'identique sur papier, et la dictée se lit à voix haute depuis la transcription fournie.",
      },
    },
    pratique: {
      consigne:
        "Deux temps chronométrés. Quarante-cinq minutes : chacun traite deux dossiers — une réserve à la livraison et un retard réclamé par le client — en dictant les faits depuis son téléphone, puis en structurant la demande avec les cinq leviers AXION. Travaillez sur vos dossiers si et seulement si aucune pièce ne quitte le service ; sinon, prenez les deux dossiers reconstitués du kit. Puis dix minutes, après le contrôle croisé : corrigez vos deux courriers d'après la grille et versez-les au classeur d'exploitation.",
      aEmporter:
        "Deux courriers relus et corrigés — une réserve, une réclamation de retard — plus la fiche mémo des cinq leviers AXION et des trois formules qui concèdent une responsabilité sans le dire. Deuxième versement au classeur d'exploitation.",
      dureeMin: 55,
      notes: {
        script:
          "Annoncez les trois causes d'échec AVANT que quiconque échoue : la dictée qui transcrit mal les noms de communes, la photo de CMR illisible, le courrier qui repart à trois pages. La parade de chacune est sur le support — un stagiaire prévenu vous appelle, un stagiaire surpris se referme pour la journée. Rappelez la règle des pièces au démarrage, pas seulement le matin : rien qui touche un contentieux en cours, aucun nom de conducteur. Passez dans les rangs, relancez sur AXION, ne rédigez à la place de personne. Les dix minutes de reprise ne sont pas du rab : c'est le seul moment où la correction s'écrit vraiment.",
        faq: [
          {
            question: "Je peux photographier la CMR et la faire résumer ?",
            reponse:
              "Dans l'environnement validé par votre direction, oui, et c'est un usage très rentable. Sur un compte personnel, non : elle porte le nom du destinataire et le détail de la marchandise.",
          },
          {
            question: "Ma dictée est hachée, il y a le bruit du quai derrière.",
            reponse:
              "Dictez par phrases courtes, une information par phrase, et relisez la transcription avant de lancer. C'est la parade n° 1 de votre support.",
          },
        ],
        blocages: [
          {
            situation: "Un stagiaire n'a aucun dossier de litige en cours.",
            parade:
              "Les deux dossiers reconstitués du kit (pages 14 et 15) sont faits pour lui. Ne le laissez pas regarder son voisin travailler pendant quarante-cinq minutes.",
          },
          {
            situation: "Un exploitant est appelé par son bureau et sort en pleine séance.",
            parade:
              "C'est le métier, ne le sanctionnez pas. À son retour, donnez-lui le plus court des deux dossiers et faites-lui sauter le second. Un atelier écourté vaut mieux qu'un atelier abandonné.",
          },
        ],
        planB:
          "Réseau tombé : l'atelier se tient à la main sur la trame papier, les cinq leviers s'appliquent à l'identique, et la dictée se remplace par des notes au stylo. Ce qui s'apprend ici est la structure de la demande et la liste de ce qu'on ne concède jamais — l'outil ne fait que l'exécuter.",
      },
    },
    verification: {
      question:
        "Contrôle croisé en binôme sur la grille fournie, appliquée aux deux courriers du voisin : chaque fait est-il daté et horodaté ? une responsabilité est-elle admise, même par une formule de politesse ? chaque délai, réserve ou clause cité se retrouve-t-il dans le contrat type fourni, ou l'assistant l'a-t-il inventé ? une donnée personnelle de conducteur a-t-elle été réintroduite ?",
      reponseAttendue:
        "Chaque affirmation non retrouvée au contrat est BARRÉE au stylo sur la copie du voisin. Le corrigé du kit liste les cinq mentions que l'assistant ajoute le plus souvent sans qu'on les lui demande : délai de réclamation, renvoi à un article, mention d'assurance, engagement de geste commercial, excuse.",
      dureeMin: 20,
      notes: {
        script:
          "Faites barrer physiquement, au stylo, sur la copie de l'autre. Le geste vaut le discours : un courrier rendu avec quatre phrases barrées se retient mieux qu'une consigne de vigilance. Exigez qu'au moins un écart remonte de chaque binôme et demandez-en un à l'oral, sinon les binômes se valident entre eux. Le contrat type est ouvert ou distribué : la vérification se fait EN L'OUVRANT, jamais de mémoire.",
        faq: [
          {
            question: "L'assistant a écrit un délai qui est juste, je le garde ?",
            reponse:
              "Vous venez de le VÉRIFIER dans le contrat, ce n'est donc plus l'assistant qui l'affirme. C'est toute la différence, et elle est entière.",
          },
        ],
        blocages: [
          {
            situation: "Les copies sont trop propres, rien n'est barré.",
            parade:
              "Projeter le courrier volontairement chargé du kit (page 17) et faire barrer collectivement. L'œil se règle en trois minutes.",
          },
          {
            situation: "Un binôme discute dix minutes de qui est responsable de l'avarie.",
            parade:
              "Couper : « ce n'est pas ce qu'on vérifie ici, et ce n'est pas à nous de trancher ». La grille porte sur l'écrit, pas sur le fond du dossier.",
          },
        ],
        planB:
          "Grille, contrat type et corrigé sont imprimés dans le kit. Aucun outil nécessaire pour tenir la séquence.",
      },
    },
    synthese: {
      acquis: [
        "Je fais rédiger le courrier par l'assistant, je tranche moi-même, et le contrat fait foi.",
        "Tout délai, article ou clause cité est retrouvé dans le contrat ouvert — ou supprimé du courrier.",
        "Je repère les trois formules de politesse qui concèdent une responsabilité sans le dire.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites nommer le fichier à voix haute : « classeur-exploitation-<service>-<date> ». Un classeur existe à partir du moment où il porte un nom. Annoncez l'après-midi en une phrase : les consignes de tournée, et ce que l'assistant ne construira jamais.",
        faq: [],
        blocages: [
          {
            situation:
              "Un stagiaire conclut « donc on peut envoyer directement, l'assistant écrit mieux que moi ».",
            parade:
              "Reprendre en une question : « qui signe ? ». La réponse ferme le module sans qu'il faille argumenter.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 3 — Consignes de tournée, documents et affrètement
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-3",
    objectif: {
      enonce:
        "À la fin de ce module, vous produisez les écrits qui accompagnent une tournée — instructions au conducteur, message au client, demande d'affrètement et relance — sans jamais laisser l'assistant construire la tournée ni rédiger un document réglementé.",
      objectifGlobalId: "obj-3",
      // Les consignes de tournée sont l'APPUI à la planification (obj-1) : le
      // TMS ordonnance, l'assistant écrit autour. La demande d'affrètement et
      // sa relance sont de la communication sous-traitants (obj-4).
      objectifsSecondairesIds: ["obj-1", "obj-4"],
      dureeMin: 5,
      notes: {
        script:
          "C'est le module où la salle attend « enfin la planification ». Coupez tout de suite, en une phrase : l'assistant ne construit aucune tournée, aucun chargement, aucune affectation de conducteur — ces décisions relèvent de votre TMS, du texte réglementaire et de vous. Annoncez la contrepartie dans la même respiration : tout ce qui s'écrit AUTOUR de la tournée, l'assistant le produit en quelques minutes, et c'est là que le temps se gagne. La chasse à l'erreur qui suit sert exactement à installer cette borne.",
        faq: [],
        blocages: [
          {
            situation:
              "Un participant annonce que son TMS « a déjà de l'IA » et que la question est réglée.",
            parade:
              "Bonne nouvelle et sujet différent : un optimiseur de tournées est un outil métier paramétré et testé, pas un assistant de rédaction. Le distinguer devant la salle vaut mieux que d'éviter la remarque.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "La même commande client recopiée trois fois : dans le message au conducteur, dans la confirmation au client, dans le courrier d'accompagnement. Trois saisies, trois occasions de se tromper d'heure — et c'est l'heure recopiée de travers qui fait revenir le camion à vide.",
      apres:
        "Une seule demande, la commande déposée telle quelle, trois sorties dans la même réponse. Chaque chiffre provient de la commande et ce qui manque ressort en « à confirmer » au lieu d'être inventé — l'exploitant n'a plus qu'à remonter les chiffres à leur source avant d'envoyer.",
      prompt:
        "Acteur : tu es exploitant transport et tu écris pour trois destinataires différents.\nConteXte : la commande client est jointe ; elle est la SEULE source d'information autorisée.\nIntention : produire les trois écrits qui accompagnent cette livraison.\nOutput : 1) les instructions au conducteur, dix lignes maximum, une information par ligne ; 2) le message de confirmation au client, cinq lignes ; 3) le courrier d'accompagnement du transport, une demi-page.\nNormes : n'invente aucune heure, aucune adresse, aucun contact et aucune référence — écris « à confirmer » partout où la commande ne dit rien ; ne propose aucun itinéraire, ne répartis aucun chargement, ne désigne aucun conducteur ; ne rédige ni lettre de voiture, ni déclaration de matière dangereuse, ni aucun document réglementé.",
      outil: "Un seul outil, celui validé dans la salle.",
      gain: { avant: "25 min", apres: "6 min" },
      captureEcran:
        "La commande d'origine à gauche, les trois sorties à droite, avec un trait reliant chaque heure et chaque adresse à sa ligne d'origine dans la commande — et les « à confirmer » surlignés.",
      verifieLe: VERIFIE_LE,
      dureeMin: 15,
      notes: {
        script:
          "DÉPOSEZ la commande devant la salle, ne la retapez pas : le dépôt de document est le second geste du métier après la dictée. Une fois les trois sorties affichées, faites REMONTER chaque chiffre à sa source — « cette heure de rendez-vous, elle vient d'où ? ». Tant qu'un chiffre n'est pas remonté à la commande, il ne part pas. Redites la borne posée à la chasse à l'erreur qui précède : les temps de conduite et de repos, les règles ADR, les poids et les gabarits se vérifient dans le texte ouvert et dans vos outils métier, jamais dans une réponse d'assistant.",
        faq: [
          {
            question: "Il peut me sortir la lettre de voiture dans la foulée ?",
            reponse:
              "Non, et c'est la borne du module : les documents réglementés restent hors de la génération assistée. Il peut en revanche vous résumer celle que vous lui donnez à lire.",
          },
          {
            question: "Si je lui donne les temps de conduite du conducteur, il peut vérifier ?",
            reponse:
              "Deux fois non : c'est une donnée personnelle, et c'est une règle qui se vérifie dans le texte réglementaire et dans les données du chronotachygraphe, pas dans une réponse d'assistant.",
          },
        ],
        blocages: [
          {
            situation: "L'assistant propose spontanément un ordre de livraison « optimisé ».",
            parade:
              "Le montrer, puis le supprimer devant la salle. C'est la meilleure démonstration possible de la borne du module : il le fera même quand on ne lui demande rien.",
          },
          {
            situation: "La commande déposée en PDF ressort illisible (scan sans texte reconnu).",
            parade:
              "Photographier la commande écran par écran plutôt que de déposer le scan, ou dicter les six lignes utiles. La parade est sur le support, page 23.",
          },
        ],
        planB:
          "La commande et les trois sorties sont imprimées dans le kit (pages 20 à 22, datées). Le traçage des chiffres jusqu'à la commande se fait au surligneur sur papier, et c'est même plus démonstratif qu'à l'écran.",
      },
    },
    pratique: {
      consigne:
        "Quarante minutes chronométrées, sur votre propre matière. Premier temps : produisez les consignes de votre tournée de demain à partir de la commande, sans demander à l'assistant de l'ordonner. Second temps : produisez une demande d'affrètement et la relance du sous-traitant qui n'a pas répondu. Avant tout dépôt, remplacez chaque nom de conducteur par « le conducteur » et chaque tarif négocié par « [tarif] ».",
      aEmporter:
        "Les consignes d'une tournée réelle, une demande d'affrètement et sa relance — trois écrits réutilisables tels quels dès la semaine suivante, versés au classeur d'exploitation.",
      dureeMin: 40,
      notes: {
        script:
          "Rappelez les deux substitutions AVANT le départ et écrivez-les au tableau : aucun nom de conducteur, aucun tarif négocié. C'est la règle du matin appliquée, et c'est le moment de la journée où elle se perd si vous ne la redites pas. Annoncez le chrono toutes les dix minutes. Sur l'affrètement, insistez sur la RELANCE : c'est l'écrit que personne n'envoie faute de temps, et celui qui rapporte le plus vite. Passez, relancez, ne rédigez à la place de personne.",
        faq: [
          {
            question: "Ma tournée de demain n'est pas encore arrêtée.",
            reponse:
              "Prenez celle d'hier, l'exercice est identique. Ou la commande de secours du kit, page 24.",
          },
          {
            question: "Je peux mettre le tarif si mon environnement est validé par ma direction ?",
            reponse:
              "C'est à votre direction de le dire, pas à moi. Aujourd'hui, en salle, on remplace : c'est la règle de l'atelier, et elle ne coûte rien.",
          },
        ],
        blocages: [
          {
            situation:
              "Un stagiaire demande à l'assistant d'ordonner ses quinze points de livraison.",
            parade:
              "L'arrêter et faire lire la sortie à voix haute : elle sera plausible et fausse, sans qu'il ait le moyen de le savoir. Puis rappeler qui ordonnance — le TMS, pas l'assistant.",
          },
          {
            situation: "Le réseau de la salle sature au moment des dépôts simultanés.",
            parade:
              "Faire démarrer par vagues de cinq. Annoncez-le comme une consigne d'atelier, jamais comme un incident.",
          },
        ],
        planB:
          "Réseau tombé : les trois écrits se rédigent sur les trames papier du kit, à partir de la commande de secours. La demande d'affrètement et sa relance sont les deux plus rentables — gardez-les même s'il faut sacrifier les consignes de tournée.",
      },
    },
    verification: {
      question:
        "Vérification croisée en binôme sur la checklist fournie : chaque heure, chaque adresse, chaque contact et chaque contrainte de quai figure-t-il dans la commande d'origine ? une mention contractuelle a-t-elle été inventée ? l'assistant a-t-il proposé un ordre de passage, réparti un chargement ou désigné un conducteur ? un temps de conduite est-il cité, et sur quelle source ?",
      reponseAttendue:
        "Tout chiffre non retrouvé dans la commande est surligné, puis corrigé ou remplacé par « à confirmer ». Le corrigé du kit montre les quatre invasions typiques : un créneau arrondi, un contact recopié d'une autre commande, une mention d'assurance ajoutée, un ordre de passage proposé sans qu'on l'ait demandé.",
      dureeMin: 15,
      notes: {
        script:
          "Checklist en main, commande d'origine posée à côté : la vérification confronte DEUX papiers, elle ne relit pas un écran. Faites surligner, pas cocher — une case cochée ne prouve rien. Sur les temps de conduite, la seule réponse acceptable est « je l'ai lu dans le texte ouvert » ou « je ne l'ai pas cité » ; « l'assistant me l'a dit » n'est pas une source, dites-le tel quel.",
        faq: [
          {
            question: "On n'a pas le temps de tout revérifier avant chaque tournée.",
            reponse:
              "Vous ne vérifiez pas tout : vous vérifiez les chiffres. Heures, adresses, contacts, contraintes de quai. Deux minutes, et c'est ce qui fait revenir un camion quand on l'omet.",
          },
        ],
        blocages: [
          {
            situation: "Un binôme valide tout en trois minutes.",
            parade:
              "Leur donner la sortie du kit page 26, qui contient les quatre invasions typiques. S'ils n'en trouvent aucune, refaire la lecture avec eux — l'œil n'est pas encore réglé.",
          },
        ],
        planB:
          "Checklist, commande de secours et corrigé sont imprimés dans le kit. Aucune dépendance à un outil.",
      },
    },
    synthese: {
      acquis: [
        "Le TMS ordonnance et le texte réglementaire tranche ; l'assistant rédige ce qui accompagne la tournée.",
        "Rien ne part au conducteur sans que chaque chiffre ait été retrouvé dans la commande.",
        "Je ne dépose ni nom de conducteur ni tarif négocié, même quand je suis pressé.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Trois acquis, prononcés par eux et pas par vous. Puis annoncez la pause et le dernier module en une phrase : le suivi d'activité, et la ligne qu'on ne franchit pas — on commente des indicateurs, on ne note personne.",
        faq: [],
        blocages: [
          {
            situation:
              "Un participant repart convaincu que « l'IA finira par faire les tournées ».",
            parade:
              "Ne pas argumenter sur l'avenir : « peut-être, et ce sera alors un outil métier paramétré et testé, pas un assistant de rédaction. Aujourd'hui, ce n'est pas le cas. »",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 4 — Suivi d'activité, personnes et classeur d'exploitation
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-4",
    objectif: {
      enonce:
        "À la fin de ce module, vous rédigez le commentaire de votre reporting d'exploitation à partir d'indicateurs déjà calculés par vos outils, sans jamais faire noter une personne, et vous repartez avec le classeur d'exploitation assemblé.",
      objectifGlobalId: "obj-2",
      // Le suivi d'activité est le point où la donnée personnelle de conducteur
      // revient par la fenêtre : la règle de confidentialité s'y rejoue en acte.
      objectifsSecondairesIds: ["obj-5"],
      dureeMin: 5,
      notes: {
        script:
          "Reprenez le tableau du matin — la liste rouge et les questions laissées ouvertes. Montrez ce que la journée a couvert ET ce qu'elle n'a pas couvert : l'honnêteté sur ce second point achète toute la crédibilité du reste. Annoncez le livrable de fin : à 17 h, chacun repart avec un classeur nommé et une feuille de route qui porte des noms et des dates.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "Le tableau des aléas de la semaine est donné à commenter tel quel, colonne des noms comprise. Le commentaire attribue les retards à des personnes, prend un ton de reproche, et devient une appréciation individuelle que personne n'avait demandée.",
      apres:
        "Le même tableau, colonne des noms retirée et remplacée par « tournée A, B, C ». Le commentaire porte sur les causes — attente à quai, créneau intenable, panne — et redevient un texte d'exploitation utilisable en réunion.",
      prompt:
        "PROMPT unique, lancé DEUX fois sur deux versions du même tableau : avec la colonne des noms, puis sans.\n« Voici le tableau des aléas de la semaine, joint. Commente-le en dix lignes maximum pour la direction. Porte le commentaire sur les causes et sur les tournées. N'ajoute aucun chiffre qui ne figure pas dans le tableau. Termine par les trois causes les plus fréquentes, dans l'ordre, avec leur nombre d'occurrences repris du tableau. »\n\nLes deux tableaux sont ceux du kit formateur et les noms qui y figurent sont FICTIFS. Aucun nom de conducteur réel n'est déposé pendant cette démonstration, ni pendant l'atelier qui suit.",
      outil: "Un seul outil, celui validé dans la salle.",
      captureEcran:
        "Les deux commentaires côte à côte, avec surlignage des passages du premier qui désignent une personne (« accumule les retards », « manque de rigueur ») et de ceux du second qui désignent une cause.",
      verifieLe: VERIFIE_LE,
      dureeMin: 10,
      notes: {
        script:
          "Dites AVANT de lancer que les noms du tableau sont fictifs, et dites pourquoi vous le précisez : un relevé nominatif d'aléas est une donnée personnelle, il ne se dépose pas, pas même pour une démonstration. Lancez la première version et lisez le commentaire à voix haute — le ton de reproche s'entend mieux qu'il ne se lit. Puis la seconde. Ne commentez pas trop, le contraste se suffit. Reliez à la séquence de cadre qui précède : le suivi et l'évaluation de la performance des travailleurs sont classés à haut risque par le règlement européen sur l'IA, et l'information préalable des salariés comme la consultation des représentants du personnel précèdent toute mise en service.",
        faq: [
          {
            question: "On n'a plus le droit de dire qu'un conducteur accumule les retards ?",
            reponse:
              "Vous avez le droit d'en parler, dans le cadre du management et avec lui. Ce qui n'a rien à faire là, c'est qu'un assistant le formule à partir d'un relevé nominatif que vous lui avez déposé.",
          },
          {
            question: "Et si on retire juste les noms du tableau ?",
            reponse:
              "Vous connaissez la réponse depuis ce matin : sur trois tournées, chacun sait qui conduisait. La parade n'est pas de masquer, elle est de commenter les causes.",
          },
        ],
        blocages: [
          {
            situation: "Le premier commentaire reste neutre et la démonstration tombe à plat.",
            parade:
              "Relancer en ajoutant « qui pose problème dans cette équipe ? ». La question fait ressortir l'appréciation individuelle immédiatement. Si cela ne suffit toujours pas, passer au plan B.",
          },
          {
            situation: "Un participant veut tester avec le vrai relevé de sa semaine.",
            parade:
              "Refuser sans négocier : c'est un relevé nominatif. Lui proposer de remplacer les noms par des lettres à la main AVANT toute chose, et seulement ensuite de travailler dessus.",
          },
        ],
        planB:
          "Les deux commentaires sont imprimés dans le kit (pages 29 et 30, datés), surlignage déjà porté. Lire le premier à voix haute reste l'essentiel de la démonstration : c'est le ton qui enseigne, pas l'écran.",
      },
    },
    pratique: {
      consigne:
        "Trois temps. Vingt-cinq minutes : rédigez la synthèse d'exploitation de votre semaine — taux de service, aléas, litiges — en version direction puis en version équipe, à partir des indicateurs DÉJÀ calculés par vos outils et sans aucun nom. Vingt minutes : assemblez le classeur d'exploitation — liste rouge, écrits du jour, grille de contrôle avant diffusion — en un document unique diffusable au service, et nommez la personne qui le tiendra à jour. Dix minutes : écrivez votre feuille de route — trois usages priorisés, qui les porte, et ce qui doit passer devant la direction et les représentants du personnel avant mise en service.",
      aEmporter:
        "La synthèse d'exploitation en deux versions, le classeur d'exploitation nommé et attribué à une personne, et la feuille de route datée avec ses trois usages et leurs porteurs.",
      dureeMin: 55,
      notes: {
        script:
          "Le chiffre ENTRE dans l'assistant, il n'en sort pas : les indicateurs viennent de vos outils, l'assistant écrit le commentaire autour. Redites-le au démarrage, c'est le contresens le plus fréquent de l'après-midi. Sur les deux versions, faites-les lire à voix haute côte à côte : la différence de ton s'entend. Sur le classeur, exigez un NOM de titulaire — un classeur sans titulaire n'est pas tenu. Sur la feuille de route, exigez une DATE : « la semaine prochaine » n'est pas une date.",
        faq: [
          {
            question: "Trois usages, c'est peu.",
            reponse:
              "C'est ce qui tient. Une feuille de route à dix lignes ne se réalise pas ; trois usages portés par des personnes nommées, si.",
          },
          {
            question: "Pourquoi une version direction et une version équipe ?",
            reponse:
              "Parce que ce ne sont pas les mêmes destinataires, et parce que c'est ce que l'assistant fait le mieux : décliner le même fond en deux tons, en quelques secondes.",
          },
        ],
        blocages: [
          {
            situation:
              "Un participant dépose son tableau de bord complet, colonne des noms comprise.",
            parade:
              "L'arrêter, faire supprimer la colonne, relancer. Puis le dire à la salle : c'est le réflexe qui se perd en dernier, et il se perd toujours au moment où on est pressé.",
          },
          {
            situation: "Un stagiaire refuse d'ouvrir un classeur, « c'est de la paperasse ».",
            parade:
              "Une question : « le jour où un client conteste un écrit sorti de votre service, avec quoi montrez-vous ce qui a été relu ? ». Ne pas argumenter davantage.",
          },
        ],
        planB:
          "Aucun outil nécessaire : la synthèse se rédige à la main sur la trame du kit, à partir des indicateurs apportés par les participants, et l'assemblage du classeur comme la feuille de route se font au stylo. C'est l'atelier le plus robuste de la journée — gardez-le complet même si tout le reste a été dégradé.",
      },
    },
    verification: {
      question:
        "Évaluation des acquis : quiz individuel de dix questions — les trois régimes d'usage, les pièces qui ne sortent jamais, ce que l'assistant ne construit jamais, la source d'une règle de temps de conduite, les mentions qu'un assistant invente dans un courrier de litige — puis correction commentée en salle, question par question.",
      reponseAttendue:
        "Le corrigé est commenté sans sauter aucune question. Le seuil de réussite est celui déclaré au programme ; un score en dessous déclenche la reprise individuelle prévue au dispositif.",
      dureeMin: 15,
      notes: {
        script:
          "C'est l'évaluation des acquis au sens de l'indicateur 11 : elle se tient, elle se corrige, elle se conserve. Ne la sacrifiez jamais au temps qui manque, c'est la première pièce qu'un auditeur demande — si vous êtes en retard, coupez ailleurs. Sur la question des temps de conduite, la seule réponse juste est « le texte réglementaire ouvert et l'outil métier » ; refusez « l'assistant », même formulé prudemment.",
        faq: [
          {
            question: "Le résultat sera transmis à mon employeur ?",
            reponse:
              "Le résultat individuel, non. Ce qui est transmis, c'est l'attestation de fin de formation et le fait que l'évaluation a bien eu lieu.",
          },
        ],
        blocages: [
          {
            situation: "Il est 16 h 50 et le quiz n'est pas commencé.",
            parade:
              "Le tenir quand même, en réduisant le commentaire du corrigé aux questions les plus ratées. On ne remplace jamais l'évaluation par un tour de table.",
          },
        ],
        planB:
          "Quiz papier dans le kit (page 33) et corrigé page 34. Aucune dépendance à un outil, aucune à un réseau.",
      },
    },
    synthese: {
      acquis: [
        "Je fais commenter des indicateurs déjà calculés par mes outils ; je ne fais noter aucune personne.",
        "Je tiens un classeur d'exploitation nommé, avec un titulaire et une grille de contrôle avant diffusion.",
        "Je fais informer les salariés et consulter leurs représentants avant toute mise en service d'un suivi.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Chacun nomme à voix haute ses trois usages, QUI les porte, et à quelle DATE le sujet passe devant la direction et les représentants du personnel. Sans nom et sans date, une feuille de route ne se réalise pas. Notez au tableau, photographiez, et envoyez la photo au groupe avant de quitter la salle.",
        faq: [],
        blocages: [
          {
            situation: "Les engagements restent vagues : « je vais essayer d'utiliser l'IA ».",
            parade:
              "Reformuler en une question : « sur quel écrit, et quel jour ? ». Ne pas passer au suivant tant que la réponse ne porte pas un nom et une date.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },
];
