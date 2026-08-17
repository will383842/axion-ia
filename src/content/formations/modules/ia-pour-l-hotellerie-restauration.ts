/**
 * CONTENU RÉDIGÉ — « IA pour l'hôtellerie-restauration » (1 jour, 7 h, 4 modules).
 *
 * ## Le fil rouge
 *
 * Chacun repart avec le classeur de l'établissement, construit pièce par pièce :
 * la liste rouge de ce qui ne sort jamais (module 1), les trames de réponses aux
 * avis et aux messages de réservation (module 2), une production carte ou groupe
 * revalidée sur fiche technique (module 3), et la fiche d'identité IA de
 * l'établissement avec sa feuille de route (module 4). L'ordre est
 * l'enseignement : on choisit son compte avant d'écrire, on écrit avant de
 * publier, on revalide avant de diffuser, on installe avant de partir.
 *
 * ## L'interdit le plus fort de la journée, enseigné comme tel
 *
 * **L'IA ne produit JAMAIS une liste d'allergènes ni une mention réglementaire
 * de carte.** Allergènes, « fait maison », origine des viandes, appellations :
 * ces mentions se RECOPIENT depuis les fiches techniques et documents validés
 * de l'établissement — elles ne se génèrent pas, ne se traduisent pas, ne se
 * reformulent pas. Une erreur d'allergène ne fait pas perdre un client : elle
 * peut mettre une vie en jeu. Le module 3 le démontre sur pièce (la moutarde
 * disparue d'une traduction) et le répète jusqu'à ce que le geste soit acquis.
 *
 * ## Trois autres règles que le formateur ne négocie pas
 *
 * **Aucun avis fabriqué, jamais** — ni pour soi, ni contre un concurrent. Et
 * une réponse publique ne confirme JAMAIS qu'une personne a séjourné ou dîné
 * dans l'établissement : elle ne révèle rien du séjour (dates, chambre,
 * montant, régime alimentaire), n'admet aucun fait non vérifié, ne nomme aucun
 * salarié, n'annonce aucun geste commercial en public.
 *
 * **Aucune donnée client dans un outil.** Réservations, historiques, fichiers
 * clients, plannings nominatifs : rien de tout cela n'entre dans un assistant.
 * Les ateliers tournent sur le matériel du kit ; les trames gardent leurs
 * champs [NOM] et [DATES] entre crochets, qui se remplissent hors outil.
 *
 * **Le formateur n'arbitre aucune question juridique.** La formule est écrite
 * et se prononce telle quelle : « je ne me prononce pas, notez la question,
 * votre conseil tranchera ».
 *
 * ⚠️ Les références réglementaires des blocs `cadre` du catalogue (règlement
 * (UE) 2024/1689 sur l'information du client, règlement (UE) n° 1169/2011
 * annexe II sur les 14 allergènes, mention « fait maison », origine des
 * viandes) sont fournies au formateur SOURCÉES ET DATÉES dans le kit et ne se
 * citent jamais de mémoire. Leur formulation — comme celle de la réponse
 * formateur sur les avis fabriqués — reste à faire relire par le conseil de
 * l'organisme.
 */

import type { EnrichissementFormation } from "./types";

/** Date de dernière vérification des captures et sorties d'outils. */
const VERIFIE_LE = "2026-08-06";

export const IA_POUR_L_HOTELLERIE_RESTAURATION: EnrichissementFormation = [
  // ───────────────────────────────────────────────────────────────────────────
  // Module 1 — Ce que l'IA fait pour l'établissement, et ce qu'on ne lui
  // confie jamais
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-1",
    objectif: {
      enonce:
        "À la fin de ce module, vous dites, pour chaque pièce de l'établissement, si elle se soumet à l'IA et sous quel compte — et vous tenez la liste rouge de ce qui ne sort jamais.",
      objectifGlobalId: "obj-1",
      // La pratique fait écrire la liste rouge de l'établissement — coordonnées
      // et séjours des clients, fiches techniques et allergènes, mentions
      // réglementées, plannings nominatifs, identifiants — et la synthèse pose
      // le dernier terme de ce même objectif : « je dis au client quand une
      // machine lui répond ».
      objectifsSecondairesIds: ["obj-2"],
      dureeMin: 5,
      notes: {
        script:
          "Tour de table en UNE phrase : « votre prénom, votre rôle dans l'établissement, et ce qui vous prend vos soirées ». Notez chaque réponse au tableau — vous y reviendrez au module 4 pour montrer ce que la journée a couvert. Annoncez la règle qui tient la journée : l'IA rédige, vous décidez, et rien de ce qui touche un client ou un allergène ne lui est confié. Annoncez le livrable : le classeur de l'établissement, dont la première pièce s'écrit dans une heure.",
        faq: [
          {
            question: "On n'a presque jamais de temps devant un écran, ça va être un problème ?",
            reponse:
              "Non, c'est prévu : la journée travaille beaucoup au téléphone et à la dictée. Deux minutes de dictée entre deux services valent une demi-page tapée le soir.",
          },
          {
            question: "On va pouvoir automatiser les réponses aux avis ?",
            reponse:
              "Les préparer très vite, oui — c'est le module 2. Les publier sans relecture, jamais : une réponse publique engage l'établissement, et c'est un humain qui appuie sur publier.",
          },
        ],
        blocages: [
          {
            situation: "Le tour de table dérive en plaintes contre les plateformes d'avis.",
            parade:
              "Couper avec : « on note, et à 11 h vous saurez répondre en cinq minutes au lieu d'y passer la soirée » — écrire la plainte au tableau et la reprendre au module 2.",
          },
        ],
        planB:
          "Aucun outil n'est nécessaire ici. Sans vidéoprojecteur, le tour de table et la règle du jour se tiennent au paperboard sans rien perdre.",
      },
    },
    demonstration: {
      avant:
        "Un avis négatif tombe un dimanche soir. Le gérant rédige à la main, à chaud : vingt minutes, un ton qui se défend au lieu d'accueillir, et une réponse qui en dit trop sur le séjour du client.",
      apres:
        "Le même avis du kit, traité par la méthode AXION : la demande est structurée en cinq lignes, la réponse sort en une minute, dans le ton de la maison, sans rien révéler — il reste à la relire et à la personnaliser.",
      prompt:
        "Acteur : tu réponds aux avis d'un hôtel-restaurant familial de montagne, ton chaleureux et sobre, sans emphase commerciale.\nConteXte : voici le texte d'un avis publié — je colle l'avis seul, sans le nom ni le profil de son auteur.\nIntention : une réponse publique prête à publier, qui remercie, répond point par point et invite à poursuivre l'échange en privé via l'accueil.\nOutput : 100 mots maximum, en français, signée « La direction ».\nNormes : ne confirme jamais que la personne a séjourné ou dîné chez nous, ne mentionne ni date, ni chambre, ni montant, n'admets aucun fait que je n'ai pas vérifié, n'annonce aucun geste commercial, ne nomme aucun membre de l'équipe.",
      outil: "Un seul outil, celui validé dans la salle (Claude ou ChatGPT selon le groupe).",
      captureEcran:
        "Les deux réponses côte à côte — la manuscrite du kit et la sortie AXION — avec les cinq lignes du prompt annotées en marge et, surlignées dans la manuscrite, les trois fuites : la date du séjour, le numéro de chambre, le geste commercial promis en public.",
      verifieLe: VERIFIE_LE,
      dureeMin: 15,
      notes: {
        script:
          "Écrivez AXION au tableau et laissez-le affiché toute la journée : Acteur, conteXte, Intention, Output, Normes. Lisez d'abord la réponse manuscrite du kit à voix haute — la salle doit reconnaître ses propres soirées. Puis lancez le prompt et lisez la sortie. Insistez sur la ligne Normes : c'est elle qui fait la différence entre une réponse rapide et une réponse sûre. Le chiffre 20 min → 5 min vient du chronométrage sur l'avis du kit, relecture comprise — donnez-le tel quel, pas comme une promesse.",
        faq: [
          {
            question: "Pourquoi coller l'avis sans le nom de son auteur ?",
            reponse:
              "Parce qu'on n'envoie dans l'outil que ce qui est nécessaire à la rédaction. Le texte suffit ; le nom, le profil et le dossier de réservation restent chez vous.",
          },
          {
            question: "Cinq lignes de prompt pour chaque avis, c'est long, non ?",
            reponse:
              "Les cinq lignes s'écrivent une fois : seul le texte de l'avis change. C'est votre trame, elle est dans le support et vous la personnaliserez à l'atelier du module 2.",
          },
        ],
        blocages: [
          {
            situation: "La sortie de l'outil est plate, la salle est déçue.",
            parade:
              "Excellente occasion : montrez la ligne Acteur, remplacez « ton chaleureux et sobre » par deux phrases qui décrivent vraiment la maison, relancez. La sortie change du tout au tout — c'est l'enseignement : le ton de la maison, c'est vous qui le donnez.",
          },
          {
            situation: "Un stagiaire veut tester tout de suite sur un avis de son établissement.",
            parade:
              "Promettre et tenir : « au module 2, vous traiterez trois avis de chez vous ». Ici on installe la méthode sur l'avis du kit, vérifié et daté.",
          },
        ],
        planB:
          "Quota atteint ou outil indisponible : les deux réponses sont imprimées dans le kit (datées). La comparaison, la lecture des cinq lignes et le repérage des trois fuites se tiennent à l'identique sur papier.",
      },
    },
    pratique: {
      consigne:
        "Atelier « où passent mes données », par table, chronométré : confrontez chaque pièce de votre quotidien aux trois régimes d'usage vus au cadre — je la soumets sur ce compte, je la soumets après l'avoir dépersonnalisée, je ne la soumets jamais. Puis écrivez la liste rouge de votre établissement : coordonnées et séjours des clients, fiches techniques et allergènes, mentions « fait maison » et origine, plannings nominatifs, identifiants de connexion — et ce que votre table y ajoute.",
      aEmporter:
        "La liste rouge de l'établissement, signée par la table, et le compte retenu pour chaque famille de pièces — première pièce du classeur.",
      dureeMin: 35,
      notes: {
        script:
          "Distribuez le jeu de pièces du kit pour amorcer : un avis, une demande de groupe, une fiche technique, un planning avec les prénoms, un mail de confirmation avec numéro de réservation. Chaque table trie, puis généralise à ses propres pièces SANS les sortir : on nomme la pièce, on ne la montre pas. Annoncez le chronomètre à voix haute toutes les dix minutes. Sur le planning, posez la distinction qui sert toute l'année : nominatif, jamais ; la trame — postes, créneaux, contraintes de service, sans aucun nom — oui, et les noms se rattachent en dehors de l'outil.",
        faq: [
          {
            question: "On peut donner notre planning à l'IA pour qu'elle nous aide à le faire ?",
            reponse:
              "Nominatif, jamais : un planning avec des noms dit qui travaille où et quand, et cela ne sort pas. La trame dépersonnalisée — postes, créneaux, contraintes — oui : l'outil propose une répartition, et vous remettez les noms chez vous.",
          },
          {
            question: "La fiche technique, c'est nous qui l'avons écrite, pourquoi liste rouge ?",
            reponse:
              "Deux raisons : c'est votre savoir-faire — recettes, grammages, coûts — et c'est le document qui fait foi pour les allergènes. Il se consulte à côté de l'outil, il n'y entre pas. Vous verrez au module 3 ce qui arrive quand on le confie à une traduction.",
          },
        ],
        blocages: [
          {
            situation:
              "Une table soutient que « tout est déjà chez Google, autant tout soumettre ».",
            parade:
              "Prendre la pièce la plus parlante du kit — le mail de confirmation — et demander : « qu'est-ce que ce message dit du client ? ». Nom, dates, chambre, tarif : rien de public là-dedans. La nuance publie/privé se voit mieux sur pièce que dans un débat.",
          },
          {
            situation:
              "Un stagiaire commence à recopier de vraies coordonnées clients sur sa liste.",
            parade:
              "Arrêter tout de suite : la liste rouge nomme des FAMILLES de pièces (« fichier clients »), jamais un client. La règle s'applique aussi au papier de la formation.",
          },
        ],
        planB:
          "L'atelier ne dépend d'aucun outil : tri des pièces du kit et rédaction de la liste rouge se font sur papier. Aucun repli nécessaire.",
      },
    },
    verification: {
      question:
        "Dix pièces réelles projetées une à une — avis client, fiche technique, planning nominatif, mail de confirmation, carte des desserts, demande de groupe, contrat fournisseur, photo de plat, identifiants du logiciel de caisse, texte du site web : chacun répond « je la soumets / je ne la soumets pas / sous quel compte », correction collective avec le corrigé du kit.",
      reponseAttendue:
        "Les dix pièces classées, et surtout la raison dite à voix haute pour chacune. Les trois qui piègent : le mail de confirmation (données client — jamais), la fiche technique (savoir-faire et allergènes — jamais), le planning (nominatif jamais, trame dépersonnalisée oui).",
      dureeMin: 15,
      notes: {
        script:
          "Faites voter à main levée AVANT de corriger chaque pièce, et comptez les voix à voix haute : le désaccord affiché est ce qui rend la correction mémorable. Ne passez pas plus d'une minute par pièce sur les évidentes, gardez le temps pour les trois pièges.",
        faq: [
          {
            question: "Le texte de notre site est public, pourquoi se poser la question ?",
            reponse:
              "Justement : il se soumet sans hésiter, et c'est ce que la question vérifie. Savoir dire oui vite est aussi utile que savoir dire non — c'est ce qui rend la règle tenable au quotidien.",
          },
        ],
        blocages: [
          {
            situation: "La salle hésite longuement sur chaque pièce et le temps file.",
            parade:
              "Passer en rythme : cinq secondes de vote, correction, pièce suivante. Les raisons se détaillent seulement sur les pièces où la salle s'est trompée.",
          },
        ],
        planB:
          "Les dix pièces et le corrigé sont imprimés dans le kit. Sans vidéoprojecteur, elles se lisent à voix haute et le vote se fait à main levée.",
      },
    },
    synthese: {
      acquis: [
        "Je choisis mon compte avant d'écrire, et je sais lequel pour quelle pièce.",
        "Je consulte la liste rouge avant de coller quoi que ce soit dans un outil.",
        "Je dis au client quand une machine lui répond.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites formuler, ne récitez pas : « qu'est-ce que vous ne collerez plus jamais dans un outil à partir de ce soir ? ». Trois réponses suffisent. Annoncez la pause, et la suite : à la reprise, on répond aux avis — les vôtres.",
        faq: [],
        blocages: [
          {
            situation: "Personne ne parle, la salle attend la pause.",
            parade:
              "Ne pas insister : énoncer les trois acquis vous-même et libérer. Un acquis arraché à contrecœur ne s'ancre pas mieux.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 2 — Avis en ligne, messages et demandes de réservation
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-2",
    objectif: {
      enonce:
        "À la fin de ce module, vous publiez une réponse d'avis prête à l'emploi, dans le ton de la maison, qui ne révèle rien du séjour — et vous traitez un message de réservation en quelques minutes.",
      objectifGlobalId: "obj-3",
      // La seconde moitié de la pratique traite deux messages de réservation —
      // demande particulière et relance après réservation non honorée — sur les
      // trames du kit, les champs [NOM] et [DATES] restant entre crochets dans
      // l'outil pour se remplir ensuite dans la messagerie.
      objectifsSecondairesIds: ["obj-4"],
      dureeMin: 5,
      notes: {
        script:
          "Reprenez la plainte du tableau si le tour de table en portait une sur les avis : c'est maintenant qu'on la traite. Annoncez la mesure du module : trois avis et deux messages traités par chacun, sur son propre établissement — et la règle qui borne tout : une réponse publique ne confirme jamais un séjour et ne révèle rien.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "L'avis négatif du kit — bruyant, factuel à moitié — reçoit la réponse spontanée qui part trop souvent : on se justifie, on confirme la date du dîner, on nomme la serveuse, on promet un dessert offert « à votre prochaine visite ». Quatre fautes en six lignes.",
      apres:
        "La même demande, bornée par les quatre interdits du cadre : la réponse remercie, répond sur les faits admis publiquement par la maison, n'admet rien d'invérifié, ne confirme rien du séjour, et déplace la suite vers l'accueil. Publiable telle quelle.",
      prompt:
        "Acteur : tu réponds aux avis de notre restaurant, ton courtois et digne, jamais défensif.\nConteXte : voici le texte d'un avis négatif publié — collé seul, sans le nom ni le profil de son auteur. Le point critiqué sur le bruit est réel ce soir-là ; le reste, je ne peux pas le vérifier.\nIntention : une réponse publique qui apaise sans s'aplatir, et invite à poursuivre en privé via l'accueil de l'établissement.\nOutput : 90 mots maximum, en français, signée « La direction ».\nNormes : quatre interdits absolus — ne confirme jamais que la personne a dîné ou séjourné chez nous ; ne révèle aucun élément de séjour (date, table, chambre, montant, régime alimentaire) ; n'admets aucun fait que je n'ai pas déclaré vérifié et ne mets en cause aucun membre de l'équipe ; n'annonce aucun geste commercial en public.",
      outil: "Un seul outil, celui validé dans la salle.",
      captureEcran:
        "Les deux réponses côte à côte, avec les quatre fautes de la version spontanée surlignées — confirmation du dîner, serveuse nommée, fait admis sans vérification, geste commercial public — et, en marge de la seconde, les quatre interdits cochés.",
      verifieLe: VERIFIE_LE,
      dureeMin: 15,
      notes: {
        script:
          "Faites chercher les fautes AVANT de les montrer : projetez la réponse spontanée et demandez « qu'est-ce qui va coûter cher ici ? ». La salle trouve la serveuse nommée, rarement la confirmation du séjour — c'est la faute invisible, celle qui trahit la discrétion due à tout client, et c'est celle sur laquelle vous insistez. Puis lancez le prompt et cochez les quatre interdits sur la sortie, un par un.",
        faq: [
          {
            question: "Le client ment dans son avis, on a le droit de le dire ?",
            reponse:
              "Publiquement, on n'accuse pas et on n'admet pas : on écrit « nous ne retrouvons pas la situation décrite » et on propose l'échange en privé. Sur le terrain du droit — diffamation, signalement à la plateforme — je ne me prononce pas : notez la question, votre conseil tranchera.",
          },
          {
            question: "Et un avis en anglais ou en allemand, on répond comment ?",
            reponse:
              "Dans la langue de l'avis : l'outil rédige la réponse dans cette langue, puis vous lui demandez la traduction française pour contrôler ce qu'elle dit avant de publier. Même trame, mêmes interdits — on le fait à l'atelier si l'un de vos avis s'y prête.",
          },
          {
            question: "On peut se faire écrire quelques bons avis pour remonter la note ?",
            reponse:
              "Non — jamais, ni pour vous ni contre un concurrent. Un avis fabriqué est une tromperie du consommateur, et c'est le deuxième interdit absolu de la journée avec les allergènes. Sur les sanctions précises, je ne me prononce pas : votre conseil vous les détaillera.",
          },
        ],
        blocages: [
          {
            situation: "La sortie « bornée » reste sèche, la salle la trouve froide.",
            parade:
              "Montrer la ligne Acteur : ajoutez-y une phrase vraie sur la maison (« auberge familiale, trois générations ») et relancez. La chaleur vient du contexte fourni, pas du relâchement des interdits.",
          },
          {
            situation:
              "Un stagiaire soutient qu'un concurrent fabrique ses avis et veut faire pareil.",
            parade:
              "Tenir la règle en une phrase — « ce que fait un autre ne rend rien permis » — et proposer la seule riposte enseignée ici : répondre vite et bien à cent pour cent de ses propres avis. C'est ce qui se voit.",
          },
        ],
        planB:
          "Les deux réponses sont imprimées dans le kit (datées), fautes déjà surlignées. La chasse aux fautes et le pointage des quatre interdits se tiennent sur papier.",
      },
    },
    pratique: {
      consigne:
        "Atelier chronométré, chacun sur son établissement : traitez trois avis réellement publiés chez vous — un positif, un négatif, un injuste — avec la trame AXION du kit, en collant le texte de l'avis seul, jamais le nom de son auteur ni votre dossier de réservation. Puis deux messages de réservation sur les trames du kit : une demande particulière et une relance après réservation non honorée — les champs [NOM] et [DATES] restent entre crochets dans l'outil et se remplissent ensuite dans votre messagerie.",
      aEmporter:
        "Cinq textes prêts à l'emploi — trois réponses d'avis et deux messages types — plus la trame AXION personnalisée au ton de votre maison. Deuxième pièce du classeur.",
      dureeMin: 50,
      notes: {
        script:
          "Faites DICTER la ligne de contexte au téléphone plutôt que la taper : c'est le geste qui survivra au retour dans l'établissement, entre deux services. Ordre imposé : le positif d'abord — il règle le ton de la maison —, le négatif ensuite, l'injuste en dernier, quand la trame est chaude. Sur l'injuste : la colère se dit à voix haute au binôme AVANT d'écrire, elle n'entre ni dans le prompt ni dans la réponse. Sur la relance de réservation non honorée : ferme, courtoise, sans menace ni pénalité improvisée — si la salle demande ce qu'on a le droit d'exiger, vous ne vous prononcez pas, la question se note.",
        faq: [
          {
            question: "Je n'ai pas d'avis négatif récent, je prends quoi ?",
            reponse:
              "Le kit en fournit trois de secours, calibrés hôtel, restaurant et café. Prenez celui qui ressemble le plus à ce que vous recevriez.",
          },
          {
            question: "Je peux répondre au client qui demande un lit bébé en donnant sa chambre ?",
            reponse:
              "Le message part de chez vous avec ces détails, bien sûr — mais ils se remplissent dans votre messagerie, pas dans l'outil. L'outil reçoit la trame et les crochets, jamais le dossier.",
          },
        ],
        blocages: [
          {
            situation:
              "Un stagiaire colle l'historique de réservation d'un client « pour personnaliser ».",
            parade:
              "Arrêter immédiatement, sans négocier : c'est la liste rouge du matin. La personnalisation se fait hors outil, au moment de remplir les crochets.",
          },
          {
            situation:
              "Le réseau sature quand quinze personnes lancent leurs prompts en même temps.",
            parade:
              "Faire partir par vagues de cinq, annoncé comme une consigne d'atelier. Pendant l'attente, on prépare la dictée du contexte suivant.",
          },
        ],
        planB:
          "Outil ou réseau indisponible : les trames s'écrivent à la main sur les supports du kit, et les avis de secours imprimés servent de matière. La structure AXION s'applique à l'identique — chacun relancera chez lui, la trame est datée et réutilisable.",
      },
    },
    verification: {
      question:
        "Contrôle croisé en binôme sur la grille fournie, pour chacun des cinq textes de l'autre : rien du séjour n'est révélé ? aucun fait non vérifié n'est admis ? aucun salarié n'est nommé ou mis en cause ? aucun geste commercial n'est annoncé en public ? le ton est celui de la maison, et le texte part-il tel quel ?",
      reponseAttendue:
        "Chaque texte revient à son auteur corrigé : les cinq cases cochées ou l'écart barré au stylo. L'écart le plus fréquent, d'après le corrigé du kit : la confirmation implicite du séjour — « lors de votre passage mardi » — qui échappe à la relecture rapide.",
      dureeMin: 20,
      notes: {
        script:
          "Faites barrer physiquement, au stylo, sur la copie de l'autre — le geste vaut le discours. Exigez de chaque binôme AU MOINS un écart remonté à l'oral. Terminez en fixant la règle d'usage : au retour dans l'établissement, toute réponse publique passe par un deuxième regard avant publication, même de trente secondes.",
        faq: [
          {
            question: "À deux dans un petit établissement, qui relit quand l'autre est en congé ?",
            reponse:
              "La grille remplace le relecteur absent : cinq questions, trente secondes, avant de publier. Elle est dans votre classeur précisément pour ça.",
          },
        ],
        blocages: [
          {
            situation: "Les binômes se valident mutuellement sans rien relever.",
            parade:
              "Projeter la réponse piégée du kit, qui contient trois écarts, et faire barrer collectivement. L'œil se règle en trois minutes, puis on reprend le croisé.",
          },
        ],
        planB: "Grille et corrigé imprimés dans le kit. Aucun outil nécessaire.",
      },
    },
    synthese: {
      acquis: [
        "Je réponds à chaque avis sans jamais confirmer le séjour ni rien révéler du client.",
        "Je fais relire toute réponse publique — par un binôme ou par la grille — avant publication.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites compter à voix haute : « combien d'avis en attente chez vous, là, maintenant ? ». Puis la question qui engage : « lesquels traitez-vous ce soir avec votre trame ? ». Annoncez le déjeuner et l'après-midi : la carte, les groupes — et l'interdit le plus important de la journée.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 3 — Carte, supports et demandes de groupes
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-3",
    objectif: {
      enonce:
        "À la fin de ce module, vous envoyez une carte traduite ou une proposition de groupe complète, dont chaque mention réglementée a été revalidée sur la fiche technique — jamais générée.",
      objectifGlobalId: "obj-5",
      // La vérification du module est la revalidation croisée fiche technique
      // en main, ligne à ligne, avec tolérance zéro sur les allergènes — un
      // seul écart et la pièce repart en correction. Le parcours « groupes »,
      // au choix du stagiaire, monte la proposition complète : devis mis en
      // forme à partir de SES prix, message d'envoi, relance à J+7, réponses
      // aux dix questions récurrentes.
      objectifsSecondairesIds: ["obj-6", "obj-7"],
      dureeMin: 5,
      notes: {
        script:
          "Annoncez la couleur avant tout : ce module contient l'interdit le plus fort de la journée. Une liste d'allergènes ne se produit pas à l'IA, ne se traduit pas, ne se reformule pas — elle se recopie depuis la fiche technique validée. Une erreur d'allergène ne fait pas perdre un client : elle peut envoyer quelqu'un à l'hôpital. Dites-le exactement comme ça, et annoncez que la démonstration va le prouver sur pièce.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "La carte se traduit un soir, d'un bloc, allergènes compris — et personne ne relit la langue qu'on ne parle pas. Dans la traduction fournie au kit, la moutarde a disparu de la sauce et le gluten a changé de ligne : deux écarts invisibles au gérant, mortels pour le client allergique qui fait confiance à la carte anglaise.",
      apres:
        "L'IA rédige le descriptif qui donne envie et sa traduction — rien d'autre. Les mentions réglementées se recopient depuis la fiche technique validée et la liste officielle des 14 allergènes du kit, puis la revalidation ligne à ligne, fiche en main, fait tomber tout écart avant impression.",
      prompt:
        "Acteur : tu écris la carte d'un restaurant de cuisine française traditionnelle, style appétissant et précis, sans emphase.\nConteXte : voici les éléments publics du plat, recopiés de la fiche technique fictive du kit — suprême de volaille, sauce crémée à la moutarde à l'ancienne, purée maison au beurre demi-sel. Je ne colle ni quantités, ni procédé, ni coûts.\nIntention : un descriptif de carte qui donne envie, puis sa traduction anglaise fidèle.\nOutput : 30 mots maximum en français, puis la version anglaise, sans emoji.\nNormes : n'écris AUCUNE mention d'allergène, aucune mention « fait maison », aucune origine de viande, aucun label ni appellation — ces mentions sont réglementées et je les recopierai moi-même depuis nos documents validés.",
      outil: "Un seul outil, celui validé dans la salle.",
      captureEcran:
        "Trois volets : la traduction naïve du kit avec ses deux écarts surlignés (moutarde disparue, gluten changé de ligne), la sortie du prompt borné — descriptif appétissant, zéro mention réglementée —, et la carte finale où la ligne allergènes est recopiée depuis la fiche technique, dans un cadre distinct.",
      verifieLe: VERIFIE_LE,
      dureeMin: 15,
      notes: {
        script:
          "La démonstration se fait sur les CAPTURES DATÉES du kit, jamais en régénérant la traduction fautive en direct — c'est la capture qui porte les deux écarts attendus. Faites chercher l'erreur AVANT de la montrer : projetez la traduction naïve et demandez « qui voit le problème ? ». Personne ou presque ne le voit — c'est exactement le point : vous non plus, en anglais, vous ne l'auriez pas vu. Puis montrez le prompt borné et posez la règle des deux couloirs : l'IA a le droit au descriptif, jamais aux mentions réglementées — deux couloirs qui ne se croisent pas.",
        faq: [
          {
            question: "Même pour traduire les noms des 14 allergènes, on n'utilise pas l'IA ?",
            reponse:
              "Non : les 14 mentions existent déjà, traduites officiellement — la liste multilingue est dans votre kit. On recopie, on ne régénère pas. Un mot approximatif sur un allergène n'est pas une faute de style, c'est un danger.",
          },
          {
            question: "Et si le plat change d'un fournisseur à l'autre ?",
            reponse:
              "C'est la fiche technique qui bouge, donc c'est elle qu'on met à jour, et la carte se recopie depuis elle. L'IA n'entre jamais dans cette chaîne : fiche validée → carte, sans intermédiaire.",
          },
        ],
        blocages: [
          {
            situation: "Un stagiaire trouve la règle excessive : « l'IA traduit très bien ».",
            parade:
              "Revenir à la capture : elle traduit très bien, ET la moutarde a disparu. C'est justement parce que la sortie est excellente partout ailleurs que l'écart est invisible. On ne confie pas à la vigilance ce qu'une règle simple élimine.",
          },
        ],
        planB:
          "Les trois volets sont imprimés dans le kit (datées), écarts déjà surlignés. La démonstration entière se tient sur papier, et c'est même sa forme la plus sûre.",
      },
    },
    pratique: {
      consigne:
        "Atelier chronométré, au choix selon votre priorité. Parcours carte : traduisez et adaptez une partie de votre carte — descriptifs à l'IA, puis mentions réglementées recopiées depuis vos fiches techniques et la liste officielle des 14 allergènes du kit, dans un bloc distinct. Parcours groupes : montez une proposition complète sur la demande fournie par le kit — devis mis en forme à partir de VOS prix (l'IA structure, elle ne chiffre rien), message d'envoi, relance à J+7, et réponses aux dix questions récurrentes des clients (liste fournie). Aucune coordonnée de client réel dans l'outil.",
      aEmporter:
        "Selon le parcours : une partie de carte traduite avec son bloc de mentions recopiées et sa checklist de revalidation, ou un dossier groupe complet — devis, message, relance, dix réponses types. Troisième pièce du classeur.",
      dureeMin: 50,
      notes: {
        script:
          "Faites choisir le parcours en trente secondes — « qu'est-ce qui vous rapporte le plus d'ici l'été ? » — et ne laissez personne faire les deux à moitié. Côté carte : imposez le geste physique, fiche technique posée À CÔTÉ du clavier, jamais dedans ; la photo d'un plat pour nourrir le descriptif, oui — la photo de la fiche technique, non. Côté groupes : les prix viennent du stagiaire et d'eux seuls ; si l'outil propose un tarif, il se barre. La demande de groupe du kit sert de client fictif de bout en bout.",
        faq: [
          {
            question: "Je peux coller l'ancienne carte anglaise pour que l'outil s'en inspire ?",
            reponse:
              "Le style, oui — collez-en deux descriptifs comme exemples de ton. Les lignes d'allergènes, non : elles ne servent jamais d'exemple, elles n'entrent pas dans l'outil, elles se recopient depuis la fiche.",
          },
          {
            question: "Pour le devis de groupe, l'outil peut calculer le total ?",
            reponse:
              "Il met en forme, et vous vérifiez chaque montant et chaque total à la calculatrice avant envoi : un devis part avec votre signature, pas la sienne. Vos prix ne viennent que de vous.",
          },
        ],
        blocages: [
          {
            situation: "Un stagiaire photographie sa fiche technique pour la déposer dans l'outil.",
            parade:
              "Arrêter avant l'envoi : liste rouge du matin — savoir-faire et allergènes. Les éléments publics du plat se recopient à la main dans le prompt, la fiche reste sur la table.",
          },
          {
            situation: "Un participant n'a ni carte sur lui ni demande de groupe en cours.",
            parade:
              "Le kit fournit une carte de secours et sa fiche technique fictive, et la demande de groupe sert à tous. Personne ne regarde son voisin travailler pendant cinquante minutes.",
          },
        ],
        planB:
          "Outil indisponible : le parcours carte se fait sur la carte de secours et les sorties imprimées du kit — la revalidation, cœur du module, est de toute façon un exercice papier, fiche en main. Le parcours groupes s'écrit sur les trames papier du kit ; chacun relancera la mise en forme chez lui.",
      },
    },
    verification: {
      question:
        "Revalidation croisée, fiche technique en main, checklist du kit ligne à ligne sur la production de l'autre : chaque allergène de la fiche est-il sur la carte, au bon plat, dans la bonne langue ? l'origine des viandes est-elle exacte ? chaque « fait maison » est-il défendable ? chaque appellation ou label est-il réellement détenu ? et sur le dossier groupe : chaque montant vient-il du stagiaire, chaque engagement est-il tenable ?",
      reponseAttendue:
        "Chaque production passée ligne à ligne, écarts relevés et corrigés en salle. Tolérance zéro sur la ligne allergènes : un seul écart et la pièce repart en correction — c'est la règle qui s'appliquera à l'établissement, on l'applique ici.",
      dureeMin: 25,
      notes: {
        script:
          "C'est la vérification la plus longue de la journée, et c'est voulu : le geste qu'on installe est précisément celui-là — relire fiche en main AVANT d'imprimer ou d'envoyer. Binômes croisés entre parcours quand c'est possible : un œil neuf voit mieux. Répétez la phrase de clôture en la faisant écrire sur la checklist : « l'IA rédige, la fiche technique fait foi, rien de réglementé ne part sans double lecture ».",
        faq: [
          {
            question: "Chez nous, qui doit faire cette double lecture ?",
            reponse:
              "Celui qui connaît les fiches : la cuisine valide, la salle ou la direction imprime. On le formalisera au module 4, avec un nom dans la fiche d'identité.",
          },
        ],
        blocages: [
          {
            situation:
              "Un binôme survole la checklist parce que « c'est la carte du kit, pas la vraie ».",
            parade:
              "Rappeler l'enjeu en une phrase — on s'entraîne exactement comme on relira la vraie — et exiger la lecture À VOIX HAUTE de la ligne allergènes : plat par plat, fiche en main. Le rythme lent est le bon rythme.",
          },
        ],
        planB: "Checklist, fiches et corrigé imprimés dans le kit. Aucun outil nécessaire.",
      },
    },
    synthese: {
      acquis: [
        "Je ne diffuse aucune mention réglementée sans l'avoir relue sur la fiche technique.",
        "Je fais valider la carte par la cuisine avant impression, et c'est écrit qui valide.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites répéter l'interdit une dernière fois, par la salle et non par vous : « qu'est-ce qui ne se génère jamais ? ». Puis annoncez la pause et le dernier module : « on va regarder l'IA mentir sur VOTRE établissement — et vous repartez avec le classeur complet ».",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 4 — Fiabiliser, évaluer, installer
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-4",
    objectif: {
      enonce:
        "À la fin de ce module, vous repérez vous-même ce que l'IA vient d'inventer sur votre établissement, et vous repartez avec la fiche d'identité et la feuille de route utilisables dès demain.",
      objectifGlobalId: "obj-8",
      // L'évaluation des acquis qui referme la journée porte explicitement sur
      // les régimes d'usage et la liste rouge, sur les quatre interdits de la
      // réponse publique et sur l'interdit allergènes : ces objectifs y sont
      // servis une dernière fois, à la correction commentée.
      objectifsSecondairesIds: ["obj-1", "obj-2", "obj-3", "obj-5"],
      dureeMin: 5,
      notes: {
        script:
          "Reprenez le tableau du matin — ce qui prend les soirées de chacun — et montrez ce que la journée a couvert et ce qu'elle n'a pas couvert : le planning lui-même, la caisse, la comptabilité restent à vos logiciels et à vous. Cette honnêteté achète la crédibilité du reste. Puis annoncez le dernier ressort : jusqu'ici l'IA travaillait sur VOS textes ; on va voir ce qu'elle écrit quand on la laisse remplir les trous.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "On demande une présentation d'établissement sans rien fournir, et la sortie est superbe : fluide, chaleureuse, exactement le ton attendu. Dans celle du kit, cinq énoncés sont faux — capacité, horaires, label, prix, et une prestation qui n'existe pas — et rien, à la lecture, ne les distingue du vrai.",
      apres:
        "Trois vérifications font tomber les cinq erreurs en quelques minutes : chaque chiffre se pointe vers un document de l'établissement, chaque label vers son justificatif, chaque prestation vers la réalité du terrain. Ce qui n'a pas de source se barre — et ce qui reste devient la fiche d'identité.",
      prompt:
        "Rédige, en 150 mots, la présentation de l'hôtel-restaurant fictif « Le Balcon des Aravis » à La Clusaz pour la page d'accueil de son site : les chambres, le restaurant, les services proposés et une idée des prix. Ton chaleureux, sans superlatif.",
      outil: "Un seul outil, celui validé dans la salle.",
      captureEcran:
        "La présentation du kit projetée en grand, les cinq erreurs plantées entourées en rouge une à une — capacité, horaires, label, prix, prestation inexistante — avec, en marge, la vérification qui fait tomber chacune.",
      verifieLe: VERIFIE_LE,
      dureeMin: 10,
      notes: {
        script:
          "Lisez d'abord la présentation à voix haute, avec conviction : la salle doit la trouver bonne — c'est le piège qui enseigne. Puis faites chercher : « cinq énoncés sont faux, trouvez-les ». On en trouve deux ou trois, rarement les cinq ; le label et la prestation inventée passent presque toujours. Le prompt ne fournit RIEN, et c'est voulu : l'outil comble les trous, plausiblement. La parade n'est pas « méfiez-vous », c'est « fournissez les faits » — et c'est l'atelier qui suit.",
        faq: [
          {
            question: "Si on lui donne les bons chiffres, elle n'inventera plus ?",
            reponse:
              "Elle inventera beaucoup moins — et c'est le piège résiduel : elle complète encore ce qui manque, plausiblement. La relecture avec les trois vérifications reste obligatoire, quelle que soit la qualité de ce que vous fournissez.",
          },
        ],
        blocages: [
          {
            situation:
              "Relancée en direct, la présentation sort presque juste, la démonstration s'affaiblit.",
            parade:
              "Revenir à la capture datée du kit, qui porte les cinq erreurs attendues — et le dire : « celle-ci a raison par hasard ; vous n'auriez eu aucun moyen de le savoir sans vérifier ». L'enseignement tient tout autant.",
          },
        ],
        planB:
          "La présentation et son corrigé sont imprimés dans le kit (datés), erreurs entourées. La chasse collective se tient sur papier à l'identique.",
      },
    },
    pratique: {
      consigne:
        "Chasse à l'erreur chronométrée, chacun sur SON établissement : faites produire une présentation de votre maison — nom et ville seulement dans le prompt, rien d'autre —, surlignez tout ce qui est faux ou invérifiable, comptez vos trouvailles, puis écrivez les faits exacts dans votre fiche d'identité sur la trame du kit : capacité réelle, horaires par saison, labels réellement détenus, gammes de prix, prestations effectives, coordonnées publiques.",
      aEmporter:
        "La fiche d'identité IA de l'établissement : les faits vérifiés que vous fournirez désormais à chaque production — et qui serviront de source à vos écrits courants. Dernière pièce du classeur.",
      dureeMin: 30,
      notes: {
        script:
          "Le prompt tient en une ligne : « présente [nom de l'établissement] à [ville] pour notre site » — rien de plus, c'est le protocole de l'exercice. Comptez les erreurs trouvées à main levée et affichez les scores au tableau AVANT d'écrire les faits exacts : le chiffre collectif vaut mieux qu'un discours sur la vigilance. Le téléphone suffit pour tout l'exercice, dites-le. La fiche d'identité ne contient que des faits d'établissement, publics et vérifiés — jamais un client, jamais un salarié nommé, jamais un prix d'achat.",
        faq: [
          {
            question: "L'IA n'a rien trouvé sur mon établissement et refuse de le présenter.",
            reponse:
              "C'est la réponse honnête — et rare. Fournissez-lui alors trois faits de votre fiche naissante et regardez-la broder autour : l'exercice devient « qu'a-t-elle ajouté que je n'ai pas dit ? ». Même geste, même leçon.",
          },
          {
            question: "Elle décrit l'ancien propriétaire et les anciens horaires, c'est normal ?",
            reponse:
              "Très fréquent : elle mélange des traces anciennes du web. C'est exactement pour ça que la fiche d'identité existe — vos faits à jour, fournis par vous, à chaque demande.",
          },
        ],
        blocages: [
          {
            situation:
              "Un participant ne trouve aucune erreur et conclut que « ça marche très bien ».",
            parade:
              "Vérifier avec lui, document en main, les trois énoncés les plus précis de sa sortie — un chiffre, un horaire, une prestation. Il en tombe presque toujours un. Sinon, dire la vérité : « juste aujourd'hui, invérifié demain » — c'est le corrigé du kit qui fait foi sur le mécanisme.",
          },
        ],
        planB:
          "Sans outil : chacun remplit directement sa fiche d'identité sur la trame papier, et la chasse à l'erreur se fait collectivement sur la présentation imprimée du kit. L'essentiel — les faits exacts écrits et sourcés — ne dépend d'aucun outil.",
      },
    },
    verification: {
      question:
        "Quiz individuel de validation des acquis, dix questions couvrant la journée — régimes d'usage et liste rouge, les quatre interdits de la réponse publique, l'interdit allergènes, les trois vérifications anti-invention — puis correction commentée question par question, chaque réponse renvoyant à la séquence qui traitait le point.",
      reponseAttendue:
        "Le quiz corrigé en salle sans sauter de question. Le seuil de réussite est celui déclaré au programme ; un score en dessous déclenche la reprise individuelle prévue au dispositif. Les deux questions les plus discriminantes du corrigé : « que fait-on d'une ligne d'allergènes ? » (on la recopie, jamais on ne la génère) et « que répond-on à un avis dont l'auteur dit avoir dîné chez vous ? » (on ne le confirme jamais).",
      dureeMin: 25,
      notes: {
        script:
          "C'est l'évaluation des acquis au sens de l'indicateur 11 : elle se tient, se corrige et se conserve. Si le temps manque, coupez ailleurs — jamais ici. À la correction, faites dire par la salle à quelle séquence chaque question renvoie : c'est la révision de la journée qui s'opère, pas un contrôle de plus.",
        faq: [
          {
            question: "Le résultat sera transmis à mon employeur ?",
            reponse:
              "Le résultat individuel, non. Ce qui est transmis, c'est l'attestation de fin de formation et le fait que l'évaluation a eu lieu.",
          },
        ],
        blocages: [
          {
            situation: "Il est 17 h et le quiz n'est pas commencé.",
            parade:
              "Le tenir quand même, en réduisant le commentaire du corrigé aux questions les plus ratées. On ne remplace jamais l'évaluation par un tour de table.",
          },
        ],
        planB: "Quiz papier et corrigé imprimés dans le kit. Aucune dépendance à un outil.",
      },
    },
    synthese: {
      acquis: [
        "J'assemble le classeur — liste rouge, trames d'avis et de messages, checklist carte, fiche d'identité — et je sais qui le tient à jour.",
        "Je nomme qui répond aux avis et sous quel délai, et qui valide les mentions réglementées avant toute diffusion.",
        "J'installe trois usages datés dès la semaine suivante, chacun avec un nom.",
      ],
      dureeMin: 10,
      notes: {
        script:
          "Chacun annonce à voix haute ses trois usages de la semaine suivante, avec un NOM et une DATE — « je vais essayer l'IA » ne compte pas. Faites nommer aussi les deux rôles : qui répond aux avis et sous quel délai, qui valide les mentions réglementées. Notez tout au tableau, photographiez, envoyez la photo au groupe : la feuille de route existe à partir du moment où elle est partagée.",
        faq: [],
        blocages: [
          {
            situation: "Les engagements restent vagues : « on va s'y mettre doucement ».",
            parade:
              "Reformuler en une question : « quel avis, quel jour, qui relit ? ». Ne pas passer au suivant tant que la réponse ne porte pas un nom et une date.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },
];
