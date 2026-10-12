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
        objet: "Et si on en parlait 20 minutes ?",
        objetPropose: null,
        paragraphes: [
          "Merci pour votre candidature à nos missions de formateur IA indépendant.",
          "Nous vous proposons un échange de 20 minutes en visio : faire connaissance, vous expliquer simplement comment fonctionnent nos missions et répondre à vos questions. Sans engagement : à l'issue, chacun décide librement de la suite.",
          "Choisissez vous-même le moment qui vous arrange, en un clic, avec le bouton ci-dessous.",
        ],
        boutons: ["Réserver mon créneau"],
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
        paragraphes: [
          "Il ne vous reste plus qu'à choisir le moment de notre échange de 20 minutes en visio.",
          "Réservez le vôtre en un clic avec le bouton ci-dessous.",
        ],
        boutons: ["Réserver mon créneau"],
      },
      {
        etape: "J+7",
        objet: "Dernier rappel : notre échange en visio",
        objetPropose: "Notre dernier message au sujet de notre échange",
        paragraphes: [
          "C'est notre dernier message à ce sujet.",
          "L'échange de 20 minutes en visio reste ouvert si vous souhaitez découvrir nos missions.",
          "Si ce n'est pas le bon moment, aucun souci : sans réservation de votre part, nous ne vous relancerons plus.",
        ],
        boutons: ["Réserver mon créneau"],
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
          "Merci pour votre candidature à nos missions de formateur IA indépendant.",
          "Notre réponse arrive plus tard que prévu : pardon pour ce délai.",
          "Nous vous proposons un échange en visio : faire connaissance, vous expliquer simplement comment fonctionnent nos missions et répondre à vos questions. Sans engagement.",
          "Et si vous avez trouvé une autre voie entre-temps, vous n'avez rien à faire : nous ne vous relancerons pas.",
        ],
        boutons: ["Réserver mon créneau"],
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
        objet: "C'est confirmé : [jour] à [heure]",
        objetPropose: "C'est confirmé : notre échange du [jour] à [heure]",
        paragraphes: [
          "Votre échange est confirmé.",
          "Au programme : faire connaissance, vous expliquer simplement nos missions, et répondre à toutes vos questions.",
          "L'invitation d'agenda vous parvient séparément, par Calendly. Nous vous écrivons la veille, puis une heure avant.",
          "Rien à préparer de votre côté.",
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
        objet: "Votre échange a lieu demain à [HH:MM]",
        objetPropose: null,
        paragraphes: [
          "Petit rappel, nous nous parlons demain à [HH:MM] (heure de Paris).",
          "Le lien de connexion est dans l'invitation d'agenda. Rien à préparer de votre côté.",
        ],
        boutons: [],
      },
      {
        etape: "1 heure avant",
        objet: "Votre échange a lieu dans une heure",
        objetPropose: null,
        paragraphes: [
          "Petit rappel, nous nous parlons à [HH:MM] (heure de Paris).",
          "Rien à préparer de votre côté.",
        ],
        boutons: ["Rejoindre la visioconférence"],
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
        objet: "Merci pour notre échange : la suite",
        objetPropose: "Votre candidature de formateur indépendant : la suite",
        paragraphes: [
          "Merci pour notre échange. Nous serions heureux de vous confier des missions de formation.",
          "Comment ça marche :\n• chaque mission vous est proposée avec ses dates et ses honoraires, avant que vous répondiez ;\n• vous l'acceptez ou la refusez librement, sans aucune conséquence ;\n• aucun volume n'est garanti ;\n• vous restez libre de vos méthodes d'animation, dans le programme convenu, et de travailler pour d'autres clients.",
          "Vos honoraires : 350 € HT la journée, 175 € HT la demi-journée.",
          "Première étape : complétez votre dossier avec le bouton ci-dessous. Comptez environ 10 minutes ; vous pouvez vous arrêter et reprendre plus tard.",
          "Vous y signerez aussi votre contrat de sous-traitance. Nous le contresignons ensuite, après vérification : il ne prend effet qu'à ce moment-là.",
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
        objet: "Suite à notre échange",
        objetPropose: null,
        paragraphes: [
          "Merci pour le temps que vous nous avez accordé lors de notre échange.",
          "Nous ne donnons pas suite pour le moment. Nos besoins ne correspondent pas à votre profil.",
          "Votre candidature reste chez nous : si nos besoins évoluent, nous pourrons revenir vers vous.",
          "Vous préférez que nous effacions vos données ? Répondez simplement à ce message : Williams Jullin, responsable d'Axion-IA, traite votre demande. Votre fiche est alors rendue anonyme, et seul ce que la loi impose de conserver est gardé.",
          "Nous vous souhaitons le meilleur pour la suite de vos projets.",
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
        objet: "Nous vous avons attendu : un autre créneau ?",
        objetPropose: null,
        paragraphes: [
          "Nous vous avons attendu pour notre échange en visio. Aucun souci : un imprévu arrive à tout le monde.",
          "Si nos missions vous intéressent toujours, choisissez simplement un nouveau créneau avec le bouton ci-dessous.",
          "Et si ce n'est plus d'actualité pour vous, vous n'avez rien à faire : nous ne vous relancerons pas.",
        ],
        boutons: ["Choisir un nouveau créneau"],
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
        objet: "Votre dossier de formateur, en ligne",
        objetPropose: "Le lien de votre dossier de formateur indépendant",
        paragraphes: [
          "Voici votre lien personnel pour compléter votre dossier.",
          "Vous y trouverez :\n• vos coordonnées ;\n• votre activité ;\n• les pièces à fournir ;\n• votre contrat.",
          "Comptez environ 10 minutes ; vous pouvez vous arrêter et reprendre plus tard.",
          "Ce lien vous est personnel.",
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
        paragraphes: [
          "Petit rappel, votre dossier n'est pas encore complété.",
          "Il reste à le compléter pour que nous puissions vous confier des missions. Vous pouvez reprendre votre dossier là où vous l'avez laissé.",
        ],
        boutons: ["Compléter mon dossier"],
      },
      {
        etape: "J+7",
        objet: "Dernier rappel : votre dossier reste ouvert",
        objetPropose: null,
        paragraphes: [
          "C'est notre dernier rappel au sujet de votre dossier.",
          "Il reste ouvert, et vous pouvez le reprendre là où vous l'avez laissé.",
          "Si vous ne souhaitez pas donner suite, vous n'avez rien à faire.",
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
        objet: "Bien reçu : votre dossier et votre contrat",
        objetPropose: null,
        paragraphes: [
          "Votre dossier et votre contrat signé nous sont bien parvenus, merci.",
          "La copie du contrat que vous avez signé est en pièce jointe.",
          "Nous relisons maintenant votre dossier, en le rapprochant du registre public des entreprises.",
          "Vous recevrez ensuite par e-mail votre contrat contresigné et l'accès à votre espace.",
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
        objet: "Votre dossier : un complément",
        objetPropose: null,
        paragraphes: [
          "Merci pour votre dossier. Pour continuer, il nous manque : [motif].",
          "Déposez-le avec le bouton ci-dessous : il suffit de reprendre votre dossier.",
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
          "Merci pour le temps consacré à votre dossier.",
          "Le registre public n'indique pas d'activité ouverte à ce numéro : [motif].",
          "Une micro-entreprise suffit. Dès que votre entreprise est créée ou régularisée, écrivez-nous : nous reprendrons votre dossier.",
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
          "Voici le lien que vous avez demandé.",
          "Ce lien vous est personnel : ne transférez pas cet e-mail. Si vous n'êtes pas à l'origine de cette demande, ignorez-le simplement.",
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
        objet: "Votre dossier : un statut pas encore ouvert",
        objetPropose: "Votre dossier : ce statut n'est pas encore ouvert chez nous",
        paragraphes: [
          "Merci pour votre dossier.",
          "Le statut que vous avez indiqué n'est pas encore ouvert chez nous.",
          "Votre dossier reste chez nous : nous revenons vers vous dès que ce sera possible.",
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
        objet: "Votre contrat de sous-traitance, en ligne",
        objetPropose: "Votre contrat de sous-traitance est prêt à être signé",
        paragraphes: [
          "Votre contrat de sous-traitance est prêt.",
          "Lisez-le, puis signez-le en ligne avec le bouton ci-dessous. Au moment de signer, un code vous est envoyé par e-mail.",
          "Il prend effet une fois signé à son tour par Axion-IA : votre espace s'ouvre alors.",
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
          "Vous n'êtes pas en train de signer ? Ignorez simplement ce message.",
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
        paragraphes: ["Il ne reste qu'à signer votre contrat de sous-traitance."],
        boutons: ["Lire et signer mon contrat"],
      },
      {
        etape: "J+7",
        objet: "Dernier rappel : votre contrat",
        objetPropose: null,
        paragraphes: [
          "C'est notre dernier rappel. Votre contrat reste disponible.",
          "Si vous avez changé d'avis, vous n'avez rien à faire.",
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
          "Votre contrat est contresigné, et votre espace formateur est ouvert.",
          "Quand une mission vous est proposée, vous recevez un e-mail. Vous l'acceptez ou la refusez librement.",
          "Aucun volume n'est garanti.",
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
          "Dès que la préfecture vous a attribué votre numéro de déclaration d'activité, transmettez-le depuis votre espace.",
          "Il est nécessaire pour vous confier une mission.",
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
          "Si vous le souhaitez, nous vous proposons une présentation de notre façon de travailler.",
          "Une demi-journée, le [date], honorée 175 € HT.",
          "Elle est facultative : elle ne change rien aux missions qui vous seront proposées.",
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
          "Vous avez 30 jours pour la lire et la signer. Vos missions en cours ne changent pas.",
          "Vous préférez rester sur la version actuelle ? C'est possible.",
        ],
        boutons: ["Lire la nouvelle version"],
      },
      {
        etape: "Relance (J+7)",
        objet: "Votre nouvelle version du contrat vous attend",
        objetPropose: null,
        paragraphes: [
          "Il vous reste [N] jours pour lire et signer la nouvelle version de votre contrat.",
        ],
        boutons: ["Lire la nouvelle version"],
      },
      {
        etape: "Relance (J+21)",
        objet: "Dernier rappel : nouvelle version du contrat",
        objetPropose: "Dernier rappel : nouvelle version de votre contrat",
        paragraphes: [
          "Il vous reste [N] jours pour signer la nouvelle version de votre contrat.",
          "Vous préférez rester sur la version actuelle ? Répondez simplement à ce message.",
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
          "Sans réponse de votre part, la proposition de mission du [date] est close.",
          "Vous n'avez rien à faire : d'autres missions pourront vous être proposées.",
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
          "Votre accord pour la mission [intitulé] est bien noté.",
          "Votre lettre de mission vous parviendra dès que le client aura signé sa convention.",
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
          "Votre lettre de mission pour [intitulé] est prête.",
          "Elle couvre [N] journée(s) et [M] demi-journée(s), du [date de début] au [date de fin], à [lieu].",
          "Elle rappelle votre contrat de sous-traitance, vos honoraires ([total] € HT) et le forfait de déplacement [le cas échéant].",
          "Elle rappelle aussi la date limite de paiement de vos honoraires : le [date limite] au plus tard, 30 jours après la dernière journée.",
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
        paragraphes: ["Il ne reste qu'à signer votre lettre de mission pour [intitulé]."],
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
          "C'est signé, merci.",
          "Voici la copie de votre signature de la lettre de mission [numéro], en PDF, en pièce jointe.",
          "L'exemplaire signé des deux parties vous parviendra ensuite.",
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
          "Une lettre rectifiée remplace la précédente. Signez-la depuis votre espace, avec le bouton ci-dessous.",
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
          "La mission [intitulé] du [date] ne vous est plus confiée.",
          "La raison : [motif : changement d'organisation du client / financement non accordé / autre choix d'Axion].",
          "Comme le prévoit votre lettre de mission, la moitié des honoraires des journées annulées vous sera réglée, hors forfait de déplacement.",
          "Cela ne remet pas en cause notre collaboration : d'autres missions pourront vous être proposées.",
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
          "La mission [intitulé] du [date] ne vous est plus confiée.",
          "La raison : [motif].",
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
          "La formation [intitulé] du [date] est annulée, et votre mission avec elle.",
          "Comme le prévoit votre lettre de mission, la moitié des honoraires des journées annulées vous sera réglée, hors forfait de déplacement.",
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
          "La formation [intitulé] du [date] est annulée, et votre mission avec elle.",
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
          "Déposez-le depuis votre espace : la lettre de mission partira aussitôt.",
        ],
        boutons: ["Déposer depuis mon espace"],
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
          "Il manque votre signature sur les feuilles de présence du [jour] ([N] demi-journée(s)).",
          "Elle est nécessaire pour établir votre facture.",
          "Signez-les depuis votre espace, ou déposez la feuille papier signée.",
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
          "C'est noté pour la mission [intitulé] du [date].",
          "Aucune pénalité n'est due, et vous n'avez rien d'autre à faire.",
        ],
        boutons: [],
      },
      {
        etape: "avec remplaçant",
        objet: "Votre désistement est enregistré",
        objetPropose: null,
        paragraphes: [
          "C'est noté pour la mission [intitulé] du [date].",
          "Aucune pénalité n'est due, et vous n'avez rien d'autre à faire.",
          "Merci aussi pour la personne que vous nous avez indiquée : nous étudions cette piste et nous vous répondons.",
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
          "Le relevé de connexion de la formation [intitulé] est prêt.",
          "Relisez-le et signez-le depuis votre espace : une minute suffit.",
          "Il garde la trace des connexions ; il ne remplace pas vos feuilles de présence.",
        ],
        boutons: ["Signer le relevé"],
      },
      {
        etape: "Relance (J+3)",
        objet: "Le relevé de connexion attend votre signature",
        objetPropose: null,
        paragraphes: [
          "Le relevé de connexion de la formation [intitulé] attend encore votre signature.",
        ],
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
          "Le virement de [montant] € pour la facture n° [numéro] est parti le [date].",
          "Le délai d'arrivée sur votre compte dépend de votre banque.",
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
          "Votre facture n° [numéro] est due, et son virement attend votre attestation URSSAF à jour.",
          "Déposez-la depuis votre espace : le virement partira ensuite.",
          "Elle se télécharge sur urssaf.fr.",
        ],
        boutons: ["Déposer mon attestation"],
      },
    ],
  },
  "formateur-facture-rectifiee": {
    code: "F39",
    titre: "Facture rectifiée",
    quand:
      "la nouvelle facture d'un désaccord accepté est émise (avoir, relevé recalculé validé, puis nouvelle facture). Une fois par avoir.",
    famille: "B",
    interne: false,
    sollicitation: false,
    variantes: [
      {
        etape: null,
        objet: "Facture n° [numéro] corrigée",
        objetPropose: null,
        // Trois numéros DISTINCTS (lot D2) : [numéro] est la facture d'origine.
        paragraphes: [
          "Suite à votre remarque, nous avons corrigé la facture n° [numéro].",
          "Elle est annulée par l'avoir n° [numéro de l'avoir].",
          "La nouvelle facture porte le n° [numéro de la nouvelle facture]. L'avoir et la nouvelle facture sont joints à ce message.",
          "Le virement reste prévu au plus tard le [date].",
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
          "Une correction de la facture n° [numéro] (avoir n° [numéro]) montre que nous vous avons versé [montant] € de trop.",
          "Ce montant n'a pas pu être déduit d'une prochaine facture.",
          "Pourriez-vous nous le rembourser par virement, sur le compte ci-dessous ? Pour en parler, répondez simplement à ce message.",
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
          "Votre facture n° [numéro] est bien reçue, merci.",
          "Nous relisons ses mentions. La date limite de paiement ne change pas : [date].",
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
          "Votre message du [date] sur la facture n° [numéro] est bien reçu.",
          "Nous l'examinons, et nous vous répondons par écrit.",
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
          "Nous avons examiné votre message du [date].",
          "La facture n° [numéro] ne change pas, pour la raison suivante : [motif écrit par vous].",
          "Vous pensez toujours qu'elle est inexacte ? Répondez à ce message : nous la regarderons avec vous.",
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
          "Pour vous confier des missions, nous avons besoin de votre attestation de vigilance URSSAF, datée de moins de 6 mois.",
          "Elle se télécharge en quelques minutes sur urssaf.fr. Déposez-la ensuite depuis votre espace.",
        ],
        boutons: ["Déposer mon attestation"],
      },
      {
        etape: "avant l'échéance",
        objet: "Votre attestation URSSAF arrive à échéance",
        objetPropose: "Votre attestation URSSAF arrive à échéance le [date]",
        paragraphes: [
          "Pensez à déposer la nouvelle depuis votre espace.",
          "Elle se télécharge sur urssaf.fr, et elle est nécessaire pour vous confier de nouvelles missions.",
        ],
        boutons: ["Déposer mon attestation"],
      },
      {
        etape: "avant une formation",
        objet: "Votre attestation URSSAF est à renouveler",
        objetPropose: "Votre attestation URSSAF doit être renouvelée avant le [date]",
        paragraphes: [
          "Votre attestation URSSAF expire avant la formation du [date].",
          "Déposez la nouvelle depuis votre espace : sans elle, nous ne pouvons pas maintenir la mission.",
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
          "Pour garder votre dossier à jour, déposez [la pièce] depuis votre espace avant le [date].",
        ],
        boutons: ["Déposer ma pièce"],
      },
      {
        etape: "Relance (15 jours avant)",
        objet: "Rappel : une pièce à renouveler",
        objetPropose: "Rappel : [pièce] à renouveler avant le [date]",
        paragraphes: ["Il reste [N] jours pour déposer votre nouvelle pièce depuis votre espace."],
        boutons: ["Déposer ma pièce"],
      },
      {
        etape: "Pièce refusée",
        objet: "Une pièce est à renvoyer",
        objetPropose: "Votre [pièce] est à renvoyer",
        paragraphes: [
          "La pièce déposée n'a pas pu être retenue : [motif : illisible / périmée / ne correspond pas à votre nom / incomplète].",
          "Déposez-en une nouvelle depuis votre espace.",
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
          "Nous avons reçu le [date] une demande de modification de vos coordonnées bancaires.",
          "Elle sera prise en compte après vérification, au plus tôt dans 48 heures. En attendant, vos virements continuent sur l'ancien compte.",
          "Vous n'êtes pas à l'origine de cette demande ? Répondez immédiatement à ce message.",
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
          "Votre demande est enregistrée, merci.",
          "À compter du [date, un mois après], vous nous adresserez vos propres factures, à déposer dans votre espace.",
          "Les factures déjà établies à votre nom restent valables, et la date limite de paiement ne change pas.",
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
          "Notre collaboration prend fin à compter du [date], [motif : à votre demande / à notre demande, avec un préavis de [30/60/90] jours / entreprise ou numéro de déclaration devenus caducs / manquement grave].",
          "Les missions déjà acceptées sont menées à terme et payées selon votre contrat.\nLes journées déjà réalisées vous sont payées selon votre contrat ; les missions qui n'ont pas commencé sont retirées.",
          "Vos relevés et vos factures vous parviendront par e-mail.",
          "Pour les consulter, vous pouvez aussi retrouver votre espace avec votre adresse habituelle.",
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
          "Merci de nous répondre ou de régulariser la situation d'ici 8 jours, soit avant le [date].",
          "Passé ce délai, sans réponse ou sans régularisation, nous pourrons mettre fin à notre collaboration sans préavis, comme le prévoit l'article 30.4 de votre contrat.",
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
          "Votre dossier est de nouveau à jour, merci.",
          "De nouvelles missions peuvent vous être proposées. Rien d'autre à faire de votre part.",
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
/**
 * F23 — proposition de mission CHIFFRÉE (variante « honoraires », lot L11b-ux ; ton
 * aligné en M24, lot A). Validée À PART : `textes_valides.formateur-mission-proposee#honoraires`.
 * Mise en page sur le gabarit commun des formateurs par `formateur-mission-proposee.tsx`
 * (le gabarit est partagé avec les salariés : son texte de base ne change pas).
 * L'objet est complété par l'intitulé. Crochets remplis depuis le payload : [intitulé],
 * [dates], [lieu], [honoraires], [déplacement], [date limite].
 */
export const TEXTE_F23_HONORAIRES = {
  envoi: {
    objet: "Proposition de mission :",
    paragraphes: [
      "Nous avons une mission de formation à vous proposer. Voici le détail :",
      "• Formation : [intitulé]\n• Dates : [dates]\n• Lieu : [lieu]\n• Honoraires : [honoraires]\n• Déplacement : [déplacement]",
      "Merci de nous répondre avant le [date limite].",
      "Vous êtes libre d'accepter ou de refuser, sans aucune conséquence. Sans réponse avant cette date, la proposition sera faite à quelqu'un d'autre.",
    ],
    bouton: "Voir et répondre",
  },
  /** 3 jours plus tard, sans réponse : mêmes faits, autres mots. */
  rappel: {
    objet: "Cette mission vous attend :",
    paragraphes: [
      "Nous n'avons pas encore votre réponse pour cette mission. Vous pouvez répondre avant le [date limite].",
      "Pour mémoire, voici le détail :",
      "• Formation : [intitulé]\n• Dates : [dates]\n• Lieu : [lieu]\n• Honoraires : [honoraires]\n• Déplacement : [déplacement]",
      "Sans réponse avant cette date, la proposition sera faite à quelqu'un d'autre. Vous êtes libre d'accepter ou de refuser, sans aucune conséquence.",
    ],
    bouton: "Voir et répondre",
  },
} as const;

export const CROCHET_NON_REMPLI = /\[[^[\]]+\]/;
