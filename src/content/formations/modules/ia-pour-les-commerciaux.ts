/**
 * CONTENU RÉDIGÉ — « IA pour les commerciaux » (1 jour, 7 h, 2 modules).
 *
 * ## Deux modules, quatre demi-modules
 *
 * Le catalogue publie cette journée en DEUX sections — la matinée et
 * l'après-midi — et l'import numérote les sections, pas les intitulés qu'elles
 * contiennent. « mod-1 » couvre donc les modules 1 et 2 du programme lu par le
 * client (le cadre, la préparation de rendez-vous, le compte rendu dicté, le
 * tri du pipeline), et « mod-2 » les modules 3 et 4 (l'objection, la
 * proposition, la fiabilité, la feuille de route). Chaque bloc rédigé ici
 * couvre donc DEUX temps distincts de la demi-journée, séparés par une pause :
 * les notes d'animation le disent explicitement à chaque fois, faute de quoi le
 * formateur fusionnerait deux séquences que le programme vendu sépare.
 *
 * ## Le fil rouge
 *
 * Chacun repart avec UN kit de rendez-vous monté sur une affaire réelle de son
 * portefeuille, en cinq pièces versées au fil de la journée : liste rouge et
 * fiche de préparation, compte rendu et relance, réponses types d'objection,
 * proposition commerciale, grille de relecture avant envoi. Aucune pièce ne se
 * suffit à elle-même — la proposition de l'après-midi se rédige sur l'affaire
 * préparée le matin, et la grille de relecture se construit sur les erreurs que
 * la salle vient elle-même de laisser passer.
 *
 * ## Trois règles que le formateur ne négocie pas
 *
 * **Le nom d'un contact, un prix négocié, une marge, un extrait de fichier
 * client n'entrent JAMAIS dans un outil pendant la journée.** Les participants
 * travaillent bien sur leurs affaires réelles — c'est ce qui est vendu — mais
 * avec les documents publics du prospect (plaquette, site, communiqués), des
 * interlocuteurs désignés par leur fonction et des montants ramenés à un ordre
 * de grandeur. Un participant qui colle un extrait de son CRM est arrêté sans
 * discussion : la formation ne peut pas provoquer le manquement qu'elle
 * enseigne à éviter.
 *
 * **Aucun chiffre, aucun nom, aucune référence client ne monte dans un document
 * sortant sans une source que le commercial a ouverte lui-même.** C'est la règle
 * qui tient les deux contrôles croisés de la journée, et c'est elle qu'on
 * mesure — en lignes barrées, à voix haute.
 *
 * **Le formateur n'arbitre aucune question juridique.** La formule est écrite,
 * elle se prononce telle quelle : « je ne me prononce pas, notez la question,
 * votre conseil tranchera ». Elle vaut en particulier pour la prospection et le
 * démarchage, l'information due à un prospect sur qui l'on se renseigne, et
 * l'obligation éventuelle de signaler qu'un interlocuteur échange avec une IA.
 *
 * ⚠️ Les références juridiques citées dans les séquences `cadre` sont fournies
 * au formateur SOURCÉES ET DATÉES dans le kit, et ne se citent jamais de
 * mémoire. Leur formulation reste à faire relire par le conseil de l'organisme.
 */

import type { EnrichissementFormation } from "./types";

/** Date de dernière vérification des captures et sorties d'outils. */
const VERIFIE_LE = "2026-08-06";

export const IA_POUR_LES_COMMERCIAUX: EnrichissementFormation = [
  // ───────────────────────────────────────────────────────────────────────────
  // Module 1 (matinée) — Le cadre, la préparation du rendez-vous,
  // le compte rendu dicté et le tri du pipeline
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-1",
    objectif: {
      enonce:
        "À la fin de ce module, vous préparez un rendez-vous réel à partir des seules sources que vous avez ouvertes vous-même, et vous sortez d'un entretien avec le compte rendu, le mail de suivi et la relance déjà écrits.",
      objectifGlobalId: "obj-1",
      // La matinée produit aussi le compte rendu, le mail de suivi et la relance
      // a J+7 (obj-3), le tri du pipeline sur criteres d'affaire (obj-4), et
      // porte les trois sequences de cadre sur la confidentialite (obj-5).
      objectifsSecondairesIds: ["obj-3", "obj-4", "obj-5"],
      dureeMin: 10,
      notes: {
        script:
          "Deux prises de parole de cinq minutes, séparées par la pause — ne les fusionnez pas. À l'ouverture, faites annoncer par chacun, en UNE phrase, le rendez-vous réel de sa semaine sur lequel il travaillera aujourd'hui : le secteur et l'enjeu, pas le nom du client si la salle mélange plusieurs entreprises. Écrivez les affaires au tableau et laissez la feuille affichée : elles seront reprises une par une à 17 h. Posez la règle qui tient la journée : l'IA prépare, le commercial engage sa signature. La seconde prise de parole ouvre le compte rendu dicté, en une phrase qui parle à un commercial terrain : « on ne repart plus du parking avec un compte rendu à écrire le soir ».",
        faq: [
          {
            question: "Je n'ai pas de rendez-vous cette semaine, je travaille sur quoi ?",
            reponse:
              "Sur une affaire en cours qui dort depuis trois semaines. La journée marche aussi bien sur une relance que sur une découverte. Le kit contient un dossier prospect de secours, mais votre affaire vaut mieux.",
          },
          {
            question: "On va pouvoir mettre notre fichier client dedans ?",
            reponse:
              "Non, et vous saurez dire pourquoi dans un quart d'heure. Ce n'est pas une interdiction de principe, c'est un tri : certaines choses n'entrent jamais, d'autres entrent selon l'outil que votre entreprise a validé.",
          },
        ],
        blocages: [
          {
            situation: "Le tour de table part en concours d'anecdotes de terrain.",
            parade:
              "Couper à la troisième avec « on la garde pour 17 h, elle servira » — et l'écrire au tableau. La reprendre en fin de journée coûte trente secondes et achète toute la crédibilité.",
          },
          {
            situation: "Un participant annonce qu'il est là parce que son directeur l'a inscrit.",
            parade:
              "Ne pas plaider. Une seule question : « combien d'heures par semaine vous passez à rédiger plutôt qu'à vendre ? ». Le chiffre qu'il donne fait le reste du travail.",
          },
        ],
        planB:
          "Aucun outil n'est nécessaire. Sans vidéoprojecteur, les affaires du tour de table s'écrivent au paperboard et la feuille reste affichée toute la journée — c'est même préférable à une slide.",
      },
    },
    demonstration: {
      avant:
        "« Parle-moi de l'entreprise Untel, que je prépare mon rendez-vous. » La réponse arrive complète et assurée : un dirigeant, un chiffre d'affaires, un effectif, une actualité récente. Rien n'est sourcé, une partie est fausse, et aucune ligne ne le signale. Deuxième temps, le soir : le compte rendu du rendez-vous s'écrit à 21 h de mémoire, ou ne s'écrit pas.",
      apres:
        "La même préparation construite à partir des SEULS documents fournis — plaquette, site, compte rendu du dernier échange — et sous la structure AXION. Ce qui vient des sources est utilisable en rendez-vous, ce qui manque est écrit noir sur blanc comme « non disponible dans les documents fournis ». Et le compte rendu se dicte en trois minutes depuis la voiture, avant même de démarrer.",
      prompt:
        "PROMPT 1 — préparation de rendez-vous, structure AXION\nActeur : tu es un directeur commercial expérimenté qui prépare un rendez-vous avec moi, commercial d'une PME de robinetterie industrielle.\nConteXte : je rencontre jeudi le responsable maintenance d'une usine agroalimentaire d'environ 200 personnes. Je te joins sa plaquette, la page « qui sommes-nous » de son site et le compte rendu de mon appel du 12 juin.\nIntention : entrer en rendez-vous avec un plan de découverte, pas avec un argumentaire.\nOutput : une fiche d'une page — ce que les documents joints m'apprennent, dix questions ouvertes de découverte, trois hypothèses d'enjeux explicitement étiquetées « hypothèse », et la liste de ce que je dois vérifier auprès de lui.\nNormes : n'utilise QUE les documents joints. N'invente aucun chiffre d'affaires, aucun effectif, aucun nom de dirigeant, aucune actualité. Si une information manque, écris « non disponible dans les documents fournis ».\n\nPROMPT 2 — compte rendu dicté\nVoici la transcription d'une dictée faite en voiture juste après un rendez-vous. Produis trois sorties séparées : (1) un compte rendu interne structuré — contexte, interlocuteurs par leur fonction, besoins exprimés, objections entendues, budget évoqué s'il l'a été ; (2) un mail de suivi adressé au client, ton professionnel et sobre, qui reprend ce qui a été dit et rien d'autre ; (3) les prochaines étapes, avec qui fait quoi et pour quelle date. N'ajoute aucun engagement de prix, de délai ni de remise qui ne figure pas dans la dictée. Signale entre crochets tout passage de la dictée que tu n'as pas compris.",
      outil: "Un seul outil pour toute la journée, celui validé dans la salle.",
      gain: { avant: "45 min", apres: "10 min" },
      captureEcran:
        "Les deux préparations côte à côte, avec en rouge dans la version libre les quatre éléments inventés — dirigeant, chiffre d'affaires, effectif, actualité — et en vert dans la version sourcée les mentions « non disponible dans les documents fournis ».",
      verifieLe: VERIFIE_LE,
      dureeMin: 30,
      notes: {
        script:
          "Faites PARIER par écrit avant d'afficher la première réponse : chacun note sur son support s'il pense que le dirigeant cité est le bon. La salle parie « oui » à une large majorité — c'est ce pari qui rend la suite mémorable. Affichez, puis ouvrez le site de l'entreprise en direct et comparez ligne à ligne. Ne dites jamais « c'est faux » vous-même : laissez quelqu'un de la salle le dire. Écrivez ensuite AXION au tableau — Acteur, conteXte, Intention, Output, Normes — et laissez-le affiché jusqu'au soir, on y revient quatre fois dans la journée. Sur la dictée : dictez VOUS-MÊME, en direct, trois minutes, au micro du téléphone, sans relire. Annoncez les trois causes d'échec AVANT de dicter — bruit ambiant, noms propres, chiffres. Une salle qui guette apprend mieux qu'une salle qui écoute.",
        faq: [
          {
            question: "Si je lui donne le site du prospect, il ne va pas inventer quand même ?",
            reponse:
              "Il peut, et c'est pour cela que la ligne Normes exige « non disponible dans les documents fournis ». Une case vide est une information utile ; une case remplie au hasard est un piège qui vous explose en rendez-vous.",
          },
          {
            question: "Ma dictée ressort avec tous les noms propres massacrés.",
            reponse:
              "Épelez-les une fois, à voix haute, en début de dictée. C'est la seule parade fiable et elle coûte dix secondes.",
          },
          {
            question:
              "Le compte rendu de mon appel précédent, c'est un document interne, je peux ?",
            reponse:
              "Sur l'outil validé par votre entreprise, oui. Sur un compte personnel, non. C'est exactement la différence entre les trois régimes d'usage vus en début de matinée.",
          },
        ],
        blocages: [
          {
            situation:
              "La réponse libre ne contient aucune erreur repérable : l'entreprise choisie est trop connue.",
            parade:
              "Basculer sur le dossier de secours du kit (page 6), une PME de trente personnes sans presse. L'invention réapparaît aussitôt. Choisir toujours une cible de la taille de leurs vrais prospects.",
          },
          {
            situation: "La dictée en direct est inexploitable à cause du bruit de la salle.",
            parade:
              "Ne pas recommencer trois fois : la transcription ratée EST l'enseignement. La montrer, nommer la cause, puis afficher la transcription propre du kit (page 9) et poursuivre.",
          },
        ],
        planB:
          "Quota atteint, réseau tombé, service indisponible : les deux préparations et les trois sorties de la dictée sont imprimées dans le kit formateur (pages 5 à 9, datées). Le pari écrit, la comparaison ligne à ligne et le repérage des inventions se tiennent à l'identique sur papier. Ne rien improviser en direct : les sorties du kit ont été vérifiées, celles du jour ne le sont pas.",
      },
    },
    pratique: {
      consigne:
        "Quatre temps chronométrés. (1) Votre liste rouge : classez les dix éléments du support — prix négocié, fichier client, marge, contrat-cadre, remise exceptionnelle, notes manuscrites de rendez-vous, adresse mail d'un contact, plaquette publique du prospect, nom du dirigeant, compte rendu interne — en « jamais », « avec précaution », « librement ». (2) Préparez le rendez-vous réel annoncé ce matin avec vos propres documents : fiche de préparation, plan de découverte en questions ouvertes, hypothèses d'enjeux étiquetées comme telles, liste de ce qui reste à vérifier. (3) Dictez trois minutes le compte rendu d'un rendez-vous récent, produisez les trois sorties, corrigez-les, puis écrivez la relance à J+7. (4) Triez votre pipeline de la semaine sur des critères tirés de l'affaire — jamais de la personne — et écrivez les relances correspondantes. Règle valable dans les quatre temps : votre interlocuteur s'appelle « le responsable maintenance », jamais par son nom ; aucun prix négocié, aucune marge, aucun extrait de fichier client n'entre dans l'outil.",
      aEmporter:
        "Votre liste rouge personnelle, la fiche de préparation du rendez-vous de la semaine avec son plan de découverte, le compte rendu, le mail de suivi et la relance à J+7 d'une affaire réelle, et votre pipeline trié avec ses critères écrits. Pièces 1 et 2 du kit de rendez-vous.",
      dureeMin: 95,
      notes: {
        script:
          "Le tri des dix éléments se corrige EN SALLE, à main levée, élément par élément. C'est là que la salle découvre qu'elle n'est pas d'accord avec elle-même sur « notes manuscrites de rendez-vous » — ne tranchez pas les cas limites à sa place, faites argumenter deux minutes, puis donnez la règle de l'entreprise si elle existe. Sur la préparation : annoncez le chronomètre à voix haute toutes les dix minutes. Passez dans les rangs, relancez sur la ligne Normes du prompt, ne rédigez à la place de personne. Sur le tri du pipeline : imposez d'écrire les critères AVANT de trier, sur une feuille séparée — un critère écrit après le tri est un critère qui justifie, pas un critère qui décide. Et redites la règle de confidentialité au démarrage de chaque temps, pas seulement en début de matinée : c'est au troisième atelier qu'elle se relâche.",
        faq: [
          {
            question: "Comment je prépare un rendez-vous sans donner le nom de l'entreprise ?",
            reponse:
              "Vous donnez sa plaquette et son site, qui sont publics, et bien plus utiles qu'un nom. Ce qui reste dehors, c'est le nom de votre contact, la remise que vous lui avez consentie et votre marge.",
          },
          {
            question: "Ma relance à J+7 ressort trop commerciale, on dirait un robot.",
            reponse:
              "Coupez les deux premières phrases et gardez la dernière question. Neuf relances sur dix tiennent en trois lignes et une question — demandez-le explicitement dans le prompt.",
          },
          {
            question: "Mon critère de tri, c'est « le contact est réactif ». Personne ou affaire ?",
            reponse:
              "La personne. Remplacez-le par ce que vous mesurez vraiment : « a répondu sous 48 h à la dernière relance ». Même intuition, mais vérifiable et défendable.",
          },
          {
            question: "Je peux me renseigner sur mon prospect avant de l'appeler ?",
            reponse:
              "Je ne me prononce pas sur ce que vous devez lui dire ni sur son droit de s'y opposer : notez la question, votre conseil tranchera. Ce qui est certain aujourd'hui : vous ne déposez que des sources publiques dans l'outil.",
          },
        ],
        blocages: [
          {
            situation:
              "Un participant colle un extrait de son fichier client pour aller plus vite.",
            parade:
              "Arrêter immédiatement, sans discuter, et faire supprimer la conversation devant vous. C'est le seul point de la journée qui ne se négocie pas.",
          },
          {
            situation: "Un participant n'a apporté aucun document.",
            parade:
              "Le kit fournit un dossier prospect complet (pages 12 à 15) : plaquette, site imprimé, compte rendu d'appel. Ne le laissez pas regarder travailler son voisin pendant trente-cinq minutes.",
          },
          {
            situation:
              "Un participant a trois affaires en portefeuille et finit le tri en cinq minutes.",
            parade:
              "Lui faire trier le pipeline du kit (page 17, quinze affaires) puis préparer la restitution du groupe.",
          },
        ],
        planB:
          "Aucun de ces quatre temps ne dépend d'un outil. Le tri des dix éléments est un exercice papier. La fiche de préparation, le plan de découverte, le compte rendu et la relance s'écrivent à la main sur les trames datées du kit, et la structure AXION s'applique à l'identique : ce qui compte est la façon de poser la demande, pas la machine qui l'exécute. Chacun relancera depuis son poste dans la semaine.",
      },
    },
    verification: {
      question:
        "Deux contrôles croisés en binôme, sur la grille fournie. Sur la préparation de rendez-vous : barrez chaque affirmation dont votre binôme n'a pas ouvert la source lui-même, comptez les lignes barrées, et distinguez ce que l'outil a repris d'un document de ce qu'il a purement inventé. Sur le tri du pipeline : retirez tout critère qui décrit la personne et non l'affaire, remplacez-le, retriez, et mesurez de combien de rangs le classement a bougé.",
      reponseAttendue:
        "Sur la préparation : chaque ligne non sourcée est barrée au stylo sur la copie du binôme, et le nombre d'inventions est annoncé à voix haute — la salle sous-estime toujours. Sur le pipeline : le nombre de rangs de déplacement est écrit en haut de la feuille. Un classement qui bouge de trois rangs ou plus signifie que ce sont les critères, et non les affaires, qui décidaient de la tournée.",
      dureeMin: 20,
      notes: {
        script:
          "Contrôle CROISÉ, jamais auto-correction : on relit la copie du voisin, au stylo, et on barre physiquement. Une page rendue avec six lignes barrées se retient mieux que n'importe quelle consigne de vigilance. Faites annoncer les comptages à voix haute et notez-les au tableau : le chiffre affiché fait le travail que le discours ne fait pas. Sur le pipeline, exigez le nombre de rangs — c'est la seule mesure qui rend le biais de sélection visible sans discussion possible.",
        faq: [
          {
            question: "On est noté ? Ça compte pour l'attestation ?",
            reponse:
              "Pas ici. L'évaluation des acquis est en fin d'après-midi, sur dix questions. Ceci sert à repérer ce qui coince pendant qu'on peut encore le corriger.",
          },
          {
            question: "Mon binôme n'a rien barré, ma fiche est donc bonne.",
            reponse:
              "Ou l'œil de votre binôme n'est pas encore réglé. Demandez-lui de citer les trois sources qu'il a ouvertes lui-même : s'il n'en cite pas trois, la relecture n'a pas eu lieu.",
          },
        ],
        blocages: [
          {
            situation: "Les binômes se valident mutuellement par courtoisie.",
            parade:
              "Annoncer que chaque binôme devra citer AU MOINS un écart à l'oral, et en interroger deux au hasard. La complaisance tombe en dix secondes.",
          },
          {
            situation: "Le classement du pipeline ne bouge d'aucun rang après correction.",
            parade:
              "Le dire tel quel : « vos critères portaient déjà sur l'affaire, bonne nouvelle ». Puis donner le pipeline du kit page 18, dont les critères plantés déplacent cinq rangs.",
          },
        ],
        planB:
          "Grilles et corrigés sont imprimés dans le kit (pages 19 et 20). Aucun outil n'est nécessaire : les deux contrôles se font au stylo sur les productions papier.",
      },
    },
    synthese: {
      acquis: [
        "Je prépare un rendez-vous à partir des seules sources que j'ai ouvertes, et j'écris noir sur blanc ce qui reste à vérifier.",
        "Je sors du rendez-vous avec le compte rendu, le mail de suivi et la relance déjà écrits.",
        "Je trie mon pipeline sur des critères tirés de l'affaire, jamais de la personne.",
      ],
      dureeMin: 10,
      notes: {
        script:
          "Deux synthèses de cinq minutes, à deux moments différents : ne les fusionnez pas. La première clôt la préparation de rendez-vous — faites FORMULER par trois personnes, en une phrase, ce qu'elles ne feront plus lundi. La seconde clôt le compte rendu et le tri : faites verser physiquement les pièces 1 et 2 dans la chemise du kit, et faites nommer le fichier à voix haute — « kit-rdv-<affaire>-<date> ». Un kit sans nom n'est jamais rouvert. Annoncez l'après-midi en une phrase : « on affronte l'objection avant de la subir, et on écrit la proposition ».",
        faq: [],
        blocages: [
          {
            situation: "Il est 12 h 25, la salle veut déjeuner et personne ne formule rien.",
            parade:
              "Ne pas insister : énoncer les trois acquis vous-même, faire verser les pièces au kit, libérer. Un acquis récité de mauvaise grâce ne s'ancre pas mieux.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 2 (après-midi) — L'objection, la proposition commerciale,
  // la fiabilité et la feuille de route
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-2",
    objectif: {
      enonce:
        "À la fin de ce module, vous écrivez une proposition commerciale dont chaque promesse tient si le projet dérape, et vous repérez sur votre propre marché le moment où l'outil se trompe avec aplomb.",
      objectifGlobalId: "obj-2",
      // Le jeu de role sur les trois objections recurrentes construit
      // l'argumentaire (obj-1) ; la sequence cadre sur ce qui ne se chiffre
      // jamais et les mentions contractuelles porte la confidentialite (obj-5).
      objectifsSecondairesIds: ["obj-1", "obj-5"],
      dureeMin: 10,
      notes: {
        script:
          "Deux prises de parole de cinq minutes, séparées par la pause. La première ouvre l'après-midi et doit casser une attente : la salle croit qu'on va lui donner des réponses aux objections. Dites l'inverse, mot pour mot — « personne ne vous donnera votre réponse au prix, vous allez l'écrire et la dire à voix haute ». La seconde ouvre le temps de fiabilité : reprenez au tableau le nombre d'inventions comptées le matin, et annoncez qu'on va cette fois les chercher sur leur propre secteur, pas sur un cas d'école.",
        faq: [
          {
            question: "On repart avec un modèle de proposition commerciale ?",
            reponse:
              "Vous repartez avec la vôtre, écrite sur une affaire en cours, pas avec un modèle vide. Un modèle se télécharge ; une proposition défendable, non.",
          },
        ],
        blocages: [
          {
            situation: "La salle revient de déjeuner à plat.",
            parade:
              "Inverser l'ordre : faire lancer la première objection par l'outil AVANT toute annonce. L'annonce se fait après, en trente secondes, sur une salle déjà réveillée.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "On demande à l'outil de relire sa proposition commerciale. Il répond qu'elle est claire, bien structurée et convaincante, propose deux reformulations de style — et ne relève ni la promesse de délai intenable, ni le chiffre de gain qui ne repose sur rien, ni la phrase qui se lit comme un engagement de résultat. Sur un point de marché, il affirme avec le même aplomb un chiffre qu'il n'a lu nulle part.",
      apres:
        "L'outil reçoit un rôle et une contrainte : il est l'acheteur qui doit faire baisser le prix, et il n'a pas le droit d'être d'accord. Les objections tombent, dont deux que la salle n'avait pas anticipées. Puis chaque affirmation chiffrée passe au même filtre, en trente secondes chronométrées : on ouvre la source, on garde ce qu'elle porte, on barre le reste.",
      prompt:
        "PROMPT 1 — l'acheteur qui n'a pas le droit d'être d'accord\nTu es responsable achats d'une usine agroalimentaire de 200 personnes. Tu reçois un fournisseur de robinetterie industrielle que tu ne connais pas, alors que ton fournisseur actuel te donne satisfaction depuis huit ans. Ton objectif est de faire baisser le prix ou de ne pas signer. Tu n'as pas le droit d'être d'accord avec moi, ni de me complimenter, ni de conclure. Pose une objection à la fois, attends ma réponse, puis enchaîne sur la faille de ma réponse. Commence par l'objection prix.\n\nPROMPT 2 — la relecture qui contredit\nRelis la proposition commerciale ci-jointe en te plaçant du côté de l'acheteur, pas du mien. Liste uniquement : les promesses que je ne pourrai pas tenir si le projet dérape, les chiffres avancés sans source, les délais qui m'engagent, et les phrases qui pourraient être lues comme un engagement de résultat. Ne me dis pas ce qui est bien. Ne reformule rien. Si une promesse te paraît tenable, ne la cite pas.\n\nPROMPT 3 — la vérification en trente secondes\nTu viens d'affirmer que ce marché progresse de 12 % par an. Sur quelle source précise t'appuies-tu : titre, éditeur, année ? Si tu ne peux pas citer une source que je pourrais ouvrir moi-même, écris « affirmation non sourcée » et n'essaie pas de la justifier autrement.",
      outil: "Un seul outil, le même que le matin.",
      captureEcran:
        "La relecture complaisante et la relecture contrainte côte à côte, avec en marge les quatre éléments que la première a laissés passer — la promesse de délai, le chiffre de gain non sourcé, la formule qui vaut engagement de résultat, la remise annoncée.",
      verifieLe: VERIFIE_LE,
      dureeMin: 30,
      notes: {
        script:
          "Le jeu de rôle se tient DEVANT la salle, avec un volontaire au clavier et vous au commentaire — pas l'inverse. Arrêtez la partie au moment précis où l'outil bascule et félicite le volontaire : c'est l'enseignement du module, il dure trois secondes et il faut le pointer du doigt. Nommez la cause en une phrase : l'outil est réglé pour vous être agréable, pas pour vous faire perdre. Relancez alors avec la contrainte « tu n'as pas le droit d'être d'accord » et faites constater la différence. Sur la relecture de proposition : faites LIRE à voix haute la promesse la plus dangereuse que la version complaisante a laissée passer. Sur la vérification : chronométrez réellement, trotteuse en main — trente secondes, pas « rapidement ».",
        faq: [
          {
            question: "L'acheteur joué par l'outil n'est pas réaliste sur mon marché.",
            reponse:
              "Alors corrigez le rôle : son secteur, son ancienneté avec le fournisseur en place, sa contrainte de budget. Un rôle mal écrit donne un acheteur de théâtre — c'est le rôle qu'on travaille, pas l'outil.",
          },
          {
            question: "Pourquoi il finit toujours par me féliciter ?",
            reponse:
              "Parce qu'il est réglé pour être agréable. C'est précisément pourquoi la contrainte « tu n'as pas le droit d'être d'accord » n'est pas un détail de style : sans elle, l'entraînement ne vaut rien.",
          },
          {
            question: "S'il ne cite aucune source, c'est qu'il n'en a pas ?",
            reponse:
              "C'est qu'il n'en a pas d'ouvrable. Traitez l'affirmation comme absente : elle ne monte pas dans un document qui part sous votre signature.",
          },
        ],
        blocages: [
          {
            situation:
              "L'outil sort du rôle après trois échanges et redevient assistant serviable.",
            parade:
              "Relancer avec « reprends ton rôle d'acheteur, tu n'as pas le droit d'être d'accord » et poursuivre. Le montrer plutôt que le corriger discrètement : la salle doit savoir que ça arrive et comment le rattraper.",
          },
          {
            situation: "Le volontaire au clavier se fige devant la salle.",
            parade:
              "Reprendre le clavier et lui laisser le commentaire. On ne transforme pas une démonstration en épreuve individuelle.",
          },
        ],
        planB:
          "Les trois échanges — jeu de rôle, relecture complaisante, relecture contrainte — sont imprimés dans le kit (pages 22 à 26, datées). Mieux encore : sans outil, tenez vous-même le rôle de l'acheteur face à un volontaire. C'est la seule séquence de la journée où le repli humain vaut la démonstration.",
      },
    },
    pratique: {
      consigne:
        "Cinq temps chronométrés. (1) En binôme, sur la trame de jeu de rôle fournie : l'outil tient l'acheteur, vous traitez trois objections récurrentes de votre marché — le prix, le délai, le concurrent déjà en place — et vous écrivez votre réponse type pour chacune. (2) Rédigez la proposition commerciale de l'affaire réelle préparée ce matin, en recopiant vos mentions contractuelles depuis vos propres conditions de vente. (3) Chasse à l'erreur chronométrée sur la fiche prospect et l'argumentaire fournis : surlignez ce que vous croyez faux, on compte à main levée, la salle corrige et dit pourquoi. (4) Montez votre grille de relecture avant envoi à partir des erreurs que vous venez de relever, passez-la sur votre proposition, corrigez ce qu'elle fait remonter. (5) Écrivez votre feuille de route : trois usages installés dès lundi, sur quelles affaires nommées, et ce que vous regardez au bout d'un mois. Règle inchangée depuis ce matin : aucun prix négocié, aucune marge, aucun nom de contact n'entre dans l'outil.",
      aEmporter:
        "Vos trois réponses types d'objection, la proposition commerciale de l'affaire en cours, votre grille de relecture avant envoi construite sur vos propres erreurs, et votre feuille de route à un mois. Pièces 3, 4 et 5 — le kit de rendez-vous est complet.",
      dureeMin: 115,
      notes: {
        script:
          "Sur le jeu de rôle : la réponse à l'objection se dit À VOIX HAUTE au binôme avant d'être écrite. Une réponse au prix qu'on n'a jamais prononcée ne tient pas trente secondes en rendez-vous. Circulez et écoutez ; ne corrigez pas les mots, corrigez les promesses. Sur la proposition : rappelez avant le départ ce qui ne se chiffre jamais avec l'outil — remise, délai d'exécution, pénalité, engagement de résultat — et faites poser les conditions de vente de l'entreprise sur la table. Ce qui est contractuel se recopie depuis vos documents, jamais depuis un modèle proposé par l'outil. Sur la chasse à l'erreur : comptez les repérages à main levée AVANT de corriger et notez le score au tableau ; la salle sous-estime systématiquement, et le chiffre affiché fait le travail. Sur la feuille de route : refusez « je vais essayer d'utiliser l'IA ». Reformulez en une question — « sur quelle affaire, et quel jour ? » — et ne passez pas au suivant sans un nom et une date.",
        faq: [
          {
            question: "On peut demander à l'outil de proposer une remise commerciale ?",
            reponse:
              "Non. Une remise engage votre entreprise et se décide selon vos règles, pas selon ce qui est plausible. L'outil rédige la phrase qui la présente ; le chiffre vient de vous.",
          },
          {
            question: "Nos conditions générales de vente, je peux les faire résumer ?",
            reponse:
              "Vous pouvez vous les faire expliquer pour vous-même. Vous ne recopiez jamais le résumé dans une proposition : ce qui est contractuel se recopie mot pour mot depuis le document d'origine.",
          },
          {
            question: "Ma grille de relecture fait quinze lignes, personne ne la passera.",
            reponse:
              "Gardez les cinq lignes qui correspondent aux erreurs que VOUS avez laissées passer aujourd'hui. Une grille de cinq lignes qu'on passe vaut mieux qu'une grille de quinze qu'on saute.",
          },
          {
            question: "Dois-je dire à mon client que j'ai utilisé l'IA pour écrire ce document ?",
            reponse:
              "Je ne me prononce pas sur votre obligation : notez la question, votre conseil tranchera. Ce qui ne dépend d'aucun texte, en revanche : un écrit qui part sous votre signature vous engage, que vous l'ayez tapé ou seulement relu.",
          },
        ],
        blocages: [
          {
            situation:
              "Un binôme écrit une réponse à l'objection prix qui promet une remise pour emporter l'affaire.",
            parade:
              "Une seule question : « qui signe cette remise, vous ou votre direction ? ». Ils réécrivent seuls, sans qu'on ait à leur donner la réponse.",
          },
          {
            situation: "Un participant veut déposer sa proposition réelle, prix négociés compris.",
            parade:
              "Faire remplacer chaque montant par un repère — « montant A », « montant B » — avant tout dépôt. La structure se travaille sans les chiffres ; les chiffres se remettent à la main après.",
          },
          {
            situation: "La salle trouve toutes les erreurs plantées en dix minutes et s'ennuie.",
            parade:
              "Le jeu de documents du kit page 30 en contient quatre de plus, dont une qui ne se voit qu'en ouvrant la source citée.",
          },
          {
            situation:
              "Un participant refuse de nommer des affaires dans sa feuille de route, « ça dépend de mon manager ».",
            parade:
              "Lui faire nommer ce qui ne dépend que de lui : le prochain compte rendu dicté, la prochaine relance écrite. Une feuille de route sans nom ne se réalise pas.",
          },
        ],
        planB:
          "L'après-midi est le moment le plus robuste de la journée si l'outil tombe. Le jeu de rôle se tient entre vous et un volontaire, sans machine, et l'entraînement est même meilleur. La proposition s'écrit à la main sur la trame datée du kit. La chasse à l'erreur est un exercice papier : les deux documents fautifs sont imprimés (pages 28 et 29). La grille de relecture et la feuille de route ne dépendent d'aucun outil. Gardez ces cinq temps complets même si tout le reste a été dégradé.",
      },
    },
    verification: {
      question:
        "Deux temps. Contrôle croisé en binôme sur la proposition, grille fournie : la promesse est-elle tenable si le projet dérape ? un chiffre a-t-il été avancé sans source ouverte ? les mentions contractuelles viennent-elles bien des conditions de vente de l'entreprise ? la prochaine étape est-elle claire, datée et attribuée ? Puis évaluation des acquis : quiz individuel de dix questions corrigé en salle question par question, suivi de l'auto-évaluation d'une production du jour sur la grille de relecture.",
      reponseAttendue:
        "Sur la proposition : les quatre points passés en revue sur la copie du binôme, chaque promesse non tenable barrée au stylo et réécrite. Sur le quiz : le corrigé est commenté question par question, sans en sauter aucune. Le seuil de réussite est celui déclaré au programme ; un score en dessous déclenche la reprise individuelle prévue au dispositif.",
      dureeMin: 25,
      notes: {
        script:
          "Le contrôle croisé se fait au stylo sur la copie de l'autre, exactement comme le matin. Faites lire à voix haute UNE promesse barrée par binôme : c'est de loin ce que la salle retient le mieux de l'après-midi. Le quiz est l'évaluation des acquis au sens de l'indicateur 11 : elle se tient, elle se corrige, elle se conserve. Ne la sacrifiez jamais au temps qui manque — c'est la première chose qu'un auditeur demande. Si vous êtes en retard, coupez ailleurs, jamais ici.",
        faq: [
          {
            question: "Le résultat du quiz part chez mon directeur commercial ?",
            reponse:
              "Le résultat individuel, non. Ce qui est transmis, c'est l'attestation de fin de formation et le fait que l'évaluation a eu lieu.",
          },
          {
            question: "Ma proposition n'a aucune promesse barrée, c'est bon signe ?",
            reponse:
              "Vérifiez d'abord qu'elle en contient une. Une proposition qui ne promet rien ne se signe pas davantage qu'une proposition intenable.",
          },
        ],
        blocages: [
          {
            situation: "Il est 17 h 10 et le quiz n'a pas commencé.",
            parade:
              "Le tenir quand même, en réduisant le commentaire du corrigé aux trois questions les plus ratées. On ne remplace jamais l'évaluation des acquis par un tour de table.",
          },
          {
            situation: "Un participant conteste la réponse attendue d'une question du quiz.",
            parade:
              "Noter la contestation, donner la réponse du corrigé, poursuivre. La question se rediscute à la pause, pas devant la salle.",
          },
        ],
        planB:
          "Quiz papier dans le kit (page 32), corrigé page 33, grille de contrôle croisé page 31. Aucune dépendance à un outil.",
      },
    },
    synthese: {
      acquis: [
        "J'écris une proposition dont chaque promesse tient si le projet dérape.",
        "Je m'entraîne face à l'objection avant de la subir, et ma réponse au prix est écrite.",
        "Je passe ma grille de relecture avant tout envoi et je barre ce dont je n'ai pas ouvert la source.",
      ],
      dureeMin: 10,
      notes: {
        script:
          "Deux synthèses de cinq minutes. La première clôt la proposition : faites formuler par trois personnes, en une phrase, la promesse qu'elles ne mettront plus. La seconde clôt la journée — reprenez le tableau du matin, celui des affaires annoncées au tour de table, et passez-les une par une : ce que la journée a couvert, et ce qu'elle n'a pas couvert. Dire honnêtement ce qui n'a pas été traité achète toute la crédibilité du reste. Remettez le kit complet pièce par pièce, en les nommant à voix haute. Photographiez le tableau des feuilles de route et envoyez la photo au groupe le soir même.",
        faq: [],
        blocages: [
          {
            situation:
              "Un participant repart en disant « c'est bien, mais je n'aurai jamais le temps ».",
            parade:
              "Une question : « combien de temps vous a pris le compte rendu dicté ce matin ? ». Le chiffre qu'il donne répond à sa place.",
          },
          {
            situation: "Le kit d'un participant est incomplet, il lui manque deux pièces.",
            parade:
              "Lui faire noter les deux pièces manquantes et la date à laquelle il les écrira, avant de sortir de la salle. Un kit incomplet sans date ne se complète jamais.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },
];
