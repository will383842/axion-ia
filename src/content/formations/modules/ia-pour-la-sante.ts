/**
 * CONTENU RÉDIGÉ — « IA pour la santé » (1 jour, 7 h, 4 modules).
 *
 * ## Le fil rouge
 *
 * Chacun repart avec le manuel de procédures IA de son service, assemblé pièce
 * par pièce : le module 1 produit la fiche « le régime de mon poste », le
 * module 2 les trames de courriers et la fiche des quatre traces, le module 3
 * la grille de rendu des écrits de pilotage, le module 4 assemble le tout et
 * le date. Aucun module ne se suffit à lui-même, et c'est voulu : l'ordre est
 * l'enseignement.
 *
 * ## Deux règles que le formateur ne négocie pas
 *
 * **Aucune donnée de patient ou de résident n'approche un outil pendant la
 * journée — ni jamais, dans ce que la journée enseigne.** Pas de nom, pas de
 * dossier, pas de compte rendu, pas de prescription, pas de planning
 * nominatif. Le retrait du nom ne change rien : un cas reste identifiable par
 * croisement, et le module 2 le démontre en direct. Les ateliers tournent sur
 * le jeu FICTIF fourni au kit ou sur des textes neutralisés hors outil et
 * contrôlés par un binôme. Un stagiaire qui colle un cas réel est arrêté, sans
 * discussion : la formation ne peut pas provoquer le manquement qu'elle
 * enseigne à éviter. Cette règle est répétée aux quatre modules — c'est un
 * enseignement central, pas une précaution de salle.
 *
 * **L'IA ne produit jamais rien qui touche au soin, et le formateur n'arbitre
 * aucune question juridique ni médicale.** Ni diagnostic, ni conseil
 * thérapeutique, ni tri ou priorisation de patients — la formation le dit
 * explicitement : ces usages relèvent des systèmes à haut risque, la journée
 * ne traite que les écrits administratifs et organisationnels. La formule de
 * refus est écrite et se prononce telle quelle : « je ne me prononce pas,
 * notez la question, votre référent tranchera. »
 *
 * ⚠️ Les références réglementaires citées dans les séquences `cadre` du
 * catalogue sont fournies au formateur SOURCÉES ET DATÉES dans le kit, et ne
 * se citent jamais de mémoire. Leur formulation reste à faire relire par le
 * conseil de l'organisme.
 */

import type { EnrichissementFormation } from "./types";

/** Date de dernière vérification des captures et sorties d'outils. */
const VERIFIE_LE = "2026-08-06";

export const IA_POUR_LA_SANTE: EnrichissementFormation = [
  // ───────────────────────────────────────────────────────────────────────────
  // Module 1 — Ce que l'IA peut faire dans un établissement, et à quelles
  // conditions
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-1",
    objectif: {
      enonce:
        "À la fin de ce module, vous classez n'importe quel écrit de votre poste en « je peux », « à condition de », « jamais » — et vous savez à qui remonte le doute, au lieu de trancher seul.",
      objectifGlobalId: "obj-4",
      dureeMin: 5,
      notes: {
        script:
          "Tour de table en UNE phrase : « votre prénom, votre poste, et l'écrit qui vous prend le plus de temps ». Notez chaque écrit au tableau — vous y reviendrez au module 4 pour montrer ce que la journée a couvert. Puis posez la règle qui tient la journée, mot pour mot : « aucune donnée de patient ou de résident n'entre dans un outil aujourd'hui — pas le nom, pas le cas, rien — et retirer le nom ne change rien, on le prouvera ce matin ». Annoncez enfin le livrable : chacun repart avec le manuel de procédures IA de son service.",
        faq: [
          {
            question: "On va enfin pouvoir dicter nos transmissions ?",
            reponse:
              "Pas quand elles décrivent un patient ou un résident : rien de ce qui décrit une personne n'entre dans un outil, et c'est la règle de la journée. Ce que vous allez gagner, c'est tout le reste — courriers, notes, écrits de pilotage — et c'est déjà la majorité de ce qui vous retient le soir.",
          },
          {
            question: "Notre direction n'a encore rien validé, on peut quand même se former ?",
            reponse:
              "Oui : se former n'engage aucun traitement de données. La fiche « le régime de mon poste » que vous remplissez ce matin repart justement chez la personne qui valide — c'est elle qui décide de la suite.",
          },
        ],
        blocages: [
          {
            situation: "Un participant raconte un cas de patient en détail dès le tour de table.",
            parade:
              "Couper doucement mais tout de suite : « arrêtez-vous là — le cas reste dans l'établissement, c'est exactement le réflexe qu'on installe aujourd'hui. Reformulez sans la personne : quelle tâche vous prend du temps ? » La salle vient de voir la règle en application.",
          },
        ],
        planB:
          "Aucun outil n'est nécessaire ici. Sans vidéoprojecteur, le tour de table, la règle et l'annonce du livrable se tiennent au paperboard sans rien perdre.",
      },
    },
    demonstration: {
      avant:
        "Le courrier de sortie s'écrit à la main entre deux appels : quinze à vingt minutes, des formules recopiées d'un ancien courrier, et une relecture qui saute quand la journée déborde.",
      apres:
        "Le même courrier — FICTIF, fourni au kit, déjà neutralisé — repris par l'outil : syntaxe corrigée, rendez-vous de suivi en liste datée, ton égal, et les informations manquantes marquées « À COMPLÉTER » au lieu d'être comblées par une invention.",
      prompt:
        "Voici un courrier de sortie FICTIF, fourni pour une formation : il ne décrit aucune personne réelle. Reprends-le sans modifier aucune information : corrige la syntaxe, mets les dates et les rendez-vous de suivi en liste, et adopte un ton professionnel et sobre. N'ajoute aucun élément médical, aucun conseil, aucune interprétation. Si une information te semble manquer, écris « À COMPLÉTER » au lieu d'inventer.",
      outil: "Un seul outil, celui validé dans la salle (Claude ou ChatGPT selon le groupe).",
      captureEcran:
        "Les deux versions côte à côte : le courrier fictif d'origine à gauche, la reprise à droite, avec les mentions « À COMPLÉTER » entourées — c'est elles qu'on commente, pas la fluidité.",
      verifieLe: VERIFIE_LE,
      dureeMin: 10,
      notes: {
        script:
          "Dites d'où vient le document AVANT de le projeter : courrier FICTIF du kit, écrit pour la formation, aucune personne réelle — et répétez-le après, parce que la question « et avec un vrai courrier ? » viendra. La réponse tient en une phrase : jamais, et c'est le sujet du matin. Lancez la reprise, puis lisez à voix haute la ligne du prompt qui interdit d'ajouter du contenu médical : c'est elle qui fait la différence entre un outil de mise en forme et un outil qui écrit du soin.",
        faq: [
          {
            question: "Et si je fais pareil avec un vrai courrier, qui le saura ?",
            reponse:
              "Peut-être personne, et c'est le pire argument : le secret professionnel ne dépend pas d'être vu. Un vrai courrier décrit un vrai patient, il n'entre pas — la question de la détection ne se pose même pas.",
          },
          {
            question: "L'outil pourrait ajouter le traitement de sortie tout seul ?",
            reponse:
              "Il pourrait, et c'est interdit deux fois : c'est du contenu de soin, et ce serait une invention plausible. Tout ce qui touche au soin reste écrit par le professionnel, sans exception.",
          },
        ],
        blocages: [
          {
            situation:
              "L'outil réécrit trop : il reformule le contenu au lieu de seulement le mettre en forme.",
            parade:
              "Ne pas le cacher, l'exploiter : comparer ligne à ligne, montrer ce qui a bougé, et rappeler que la consigne « sans modifier aucune information » réduit le risque sans le supprimer — c'est pour ça que la relecture reste obligatoire.",
          },
        ],
        planB:
          "Quota atteint ou service indisponible : la version d'origine et la reprise sont imprimées dans le kit (datées). La comparaison ligne à ligne et la lecture du prompt se font sur papier, sans rien perdre.",
      },
    },
    pratique: {
      consigne:
        "Deux temps. D'abord, chacun ouvre les conditions d'utilisation du compte qu'il emploie déjà et remplit la fiche « le régime de mon poste » : le régime constaté, ce qui a le droit d'y entrer, et le nom de la personne qui valide dans l'établissement — fiche datée. Ensuite, chronométré : classez douze écrits de votre quotidien (liste fournie, complétée par vos propres cas) en « je peux », « à condition de », « jamais », puis correction croisée en binôme — chacun défend un classement contesté.",
      aEmporter:
        "La fiche « le régime de mon poste », datée et portant le nom de la personne qui valide, et le classement des douze écrits corrigé — les deux premières pages du manuel de procédures.",
      dureeMin: 40,
      notes: {
        script:
          "La liste des douze écrits contient des pièges, et c'est voulu : la relance de facturation sans nom (je peux), la note de service (je peux), le planning nominatif des résidents (jamais — même « juste les initiales »), la transmission ciblée (jamais), le courrier type de convocation à compléter après coup (à condition de). Faites écrire « jamais » en toutes lettres, pas d'une croix : le mot engage. Pendant la correction croisée, collectez les cas litigieux au tableau sans les trancher — ils servent à la vérification qui suit. Le doute se note, il ne se tranche pas en salle.",
        faq: [
          {
            question: "Mon compte personnel gratuit, c'est quel régime ?",
            reponse:
              "Grand public : ce qui y entre peut servir à entraîner le modèle et sort de votre contrôle. Rien de professionnel n'y entre tant que votre direction n'a pas validé mieux — c'est la première ligne de votre fiche.",
          },
          {
            question: "Avec les initiales et l'âge, ce n'est plus identifiant ?",
            reponse:
              "Si. Dans un service de quarante lits, « Mme B., 87 ans, entrée mardi » désigne une personne. L'identification se fait par croisement, pas par le nom — le module 2 le démontre en direct.",
          },
        ],
        blocages: [
          {
            situation:
              "Un stagiaire classe « à condition de » tout ce qui l'arrange, pour ne rien s'interdire.",
            parade:
              "Une seule question : « à condition de QUOI, validé par QUI ? ». Si la condition n'a ni nom ni date, c'est un « jamais » provisoire. Il corrige seul, ne corrigez pas à sa place.",
          },
          {
            situation:
              "Personne dans la salle n'a de compte professionnel : tout est grand public.",
            parade:
              "La fiche se remplit quand même — le régime constaté EST l'information. C'est précisément ce que la personne qui valide doit lire, et c'est un livrable plus utile qu'un compte parfait.",
          },
        ],
        planB:
          "L'atelier ne dépend d'aucun outil : les conditions d'utilisation des trois comptes les plus répandus sont imprimées dans le kit (datées), la fiche et la liste des douze écrits sont sur papier.",
      },
    },
    verification: {
      question:
        "Correction en salle : les cas litigieux du classement sont tranchés en plénière contre la fiche des trois régimes — chacun corrige son propre classement et note les deux cas qu'il avait faux. Question fermée pour finir : un écrit sans nom mais qui raconte le parcours d'un patient, quel classement ?",
      reponseAttendue:
        "« Jamais » — le retrait du nom ne change pas la nature de la donnée. Chaque stagiaire repart avec ses deux erreurs notées en bas de sa fiche ; les cas restés en doute sont écrits au tableau, à remonter au référent, jamais tranchés en salle.",
      dureeMin: 10,
      notes: {
        script:
          "Tranchez CONTRE la fiche des trois régimes, jamais d'opinion personnelle : la fiche est datée et sourcée, vous ne l'êtes pas. Si un cas litigieux est en réalité une question juridique — secret partagé, sous-traitance, hébergement — la formule est écrite et se prononce telle quelle : « je ne me prononce pas, notez la question, votre référent tranchera ». La liste des questions remontées est une production utile de la journée : elle part dans le manuel.",
        faq: [
          {
            question: "Et si notre référent ne répond jamais ?",
            reponse:
              "Alors le doute reste un « jamais ». Une absence de réponse n'est pas une autorisation — c'est même la règle la plus protectrice que vous emportez aujourd'hui.",
          },
        ],
        blocages: [
          {
            situation: "La plénière dérive en débat sur le bien-fondé de la réglementation.",
            parade:
              "Recentrer en une phrase : « le débat est légitime, il n'est pas d'aujourd'hui — aujourd'hui on apprend à travailler DANS la règle ». Puis passer au cas suivant sans attendre.",
          },
        ],
        planB:
          "La fiche des trois régimes et le corrigé du classement sont imprimés dans le kit. Sans vidéoprojecteur, ils se distribuent et se commentent à l'oral.",
      },
    },
    synthese: {
      acquis: [
        "Je nomme le régime de mon poste et la personne qui le valide dans l'établissement.",
        "Je classe un écrit en « je peux / à condition de / jamais » — et un écrit qui décrit un patient est un « jamais », même sans le nom.",
        "Je fais remonter le doute à mon référent au lieu de trancher seul.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites-les FORMULER, ne récitez pas : « en une phrase, qu'est-ce que vous ne ferez plus à partir de demain ? ». Trois réponses suffisent. Annoncez la pause et ce qui suit : « on va prouver que retirer le nom ne suffit pas — puis vous écrirez vos premiers courriers ».",
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
  // Module 2 — Neutraliser un cas, puis écrire vite ses courriers et ses
  // transmissions
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-2",
    objectif: {
      enonce:
        "À la fin de ce module, vous produisez un courrier ou une note de transmission diffusable à partir d'un texte que vous avez rendu réellement non identifiant — contrôlé par un collègue AVANT d'entrer dans l'outil.",
      objectifGlobalId: "obj-1",
      // Ce module produit aussi les trames de courriers de gestion courante :
      // confirmation ou report de rendez-vous aux familles, réponse à une
      // administration — l'appui administratif vendu en obj-2. Et il installe
      // le geste central de la confidentialité (obj-4) : neutraliser hors
      // outil, contrôler à deux.
      objectifsSecondairesIds: ["obj-2", "obj-4"],
      dureeMin: 5,
      notes: {
        script:
          "Posez le contrat du module d'entrée : « rien n'entre dans l'outil avant le contrôle des quatre traces par votre binôme — et au moindre doute, vous basculez sur un cas du jeu fictif du kit ». Puis annoncez le gain : ce module est celui des écrits du quotidien, courriers aux familles, aux confrères, aux administrations — le volume le plus lourd du métier, sans une seule donnée de patient dedans quand on s'y prend bien.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "« J'ai retiré le nom, donc c'est anonyme. » Le texte FICTIF projeté n'a plus de nom, et la salle le croit muet sur la personne.",
      apres:
        "On demande à l'outil ce que le texte permet de deviner : âge probable, entrée un mardi, chambre côté jardin, fille qui visite le jeudi. En moins d'une minute, la liste suffit à désigner la personne dans n'importe quel service. Le nom n'était pas l'information.",
      prompt:
        "Voici un texte FICTIF de formation, dont le nom de la personne a été retiré. Première tâche : liste tout ce que ce texte permet de déduire sur la personne — âge probable, lieux, dates, entourage, situation, éléments singuliers. Deuxième tâche : dis quelles informations un collègue, un voisin ou un proche devrait déjà connaître pour la reconnaître à partir de ce texte. Travaille uniquement à partir du texte fourni, ne complète rien.",
      outil: "Un seul outil, celui validé dans la salle.",
      captureEcran:
        "La sortie projetée avec les quatre familles de traces surlignées en quatre couleurs : dates, lieu, entourage, singularité du cas.",
      verifieLe: VERIFIE_LE,
      dureeMin: 10,
      notes: {
        script:
          "Répétez que le texte est fictif AVANT et APRÈS la démonstration — c'est la condition pour la faire. Faites PARIER la salle à main levée avant de lancer : « ce texte est-il anonyme ? ». Le pari est ce qui rend la suite mémorable : sans lui, la salle regarde une démonstration ; avec lui, elle s'est trompée elle-même. Concluez en une phrase : « c'est pour ça que la règle du matin ne dit pas “anonymisez”, elle dit “rien n'entre” ».",
        faq: [
          {
            question: "Donc même anonymisé, on n'a pas le droit ?",
            reponse:
              "Un texte pseudonymisé reste une donnée personnelle, soumise aux mêmes règles — c'est le cadre qui suit. Ce qui peut entrer, c'est un texte réécrit au point de ne plus décrire cette personne-là : c'est exactement l'atelier.",
          },
          {
            question: "Qui irait vraiment recouper tout ça ?",
            reponse:
              "Personne n'a besoin de le faire : il suffit que ce soit possible. Et dans un établissement, tout le monde connaît tout le monde — le croisement, c'est la salle de pause.",
          },
        ],
        blocages: [
          {
            situation: "L'outil déduit peu, la démonstration tombe à plat.",
            parade:
              "Relancer avec : « dresse le portrait le plus précis possible de la personne ». La formulation « portrait » force la déduction. Si ça ne suffit pas, passer au plan B — ne rien improviser.",
          },
        ],
        planB:
          "La sortie est imprimée et surlignée dans le kit (datée). La démonstration se rejoue sur papier : lecture du texte, pari de la salle, puis lecture de la liste des déductions.",
      },
    },
    pratique: {
      consigne:
        "Trois temps. D'abord la prise en main, chronométrée, chacun sur son poste : déposer un fichier, coller un export, dicter deux minutes depuis son téléphone — sur les documents FICTIFS du kit uniquement — avec la parade des trois échecs classiques (scan sans texte reconnu, tableau désaligné, fichier trop lourd). Ensuite, neutralisez votre propre cas : réécrivez un extrait réel SUR PAPIER, hors outil, jusqu'à ce que les quatre traces aient disparu — dates, lieu, entourage, singularité — puis faites-le contrôler par votre binôme, fiche des quatre traces en main ; tant qu'une trace reste, rien n'entre dans l'outil, et au moindre doute vous basculez sur un cas du jeu fictif. Enfin, atelier chronométré : produisez un écrit réel de votre poste — courrier à une famille (confirmation ou report de rendez-vous compris), courrier à un confrère, note de transmission, réponse à une administration — à partir du cas neutralisé.",
      aEmporter:
        "Un écrit diffusable après relecture, la fiche des quatre traces, et les trames réutilisables de courriers — famille, confrère, administration, rendez-vous. Troisième pièce du manuel de procédures.",
      dureeMin: 50,
      notes: {
        script:
          "Le deuxième temps se fait STYLO EN MAIN, écrans fermés — dites-le, puis vérifiez-le en passant dans les rangs : une neutralisation qui se fait dans l'outil est déjà une fuite. Le contrôle du binôme est un droit de veto, pas un avis. Sur la prise en main : annoncez les trois causes d'échec AVANT qu'elles arrivent — un stagiaire qui échoue sans avoir été prévenu se referme pour la journée ; prévenu, il vous appelle. Et la dictée se fait sur un texte du kit : personne ne dicte un contenu de patient, même pour essayer.",
        faq: [
          {
            question: "Neutraliser directement dans l'outil, ce serait plus rapide.",
            reponse:
              "Ce serait surtout déjà trop tard : pour lui faire neutraliser le cas, il faudrait le lui donner. La neutralisation se fait hors outil, toujours — c'est le seul ordre des opérations qui protège.",
          },
          {
            question: "Ma réponse à l'administration doit citer le numéro de dossier.",
            reponse:
              "Alors elle se finit hors outil : l'outil produit la trame et les formulations, vous insérez le numéro et les éléments nominatifs après, sur votre poste. L'outil écrit le squelette, jamais le dossier.",
          },
        ],
        blocages: [
          {
            situation: "Un stagiaire colle son extrait réel non contrôlé « pour gagner du temps ».",
            parade:
              "Arrêter immédiatement, sans négocier : faire supprimer la conversation, puis le dire à la salle sans nommer personne — « on vient de voir la seule faute grave possible aujourd'hui ». C'est le point non négociable de la journée.",
          },
          {
            situation: "Un binôme n'ose pas invalider le texte de l'autre.",
            parade:
              "Imposer la règle du compte : le contrôleur annonce un NOMBRE de traces restantes (« il en reste deux »), il ne juge pas le texte. Compter est plus facile que critiquer, et tout aussi efficace.",
          },
        ],
        planB:
          "Réseau ou outil indisponible : la neutralisation et son contrôle sont déjà hors outil, ils se tiennent tels quels. L'écrit final se rédige à la main sur les trames papier du kit (datées) — chacun relancera la mise en forme chez lui, la structure est acquise.",
      },
    },
    verification: {
      question:
        "Vérification croisée sur la grille fournie : dans l'écrit produit par votre binôme, comptez à voix haute les traces résiduelles — dates, lieu, entourage, singularité — puis passez l'exactitude, le ton, les mentions attendues et les formulations biaisées relevées dans la grille du matin.",
      reponseAttendue:
        "Zéro trace résiduelle : chaque trace trouvée se compte à voix haute et se corrige séance tenante. Le corrigé fourni montre les trois traces qui survivent le plus souvent — le jour de la semaine, le lien de parenté, le détail singulier du cas.",
      dureeMin: 10,
      notes: {
        script:
          "Faites compter à voix haute : le comptage collectif règle l'œil de toute la salle en trois productions. Commentez deux ou trois écarts seulement, ceux qui se répètent — le reste se lit sur le corrigé.",
        faq: [
          {
            question: "Le ton de mon courrier famille est trop froid, c'est l'outil ?",
            reponse:
              "C'est la consigne : demandez « chaleureux et sobre » et donnez en modèle une phrase de vos propres courriers — une formule de politesse d'établissement n'est pas une donnée de patient, elle peut entrer.",
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
          "Grille et corrigé sont imprimés dans le kit. La vérification croisée ne dépend d'aucun outil.",
      },
    },
    synthese: {
      acquis: [
        "Je neutralise un cas hors outil, stylo en main — et je bascule sur le jeu fictif au moindre doute.",
        "Je fais contrôler les quatre traces par un collègue avant d'appuyer sur Entrée.",
        "Je produis un courrier ou une transmission diffusable à partir du cas neutralisé, et je le relis avant diffusion.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites formuler la règle des quatre traces par un stagiaire, pas par vous — elle doit sortir de la salle. Puis annoncez l'après-midi : « les écrits longs, ceux qu'on repousse — synthèses, rapports, tutelle. Aucune donnée de patient dedans, et le plus gros gain de la journée. »",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 3 — Les écrits qui font vivre l'établissement : qualité, projets,
  // tutelle
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-3",
    objectif: {
      enonce:
        "À la fin de ce module, vous produisez en une séance un écrit de pilotage que vous repoussez d'habitude — synthèse, trame de rapport d'activité, réponse à une tutelle ou à un appel à projets — et chaque affirmation y est renvoyée à sa page source.",
      objectifGlobalId: "obj-3",
      // Les écrits de pilotage sont l'appui administratif vendu en obj-2, et
      // la chasse à l'erreur de fin de module est le geste de vérification
      // avant diffusion vendu en obj-5.
      objectifsSecondairesIds: ["obj-2", "obj-5"],
      dureeMin: 5,
      notes: {
        script:
          "Reprenez le tableau du matin — les écrits cités au tour de table — et entourez ceux que l'après-midi couvre : rapports, synthèses, réponses aux tutelles. Puis dites pourquoi ce terrain est le plus sûr de la journée : ces documents ne contiennent pas de données de patients — quand ils en frôlent une, on le verra, et on la sort.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "Le rapport de quarante pages attend depuis trois semaines dans la pile : personne n'a deux heures devant soi, donc personne ne l'ouvre, et la note pour la direction ne part pas.",
      apres:
        "Le même rapport — public, fourni au kit — chargé dans l'outil : une note d'une page en trois constats, deux vigilances, trois actions, chaque ligne renvoyée à sa page. La lecture n'a pas disparu : elle est devenue une vérification ciblée de six pages au lieu de quarante.",
      prompt:
        "Voici un rapport public de quarante pages, joint en PDF. Rédige une note d'une page pour la direction d'un établissement de santé : trois constats principaux, deux points de vigilance, trois actions recommandées par le rapport lui-même. Pour chaque élément, cite la page d'où il vient. N'ajoute aucune recommandation de ton cru. Si une rubrique ne peut pas être remplie à partir du texte, écris « le rapport ne le précise pas ».",
      outil: "Un seul outil, celui validé dans la salle.",
      captureEcran:
        "La note d'une page projetée à côté du sommaire du rapport, avec les renvois de page entourés — et une ligne « le rapport ne le précise pas » laissée visible.",
      verifieLe: VERIFIE_LE,
      dureeMin: 10,
      notes: {
        script:
          "Utilisez le rapport PUBLIC du kit, référencé et daté — jamais un document interne apporté par la salle pour la démonstration. Après la sortie, ouvrez le rapport à DEUX des pages citées et vérifiez en direct devant tout le monde : la vérification fait partie de la démonstration, pas de l'après. Si une page citée est fausse, c'est encore mieux — voir la parade.",
        faq: [
          {
            question: "Et si la page citée ne dit pas ça ?",
            reponse:
              "Alors vous venez de gagner : vous l'avez vu en trente secondes, avant la direction. C'est tout l'intérêt d'exiger les renvois de page — une note sans renvois est invérifiable, donc inutilisable.",
          },
          {
            question: "On peut charger nos documents internes ?",
            reponse:
              "Un protocole, une recommandation ou un cahier des charges sans donnée de patient, oui — dans le régime validé de votre poste. Un document qui décrit des personnes, jamais, quel que soit le régime.",
          },
        ],
        blocages: [
          {
            situation:
              "Les numéros de page cités sont faux — le PDF est paginé autrement que le document.",
            parade:
              "Le montrer et en faire l'enseignement : les renvois se vérifient TOUJOURS. Relancer en ajoutant « cite la phrase exacte en plus de la page » — la citation textuelle se retrouve par recherche même quand la pagination diffère.",
          },
        ],
        planB:
          "La note et le rapport sont imprimés dans le kit (datées), les deux pages à vérifier marquées d'un signet. La démonstration se rejoue sur papier, vérification en direct comprise.",
      },
    },
    pratique: {
      consigne:
        "Deux temps. D'abord, faire parler un document long au lieu de le lire : chargez votre protocole, votre recommandation ou votre cahier des charges d'appel à projets — sans aucune donnée de patient — et posez trois questions ; production attendue : trois réponses, chacune renvoyée à sa page d'origine et vérifiée dans le document. Ensuite, atelier chronométré au choix, consigne écrite et grille de rendu fournies pour chacun des quatre parcours : synthèse d'un document apporté, trame de rapport d'activité, réponse à un appel à projets, trame de note de projet personnalisé — la trame SEULE : structure et formulations types, jamais le contenu concernant un résident, qui se remplit ensuite hors outil.",
      aEmporter:
        "Un écrit de pilotage entamé sur un document réel, ses renvois de page vérifiés, et la grille de rendu de votre parcours — quatrième pièce du manuel de procédures.",
      dureeMin: 60,
      notes: {
        script:
          "Sur le premier temps : exigez la vérification d'UNE réponse sur trois dans le document source, à l'écran — pas les trois, le temps manque, mais jamais zéro. Sur le parcours « projet personnalisé » : dites-le explicitement et deux fois — la trame sort de l'outil VIDE de toute personne, le remplissage se fait dans l'établissement, hors outil. Sur le choix de parcours : celui qui hésite prend la synthèse, c'est le parcours qui marche pour tous. Passez dans les rangs, relancez, ne rédigez rien à la place de personne.",
        faq: [
          {
            question: "Mon appel à projets exige des données d'activité chiffrées.",
            reponse:
              "L'outil construit l'argumentaire et la structure ; les chiffres, c'est vous qui les insérez ensuite, depuis vos tableaux de bord. Ne le laissez jamais remplir un chiffre : il en mettra un plausible, et faux.",
          },
          {
            question: "Un rapport d'activité cite forcément des situations de résidents.",
            reponse:
              "En agrégé, oui — jamais en situation individuelle reconnaissable. La règle des quatre traces du matin s'applique ici aussi : une « situation illustrative » singulière est identifiante, elle se réécrit ou elle sort.",
          },
        ],
        blocages: [
          {
            situation: "Un stagiaire n'a apporté aucun document.",
            parade:
              "Le kit fournit un protocole public et un cahier des charges d'appel à projets public. Personne ne regarde son voisin travailler pendant quarante-cinq minutes.",
          },
          {
            situation: "Le PDF chargé est un scan sans texte reconnu.",
            parade:
              "C'est l'échec n° 1 de la prise en main du matin : reprendre la parade (re-export depuis la source, ou photo page à page). Si rien n'y fait, basculer sur le document du kit sans y passer plus de cinq minutes.",
          },
        ],
        planB:
          "Outil indisponible : les quatre parcours ont leur trame papier dans le kit, et le premier temps se fait sur le rapport imprimé — trois questions, réponses cherchées au sommaire et à l'index. L'exercice démontre au passage, par contraste, ce que l'outil fait gagner.",
      },
    },
    verification: {
      question:
        "Chasse à l'erreur dans votre propre production : surlignez ce que l'IA a inventé, arrondi ou déformé, retournez au document source pour trancher chaque surlignage, puis comptage collectif à voix haute — c'est la salle qui corrige, pas le formateur.",
      reponseAttendue:
        "Chaque production porte au moins un surlignage tranché contre la source — une invention trouvée n'est pas un échec, c'est la preuve que la relecture fonctionne. Le score collectif s'écrit au tableau, et la règle se formule ensemble : rien ne se signe sans retour à la source.",
      dureeMin: 15,
      notes: {
        script:
          "Comptez les surlignages à main levée AVANT de trancher, et notez le score au tableau : la salle sous-estime toujours ce que l'outil invente, et le chiffre affiché vaut mieux qu'un discours sur la vigilance. Celui qui n'a rien trouvé échange sa production avec son binôme — on trouve toujours mieux chez l'autre.",
        faq: [
          {
            question: "Je n'ai rien trouvé, mon texte est bon ?",
            reponse:
              "Peut-être — ou votre œil n'est pas encore réglé. Échangez avec votre binôme et cherchez dans sa production : si vous trouvez chez lui, vous savez quoi rechercher chez vous.",
          },
        ],
        blocages: [
          {
            situation: "Le tranchage déborde : les documents sources sont trop longs.",
            parade:
              "Limiter à trois surlignages par personne, les plus lourds de conséquence. Le geste s'apprend sur trois, pas sur douze — le reste se tranche au bureau, avec la même méthode.",
          },
        ],
        planB:
          "Sans outil, la chasse se fait sur la production papier du plan B précédent : surligner, retourner à la source, trancher — le geste est identique.",
      },
    },
    synthese: {
      acquis: [
        "Je fais parler un document long : trois questions, trois réponses, chacune renvoyée à sa page.",
        "Je ne signe jamais un écrit de pilotage sans avoir recoupé ses affirmations avec la source.",
        "Je produis une trame de projet personnalisé vide de toute personne — le contenu se remplit hors outil.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites formuler la règle de signature par la salle : « qu'est-ce qu'on ne signe plus ? ». Puis annoncez la pause et le dernier module en une phrase : « vous repartez avec le manuel de votre service et trois usages datés, à faire viser par votre encadrement ».",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 4 — Ancrer dans l'établissement sans se mettre en faute
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-4",
    objectif: {
      enonce:
        "À la fin de ce module, vous repartez avec le manuel de procédures IA de votre service — trois fiches portant leur liste de vérifications — et trois usages datés, à faire viser par votre encadrement.",
      objectifGlobalId: "obj-5",
      // Le retour sur l'historique du jour et le renvoi au référent protection
      // des données prolongent la confidentialité (obj-4) jusque dans
      // l'ancrage.
      objectifsSecondairesIds: ["obj-4"],
      dureeMin: 5,
      notes: {
        script:
          "Reprenez le tableau du tour de table : entourez ce que la journée a couvert, et dites franchement ce qu'elle n'a pas couvert — l'honnêteté sur ce point achète la crédibilité de tout le reste. Puis annoncez la mécanique du module : on vérifie d'abord ce qu'on a fait aujourd'hui, on l'écrit en procédures ensuite, on date les usages enfin.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "Chacun repart d'une formation avec des réflexes en tête et rien d'écrit : trois semaines plus tard, l'usage a repris sa forme d'avant, et le collègue absent ce jour-là colle ce qu'il veut dans l'outil qu'il veut.",
      apres:
        "Un besoin réel de la salle devient une fiche-procédure d'une page, rédigée en direct : la liste de vérifications en en-tête, quand l'utiliser, ce qui n'entre jamais, les étapes numérotées. Elle est affichable au poste demain matin — après visa.",
      prompt:
        "Rédige une fiche-procédure d'une page pour le personnel d'un établissement de santé : « produire un courrier à une famille avec l'aide de l'IA ». Structure imposée : en en-tête, la liste des vérifications à faire avant diffusion ; puis quand utiliser cette procédure ; puis ce qui ne doit JAMAIS être collé dans l'outil — aucune donnée de patient ou de résident, même sans le nom ; puis les étapes, numérotées, une action par étape. Phrases courtes, impératives, sans jargon. La fiche tient sur une page.",
      outil: "Un seul outil, celui validé dans la salle.",
      captureEcran:
        "La fiche projetée en entier, l'en-tête de vérifications surligné, et la ligne « aucune donnée de patient ou de résident, même sans le nom » entourée.",
      verifieLe: VERIFIE_LE,
      dureeMin: 10,
      notes: {
        script:
          "Prenez le besoin DANS la salle — tour rapide : « quelle fiche vous servirait lundi matin ? » — et remplacez le sujet du prompt par le besoin choisi ; le prompt du kit sert de repli tel quel. Une fois la fiche affichée, faites vérifier par la salle qu'elle reprend les règles de la journée : si la fiche contredit ce qu'on a appris, elle est fausse — c'est le test, et c'est la salle qui le fait passer.",
        faq: [
          {
            question: "Qui signe cette fiche dans l'établissement ?",
            reponse:
              "La personne qui valide les procédures chez vous — cadre, direction, référent qualité. La fiche sort d'ici en projet : la mention « à faire viser » ne se retire pas avant validation.",
          },
          {
            question: "On peut en faire une pour le secrétariat et une pour les soignants ?",
            reponse:
              "Pour les écrits administratifs de chaque poste, oui. Mais aucune fiche ne décrira jamais un usage de soin — ni diagnostic, ni tri, ni conseil : ce n'est le périmètre ni de l'outil, ni de la journée.",
          },
        ],
        blocages: [
          {
            situation:
              "Le besoin choisi par la salle touche au soin — « une aide à la préparation des piluliers », « un tri des demandes de rendez-vous urgentes ».",
            parade:
              "Refuser calmement et à voix haute : « c'est un usage de soin ou de priorisation de patients — l'IA n'y entre pas, choisissons un écrit ». Le refus en direct est un enseignement, pas un incident : c'est la ligne rouge du matin, appliquée devant tous.",
          },
        ],
        planB:
          "La fiche-procédure du kit (datée) est imprimée : la démonstration devient une lecture commentée, en-tête d'abord, et la salle amende la fiche à la main.",
      },
    },
    pratique: {
      consigne:
        "Trois temps. D'abord, retour sur vos propres demandes du jour : relisez l'historique de vos échanges avec l'outil, surlignez ce qui n'aurait pas dû être collé, supprimez les conversations concernées, et reportez le constat en bas de votre fiche « le régime de mon poste ». Ensuite, rédigez le manuel de procédures IA de votre service : trois fiches-procédures — courrier famille ou confrère, note de transmission, écrit de pilotage — portant chacune en en-tête sa liste de vérifications, plus la page « régimes, ligne rouge et à qui la question remonte ». Enfin, la feuille de route individuelle : trois usages datés, un usage explicitement écarté et pourquoi, la personne qui valide avant de démarrer, la date de revue.",
      aEmporter:
        "Le manuel de procédures IA du service — trois fiches vérifiées plus la page des régimes — et la feuille de route datée, à faire viser par votre encadrement. C'est le livrable de la journée, et il s'assemble ici.",
      dureeMin: 40,
      notes: {
        script:
          "Le premier temps est un examen sans témoin : personne n'annonce ce qu'il a trouvé, chacun supprime et note. Si quelqu'un a collé une donnée de patient malgré la journée : suppression, constat sur la fiche, et signalement à son référent en rentrant — dites-le sans dramatiser ni minimiser, c'est la conduite à tenir, pas une punition. Sur le manuel : l'en-tête de vérifications se recopie de la grille utilisée toute la journée, ne le faites pas réinventer. Sur la feuille de route : un usage sans date et sans nom de valideur n'est pas un usage, c'est une intention.",
        faq: [
          {
            question: "L'usage écarté, ça sert à quoi de l'écrire ?",
            reponse:
              "C'est la ligne que votre encadrement lira en premier : elle prouve que vous savez où vous vous arrêtez. Un manuel qui ne dit que « oui » ne protège personne — c'est le « jamais » écrit qui rend le reste crédible.",
          },
          {
            question: "Je peux mettre « dicter mes transmissions » dans mes trois usages ?",
            reponse:
              "Non : une transmission décrit un patient, elle n'entre pas dans un outil. C'est en revanche un excellent candidat pour l'usage écarté — avec sa raison écrite en une phrase.",
          },
        ],
        blocages: [
          {
            situation: "Le retour sur l'historique tourne à l'aveu public entre collègues.",
            parade:
              "Couper : personne ne montre son écran, personne ne commente celui du voisin. Le constat est individuel, il va sur la fiche — pas dans la salle.",
          },
          {
            situation: "Les trois fiches ne tiennent pas dans le temps imparti.",
            parade:
              "Priorité à la fiche du geste le plus fréquent, complète et vérifiée ; les deux autres partent en trame, en-tête déjà recopié. Un manuel d'une fiche vérifiée vaut mieux que trois fiches bâclées.",
          },
        ],
        planB:
          "Presque rien ne dépend d'un outil : le manuel et la feuille de route s'écrivent sur les trames papier du kit. Seul le retour sur l'historique suppose l'outil ouvert — à défaut, chacun note de mémoire ce qu'il a collé de douteux, et refait l'exercice au bureau. C'est l'atelier le plus robuste de la journée.",
      },
    },
    verification: {
      question:
        "Validation des acquis : quiz individuel de dix questions, corrigé en salle question par question — les trois régimes, les quatre traces, la ligne rouge du soin, les renvois de page, à qui remonte le doute. Puis passage de votre production du jour à la grille de critères, chacun notant les points à reprendre sur sa fiche-procédure.",
      reponseAttendue:
        "Le corrigé est commenté question par question, sans en passer aucune. Le seuil de réussite est celui déclaré au programme ; un score en dessous déclenche la reprise individuelle prévue au dispositif. Les points à reprendre se notent sur la fiche-procédure elle-même — c'est elle qui vit après la journée.",
      dureeMin: 20,
      notes: {
        script:
          "C'est l'évaluation des acquis au sens de l'indicateur 11 : elle se tient, se corrige et se conserve — ne la sacrifiez jamais au temps qui manque ; si vous êtes en retard, coupez ailleurs. Deux questions du quiz portent sur la ligne rouge — données de patients, usages de soin : si l'une des deux est ratée par plusieurs personnes, reprenez-la en entier. C'est la seule erreur de la journée qui ne pardonne pas dehors.",
        faq: [
          {
            question: "Mon résultat sera transmis à mon employeur ?",
            reponse:
              "Le résultat individuel ne l'est pas. Ce qui est transmis, c'est l'attestation de fin de formation et le fait que l'évaluation a eu lieu.",
          },
        ],
        blocages: [
          {
            situation: "Il est 17 h 10 et le quiz n'est pas commencé.",
            parade:
              "Le tenir quand même, en réduisant le commentaire du corrigé aux questions les plus ratées. On ne remplace jamais l'évaluation par un tour de table.",
          },
        ],
        planB: "Quiz papier et corrigé imprimés dans le kit. Aucune dépendance à un outil.",
      },
    },
    synthese: {
      acquis: [
        "Je fais viser le manuel de procédures et ma feuille de route par mon encadrement avant tout usage régulier.",
        "Je ne fais jamais entrer une donnée de patient ou de résident dans un outil — même sans le nom — et je ne fais jamais produire à l'IA un contenu de soin.",
        "Je sais à qui remonte chaque doute : la validation d'un outil à la direction, les questions de secret et de données au référent désigné.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Clôture : chacun lit à voix haute son premier usage daté ET son usage écarté — les deux, dans cet ordre. Notez-les au tableau, prenez une photo du tableau (il ne porte que des usages, aucune donnée), envoyez-la au groupe. Terminez par la formule qui les protège dehors, prononcée une dernière fois ensemble : « je ne me prononce pas, je note la question, mon référent tranchera ».",
        faq: [],
        blocages: [
          {
            situation: "Les engagements restent vagues : « je vais essayer d'utiliser l'IA ».",
            parade:
              "Reformuler en une question : « quel écrit, et quel jour ? ». Ne pas passer au suivant tant que la réponse ne porte pas un écrit et une date.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },
];
