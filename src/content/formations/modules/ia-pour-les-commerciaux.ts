/**
 * CONTENU RÉDIGÉ — « IA pour les commerciaux » (1 jour, 7 h, 4 modules).
 *
 * ## Quatre modules, quatre temps pédagogiques
 *
 * Le catalogue publie cette journée en QUATRE modules : le cadre et la
 * préparation de rendez-vous (mod-1), le compte rendu dicté, le suivi et le tri
 * du pipeline (mod-2), l'objection et la proposition commerciale (mod-3), la
 * fiabilité et l'ancrage sur son propre marché (mod-4). Chaque module rédigé ici
 * couvre UN temps, avec sa propre prise de parole d'ouverture, sa démonstration
 * et son prompt en entier — plus rien n'est agrégé sur deux temps.
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
 * qui tient les contrôles croisés de la journée, et c'est elle qu'on mesure —
 * en lignes barrées, à voix haute.
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
  // Module 1 — Le cadre et le kit de rendez-vous
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-1",
    objectif: {
      enonce:
        "À la fin de ce module, vous savez ce qui entre et n'entre jamais dans un outil — votre liste rouge est écrite — et vous préparez un rendez-vous réel à partir des seules sources que vous avez ouvertes vous-même.",
      objectifGlobalId: "obj-1",
      // Les deux sequences de cadre et le tri en liste rouge portent la
      // confidentialite (obj-5).
      objectifsSecondairesIds: ["obj-5"],
      dureeMin: 5,
      notes: {
        script:
          "À l'ouverture, faites annoncer par chacun, en UNE phrase, le rendez-vous réel de sa semaine sur lequel il travaillera aujourd'hui : le secteur et l'enjeu, pas le nom du client si la salle mélange plusieurs entreprises. Écrivez les affaires au tableau et laissez la feuille affichée : elles seront reprises une par une à 17 h. Posez la règle qui tient la journée : l'IA prépare, le commercial engage sa signature. Annoncez le fil rouge — un kit de rendez-vous en cinq pièces, monté sur une affaire réelle, utilisable dès lundi matin.",
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
        "« Parle-moi de l'entreprise Untel, que je prépare mon rendez-vous. » La réponse arrive complète et assurée : un dirigeant, un chiffre d'affaires, un effectif, une actualité récente. Rien n'est sourcé, une partie est fausse, et aucune ligne ne le signale.",
      apres:
        "La même préparation construite à partir des SEULS documents fournis — plaquette, site, compte rendu du dernier échange — et sous la structure AXION. Ce qui vient des sources est utilisable en rendez-vous, ce qui manque est écrit noir sur blanc comme « non disponible dans les documents fournis ».",
      prompt:
        "PROMPT — préparation de rendez-vous, structure AXION\nActeur : tu es un directeur commercial expérimenté qui prépare un rendez-vous avec moi, commercial d'une PME de robinetterie industrielle.\nConteXte : je rencontre jeudi le responsable maintenance d'une usine agroalimentaire d'environ 200 personnes. Je te joins sa plaquette, la page « qui sommes-nous » de son site et le compte rendu de mon appel du 12 juin.\nIntention : entrer en rendez-vous avec un plan de découverte, pas avec un argumentaire.\nOutput : une fiche d'une page — ce que les documents joints m'apprennent, dix questions ouvertes de découverte, trois hypothèses d'enjeux explicitement étiquetées « hypothèse », et la liste de ce que je dois vérifier auprès de lui.\nNormes : n'utilise QUE les documents joints. N'invente aucun chiffre d'affaires, aucun effectif, aucun nom de dirigeant, aucune actualité. Si une information manque, écris « non disponible dans les documents fournis ».",
      outil: "Un seul outil pour toute la journée, celui validé dans la salle.",
      gain: { avant: "45 min", apres: "10 min" },
      captureEcran:
        "Les deux préparations côte à côte, avec en rouge dans la version libre les quatre éléments inventés — dirigeant, chiffre d'affaires, effectif, actualité — et en vert dans la version sourcée les mentions « non disponible dans les documents fournis ».",
      verifieLe: VERIFIE_LE,
      dureeMin: 20,
      notes: {
        script:
          "Faites PARIER par écrit avant d'afficher la première réponse : chacun note sur son support s'il pense que le dirigeant cité est le bon. La salle parie « oui » à une large majorité — c'est ce pari qui rend la suite mémorable. Affichez, puis ouvrez le site de l'entreprise en direct et comparez ligne à ligne. Ne dites jamais « c'est faux » vous-même : laissez quelqu'un de la salle le dire. Écrivez ensuite AXION au tableau — Acteur, conteXte, Intention, Output, Normes — et laissez-le affiché jusqu'au soir, on y revient à chaque module de la journée.",
        faq: [
          {
            question: "Si je lui donne le site du prospect, il ne va pas inventer quand même ?",
            reponse:
              "Il peut, et c'est pour cela que la ligne Normes exige « non disponible dans les documents fournis ». Une case vide est une information utile ; une case remplie au hasard est un piège qui vous explose en rendez-vous.",
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
        ],
        planB:
          "Quota atteint, réseau tombé, service indisponible : les deux préparations sont imprimées dans le kit formateur (pages 5 à 7, datées). Le pari écrit, la comparaison ligne à ligne et le repérage des inventions se tiennent à l'identique sur papier. Ne rien improviser en direct : les sorties du kit ont été vérifiées, celles du jour ne le sont pas.",
      },
    },
    pratique: {
      consigne:
        "Deux temps chronométrés. (1) Votre liste rouge : classez les dix éléments du support — prix négocié, fichier client, marge, contrat-cadre, remise exceptionnelle, notes manuscrites de rendez-vous, adresse mail d'un contact, plaquette publique du prospect, nom du dirigeant, compte rendu interne — en « jamais », « avec précaution », « librement ». (2) Préparez le rendez-vous réel annoncé ce matin avec vos propres documents : fiche de préparation, plan de découverte en questions ouvertes, hypothèses d'enjeux étiquetées comme telles, liste de ce qui reste à vérifier. Règle valable dans les deux temps : votre interlocuteur s'appelle « le responsable maintenance », jamais par son nom ; aucun prix négocié, aucune marge, aucun extrait de fichier client n'entre dans l'outil.",
      aEmporter:
        "Votre liste rouge personnelle, et la fiche de préparation du rendez-vous de la semaine avec son plan de découverte — pièce 1 du kit de rendez-vous.",
      dureeMin: 45,
      notes: {
        script:
          "Le tri des dix éléments se corrige EN SALLE, à main levée, élément par élément. C'est là que la salle découvre qu'elle n'est pas d'accord avec elle-même sur « notes manuscrites de rendez-vous » — ne tranchez pas les cas limites à sa place, faites argumenter deux minutes, puis donnez la règle de l'entreprise si elle existe. Sur la préparation : annoncez le chronomètre à voix haute toutes les dix minutes. Passez dans les rangs, relancez sur la ligne Normes du prompt, ne rédigez à la place de personne. Et redites la règle de confidentialité au démarrage de chaque temps, pas seulement en ouverture.",
        faq: [
          {
            question: "Comment je prépare un rendez-vous sans donner le nom de l'entreprise ?",
            reponse:
              "Vous donnez sa plaquette et son site, qui sont publics, et bien plus utiles qu'un nom. Ce qui reste dehors, c'est le nom de votre contact, la remise que vous lui avez consentie et votre marge.",
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
        ],
        planB:
          "Aucun de ces deux temps ne dépend d'un outil. Le tri des dix éléments est un exercice papier. La fiche de préparation et le plan de découverte s'écrivent à la main sur les trames datées du kit, et la structure AXION s'applique à l'identique : ce qui compte est la façon de poser la demande, pas la machine qui l'exécute. Chacun relancera depuis son poste dans la semaine.",
      },
    },
    verification: {
      question:
        "Contrôle croisé en binôme, sur la grille fournie : barrez chaque affirmation de la préparation de rendez-vous dont votre binôme n'a pas ouvert la source lui-même, comptez les lignes barrées, et distinguez ce que l'outil a repris d'un document de ce qu'il a purement inventé.",
      reponseAttendue:
        "Chaque ligne non sourcée est barrée au stylo sur la copie du binôme, et le nombre d'inventions est annoncé à voix haute — la salle sous-estime toujours. Les lignes barrées sont classées en deux colonnes : repris d'un document mais non vérifié, ou purement inventé.",
      dureeMin: 10,
      notes: {
        script:
          "Contrôle CROISÉ, jamais auto-correction : on relit la copie du voisin, au stylo, et on barre physiquement. Une page rendue avec six lignes barrées se retient mieux que n'importe quelle consigne de vigilance. Faites annoncer les comptages à voix haute et notez-les au tableau : le chiffre affiché fait le travail que le discours ne fait pas — et gardez-le écrit, il sera repris en ouverture du module 4.",
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
        ],
        planB:
          "Grille et corrigé sont imprimés dans le kit (page 19). Aucun outil n'est nécessaire : le contrôle se fait au stylo sur les productions papier.",
      },
    },
    synthese: {
      acquis: [
        "Je tiens ma liste rouge : je sais ce qui n'entre jamais dans un outil, ce qui entre avec précaution, et sur quel compte.",
        "Je prépare un rendez-vous à partir des seules sources que j'ai ouvertes, et j'écris noir sur blanc ce qui reste à vérifier.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Cinq minutes. Faites FORMULER par trois personnes, en une phrase, ce qu'elles ne feront plus lundi — pas un résumé, une action. Annoncez la suite en une phrase avant la pause : « après la pause, on ne repart plus du parking avec un compte rendu à écrire le soir ».",
        faq: [],
        blocages: [
          {
            situation: "La salle piaffe vers la pause et personne ne formule rien.",
            parade:
              "Ne pas insister : énoncer les deux acquis vous-même et libérer. Un acquis récité de mauvaise grâce ne s'ancre pas mieux.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 2 — Après le rendez-vous : compte rendu dicté, suivi et relances
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-2",
    objectif: {
      enonce:
        "À la fin de ce module, vous sortez d'un entretien avec le compte rendu, le mail de suivi et la relance déjà écrits, et vous triez votre pipeline sur des critères tirés de l'affaire, jamais de la personne.",
      objectifGlobalId: "obj-3",
      // Le tri du pipeline sur criteres d'affaire porte la qualification
      // (obj-4) ; la sequence cadre « qualifier sans profiler » et la regle
      // redite a chaque atelier portent la confidentialite (obj-5).
      objectifsSecondairesIds: ["obj-4", "obj-5"],
      dureeMin: 5,
      notes: {
        script:
          "Une prise de parole de cinq minutes, en une phrase qui parle à un commercial terrain : « on ne repart plus du parking avec un compte rendu à écrire le soir ». Annoncez les deux livrables du module — le compte rendu dicté avec sa relance à J+7, puis le pipeline trié — et rappelez que tout se fait sur les affaires réelles annoncées au tour de table.",
        faq: [
          {
            question: "Mon entreprise m'impose déjà une trame de compte rendu dans le CRM.",
            reponse:
              "Tant mieux : c'est cette trame que vous donnerez à l'outil comme structure de sortie. La dictée remplace la saisie du soir, pas le format maison.",
          },
        ],
        blocages: [
          {
            situation: "La salle revient de pause dispersée et met cinq minutes à se rasseoir.",
            parade:
              "Ne pas attendre le silence complet : lancer la dictée en direct — le téléphone au micro réveille mieux qu'un rappel à l'ordre.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "Le compte rendu du rendez-vous s'écrit à 21 h de mémoire, ou ne s'écrit pas. Le mail de suivi part deux jours plus tard, la relance jamais — et ce qui a vraiment été dit en entretien s'évapore entre-temps.",
      apres:
        "Le compte rendu se dicte en trois minutes depuis la voiture, avant même de démarrer. Trois sorties tombent d'un coup : le compte rendu structuré, le mail de suivi au client, les prochaines étapes datées — et les passages douteux sont signalés au lieu d'être comblés.",
      prompt:
        "PROMPT — compte rendu dicté\nVoici la transcription d'une dictée faite en voiture juste après un rendez-vous. Produis trois sorties séparées : (1) un compte rendu interne structuré — contexte, interlocuteurs par leur fonction, besoins exprimés, objections entendues, budget évoqué s'il l'a été ; (2) un mail de suivi adressé au client, ton professionnel et sobre, qui reprend ce qui a été dit et rien d'autre ; (3) les prochaines étapes, avec qui fait quoi et pour quelle date. N'ajoute aucun engagement de prix, de délai ni de remise qui ne figure pas dans la dictée. Signale entre crochets tout passage de la dictée que tu n'as pas compris.",
      outil: "Un seul outil, le même que dans le module précédent.",
      captureEcran:
        "La transcription brute d'une dictée de trois minutes et, en regard, les trois sorties — compte rendu structuré, mail de suivi, prochaines étapes datées — avec un passage incompris signalé entre crochets au lieu d'être inventé.",
      verifieLe: VERIFIE_LE,
      dureeMin: 10,
      notes: {
        script:
          "Dictez VOUS-MÊME, en direct, trois minutes, au micro du téléphone, sans relire. Annoncez les trois causes d'échec AVANT de dicter — bruit ambiant, noms propres, chiffres. Une salle qui guette apprend mieux qu'une salle qui écoute. Au moment d'afficher les trois sorties, pointez la ligne entre crochets : un outil qui signale ce qu'il n'a pas compris vaut mieux qu'un outil qui comble.",
        faq: [
          {
            question: "Ma dictée ressort avec tous les noms propres massacrés.",
            reponse:
              "Épelez-les une fois, à voix haute, en début de dictée. C'est la seule parade fiable et elle coûte dix secondes.",
          },
        ],
        blocages: [
          {
            situation: "La dictée en direct est inexploitable à cause du bruit de la salle.",
            parade:
              "Ne pas recommencer trois fois : la transcription ratée EST l'enseignement. La montrer, nommer la cause, puis afficher la transcription propre du kit (page 9) et poursuivre.",
          },
        ],
        planB:
          "Quota atteint, réseau tombé, service indisponible : la transcription et les trois sorties de la dictée sont imprimées dans le kit formateur (pages 8 et 9, datées). L'annonce des trois causes d'échec et la lecture commentée se tiennent à l'identique sur papier. Ne rien improviser en direct : les sorties du kit ont été vérifiées, celles du jour ne le sont pas.",
      },
    },
    pratique: {
      consigne:
        "Deux temps chronométrés. (1) Dictez trois minutes le compte rendu d'un rendez-vous récent, produisez les trois sorties, corrigez-les, puis écrivez la relance à J+7. (2) Triez votre pipeline de la semaine sur des critères tirés de l'affaire — jamais de la personne — et écrivez les relances correspondantes. Règle inchangée : votre interlocuteur s'appelle « le responsable maintenance », jamais par son nom ; aucun prix négocié, aucune marge, aucun extrait de fichier client n'entre dans l'outil.",
      aEmporter:
        "Le compte rendu, le mail de suivi et la relance à J+7 d'une affaire réelle — pièce 2 du kit de rendez-vous — et votre pipeline trié avec ses critères écrits.",
      dureeMin: 50,
      notes: {
        script:
          "Sur la dictée : annoncez le chronomètre à voix haute, passez dans les rangs, et faites corriger les sorties AVANT d'écrire la relance — une relance bâtie sur un compte rendu faux est une relance fausse. Sur le tri du pipeline : imposez d'écrire les critères AVANT de trier, sur une feuille séparée — un critère écrit après le tri est un critère qui justifie, pas un critère qui décide. Et redites la règle de confidentialité au démarrage de chaque temps, pas seulement en début de matinée : c'est au troisième atelier de la journée qu'elle se relâche.",
        faq: [
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
        ],
        blocages: [
          {
            situation:
              "Un participant a trois affaires en portefeuille et finit le tri en cinq minutes.",
            parade:
              "Lui faire trier le pipeline du kit (page 17, quinze affaires) puis préparer la restitution du groupe.",
          },
          {
            situation: "Un participant n'a aucun rendez-vous récent à dicter.",
            parade:
              "Lui faire dicter le dernier échange téléphonique marquant, même ancien. La mécanique s'apprend sur n'importe quel entretien réel — pas sur un cas inventé.",
          },
        ],
        planB:
          "Le compte rendu et la relance s'écrivent à la main sur les trames datées du kit, et le tri du pipeline est un exercice papier : les critères s'écrivent et se confrontent sans machine. Chacun dictera depuis son téléphone dans la semaine.",
      },
    },
    verification: {
      question:
        "Contrôle croisé en binôme sur le tri du pipeline : retirez tout critère qui décrit la personne et non l'affaire, remplacez-le, retriez, et mesurez de combien de rangs le classement a bougé.",
      reponseAttendue:
        "Chaque critère de personne est retiré et remplacé par un critère d'affaire vérifiable, et le nombre de rangs de déplacement est écrit en haut de la feuille. Un classement qui bouge de trois rangs ou plus signifie que ce sont les critères, et non les affaires, qui décidaient de la tournée.",
      dureeMin: 10,
      notes: {
        script:
          "Contrôle croisé au stylo, comme au module précédent. Exigez le nombre de rangs — c'est la seule mesure qui rend le biais de sélection visible sans discussion possible. Faites annoncer les chiffres à voix haute et notez-les au tableau, à côté du démonstrateur du cadre : deux jeux de critères, deux tournées, deux affaires perdues.",
        faq: [
          {
            question: "Mon classement n'a pas bougé, mes critères étaient donc bons ?",
            reponse:
              "Vérifiez d'abord qu'un critère a réellement été remplacé. Si oui, bonne nouvelle : vos critères portaient déjà sur l'affaire — c'est exactement ce qu'on cherche.",
          },
        ],
        blocages: [
          {
            situation: "Le classement du pipeline ne bouge d'aucun rang après correction.",
            parade:
              "Le dire tel quel : « vos critères portaient déjà sur l'affaire, bonne nouvelle ». Puis donner le pipeline du kit page 18, dont les critères plantés déplacent cinq rangs.",
          },
        ],
        planB:
          "Grille et corrigé sont imprimés dans le kit (page 20). Aucun outil n'est nécessaire : le contrôle se fait au stylo sur les tris papier.",
      },
    },
    synthese: {
      acquis: [
        "Je sors du rendez-vous avec le compte rendu, le mail de suivi et la relance déjà écrits.",
        "Je trie mon pipeline sur des critères tirés de l'affaire, jamais de la personne — et mes critères sont écrits avant le tri.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Cinq minutes. Faites verser physiquement les pièces 1 et 2 dans la chemise du kit, et faites nommer le fichier à voix haute — « kit-rdv-<affaire>-<date> ». Un kit sans nom n'est jamais rouvert. Annoncez l'après-midi en une phrase : « on affronte l'objection avant de la subir, et on écrit la proposition ».",
        faq: [],
        blocages: [
          {
            situation: "Il est 12 h 25, la salle veut déjeuner et personne ne formule rien.",
            parade:
              "Ne pas insister : énoncer les deux acquis vous-même, faire verser les pièces au kit, libérer. Un acquis récité de mauvaise grâce ne s'ancre pas mieux.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 3 — Objections et proposition commerciale
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-3",
    objectif: {
      enonce:
        "À la fin de ce module, vous avez écrit et prononcé votre réponse aux trois objections récurrentes de votre marché, et rédigé une proposition commerciale dont chaque promesse tient si le projet dérape.",
      objectifGlobalId: "obj-2",
      // Le jeu de role sur les trois objections recurrentes construit
      // l'argumentaire (obj-1) ; la sequence cadre sur ce qui ne se chiffre
      // jamais et les mentions contractuelles porte la confidentialite (obj-5).
      objectifsSecondairesIds: ["obj-1", "obj-5"],
      dureeMin: 5,
      notes: {
        script:
          "Une prise de parole de cinq minutes qui doit casser une attente : la salle croit qu'on va lui donner des réponses aux objections. Dites l'inverse, mot pour mot — « personne ne vous donnera votre réponse au prix, vous allez l'écrire et la dire à voix haute ». Annoncez que la proposition de ce module s'écrit sur l'affaire préparée le matin : le kit se construit d'une pièce sur l'autre.",
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
        "On demande à l'outil de relire sa proposition commerciale. Il répond qu'elle est claire, bien structurée et convaincante, propose deux reformulations de style — et ne relève ni la promesse de délai intenable, ni le chiffre de gain qui ne repose sur rien, ni la phrase qui se lit comme un engagement de résultat. Et face à une objection, il finit par vous féliciter au lieu de vous contredire.",
      apres:
        "L'outil reçoit un rôle et une contrainte : il est l'acheteur qui doit faire baisser le prix, et il n'a pas le droit d'être d'accord. Les objections tombent, dont deux que la salle n'avait pas anticipées. Puis, second temps : de simples notes d'affaire, une proposition se structure — et son ouverture change selon qu'elle sera lue par le décideur, le technique ou les achats.",
      prompt:
        "PROMPT 1 — l'acheteur qui n'a pas le droit d'être d'accord\nTu es responsable achats d'une usine agroalimentaire de 200 personnes. Tu reçois un fournisseur de robinetterie industrielle que tu ne connais pas, alors que ton fournisseur actuel te donne satisfaction depuis huit ans. Ton objectif est de faire baisser le prix ou de ne pas signer. Tu n'as pas le droit d'être d'accord avec moi, ni de me complimenter, ni de conclure. Pose une objection à la fois, attends ma réponse, puis enchaîne sur la faille de ma réponse. Commence par l'objection prix.\n\nPROMPT 2 — la relecture qui contredit\nRelis la proposition commerciale ci-jointe en te plaçant du côté de l'acheteur, pas du mien. Liste uniquement : les promesses que je ne pourrai pas tenir si le projet dérape, les chiffres avancés sans source, les délais qui m'engagent, et les phrases qui pourraient être lues comme un engagement de résultat. Ne me dis pas ce qui est bien. Ne reformule rien. Si une promesse te paraît tenable, ne la cite pas.\n\nPROMPT 3 — de vos notes à la proposition, selon l'interlocuteur\nActeur : tu es un directeur commercial expérimenté qui met en forme une proposition, sans jamais décider d'un chiffre à ma place.\nConteXte : je vends de la robinetterie industrielle ; voici mes notes sur l'affaire en cours avec une usine agroalimentaire de 200 personnes — besoin exprimé, périmètre discuté, calendrier évoqué, montant ramené à « montant A ».\nIntention : produire une proposition que le responsable maintenance fera circuler en interne, donc lisible par trois lecteurs différents.\nOutput : une proposition structurée — contexte et besoin reformulés, solution proposée, périmètre et limites, calendrier, conditions renvoyées à nos conditions de vente — puis, pour chaque lecteur (décideur, technique, achats), les deux points à mettre en avant en ouverture.\nNormes : n'utilise QUE mes notes. Laisse « montant A » tel quel ; n'invente aucun prix, aucune remise, aucun délai d'exécution, aucune pénalité, et n'écris aucune phrase qui promet un résultat. Marque chaque mention contractuelle « à recopier depuis les conditions de vente ». Si une information manque, écris « à compléter » plutôt que d'inventer.",
      outil: "Un seul outil, le même que le matin.",
      captureEcran:
        "La relecture complaisante et la relecture contrainte côte à côte, avec en marge les quatre éléments que la première a laissés passer — la promesse de délai, le chiffre de gain non sourcé, la formule qui vaut engagement de résultat, la remise annoncée.",
      verifieLe: VERIFIE_LE,
      dureeMin: 25,
      notes: {
        script:
          "Le jeu de rôle se tient DEVANT la salle, avec un volontaire au clavier et vous au commentaire — pas l'inverse. Arrêtez la partie au moment précis où l'outil bascule et félicite le volontaire : c'est l'enseignement du module, il dure trois secondes et il faut le pointer du doigt. Nommez la cause en une phrase : l'outil est réglé pour vous être agréable, pas pour vous faire perdre. Relancez alors avec la contrainte « tu n'as pas le droit d'être d'accord » et faites constater la différence. Sur la relecture de proposition : faites LIRE à voix haute la promesse la plus dangereuse que la version complaisante a laissée passer. Sur le second temps — des notes à la proposition — faites remarquer les mentions « à recopier depuis les conditions de vente » et le « montant A » resté tel quel : c'est la démonstration de la règle du cadre, pas un détail de forme, et l'angle d'ouverture qui change selon le lecteur.",
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
          "Les trois échanges — jeu de rôle, relecture complaisante contre relecture contrainte, notes mises en proposition — sont imprimés dans le kit (pages 22 à 26, datées). Mieux encore : sans outil, tenez vous-même le rôle de l'acheteur face à un volontaire. C'est la seule séquence de la journée où le repli humain vaut la démonstration.",
      },
    },
    pratique: {
      consigne:
        "Deux temps chronométrés. (1) En binôme, sur la trame de jeu de rôle fournie : l'outil tient l'acheteur, vous traitez trois objections récurrentes de votre marché — le prix, le délai, le concurrent déjà en place — et vous écrivez votre réponse type pour chacune. (2) Rédigez la proposition commerciale de l'affaire réelle préparée ce matin, en recopiant vos mentions contractuelles depuis vos propres conditions de vente. Règle inchangée depuis ce matin : aucun prix négocié, aucune marge, aucun nom de contact n'entre dans l'outil — les montants entrent comme repères, « montant A », « montant B ».",
      aEmporter:
        "Vos trois réponses types d'objection et la proposition commerciale de l'affaire en cours — pièces 3 et 4 du kit de rendez-vous.",
      dureeMin: 60,
      notes: {
        script:
          "Sur le jeu de rôle : la réponse à l'objection se dit À VOIX HAUTE au binôme avant d'être écrite. Une réponse au prix qu'on n'a jamais prononcée ne tient pas trente secondes en rendez-vous. Circulez et écoutez ; ne corrigez pas les mots, corrigez les promesses. Sur la proposition : rappelez avant le départ ce qui ne se chiffre jamais avec l'outil — remise, délai d'exécution, pénalité, engagement de résultat — et faites poser les conditions de vente de l'entreprise sur la table. Ce qui est contractuel se recopie depuis vos documents, jamais depuis un modèle proposé par l'outil.",
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
        ],
        planB:
          "Le jeu de rôle se tient entre vous et un volontaire, sans machine, et l'entraînement est même meilleur. La proposition s'écrit à la main sur la trame datée du kit, conditions de vente posées sur la table. Gardez ces deux temps complets même si tout le reste a été dégradé.",
      },
    },
    verification: {
      question:
        "Contrôle croisé en binôme sur la proposition, grille fournie : la promesse est-elle tenable si le projet dérape ? un chiffre a-t-il été avancé sans source ouverte ? les mentions contractuelles viennent-elles bien des conditions de vente de l'entreprise ? la prochaine étape est-elle claire, datée et attribuée ?",
      reponseAttendue:
        "Les quatre points passés en revue sur la copie du binôme, chaque promesse non tenable barrée au stylo et réécrite, et chaque mention contractuelle pointée vers le document d'origine.",
      dureeMin: 10,
      notes: {
        script:
          "Le contrôle croisé se fait au stylo sur la copie de l'autre, exactement comme le matin. Faites lire à voix haute UNE promesse barrée par binôme : c'est de loin ce que la salle retient le mieux de l'après-midi.",
        faq: [
          {
            question: "Ma proposition n'a aucune promesse barrée, c'est bon signe ?",
            reponse:
              "Vérifiez d'abord qu'elle en contient une. Une proposition qui ne promet rien ne se signe pas davantage qu'une proposition intenable.",
          },
        ],
        blocages: [
          {
            situation: "Un binôme conteste : « cette promesse, on la tient toujours ».",
            parade:
              "Une seule question : « et si le projet prend trois semaines de retard, vous la tenez encore ? ». C'est le critère de la grille, pas une opinion — la promesse se réécrit conditionnée ou se barre.",
          },
        ],
        planB:
          "La grille de contrôle croisé est imprimée dans le kit (page 31). Aucune dépendance à un outil : le contrôle se fait au stylo sur les propositions papier.",
      },
    },
    synthese: {
      acquis: [
        "Je m'entraîne face à l'objection avant de la subir, et ma réponse au prix est écrite.",
        "J'écris une proposition dont chaque promesse tient si le projet dérape.",
        "Ce qui est contractuel se recopie depuis mes conditions de vente, jamais depuis un modèle proposé par l'outil.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Cinq minutes. Faites formuler par trois personnes, en une phrase, la promesse qu'elles ne mettront plus dans une proposition. Annoncez la suite avant la pause : « après la pause, on cherche les erreurs de l'outil sur VOTRE marché — et cette fois c'est vous qui les trouvez ».",
        faq: [],
        blocages: [
          {
            situation:
              "Les pièces 3 et 4 restent éparpillées sur les tables au moment de la pause.",
            parade:
              "Faire verser les deux pièces au kit AVANT de libérer la salle, comme le matin. Une pièce qui ne rejoint pas la chemise ne rejoint jamais le terrain.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
  },

  // ───────────────────────────────────────────────────────────────────────────
  // Module 4 — Fiabilité et ancrage sur son propre marché
  // ───────────────────────────────────────────────────────────────────────────
  {
    moduleId: "mod-4",
    objectif: {
      enonce:
        "À la fin de ce module, vous repérez sur votre propre marché le moment où l'outil se trompe avec aplomb, et votre grille de relecture avant envoi est construite sur vos propres erreurs — et déjà passée sur votre proposition.",
      objectifGlobalId: "obj-5",
      // La grille de relecture se passe sur la proposition redigee au module
      // precedent et la corrige (obj-2).
      objectifsSecondairesIds: ["obj-2"],
      dureeMin: 5,
      notes: {
        script:
          "Une prise de parole de cinq minutes : reprenez au tableau le nombre d'inventions comptées le matin lors du contrôle croisé, et annoncez qu'on va cette fois les chercher sur leur propre secteur, pas sur un cas d'école. La règle de la journée devient ici un réflexe outillé : rien ne part sous votre signature sans une source ouverte — et ce module fabrique l'outil qui le garantit, la grille de relecture.",
        faq: [
          {
            question: "On a déjà vu ce matin que l'outil invente, pourquoi y revenir ?",
            reponse:
              "Ce matin, c'était sur un cas d'école et c'est le formateur qui l'a montré. Ici, c'est sur votre marché et c'est vous qui trouvez — c'est la différence entre savoir que l'outil invente et le repérer quand il le fait chez vous.",
          },
        ],
        blocages: [
          {
            situation: "La salle, en fin de journée, réclame de « finir plus tôt ».",
            parade:
              "Annoncer le programme du module en trois livrables datés — la grille, le quiz, la feuille de route — et rappeler que c'est le module qui décide de ce qui survivra à la journée. Ne rien couper ici.",
          },
        ],
        planB: "Aucun outil en jeu.",
      },
    },
    demonstration: {
      avant:
        "Sur un point de marché, l'outil affirme avec aplomb un chiffre qu'il n'a lu nulle part — « ce marché progresse de 12 % par an » — et le chiffre glisse tel quel dans un argumentaire prêt à partir sous signature.",
      apres:
        "Chaque affirmation chiffrée passe au même filtre, en trente secondes chronométrées : on demande la source précise, on l'ouvre, on garde ce qu'elle porte, on barre le reste. Une affirmation sans source ouvrable est traitée comme absente.",
      prompt:
        "PROMPT — la vérification en trente secondes\nTu viens d'affirmer que ce marché progresse de 12 % par an. Sur quelle source précise t'appuies-tu : titre, éditeur, année ? Si tu ne peux pas citer une source que je pourrais ouvrir moi-même, écris « affirmation non sourcée » et n'essaie pas de la justifier autrement.",
      outil: "Un seul outil, le même que depuis ce matin.",
      captureEcran:
        "L'affirmation « ce marché progresse de 12 % par an » et, dessous, la réponse « affirmation non sourcée » — avec, en regard, la ligne barrée au stylo dans l'argumentaire qui allait partir.",
      verifieLe: VERIFIE_LE,
      dureeMin: 5,
      notes: {
        script:
          "Chronométrez réellement, trotteuse en main — trente secondes, pas « rapidement » : c'est la brièveté du geste qui le rend adoptable. Montrez la ligne barrée comme un résultat, pas comme une perte : une affirmation retirée avant envoi est un rendez-vous sauvé. Et annoncez la chasse à l'erreur qui suit : « maintenant, c'est vous qui barrez ».",
        faq: [
          {
            question: "S'il ne cite aucune source, c'est qu'il n'en a pas ?",
            reponse:
              "C'est qu'il n'en a pas d'ouvrable. Traitez l'affirmation comme absente : elle ne monte pas dans un document qui part sous votre signature.",
          },
        ],
        blocages: [
          {
            situation:
              "L'outil cite une source plausible — titre, éditeur, année — mais introuvable.",
            parade:
              "C'est le cas d'école, et il vaut de l'or devant la salle : une source qu'on ne peut pas ouvrir soi-même est une absence de source. On barre, et on le dit avec la formule de la journée : « une source que JE n'ai pas ouverte n'existe pas ».",
          },
        ],
        planB:
          "L'échange de vérification — l'affirmation, la question, la réponse « affirmation non sourcée » — est imprimé dans le kit (page 27, daté). La démonstration se tient sur papier, chronomètre en main, à l'identique.",
      },
    },
    pratique: {
      consigne:
        "Trois temps chronométrés. (1) Chasse à l'erreur sur la fiche prospect et l'argumentaire fournis, produits sur votre secteur : surlignez ce que vous croyez faux, on compte à main levée, la salle corrige et dit pourquoi. (2) Montez votre grille de relecture avant envoi à partir des erreurs que vous venez de relever, passez-la sur la proposition écrite en début d'après-midi, corrigez ce qu'elle fait remonter. (3) Écrivez votre feuille de route : trois usages installés dès lundi, sur quelles affaires nommées, et ce que vous regardez au bout d'un mois. Règle inchangée depuis ce matin : aucun prix négocié, aucune marge, aucun nom de contact n'entre dans l'outil.",
      aEmporter:
        "Votre grille de relecture avant envoi construite sur vos propres erreurs, et votre feuille de route à un mois. Pièce 5 — le kit de rendez-vous est complet.",
      dureeMin: 55,
      notes: {
        script:
          "Sur la chasse à l'erreur : comptez les repérages à main levée AVANT de corriger et notez le score au tableau ; la salle sous-estime systématiquement, et le chiffre affiché fait le travail. Exigez le « pourquoi c'est faux » à chaque correction — repérer sans expliquer ne construit pas la grille. Sur la grille : elle se monte sur les erreurs que CHACUN a laissées passer aujourd'hui, pas sur une liste générique, puis se passe immédiatement sur la proposition du module précédent — c'est ce passage qui prouve qu'elle sert. Sur la feuille de route : refusez « je vais essayer d'utiliser l'IA ». Reformulez en une question — « sur quelle affaire, et quel jour ? » — et ne passez pas au suivant sans un nom et une date.",
        faq: [
          {
            question: "Ma grille de relecture fait quinze lignes, personne ne la passera.",
            reponse:
              "Gardez les cinq lignes qui correspondent aux erreurs que VOUS avez laissées passer aujourd'hui. Une grille de cinq lignes qu'on passe vaut mieux qu'une grille de quinze qu'on saute.",
          },
        ],
        blocages: [
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
          "Ce module est le plus robuste de la journée si l'outil tombe. La chasse à l'erreur est un exercice papier : les deux documents fautifs sont imprimés (pages 28 et 29). La grille de relecture et la feuille de route ne dépendent d'aucun outil. Gardez ces trois temps complets même si tout le reste a été dégradé.",
      },
    },
    verification: {
      question:
        "Évaluation des acquis : quiz individuel de dix questions corrigé en salle question par question, suivi de l'auto-évaluation d'une production du jour sur la grille de relecture que chacun vient de construire.",
      reponseAttendue:
        "Le corrigé est commenté question par question, sans en sauter aucune, et chaque participant passe sa grille sur une de ses productions du jour. Le seuil de réussite est celui déclaré au programme ; un score en dessous déclenche la reprise individuelle prévue au dispositif.",
      dureeMin: 15,
      notes: {
        script:
          "Le quiz est l'évaluation des acquis au sens de l'indicateur 11 : elle se tient, elle se corrige, elle se conserve. Ne la sacrifiez jamais au temps qui manque — c'est la première chose qu'un auditeur demande. Si vous êtes en retard, coupez ailleurs, jamais ici. L'auto-évaluation sur la grille vient APRÈS le quiz : elle montre que la grille sert dès aujourd'hui, pas « à partir de lundi ».",
        faq: [
          {
            question: "Le résultat du quiz part chez mon directeur commercial ?",
            reponse:
              "Le résultat individuel, non. Ce qui est transmis, c'est l'attestation de fin de formation et le fait que l'évaluation a eu lieu.",
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
        planB: "Quiz papier dans le kit (page 32), corrigé page 33. Aucune dépendance à un outil.",
      },
    },
    synthese: {
      acquis: [
        "Je repère sur mon propre marché le moment où l'outil se trompe avec aplomb.",
        "Je passe ma grille de relecture avant tout envoi et je barre ce dont je n'ai pas ouvert la source.",
        "Ma feuille de route nomme trois usages, des affaires réelles et un rendez-vous de mesure à un mois.",
      ],
      dureeMin: 5,
      notes: {
        script:
          "Cinq minutes pour clore la journée. Reprenez le tableau du matin, celui des affaires annoncées au tour de table, et passez-les une par une : ce que la journée a couvert, et ce qu'elle n'a pas couvert. Dire honnêtement ce qui n'a pas été traité achète toute la crédibilité du reste. Remettez le kit complet pièce par pièce, en les nommant à voix haute. Photographiez le tableau des feuilles de route et envoyez la photo au groupe le soir même.",
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
