/**
 * CONTENU RÉDIGÉ — « IA pour l'industrie » (2 jours, 14 h, 8 modules).
 *
 * ## Le fil rouge
 *
 * Les deux jours travaillent le SYSTÈME DOCUMENTAIRE du site, et rien d'autre :
 * modes opératoires, comptes rendus de poste, fiches qualité, écrits de
 * maintenance, documentation technique. Chacun repart avec sept pièces, écrites
 * dans l'ordre : la liste rouge du site (module 1), des fiches de non-conformité
 * (module 2), un écrit maîtrisé mis à jour avec sa fiche d'évolution (module 3),
 * un questionnaire client tracé (module 4), la revue d'écart et son plan
 * d'action (module 5), trois dispositifs de suivi qualifiés (module 6), et la
 * procédure d'usage de l'IA du site (module 7) — que le module 8 trie et
 * transforme en feuille de route.
 *
 * L'ordre est l'enseignement : aucun module ne se suffit à lui-même, et le
 * module 7 ne fait que rassembler ce que les six premiers ont produit.
 *
 * ## Trois règles que le formateur ne négocie pas
 *
 * **L'IA ne produit JAMAIS un mode opératoire de sécurité, une consigne de
 * sécurité machine, une fiche de données de sécurité ni un paramètre de
 * process.** Ces textes viennent des documents validés et se RECOPIENT. C'est
 * l'interdit le plus fort des deux jours, et il s'enseigne comme tel : une
 * erreur ici ne coûte pas un audit, elle blesse quelqu'un. La règle est posée
 * au module 3 AVANT que quiconque ouvre un document, elle est reprise au
 * module 7 dans la procédure d'usage, et elle est évaluée au quiz du module 8.
 *
 * **Le secret industriel ne sort pas.** Plans et nomenclatures, paramètres et
 * gammes de fabrication, formulations, prix de revient, cahiers des charges et
 * incidents qualité couverts par un accord client : la « liste rouge du site »
 * que les stagiaires écrivent au module 1 est un livrable, pas un exposé. Elle
 * est reprise littéralement au module 7 et sert d'arbitre à chaque atelier
 * intermédiaire — un participant qui veut déposer une pièce interdite est
 * renvoyé à SA propre feuille, pas au discours du formateur.
 *
 * **Le formateur n'arbitre aucune question de sécurité ni de conformité.** La
 * formule est écrite, elle se prononce telle quelle : « je ne me prononce pas,
 * notez la question, votre référent QSE tranchera ». Les livrables remis
 * portent un en-tête « Projet — à valider avant diffusion » qui ne se retire
 * pas.
 *
 * ## Le passage de relais entre les deux jours
 *
 * La synthèse du module 4 ferme le jour 1 par un geste concret : créer un
 * dossier NOMMÉ, y ranger les quatre livrables, cocher la liste à voix haute.
 * Sans cet état stable, le jour 2 redémarre à froid — les scripts des modules 4
 * et 5 le disent explicitement au formateur.
 *
 * ## Public
 *
 * Atelier et bureau des méthodes mêlés, niveaux très inégaux devant un écran.
 * Les gestes de DICTÉE et de PHOTO de document sont enseignés au module 2 et
 * ils ne sont pas accessoires : ce sont eux qui rendent la formation praticable
 * par ceux qui n'écrivent pas vite. Les scripts d'atelier imposent des binômes
 * atelier / méthodes appariés délibérément.
 */

import type { EnrichissementFormation } from "./types";

/** Date de dernière vérification des captures et sorties d'outils. */
const VERIFIE_LE = "2026-08-06";

export const IA_POUR_L_INDUSTRIE: EnrichissementFormation = [
  // ───────────────────────────────────────────────────────────────────────────
  // Module 1 — Le système documentaire du site face à l'IA (Matin J1)
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-1",
    objectif: {
      enonce:
        "À la fin de ce module, vous prenez n'importe quelle pièce du système documentaire du site — mode opératoire, plan, compte rendu de poste, cahier des charges client — et vous dites dans quel régime d'usage elle peut aller, ou qu'elle ne sort pas, en justifiant votre réponse devant un auditeur.",
      objectifGlobalId: "obj-1",
      // La séquence de pratique produit en outre la liste rouge du site, avec sa
      // case « à trancher par le QSE » pour les cas litigieux : le module sert
      // donc aussi, en second, l'objectif de tenue de cette liste.
      objectifsSecondairesIds: ["obj-2"],
      dureeMin: 5,
      notes: {
        script:
          "Deux publics dans la salle, et c'est un sujet avant même l'IA : l'atelier et le bureau des méthodes ne manipulent pas les mêmes documents et n'ont pas les mêmes réflexes. Tour de table en UNE phrase : « votre prénom, votre poste, et le document que vous écrivez le plus souvent ». Notez chaque document au tableau — c'est la matière première des deux jours et vous y reviendrez au module 8. Annoncez le livrable du module : la liste rouge du site, écrite par eux, reprise telle quelle demain après-midi dans la procédure d'usage.",
        faq: [
          {
            question: "On n'a pas le droit d'utiliser l'IA chez nous, la DSI a tout bloqué.",
            reponse:
              "Un blocage n'est pas une interdiction, c'est un choix de régime — le troisième, l'environnement validé. Notez le nom de l'outil autorisé chez vous, on travaillera avec celui-là.",
          },
          {
            question: "Nos documents sont couverts par un accord de confidentialité client.",
            reponse:
              "Alors ils ne se déposent pas. C'est exactement ce que votre liste rouge va écrire noir sur blanc dans une heure, et c'est ce que vous montrerez à votre donneur d'ordre s'il pose la question.",
          },
        ],
        blocages: [
          {
            situation: "Le tour de table dérive sur les défauts de la GED du site.",
            parade:
              "Écrire la plainte au tableau et couper : « on y revient au module 7, quand on écrira la procédure d'usage ». La reprendre plus tard fait plus pour la crédibilité que la traiter tout de suite.",
          },
          {
            situation:
              "Un participant d'atelier dit qu'il n'écrit rien et que la formation n'est pas pour lui.",
            parade:
              "Lui demander qui remplit le cahier de poste et les bons d'intervention. Il écrit, simplement personne ne le lui a jamais dit. Notez ses documents au tableau comme les autres.",
          },
        ],
        planB:
          "Aucun outil n'est nécessaire ici : tour de table, tableau, feutre. Si le vidéoprojecteur est mort, le module 1 ne perd rien — il se tient entièrement à l'oral et au paperboard.",
      },
    },
    demonstration: {
      avant:
        "On prend un rapport d'incident qualité dont on a retiré le nom de l'opérateur et celui du client, et on le considère comme anonyme : « il n'y a plus de nom, on peut le déposer ». C'est le raisonnement le plus répandu sur un site, et c'est celui qui fait sortir les dossiers.",
      apres:
        "On repose le même rapport à la salle et on laisse trois questions le ré-identifier : quelle équipe, quel poste de la ligne, quel jour d'arrêt. Le nom revient en trente secondes, dit par la salle elle-même — et le document redevient ce qu'il n'avait jamais cessé d'être.",
      prompt:
        "À partir du SEUL rapport ci-joint, dont les noms ont été retirés, liste tout ce qui permettrait à une personne du site de savoir de qui et de quelle affaire il s'agit : dates, horaires de poste, numéro de ligne ou de machine, référence produit, numéro de lot, numéro de commande, tournure de phrase propre à un service. Pour chaque élément, indique la question qu'il suffirait de poser pour lever l'anonymat. N'invente aucun élément absent du document.",
      outil: "Un seul outil, celui autorisé sur le site (Claude ou ChatGPT selon le groupe).",
      captureEcran:
        "La liste des identifiants indirects rendue par l'outil, avec les trois qui ont suffi à la salle entourés en rouge.",
      verifieLe: VERIFIE_LE,
      dureeMin: 15,
      notes: {
        script:
          "Ne faites pas la démonstration à la place de la salle : distribuez le rapport pseudonymisé du kit, laissez-les lire une minute, puis demandez « qui c'est ? ». Sur un site, quelqu'un trouve toujours. C'est ce moment-là qui installe la règle, pas votre commentaire. Passez l'outil ensuite, pour montrer qu'une machine liste les mêmes indices en dix secondes — et que n'importe qui peut le faire depuis le document déposé.",
        faq: [
          {
            question: "Et si on remplace le numéro de ligne par une lettre ?",
            reponse:
              "Vous avez pseudonymisé une deuxième fois. Testez : la salle retrouvera quand même, parce que la date et la référence produit suffisent. L'anonymisation réelle détruit de l'information, elle ne la déguise pas.",
          },
          {
            question: "Donc on ne peut rien déposer ?",
            reponse:
              "Si, mais dans le bon régime — pas en retirant des noms. C'est la différence que votre liste rouge va poser dans un quart d'heure.",
          },
        ],
        blocages: [
          {
            situation: "Personne ne reconnaît le cas, la salle vient de plusieurs sites.",
            parade:
              "Le faire sur un cas de LEUR site, à l'oral, sans rien déposer : « décrivez-moi un incident de la semaine dernière sans dire de nom ». Trois phrases plus tard, leurs collègues ont identifié la ligne.",
          },
          {
            situation: "L'outil rend une liste pauvre, deux items.",
            parade:
              "Relancer avec « continue, il en manque au moins six » — la relance exhaustive est dans le kit. Si ça ne donne rien, passer au plan B : la version papier est plus nette.",
          },
        ],
        planB:
          "Le rapport pseudonymisé et la liste des identifiants indirects sont imprimés dans le kit, datés. Sans réseau, l'exercice se tient mieux qu'avec : on distribue le rapport, la salle ré-identifie à voix haute, et on compare à la liste imprimée.",
      },
    },
    pratique: {
      consigne:
        "En table, chronométré, deux temps. D'abord, écrivez la liste rouge de VOTRE site sur la trame fournie : ce qui ne sort jamais, quel que soit l'outil — plans et nomenclatures, paramètres et gammes de fabrication, formulations, prix de revient, cahiers des charges et incidents qualité couverts par un accord client, données nominatives d'opérateurs. Ensuite, classez les quinze pièces du jeu fourni en trois colonnes : dépôt libre, environnement entreprise avec engagement de non-réutilisation, ne sort pas. Pour chaque pièce mise en colonne 3, écrivez en une ligne ce qui la retient.",
      aEmporter:
        "La liste rouge du site, datée et signée de la table — elle est reprise littéralement au module 7 dans la procédure d'usage — et les quinze pièces classées avec leur motif.",
      dureeMin: 35,
      notes: {
        script:
          "Annoncez en lançant l'atelier que la liste rouge est un livrable des deux jours et qu'elle sera recopiée demain après-midi : ça change la façon de l'écrire. Faites travailler au feutre sur la trame A3, pas sur un ordinateur — une table entière voit la même feuille, l'atelier et les méthodes discutent, et c'est là que le désaccord utile sort. Passez de table en table avec une seule question quand ça bloque : « ce document, vous l'enverriez par mail à un fournisseur ? ». Si non, il est en colonne 3.",
        faq: [
          {
            question: "Le mode opératoire d'une machine, il va où ?",
            reponse:
              "Colonne 3, pour deux raisons : il porte souvent des paramètres de fabrication, et surtout on ne le fait jamais réécrire. On y revient au module 3, c'est l'interdit le plus fort des deux jours.",
          },
          {
            question: "Un plan client sans son cartouche, ça passe ?",
            reponse:
              "Non. Le plan reste la propriété du client et l'accord de confidentialité couvre le contenu, pas le cartouche. Le retirer ne change rien à l'engagement signé.",
          },
        ],
        blocages: [
          {
            situation: "Une table classe tout en colonne 3 « pour être tranquille ».",
            parade:
              "Leur demander de citer une seule pièce qu'ils accepteraient de déposer. S'ils n'en trouvent aucune, leur donner le compte rendu de réunion de production du jeu fourni : personne ne le classe en rouge, et la discussion redémarre.",
          },
          {
            situation: "Deux participants du même site ne sont pas d'accord sur une pièce.",
            parade:
              "Ne tranchez pas. Écrivez la pièce dans la case « à trancher par le QSE » de la trame. Une liste rouge qui porte trois questions ouvertes est plus honnête qu'une liste lisse.",
          },
        ],
        planB:
          "L'atelier ne demande aucun outil : trame A3, quinze pièces imprimées du kit, un feutre. C'est l'atelier le plus robuste du jour 1 — gardez-le entier même si tout le réseau est tombé.",
      },
    },
    verification: {
      question:
        "Dix pièces du système documentaire d'un site sont présentées une par une. Pour chacune, chacun répond SEUL et par écrit : je la dépose en régime libre, en environnement entreprise, ou elle ne sort pas — et en trois mots, pourquoi. Correction collective ensuite, pièce par pièce, avec comptage des écarts.",
      reponseAttendue:
        "Le corrigé donne pour chaque pièce le régime attendu et le motif en une ligne. Sont attendues en « ne sort pas » : le plan client, la gamme de fabrication portant des paramètres, la fiche de données de sécurité, le relevé de rebuts nominatif et le cahier des charges sous accord. Tout écart portant sur une pièce de la liste rouge se reprend immédiatement en salle, pas à la pause.",
      dureeMin: 20,
      notes: {
        script:
          "Chacun répond SEUL et par écrit avant toute correction : à main levée, la salle s'aligne sur le premier qui parle et vous ne voyez rien. Comptez les écarts à voix haute et écrivez le total au tableau — c'est ce chiffre qui fait passer le message, pas votre insistance. Reprenez en priorité les écarts qui portent sur la liste rouge, ce sont les seuls qui coûtent cher.",
        faq: [
          {
            question: "On note ? C'est l'examen ?",
            reponse:
              "Non. L'évaluation des acquis se tient demain après-midi, dix questions. Ceci sert à repérer ce qui coince pendant qu'on peut encore le corriger.",
          },
        ],
        blocages: [
          {
            situation: "Un participant conteste le corrigé sur une pièce précise de son site.",
            parade:
              "Ne pas discuter de son cas : « je ne me prononce pas, notez la question, votre référent QSE tranchera ». Écrire la question au tableau, elle partira dans la feuille de route de demain.",
          },
        ],
        planB:
          "Les dix pièces et leur corrigé sont imprimés dans le kit. Sans vidéoprojecteur, on les distribue une par une et la correction se fait à l'oral, à l'identique.",
      },
    },
    synthese: {
      acquis: [
        "Je dis, devant n'importe quelle pièce du site, dans quel régime elle peut aller ou qu'elle ne sort pas.",
        "Je ne considère jamais un document comme anonyme parce qu'on en a retiré les noms.",
        "J'écris la liste rouge de mon site et je fais trancher les cas douteux par le référent QSE.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites-les FORMULER, ne récitez pas : « en une phrase, qu'est-ce que vous ne déposerez plus à partir de lundi ? ». Trois réponses suffisent. Faites ensuite ranger la liste rouge dans la pochette de formation, pas dans un sac — elle ressert quatre fois d'ici demain soir. Annoncez la suite : les non-conformités, et on ne reparlera plus de régime, ce sera acquis.",
        faq: [],
        blocages: [
          {
            situation: "C'est l'heure de la pause et personne ne parle.",
            parade:
              "Ne pas insister : énoncer les trois acquis vous-même, faire ranger la liste rouge, libérer. Un acquis récité de mauvaise grâce ne s'ancre pas mieux.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 2 — Non-conformités et réclamations clients (Matin J1)
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-2",
    objectif: {
      enonce:
        "À la fin de ce module, vous transformez des notes brutes — page de cahier de poste photographiée, deux minutes dictées, mail de client — en fiche de non-conformité complète et en projet de réponse client, sans qu'aucune cause n'ait été inventée.",
      objectifGlobalId: "obj-3",
      dureeMin: 5,
      notes: {
        script:
          "Dites pourquoi on commence par là : la fiche de non-conformité est l'écrit le plus fréquent du site, le plus mal rédigé, et celui qui ressort en audit. C'est le meilleur rapport gain/risque des deux jours, dites-le tel quel. Rappelez en une phrase que les pièces de l'atelier ont été préparées selon la liste rouge écrite il y a une heure : la règle du module 1 s'applique à partir de maintenant sans qu'on la redise.",
        faq: [
          {
            question: "On va gagner du temps sur les fiches ou juste les faire autrement ?",
            reponse:
              "Les deux, mais dans cet ordre : d'abord les faire correctement, ensuite plus vite. Une fiche produite en cinq minutes qui invente une cause vous coûtera une journée en audit.",
          },
        ],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "Le fait tient en trois lignes dans le cahier de poste : « pièces marquées au démoulage, lot du matin, opérateur a arrêté la ligne ». Personne ne peut en faire une fiche opposable, et six mois plus tard, devant un auditeur, personne ne sait plus ce qui s'est passé ni ce qui a été décidé.",
      apres:
        "Les mêmes trois lignes, plus le compte rendu du poste et la photo de la page, deviennent une fiche structurée : fait daté et chiffré, hypothèses de cause listées SÉPARÉMENT du fait, questions à poser au producteur du défaut, action corrective vérifiable avec sa preuve attendue — et un projet de réponse client qui ne promet rien qui ne soit dans la fiche.",
      prompt:
        "Acteur : tu assistes le responsable qualité d'un site de production mécanique.\nConteXte : je te fournis trois pièces et rien d'autre — la photo de la page du cahier de poste du 12/05, le compte rendu du poste du matin, et le mail de réclamation du client.\nIntention : préparer une fiche de non-conformité exploitable et un projet de réponse au client.\nOutput : deux parties. Partie 1, la fiche — fait constaté (date, poste, référence, lot, quantité concernée), hypothèses de cause NUMÉROTÉES et présentées comme des hypothèses, questions à poser au producteur du défaut, action corrective proposée avec la preuve qui permettra de la vérifier. Partie 2, un projet de réponse client de 150 mots maximum.\nNormes : n'écris aucune cause comme si elle était établie — ce qui n'est pas dans les pièces est une hypothèse ou une question. Ne reprends aucun chiffre absent des pièces ; s'il manque, écris « à relever ». N'engage aucun délai, aucune indemnisation, aucune action sur d'autres lots : je les décide moi-même.",
      outil: "Un seul outil, celui autorisé sur le site.",
      captureEcran:
        "Les deux sorties côte à côte, avec surlignage des deux endroits où la version spontanée présente une hypothèse comme une cause établie, et la même zone corrigée dans la version structurée.",
      verifieLe: VERIFIE_LE,
      dureeMin: 15,
      notes: {
        script:
          "Écrivez AXION au tableau — Acteur, conteXte, Intention, Output, Normes — et laissez-le affiché les deux jours. Lancez D'ABORD la version spontanée (« fais-moi une fiche de non-conformité avec ça ») et laissez la salle trouver le résultat « pas mal ». C'est le piège : la sortie spontanée écrit une cause. Faites-la lire à voix haute, puis demandez « qui a dit que c'était ça, la cause ? ». Passez ensuite la version structurée : c'est la ligne Normes qui fait tout le travail, insistez-y.",
        faq: [
          {
            question: "L'IA peut-elle trouver la cause à notre place ?",
            reponse:
              "Non, et le prompt le lui interdit. Elle formule des hypothèses et les questions à poser ; la cause se tranche à l'atelier, avec ceux qui étaient au poste. Une cause écrite dans une fiche engage le site.",
          },
          {
            question: "On peut lui donner la photo du cahier telle quelle, sans la retaper ?",
            reponse:
              "Oui, et c'est le geste à prendre : photographiez page par page, bien à plat. Si la lecture est mauvaise, cadrez une colonne à la fois.",
          },
        ],
        blocages: [
          {
            situation:
              "La sortie spontanée est prudente et n'invente aucune cause, la démonstration tombe à plat.",
            parade:
              "Relancer avec « en une phrase, quelle est la cause la plus probable ? ». La contrainte de brièveté force l'affirmation et le défaut ressort. Sinon, plan B : la sortie du kit est datée et contient les deux inventions.",
          },
          {
            situation: "Un participant veut déposer la vraie réclamation d'un vrai client.",
            parade:
              "Refuser. Les incidents qualité clients sont en colonne 3 de leur PROPRE liste rouge, écrite il y a une heure : renvoyez-les à leur feuille plutôt que d'argumenter.",
          },
        ],
        planB:
          "Les deux sorties, spontanée et structurée, sont imprimées dans le kit avec leur date de vérification, les deux inventions déjà entourées. Sans réseau, on distribue les deux pages et on compare à voix haute : la démonstration perd le direct, pas l'enseignement.",
      },
    },
    pratique: {
      consigne:
        "Chronométré, chacun sur son poste, deux productions. Prenez une non-conformité interne et une réclamation client parmi les pièces préparées et fournies. Faites entrer les notes brutes par l'un des trois gestes, au choix : photographier la page du cahier de poste, dicter deux minutes ce que vous avez compris de l'incident, ou déposer le compte rendu de poste en PDF. Produisez ensuite, pour chacune : la fiche renseignée avec ses hypothèses numérotées, la liste des questions à poser au producteur du défaut, et le projet de réponse client. Les quantités, lots et références se recopient depuis le compte rendu de poste, jamais de mémoire.",
      aEmporter:
        "Deux fiches de non-conformité renseignées, leurs listes de questions, deux projets de réponse client, et la fiche mémo des cinq leviers AXION — deuxième pièce du dossier du site.",
      dureeMin: 50,
      notes: {
        script:
          "Annoncez les trois causes d'échec AVANT que quiconque échoue : photo prise de travers et illisible, dictée où l'on parle en même temps que le voisin, PDF scanné sans texte reconnu. La parade de chacune est sur le support ; prévenu, un stagiaire vous appelle, surpris il se referme pour la journée. La salle mêle l'atelier et le bureau des méthodes : appariez-les DÉLIBÉRÉMENT, un de chaque par binôme d'entraide. Celui qui connaît le poste dicte, celui qui connaît l'écran manipule, puis on inverse — sinon l'atelier regarde les méthodes travailler pendant cinquante minutes. Vous ne rédigez à la place de personne.",
        faq: [
          {
            question: "Ma photo du cahier ressort illisible.",
            reponse:
              "Cadrez une colonne à la fois plutôt que la double page, à plat et sans ombre, puis redemandez « retranscris ce tableau ligne par ligne, écris illisible quand tu n'es pas sûr ». C'est la parade n° 2 du support.",
          },
          {
            question: "Je préfère dicter, je n'écris pas vite.",
            reponse:
              "Dictez : c'est prévu et c'est le geste le plus rentable en atelier. Parlez comme si vous expliquiez à un collègue qui arrive, et donnez les chiffres deux fois.",
          },
        ],
        blocages: [
          {
            situation: "Un participant reste bloqué sur la mise en forme et ne produit rien.",
            parade:
              "Le ramener à la ligne Output du prompt : la forme se décide là, une fois. S'il n'y arrive pas, lui donner le prompt complet du support à recopier et à remplir ligne par ligne.",
          },
          {
            situation: "Le réseau de la salle sature quand tout le monde dépose en même temps.",
            parade:
              "Faire démarrer par vagues de cinq, annoncé comme une consigne d'atelier et non comme un incident.",
          },
        ],
        planB:
          "Réseau tombé : l'atelier se tient sur la trame papier de la fiche, et les cinq leviers AXION s'appliquent à l'identique — c'est la structure de la demande qui s'apprend, pas le clic. Les gestes photo et dictée se répètent hors ligne sur le téléphone, la retranscription attendra le retour au poste. La trame est datée et réutilisable.",
      },
    },
    verification: {
      question:
        "Contrôle croisé en binôme sur la grille fournie, sur les fiches de l'autre : le fait est-il séparé de l'hypothèse, phrase par phrase ? l'action corrective est-elle vérifiable et datée, avec sa preuve attendue ? une cause a-t-elle été écrite comme établie ? chaque chiffre — quantité, lot, référence, heure — est-il retrouvable dans la pièce source ? Chaque binôme compte ses écarts, les note en haut de page, et corrige avant de passer à la suite.",
      reponseAttendue:
        "Le nombre d'écarts est écrit sur la copie et la correction est faite dans la foulée. Le corrigé liste les quatre glissements les plus fréquents : l'hypothèse devenue cause, le chiffre arrondi qui n'est plus celui du compte rendu, l'action invérifiable (« sensibiliser l'équipe ») et l'engagement de délai que personne n'a validé.",
      dureeMin: 25,
      notes: {
        script:
          "Faites corriger au stylo rouge sur la copie de l'AUTRE : le geste vaut le discours. Insistez sur le chiffre — une quantité arrondie dans une fiche devient une fausse déclaration devant le client, et c'est le défaut le plus fréquent parce qu'il paraît anodin. Comptez les écarts au tableau, table par table.",
        faq: [
          {
            question: "« Sensibiliser l'équipe », pourquoi ce n'est pas une action ?",
            reponse:
              "Parce que personne ne peut prouver que c'est fait. Une action corrective se vérifie : qui, quand, et quelle preuve on conserve. « Sensibiliser » n'a jamais fermé un écart en audit.",
          },
        ],
        blocages: [
          {
            situation: "Les binômes se valident mutuellement sans rien relever.",
            parade:
              "Annoncer que chaque binôme devra citer AU MOINS un écart à l'oral. La complaisance tombe immédiatement.",
          },
        ],
        planB:
          "Grille et corrigé sont imprimés dans le kit. La vérification ne dépend d'aucun outil : elle se fait au stylo sur les copies, y compris sur des fiches remplies à la main pendant le plan B de l'atelier.",
      },
    },
    synthese: {
      acquis: [
        "Je transforme des notes brutes — photo, dictée, compte rendu de poste — en fiche de non-conformité exploitable.",
        "Je sépare le fait de l'hypothèse et je ne laisse jamais une cause s'écrire toute seule.",
        "Je ne reprends aucun chiffre qui ne soit retrouvable dans la pièce source.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites nommer le fichier à voix haute : « nc-<référence>-<date> ». Un livrable existe à partir du moment où il a un nom. Annoncez ce qui vient après la pause : les documents maîtrisés, et on commencera par ce que l'IA ne réécrira JAMAIS — prévenez que ce sera la règle la plus stricte des deux jours, ça change l'écoute.",
        faq: [],
        blocages: [
          {
            situation: "Un participant veut envoyer sa réponse client dès la pause.",
            parade:
              "L'arrêter : c'est un projet, il passe par le responsable qualité qui signe. Lui faire écrire « projet — à valider » en haut de page avant de ranger.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 3 — Maîtrise documentaire (Après-midi J1)
  // ⚠️ Module porteur de l'interdit central des deux jours.
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-3",
    objectif: {
      enonce:
        "À la fin de ce module, vous mettez à jour un écrit maîtrisé de votre site — mode opératoire d'atelier, gamme de maintenance préventive, compte rendu d'intervention type, procédure de contrôle — et vous produisez la fiche d'évolution de version qui dit ce qui change, pourquoi, qui est impacté et qui valide.",
      objectifGlobalId: "obj-4",
      // La consigne de pratique impose en outre de surligner les paragraphes à
      // portée de sécurité ou de process, de les recopier de la version en
      // vigueur et de les faire revalider par le référent QSE : c'est là que
      // l'interdit central des deux jours s'exerce sur pièce.
      objectifsSecondairesIds: ["obj-5"],
      dureeMin: 5,
      notes: {
        script:
          "Annoncez l'ordre du module et tenez-le : on pose l'interdit AVANT de toucher au premier document, jamais après. Dites-le tel quel — dans quinze minutes vous saurez ce que l'IA ne réécrit jamais, et c'est la seule règle des deux jours dont le non-respect peut blesser quelqu'un. Demandez à chacun de sortir dès maintenant le document qu'il compte mettre à jour : ça vous laisse le temps du cadre pour repérer ceux qui ont posé un écrit de sécurité sur la table.",
        faq: [
          {
            question:
              "On peut faire réécrire nos modes opératoires ? On en a deux cents à reprendre.",
            reponse:
              "Pas ceux qui portent la sécurité — on verra dans dix minutes pourquoi, et la règle ne se négocie pas. Pour les autres, oui, et c'est exactement l'atelier de ce module.",
          },
        ],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "On donne une procédure de contrôle à l'assistant avec « rends-la plus claire ». La sortie est effectivement plus claire, mieux ordonnée, plus courte — et c'est précisément ce qui la rend dangereuse : personne ne relit ligne à ligne un texte qui se lit mieux que l'original.",
      apres:
        "On compare les deux versions étape par étape, l'original ouvert à côté. Trois pertes apparaissent, toujours les mêmes : une référence de norme inventée, une étape de sécurité supprimée au nom de la concision, l'indice de version disparu de l'en-tête.",
      prompt:
        "Voici la version en vigueur d'une procédure de contrôle, en pièce jointe. Propose une version retravaillée en respectant STRICTEMENT ces règles : ne supprime aucune étape, ne fusionne aucune étape, ne modifie aucune valeur, aucun seuil, aucune référence de norme et aucun indice de version. Tu peux uniquement reformuler pour la clarté et réordonner à l'intérieur d'une même phase. Rends ensuite un tableau à trois colonnes : étape d'origine, étape proposée, nature de la modification. Signale enfin, dans une liste séparée, toute étape que tu identifies comme relevant de la sécurité des personnes : je les traiterai à part et tu n'y touches pas.",
      outil: "Un seul outil, celui autorisé sur le site.",
      captureEcran:
        "Le tableau à trois colonnes, avec la ligne où une étape a disparu entourée en rouge et la référence de norme inventée surlignée.",
      verifieLe: VERIFIE_LE,
      dureeMin: 15,
      notes: {
        script:
          "Ne cachez rien : montrez d'abord ce que l'assistant améliore VRAIMENT, sinon la salle vous prend pour un opposant et n'écoute plus l'interdit. La structure et le langage progressent, dites-le. Ouvrez ensuite l'original à côté et cherchez les trois pertes AVEC eux, sans les annoncer. Celle qui compte est l'étape de sécurité supprimée : laissez le silence après, il vaut tout le discours. Énoncez alors la règle et faites-la écrire : un mode opératoire de sécurité, une consigne de sécurité machine, une fiche de données de sécurité, un paramètre de process ne se font pas produire — ils se RECOPIENT depuis le document validé.",
        faq: [
          {
            question:
              "Si on lui interdit de toucher aux étapes de sécurité dans le prompt, c'est bon ?",
            reponse:
              "Non. Vous venez de voir qu'il ne tient pas toujours la consigne. La règle n'est pas « demandez-lui de ne pas y toucher », c'est « ces textes-là ne passent pas par lui » : on les recopie depuis la version validée.",
          },
          {
            question: "Et une fiche de données de sécurité fournisseur, on peut la résumer ?",
            reponse:
              "Non. Elle se diffuse telle quelle, elle est réglementée et elle vient du fournisseur. Un résumé qui perd une phrase peut coûter une brûlure. Si vous voulez un support d'accueil, votre référent QSE le construit à partir de la fiche, pas l'assistant.",
          },
        ],
        blocages: [
          {
            situation: "L'assistant respecte parfaitement la consigne, aucune perte visible.",
            parade:
              "Le dire immédiatement : « il a bien travaillé cette fois, et vous n'aviez aucun moyen de le savoir avant de comparer ». C'est exactement l'enseignement. Passer ensuite au plan B et montrer la sortie du kit, qui contient les trois pertes.",
          },
          {
            situation: "Un participant a sorti un mode opératoire de sécurité pour l'atelier.",
            parade:
              "Le repérer maintenant, pas dans dix minutes. Lui faire ranger le document et lui donner la procédure de secours du kit. Ne pas discuter du cas particulier : « je ne me prononce pas, notez la question, votre référent QSE tranchera ».",
          },
        ],
        planB:
          "Original, sortie retravaillée et tableau comparatif sont imprimés dans le kit, datés, avec les trois pertes présentes mais non annotées : la salle les cherche sur papier, feutre en main. Sans réseau c'est même plus lisible qu'à l'écran, et le temps de recherche joue en votre faveur.",
      },
    },
    pratique: {
      consigne:
        "Chronométré. Mettez à jour UN écrit maîtrisé de votre site — mode opératoire d'atelier hors sécurité, gamme ou fiche de maintenance préventive, compte rendu d'intervention type, procédure de contrôle, notice d'utilisation interne — et produisez sa fiche d'évolution de version sur la trame fournie : ce qui change, pourquoi, qui est impacté, qui valide, à quelle date. Surlignez en jaune, dans votre nouvelle version, chaque paragraphe qui touche à la sécurité des personnes ou à un paramètre de process : ceux-là ne sont pas retouchés, ils sont recopiés de la version en vigueur et devront repasser par le référent QSE avant toute diffusion.",
      aEmporter:
        "Un écrit maîtrisé mis à jour, sa fiche d'évolution de version renseignée, et la liste surlignée des paragraphes à faire revalider par le QSE — troisième pièce du dossier du site.",
      dureeMin: 40,
      notes: {
        script:
          "Faites le tour des documents sortis AVANT de lancer le chronomètre : un mode opératoire de sécurité posé sur une table, c'est vous qui le repérez, pas eux. La consigne de surlignage n'est pas décorative — c'est elle qui produit la liste de revalidation, qui est le vrai livrable. Ceux du bureau des méthodes iront vite et voudront en faire trois : arrêtez-les, un document bien fait avec sa fiche d'évolution vaut mieux que trois réécritures sans traçabilité. Ceux de l'atelier travailleront sur un document qu'ils exécutent sans l'avoir écrit : c'est un avantage, ils voient les étapes manquantes.",
        faq: [
          {
            question: "Notre GED gère déjà l'indice de version, faut-il quand même le noter ?",
            reponse:
              "Oui, dans la fiche d'évolution : la GED garde l'indice, elle ne garde ni pourquoi ça a changé ni qui a été impacté. C'est précisément ce qu'un auditeur demande.",
          },
          {
            question: "Je n'ai pas apporté de document de mon site.",
            reponse:
              "Le kit en fournit trois : une gamme de maintenance préventive, un mode opératoire de conditionnement et une procédure de contrôle réception. Prenez celui qui ressemble le plus à votre quotidien.",
          },
        ],
        blocages: [
          {
            situation:
              "Un participant fait réécrire son document intégralement et perd l'original.",
            parade:
              "L'arrêter et lui faire rouvrir la version en vigueur à côté. On ne travaille jamais sans l'original sous les yeux : sans lui, la fiche d'évolution est invérifiable.",
          },
          {
            situation: "La salle demande si tel paragraphe relève de la sécurité.",
            parade:
              "Ne pas arbitrer : « je ne me prononce pas, notez la question, votre référent QSE tranchera ». Faire surligner par défaut — le doute se traite en surlignant, jamais en tranchant.",
          },
        ],
        planB:
          "Sans réseau, la mise à jour se fait à la main sur photocopie de l'original, feutre pour le surlignage, et la fiche d'évolution se remplit au stylo sur la trame papier. Le livrable est identique et la liste de revalidation aussi ; seule la reformulation assistée est reportée au retour au poste.",
      },
    },
    verification: {
      question:
        "Vérification croisée en binôme sur la grille fournie, l'original en vigueur ouvert à côté de la nouvelle version : aucune étape de sécurité n'a-t-elle disparu entre les deux ? chaque référence normative citée est-elle retrouvée dans le document déposé, à la page indiquée ? l'indice de version et le circuit de validation sont-ils renseignés dans la fiche d'évolution ? les paragraphes à revalider sont-ils surlignés et listés ?",
      reponseAttendue:
        "Les quatre points passés en revue sur chaque production, écarts relevés au stylo. Toute référence normative que le binôme ne retrouve pas dans le document source est BARRÉE, sans discussion : une norme non retrouvée est réputée inventée. Correction commentée en salle sur deux ou trois écarts récurrents.",
      dureeMin: 20,
      notes: {
        script:
          "La règle de la référence barrée se prononce telle quelle et ne se négocie pas : non retrouvée, donc barrée. C'est le seul moyen de tenir l'exigence sans discuter chaque cas. Exigez l'original SOUS LES YEUX — une comparaison de mémoire ne vaut rien ici. Terminez en comptant combien d'étapes de sécurité la salle a récupérées : le chiffre justifie à lui seul les vingt minutes.",
        faq: [
          {
            question: "La norme existe, je la connais, elle n'est juste pas dans le PDF déposé.",
            reponse:
              "Alors vous la citez depuis le document où elle figure, pas depuis la mémoire de l'assistant. Barrez, notez la référence à vérifier, rouvrez le bon document au bureau.",
          },
        ],
        blocages: [
          {
            situation: "Un binôme n'a pas l'original sous la main.",
            parade:
              "Basculer sur les documents du kit, qui ont leur original imprimé. Sans original, la vérification n'est qu'un exercice de style.",
          },
        ],
        planB:
          "Grille et corrigé imprimés dans le kit, originaux fournis en version papier. Aucune dépendance à un outil : c'est une lecture comparée, feuille contre feuille.",
      },
    },
    synthese: {
      acquis: [
        "Je mets à jour un écrit maîtrisé sans jamais travailler sans l'original sous les yeux.",
        "Je ne fais produire ni mode opératoire de sécurité, ni consigne machine, ni fiche de données de sécurité, ni paramètre de process : je les recopie du document validé.",
        "Je produis la fiche d'évolution de version et je liste les paragraphes à faire revalider par le référent QSE.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Terminez sur l'interdit, pas sur la méthode : faites-le répéter à voix haute par deux personnes différentes, dans leurs mots. C'est la phrase que vous voulez entendre dans six mois dans leur atelier. Annoncez la suite après la pause : les questionnaires clients, et la règle du jeu change — on ne rédige plus, on prouve.",
        faq: [],
        blocages: [
          {
            situation: "Quelqu'un objecte que « chez nous personne ne relit, ça passera ».",
            parade:
              "Une seule question, sans commentaire : « et le jour où l'étape manquante est celle de la consignation ? ». Ne pas argumenter plus loin.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 4 — Questionnaires clients et audits fournisseurs (Après-midi J1)
  // ⚠️ Sa synthèse ferme le jour 1 par un état stable et NOMMÉ.
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-4",
    objectif: {
      enonce:
        "À la fin de ce module, vous répondez à un questionnaire client ou à une grille d'audit en appuyant chaque réponse sur une pièce du site, et vous transformez en question interne toute réponse que vous ne pouvez pas prouver.",
      objectifGlobalId: "obj-6",
      dureeMin: 5,
      notes: {
        script:
          "Annoncez le changement de règle du jeu : jusqu'ici on rédigeait, maintenant on prouve. Le module se juge sur une seule chose — le nombre de réponses qui ne tenaient pas sans pièce. Prévenez que ce chiffre sera compté à voix haute en fin de module : ça change la façon de travailler pendant l'atelier.",
        faq: [
          {
            question: "Nos questionnaires clients font quarante pages, on va en traiter un ?",
            reponse:
              "Vous allez traiter la partie qui vous coûte le plus : une dizaine de questions menées jusqu'à la preuve, pas quarante remplies à la va-vite. Le geste se rejoue ensuite au bureau.",
          },
        ],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "On répond au questionnaire client de mémoire, à deux jours de la date limite, en reprenant le fichier de l'an dernier. Les réponses sont plausibles, quelques-unes ne sont plus vraies, et personne ne sait dire sur quoi elles s'appuient.",
      apres:
        "On dépose d'abord les documents de référence du site — manuel qualité, certificats, procédures, enregistrements récents — puis on traite le questionnaire question par question, chaque réponse portant en face le document et la section qui la prouvent. Une réponse sans pièce ressort marquée « non prouvé », avec la question à poser en interne.",
      prompt:
        "Tu réponds à un questionnaire client à partir des SEULS documents que je viens de déposer. Pour chaque question, rends trois colonnes : la réponse proposée, le document et la section précise sur lesquels elle s'appuie, et un niveau parmi « prouvé par le document déposé », « partiellement prouvé », « non prouvé ». N'utilise aucune connaissance générale sur les normes ou sur le secteur : si les documents déposés ne permettent pas de répondre, écris « non prouvé » et formule la question à poser en interne. Ne reformule aucun chiffre : recopie-le tel qu'il figure dans l'enregistrement, avec sa date de relevé.",
      outil: "Un seul outil, celui autorisé sur le site.",
      captureEcran:
        "Le tableau à trois colonnes, avec la ligne classée « prouvé » par l'assistant alors qu'aucun document déposé ne la porte, entourée en rouge à côté du document ouvert à la section citée.",
      verifieLe: VERIFIE_LE,
      dureeMin: 15,
      notes: {
        script:
          "Le moment utile n'est pas la production du tableau, c'est la ligne où l'assistant s'est déclaré « prouvé » sans preuve. Cherchez-la AVEC la salle en ouvrant le document cité : il ne dit pas ce qu'on lui fait dire. Faites-le en direct, document à l'écran — c'est vérifiable en quinze secondes et ça vaut tout l'exposé sur les hallucinations. Faites refaire la vérification par un participant, pour que ce soit sa main qui l'ait faite.",
        faq: [
          {
            question: "Si on lui demande de citer ses sources, il ne peut plus inventer ?",
            reponse:
              "Il invente moins, et il invente autrement : il cite un document réel en lui faisant dire ce qu'il ne dit pas. C'est pour ça qu'on ouvre le document, on ne se contente pas de la citation.",
          },
          {
            question: "On peut déposer notre manuel qualité ?",
            reponse:
              "Selon votre régime d'usage — reprenez votre colonne de ce matin. Le manuel qualité passe souvent en environnement entreprise ; ses annexes clients, non.",
          },
        ],
        blocages: [
          {
            situation: "L'assistant cite correctement toutes ses sources, rien à montrer.",
            parade:
              "Poser une question dont la réponse n'est dans AUCUN document déposé — « quel est votre taux de service sur les douze derniers mois ? ». Soit la ligne « non prouvé » attendue apparaît, soit un chiffre est inventé : les deux enseignent.",
          },
        ],
        planB:
          "Documents de référence, questionnaire et tableau produit sont imprimés dans le kit, datés, avec la citation fautive laissée en place. La salle ouvre le document papier cité et constate l'écart : l'exercice fonctionne intégralement hors réseau.",
      },
    },
    pratique: {
      consigne:
        "Chronométré. Choisissez le document qui vous attend vraiment : un questionnaire client, un dossier de qualification fournisseur, ou une grille d'audit que vous devez adresser à un sous-traitant. Traitez-en au moins dix questions. Pour chacune, écrivez en face la pièce qui la prouve — nom du document, indice de version, section — et le chiffre tel qu'il figure dans l'enregistrement, avec sa date de relevé. Toute question dont vous n'avez pas la pièce sous la main est marquée « non prouvé » et reformulée en question à poser en interne, avec le nom du service à qui la poser.",
      aEmporter:
        "Un questionnaire ou une grille d'audit traité sur au moins dix questions, chaque réponse portant sa pièce de preuve, et la liste des questions internes à poser avec leur destinataire — quatrième pièce du dossier du site.",
      dureeMin: 45,
      notes: {
        script:
          "La consigne qui fait tout le module est « la pièce en face », pas « la réponse » : répétez-la en passant dans les rangs. Les chiffres sont le point sensible — un taux de service ou un niveau de rebut repris de tête est une fausse déclaration au client. Faites rouvrir l'enregistrement, avec sa date de relevé. Ceux qui n'ont apporté aucun document travaillent sur le jeu du kit : ne les laissez pas regarder leur voisin pendant quarante-cinq minutes.",
        faq: [
          {
            question: "Je connais la réponse par cœur, je dois vraiment chercher la pièce ?",
            reponse:
              "Oui, parce que le client ne vous croira pas sur parole en audit et que vous devrez la ressortir sous trois jours. Autant la trouver maintenant, quand vous avez le temps.",
          },
          {
            question: "Et si aucune pièce n'existe ?",
            reponse:
              "Alors la réponse est « non prouvé », et vous venez de découvrir un écart avant votre client. C'est le meilleur résultat possible de cet atelier.",
          },
        ],
        blocages: [
          {
            situation:
              "Un participant remplit vite et sans preuves pour « finir le questionnaire ».",
            parade:
              "Lui demander de vous montrer la pièce de la question 3. S'il ne l'a pas, lui faire barrer et reprendre. Le nombre de réponses n'a aucune valeur ici.",
          },
          {
            situation: "Le questionnaire apporté contient des données du client sous accord.",
            parade:
              "Retour à la liste rouge du matin : on ne dépose pas. On traite le questionnaire à la main sur la trame, ou on prend celui du kit. Ne pas laisser passer.",
          },
        ],
        planB:
          "Sans réseau, l'atelier se tient intégralement au stylo : trame à trois colonnes du kit, documents du site sortis de la pochette, chiffres recopiés depuis les enregistrements. C'est même la version la plus fidèle au geste enseigné, l'assistant ne faisant que l'accélérer au bureau.",
      },
    },
    verification: {
      question:
        "Vérification aux sources en binôme : reprenez les réponses de l'autre une par une et OUVREZ la pièce citée. Toute réponse sans pièce en face, ou dont la pièce ne dit pas ce qu'on lui fait dire, est barrée et transformée en question à poser en interne. Comptez combien de réponses ne tenaient pas et écrivez le nombre en haut de la copie.",
      reponseAttendue:
        "Le compte est écrit sur chaque copie et annoncé à voix haute par table. Le corrigé rappelle les trois cas qui font tomber une réponse : aucune pièce, une pièce qui ne dit pas cela, et un chiffre repris sans sa date de relevé.",
      dureeMin: 20,
      notes: {
        script:
          "Ouvrez VRAIMENT les pièces : vérifier qu'une référence est écrite ne suffit pas, c'est là que la moitié des écarts se trouvent. Faites annoncer les comptes table par table et écrivez-les au tableau. Le total de la salle est le chiffre que chacun ramènera à son responsable qualité — il vaut mieux que n'importe quelle recommandation.",
        faq: [
          {
            question: "On a barré la moitié de nos réponses, c'est mauvais signe ?",
            reponse:
              "C'est excellent : ces réponses seraient parties chez le client. Vous les avez arrêtées ici plutôt qu'en audit.",
          },
        ],
        blocages: [
          {
            situation: "Un binôme refuse de barrer les réponses de l'autre par politesse.",
            parade:
              "Rappeler que la personne barrée est celle qui y gagne, et annoncer que chaque binôme citera un écart à l'oral. La gêne tombe.",
          },
        ],
        planB:
          "Grille de vérification et corrigé imprimés dans le kit, pièces de preuve du jeu fourni en version papier. Aucun outil nécessaire : c'est une lecture croisée, document ouvert.",
      },
    },
    synthese: {
      acquis: [
        "Je réponds à un client ou à un auditeur en posant la pièce qui prouve, jamais de mémoire.",
        "Je recopie les chiffres depuis l'enregistrement, avec leur date de relevé.",
        "Je transforme toute réponse non prouvée en question interne, adressée à un service nommé.",
      ],
      dureeMin: 10,
      notes: {
        script:
          "C'est la fin du jour 1, et c'est le moment le plus mal utilisé des formations de deux jours. Ne laissez PAS la salle repartir avec des fichiers épars : faites créer un dossier nommé « ia-site-<nom du site>-<date> », faites-y ranger les quatre livrables — liste rouge, fiches de non-conformité, écrit maîtrisé mis à jour avec sa fiche d'évolution, questionnaire tracé — et faites cocher la liste au tableau, à voix haute, pièce par pièce. Ce qui n'est pas nommé ce soir sera reperdu demain matin, et le jour 2 redémarrera à froid. Annoncez enfin le programme du lendemain en une phrase : on prépare un audit, on pose ce que l'IA ne décide jamais sur un site, et on écrit la procédure d'usage.",
        faq: [
          {
            question: "On peut verser ça dans notre GED dès ce soir ?",
            reponse:
              "Les livrables sont des projets tant que le responsable qualité ne les a pas validés. Rangez-les dans votre pochette, faites-les valider, puis versez-les.",
          },
        ],
        blocages: [
          {
            situation: "Il est 17 h 20 et la salle est déjà debout.",
            parade:
              "Ne sacrifier que le commentaire, jamais la nomination du dossier : trente secondes pour le créer et vérifier que les quatre pièces y sont. C'est ce qui permet de commencer demain à 9 h 05 au lieu de 9 h 40.",
          },
        ],
        planB:
          "Aucun outil en jeu. Si les livrables ont été produits sur papier, la pochette de formation joue le rôle du dossier : même nom écrit au feutre en couverture, même liste cochée pièce par pièce.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 5 — Préparer une certification ou un audit client (Matin J2)
  // ⚠️ Premier module du jour 2 : il rouvre le dossier nommé la veille.
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-5",
    objectif: {
      enonce:
        "À la fin de ce module, vous produisez une revue d'écart appuyée sur le référentiel réellement applicable chez vous, et le plan d'action daté qui en découle — une ligne par écart, avec porteur, échéance et preuve attendue.",
      objectifGlobalId: "obj-7",
      dureeMin: 5,
      notes: {
        script:
          "Redémarrage du jour 2 : commencez par faire ROUVRIR le dossier nommé hier soir et vérifiez à main levée que chacun l'a retrouvé. Trois minutes ici évitent une matinée de retard, et celui qui ne l'a pas retrouvé le reconstitue tout de suite avec sa pochette. Rappelez ensuite en une phrase les trois acquis du jour 1 affichés au tableau, puis annoncez que le module 5 est celui qui rapporte le plus de temps : la revue d'écart est le travail le plus long d'une préparation d'audit.",
        faq: [
          {
            question:
              "Notre référentiel n'est pas une norme, c'est celui de notre donneur d'ordre.",
            reponse:
              "C'est le cas le plus fréquent et ça ne change rien à la méthode : on dépose le référentiel applicable, quel qu'il soit, et on l'interroge exigence par exigence.",
          },
        ],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "On prépare l'audit avec le référentiel dans la tête et le rapport précédent au fond d'un tiroir. La revue d'écart se fait la semaine d'avant, en urgence, et les exigences oubliées se découvrent le jour même, devant l'auditeur.",
      apres:
        "On dépose le référentiel applicable et le rapport du dernier audit, puis on l'interroge exigence par exigence en demandant à chaque fois la preuve attendue. La revue d'écart sort en une session — et l'exigence inventée en chemin se retrouve en trois secondes par recherche plein texte dans le document.",
      prompt:
        "Voici le référentiel applicable et le rapport du dernier audit, en pièces jointes. Parcours le référentiel exigence par exigence, dans son ordre, et rends un tableau : numéro d'exigence tel qu'il est écrit dans le document, formulation exacte de l'exigence recopiée entre guillemets, preuve habituellement attendue, écart relevé au dernier audit s'il y en a un. N'ajoute aucune exigence qui ne figure pas dans le document déposé et n'en reformule aucune. Si tu n'es pas certain d'un numéro, écris « numéro à vérifier » plutôt que de le deviner.",
      outil: "Un seul outil, celui autorisé sur le site.",
      captureEcran:
        "Le tableau des exigences, avec la ligne dont le numéro n'existe pas dans le référentiel entourée en rouge, à côté de la fenêtre de recherche plein texte qui rend zéro résultat.",
      verifieLe: VERIFIE_LE,
      dureeMin: 15,
      notes: {
        script:
          "Faites la recherche plein texte EN DIRECT devant la salle : copier le numéro d'exigence rendu par l'assistant, le chercher dans le PDF déposé, zéro résultat. Trois secondes, et c'est le geste que vous voulez qu'ils gardent des deux jours. Faites-le refaire par un participant sur un autre numéro, pour que ce soit sa main qui l'ait fait et pas la vôtre.",
        faq: [
          {
            question: "Pourquoi recopier la formulation exacte entre guillemets ?",
            reponse:
              "Parce qu'une exigence reformulée devient une exigence différente, et que c'est sur la formulation exacte que l'auditeur vous interrogera.",
          },
        ],
        blocages: [
          {
            situation: "Toutes les exigences citées existent, aucun défaut à montrer.",
            parade:
              "Demander une exigence sur un thème absent du référentiel déposé — « que dit-il sur la cybersécurité ? ». Soit il répond « absent », soit il invente : les deux enseignent.",
          },
          {
            situation: "La salle demande si telle exigence s'applique à leur site.",
            parade:
              "Ne pas se prononcer sur la conformité : « je ne me prononce pas, notez la question, votre référent QSE ou votre certificateur tranchera ». Écrire la question au tableau.",
          },
        ],
        planB:
          "L'extrait de référentiel, le tableau produit et la capture de la recherche infructueuse sont imprimés dans le kit, datés. Sans réseau, la salle cherche le numéro fantôme dans le référentiel papier fourni : c'est plus long et tout aussi convaincant.",
      },
    },
    pratique: {
      consigne:
        "Chronométré. À partir du référentiel réellement applicable chez vous — norme de système, exigence client, référentiel de donneur d'ordre — préparez votre revue d'écart et le plan d'action qui en découle. Une ligne par écart, et chaque ligne porte quatre choses : l'exigence citée dans sa formulation exacte, l'écart constaté, le porteur désigné par FONCTION et non par prénom, l'échéance et la preuve attendue. Les écarts du dernier audit se reprennent en premier. Tout chiffre inscrit vient d'un enregistrement du site, avec sa date.",
      aEmporter:
        "La revue d'écart du site et son plan d'action daté, une ligne par écart avec porteur par fonction, échéance et preuve attendue — cinquième pièce du dossier du site.",
      dureeMin: 45,
      notes: {
        script:
          "Insistez sur « porteur par fonction » : un plan d'action qui nomme des prénoms meurt au premier départ, et un auditeur le sait. Faites reprendre les écarts du dernier audit EN PREMIER, c'est là que se joue la crédibilité du dossier. Ceux qui n'ont pas leur référentiel travaillent sur celui du kit — ne les laissez pas improviser de mémoire, une exigence citée de tête est une exigence fausse.",
        faq: [
          {
            question: "On peut faire écrire les actions correctives par l'assistant ?",
            reponse:
              "Il propose, vous tranchez et vous signez. Une action que vous ne pouvez pas tenir engage le site devant l'auditeur, et l'assistant ne sera pas là ce jour-là.",
          },
          {
            question: "Combien d'écarts faut-il traiter ?",
            reponse:
              "Autant que le chronomètre permet, avec les quatre colonnes remplies. Cinq lignes complètes valent mieux que vingt lignes creuses.",
          },
        ],
        blocages: [
          {
            situation: "Un participant reprend des chiffres de mémoire pour aller plus vite.",
            parade:
              "Faire barrer et remplacer par « à relever, source : <nom de l'enregistrement> ». Un chiffre non sourcé dans un plan d'action est un écart de plus, pas un gain de temps.",
          },
          {
            situation: "Deux participants du même site produisent deux revues divergentes.",
            parade:
              "Les faire travailler sur une seule revue, en notant les points de désaccord dans une colonne « à arbitrer ». Ils repartiront avec le même document, ce qui est le but.",
          },
        ],
        planB:
          "Sans réseau, la revue d'écart se conduit à la main sur la trame à quatre colonnes du kit, référentiel papier ouvert. Le geste vérifié — citer l'exigence exacte, poser la preuve attendue — est identique ; seule la vitesse de dégrossissage change.",
      },
    },
    verification: {
      question:
        "Vérification aux sources en binôme : pour chaque exigence citée dans la revue de l'autre, retrouvez-la dans le document déposé, à son numéro. Toute exigence non retrouvée fait sauter la phrase. Pour chaque chiffre inscrit, retrouvez l'enregistrement du site et sa date. Comptez les phrases supprimées et notez le total en haut de la revue.",
      reponseAttendue:
        "Le nombre de phrases supprimées est écrit et annoncé par table. Le corrigé rappelle les deux sources d'erreur : l'exigence qui n'existe pas dans le référentiel déposé, et le chiffre CALCULÉ par l'assistant à partir d'autres chiffres — un total, une moyenne, un pourcentage — qui n'est enregistré nulle part sur le site.",
      dureeMin: 25,
      notes: {
        script:
          "Le chiffre calculé est le piège que la salle ne voit pas : un pourcentage obtenu par l'assistant à partir de deux valeurs déposées paraît sourcé, et il ne l'est pas — aucun enregistrement du site ne le porte. Montrez-en un exemple AVANT de lancer la vérification, sinon personne ne le cherchera. Terminez par les comptes annoncés table par table.",
        faq: [
          {
            question: "Un pourcentage recalculé, c'est vraiment un problème ?",
            reponse:
              "Devant un auditeur, oui : il vous demandera l'enregistrement et vous n'en aurez pas. Si vous voulez ce chiffre, faites-le produire par le service qui tient la donnée, et enregistrez-le.",
          },
        ],
        blocages: [
          {
            situation: "La vérification déborde et la synthèse va sauter.",
            parade:
              "Arrêter à l'heure et sacrifier la moitié des lignes plutôt que la synthèse : c'est elle qui referme le module. Les lignes non vérifiées sont marquées « à vérifier » et repartent dans le dossier.",
          },
        ],
        planB:
          "Référentiel papier, revues imprimées et corrigé du kit : la vérification aux sources est le bloc le moins dépendant d'un outil de toute la formation.",
      },
    },
    synthese: {
      acquis: [
        "Je cite une exigence dans sa formulation exacte, retrouvée dans le référentiel déposé.",
        "Je bâtis un plan d'action où chaque ligne porte un porteur par fonction, une échéance et la preuve attendue.",
        "Je n'inscris aucun chiffre qui ne soit enregistré quelque part sur le site, avec sa date.",
      ],
      dureeMin: 10,
      notes: {
        script:
          "Faites verser la revue d'écart et le plan d'action dans le dossier nommé hier soir, et faites cocher la liste : cinq pièces. Annoncez le module suivant avec sa vraie couleur — après la pause on ne parle plus de documents mais de personnes, et c'est le module où l'on dit ce que l'IA ne décidera jamais sur un site.",
        faq: [],
        blocages: [
          {
            situation: "Un participant veut envoyer son plan d'action au certificateur en sortant.",
            parade:
              "L'arrêter : c'est un projet de revue, il passe par le responsable qualité et par la direction. Lui faire écrire « projet » en haut de page avant de ranger.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 6 — Ce que l'IA ne décide jamais sur un site (Matin J2)
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-6",
    objectif: {
      enonce:
        "À la fin de ce module, vous dites devant un projet de suivi ou de contrôle automatisé si l'on est encore sur de l'activité ou déjà sur l'évaluation d'une personne, et vous savez ce que cela déclenche avant toute mise en service.",
      objectifGlobalId: "obj-8",
      // Le module sert la première moitié de l'objectif — la qualification à la
      // grille en quatre questions ; la procédure d'usage qui le complète
      // s'écrit au module 7. Il rouvre en outre la liste rouge du module 1 :
      // les relevés nominatifs y figurent déjà, et c'est à elle que le
      // formateur renvoie tout participant qui veut déposer les siens.
      objectifsSecondairesIds: ["obj-2"],
      dureeMin: 5,
      notes: {
        script:
          "Prévenez la salle du changement de registre : les cinq premiers modules servaient à produire des écrits, celui-ci sert à refuser. Dites-le tel quel, c'est ce qui fera écouter le cadre qui suit. Demandez à chaque table de sortir dès maintenant trois dispositifs réels ou envisagés sur leur site — c'est la matière de l'atelier, et ça leur laisse le temps du cadre pour y penser.",
        faq: [
          {
            question: "On voulait justement automatiser le suivi des cadences, c'est mort ?",
            reponse:
              "Non, mais ce n'est pas un projet informatique : c'est un projet qui passe par l'information des salariés et la consultation de leurs représentants. On va voir ce que ça implique et qui le déclenche.",
          },
        ],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "On soumet une évaluation d'activité à l'assistant et on lit l'avis rendu comme un constat. Personne ne voit sur quoi il s'est appuyé, parce que ce n'est écrit nulle part — et l'avis se retrouve ensuite dans une discussion sur une personne.",
      apres:
        "On soumet DEUX FOIS la même évaluation, la seconde avec une variable de plus — ancienneté, équipe, site d'origine — et on lit les deux avis côte à côte. L'avis a changé sans qu'aucune donnée de performance n'ait bougé, et la salle voit la variable qui l'a fait basculer.",
      prompt:
        "PASSE A — « Voici les relevés d'activité anonymisés de trois postes sur une semaine, en pièce jointe. Décris pour chacun ce que montrent les chiffres, sans évaluer les personnes, sans classer et sans recommander. »\n\nPASSE B — « Mêmes relevés, avec en plus l'ancienneté et l'équipe de rattachement de chaque poste. En une phrase, dis quel poste te semble le moins performant, et pourquoi. »",
      outil: "Un seul outil, celui autorisé sur le site.",
      captureEcran:
        "Les deux sorties côte à côte, avec la phrase de la passe B où l'ancienneté est reprise comme motif entourée en rouge.",
      verifieLe: VERIFIE_LE,
      dureeMin: 15,
      notes: {
        script:
          "Faites PARIER par écrit avant d'afficher la passe B : chacun note quel poste sortira désigné. Le pari est ce qui rend la démonstration mémorable — sans lui la salle regarde, avec lui elle s'est trompée elle-même. Dites explicitement que le jeu de données est FICTIF et fourni dans le kit : sinon la salle croit que vous avez déposé des relevés réels, et l'atelier suivant est faussé dès le départ.",
        faq: [
          {
            question: "C'est le prompt qui est biaisé, pas l'outil.",
            reponse:
              "Oui. Et c'est la mauvaise nouvelle : le biais vient de la demande, donc il sera dans les vôtres, pas seulement dans celle-ci.",
          },
          {
            question: "Si on ne lui donne que des chiffres de production, il n'y a plus de biais ?",
            reponse:
              "Il en reste : un poste, une équipe, un horaire désignent des personnes sur un site où tout le monde se connaît. C'est exactement ce qu'on a vu hier matin avec le rapport pseudonymisé.",
          },
        ],
        blocages: [
          {
            situation: "Les deux passes rendent des sorties presque identiques.",
            parade:
              "Relancer la passe B avec « en une seule phrase, lequel changerais-tu de poste ? ». La contrainte de brièveté force la hiérarchisation et le biais ressort. Sinon, plan B.",
          },
          {
            situation: "Un participant propose de tester avec les relevés réels de son site.",
            parade:
              "Refus net, sans négociation : les relevés nominatifs sont sur leur propre liste rouge d'hier. Les renvoyer à leur feuille plutôt qu'argumenter.",
          },
        ],
        planB:
          "Les deux sorties du jeu fictif sont imprimées dans le kit, datées, avec la phrase fautive présente. Le pari écrit et la comparaison ligne à ligne se tiennent intégralement sur papier, sans rien perdre.",
      },
    },
    pratique: {
      consigne:
        "En table, chronométré. Prenez trois dispositifs réels ou envisagés sur votre site — cadences par ligne, rebuts par opérateur, temps par poste, géolocalisation des engins, contrôle qualité par vision, comptage de présence. Passez chacun à la grille en quatre questions : y a-t-il des données personnelles, même indirectes ? le résultat produit-il un effet sur une personne ? une obligation de sécurité est-elle en jeu ? une décision peut-elle être prise sans relecture humaine ? Puis tranchez PAR ÉCRIT : agrégation au niveau de la ligne, abandon, ou dossier d'information et de consultation préalable à monter — et dans ce dernier cas, écrivez quelle fonction le déclenche et à quel moment.",
      aEmporter:
        "Trois dispositifs du site qualifiés à la grille, la décision écrite pour chacun, et le nom de la fonction qui déclenche le dossier d'information et de consultation le cas échéant — sixième pièce du dossier du site.",
      dureeMin: 35,
      notes: {
        script:
          "Faites travailler par site, pas par affinité : la qualification n'a de sens que si ceux qui connaissent les dispositifs sont autour de la même table. Sur les dispositifs sensibles — rebuts par opérateur, géolocalisation — n'arbitrez pas à leur place : posez la question de la grille et laissez-les trancher, votre rôle est de refuser les réponses vagues. Rappelez que la borne produit ne se discute pas : la décision de libération de lot et la signature d'une déclaration de conformité restent celles d'une personne désignée, jamais d'un système.",
        faq: [
          {
            question: "Les cadences par ligne, c'est de l'activité ou de la personne ?",
            reponse:
              "Posez la grille : si une seule personne tient la ligne sur le créneau, le chiffre de la ligne EST le chiffre de la personne. C'est la table qui tranche, pas moi.",
          },
          {
            question: "Le contrôle qualité par vision, il décide tout seul ?",
            reponse:
              "S'il écarte une pièce, la question devient produit : qui libère le lot, et sur quelle base. La réponse s'écrit dans la case, elle ne s'improvise pas devant l'auditeur.",
          },
        ],
        blocages: [
          {
            situation: "Une table qualifie tout en « agrégation » pour éviter le sujet.",
            parade:
              "Leur demander lequel des trois dispositifs ils accepteraient de présenter tel quel aux représentants du personnel. La discussion redémarre en trente secondes.",
          },
          {
            situation: "La salle veut savoir si tel dispositif est légal chez eux.",
            parade:
              "Formule exacte, prononcée telle quelle : « je ne me prononce pas, notez la question, votre référent QSE et votre direction trancheront ». Écrire la question au tableau : la liste des questions ouvertes est une production utile des deux jours.",
          },
        ],
        planB:
          "Aucun outil n'intervient dans cet atelier : grille papier, feutre, discussion de table. C'est l'atelier le plus robuste du jour 2, gardez-le entier quoi qu'il arrive au réseau.",
      },
    },
    verification: {
      question:
        "Correction collective, table par table : chaque table présente une qualification et la décision qu'elle a écrite, et la salle vérifie que les quatre questions de la grille ont été réellement posées et que la décision est écrite, pas seulement suggérée. Les désaccords sont arbitrés en salle et la règle retenue est écrite au tableau.",
      reponseAttendue:
        "Chaque table repart avec ses trois décisions écrites et la règle commune notée au tableau : dès qu'un suivi porte sur des indicateurs individuels, information des salariés et consultation des représentants du personnel AVANT mise en service ; et aucune décision de libération de lot ni de déclaration de conformité rendue par un système.",
      dureeMin: 15,
      notes: {
        script:
          "Faites présenter en premier les tables les plus en désaccord, c'est là que la salle apprend. Écrivez la règle retenue au tableau en toutes lettres et faites-la recopier : elle sera reversée telle quelle dans la procédure d'usage cet après-midi. Si un désaccord porte sur du droit, ne tranchez pas — écrivez la question dans la colonne des questions ouvertes.",
        faq: [
          {
            question: "Qui déclenche l'information et la consultation chez nous ?",
            reponse:
              "Ce n'est pas à moi de le dire : notez la question, votre direction et vos représentants du personnel la trancheront. Ce qu'il faut retenir, c'est que cela se fait AVANT la mise en service, pas après.",
          },
        ],
        blocages: [
          {
            situation: "Une table conteste la règle commune retenue.",
            parade:
              "Ne pas chercher l'unanimité : écrire la règle et écrire l'objection à côté, dans la colonne des questions ouvertes. Une salle qui repart avec un désaccord noté est plus honnête qu'une salle alignée de force.",
          },
        ],
        planB: "Aucun outil en jeu : tableau, feutre, grilles papier remplies à l'atelier.",
      },
    },
    synthese: {
      acquis: [
        "Je qualifie un projet de suivi à la grille avant de le lancer, et je dis s'il porte sur l'activité ou sur des personnes.",
        "Je sais qu'un suivi d'indicateurs individuels exige l'information des salariés et la consultation de leurs représentants avant mise en service.",
        "Je n'accepte aucune décision de libération de lot ni de déclaration de conformité rendue par un système.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Terminez sur la phrase du module et faites-la reformuler par deux personnes différentes : on assiste des écrits et des dossiers, jamais un jugement sur quelqu'un ni une décision de conformité produit. Annoncez l'après-midi : on écrit la procédure d'usage du site, et tout ce qui a été produit depuis hier y entre.",
        faq: [],
        blocages: [
          {
            situation: "La salle est tendue après le module, l'ambiance est lourde.",
            parade:
              "Ne pas dérider artificiellement : dire que c'est le module qui protège les gens, y compris ceux qui portent les projets, et enchaîner sur la procédure d'usage, qui est constructive.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 7 — Écrire la procédure d'usage de l'IA du site (Après-midi J2)
  // ⚠️ Ce module ne produit rien de neuf : il RASSEMBLE les modules 1, 3 et 6.
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-7",
    objectif: {
      enonce:
        "À la fin de ce module, vous disposez de la procédure d'usage de l'IA de votre site, rédigée et prête à être versée au manuel qualité et présentée à un auditeur.",
      objectifGlobalId: "obj-2",
      // C'est ICI que la liste rouge du site cesse d'être un brouillon
      // d'atelier pour devenir la pièce écrite versée au manuel qualité : le
      // module la reverse littéralement dans la procédure d'usage, ce qui en
      // fait l'aboutissement de l'objectif 2 et non un simple rappel.
      // Il sert en outre la seconde moitié de l'objectif 8 — la rédaction de
      // la procédure d'usage elle-même, dont le module 6 a posé la
      // qualification — et la règle de revalidation des écrits à portée
      // sécurité du module 3 (objectif 5).
      objectifsSecondairesIds: ["obj-8", "obj-5"],
      dureeMin: 5,
      notes: {
        script:
          "Annoncez que ce module ne produit rien de neuf : il rassemble. La liste rouge du module 1, la règle de revalidation des écrits à portée sécurité du module 3 et la grille de qualification du module 6 y entrent telles quelles. Faites ressortir ces trois documents des pochettes AVANT de commencer, physiquement, sur la table : un participant qui les cherche pendant l'atelier perd dix minutes sur quarante-cinq.",
        faq: [
          {
            question: "On a déjà une charte informatique, est-ce que ça suffit ?",
            reponse:
              "Une charte dit ce qui est interdit ; une procédure dit qui valide et quelles traces on conserve. C'est la seconde qu'un auditeur ouvre.",
          },
        ],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "L'usage de l'IA sur le site tient dans des habitudes individuelles : chacun a son outil, sa façon de faire, ses limites personnelles. Rien n'est écrit, donc rien ne survit au départ de celui qui savait, et un auditeur n'a rien à ouvrir.",
      apres:
        "Une procédure d'usage type est projetée et commentée point par point — périmètre autorisé, liste rouge, circuit de validation, traces conservées, conduite à tenir en cas de doute — et l'on montre les trois endroits qu'un auditeur regarde en premier : qui valide, quelles traces, et que fait-on quand on ne sait pas.",
      prompt:
        "Voici trois pièces produites par notre site : notre liste rouge, notre règle de revalidation des écrits à portée sécurité, et notre grille de qualification des dispositifs de suivi. Rédige à partir d'elles, et uniquement d'elles, une procédure d'usage de l'IA en cinq parties : périmètre autorisé, ce qui ne sort jamais, circuit de validation avant diffusion, traces conservées et où elles sont rangées, conduite à tenir en cas de doute. Désigne les responsables par FONCTION et jamais par prénom. N'ajoute aucune règle qui ne figure pas dans les trois pièces : si une partie te semble incomplète, écris la question à trancher plutôt que d'inventer la règle.",
      outil: "Un seul outil, celui autorisé sur le site.",
      captureEcran:
        "La procédure produite, avec en marge une pastille sur les trois zones qu'un auditeur ouvre en premier : qui valide, quelles traces, que fait-on en cas de doute.",
      verifieLe: VERIFIE_LE,
      dureeMin: 15,
      notes: {
        script:
          "Projetez la procédure type du kit et commentez-la point par point, à voix haute — c'est un texte court, il se lit en cinq minutes, ne le faites pas lire en silence. Insistez sur « par fonction et jamais par prénom » : une procédure nominative meurt au premier départ. Montrez ensuite la sortie obtenue à partir des trois pièces d'une session précédente, et surtout sa colonne « questions à trancher » : c'est cela que la salle doit reproduire, pas une procédure lisse.",
        faq: [
          {
            question: "Une procédure d'usage doit-elle être validée par la direction ?",
            reponse:
              "Je ne me prononce pas sur votre système documentaire : notez la question, votre responsable qualité tranchera. Ce qui est sûr, c'est qu'une procédure sans validation tracée ne vaut rien en audit.",
          },
          {
            question: "Elle doit faire combien de pages ?",
            reponse:
              "Deux, et elles se lisent. Une procédure de douze pages n'est appliquée par personne, et un auditeur le sait aussi bien que vous.",
          },
        ],
        blocages: [
          {
            situation: "La salle veut recopier la procédure type telle quelle.",
            parade:
              "L'interdire : une procédure recopiée ne porte pas leur liste rouge, donc elle ne protège rien. Leur faire ouvrir leurs trois pièces et repartir de là.",
          },
        ],
        planB:
          "La procédure type et une procédure rédigée en session précédente sont imprimées dans le kit, datées, pastilles comprises. Le commentaire point par point se fait à l'identique sur papier, sans rien perdre.",
      },
    },
    pratique: {
      consigne:
        "Chronométré. Rédigez la procédure d'usage de l'IA de votre site sur la trame fournie, en cinq parties : périmètre autorisé, ce qui ne sort jamais, circuit de validation avant diffusion, traces conservées et où, conduite à tenir en cas de doute. Reversez-y LITTÉRALEMENT la liste rouge du module 1, la règle de revalidation des écrits à portée sécurité du module 3 et la grille de qualification du module 6. Désignez chaque responsable par fonction. Tout point que vous ne pouvez pas trancher va dans une partie « questions à trancher », avec le nom de la fonction qui tranchera.",
      aEmporter:
        "La procédure d'usage de l'IA du site, en projet, avec sa liste de questions à trancher et les fonctions qui trancheront — septième pièce du dossier, et la seule qui survivra au départ de ceux qui étaient dans la salle.",
      dureeMin: 45,
      notes: {
        script:
          "Les participants d'un même site rédigent ENSEMBLE une seule procédure : deux procédures d'un même site, c'est aucune procédure. Rappelez que la partie « ce qui ne sort jamais » se recopie de leur liste rouge et ne se réinvente pas — réécrite de mémoire, elle perdra la moitié de ses lignes. La partie « conduite à tenir en cas de doute » est celle qu'on bâcle : exigez-y une phrase opérationnelle, pas un principe. « Je ne dépose pas et je demande au référent QSE avant » est une conduite ; « faire preuve de vigilance » n'en est pas une.",
        faq: [
          {
            question: "Et si personne chez nous ne veut valider ?",
            reponse:
              "Alors la procédure porte la question à trancher, avec la fonction concernée, et vous la remontez. Une question écrite remonte, une gêne orale ne remonte pas.",
          },
          {
            question: "On peut faire relire la procédure par l'assistant ?",
            reponse:
              "Oui pour la forme, c'est même utile. Le contenu, lui, ne vient que de vos trois pièces — sinon vous récupérez la procédure d'un site qui n'est pas le vôtre.",
          },
        ],
        blocages: [
          {
            situation: "Un participant seul de son site n'ose pas engager l'entreprise.",
            parade:
              "Lui faire écrire l'en-tête « projet — à valider par <fonction> le <date> » et continuer. Personne n'engage rien aujourd'hui, et un projet daté circule mieux qu'une intention.",
          },
          {
            situation: "Une table écrit une procédure de huit pages.",
            parade:
              "Leur faire souligner ce qu'un auditeur ouvrirait, et couper le reste. Une procédure qui ne se lit pas ne s'applique pas.",
          },
        ],
        planB:
          "La trame en cinq parties est papier et l'atelier se tient intégralement au stylo, les trois pièces à reverser étant elles-mêmes dans la pochette. C'est l'atelier à préserver en priorité si le réseau tombe : c'est le livrable qui reste au site.",
      },
    },
    verification: {
      question:
        "Contrôle croisé en binôme sur la grille de relecture fournie, sur la procédure de l'autre : le périmètre autorisé est-il borné, avec des usages nommés ? la liste rouge est-elle reprise et complète ? qui valide est-il désigné par fonction et non par prénom ? les traces à conserver sont-elles listées, avec l'endroit où on les range ? la conduite à tenir en cas de doute est-elle une action exécutable ? Corrigez immédiatement ce qui manque, avant de sortir de la salle.",
      reponseAttendue:
        "Les cinq points cochés sur chaque procédure et les manques corrigés dans la foulée. Le corrigé signale les trois faiblesses les plus fréquentes : un périmètre défini par ce qui est interdit et jamais par ce qui est permis, un valideur nommé par prénom, et une conduite en cas de doute réduite à un principe de vigilance.",
      dureeMin: 25,
      notes: {
        script:
          "La reprise se fait DANS le module, pas « au bureau la semaine prochaine » : c'est le dernier moment où ils sont ensemble avec les pièces sous la main. Vérifiez vous-même, en passant, qu'aucun prénom n'apparaît dans le circuit de validation. Terminez en faisant lire à voix haute la conduite à tenir en cas de doute de deux ou trois procédures : celles qui ne sont pas exécutables s'entendent immédiatement.",
        faq: [
          {
            question: "Notre valideur, c'est vraiment une personne, on est huit sur le site.",
            reponse:
              "Alors écrivez sa fonction : « le responsable qualité du site ». Le poste survit, la personne change — et c'est la procédure qui doit survivre.",
          },
        ],
        blocages: [
          {
            situation: "Un binôme s'est autovalidé sans rien relever.",
            parade:
              "Leur demander de vous lire la conduite à tenir en cas de doute. Si ce n'est pas une action exécutable, l'écart est trouvé et la relecture reprend.",
          },
        ],
        planB:
          "Grille de relecture et corrigé imprimés dans le kit. La vérification se fait au stylo sur les procédures, y compris manuscrites : aucun outil n'est en jeu.",
      },
    },
    synthese: {
      acquis: [
        "Je dispose d'une procédure d'usage écrite, où les responsables sont désignés par fonction.",
        "J'y ai reversé la liste rouge du site, la règle de revalidation des écrits à portée sécurité et la grille de qualification des suivis.",
        "Je remonte ce que je ne peux pas trancher sous forme de questions écrites, adressées à une fonction.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites ranger la procédure dans le dossier nommé hier soir et faites cocher la liste : sept pièces. Dites la phrase du module — ce qui tient dans le temps, c'est une procédure datée et validée, pas une habitude individuelle. Annoncez le dernier module : évaluation des acquis, tri de ce qui est diffusable, et feuille de route.",
        faq: [],
        blocages: [
          {
            situation: "Il est tard et la salle veut partir avant la pause.",
            parade:
              "Annoncer la durée exacte du dernier module et son contenu : l'évaluation des acquis s'y tient et elle ne se remplace pas. Une salle qui sait combien de temps il reste attend.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 8 — Évaluation, revue des productions et feuille de route (A-m J2)
  // ⚠️ Le catalogue place la VÉRIFICATION (quiz) AVANT les deux séquences de
  //    pratique : cet ordre est délibéré, il empêche l'évaluation de sauter.
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-8",
    objectif: {
      enonce:
        "À la fin de ce module, vous savez lesquelles de vos productions des deux jours sont diffusables en l'état, lesquelles repassent par la qualité ou par le référent QSE, et par quoi vous commencez lundi.",
      objectifGlobalId: "obj-5",
      // Le tri avant diffusion est la dernière application de l'objectif :
      // toute pièce portant un paragraphe surligné au module 3 va en pile
      // « référent QSE ». L'évaluation des acquis qui ouvre le module porte en
      // outre sur les régimes d'usage, la liste rouge, la vérification aux
      // sources et la qualification des dispositifs de suivi.
      objectifsSecondairesIds: ["obj-1", "obj-2", "obj-6", "obj-8"],
      dureeMin: 5,
      notes: {
        script:
          "Annoncez l'ordre inhabituel du module et TENEZ-LE : l'évaluation des acquis d'abord, la revue et la feuille de route ensuite. Si vous inversez, l'évaluation saute faute de temps — c'est ce qui arrive dans la moitié des sessions et c'est la première chose qu'un auditeur regarde. Rappelez que rien de ce qui a été produit n'est diffusable tant que personne ne l'a validé, et que le module sert précisément à le trier.",
        faq: [
          {
            question: "On repart avec quelque chose d'utilisable, finalement ?",
            reponse:
              "Sept pièces, dont une partie utilisable lundi et le reste soumis à validation. C'est exactement ce que le tri de tout à l'heure va établir, pièce par pièce.",
          },
        ],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "On garde la conversation avec l'assistant comme si elle prouvait quelque chose — ou bien on ne garde rien du tout, et six mois plus tard le travail se refait sans que personne sache ce qui avait été décidé ni pourquoi.",
      apres:
        "On passe la même demande trois fois de suite devant la salle : trois textes différents sortent, sans qu'on ait rien changé. On en tire la règle de conservation du site — ce qui s'enregistre, c'est le document validé et sa trace de validation, jamais la conversation qui l'a produit.",
      prompt:
        "Rédige le paragraphe « action corrective » de la fiche de non-conformité ci-jointe, en cinq lignes maximum, à partir des seuls éléments écrits dans la fiche. Ne propose aucune action qui ne découle pas d'un élément de la fiche, et n'invente ni délai ni responsable.",
      outil: "Un seul outil, celui autorisé sur le site.",
      captureEcran:
        "Les trois sorties de la même demande, numérotées 1, 2 et 3, avec les formulations divergentes surlignées d'une même couleur.",
      verifieLe: VERIFIE_LE,
      dureeMin: 15,
      notes: {
        script:
          "Lancez la même demande trois fois de suite, sans rien changer, et affichez les trois sorties côte à côte. Demandez alors : « laquelle est la bonne ? ». Le silence répond. Enchaînez sur ce que cela implique côté système documentaire : une production d'IA n'est pas reproductible, donc ce n'est pas un enregistrement et elle ne prouve rien. Ce qui s'archive, c'est le document validé, qui l'a validé et quand. Faites recopier cette règle dans la procédure d'usage écrite juste avant — deux minutes suffisent et elle y manque presque toujours.",
        faq: [
          {
            question: "Faut-il garder les conversations pour prouver qu'on a utilisé l'IA ?",
            reponse:
              "Non : elles ne prouvent rien, on vient de le voir. Ce qui se conserve, c'est le document validé, qui l'a validé et quand.",
          },
          {
            question: "Alors à quoi sert la traçabilité qu'on écrit depuis hier ?",
            reponse:
              "À prouver que la décision est humaine et datée. C'est la trace de VALIDATION qui compte, pas la trace de la machine.",
          },
        ],
        blocages: [
          {
            situation: "Les trois sorties sont quasiment identiques.",
            parade:
              "Relancer en changeant l'ordre des pièces jointes ou en ajoutant « sois plus direct ». Si la salle reste sceptique, le kit contient trois sorties d'une même demande, datées, divergences surlignées.",
          },
        ],
        planB:
          "Les trois sorties de la même demande sont imprimées dans le kit, datées et surlignées. Distribuées côte à côte, elles produisent exactement le même effet : la salle cherche la bonne et ne la trouve pas.",
      },
    },
    pratique: {
      consigne:
        "Deux temps chronométrés. D'abord, sortez les sept productions des deux jours et classez-les à la grille de contrôle avant diffusion en trois piles : diffusable en l'état, repasse par la qualité, repasse par le référent QSE — et écrivez en face de chacune ce qui manque pour la faire passer. Ensuite, rédigez la feuille de route du site sur la trame fournie : trois usages priorisés, un porteur par fonction et une échéance par ligne, et ce qui doit passer devant la direction et devant les représentants du personnel avant tout déploiement. Chaque participant lit sa feuille de route à voix haute.",
      aEmporter:
        "Les sept productions triées en trois piles avec le manque écrit en face, et la feuille de route du site : trois usages, un porteur par fonction, une échéance, et ce qui passe devant la direction et les représentants du personnel.",
      dureeMin: 50,
      notes: {
        script:
          "Sur le tri : le réflexe de la salle est de tout mettre en « diffusable ». Passez et posez une seule question par pile — « qui l'a validé ? ». La pile fond. Tout écrit portant un paragraphe surligné au module 3 va en pile QSE, sans discussion. Sur la feuille de route : la lecture À VOIX HAUTE n'est pas décorative, c'est elle qui transforme une intention en engagement devant les collègues. Refusez les lignes sans fonction et sans date — « sur quel usage, et quelle semaine ? » — et ne passez pas au suivant tant que la réponse ne porte pas les deux. Photographiez le tableau des feuilles de route et envoyez-le au groupe.",
        faq: [
          {
            question: "Trois usages, ce n'est pas un peu peu ?",
            reponse:
              "C'est trois de plus que ce qui tourne aujourd'hui. Un site qui tient trois usages six mois en installera dix ; un site qui en lance dix n'en tient aucun.",
          },
          {
            question: "Et si mon responsable ne valide rien ?",
            reponse:
              "Alors votre première ligne de feuille de route est de lui présenter la procédure d'usage, avec une date. C'est un usage prioritaire à part entière.",
          },
        ],
        blocages: [
          {
            situation: "Un participant classe tout en diffusable pour ne pas avoir à demander.",
            parade:
              "Lui demander le nom de la fonction qui a validé sa fiche de non-conformité. Il n'y en a pas. Le classement se corrige seul, sans commentaire de votre part.",
          },
          {
            situation: "Les engagements restent vagues : « je vais essayer d'utiliser l'IA ».",
            parade:
              "Reformuler en une question : « sur quel document, et quelle semaine ? ». Ne pas passer au suivant tant que la réponse ne porte pas une fonction et une date.",
          },
        ],
        planB:
          "Aucun outil nécessaire : le tri se fait sur les productions papier sorties de la pochette, la feuille de route se remplit au stylo sur la trame, et la lecture à voix haute ne dépend de rien. Gardez ces cinquante minutes entières même si tout le reste a été dégradé — c'est ce bloc qui décide de ce qui se passera lundi.",
      },
    },
    verification: {
      question:
        "Évaluation des acquis : quiz individuel de dix questions couvrant les trois régimes d'usage, la liste rouge du site, la règle de revalidation des écrits à portée sécurité, la vérification aux sources et la qualification des dispositifs de suivi. Correction commentée en salle, question par question.",
      reponseAttendue:
        "Le corrigé est repris question par question, sans en passer aucune. Si le temps manque, les questions portant sur les écrits à portée sécurité et sur la qualification des suivis sont commentées en premier. Le seuil de réussite est celui déclaré au programme ; en dessous, la reprise individuelle prévue au dispositif est déclenchée.",
      dureeMin: 20,
      notes: {
        script:
          "C'est l'évaluation des acquis au sens de l'indicateur 11 : elle se tient, elle se corrige, elle se conserve. Ne la sacrifiez jamais au temps qui manque — si vous êtes en retard, coupez dans la revue des productions, pas ici. Dix minutes de réponse en silence, dix minutes de correction commentée. Ramassez les copies : c'est une pièce du dossier de la session.",
        faq: [
          {
            question: "Le résultat part chez mon employeur ?",
            reponse:
              "Le résultat individuel, non. Ce qui est transmis, c'est l'attestation de fin de formation et le fait que l'évaluation a eu lieu.",
          },
          {
            question: "Une question porte sur un cas qui me concerne vraiment chez nous.",
            reponse:
              "Notez-la à part : je ne me prononce pas sur votre cas, votre référent QSE tranchera. Le quiz porte sur la règle, pas sur votre site.",
          },
        ],
        blocages: [
          {
            situation: "Il est 16 h 40 et le quiz n'est pas commencé.",
            parade:
              "Le tenir quand même, en réduisant le commentaire aux trois questions les plus ratées. On ne remplace jamais l'évaluation des acquis par un tour de table.",
          },
        ],
        planB:
          "Quiz et corrigé sont imprimés dans le kit — c'est d'ailleurs la version normale : le quiz se tient sur papier et aucun outil n'est en jeu.",
      },
    },
    synthese: {
      acquis: [
        "Je sais ce qui sort de mon site et sous quel régime, et je ne fais produire ni écrit de sécurité ni paramètre de process.",
        "Je produis des documents opposables — fiche tracée, réponse prouvée, revue d'écart sourcée — et non des brouillons.",
        "Je repars avec une procédure d'usage écrite et une feuille de route à trois lignes, portées par des fonctions et datées.",
      ],
      dureeMin: 10,
      notes: {
        script:
          "Reprenez le tableau des documents noté au module 1, celui du tour de table : montrez ce que les deux jours ont couvert, et dites franchement ce qu'ils n'ont pas couvert — l'analyse de données brutes de production et le prototypage d'une automatisation n'ont pas été faits. Dites-le plutôt que de le laisser croire : l'honnêteté sur ce point achète la crédibilité de tout le reste. Terminez par la vérification du dossier — sept pièces, nommées, dans une pochette qui repart avec eux.",
        faq: [
          {
            question: "On peut vous rappeler si on bloque ?",
            reponse:
              "Les modalités de suivi figurent dans votre convocation. Ce qui vous débloquera le plus vite, c'est votre propre procédure d'usage : elle a été écrite pour ça.",
          },
        ],
        blocages: [
          {
            situation: "La salle demande une formation de suite sur l'automatisation.",
            parade:
              "Noter la demande et la transmettre, sans rien promettre en séance : ce n'est pas au formateur d'engager le catalogue ni un tarif.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },
];
