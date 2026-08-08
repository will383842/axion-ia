/**
 * CONTENU RÉDIGÉ — « IA pour la finance » (1 jour, 7 h, 4 modules).
 *
 * ## Le découpage suit le catalogue
 *
 * Le catalogue découpe cette journée en QUATRE modules : le partage des rôles
 * et l'analyse de documents (`mod-1`), le tableur assisté et les trames de
 * contrôle (`mod-2`), écrire autour du chiffre (`mod-3`), fiabilité et ancrage
 * (`mod-4`). Chaque module porte ici SA démonstration avec SON prompt en
 * entier, sa pratique, sa vérification et sa synthèse — rien n'est agrégé.
 *
 * ## Le fil rouge
 *
 * Chacun repart avec UN classeur de clôture assistée, monté pièce par pièce :
 * `mod-1` y verse la ligne de partage et une synthèse de document long,
 * `mod-2` une formule documentée et une trame de contrôle, `mod-3` le
 * commentaire de gestion et la séquence de relance, `mod-4` la règle de
 * relecture du service et le classeur assemblé, nommé, avec son titulaire.
 * L'ordre est l'enseignement : on pose ce qui ne sort pas avant de produire
 * quoi que ce soit.
 *
 * ## Trois règles que le formateur ne négocie pas
 *
 * **Les chiffres restent dans les systèmes du client.** L'IA travaille sur ce
 * qui les entoure — lire, résumer, commenter, contrôler. Tout chiffre qu'elle
 * produit est traité comme faux jusqu'à vérification à sa source, et toute
 * formule obtenue se teste sur un cas dont on connaît déjà le résultat.
 *
 * **Aucun document financier réel confidentiel n'est déposé dans un outil
 * pendant la journée.** Les ateliers tournent sur le matériel du kit. La
 * qualification, elle, se pratique sur le document du stagiaire — à la main,
 * sur la grille, sans rien déposer. Un stagiaire qui ouvre son fichier des
 * écritures ou une balance nominative est arrêté, sans discussion.
 *
 * **L'IA n'est JAMAIS la source d'une réponse comptable, fiscale ou
 * réglementaire.** Elle reformule un texte qu'on lui fournit, et c'est ce texte
 * qu'on cite. Le formateur n'arbitre aucune question de fond : la formule est
 * écrite et se prononce telle quelle — « je ne me prononce pas, notez la
 * question, votre conseil tranchera ».
 *
 * ⚠️ Les références juridiques citées dans les séquences `cadre` du catalogue
 * (art. 22 du RGPD, annexe III du règlement (UE) 2024/1689) sont fournies au
 * formateur SOURCÉES ET DATÉES dans le kit et ne se citent jamais de mémoire.
 * Leur formulation reste à faire relire par le conseil de l'organisme.
 */

import type { EnrichissementFormation } from "./types";

/** Date de dernière vérification des captures et sorties d'outils. */
const VERIFIE_LE = "2026-08-06";

export const IA_POUR_LA_FINANCE: EnrichissementFormation = [
  // ───────────────────────────────────────────────────────────────────────────
  // Module 1 — Le partage des rôles et l'analyse de documents
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-1",
    objectif: {
      enonce:
        "À la fin de ce module, vous qualifiez un document financier dans son régime d'usage avant de l'ouvrir dans un outil, vous en tirez une synthèse dont chaque affirmation renvoie à une page, et vous savez précisément ce que l'IA ne calculera pas.",
      objectifGlobalId: "obj-1",
      // Le module pose aussi la liste rouge et les trois régimes d'usage : c'est
      // lui qui installe les règles de confidentialité de toute la journée.
      objectifsSecondairesIds: ["obj-5"],
      dureeMin: 10,
      notes: {
        script:
          "Tour de table en UNE phrase, pas une par personne qui s'étale : « votre prénom, et le document qui vous prend le plus de temps à lire ». Notez chaque réponse au tableau, vous y reviendrez à 17 h. Écrivez ensuite au paperboard la phrase qui tient la journée et laissez-la affichée : les chiffres restent dans vos systèmes, l'IA travaille sur tout ce qui les entoure. Annoncez le livrable, c'est ce qui achète l'attention : chacun repart avec son classeur de clôture assistée, monté pièce par pièce sur les quatre modules.",
        faq: [
          {
            question: "On va enfin pouvoir fiabiliser nos rapprochements ?",
            reponse:
              "Oui — et sous la forme exacte que le programme annonce : une trame de contrôle déroulable, que vous construirez au module suivant. Un modèle de langage ne calcule pas, il rédige le calcul le plus probable — vous le constaterez vous-même dans une heure. L'IA écrit la liste des points à vérifier, une autre personne peut la dérouler, la cocher et la signer. C'est moins spectaculaire qu'un rapprochement automatique, et c'est opposable.",
          },
          {
            question: "Notre expert-comptable nous a dit de ne rien mettre dans ces outils.",
            reponse:
              "Il a raison sur le fichier des écritures, sur la balance nominative et sur toute pièce de paie — cette liste rouge sera écrite au tableau avant le premier atelier. Il n'a pas dit que la fonction finance ne devait rien en faire : les trois régimes d'usage servent précisément à trancher document par document, au lieu de trancher une fois pour toutes.",
          },
        ],
        blocages: [
          {
            situation: "Le tour de table dérive sur les défauts de l'ERP et de l'outil de saisie.",
            parade:
              "Couper avec « on note, et on regarde à 17 h si l'IA change quelque chose là-dessus », puis écrire la plainte au tableau. La reprendre en fin de journée vaut beaucoup mieux qu'une promesse en début de journée.",
          },
          {
            situation:
              "Un stagiaire annonce d'emblée que « l'IA se trompe sur les chiffres, donc c'est inutile ».",
            parade:
              "Lui donner raison immédiatement et lui confier le chronomètre de l'atelier « faites-la se tromper ». Il obtiendra la démonstration de ce qu'il affirme, et la salle l'entendra de lui plutôt que de vous.",
          },
        ],
        planB:
          "Aucun outil n'est nécessaire ici. Sans vidéoprojecteur, le tour de table, la liste rouge et la phrase du jour se tiennent au paperboard sans rien perdre — la liste rouge s'écrit de toute façon à la main, avec les mots du service, jamais projetée toute faite.",
      },
    },
    demonstration: {
      avant:
        "« Résume-moi ce rapport et dis-moi ce qui ne va pas. » La sortie est fluide, elle avance des montants, elle conclut. Rien n'est rattaché à une page, et deux des chiffres cités ne figurent nulle part dans le document.",
      apres:
        "La même demande cadrée par les cinq leviers AXION, avec interdiction de recalculer et obligation de citer la page. La synthèse devient vérifiable en trois minutes, et ce que le document ne dit pas apparaît en creux au lieu d'être comblé.",
      prompt:
        "DÉMONSTRATION — Analyse d'un document financier long, méthode AXION\n\nActeur : tu es contrôleur de gestion dans une PME industrielle de 60 personnes.\nConteXte : je te dépose le rapport du commissaire aux comptes sur l'exercice clos, 34 pages, document fourni au kit de formation.\nIntention : préparer ma réunion avec le dirigeant sans avoir à relire les 34 pages.\nOutput : une synthèse d'une page — cinq constats, chacun suivi entre parenthèses de la page du document où il figure ; puis trois questions à poser à l'émetteur du rapport.\nNormes : n'utilise QUE le document joint. Ne recalcule aucun montant, ne fais aucune addition, aucune moyenne, aucun pourcentage — recopie les chiffres tels qu'ils sont écrits. Si un constat n'est rattachable à aucune page, ne l'écris pas. N'ajoute aucune recommandation.",
      outil: "Un seul outil, celui validé dans la salle (Claude ou ChatGPT selon le groupe).",
      captureEcran:
        "Les deux synthèses du rapport côte à côte, avec en rouge les deux montants absents du document source, et les cinq leviers AXION annotés en marge du prompt cadré.",
      verifieLe: VERIFIE_LE,
      dureeMin: 15,
      notes: {
        script:
          "Lancez la demande spontanée sur le rapport du kit et LISEZ LA SORTIE À VOIX HAUTE avec conviction : la salle doit la trouver bonne avant qu'on l'abatte. Envoyez ensuite deux stagiaires chercher dans le document imprimé les deux montants annoncés — ils ne les trouveront pas. Ce moment-là tient toute la journée : ne le racontez pas, faites-le faire. Enchaînez sur la version cadrée. Écrivez AXION au tableau et laissez-le affiché jusqu'au soir : Acteur, conteXte, Intention, Output, Normes.",
        faq: [
          {
            question:
              "Pourquoi lui interdire de recalculer ? C'est justement ce qu'on attend d'elle.",
            reponse:
              "Parce qu'elle ne calcule pas, elle rédige un calcul. Vous le vérifierez cet après-midi : le même total demandé deux fois donne deux résultats. Interdire le recalcul n'est pas une précaution de confort, c'est ce qui rend la sortie utilisable sans la refaire.",
          },
          {
            question: "La liasse fiscale, on peut la déposer ? Les comptes sont publics.",
            reponse:
              "Les comptes déposés le sont, la liasse et ses annexes ne le sont pas toutes. Je ne me prononce pas sur votre cas : notez la question, votre conseil tranchera. Pour aujourd'hui, on travaille sur le document du kit.",
          },
        ],
        blocages: [
          {
            situation:
              "La demande spontanée produit une sortie honnête, sans aucun montant inventé — la démonstration tombe à plat.",
            parade:
              "Relancer en ajoutant « donne les trois chiffres clés de l'exercice ». La contrainte de chiffrage déclenche presque toujours l'invention. Si elle ne la déclenche pas, le dire franchement : « vous ne pouviez pas le savoir à l'avance, c'est exactement le problème », puis passer aux sorties du kit.",
          },
          {
            situation:
              "Un stagiaire ouvre son propre fichier des écritures ou une balance nominative pour « essayer avec du vrai ».",
            parade:
              "Arrêter immédiatement, sans négocier, et rappeler la liste rouge en une phrase. C'est le seul point de la journée où l'on ne discute pas.",
          },
        ],
        planB:
          "Quota atteint, réseau tombé ou service indisponible : les deux sorties — spontanée et cadrée — sont imprimées dans le kit formateur (datées), montants inventés déjà entourés, et le rapport du commissaire aux comptes est fourni imprimé. La recherche des deux montants dans le document se tient à l'identique sur papier — c'est même là qu'elle est la plus frappante. N'improvisez aucune démonstration de remplacement en direct : les sorties du kit ont été vérifiées, les vôtres ne le seront pas.",
      },
    },
    pratique: {
      consigne:
        "Deux temps chronométrés. (1) Faites-la se tromper : demandez à l'outil de lettrer les deux extraits du kit, de recalculer le total de la page 3 et de prévoir un atterrissage à partir des trois lignes fournies au kit — relevez PAR ÉCRIT chaque erreur produite, on en tire la ligne de partage écrite au tableau. (2) Qualifiez à la main, sur la grille, un document long de votre propre service (rapport, liasse, note d'un commissaire aux comptes, contrat de prêt), puis travaillez sur le document équivalent du kit : tirez-en une synthèse structurée et trois questions à poser à son émetteur.",
      aEmporter:
        "La ligne de partage écrite de votre main (ce que l'IA rédige, ce qu'elle ne calculera jamais) et une synthèse de document long avec ses trois questions à l'émetteur — premières pièces du classeur de clôture assistée.",
      dureeMin: 45,
      notes: {
        script:
          "Annoncez le chronomètre à voix haute toutes les cinq minutes, sur les deux temps. Temps 1 : ne corrigez RIEN pendant l'exercice, laissez les erreurs s'accumuler. Tracez ensuite deux colonnes au tableau — « elle rédige » et « elle ne calcule pas » — et faites-les remplir par la salle. La ligne de partage doit être écrite par eux, sinon elle n'est pas retenue. Temps 2 : dites-le au démarrage de l'atelier et pas seulement en ouverture de journée — on qualifie le sien, on dépose celui du kit.",
        faq: [
          {
            question: "Pourquoi je ne peux pas déposer mon vrai rapport ? Il n'est pas nominatif.",
            reponse:
              "Peut-être, et ce n'est pas à moi de le dire aujourd'hui. La règle de la journée est simple parce qu'elle doit tenir sans arbitrage : on qualifie le sien sur la grille, on dépose celui du kit. Vous déposerez le vôtre lundi, une fois votre régime d'usage validé chez vous.",
          },
        ],
        blocages: [
          {
            situation:
              "L'outil réussit le lettrage des deux extraits et le total de la page 3 tombe juste — le temps 1 ne produit aucune erreur.",
            parade:
              "Faire relancer la même demande dans une conversation neuve et comparer les deux sorties, puis exiger l'atterrissage : la projection à partir de trois lignes produit presque toujours un chiffre invérifiable. À défaut, les sorties fautives imprimées du kit alimentent la ligne de partage à l'identique.",
          },
          {
            situation: "Un stagiaire qualifie son document en « déposable » pour aller plus vite.",
            parade:
              "Lui faire justifier la case cochée à voix haute, critère par critère, sur la grille. Si un seul critère hésite, le document est traité comme non déposable — c'est la règle de la grille, pas la vôtre.",
          },
        ],
        planB:
          "Réseau ou outil indisponibles : les deux temps se tiennent sur papier. Le temps 1 utilise les sorties fautives imprimées du kit, le temps 2 la synthèse imprimée à corriger — la qualification sur grille, elle, ne dépend d'aucun outil par construction.",
      },
    },
    verification: {
      question:
        "Contrôle croisé en binôme, grille fournie, sur les productions de l'autre : le régime d'usage retenu pour le document était-il le bon ? quelle affirmation de la synthèse ne figure pas dans le document source ? quel chiffre a été repris sans être vérifié à la page citée ?",
      reponseAttendue:
        "Chaque affirmation non rattachée à une page est BARRÉE sur la copie du binôme, chaque chiffre non vérifié entouré. Le corrigé projeté ensuite montre les trois formes que prend une affirmation non sourcée : le chiffre arrondi, la cause supposée, et la comparaison avec un exercice précédent qui n'a jamais été fourni.",
      dureeMin: 10,
      notes: {
        script:
          "Contrôle CROISÉ, jamais auto-correction : chaque binôme relit celui d'à côté. Faites barrer physiquement, au stylo, sur la copie de l'autre — une page rendue avec quatre phrases barrées se retient mieux qu'un discours sur la vigilance. Projetez le corrigé après, jamais avant, et ne commentez que les deux ou trois écarts qui se répètent dans la salle : le reste se lit sur le corrigé.",
        faq: [
          {
            question: "On note ? Ça compte ?",
            reponse:
              "Pas ici. L'évaluation des acquis est en fin de journée, sur dix questions. Ce contrôle sert à repérer ce qui coince pendant qu'on peut encore le corriger.",
          },
          {
            question: "Mon binôme n'a rien trouvé, ma synthèse est donc bonne ?",
            reponse:
              "Elle est peut-être bonne. Ou l'œil de votre binôme n'est pas encore réglé, ce qui est normal au premier passage. Reprenez-la avec le corrigé, chiffre par chiffre.",
          },
        ],
        blocages: [
          {
            situation: "Les binômes se valident mutuellement sans rien relever.",
            parade:
              "Annoncer que chaque binôme devra remonter AU MOINS un écart à l'oral, puis en demander un. La complaisance tombe immédiatement.",
          },
        ],
        planB:
          "Grille et corrigé sont imprimés dans le kit. Sans vidéoprojecteur, le corrigé se distribue et se commente à l'oral, écart par écart.",
      },
    },
    synthese: {
      acquis: [
        "Je qualifie un document dans son régime d'usage avant de l'ouvrir dans un outil, et je sais qu'en retirer les noms ne suffit pas.",
        "Je sais ce que l'IA ne calculera pas : elle rédige, et tout chiffre qu'elle avance se vérifie à sa source.",
        "Je synthétise un document long et chaque affirmation de ma synthèse renvoie à une page.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites-les FORMULER, ne récitez pas : « en une phrase, qu'est-ce que vous ne ferez plus à partir de maintenant ? ». Trois réponses suffisent. Annoncez le module suivant en une phrase : le tableur — et personne n'y collera la moindre cellule.",
        faq: [],
        blocages: [
          {
            situation: "La salle est encore sur la démonstration et personne ne formule d'acquis.",
            parade:
              "Ne pas insister : énoncer les trois acquis vous-même et enchaîner. Un acquis récité à contrecœur ne s'ancre pas mieux qu'un acquis énoncé par le formateur.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 2 — Le tableur assisté et les trames de contrôle
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-2",
    objectif: {
      enonce:
        "À la fin de ce module, vous obtenez une formule ou un croisement de tableur en décrivant seulement la structure de vos colonnes — aucune donnée ne quitte votre fichier — et vous produisez une trame de contrôle qu'une autre personne peut dérouler, cocher et signer.",
      objectifGlobalId: "obj-2",
      // Décrire une structure sans livrer de données est un geste de
      // confidentialité autant que de méthode : le module sert aussi obj-5.
      objectifsSecondairesIds: ["obj-5"],
      dureeMin: 5,
      notes: {
        script:
          "Cinq minutes au retour de la pause. Annoncez la règle du module et laissez la salle réagir, c'est le point qui surprend le plus : personne ne collera la moindre cellule dans l'outil, on décrira seulement les en-têtes de colonnes. Annoncez ensuite la seconde moitié du module : le rapprochement, traité sous la forme que le programme promet — une trame de contrôle que l'IA rédige et que l'humain coche et signe.",
        faq: [
          {
            question:
              "Si elle ne voit pas mes données, comment peut-elle donner la bonne formule ?",
            reponse:
              "Parce qu'une formule dépend de la structure, pas des valeurs : nom des colonnes, type de contenu, position des en-têtes. C'est exactement ce qu'on va décrire — et rien d'autre.",
          },
        ],
        blocages: [
          {
            situation:
              "Un stagiaire pressé veut « juste coller le fichier, il n'y a rien de confidentiel dedans ».",
            parade:
              "Renvoyer à la grille du module 1 : si le fichier n'a pas été qualifié, il ne se dépose pas. Et lui montrer que la description des en-têtes est plus rapide que l'anonymisation qu'il s'apprêtait à improviser.",
          },
        ],
        planB: "Aucun outil en jeu pour l'annonce : la règle du module s'écrit au paperboard.",
      },
    },
    demonstration: {
      avant:
        "La formule se cherche sur un forum, se recopie et s'adapte par essais-erreurs — ou pire : le fichier entier se colle dans l'outil « pour qu'il se débrouille ». La formule héritée du prédécesseur, elle, ne se comprend plus et ne se touche plus. Le rapprochement se refait à la main, différemment à chaque clôture, sans trace de ce qui a été vérifié.",
      apres:
        "Les en-têtes de colonnes suffisent : la formule, le croisement et la marche à suivre arrivent sans qu'une seule cellule ne sorte du fichier, et la formule héritée s'explique ligne à ligne en français. Le rapprochement devient une trame de contrôle : l'IA écrit la liste des points à vérifier, l'humain coche et signe.",
      prompt:
        "DÉMONSTRATION 1 — Une formule sans livrer la moindre donnée\n\nMa feuille Excel s'appelle « Balance ». La ligne 1 porte les en-têtes, les données vont de la ligne 2 à la ligne 4000. Colonnes : A compte, B libellé, C date d'écriture, D débit, E crédit, F code journal, G lettrage (vide si non lettré).\nJe veux, en colonne H, le solde de chaque ligne (débit moins crédit) ; et sur une feuille séparée, le total par compte pour le seul journal « VE », sur les écritures non lettrées uniquement.\nDonne-moi la formule de la colonne H, la formule de totalisation, et la marche à suivre pour obtenir le même résultat par tableau croisé dynamique. Je suis sur Excel 365 en français, sépare les arguments par des points-virgules. Ne me demande aucune donnée : je ne te transmets que la structure de mes colonnes.\n\nDÉMONSTRATION 2 — Comprendre une formule héritée\n\nExplique-moi cette formule ligne à ligne, en français, comme si je devais la réécrire moi-même : =SIERREUR(RECHERCHEV($A2;'Plan de comptes'!$A:$D;4;FAUX);SI(ESTVIDE($A2);\"\";\"compte inconnu\"))\nDis ce qu'elle renvoie dans chacun des trois cas possibles, et quel est le risque si l'ordre des colonnes du plan de comptes change. Ne propose aucune version améliorée : je veux d'abord comprendre celle-ci.\n\nDÉMONSTRATION 3 — Une trame de contrôle plutôt qu'un rapprochement\n\nActeur : tu es contrôleur interne dans une PME de 60 personnes.\nConteXte : notre clôture mensuelle comporte ces étapes, que je te décris : arrêté des journaux d'achats et de ventes, rapprochement bancaire, cut-off des factures non parvenues, contrôle des états de frais, revue des comptes d'attente.\nIntention : obtenir une trame de contrôle qu'une personne qui n'a pas assisté à la clôture puisse dérouler seule.\nOutput : une liste de points de contrôle numérotés — chaque point est un geste vérifiable (« rapprocher X avec Y », « vérifier que Z est à zéro »), suivi d'une case à cocher et d'un champ « constaté par / le ». Termine par une ligne de signature.\nNormes : tu écris la liste des points, tu n'exécutes aucun contrôle et tu ne produis aucun chiffre. Aucun point ne vise une personne : un écart signalé ne désigne jamais quelqu'un — recopie cette borne en tête de trame. N'écris aucun point du type « vérifier que tout est correct » : chaque point doit être cochable par oui ou par non.",
      outil: "Un seul outil, celui validé dans la salle.",
      captureEcran:
        "La formule obtenue à partir des seuls en-têtes, annotée « aucune cellule collée » ; l'explication ligne à ligne de la formule héritée ; et la trame de clôture du kit avec sa borne surlignée en tête.",
      verifieLe: VERIFIE_LE,
      dureeMin: 20,
      notes: {
        script:
          "Trois démonstrations s'enchaînent, ne les mélangez pas. (1) Tapez le prompt tableur devant eux et dites à voix haute, au moment de valider, que vous n'avez collé aucune cellule. (2) Projetez la formule héritée sans un mot pendant trente secondes, laissez le silence s'installer, puis lancez l'explication. (3) Pour la trame, lisez ensuite la trame de clôture fournie au kit en la commentant : l'IA écrit la liste des points à vérifier, c'est l'humain qui coche et qui signe — et la borne posée le matin est recopiée en tête.",
        faq: [
          {
            question: "Décrire seulement les en-têtes suffit vraiment à obtenir la bonne formule ?",
            reponse:
              "Oui, dans l'immense majorité des cas : une formule dépend de la structure, pas des valeurs. Quand ça ne suffit pas, c'est que la structure est ambiguë — le remède est alors de préciser le type de chaque colonne, jamais d'y coller trois lignes d'exemple.",
          },
          {
            question: "Une trame de contrôle, ce n'est pas juste une check-list de plus ?",
            reponse:
              "C'est une check-list qui a deux propriétés que les vôtres n'ont probablement pas : chaque point est cochable par oui ou par non, et quelqu'un qui n'a pas assisté à la clôture peut la dérouler. C'est ce qui la rend opposable — et c'est ce qu'on vérifiera en binôme.",
          },
        ],
        blocages: [
          {
            situation:
              "La salle réclame tout de suite la version « améliorée » de la formule héritée.",
            parade:
              "Refuser : « on comprend d'abord, on réécrit ensuite ». Une formule remplacée sans avoir été comprise est la première cause d'erreur de clôture.",
          },
        ],
        planB:
          "Quota atteint, réseau tombé ou service indisponible : les trois sorties sont imprimées dans le kit formateur (datées), et la trame de clôture est fournie imprimée — sa lecture commentée ne dépend d'aucun outil. N'improvisez aucune démonstration de remplacement en direct : les sorties du kit ont été vérifiées, les vôtres ne le seront pas.",
      },
    },
    pratique: {
      consigne:
        "Deux temps chronométrés. (1) Apportez un besoin de tableur réel : décrivez la structure de vos colonnes, sans aucune donnée, et repartez avec votre formule, votre croisement ou votre procédure — testés sur votre fichier et documentés en français dans le classeur. (2) Produisez votre trame de contrôle sur un processus réel — clôture, cut-off, états de frais — en recopiant EN TÊTE de trame la borne posée le matin : un écart signalé ne désigne jamais une personne.",
      aEmporter:
        "Une formule ou un croisement testé et documenté en français, et votre trame de contrôle déroulable — la deuxième moitié de la matinée versée au classeur de clôture assistée.",
      dureeMin: 50,
      notes: {
        script:
          "Annoncez le chronomètre à voix haute toutes les cinq minutes. Temps 1 : circulez, la faute la plus fréquente est de coller trois lignes « juste pour donner un exemple ». Temps 2 : exigez la borne recopiée en tête de trame, pas en bas de page — en bas de page, personne ne la lit.",
        faq: [
          {
            question: "Ma formule renvoie une erreur, l'outil s'est trompé.",
            reponse:
              "Neuf fois sur dix c'est le séparateur ou la version : dites-lui « je suis sur Excel 365 en français, sépare les arguments par des points-virgules » et relancez. La dixième fois, c'est une colonne que vous avez mal décrite — relisez votre description, pas sa réponse.",
          },
          {
            question: "Je n'ai aucun besoin de tableur en tête.",
            reponse:
              "Prenez celui du kit : rapprocher deux extractions qui n'ont pas les mêmes colonnes. Tout le monde a eu ce problème un jour.",
          },
        ],
        blocages: [
          {
            situation: "Un binôme obtient une formule qui « marche » sans l'avoir testée.",
            parade:
              "Une seule question : « sur quelle ligne l'avez-vous vérifiée ? ». Faites-la tester sur une ligne dont ils connaissent déjà le résultat — c'est la règle qu'on installe pour de bon : toute formule produite se teste sur un cas dont on connaît la réponse.",
          },
          {
            situation: "Un stagiaire termine l'atelier tableur en dix minutes.",
            parade:
              "Lui donner le second besoin du kit (écart de cut-off entre deux extractions) et lui demander de préparer la restitution devant le groupe.",
          },
          {
            situation: "La trame de contrôle produite désigne un service ou une personne.",
            parade:
              "Faire relire à voix haute, par son auteur, la borne qu'il a recopiée en tête de sa propre trame. La correction vient seule, et sans vous.",
          },
        ],
        planB:
          "Réseau ou outil indisponibles : les deux temps se tiennent sur papier. Le temps 1 s'écrit à la main — décrire une structure de colonnes est un exercice de rédaction, pas d'outil, et la formule se recopiera lundi. Le temps 2 ne dépend d'aucun outil : c'est le plus robuste de la matinée, gardez-le complet même si tout le reste a été dégradé.",
      },
    },
    verification: {
      question:
        "Contrôle croisé en binôme sur la trame de l'autre : quelqu'un qui n'a pas assisté à la clôture peut-il la dérouler et la cocher seul, et la borne est-elle bien écrite en tête ? Au passage : la formule de l'autre a-t-elle été testée sur une ligne dont le résultat était connu ?",
      reponseAttendue:
        "Tout point de trame qui commence par « vérifier que tout est correct » est réécrit en geste vérifiable, toute trame sans borne en tête y revient, et toute formule non testée repart au test sur un cas connu avant d'entrer au classeur.",
      dureeMin: 5,
      notes: {
        script:
          "Cinq minutes serrées : chaque binôme déroule la trame de l'autre à voix basse et pointe le premier point non cochable qu'il rencontre. Un seul écart remonté à l'oral par binôme suffit — l'objectif est le réflexe, pas l'exhaustivité.",
        faq: [
          {
            question: "Ma trame est plus courte que celle du kit, c'est un problème ?",
            reponse:
              "Non. Une trame courte dont chaque point est cochable vaut mieux qu'une trame longue qui suppose de connaître le dossier. La longueur viendra avec l'usage, clôture après clôture.",
          },
        ],
        blocages: [
          {
            situation:
              "Une trame est déclarée « cochable » alors qu'elle suppose de connaître le dossier.",
            parade:
              "La faire dérouler à voix haute par quelqu'un d'un autre service. Trois points suffisent pour que ce soit évident aux deux.",
          },
        ],
        planB:
          "Grille de contrôle imprimée dans le kit. Le déroulé croisé d'une trame ne dépend d'aucun outil.",
      },
    },
    synthese: {
      acquis: [
        "Je décris la structure de mes colonnes pour obtenir une formule, sans qu'aucune donnée ne quitte mon fichier — et je la teste sur un cas dont je connais le résultat.",
        "Je fais expliquer une formule héritée avant de la remplacer.",
        "Je produis une trame de contrôle qu'une autre personne peut dérouler, cocher et signer.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites-les FORMULER : « en une phrase, qu'est-ce que vous ne ferez plus à partir de lundi ? ». Faites ensuite nommer le fichier à voix haute — « classeur-cloture-assistee-<service>-<date> » : le classeur existe à partir du moment où il porte un nom. Annoncez l'après-midi en une phrase : on arrête de produire du chiffre, on écrit autour.",
        faq: [],
        blocages: [
          {
            situation: "Il est 12 h 25, la salle veut déjeuner et plus personne ne parle.",
            parade:
              "Ne pas insister : énoncer les trois acquis vous-même, faire nommer le fichier, libérer. Un acquis récité à contrecœur ne s'ancre pas mieux qu'un acquis énoncé par le formateur.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 3 — Écrire autour du chiffre
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-3",
    objectif: {
      enonce:
        "À la fin de ce module, vous faites dire à vos indicateurs déjà calculés ce qu'ils veulent dire, pour le lecteur que vous avez nommé — direction, opérationnels, banque, associé — et vous disposez d'une séquence de relance d'impayé prête à l'emploi.",
      objectifGlobalId: "obj-3",
      dureeMin: 5,
      notes: {
        script:
          "À la reprise, posez la règle de l'après-midi et écrivez-la au tableau : les chiffres sont déjà calculés et déjà vérifiés par vous, l'IA ne fait que les mettre en phrase. Faites noter à chacun le NOM du lecteur de son prochain reporting — direction, opérationnels, banque, associé : sans destinataire nommé, l'atelier qui suit produit du texte interchangeable.",
        faq: [
          {
            question: "Si elle ne calcule rien, à quoi sert-elle vraiment en finance ?",
            reponse:
              "À la moitié de votre temps qui n'est pas du calcul : lire, résumer, commenter, relancer, expliquer, contrôler. Vous avez mesuré ce matin ce qu'elle fait d'un rapport de trente-quatre pages.",
          },
        ],
        blocages: [
          {
            situation: "Un stagiaire arrive sans reporting et sans chiffres exploitables.",
            parade:
              "Le tableau de bord fictif du kit fournit la matière ; c'est aussi le repli obligatoire de celui qui hésite sur la confidentialité de ses propres chiffres. Personne ne regarde son voisin travailler pendant trente-cinq minutes.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "« Commente-moi ce tableau de bord. » La sortie explique les variations avec assurance, avance des causes que personne ne lui a données, propose un plan d'action, et recalcule au passage un ratio qui ne tombe pas juste. La relance d'impayé, elle, s'écrit de mémoire — avec des mentions dues oubliées ou inventées.",
      apres:
        "Les mêmes chiffres saisis à la main, avec interdiction de recalculer et obligation d'écrire « cause à confirmer auprès de » là où l'explication manque. Le commentaire devient publiable après une relecture, la version pour un second lecteur se produit en trente secondes, et les mentions de la relance viennent de la trame du kit — jamais de l'outil.",
      prompt:
        "DÉMONSTRATION A — Le commentaire de gestion\n\nVoici les indicateurs de mon reporting de mai, déjà calculés et vérifiés par mes soins. Je te les saisis, tu ne les recalcules pas : chiffre d'affaires 1 240 k€ (mois précédent 1 118 k€) ; marge brute 31,2 % (mois précédent 33,8 %) ; délai moyen de règlement client 62 jours (objectif 45) ; encours clients 410 k€, dont 78 k€ échus.\nÉcris le commentaire de gestion destiné au dirigeant : dix lignes maximum, un paragraphe par indicateur qui bouge, chaque phrase reprenant le chiffre exactement tel que je te l'ai donné. Ne calcule aucun ratio nouveau, n'invente aucune cause, ne propose aucun plan d'action. Là où une explication te manque, écris « cause à confirmer auprès de » suivi du service concerné.\n\nDÉMONSTRATION B — Le second niveau de lecture\n\nReprends le commentaire précédent et réécris-le pour les responsables d'atelier : mêmes chiffres, aucun terme comptable — remplace « marge brute » par ce qu'elle mesure concrètement — et termine par la seule action qui dépend d'eux. Huit lignes maximum.\n\nDÉMONSTRATION C — La relance de niveau 2, complétée depuis la trame du kit\n\nVoici, recopiée entre les balises, la trame de relance de niveau 2 du kit — tu n'en modifies ni la structure ni les mentions.\n[TRAME] Objet : Relance n° 2 — facture [numéro] échue le [date d'échéance]. Madame, Monsieur, sauf erreur de notre part, la facture [numéro] du [date d'émission], d'un montant de [montant] € TTC, demeure impayée à ce jour malgré notre relance du [date de la relance 1]. Nous vous remercions de bien vouloir procéder à son règlement sous [délai] jours. À défaut, conformément à nos conditions générales de vente, des pénalités de retard au taux de [taux] ainsi que l'indemnité forfaitaire pour frais de recouvrement de 40 € par facture seront appliquées. [/TRAME]\nComplète uniquement les champs entre crochets à partir de ces éléments, que je te saisis à la main : facture F-2026-0341, émise le 12 avril 2026, échue le 12 mai 2026, montant 4 830 € TTC, première relance envoyée le 26 mai 2026, délai accordé 8 jours, taux prévu aux conditions générales : taux de la BCE majoré de 10 points.\nNe reformule pas le corps du texte, n'ajoute aucune mention ni aucune pénalité que je n'ai pas fournie, et conserve l'en-tête « Projet — à faire valider par votre conseil avant diffusion ».",
      outil: "Un seul outil, celui validé dans la salle.",
      captureEcran:
        "Les deux commentaires côte à côte, la cause inventée de la version libre entourée en rouge et le ratio recalculé faux surligné ; en dessous, la relance de niveau 2 complétée, ses mentions surlignées et reprises mot pour mot de la trame.",
      verifieLe: VERIFIE_LE,
      dureeMin: 15,
      notes: {
        script:
          "Trois séquences. (1) Commentaire de gestion : lancez d'abord la version libre et lisez-la à voix haute — elle est bonne, c'est le piège. Demandez ensuite à la salle d'où sort la cause avancée : personne ne l'a fournie. Enchaînez sur la version cadrée, puis sur la réécriture pour le second lecteur en faisant remarquer que vous n'avez retapé aucun chiffre. (2) Les trois trames du kit — relance graduée à trois niveaux, note de synthèse au dirigeant, réponse à une demande du commissaire aux comptes : ne les commentez pas ligne à ligne, dites pour chacune ce qu'elle IMPOSE et ce qu'elle INTERDIT — c'est tout ce qui se retient en cinq minutes. (3) La relance complétée : montrez que l'outil n'a rempli QUE les crochets, et que les mentions étaient déjà dans la trame.",
        faq: [
          {
            question: "Les mentions obligatoires d'une relance d'impayé, elle les connaît ?",
            reponse:
              "Elle les écrit parfois, avec un montant faux — c'est pire qu'un oubli, parce que ça se lit comme du vrai. Les mentions viennent de la trame du kit, jamais de l'outil, et cette trame porte un en-tête « Projet — à faire valider par votre conseil avant diffusion » qui ne se retire pas.",
          },
          {
            question: "Je peux lui demander la règle comptable applicable plutôt que de chercher ?",
            reponse:
              "Non. L'IA n'est jamais la source d'une réponse comptable, fiscale ou réglementaire. Vous ouvrez le texte, vous le lui fournissez, elle le reformule, et c'est le texte que vous citez. Sur le fond de votre cas, je ne me prononce pas : notez la question, votre conseil tranchera.",
          },
        ],
        blocages: [
          {
            situation: "Un stagiaire dicte ses chiffres réels à voix haute avec le nom du client.",
            parade:
              "Couper immédiatement et rappeler la liste rouge du matin : un nom de client prononcé dans une salle de formation vaut un nom de client déposé dans un outil.",
          },
        ],
        planB:
          "Les trois séquences sont imprimées dans le kit (datées) : commentaire libre et commentaire cadré, les trois trames, et la relance complétée. La comparaison se tient à l'identique sur papier, y compris le « d'où sort cette cause ? » posé à la salle.",
      },
    },
    pratique: {
      consigne:
        "Deux temps chronométrés. (1) Rédigez le commentaire de votre dernier reporting à partir de vos indicateurs déjà calculés, saisis à la main — aucun fichier déposé, aucun nom de client, aucune donnée nominative — puis produisez la version destinée à un second lecteur que vous aurez nommé. (2) À partir des trames fournies au kit, produisez soit votre séquence de relance d'impayé à trois niveaux, soit votre note de synthèse au dirigeant, à partir de votre propre dossier.",
      aEmporter:
        "Le commentaire de votre dernier reporting en deux niveaux de lecture, et une séquence de relance d'impayé à trois niveaux ou une note de synthèse au dirigeant — versés au classeur de clôture assistée.",
      dureeMin: 65,
      notes: {
        script:
          "Temps 1 : exigez le NOM du second lecteur avant la première ligne — un commentaire sans destinataire nommé revient toujours interchangeable. Circulez et cherchez la faute propre à cet atelier : le stagiaire qui laisse l'outil recalculer un pourcentage « juste pour vérifier ». Temps 2 : les mentions dues se recopient de la trame, jamais de l'outil, et l'en-tête « Projet — à faire valider par votre conseil avant diffusion » reste apparent. Vous n'arbitrez AUCUNE question juridique ni comptable ; la formule se prononce telle quelle — « je ne me prononce pas, notez la question, votre conseil tranchera » — et vous écrivez la question au tableau : la liste des questions ouvertes est une production utile de la journée.",
        faq: [
          {
            question: "Je peux saisir mes vrais chiffres de marge ?",
            reponse:
              "Des agrégats non nominatifs, saisis à la main, oui, si votre régime d'usage le permet. Un fichier déposé, un nom de client, une ligne de paie : non, jamais. En cas d'hésitation, le tableau de bord du kit fait très bien l'affaire et vous relancerez chez vous lundi.",
          },
          {
            question: "Trois niveaux de relance, ce n'est pas trop agressif pour un bon client ?",
            reponse:
              "C'est précisément pour cela que la trame les sépare : le niveau 1 ne mentionne aucune pénalité, le niveau 3 les mentionne toutes. Le ton relève de votre choix commercial ; les mentions dues, non.",
          },
          {
            question: "L'IA peut-elle me dire si je dois provisionner cette créance ?",
            reponse:
              "Non. Elle n'est jamais la source d'une réponse comptable. Elle reformule le texte que vous lui donnez, et c'est ce texte que vous citez à votre commissaire aux comptes — pas la réponse de l'outil.",
          },
        ],
        blocages: [
          {
            situation:
              "Un stagiaire construit un score de risque client pour prioriser ses relances.",
            parade:
              "Arrêter et rappeler les deux bornes du matin : un écart signalé ne désigne jamais une personne, et noter la solvabilité d'une personne physique relève des usages à haut risque du règlement européen sur l'IA. Rediriger vers un tri par montant et par ancienneté d'échéance, qui répond à son besoin sans le risque.",
          },
        ],
        planB:
          "Aucun outil n'est indispensable : les deux temps se tiennent sur papier. Le temps 1 s'écrit à la main sur la trame de commentaire du kit — ce qui compte est la structure de la demande, pas l'outil qui l'exécute. Le temps 2 utilise les trames imprimées, qui sont de toute façon la source des mentions.",
      },
    },
    verification: {
      question:
        "Contrôle croisé en binôme, grille fournie, sur les écrits de l'autre : un chiffre y figure-t-il sans avoir été vérifié à sa source ? le ton correspond-il au niveau de relance ? les mentions dues sont-elles présentes et reprises de la trame ? le destinataire et le niveau de lecture sont-ils cohérents ?",
      reponseAttendue:
        "Les quatre points passés en revue sur chaque écrit, écarts relevés à l'oral. Toute mention qui vient de l'outil et non de la trame rend la case « mentions dues présentes » non cochable, et tout chiffre sans source ni date est barré.",
      dureeMin: 10,
      notes: {
        script:
          "Contrôle CROISÉ, grille en main, les quatre points dans l'ordre — chiffres, ton, mentions, destinataire. Faites verbaliser chaque écart à l'oral, un par binôme au minimum, et gardez la règle du module 1 : on barre au stylo sur la copie de l'autre, jamais sur la sienne.",
        faq: [
          {
            question: "J'ai coché « mentions dues présentes » alors qu'elles viennent de l'outil.",
            reponse:
              "Alors la case n'est pas cochable. Les mentions viennent de la trame ou d'un texte que vous avez ouvert vous-même, jamais de l'outil. C'est le seul point du contrôle qui ne se négocie pas.",
          },
        ],
        blocages: [
          {
            situation:
              "Un binôme valide un écrit contenant un chiffre non vérifié parce que « c'est sûrement le bon ».",
            parade:
              "Une question : « à quelle source, ouverte quand ? ». Si la réponse ne porte ni source ni date, le chiffre est barré.",
          },
        ],
        planB:
          "Grille de contrôle croisé imprimée dans le kit. Le contrôle ne dépend d'aucun outil.",
      },
    },
    synthese: {
      acquis: [
        "J'écris le commentaire de mes indicateurs déjà calculés, et je l'adapte au lecteur que j'ai nommé.",
        "Mes mentions de relance viennent de la trame, jamais de l'outil — et l'en-tête « à faire valider par votre conseil » ne se retire pas.",
        "Je dispose d'une séquence de relance d'impayé à trois niveaux prête à l'emploi.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites verser les productions au classeur avant la pause — un écrit non rangé est un écrit perdu. Annoncez le dernier module en une phrase : « on va regarder à quel moment elle se trompe sur un chiffre, et vous repartez avec le classeur monté ».",
        faq: [],
        blocages: [
          {
            situation:
              "Une question comptable ou fiscale restée ouverte revient au moment de conclure.",
            parade:
              "La relire à voix haute depuis le tableau et la laisser ouverte : « je ne me prononce pas, votre conseil tranchera ». Une question notée et transmise vaut mieux qu'une réponse donnée par complaisance.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 4 — Fiabilité et ancrage
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-4",
    objectif: {
      enonce:
        "À la fin de ce module, vous repérez seul, sans aide, le moment où l'IA se trompe sur un chiffre — et vous repartez avec votre classeur de clôture assistée monté, nommé, et tenu par quelqu'un.",
      objectifGlobalId: "obj-4",
      dureeMin: 5,
      notes: {
        script:
          "Au retour de la pause, annoncez le dernier temps en une phrase : « on va regarder à quel moment elle se trompe sur un chiffre, et vous repartez avec le classeur monté ». Rappelez la règle installée depuis le matin, elle va être mise à l'épreuve : tout chiffre produit par l'IA est traité comme faux jusqu'à vérification à sa source.",
        faq: [
          {
            question: "On a déjà vu qu'elle se trompait ce matin, pourquoi y revenir ?",
            reponse:
              "Ce matin, vous l'avez vue se tromper quand on le lui demandait. Ce module entraîne l'inverse : la repérer quand elle se trompe sans prévenir, dans une note propre et assurée — c'est là que les erreurs passent en production.",
          },
        ],
        blocages: [
          {
            situation:
              "La salle est en confiance après trois modules réussis et veut « aller plus vite ».",
            parade:
              "C'est exactement le moment de la chasse à l'erreur : la confiance installée est la condition du piège. Ne pas raccourcir ce module — c'est lui qui protège tout ce qui précède.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "Le même calcul demandé deux fois de suite renvoie deux résultats différents — et rien, à l'écran, ne distingue le bon du faux : les deux sorties sont aussi propres et aussi assurées l'une que l'autre.",
      apres:
        "Le geste de relecture qui l'attrape en dix secondes : ne jamais lire la conclusion d'abord — pointer chaque chiffre de la sortie, le retrouver dans la source, et seulement ensuite lire le raisonnement.",
      prompt:
        "DÉMONSTRATION — Le même calcul, deux fois\n\nÀ lancer deux fois, la seconde dans une conversation NEUVE, sans rien changer au texte (le tableau de douze lignes est fourni au kit, et se recopie tel quel à la suite du prompt) :\nCalcule le taux de marge brute de chacune des douze lignes du tableau ci-dessous, puis donne le taux moyen pondéré par le chiffre d'affaires. Détaille chaque étape de ton calcul.",
      outil: "Un seul outil, celui validé dans la salle.",
      captureEcran:
        "Les deux réponses du même calcul lancé deux fois, côte à côte, avec l'écart sur le taux moyen pondéré encadré en rouge.",
      verifieLe: VERIFIE_LE,
      dureeMin: 5,
      notes: {
        script:
          "Ouvrez une conversation NEUVE pour le second lancement, sinon l'outil se recopie. Affichez les deux résultats côte à côte et laissez le silence faire le travail. Puis montrez le geste de relecture : chiffre par chiffre vers la source, la conclusion en dernier.",
        faq: [
          {
            question: "Deux réponses différentes à la même question, c'est un bug ?",
            reponse:
              "Non, c'est le fonctionnement normal : le modèle produit un texte probable, pas un résultat. C'est pour cela que la règle du service n'est pas « vérifier de temps en temps » mais « ne jamais lui faire produire un chiffre qu'on n'a pas soi-même ».",
          },
        ],
        blocages: [
          {
            situation: "Les deux lancements du même calcul donnent exactement le même résultat.",
            parade:
              "Le dire franchement : « elle est stable cette fois, et vous n'aviez aucun moyen de le savoir avant ». Puis relancer en exigeant le détail étape par étape — la divergence apparaît presque toujours sur le pondéré. À défaut, les deux sorties du kit font le travail.",
          },
        ],
        planB:
          "Les deux résultats divergents du même calcul sont imprimés dans le kit (datés), l'écart déjà encadré. La comparaison se tient à l'identique sur papier.",
      },
    },
    pratique: {
      consigne:
        "Deux temps chronométrés. (1) Chasse à l'erreur, corrigé fourni au kit : une note financière et un calcul produits par l'IA contiennent quatre erreurs de chiffre et deux affirmations non sourcées — surlignez ce que vous croyez faux, on compte à main levée avant d'ouvrir le corrigé, et on en tire la règle de relecture du service, écrite en une phrase. (2) Montez et nommez votre classeur de clôture assistée : trames de contrôle, formules documentées, trame de commentaire, séquence de relance, liste rouge du service, glossaire maison — rangé pour être rouvert à la prochaine clôture.",
      aEmporter:
        "La règle de relecture du service écrite en une phrase, et le classeur de clôture assistée complet, nommé, rangé, avec le nom de la personne qui le tient à jour.",
      dureeMin: 55,
      notes: {
        script:
          "Temps 1 : comptez les repérages À MAIN LEVÉE et notez le score au tableau AVANT d'ouvrir le corrigé. La salle sous-estime toujours, et le chiffre affiché vaut mieux qu'un discours sur la vigilance. Faites ensuite écrire la règle de relecture du service en une phrase, par eux. Temps 2 : faites nommer le fichier ET la personne qui le tient — un classeur sans titulaire n'est jamais rouvert.",
        faq: [
          {
            question: "La règle de relecture, c'est la même pour tout le monde ?",
            reponse:
              "Le fond, oui : tout chiffre produit par l'IA est faux jusqu'à vérification à sa source. La formulation, non — elle s'écrit avec les mots du service, c'est ce qui fait qu'elle sera relue. Celle qui sort de votre salle vaut mieux que celle qui sortirait du kit.",
          },
        ],
        blocages: [
          {
            situation: "La salle trouve les six erreurs plantées en huit minutes et s'ennuie.",
            parade:
              "La note du kit en contient trois de plus, dont une qui ne se voit qu'en rouvrant le document source. La distribuer à ceux qui ont fini, pas d'emblée à tout le monde.",
          },
          {
            situation: "Un stagiaire refuse de monter un classeur, « je retiendrai bien ».",
            parade:
              "Une question : « à la prochaine clôture, dans onze semaines, vous retrouverez votre formule où ? ». Ne pas argumenter davantage.",
          },
        ],
        planB:
          "Aucun outil n'est indispensable : le temps 1 est déjà sur papier par construction, et le temps 2 est un travail de rangement — c'est l'atelier le plus robuste de la journée, gardez-le complet même si tout le reste a été dégradé.",
      },
    },
    verification: {
      question:
        "Évaluation des acquis : quiz individuel de validation (10 questions) corrigé en salle, puis auto-évaluation d'une production du jour sur la grille de relecture du classeur.",
      reponseAttendue:
        "Le corrigé est commenté question par question sans en sauter aucune ; le seuil de réussite est celui déclaré au programme, et un score en dessous déclenche la reprise individuelle prévue au dispositif. L'auto-évaluation se fait sur une production réelle du jour, sortie du classeur.",
      dureeMin: 15,
      notes: {
        script:
          "C'est l'évaluation des acquis au sens de l'indicateur 11 : elle se tient, elle se corrige, elle se conserve. Ne la sacrifiez jamais au temps qui manque — si vous êtes en retard, coupez ailleurs, jamais sur le quiz. C'est la première chose qu'un auditeur demande. Sur l'auto-évaluation, faites cocher la grille sur une production RÉELLE du jour, sortie du classeur, pas sur un souvenir de l'après-midi.",
        faq: [
          {
            question: "Le résultat sera transmis à mon employeur ?",
            reponse:
              "Le résultat individuel, non. Ce qui est transmis, c'est l'attestation de fin de formation et le fait que l'évaluation a eu lieu.",
          },
        ],
        blocages: [
          {
            situation: "Il est 17 h 15 et le quiz n'est pas commencé.",
            parade:
              "Le tenir quand même, en réduisant le commentaire du corrigé aux questions les plus ratées. On ne remplace jamais l'évaluation par un tour de table.",
          },
        ],
        planB:
          "Quiz papier et corrigé imprimés dans le kit, grille d'auto-évaluation dans le classeur. Aucune dépendance à un outil, et c'est délibéré : l'évaluation ne peut pas sauter parce que le réseau est tombé.",
      },
    },
    synthese: {
      acquis: [
        "Je traite tout chiffre produit par l'IA comme faux jusqu'à vérification à sa source.",
        "Je rouvre mon classeur de clôture assistée à la prochaine clôture, et je sais qui le tient à jour.",
        "Ma feuille de route porte trois usages à installer, un nom pour chacun, et ce qu'on vérifie au bout d'un mois.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Chacun nomme à voix haute TROIS usages qu'il installe avant la prochaine clôture, QUI les tient, et ce qu'il regardera au bout d'un mois. Sans nom et sans date, une feuille de route ne se réalise pas. Reprenez ensuite le tableau du matin, celui du tour de table, et montrez ce que la journée a couvert ET ce qu'elle n'a pas couvert : l'honnêteté sur ce second point achète toute la crédibilité du reste. Notez au tableau, photographiez, envoyez la photo au groupe.",
        faq: [],
        blocages: [
          {
            situation: "Les engagements restent vagues : « je vais essayer d'utiliser l'IA ».",
            parade:
              "Reformuler en une question : « sur quel processus, et quel jour ? ». Ne pas passer au suivant tant que la réponse ne porte pas un nom et une date.",
          },
          {
            situation:
              "Une question comptable ou fiscale restée ouverte revient en fin de journée.",
            parade:
              "La relire à voix haute depuis le tableau et la laisser ouverte : « je ne me prononce pas, votre conseil tranchera ». Une question notée et transmise vaut mieux qu'une réponse donnée par complaisance à 17 h 30.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },
];
