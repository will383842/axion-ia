/**
 * CONTENU RÉDIGÉ — « IA pour bien commencer » (demi-journée, 4 h, 3 modules).
 *
 * ## Le public, avant tout
 *
 * C'est la formation d'entrée du catalogue : une partie de la salle n'a JAMAIS
 * ouvert un outil d'IA. Tout est écrit pour cette réalité — les scripts prévoient
 * la lenteur vraie (retrouver un mot de passe, taper son premier prompt à deux
 * doigts), et le blocage le plus fréquent n'est pas technique : c'est la peur de
 * « mal faire ». Les parades rassurent par le GESTE, jamais par le discours — on
 * fait constater qu'il n'y a rien à casser, on ne l'affirme pas.
 *
 * ## Le fil rouge
 *
 * Chacun repart avec UN feuillet personnel, rempli au fil de la demi-journée :
 * les preuves du module 1 (le compte de ses erreurs trouvées, le mot qui a fait
 * basculer la réponse), les demandes AXION testées du module 2 et du module 3,
 * et au verso la tâche par laquelle il commence lundi, avec le nom de la
 * personne à qui il posera ses questions.
 *
 * ## Trois règles que le formateur ne négocie pas
 *
 * **Un seul outil pour toute la demi-journée** — celui préparé avec l'entreprise
 * en amont. En 4 h, en changer une seule fois ferait perdre l'atelier aux
 * débutants : chaque bouton réappris est du temps de pratique en moins.
 *
 * **Aucune donnée personnelle réelle n'entre dans l'outil.** Rien de nominatif,
 * rien de confidentiel : les ateliers tournent sur les tâches réelles mais avec
 * des éléments remplacés par des marqueurs, et le kit fournit des documents de
 * secours.
 *
 * **Le formateur n'arbitre aucune question juridique.** La formule est écrite et
 * se prononce telle quelle : « je ne me prononce pas, notez la question, votre
 * conseil tranchera ».
 */

import type { EnrichissementFormation } from "./types";

/** Date de dernière vérification des captures et sorties d'outils. */
const VERIFIE_LE = "2026-08-06";

export const IA_POUR_BIEN_COMMENCER: EnrichissementFormation = [
  // ───────────────────────────────────────────────────────────────────────────
  // Module 1 — Ce que l'IA sait faire, et ce qu'on ne lui confie jamais
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-1",
    objectif: {
      enonce:
        "À la fin de ce module, vous décrivez en une phrase ce qu'une IA générative peut faire sur votre poste, vous citez trois informations que vous ne lui donnerez jamais, et vous savez qu'un seul mot changé dans une demande peut faire basculer la réponse.",
      objectifGlobalId: "obj-1",
      // La liste de ce qui ne sort jamais est posée au cadre, mais c'est la
      // vérification de ce module (huit situations « je peux / je ne peux
      // pas ») qui installe le réflexe de confidentialité.
      objectifsSecondairesIds: ["obj-5"],
      dureeMin: 3,
      notes: {
        script:
          "Trois minutes, pas de tour de table — il viendra plus tard, par le geste. Dites deux choses, dans cet ordre. Un : « personne ne touche au clavier avant l'atelier, et pendant l'atelier vous ne pouvez rien casser — on le vérifiera ensemble ». C'est LA phrase qui détend les débutants complets, dites-la mot pour mot. Deux : annoncez le feuillet — « à 13 h, vous repartez avec une feuille remplie de VOS demandes, testées sur VOTRE poste ». Montrez le feuillet vierge en le levant, ne le décrivez pas.",
        faq: [
          {
            question: "Je n'ai jamais utilisé ChatGPT, je vais pouvoir suivre ?",
            reponse:
              "Oui — la formation est construite pour vous. Le premier geste sur le clavier sera de recopier une demande déjà écrite sur votre support. On ne demande d'inventer à personne.",
          },
          {
            question: "L'IA va remplacer nos postes, c'est ça le message ?",
            reponse:
              "Non. Le message de la demi-journée tient en une phrase : l'IA prépare, l'humain décide. Vous verrez d'ailleurs dès la première heure tout ce qu'elle fait mal.",
          },
        ],
        blocages: [
          {
            situation:
              "Un participant annonce d'emblée qu'il est « nul en informatique » et se met en retrait.",
            parade:
              "Ne pas argumenter — lui donner un rôle : « vous serez notre vérificateur tout à l'heure, c'est le poste le plus important ». Le retrait vient de la peur d'être exposé ; un rôle annoncé la remplace.",
          },
        ],
        planB:
          "Aucun outil n'est nécessaire ici. Sans vidéoprojecteur, l'annonce se fait au paperboard et le feuillet circule de main en main.",
      },
    },
    demonstration: {
      avant:
        "« Rédige un message pour annoncer un changement d'organisation. » La sortie est fluide, bien écrite, et creuse : elle pourrait venir de n'importe quelle entreprise, et la salle la trouve d'abord « pas mal » — c'est le piège à montrer.",
      apres:
        "La même demande, enrichie du contexte réel, produit un message utilisable. Puis le geste du biais : on change UN SEUL mot dans une demande de portrait, et la réponse change de camp sous les yeux de la salle. La machine ne sait pas, elle prédit — et elle prédit à partir des mots qu'on lui donne.",
      prompt:
        "DEMANDE 1, nue — « Rédige un message pour annoncer un changement d'organisation. »\n\nDEMANDE 2, enrichie — « Rédige un message pour annoncer un changement d'organisation. Contexte : entreprise de 25 personnes, le service client passe de deux à trois équipes le mois prochain, personne ne perd son poste, les horaires ne changent pas. Le message sera lu à voix haute en réunion, il doit tenir en 30 secondes et se terminer par la date de la réunion questions-réponses du vendredi suivant. »\n\nLE GESTE DU BIAIS — « Rédige le portrait d'un chef d'équipe efficace. » puis, en ne changeant qu'UN SEUL mot : « Rédige le portrait d'une cheffe d'équipe efficace. »",
      outil:
        "Un seul outil pour toute la demi-journée — celui préparé avec l'entreprise en amont (Claude ou ChatGPT selon le groupe).",
      captureEcran:
        "Trois écrans : les deux messages côte à côte (le creux et le contextualisé), puis les deux portraits côte à côte avec surlignage des adjectifs qui ont changé de registre entre « chef » et « cheffe ».",
      verifieLe: VERIFIE_LE,
      dureeMin: 12,
      notes: {
        script:
          "Formateur seul au clavier, les deux demandes AFFICHÉES EN ENTIER — les stagiaires doivent voir qu'il n'y a aucun tour de magie, juste du texte. Lancez la demande nue, laissez la salle dire « pas mal » : ne corrigez pas, c'est le piège voulu. Lancez la version enrichie, faites nommer ce qui a changé. Puis le geste du biais : demandez à main levée « qui pense que la réponse sera identique ? » AVANT de changer le mot. Lisez les deux portraits à voix haute et laissez la salle repérer elle-même les adjectifs qui basculent. Ne concluez pas à leur place — quelqu'un le dira, et ce sera mieux dit.",
        faq: [
          {
            question: "Elle a écrit ça en dix secondes — où est le piège ?",
            reponse:
              "Le piège est que c'est plausible, pas vérifié. Vous le constaterez vous-même dans vingt minutes, sur votre propre domaine — et c'est vous qui compterez les erreurs.",
          },
          {
            question: "Le coup du portrait, c'est l'outil qui est sexiste ?",
            reponse:
              "L'outil prédit les mots les plus probables d'après tout ce qu'il a lu — y compris les clichés. Le biais entre par les mots de votre demande, c'est pour ça qu'on apprend à les choisir.",
          },
        ],
        blocages: [
          {
            situation: "Les deux portraits ressortent quasi identiques et le geste tombe à plat.",
            parade:
              "Relancer les deux demandes en ajoutant « en cinq adjectifs seulement ». La contrainte force l'outil à hiérarchiser et l'écart ressort. Si l'écart reste invisible, passer aux sorties imprimées du kit — ne jamais improviser un autre exemple en direct.",
          },
        ],
        planB:
          "Quota atteint ou service indisponible : les trois couples de sorties sont imprimés dans le kit formateur, datés. Le pari à main levée, la lecture à voix haute et le repérage des adjectifs se tiennent à l'identique sur papier.",
      },
    },
    pratique: {
      consigne:
        "Chasse à l'erreur et chasse au biais, chronométrées, chacun sur SON domaine. Premier temps : faites produire à l'IA un texte de dix lignes qui présente votre métier ou votre domaine — la demande est déjà écrite sur votre support, remplacez seulement le domaine. Surlignez tout ce qui est faux, inventé ou approximatif, et comptez : vous êtes le seul expert de votre sujet dans la salle. Deuxième temps : relancez la même demande en changeant UN seul mot, et notez sur votre feuillet ce qui a bougé dans la réponse.",
      aEmporter:
        "Le recto du feuillet commencé : le nombre d'erreurs trouvées sur son propre domaine et le mot qui a fait basculer la réponse — la preuve personnelle que l'IA se relit et se surveille.",
      dureeMin: 30,
      notes: {
        script:
          "C'est le premier contact clavier : budgétez dix minutes RIEN QUE pour la mise en route, c'est normal et c'est prévu — comptes à retrouver, mots de passe oubliés, première demande tapée à deux doigts. Annoncez-le pour dédramatiser : « les dix premières minutes servent à s'installer, personne n'est en retard ». Faites démarrer par vagues de cinq pour ne pas saturer le réseau. La demande modèle est sur le support : le premier geste est de la RECOPIER, pas d'inventer — un débutant qui recopie réussit, un débutant devant une page blanche se fige. Passez dans les rangs : celui qui n'a rien tapé après cinq minutes a un problème de connexion ou de peur, jamais d'intelligence — dans les deux cas, asseyez-vous trente secondes à côté de lui. À mi-parcours, annoncez le deuxième temps à voix haute : « changez UN mot, un seul, et regardez ».",
        faq: [
          {
            question: "Et si je fais une mauvaise manipulation ?",
            reponse:
              "Faisons-la ensemble tout de suite : effacez la conversation. Voilà — rien n'est cassé, on recommence. C'est la seule « mauvaise manipulation » possible, et elle ne coûte rien.",
          },
          {
            question: "L'IA n'a fait aucune erreur sur mon domaine, c'est bon signe ?",
            reponse:
              "Relisez les chiffres, les dates et les noms propres — c'est là qu'elle invente le plus volontiers. Si tout tient vraiment, tant mieux : mais vous venez de le VÉRIFIER, et c'est exactement le réflexe qu'on installe.",
          },
        ],
        blocages: [
          {
            situation: "Un participant ne retrouve pas son mot de passe et perd le fil.",
            parade:
              "Ne pas laisser la salle attendre : lui prêter un des comptes de secours du kit, préparés avant la session, et traiter la récupération du mot de passe à la pause. Cinq minutes de réinitialisation en direct tuent l'élan de l'atelier.",
          },
          {
            situation:
              "Un participant reste figé, n'ose pas lancer sa demande « de peur de mal faire ».",
            parade:
              "Ne pas le rassurer avec des mots — avec un geste : tapez VOUS-MÊME une demande volontairement ratée sur son clavier (« bonjour machine explique mon métier »), lancez-la, et montrez que l'outil répond quand même. La peur tombe quand il a vu une demande ratée ne rien casser.",
          },
          {
            situation: "Un participant veut coller un document interne « pour tester en vrai ».",
            parade:
              "Arrêter en une phrase : « rien de nominatif ni de confidentiel aujourd'hui — c'est la liste qu'on vient de voir, et l'atelier marche sans ». Le module 2 lui donnera un cadre pour déposer un document non sensible.",
          },
        ],
        planB:
          "Outil ou réseau indisponible : le kit fournit trois textes pré-générés avec erreurs plantées (dont un par grande famille de métiers) et les deux portraits imprimés. La chasse se fait au surligneur, le compte à main levée — l'exercice perd le domaine personnel mais garde tout son enseignement.",
      },
    },
    verification: {
      question:
        "Vérification corrigée en salle : huit situations « je peux le soumettre / je ne peux pas » (liste fournie — un CV reçu, une fiche produit publique, un échange client nominatif, un chiffre non publié…), tranchées une par une à main levée. Puis deux questions sur la chasse au biais : quel mot avez-vous changé, et qu'est-ce qui a bougé dans la réponse ?",
      reponseAttendue:
        "Les huit situations tranchées avec la règle qui tranche à chaque fois — nominatif ou confidentiel ne sort jamais, retirer le nom ne suffit pas. Les corrigés sont fournis au kit. Sur le biais : chacun cite son mot et l'effet constaté — la formulation exacte importe moins que le lien de cause à effet.",
      dureeMin: 10,
      notes: {
        script:
          "Vote à main levée situation par situation, AVANT de donner le corrigé — l'engagement du vote fait la mémorisation. Sur les deux ou trois situations qui divisent la salle, faites défendre chaque camp en une phrase avant de trancher. Si une question dérive vers « et légalement, chez nous, on a le droit de… ? », formule exacte : « je ne me prononce pas, notez la question, votre conseil tranchera » — et notez-la au tableau.",
        faq: [
          {
            question:
              "On a un compte d'entreprise avec engagement de non-réutilisation, tout devient permis ?",
            reponse:
              "Non — le régime change ce que l'outil a le droit de faire de vos données, pas la liste de ce qui ne sort jamais. Le nominatif et le confidentiel restent dehors tant que votre entreprise n'a pas dit le contraire par écrit.",
          },
        ],
        blocages: [
          {
            situation: "La salle vote tout en « je ne peux pas », par prudence excessive.",
            parade:
              "Montrer le coût de l'excès : « si tout est interdit, vous ne vous servirez jamais de l'outil, et quelqu'un d'autre le fera sans règles ». Reprendre la fiche produit publique et faire dire POURQUOI elle peut être soumise.",
          },
        ],
        planB:
          "La liste des huit situations et son corrigé sont imprimés dans le kit. Sans vidéoprojecteur, lecture à voix haute et vote à main levée — rien ne change.",
      },
    },
    synthese: {
      acquis: [
        "Je repère une affirmation inventée : chiffres, dates et noms se vérifient avant de faire confiance au texte.",
        "J'applique la liste de ce qui ne sort jamais avant de soumettre quoi que ce soit — et je sais que retirer le nom ne suffit pas.",
        "Je nomme le régime d'usage en vigueur chez moi, et je sais à qui poser la question si je l'ignore.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites formuler, ne récitez pas : « qu'est-ce que vous vérifierez systématiquement à partir de maintenant ? » — deux ou trois réponses suffisent. Annoncez la pause (quinze minutes, montre en main) et la suite en une phrase : « au retour, on apprend à formuler pour obtenir du premier coup ce que vous avez mis trois essais à obtenir ». Profitez de la pause pour régler discrètement les problèmes de connexion repérés pendant l'atelier — c'est le vrai usage de ces quinze minutes.",
        faq: [],
        blocages: [
          {
            situation: "Personne ne répond, la salle attend la pause.",
            parade:
              "Ne pas insister : énoncer les trois acquis vous-même en dix secondes et libérer. Un acquis arraché ne s'ancre pas mieux.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 2 — Formuler sa demande : la méthode AXION
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-2",
    objectif: {
      enonce:
        "À la fin de ce module, vous transformez une demande vague en demande structurée par les cinq leviers AXION, et vous obtenez un texte utilisable dès le premier ou le deuxième essai.",
      objectifGlobalId: "obj-3",
      dureeMin: 3,
      notes: {
        script:
          "Reprenez ce que la salle a vécu avant la pause : la demande nue donnait du creux, la demande enrichie donnait de l'utilisable. Annoncez que la différence entre les deux tient en cinq lettres, et écrivez AXION au tableau — il y restera jusqu'à 13 h. Une phrase de cadrage pour les débutants : « il n'y a pas de demande ratée, il y a des demandes incomplètes — et on va apprendre à voir ce qui leur manque ».",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "« Écris un message pour que les gens utilisent le nouveau tableau de réservation. » La sortie est un message générique, vaguement moralisateur, que personne n'enverrait tel quel — et surtout, on ne sait pas quoi lui reprocher précisément.",
      apres:
        "Le même besoin passé par les cinq leviers AXION : Acteur, conteXte, Intention, Output, Normes. La sortie est envoyable presque telle quelle, et chaque ligne de la demande explique un choix visible du résultat — la salle voit POURQUOI ça marche.",
      prompt:
        "Acteur : tu es un collaborateur d'une PME de 20 personnes, sans fonction d'encadrement — tu écris à des collègues, pas à des subordonnés.\nConteXte : la salle de réunion se réserve depuis lundi sur un tableau partagé ; la moitié de l'équipe continue de réserver par e-mail et deux réunions se sont retrouvées en double cette semaine.\nIntention : que chacun passe au tableau dès cette semaine, sans que personne ne se sente accusé.\nOutput : un message pour la messagerie interne, 120 mots maximum, ton simple et direct, qui se termine par l'endroit où trouver le tableau.\nNormes : pas de reproche, aucun nom de personne, et n'invente rien sur les horaires ou les salles — je vérifierai moi-même les informations pratiques avant l'envoi.",
      outil:
        "Un seul outil pour toute la demi-journée — celui préparé avec l'entreprise en amont (Claude ou ChatGPT selon le groupe).",
      captureEcran:
        "Les deux sorties côte à côte, la demande AXION affichée en marge avec les cinq leviers annotés d'une couleur chacun, et des flèches reliant chaque levier à son effet visible dans le texte produit.",
      verifieLe: VERIFIE_LE,
      dureeMin: 12,
      notes: {
        script:
          "Déroulez les cinq leviers UN PAR UN en les écrivant sous AXION au tableau : Acteur — à qui l'outil doit ressembler ; conteXte — ce qu'il ignore de votre situation ; Intention — ce que le texte doit produire chez le lecteur ; Output — format, longueur, ton ; Normes — ce qui est interdit ou à ne pas inventer. Lancez d'abord la demande vague, laissez la salle chercher quoi reprocher au résultat — c'est difficile, et c'est le point : sans structure, on ne sait même pas dire ce qui manque. Puis la version AXION, et reliez à voix haute chaque levier à son effet dans la sortie. Insistez sur Normes : c'est le levier que les débutants oublient toujours, et c'est celui qui empêche l'outil d'inventer.",
        faq: [
          {
            question: "Il faut vraiment écrire les cinq lignes à chaque fois ?",
            reponse:
              "Au début, oui — la trame du support est faite pour ça, on remplit ligne par ligne. Avec l'habitude, les cinq leviers deviennent un réflexe mental et trois suffisent souvent. Mais quand un résultat déçoit, revenez aux cinq : le levier manquant saute aux yeux.",
          },
          {
            question:
              "Pourquoi « je vérifierai moi-même » dans la demande ? L'outil ne peut pas vérifier ?",
            reponse:
              "Non — il ne connaît ni vos salles ni vos horaires, et si vous le laissez faire, il les inventera de façon plausible. Ce que vous n'avez pas vérifié, vous ne le laissez pas écrire : c'est la règle du module 1 qui continue.",
          },
        ],
        blocages: [
          {
            situation: "La sortie AXION déçoit — plate ou à côté du ton attendu.",
            parade:
              "Ne pas s'excuser ni relancer en cachette : montrer le geste de la relance — « on ajoute UNE précision dans Output, “plus chaleureux”, et on relance ». La correction en direct enseigne plus que la démonstration parfaite.",
          },
        ],
        planB:
          "Les deux sorties sont imprimées dans le kit, datées, avec les cinq leviers annotés. La comparaison et le rattachement levier → effet se font à l'identique sur papier.",
      },
    },
    pratique: {
      consigne:
        "Deux temps. D'abord, déposer un document et travailler dessus : chacun dépose un fichier NON SENSIBLE (PDF, export, photo d'une page — le support en fournit un si vous n'en avez pas) et demande à l'IA de le résumer en cinq points ; les trois échecs classiques — scan sans texte reconnu, fichier trop lourd, tableau désaligné — se constatent et se contournent en direct. Ensuite, la pratique chronométrée : écrivez votre demande AXION sur une tâche de VOTRE poste en remplissant la trame ligne par ligne, lancez-la, puis relancez UNE fois en ajoutant une seule précision au lieu de tout recommencer — et recopiez sur votre feuillet la version qui marche.",
      aEmporter:
        "Sa première demande AXION écrite, testée et relancée sur une tâche de son poste, recopiée sur le feuillet, plus la fiche mémo des cinq leviers.",
      dureeMin: 40,
      notes: {
        script:
          "Le dépôt de fichier est le geste le plus lent de la demi-journée pour un débutant : montrez UNE FOIS au projecteur où se trouve le trombone et le glisser-déposer, puis faites déposer par vagues de cinq. Annoncez les trois échecs AVANT qu'ils n'arrivent — prévenus, ils vous appellent ; surpris, ils se referment. Au passage à la trame AXION : le premier réflexe des débutants est de tout écrire dans une seule ligne — renvoyez à la trame, une ligne par levier, et rappelez « il n'y a pas de demande ratée, il y a des demandes incomplètes ». Sur la relance : interdisez de tout réécrire — le geste à installer est UNE précision ajoutée, pas une page blanche. Vous ne rédigez à la place de personne : vous pointez le levier vide, c'est tout.",
        faq: [
          {
            question: "Je peux déposer un document de mon entreprise ?",
            reponse:
              "Oui, s'il ne contient rien de nominatif ni de confidentiel — c'est la liste du module 1. Une plaquette, une notice, un mode opératoire général conviennent. Dans le doute, prenez le document de secours du support.",
          },
          {
            question: "Ma photo de page ressort illisible, c'est fichu ?",
            reponse:
              "Non — c'est l'échec n° 1, et sa parade est sur votre support : recadrez plus près, ou photographiez la page en deux moitiés et demandez à l'outil de recoller le texte.",
          },
        ],
        blocages: [
          {
            situation: "Un participant n'a aucun fichier non sensible sous la main.",
            parade:
              "Le support fournit un document de secours (une notice produit fictive). Ne le laissez pas regarder son voisin travailler : le dépôt est un geste, il s'apprend en le faisant.",
          },
          {
            situation: "Un participant a fini sa demande AXION en dix minutes et s'ennuie.",
            parade:
              "Lui faire jouer la panne : « retirez la ligne conteXte, relancez, et comparez ». Constater soi-même ce qu'un levier absent coûte au résultat vaut tous les discours — et il restituera volontiers à la vérification.",
          },
          {
            situation: "Le réseau sature au moment des dépôts simultanés.",
            parade:
              "Basculer la moitié de la salle sur la trame AXION en attendant sa vague de dépôt — l'ordre des deux temps peut s'inverser par table sans rien perdre.",
          },
        ],
        planB:
          "Réseau ou outil tombé : le dépôt se démontre sur les captures imprimées du kit (les trois échecs y figurent), et la demande AXION s'écrit à la main sur la trame papier — c'est la structure qui s'apprend, pas le clic. Chacun relancera chez lui ; la trame est datée et réutilisable.",
      },
    },
    verification: {
      question:
        "Vérification en binôme, grille des cinq leviers fournie, appliquée à la demande du voisin : quel levier manque ou reste flou, et qu'est-ce que cette absence a changé au résultat obtenu ? Restitution de trois binômes, corrigée en salle.",
      reponseAttendue:
        "Chaque binôme nomme au moins un levier manquant ou flou chez le voisin, avec la ligne qu'il faudrait ajouter. Le corrigé rappelle les deux leviers oubliés dans la plupart des premières demandes — le conteXte (l'outil ne sait rien de votre situation) et les Normes (rien ne lui interdit d'inventer).",
      dureeMin: 12,
      notes: {
        script:
          "Contrôle croisé, pas auto-relecture : on voit mieux le levier qui manque chez l'autre que chez soi. Imposez la règle « au moins un manque relevé par binôme » — sinon la politesse fait tout valider. Choisissez pour la restitution trois binômes aux manques DIFFÉRENTS, pour couvrir plusieurs leviers en trois minutes. Restez sur la formulation, jamais sur le fond métier de la tâche.",
        faq: [
          {
            question: "Ma demande a marché sans tous les leviers, pourquoi en rajouter ?",
            reponse:
              "Si le résultat vous convient, ne rajoutez rien — les leviers servent quand le résultat déçoit. La grille est un outil de diagnostic, pas une politesse à réciter.",
          },
        ],
        blocages: [
          {
            situation: "Les binômes se valident mutuellement sans rien relever.",
            parade:
              "Projeter la demande volontairement incomplète du kit et faire chercher collectivement ce qui lui manque. L'œil se règle en deux minutes, puis relancer le contrôle croisé.",
          },
        ],
        planB: "Grille et demande d'exemple sont imprimées dans le kit. Aucun outil nécessaire.",
      },
    },
    synthese: {
      acquis: [
        "Je nomme les cinq leviers AXION et je repère celui qui manque à une demande.",
        "Je réécris une demande vague en demande structurée, sur la trame, ligne par ligne.",
        "Je relance en ajoutant une seule précision au lieu de tout recommencer.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites lever la fiche mémo : « elle est à vous, elle repart avec vous, elle se remplit ligne par ligne ». Puis annoncez le dernier module en une phrase : « il reste à transformer l'essai — vous repartez avec trois demandes testées et la tâche par laquelle vous commencez lundi ». Pas de pause ici, on enchaîne : dites-le pour que personne ne se lève.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 3 — Trois usages à emporter, et par quoi je commence lundi
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-3",
    objectif: {
      enonce:
        "À la fin de ce module, vous repartez avec trois demandes écrites et testées, relançables telles quelles lundi matin, vous savez quelles tâches de votre poste se prêtent à l'IA et lesquelles ne s'y prêtent pas, et vous savez ce que vous relisez avant de diffuser un texte.",
      objectifGlobalId: "obj-4",
      // Le tri des tâches du poste en deux colonnes — « se prête à l'IA / ne
      // s'y prête pas » — ouvre l'atelier : c'est lui qui sert obj-2.
      objectifsSecondairesIds: ["obj-2"],
      dureeMin: 3,
      notes: {
        script:
          "Annoncez la couleur : « ce module, c'est le vôtre — les deux tiers du temps, c'est vous qui produisez, sur vos tâches à vous ». Rappelez le feuillet : il se termine dans l'heure, avec trois demandes dessus et la tâche de lundi au verso. Une phrase pour cadrer l'ambition, importante pour les débutants : « on ne cherche pas des demandes parfaites, on cherche des demandes QUI MARCHENT — la différence, c'est que les vôtres seront testées ».",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "L'e-mail difficile — annoncer un retard à un client — s'écrit aujourd'hui en une demi-heure de brouillons : on tourne autour de la mauvaise nouvelle, on s'excuse trop ou pas assez, et on finit par l'envoyer sans être sûr du ton.",
      apres:
        "La même tâche avec une demande AXION lue à voix haute, ligne par ligne : la sortie annonce le retard dès la première phrase, tient le ton, se termine par la nouvelle date — et la relecture porte sur trois points précis au lieu de tout réécrire.",
      prompt:
        "Acteur : tu es chargé de clientèle dans une entreprise de services de 15 personnes.\nConteXte : la commande d'un client fidèle aura cinq jours ouvrés de retard, la cause est un fournisseur, et c'est la première fois que cela arrive avec ce client.\nIntention : que le client reste en confiance et sache exactement quand il sera livré, sans que l'e-mail promette quoi que ce soit que je ne maîtrise pas.\nOutput : un e-mail de 130 mots maximum, objet compris, ton professionnel et direct, qui annonce le retard dès la première phrase et se termine par la nouvelle date de livraison.\nNormes : pas d'excuses en cascade, pas de jargon, et aucun geste commercial ni remise — si un dédommagement se décide, ce sera par moi, pas par le texte.",
      outil:
        "Un seul outil pour toute la demi-journée — celui préparé avec l'entreprise en amont (Claude ou ChatGPT selon le groupe).",
      gain: { avant: "30 min", apres: "5 min" },
      captureEcran:
        "Les deux e-mails côte à côte — le brouillon laborieux et la sortie AXION — avec la première phrase de chacun surlignée : celle qui tourne autour du pot, celle qui annonce.",
      verifieLe: VERIFIE_LE,
      dureeMin: 8,
      notes: {
        script:
          "Huit minutes, tenez-les : c'est une démonstration de rappel, pas une découverte. Lisez la demande À VOIX HAUTE en nommant chaque levier au passage — c'est la troisième fois que la salle voit AXION, elle doit pouvoir anticiper les lignes. Comparez les deux sorties ligne à ligne sur UN critère : où est annoncé le retard ? Puis montrez la ligne Normes et ce qu'elle a empêché : aucun geste commercial inventé. C'est la transition parfaite vers le cadre qui précède : l'IA prépare, l'humain décide et signe.",
        faq: [
          {
            question: "Le client verra que c'est écrit par une IA, non ?",
            reponse:
              "Ce qu'il recevra, c'est un e-mail que VOUS avez relu, corrigé et signé — c'est le principe vu il y a cinq minutes : quand un écrit rédigé avec l'IA est adressé à quelqu'un, on applique la règle de signalement vue au cadre, et l'humain reste l'auteur qui s'engage.",
          },
        ],
        blocages: [
          {
            situation: "La sortie promet un geste commercial malgré la ligne Normes.",
            parade:
              "Ne pas cacher l'incident : le surligner. C'est la meilleure preuve de la demi-journée que la relecture reste obligatoire — la ligne Normes réduit le risque, elle ne le supprime pas.",
          },
        ],
        planB:
          "Les deux e-mails sont imprimés dans le kit, datés, la première phrase de chacun déjà surlignée. La lecture à voix haute de la demande et la comparaison se tiennent sur papier.",
      },
    },
    pratique: {
      consigne:
        "Atelier chronométré, en trois temps, tout sur votre feuillet. Un : listez cinq tâches récurrentes de votre poste et répartissez-les en deux colonnes — « se prête à l'IA » / « ne s'y prête pas » — en vous servant de ce que la matinée vous a montré (l'IA invente, l'IA ne connaît pas vos données, le nominatif ne sort pas). Deux : traitez DEUX tâches de la colonne de droite en écrivant leur demande AXION, lancez, relancez au moins une fois avec une seule précision, et conservez les versions qui marchent. Trois : mettez au propre votre troisième demande, puis remplissez le verso — la tâche par laquelle je commence lundi, et la personne à qui je pose mes questions.",
      aEmporter:
        "Le feuillet complet : les cinq tâches triées en deux colonnes, trois demandes AXION testées et relançables telles quelles, et au verso la tâche de lundi avec le nom de la personne ressource.",
      dureeMin: 45,
      notes: {
        script:
          "Annoncez le minuteur et affichez-le : dix minutes pour le tri des tâches, vingt-cinq pour les deux demandes, dix pour la mise au propre et le verso. Pour les plus lents, dites-le d'avance : « UNE demande finie et testée vaut mieux que deux à moitié — le feuillet n'est pas un concours ». Vous circulez et vous ne corrigez QUE la formulation de la demande, jamais le fond métier : vous n'êtes pas expert de leurs postes, et c'est une force — dites-le. Sur le tri en colonnes : exigez au moins UNE tâche dans la colonne « ne s'y prête pas », et faites dire pourquoi — savoir ce qu'on ne confie pas à l'IA est un acquis au même titre que le reste. Rappelez une fois, à mi-parcours, la liste de ce qui ne sort jamais.",
        faq: [
          {
            question: "Toutes mes tâches touchent à des données clients, je fais quoi ?",
            reponse:
              "Vous travaillez la STRUCTURE avec des marqueurs : écrivez <NOM>, <MONTANT>, <DATE> dans votre demande. La demande reste réutilisable lundi — vous remplacerez les marqueurs dans votre environnement, selon le régime d'usage de votre entreprise.",
          },
          {
            question: "Et si aucune de mes tâches ne se prête vraiment à l'IA ?",
            reponse:
              "C'est une réponse en soi, et elle vaut d'être notée — mais vérifions ensemble : la colonne « ne s'y prête pas » se remplit souvent trop vite. Les écrits, les résumés, les reformulations existent dans presque tous les postes.",
          },
        ],
        blocages: [
          {
            situation:
              "Un participant demande si son entreprise a légalement le droit d'utiliser l'IA sur telle tâche précise.",
            parade:
              "Formule exacte, prononcée telle quelle : « je ne me prononce pas, notez la question, votre conseil tranchera ». La question part au verso du feuillet, dans les questions pour la personne ressource.",
          },
          {
            situation: "Un participant recommence sa demande de zéro à chaque essai décevant.",
            parade:
              "Poser la main sur le clavier, au sens propre : « on ne réécrit pas, on ajoute UNE précision ». C'est le geste du module 2 ; s'il ne s'installe pas ici, il ne s'installera pas seul lundi.",
          },
          {
            situation: "Un participant a fini ses trois demandes avec quinze minutes d'avance.",
            parade:
              "Lui confier une quatrième tâche : reprendre la colonne « ne s'y prête pas » et écrire, pour une tâche, la raison en une phrase au dos du feuillet. Ou l'envoyer en appui d'un voisin qui patine — en pointant les leviers, pas en tapant à sa place.",
          },
        ],
        planB:
          "Outil ou réseau tombé : le tri des tâches et les trois demandes s'écrivent à la main sur le feuillet — c'est déjà le support de l'atelier. Les demandes ne seront pas testées en salle : faites-les vérifier à la grille des cinq leviers par le voisin, et chacun les lance lundi ; la trame est datée et le feuillet est fait pour ça.",
      },
    },
    verification: {
      question:
        "Évaluation des acquis : quiz individuel de dix questions (corrigé fourni), corrigé en salle question par question. Puis relecture par chacun de SA meilleure production du jour, à la grille fournie — exactitude des chiffres, noms et dates ; ton adapté au destinataire ; structure ; réutilisable tel quel ou pas — et note sur le feuillet de ce qu'il reste à corriger avant de s'en servir.",
      reponseAttendue:
        "Le corrigé est commenté question par question, sans en passer aucune. Le seuil de réussite est celui déclaré au programme ; un score en dessous déclenche la reprise individuelle prévue au dispositif. Sur la relecture : chacun relève AU MOINS un point à corriger sur sa propre production — une copie « parfaite » est une copie relue trop vite.",
      dureeMin: 15,
      notes: {
        script:
          "C'est l'évaluation des acquis au sens de l'indicateur 11 : elle se tient, elle se corrige, elle se conserve. Si le temps manque, coupez ailleurs — jamais ici. Le quiz est individuel et sans document ; annoncez-le simplement, sans solennité : dix questions sur ce qui a été fait, pas des pièges. Pendant la relecture, passez voir en priorité ceux qui n'ont rien noté à corriger — c'est presque toujours une relecture trop rapide, pas une production parfaite.",
        faq: [
          {
            question: "Le résultat du quiz sera transmis à mon employeur ?",
            reponse:
              "Le résultat individuel ne l'est pas. Ce qui est transmis, c'est l'attestation de fin de formation et le fait que l'évaluation a eu lieu.",
          },
        ],
        blocages: [
          {
            situation: "Il reste douze minutes et le quiz n'est pas lancé.",
            parade:
              "Le tenir quand même : quiz complet, et commentaire du corrigé resserré sur les questions les plus ratées. On ne remplace jamais l'évaluation par un tour de table.",
          },
        ],
        planB: "Quiz papier et corrigé imprimés dans le kit. Aucune dépendance à un outil.",
      },
    },
    synthese: {
      acquis: [
        "J'écris une demande AXION sur une tâche de mon poste, et je la conserve pour la relancer telle quelle.",
        "Je relance avec une précision au lieu de tout recommencer.",
        "Je relis chiffres, noms et dates, et je signale l'usage de l'IA avant de diffuser un écrit.",
      ],
      dureeMin: 3,
      notes: {
        script:
          "Trois minutes, un seul geste : chacun lit à VOIX HAUTE le verso de son feuillet — la tâche par laquelle il commence lundi. Un tour rapide, une phrase par personne, sans commentaire. Fermez sur la phrase de la demi-journée : « l'IA prépare, l'humain décide — et lundi, c'est vous qui commencez ». Rappelez que le feuillet part avec eux : c'est leur premier outil de travail, pas un support de cours.",
        faq: [],
        blocages: [
          {
            situation: "Le tour des « lundis » traîne, certains racontent leur feuillet entier.",
            parade:
              "Cadrer d'un mot avant de lancer : « la tâche, juste la tâche ». Si ça déborde quand même, passer au suivant d'un geste — la salle comprend, l'horaire de fin est tenu.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },
];
