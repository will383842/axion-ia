/**
 * CONTENU RÉDIGÉ — « IA pour les achats » (1 jour, 7 h, 4 modules).
 *
 * ## Le fil rouge
 *
 * Chacun repart avec UN dossier d'arbitrage fournisseur prêt à être envoyé au
 * décideur, construit pièce par pièce au fil des quatre modules. Le module 1
 * pose la liste rouge et le devis de travail, le module 2 produit le comparatif
 * sans en recopier un chiffre, le module 3 écrit les relances et le courrier de
 * réserve, le module 4 vérifie la note de marché et assemble. Aucun module ne se
 * suffit à lui-même, et c'est voulu : l'ordre est l'enseignement.
 *
 * ## Deux règles que le formateur ne négocie pas
 *
 * **Aucun devis réel ni donnée fournisseur réelle n'est déposé dans un outil
 * pendant la journée.** Les ateliers tournent sur le jeu de devis fourni au kit,
 * décliné par famille d'achat. Conditions négociées, prix, remises et contrats
 * relèvent du secret des affaires : ils ne sortent jamais, même sans le nom du
 * fournisseur. Un stagiaire qui ouvre un vrai devis pendant l'atelier est
 * arrêté, sans discussion : la formation ne peut pas provoquer le manquement
 * qu'elle enseigne à éviter.
 *
 * **Le formateur n'arbitre aucune question juridique.** La formule est écrite,
 * elle se prononce telle quelle : « je ne me prononce pas, notez la question,
 * votre conseil tranchera ». Les modèles de courriers remis au kit font foi en
 * séance et ne se modifient pas ; les écarts se notent pour le juriste du
 * client.
 *
 * **Et une règle de fiabilité qui traverse la journée :** une note de marché
 * produite par l'IA n'est JAMAIS une source. Toute donnée chiffrée et tout nom
 * cité se vérifient à une source que l'on peut citer, sinon ils disparaissent.
 *
 * ⚠️ Les références juridiques (secret des affaires, pénalités de retard,
 * données personnelles des indépendants) sont portées par les séquences `cadre`
 * du catalogue et fournies au formateur SOURCÉES ET DATÉES dans le kit. Leur
 * formulation reste à faire relire par le conseil de l'organisme.
 */

import type { EnrichissementFormation } from "./types";

/** Date de dernière vérification des captures et sorties d'outils. */
const VERIFIE_LE = "2026-08-06";

export const IA_POUR_LES_ACHATS: EnrichissementFormation = [
  // ───────────────────────────────────────────────────────────────────────────
  // Module 1 — Le cadre d'usage : ce qui sort, ce qui ne sort jamais
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-1",
    objectif: {
      enonce:
        "À la fin de ce module, vous distinguez ce qui peut entrer dans un outil d'IA de ce qui n'y entre jamais, et vous disposez de vos trois devis de travail pour les ateliers de la journée.",
      objectifGlobalId: "obj-5",
      dureeMin: 5,
      notes: {
        script:
          "Tour de salle en UNE phrase, pas une par personne qui s'étale : « votre prénom, votre famille d'achat, et le cas que vous voulez avoir traité ce soir ». Notez chaque cas au tableau — vous y reviendrez au module 4 pour montrer ce que la journée a couvert. Annoncez tout de suite la règle qui tient la journée : l'IA prépare, l'acheteur décide et signe. Et annoncez le livrable : chacun repart avec son dossier d'arbitrage fournisseur.",
        faq: [
          {
            question: "On va pouvoir coller nos devis fournisseurs dans l'outil ?",
            reponse:
              "Pas les vrais, et c'est le premier enseignement de la journée : conditions négociées, prix et remises ne sortent jamais. Les ateliers tournent sur le jeu de devis du kit — vous y perdez rien, la méthode est identique.",
          },
          {
            question: "Notre DSI a bloqué ChatGPT, on va faire quoi ?",
            reponse:
              "Exactement ce qu'on voit dans une demi-heure : les trois régimes d'usage. Un blocage n'est pas une interdiction de l'IA, c'est un choix de régime. Notez le nom de l'outil validé chez vous, on travaillera avec.",
          },
        ],
        blocages: [
          {
            situation: "Le tour de salle dérive en plaintes sur l'ERP ou le circuit de validation.",
            parade:
              "Couper avec : « on note, et on regarde à 16 h si l'IA change quelque chose là-dessus » — puis écrire la plainte au tableau. La reprendre au module 4 fait beaucoup pour la crédibilité.",
          },
        ],
        planB:
          "Aucun outil n'est nécessaire ici. Si le vidéoprojecteur est en panne, le tour de salle et la règle du jour se tiennent au paperboard sans rien perdre.",
      },
    },
    demonstration: {
      avant:
        "Trois devis pour la même prestation se comparent aujourd'hui à la main : trois PDF ouverts côte à côte, un tableur, une heure à recopier des lignes — et des postes qui ne se recouvrent pas d'un devis à l'autre.",
      apres:
        "Les trois mêmes devis déposés avec une consigne affichée en entier : les postes s'alignent en un tableau, les écarts de périmètre ressortent, les questions à poser à chaque fournisseur s'écrivent d'elles-mêmes. Et les totaux ne sont pas calculés — c'est la règle, pas un oubli.",
      prompt:
        "Voici trois devis pour la même prestation, joints en PDF. Aligne les postes comparables dans un tableau : une ligne par poste, une colonne par devis. Quand un poste n'apparaît que dans certains devis, écris « non chiffré » dans les colonnes des autres. Relève ensuite les écarts de périmètre — ce que l'un chiffre et que l'autre ne mentionne pas — et liste les questions à poser à chaque fournisseur avant toute comparaison de prix. Ne calcule aucun total, n'additionne rien, ne recommande aucun devis : les totaux et la décision restent de mon côté.",
      outil: "Un seul outil, celui validé dans la salle (Claude ou ChatGPT selon le groupe).",
      captureEcran:
        "Le tableau d'alignement produit, les cases « non chiffré » entourées, et la consigne affichée à côté avec la ligne « ne calcule aucun total » surlignée.",
      verifieLe: VERIFIE_LE,
      dureeMin: 15,
      notes: {
        script:
          "Commencez par la version à la main : ouvrez les trois PDF du kit côte à côte et faites chercher à la salle le poste « livraison » dans chacun — laissez trente secondes d'inconfort, c'est leur quotidien. Puis lancez la consigne et lisez la sortie ligne à ligne. Insistez sur deux points : les cases « non chiffré » sont la vraie trouvaille (un devis moins cher est souvent un devis qui chiffre moins de choses), et l'absence de totaux est volontaire — l'outil produit des totaux plausibles et parfois faux, sans signaler le doute ; le tableur, lui, ne se trompe pas. L'IA aligne, le tableur calcule.",
        faq: [
          {
            question: "Pourquoi lui interdire les totaux ? Il sait calculer, non ?",
            reponse:
              "Il produit des totaux plausibles, et parfois faux, sans jamais signaler le doute. Recalculer au tableur prend trois minutes et ne laisse aucune incertitude. On sépare les rôles : l'IA aligne, le tableur calcule.",
          },
          {
            question: "Et nos stocks, nos prévisions de consommation ?",
            reponse:
              "Ils restent dans vos systèmes — ERP, WMS, tableur. L'IA travaille sur les documents qui entourent les flux : devis, cahiers des charges, relances, synthèses. C'est là que part le temps du service.",
          },
        ],
        blocages: [
          {
            situation: "Le tableau produit désaligne des postes ou invente une ligne.",
            parade:
              "Ne pas le cacher, l'exploiter : c'est exactement pour cela que le module 2 commence par un test de contrôle. Montrez l'écart, annoncez qu'on apprendra à l'attraper systématiquement après la pause.",
          },
          {
            situation: "Un stagiaire sort un vrai devis de son sac pour « tester sur du concret ».",
            parade:
              "Refuser fermement et expliquer en une phrase : « aucun devis réel ne se dépose aujourd'hui, c'est précisément la règle que la journée installe ». Le jeu du kit couvre sa famille d'achat.",
          },
        ],
        planB:
          "Quota atteint ou outil indisponible : le tableau d'alignement est imprimé dans le kit (pages 4 et 5, datées), avec les trois devis source. La lecture ligne à ligne et le repérage des « non chiffré » se tiennent à l'identique sur papier. Ne rien improviser en direct : les sorties du kit ont été vérifiées.",
      },
    },
    pratique: {
      consigne:
        "Deux temps. D'abord, chacun sur son poste : ouvrez l'outil, retrouvez sous quel régime d'usage vous travaillez et où est écrit — ou absent — l'engagement de non-réutilisation de vos données, puis notez la réponse en tête de votre dossier. Ensuite, remplissez la liste rouge de votre service sur la trame à trois colonnes du kit (jamais / seulement en offre entreprise / libre), faites-la relire par votre voisin qui doit y trouver au moins un oubli, puis choisissez dans le jeu du kit les trois devis de travail les plus proches de votre famille d'achat.",
      aEmporter:
        "Votre régime d'usage noté et daté, la liste rouge de votre service relue par un tiers, et vos trois devis de travail — la matière de tous les ateliers de la journée. Première pièce du dossier d'arbitrage.",
      dureeMin: 35,
      notes: {
        script:
          "Guidez le geste « où passent mes données » écran par écran, sur l'outil validé de la salle : le chemin en trois clics est dans le kit, capture par capture. Faites un tour de salle rapide sur les écarts — il y a presque toujours un compte grand public au milieu des offres entreprise, et c'est une découverte utile, pas une faute. Sur la liste rouge : rappelez que ce n'est pas une liste de mots mais de familles d'information — tarifs négociés, remises, coûts de revient, contrats, litiges en cours. Le voisin DOIT trouver un oubli : annoncez-le comme une règle du jeu, pas comme une politesse.",
        faq: [
          {
            question: "Mon voisin n'a rien trouvé à redire à ma liste.",
            reponse:
              "Alors elle est incomplète : personne ne pense seul aux remises de fin d'année ni aux conditions logistiques. Les deux oublis les plus fréquents sont au dos de la trame — vérifiez-les.",
          },
          {
            question: "Un devis reçu, c'est adressé à nous — on peut le coller, non ?",
            reponse:
              "Un devis reste couvert par sa clause de confidentialité même sans le nom du fournisseur, et un devis d'artisan ou d'indépendant porte des données personnelles. En atelier, la liste rouge tranche. Pour votre cas précis : notez la question, votre conseil tranchera.",
          },
        ],
        blocages: [
          {
            situation:
              "Un stagiaire ne retrouve aucun engagement de non-réutilisation dans son offre.",
            parade:
              "C'est une information en soi : faites-la noter telle quelle — « engagement non trouvé le <date> » — et remonter à la DSI. Un engagement introuvable se traite comme un engagement absent.",
          },
          {
            situation: "Plusieurs stagiaires n'ont aucun compte utilisable, tout est bloqué.",
            parade:
              "Binômes sur les postes équipés pour le geste « où passent mes données », et trame papier pour le reste — la liste rouge et le choix des devis de travail ne dépendent d'aucun outil.",
          },
        ],
        planB:
          "Le geste « où passent mes données » se fait sur les captures imprimées du kit (pages 7 à 9, datées, un jeu par régime). La liste rouge et le choix des trois devis de travail sont entièrement papier. L'atelier se tient sans réseau.",
      },
    },
    verification: {
      question:
        "Cinq cas concrets projetés, réponse individuelle par écrit — « je colle / je ne colle pas / je reformule » : un devis d'artisan avec nom et adresse, un tableau de prix négociés sans nom de fournisseur, un cahier des charges déjà publié, un fil d'e-mails de litige en cours, un contrat-cadre signé.",
      reponseAttendue:
        "Le corrigé projeté tranche les cinq cas ; les deux qui divisent la salle — le tableau de prix sans nom et le devis d'artisan — se corrigent par vote à main levée puis explication : retirer le nom ne retire ni la clause de confidentialité, ni le caractère personnel des données d'un indépendant.",
      dureeMin: 10,
      notes: {
        script:
          "Faites ÉCRIRE avant de projeter le corrigé — une réponse orale se rallie à la majorité, une réponse écrite engage. Commencez la correction par le cas facile (le cahier des charges publié) pour installer le geste, gardez le devis d'artisan pour la fin. Sur les deux cas qui divisent, demandez UNE raison à un votant de chaque camp avant de trancher.",
        faq: [
          {
            question: "Le devis d'artisan, si j'enlève le nom et l'adresse, ça passe ?",
            reponse:
              "Non : pseudonymiser n'est pas anonymiser. Le devis d'un indépendant reste rattachable à la personne par son contenu même — le lieu du chantier, la nature des travaux, le prix suffisent souvent à le réidentifier.",
          },
        ],
        blocages: [
          {
            situation: "La salle se range à la majorité sans argumenter.",
            parade:
              "Interroger nommément un votant minoritaire : « qu'est-ce qui vous a arrêté ? ». La minorité a souvent vu le bon détail, et le dire à voix haute vaut le corrigé.",
          },
        ],
        planB:
          "Les cinq cas et le corrigé sont imprimés dans le kit (page 11). Sans vidéoprojecteur, ils se distribuent et se corrigent à l'oral.",
      },
    },
    synthese: {
      acquis: [
        "Je fais les deux gestes avant chaque copier-coller : je vérifie mon régime d'usage, je passe le document à la liste rouge.",
        "Je sais dire au collègue qui veut coller un contrat fournisseur pourquoi il ne le fait pas — et quoi faire à la place.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites FORMULER la phrase au collègue par deux ou trois stagiaires, à voix haute — une phrase qu'on n'a jamais prononcée ne sort pas le jour où il faut. Annoncez la pause et ce qui suit : on compare les devis pour de bon, sans en recopier un chiffre.",
        faq: [],
        blocages: [
          {
            situation: "Personne ne parle, la salle veut sa pause.",
            parade:
              "Ne pas insister : énoncer les deux acquis vous-même et libérer. Un acquis mal formulé à contrecœur ne s'ancre pas mieux.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 2 — Comparer des devis sans en recopier un chiffre
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-2",
    objectif: {
      enonce:
        "À la fin de ce module, vous produisez un comparatif de trois devis sous vos propres critères pondérés, totaux recalculés à la main, avec les questions à reposer à chaque fournisseur.",
      objectifGlobalId: "obj-1",
      // La séquence « du besoin flou à la consultation » produit la trame de
      // consultation structurée — l'amorce du cahier des charges vendu en obj-2.
      objectifsSecondairesIds: ["obj-2"],
      dureeMin: 5,
      notes: {
        script:
          "Annoncez la règle du module, elle est dans son titre : comparer sans en recopier un chiffre. L'IA aligne et pose les questions, le tableur calcule, vous tranchez. Annoncez aussi le livrable : à midi, chacun a un comparatif défendable devant son responsable — critères à lui, totaux à lui, questions par fournisseur.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "Le même lot de trois devis, comparé avec la grille projetée à l'écran : un classement sort, net et argumenté, et la salle le prend pour un avis de l'outil.",
      apres:
        "Le même lot, une seconde grille : les pondérations changent, le classement s'inverse. Les deux consignes sont affichées en entier, côte à côte — ce qui a décidé, ce sont les pondérations, et elles viennent de vous.",
      prompt:
        "CONSIGNE A — « Compare les trois devis joints selon cette grille : prix total pondéré à 70 %, délai de livraison à 20 %, étendue de garantie à 10 %. Présente le résultat en tableau, puis dis quel devis ressort en tête selon cette grille et pourquoi. »\n\nCONSIGNE B — « Compare les trois devis joints selon cette grille : respect du délai et pénalités de retard prévues au devis à 50 %, étendue de garantie à 30 %, prix total à 20 %. Présente le résultat en tableau, puis dis quel devis ressort en tête selon cette grille et pourquoi. »",
      outil: "Un seul outil, celui validé dans la salle.",
      captureEcran:
        "Les deux tableaux côte à côte, le devis en tête entouré dans chacun — deux devis différents — et les lignes de pondération des deux consignes surlignées.",
      verifieLe: VERIFIE_LE,
      dureeMin: 15,
      notes: {
        script:
          "Faites PARIER par écrit avant de lancer la consigne B : chacun note quel devis sortira en tête. Le pari est ce qui rend la suite mémorable — sans lui, la salle regarde une démonstration ; avec lui, elle s'est trompée elle-même. Point d'atterrissage, à dire en une phrase : la grille vient de vous, l'IA applique la vôtre — y compris quand elle est mauvaise. Un classement n'est jamais une décision : la décision se signe, par un acheteur.",
        faq: [
          {
            question: "Alors à quoi bon, si le résultat dépend de la grille ?",
            reponse:
              "C'est la bonne nouvelle : la grille est votre métier. L'outil vous fait gagner l'alignement, la mise en forme et les questions — pas le jugement. La grille, elle, se discute avec votre responsable, pas avec l'outil.",
          },
          {
            question: "Il y a une bonne pondération, quelque part ?",
            reponse:
              "Pas dans l'absolu : elle dépend de l'achat. Un consommable en réapprovisionnement ne se pondère pas comme un équipement critique. C'est exactement ce que vous poserez à l'atelier, achat par achat.",
          },
        ],
        blocages: [
          {
            situation:
              "Les deux grilles donnent le même classement et la démonstration tombe à plat.",
            parade:
              "Le kit fournit une consigne C calibrée pour inverser le classement sur ce lot précis (page 14). La lancer sans commentaire, puis reprendre : « il a suffi de changer les pondérations ». Si l'outil est indisponible, passer aux sorties imprimées.",
          },
        ],
        planB:
          "Les deux sorties sont imprimées dans le kit (pages 15 et 16, datées), pondérations surlignées. Le pari écrit et la comparaison se tiennent à l'identique sur papier.",
      },
    },
    pratique: {
      consigne:
        "Trois temps. D'abord le dépôt : chargez vos trois devis de travail (PDF, scan, tableau) et passez le test de contrôle — faites recopier par l'outil trois montants tirés au hasard et confrontez-les au document d'origine ; un seul écart, et le devis se retraite avant d'aller plus loin. Ensuite l'atelier : posez et pondérez vos critères (coût complet, délai, incoterm, pénalités de retard, garanties, panel existant), faites aligner les postes, recalculez chaque total à la main au tableur, et écrivez les questions à reposer à chaque fournisseur. Enfin : transformez deux lignes de besoin réel en trame de consultation structurée sur le modèle du kit — objet, périmètre, critères de choix, pièces à fournir, délai de réponse.",
      aEmporter:
        "Un comparatif défendable — critères pondérés par vous, totaux recalculés à la main, questions par fournisseur — et une trame de consultation réutilisable. Deuxième versement au dossier d'arbitrage.",
      dureeMin: 60,
      notes: {
        script:
          "Annoncez les trois causes d'échec AVANT que quiconque échoue : scan sans texte reconnu, tableau qui se désaligne, page manquante. La parade de chacune est sur le support. Un stagiaire qui échoue sans avoir été prévenu se referme pour la journée ; prévenu, il vous appelle. Le test des trois montants n'est pas optionnel : c'est lui qui autorise la suite — faites-le cocher sur le support. Les critères s'écrivent AVANT de lancer l'outil, sur papier : une grille posée après la sortie est une grille qui s'est laissée influencer. Passez dans les rangs, relancez, ne pondérez à la place de personne.",
        faq: [
          {
            question: "Pourquoi recalculer les totaux, l'outil les a déjà alignés ?",
            reponse:
              "Aligner n'est pas calculer. Ce que l'outil affiche comme somme est plausible sans être fiable, et rien ne signale l'erreur. Le total est un geste de tableur : trois minutes, zéro doute — et c'est votre chiffre qui part au décideur.",
          },
          {
            question: "Mon besoin est vraiment flou, deux lignes à peine. Je le donne tel quel ?",
            reponse:
              "Oui — c'est le point de départ prévu. L'outil vous rend une trame à trous, et c'est en la remplissant que le besoin se précise. Ce qui ne se délègue pas, ce sont les critères de choix : eux viennent de vous.",
          },
        ],
        blocages: [
          {
            situation: "Le test de contrôle échoue sur un scan de mauvaise qualité.",
            parade:
              "Recadrer page par page plutôt que le document entier, et redemander « recopie ce tableau ligne à ligne ». Si l'écart persiste, basculer sur l'exemplaire propre du même devis fourni au kit — l'atelier ne doit pas s'arrêter sur un problème de scan.",
          },
          {
            situation: "Un stagiaire n'a aucun besoin réel à transformer en consultation.",
            parade:
              "Le kit fournit deux besoins de secours (page 18). Ne le laissez pas regarder son voisin travailler pendant dix minutes.",
          },
          {
            situation: "Le réseau sature au moment des dépôts simultanés.",
            parade:
              "Faites démarrer par vagues de cinq, et annoncez-le comme une consigne d'atelier, pas comme un incident.",
          },
        ],
        planB:
          "Réseau tombé : l'alignement se fait sur le comparatif imprimé du kit (déjà produit, daté, page 19) ; les critères, les pondérations, les totaux au tableur ou à la calculatrice et les questions par fournisseur se travaillent à l'identique sur papier. La trame de consultation est un exercice d'écriture qui ne dépend d'aucun outil.",
      },
    },
    verification: {
      question:
        "Échange de comparatifs en binôme, cinq minutes chrono : trouvez chez votre voisin une erreur de total et un critère manquant — il y en a presque toujours.",
      reponseAttendue:
        "Au moins un écart relevé par binôme, mis en commun en salle. Les deux plus fréquents : un total repris de la sortie de l'outil sans recalcul, et l'absence du coût complet — transport, mise en service, maintenance la première année.",
      dureeMin: 5,
      notes: {
        script:
          "Contrôle CROISÉ, cinq minutes, pas plus — annoncez le chrono. Chaque binôme doit remonter AU MOINS un écart et vous en demanderez un à l'oral : la complaisance tombe immédiatement. Corrigez en salle les deux écarts les plus fréquents, pas tous.",
        faq: [],
        blocages: [
          {
            situation: "Un binôme ne trouve rien : « son comparatif est parfait ».",
            parade:
              "Leur donner le comparatif piégé du kit (page 20) : il contient une erreur de total et deux critères manquants. L'œil se règle en trois minutes, puis ils reviennent sur celui du voisin.",
          },
        ],
        planB: "L'échange se fait sur papier, la grille de relecture est imprimée au kit.",
      },
    },
    synthese: {
      acquis: [
        "Je ne délègue jamais les critères, les totaux ni la décision — l'IA aligne, le tableur calcule, je tranche.",
        "Je passe le test des trois montants avant d'exploiter tout document déposé.",
        "Je transforme un besoin flou en trame de consultation structurée sur le modèle du kit.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites nommer le fichier à voix haute : « dossier-arbitrage-<famille d'achat>-<date> ». Le dossier existe à partir du moment où il a un nom. Annoncez l'après-midi : les relances qui aboutissent, le litige qui ne s'aggrave pas, et un fournisseur qui refuse.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 3 — Relances et litiges : la séquence à trois niveaux
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-3",
    objectif: {
      enonce:
        "À la fin de ce module, vous rédigez une séquence de relance à trois niveaux prête à l'envoi, un courrier de réserve confronté aux modèles du kit, et vous tenez un face-à-face avec un fournisseur qui refuse.",
      objectifGlobalId: "obj-3",
      dureeMin: 5,
      notes: {
        script:
          "Annoncez la règle de l'après-midi avant tout : aucune donnée de la liste rouge n'entre dans les exercices, et les noms de fournisseurs se remplacent par des balises. Puis le programme en une phrase : trois écrits qui partent vraiment — la relance, le courrier de réserve, la préparation du face-à-face — et un passage devant un fournisseur qui dit non.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "Une commande en retard, un fil de onze e-mails : promesses non tenues, réponses partielles, un collègue en copie qui s'agace. La relance qui part est soit trop molle, soit trop brutale — et elle se réécrit de zéro à chaque dossier.",
      apres:
        "Le même fil, balisé, déposé avec une consigne qui fixe le niveau, le ton et les interdits. La relance sort calibrée : les faits, la demande, l'échéance — rien qui engage l'entreprise au-delà du nécessaire.",
      prompt:
        "Voici l'historique de nos échanges sur la commande <REF-COMMANDE>, collé ci-dessous — les noms et références sont remplacés par des balises. Rédige une relance de niveau 2, ferme mais sans menace : rappelle la date de livraison convenue et l'écart constaté à ce jour, demande une date de livraison ferme sous 48 heures, et propose un point téléphonique. Ton professionnel et factuel, six phrases maximum. N'écris aucun chiffrage de préjudice, aucune annonce de résiliation, aucune reconnaissance de responsabilité, et aucune excuse à la place du fournisseur. N'invente ni date ni engagement : si une information manque dans le fil, écris <A COMPLETER> à sa place.",
      outil: "Un seul outil, celui validé dans la salle.",
      captureEcran:
        "Le fil balisé à gauche, la relance produite à droite, avec la partie de la consigne qui fixe le ton et les interdits surlignée.",
      verifieLe: VERIFIE_LE,
      dureeMin: 15,
      notes: {
        script:
          "Lisez d'abord le fil à voix haute, vite, en sautant d'un e-mail à l'autre — la salle doit ressentir l'embrouillamini, c'est son quotidien. Puis montrez le même fil balisé : l'outil n'a besoin ni du nom du fournisseur ni d'un seul prix pour calibrer une relance, et c'est une découverte pour la plupart. Lancez, lisez la sortie, et attardez-vous sur ce qu'elle NE contient PAS : pas de préjudice chiffré, pas de menace, pas d'excuse. La moitié de la consigne est faite d'interdits, et c'est elle qui protège.",
        faq: [
          {
            question: "Pourquoi baliser, puisque nos e-mails partent bien chez le fournisseur ?",
            reponse:
              "Ce qui part chez le fournisseur est votre courrier. Ce qui entre dans l'outil suit le régime d'usage du matin. Deux circuits, deux règles — et baliser coûte trente secondes.",
          },
          {
            question: "On commence toujours au niveau 1, ou on peut attaquer au niveau 2 ?",
            reponse:
              "Le niveau se choisit sur l'historique de la relation et l'enjeu du retard, pas sur l'humeur du jour. C'est exactement ce que vous poserez à l'atelier, dossier en main.",
          },
        ],
        blocages: [
          {
            situation:
              "La relance produite contient une menace voilée — « nous en tirerons les conséquences ».",
            parade:
              "La montrer et la barrer à l'écran : la consigne interdit l'annonce de résiliation, pas les formules vagues — c'est votre relecture qui les attrape. La démonstration de la limite vaut mieux qu'une sortie parfaite.",
          },
        ],
        planB:
          "Le fil balisé et la relance produite sont imprimés dans le kit (pages 23 et 24, datées). La lecture à voix haute et l'analyse des interdits se tiennent à l'identique sur papier.",
      },
    },
    pratique: {
      consigne:
        "Trois temps. Atelier 1 : écrivez vos trois niveaux de relance sur le dossier de commande en retard fourni au kit — rappel courtois, relance ferme, escalade au responsable — puis la version anglaise du niveau 2 pour un fournisseur étranger ; noms et références en balises, aucune donnée de la liste rouge. Ensuite : rédigez votre courrier de réserve à réception sur le cas fourni, comparez-le phrase à phrase aux trois modèles validés du kit et surlignez vos trois écarts — le modèle du kit fait foi et ne se modifie pas en séance. Enfin, le jeu de rôle : l'IA joue le fournisseur qui refuse, scénario et objections fournis clés en main ; préparez vos réponses, votre limite basse et votre plan B, puis tenez cinq minutes devant votre binôme, grille d'observation en main.",
      aEmporter:
        "Votre séquence de relance à trois niveaux avec sa version anglaise, votre courrier de réserve annoté de ses trois écarts aux modèles, et votre grille de préparation au face-à-face. Troisième versement au dossier d'arbitrage.",
      dureeMin: 75,
      notes: {
        script:
          "Trois consignes écrites et remises — ne les dictez pas. Sur le courrier de réserve, vous n'arbitrez AUCUNE question juridique ; formule exacte, prononcée telle quelle : « je ne me prononce pas, notez la question, votre conseil tranchera ». Le modèle du kit fait foi et ne se modifie pas en séance : les écarts se surlignent et se notent pour le juriste du client. Sur le jeu de rôle : le prompt du personnage est fourni clés en main dans le kit, lancez-le sans le modifier ; chronométrez cinq minutes ferme, l'observateur coche la grille pendant que l'autre négocie, puis ils échangent.",
        faq: [
          {
            question: "Mon courrier de réserve me semble meilleur que le modèle du kit.",
            reponse:
              "Peut-être — mais en séance, le modèle fait foi. Notez vos écarts et portez-les à votre juriste : s'il les valide, votre version devient votre modèle. Ce qu'on n'improvise jamais, c'est un écrit qui engage l'entreprise.",
          },
          {
            question: "L'IA-fournisseur accepte tout ce que je propose, l'exercice ne sert à rien.",
            reponse:
              "Relisez le prompt du kit en entier avant de le lancer : la posture, le refus et les trois objections y sont écrits. S'il cède encore, relancez avec la ligne de rappel prévue au scénario — « tu maintiens ton refus et tu invoques la hausse des matières ».",
          },
        ],
        blocages: [
          {
            situation:
              "Un binôme veut rejouer un litige réellement en cours avec son fournisseur actuel.",
            parade:
              "Refuser : un litige en cours ne s'expose ni dans l'outil ni devant la salle. Le scénario du kit fait travailler les mêmes muscles — préparation, limite basse, plan B — sans exposer personne.",
          },
          {
            situation: "Le temps file et le jeu de rôle commencerait à 16 h passées.",
            parade:
              "Réduire à un passage par binôme au lieu de deux, jamais le supprimer : c'est le seul moment de la journée où la préparation se teste contre un refus. Couper plutôt sur la mise en commun.",
          },
        ],
        planB:
          "Outil indisponible : les relances et le courrier de réserve s'écrivent à la main sur les trames du kit, et le FORMATEUR joue le fournisseur au jeu de rôle — le scénario, la posture et les trois objections sont imprimés (pages 26 à 28, datées). L'atelier tient intégralement sans outil.",
      },
    },
    verification: {
      question:
        "Trois relances anonymes projetées : laquelle engage l'entreprise plus que nécessaire, laquelle sera ignorée, et pourquoi ? Réponse individuelle par écrit avant la correction en salle.",
      reponseAttendue:
        "La relance qui reconnaît un tort et chiffre un préjudice engage ; celle qui ne demande rien de daté sera ignorée ; la troisième tient les faits, la demande, l'échéance. La correction argumente sur les formulations exactes, surlignées à l'écran.",
      dureeMin: 10,
      notes: {
        script:
          "Faites écrire les deux réponses avant de corriger. À la correction, surlignez les formulations fautives une à une — « nous comprenons votre situation » qui excuse, « dans les meilleurs délais » qui n'engage à rien. C'est au mot près que se joue une relance, et c'est au mot près qu'on corrige.",
        faq: [],
        blocages: [
          {
            situation: "La salle trouve les trois relances « toutes correctes ».",
            parade:
              "Poser une seule question : « laquelle liriez-vous jusqu'au bout si vous étiez le fournisseur ? ». Le tri se fait tout seul, et la correction repart de là.",
          },
        ],
        planB:
          "Les trois relances et le corrigé sont imprimés dans le kit (page 30). Distribution et correction à l'oral.",
      },
    },
    synthese: {
      acquis: [
        "Je produis une relance calibrée en dix minutes, balises en place, sans donnée de la liste rouge.",
        "Je compare tout courrier de réserve au modèle validé avant envoi — et je fais relire ce qui s'en écarte.",
        "Je prépare un face-à-face fournisseur avec ma limite basse et mon plan B écrits.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites formuler par deux ou trois stagiaires l'écrit qu'ils feront toujours relire avant envoi — la réponse attendue est le courrier de réserve, et s'ils le disent eux-mêmes, c'est gagné. Annoncez la pause et le dernier module : la note de marché qui ment, et le dossier qui part au décideur.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 4 — Négociation, arbitrage et fiabilité
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-4",
    objectif: {
      enonce:
        "À la fin de ce module, vous faites tomber une note de marché inventée en la confrontant à vos sources, et votre dossier d'arbitrage fournisseur est prêt à partir au décideur.",
      objectifGlobalId: "obj-4",
      // La note d'arbitrage prolonge le comparatif du module 2 : le module sert
      // aussi l'analyse de devis vendue en obj-1.
      objectifsSecondairesIds: ["obj-1"],
      dureeMin: 5,
      notes: {
        script:
          "Reprenez le tableau du matin, celui du tour de salle : montrez ce que la journée a couvert cas par cas, et ce qu'elle n'a pas couvert — l'honnêteté sur ce dernier point achète toute la crédibilité du reste. Puis annoncez l'enjeu du module : savoir quand l'IA vous ment dans votre propre domaine, et repartir avec le dossier assemblé.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "La note d'arbitrage d'une page s'écrit aujourd'hui à la main, en fin de journée, quand la décision est déjà à moitié prise — elle justifie plus qu'elle n'éclaire.",
      apres:
        "La même note produite à partir du comparatif du matin, seule source autorisée : recommandation, deux risques, une question ouverte — et chaque chiffre traçable jusqu'à la ligne du tableau qui le porte.",
      prompt:
        "À partir du tableau comparatif joint — c'est la seule source autorisée —, rédige une note d'arbitrage d'une page pour ma direction : une recommandation en trois phrases, deux risques identifiés, une question restée ouverte. Chaque chiffre et chaque nom cités doivent figurer dans le tableau joint ; si un élément utile manque, écris « à vérifier » à sa place au lieu de le compléter. N'ajoute aucune donnée de marché, aucun fournisseur et aucun prix qui ne viennent pas du tableau.",
      outil: "Un seul outil, celui validé dans la salle.",
      captureEcran:
        "La note produite avec, en marge, une flèche de chaque chiffre vers sa ligne du tableau comparatif — et une mention « à vérifier » laissée telle quelle.",
      verifieLe: VERIFIE_LE,
      dureeMin: 10,
      notes: {
        script:
          "Insistez sur la ligne « seule source autorisée » : c'est elle qui sépare cette note d'une note de marché demandée à vide — et c'est la transition exacte vers la chasse à l'erreur qui suit. Tracez les flèches à l'écran, chiffre par chiffre, jusqu'à la ligne du tableau : la traçabilité se montre, elle ne s'affirme pas. Et montrez la mention « à vérifier » restée en l'état : une case honnêtement vide vaut mieux qu'une case remplie par personne.",
        faq: [
          {
            question: "La recommandation de la note, c'est la décision ?",
            reponse:
              "Non : la note éclaire, la décision se signe — par un acheteur. Et le décideur reçoit aussi la question ouverte, pas seulement la recommandation : c'est ce qui distingue une note d'arbitrage d'un plaidoyer.",
          },
        ],
        blocages: [
          {
            situation: "La note produite ajoute un chiffre qui ne figure pas dans le tableau.",
            parade:
              "Le montrer et le barrer devant la salle : même consigne verrouillée, la relecture reste obligatoire. C'est la meilleure introduction possible à la chasse à l'erreur.",
          },
        ],
        planB:
          "La note et son tableau source sont imprimés dans le kit (pages 32 et 33, datées), flèches déjà tracées. La démonstration se tient sur papier.",
      },
    },
    pratique: {
      consigne:
        "Deux temps. La chasse à l'erreur, chronométrée : une note de marché produite par l'IA sur votre famille d'achat vous est remise — surlignez tout ce que vous croyez faux, on compte à main levée. Règle appliquée ensuite, à écrire en tête de votre dossier : toute donnée chiffrée et tout nom cité doivent se retrouver dans une source à vous, sinon ils disparaissent. Puis chacun rédige sa note d'arbitrage d'une page à partir de son propre comparatif — recommandation, deux risques, une question ouverte — et la classe dans son dossier d'arbitrage fournisseur.",
      aEmporter:
        "La règle de vérification écrite en tête de votre dossier, et votre note d'arbitrage d'une page classée — le dossier d'arbitrage fournisseur est complet.",
      dureeMin: 35,
      notes: {
        script:
          "Sur la chasse à l'erreur : comptez les repérages à main levée AVANT de corriger, et notez le score au tableau — la salle sous-estime toujours, et le chiffre affiché vaut mieux qu'un discours sur la vigilance. Les notes du kit sont pré-générées par famille d'achat, erreurs recensées au corrigé : fournisseur inventé, référence inventée, prix plausible mais faux. Dites la règle telle quelle : une note de marché produite par l'IA n'est JAMAIS une source — c'est un brouillon de questions. Elle sert d'éclaireur pour anticiper une tension ou une rupture, à condition que chaque affirmation soit vérifiée à une source que vous pouvez citer avant d'entrer dans un dossier.",
        faq: [
          {
            question: "Et si le chiffre de la note est juste ?",
            reponse:
              "Alors vous l'avez vérifié, et c'est VOTRE source qui figure en note — plus jamais « l'IA l'a dit ». Un chiffre juste sans source citable reste inutilisable devant un décideur.",
          },
          {
            question: "On peut quand même utiliser l'IA pour la veille marché ?",
            reponse:
              "Oui, comme éclaireur : elle propose des pistes, des fournisseurs à regarder, des questions à poser. Rien de ce qu'elle affirme n'entre dans un dossier sans sa source — c'est la règle que vous venez d'écrire.",
          },
        ],
        blocages: [
          {
            situation: "La salle trouve toutes les erreurs plantées en cinq minutes.",
            parade:
              "La note complémentaire du kit (page 35) en contient trois plus fines — dont une qui ne se voit qu'en ouvrant la source. C'est celle qui marque.",
          },
          {
            situation: "Un stagiaire n'a pas terminé son comparatif du matin.",
            parade:
              "Il rédige sa note d'arbitrage sur le comparatif corrigé du kit (page 19). L'exercice d'écriture compte plus que la continuité du support.",
          },
        ],
        planB:
          "Aucune dépendance forte : les notes de marché sont imprimées par famille d'achat, et la note d'arbitrage s'écrit à la main sur la trame du kit. C'est l'atelier le plus robuste de la journée — gardez-le complet même si tout le reste a été dégradé.",
      },
    },
    verification: {
      question:
        "Évaluation des acquis : quiz individuel de dix questions, corrigé en salle question par question. Puis évaluation croisée du dossier d'arbitrage sur la grille du kit — critères posés, totaux recalculés, questions au fournisseur, liste rouge respectée, aucune donnée interdite soumise.",
      reponseAttendue:
        "Le corrigé est commenté question par question, sans en passer aucune. Le seuil de réussite est celui déclaré au programme ; un score en dessous déclenche la reprise individuelle prévue au dispositif. Sur la grille croisée, chaque case non cochée se corrige séance tenante — le dossier part complet ou ne part pas.",
      dureeMin: 15,
      notes: {
        script:
          "C'est l'évaluation des acquis au sens de l'indicateur 11 : elle se tient, elle se corrige, et elle se conserve. Ne la sacrifiez jamais au temps qui manque — c'est la première chose qu'un auditeur demande. Si vous êtes en retard, coupez ailleurs. L'évaluation croisée du dossier se fait grille en main, case par case, sans complaisance : chaque binôme doit pouvoir dire ce qui manque chez l'autre.",
        faq: [
          {
            question: "Le résultat du quiz va être transmis à mon employeur ?",
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
        planB:
          "Quiz papier dans le kit (page 37) et corrigé page 38, grille croisée page 39. Aucune dépendance à un outil.",
      },
    },
    synthese: {
      acquis: [
        "Je décide sur un dossier d'arbitrage traçable : critères à moi, totaux recalculés, sources citées.",
        "Je vérifie tout chiffre et tout nom d'une note produite par l'IA à une source que je peux citer.",
        "J'installe trois usages dans le service, chacun avec un responsable et une date, écrits en dernière page du dossier.",
      ],
      dureeMin: 10,
      notes: {
        script:
          "Chacun nomme à voix haute TROIS usages qu'il installe la semaine suivante, QUI les tient, et à quelle DATE — écrits en dernière page du dossier. Sans nom et sans date, une feuille de route ne se réalise pas. Reprenez une dernière fois le tableau du matin : chaque cas noté a-t-il trouvé son geste ? Notez la feuille de route au tableau, prenez une photo, envoyez-la au groupe.",
        faq: [],
        blocages: [
          {
            situation: "Les engagements restent vagues : « je vais essayer d'utiliser l'IA ».",
            parade:
              "Reformuler en une question : « sur quelle famille d'achat, et quel jour ? ». Ne pas passer au suivant tant que la réponse ne porte pas un nom et une date.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },
];
