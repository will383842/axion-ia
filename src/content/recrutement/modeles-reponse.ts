/**
 * Textes PRÉ-REMPLIS pour répondre à un candidat.
 *
 * ## Ce que ce fichier n'est pas
 *
 * 🔑 Ce ne sont PAS des gabarits d'e-mail. Le parc en compte 43, chacun avec son
 * enregistrement, ses cinq gardes et son aperçu ; en ajouter quatre pour quatre
 * formulations aurait alourdi le parc sans rien apporter — les quatre auraient
 * partagé la même mise en page, la même famille et le même pied de page.
 *
 * Ce sont des **points de départ**, chargés dans le composeur, modifiables avant
 * l'envoi. Ce qui part est ce qui a été relu. Le gabarit, unique, est
 * `candidature-reponse`.
 *
 * ## Le ton, et pourquoi il est écrit ici plutôt que laissé à chacun
 *
 * Un refus rédigé à la volée un jour de fatigue ne ressemble pas à un refus
 * rédigé un lundi matin. La personne qui le reçoit, elle, n'en lit qu'un. Ces
 * textes fixent le plancher : on dit non clairement, sans formule creuse
 * (« votre profil est très intéressant mais »), sans promesse qu'on ne tiendra
 * pas (« nous gardons votre candidature » — seulement si la case vivier a été
 * cochée), et on remercie du temps passé, qui est réel.
 *
 * ⚠️ Aucun de ces textes ne mentionne un délai de réponse. La page carrières en
 * promet un (« quelques jours ouvrés ») que l'accusé de réception s'est
 * délibérément abstenu de reprendre le 2026-08-13, faute de pouvoir le tenir.
 * Tant que l'arbitrage `D3` n'est pas rendu, on n'en réintroduit aucun ici.
 *
 * Les variables entre accolades sont substituées par le composeur avant
 * affichage : `{prenom}`, `{poste}`. Ce qui n'est pas substitué reste visible —
 * un trou dans un texte se voit et se corrige, contrairement à un `undefined`
 * qui disparaît.
 */

/** Identifiants des modèles — SOURCE du `z.enum` de l'action, jamais recopiés. */
export const MODELES_REPONSE_IDS = [
  "libre",
  "refus",
  "invitation-entretien",
  "demande-piece",
  "relance",
] as const;

export type ModeleReponseId = (typeof MODELES_REPONSE_IDS)[number];

export interface ModeleReponse {
  readonly id: ModeleReponseId;
  readonly libelle: string;
  /** Ce que ce modèle sert à dire — affiché sous le choix, pour éviter l'erreur. */
  readonly quand: string;
  readonly objet: string;
  readonly corps: string;
}

export const MODELES_REPONSE: readonly ModeleReponse[] = [
  {
    id: "libre",
    libelle: "Message libre",
    quand: "Aucun texte de départ — on écrit tout.",
    objet: "",
    corps: "",
  },
  {
    id: "refus",
    libelle: "Refus",
    quand: "La candidature n'est pas retenue. Dire non clairement, et remercier.",
    objet: "Votre candidature — {poste}",
    corps: [
      "Bonjour {prenom},",
      "",
      "Merci d'avoir pris le temps de postuler au poste de {poste}, et de nous avoir présenté votre parcours.",
      "",
      "Après examen, nous ne donnons pas suite à votre candidature. Ce n'est pas un jugement sur votre travail : nous cherchons un profil dont le centre de gravité est différent, et il vaut mieux vous le dire franchement que vous laisser attendre.",
      "",
      "Je vous souhaite une bonne suite, sincèrement.",
    ].join("\n"),
  },
  {
    id: "invitation-entretien",
    libelle: "Invitation à un entretien",
    quand: "On veut rencontrer la personne. Proposer, jamais imposer, un créneau.",
    objet: "Échangeons — {poste}",
    corps: [
      "Bonjour {prenom},",
      "",
      "Votre candidature au poste de {poste} nous intéresse, et j'aimerais qu'on en parle de vive voix.",
      "",
      "Seriez-vous disponible pour un échange d'une trentaine de minutes ? Dites-moi deux ou trois créneaux qui vous arrangent, et je m'aligne. En visioconférence ou par téléphone, comme vous préférez.",
      "",
      "À bientôt j'espère.",
    ].join("\n"),
  },
  {
    id: "demande-piece",
    libelle: "Demande de pièce ou de précision",
    quand: "Il manque quelque chose pour décider — un CV, un lien, une précision.",
    objet: "Une précision sur votre candidature",
    corps: [
      "Bonjour {prenom},",
      "",
      "Merci pour votre candidature au poste de {poste}. Avant d'aller plus loin, il me manque un élément :",
      "",
      "— *(préciser ici ce qui manque)*",
      "",
      "Vous pouvez simplement répondre à ce message, je m'occupe du reste.",
    ].join("\n"),
  },
  {
    id: "relance",
    libelle: "Relance",
    quand: "On a écrit, personne n'a répondu. Une seule relance, sans reproche.",
    objet: "Petite relance — {poste}",
    corps: [
      "Bonjour {prenom},",
      "",
      "Je me permets un mot de relance au sujet de votre candidature au poste de {poste} : mon message précédent est peut-être passé inaperçu.",
      "",
      "Si le poste ne vous intéresse plus, dites-le moi sans détour — cela ne me vexera pas et me permettra d'avancer. Si au contraire il vous intéresse toujours, j'attends votre retour.",
    ].join("\n"),
  },
];

/**
 * Substitue les variables d'un modèle.
 *
 * 🔑 Une variable inconnue est LAISSÉE TELLE QUELLE, accolades comprises. Un
 * remplacement par une chaîne vide produirait « Bonjour , » — une phrase
 * grammaticalement correcte, donc invisible à la relecture, qui partirait telle
 * quelle. Un `{prenom}` resté à l'écran se voit et se corrige.
 */
export function remplirModele(texte: string, valeurs: Record<string, string | null>): string {
  return texte.replace(/\{(\w+)\}/g, (entier, cle: string) => {
    const valeur = valeurs[cle];
    return valeur != null && valeur.trim().length > 0 ? valeur : entier;
  });
}

// ─── Lot L0c-2 — modèles « formateur indépendant » ───────────────────────────
//
// Textes de `TEXTES-A-VALIDER` (blocs F1, F6, F7), adaptés au composeur : un
// lien à insérer remplace le bouton. Proposés SEULEMENT sur une candidature de
// formateur freelance, interrupteur `formateurs.modeles_composeur` allumé.
// ⚠️ F6 promettait « Nous gardons votre candidature » : retiré ici, la
// conservation dépend de la case vivier (cf. les tests de ce fichier).

export const MODELES_REPONSE_FORMATEUR_IDS = [
  "formateur-proposition-echange",
  "formateur-non-retenu",
  "formateur-absent",
] as const;

export type ModeleReponseFormateurId = (typeof MODELES_REPONSE_FORMATEUR_IDS)[number];

export interface ModeleReponseFormateur extends Omit<ModeleReponse, "id"> {
  readonly id: ModeleReponseFormateurId;
}

/** Tous les identifiants qu'un composeur peut envoyer (source du `z.enum` des actions). */
export const MODELES_COMPOSEUR_IDS = [
  ...MODELES_REPONSE_IDS,
  ...MODELES_REPONSE_FORMATEUR_IDS,
] as const;

export type ModeleComposeurId = (typeof MODELES_COMPOSEUR_IDS)[number];

export const MODELES_REPONSE_FORMATEUR: readonly ModeleReponseFormateur[] = [
  {
    id: "formateur-proposition-echange",
    libelle: "Proposition d'un échange",
    quand:
      "Proposer l'échange de 20 minutes. Insérez le lien « Réserver un échange » à l'endroit indiqué.",
    objet: "Choisissez votre moment pour notre échange",
    corps: [
      "Bonjour {prenom},",
      "",
      "Merci pour votre candidature.",
      "",
      "Nous vous proposons un échange de 20 minutes en visio pour faire connaissance, vous présenter comment fonctionnent les missions que nous confions à des formateurs indépendants, et répondre à vos questions. Sans engagement : à l'issue, chacun décide librement de la suite.",
      "",
      "Choisissez le moment qui vous convient avec ce lien :",
      "",
      "— *(insérez ici le lien « Réserver un échange »)*",
    ].join("\n"),
  },
  {
    id: "formateur-non-retenu",
    libelle: "Non retenu après l'échange",
    quand: "Après l'échange, quand vous ne donnez pas suite.",
    objet: "Merci pour notre échange",
    corps: [
      "Bonjour {prenom},",
      "",
      "Merci pour le temps que vous nous avez consacré.",
      "",
      "Nous ne donnons pas suite pour le moment : nos besoins actuels ne correspondent pas à votre profil.",
      "",
      "Si vous préférez que nous effacions vos données, répondez simplement à ce message : Williams Jullin, responsable d'Axion-IA, traite votre demande. Nous rendons alors votre fiche anonyme et ne gardons que ce que la loi nous impose de conserver.",
    ].join("\n"),
  },
  {
    id: "formateur-absent",
    libelle: "Absent à l'échange",
    quand: "La personne n'est pas venue à l'échange. Une seule fois.",
    objet: "Nous vous avons attendu",
    corps: [
      "Bonjour {prenom},",
      "",
      "Nous vous avons attendu pour notre échange. Un imprévu arrive à tout le monde.",
      "",
      "Si la proposition vous intéresse toujours, choisissez un nouveau créneau avec ce lien. Sinon, vous n'avez rien à faire : nous ne vous relancerons pas.",
      "",
      "— *(insérez ici le lien « Réserver un échange »)*",
    ].join("\n"),
  },
];

/** Les modèles proposés par le composeur. Coupé : ceux d'aujourd'hui, et eux seuls. */
export function modelesDuComposeur(o: {
  readonly modelesFormateur: boolean;
}): ReadonlyArray<ModeleReponse | ModeleReponseFormateur> {
  return o.modelesFormateur ? [...MODELES_REPONSE, ...MODELES_REPONSE_FORMATEUR] : MODELES_REPONSE;
}

/** Le serveur revérifie : un modèle formateur n'est accepté que s'il est proposé. */
export function modeleAutorise(id: string, o: { readonly modelesFormateur: boolean }): boolean {
  return modelesDuComposeur(o).some((m) => m.id === id);
}
