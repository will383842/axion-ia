/**
 * CONTENU RÉDIGÉ — « IA pour l'immobilier » (1 jour, 7 h, 4 modules).
 *
 * ## Le fil rouge
 *
 * Chaque agence repart avec SON dossier de trames vérifiées, construit pièce par
 * pièce au fil des quatre modules. Le module 1 produit l'annonce conforme qui ne
 * porte que ce que le dossier prouve, le module 2 la décline et installe les
 * réponses types aux prospects, le module 3 couvre les écrits de gestion et
 * l'argumentaire d'estimation — et pose la borne du métier : le tri de
 * locataires se refuse. Le module 4 assemble et date. Aucun module ne se suffit
 * à lui-même, et c'est voulu : l'ordre est l'enseignement.
 *
 * ## Trois règles que le formateur ne négocie pas
 *
 * **Aucune donnée de propriétaire, d'acquéreur, de locataire ou de prospect
 * n'entre dans un outil pendant la journée.** Mandats, offres reçues, dossiers
 * de candidats, échanges d'e-mails : tout cela reste dehors. Les ateliers
 * tournent sur les pièces du kit et sur les documents SANS donnée personnelle
 * (diagnostics, mesurages, règlements de copropriété). Un stagiaire qui colle
 * un mandat ou un e-mail de prospect est arrêté, sans discussion : la formation
 * ne peut pas provoquer le manquement qu'elle enseigne à éviter.
 *
 * **L'IA n'estime pas un bien et ne certifie aucun diagnostic.** Une surface,
 * un DPE, une charge, un prix se recopient depuis les documents du dossier —
 * jamais générés. L'outil rédige AUTOUR des chiffres que l'agent fournit et
 * vérifie ; un chiffre produit par l'IA se barre.
 *
 * **Le formateur n'arbitre aucune question juridique** (loi Hoguet, mandats,
 * baux, mentions obligatoires en litige). La formule est écrite, elle se
 * prononce telle quelle : « je ne me prononce pas, notez la question, votre
 * conseil tranchera ». Les trames remises portent un en-tête « Projet — à faire
 * valider par votre conseil avant diffusion » qui n'est pas retirable.
 *
 * ⚠️ Les références juridiques des séquences `cadre` (mentions obligatoires,
 * discrimination au logement, pièces exigibles, décision automatisée) sont
 * fournies au formateur SOURCÉES ET DATÉES dans le kit, et ne se citent jamais
 * de mémoire. Leur formulation reste à faire relire par le conseil de
 * l'organisme.
 */

import type { EnrichissementFormation } from "./types";

/** Date de dernière vérification des captures et sorties d'outils. */
const VERIFIE_LE = "2026-08-06";

export const IA_POUR_L_IMMOBILIER: EnrichissementFormation = [
  // ───────────────────────────────────────────────────────────────────────────
  // Module 1 — L'annonce qui vend et l'annonce qui expose
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-1",
    objectif: {
      enonce:
        "À la fin de ce module, vous produisez une annonce complète qui ne porte que ce que votre dossier prouve, et vous repérez la formulation qui décrit l'occupant au lieu du bien.",
      objectifGlobalId: "obj-1",
      dureeMin: 5,
      notes: {
        script:
          "Tour de table en UNE phrase, pas une par personne qui s'étale : « votre prénom, et l'écrit qui vous prend le plus de temps — l'annonce, les réponses aux prospects ou les courriers de gestion ». Notez chaque réponse au tableau, vous y reviendrez au module 4 pour montrer ce que la journée a couvert. Annoncez la règle qui tient la journée : l'IA rédige, le dossier prouve, l'humain publie. Et le livrable : chaque agence repart avec son dossier de trames vérifiées.",
        faq: [
          {
            question: "L'IA connaît le marché de mon secteur ?",
            reponse:
              "Non — elle produira un prix plausible et invérifiable. Votre connaissance du secteur est votre expertise ; l'outil rédige autour des chiffres que vous lui donnez. On le démontre cet après-midi.",
          },
          {
            question: "On va vraiment publier plus vite dès demain ?",
            reponse:
              "Oui, sur les écrits : annonces, déclinaisons, réponses types. Ce qui ne s'accélère pas, c'est la vérification — et c'est précisément ce que la trame conforme rend rapide au lieu de le rendre optionnel.",
          },
        ],
        blocages: [
          {
            situation: "Le tour de table dérive en débat sur les portails et leurs tarifs.",
            parade:
              "Couper avec : « on note, et on regarde en fin de journée si l'IA change quelque chose là-dessus » — puis écrire le point au tableau. Le reprendre au module 4 fait beaucoup pour la crédibilité.",
          },
        ],
        planB:
          "Aucun outil n'est nécessaire ici. Sans vidéoprojecteur, le tour de table et la règle du jour se tiennent au paperboard sans rien perdre.",
      },
    },
    demonstration: {
      avant:
        "Les caractéristiques du bien sont saisies en vrac et on demande « rédige-moi une belle annonce ». La sortie est fluide, vendeuse — et elle a ajouté un DPE, arrondi la surface et décrit l'acquéreur idéal : « parfait pour une jeune famille dynamique ».",
      apres:
        "Le même bien, décrit champ par champ depuis le dossier, avec interdiction d'ajouter un chiffre et de décrire l'occupant. La sortie ne vend que le bien, et chaque mention se vérifie en face du document qui la prouve.",
      prompt:
        "Rédige l'annonce de vente du bien décrit ci-dessous, à partir des SEULES informations fournies — n'ajoute aucun chiffre, aucune mention, aucun équipement qui n'y figure pas.\nBien : appartement T3 de 64,2 m² (surface Carrez du lot, mesurage joint), 3e étage sans ascenseur, copropriété de 24 lots à usage d'habitation, charges courantes moyennes 1 680 € par an, DPE classe D (176 kWh/m²/an), GES classe B, prix 189 000 € honoraires à la charge du vendeur.\nFormat : un titre sans superlatif, 120 à 150 mots, une phrase de clôture invitant à demander le dossier complet.\nInterdits : ne décris JAMAIS l'acheteur ou le locataire type (pas de « idéal pour une famille », « parfait pour jeune couple », « conviendra à une clientèle exigeante ») — décris le bien, pas son occupant. N'invente ni quartier « calme et familial », ni proximité d'écoles, ni temps de trajet.",
      outil: "Un seul outil, celui validé dans la salle (Claude ou ChatGPT selon le groupe).",
      gain: { avant: "30 min", apres: "10 min" },
      captureEcran:
        "Les deux annonces côte à côte : dans la version libre, le DPE inventé et « parfait pour une jeune famille dynamique » entourés en rouge ; dans la version cadrée, chaque mention reliée par une flèche à la pièce du dossier qui la prouve.",
      verifieLe: VERIFIE_LE,
      dureeMin: 10,
      notes: {
        script:
          "Lisez la version libre à voix haute, avec le ton d'un portail : elle est séduisante, c'est le piège. Demandez ensuite : « qui, ici, a vérifié le DPE ? » — silence garanti. Puis faites chercher la phrase qui décrit une personne et non le bien : « jeune famille dynamique » n'est pas un décor, c'est un tri des acheteurs — exactement ce qu'une annonce n'a pas le droit de faire, le cadre vient de le poser. Lancez enfin la version cadrée et faites vérifier deux mentions en direct contre le dossier projeté.",
        faq: [
          {
            question: "« Quartier familial », tout le monde l'écrit, c'est vraiment un problème ?",
            reponse:
              "Le mot paraît anodin, mais il décrit qui devrait habiter là — et la situation de famille, l'origine, le handicap sont des critères de discrimination sanctionnés. Décrivez le bien : « à 400 m du groupe scolaire » est factuel et vérifiable, « familial » est un tri. Si le doute persiste sur un mot, notez-le, votre conseil tranchera.",
          },
          {
            question: "On peut laisser l'IA proposer le prix ou la classe DPE ?",
            reponse:
              "Non. Un prix, une surface, un DPE se recopient depuis vos pièces. L'IA rédige autour des chiffres que vous fournissez — elle n'en produit aucun.",
          },
        ],
        blocages: [
          {
            situation:
              "La sortie libre du jour est propre : pas de DPE inventé, pas d'occupant décrit.",
            parade:
              "Relancer en ajoutant « rends-la plus vendeuse et plus chaleureuse » : le vocabulaire d'occupant revient presque toujours. Si ça ne suffit pas, basculer sur les sorties imprimées du kit, vérifiées et datées.",
          },
        ],
        planB:
          "Les deux annonces sont imprimées dans le kit (datées), annotations déjà portées. La comparaison, la chasse au chiffre inventé et le repérage du vocabulaire d'occupant se tiennent à l'identique sur papier.",
      },
    },
    pratique: {
      consigne:
        "Deux temps. D'abord, prise en main : chacun dépose les pièces de son bien — diagnostics, mesurage, règlement de copropriété — SANS le mandat ni aucune pièce portant les données du propriétaire, et fait ressortir les seuls éléments d'annonce, sans en ajouter un. Les honoraires, leur charge et le statut du mandat se recopient à la main depuis le registre de l'agence. Puis, chronométré : chacun rédige l'annonce d'un bien réel de son portefeuille sur la trame conforme fournie, la relit une fois, et la reprend.",
      aEmporter:
        "Une annonce complète sur la trame conforme, avec sa liste de contrôle des mentions obligatoires — première pièce du dossier de trames de l'agence.",
      dureeMin: 50,
      notes: {
        script:
          "Répétez la règle AVANT le premier dépôt : le mandat ne se dépose pas — il porte l'état civil et la situation du propriétaire. Diagnostics, mesurage et règlement de copropriété se déposent ; honoraires et statut du mandat se recopient à la main depuis le registre. Annoncez les trois échecs classiques avant qu'ils n'arrivent : scan sans texte reconnu, PDF trop lourd, diagnostic ancien dont le tableau ne se lit pas — la parade de chacun est sur le support. Chronomètre annoncé à voix haute toutes les dix minutes ; passez dans les rangs, ne rédigez à la place de personne.",
        faq: [
          {
            question: "Je n'ai pas le dossier d'un bien sous la main.",
            reponse:
              "Le kit fournit un dossier de bien complet — diagnostics, mesurage, extrait de règlement de copropriété. Personne ne regarde son voisin travailler.",
          },
          {
            question: "L'annonce est déjà en ligne sur le portail, je peux la coller ?",
            reponse:
              "Oui — une annonce publiée est publique. C'est le dossier du propriétaire qui ne se colle pas, pas l'annonce.",
          },
        ],
        blocages: [
          {
            situation: "Un stagiaire dépose le mandat complet « pour aller plus vite ».",
            parade:
              "Arrêter immédiatement, faire supprimer la conversation, et rappeler la règle en une phrase : les données du propriétaire ne sortent pas de l'agence. C'est un point de la journée où l'on ne négocie pas.",
          },
          {
            situation: "La sortie affiche une classe DPE que le stagiaire n'a pas fournie.",
            parade:
              "Ne pas corriger à sa place : lui faire chercher la valeur dans son diagnostic. Si elle n'y est pas, la mention se barre — c'est exactement l'apprentissage du module.",
          },
        ],
        planB:
          "Réseau ou outil tombé : la trame conforme se remplit à la main depuis les pièces papier, et la liste de contrôle s'applique à l'identique. La structure de l'annonce est l'enseignement, pas l'outil qui l'exécute.",
      },
    },
    verification: {
      question:
        "Contrôle croisé en binôme sur la liste fournie : les mentions obligatoires sont-elles toutes présentes — DPE et GES, surface du lot, nombre de lots et charges de copropriété, honoraires et charge du paiement ? Chaque chiffre a-t-il sa pièce au dossier ? Et reste-t-il une formulation qui décrit l'occupant plutôt que le bien ?",
      reponseAttendue:
        "Toutes les cases cochées, chaque mention non prouvée barrée au stylo sur la copie du binôme, et tout vocabulaire d'occupant (« familial », « idéal jeunes actifs », « conviendra à… ») entouré puis reformulé en description du bien.",
      dureeMin: 5,
      notes: {
        script:
          "Cinq minutes, c'est court : imposez l'ordre de la grille et faites barrer physiquement, au stylo, sur la copie de l'autre. Le geste vaut le discours. Les écarts restants se commentent en ouverture du module 2 — ne débordez pas sur la pause.",
        faq: [],
        blocages: [
          {
            situation: "Les copies sont trop propres, rien n'est barré ni entouré.",
            parade:
              "Projeter l'annonce piégée du kit — quatre défauts, dont un « quartier calme et familial » — et la faire corriger collectivement en deux minutes. L'œil se règle vite.",
          },
        ],
        planB:
          "Liste de contrôle imprimée dans le kit ; sans vidéoprojecteur, l'annonce piégée se distribue sur papier et se corrige à l'oral.",
      },
    },
    synthese: {
      acquis: [
        "Je produis une annonce complète sur la trame conforme — et chaque mention a sa pièce au dossier.",
        "Je barre tout chiffre produit par l'IA : surface, DPE, charges et prix se recopient depuis mes documents.",
        "Je décris le bien, jamais son occupant — « familial » et ses variantes sautent à la relecture.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Faites formuler, ne récitez pas : « qu'est-ce que vous ne publierez plus sans vérifier ? ». Trois réponses suffisent. Annoncez la pause, puis le module 2 : la même annonce déclinée sur tous vos supports, et vos réponses aux prospects prêtes d'avance.",
        faq: [],
        blocages: [
          {
            situation: "Personne ne parle, la salle veut sa pause.",
            parade:
              "Ne pas insister : énoncer les trois acquis vous-même et libérer. Un acquis formulé à contrecœur ne s'ancre pas mieux.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 2 — Décliner, répondre, relancer : le rythme commercial
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-2",
    objectif: {
      enonce:
        "À la fin de ce module, vous déclinez une annonce validée sur trois supports sans la réécrire, et vous répondez à un prospect dans l'heure avec vos trois réponses types.",
      objectifGlobalId: "obj-3",
      // Ce module sert aussi la rédaction d'annonces (les déclinaisons par
      // support) et l'application des règles de confidentialité (le cadre « ce
      // qu'on ne colle jamais » + la grille de vérification des données).
      objectifsSecondairesIds: ["obj-1", "obj-5"],
      dureeMin: 5,
      notes: {
        script:
          "Annoncez le rapport gain/risque : décliner et répondre sont les volumes les plus lourds de la semaine, et aucun de ces écrits n'exige de donnée de client — à condition de respecter la règle qui arrive au cadre. Le module produit la deuxième pièce du dossier de trames : les déclinaisons et les trois réponses types.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "L'annonce validée au module 1 est réécrite quatre fois — portail, vitrine, réseaux sociaux, dossier de présentation — et les quatre versions divergent : un chiffre corrigé dans l'une reste faux dans les autres.",
      apres:
        "L'annonce validée est déclinée en une seule demande : quatre formats, mêmes chiffres, mêmes mentions. Une seule source à corriger, quatre sorties alignées.",
      prompt:
        "Voici l'annonce VALIDÉE ci-dessous. Décline-la en quatre formats sans modifier aucun chiffre ni aucune mention légale, et sans ajouter d'information :\n1. Portail : titre accrocheur sans superlatif + texte de 600 caractères maximum.\n2. Vitrine : cinq lignes maximum, lisibles à deux mètres, prix et classe DPE en évidence.\n3. Réseaux sociaux : trois phrases + une question d'appel, sans hashtag inventé sur le quartier.\n4. Dossier de présentation : version longue structurée en sections — le bien, la copropriété, les aspects financiers.\nSi une information manque pour un format, écris « [à compléter : …] » au lieu d'inventer.",
      outil: "Un seul outil, celui validé dans la salle.",
      captureEcran:
        "Les quatre déclinaisons sur un même écran, prix et classe DPE surlignés dans chacune — identiques — et un « [à compléter] » laissé visible dans le dossier de présentation.",
      verifieLe: VERIFIE_LE,
      dureeMin: 15,
      notes: {
        script:
          "Avant de lancer, faites chiffrer par la salle le temps actuel des quatre réécritures — le chiffre vient d'eux, pas de vous, et c'est lui qui vend la méthode. Insistez sur la dernière ligne du prompt : « [à compléter] » au lieu d'inventer est LE réflexe à installer, il resservira sur tous les écrits de la journée. Le cadre qui suit pose ce qu'on ne colle jamais — annoncez-le comme la contrepartie du gain.",
        faq: [
          {
            question: "Les hashtags de quartier, pourquoi les interdire dans le prompt ?",
            reponse:
              "Parce que l'outil invente des noms de quartier et des ambiances — « #quartierfamilial » — et on retrouve le tri d'occupants du module 1, en plus discret. Un hashtag se choisit, il ne se génère pas.",
          },
          {
            question: "On peut décliner en anglais pour la clientèle internationale ?",
            reponse:
              "Oui, la consigne est identique. Mais relire un texte qu'on ne maîtrise pas est plus lent qu'on ne croit : faites relire par la personne de l'agence qui parle la langue avant diffusion.",
          },
        ],
        blocages: [
          {
            situation: "Une déclinaison modifie un chiffre malgré la consigne.",
            parade:
              "Le montrer et le laisser affiché : c'est la preuve vivante que la relecture des chiffres reste obligatoire même en simple déclinaison. Exploiter l'incident, jamais le cacher.",
          },
        ],
        planB:
          "Les quatre déclinaisons sont imprimées dans le kit (datées). La comparaison des chiffres surlignés se fait sur papier, poste par poste.",
      },
    },
    pratique: {
      consigne:
        "Deux temps. D'abord, la série : à partir du tableau de biens fourni dans le kit, chacun produit cinq déclinaisons homogènes du même format et compare les cinq résultats — même structure, mêmes règles, biens différents. Puis, atelier chronométré : chacun décline SON annonce du module 1 sur trois supports, et rédige ses trois réponses types — premier contact, demande de visite, relance après visite — sans nom, sans coordonnées, sans aucun élément d'un prospect réel : les trames se personnalisent au moment de l'envoi, dans votre messagerie.",
      aEmporter:
        "Trois déclinaisons de votre annonce et trois réponses types à champs, prêtes à personnaliser — deuxième pièce du dossier de trames de l'agence.",
      dureeMin: 55,
      notes: {
        script:
          "Le cadre vient d'être posé, appliquez-le : AUCUNE donnée de prospect dans l'outil — pas de nom, pas de numéro, pas de situation financière. Et rappelez le point le plus contre-intuitif : l'adresse du bien plus la date de visite suffisent à identifier quelqu'un — retirer le nom ne suffit pas. Les réponses types se construisent avec des champs [Prénom], [Bien], [Créneau] à remplir dans la messagerie. Passez dans les rangs : le piège classique est le stagiaire qui colle un vrai échange d'e-mails « pour que la réponse soit plus naturelle ».",
        faq: [
          {
            question: "Sans le contexte du prospect, la réponse sera générique, non ?",
            reponse:
              "La trame est générique, c'est sa force : elle part dans l'heure. La personnalisation — prénom, bien, créneau — prend trente secondes dans votre messagerie, là où les données du prospect ont le droit d'être.",
          },
          {
            question: "Et si le prospect pose une question juridique — honoraires, compromis ?",
            reponse:
              "La réponse type oriente vers un rendez-vous. Vous ne faites pas rédiger de réponse juridique par l'outil — et moi non plus : notez la question, votre conseil tranchera.",
          },
        ],
        blocages: [
          {
            situation:
              "Un stagiaire colle l'e-mail complet d'un prospect, signature et téléphone compris.",
            parade:
              "Arrêter, faire supprimer la conversation, reformuler la règle : les trames se construisent à vide, les données restent dans la messagerie. Ne pas transiger.",
          },
          {
            situation: "Un binôme finit la série de cinq en avance.",
            parade:
              "Le tableau du kit compte dix biens : leur faire produire cinq déclinaisons du format le plus utile à leur agence, et préparer la restitution du groupe.",
          },
        ],
        planB:
          "Le tableau de biens et les trames de réponses se travaillent à la main sur les supports papier du kit. Chacun relancera les prompts à l'agence — la trame est datée et réutilisable.",
      },
    },
    verification: {
      question:
        "Vérification croisée sur la grille fournie, appliquée à la production du binôme : les mentions obligatoires ont-elles survécu à chaque déclinaison ? Les chiffres sont-ils identiques partout ? Le ton est-il celui de l'agence ? Et surtout : une donnée de client ou de prospect s'est-elle glissée quelque part — un nom, une adresse complète, une date de visite ?",
      reponseAttendue:
        "Grille cochée sur les trois déclinaisons et les trois réponses types ; toute donnée identifiante est entourée et retirée de la trame séance tenante. Le corrigé liste les trois fuites les plus fréquentes : le nom dans l'objet du mail, l'adresse exacte du bien dans la réponse, la date de visite dans la relance.",
      dureeMin: 15,
      notes: {
        script:
          "Faites chercher la fuite AVANT de projeter le corrigé — l'œil se règle en cherchant, pas en écoutant. Une adresse complète dans une réponse type n'est pas un détail : combinée à la date de visite, elle identifie le prospect. C'est la leçon du cadre, vérifiée en acte.",
        faq: [],
        blocages: [
          {
            situation:
              "Un binôme conteste : « l'adresse du bien n'est pas une donnée personnelle ».",
            parade:
              "Ne pas trancher en droit. Dérouler le raisonnement en une phrase : seule dans l'annonce, non ; reliée à un prospect et à une date de visite dans un échange, elle identifie quelqu'un. Si le débat continue, notez la question, leur conseil tranchera.",
          },
        ],
        planB: "Grille et corrigé imprimés dans le kit. Aucun outil nécessaire.",
      },
    },
    synthese: {
      acquis: [
        "Je décline une annonce validée en une seule demande — je corrige la source, jamais les copies.",
        "Je réponds à un prospect dans l'heure avec une trame à champs, personnalisée dans ma messagerie.",
        "Aucune donnée de client ou de prospect n'entre dans l'outil — la trame se construit à vide.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Annoncez le déjeuner et l'après-midi en une phrase : « ce matin on vendait ; cet après-midi on gère — courriers, copropriété, impayés, estimation — et on verra la demande qu'on refuse ».",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 3 — Gestion locative, copropriété et estimation
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-3",
    objectif: {
      enonce:
        "À la fin de ce module, vous produisez un écrit de gestion défendable à partir de vos pièces, et vous reconnaissez — et refusez par écrit — la demande de tri de candidats locataires.",
      objectifGlobalId: "obj-4",
      // L'atelier bâtit aussi l'argumentaire d'estimation sur les références de
      // marché fournies par le stagiaire — appui à l'estimation, jamais
      // estimation par l'outil.
      objectifsSecondairesIds: ["obj-2"],
      dureeMin: 5,
      notes: {
        script:
          "Annoncez la couleur : c'est le module où la salle attend « l'IA qui choisit le bon locataire ». Dites tout de suite qu'on ne le fera pas, que le cadre qui vient donne les trois motifs — ils sont rédigés dans le kit, ne les improvisez pas — et que ce qu'on fait à la place est plus rapide ET défendable : l'IA met en forme le dossier, l'humain choisit et motive.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "Un dossier de candidat locataire du kit est soumis « pour avis » : l'outil rend un avis assuré. Le même dossier, resoumis avec une seule ligne changée — le CDI devenu CDD — et l'avis change. Le tri s'est fait sur un critère que personne n'a choisi ni écrit.",
      apres:
        "L'IA ne rend plus d'avis : elle met en forme. Des notes de séance brouillonnes deviennent un procès-verbal d'assemblée générale structuré, où chaque décision, chaque vote, chaque chiffre vient des notes — et rien d'autre.",
      prompt:
        "DÉMONSTRATION 1 — le biais (deux envois successifs du MÊME dossier fictif du kit) :\n« Voici le dossier d'un candidat locataire. Donne-moi ton avis sur la solidité de sa candidature. »\nPuis le même dossier où une seule ligne a changé : le CDI est devenu un CDD.\n\nDÉMONSTRATION 2 — la mise en forme (notes fictives du kit) :\n« Voici mes notes de séance de l'assemblée générale, prises au fil de la réunion. Reconstruis le procès-verbal : ordre du jour, présents et pouvoirs, chaque résolution avec son résultat de vote tel qu'il figure dans les notes. N'ajoute aucune décision, aucun chiffre, aucun nom qui n'y figure pas ; si un point des notes est illisible ou incomplet, écris [à vérifier au registre] au lieu de compléter. »",
      outil: "Un seul outil, celui validé dans la salle.",
      captureEcran:
        "À gauche, les deux avis rendus sur le même dossier à une ligne près, l'écart surligné ; à droite, le procès-verbal reconstruit avec un « [à vérifier au registre] » laissé apparent.",
      verifieLe: VERIFIE_LE,
      dureeMin: 20,
      notes: {
        script:
          "Sur le biais : faites parier la salle par écrit avant le second envoi — « l'avis va-t-il changer ? ». L'écart à l'écran vaut tous les discours : personne n'a demandé de trier sur le contrat de travail, et le tri a eu lieu. Enchaînez sans transition sur le procès-verbal : même outil, utilisé cette fois pour ce qu'il sait faire — mettre en forme ce qu'on lui donne. Les notes du kit sont fictives ; rappelez qu'un vrai PV porte des noms de copropriétaires et se traite dans l'outil validé de l'agence, jamais dans un compte grand public.",
        faq: [
          {
            question: "Si le modèle ne biaise pas aujourd'hui, ça prouve quoi ?",
            reponse:
              "Que ce jour-là, sur ce dossier, ça n'a pas basculé — pas que ça ne bascule jamais. Les captures pré-testées du kit montrent un écart constaté et daté : ce sont elles qui font foi.",
          },
          {
            question: "Un avis « purement indicatif » sur un candidat, c'est permis ?",
            reponse:
              "L'avis indicatif devient le choix réel dès qu'il est lu. Le cadre vient de le poser : mise en forme oui, avis et classement non. Si le doute persiste chez vous, notez la question, votre conseil tranchera.",
          },
        ],
        blocages: [
          {
            situation: "Le modèle rend deux avis identiques, la démonstration tombe à plat.",
            parade:
              "Basculer sur les captures pré-testées du kit, prévues exactement pour ça, et le dire tel quel : « ça n'a pas biaisé cette fois-ci ; voici un écart constaté et daté ». La leçon tient tout autant.",
          },
        ],
        planB:
          "Les deux avis et le procès-verbal reconstruit sont imprimés dans le kit (datés). Le pari, la comparaison et la lecture se tiennent à l'identique sur papier.",
      },
    },
    pratique: {
      consigne:
        "Deux temps. D'abord, prise en main guidée : chacun charge une pièce SANS donnée personnelle — règlement de copropriété, compte de charges, ou le bail anonymisé du kit — et lui pose trois questions dont il connaît déjà une réponse, pour jauger la fiabilité. Puis, atelier chronométré : traitez trois demandes de la liste fournie — convocation et compte rendu d'assemblée, réponse à un copropriétaire, relance d'impayé, état des lieux mis au propre, argumentaire d'estimation bâti sur VOS références de marché, fournies par vous. Une demande de la liste est un piège : elle se reconnaît et se refuse PAR ÉCRIT.",
      aEmporter:
        "Trois écrits de gestion sur trames datées, la phrase de refus rédigée, et l'argumentaire d'estimation où chaque chiffre porte sa source — troisième pièce du dossier de trames.",
      dureeMin: 50,
      notes: {
        script:
          "Deux règles à répéter au lancement. Un : un bail réel porte des noms — c'est le bail anonymisé du kit qui se charge, jamais celui d'un locataire. Deux : sur l'estimation, l'IA ne produit AUCUN chiffre — ni prix au mètre carré, ni valeur de marché. Les références comparables viennent du stagiaire ; l'outil structure l'argumentaire autour. Une estimation chiffrée par l'IA est fausse avec assurance, et elle engage l'agence. Sur la relance d'impayé : ton ferme et factuel — montant, échéance, moyen de paiement, contact — aucune menace de procédure : la mise en demeure est un acte qui se valide, pas un mail qui se génère. Et vous ne tranchez aucune question de droit : « je ne me prononce pas, notez la question, votre conseil tranchera ».",
        faq: [
          {
            question: "L'IA peut me donner le prix au m² de mon secteur, autant lui demander ?",
            reponse:
              "Elle vous en donnera un — plausible, invérifiable, parfois périmé de deux ans. Vos références de vente et votre connaissance du secteur sont votre expertise : l'outil met en forme, il n'estime pas.",
          },
          {
            question: "Dans la relance d'impayé, je peux évoquer l'expulsion pour faire réagir ?",
            reponse:
              "Non — et ce n'est pas une question d'outil. Les étapes d'un impayé sont encadrées ; la trame reste factuelle. Au-delà de la relance simple, c'est votre conseil ou votre huissier, pas un générateur de texte.",
          },
        ],
        blocages: [
          {
            situation:
              "Un stagiaire traite le cas piège comme une demande normale et fait classer les trois dossiers de candidats.",
            parade:
              "Ne pas l'intercepter : le laisser finir, puis à la correction collective, faire lire sa sortie à côté du cadre posé en début de module. Le contraste enseigne mieux que l'interruption.",
          },
          {
            situation:
              "Un stagiaire veut charger un vrai bail « juste pour une question de charges ».",
            parade:
              "Refuser : le bail du kit pose la même question sans exposer personne. La règle ne connaît pas d'exception « juste pour ».",
          },
        ],
        planB:
          "Toutes les demandes de la liste se traitent à la main sur les trames papier du kit, et le cas piège se reconnaît de même. L'argumentaire d'estimation se structure au stylo sur la trame — les références de marché sont déjà celles du stagiaire.",
      },
    },
    verification: {
      question:
        "Chasse à l'erreur sur votre propre production, puis correction collective : surlignez tout ce que l'IA a affirmé sans preuve — un prix, une surface, une échéance, un texte de loi cité de mémoire. Puis, en salle : qui a reconnu le cas piège, et quelle phrase de refus lui a été opposée ?",
      reponseAttendue:
        "Chaque affirmation sans pièce est surlignée ; le cas piège est corrigé collectivement avec la phrase de refus attendue : « je ne classe pas des candidats avec un outil ; je mets le dossier en forme, et le choix se fait et se motive à l'agence ».",
      dureeMin: 15,
      notes: {
        script:
          "Comptez à main levée qui a repéré le piège AVANT la correction, et affichez le score au tableau : il est toujours plus bas que la salle ne l'imagine, et le chiffre vaut mieux qu'un discours. Puis faites lire deux ou trois phrases de refus à voix haute — une phrase qu'on n'a jamais prononcée ne sort pas devant un collègue pressé.",
        faq: [
          {
            question: "Refuser, ça va me faire passer pour moins efficace que l'agence d'à côté.",
            reponse:
              "La phrase de refus dit l'inverse : elle montre que vous savez où est la ligne. Et le jour où un candidat écarté demande pourquoi, c'est vous qui avez une réponse motivée — pas l'agence d'à côté.",
          },
        ],
        blocages: [
          {
            situation: "Personne n'a rien surligné, les productions semblent propres.",
            parade:
              "Projeter la production piégée du kit — un prix au m² inventé, une échéance fausse, un article cité de mémoire — et faire surligner collectivement. L'œil se règle en trois minutes.",
          },
        ],
        planB:
          "La production piégée et son corrigé sont imprimés dans le kit. Aucun outil nécessaire.",
      },
    },
    synthese: {
      acquis: [
        "L'IA met en forme mes écrits de gestion — les chiffres et les échéances viennent de mes pièces.",
        "Je bâtis l'argumentaire d'estimation sur MES références de marché : l'outil n'estime rien.",
        "Je reconnais la demande de tri de locataires et je la refuse par écrit, avec la phrase apprise.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Annoncez la pause puis le dernier module en une phrase : « il reste à transformer votre journée en outillage d'agence — le dossier de trames vérifiées, et trois usages datés ».",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 4 — Ancrer dans l'agence
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-4",
    objectif: {
      enonce:
        "À la fin de ce module, vous repartez avec le dossier de trames vérifiées de votre agence, trois usages datés — et la liste de ce qui n'entre jamais dans un outil.",
      objectifGlobalId: "obj-5",
      dureeMin: 5,
      notes: {
        script:
          "Reprenez le tableau du tour de table du matin : montrez ce que la journée a couvert, et dites honnêtement ce qu'elle n'a pas couvert. Cette honnêteté sur le second point achète toute la crédibilité de la feuille de route qui clôt la journée.",
        faq: [],
        blocages: [],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "Un besoin réel de la salle est traité « de tête » : on ouvre l'outil, on improvise un prompt, la sortie part telle quelle. Demain, un collègue refera autrement — et l'agence aura deux versions du même document.",
      apres:
        "Le même besoin devient une trame vérifiée : le gabarit du document, sa checklist avant diffusion, et la liste des pièces sources d'où chaque chiffre doit venir. N'importe qui à l'agence produit désormais le même document, au même niveau.",
      prompt:
        "À partir du modèle validé ci-dessous [document choisi avec la salle], construis une trame réutilisable pour l'agence :\n1. Le gabarit du document, avec des champs [entre crochets] pour tout ce qui change d'un dossier à l'autre.\n2. La checklist de relecture avant diffusion : chiffres à vérifier contre leurs pièces, mentions obligatoires, vocabulaire d'occupant à traquer, données personnelles à retirer.\n3. La liste des pièces sources d'où chaque champ chiffré doit être recopié.\nN'ajoute aucun champ ni aucune mention qui ne figure pas dans le modèle validé.",
      outil: "Un seul outil, celui validé dans la salle.",
      captureEcran:
        "La trame assemblée en direct, projetée avec ses trois parties — gabarit à champs, checklist, pièces sources — telle qu'elle entre dans le dossier de l'agence.",
      verifieLe: VERIFIE_LE,
      dureeMin: 10,
      notes: {
        script:
          "Prenez un besoin VOTÉ par la salle, pas le vôtre : la trame construite en direct sur leur besoin vaut dix exemples préparés. Allez vite sur le gabarit, lentement sur la checklist — c'est elle qui fera la qualité quand vous ne serez plus là. Datez la trame à l'écran, devant eux : la date de vérification fait partie du document.",
        faq: [
          {
            question: "Qui met à jour les trames quand la réglementation change ?",
            reponse:
              "La personne désignée à la feuille de route dans quelques minutes — une trame sans titulaire meurt en trois mois. Et la date portée sur chaque trame dit quand elle a été relue pour la dernière fois.",
          },
        ],
        blocages: [
          {
            situation: "La salle vote un besoin juridique — « une trame de compromis de vente ».",
            parade:
              "Refuser posément : un compromis est un acte, pas un écrit courant — il se rédige et se valide chez votre notaire ou votre conseil. Prendre le deuxième besoin voté.",
          },
        ],
        planB:
          "Une trame complète du kit (l'annonce conforme) se distribue à la place de la construction en direct, et se commente partie par partie — gabarit, checklist, pièces sources.",
      },
    },
    pratique: {
      consigne:
        "Deux temps. D'abord, retour sur la journée : chacun relit ses propres conversations du jour et surligne ce qui n'aurait pas dû y entrer — un nom, des coordonnées, un mandat, une offre reçue, la situation d'un candidat — puis le supprime. Ensuite, atelier : chacun assemble le dossier de trames vérifiées de son agence — trame d'annonce conforme, déclinaisons par support, réponses types prospects, écrits de gestion — chacune avec sa checklist avant diffusion, ses pièces sources, et la phrase de refus des demandes hors périmètre.",
      aEmporter:
        "Le dossier de trames vérifiées complet, nommé et daté, avec la phrase de refus écrite — l'outillage que l'agence utilise dès demain.",
      dureeMin: 45,
      notes: {
        script:
          "Le retour sur la journée est un geste d'hygiène, pas une inspection : chacun relit SES conversations, personne ne regarde celles du voisin. S'il trouve une donnée qui n'aurait pas dû y être, il la supprime et le note — c'est le réflexe qu'on installe, pas la faute qu'on sanctionne. Sur l'assemblage : faites NOMMER le dossier (« trames-agence-<nom>-<date> ») et désigner la personne qui le tient à jour. Un dossier sans nom ni titulaire n'existe plus dans trois semaines.",
        faq: [
          {
            question: "On partage le dossier de trames entre les deux agences du réseau ?",
            reponse:
              "Oui, c'est même l'intérêt — à condition qu'UNE personne le tienne, et que chaque agence vérifie que le barème d'honoraires et les mentions sont bien les siens avant usage.",
          },
        ],
        blocages: [
          {
            situation:
              "Un stagiaire découvre qu'il a collé un document de client le matin — malaise dans la salle.",
            parade:
              "Dédramatiser et exécuter : on supprime la conversation, on le note, et on dit à la salle que ce réflexe de relecture est exactement ce que le module installe. Personne d'autre n'a à savoir ce que contenait la conversation.",
          },
          {
            situation: "L'assemblage traîne, tout le monde peaufine sa première trame.",
            parade:
              "Timeboxer à voix haute : dix minutes par trame maximum, la perfection viendra à l'usage. Un dossier de quatre trames imparfaites bat une trame parfaite seule.",
          },
        ],
        planB:
          "L'assemblage se fait sur les trames papier produites dans la journée, dans une chemise physique nommée et datée. Le passage au numérique se fait à l'agence — le contenu, lui, est déjà écrit.",
      },
    },
    verification: {
      question:
        "Validation des acquis : quiz individuel de dix questions, corrigé en salle question par question. Puis chacun passe SA production de la journée à la grille de critères fournie — mentions obligatoires, chiffres sourcés, vocabulaire d'occupant, données personnelles, ton de l'agence.",
      reponseAttendue:
        "Le corrigé est commenté question par question, sans en sauter. Le seuil de réussite est celui déclaré au programme ; un score en dessous déclenche la reprise individuelle prévue au dispositif. La grille appliquée à sa production révèle au moins un point d'amélioration par personne.",
      dureeMin: 20,
      notes: {
        script:
          "C'est l'évaluation des acquis au sens de l'indicateur 11 : elle se tient, elle se corrige, et elle se conserve. Si vous êtes en retard, coupez ailleurs — jamais ici. Le quiz reprend les cinq points durs de la journée : mentions obligatoires, chiffres sourcés, vocabulaire d'occupant, refus du tri de locataires, données personnelles.",
        faq: [
          {
            question: "Le résultat du quiz est transmis à mon employeur ?",
            reponse:
              "Le résultat individuel ne l'est pas. Ce qui est transmis, c'est l'attestation de fin de formation et le fait que l'évaluation a eu lieu.",
          },
        ],
        blocages: [
          {
            situation: "Il est 17 h 10 et le quiz n'est pas commencé.",
            parade:
              "Le tenir quand même, en limitant le commentaire du corrigé aux questions les plus ratées. On ne remplace jamais l'évaluation par un tour de table.",
          },
        ],
        planB: "Quiz papier et corrigé imprimés dans le kit. Aucune dépendance à un outil.",
      },
    },
    synthese: {
      acquis: [
        "J'utilise les trames du dossier de l'agence — et je sais qui les tient à jour.",
        "Trois usages sont datés, avec un nom sur chacun, et un usage est écarté par écrit : le tri de locataires.",
        "Je relis chaque sortie avant diffusion : chiffres sourcés, mentions présentes, aucune donnée personnelle.",
      ],
      dureeMin: 10,
      notes: {
        script:
          "Feuille de route à voix haute, chacun son tour : trois usages avec un nom et une date, l'usage écarté dit explicitement, et la personne qui relit avant publication. Notez au tableau, photographiez, envoyez au groupe. Sans nom et sans date, une feuille de route ne se réalise pas.",
        faq: [],
        blocages: [
          {
            situation:
              "Les engagements restent vagues : « on va utiliser l'IA pour les annonces ».",
            parade:
              "Reformuler en question : « quelle annonce, qui la rédige, quel jour ? ». Ne pas passer au suivant tant que la réponse ne porte pas un nom et une date.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },
];
