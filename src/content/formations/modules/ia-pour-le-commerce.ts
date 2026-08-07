/**
 * CONTENU RÉDIGÉ — « IA pour le commerce » (1 jour, 7 h, 4 modules).
 *
 * ## Le fil rouge
 *
 * Chacun repart avec LE MANUEL DE PUBLICATION DE L'ENSEIGNE, assemblé pièce par
 * pièce au fil des quatre modules : la trame de fiche produit au module 1, le
 * procédé de série et sa règle d'échantillonnage au module 2, les réponses
 * types aux avis au module 3, l'assemblage et la feuille de route au module 4.
 * Le manuel doit être utilisable dès le lendemain par un vendeur qui n'était
 * pas en salle — c'est le critère de réussite de la journée.
 *
 * ## Trois règles que le formateur ne négocie pas
 *
 * **On ne fabrique JAMAIS un avis, un témoignage ni une note, et on ne fait
 * jamais écrire un avis par l'IA** — c'est une pratique commerciale trompeuse
 * sanctionnée. **Une réponse publique ne confirme jamais qu'une personne est
 * cliente et ne révèle rien de son dossier** — ni commande, ni date, ni
 * produit, ni montant. Ces deux lignes sont NON RETIRABLES des supports.
 *
 * **Une fiche produit n'affirme rien que la fiche technique fournisseur ne
 * prouve.** Caractéristiques, normes, origine se recopient depuis le document
 * source ; elles ne se génèrent jamais. Ce qui n'est pas dans la fiche
 * technique est « à compléter par le magasin », pas par l'outil.
 *
 * **Aucune donnée client ne passe dans un outil pendant la journée.** Les
 * ateliers tournent sur les produits des stagiaires (fiches techniques,
 * tableaux produits, avis publics recopiés SANS le nom de leur auteur) et sur
 * le matériel du kit. Fichier clients, marges, conditions d'achat : jamais.
 *
 * **Le formateur n'arbitre aucune question juridique.** La formule est écrite,
 * elle se prononce telle quelle : « je ne me prononce pas, notez la question,
 * votre conseil tranchera ».
 *
 * ⚠️ Les références réglementaires de la journée (pratiques commerciales
 * trompeuses, obligations de transparence du règlement européen sur l'IA,
 * mentions obligatoires d'une offre) sont portées par les séquences `cadre` du
 * catalogue et fournies au formateur SOURCÉES ET DATÉES dans le kit — elles ne
 * se citent jamais de mémoire, et leur formulation reste à faire relire par le
 * conseil de l'organisme.
 */

import type { EnrichissementFormation } from "./types";

/** Date de dernière vérification des captures et sorties d'outils. */
const VERIFIE_LE = "2026-08-06";

export const IA_POUR_LE_COMMERCE: EnrichissementFormation = [
  // ───────────────────────────────────────────────────────────────────────────
  // Module 1 — Une fiche produit qui vend et qui n'invente rien
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-1",
    objectif: {
      enonce:
        "À la fin de ce module, vous produisez une fiche produit publiable à partir d'une fiche technique fournisseur, et vous savez dire, ligne par ligne, ce qui doit être vérifié avant publication.",
      objectifGlobalId: "obj-1",
      dureeMin: 5,
      notes: {
        script:
          "Tour de table en UNE phrase : « votre prénom, votre rayon ou votre canal de vente, et le contenu qui vous prend le plus de temps ». Notez les réponses au tableau — vous y reviendrez au module 4 pour montrer ce que la journée a couvert. Annoncez la règle qui tient la journée : rien ne se publie que la fiche technique fournisseur ne prouve. Et annoncez le livrable : chacun repart avec le manuel de publication de son enseigne.",
        faq: [
          {
            question: "On va apprendre à faire écrire nos avis Google aussi ?",
            reponse:
              "Non, et c'est une des deux lignes rouges de la journée : on ne fabrique jamais un avis. Ce qu'on fera cet après-midi est différent et autorisé : RÉPONDRE aux avis, vite et bien.",
          },
          {
            question: "Nos fiches viennent déjà du fournisseur, ça sert à quoi ?",
            reponse:
              "Le texte fournisseur est celui de tous vos concurrents. La journée sert à produire VOTRE fiche — votre ton, votre client, votre canal — sans rien inventer de plus que lui.",
          },
        ],
        blocages: [
          {
            situation:
              "Le tour de table dérive en débat sur la place de marché qui « étrangle tout le monde ».",
            parade:
              "Couper avec : « on note, et on regarde cet après-midi ce que l'IA change sur vos contenus place de marché » — écrire la plainte au tableau et la reprendre au module 3.",
          },
        ],
        planB:
          "Aucun outil n'est nécessaire ici. Sans vidéoprojecteur, le tour de table et la règle du jour se tiennent au paperboard sans rien perdre.",
      },
    },
    demonstration: {
      avant:
        "La fiche s'écrit à la main : on recopie la fiche technique, on cherche des tournures qui vendent, on y passe trois quarts d'heure — et la pile des produits « à mettre en ligne » ne baisse pas.",
      apres:
        "Trois lignes de fiche technique fournisseur déposées dans l'outil, et la fiche complète sort en quelques minutes : titre, argumentaire, caractéristiques — chaque affirmation reliable à la ligne du document qui la prouve, et ce qui manque marqué « à compléter par le magasin ».",
      prompt:
        "Voici la fiche technique fournisseur ci-jointe. Rédige une fiche produit pour notre site à partir de ce SEUL document. Structure imposée : un titre de 60 caractères maximum commençant par le nom du produit ; un argumentaire de 80 mots orienté usage client ; les caractéristiques en liste, reprises de la fiche technique SANS reformulation. N'ajoute aucune caractéristique, aucune norme, aucune origine, aucune allégation de santé ou environnementale qui ne figure pas dans le document. Prix, disponibilité, garantie et conditions de retour : n'écris rien, laisse quatre lignes marquées « à compléter par le magasin ». Si une information manque, écris « non renseigné » — n'invente rien.",
      outil: "Un seul outil, celui validé dans la salle (Claude ou ChatGPT selon le groupe).",
      captureEcran:
        "La fiche technique fournisseur à gauche, la fiche produit générée à droite, une flèche par caractéristique reliant chaque affirmation à la ligne qui la prouve — et les quatre lignes « à compléter par le magasin » entourées.",
      verifieLe: VERIFIE_LE,
      dureeMin: 15,
      notes: {
        script:
          "Demandez d'abord à la salle combien de temps prend une fiche chez eux, et notez les chiffres au tableau — c'est contre CES chiffres que la démonstration joue. Lancez ensuite le prompt sur la fiche technique du kit, et lisez la sortie à voix haute en pointant, pour chaque affirmation, la ligne source. Terminez par les quatre lignes « à compléter par le magasin » : c'est là que la salle comprend que l'outil ne décide ni du prix ni du stock.",
        faq: [
          {
            question: "Pourquoi interdire à l'outil d'écrire le prix et la disponibilité ?",
            reponse:
              "Parce qu'il les remplira, plausiblement et faux. Prix, stock, garantie et retours viennent de VOS systèmes, jamais d'un modèle de langage.",
          },
          {
            question: "On peut lui demander d'améliorer les caractéristiques, non ?",
            reponse:
              "Reformuler l'argumentaire, oui. Les caractéristiques, non : « déperlant » qui devient « imperméable », c'est un client qui revient et une fiche qui expose l'enseigne.",
          },
        ],
        blocages: [
          {
            situation:
              "La sortie ajoute quand même une mention « écologique » absente de la fiche technique.",
            parade:
              "Excellent incident : montrez-le et gardez-le à l'écran. C'est la preuve vivante que la consigne réduit le risque sans le supprimer, et que la relecture contre la fiche technique reste obligatoire.",
          },
          {
            situation:
              "Un stagiaire objecte que ses concurrents publient des fiches bien plus vendeuses.",
            parade:
              "Répondre en une phrase : « vendeur et prouvé ne s'opposent pas — l'argumentaire porte le style, les caractéristiques portent la preuve » — puis passer à la suite, le débat se videra à l'atelier.",
          },
        ],
        planB:
          "Quota atteint ou outil indisponible : la fiche technique et la sortie sont imprimées dans le kit formateur (datées). La lecture flèche par flèche se fait sur papier, à l'identique. Ne rien improviser en direct : les sorties du kit ont été vérifiées.",
      },
    },
    pratique: {
      consigne:
        "Deux temps, chacun sur son poste. D'abord la prise en main : déposez une fiche technique fournisseur — la vôtre ou celle de secours du kit — et faites-en ressortir la fiche produit avec la trame projetée, sans rien ajouter. Puis la pratique chronométrée : rédigez DEUX fiches complètes sur vos propres produits, dans le format de votre canal de vente (site, place de marché ou étiquette rayon), chaque affirmation devant se retrouver dans la fiche technique.",
      aEmporter:
        "Deux fiches produit publiables après vérification, plus la trame de prompt réutilisable — première pièce du manuel de publication.",
      dureeMin: 45,
      notes: {
        script:
          "Annoncez les trois causes d'échec AVANT que quiconque échoue : fiche technique scannée sans texte reconnu, PDF trop lourd, photo de catalogue illisible. La parade de chacune est sur le support — prévenu, le stagiaire vous appelle au lieu de se refermer. Annoncez le chronomètre à voix haute toutes les dix minutes. Passez dans les rangs, relancez sur la trame, ne rédigez à la place de personne.",
        faq: [
          {
            question: "Je n'ai pas de fiche technique sous la main, juste le produit en tête.",
            reponse:
              "Alors prenez la fiche de secours du kit. De mémoire, on n'écrit pas une fiche : la règle de la journée est justement qu'une caractéristique se recopie d'un document, jamais d'un souvenir.",
          },
          {
            question: "Ma photo de la fiche papier ressort illisible.",
            reponse:
              "Cadrez section par section plutôt que la page entière, et demandez « reconstitue ce texte ligne à ligne ». C'est la parade n° 3 de votre support.",
          },
        ],
        blocages: [
          {
            situation:
              "Un stagiaire colle sa grille tarifaire d'achat fournisseur « pour que la fiche soit complète ».",
            parade:
              "Arrêter immédiatement : conditions d'achat et marges ne passent jamais dans un outil. Le prix de VENTE s'ajoute à la main après coup, sur la ligne prévue.",
          },
          {
            situation: "Un binôme finit ses deux fiches en quinze minutes.",
            parade:
              "Leur faire produire la version place de marché de leur meilleure fiche (contrainte de 300 caractères) et préparer la restitution du groupe.",
          },
        ],
        planB:
          "Réseau tombé : la fiche s'écrit à la main sur la trame papier du support, à partir de la fiche technique. Ce qui compte est la structure et la règle de preuve, pas l'outil qui l'exécute — chacun relancera chez lui, la trame est datée et réutilisable.",
      },
    },
    verification: {
      question:
        "Contrôle croisé en binôme, grille fournie : dans les fiches de l'autre, barrez chaque affirmation que la fiche technique fournisseur ne prouve pas — caractéristique ajoutée, norme citée de mémoire, origine embellie, allégation santé ou environnementale — puis on compte les barres à voix haute.",
      reponseAttendue:
        "Chaque affirmation non prouvée est BARRÉE au stylo sur la copie du binôme. Le corrigé projeté liste les cinq ajouts que l'outil glisse le plus souvent : le superlatif invérifiable, le matériau embelli, la norme périmée, l'« écologique » sans preuve, le stock promis.",
      dureeMin: 10,
      notes: {
        script:
          "Faites barrer physiquement, au stylo, sur la copie de l'autre — le geste vaut le discours. Comptez les barres à main levée et notez le total au tableau : ce chiffre est le meilleur argument de la journée pour la relecture systématique.",
        faq: [
          {
            question: "L'outil a écrit « garantie 2 ans », et c'est vrai chez nous.",
            reponse:
              "Alors gardez-le — mais vous venez de le VÉRIFIER dans vos conditions de vente, ce n'est plus l'outil qui l'affirme. C'est toute la différence.",
          },
        ],
        blocages: [
          {
            situation: "Les copies sont trop propres, rien n'est barré.",
            parade:
              "Projetez la fiche volontairement chargée du kit et faites barrer collectivement. L'œil se règle en trois minutes, puis renvoyez aux copies réelles.",
          },
        ],
        planB: "Grille et corrigé sont imprimés dans le kit. Aucun outil nécessaire.",
      },
    },
    synthese: {
      acquis: [
        "Je produis une fiche en quelques minutes à partir de la fiche technique fournisseur — jamais de mémoire.",
        "Je ne publie aucune caractéristique, norme ou origine que la fiche technique ne prouve.",
        "Je laisse prix, disponibilité, garantie et retours au magasin — jamais à l'outil.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites-les FORMULER, ne récitez pas : « en une phrase, qu'est-ce que vous ne publierez plus sans vérifier ? ». Trois réponses suffisent. Annoncez la pause et la suite : on passe du produit unique à la série de cinquante.",
        faq: [],
        blocages: [
          {
            situation: "Personne ne parle, la salle veut sa pause.",
            parade:
              "Ne pas insister : énoncer les trois acquis vous-même et libérer. Un acquis arraché à contrecœur ne s'ancre pas mieux.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 2 — Du un au cinquante : produire en série et décliner
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-2",
    objectif: {
      enonce:
        "À la fin de ce module, vous produisez une série de fiches homogènes depuis votre tableau produits, et vous déclinez un même produit sur trois supports — dont un support de point de vente — sans le réécrire.",
      objectifGlobalId: "obj-1",
      // La déclinaison impose un support de point de vente (affiche de rayon) :
      // le module sert donc aussi la production des supports en magasin.
      objectifsSecondairesIds: ["obj-4"],
      dureeMin: 5,
      notes: {
        script:
          "Annoncez le changement d'échelle : le module 1 a prouvé qu'une fiche se produit vite ; ce module prouve que cinquante se produisent ENSEMBLE — et que la série se contrôle sans tout relire. Précisez tout de suite que le cadre qui suit (la liste rouge de ce qu'on ne colle jamais) conditionne tout l'atelier.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "Vingt produits à mettre en ligne : on ouvre la première fiche, on copie la précédente, on adapte. Au dixième produit, le format a dérivé — titres de longueurs différentes, rubriques dans le désordre — et il reste une demi-journée de travail.",
      apres:
        "Le tableau de vingt produits est déposé avec une trame imposée : vingt fiches sortent au même format, mêmes rubriques, même ton. Puis un seul produit est décliné site / place de marché / affiche de rayon depuis la même matière — trois supports, zéro réécriture.",
      prompt:
        "Voici un tableau de produits (colonnes : référence, nom, catégorie, matière, dimensions, coloris, prix conseillé, points forts fournisseur). Pour CHAQUE ligne, produis une fiche au format EXACT suivant : titre de 60 caractères maximum commençant par le nom ; argumentaire de 60 mots orienté usage client ; caractéristiques en cinq puces reprises du tableau SANS reformulation. N'utilise AUCUNE information absente du tableau ; si une case est vide, écris « non renseigné ». Même structure, même ton, même longueur pour toutes les fiches. Ensuite, pour la référence que je t'indique, décline la fiche en trois versions : description longue pour notre site, description courte de 300 caractères maximum pour la place de marché, et texte d'affiche de rayon — une accroche de huit mots maximum et trois caractéristiques clés — sans rien ajouter au contenu de la fiche.",
      outil: "Un seul outil, celui validé dans la salle.",
      captureEcran:
        "Trois fiches de la série côte à côte pour montrer l'homogénéité du format, puis les trois déclinaisons du même produit — avec la colonne du tableau source surlignée à chaque reprise.",
      verifieLe: VERIFIE_LE,
      dureeMin: 15,
      notes: {
        script:
          "Affichez d'abord le tableau du kit en entier, pour que la salle voie que TOUT part des colonnes. Lancez la série, puis faites défiler trois fiches côte à côte : c'est l'homogénéité qui impressionne, pas la vitesse. Terminez par la déclinaison et insistez : la même matière, trois formats — celui qui réécrit à la main pour chaque support fait le travail trois fois.",
        faq: [
          {
            question: "Vingt fiches d'un coup, il ne va pas se tromper quelque part ?",
            reponse:
              "Si, probablement — et c'est le sujet de la vérification tout à l'heure : on ne relit pas tout, on échantillonne. Une série se contrôle autrement qu'une fiche.",
          },
          {
            question: "Notre tableau produits n'a pas ces colonnes-là.",
            reponse:
              "Peu importe : la trame se cale sur VOS colonnes. Ce qui compte est de nommer chaque colonne dans le prompt et de n'autoriser rien d'autre.",
          },
        ],
        blocages: [
          {
            situation: "L'outil s'arrête au bout de douze fiches sur les vingt.",
            parade:
              "Relancer avec « continue la série au même format à partir de la référence suivante » — et montrer ce geste à la salle, ils le rencontreront chez eux.",
          },
          {
            situation: "Une fiche de la série sort avec un format différent des autres.",
            parade:
              "La garder à l'écran : c'est l'argument vivant du contrôle par échantillonnage qui arrive en vérification. Ne pas la corriger tout de suite.",
          },
        ],
        planB:
          "Outil indisponible : le tableau du kit, trois fiches de la série et les trois déclinaisons sont imprimés (pages 10 à 12, datées). La lecture comparée se tient sur papier, à l'identique.",
      },
    },
    pratique: {
      consigne:
        "Atelier chronométré, sur vos propres données. D'abord, passez votre tableau produits à la liste rouge : aucune colonne de marge, de conditions d'achat, ni aucune donnée client ne doit s'y trouver — supprimez-la AVANT tout dépôt. Puis produisez votre série de fiches homogènes avec la trame du module. Enfin, déclinez UN produit sur trois supports, dont un support de point de vente : affiche de rayon, chevalet ou étiquette.",
      aEmporter:
        "Votre série de fiches homogènes, la trame de série calée sur vos colonnes, et les trois déclinaisons du produit témoin — deuxième pièce du manuel de publication.",
      dureeMin: 40,
      notes: {
        script:
          "Avant de lancer le chronomètre, répétez la liste rouge du cadre, telle quelle : fichier clients, chiffre d'affaires, marges, conditions d'achat fournisseurs — rien de tout cela ne se colle, et retirer les noms d'un fichier client ne le fait pas sortir du RGPD. Faites vérifier les colonnes en binôme AVANT le premier dépôt. Pendant l'atelier, relancez sur le format : une série dont les fiches diffèrent n'est pas une série.",
        faq: [
          {
            question: "Ma colonne « prix d'achat », je peux la laisser si je ne m'en sers pas ?",
            reponse:
              "Non : ce qui est déposé est déposé. On supprime la colonne du fichier de travail avant dépôt — c'est trente secondes, et c'est le réflexe à installer.",
          },
          {
            question: "Je n'ai pas de tableau produits, tout est dans le logiciel de caisse.",
            reponse:
              "Exportez dix produits en tableau si l'export est simple, sinon prenez le tableau de secours du kit. L'objectif est le procédé, il se transpose lundi.",
          },
        ],
        blocages: [
          {
            situation:
              "Un stagiaire dépose son tableau avec une colonne de marges « parce que ça ira plus vite ».",
            parade:
              "Arrêter immédiatement, sans négocier, et rappeler la règle en une phrase. C'est le point de la journée où l'on ne discute pas.",
          },
          {
            situation: "Le réseau sature au moment des dépôts simultanés.",
            parade:
              "Faire démarrer par vagues de cinq, annoncé comme une consigne d'atelier, pas comme un incident.",
          },
        ],
        planB:
          "Outil indisponible : la trame de série se construit sur papier — choix des colonnes, format imposé rubrique par rubrique, règle d'échantillonnage — et l'exercice de contrôle se fait sur la série témoin imprimée du kit. La production réelle se relance au bureau avec la trame datée.",
      },
    },
    verification: {
      question:
        "Contrôle par échantillonnage, en binôme : tirez TROIS fiches au hasard dans la série de l'autre et vérifiez quatre points — prix conforme au tableau, caractéristiques toutes prouvées, mentions obligatoires présentes, formulations stéréotypées sur le genre, l'âge ou l'origine. Si une fiche tombe, que fait-on de la série ?",
      reponseAttendue:
        "Les trois fiches passées aux quatre points, écarts relevés à voix haute. Et la règle énoncée par la salle elle-même : si une fiche tombe, TOUTE la série repasse — une erreur d'échantillon n'est jamais isolée, elle s'est répliquée sur les cinquante fiches.",
      dureeMin: 20,
      notes: {
        script:
          "Faites tirer les trois fiches vraiment au hasard — numéros tirés à voix haute, pas « les trois premières ». Sur les stéréotypes, renvoyez aux exemples du kit vus au cadre : une formulation genrée dans la trame se réplique à l'identique sur toute la série, c'est le défaut le plus silencieux de la production en masse.",
        faq: [
          {
            question: "Trois fiches sur cinquante, c'est vraiment suffisant ?",
            reponse:
              "Pour attraper une erreur de TRAME, oui — elle est partout, donc dans l'échantillon. Pour une erreur de LIGNE du tableau source, non : c'est le tableau qu'il faut tenir propre, pas les fiches.",
          },
        ],
        blocages: [
          {
            situation: "Un binôme valide les trois fiches sans avoir ouvert le tableau source.",
            parade:
              "Demander : « conforme à quoi ? ». Sans le tableau sous les yeux, on ne vérifie pas, on approuve. Faire refaire avec le tableau ouvert.",
          },
        ],
        planB:
          "L'échantillonnage se pratique sur la série témoin imprimée du kit, qui contient trois écarts plantés. Grille et corrigé imprimés, aucun outil nécessaire.",
      },
    },
    synthese: {
      acquis: [
        "Je produis une série homogène depuis un tableau nettoyé — jamais fiche par fiche.",
        "Je contrôle par échantillonnage, et si une fiche tombe, toute la série repasse.",
        "Je décline un produit sur ses supports, y compris en rayon, sans le réécrire.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites formuler la règle d'échantillonnage par un stagiaire, avec ses mots — c'est la pièce du manuel que le module vient de produire. Annoncez le déjeuner et l'après-midi : les avis clients, et ce qu'on ne fait JAMAIS avec.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 3 — Avis clients, fiche d'établissement et écrire autour du chiffre
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-3",
    objectif: {
      enonce:
        "À la fin de ce module, vous répondez publiquement à un avis difficile sans rien révéler du client ni engager l'enseigne, et vous faites écrire formules et commentaires autour de vos chiffres sans jamais les livrer.",
      objectifGlobalId: "obj-2",
      // Le second versant du module — « écrire autour du chiffre » — sert
      // l'appui à l'analyse des ventes : formules, tableaux croisés,
      // commentaires de résultats déjà calculés.
      objectifsSecondairesIds: ["obj-3"],
      dureeMin: 5,
      notes: {
        script:
          "Posez d'entrée les deux lignes rouges, avant même le cadre : on ne fabrique jamais un avis, un témoignage ni une note — et une réponse publique ne confirme jamais qu'une personne est cliente ni ne révèle rien de son dossier. Tout le module tient dans ces deux phrases ; le cadre qui suit dira pourquoi la loi les impose.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "Un avis à une étoile, injuste. La réponse part à chaud : elle conteste les faits, confirme au passage la commande et sa date, promet un remboursement — en public. L'avis suivant citera cette réponse, et l'enseigne est engagée.",
      apres:
        "Le même avis traité en deux temps. D'abord la réponse qui referme : remerciement, position de l'enseigne, invitation vers un canal privé — sans confirmer que la personne est cliente, sans rien révéler d'un dossier. Puis la bascule sur le chiffre : la même question de calcul posée deux fois sur les mêmes données collées rend deux totaux différents — l'outil écrit la formule, il ne calcule pas.",
      prompt:
        "PROMPT 1 — répondre à l'avis : « Voici un avis publié sur notre fiche, recopié sans le nom de son auteur : [coller le texte de l'avis]. Rédige une réponse publique de 70 mots maximum qui remercie, exprime notre exigence de qualité et invite à écrire à [adresse du service client] pour examiner la situation. INTERDITS : ne confirme pas que la personne est cliente, ne mentionne ni commande, ni date, ni produit, ni montant, ne promets aucun remboursement ni geste commercial, n'admets aucune faute. »\n\nPROMPT 2 — écrire autour du chiffre : « Mon tableau de ventes a les colonnes suivantes : date, magasin, famille de produits, quantité, montant TTC. SANS que je te fournisse les données, écris la formule de tableur qui totalise le montant par famille de produits et par mois, puis explique-la ligne à ligne pour que je puisse l'adapter. »",
      outil: "Un seul outil, celui validé dans la salle.",
      captureEcran:
        "Les deux réponses à l'avis côte à côte — les passages qui confirment la commande et promettent un geste entourés en rouge dans la première — puis les deux totaux différents rendus par l'outil sur les mêmes données collées.",
      verifieLe: VERIFIE_LE,
      dureeMin: 20,
      notes: {
        script:
          "Lisez d'abord la réponse qui aggrave à voix haute, avec conviction — la salle doit sentir qu'elle aurait pu l'écrire. Puis la réponse qui referme, et comparez mot à mot : ce que la première CONFIRME, la seconde le tait. Pour le chiffre : collez le petit tableau du kit, demandez le total, recommencez dans une nouvelle conversation — les deux totaux diffèrent. Concluez d'une phrase : l'IA écrit AUTOUR du chiffre, jamais LE chiffre.",
        faq: [
          {
            question: "Si le client dit vrai et qu'on a fauté, on ne s'excuse même pas ?",
            reponse:
              "On peut regretter l'expérience vécue sans admettre un fait précis en public : le traitement du fond se fait en privé, dossier en main. La nuance exacte est sur la trame du kit.",
          },
          {
            question: "Pourquoi l'outil se trompe sur une simple addition ?",
            reponse:
              "Parce qu'il génère du texte plausible, il ne calcule pas. C'est votre tableur qui calcule — l'outil écrit la formule que le tableur exécutera.",
          },
        ],
        blocages: [
          {
            situation:
              "Les deux totaux sortent identiques, la démonstration du chiffre tombe à plat.",
            parade:
              "Relancer sur le tableau long du kit : plus de lignes, l'écart apparaît. Sinon, montrer les deux captures datées du kit — et le dire : « ça n'a pas raté aujourd'hui, ça ratera lundi ».",
          },
          {
            situation:
              "Un stagiaire raconte que son concurrent fait manifestement écrire ses avis.",
            parade:
              "Rappeler la ligne rouge sans juger le cas : nous, on ne fabrique jamais un avis. Pour le signalement d'un concurrent : « je ne me prononce pas, notez la question, votre conseil tranchera ».",
          },
        ],
        planB:
          "Outil indisponible : les deux réponses à l'avis et les deux totaux contradictoires sont imprimés dans le kit (datées), surlignage déjà appliqué. La comparaison mot à mot se tient sur papier.",
      },
    },
    pratique: {
      consigne:
        "Deux temps. D'abord l'atelier avis, chronométré : répondez à trois avis réels de votre enseigne — un positif, un négatif, un injustifié — recopiés SANS le nom de leur auteur, sur vos avis produit et place de marché, puis complétez la réponse type de votre fiche d'établissement locale sur la trame fournie. Ensuite le chiffre : faites écrire la formule ou le tableau croisé dont vous avez besoin en décrivant la STRUCTURE de votre tableau (noms de colonnes, types de valeurs), jamais son contenu, puis testez-la sur votre fichier.",
      aEmporter:
        "Trois réponses publiables après relecture, la réponse type de la fiche d'établissement, et une formule testée sur votre propre fichier — troisième pièce du manuel de publication.",
      dureeMin: 45,
      notes: {
        script:
          "Répétez les deux lignes rouges AU DÉMARRAGE de l'atelier, pas seulement en ouverture : on ne fabrique jamais un avis, et une réponse publique ne confirme jamais qu'une personne est cliente. Les avis se recopient sans le pseudo de l'auteur ni aucun élément identifiant. Sur le chiffre : la structure du tableau passe dans l'outil, jamais son contenu — c'est la même liste rouge que ce matin. Vous n'arbitrez AUCUNE question juridique : « je ne me prononce pas, notez la question, votre conseil tranchera ».",
        faq: [
          {
            question:
              "Offrir un bon d'achat contre un avis, c'est autorisé si l'avis est sincère ?",
            reponse:
              "Question pour votre conseil, pas pour moi : notez-la. Ce qui est certain et non négociable aujourd'hui : on n'écrit pas l'avis, ni ne le fait écrire.",
          },
          {
            question: "Répondre à un avis positif, ça sert vraiment ?",
            reponse:
              "C'est la réponse la plus rentable : trente secondes, zéro risque, et c'est elle que lisent les futurs clients. La trame du kit en fait un réflexe.",
          },
        ],
        blocages: [
          {
            situation:
              "Un stagiaire colle l'export complet de ses ventes « pour que la formule soit juste ».",
            parade:
              "Arrêter immédiatement : la structure, jamais le contenu. Faire effacer, redemander avec les seuls noms de colonnes — la formule sortira identique.",
          },
          {
            situation: "Un stagiaire n'a aucun avis en ligne à traiter.",
            parade:
              "Le kit fournit trois avis de secours : un positif, un négatif, un injustifié. Ne le laissez pas regarder son voisin travailler.",
          },
        ],
        planB:
          "Outil indisponible : les trois avis du kit se traitent sur les trames papier à trous (remerciement, position, canal privé), et la formule s'écrit à la main à partir de la structure du tableau — la syntaxe exacte se vérifiera au bureau. Rien de l'atelier n'exige l'outil pour être compris.",
      },
    },
    verification: {
      question:
        "Relecture croisée en binôme sur la grille fournie : dans les réponses de l'autre, repérez ce qui divulgue une donnée personnelle ou confirme que la personne est cliente, ce qui promet un geste commercial, ce qui admet une faute ou engage l'enseigne. Chaque réponse est déclarée publiable ou renvoyée.",
      reponseAttendue:
        "Chaque réponse passée aux trois catégories et marquée « publiable » ou « renvoyée », avec le motif. Le corrigé montre les trois fuites les plus fréquentes : la date d'achat reprise de l'avis, le produit nommé en réponse, le remboursement promis en public.",
      dureeMin: 10,
      notes: {
        script:
          "La fuite la plus sournoise est celle qui REPREND l'avis : le client a cité sa date d'achat, la réponse la reformule — et voilà l'enseigne qui confirme publiquement le dossier. Faites-la chercher dans le corrigé avant de la nommer.",
        faq: [],
        blocages: [
          {
            situation: "Un binôme déclare tout publiable sans rien relever.",
            parade:
              "Leur donner la réponse piégée du kit, qui contient les trois fuites. S'ils n'en trouvent aucune, refaire la lecture avec eux — l'œil n'est pas réglé.",
          },
        ],
        planB: "Grille et corrigé imprimés dans le kit. Aucun outil nécessaire.",
      },
    },
    synthese: {
      acquis: [
        "Je réponds à un avis sans confirmer que la personne est cliente ni rien révéler d'un dossier.",
        "Je ne fabrique jamais un avis, un témoignage ni une note — et je sais l'expliquer à mon équipe.",
        "Je fais écrire formules et commentaires depuis la structure de mes tableaux, jamais leur contenu.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites reformuler les deux lignes rouges par la salle, pas par vous — c'est elles qui doivent redescendre en magasin. Annoncez la pause et le dernier module : tout ce qui a été produit aujourd'hui devient le manuel de l'enseigne.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 4 — Le manuel de publication de l'enseigne
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-4",
    objectif: {
      enonce:
        "À la fin de ce module, vous repérez dans votre propre historique ce qui n'aurait jamais dû être collé, et vous repartez avec le manuel de publication de l'enseigne, utilisable dès demain par un vendeur qui n'était pas en salle.",
      objectifGlobalId: "obj-5",
      // Le manuel assemble aussi les trames de supports de rayon produites au
      // module 2 : il sert donc, en second, la production des supports de
      // point de vente.
      objectifsSecondairesIds: ["obj-4"],
      dureeMin: 5,
      notes: {
        script:
          "Reprenez le tableau du tour de table du matin : montrez ce que la journée a couvert, et dites honnêtement ce qu'elle n'a pas couvert — cette honnêteté achète la crédibilité du reste. Puis posez le critère du module : le manuel est réussi si un vendeur absent aujourd'hui peut publier avec, sans rien demander.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "La trame qui a bien marché ce matin est rejouée telle quelle sur un autre produit : le format change — l'ordre des rubriques bouge, le titre s'allonge — parce que la consigne reposait sur des sous-entendus que l'outil n'a pas retenus.",
      apres:
        "La même trame durcie en consigne réutilisable : format imposé rubrique par rubrique, limites chiffrées, interdits écrits. Rejouée sur un troisième produit, elle rend exactement le même format — c'est le test qui dit qu'une trame est finie, et c'est lui qui décide de l'entrée au manuel.",
      prompt:
        "Tu appliques la consigne de publication suivante, sans t'en écarter. FORMAT : titre de 60 caractères maximum commençant par le nom du produit ; argumentaire de 60 mots orienté usage client ; caractéristiques en cinq puces reprises de la fiche technique SANS reformulation ; une dernière ligne « Prix, disponibilité, garantie, retours : à compléter par le magasin ». INTERDITS : aucune caractéristique absente de la fiche technique, aucune allégation de santé ou environnementale, aucun superlatif invérifiable, aucun élément concernant un client. Produit à traiter : [coller la fiche technique]. Rends UNIQUEMENT la fiche, sans commentaire.",
      outil: "Un seul outil, celui validé dans la salle.",
      captureEcran:
        "Les deux sorties de la trame rejouée côte à côte : à gauche le format qui dérive, à droite le format identique au premier passage — les écarts surlignés.",
      verifieLe: VERIFIE_LE,
      dureeMin: 10,
      notes: {
        script:
          "Rejouez d'abord la trame « molle » du matin sur un produit du kit et laissez la salle constater la dérive — ne l'annoncez pas. Puis la consigne durcie, deux produits de suite, formats identiques. Énoncez le test en une phrase : une trame n'entre au manuel que si, rejouée sur un autre produit, elle rend le même format.",
        faq: [
          {
            question: "Pourquoi « rends uniquement la fiche, sans commentaire » ?",
            reponse:
              "Parce qu'un vendeur pressé copie-colle la sortie entière. Si l'outil bavarde autour, le bavardage part en ligne avec la fiche.",
          },
        ],
        blocages: [
          {
            situation: "Même durcie, la trame rend un format légèrement différent.",
            parade:
              "Montrer où la consigne laissait un choix — c'est toujours là que ça dérive — et le fermer en direct par une limite chiffrée. C'est exactement le geste qu'ils referont chez eux.",
          },
        ],
        planB:
          "Outil indisponible : les deux sorties rejouées sont imprimées dans le kit (datées), écarts surlignés. Le test de la trame finie s'explique sur papier.",
      },
    },
    pratique: {
      consigne:
        "Trois temps. D'abord le retour sur vos propres demandes : relisez l'historique de votre journée et repérez ce qui n'aurait pas dû être collé — fichier clients, marges, conditions fournisseurs — puis réécrivez une demande fautive en demande propre. Ensuite, assemblez le manuel de publication de l'enseigne : trame de fiche produit et sa checklist de contrôle, procédé de série et sa règle d'échantillonnage, réponses types aux avis produit et place de marché, trames de supports de rayon. Enfin, la feuille de route : trois usages datés, un usage explicitement écarté, et le nom de la personne qui relit avant publication — inscrits dans le manuel.",
      aEmporter:
        "Le manuel de publication complet de l'enseigne — trames testées, checklists, règle d'échantillonnage, réponses types, supports de rayon — avec sa feuille de route datée et le nom du relecteur.",
      dureeMin: 50,
      notes: {
        script:
          "Le retour sur l'historique se fait chacun sur son poste, en silence, cinq minutes — puis chacun lit à voix haute UNE demande qu'il réécrit, sans se justifier. Sur le manuel : faites-le NOMMER (« manuel-publication-<enseigne>-<date> ») et faites nommer le relecteur — un manuel sans nom ni titulaire ne redescend jamais en magasin. Sur la feuille de route : l'usage ÉCARTÉ compte autant que les trois retenus, c'est lui qui protège l'équipe.",
        faq: [
          {
            question: "Quel usage faut-il écarter ?",
            reponse:
              "Celui que la journée a exclu pour VOTRE contexte : faire écrire des avis, coller le fichier clients, laisser l'outil fixer les prix… L'écrire noir sur blanc évite qu'un vendeur bien intentionné le fasse dans six mois.",
          },
          {
            question: "Qui doit être le relecteur avant publication ?",
            reponse:
              "Quelqu'un qui a la fiche technique et les conditions de vente sous la main — pas forcément un chef, mais quelqu'un qui peut VÉRIFIER, pas seulement relire.",
          },
        ],
        blocages: [
          {
            situation: "Un stagiaire a un historique vide ou trop propre, rien à réécrire.",
            parade:
              "Le kit fournit six demandes à trier, dont trois fautives. L'exercice tient à l'identique, et souvent mieux : on juge plus lucidement les demandes des autres.",
          },
          {
            situation: "La feuille de route reste vague : « on va utiliser l'IA pour les fiches ».",
            parade:
              "Reformuler en une question : « quelle série, quel jour, qui relit ? ». Ne pas passer au suivant tant que la réponse ne porte pas un nom et une date.",
          },
        ],
        planB:
          "Aucun outil nécessaire : le retour d'historique se remplace par le tri des six demandes du kit, et l'assemblage du manuel se fait sur papier. C'est l'atelier le plus robuste de la journée — gardez-le complet même si tout le reste a été dégradé.",
      },
    },
    verification: {
      question:
        "Validation des acquis : quiz individuel de dix questions, corrigé en salle question par question. Puis passage de votre propre production du jour à la grille de critères fournie — mentions obligatoires présentes, caractéristiques prouvées par la fiche technique, rien de personnel publié.",
      reponseAttendue:
        "Le corrigé est commenté question par question, sans en passer aucune. Le seuil de réussite est celui déclaré au programme ; un score en dessous déclenche la reprise individuelle prévue au dispositif.",
      dureeMin: 20,
      notes: {
        script:
          "C'est l'évaluation des acquis au sens de l'indicateur 11 : elle se tient, elle se corrige, et elle se conserve. Ne la sacrifiez jamais au temps qui manque — si vous êtes en retard, coupez ailleurs. Le passage à la grille se fait ensuite, chacun sur SA production : c'est lui qui relie le quiz au geste réel.",
        faq: [
          {
            question: "Le résultat du quiz sera transmis à mon employeur ?",
            reponse:
              "Le résultat individuel ne l'est pas. Ce qui est transmis, c'est l'attestation de fin de formation et le fait que l'évaluation a eu lieu.",
          },
        ],
        blocages: [
          {
            situation: "Il est 17 h 15 et le quiz n'est pas commencé.",
            parade:
              "Le tenir quand même, en réduisant le commentaire du corrigé aux questions les plus ratées. On ne remplace jamais l'évaluation par un tour de table.",
          },
        ],
        planB: "Quiz papier dans le kit et corrigé page 27. Aucune dépendance à un outil.",
      },
    },
    synthese: {
      acquis: [
        "Je sais ce que je publie seul, ce que je fais relire, et ce que je ne fais pas faire à l'IA.",
        "Je ne colle jamais fichier clients, marges ni conditions fournisseurs — et je repère une demande fautive dans un historique.",
        "Le manuel de publication a un nom, un relecteur désigné et trois usages datés.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Chacun lit à voix haute UN usage daté de sa feuille de route, et l'usage qu'il écarte. Notez-les au tableau, prenez une photo, envoyez-la au groupe : c'est l'engagement qui redescend en magasin. Clôturez sur les deux lignes rouges de l'après-midi — elles doivent partir avec eux.",
        faq: [],
        blocages: [
          {
            situation: "Les engagements restent vagues au moment de conclure.",
            parade:
              "Une question par personne, pas plus : « quel produit, quel jour ? ». Puis clôturer — l'énergie de fin de journée ne se rattrape pas.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },
];
