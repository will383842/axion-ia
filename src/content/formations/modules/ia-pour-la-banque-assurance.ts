/**
 * CONTENU RÉDIGÉ — « IA pour la banque et l'assurance » (1 jour, 4 modules).
 *
 * Écrit sur le modèle du pilote « IA pour les RH », pour le secteur le plus
 * régulé du catalogue : secret bancaire, secret des assurances, données de
 * santé des questionnaires médicaux, lutte anti-blanchiment.
 *
 * ## Le fil rouge
 *
 * Chacun repart avec LE PROTOCOLE DE SON SERVICE, construit page par page au
 * fil des quatre modules : page 1 la liste rouge et les régimes d'usage,
 * page 2 la qualification des décisions, page 3 les réponses types tracées,
 * page 4 la feuille de route. Le module 1 pose dans quel environnement chaque
 * pièce a le droit d'être traitée, le module 2 pose ce que l'IA ne touche
 * jamais, le module 3 produit les synthèses et courriers sur dossiers
 * reconstitués, le module 4 installe les réponses tracées. L'ordre est
 * l'enseignement : on ne produit rien avant d'avoir qualifié.
 *
 * ## Trois règles que le formateur ne négocie pas
 *
 * **Aucune pièce réelle de dossier client ne s'approche d'un outil pendant la
 * journée** — pas un compte, pas un sinistre, pas un contrat nominatif, pas un
 * relevé. Les ateliers outillés tournent exclusivement sur les dossiers
 * reconstitués du kit. Les exercices sur les dossiers PROPRES des stagiaires
 * (module 2) se font sur papier, l'outil fermé. Un stagiaire qui dépose une
 * pièce réelle est arrêté sans discussion : la formation ne peut pas provoquer
 * le manquement qu'elle enseigne à éviter — et cette règle EST un des
 * enseignements de la journée, pas une contrainte d'organisation.
 *
 * **Une clause, un taux, une garantie, une exclusion se RECOPIENT depuis le
 * document fourni à l'outil — jamais générés.** L'IA reformule un texte qu'on
 * lui donne ; elle n'est jamais la source d'une réponse contractuelle ou
 * réglementaire. Toute référence non retrouvée mot pour mot dans le document
 * déposé saute, sans débat.
 *
 * **Le formateur n'arbitre aucune question juridique ou réglementaire** —
 * ACPR, LCB-FT, devoir de conseil, conformité interne. La formule est écrite
 * et se prononce telle quelle : « je ne me prononce pas, notez la question,
 * votre conformité tranchera ». Les trames remises portent un en-tête
 * « Projet — à faire valider par votre conformité avant diffusion » qui n'est
 * pas retirable.
 *
 * ⚠️ Les références réglementaires citées dans les séquences `cadre` du
 * catalogue (régimes d'usage, usages à haut risque du règlement européen sur
 * l'IA, droit du client à une intervention humaine) sont fournies au formateur
 * SOURCÉES ET DATÉES dans le kit, et ne se citent jamais de mémoire. Leur
 * formulation reste à faire relire par le conseil de l'organisme.
 */

import type { EnrichissementFormation } from "./types";

/** Date de dernière vérification des captures et sorties d'outils. */
const VERIFIE_LE = "2026-08-06";

export const IA_POUR_LA_BANQUE_ASSURANCE: EnrichissementFormation = [
  // ───────────────────────────────────────────────────────────────────────────
  // Module 1 — Le cadre d'abord : dans quel environnement chaque pièce a le
  // droit d'être traitée
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-1",
    objectif: {
      enonce:
        "À la fin de ce module, devant n'importe quelle pièce d'un dossier, vous nommez l'environnement dans lequel vous avez le droit de la traiter — ou vous dites « pas du tout », et vous savez pourquoi.",
      objectifGlobalId: "obj-4",
      dureeMin: 5,
      notes: {
        script:
          "Tour de table en UNE phrase : « votre prénom, votre poste, et la pièce de dossier qui vous prend le plus de temps ». Notez chaque réponse au tableau — vous y reviendrez au module 4 pour montrer ce que la journée a couvert. Puis posez la règle qui tient la journée, telle quelle : « aucune pièce réelle d'un dossier client ne s'approche d'un outil aujourd'hui — et comprendre pourquoi est le premier enseignement ». Annoncez le livrable : chacun repart avec le protocole de son service, quatre pages, construit dans la journée.",
        faq: [
          {
            question: "Si on ne peut rien déposer, à quoi va servir la journée ?",
            reponse:
              "À savoir précisément ce qui PEUT être traité, dans quel environnement, et à produire vite sur cette base. Le kit fournit des dossiers reconstitués complets : tout ce qu'on fera aujourd'hui, vous saurez le refaire lundi dans le régime validé chez vous.",
          },
          {
            question: "Notre établissement a déjà un outil IA interne validé, ça change quoi ?",
            reponse:
              "C'est le troisième régime qu'on voit dans quinze minutes : un environnement validé par la conformité autorise plus de choses, jamais tout. La liste rouge de ce module s'applique aussi à lui.",
          },
        ],
        blocages: [
          {
            situation: "Le tour de table dérive en débat sur « la banque va-t-elle disparaître ».",
            parade:
              "Couper avec : « on parle de vos dossiers de cette semaine, pas de 2035 » — et noter la question au tableau pour la pause. La journée est outillée, pas prospective.",
          },
        ],
        planB:
          "Aucun outil n'est nécessaire ici. Sans vidéoprojecteur, le tour de table et la règle du jour se tiennent au paperboard sans rien perdre.",
      },
    },
    demonstration: {
      avant:
        "On croit qu'un dossier privé de son nom et de son numéro de contrat est devenu anonyme, et qu'on peut donc le déposer sans risque. C'est la pratique la plus répandue du secteur — et elle est fausse.",
      apres:
        "Le même dossier « pseudonymisé » est ré-identifié devant la salle en trois questions : commune, profession, type de sinistre suffisent à ne plus désigner qu'une personne. La distinction pseudonymiser / anonymiser cesse d'être théorique — et la liste rouge qui suit devient une évidence.",
      prompt:
        "Voici la fiche d'un dossier de sinistre dont le nom, le numéro de contrat et la date de naissance ont été retirés (document joint — dossier reconstitué du kit, entièrement fictif). Réponds à trois questions, dans l'ordre, en t'appuyant uniquement sur ce document. Question 1 : liste les éléments qui restent identifiants — commune, profession, employeur cité, type et date du sinistre, montants. Question 2 : dans une commune de 3 000 habitants, combien de personnes peuvent correspondre à la fois à cette profession et à ce sinistre survenu à cette date ? Question 3 : quels champs faudrait-il encore retirer ou généraliser pour que ce dossier ne désigne plus personne — et que resterait-il alors d'exploitable ?",
      outil: "Un seul outil, celui validé dans la salle (Claude ou ChatGPT selon le groupe).",
      captureEcran:
        "La fiche « anonymisée » à gauche, la réponse de l'outil à droite, avec les trois éléments ré-identifiants surlignés — commune, profession, date du sinistre.",
      verifieLe: VERIFIE_LE,
      dureeMin: 15,
      notes: {
        script:
          "Avant de lancer, faites voter à main levée : « ce dossier sans nom ni numéro de contrat, il est anonyme — oui ou non ? ». La majorité vote oui, et c'est ce vote qui rend la suite mémorable. Lancez, lisez la réponse à voix haute, et laissez le silence faire son travail après la question 2. Concluez en UNE phrase : « retirer le nom ne suffit pas — c'est pour ça que la règle n'est pas “anonymisez”, mais “qualifiez la pièce avant d'ouvrir l'outil” ».",
        faq: [
          {
            question: "Alors l'anonymisation ne sert à rien ?",
            reponse:
              "Elle sert, mais c'est un métier : généraliser, agréger, supprimer — pas masquer. Tant que votre établissement n'a pas défini une procédure validée, la règle simple tient : une pièce de dossier client ne sort pas, même sans nom.",
          },
          {
            question: "Et dans l'outil interne validé par notre conformité ?",
            reponse:
              "Ce que votre conformité a validé s'applique — c'est exactement le troisième régime. La démonstration montre pourquoi cette validation est indispensable, pas comment la contourner.",
          },
        ],
        blocages: [
          {
            situation:
              "L'outil répond prudemment qu'il ne peut pas estimer le nombre de personnes.",
            parade:
              "Reformulez à l'oral : « admettons dix personnes, admettons cent — combien faut-il de recoupements de plus pour tomber à une seule ? ». Le raisonnement porte l'enseignement, pas le chiffre exact. Sinon, plan B.",
          },
          {
            situation: "Un stagiaire objecte que personne ne ferait l'effort de ré-identifier.",
            parade:
              "Une question en retour : « le jour où ce dossier fuit, qui devra prouver qu'il était vraiment anonyme — vous ou l'attaquant ? ». Ne pas argumenter davantage.",
          },
        ],
        planB:
          "La fiche et la sortie complète de l'outil sont imprimées dans le kit (pages 4 et 5, datées). La démonstration se tient à l'identique sur papier : le vote à main levée, la lecture des trois réponses, le surlignage des éléments ré-identifiants. Ne rien improviser en direct.",
      },
    },
    pratique: {
      consigne:
        "Deux temps, chronométrés, sur le matériel fourni — jamais sur vos pièces réelles. D'abord, par table : vingt pièces de dossier reconstituées (relevé de compte, questionnaire médical, constat amiable, courrier de relance, tableau d'amortissement…) à répartir entre les trois régimes d'usage — compte grand public, offre entreprise, environnement validé par la conformité — ou « pas du tout », sur la grille de tri fournie. Ensuite, chaque table confronte la liste rouge de référence remise à ses propres types de pièces : ajoutez ce qui manque pour votre service, barrez ce qui ne vous concerne pas, et nommez par écrit votre cas litigieux — celui que votre conformité devra trancher. C'est la page 1 de votre protocole.",
      aEmporter:
        "La grille de tri corrigée des vingt pièces, et la page 1 du protocole : votre liste rouge annotée, avec votre cas litigieux nommé — à faire valider par votre conformité.",
      dureeMin: 45,
      notes: {
        script:
          "Annoncez le chronomètre à voix haute toutes les cinq minutes. Sur le tri : les vingt pièces sont calibrées pour que quatre fassent VRAIMENT débat — laissez les tables se disputer, c'est le but, et tranchez uniquement avec le corrigé du kit, jamais de mémoire. Sur la liste rouge : rappelez que « déclaration de soupçon » est un interdit ABSOLU — rien qui s'en approche ne se tape, ne se dicte, ne se photographie, dans aucun régime ; si la question fuse, c'est une question conformité, pas une question formateur. Pour tout cas litigieux : « je ne me prononce pas, notez la question, votre conformité tranchera » — et la question s'écrit sur la page 1, c'est une production utile, pas un échec.",
        faq: [
          {
            question: "Un questionnaire médical vide, sans nom, c'est traitable ?",
            reponse:
              "Le formulaire VIERGE est un document interne sans donnée personnelle : il se traite. Le même formulaire REMPLI est une donnée de santé : il ne sort pas, dans aucun régime. La différence entre les deux est exactement ce que la grille vous fait qualifier.",
          },
          {
            question: "Nos courriers types contiennent l'en-tête de l'établissement, ça sort ?",
            reponse:
              "Un modèle de courrier sans donnée client est un document d'entreprise : régime entreprise ou environnement validé, selon la politique de votre DSI. C'est l'une des quatre questions de la fiche à lui poser lundi.",
          },
        ],
        blocages: [
          {
            situation: "Une table classe tout en « pas du tout » par prudence, et s'ennuie.",
            parade:
              "Leur demander de chiffrer : « si plus rien ne se traite, combien d'heures par semaine votre service renonce-t-il à gagner ? ». La prudence indifférenciée est l'autre échec — la grille sert à distinguer, pas à tout fermer.",
          },
          {
            situation:
              "Un stagiaire sort une pièce réelle de sa sacoche « pour vérifier un vrai cas ».",
            parade:
              "L'arrêter immédiatement, sans négocier, et rappeler la règle en une phrase : « aucune pièce réelle aujourd'hui — décrivez le cas à l'oral, on le qualifie sur la grille, la pièce reste dans la sacoche ».",
          },
        ],
        planB:
          "L'atelier ne dépend d'aucun outil : pièces imprimées, grille papier, liste rouge imprimée. Aucun repli nécessaire.",
      },
    },
    verification: {
      question:
        "Dix pièces projetées une par une, réponse individuelle ÉCRITE pour chacune : « je la traite — dans quel régime — ou pas du tout ». Puis correction collective sur le corrigé du formateur, pièce par pièce.",
      reponseAttendue:
        "Dix réponses écrites par personne, confrontées au corrigé du kit. Les pièces 7 à 10 sont les pièges du secteur — extrait de relevé « juste pour le format », questionnaire médical rempli, capture d'un outil métier, note interne mentionnant un incident de paiement — et c'est sur elles que se joue la correction.",
      dureeMin: 15,
      notes: {
        script:
          "Réponse ÉCRITE avant toute discussion : une réponse orale collective laisse les indécis suivre la salle. Corrigez pièce par pièce, et sur chaque erreur fréquente, faites dire par un stagiaire POURQUOI — la justification vaut plus que la bonne case. Ne passez pas plus d'une minute trente par pièce.",
        faq: [
          {
            question: "On note ? Ça compte pour l'évaluation ?",
            reponse:
              "Non, l'évaluation des acquis est en fin de journée, sur dix questions. Ceci sert à régler l'œil pendant qu'on peut encore corriger.",
          },
        ],
        blocages: [
          {
            situation: "La salle est en désaccord frontal avec le corrigé sur une pièce.",
            parade:
              "Ne pas trancher en direct : « le corrigé donne la position par défaut ; si votre conformité a validé autre chose chez vous, c'est elle qui a raison chez vous. Notez la pièce sur votre page 1. »",
          },
        ],
        planB:
          "Les dix pièces et le corrigé sont imprimés dans le kit (pages 8 et 9). Sans vidéoprojecteur, distribution papier et correction à l'oral.",
      },
    },
    synthese: {
      acquis: [
        "Je qualifie chaque pièce AVANT d'ouvrir l'outil : quel régime, ou pas du tout — et je sais pourquoi retirer le nom ne suffit pas.",
        "Je pose lundi les quatre questions de la fiche à ma DSI, et je fais trancher mon cas litigieux par la conformité.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites FORMULER, ne récitez pas : « en une phrase, qu'est-ce que vous ne ferez plus à partir de demain ? ». Trois réponses suffisent. Annoncez la pause et la suite en une phrase : « après la pause, ce que l'IA ne touche JAMAIS dans ce métier — et pourquoi c'est la loi, pas une prudence maison ».",
        faq: [],
        blocages: [
          {
            situation: "Personne ne parle, la salle attend sa pause.",
            parade:
              "Ne pas insister : énoncer les deux acquis vous-même et libérer. Un acquis arraché à contrecœur ne s'ancre pas mieux.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 2 — Ce que l'IA ne touche jamais dans ce métier
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-2",
    objectif: {
      enonce:
        "À la fin de ce module, vous reconnaissez une décision qui ne se délègue pas — octroi, notation, tarification, sélection des risques — et vous savez ce que vous devez au client quand un outil est intervenu dans son dossier.",
      objectifGlobalId: "obj-4",
      // 105 minutes de programme qui n'etaient vendues nulle part : ce que
      // la formation refuse de deleguer est son enseignement le plus lourd.
      objectifsSecondairesIds: ["obj-6"],
      dureeMin: 5,
      notes: {
        script:
          "Posez la frontière en une phrase avant tout développement : « aujourd'hui on travaille sur les ÉCRITS — synthèses, courriers, réponses — jamais sur la DÉCISION ». Puis annoncez ce qui va se passer : une démonstration de biais qu'on ne fera qu'une fois, précisément pour que personne ne la refasse au bureau, et deux ateliers qui produisent la page 2 du protocole. Le module 2 est celui qui protège tous les autres : dites-le tel quel.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "On imagine que demander « un avis » à l'outil sur un dossier est un raccourci inoffensif, puisqu'un humain relira. L'avis paraît neutre, argumenté, professionnel — et personne ne voit sur quoi il repose.",
      apres:
        "Le même dossier fictif est soumis deux fois, mot pour mot, avec UNE seule ligne ajoutée — âge, situation familiale, quartier. L'avis rendu change à l'écran. La salle voit de ses yeux pourquoi évaluer une personne avec cet outil est classé à haut risque : le biais est invisible, indétectable après coup, et il a suffi d'une ligne.",
      prompt:
        "PROMPT A — « Voici un dossier de demande reconstitué (document joint du kit, entièrement fictif) : financement de travaux de 18 000 € sur 60 mois, revenus, charges et historique détaillés dans le document. Rédige en trois phrases un avis sur ce dossier. »\n\nPROMPT B — identique mot pour mot, le MÊME document joint avec une seule ligne ajoutée en tête : « Demandeur : 63 ans, divorcé, réside dans le quartier des Grands-Champs. » — « Rédige en trois phrases un avis sur ce dossier. »",
      outil: "Un seul outil, celui validé dans la salle.",
      captureEcran:
        "Les deux avis côte à côte, la ligne ajoutée surlignée dans le prompt B, et les formulations de l'avis qui ont changé entourées — la prudence apparue, les réserves nouvelles.",
      verifieLe: VERIFIE_LE,
      dureeMin: 20,
      notes: {
        script:
          "Annoncez AVANT de lancer : « ce que je vais faire là, on ne le refait jamais — ni ici ni au bureau. On le fait UNE fois, sur un dossier fictif, pour que vous voyiez pourquoi. » Faites parier par écrit : l'avis va-t-il changer ? Lancez les deux prompts, affichez côte à côte, et lisez ligne à ligne sans commenter — laissez quelqu'un le dire. Concluez sur les trois faits, dans l'ordre : le biais a suffi d'une ligne ; rien dans l'avis ne le signale ; personne n'aurait pu le prouver après coup. C'est exactement pour ça que le règlement européen classe ces usages à haut risque — la référence sourcée est dans votre kit, ne la citez pas de mémoire.",
        faq: [
          {
            question: "Et si l'humain relit l'avis avant de décider, où est le problème ?",
            reponse:
              "L'avis oriente la relecture : vous relisez un dossier déjà teinté, sans savoir par quoi. La règle du secteur n'est pas « relire l'avis de l'outil », c'est « ne pas demander d'avis à l'outil sur une personne ».",
          },
          {
            question: "Nos outils de scoring internes font déjà ça, non ?",
            reponse:
              "Vos outils de scoring homologués relèvent d'un cadre dédié — modèles validés, documentés, audités par votre établissement. Un outil d'IA générative grand public n'a rien de tout cela. Ce n'est pas le même objet, et c'est une question pour votre conformité, pas pour moi.",
          },
        ],
        blocages: [
          {
            situation: "Les deux avis sortent quasiment identiques, la démonstration tombe à plat.",
            parade:
              "Relancer les deux prompts en ajoutant « conclus par : plutôt favorable ou plutôt réservé ». La contrainte de conclusion force la bascule et l'écart ressort. Si rien ne bouge, passez au plan B — et dites-le honnêtement : « il ne bascule pas à chaque fois, et c'est pire : vous ne saurez jamais quand ».",
          },
          {
            situation:
              "Un stagiaire demande de refaire le test avec d'autres variables « pour voir ».",
            parade:
              "Refuser en une phrase : « on l'a fait une fois pour comprendre, on ne joue pas à ça — c'est précisément l'usage interdit ». Rediriger vers l'atelier de qualification qui suit.",
          },
        ],
        planB:
          "Les deux avis sont imprimés dans le kit (pages 12 et 13, datées), la ligne ajoutée et les formulations qui basculent déjà surlignées. Le pari écrit et la lecture ligne à ligne se tiennent à l'identique sur papier.",
      },
    },
    pratique: {
      consigne:
        "Deux temps, chronométrés — l'outil reste FERMÉ, tout se fait sur papier. D'abord, individuellement : passez trois dossiers de VOTRE quotidien (décrits de mémoire, aucune pièce sortie) au test de qualification en quatre questions de la grille fournie — est-ce une décision sur une personne ? produit-elle un effet pour elle ? qui la signe ? qu'en saura le client ? Classez chacun : périmètre IA, hors périmètre, ou à faire trancher. C'est la page 2 de votre protocole. Ensuite, par table : écrivez les trois phrases de votre établissement — ce qu'on dit au client quand un outil est intervenu, qui décide et signe, ce qu'on trace — et la formule de renvoi, mot pour mot : « je ne me prononce pas, notre service conformité tranche ».",
      aEmporter:
        "La page 2 du protocole : vos trois dossiers qualifiés sur la grille en quatre questions, les trois phrases de l'établissement et la formule de renvoi — en projet, à faire valider par votre conformité.",
      dureeMin: 50,
      notes: {
        script:
          "Répétez la consigne matérielle au démarrage : outil fermé, dossiers décrits de mémoire, AUCUNE pièce sortie des sacoches. Sur la qualification : la question qui départage presque tout est la deuxième — « produit-elle un effet pour la personne ? » ; un refus de garantie, une tarification, une clôture de compte sont des effets ; une synthèse pour préparer un rendez-vous n'en est pas un. Sur les trois phrases : faites-les lire à VOIX HAUTE par table — une phrase qu'on n'a pas prononcée ne se tient pas devant un client. Vous n'arbitrez RIEN : toute question du type « et chez nous, tel cas ? » reçoit la formule, et la question s'écrit sur la page 2.",
        faq: [
          {
            question: "Trier les demandes entrantes par priorité, c'est dans le périmètre ?",
            reponse:
              "Passez-le à la grille : si le tri décide de qui attend et qui est servi, il produit un effet pour des personnes — il se fait sous VOS règles écrites, pas au jugé de l'outil. Si le doute reste, c'est un cas « à faire trancher », et c'est une bonne réponse.",
          },
          {
            question: "Le client doit-il vraiment être informé qu'une IA a préparé son courrier ?",
            reponse:
              "Ce que votre établissement doit au client dépend de l'usage et de votre politique — c'est exactement la première des trois phrases que vous écrivez, et elle part en validation conformité. Je ne tranche pas à sa place.",
          },
        ],
        blocages: [
          {
            situation:
              "Un stagiaire classe tout « hors périmètre » et conclut que l'IA ne sert à rien ici.",
            parade:
              "Reprendre SES trois dossiers avec lui : dans chacun il y a des écrits — la synthèse, le courrier, la réponse. La décision est hors périmètre, la préparation ne l'est pas. C'est la distinction que l'après-midi met en pratique.",
          },
          {
            situation:
              "Une table veut une réponse ferme : « alors, le pré-tri de dossiers, oui ou non ? »",
            parade:
              "Formule exacte, prononcée telle quelle : « je ne me prononce pas, notez la question, votre conformité tranchera ». Écrivez la question au tableau — la liste des questions ouvertes est une production utile de la journée.",
          },
        ],
        planB:
          "L'atelier est entièrement papier par construction : grille imprimée, protocole imprimé. Aucun repli nécessaire — c'est l'atelier le plus robuste de la journée.",
      },
    },
    verification: {
      question:
        "Huit situations projetées une par une, réponse individuelle écrite : « dans le périmètre / hors périmètre / à faire trancher par la conformité ». Puis correction collective sur le corrigé du formateur.",
      reponseAttendue:
        "Huit réponses écrites par personne. Le corrigé assume des réponses « à faire trancher » : sur les situations 6 à 8 — pré-tri de réclamations, alerte sur dossier « atypique », relance ciblée d'impayés — c'est la SEULE bonne réponse, et un stagiaire qui répond trop vite « périmètre » ou « hors périmètre » n'a pas encore le réflexe.",
      dureeMin: 10,
      notes: {
        script:
          "Insistez à la correction : « à faire trancher » n'est pas un aveu d'ignorance, c'est la réponse professionnelle — celle qui laisse une trace et protège tout le monde. Comptez à main levée qui l'a utilisée au moins une fois : c'est le vrai score du module.",
        faq: [],
        blocages: [
          {
            situation: "La salle trouve le corrigé trop prudent et proteste.",
            parade:
              "Une question en retour : « qui, dans cette salle, signera à la place de votre conformité ? ». Puis noter les situations contestées sur les pages 2 — elles partent en validation, c'est exactement le circuit.",
          },
        ],
        planB:
          "Les huit situations et le corrigé sont imprimés dans le kit (pages 15 et 16). Sans vidéoprojecteur, distribution papier et correction à l'oral.",
      },
    },
    synthese: {
      acquis: [
        "L'IA prépare les écrits, l'humain décide et signe — et je qualifie tout cas douteux sur la grille en quatre questions avant de faire quoi que ce soit.",
        "Toute décision où un outil est intervenu doit rester justifiable un an plus tard : je sais ce qu'on dit au client, qui signe, ce qu'on trace.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites reformuler la frontière par un stagiaire, en une phrase, avec ses mots. Puis annoncez le déjeuner et l'après-midi : « ce matin on a posé ce qu'on ne fait pas ; cet après-midi on produit — synthèses de dossiers, courriers, réponses — vite, et dans les règles posées ce matin ».",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 3 — Sinistres, dossiers et documents contractuels
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-3",
    objectif: {
      enonce:
        "À la fin de ce module, vous produisez la synthèse d'un dossier et le courrier motivé qui l'accompagne, prêts pour un rendez-vous, dans le régime d'usage identifié le matin — chaque référence contractuelle retrouvée à la source.",
      objectifGlobalId: "obj-1",
      // Le courrier d'acceptation ou de refus motivé produit à l'atelier sert
      // l'objectif « courriers et propositions » ; la vérification aux sources
      // en binômes croisés sert « vérifier une production avant diffusion ».
      objectifsSecondairesIds: ["obj-2", "obj-5"],
      dureeMin: 5,
      notes: {
        script:
          "Annoncez le contrat de l'après-midi : « on produit, sur les dossiers reconstitués du kit — un cas complet chacun, de la pièce jointe jusqu'au courrier signable ». Et posez la règle qui gouverne tout le module, telle quelle : « une clause, un taux, une garantie, une exclusion se RECOPIENT depuis le document déposé — jamais de mémoire de l'outil, jamais de la vôtre. Toute référence non retrouvée à la source saute. »",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "On pose à l'outil une question de garantie sans lui fournir le contrat : « l'infiltration par la toiture est-elle couverte ? ». Il répond avec assurance, cite une clause, un article, une franchise. Tout est plausible — et rien n'existe : la clause est inventée, et rien dans la réponse ne le signale.",
      apres:
        "Les conditions générales du kit sont déposées, puis interrogées garantie par garantie avec l'obligation de RECOPIER mot pour mot la clause et son numéro d'article. Chaque affirmation devient vérifiable en dix secondes — et la clause que l'outil avait inventée en début de démonstration est cherchée dans le document, en direct, devant la salle : elle n'y est pas.",
      prompt:
        "Voici les conditions générales jointes (document du kit, contrat multirisque habitation reconstitué). En te limitant STRICTEMENT à ce document : la garantie dégât des eaux couvre-t-elle une infiltration par la toiture ? Indique la franchise applicable et le délai de déclaration. Pour CHAQUE élément de ta réponse, recopie MOT POUR MOT la clause sur laquelle tu t'appuies, avec son numéro d'article. Si le document ne permet pas de répondre sur un point, écris « le document ne le précise pas » et n'invente rien.",
      outil: "Un seul outil, celui validé dans la salle.",
      captureEcran:
        "La réponse sans document à gauche — clause inventée entourée en rouge — et la réponse sur document déposé à droite, avec la clause recopiée et son numéro d'article surlignés, ouverts en parallèle dans le PDF.",
      verifieLe: VERIFIE_LE,
      dureeMin: 15,
      notes: {
        script:
          "Posez d'abord la question SANS document, et lisez la réponse à voix haute avec aplomb — la salle doit sentir à quel point c'est convaincant. Puis cherchez l'article cité dans le contrat du kit, en direct : il n'y est pas. Laissez ce silence-là durer. Ensuite déposez le document et relancez avec le prompt strict : montrez la clause recopiée, ouvrez le PDF, retrouvez-la en dix secondes. La règle tombe d'elle-même : « l'IA reformule un texte qu'on lui donne ; elle n'est jamais la source d'une réponse contractuelle ».",
        faq: [
          {
            question: "Comment on sait que la première clause était inventée ?",
            reponse:
              "On ne le savait pas, et c'est exactement le problème : elle avait un numéro d'article et un vocabulaire parfaits. C'est pour ça que la règle n'est pas « méfiez-vous », mais « fournissez le document et exigez la recopie mot pour mot ».",
          },
          {
            question: "Et si le contrat fait deux cents pages, l'outil lit vraiment tout ?",
            reponse:
              "Pas toujours de façon fiable, et c'est pour ça que la recopie est exigée : une clause recopiée se vérifie en dix secondes dans le PDF. Ce que vous ne retrouvez pas à la source, vous le traitez comme inexistant.",
          },
        ],
        blocages: [
          {
            situation:
              "La réponse sans document est correcte par hasard, ou l'outil refuse de répondre sans source.",
            parade:
              "Le dire immédiatement : « il a bien répondu cette fois — et vous n'aviez aucun moyen de le savoir avant de vérifier ». S'il refuse : « les garde-fous s'améliorent, mais votre procédure ne peut pas reposer sur l'humeur d'un garde-fou ». L'enseignement tient dans les deux cas.",
          },
          {
            situation: "L'outil cite une clause qui existe mais avec un numéro d'article faux.",
            parade:
              "Incident en or : montrez-le. C'est la forme la plus dangereuse de l'erreur — vraie clause, fausse référence — et la raison pour laquelle on vérifie la recopie DANS le document, pas juste sa vraisemblance.",
          },
        ],
        planB:
          "Les deux réponses sont imprimées dans le kit (pages 19 et 20, datées), la clause inventée entourée, la clause recopiée surlignée avec la page du contrat en vis-à-vis. La recherche dans le contrat papier se fait en salle, au surligneur.",
      },
    },
    pratique: {
      consigne:
        "Atelier chronométré, individuel, sur dossier reconstitué fourni — au choix selon votre quotidien : une déclaration de sinistre (constat, photos décrites, contrat joint) ou une reprise d'historique client (courriers, avenants, tableau des garanties). Traitez le cas complet dans le régime identifié au module 1 : déposez les pièces du kit, produisez la synthèse du dossier sur la trame fournie — faits, garanties en jeu, points à vérifier, pièces manquantes — puis le courrier d'acceptation ou de refus motivé, chaque garantie, franchise et délai cité étant RECOPIÉ du document déposé avec sa référence. L'en-tête « Projet — à faire valider avant envoi » reste sur le courrier.",
      aEmporter:
        "Une synthèse de dossier complète et un courrier motivé prêt pour validation, plus la trame de synthèse et le prompt de recopie réutilisables lundi sur vos propres modèles — dans votre régime validé.",
      dureeMin: 50,
      notes: {
        script:
          "Faites choisir le cas dans les cinq premières minutes — sinistre ou historique — et annoncez les jalons à voix haute : synthèse à mi-temps, courrier ensuite. Passez dans les rangs avec UNE question en boucle : « cette franchise, ce délai, cette garantie — où est-ce écrit dans le document ? ». Ne rédigez à la place de personne. Les trames et prompts sont dans le support : ne les dictez pas. Rappelez une fois, au démarrage : uniquement les dossiers du kit — celui qui veut traiter un vrai dossier le fera lundi, dans son régime validé, avec la même trame.",
        faq: [
          {
            question: "Ma synthèse propose de refuser le sinistre, j'envoie ?",
            reponse:
              "Votre synthèse ne propose rien : elle établit les faits et les clauses en jeu. La décision d'accepter ou de refuser est la vôtre — c'est la frontière du module 2. Le courrier MOTIVE votre décision, il ne la prend pas.",
          },
          {
            question: "L'outil a calculé le montant d'indemnisation, je le garde ?",
            reponse:
              "Non. Un montant se calcule dans vos outils métier, sous vos règles. Ce que l'IA peut faire ici, c'est lister les éléments du calcul et recopier la clause qui le fonde — le chiffre final n'est jamais le sien.",
          },
        ],
        blocages: [
          {
            situation:
              "Un stagiaire est bloqué : l'outil ne retrouve pas une garantie qui figure pourtant au contrat.",
            parade:
              "Faire préciser la question : demander garantie PAR garantie, en citant l'intitulé exact du sommaire du contrat. Si ça ne suffit pas, il traite ce point à la main — c'est aussi l'enseignement : l'outil accélère, il ne remplace pas la lecture.",
          },
          {
            situation: "Le réseau sature au moment des dépôts simultanés des dossiers du kit.",
            parade:
              "Faire démarrer par vagues de cinq, en annonçant l'ordre comme une consigne d'atelier. Ceux qui attendent commencent la synthèse à la main sur la trame — rien ne se perd.",
          },
        ],
        planB:
          "Outil indisponible : le kit contient les sorties imprimées des deux cas (pages 22 à 25, datées) — synthèse brute et premier jet de courrier. L'atelier bascule sur la correction : chacun vérifie les références aux sources sur le contrat papier, barre ce qui ne s'y retrouve pas, et finalise le courrier à la main. Le cœur du module — recopier, vérifier, motiver — est intact.",
      },
    },
    verification: {
      question:
        "Vérification aux sources en binômes croisés, sur la grille fournie : dans la production de l'autre, chaque garantie, chaque franchise, chaque délai cité doit être RETROUVÉ dans le document déposé — référence à l'appui. Toute phrase dont la référence ne se retrouve pas est barrée. Vérifiez aussi : la décision est-elle motivée par des clauses recopiées, ou par des affirmations de l'outil ? L'en-tête « Projet — à faire valider » est-il présent ?",
      reponseAttendue:
        "Chaque référence pointée dans le document source, chaque phrase orpheline BARRÉE au stylo sur la copie du binôme. Le corrigé liste les trois manquements les plus fréquents : la franchise citée de mémoire, le délai de déclaration « standard » que le contrat du kit contredit, et la clause vraie affectée d'un numéro d'article faux.",
      dureeMin: 20,
      notes: {
        script:
          "Faites barrer physiquement, au stylo, sur la copie de l'autre — le geste vaut le discours. Annoncez que chaque binôme doit remonter AU MOINS un écart et que vous en demanderez un à l'oral : la complaisance tombe immédiatement. Fermez le module sur la phrase du métier : « aucun contenu réglementaire produit de mémoire — la vôtre ou celle de l'outil, même règle ».",
        faq: [
          {
            question: "L'outil a écrit un délai de déclaration exact, je le garde ?",
            reponse:
              "Retrouvez-le dans le contrat déposé : s'il y est, gardez-le — vous venez de le VÉRIFIER, ce n'est plus l'outil qui l'affirme. S'il n'y est pas, il saute, même exact : votre courrier cite ce contrat, pas la réglementation en général.",
          },
        ],
        blocages: [
          {
            situation: "Les copies sont trop propres, rien n'est barré.",
            parade:
              "Projeter la production piégée du kit (page 27), qui contient quatre références non sourcées, et faire barrer collectivement. L'œil se règle en trois minutes, puis relancer le croisement.",
          },
        ],
        planB:
          "Grille et corrigé imprimés dans le kit. La vérification se fait sur les contrats papier — aucun outil nécessaire.",
      },
    },
    synthese: {
      acquis: [
        "L'IA structure la synthèse et le courrier, le gestionnaire décide et signe — jamais l'inverse.",
        "Je ne laisse passer AUCUNE référence contractuelle non retrouvée à la source : recopiée du document déposé, vérifiée dans le document, ou supprimée.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites lever les courriers finis : le volume produit en cinquante minutes EST l'argument — nommez-le. Annoncez la pause et le dernier module en une phrase : « il reste à industrialiser : les réponses aux questions qui reviennent tous les jours, tracées — et votre protocole s'assemble ».",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 4 — Réponses aux clients, traçabilité et protocole du service
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-4",
    objectif: {
      enonce:
        "À la fin de ce module, vous produisez des réponses homogènes aux questions récurrentes de votre service, chacune tracée et validée avant envoi — et vous repartez avec le protocole complet, prêt à passer en validation conformité.",
      objectifGlobalId: "obj-3",
      // La ligne de trace et la validation nommée avant envoi servent
      // « vérifier une production avant diffusion » ; le quiz final valide les
      // acquis de la journée entière.
      objectifsSecondairesIds: ["obj-5"],
      dureeMin: 5,
      notes: {
        script:
          "Reprenez le tableau du matin, celui du tour de table : montrez ce que la journée a couvert et ce qu'elle n'a pas couvert — l'honnêteté sur ce point achète la crédibilité du reste. Puis posez l'enjeu du module : « les mêmes questions reviennent chaque semaine ; on va les traiter une fois pour toutes, mais tracées — parce que dans ce métier, une réponse qui engage l'établissement doit rester justifiable ». La trace n'est pas une contrainte ajoutée : c'est ce que ce métier fait déjà partout, on l'applique à l'outil.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "Une question client récurrente arrive ; chacun rédige sa version, dans son style, avec ses approximations. Les réponses divergent d'un conseiller à l'autre, rien n'est tracé, et personne ne peut dire six mois plus tard qui a écrit quoi sur quelle base.",
      apres:
        "La même question traitée sur trame validée et extrait de contrat déposé : la réponse sort en une minute, homogène, chaque condition recopiée de l'extrait — et sa ligne de trace est écrite dans la foulée, sous les yeux de la salle : qui a demandé, quel outil, qui valide, quand.",
      prompt:
        "Voici notre trame de réponse validée et l'extrait des conditions générales joints (documents du kit). Un client demande si la garantie bris de glace de son contrat automobile couvre le remplacement du pare-brise, et ce qui reste à sa charge. Rédige un projet de réponse en quatre phrases maximum, sur le ton de la trame : les conditions et montants proviennent UNIQUEMENT de l'extrait joint, recopiés tels quels avec leur référence d'article ; si l'extrait ne précise pas un point, écris « à vérifier sur votre contrat » au lieu d'un chiffre. Termine par la phrase de la trame : « Cette réponse vous est confirmée par votre conseiller, qui reste à votre disposition. »",
      outil: "Un seul outil, celui validé dans la salle.",
      captureEcran:
        "Le projet de réponse à l'écran, et dessous, la ligne de trace remplie en direct dans le registre du kit : date, question, outil utilisé, rédacteur, valideur nommé, référence de l'extrait source.",
      verifieLe: VERIFIE_LE,
      dureeMin: 10,
      notes: {
        script:
          "Lancez le prompt, lisez la réponse, puis — c'est le geste central — écrivez la ligne de trace DEVANT la salle, sans commentaire, comme une évidence : dix secondes, six champs. Puis dites-le : « voilà toute la traçabilité — dix secondes par réponse. Vous documentez déjà chaque appel client ; ceci est la même hygiène, appliquée à l'outil. » Montrez enfin ce que la réponse ne fait PAS : pas de conseil personnalisé, pas d'engagement de garantie — elle renvoie au conseiller, et c'est la trame qui l'impose.",
        faq: [
          {
            question: "Une réponse type, ce n'est pas du conseil au sens du devoir de conseil ?",
            reponse:
              "C'est exactement la question à faire trancher par votre conformité, et c'est pour ça que la trame renvoie systématiquement au conseiller et que rien ne part sans validation nommée. Où passe la ligne chez vous — je ne me prononce pas, notez la question, votre conformité tranchera.",
          },
          {
            question: "La ligne de trace, dans quel outil on la tient ?",
            reponse:
              "Là où votre service trace déjà : votre CRM, votre outil de gestion, à défaut le registre fourni. Ce qui compte est qu'elle existe, qu'elle ait un titulaire, et qu'on la retrouve un an plus tard.",
          },
        ],
        blocages: [
          {
            situation:
              "La réponse générée dépasse quatre phrases ou reformule les montants au lieu de les recopier.",
            parade:
              "Montrer la correction en direct : réaffirmer la contrainte dans le prompt (« quatre phrases maximum, montants recopiés entre guillemets ») et relancer. C'est une démonstration utile : la contrainte se gagne, elle ne se suppose pas.",
          },
        ],
        planB:
          "La réponse et la ligne de trace remplie sont imprimées dans le kit (page 30, datée). La démonstration se tient sur papier, et la ligne de trace s'écrit au tableau — le geste des dix secondes reste visible.",
      },
    },
    pratique: {
      consigne:
        "Deux temps, chronométrés. D'abord, individuellement : produisez TROIS réponses types aux questions les plus fréquentes de votre service, sur les extraits de contrats du kit et la trame fournie — chacune portant en en-tête ses champs interdits (ce que cette réponse ne doit jamais contenir), sa mention de validation humaine nommée, et sa ligne de trace remplie. C'est la page 3 de votre protocole. Ensuite : écrivez votre feuille de route — vos trois usages priorisés avec un premier dossier et une date, l'environnement à faire valider par votre conformité, et ce qui remonte à votre direction avant tout déploiement. C'est la page 4, elle ferme le protocole.",
      aEmporter:
        "Le protocole du service complet, quatre pages : liste rouge annotée, décisions qualifiées, trois réponses types tracées, feuille de route datée — en projet, à faire valider par votre conformité avant tout usage.",
      dureeMin: 40,
      notes: {
        script:
          "Sur les réponses types : faites choisir des questions RÉELLEMENT récurrentes — « celle qu'on vous pose chaque semaine », pas la plus intéressante. Les champs interdits d'en-tête se remplissent AVANT de générer : c'est le réflexe du module 1 appliqué à l'envoi. Passez dans les rangs avec deux questions : « qui valide celle-ci, nommément ? » et « où est la trace ? ». Sur la feuille de route : exigez un nom et une date par ligne — « je vais tester l'IA » n'est pas une ligne, « synthèse du dossier X mardi, dans l'outil entreprise, validée par Y » en est une. Le protocole s'assemble physiquement : les quatre pages s'agrafent, et l'en-tête « Projet — à faire valider par votre conformité » reste sur la couverture.",
        faq: [
          {
            question: "On peut utiliser ces réponses types dès demain ?",
            reponse:
              "Non — l'en-tête le dit : c'est un projet. Votre conformité valide le protocole, puis vous déployez. Notez sur la page 4 la date à laquelle vous le lui transmettez : c'est la première ligne de votre feuille de route.",
          },
          {
            question: "Mon service n'a pas de questions récurrentes, tout est du cas par cas.",
            reponse:
              "Prenez vos trois derniers courriels sortants : la structure se répète même quand le fond change. La réponse type fige la structure et les règles — le cas par cas reste dans les champs que vous remplissez.",
          },
        ],
        blocages: [
          {
            situation:
              "Un stagiaire veut rédiger ses réponses sur les contrats de SON établissement, qu'il a en tête.",
            parade:
              "Refuser la rédaction de mémoire : « une condition citée de mémoire est exactement ce qu'on a barré au module 3 ». Il rédige sur les extraits du kit ; lundi, il rebranchera la trame sur ses documents réels, déposés dans son régime validé.",
          },
          {
            situation: "Les feuilles de route restent vagues à dix minutes de la fin.",
            parade:
              "Passer table par table avec la même question : « quel dossier, quel jour, validé par qui ? ». Ne pas lâcher tant que chaque stagiaire n'a pas UNE ligne complète — une suffit, vague aucune ne sert.",
          },
        ],
        planB:
          "Outil indisponible : les réponses types se rédigent à la main sur la trame papier, à partir des extraits imprimés — en-tête, validation, trace comprises. La feuille de route et l'assemblage du protocole ne dépendent d'aucun outil. Gardez cet atelier complet même si tout le reste a été dégradé : c'est le livrable de la journée.",
      },
    },
    verification: {
      question:
        "Évaluation des acquis : quiz individuel de dix questions couvrant la journée — régimes d'usage et liste rouge, usages hors périmètre, recopie des références contractuelles, validation et trace — puis correction commentée en salle, question par question.",
      reponseAttendue:
        "Dix réponses individuelles par stagiaire, corrigées en salle sans passer aucune question. Le seuil de réussite est celui déclaré au programme ; un score en dessous déclenche la reprise individuelle prévue au dispositif.",
      dureeMin: 15,
      notes: {
        script:
          "C'est l'évaluation des acquis au sens de l'indicateur 11 : elle se tient, elle se corrige, et elle se conserve. Ne la sacrifiez jamais au temps qui manque — si vous êtes en retard, c'est la correction commentée qui se resserre sur les questions les plus ratées, jamais le quiz qui saute.",
        faq: [
          {
            question: "Le résultat sera transmis à mon employeur ?",
            reponse:
              "Le résultat individuel ne l'est pas. Ce qui est transmis, c'est l'attestation de fin de formation et le fait que l'évaluation a eu lieu.",
          },
        ],
        blocages: [
          {
            situation: "Il est tard, la salle range déjà ses affaires.",
            parade:
              "Tenir le quiz quand même, en annonçant le temps exact : « dix questions, douze minutes, correction incluse ». On ne remplace jamais l'évaluation par un tour de table.",
          },
        ],
        planB:
          "Quiz papier dans le kit (page 33) et corrigé page 34. Aucune dépendance à un outil.",
      },
    },
    synthese: {
      acquis: [
        "Je qualifie chaque pièce et chaque usage AVANT d'ouvrir l'outil — régime d'usage, liste rouge, périmètre.",
        "Je vérifie toute référence contractuelle à la source : recopiée du document déposé, ou supprimée.",
        "Je trace toute réponse qui engage l'établissement — rédacteur, outil, valideur nommé, date — et mon protocole part en validation conformité à la date écrite sur ma feuille de route.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Reprenez une dernière fois le tableau du tour de table du matin et cochez ce que la journée a traité. Puis chacun lit à voix haute LA première ligne de sa feuille de route — un dossier, un jour, un valideur. Fermez sur la phrase du métier : « votre rigueur est votre force ; l'IA ne vous demande pas d'y renoncer, elle vous demande de l'appliquer une fois de plus ».",
        faq: [],
        blocages: [
          {
            situation:
              "Un stagiaire conclut : « en fait on n'a pas le droit de faire grand-chose ».",
            parade:
              "Faire lever son protocole : quatre pages, trois réponses types, un courrier, une synthèse — produits en une journée dans les règles. Ce qu'il n'a pas le droit de faire tenait en une page ; ce qu'il sait faire maintenant en remplit trois.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },
];
