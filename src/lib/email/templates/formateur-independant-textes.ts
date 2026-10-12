// Formateurs indépendants — les TEXTES des e-mails F1 à F60 (lot L-ENV).
//
// 🔴 NON VALIDÉS. Ces textes sont ceux soumis à Will (brouillon du 10/10/2026) ; aucun ne
// part tant que l'interrupteur `textes_valides` est éteint ET que le registre « texte
// validé » (`server/email/textes-valides.ts`) ne porte pas le gabarit. L'adaptateur
// d'envoi (`server/qualiopi/formateurs-independants/envois.ts`) le vérifie avant TOUT
// enfilage, cron compris.
//
// Généré depuis le document de validation, puis relu : un objet de plus de 45 caractères
// (règle du référentiel, `objet-email.ts`) est raccourci, et l'objet d'origine est gardé
// dans `objetPropose` pour que Will tranche.
//
// Les mots entre [crochets] sont remplis par l'outil (`valeurs` du payload) ; tant
// qu'aucune valeur n'est fournie, l'aperçu les montre tels quels.
//
// Pur : aucun import (le worker peut le lire).

export type FamilleTexteFormateur = "A" | "B";

export interface VarianteTexteFormateur {
  /** Libellé de l'étape (« J+3 », « veille »…), ou `null` pour un e-mail sans étape. */
  readonly etape: string | null;
  readonly objet: string;
  /** L'objet du document de validation, quand il a fallu le raccourcir. */
  readonly objetPropose: string | null;
  /** Paragraphes ; une ligne commençant par « • » est une puce. */
  readonly paragraphes: readonly string[];
  /** Libellés des boutons possibles (le premier par défaut). */
  readonly boutons: readonly string[];
}

export interface TexteFormateur {
  /** Numéro du catalogue (F1…F60). */
  readonly code: string;
  readonly titre: string;
  readonly quand: string;
  readonly famille: FamilleTexteFormateur;
  /** Message interne, pour Will seul. */
  readonly interne: boolean;
  /** Sollicitation : soumise à l'opposition, porte la ligne de désinscription. */
  readonly sollicitation: boolean;
  readonly variantes: readonly [VarianteTexteFormateur, ...VarianteTexteFormateur[]];
}

export const LIGNE_OPPOSITION =
  "Si vous ne souhaitez plus recevoir de message de notre part, un clic suffit : le lien est en bas de ce message.";

export const TEXTES_FORMATEUR = {
  "formateur-invitation-echange": {
    code: "F1",
    titre: "Invitation à l'échange",
    quand:
      "15 à 20 minutes après la candidature (une seule invitation par personne ; rien ne part si le registre des entreprises montre une entreprise fermée).",
    famille: "B",
    interne: false,
    sollicitation: true,
    variantes: [
      {
        etape: null,
        objet: "Choisissez votre moment pour notre échange",
        objetPropose: null,
        paragraphes: [
          "Merci pour votre candidature.",
          "Nous vous proposons un échange de 20 minutes en visio pour faire connaissance, vous présenter comment fonctionnent les missions que nous confions à des formateurs indépendants, et répondre à vos questions. Sans engagement : à l'issue, chacun décide librement de la suite.",
          "Choisissez le moment qui vous convient avec le bouton ci-dessous.",
        ],
        boutons: ["Choisir mon moment"],
      },
    ],
  },
  "formateur-invitation-relance": {
    code: "F2",
    titre: "Relances de l'invitation (2 au plus)",
    quand:
      "3 jours puis 7 jours après l'invitation, tant que la personne n'a ni réservé, ni répondu, ni été classée par vous. Rien après 14 jours.",
    famille: "B",
    interne: false,
    sollicitation: true,
    variantes: [
      {
        etape: "J+3",
        objet: "Votre échange vous attend",
        objetPropose: null,
        paragraphes: ["Il ne reste qu'à choisir le moment, en un clic."],
        boutons: ["Choisir mon moment"],
      },
      {
        etape: "J+7",
        objet: "Dernier message au sujet de notre échange",
        objetPropose: "Notre dernier message au sujet de notre échange",
        paragraphes: [
          "L'échange de 20 minutes reste ouvert. Si le moment n'est pas le bon, aucun souci : nous ne vous relancerons plus.",
        ],
        boutons: ["Choisir mon moment"],
      },
    ],
  },
  "formateur-invitation-rattrapage": {
    code: "F55",
    titre: "Rattrapage unique des candidatures déjà reçues (sans « 15 minutes », sans relance)",
    quand:
      "une seule fois, après votre aperçu de la liste nominative, aux candidatures reçues depuis le 9 octobre qui n'ont pas encore été invitées.",
    famille: "B",
    interne: false,
    sollicitation: true,
    variantes: [
      {
        etape: null,
        objet: "Votre candidature : nous revenons vers vous",
        objetPropose: "Votre candidature de formateur indépendant : nous revenons vers vous",
        paragraphes: [
          "Vous avez candidaté à la mission de formateur IA indépendant. Nous vous répondons un peu plus tard que prévu, et nous nous en excusons.",
          "Nous vous proposons un échange en visio pour faire connaissance, vous expliquer comment fonctionnent les missions et répondre à vos questions. Sans engagement.",
          "Si vous avez trouvé une autre voie entre-temps, vous n'avez rien à faire : nous ne vous relancerons pas.",
        ],
        boutons: ["Choisir mon moment"],
      },
    ],
  },
  "formateur-echange-confirme": {
    code: "F3",
    titre: "Échange confirmé",
    quand: "la personne vient de réserver son créneau (en moins d'une minute).",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "Échange confirmé : [jour] à [heure]",
        objetPropose: "C'est confirmé : notre échange du [jour] à [heure]",
        paragraphes: [
          "C'est confirmé. Nous ferons connaissance, nous vous présenterons le fonctionnement des missions et vous poserez vos questions.",
          "L'invitation d'agenda vous parvient séparément, par Calendly. Nous vous écrivons la veille, puis une heure avant. Rien à préparer.",
        ],
        boutons: [],
      },
    ],
  },
  "formateur-echange-rappel": {
    code: "F4",
    titre: "Rappels de l'échange (la veille, puis une heure avant)",
    quand: "24 heures avant, puis 1 heure avant l'échange, sauf annulation.",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: "veille",
        objet: "Notre échange a lieu demain à [HH:MM]",
        objetPropose: null,
        paragraphes: [
          "Votre échange a lieu demain à [HH:MM] (heure de Paris). Le lien de connexion est dans l'invitation d'agenda.",
        ],
        boutons: [],
      },
      {
        etape: "1 heure avant",
        objet: "Notre échange commence dans une heure",
        objetPropose: null,
        paragraphes: ["Votre échange a lieu dans une heure, à [HH:MM] (heure de Paris)."],
        boutons: ["Rejoindre la visio"],
      },
    ],
  },
  "formateur-issue-retenu": {
    code: "F5",
    titre: "Échange concluant : la suite (clic « Retenu »)",
    quand: "vous cliquez « Retenu » après l'échange, et vous avez vu l'aperçu.",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "Votre candidature : la suite",
        objetPropose: "Votre candidature de formateur indépendant : la suite",
        paragraphes: [
          "Merci pour notre échange. Nous serions heureux de vous confier des missions de formation.",
          "Comment cela se passe :\n• une mission vous est proposée, avec les dates et les honoraires indiqués avant que vous répondiez ; vous l'acceptez ou vous la refusez librement, sans aucune conséquence ;\n• aucun volume n'est garanti ;\n• vous restez libre de vos méthodes d'animation, dans le programme convenu, et de travailler pour d'autres clients ;\n• honoraires : 350 € HT la journée, 175 € HT la demi-journée.",
          "Première étape : compléter votre dossier (environ 10 minutes, vous pouvez reprendre plus tard). Vous y signerez aussi votre contrat de sous-traitance, qui ne prend effet qu'après notre vérification et notre propre signature.",
        ],
        boutons: ["Compléter mon dossier"],
      },
    ],
  },
  "formateur-issue-non-retenu": {
    code: "F6",
    titre: "Échange non concluant (clic « Non retenu »)",
    quand: "vous cliquez « Non retenu », après aperçu.",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "Merci pour notre échange",
        objetPropose: null,
        paragraphes: [
          "Merci pour le temps que vous nous avez consacré.",
          "Nous ne donnons pas suite pour le moment : nos besoins actuels ne correspondent pas à votre profil. Nous gardons votre candidature et pourrons revenir vers vous si cela change.",
          "Si vous préférez que nous effacions vos données, répondez simplement à ce message : Williams Jullin, responsable d'Axion-IA, traite votre demande. Nous rendons alors votre fiche anonyme et ne gardons que ce que la loi nous impose de conserver.",
        ],
        boutons: [],
      },
    ],
  },
  "formateur-issue-absent": {
    code: "F7",
    titre: "Absent à l'échange (clic « Absent »)",
    quand: "vous cliquez « Absent » (une seule fois par personne).",
    famille: "B",
    interne: false,
    sollicitation: true,
    variantes: [
      {
        etape: null,
        objet: "Nous vous avons attendu",
        objetPropose: null,
        paragraphes: [
          "Nous vous avons attendu pour notre échange. Un imprévu arrive à tout le monde.",
          "Si la proposition vous intéresse toujours, choisissez un nouveau créneau. Sinon, vous n'avez rien à faire : nous ne vous relancerons pas.",
        ],
        boutons: ["Choisir un autre moment"],
      },
    ],
  },
  "formateur-dossier-lien": {
    code: "F8",
    titre: "Lien du dossier (renvoi)",
    quand: "vous cliquez « Renvoyer le lien », ou le lien est renouvelé.",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "Le lien de votre dossier de formateur",
        objetPropose: "Le lien de votre dossier de formateur indépendant",
        paragraphes: [
          "Voici le lien de votre dossier : coordonnées, activité, pièces à fournir et contrat. Environ 10 minutes ; vous pouvez vous arrêter et reprendre plus tard. Ce lien vous est personnel.",
        ],
        boutons: ["Compléter mon dossier"],
      },
    ],
  },
  "formateur-dossier-relance": {
    code: "F9",
    titre: "Relances du dossier (2 au plus)",
    quand:
      "3 puis 7 jours après F5 ou F8, tant que le dossier n'est pas envoyé. Rien après 14 jours.",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: "J+3",
        objet: "Votre dossier vous attend",
        objetPropose: null,
        paragraphes: ["Il reste à le compléter pour que nous puissions vous confier des missions."],
        boutons: ["Compléter mon dossier"],
      },
      {
        etape: "J+7",
        objet: "Dernier rappel : votre dossier reste ouvert",
        objetPropose: null,
        paragraphes: [
          "Votre dossier est toujours ouvert, vous pouvez le reprendre là où vous l'avez laissé.",
        ],
        boutons: ["Compléter mon dossier"],
      },
    ],
  },
  "formateur-dossier-recu": {
    code: "F10",
    titre: "Dossier bien reçu (avec la copie de la signature du contrat)",
    quand:
      "la personne envoie son dossier signé. Remplace l'ancien « F28 bis » : un seul e-mail au lieu de deux.",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "Votre dossier est bien reçu",
        objetPropose: null,
        paragraphes: [
          "Votre dossier est bien reçu. Vous trouverez en pièce jointe la copie du contrat que vous avez signé.",
          "Nous vérifions maintenant vos informations au registre public. Votre contrat contresigné et l'accès à votre espace vous parviendront ensuite par e-mail.",
        ],
        boutons: [],
      },
    ],
  },
  "formateur-dossier-a-verifier": {
    code: "F11",
    titre: "Dossier à vérifier (message interne, pour vous seul)",
    quand:
      "un dossier est envoyé (alerte Telegram et corbeille, jamais de nom complet, d'IBAN ni de numéro d'entreprise).",
    famille: "B",
    interne: true,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "Dossier formateur reçu, à vérifier",
        objetPropose: null,
        paragraphes: [
          "Dossier reçu · [identifiant court] · registre : [vert / orange / rouge] · [lien console « Vérifier et contresigner »]",
        ],
        boutons: [],
      },
    ],
  },
  "formateur-dossier-a-completer": {
    code: "F12",
    titre: "Il manque un élément (vous décidez)",
    quand:
      "sur l'écran de vérification, vous cliquez « Demander un complément », en choisissant un motif dans une liste fermée.",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "Votre dossier : il nous manque un élément",
        objetPropose: null,
        paragraphes: [
          "Pour continuer, il nous manque : [motif].",
          "Vous pouvez le déposer avec le même lien, il suffit de reprendre votre dossier.",
        ],
        boutons: ["Reprendre mon dossier"],
      },
    ],
  },
  "formateur-dossier-refuse": {
    code: "F13",
    titre: "Dossier non retenu (vous confirmez un registre rouge)",
    quand:
      "le registre indique une entreprise fermée ou un numéro introuvable, et vous cliquez « Refuser le dossier », après aperçu.",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "Votre dossier de formateur indépendant",
        objetPropose: null,
        paragraphes: [
          "Merci pour votre intérêt.",
          "Le registre public n'indique pas d'activité ouverte à ce numéro [motif : entreprise fermée / numéro introuvable]. Si vous créez ou régularisez votre entreprise (une micro-entreprise suffit), écrivez-nous : nous reprendrons votre dossier.",
        ],
        boutons: [],
      },
    ],
  },
  "formateur-lien-espace": {
    code: "F14",
    titre: "Retrouver mon espace (lien demandé par la personne)",
    quand:
      "la personne demande son lien sur la page « Retrouver mon espace ». La page répond toujours la même phrase, quelle que soit l'adresse.",
    famille: "A",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "Votre lien pour retrouver votre espace",
        objetPropose: null,
        paragraphes: [
          "Voici le lien que vous avez demandé. Il vous est personnel.",
          "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.",
        ],
        boutons: ["Reprendre mon dossier", "Ouvrir mon espace"],
      },
    ],
  },
  "formateur-statut-non-ouvert": {
    code: "F15",
    titre: "Statut pas encore ouvert (portage salarial, coopérative, hors de France)",
    quand: "le dossier indique un statut que nous n'ouvrons pas encore (une seule fois).",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "Votre dossier : ce statut n'est pas ouvert",
        objetPropose: "Votre dossier : ce statut n'est pas encore ouvert chez nous",
        paragraphes: [
          "Ce statut n'est pas encore ouvert chez nous. Nous gardons votre dossier et nous revenons vers vous dès que ce sera possible.",
        ],
        boutons: [],
      },
    ],
  },
  "formateur-contrat-a-signer": {
    code: "F16",
    titre:
      "Contrat à signer (cas particuliers seulement : nouvelle version, organisme, mise à niveau)",
    quand:
      "un contrat doit être signé hors du dossier (si la décision 93 est acceptée, ce n'est plus le parcours normal d'un nouveau formateur).",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "Votre contrat de sous-traitance à signer",
        objetPropose: "Votre contrat de sous-traitance est prêt à être signé",
        paragraphes: [
          "Votre contrat de sous-traitance est prêt.",
          "Lisez-le, puis signez-le en ligne : un code vous sera envoyé par e-mail au moment de signer. Il prend effet quand nous l'aurons contresigné ; votre espace s'ouvre alors.",
        ],
        boutons: ["Lire et signer mon contrat"],
      },
    ],
  },
  "formateur-code-signature": {
    code: "F17",
    titre: "Code de signature",
    quand:
      "la personne clique « Recevoir mon code » (valable 15 minutes, 5 essais). Le code est dans l'objet pour se lire depuis la notification.",
    famille: "A",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "[code] : votre code de signature Axion-IA",
        objetPropose: null,
        // La durée est remplie par l'outil depuis le mécanisme (`CODE_VALIDITE_MS`, 15 minutes
        // depuis S6b, décision 35) : le texte n'annonce jamais une durée fausse.
        paragraphes: [
          "Votre code de signature : [code]. Il est valable [durée].",
          "Si vous n'êtes pas en train de signer, ignorez ce message.",
        ],
        boutons: [],
      },
    ],
  },
  "formateur-contrat-relance": {
    code: "F18",
    titre: "Relances du contrat (2 au plus, seulement si F16 est parti)",
    quand: "3 puis 7 jours après F16, tant que le contrat n'est pas signé.",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: "J+3",
        objet: "Votre contrat vous attend",
        objetPropose: null,
        paragraphes: ["Il ne reste qu'à le signer."],
        boutons: ["Lire et signer mon contrat"],
      },
      {
        etape: "J+7",
        objet: "Dernier rappel pour votre contrat",
        objetPropose: null,
        paragraphes: [
          "Votre contrat reste disponible. Si vous avez changé d'avis, vous n'avez rien à faire.",
        ],
        boutons: ["Lire et signer mon contrat"],
      },
    ],
  },
  "formateur-espace-ouvert": {
    code: "F20",
    titre: "Espace ouvert",
    quand:
      "vous cliquez « Contresigner et ouvrir son espace ». Elle reçoit aussi l'exemplaire complet du contrat (F19, inchangé).",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "Votre espace formateur est ouvert",
        objetPropose: null,
        paragraphes: [
          "Votre espace formateur est ouvert.",
          "Quand une mission vous sera proposée, vous recevrez un e-mail ; vous l'acceptez ou la refusez librement. Aucun volume n'est garanti.",
        ],
        boutons: ["Ouvrir mon espace"],
      },
    ],
  },
  "formateur-nda-a-transmettre": {
    code: "F21",
    titre: "Numéro de déclaration d'activité à transmettre",
    quand:
      "le formateur a signé avec un numéro « en cours » ; 30 puis 60 jours après la contresignature (vous recevez une alerte à 90 jours).",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "Votre numéro de déclaration d'activité",
        objetPropose: null,
        paragraphes: [
          "Dès que la préfecture vous a attribué votre numéro de déclaration d'activité, merci de le transmettre depuis votre espace : il est nécessaire pour vous confier une mission.",
        ],
        boutons: ["Transmettre mon numéro"],
      },
    ],
  },
  "formateur-presentation-methode": {
    code: "F22",
    titre: "Présentation de notre méthode (facultative)",
    quand: "vous proposez une date, après aperçu. Une seule proposition.",
    famille: "B",
    interne: false,
    sollicitation: true,
    variantes: [
      {
        etape: null,
        objet: "Notre façon de travailler (facultatif)",
        objetPropose: "Une présentation de notre façon de travailler (facultative)",
        paragraphes: [
          "Nous vous proposons, si vous le souhaitez, une présentation de notre façon de travailler : une demi-journée, le [date], honorée 175 € HT.",
          "Elle est facultative et ne change rien aux missions qui vous seront proposées.",
        ],
        boutons: ["Répondre à cette proposition"],
      },
    ],
  },
  "formateur-contrat-nouvelle-version": {
    code: "F45",
    titre: "Nouvelle version du contrat (et relances à 7 et 21 jours)",
    quand: "vous lancez une nouvelle version du contrat, après aperçu.",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "Une nouvelle version de votre contrat",
        objetPropose: "Une nouvelle version de votre contrat est disponible",
        paragraphes: [
          "Une nouvelle version de votre contrat de sous-traitance est disponible.",
          "Ce qui change : [liste courte].",
          "Vous avez 30 jours pour la lire et la signer. Vos missions en cours ne changent pas. Si vous préférez rester sur la version actuelle, vous le pouvez.",
        ],
        boutons: ["Lire la nouvelle version"],
      },
      {
        etape: "Relance (J+7)",
        objet: "Votre nouvelle version du contrat vous attend",
        objetPropose: null,
        paragraphes: ["Il vous reste [N] jours pour la lire et la signer."],
        boutons: ["Lire la nouvelle version"],
      },
      {
        etape: "Relance (J+21)",
        objet: "Dernier rappel : nouvelle version du contrat",
        objetPropose: "Dernier rappel : nouvelle version de votre contrat",
        paragraphes: [
          "Il vous reste [N] jours. Si vous préférez rester sur la version actuelle, répondez simplement à ce message.",
        ],
        boutons: [],
      },
    ],
  },
  "formateur-proposition-close": {
    code: "F24",
    titre: "Proposition close (sans réponse)",
    quand: "la date limite de réponse est passée sans réponse.",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "La proposition de mission du [date] est close",
        objetPropose: null,
        paragraphes: [
          "La proposition de mission du [date] n'a pas reçu de réponse : elle est close. Rien à faire de votre part ; d'autres missions pourront vous être proposées.",
        ],
        boutons: [],
      },
    ],
  },
  "formateur-accord-enregistre": {
    code: "F25",
    titre: "Accord enregistré, la lettre suit",
    quand:
      "le formateur accepte, mais la lettre ne peut pas partir tout de suite (le client n'a pas encore signé, ou le financeur n'a pas répondu).",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "Merci, votre accord est enregistré",
        objetPropose: null,
        paragraphes: [
          "Merci, votre accord est enregistré pour la mission [intitulé]. Votre lettre de mission vous parviendra dès que le client aura signé sa convention.",
        ],
        boutons: [],
      },
    ],
  },
  "formateur-lettre-a-signer": {
    code: "F26",
    titre: "Lettre de mission à signer",
    quand:
      "la lettre est prête (le client a signé, le formateur a accepté). Une lettre couvre toutes les journées de la mission, de 1 à plusieurs jours. Aucun lien secret : le bouton passe par la connexion si besoin.",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "Votre lettre de mission est prête à signer",
        objetPropose: null,
        paragraphes: [
          "Votre lettre de mission pour [intitulé] est prête : [N] journée(s) et [M] demi-journée(s), du [date de début] au [date de fin], à [lieu].",
          "Elle rappelle votre contrat de sous-traitance, vos honoraires ([total] € HT), le forfait de déplacement [le cas échéant] et la date limite de paiement : au plus tard le [date limite], 30 jours après la dernière journée.",
        ],
        boutons: ["Signer ma lettre"],
      },
    ],
  },
  "formateur-lettre-relance": {
    code: "F27",
    titre: "Relances de la lettre (2 au plus)",
    quand:
      "une première fois entre 2 jours après l'envoi et le milieu du délai, puis 3 jours avant le début. Rien après le début de la mission.",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: "1re",
        objet: "Votre lettre de mission est à signer",
        objetPropose: "Votre lettre de mission attend votre signature",
        paragraphes: ["Votre lettre pour [intitulé] est prête : il ne reste qu'à la signer."],
        boutons: ["Signer ma lettre"],
      },
      {
        etape: "J-3",
        objet: "Votre mission commence dans 3 jours",
        objetPropose: null,
        paragraphes: ["Votre lettre de mission pour [intitulé] attend encore votre signature."],
        boutons: ["Signer ma lettre"],
      },
    ],
  },
  "formateur-lettre-copie-signature": {
    code: "F28",
    titre: "Copie de votre signature de la lettre",
    quand:
      "le formateur vient de signer sa lettre (l'exemplaire complet, signé des deux parties, suit par F19).",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "Votre copie de la lettre de mission signée",
        objetPropose: null,
        paragraphes: [
          "C'est signé. Voici la copie de votre signature de la lettre de mission [numéro] (PDF joint). L'exemplaire signé des deux parties vous parviendra ensuite.",
        ],
        boutons: [],
      },
    ],
  },
  "formateur-lettre-rectifiee": {
    code: "F29",
    titre: "Lettre modifiée (rectificative)",
    quand: "les dates, le lieu ou le forfait changent après la signature.",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "Les conditions de votre mission ont changé",
        objetPropose: null,
        paragraphes: [
          "Les conditions de votre mission [intitulé] ont changé : [ce qui change].",
          "Une lettre rectifiée remplace la précédente. Merci de la signer depuis votre espace.",
        ],
        boutons: ["Signer ma lettre rectifiée"],
      },
    ],
  },
  "formateur-mission-retiree": {
    code: "F30",
    titre: "Mission retirée",
    quand:
      "la mission ne lui est plus confiée (changement de formateur, financement non accordé, retrait). Motif choisi dans une liste fermée.",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "Une mission ne vous est plus confiée",
        objetPropose: "La mission [intitulé] ne vous est plus confiée",
        paragraphes: [
          "La mission [intitulé] du [date] ne vous est plus confiée : [motif : changement d'organisation du client / financement non accordé / autre choix d'Axion].",
          "Cela ne remet pas en cause notre collaboration : d'autres missions pourront vous être proposées.",
          "Conformément à votre lettre de mission, la moitié des honoraires des journées annulées vous sera réglée, hors forfait de déplacement.",
        ],
        boutons: [],
      },
      // Fin de mission (L11e) — lettre émise mais pas encore signée : aucune
      // indemnité n'est annoncée. Variante neuve, à valider par Will.
      {
        etape: "lettre non signée",
        objet: "Une mission ne vous est plus confiée",
        objetPropose: "La mission [intitulé] ne vous est plus confiée",
        paragraphes: [
          "La mission [intitulé] du [date] ne vous est plus confiée : [motif].",
          "La lettre de mission, que vous n'aviez pas encore signée, est annulée.",
          "Cela ne remet pas en cause notre collaboration : d'autres missions pourront vous être proposées.",
        ],
        boutons: [],
      },
    ],
  },
  "formateur-formation-annulee": {
    code: "F31",
    titre: "Formation annulée",
    quand: "la session est annulée.",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "La formation [intitulé] du [date] est annulée",
        objetPropose: null,
        paragraphes: [
          "La formation [intitulé] du [date] est annulée. Votre mission est donc annulée aussi.",
          "Conformément à votre lettre de mission, la moitié des honoraires des journées annulées vous sera réglée, hors forfait de déplacement.",
        ],
        boutons: [],
      },
      // Fin de mission (L11e) — lettre émise mais pas encore signée : aucune
      // indemnité n'est annoncée. Variante neuve, à valider par Will.
      {
        etape: "lettre non signée",
        objet: "La formation [intitulé] du [date] est annulée",
        objetPropose: null,
        paragraphes: [
          "La formation [intitulé] du [date] est annulée. Votre mission est donc annulée aussi.",
          "La lettre de mission, que vous n'aviez pas encore signée, est annulée.",
        ],
        boutons: [],
      },
    ],
  },
  "formateur-mission-en-attente": {
    code: "F32",
    titre: "Mission en attente d'un élément",
    quand:
      "une lettre ne peut pas partir à cause d'une pièce manquante (une seule fois, sauf si le motif change).",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "Votre mission : il nous manque un élément",
        objetPropose: "Pour vous confier la mission [intitulé], il nous manque un élément",
        paragraphes: [
          "Pour vous confier cette mission, il nous manque : [motif].",
          "Vous pouvez y remédier depuis votre espace : la lettre partira aussitôt.",
        ],
        boutons: ["Ouvrir mon espace"],
      },
    ],
  },
  "formateur-feuilles-manquantes": {
    code: "F35",
    titre: "Feuilles de présence manquantes",
    quand:
      "3 jours après la dernière journée, s'il manque des signatures (c'est la 4e étape des rappels de contresignature existants).",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "Il manque des signatures sur vos feuilles",
        objetPropose: "Il manque des signatures pour établir votre facture",
        paragraphes: [
          "Pour établir votre facture, il manque votre signature sur les feuilles de présence du [jour] ([N] demi-journée(s)).",
          "Vous pouvez les signer depuis votre espace, ou déposer la feuille papier signée.",
        ],
        boutons: ["Signer mes feuilles"],
      },
    ],
  },
  "formateur-desistement-recu": {
    code: "F48",
    titre: "Désistement reçu",
    quand: "le formateur clique « Je ne peux plus assurer cette mission » dans son espace.",
    famille: "B",
    interne: false,
    sollicitation: false,
    // Deux variantes (lot L11h) : le second paragraphe du texte soumis ne vaut
    // que « si un remplaçant a été proposé ». Étape 1 = sans, étape 2 = avec.
    variantes: [
      {
        etape: null,
        objet: "Votre désistement est enregistré",
        objetPropose: null,
        paragraphes: [
          "C'est noté pour la mission [intitulé] du [date] : nous sommes prévenus. Aucune pénalité n'est due. Rien d'autre à faire de votre part.",
        ],
        boutons: [],
      },
      {
        etape: "avec remplaçant",
        objet: "Votre désistement est enregistré",
        objetPropose: null,
        paragraphes: [
          "C'est noté pour la mission [intitulé] du [date] : nous sommes prévenus. Aucune pénalité n'est due. Rien d'autre à faire de votre part.",
          "Nous examinons la personne que vous nous avez indiquée et nous vous répondons.",
        ],
        boutons: [],
      },
    ],
  },
  "formateur-releve-connexion": {
    code: "F60",
    titre: "Relevé de connexion à signer (formation à distance)",
    quand:
      "une formation en visio est terminée et son relevé de connexion est prêt ; relance 3 jours après.",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "Votre relevé de connexion est à signer",
        objetPropose: "Le relevé de connexion de votre formation à distance est à signer",
        paragraphes: [
          "Le relevé de connexion de la formation [intitulé] est prêt. Relisez-le et signez-le depuis votre espace : cela prend une minute.",
          "Il garde la trace des connexions ; il ne remplace pas vos feuilles de présence.",
        ],
        boutons: ["Signer le relevé"],
      },
      {
        etape: "Relance (J+3)",
        objet: "Le relevé de connexion attend votre signature",
        objetPropose: null,
        paragraphes: ["Le relevé de la formation [intitulé] attend votre signature."],
        boutons: ["Signer le relevé"],
      },
    ],
  },
  "formateur-virement-fait": {
    code: "F37",
    titre: "Virement effectué",
    quand: "vous cliquez « Virements faits ».",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "Virement effectué : facture n° [numéro]",
        objetPropose: null,
        paragraphes: [
          "Le virement de [montant] € pour la facture n° [numéro] a été effectué le [date]. Le délai d'arrivée sur votre compte dépend de votre banque.",
        ],
        boutons: [],
      },
    ],
  },
  "formateur-virement-en-attente": {
    code: "F38",
    titre: "Virement en attente de l'attestation URSSAF",
    quand: "une facture est due mais l'attestation URSSAF est échue (une fois par facture).",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "Virement en attente : attestation URSSAF",
        objetPropose: "Facture n° [numéro] : le virement attend votre attestation URSSAF",
        paragraphes: [
          "Votre facture n° [numéro] est due. Pour que nous puissions effectuer le virement, nous avons besoin de votre attestation URSSAF à jour. Déposez-la depuis votre espace, elle se télécharge sur urssaf.fr : le virement partira ensuite.",
        ],
        boutons: ["Déposer mon attestation"],
      },
    ],
  },
  "formateur-facture-rectifiee": {
    code: "F39",
    titre: "Facture rectifiée",
    quand: "vous acceptez un désaccord (avoir, puis nouvelle facture).",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "Facture n° [numéro] corrigée",
        objetPropose: null,
        paragraphes: [
          "Suite à votre remarque, la facture n° [numéro] est annulée par l'avoir n° [numéro]. La facture rectifiée n° [numéro] est jointe.",
        ],
        boutons: [],
      },
    ],
  },
  "formateur-trop-percu": {
    code: "F54",
    titre: "Montant versé en trop",
    quand:
      "une correction a fait apparaître un trop-versé et le formateur n'a pas de relevé suivant dans les 60 jours (une fois par avoir).",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "Une régularisation sur vos honoraires",
        objetPropose: null,
        paragraphes: [
          "Une correction de la facture n° [numéro] (avoir n° [numéro]) a fait apparaître que nous vous avons versé [montant] € de trop. Il n'a pas pu être déduit d'une prochaine facture.",
          "Pourriez-vous nous le rembourser par virement sur le compte indiqué ci-dessous ? Si vous préférez en parler, répondez simplement à ce message.",
          "[coordonnées bancaires d'Axion]",
          "Nous ne retenons jamais rien sur une autre mission sans votre accord écrit.",
        ],
        boutons: [],
      },
    ],
  },
  "formateur-facture-deposee": {
    code: "F56",
    titre: "Facture déposée bien reçue",
    quand:
      "un formateur sans autofacturation (ou qui l'a révoquée) dépose sa propre facture dans son espace.",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "Votre facture n° [numéro] est bien reçue",
        objetPropose: null,
        paragraphes: [
          "Votre facture n° [numéro] est bien reçue. Nous contrôlons ses mentions. La date limite de paiement ne change pas : [date].",
        ],
        boutons: [],
      },
    ],
  },
  "formateur-desaccord-recu": {
    code: "F58",
    titre: "Désaccord bien reçu",
    quand: "le formateur clique « Signaler un désaccord » sur une facture.",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "Votre désaccord est bien reçu",
        objetPropose: null,
        paragraphes: [
          "Votre message du [date] sur la facture n° [numéro] est bien reçu. Nous l'examinons et nous vous répondons par écrit.",
        ],
        boutons: [],
      },
    ],
  },
  "formateur-desaccord-non-retenu": {
    code: "F59",
    titre: "Désaccord non retenu (vous décidez)",
    quand:
      "vous clôturez un désaccord sans suite, après aperçu. Le motif est celui que vous écrivez.",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "Réponse à votre désaccord",
        objetPropose: "Réponse à votre désaccord sur la facture n° [numéro]",
        paragraphes: [
          "Nous avons examiné votre message du [date]. Nous ne modifions pas la facture n° [numéro], pour la raison suivante : [motif écrit par vous].",
          "Si vous pensez toujours qu'elle est inexacte, répondez à ce message : nous la regarderons avec vous.",
        ],
        boutons: [],
      },
    ],
  },
  "formateur-vigilance": {
    code: "F40",
    titre: "Attestation URSSAF (3 variantes)",
    quand:
      "à la signature du contrat ; avant l'échéance (15 jours avant, puis tous les 15 jours, 3 fois au plus) ; tout de suite si elle expire dans les 7 jours avant une formation.",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: "à la signature",
        objet: "Votre attestation de vigilance URSSAF",
        objetPropose: null,
        paragraphes: [
          "Pour vous confier des missions, nous avons besoin de votre attestation de vigilance URSSAF, datée de moins de 6 mois. Elle se télécharge en quelques minutes sur urssaf.fr. Déposez-la depuis votre espace.",
        ],
        boutons: ["Déposer mon attestation"],
      },
      {
        etape: "avant l'échéance",
        objet: "Votre attestation URSSAF arrive à échéance",
        objetPropose: "Votre attestation URSSAF arrive à échéance le [date]",
        paragraphes: [
          "Déposez la nouvelle depuis votre espace (elle se télécharge sur urssaf.fr). Elle est nécessaire pour vous confier de nouvelles missions.",
        ],
        boutons: ["Déposer mon attestation"],
      },
      {
        etape: "avant une formation",
        objet: "Votre attestation URSSAF est à renouveler",
        objetPropose: "Votre attestation URSSAF doit être renouvelée avant le [date]",
        paragraphes: [
          "Votre attestation expire avant la formation du [date]. Déposez la nouvelle depuis votre espace : sans elle, nous ne pouvons pas maintenir la mission.",
        ],
        boutons: ["Déposer mon attestation"],
      },
    ],
  },
  "formateur-piece-a-renouveler": {
    code: "F41",
    titre: "Autres pièces à renouveler (3 variantes)",
    quand:
      "30 jours puis 15 jours avant l'échéance d'une pièce (CV de plus de 24 mois, assurance RC pro, numéro de déclaration d'activité) ; ou quand vous refusez une pièce, avec un motif de la liste.",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "Une pièce de votre dossier est à renouveler",
        objetPropose: "Votre [CV / assurance RC pro / numéro de déclaration] est à renouveler",
        paragraphes: [
          "Pour tenir votre dossier à jour, merci de déposer [la pièce] avant le [date], depuis votre espace.",
        ],
        boutons: ["Déposer ma pièce"],
      },
      {
        etape: "Relance (15 jours avant)",
        objet: "Rappel : une pièce à renouveler",
        objetPropose: "Rappel : [pièce] à renouveler avant le [date]",
        paragraphes: ["Il reste [N] jours."],
        boutons: ["Déposer ma pièce"],
      },
      {
        etape: "Pièce refusée",
        objet: "Une pièce est à renvoyer",
        objetPropose: "Votre [pièce] est à renvoyer",
        paragraphes: [
          "Nous n'avons pas pu retenir la pièce déposée : [motif : illisible / périmée / ne correspond pas à votre nom / incomplète]. Merci d'en déposer une nouvelle.",
        ],
        boutons: ["Déposer ma pièce"],
      },
    ],
  },
  "formateur-piece-deposee": {
    code: "F42",
    titre: "Pièce déposée (message interne, pour vous seul)",
    quand: "un formateur dépose une pièce.",
    famille: "B",
    interne: true,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "Pièce déposée par un formateur",
        objetPropose: null,
        paragraphes: ["Pièce déposée · [identifiant court] · [type de pièce] · [lien console]"],
        boutons: [],
      },
    ],
  },
  "formateur-iban-changement": {
    code: "F43",
    titre: "Demande de changement de compte bancaire",
    quand:
      "le formateur demande à changer d'IBAN. Part à l'ancienne **et** à la nouvelle adresse e-mail s'il a aussi changé d'adresse. Ne contient jamais l'IBAN, même en partie.",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "Changement de vos coordonnées bancaires",
        objetPropose: "Demande de modification de vos coordonnées bancaires",
        paragraphes: [
          "Une demande de modification de vos coordonnées bancaires a été reçue le [date].",
          "Elle sera prise en compte après vérification, au plus tôt dans 48 heures. Vos virements continuent sur l'ancien compte en attendant.",
          "Si vous n'êtes pas à l'origine de cette demande, répondez immédiatement à ce message.",
        ],
        boutons: [],
      },
    ],
  },
  "formateur-iban-valide": {
    code: "F44",
    titre: "Changement validé",
    quand: "vous validez un changement (adresse, régime de TVA, compte bancaire).",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "La modification de [nature] est enregistrée",
        objetPropose: null,
        paragraphes: [
          "La modification de [nature : votre adresse / votre régime de TVA / votre compte bancaire] est enregistrée à compter du [date].",
        ],
        boutons: [],
      },
    ],
  },
  "formateur-fin-autofacturation": {
    code: "F46",
    titre: "Fin de l'autofacturation (le formateur révoque le mandat)",
    quand:
      "le formateur révoque le mandat qui nous permet d'établir ses factures. Préavis d'un mois, comme dans le contrat.",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "Votre demande est enregistrée",
        objetPropose: null,
        paragraphes: [
          "Votre demande est enregistrée : à compter du [date, un mois après], vous nous adresserez vos propres factures, que vous déposerez dans votre espace. Les factures déjà établies à votre nom restent valables. La date limite de paiement ne change pas.",
        ],
        boutons: [],
      },
    ],
  },
  "formateur-fin-collaboration": {
    code: "F47",
    titre: "Fin de collaboration (aucun envoi en cas de décès)",
    quand:
      "vous mettez fin à la collaboration, après aperçu. Motif choisi dans une liste fermée. Cet e-mail passe même après la fin, comme les e-mails d'argent. Pas de bouton « Ouvrir mon espace ».",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "Fin de notre collaboration",
        objetPropose: null,
        paragraphes: [
          "Nous mettons fin à notre collaboration à compter du [date], [motif : à votre demande / à notre demande, avec un préavis de [30/60/90] jours / entreprise ou numéro de déclaration devenus caducs / manquement grave].",
          "Les missions déjà acceptées sont menées à terme et payées selon votre contrat.\nLes journées déjà réalisées vous sont payées selon votre contrat ; les missions qui n'ont pas commencé sont retirées.",
          "Vos relevés et vos factures vous parviendront par e-mail. Vous pouvez retrouver votre espace avec votre adresse habituelle pour les consulter.",
        ],
        boutons: [],
      },
    ],
  },
  "formateur-avertissement": {
    code: "F49",
    titre: "Avertissement avant une fin pour manquement grave",
    quand:
      "au moins 8 jours avant toute fin pour manquement, sauf manquement qui ne peut pas être réparé (article 30.4 de votre contrat). Après aperçu et sur décision de vous seul.",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "Un point important sur notre collaboration",
        objetPropose: "Un point important sur votre collaboration avec Axion-IA",
        paragraphes: [
          "Nous avons constaté ce qui suit : [fait précis, écrit par Will].",
          "Nous vous demandons de nous répondre ou de régulariser la situation d'ici 8 jours, soit avant le [date]. Passé ce délai, sans réponse ou sans régularisation, nous pourrons mettre fin à notre collaboration sans préavis, comme le prévoit l'article 30.4 de votre contrat.",
          "Pour en parler, répondez simplement à ce message.",
        ],
        boutons: [],
      },
    ],
  },
  "formateur-dossier-a-jour": {
    code: "F57",
    titre: "Dossier à jour",
    quand:
      "un blocage est levé (attestation ou pièce de nouveau valable). Une seule fois par épisode.",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "Votre dossier est à jour",
        objetPropose: null,
        paragraphes: [
          "Votre dossier est à jour : de nouvelles missions peuvent de nouveau vous être proposées. Rien d'autre à faire.",
        ],
        boutons: [],
      },
    ],
  },
} as const satisfies Record<string, TexteFormateur>;

export type GabaritFormateurIndependant = keyof typeof TEXTES_FORMATEUR;

export const GABARITS_FORMATEUR_INDEPENDANT = Object.keys(
  TEXTES_FORMATEUR,
) as ReadonlyArray<GabaritFormateurIndependant>;

export function estGabaritFormateurIndependant(x: string): x is GabaritFormateurIndependant {
  return Object.prototype.hasOwnProperty.call(TEXTES_FORMATEUR, x);
}

/**
 * Les e-mails d'ARGENT : seuls ceux-ci partent encore après une fin de collaboration, et
 * l'opposition ne les arrête pas (classe C). Même nom de constante que chez les apporteurs.
 */
export const GABARITS_ARGENT_FORMATEUR: ReadonlySet<GabaritFormateurIndependant> =
  new Set<GabaritFormateurIndependant>([
    "formateur-virement-fait",
    "formateur-virement-en-attente",
    "formateur-facture-rectifiee",
    "formateur-trop-percu",
    "formateur-facture-deposee",
    "formateur-desaccord-recu",
    "formateur-desaccord-non-retenu",
    "formateur-fin-collaboration",
  ]);

/** Les SOLLICITATIONS (classe A) : soumises à l'opposition, comme celles des apporteurs. */
export const GABARITS_SOLLICITATION_FORMATEUR: ReadonlySet<GabaritFormateurIndependant> =
  new Set<GabaritFormateurIndependant>(
    (Object.keys(TEXTES_FORMATEUR) as GabaritFormateurIndependant[]).filter(
      (g) => TEXTES_FORMATEUR[g].sollicitation,
    ),
  );

/** Un [crochet] encore présent : une valeur que l'outil n'a pas remplie. */
export const CROCHET_NON_REMPLI = /\[[^[\]]+\]/;
