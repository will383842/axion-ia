/**
 * CONTENU RÉDIGÉ — « IA pour la production » (2 jours, 14 h, 4 modules).
 *
 * ## Le fil rouge
 *
 * Chacun repart avec UN classeur de bord d'atelier, versé pièce par pièce au fil
 * des quatre demi-journées. Le module 1 pose ce qui ne sort jamais de l'atelier
 * et produit la première consigne de poste. Le module 2 installe les deux écrits
 * de volume — compte rendu de poste, mode opératoire — à partir de la DICTÉE, le
 * seul geste tenable pour des gens qui n'ont pas de temps devant un écran. Le
 * module 3 apprend à compter les erreurs de la machine et à préparer les
 * documents qui repartent au visa. Le module 4 qualifie une automatisation,
 * l'éprouve sur un cas limite, et assemble le classeur.
 *
 * ## Pourquoi la fin de J1 n'est pas une fin de journée ordinaire
 *
 * 🔴 Le module 2 se termine par un état STABLE et NOMMÉ : le classeur de bord
 * porte un nom, et chacun a dit à voix haute où il le range. Sans cela, J2
 * redémarre à froid — la matinée du jour 2 se passe à rechercher les fichiers de
 * la veille, et la chasse à l'erreur, qui est le cœur du dispositif, se fait sur
 * rien. Le script du bloc de synthèse du module 2 l'impose explicitement.
 *
 * ## Trois règles que le formateur ne négocie pas
 *
 * **L'IA ne produit JAMAIS une consigne de sécurité, un paramètre machine ni une
 * instruction de conduite.** Ces éléments viennent des documents validés de
 * l'entreprise et se RECOPIENT, mot pour mot. Tous les prompts de ces deux jours
 * portent la contrainte explicitement, et la grille de relecture refuse une
 * production dont un point de sécurité a été rédigé par l'outil. Une erreur à
 * cet endroit blesse quelqu'un — c'est le seul point où l'on n'arbitre rien et
 * où l'on ne discute pas.
 *
 * **Le secret industriel ne sort pas.** Cadences, rendements, paramètres de
 * réglage, plans, prix de revient, nom du client et incidents clients, données
 * nominatives des opérateurs : la liste rouge s'écrit au module 1 et tient les
 * deux jours. Les ateliers tournent sur le MATÉRIEL DU KIT dès qu'un document
 * réel porterait l'un de ces éléments.
 *
 * **Le formateur n'arbitre aucune question de sécurité ni de réglementation
 * HSE.** La formule est écrite, elle se prononce telle quelle : « je ne me
 * prononce pas, notez la question, votre référent QSE tranchera ». Les trames
 * remises portent un emplacement de visa qui n'est pas retirable.
 *
 * ⚠️ Les références juridiques citées dans les blocs `cadre` du programme
 * (règlement européen sur l'IA, code du travail) sont fournies au formateur
 * SOURCÉES ET DATÉES dans le kit, et ne se citent jamais de mémoire.
 */

import type { EnrichissementFormation } from "./types";

/** Date de dernière vérification des captures et sorties d'outils. */
const VERIFIE_LE = "2026-08-06";

export const IA_POUR_LA_PRODUCTION: EnrichissementFormation = [
  // ───────────────────────────────────────────────────────────────────────────
  // Module 1 — Matin J1 : le socle, ce qui ne sort jamais de l'atelier
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-1",
    objectif: {
      enonce:
        "À la fin de ce module, vous avez écrit la liste rouge de votre atelier — ce qui ne sort jamais, ce qui se neutralise, ce qui est libre — et vous produisez une consigne de poste qui la respecte.",
      objectifGlobalId: "obj-1",
      // La matinée sert deux objectifs de plus : la consigne de poste rédigée
      // aux cinq leviers AXION puis reprise après contrôle du binôme sur la
      // grille fournie, et la règle de recopie — la vérification demande « que
      // fait-on d'un paramètre de réglage cité dans une dictée ? » et contrôle
      // que la contrainte de sécurité a été recopiée et non rédigée.
      objectifsSecondairesIds: ["obj-2", "obj-3"],
      dureeMin: 10,
      notes: {
        script:
          "Tour de table MINUTÉ, une phrase par personne, pas un récit d'atelier : « votre prénom, votre ligne ou votre atelier, et l'écrit que vous voulez avoir réglé ce soir ». Notez chaque réponse au tableau, elle servira deux fois — ce soir en synthèse de J1, et demain après-midi pour la feuille de route. Annoncez ensuite les deux règles qui tiennent les deux jours, dans cet ordre : l'IA prépare, l'homme du métier décide ; et l'IA n'écrit JAMAIS une consigne de sécurité, un paramètre machine ou une instruction de conduite — ceux-là se recopient depuis vos documents validés. Annoncez enfin le livrable : chacun repart avec son classeur de bord d'atelier.",
        faq: [
          {
            question: "On va pouvoir lui faire sortir nos paramètres de réglage ?",
            reponse:
              "Non, et c'est la règle la plus ferme des deux jours. Un paramètre de conduite vient de votre document de référence et se recopie. Ce que l'outil produit à cet endroit est plausible et faux, et une erreur de réglage se paie sur la machine ou sur quelqu'un.",
          },
          {
            question: "Notre informatique a bloqué ChatGPT, on fait quoi ?",
            reponse:
              "Exactement ce qu'on voit dans dix minutes : les trois régimes d'usage. Un blocage n'est pas une interdiction de l'IA, c'est un choix de régime. Notez le nom de l'outil validé chez vous, on travaillera avec celui-là.",
          },
        ],
        blocages: [
          {
            situation:
              "Le tour de table dérive en règlement de comptes avec la GPAO ou l'ERP qui « ne sert à rien ».",
            parade:
              "Couper avec : « on note, et on regarde demain après-midi si l'IA change quelque chose là-dessus » — puis écrire la doléance au tableau. La reprendre au module 4 fait beaucoup pour la crédibilité.",
          },
          {
            situation: "Deux personnes arrivent en retard, sorties du poste, la salle attend.",
            parade:
              "Ne pas refaire le tour de table. Les faire s'installer, leur demander leur phrase pendant la première séquence de cadre, et poursuivre. Un public de terrain arrive en décalé, c'est normal — le prévoir, pas le sanctionner.",
          },
        ],
        planB:
          "Aucun outil n'est nécessaire ici. Vidéoprojecteur en panne : le tour de table et les deux règles se tiennent au paperboard sans rien perdre.",
      },
    },
    demonstration: {
      avant:
        "Le compte rendu de prise de poste s'écrit à la main sur le cahier de quart, en fin de poste, quand la ligne redémarre et que le téléphone sonne. Il est court, à moitié lisible pour l'équipe suivante, et ce qui comptait vraiment — l'aléa de trois heures du matin — n'y figure pas.",
      apres:
        "Les mêmes éléments dictés deux minutes en marchant, puis remis en forme sous la trame de passage de consigne : ce qui s'est passé, ce qui a été décidé, ce qui reste à reprendre. Ce qui manque apparaît en clair, sous forme de « à préciser », au lieu d'être oublié.",
      prompt:
        "Acteur : tu es agent de maîtrise dans un atelier de production, et tu écris pour l'équipe qui prend le poste après moi.\nConteXte : je te donne ma dictée brute de fin de poste, prise en marchant, avec des phrases inachevées et des reprises.\nIntention : produire le passage de consigne écrit que l'équipe suivante lira en trois minutes avant de monter au poste.\nOutput : trois rubriques et rien d'autre — FAITS DU POSTE, DÉCISIONS PRISES, À REPRENDRE PAR L'ÉQUIPE SUIVANTE. Une ligne par point, avec le poste ou la ligne nommé en début de ligne.\nNormes : n'écris que ce qui est dans ma dictée. N'invente aucun horaire, aucune quantité, aucune référence produit, aucun nom de client. Ne rédige AUCUNE consigne de sécurité et AUCUN paramètre de réglage : si ma dictée en contient, recopie-les mot pour mot entre guillemets et ajoute « à vérifier au document de référence ». Si un point est incompréhensible, écris « à préciser » plutôt que de deviner.",
      outil:
        "Un seul outil, celui validé dans la salle (Claude ou ChatGPT selon le régime d'usage retenu par le client).",
      captureEcran:
        "La dictée brute à gauche, le passage de consigne à droite, avec en surlignage les trois « à préciser » que l'outil a rendus au lieu de combler, et le paramètre de réglage laissé entre guillemets.",
      verifieLe: VERIFIE_LE,
      dureeMin: 35,
      notes: {
        script:
          "Deux temps enchaînés. D'abord la démonstration avant / après sur le compte rendu de prise de poste (vingt minutes) : lancez la version bâclée EN PREMIER, celle sans structure, et laissez la salle la trouver « pas mal » — c'est le piège, et il fonctionne. MONTREZ ce qui a raté au premier essai, ne rejouez pas une prise nickel : un public de terrain sent immédiatement la démonstration truquée, et la crédibilité de deux jours se joue là. Ensuite (quinze minutes), écrivez AXION au tableau — Acteur, conteXte, Intention, Output, Normes — et reprenez la consigne levier par levier, en ajoutant une ligne à la fois pour montrer ce que chacune change dans la sortie. Laissez AXION affiché les deux jours. Insistez sur la ligne Normes : c'est elle, et elle seule, qui empêche l'outil d'écrire un paramètre machine.",
        faq: [
          {
            question:
              "Pourquoi lui interdire d'écrire les quantités puisqu'elles sont dans ma tête ?",
            reponse:
              "Parce qu'il les écrira quand même, plausibles et fausses, si vous ne les avez pas dictées. Un tonnage inventé dans un passage de consigne se retrouve dans le suivi du mois — et personne ne saura d'où il vient.",
          },
          {
            question: "« À préciser » partout, ça fait négligé devant l'équipe suivante.",
            reponse:
              "C'est l'inverse : un « à préciser » est une question posée à l'équipe suivante. Un chiffre inventé, lui, ne se voit pas et ne se pose pas.",
          },
        ],
        blocages: [
          {
            situation:
              "La sortie recopie bien le paramètre entre guillemets mais le reformule au passage — « environ 180 °C ».",
            parade:
              "Excellent incident, gardez-le à l'écran. C'est la preuve vivante que la ligne Normes réduit le risque sans le supprimer, et que la relecture reste obligatoire sur tout point de conduite. Ne le cachez pas, exploitez-le.",
          },
          {
            situation:
              "Un participant veut coller sa vraie dictée de la nuit dernière, tout de suite.",
            parade:
              "Refuser pour l'instant, en une phrase : « on écrit la liste rouge d'abord, on colle après ». Il le fera à l'atelier, dans une demi-heure, en connaissant les limites.",
          },
        ],
        planB:
          "Quota atteint ou réseau tombé : la dictée brute et les deux sorties sont imprimées dans le kit formateur, datées. La comparaison ligne à ligne et le repérage des « à préciser » se tiennent à l'identique sur papier. N'improvisez aucune sortie en direct : celles du kit ont été vérifiées.",
      },
    },
    pratique: {
      consigne:
        "Trois temps. 1) Seul, sur la trame fournie, écrivez la liste rouge de VOTRE atelier en trois colonnes : « ne sort jamais » (plans, paramètres de réglage, cadences, rendements, prix de revient, nom du client et incidents clients, données nominatives des opérateurs), « à neutraliser avant de coller », « libre » — puis confrontation en binôme, et arbitrage des cas litigieux en salle. 2) Avec les cinq leviers AXION, rédigez la consigne de poste réelle de votre atelier, en respectant votre propre liste rouge. 3) Échangez les consignes en binôme, remplissez la grille d'auto-évaluation fournie, puis reprenez la vôtre.",
      aEmporter:
        "La liste rouge de votre atelier en trois colonnes, et votre consigne de poste reprise après retour du binôme — les deux premières pièces du classeur de bord d'atelier.",
      dureeMin: 80,
      notes: {
        script:
          "Sur la liste rouge : ne la dictez pas, ils écriraient la vôtre. La trame est à trous, les trois colonnes sont imprimées, laissez-les buter. Passez dans les rangs et posez UNE question à ceux qui bloquent : « si ça s'affichait demain chez votre concurrent, ça vous ferait quoi ? ». Sur la pseudonymisation, l'exemple qui fait basculer la salle : « l'opérateur de la ligne 3 du poste de nuit » ne porte aucun nom et désigne exactement une personne — dans un atelier, retirer le nom ne suffit jamais. Sur la consigne de poste : chacun travaille sur SON atelier, mais dès qu'un document réel porterait un élément de la colonne rouge, on bascule sur le matériel du kit, sans discussion. Annoncez le chronomètre à voix haute toutes les dix minutes. Ne rédigez à la place de personne.",
        faq: [
          {
            question: "Nos cadences, c'est vraiment confidentiel ? Tout le monde les connaît.",
            reponse:
              "Non, tout le monde ne les connaît pas. Une cadence et un rendement donnent votre prix de revient à qui sait les lire, et c'est exactement ce qu'un concurrent cherche. Colonne rouge, sans exception.",
          },
          {
            question: "Je peux déposer notre mode opératoire existant pour qu'il s'en inspire ?",
            reponse:
              "S'il porte des paramètres de réglage ou des données de gamme, non — c'est le cœur de la colonne rouge. S'il n'en porte pas et que votre régime d'usage le permet, oui. C'est justement l'arbitrage que vous êtes en train d'apprendre à faire.",
          },
          {
            question: "Une consigne de sécurité, je peux la lui faire reformuler en plus simple ?",
            reponse:
              "Je ne me prononce pas, notez la question, votre référent QSE tranchera. Ce que je peux dire : dans cette formation, un point de sécurité se recopie, il ne se reformule pas.",
          },
        ],
        blocages: [
          {
            situation:
              "Un participant colle un plan, une gamme ou une fiche de réglage réelle dans l'outil.",
            parade:
              "Arrêter immédiatement, faire fermer la conversation, sans négocier. C'est le seul geste de la matinée qui ne se discute pas — et la salle a besoin de voir que vous ne discutez pas.",
          },
          {
            situation: "Un binôme confond consigne de poste et consigne de sécurité.",
            parade:
              "Une seule question : « si quelqu'un applique cette ligne à la lettre, est-ce qu'il peut se blesser ? ». Si oui, la ligne se recopie depuis le document visé et l'IA n'y touche pas. Ils trient seuls ensuite.",
          },
          {
            situation: "Un binôme a fini en quinze minutes et regarde ailleurs.",
            parade:
              "Leur donner le cas litigieux du kit — le compte rendu d'incident où le nom du client apparaît en filigrane dans la référence produit — et leur demander de préparer la restitution en salle.",
          },
        ],
        planB:
          "L'atelier ne dépend d'aucun outil pour son premier temps : la liste rouge s'écrit à la main sur la trame. Pour la consigne de poste, réseau tombé, les cinq leviers AXION s'appliquent à l'identique sur la trame papier — ce qui compte est la structure de la demande, pas l'outil qui l'exécute. Chacun relancera au poste, la trame est datée et réutilisable.",
      },
    },
    verification: {
      question:
        "Deux temps. Cinq questions corrigées en salle : quel régime d'usage est en vigueur chez vous ? citez trois éléments de votre colonne « ne sort jamais » ? pourquoi retirer le nom d'un opérateur ne suffit-il pas ? qui écrit une consigne de sécurité ? que fait-on d'un paramètre de réglage cité dans une dictée ? Puis trois consignes produites passent au vidéoprojecteur et sont lues à la grille : destinataire nommé, contexte suffisant, format attendu, contrainte de sécurité recopiée et non rédigée.",
      reponseAttendue:
        "Des cinq questions, la quatrième ne se négocie pas : une consigne de sécurité est écrite par le référent QSE et se recopie mot pour mot — l'IA ne la produit jamais. La cinquième non plus : un paramètre de réglage se recopie depuis le document de référence. Sur la grille, les trois consignes projetées doivent porter les quatre cases ; les écarts se corrigent à l'écran, devant tout le monde, sur la consigne de leur auteur — c'est là que se joue l'apprentissage, pas dans la note.",
      dureeMin: 25,
      notes: {
        script:
          "Les cinq questions se corrigent à l'oral, question par question, à main levée — pas de copie ramassée. Sur le passage au vidéoprojecteur : demandez des VOLONTAIRES et projetez trois consignes seulement, dont une bonne et une bancale. Prévenez avant de projeter : « on corrige le texte, pas la personne ». Un public de terrain accepte très bien la correction publique si la règle est annoncée d'avance, et très mal si elle ne l'est pas. Si la quatrième case — contrainte de sécurité recopiée — est vide sur les trois consignes, arrêtez tout et refaites-la avec la salle : c'est le point qui blesse quelqu'un.",
        faq: [
          {
            question: "On est notés ? Ça remonte à mon chef ?",
            reponse:
              "Pas ici. L'évaluation des acquis est demain en fin d'après-midi, et le résultat individuel ne remonte pas. Ceci sert à repérer ce qui coince pendant qu'on peut encore le corriger ensemble.",
          },
        ],
        blocages: [
          {
            situation: "Personne ne veut voir sa consigne projetée.",
            parade:
              "Projeter la vôtre en premier, celle du kit, volontairement bancale, et la faire démonter par la salle. Après ça, il y a des volontaires.",
          },
        ],
        planB:
          "Vidéoprojecteur en panne : les trois consignes se lisent à voix haute par leur auteur, la grille est imprimée et cochée par le voisin. Le corrigé des cinq questions est dans le kit.",
      },
    },
    synthese: {
      acquis: [
        "Je nomme ce qui ne sort jamais de mon atelier avant d'ouvrir une conversation avec l'IA.",
        "Je rédige une consigne de poste avec les cinq leviers AXION, et je recopie les points de sécurité au lieu de les faire écrire.",
        "Je repère qu'un compte rendu d'équipe reste ré-identifiable même quand j'en ai retiré les noms.",
      ],
      dureeMin: 10,
      notes: {
        script:
          "Faites ÉCRIRE, pas réciter : chacun note sur sa fiche de route personnelle les deux gestes qu'il applique dès cet après-midi. Puis trois personnes les lisent à voix haute — trois suffisent. Annoncez la suite en une phrase : « cet après-midi, on ne parle plus de règles, on produit les deux écrits qui vous prennent le plus de temps, et on le fait en dictant ».",
        faq: [],
        blocages: [
          {
            situation:
              "Il est midi passé, la salle a faim et les fiches de route restent blanches.",
            parade:
              "Ne pas insister : énoncer les trois acquis vous-même, faire écrire les deux gestes en trente secondes chrono, et libérer. Un acquis formulé à contrecœur ne s'ancre pas mieux.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 2 — Après-midi J1 : compte rendu de poste et mode opératoire
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-2",
    objectif: {
      enonce:
        "À la fin de ce module, vous produisez à partir d'une dictée le compte rendu de votre point de production, et le mode opératoire d'une opération réelle de votre atelier.",
      objectifGlobalId: "obj-4",
      // Le quatrième temps de la pratique marque l'emplacement du visa HSE et
      // recopie les valeurs de réglage depuis la fiche visée ; le deuxième met
      // en forme le mode opératoire d'une opération réelle, le fait relire en
      // binôme et fait barrer par son auteur l'étape que personne n'exécute.
      objectifsSecondairesIds: ["obj-3", "obj-5"],
      dureeMin: 5,
      notes: {
        script:
          "Annoncez pourquoi cet après-midi est le plus rentable des deux jours : ce sont les deux écrits de VOLUME du métier, ceux qui repoussent tout le reste. Et annoncez le geste central, qui va surprendre : on va DICTER, debout, téléphone à la main. Personne ici n'a une demi-heure devant un écran ; le clavier est ce qui fait que ces écrits ne sont jamais faits. Annoncez enfin le livrable de la journée : à 17 h, chacun a son classeur nommé.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "Le point de production de neuf heures dure vingt minutes, chacun en sort avec ses notes, et le compte rendu part le lendemain soir — quand il part. Les décisions se perdent, et la même question revient au point de la semaine suivante.",
      apres:
        "Trois minutes dictées au téléphone en sortant de la salle deviennent un compte rendu en trois rubriques : ce qui a été constaté, ce qui a été décidé, ce qu'il faut relancer et par qui. Ce qui n'a pas été dit reste vide, et ce vide est une information exploitable.",
      prompt:
        "Voici la transcription brute de ma dictée de trois minutes, prise en sortant du point de production. Elle contient des hésitations, des reprises et des phrases inachevées.\nÉcris le compte rendu du point sous exactement trois rubriques : FAITS (ce qui a été constaté, une ligne par ligne de production), DÉCISIONS (ce qui a été arbitré, en nommant qui l'a arbitré si je l'ai dit), À RELANCER (l'action, la personne nommée dans ma dictée, l'échéance si je l'ai donnée).\nN'ajoute rien qui ne soit dans la dictée : aucun tonnage, aucun taux, aucune référence produit, aucun nom de client. Si je n'ai pas donné de porteur ou d'échéance, écris « porteur à désigner » ou « échéance à fixer », n'en invente pas.\nNe reformule aucun élément de sécurité et aucun paramètre de conduite : recopie-le tel que je l'ai dit, entre guillemets.\nTermine par la liste des points de ma dictée que tu n'as pas compris.",
      outil: "Un seul outil, celui validé dans la salle.",
      captureEcran:
        "La transcription brute et le compte rendu côte à côte, avec la rubrique finale « points non compris » entourée — c'est elle qu'on regarde en premier, avant le reste de la sortie.",
      verifieLe: VERIFIE_LE,
      dureeMin: 35,
      notes: {
        script:
          "Deux temps. Le premier (vingt minutes) : dictez VOUS-MÊME, en direct, devant la salle, trois minutes, debout, sans notes. C'est le moment qui décide de l'après-midi — s'ils vous voient dicter maladroitement et obtenir un compte rendu propre, ils dicteront ; si vous lisez un texte préparé, personne ne dictera. Puis montrez les trois entrées de matière — dépôt de fichier, dictée, photo — et ANNONCEZ LEURS TROIS ÉCHECS AVANT que quiconque échoue : scan sans texte reconnu, photo de tableau désalignée, dictée où les postes ne sont pas nommés. Un participant qui échoue sans avoir été prévenu se referme pour l'après-midi ; prévenu, il vous appelle. Le second temps (quinze minutes) : le passage du geste raconté au mode opératoire structuré, sur la trame fournie, une opération d'atelier simple et physique — un changement de format, pas une procédure administrative.",
        faq: [
          {
            question: "Ma dictée est pleine de fautes et de « euh », il comprend quand même ?",
            reponse:
              "Oui, et c'est précisément ce qui rend le geste utilisable au poste. Ce qu'il ne comprend pas, il vous le dit en fin de sortie — c'est la dernière ligne du prompt, et c'est celle qu'on lit en premier.",
          },
          {
            question: "Pourquoi lui faire lister ce qu'il n'a pas compris ?",
            reponse:
              "Parce que sans cette ligne il comble les trous à votre place, silencieusement. Avec elle, il vous rend les trous. C'est la différence entre un compte rendu qu'on relit en deux minutes et un compte rendu qu'on ne relit pas du tout.",
          },
        ],
        blocages: [
          {
            situation:
              "La dictée en direct ressort mal transcrite à cause du bruit ambiant de la salle.",
            parade:
              "Le dire et l'exploiter : « voilà pourquoi on dicte dans le couloir et pas au pied de la ligne ». Puis relancer sur la transcription du kit. L'incident enseigne quelque chose de vrai sur les conditions d'usage.",
          },
          {
            situation: "Le mode opératoire démontré ressort avec des valeurs de réglage inventées.",
            parade:
              "Le garder à l'écran et compter les valeurs inventées avec la salle. C'est la meilleure démonstration possible de la règle du matin, et elle arrive au bon moment — juste avant que chacun rédige le sien.",
          },
        ],
        planB:
          "La transcription brute, le compte rendu et le mode opératoire sont imprimés dans le kit, datés. La démonstration se tient à l'identique : on lit la dictée à voix haute, on distribue les sorties, on entoure la rubrique des points non compris.",
      },
    },
    pratique: {
      consigne:
        "Quatre temps, sur vos propres écrits. 1) Dictez votre point de production ou votre prise de poste — deux à trois minutes, téléphone accepté, debout comme au poste — et produisez le compte rendu. 2) À partir de la trame fournie, produisez le mode opératoire d'une opération réelle de votre atelier : l'IA met en forme le geste que vous racontez, elle ne l'invente pas. 3) Relecture croisée en binôme sur la grille fournie — exactitude, ordre des étapes, points de sécurité, réutilisabilité — puis chacun reprend son mode opératoire. 4) Reprenez votre consigne du matin en langage clair, puis dans la langue parlée par votre équipe, et marquez l'emplacement du visa HSE.",
      aEmporter:
        "Un compte rendu de poste issu de votre propre dictée, un mode opératoire d'atelier relu par un pair et repris, et la version en langage clair de votre consigne avec l'emplacement du visa HSE marqué — troisième versement au classeur de bord.",
      dureeMin: 120,
      notes: {
        script:
          "Organisez la dictée AVANT de lancer le chronomètre, sinon quinze personnes dictent en même temps et plus personne ne s'entend : deux vagues, la première dans le couloir et le hall, la seconde en salle. Annoncez-le comme une consigne d'atelier, pas comme un incident. Sur le mode opératoire : la trame est fournie, l'opération doit être une opération PHYSIQUE que le participant a faite lui-même — s'il ne l'a jamais faite, il ne pourra pas relire ce que l'outil écrit. Entre le troisième et le quatrième temps, posez la règle du visa avant que quiconque commence à traduire : toute consigne à portée de sécurité repart au visa du responsable HSE avant affichage, la traduction comprise. Sur le quatrième temps, dites-le tel quel : l'IA propose une traduction, elle ne la valide pas ; c'est un locuteur de l'équipe et le référent QSE qui valident. Et vous, vous n'arbitrez rien : « je ne me prononce pas, notez la question, votre référent QSE tranchera ».",
        faq: [
          {
            question: "Je peux faire traduire une consigne de sécurité pour mon équipe ?",
            reponse:
              "Vous pouvez faire préparer une proposition de traduction. Elle ne s'affiche pas sans relecture par un locuteur de l'équipe et sans le visa du responsable HSE. Une consigne de sécurité mal traduite est une consigne de sécurité fausse.",
          },
          {
            question: "Mon mode opératoire contient les réglages, sinon il ne sert à rien.",
            reponse:
              "Alors laissez la place vide dans le texte produit et recopiez les valeurs depuis la fiche de réglage visée, à la main, en dernier. Le mode opératoire est complet, et aucune valeur n'a été écrite par la machine.",
          },
          {
            question: "Ça vaut le coup de dicter plutôt que d'écrire ?",
            reponse:
              "Faites les deux une fois et comparez le temps sur votre montre. La plupart des participants dictent trois minutes là où ils écrivaient vingt — mais vérifiez sur votre propre écrit, pas sur ma parole.",
          },
        ],
        blocages: [
          {
            situation: "Un participant refuse de dicter, « je ne vais pas parler tout seul ».",
            parade:
              "Le mettre en binôme : il raconte à quelqu'un, l'autre tient le téléphone. Ça marche à tous les coups, et c'est exactement le geste du passage de consigne réel.",
          },
          {
            situation: "Le mode opératoire produit ajoute une étape que personne ne fait.",
            parade:
              "Ne pas la corriger vous-même : demander à l'auteur de la barrer devant le groupe et de dire d'où elle sort. La réponse est toujours « de nulle part » — et c'est l'enseignement de l'après-midi.",
          },
          {
            situation: "Le réseau de la salle sature pendant les dépôts de fichiers simultanés.",
            parade:
              "Faire démarrer par vagues de cinq, comme pour la dictée. Annoncez-le comme une consigne d'atelier.",
          },
        ],
        planB:
          "Réseau tombé : le compte rendu s'écrit sur la trame papier à partir des notes du point de production, et le mode opératoire sur la trame fournie. La structure — faits, décisions, à relancer — est ce qui compte et elle ne dépend d'aucun outil. Chacun relancera la dictée depuis son poste, les trames sont datées et réutilisables.",
      },
    },
    verification: {
      question:
        "Deux temps. Trois comptes rendus produits en séance passent à la grille fournie — faits / décisions / à relancer — et la salle cherche collectivement ce que la machine a ajouté et que personne n'a dit au point de production. Puis cinq questions corrigées en salle : quelles sont les trois entrées de matière, et l'échec propre à chacune ? que fait-on d'un paramètre de réglage sorti d'une dictée ? qui vise une consigne à portée de sécurité, et avant quoi ?",
      reponseAttendue:
        "Sur les trois comptes rendus, au moins un ajout non dit doit être trouvé : il y en a toujours un, et le corrigé du kit indique lequel chercher si la salle passe à côté. Aux cinq questions : dépôt de fichier — échec typique, le scan sans texte reconnu ; dictée — échec typique, les postes non nommés ; photo — échec typique, le tableau désaligné. Un paramètre de réglage se recopie depuis le document de référence et ne se laisse jamais rédiger. Toute consigne à portée de sécurité repart au visa du responsable HSE AVANT affichage, traduction comprise.",
      dureeMin: 25,
      notes: {
        script:
          "Sur les trois comptes rendus : demandez à leurs AUTEURS de dire ce qui a été ajouté, pas au groupe. Celui qui était au point de production est le seul à pouvoir le savoir, et c'est exactement le geste qu'on veut installer — la relecture par celui qui sait. Les cinq questions se corrigent à main levée, sans copie ramassée.",
        faq: [
          {
            question: "Et si je ne me souviens plus de ce qui a été dit au point ?",
            reponse:
              "Alors le compte rendu part le lendemain et il est déjà faux — c'est justement pourquoi on dicte en sortant de la salle, pas le soir.",
          },
        ],
        blocages: [
          {
            situation: "Les auteurs ne trouvent aucun ajout, tout leur paraît juste.",
            parade:
              "Projeter le compte rendu du kit, qui en contient quatre dont un chiffre. L'œil se règle en trois minutes, puis relancer sur leurs propres copies.",
          },
        ],
        planB: "Grille et corrigé sont imprimés dans le kit. Aucun outil nécessaire.",
      },
    },
    synthese: {
      acquis: [
        "Je produis mon compte rendu de poste à partir d'une dictée de trois minutes, sans m'asseoir devant un écran.",
        "Je fais mettre en forme un mode opératoire que je raconte, et je recopie les points de sécurité depuis le document visé.",
        "Je marque l'emplacement du visa HSE avant de classer un écrit destiné à l'affichage.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "🔴 Cette synthèse n'est pas une fin de journée ordinaire : elle doit produire un ÉTAT STABLE ET NOMMÉ, sinon demain matin redémarre à froid. Faites nommer le classeur à voix haute, un par un : « classeur-de-bord-<atelier>-<date> ». Faites dire OÙ il est rangé — poste de travail, espace partagé, clé — et faites-le écrire sur la fiche de route. Puis comptez à main levée ceux qui ont nommé ET rangé, et ne libérez pas la salle tant que le compte n'y est pas : ceux qui repartent sans classeur nommé passeront la matinée de demain à rechercher des fichiers, et la chasse à l'erreur de 9 h se fera sur rien. Annoncez enfin la première heure de demain : « on commence par compter les erreurs que la machine fait sur VOTRE process ».",
        faq: [
          {
            question: "On peut finir le classeur demain matin ?",
            reponse:
              "Non. Demain matin on travaille DEDANS dès la première demi-heure. Ce qui n'est pas nommé ce soir sera cherché demain, et c'est du temps pris sur la pratique.",
          },
        ],
        blocages: [
          {
            situation:
              "Il est 17 h passé, deux personnes sont déjà parties au poste sans avoir nommé leur classeur.",
            parade:
              "Leur envoyer le nom attendu par message le soir même, et prévoir dix minutes demain à 8 h 50 pour les remettre à niveau AVANT l'objectif du matin. Ne pas laisser cet écart entrer dans la matinée de J2.",
          },
        ],
        planB:
          "Aucun outil en jeu : le classeur peut être une pochette cartonnée et un nom écrit au feutre. Ce qui compte est qu'il existe, qu'il porte un nom et que son propriétaire sache où il est.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 3 — Matin J2 : compter les erreurs, préparer ce qui part au visa
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-3",
    objectif: {
      enonce:
        "À la fin de ce module, vous avez compté les erreurs de la machine sur votre propre process, et vous préparez un document de sécurité prêt au visa du responsable HSE.",
      objectifGlobalId: "obj-6",
      // Le document de sécurité préparé au deuxième temps repart au visa HSE
      // avant affichage, points de sécurité recopiés et non rédigés ; le
      // quatrième temps produit le commentaire du mois à partir de chiffres
      // déjà calculés par le système, chaque chiffre pointé contre sa source,
      // et c'est le seul endroit des deux jours où l'IA commente un plan de
      // charge — sans jamais l'ordonnancer.
      objectifsSecondairesIds: ["obj-3", "obj-7"],
      dureeMin: 5,
      notes: {
        script:
          "Faites ROUVRIR le classeur nommé hier soir, tout de suite, avant de parler : « ouvrez-le, dites-moi son nom ». Ceux qui ne l'ont pas récupèrent la pochette de secours du kit et le reconstituent pendant la première pratique — ne consacrez pas la matinée à rattraper. Annoncez ensuite le retournement de la matinée : hier on a appris à faire produire, ce matin on apprend à ne plus faire confiance. Et annoncez le résultat attendu à midi : un document de sécurité prêt à partir au visa.",
        faq: [],
        blocages: [
          {
            situation: "Un tiers de la salle n'a pas le classeur d'hier.",
            parade:
              "Ne pas commenter, distribuer les pochettes de secours et enchaîner. Le reproche coûterait la matinée ; la pochette coûte deux minutes.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "La causerie sécurité du lundi se prépare le lundi à 5 h 50, dix minutes avant, en reprenant celle du mois dernier. Le sujet ne colle pas à ce qui s'est passé sur la ligne, l'équipe le sent, et l'exercice devient une formalité qu'on signe.",
      apres:
        "La trame de causerie fournie est remplie à partir de l'aléa réellement survenu la semaine passée : le fait, ce qui aurait pu arriver, la question posée à l'équipe. Les points de sécurité viennent du document visé et sont recopiés ; l'IA n'écrit que ce qui les entoure.",
      prompt:
        "Je te donne la trame de causerie sécurité ci-jointe et le récit d'un aléa survenu la semaine dernière sur une ligne de production.\nRemplis la trame rubrique par rubrique, sans en ajouter ni en retirer : contexte de l'aléa en trois lignes, ce qui aurait pu arriver, la question à poser à l'équipe, l'emplacement de signature.\nRègle absolue : tu n'écris AUCUNE consigne de sécurité et AUCUN geste de conduite. Là où la trame attend une consigne, écris exactement « [recopier ici la consigne du document de référence — visa HSE] » et n'invente rien autour.\nN'utilise aucun chiffre que je ne t'ai pas donné : ni cadence, ni tonnage, ni durée d'arrêt.\nÉcris au niveau de langue d'un opérateur : phrases courtes, pas de vocabulaire de bureau, pas d'abréviation qui ne soit dans mon récit.",
      outil: "Un seul outil, celui validé dans la salle.",
      captureEcran:
        "La causerie remplie, avec les trois emplacements « [recopier ici la consigne du document de référence — visa HSE] » surlignés — ce sont les seules lignes que la machine n'a pas écrites, et ce sont les seules qui engagent.",
      verifieLe: VERIFIE_LE,
      dureeMin: 10,
      notes: {
        script:
          "Dix minutes, pas plus : c'est la pratique qui porte cette matinée, la démonstration n'est qu'un lancement. Montrez la trame vide d'abord, la sortie ensuite, et arrêtez-vous sur UN seul point — les emplacements réservés au visa, restés vides. Dites la phrase telle quelle : « la machine a écrit tout le reste et rien de ce qui engage ». Ne commentez pas davantage, la salle a compris.",
        faq: [
          {
            question: "Pourquoi il ne remplit pas les consignes, il les connaît sûrement ?",
            reponse:
              "Il en connaît de plausibles, pas les vôtres. Vos consignes viennent de vos documents visés, adaptés à vos machines et à votre site. Une consigne plausible et fausse, appliquée, blesse quelqu'un.",
          },
        ],
        blocages: [
          {
            situation:
              "Malgré la consigne, la sortie rédige une phrase de sécurité au lieu de laisser l'emplacement.",
            parade:
              "Le montrer, l'entourer, et le dire : la contrainte réduit le risque, elle ne le supprime pas. C'est exactement pour cela que la relecture et le visa restent obligatoires — l'incident vaut mieux qu'un discours.",
          },
        ],
        planB:
          "La trame vide et la causerie remplie sont imprimées dans le kit, datées, avec les emplacements de visa déjà surlignés. La démonstration se tient à l'identique sur papier.",
      },
    },
    pratique: {
      consigne:
        "Quatre temps. 1) La chasse à l'erreur, chronométrée : on fait produire un texte sur VOTRE process, chacun l'imprime et surligne au feutre tout ce qu'il sait faux — on comptera. 2) À partir des trames fournies, préparez un document réel de votre atelier : causerie sécurité, analyse d'un aléa, ou fiche de non-conformité et action corrective. 3) Relecture croisée en binôme sur la grille, puis reprise et marquage de l'emplacement du visa HSE avant classement. 4) À partir d'indicateurs DÉJÀ CALCULÉS par votre système — TRS, rebuts, plan de charge, ou le jeu fourni si vous n'avez pas les vôtres — rédigez le commentaire du mois de votre atelier, et pointez chaque chiffre cité contre sa source avant de classer.",
      aEmporter:
        "Votre tableau personnel des erreurs types relevées sur votre propre process, un document de sécurité prêt au visa, et le commentaire du mois de vos indicateurs avec chaque chiffre pointé contre sa source.",
      dureeMin: 130,
      notes: {
        script:
          "Sur la chasse à l'erreur : IMPRIMEZ, distribuez un feutre, et faites surligner sur papier — à l'écran, personne ne surligne et tout le monde survole. Comptez les repérages à main levée AVANT de corriger, et écrivez le score au tableau. La salle sous-estime toujours, et le chiffre affiché vaut mieux que tout discours sur la vigilance. Entre le troisième et le quatrième temps, posez la règle du calcul avant que quiconque ouvre un tableur : on ne fait JAMAIS calculer l'IA, le chiffre vient de votre système, l'IA n'écrit que le commentaire autour. Sur le plan de charge, dites-le tel quel : c'est le seul endroit de ces deux jours où l'IA touche à la planification, et c'est délibéré — elle COMMENTE une charge que votre GPAO a calculée, elle ne la calcule pas et ne la réordonnance pas. Sur les documents de sécurité : vous n'arbitrez rien. La formule se prononce telle quelle, « je ne me prononce pas, notez la question, votre référent QSE tranchera », et la question s'écrit au tableau — la liste des questions ouvertes est une production utile de la matinée.",
        faq: [
          {
            question: "Le TRS qu'il m'a sorti tombe juste, pourquoi je ne peux pas m'en servir ?",
            reponse:
              "Il tombe juste cette fois, et vous n'aviez aucun moyen de le savoir avant de vérifier. C'est pour cela que la règle n'est pas « vérifiez le calcul » mais « ne faites pas calculer ».",
          },
          {
            question: "On peut lui faire proposer un réordonnancement du plan de charge ?",
            reponse:
              "Non. Il ne connaît ni vos temps de changement de format, ni vos aléas d'approvisionnement, ni vos contraintes d'équipe. Il commente la charge que votre système a calculée ; c'est votre système qui ordonnance.",
          },
          {
            question: "Notre causerie doit-elle être signée par les participants ?",
            reponse:
              "Je ne me prononce pas, notez la question, votre référent QSE tranchera. La trame prévoit l'emplacement ; ce qu'on en fait relève de vos règles internes.",
          },
        ],
        blocages: [
          {
            situation:
              "La chasse à l'erreur ne donne presque rien, la salle trouve le texte correct.",
            parade:
              "Distribuer le texte du kit sur un process générique, qui en contient sept dont deux invisibles sans ouvrir le document source. Puis relancer sur leur propre impression : l'œil est réglé.",
          },
          {
            situation: "Un participant veut faire calculer un TRS « juste pour voir ».",
            parade:
              "Le laisser faire, puis lui demander de poser à côté le chiffre de son système. Faites lire l'écart à voix haute. Une seule démonstration de ce type suffit pour toute la salle.",
          },
          {
            situation:
              "Un participant insiste pour savoir si son document est réglementairement conforme.",
            parade:
              "Formule exacte, prononcée telle quelle : « je ne me prononce pas, notez la question, votre référent QSE tranchera ». Écrire la question au tableau et passer au suivant. Ne jamais donner un demi-avis, il sera cité comme un avis.",
          },
        ],
        planB:
          "Outil indisponible : la chasse à l'erreur se fait sur le texte imprimé du kit, les trois trames de document se remplissent à la main, et le commentaire d'indicateurs s'écrit à partir du jeu d'indicateurs papier fourni. C'est l'atelier le plus robuste des deux jours — gardez-le complet même si tout le reste a été dégradé.",
      },
    },
    verification: {
      question:
        "Deux temps. Mise en commun des surlignages : on construit ensemble au tableau la liste des erreurs types — référence inventée, étape sautée, chiffre plausible et faux, consigne de sécurité adoucie — et chacun écrit ce qu'il change dans sa relecture. Puis cinq questions corrigées en salle : citez deux erreurs types et le signe qui les trahit ; d'où vient un chiffre cité dans un commentaire d'indicateurs ; que fait l'IA sur un plan de charge, et que ne fait-elle jamais ; qui vise une causerie sécurité ; que faites-vous d'une consigne que l'IA a reformulée ?",
      reponseAttendue:
        "La quatrième erreur type — la consigne de sécurité adoucie — est celle que la salle trouve le moins, et c'est la seule qui blesse quelqu'un ; si personne ne l'a relevée, elle se montre sur le texte du kit. Aux cinq questions : un chiffre vient du système qui l'a calculé et se recopie ; l'IA commente une charge déjà calculée et ne l'ordonnance jamais ; la causerie repart au responsable HSE avant affichage ; une consigne reformulée se jette et se recopie depuis le document visé.",
      dureeMin: 25,
      notes: {
        script:
          "Construisez le tableau des erreurs types AVEC la salle, ne le projetez pas tout fait : les quatre catégories doivent sortir de leurs surlignages, sinon elles restent un slide. Écrivez au tableau, en face de chaque erreur type, le SIGNE qui la trahit — une référence trop ronde, une étape qui ne mentionne aucun outil, un chiffre sans unité, une consigne au conditionnel. Terminez par la consigne adoucie et laissez le silence : c'est la seule ligne du tableau qui envoie quelqu'un à l'infirmerie.",
        faq: [
          {
            question:
              "Comment on repère une consigne « adoucie » si on ne connaît pas l'originale ?",
            reponse:
              "On ne la repère pas, et c'est pour cela qu'on ne la fait pas écrire. Une consigne ne se relit pas : elle se recopie depuis le document visé.",
          },
        ],
        blocages: [
          {
            situation: "La mise en commun tourne au concours de la pire sortie et déborde.",
            parade:
              "Limiter à un exemple par erreur type, chronomètre affiché. Les autres exemples se notent sur la fiche personnelle, pas au tableau.",
          },
        ],
        planB: "Le tableau des erreurs types et le corrigé des cinq questions sont dans le kit.",
      },
    },
    synthese: {
      acquis: [
        "Je compte les erreurs de la machine sur mon propre process, au lieu de supposer qu'elle a raison.",
        "Je prépare causerie, analyse d'aléa et fiche de non-conformité sur trame, et je les fais viser avant affichage.",
        "Je recopie tout chiffre depuis le système qui l'a calculé — l'IA n'écrit que le commentaire autour.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites nommer à voix haute « les trois documents que je ne repousserai plus », un par personne, en trois mots. Puis faites CLASSER dans le classeur avant la coupure du midi — un document préparé et non classé sera refait dans trois semaines. Annoncez l'après-midi en une phrase : « on va automatiser un relevé d'atelier, et surtout on va voir ce qu'on n'automatise jamais sur une personne ».",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 4 — Après-midi J2 : automatiser un relevé, jamais un jugement
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-4",
    objectif: {
      enonce:
        "À la fin de ce module, vous savez ce qui ne s'automatise jamais sur une personne, et vous faites tourner un suivi hebdomadaire sur votre propre relevé d'atelier.",
      objectifGlobalId: "obj-8",
      // La grille d'auto-évaluation de fin de journée rejuge toutes les
      // productions des deux jours sur une ligne éliminatoire — « points de
      // sécurité recopiés et emplacement de visa marqué » : une production dont
      // un point de sécurité a été rédigé par l'outil est refusée.
      objectifsSecondairesIds: ["obj-3"],
      dureeMin: 5,
      notes: {
        script:
          "Annoncez l'ordre de l'après-midi et pourquoi il est dans cet ordre : on regarde d'abord ce qu'on n'automatise pas, on prototype ensuite. L'inverse produirait des prototypes à jeter, et le temps d'un chef d'équipe ne se jette pas. Annoncez le résultat de 17 h : un suivi hebdomadaire qui tourne sur SON relevé, éprouvé sur un cas limite. Reprenez enfin le tableau des doléances du premier matin — c'est ici qu'on y répond, ou qu'on dit honnêtement qu'on n'y répond pas.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "Le relevé d'atelier arrive en colonnes désordonnées : des dates au format américain sur trois lignes et français sur les autres, des kilos et des tonnes mélangés, des cellules vides, et des commentaires libres écrits dans la colonne des quantités. Le remettre au propre prend la moitié du vendredi après-midi.",
      apres:
        "Le même relevé, avec une consigne qui dit ce qu'on attend colonne par colonne et ce qu'on fait des trous, ressort en suivi hebdomadaire lisible — et surtout il SIGNALE en fin de sortie ce qu'il n'a pas su interpréter, au lieu de le combler en silence.",
      prompt:
        "Voici un relevé d'atelier brut, copié tel quel depuis mon fichier de suivi.\nMets-le en forme en un suivi hebdomadaire, une ligne par semaine, avec ces colonnes et aucune autre : semaine (numéro), ligne de production, quantité produite, unité, nombre d'arrêts, commentaire.\nRègles de traitement, à appliquer sans exception : ne convertis aucune unité, recopie l'unité telle qu'elle est écrite ; ne calcule aucun total, aucune moyenne, aucun taux ; laisse vide toute cellule que la source ne renseigne pas et n'estime rien.\nNe reprends aucun nom de personne présent dans le relevé : remplace-le par le libellé du poste.\nTermine par une rubrique « LIGNES DOUTEUSES » où tu listes chaque ligne que tu n'as pas su interpréter, avec la raison : date ambiguë, unité absente, quantité non numérique, doublon apparent.",
      outil: "Un seul outil, celui validé dans la salle.",
      captureEcran:
        "Le relevé brut à gauche, le suivi hebdomadaire à droite, et en bas la rubrique « LIGNES DOUTEUSES » entourée — avec la ligne où « 1,2 » pouvait être des tonnes ou des kilos et n'a pas été tranchée.",
      verifieLe: VERIFIE_LE,
      dureeMin: 15,
      notes: {
        script:
          "Faites la démonstration sur un relevé VRAIMENT sale, celui du kit, pas sur un tableau propre : un relevé propre ne prouve rien et la salle le sait. Lancez d'abord sans les règles de traitement et laissez l'outil convertir des kilos en tonnes de son propre chef — c'est le moment qui fait basculer l'après-midi. Puis ajoutez les règles et relancez. Terminez sur la rubrique des lignes douteuses et posez la question à la salle : « qui va lire cette rubrique le lundi matin, et à quelle heure ? ». S'ils n'ont pas de réponse, le prototype ne tiendra pas trois semaines.",
        faq: [
          {
            question: "Pourquoi lui interdire de convertir les unités, ce serait bien pratique ?",
            reponse:
              "Parce qu'une conversion silencieuse dans un suivi de production ne se voit jamais et fausse tout le mois. Recopiez l'unité, et convertissez vous-même si vous en avez besoin — vous saurez au moins que vous l'avez fait.",
          },
        ],
        blocages: [
          {
            situation: "La sortie calcule un total malgré la consigne.",
            parade:
              "L'entourer et le supprimer devant la salle. Puis énoncer la règle qui en découle : un prototype se relit sur ce qu'il n'aurait PAS dû faire, pas seulement sur ce qu'il a fait.",
          },
        ],
        planB:
          "Le relevé brut, la sortie sans règles et la sortie avec règles sont imprimés dans le kit, datés. La comparaison colonne par colonne se tient à l'identique sur papier.",
      },
    },
    pratique: {
      consigne:
        "Quatre temps. 1) Passez VOTRE idée d'automatisation au test des quatre questions et écrivez votre verdict sur la fiche fournie ; les cas litigieux sont arbitrés en salle. 2) Construisez le suivi hebdomadaire de votre propre relevé d'atelier — uniquement si votre cas a passé le test. 3) Fiabilisez : faites tourner votre jeu d'essai, glissez-y un cas limite (ligne vide, unité changée en cours de mois, semaine à quatre jours), puis écrivez le signal à émettre quand le résultat est douteux et votre procédure de retour arrière. 4) Assemblez et nommez votre classeur de bord d'atelier, et notez où vous le rangez pour le rouvrir lundi.",
      aEmporter:
        "Votre fiche de qualification remplie et datée, votre suivi hebdomadaire éprouvé sur un cas limite avec son signal de doute et sa procédure de retour arrière écrits, et le classeur de bord d'atelier complet et nommé.",
      dureeMin: 110,
      notes: {
        script:
          "Le test des quatre questions se remplit AVANT d'ouvrir l'outil, sur la fiche papier, et la fiche se garde même quand le verdict est « on arrête » — c'est la trace qui protège le chef d'équipe. Rappelez la règle avant de lancer : une seule réponse « oui » stoppe le prototype et renvoie la question à la direction et au CSE. Sur le troisième temps, insistez : un prototype qui n'a jamais vu de cas limite n'a jamais été testé, il a seulement été essayé. Faites écrire deux phrases, pas un paragraphe — « quel signal, à qui » et « que fais-je lundi si c'est faux ». La réponse « je reprends le fichier de la semaine dernière » est parfaitement valable ; encore faut-il qu'elle soit écrite et que le fichier existe. Sur le quatrième temps, énumérez les huit pièces du classeur à voix haute et faites cocher : liste rouge, consigne de poste, compte rendu de poste, mode opératoire, document visé, commentaire d'indicateurs, suivi hebdomadaire, procédure de retour arrière.",
        faq: [
          {
            question:
              "Suivre les rebuts par opérateur, ce n'est pas du flicage, c'est de la qualité.",
            reponse:
              "L'intention ne change pas la qualification. Suivre les cadences, les temps par poste ou les rebuts par opérateur relève du suivi de la performance et du comportement des travailleurs — usage à haut risque, information préalable des salariés et de leurs représentants, consultation du CSE avant mise en œuvre. Ce n'est pas un avis, ce sont les textes du kit ; lisez-les et faites-les lire à votre direction.",
          },
          {
            question: "Mon cas ne passe pas le test, je fais quoi de mon après-midi ?",
            reponse:
              "Vous prenez le relevé d'atelier de secours du kit et vous construisez le suivi dessus. Vous repartirez avec le geste, et avec une fiche de qualification qui explique noir sur blanc pourquoi votre idée initiale s'arrête.",
          },
          {
            question: "Qui doit lire le signal quand le résultat est douteux ?",
            reponse:
              "Quelqu'un de nommé, avec un jour et une heure. Un signal envoyé à une boîte générique n'est pas lu, et un suivi dont personne ne lit les alertes est plus dangereux que pas de suivi du tout.",
          },
        ],
        blocages: [
          {
            situation:
              "Un participant veut absolument prototyper un suivi de cadence par opérateur, « c'est déjà dans la GPAO ».",
            parade:
              "Ne pas argumenter sur l'outil, revenir au test : « est-ce qu'il y a un effet sur une personne ? ». Il répond oui. Le prototype s'arrête, la fiche se remplit, la question part à la direction et au CSE. C'est le point de l'après-midi où l'on ne négocie pas.",
          },
          {
            situation: "Le relevé apporté contient les noms des opérateurs en clair.",
            parade:
              "Faire remplacer les noms par les libellés de poste AVANT tout dépôt, sur le fichier local. La règle du prompt ne dispense pas du geste : ce qui n'est pas déposé ne peut pas fuir.",
          },
          {
            situation: "Un participant a laissé son relevé au bureau et n'a rien à traiter.",
            parade:
              "Relevé de secours du kit, immédiatement, sans commentaire. Ne le laissez pas regarder son voisin travailler pendant quarante-cinq minutes — c'est le meilleur moyen de perdre la fin de formation.",
          },
        ],
        planB:
          "Outil indisponible : le test des quatre questions et la fiche de qualification ne dépendent d'aucun outil, le suivi hebdomadaire se construit à la main sur la trame du kit à partir du relevé imprimé, et le cas limite se traite au crayon. L'assemblage du classeur se fait en pochette cartonnée. Gardez les quatre temps, ne sacrifiez ni le test ni l'assemblage.",
      },
    },
    verification: {
      question:
        "Évaluation des acquis : quiz individuel de dix questions, corrigé en salle question par question. Puis chacun évalue sa production d'atelier des deux jours sur la grille fournie — exactitude des faits et des chiffres, points de sécurité recopiés et emplacement de visa marqué, structure des écrits, réutilisabilité lundi matin.",
      reponseAttendue:
        "Le corrigé se commente question par question, sans en sauter aucune ; le seuil de réussite est celui déclaré au programme, et un score en dessous déclenche la reprise individuelle prévue au dispositif. Sur la grille, la ligne « points de sécurité » ne se moyenne pas avec les autres : une production dont un point de sécurité a été rédigé par l'outil est refusée, quel que soit le reste.",
      dureeMin: 25,
      notes: {
        script:
          "C'est l'évaluation des acquis au sens de l'indicateur 11 : elle se tient, elle se corrige, elle se conserve. Ne la sacrifiez jamais au temps qui manque — si vous êtes en retard, coupez sur l'assemblage du classeur, pas ici. Sur la grille d'auto-évaluation, annoncez la règle avant de distribuer : la ligne sécurité est éliminatoire et ne se compense pas. Dans un atelier, une moyenne qui absorbe un défaut de sécurité est une moyenne qui ment.",
        faq: [
          {
            question: "Le résultat va être transmis à mon responsable ?",
            reponse:
              "Le résultat individuel ne l'est pas. Ce qui est transmis, c'est l'attestation de fin de formation et le fait que l'évaluation a eu lieu.",
          },
        ],
        blocages: [
          {
            situation: "Il est 16 h 40 et le quiz n'est pas commencé.",
            parade:
              "Le tenir quand même, en réduisant le commentaire du corrigé aux questions les plus ratées. On ne remplace jamais l'évaluation des acquis par un tour de table.",
          },
        ],
        planB:
          "Quiz papier et corrigé dans le kit, grille d'auto-évaluation imprimée. Aucune dépendance à un outil.",
      },
    },
    synthese: {
      acquis: [
        "Je passe toute idée d'automatisation au test des quatre questions avant d'ouvrir un outil, et une seule réponse « oui » l'arrête.",
        "Je fais tourner un suivi hebdomadaire sur mon relevé d'atelier, éprouvé sur un cas limite, avec un signal de doute et un retour arrière écrits.",
        "Je n'automatise jamais un suivi de cadence, de temps de poste ou de rebuts par opérateur sans information des salariés et consultation du CSE.",
      ],
      dureeMin: 10,
      notes: {
        script:
          "Chacun nomme à voix haute TROIS usages et UNE automatisation à installer, avec un porteur et une échéance par ligne. Sans nom et sans date, une feuille de route ne se réalise pas — et dans un atelier, la semaine qui suit une formation est toujours la pire de l'année. Reprenez le tableau des doléances du premier matin et dites ce qui a été couvert et ce qui ne l'a pas été : l'honnêteté sur ce dernier point achète toute la crédibilité du reste. Notez la feuille de route au tableau, prenez une photo, envoyez-la au groupe et au commanditaire.",
        faq: [
          {
            question: "Et si mon référent QSE refuse de viser mes documents ?",
            reponse:
              "Alors ils ne s'affichent pas, et c'est le système qui fonctionne. Notez son motif : c'est souvent une question de forme qui se corrige en dix minutes, et la trame prévoit l'emplacement pour ça.",
          },
        ],
        blocages: [
          {
            situation: "Les engagements restent vagues : « je vais essayer d'utiliser l'IA ».",
            parade:
              "Reformuler en une question : « sur quel écrit, et quel jour de la semaine prochaine ? ». Ne pas passer au suivant tant que la réponse ne porte pas un écrit nommé et un jour.",
          },
          {
            situation:
              "Un participant repart en annonçant qu'il va automatiser le suivi des temps de ses opérateurs.",
            parade:
              "Le rattraper avant qu'il sorte, ressortir sa fiche de qualification, et lui faire écrire la question à poser à sa direction et au CSE. C'est la dernière chose que vous faites de la formation, et c'est peut-être la plus utile.",
          },
        ],
        planB: "Aucun outil en jeu : la feuille de route s'écrit au paperboard et se photographie.",
      },
    },
  },
];
