/**
 * CONTENU RÉDIGÉ — « IA pour le BTP » (1 jour, 7 h, 4 modules).
 *
 * ## Le fil rouge
 *
 * Chacun repart avec UN dossier « prêt à envoyer » : trois pièces réelles de
 * son chantier en cours — un compte-rendu, un courrier qui engage, une pièce
 * d'appel d'offres ou de synthèse — chacune passée à sa grille de contrôle
 * avant envoi. Le module 1 installe les gestes du terrain (dicter, photographier,
 * déposer) et la règle de la journée, le module 2 produit les écrits qui
 * engagent, le module 3 affronte les inventions de l'outil sur les appels
 * d'offres, le module 4 assemble et date les usages. L'ordre est l'enseignement.
 *
 * ## La règle de la journée, répétée telle quelle
 *
 * **L'IA rédige, elle ne chiffre pas, elle ne décide pas.** Prix de revient,
 * marges, coefficients, bibliothèque de prix, DPGF, contrats de sous-traitance
 * et coordonnées clients ne sortent JAMAIS de l'entreprise — et retirer le nom
 * ne suffit pas quand l'adresse du chantier reste.
 *
 * ## Trois interdits que le formateur ne négocie pas
 *
 * **La sécurité ne se produit jamais à l'IA.** Plan de prévention, PPSPS,
 * analyse de risques, consigne : l'outil peut reformuler un document DÉJÀ
 * validé, il n'en crée aucun. Un stagiaire qui essaie est arrêté, sans
 * discussion — c'est l'un des enseignements de la journée.
 *
 * **Aucun tri de personnes.** Candidats, intérimaires, compagnons : l'IA ne
 * trie, ne classe, ne note personne.
 *
 * **Le formateur n'arbitre aucune question juridique ou normative.** Norme,
 * DTU, CCAG, règle de sécurité : le texte s'ouvre, se fournit, se cite — jamais
 * de mémoire, jamais depuis l'outil. La formule est écrite et se prononce telle
 * quelle : « je ne me prononce pas, notez la question, votre référent
 * tranchera ».
 *
 * ⚠️ Les listes du kit citées dans les blocs `cadre` (écrits qui engagent,
 * mentions du descriptif de devis, bornes marché public) sont fournies au
 * formateur SOURCÉES ET DATÉES, se lisent telles quelles, et restent à faire
 * relire par le conseil de l'organisme.
 */

import type { EnrichissementFormation } from "./types";

/** Date de dernière vérification des captures et sorties d'outils. */
const VERIFIE_LE = "2026-08-06";

export const IA_POUR_LE_BTP: EnrichissementFormation = [
  // ───────────────────────────────────────────────────────────────────────────
  // Module 1 — Ce que l'IA écrit sur un chantier, ce qu'elle ne chiffre jamais
  // et ce qu'elle ne décide pas
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-1",
    objectif: {
      enonce:
        "À la fin de ce module, vous transformez des notes dictées sur le terrain en un compte-rendu diffusable, et vous nommez ce qui ne sort jamais de l'entreprise AVANT de coller quoi que ce soit dans un outil.",
      objectifGlobalId: "obj-1",
      // Le module pose aussi la règle de confidentialité qui tient la journée —
      // prix, marges, clients, sous-traitance ne sortent pas — et la fait
      // contrôler sur la production du binôme au contrôle croisé : « qu'est-ce
      // qui n'aurait jamais dû être collé dans l'outil ? » (obj-2).
      objectifsSecondairesIds: ["obj-2"],
      dureeMin: 5,
      notes: {
        script:
          "Tour de table en UNE phrase : « votre prénom, votre poste, et le document qui vous retient au bureau le soir ». Notez chaque réponse au tableau — vous y reviendrez au module 4 pour montrer ce que la journée a couvert. Annoncez la règle de la journée, mot pour mot : l'IA rédige, elle ne chiffre pas, elle ne décide pas. Et annoncez le livrable : trois pièces réelles finalisées, avec leur grille de contrôle avant envoi.",
        faq: [
          {
            question: "On va pouvoir faire nos devis complets avec l'IA ?",
            reponse:
              "Le descriptif, oui — et le module 2 le fait. Le chiffrage, jamais : prix de revient, marges et bibliothèque de prix ne sortent pas de l'entreprise, et le logiciel de chiffrage reste le vôtre. L'IA rédige, elle ne chiffre pas.",
          },
          {
            question: "Je tape très mal au clavier, ça va coincer ?",
            reponse:
              "Non, et c'est prévu : la journée repose sur la dictée et la photo, pas sur le clavier. Deux minutes de dictée valent une demi-page tapée.",
          },
        ],
        blocages: [
          {
            situation: "Le tour de table dérive sur « l'IA va remplacer les métreurs ».",
            parade:
              "Couper en une phrase : « elle ne chiffre pas, donc non — et on le démontre toute la journée ». Écrire la crainte au tableau et la reprendre au module 4, une fois les limites vues.",
          },
        ],
        planB:
          "Aucun outil nécessaire ici. Sans vidéoprojecteur, le tour de table et la règle du jour se tiennent au paperboard sans rien perdre.",
      },
    },
    demonstration: {
      avant:
        "Le compte-rendu s'écrit le soir, au bureau, de mémoire : la version « sans IA » est chronométrée d'abord, sur les trois notes du kit — quarante-cinq minutes, et des détails déjà perdus entre le chantier et le clavier.",
      apres:
        "Les trois mêmes notes, dont une dictée EN DIRECT au téléphone, deviennent un compte-rendu structuré et diffusable en une dizaine de minutes — et chaque information manquante est marquée « à compléter » au lieu d'être inventée.",
      prompt:
        "Voici trois notes de chantier dictées telles quelles en fin de journée, sans ponctuation ni mise en forme. Rédige un compte-rendu de chantier diffusable aux intervenants.\nStructure imposée : chantier et date · présents · avancement par lot · points de blocage · décisions prises · actions à suivre, chacune avec un responsable et une échéance.\nRègles : n'utilise que ce qui figure dans les notes ; si une information manque (nom, date, lot, échéance), écris « à compléter » sans l'inventer ; aucun montant, aucun engagement de délai que les notes ne portent pas ; phrases courtes, ton factuel.\nLes trois notes dictées sont collées à la suite de ce message.",
      outil: "Un seul outil, celui validé dans la salle (Claude ou ChatGPT selon le groupe).",
      captureEcran:
        "Les notes dictées brutes à gauche, le compte-rendu structuré à droite, avec les « à compléter » surlignés — ce sont eux qui prouvent que rien n'a été inventé.",
      verifieLe: VERIFIE_LE,
      dureeMin: 15,
      notes: {
        script:
          "Dictez la troisième note EN DIRECT, debout, téléphone à la main, comme en sortant d'un chantier — hésitations et bruit compris : la salle doit voir qu'une dictée imparfaite suffit. Faites tenir le chronomètre par un stagiaire, sur les deux versions : le gain affiché vient de là, pas d'une promesse. Terminez sur les « à compléter » : c'est la sortie honnête, celle qui ne ment pas sur ce que les notes ne portaient pas.",
        faq: [
          {
            question: "Avec l'accent et les termes de métier, la dictée va suivre ?",
            reponse:
              "Oui — banche, cueillie, calfeutrement passent. Il restera deux ou trois mots à corriger, et corriger deux mots est toujours plus rapide que tout taper.",
          },
          {
            question: "Pourquoi interdire les montants dans le compte-rendu ?",
            reponse:
              "Parce que l'outil les remplit, plausiblement et faux — et qu'un montant faux dans un compte-rendu diffusé engage l'entreprise. Ce que vous n'avez pas vérifié dans vos documents, vous ne le laissez pas écrire.",
          },
        ],
        blocages: [
          {
            situation: "La dictée en direct transcrit mal — bruit de salle, débit trop rapide.",
            parade:
              "L'incident est utile : montrez la correction en trente secondes, c'est le geste réel du terrain. Si la transcription est inutilisable, la note dictée figure en transcription dans le kit — basculez dessus sans commentaire.",
          },
          {
            situation:
              "Un stagiaire veut refaire la démonstration avec ses notes à lui, tout de suite.",
            parade:
              "Promettre et tenir : c'est exactement l'atelier qui suit, dans dix minutes, sur ses propres notes. Ne pas casser le déroulé de la démonstration.",
          },
        ],
        planB:
          "Réseau absent ou quota atteint : la transcription des trois notes et le compte-rendu produit sont imprimés dans le kit, datés. La comparaison chronométrée se tient sur papier ; la dictée en direct se reporte à l'atelier suivant.",
      },
    },
    pratique: {
      consigne:
        "Deux temps. D'abord les trois gestes du terrain, chacun sur SON téléphone, chronométré : dicter deux minutes de notes comme en fin de journée, photographier une page de carnet ou un tableau de planning, déposer un plan ou un PDF — puis vérifier ce que l'outil en a réellement lu. Ensuite, chronométré : transformez vos propres notes de chantier de la semaine — dictées ou photographiées — en un compte-rendu structuré et diffusable, sur la trame projetée. Aucun prix, aucune marge, aucune coordonnée client dans ce que vous collez.",
      aEmporter:
        "Votre premier compte-rendu produit depuis vos propres notes, la trame de prompt réutilisable, et la parade des trois échecs classiques — photo floue, plan scanné de travers, PDF image sans texte.",
      dureeMin: 35,
      notes: {
        script:
          "Annoncez les trois causes d'échec AVANT que quiconque échoue : photo floue, plan scanné de travers, PDF image sans texte reconnu. La parade de chacune est sur le support. Un stagiaire qui échoue sans avoir été prévenu se referme pour la journée ; prévenu, il vous appelle. Après chaque dépôt, faites vérifier ce que l'outil a lu : « recopie le titre et les trois premières lignes » — avant toute question. Passez dans les rangs, relancez sur la structure, ne rédigez rien à la place de personne. Rappelez à voix haute avant les collages : pas de prix, pas de client.",
        faq: [
          {
            question: "Je n'ai pas de notes de chantier de la semaine sur moi.",
            reponse:
              "Le kit fournit un jeu de notes de chantier de secours. Vous travaillez dessus — pas en regardant le voisin travailler.",
          },
          {
            question: "Ma photo de tableau de planning ressort illisible.",
            reponse:
              "Cadrez colonne par colonne plutôt que le tableau entier, et demandez « reconstitue ce tableau en texte, ligne par ligne ». C'est la parade n° 2 de votre support.",
          },
        ],
        blocages: [
          {
            situation:
              "Un stagiaire colle un extrait de devis avec prix de revient « pour aller plus vite ».",
            parade:
              "Arrêter immédiatement, faire supprimer la conversation, rappeler la règle en une phrase : les prix ne sortent pas de l'entreprise. C'est LE manquement que la journée enseigne à éviter — on ne discute pas.",
          },
          {
            situation: "Le réseau de la salle sature au moment des dépôts simultanés.",
            parade:
              "Faire démarrer par vagues de cinq, en l'annonçant comme une consigne d'atelier, pas comme un incident.",
          },
        ],
        planB:
          "Sans réseau : les trois gestes se démontrent sur les captures du kit, et le compte-rendu s'écrit à la main sur la trame papier — présents, avancement par lot, blocages, décisions, actions. La structure est l'enseignement, l'outil n'est que l'exécutant ; chacun relance chez lui avec la trame datée.",
      },
    },
    verification: {
      question:
        "Contrôle croisé en binôme, cinq minutes minutées par relecteur, grille fournie : dans le compte-rendu de l'autre, qu'est-ce qui manque pour qu'il soit diffusable ? qu'est-ce que l'outil a ajouté que les notes ne portaient pas ? et qu'est-ce qui n'aurait jamais dû être collé dans l'outil ?",
      reponseAttendue:
        "Les trois colonnes de la grille remplies : les manques passent en « à compléter », toute invention est barrée, et tout collage interdit est nommé à voix haute — c'est la colonne qui compte le plus.",
      dureeMin: 10,
      notes: {
        script:
          "Tenez le minuteur vous-même : cinq minutes par relecteur, changement annoncé à voix haute. Exigez de chaque binôme AU MOINS un écart remonté à l'oral — la grille vide n'existe pas. Projetez ensuite deux ou trois écarts répétés dans la salle, pas plus.",
        faq: [
          {
            question: "On note ? Ça compte pour l'évaluation ?",
            reponse:
              "Non. L'évaluation des acquis est en fin de journée, sur dix questions. Ici on repère ce qui coince pendant qu'on peut encore le corriger.",
          },
        ],
        blocages: [
          {
            situation: "Les binômes se valident mutuellement sans rien relever.",
            parade:
              "Annoncer que chaque binôme remonte au moins un écart et que vous en demanderez un à l'oral. La complaisance tombe immédiatement.",
          },
        ],
        planB:
          "La grille est imprimée dans le kit et le contrôle croisé ne dépend d'aucun outil. Sans vidéoprojecteur, les écarts se commentent à l'oral.",
      },
    },
    synthese: {
      acquis: [
        "Je dicte mes notes sur place et j'en fais un compte-rendu diffusable sans y passer la soirée.",
        "Je fais marquer « à compléter » plutôt que de laisser l'outil inventer.",
        "Je sais ce qui ne se colle jamais : prix, marges, coordonnées clients, pièces de sous-traitance.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites FORMULER, ne récitez pas : « en une phrase, qu'est-ce que vous ne collerez plus jamais dans un outil ? ». Trois réponses suffisent. Annoncez la pause et la suite : les écrits qui engagent — constat de retard, réserves, courriers au maître d'œuvre.",
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
  // Module 2 — Comptes-rendus, courriers de chantier et pièces qui engagent
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-2",
    objectif: {
      enonce:
        "À la fin de ce module, vous produisez un courrier de chantier qui protège l'entreprise — constat de retard, relance de sous-traitant, demande d'avenant — et vous reconnaissez une pièce qui engage avant de l'envoyer.",
      objectifGlobalId: "obj-3",
      // L'atelier produit deux pièces : le courrier qui engage, et un
      // compte-rendu du chantier en cours (obj-1). La vérification fait barrer
      // au stylo toute référence contractuelle que l'auteur n'a pas recopiée
      // pièce du marché en main (obj-4).
      objectifsSecondairesIds: ["obj-1", "obj-4"],
      dureeMin: 5,
      notes: {
        script:
          "Annoncez la bascule : le module 1 produisait des écrits d'information, ceux-ci ont des conséquences — un constat de retard se retrouve dans un dossier de réclamation deux ans plus tard. C'est pour cela que la relecture change de nature : on ne relit plus pour la forme, on relit ce que la pièce fera dire à l'entreprise.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "Le constat de retard écrit à chaud, tel qu'il part vraiment : accusateur, sans dates précises, mêlant faits et opinions — le jour où le dossier sort, c'est lui qui dessert l'entreprise qui l'a envoyé.",
      apres:
        "Les mêmes faits, structurés : datés, sourcés, sans accusation, avec une demande claire et une formule qui réserve les droits sans les chiffrer. Les deux textes sont dans le kit et se lisent côte à côte — mêmes événements, deux effets.",
      prompt:
        "Tu m'aides à rédiger un courrier de chantier. Contexte : entreprise de gros œuvre, chantier de douze logements, le lot plomberie n'a pas libéré la zone prévue au planning et notre équipe n'a pas pu couler la dalle du R+1 à la date convenue.\nRédige un constat factuel destiné au maître d'œuvre, avec copie à l'OPC : rappel du planning contractuel (référence exacte laissée « à compléter » — je la recopierai depuis la pièce du marché), faits constatés avec leurs dates, conséquence sur notre avancement, demande de position sous délai.\nRègles : aucun ton accusateur, aucune menace, aucune qualification juridique, aucun montant ; uniquement des faits que je peux prouver ; termine par une formule qui réserve nos droits sans les chiffrer. Je relis, je complète les références et je signe.",
      outil: "Un seul outil, celui validé dans la salle.",
      captureEcran:
        "Les deux courriers côte à côte : les formulations accusatoires du premier surlignées, et en regard les faits datés du second.",
      verifieLe: VERIFIE_LE,
      dureeMin: 15,
      notes: {
        script:
          "Lisez le mauvais courrier à voix haute D'ABORD, et demandez : « qui a déjà envoyé celui-là ? ». Des mains se lèvent — c'est le moment du module. Puis montrez la version factuelle et pointez les trois différences : les dates, la séparation faits/opinions, la formule finale. Insistez : l'outil structure les faits, mais la référence au planning contractuel se recopie depuis la pièce du marché, et la décision d'envoyer reste à vous.",
        faq: [
          {
            question: "On peut laisser l'outil citer l'article du CCAG applicable ?",
            reponse:
              "Non. Une référence contractuelle ou réglementaire ne se cite jamais de mémoire d'outil : vous ouvrez votre pièce du marché et vous recopiez la référence vous-même. En cas de doute sur le fond, je ne me prononce pas — notez la question, votre référent tranchera.",
          },
          {
            question: "Un constat envoyé par mail, ça vaut quelque chose ?",
            reponse:
              "Je ne me prononce pas sur la valeur juridique — notez la question, votre référent tranchera. Ce que la journée vous donne, c'est un contenu factuel et daté, quel que soit le canal choisi.",
          },
        ],
        blocages: [
          {
            situation:
              "La salle part en débat juridique sur les réserves et les délais de contestation.",
            parade:
              "Formule exacte, prononcée telle quelle : « je ne me prononce pas, notez la question, votre référent tranchera ». Écrire la question au tableau — la liste des questions ouvertes est une production utile de la journée.",
          },
        ],
        planB:
          "Les deux courriers sont imprimés dans le kit, datés : la lecture comparée se tient intégralement sur papier, surlignage compris.",
      },
    },
    pratique: {
      consigne:
        "Atelier chronométré, deux pièces sur les trames fournies : un compte-rendu de votre chantier en cours, puis un courrier qui engage — au choix : constat de retard, relance de sous-traitant, demande d'avenant après un imprévu. Pour la pièce qui engage : les faits, les dates et les destinataires viennent de VOS notes ; toute référence contractuelle reste « à compléter » tant que la pièce du marché n'est pas sous vos yeux ; aucun montant ne se colle ni ne se demande à l'outil.",
      aEmporter:
        "Deux pièces prêtes à relecture — un compte-rendu et un courrier qui engage — plus les listes du kit remises imprimées et datées : les écrits qui engagent, et les mentions du descriptif de devis bâtiment.",
      dureeMin: 50,
      notes: {
        script:
          "Les deux listes du kit — écrits qui engagent, mentions obligatoires du descriptif de devis — se LISENT TELLES QUELLES, sans improviser ni compléter en salle. Annoncez le découpage : vingt-cinq minutes par pièce, top à mi-parcours à voix haute. Passez en priorité voir ceux qui écrivent un constat de retard : c'est la pièce dont le ton dérape le plus vite. Quand un texte accuse, une seule question : « qu'est-ce que vous pouvez prouver, et avec quelle date ? ».",
        faq: [
          {
            question: "Mon courrier doit vraiment partir ce soir — je peux l'envoyer tel quel ?",
            reponse:
              "Non. L'atelier produit un projet : il passe par la relecture que votre feuille de route désignera au module 4. Un courrier qui engage part relu, ou ne part pas.",
          },
          {
            question: "L'outil m'a proposé un délai de mise en demeure de huit jours.",
            reponse:
              "Supprimez-le. Un délai juridique ne vient jamais de l'outil — notez la question, votre référent tranchera avec le texte applicable sous les yeux.",
          },
        ],
        blocages: [
          {
            situation: "Un stagiaire n'a aucun courrier qui engage en cours sur son chantier.",
            parade:
              "Le kit fournit un scénario complet — retard du lot plomberie, avec ses notes datées. Il travaille dessus, sur les mêmes trames.",
          },
          {
            situation:
              "Un stagiaire colle le contrat de sous-traitance « pour que l'outil comprenne le contexte ».",
            parade:
              "Arrêt immédiat, suppression de la conversation, rappel en une phrase : les pièces de sous-traitance ne sortent pas de l'entreprise. Les faits utiles se dictent, le contrat reste dans le classeur.",
          },
        ],
        planB:
          "Les deux trames s'écrivent à la main : la structure du compte-rendu et le squelette du courrier — faits datés · référence à compléter · demande · formule de réserve — sont sur papier dans le kit. La passe par l'outil se rejoue chez soi, la trame est datée.",
      },
    },
    verification: {
      question:
        "Contrôle croisé en binôme, grille fournie : chaque fait est-il vérifiable et sa source notée ? les dates sont-elles complètes ? les destinataires et copies sont-ils les bons ? les mentions attendues y sont-elles ? le ton reste-t-il strictement factuel — aucune accusation, aucune menace, aucune qualification juridique ?",
      reponseAttendue:
        "La grille cochée sur les deux pièces, écarts repris en salle. Les trois plus fréquents : l'opinion glissée dans un fait, la date absente, et la référence contractuelle citée de mémoire — celle-là se barre systématiquement.",
      dureeMin: 15,
      notes: {
        script:
          "Faites barrer physiquement, au stylo, toute référence que l'auteur n'a pas recopiée pièce en main. Reprenez en salle deux ou trois écarts répétés, pas plus — le reste se lit sur le corrigé. Le geste du barrage vaut le discours.",
        faq: [
          {
            question: "L'outil a mis une date que j'avais bien dictée, je la garde ?",
            reponse:
              "Oui — mais vous venez de la VÉRIFIER contre vos notes. Ce n'est plus l'outil qui l'affirme, c'est vous. C'est toute la différence.",
          },
        ],
        blocages: [
          {
            situation: "Les copies sont trop propres, rien n'est relevé.",
            parade:
              "Projeter le courrier volontairement chargé du kit et faire barrer collectivement — l'œil se règle en trois minutes, puis refaire une passe sur les copies du binôme.",
          },
        ],
        planB: "Grille et corrigé imprimés dans le kit. Aucun outil nécessaire.",
      },
    },
    synthese: {
      acquis: [
        "Je transforme mes notes en pièce diffusable : faits datés, sources notées, ton factuel.",
        "Je reconnais un courrier qui engage, et il ne part jamais sans la relecture prévue.",
        "Une référence contractuelle se recopie depuis la pièce du marché, jamais depuis l'outil.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites formuler l'acquis du module par deux ou trois stagiaires, puis annoncez l'après-midi en une phrase : « les appels d'offres — là où l'outil invente le plus, et où une invention envoyée est une fausse déclaration ». Libérez pour le déjeuner à l'heure.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 3 — Appels d'offres, pièces techniques et documents de sécurité
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-3",
    objectif: {
      enonce:
        "À la fin de ce module, vous dégrossissez une trame de mémoire technique et vous faites répondre une pièce technique à vos questions — sans laisser passer une seule affirmation que vos documents ne prouvent pas.",
      objectifGlobalId: "obj-6",
      // Le premier temps de l'atelier fait parler CCTP, notice ou règlement de
      // consultation — trois questions, la phrase exacte retrouvée dans le
      // document pour chacune (obj-5). Et la borne sécurité s'y applique : la
      // causerie se reformule à partir d'un document déjà validé, l'analyse de
      // risques se refuse net (obj-7).
      objectifsSecondairesIds: ["obj-5", "obj-7"],
      dureeMin: 5,
      notes: {
        script:
          "Posez les deux bornes de l'après-midi avant tout : en marché public, une référence inventée dans un mémoire est une fausse déclaration ; et la sécurité ne se produit jamais à l'IA — elle reformule un document validé, elle n'en crée aucun. Annoncez que le module ne va pas l'affirmer mais le DÉMONTRER, sur une sortie réelle.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "« Rédige la partie moyens humains de notre mémoire technique. » La sortie est fluide, assurée, professionnelle — et elle affirme des effectifs, des chantiers de référence et une certification que l'entreprise n'a pas. Rien ne la distingue visuellement d'un texte exact.",
      apres:
        "La même sortie, passée au repérage collectif ligne à ligne : chaque affirmation chiffrée ou nominative est surlignée, et pour chacune une seule question — quelle pièce de l'entreprise la prouve ? Ce qui n'a pas de pièce se barre, devant la salle.",
      prompt:
        "Rédige la partie « moyens humains et matériels » d'un mémoire technique pour un marché public de rénovation d'une école élémentaire en site occupé : entreprise de second œuvre, dix-huit salariés, lots peinture et sols souples. Mets en avant l'expérience de l'entreprise sur des chantiers en site occupé et ses références en bâtiments scolaires.",
      outil:
        "Un seul outil, celui validé dans la salle — la trace du kit (prompt et sortie complète) a été capturée sur ce même outil.",
      captureEcran:
        "La sortie complète du kit projetée, affirmations chiffrées et nominatives surlignées, avec en marge la pièce qui les prouverait — trois n'en ont aucune.",
      verifieLe: VERIFIE_LE,
      dureeMin: 10,
      notes: {
        script:
          "La démonstration se fait SUR LA TRACE CAPTURÉE du kit, jamais en direct : la trace est datée et contient exactement les inventions attendues. Une relance en direct est un bonus de fin de séquence, pas le support. Faites compter à main levée le nombre d'affirmations invérifiables trouvées, puis annoncez le compte réel — l'écart entre les deux est l'enseignement.",
        faq: [
          {
            question: "Si je lui donne nos vraies références, il n'inventera plus ?",
            reponse:
              "Il inventera moins — et c'est le piège : il complète les trous, plausiblement. La relecture pièce en main reste obligatoire, quelle que soit la qualité de ce que vous fournissez.",
          },
          {
            question: "Et sur un marché privé, c'est moins grave ?",
            reponse:
              "La règle de travail est la même : rien ne part sans la pièce qui le prouve. Sur la qualification juridique de l'écart, je ne me prononce pas — notez la question, votre référent tranchera.",
          },
        ],
        blocages: [
          {
            situation:
              "La salle demande si le règlement de la consultation autorise l'usage de l'IA sur le mémoire.",
            parade:
              "« Je ne me prononce pas, notez la question, votre référent tranchera » — et rappeler que le règlement de consultation se LIT : il est dans les pièces, la réponse s'y trouve ou ne s'y trouve pas.",
          },
        ],
        planB:
          "La démonstration EST son propre plan B : trace imprimée dans le kit, prompt et sortie complets, surlignage préparé. Aucune dépendance au direct ni au réseau.",
      },
    },
    pratique: {
      consigne:
        "Deux temps. D'abord, guidé : chargez un CCTP, une notice technique ou un règlement de consultation — le vôtre s'il est public et sans aucun prix, sinon celui du kit — posez-lui trois questions, puis retrouvez dans le document la phrase exacte qui fonde chaque réponse ; une réponse sans phrase retrouvée ne compte pas. Ensuite, atelier chronométré au choix selon votre poste : dégrossir la trame d'un mémoire technique sur le scénario du kit, synthétiser une pièce technique en une page pour l'équipe, rédiger une note d'avancement aux intervenants, ou reformuler une causerie sécurité À PARTIR d'un document déjà validé par votre entreprise — jamais en créer le contenu.",
      aEmporter:
        "Trois questions-réponses ancrées chacune sur une phrase du document source, et votre production au choix — trame de mémoire, synthèse d'une page, note d'avancement ou causerie reformulée — avec sa liste de vérifications pièce en main.",
      dureeMin: 63,
      notes: {
        script:
          "Installez la règle du doigt sur la phrase : une réponse de l'outil n'existe que lorsque le stagiaire a retrouvé la phrase source dans le document — main levée quand c'est fait, pas avant. Sur la causerie sécurité : vérifiez PHYSIQUEMENT que chaque stagiaire qui la choisit part d'un document validé — celui du kit à défaut. L'IA en reformule la forme, le fond ne bouge pas, et rien n'en part sans validation du responsable sécurité de l'entreprise. Rappelez avant les chargements : un document de consultation publique sans prix, oui ; un DPGF, jamais.",
        faq: [
          {
            question: "Je peux charger le DPGF aussi, il est dans le même dossier ?",
            reponse:
              "Non. Le DPGF porte vos prix : il ne sort pas de l'entreprise. Le CCTP et le règlement d'une consultation publique, oui — c'est toute la différence entre une pièce publiée et vos conditions.",
          },
          {
            question: "L'outil me répond des choses que le CCTP ne dit pas.",
            reponse:
              "C'est le test réussi : la réponse se jette. Reformulez en imposant « réponds uniquement d'après ce document et cite la phrase exacte ; si le document ne permet pas de répondre, dis-le ».",
          },
        ],
        blocages: [
          {
            situation:
              "Un stagiaire veut faire produire une analyse de risques « juste pour voir ».",
            parade:
              "Refus net, une phrase, que toute la salle entend : c'est l'un des interdits posés le matin — la sécurité ne se produit pas à l'IA, en formation pas plus qu'au bureau. Ne pas rouvrir le débat.",
          },
          {
            situation:
              "Le document chargé est un PDF image : l'outil ne lit rien mais répond quand même.",
            parade:
              "Ressortir la parade du module 1 : « recopie le titre et le premier paragraphe » AVANT toute question. Si rien ne revient, le document est à re-scanner ou à remplacer par celui du kit.",
          },
        ],
        planB:
          "Sans réseau : les trois questions se posent sur le CCTP papier du kit, au surligneur — chercher la phrase qui répond est exactement la compétence visée. L'atelier au choix s'écrit sur les trames papier ; la passe par l'outil se rejoue chez soi, trames datées.",
      },
    },
    verification: {
      question:
        "Contrôle croisé en binôme : dans la production de l'autre, cochez chaque affirmation chiffrée ou nominative — effectif, référence de chantier, certification, qualification, délai — et exigez la pièce de l'entreprise ou la phrase du document qui la prouve. Ce qui n'est retrouvé nulle part se barre à l'écran, devant le binôme.",
      reponseAttendue:
        "Chaque affirmation porte sa source, ou elle est barrée. Le corrigé du kit montre les trois inventions types d'un mémoire généré : la référence de chantier plausible, la certification approximative, l'effectif arrondi au-dessus.",
      dureeMin: 10,
      notes: {
        script:
          "Faites barrer À L'ÉCRAN, pas sur papier : le geste devant témoin marque davantage, et c'est celui qui devra se refaire au bureau avant chaque envoi. Nommez les trois inventions types seulement APRÈS que les binômes ont cherché.",
        faq: [],
        blocages: [
          {
            situation: "Un binôme ne trouve aucun écart dans une trame de mémoire générée.",
            parade:
              "Lui donner la production du kit qui en contient quatre. S'il n'en trouve toujours pas, refaire la lecture avec lui — l'œil n'est pas encore réglé, et c'est maintenant qu'il se règle.",
          },
        ],
        planB:
          "Grille et corrigé imprimés dans le kit ; le barrage se fait au surligneur sur papier.",
      },
    },
    synthese: {
      acquis: [
        "Rien ne part dans un mémoire sans la pièce qui le prouve — je barre ce que je ne retrouve pas.",
        "Je fais répondre une pièce technique à mes questions, phrase source à l'appui.",
        "Sur la sécurité, l'IA reformule un document validé — elle n'en crée jamais.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites redire la borne marché public par un stagiaire, avec ses mots. Annoncez la pause puis le dernier module en une phrase : « on assemble le dossier prêt à envoyer, et chacun repart avec ses trois usages datés ».",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 4 — Le dossier « prêt à envoyer » et ce qu'on installe lundi
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-4",
    objectif: {
      enonce:
        "À la fin de ce module, vous repartez avec trois pièces finalisées, leur grille de contrôle avant envoi renseignée, trois usages datés — et un usage que vous vous interdisez, par écrit.",
      objectifGlobalId: "obj-8",
      // Le premier temps relit les demandes de la journée et compte ce qui a
      // failli sortir de l'entreprise — un prix, une marge, un nom de client,
      // un salarié (obj-2) ; la synthèse referme sur ce qu'on ne fait jamais
      // faire à l'IA : chiffrer, produire la sécurité, trier des personnes
      // (obj-7).
      objectifsSecondairesIds: ["obj-2", "obj-7"],
      dureeMin: 5,
      notes: {
        script:
          "Reprenez le tableau du matin — le document qui retient chacun le soir — et montrez ce que la journée a couvert. Dites aussi honnêtement ce qu'elle n'a PAS couvert : le chiffrage et la planification elle-même restent au logiciel et à l'humain. Cette honnêteté achète la crédibilité de tout le reste.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "Une pièce « prête à partir », proposée par la salle, est envoyée comme elle l'aurait été hier : personne n'a vérifié qui la relit, ce qu'elle affirme, ni ce qu'elle laisse sortir de l'entreprise.",
      apres:
        "La même pièce passe la grille de contrôle avant envoi, en direct : en cinq minutes, quatre lignes se barrent — un chiffre sans source, une mention absente, un nom de client, un destinataire oublié.",
      prompt:
        "Voici une pièce prête à partir, collée ci-dessous, et ma grille de contrôle avant envoi. Passe la pièce à la grille, ligne par ligne : pour chaque affirmation chiffrée ou nominative, dis-moi où je dois la vérifier ; signale tout ce qui ne devrait pas sortir de l'entreprise — prix de revient, marge, coordonnées d'un client, nom d'un salarié, pièce de sous-traitance ; signale les mentions attendues qui manquent. Tu ne corriges rien, tu listes. La décision d'envoyer reste la mienne.",
      outil: "Un seul outil, celui validé dans la salle.",
      captureEcran:
        "La pièce projetée avec les quatre lignes barrées en direct, et la grille de contrôle cochée en regard.",
      verifieLe: VERIFIE_LE,
      dureeMin: 10,
      notes: {
        script:
          "Demandez une pièce VOLONTAIRE de la salle et masquez vous-même noms et montants AVANT de projeter — jamais après. Si personne ne se lance, la pièce du kit fait l'affaire, mais une pièce de la salle marque dix fois plus. Ordre des rôles à énoncer tel quel : l'outil pré-liste, la grille papier tranche, l'humain signe.",
        faq: [
          {
            question: "La grille, ce n'est pas encore de la paperasse en plus ?",
            reponse:
              "Cinq lignes, deux minutes par pièce. Le jour où un maître d'œuvre conteste un chiffre, c'est elle qui montre qui a vérifié quoi, et quand.",
          },
        ],
        blocages: [
          {
            situation:
              "La pièce volontaire contient un montant que son auteur n'avait pas vu avant de la donner.",
            parade:
              "C'est exactement la démonstration : remercier l'auteur, barrer la ligne, ne JAMAIS le reprendre devant la salle. On commente la pièce, pas la personne.",
          },
        ],
        planB:
          "La pièce du kit et sa grille pré-remplie sont imprimées : la passe se rejoue sur papier, au surligneur, ligne à ligne.",
      },
    },
    pratique: {
      consigne:
        "Trois temps. D'abord, relisez toutes VOS demandes de la journée dans l'outil et surlignez ce qui a failli sortir — un prix, une marge, un nom de client, un salarié : chacun compte les siens, seul le total de la salle s'affiche au tableau. Ensuite, finalisez vos trois pièces de la journée et renseignez pour chacune la grille de contrôle avant envoi : source de chaque fait, mentions vérifiées, ce qui ne sort pas, qui relit et qui signe. Enfin, écrivez votre feuille de route : trois usages datés avec la pièce concernée, un usage que vous vous interdisez, et le nom de la personne qui relit avant diffusion.",
      aEmporter:
        "Le dossier prêt à envoyer : trois pièces finalisées, leur grille de contrôle renseignée, et la feuille de route — trois usages datés, un usage écarté par écrit, un relecteur nommé.",
      dureeMin: 50,
      notes: {
        script:
          "Le comptage des « failli sortir » se fait en silence, puis SEUL le total anonyme s'affiche au tableau — le chiffre collectif frappe sans exposer personne. Sur la feuille de route, aucun « j'essaierai l'IA » : chaque usage porte une pièce, une date, un nom. Ne validez pas une feuille sans les trois. Sur les grilles : passez vérifier que la colonne « qui relit et qui signe » porte un NOM, pas une fonction.",
        faq: [
          {
            question: "L'usage interdit, c'est forcément la sécurité ?",
            reponse:
              "C'est le plus fréquent, mais choisissez le VÔTRE : celui qui vous tente et que la journée a montré risqué — le chiffrage, le tri d'intérimaires, la réponse juridique. Un interdit choisi tient mieux qu'un interdit récité.",
          },
          {
            question: "Qui doit relire — forcément mon chef ?",
            reponse:
              "Celui qui engage sa signature sur la pièce. Pour un devis, celui qui en répond ; pour un courrier au maître d'œuvre, celui qui le signe.",
          },
        ],
        blocages: [
          {
            situation:
              "Un stagiaire n'a pas trois pièces finalisables — les ateliers ont pris du retard.",
            parade:
              "Deux pièces réelles et la trame datée de la troisième valent mieux que trois bâclées. La grille se renseigne sur ce qui existe ; le reste part sur la feuille de route, avec sa date.",
          },
          {
            situation:
              "Les feuilles de route restent vagues : « je vais utiliser l'IA pour les CR ».",
            parade:
              "Reformuler en une question : « quelle pièce, quel jour, qui relit ? » — et ne pas passer au suivant tant que la réponse ne porte pas les trois.",
          },
        ],
        planB:
          "Presque rien ici ne dépend d'un outil : sans réseau, la liste des collages de la journée se reconstitue de mémoire en binôme — ce qui vaut exercice — et pièces, grilles et feuilles de route s'écrivent sur papier, sur les trames du kit.",
      },
    },
    verification: {
      question:
        "Validation des acquis : quiz individuel de dix questions, corrigé en salle question par question. Puis chacun passe une de ses propres pièces du jour à la grille de critères fournie — sources, mentions, confidentialité, ton, relecteur — et les écarts sont repris nominativement, pièce à l'écran.",
      reponseAttendue:
        "Le quiz corrigé sans sauter de question ; le seuil de réussite est celui déclaré au programme, et un score en dessous déclenche la reprise individuelle prévue au dispositif. Sur les pièces : chaque écart repris se corrige en direct — c'est la dernière passe avant l'envoi réel.",
      dureeMin: 20,
      notes: {
        script:
          "C'est l'évaluation des acquis au sens de l'indicateur 11 : elle se tient, se corrige et se conserve. Si le temps manque, coupez ailleurs — jamais ici. La reprise nominative se fait pièce à l'écran : on commente le document, jamais la personne.",
        faq: [
          {
            question: "Mon score sera transmis à mon employeur ?",
            reponse:
              "Le résultat individuel, non. Ce qui est transmis : l'attestation de fin de formation et le fait que l'évaluation a eu lieu.",
          },
        ],
        blocages: [
          {
            situation: "Il est 17 h et le quiz n'est pas commencé.",
            parade:
              "Le tenir quand même, en resserrant le commentaire du corrigé sur les questions les plus ratées. On ne remplace jamais l'évaluation par un tour de table.",
          },
        ],
        planB:
          "Quiz papier et corrigé dans le kit ; la passe des pièces à la grille se fait sur les impressions. Aucune dépendance à un outil.",
      },
    },
    synthese: {
      acquis: [
        "Je n'envoie une pièce qu'après sa grille de contrôle : sources, mentions, confidentialité, relecteur nommé.",
        "Mes trois prochains usages portent chacun une pièce, une date et un relecteur.",
        "Je sais ce que je ne ferai jamais faire à l'IA : chiffrer, produire la sécurité, trier des personnes.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Tour final, une phrase chacun : « la pièce que j'envoie demain ». Photographiez le tableau des usages datés et envoyez-le au groupe. Fermez sur la règle de la journée, mot pour mot : l'IA rédige, elle ne chiffre pas, elle ne décide pas.",
        faq: [],
        blocages: [
          {
            situation:
              "Un stagiaire conclut « donc l'IA ne sert à rien pour le chiffrage, dommage ».",
            parade:
              "Reprendre le chronométrage du matin : quarante-cinq minutes devenues dix sur un seul compte-rendu. Le temps rendu au terrain EST le gain — le chiffrage n'a jamais été la promesse.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },
];
