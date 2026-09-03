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
