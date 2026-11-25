// DOCUMENTS REMIS à l'apporteur (2026-11-25) : le registre UNIQUE de ce qu'il doit pouvoir
// retrouver — titre, phrase simple, chemin, condition d'affichage.
//
// Lu par la page « Mes documents » de son espace
// (`/apporteur/dossier/<apporteurId>/<jeton>/documents`) ; module PUR (ni base, ni disque, ni
// `server-only`), pour que les e-mails puissent le réutiliser plus tard.
//
//   · ce fichier ne contrôle AUCUN accès : il dit seulement quoi lister. Le lien personnel est
//     vérifié par `lireDossierParLien`, et chaque adresse listée refait son propre contrôle ;
//   · aucun montant, aucun pourcentage : les chiffres vivent dans les documents eux-mêmes ;
//   · le livret d'accueil n'est listé que si son fichier existe dans `public/` : c'est
//     l'appelant, côté serveur, qui le constate et le dit par `livretDisponible`.

/** Ce qu'il faut savoir du dossier pour décider des lignes à montrer. */
export interface ContexteDocuments {
  /** Adresse de l'espace personnel, sans barre finale : `/apporteur/dossier/<id>/<jeton>`. */
  readonly espace: string;
  /** Le contrat est signé : la charte et les outils sont ouverts (art. 22 bis). */
  readonly sousContrat: boolean;
  /** Le PDF du contrat signé des deux parties existe et peut être téléchargé. */
  readonly contratSigneDisponible: boolean;
  /** Le fichier du livret d'accueil existe dans `public/` (constaté côté serveur). */
  readonly livretDisponible: boolean;
}

export type CleDocument = "contrat" | "fiche-commissions" | "livret" | "charte" | "outils";

export interface DocumentRemis {
  readonly cle: CleDocument;
  readonly titre: string;
  /** Une phrase simple : à quoi sert ce document. */
  readonly description: string;
  /** Texte du lien. */
  readonly action: string;
  /** Adresse du document, relative au site. */
  readonly chemin: (espace: string) => string;
  /** Faut-il montrer la ligne à cet apporteur ? */
  readonly visible: (c: ContexteDocuments) => boolean;
  /** Fichier ou page à imprimer : s'ouvre dans un nouvel onglet, l'espace reste ouvert. */
  readonly nouvelOnglet: boolean;
}

export const CHEMIN_FICHE_COMMISSIONS = "/documents/apporteurs/comment-ca-marche.pdf";
export const CHEMIN_LIVRET = "/documents/apporteurs/livret-apporteur.pdf";

export const DOCUMENTS_REMIS: readonly DocumentRemis[] = [
  {
    cle: "contrat",
    titre: "Mon contrat signé",
    description: "Votre contrat d'apporteur d'affaires, signé par vous et par Axion-IA.",
    action: "Télécharger mon contrat (PDF)",
    chemin: (espace) => `${espace}/contrat?dl=1`,
    visible: (c) => c.sousContrat && c.contratSigneDisponible,
    nouvelOnglet: true,
  },
  {
    cle: "fiche-commissions",
    titre: "La fiche des commissions",
    description: "Comment vos commissions sont calculées et versées, expliqué simplement.",
    action: "Ouvrir la fiche (PDF)",
    chemin: () => CHEMIN_FICHE_COMMISSIONS,
    visible: () => true,
    nouvelOnglet: true,
  },
  {
    cle: "livret",
    titre: "Le livret d'accueil",
    description: "Le guide pour bien démarrer dans le réseau, étape par étape.",
    action: "Ouvrir le livret (PDF)",
    chemin: () => CHEMIN_LIVRET,
    visible: (c) => c.livretDisponible,
    nouvelOnglet: true,
  },
  {
    cle: "charte",
    titre: "La charte de marque",
    description: "Les règles à suivre quand vous parlez d'Axion-IA.",
    action: "Ouvrir la charte",
    chemin: (espace) => `${espace}/charte`,
    visible: (c) => c.sousContrat,
    nouvelOnglet: true,
  },
  {
    cle: "outils",
    titre: "Mes outils de communication",
    description: "Bannière, visuels, textes et logo, prêts à l'emploi.",
    action: "Ouvrir mes outils",
    chemin: (espace) => `${espace}/outils`,
    visible: (c) => c.sousContrat,
    nouvelOnglet: false,
  },
];

/** Une ligne prête à afficher. */
export interface DocumentAffiche {
  readonly cle: CleDocument;
  readonly titre: string;
  readonly description: string;
  readonly action: string;
  readonly href: string;
  readonly nouvelOnglet: boolean;
}

/** Les documents à montrer à CET apporteur, dans l'ordre du registre. */
export function documentsRemis(c: ContexteDocuments): DocumentAffiche[] {
  return DOCUMENTS_REMIS.filter((d) => d.visible(c)).map((d) => ({
    cle: d.cle,
    titre: d.titre,
    description: d.description,
    action: d.action,
    href: d.chemin(c.espace),
    nouvelOnglet: d.nouvelOnglet,
  }));
}

/** Textes de la page « Mes documents ». */
export const DOCUMENTS_TITRE = "Mes documents";
export const DOCUMENTS_INTRO =
  "Tous les documents que nous vous avons remis, réunis au même endroit.";
/** Dossier pas encore signé : ce qui viendra s'ajouter. */
export const DOCUMENTS_NON_SIGNE =
  "Votre contrat, la charte de marque et vos outils de communication s'ajouteront ici dès que votre contrat sera signé.";

/** Ce que voit qui ouvre la page sans lien personnel valide : aucun document. */
export const DOCUMENTS_RESERVES = {
  titre: "Vos documents sont dans votre espace",
  texte: "Ouvrez cette page depuis votre lien personnel pour retrouver vos documents.",
} as const;
