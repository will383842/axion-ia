/**
 * CONTENU RÉDIGÉ — « IA pour le juridique » (1 jour, 7 h, 4 modules).
 *
 * ## Le fil rouge
 *
 * Chacun repart avec UN dossier de cadrage IA remis à la direction, construit
 * pièce par pièce au fil des quatre modules : la grille de qualification des
 * documents (module 1), la grille de vigilance et la synthèse sous grille
 * (module 2), le document type et les articles de charte (module 3), la note
 * d'une page à la direction (module 4). Aucun module ne se suffit à lui-même,
 * et c'est voulu : l'ordre est l'enseignement.
 *
 * ## La posture, non négociable
 *
 * **Le formateur enseigne l'outil, jamais le droit.** Le public est juriste :
 * la salle connaît le droit mieux que le formateur, et la journée ne tient que
 * si c'est dit en ouverture. Toute question de fond se renvoie avec la formule
 * écrite, prononcée telle quelle : « je ne me prononce pas sur le fond — notez
 * le point, votre service tranchera avec votre conseil ».
 *
 * **Aucun élément de dossier réel ne sort.** Aucun contrat client, aucun nom de
 * partie, aucune pièce réelle n'est déposé dans un outil pendant la journée :
 * le kit fournit tout, et cette règle est elle-même un enseignement de la
 * formation. Un stagiaire qui ouvre une pièce réelle est arrêté, sans
 * discussion.
 *
 * **L'IA n'est jamais une source de droit.** Elle reformule un texte qu'on lui
 * FOURNIT, et l'on cite le texte qu'on a ouvert — jamais elle. Toute réponse
 * juridique non sourcée est présumée inventée. C'est la règle centrale de la
 * journée, et chaque module la fait travailler.
 *
 * ⚠️ Les références de textes citées dans les démonstrations et les corrigés
 * sont fournies au formateur SOURCÉES ET DATÉES dans le kit, et ne se citent
 * jamais de mémoire. Leur formulation reste à faire relire par le conseil de
 * l'organisme.
 */

import type { EnrichissementFormation } from "./types";

/** Date de dernière vérification des captures et sorties d'outils. */
const VERIFIE_LE = "2026-08-06";

export const IA_POUR_LE_JURIDIQUE: EnrichissementFormation = [
  // ───────────────────────────────────────────────────────────────────────────
  // Module 1 — Ce qu'on a le droit de soumettre, et à quel outil
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-1",
    objectif: {
      enonce:
        "À la fin de ce module, vous qualifiez tout document AVANT de l'ouvrir dans un outil — soumissible tel quel, après traitement, ou jamais — et vous tenez la formule de refus devant un collègue pressé.",
      objectifGlobalId: "obj-1",
      // Le second temps de l'atelier classe les cinq documents du jeu dans les
      // trois régimes et exige la justification écrite ; le contrôle croisé
      // fait nommer les deux verrous que l'anonymisation ne lève pas de la même
      // façon : c'est l'objectif 1.
      // Le premier temps lit les conditions d'utilisation de trois outils et
      // conclut le régime de chacun, ou son ambiguïté (objectif 2) — servi ici
      // et nulle part ailleurs.
      objectifsSecondairesIds: ["obj-2"],
      dureeMin: 5,
      notes: {
        script:
          "Posez la posture avant toute chose, et dites-la telle quelle : « vous connaissez le droit mieux que moi — mon métier aujourd'hui, c'est l'outil ; le vôtre, c'est le droit, et il le reste ». C'est ce qui rend la journée tenable devant des juristes. Annoncez ensuite les deux règles : aucun élément de dossier réel, aucun nom de partie ne sort dans un outil aujourd'hui — le kit fournit tout — et l'IA n'est jamais une source de droit, on y revient toute la journée. Terminez par le livrable : chacun repart avec son dossier de cadrage IA, remis pièce par pièce à la direction.",
        faq: [
          {
            question: "Vous allez nous dire ce qu'on a le droit de faire avec l'IA ?",
            reponse:
              "Non. Je vous montre comment l'outil traite ce qu'on lui confie et comment lire ses conditions d'utilisation. Ce que VOTRE service a le droit de faire, c'est vous et votre conseil qui le tranchez — et la journée vous outille précisément pour ça.",
          },
          {
            question: "On a signé des NDA avec presque tous nos clients, ça condamne l'outil ?",
            reponse:
              "Non — ça impose de qualifier chaque document avant de le soumettre, et c'est exactement l'objet du module. Un NDA condamne un document, pas l'outil.",
          },
        ],
        blocages: [
          {
            situation:
              "Un juriste teste le formateur sur un point de droit dès l'ouverture, pour situer le niveau.",
            parade:
              "Ne pas jouer : « je ne me prononce pas sur le fond — notez le point, votre service tranchera avec votre conseil ». Puis écrire la question au tableau : la liste des questions ouvertes est une production de la journée, et l'assumer d'emblée assoit la posture au lieu de la fragiliser.",
          },
        ],
        planB:
          "Aucun outil n'est nécessaire ici. Sans vidéoprojecteur, la posture, les deux règles et le livrable s'annoncent au paperboard sans rien perdre.",
      },
    },
    demonstration: {
      avant:
        "« Résume ce courrier et dis-moi quoi répondre. » La sortie mélange résumé, avis juridique et références que personne ne peut vérifier — précisément ce qu'on ne lui a pas demandé, et ce qu'un lecteur pressé prendrait pour une analyse.",
      apres:
        "La même demande structurée par les cinq leviers AXION, sur le courrier FACTICE du kit. La sortie s'en tient au document : les demandes, les délais, les pièces — et ce qui manque s'écrit « non précisé » au lieu de s'inventer.",
      prompt:
        "Acteur : tu es juriste d'entreprise dans une PME industrielle française.\nConteXte : je te fournis ci-dessous un courrier de mise en demeure FACTICE, issu d'un kit d'exercice ; aucune partie réelle n'y figure.\nIntention : préparer ma réponse — je veux voir d'un coup d'œil ce que l'expéditeur demande, sous quels délais, et ce qu'il faudrait réunir avant de répondre.\nOutput : trois listes à puces — demandes de l'expéditeur, délais invoqués, pièces à réunir — dans l'ordre du courrier, sans paragraphe.\nNormes : ne cite aucun texte de loi, ne qualifie pas juridiquement les faits, ne recommande aucune réponse, n'ajoute rien qui ne figure pas dans le courrier ; ce qui manque s'écrit « non précisé ».",
      outil: "Un seul outil, celui validé dans la salle (Claude ou ChatGPT selon le groupe).",
      captureEcran:
        "Les deux sorties côte à côte, avec surlignage de ce que la demande libre a produit en trop : un avis non demandé, deux références invérifiables, une qualification des faits.",
      verifieLe: VERIFIE_LE,
      dureeMin: 15,
      notes: {
        script:
          "Lancez d'abord la demande libre et lisez la sortie à voix haute, sans commentaire : laissez un juriste de la salle relever l'avis non demandé et les références invérifiables — c'est sa matière, pas la vôtre, et sa critique porte plus que la vôtre. Puis la version AXION. Écrivez AXION au tableau et laissez-le affiché toute la journée : Acteur, conteXte, Intention, Output, Normes. Insistez sur la ligne Normes : c'est elle qui interdit à l'outil de citer du droit et de qualifier les faits — chez un juriste, c'est la ligne qui décide de tout.",
        faq: [
          {
            question:
              "Pourquoi interdire à l'outil de citer des textes ? C'est ce qui nous serait le plus utile.",
            reponse:
              "Parce qu'il en invente, avec assurance et numérotation plausible. Une référence produite de mémoire par l'outil est présumée fausse tant que vous ne l'avez pas ouverte à la source. Le module 4 y est entièrement consacré — vous verrez une référence naître sous vos yeux.",
          },
          {
            question: "Ce prompt, on peut le réutiliser tel quel lundi ?",
            reponse:
              "Oui, il est dans votre support, les cinq lignes se remplacent une à une. À condition d'avoir d'abord qualifié le document — c'est l'atelier qui vient.",
          },
        ],
        blocages: [
          {
            situation:
              "La sortie libre est prudente : pas d'avis, pas de référence — la démonstration tombe à plat.",
            parade:
              "Relancer en ajoutant « cite les textes applicables et dis-moi si leur demande est fondée ». La contrainte force l'avis et les références, et le dérapage redevient visible. Si rien ne sort, passer au plan B.",
          },
          {
            situation:
              "Un stagiaire propose de refaire la démonstration avec un courrier reçu par son entreprise.",
            parade:
              "Refuser et redire la règle en une phrase : « aucune pièce réelle ne sort aujourd'hui — c'est précisément ce que la journée installe ». Le kit fournit un second courrier si la salle veut une variante.",
          },
        ],
        planB:
          "Quota atteint ou outil indisponible : les deux sorties sont imprimées dans le kit, datées. La comparaison se tient à l'identique sur papier — lecture à voix haute, relevé des dérapages à main levée. Ne rien improviser en direct : les sorties du kit ont été vérifiées.",
      },
    },
    pratique: {
      consigne:
        "Deux temps, chronométrés. D'abord, sur les extraits fournis des conditions d'utilisation de trois outils : surlignez les quatre clauses qui décident du régime d'usage — réutilisation des contenus pour l'entraînement, sous-traitance de données, localisation, durée de conservation — et concluez le régime de chaque outil. Ensuite, en binôme, sur la grille de qualification fournie : classez les cinq documents du jeu — NDA reçu, CGV, contrat client, mise en demeure, note interne — en soumissible tel quel, soumissible après traitement, ou jamais soumissible, et justifiez chaque réponse par écrit.",
      aEmporter:
        "La grille de qualification remplie et justifiée, plus la conclusion de régime des trois outils — première pièce du dossier de cadrage IA.",
      dureeMin: 40,
      notes: {
        script:
          "Les extraits de conditions d'utilisation sont FOURNIS dans le kit, datés — ne faites pas chercher en ligne : les pages changent, votre corrigé ne suivrait pas. Annoncez le chronomètre à voix haute à mi-parcours de chaque temps. Sur la qualification, exigez la justification écrite : c'est elle qui se relit au contrôle croisé, pas la case cochée — un classement juste mal justifié ne se défend pas devant une direction. Quand un binôme demande « et chez nous, on a le droit ? », formule exacte : « je ne me prononce pas — notez la question, votre service tranchera avec votre conseil ».",
        faq: [
          {
            question: "« Soumissible après traitement », ça veut dire anonymisé ?",
            reponse:
              "Pas seulement, et c'est le piège du matin : retirer les noms ne lève pas une clause de confidentialité — l'éditeur de l'outil reste un tiers tant qu'aucun engagement contractuel ne le lie. « Après traitement » peut vouloir dire : extrait limité, clause recopiée seule, ou passage dans l'environnement validé par votre DSI.",
          },
          {
            question: "Notre DSI a déjà validé un outil, cet exercice nous concerne encore ?",
            reponse:
              "Oui. La validation DSI vous donne le régime de l'outil, pas la qualification du document. Un document sous NDA ne va nulle part sans traitement, même dans l'outil validé.",
          },
        ],
        blocages: [
          {
            situation: "Un binôme finit la qualification en dix minutes.",
            parade:
              "Leur donner le sixième document du kit — les conclusions adverses reçues dans un contentieux en cours, le plus piégeux du jeu — et leur demander de préparer la restitution du groupe.",
          },
          {
            situation:
              "Un binôme reste bloqué sur le régime d'un outil, les extraits leur semblent contradictoires.",
            parade:
              "C'est voulu : un des trois extraits est ambigu. La conclusion attendue n'est pas un régime, c'est « ambigu — à trancher avec la DSI et le conseil ». Savoir conclure à l'ambiguïté EST la compétence visée.",
          },
        ],
        planB:
          "Aucun outil en jeu : les deux temps se font au surligneur et au stylo sur les extraits et la grille imprimés. Aucun repli nécessaire.",
      },
    },
    verification: {
      question:
        "Contrôle croisé entre binômes sur le corrigé fourni : les cinq qualifications attendues sont-elles retrouvées et justifiées ? Les deux pièges du jeu ont-ils été vus — le NDA qui interdit la communication à tout tiers, éditeur de l'outil compris, et la note interne nominative qui redevient une donnée personnelle ?",
      reponseAttendue:
        "Les cinq qualifications justifiées et les deux pièges nommés. Le corrigé est projeté après le contrôle croisé et les écarts se commentent en salle : un binôme qui a classé le NDA « soumissible après anonymisation » a manqué le second verrou — la clause vise le tiers, pas le nom.",
      dureeMin: 10,
      notes: {
        script:
          "Contrôle CROISÉ, pas auto-correction : chaque binôme relit celui d'à côté. Projetez le corrigé après, jamais avant. Commentez seulement les écarts qui se répètent — en général le NDA, parce que l'anonymisation rassure à tort. C'est le moment de refaire dire à la salle la différence entre les deux verrous : données personnelles d'un côté, confidentialité contractuelle de l'autre.",
        faq: [
          {
            question: "Ce corrigé, il a été validé par qui ?",
            reponse:
              "Par le conseil de l'organisme, et il est daté. C'est aussi la règle que vous emportez : une grille de qualification se fait valider, puis elle se date — la vôtre suivra le même chemin dans votre service.",
          },
        ],
        blocages: [
          {
            situation: "Les binômes se valident mutuellement sans rien relever.",
            parade:
              "Annoncer que chaque binôme doit remonter AU MOINS un écart ou une justification incomplète, et que vous en demanderez un à l'oral. La complaisance tombe immédiatement.",
          },
        ],
        planB:
          "Le corrigé est imprimé dans le kit. Sans vidéoprojecteur, il se distribue et se commente à l'oral.",
      },
    },
    synthese: {
      acquis: [
        "Je qualifie tout document avant de l'ouvrir dans un outil — et je justifie le classement par écrit.",
        "Je lis des conditions d'utilisation comme un contrat : quatre clauses décident du régime.",
        "Je sais ce que l'anonymisation ne règle pas : la clause de confidentialité vise le tiers, pas le nom.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites FORMULER, ne récitez pas : « en une phrase, qu'est-ce que vous ne soumettrez plus jamais tel quel à partir de demain ? ». Trois réponses suffisent. Annoncez la pause et la suite : on passe au contrat lui-même — le lire et le synthétiser sous VOTRE grille, pas celle de l'outil.",
        faq: [],
        blocages: [
          {
            situation: "Personne ne parle, la salle attend sa pause.",
            parade:
              "Ne pas insister : énoncer les trois acquis vous-même et libérer. Un acquis formulé à contrecœur ne s'ancre pas mieux.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 2 — Lire et synthétiser un contrat sous sa propre grille
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-2",
    objectif: {
      enonce:
        "À la fin de ce module, vous produisez une synthèse de contrat sous VOTRE grille de vigilance, chaque case appuyée sur une citation du texte — une synthèse qui prépare votre relecture, jamais qui la remplace.",
      objectifGlobalId: "obj-4",
      // La synthèse est produite sous la grille du stagiaire, chaque case
      // appuyée sur la phrase recopiée ou marquée « absente du contrat », après
      // le test de la dernière clause posé en démonstration : c'est
      // l'objectif 4.
      // Le premier temps de l'atelier construit la grille ordonnée et pondérée
      // selon la position type (objectif 3) ; le contrôle croisé cherche dans
      // la synthèse du binôme les quatre défauts et la question qui manque
      // (objectif 5).
      objectifsSecondairesIds: ["obj-3", "obj-5"],
      dureeMin: 5,
      notes: {
        script:
          "Posez la borne d'entrée avant tout : rien de ce qui sera produit ce matin ne remplace la lecture du contrat — l'outil oriente la relecture, il ne la garantit pas. Annoncez ensuite la matière : le jeu de contrats du kit sert à tout ; un stagiaire peut travailler sur un document dont il MAÎTRISE le régime, qualifié avec la grille du module 1 — c'est sa première réutilisation, dites-le explicitement.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "« Résume-moi ce contrat. » La sortie est fluide, hiérarchise d'elle-même et lisse les points durs — une clause limitative de responsabilité peut disparaître d'un résumé sans laisser de trace, et rien n'indique ce qui a été omis.",
      apres:
        "Le même contrat sous une grille imposée, ligne à ligne, chaque case appuyée sur la phrase recopiée du texte. Ce que le contrat ne prévoit pas devient visible : « absente du contrat » est une information, pas un vide.",
      prompt:
        "Remplis la grille ci-dessous à partir du SEUL contrat joint. N'évalue pas, ne conseille pas, ne complète pas : si une clause est absente, écris « absente du contrat ». Pour chaque ligne remplie, indique le numéro de l'article et recopie la phrase exacte sur laquelle tu t'appuies.\nGrille : objet et durée · responsabilité et plafonds · résiliation (motifs et préavis) · pénalités · exclusivité · force majeure · sous-traitance et données confiées · droit applicable et juridiction.\nTermine par la liste de ce que le contrat ne précise pas.",
      outil: "Un seul outil, celui validé dans la salle (Claude ou ChatGPT selon le groupe).",
      captureEcran:
        "Les deux sorties côte à côte : la synthèse libre avec ses points durs lissés surlignés, la grille avec ses citations d'articles et ses lignes « absente du contrat ».",
      verifieLe: VERIFIE_LE,
      dureeMin: 25,
      notes: {
        script:
          "Commencez par le dépôt, avant toute synthèse : montrez les trois causes d'échec — scan sans texte reconnu, document tronqué en silence, tableau désaligné — et leur parade, qui est sur le support. Le tronquage silencieux est le plus dangereux pour un juriste : donnez le test en dix secondes, « recopie la dernière clause du document », et faites-le adopter comme réflexe systématique. Ensuite seulement, la synthèse libre puis la grille, sur le contrat du kit. Terminez en posant la borne à voix haute : pour comparer deux versions d'un contrat, l'exhaustivité reste au comparateur du traitement de texte — l'IA oriente la relecture, le comparateur voit tout.",
        faq: [
          {
            question: "La grille cite l'article 12 — comment je sais que la citation est exacte ?",
            reponse:
              "Vous ouvrez l'article 12. La citation sert exactement à ça : elle rend la vérification instantanée. Une synthèse sans appui ne se vérifie qu'en relisant tout le contrat — autant dire jamais.",
          },
          {
            question: "Pourquoi ne pas demander directement les clauses à risque ?",
            reponse:
              "Parce que « à risque » dépend de votre position : côté client ou côté prestataire, la même clause change de sens. C'est votre grille qui porte votre position ; l'outil, lui, ne connaît que des généralités — c'est l'atelier qui suit.",
          },
        ],
        blocages: [
          {
            situation:
              "L'outil remplit une case pour une clause absente du contrat, malgré la consigne.",
            parade:
              "Montrez-le et gardez-le à l'écran : la grille réduit le risque, elle ne le supprime pas. La parade est dans la consigne elle-même — pas de phrase recopiée, pas de confiance. C'est la démonstration la plus utile du module, ne la cachez pas.",
          },
          {
            situation:
              "Le contrat de démonstration dépasse la taille acceptée par l'outil du jour.",
            parade:
              "Le kit fournit une version allégée du même contrat, paginée à l'identique. Basculer dessus sans commentaire — l'incident se signale seulement s'il sert : « voilà le document tronqué en silence dont je vous parlais ».",
          },
        ],
        planB:
          "Outil indisponible : les deux sorties sont imprimées dans le kit, datées, surlignage déjà appliqué. La comparaison ligne à ligne et le test de la dernière clause se montrent sur papier.",
      },
    },
    pratique: {
      consigne:
        "Deux temps. D'abord, chacun construit SA grille de points de vigilance à partir de sa position type — la liste de référence fournie s'ordonne, se pondère et se complète : responsabilité et plafonds, clause limitative de responsabilité, résiliation, pénalités, exclusivité, force majeure, prescription, sous-traitance de données. Ensuite, atelier chronométré : appliquez votre grille à un contrat du jeu fourni — ou à un document dont vous maîtrisez le régime de confidentialité, qualifié au module 1 — et produisez la synthèse sous grille plus la liste des questions à poser avant relecture.",
      aEmporter:
        "Votre grille de vigilance ordonnée et pondérée, une synthèse sous grille avec ses citations, et la liste des questions à poser — deuxième pièce du dossier de cadrage IA.",
      dureeMin: 50,
      notes: {
        script:
          "La grille se construit SANS outil, sur papier : c'est un acte de juriste, pas un prompt — dites-le, ça change le statut de l'exercice. Refusez la grille standard recopiée telle quelle : chacun ordonne selon SA position type — côté client, côté prestataire, bailleur, employeur — et raye ce qui ne le concerne pas. Au moment d'appliquer, la consigne de citation est obligatoire : chaque case porte sa phrase recopiée ou « absente du contrat ». Passez dans les rangs et relancez sur la liste de questions : c'est elle qui distingue une synthèse qui prépare d'un résumé qui endort.",
        faq: [
          {
            question: "Ma grille a quinze lignes, c'est trop ?",
            reponse:
              "Oui. Au-delà d'une dizaine, l'outil dilue et vous ne relisez plus vraiment les réponses. Pondérez : les cinq premières lignes sont celles qui vous font perdre un arbitrage si elles vous échappent.",
          },
          {
            question: "Je peux garder cette grille pour tous mes contrats ?",
            reponse:
              "Une grille par TYPE de contrat et par position. Celle d'aujourd'hui est la première ; elle se date, et elle se fait relire dans votre service — comme le corrigé de ce matin.",
          },
        ],
        blocages: [
          {
            situation:
              "Un stagiaire ouvre un contrat réel de son entreprise, non qualifié, « pour que ce soit utile ».",
            parade:
              "Arrêter immédiatement, sans négocier, et rappeler la règle en une phrase : la qualification du module 1 passe AVANT tout dépôt. C'est le seul point de la journée où l'on ne discute pas.",
          },
          {
            situation: "Un stagiaire a fini sa synthèse en avance.",
            parade:
              "Lui donner le deuxième contrat du jeu — le plus long — ou lui faire échanger sa grille avec son voisin : appliquer la grille d'un autre montre mieux que tout pourquoi la position dicte la grille.",
          },
        ],
        planB:
          "Outil indisponible : la grille se construit à la main — elle n'en dépend pas — et la synthèse s'exerce en annotant la sortie imprimée du kit. La liste de questions se rédige sur papier. La structure du geste est identique.",
      },
    },
    verification: {
      question:
        "Contrôle croisé en binôme sur la grille de relecture fournie : dans la synthèse de l'autre, cherchez la clause manquée, l'affirmation sans citation à l'appui, le point que la synthèse a lissé, et la question qui aurait dû être posée mais ne l'a pas été.",
      reponseAttendue:
        "Les quatre catégories passées en revue, écarts relevés au stylo sur la copie de l'autre. Le corrigé fourni montre le lissage le plus fréquent : la clause pénale reformulée en « des pénalités peuvent s'appliquer » — la reformulation qui adoucit est le défaut le plus difficile à voir.",
      dureeMin: 10,
      notes: {
        script:
          "Faites annoter physiquement, au stylo, sur la copie de l'autre. Le lissage ne se voit pas en relisant la synthèse seule : il se voit en comparant la case au texte source — exigez que chaque écart relevé cite l'article comparé. C'est le même geste que la règle de la journée, appliqué à la production d'un pair.",
        faq: [
          {
            question: "On note ? Ça compte ?",
            reponse:
              "On ne note pas ici. L'évaluation des acquis est en fin de journée, sur dix questions. Ceci sert à régler l'œil pendant qu'on peut encore corriger.",
          },
        ],
        blocages: [
          {
            situation: "Les copies reviennent vierges, rien n'est relevé.",
            parade:
              "Projeter la synthèse volontairement chargée du kit et chercher collectivement les quatre défauts. L'œil se règle en trois minutes, puis relancer le croisé sur les vraies copies.",
          },
        ],
        planB: "Grille de relecture et corrigé sont imprimés dans le kit. Aucun outil nécessaire.",
      },
    },
    synthese: {
      acquis: [
        "J'impose ma grille au lieu de subir la synthèse de l'outil.",
        "J'exige une citation à l'appui de chaque case — sans phrase recopiée, pas de confiance.",
        "Je renvoie l'exhaustivité au comparateur : l'IA oriente ma relecture, elle ne la remplace pas.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites nommer les pièces déjà au dossier : grille de qualification, grille de vigilance, synthèse citée, liste de questions. Le dossier existe à partir du moment où il se compte. Annoncez l'après-midi : produire ce qui se réutilise — documents types, veille tenable, et la réponse à la question que la direction finira par poser.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 3 — Documents types, et ce que la direction va vous demander
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-3",
    objectif: {
      enonce:
        "À la fin de ce module, vous produisez un document type réutilisable, vous ne faites de veille que sur un texte que vous fournissez, et vous savez quoi répondre quand la direction demande « qu'a-t-on le droit de faire avec l'IA ? ».",
      objectifGlobalId: "obj-6",
      // L'atelier produit le document type réutilisable, adapte les trois
      // articles de charte au vocabulaire de l'entreprise et coche la liste
      // d'opposabilité : c'est l'objectif 6.
      // Le deuxième temps interroge un texte réglementaire que le stagiaire
      // fournit lui-même, phrase d'appui exigée, et fait écrire la phrase de
      // refus (objectif 7) — servi ici et nulle part ailleurs.
      objectifsSecondairesIds: ["obj-7"],
      dureeMin: 5,
      notes: {
        script:
          "Annoncez le renversement de l'après-midi : ce matin vous avez protégé ce qui ENTRE dans l'outil, maintenant vous produisez ce qui en SORT — et vous préparez la réponse à la question qui arrivera de la direction. Le cadre réglementaire qui précède est FOURNI dans le kit, sourcé et daté : vous donnez les références et le texte, vous n'arbitrez rien — la salle qualifie, le service tranche. Redites-le au moment d'aborder l'annexe III : c'est là que la tentation d'arbitrer est la plus forte.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "« Que prévoit l'article 4 du règlement européen sur l'IA ? » L'outil répond de mémoire, avec assurance, en mélangeant le texte, des commentaires lus ailleurs et des obligations qui n'y figurent pas. Rien n'est daté, rien n'est vérifiable.",
      apres:
        "Le même article, copié depuis EUR-Lex et fourni au modèle. La réponse cesse de broder : elle reformule le texte qu'on lui a donné, cite sa phrase d'appui, et se vérifie en trois secondes — c'est le seul geste de veille tenable avec un outil généraliste.",
      prompt:
        "PROMPT A, de mémoire — « Que prévoit l'article 4 du règlement européen sur l'intelligence artificielle en matière de formation des équipes ? »\n\nPROMPT B, texte fourni — « Voici l'article 4 du règlement (UE) 2024/1689, copié depuis EUR-Lex, ci-dessous. En te limitant STRICTEMENT à ce texte, reformule en trois phrases l'obligation qu'il crée pour un employeur dont les équipes utilisent des systèmes d'IA. Recopie la phrase exacte sur laquelle tu t'appuies. Si le texte ne permet pas de répondre, dis-le et n'ajoute rien. »",
      outil: "Un seul outil, celui validé dans la salle (Claude ou ChatGPT selon le groupe).",
      captureEcran:
        "Les deux réponses côte à côte : les affirmations invérifiables de la première entourées, la citation exacte de la seconde surlignée, l'onglet EUR-Lex ouvert visible.",
      verifieLe: VERIFIE_LE,
      dureeMin: 10,
      notes: {
        script:
          "Lisez la première réponse à voix haute, avec assurance — la salle doit sentir à quel point elle est plausible, c'est le danger. Puis ouvrez EUR-Lex à l'écran, copiez l'article, refaites. Posez la règle telle quelle : l'IA n'est pas une source de droit — elle reformule un texte que VOUS avez ouvert, et c'est ce texte que vous citez, jamais elle. Donnez la version courte à afficher au service : « une référence n'existe que si vous l'avez ouverte à la source ».",
        faq: [
          {
            question: "Et les outils de veille juridique spécialisés qui intègrent de l'IA ?",
            reponse:
              "Ils sont adossés à des bases éditoriales — c'est un autre produit, avec un autre contrat. La journée porte sur les outils généralistes que vous avez déjà, et la règle du texte fourni reste la borne : ce qui compte est de toujours savoir d'où vient ce que vous lisez.",
          },
        ],
        blocages: [
          {
            situation: "La réponse de mémoire est correcte, la démonstration semble tomber à plat.",
            parade:
              "Le dire immédiatement : « elle est juste cette fois, et vous n'aviez aucun moyen de le savoir sans ouvrir le texte ». L'enseignement tient tout autant — c'est même sa forme la plus honnête.",
          },
        ],
        planB:
          "Les deux réponses sont imprimées dans le kit, datées, avec l'article source joint. La comparaison se tient sur papier, texte source en main — ce qui est exactement la règle enseignée.",
      },
    },
    pratique: {
      consigne:
        "Trois temps chronométrés. D'abord, produisez un document type réutilisable à partir de votre propre trame : mise en demeure, courrier de résiliation, réponse à réclamation, ou réponse à un NDA reçu — la trame de secours du kit sert à qui n'en a pas. Ensuite, interrogez et reformulez un texte réglementaire que VOUS fournissez, puis écrivez la phrase de refus à tenir pour toute demande de veille qui sort de ce cadre. Enfin, adaptez les trois articles de charte pré-rédigés au vocabulaire de votre entreprise — ce qui est permis, ce qui est interdit, qui tranche en cas de doute — et cochez dans la liste fournie ce qui reste à faire pour rendre la charte opposable.",
      aEmporter:
        "Un document type réutilisable en projet, la phrase de refus de veille, et trois articles de charte adaptés avec leur liste d'opposabilité cochée — troisième pièce du dossier de cadrage IA.",
      dureeMin: 50,
      notes: {
        script:
          "Sur le document type : l'en-tête « Projet — à faire valider par votre conseil avant diffusion » reste apparent et ne se retire pas, même pour un courrier que le stagiaire estime maîtriser — c'est la même mécanique que les trames RH, et elle ne se négocie pas. Sur la veille : le texte se fournit, il ne se cherche pas — un stagiaire qui fait chercher une référence à l'outil sort du cadre, et c'est l'occasion de lui faire écrire sa phrase de refus séance tenante. Sur la charte : seuls les mots s'adaptent, la structure des trois articles ne se réécrit pas, et vous n'arbitrez AUCUNE formulation — « je ne me prononce pas, notez le point, votre service tranchera ».",
        faq: [
          {
            question: "Notre entreprise n'a pas de charte IA — on peut diffuser celle-là lundi ?",
            reponse:
              "Non. Trois articles adaptés sont un point de départ pour votre direction, pas une charte adoptée. La liste d'opposabilité cochée vous dit précisément ce qui manque — consultation des représentants du personnel, dépôt, information des salariés — et c'est elle que vous remontez.",
          },
          {
            question: "La phrase de refus de veille, vous avez un exemple ?",
            reponse:
              "« Je ne fais pas de recherche de droit avec l'outil ; apportez-moi le texte, je vous aide à le lire. » Elle est sur le support — adaptez les mots, gardez la structure : pas de recherche, texte fourni, aide à la lecture.",
          },
        ],
        blocages: [
          {
            situation:
              "Un stagiaire fait chercher une jurisprudence à l'outil, « juste pour voir ce qu'il trouve ».",
            parade:
              "Arrêter, sans dramatiser : la règle vient d'être posée, la démonstration vient de montrer pourquoi. Lui faire écrire immédiatement sa phrase de refus — c'est l'exercice du deuxième temps, il vient de rencontrer son cas d'usage.",
          },
          {
            situation:
              "La salle veut débattre du fond d'un article de charte — « interdire ça n'a aucun sens chez nous ».",
            parade:
              "Ne pas trancher : « c'est exactement le débat à avoir — mais avec votre direction, pas avec moi ». Écrire le point au tableau, le faire reporter dans la rubrique « à trancher » de la note du module 4.",
          },
        ],
        planB:
          "Réseau tombé : le document type et les articles de charte se travaillent au stylo sur les trames papier ; la veille sur texte fourni se remplace par la lecture annotée de l'article imprimé du kit. La structure des trois gestes est identique — c'est la trame qui enseigne, pas l'outil.",
      },
    },
    verification: {
      question:
        "Contrôle croisé en binôme sur la grille fournie : dans les productions de l'autre, cherchez un article de charte non applicable en l'état, une interdiction invérifiable, une décision sans décideur nommé, et une action d'opposabilité oubliée.",
      reponseAttendue:
        "Les quatre défauts recherchés sur pièce, écarts relevés à l'oral. Le corrigé rappelle le plus fréquent : « il est interdit de soumettre des données sensibles » sans que personne ne sache qui vérifie ni comment — une interdiction sans contrôle nommé n'est pas applicable.",
      dureeMin: 10,
      notes: {
        script:
          "Le défaut à faire chercher en priorité est la décision sans décideur : chaque « qui tranche » doit porter une fonction nommée, pas « la direction » en général. Faites reformuler un exemple à l'oral — une charte se juge à sa capacité d'être appliquée un mardi matin par quelqu'un de précis.",
        faq: [],
        blocages: [
          {
            situation:
              "Un binôme défend son interdiction invérifiable : « on ne peut pas tout contrôler ».",
            parade:
              "D'accord — alors la formulation change : ce qui ne se contrôle pas s'écrit comme un engagement de déclaration, pas comme une interdiction. Faire réécrire la phrase en séance, c'est un geste de deux minutes.",
          },
        ],
        planB: "Grille et corrigé imprimés dans le kit. Aucun outil nécessaire.",
      },
    },
    synthese: {
      acquis: [
        "Je produis un document type réutilisable — en projet, validé avant toute diffusion.",
        "Je ne fais de veille que sur un texte que j'ai fourni, et je tiens la phrase de refus.",
        "Je sais quelles références citer quand la direction demande le fondement, et ce qui reste à faire pour rendre une charte opposable.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites compter les pièces du dossier à voix haute — il en manque une : la note à la direction, c'est le dernier module. Annoncez la pause et la suite en une phrase : « on va voir naître une référence inventée dans votre propre matière, et vous repartez avec le dossier assemblé ».",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 4 — Hallucinations, limites, et mise en service
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-4",
    objectif: {
      enonce:
        "À la fin de ce module, vous reconnaissez une référence inventée avant qu'elle ne sorte du service, et vous repartez avec un dossier de cadrage IA prêt à être remis à la direction.",
      objectifGlobalId: "obj-8",
      // La chasse à l'hallucination relève les trois références fausses et les
      // deux approximations d'une note juridique produite par l'IA, la
      // vérification les réécrit en formulation vérifiable en nommant la source
      // à ouvrir, et l'atelier rédige la note d'une page à la direction — ce
      // que le service fait, ne fait pas, ce qui reste à trancher :
      // c'est l'objectif 8.
      dureeMin: 5,
      notes: {
        script:
          "Annoncez le contrat du module : on va voir NAÎTRE une référence inventée, puis s'entraîner à la traquer — dans votre matière, sur des textes du kit. C'est le module où la salle est la plus forte, et c'est voulu : les juristes jugent le fond mieux que vous, votre rôle est de montrer le mécanisme. Dites-le tel quel — cette répartition des rôles est la posture de toute la journée, condensée.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "« Quel est le délai de prescription de l'action en garantie des vices cachés, et quel article le prévoit ? » L'outil répond avec un délai, un numéro d'article et une assurance parfaite. Cette salle est la seule qui peut juger la réponse en direct — et c'est ce qui rend la démonstration décisive.",
      apres:
        "La même question avec l'article fourni, copié depuis Légifrance. La réponse recopie sa phrase d'appui et s'arrête où le texte s'arrête : le délai et son point de départ deviennent précis au lieu de plausibles.",
      prompt:
        "PROMPT A, sans texte — « Quel est le délai de prescription applicable à une action en garantie des vices cachés, et quel article du Code civil le prévoit ? »\n\nPROMPT B, texte fourni — « Voici l'article 1648 du Code civil, copié depuis Légifrance, ci-dessous. En te limitant STRICTEMENT à ce texte, indique le délai qu'il fixe et son point de départ. Recopie la phrase exacte sur laquelle tu t'appuies. Si le texte ne suffit pas à répondre, dis-le et n'invente rien. »",
      outil: "Un seul outil, celui validé dans la salle (Claude ou ChatGPT selon le groupe).",
      captureEcran:
        "Les deux réponses côte à côte, la variable modifiée surlignée : rien n'a changé entre les deux prompts, sauf le texte fourni.",
      verifieLe: VERIFIE_LE,
      dureeMin: 10,
      notes: {
        script:
          "L'article du kit est fourni, sourcé et daté — vous ne le citez jamais de mémoire, et vous le DITES à la salle : c'est la règle en acte, appliquée par le formateur lui-même. Posez d'abord la question sans texte et laissez la salle juger la réponse : dans cette salle, quelqu'un SAIT — laissez-le parler avant vous, c'est la démonstration la plus forte de la journée. Puis fournissez le texte et refaites. Surlignez la variable : rien d'autre n'a changé que le texte fourni.",
        faq: [
          {
            question:
              "Pourquoi l'outil invente-t-il un article au lieu de dire qu'il ne sait pas ?",
            reponse:
              "Parce qu'il produit la suite la plus plausible, pas la plus vraie : un numéro d'article plausible est statistiquement facile, « je ne sais pas » ne l'est pas. C'est un mécanisme, pas une malveillance — et il ne se corrige pas, il se contourne : texte fourni, citation exigée.",
          },
        ],
        blocages: [
          {
            situation: "La réponse sans texte est correcte, article compris.",
            parade:
              "Le dire immédiatement : « elle est juste cette fois, et personne ici ne pouvait le garantir avant d'ouvrir le texte ». Puis montrer la réponse fausse archivée du kit, datée — la variabilité d'un jour à l'autre est l'argument le plus parlant pour un juriste.",
          },
        ],
        planB:
          "Les deux réponses sont imprimées dans le kit, datées, l'article source joint. Le contraste se montre sur papier, texte en main.",
      },
    },
    pratique: {
      consigne:
        "Deux temps. D'abord, chasse à l'hallucination chronométrée sur le texte fourni : une note juridique produite par l'IA, contenant trois références fausses et deux approximations plantées — surlignez ce que vous croyez faux, on compte les repérages à main levée avant le corrigé. Ensuite, assemblez votre dossier de cadrage IA — grille de qualification, grille de vigilance, document type, articles de charte, grille de relecture — et rédigez la note d'une page à la direction : ce que le service fait avec l'IA, ce qu'il ne fait pas, ce qui reste à trancher.",
      aEmporter:
        "Le dossier de cadrage IA complet et nommé, et la note d'une page à la direction — le livrable final de la journée.",
      dureeMin: 40,
      notes: {
        script:
          "Sur la chasse : comptez les repérages à main levée AVANT le corrigé et notez le score au tableau. La salle attrape les références grossières et manque les approximations — le chiffre affiché le montre mieux qu'un discours sur la vigilance. Les erreurs plantées du kit ont été validées et datées ; n'en improvisez jamais de nouvelles en direct. Sur la note : exigez les trois rubriques — fait, ne fait pas, à trancher — et un destinataire nommé. Reportez-y les points écrits au tableau depuis le matin : la note est l'endroit où la liste des questions ouvertes devient utile.",
        faq: [
          {
            question: "Les deux sujets à remonter à la direction, c'est quoi exactement ?",
            reponse:
              "Le régime d'usage à trancher — quel outil, avec quel engagement contractuel de l'éditeur — et la charte à faire adopter, avec sa liste d'opposabilité. Ce sont les deux premières lignes de votre rubrique « à trancher ».",
          },
          {
            question: "Ma note peut-elle dire que le service valide l'usage de l'IA ?",
            reponse:
              "Non — elle dit ce que le service FAIT, ce qu'il ne fait pas, et propose ce qui reste à trancher. La validation est une décision de direction ; votre note la prépare, elle ne la prend pas.",
          },
        ],
        blocages: [
          {
            situation: "La salle trouve les cinq erreurs en dix minutes et s'ennuie.",
            parade:
              "Le texte complémentaire du kit contient deux erreurs plus fines — dont une qui ne se voit qu'en ouvrant le texte source. C'est celle qui fait mouche : le doute ne suffit pas, il faut le geste d'ouverture.",
          },
          {
            situation:
              "Un stagiaire conteste une « erreur » du corrigé — le débat de fond s'installe.",
            parade:
              "Ne pas arbitrer : noter la contestation, l'adresser au conseil de l'organisme, et le dire à la salle — le corrigé obéit lui aussi à la règle de la source. Une contestation documentée améliore le kit ; un arbitrage improvisé du formateur détruirait la posture de la journée.",
          },
        ],
        planB:
          "Aucun outil nécessaire : la chasse se fait au surligneur sur le texte imprimé, l'assemblage et la note au stylo. C'est l'atelier le plus robuste de la journée — gardez-le complet même si tout le reste a été dégradé.",
      },
    },
    verification: {
      question:
        "Deux temps. D'abord, chacun réécrit une des cinq erreurs de la chasse en formulation vérifiable et nomme la source qu'il aurait dû ouvrir. Puis l'évaluation des acquis : quiz individuel de dix questions corrigé en salle, suivi de l'auto-évaluation d'une production du jour sur la grille de relecture.",
      reponseAttendue:
        "Une réécriture qui porte sa source pour chaque erreur reprise, et la règle prononcée : le périmètre du conseil ne se délègue pas, l'IA n'est jamais l'auteur d'une position du service. Le quiz est corrigé question par question ; le seuil de réussite est celui déclaré au programme, un score en dessous déclenche la reprise individuelle prévue au dispositif.",
      dureeMin: 25,
      notes: {
        script:
          "Les réécritures se lisent à VOIX HAUTE : une formulation vérifiable se reconnaît à l'oreille — elle porte une source et une date. Puis le quiz : c'est l'évaluation des acquis au sens de l'indicateur 11, elle se tient, se corrige et se conserve. Ne la sacrifiez jamais au temps qui manque — c'est la première chose qu'un auditeur demande. Si vous êtes en retard, coupez ailleurs.",
        faq: [
          {
            question: "Le résultat du quiz va être transmis à mon employeur ?",
            reponse:
              "Le résultat individuel ne l'est pas. Ce qui est transmis : l'attestation de fin de formation et le fait que l'évaluation a eu lieu.",
          },
        ],
        blocages: [
          {
            situation: "Il est 17 h 15, le quiz n'est pas commencé.",
            parade:
              "Le tenir quand même, en réduisant le commentaire du corrigé aux questions les plus ratées. On ne remplace jamais l'évaluation par un tour de table.",
          },
        ],
        planB: "Quiz papier et corrigé dans le kit. Aucune dépendance à un outil.",
      },
    },
    synthese: {
      acquis: [
        "J'installe trois usages dès la semaine suivante — sur documents qualifiés, sous ma grille, citation à l'appui.",
        "Je remonte les deux sujets à la direction : le régime d'usage à trancher, la charte à faire adopter.",
        "Je tiens la règle du service : une référence n'existe que si je l'ai ouverte à la source.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Chacun nomme à voix haute ses trois usages, le DESTINATAIRE de sa note à la direction, et la DATE à laquelle elle part. Sans nom et sans date, une note ne part pas. Notez au tableau, prenez une photo, envoyez-la au groupe — c'est la dernière trace de la journée, et la première de la mise en service.",
        faq: [],
        blocages: [
          {
            situation:
              "Les engagements restent vagues : « je vais essayer sur mes prochains contrats ».",
            parade:
              "Reformuler en une question : « sur quel dossier, et quel jour ? ». Ne pas passer au suivant tant que la réponse ne porte pas un objet et une date.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },
];
