/**
 * Console éditoriale — exports CSV et sauvegarde JSON (§2 bis D, critères 9
 * et 10 du lot 1).
 *
 * Module PUR : il reçoit des données et rend du texte. Aucun accès base, donc
 * chaque cas tordu se teste en une milliseconde — et les cas tordus d'un CSV
 * sont nombreux.
 *
 * > ⚠️ « La sauvegarde complète est une EXIGENCE, pas un confort. Elle doit
 * > exister dès le lot 1. Un outil dont on ne peut pas sortir est un piège. »
 *
 * C'est la raison d'être de ce fichier, et elle vaut d'être prise au sérieux :
 * une console éditoriale qui retient ses données est une console qu'on n'ose
 * plus quitter, donc qu'on n'ose plus critiquer.
 */

/** Une publication, réduite à ce qu'un export porte. */
export interface PublicationExportable {
  refImport: string | null;
  datePrevue: string;
  heurePrevue: string;
  compteLibelle: string;
  identite: string;
  titreInterne: string;
  accroche: string | null;
  corps: string | null;
  premierCommentaire: string | null;
  tags: string[];
  lienUrl: string | null;
  statutRedaction: string;
  statutAsset: string;
  statutDiffusion: string;
  urlPubliee: string | null;
  cheminsMedias: string[];
}

/**
 * Colonnes du CSV de programmation, dans l'ordre.
 *
 * Le §2 bis D précise l'usage : « import dans Buffer ou équivalent, APRÈS
 * remappage des colonnes ». L'ordre est donc celui qui se relit à l'œil, pas
 * celui d'un format imposé — personne ne consomme ce fichier sans le regarder.
 */
export const COLONNES_CSV = [
  "reference",
  "date",
  "heure",
  "compte",
  "identite",
  "titre",
  "accroche",
  "corps",
  "premier_commentaire",
  "tags",
  "lien",
  "statut_redaction",
  "statut_asset",
  "statut_diffusion",
  "url_publiee",
  "medias",
] as const;

/**
 * Échappe une cellule pour un CSV à séparateur `;`.
 *
 * 🔴 Trois pièges, tous rencontrés à l'import et donc certains de revenir à
 * l'export :
 *
 * 1. Un `;` dans une accroche décale toute la ligne ;
 * 2. un guillemet doit être DOUBLÉ à l'intérieur d'un champ cité ;
 * 3. **un corps de publication contient TOUJOURS des sauts de ligne** — c'est
 *    même sa forme normale sur LinkedIn. Sans citation, une seule publication
 *    produirait quinze lignes de CSV.
 */
/**
 * Les amorces de formule d'un tableur.
 *
 * 🔴 Défaut trouvé par la passe 4 du protocole (adversaire).
 *
 * Cet export est explicitement destiné à Excel — BOM UTF-8 et CRLF assumés,
 * juste en dessous. Une cellule qui commence par `=`, `+`, `-` ou `@` y est
 * interprétée comme une FORMULE, pas comme du texte. Un titre interne saisi
 * par un coéquipier `production` —
 *
 *     =cmd|' /C calc'!A0
 *
 * — s'exécutait donc chez celui qui ouvre l'export. La surface est
 * interne, mais « interne » n'est pas « de confiance » : le §4 prévoit
 * précisément des rôles qui écrivent sans pouvoir valider.
 *
 * On préfixe d'une apostrophe plutôt que de retirer le caractère : le texte
 * reste LISIBLE et intégral — mutiler la donnée d'un export serait remplacer
 * un problème de sécurité par un problème de fidélité.
 */
const AMORCES_FORMULE = ["=", "+", "-", "@", "\t", "\r"];

/** Neutralise une amorce de formule sans altérer le texte affiché. */
export function neutraliserFormule(valeur: string): string {
  if (valeur.length === 0) return valeur;
  const premier = valeur[0] as string;
  return AMORCES_FORMULE.includes(premier) ? "'" + valeur : valeur;
}

export function echapperCellule(valeur: string): string {
  // La neutralisation vient AVANT la citation : sinon le `"` ouvrant
  // masquerait l'amorce à l'inspection, et le tableur la verrait quand même.
  valeur = neutraliserFormule(valeur);
  const doitCiter =
    valeur.includes(";") || valeur.includes('"') || valeur.includes("\n") || valeur.includes("\r");
  if (!doitCiter) return valeur;
  return `"${valeur.replace(/"/g, '""')}"`;
}

/** Une valeur quelconque → cellule. `null` devient vide, pas « null ». */
function cellule(v: string | null | undefined): string {
  return echapperCellule(v ?? "");
}

/**
 * Construit le CSV de programmation.
 *
 * BOM UTF-8 en tête et CRLF en fin de ligne : c'est ce qu'attend un tableur
 * sous Windows, et c'est le format que le §6 décrit pour le dossier d'entrée.
 * Sans le BOM, Excel affiche « Ã© » à la place de « é » et l'utilisateur
 * conclut que l'outil est cassé.
 */
export function construireCsv(publications: readonly PublicationExportable[]): string {
  const lignes: string[] = [COLONNES_CSV.join(";")];
  for (const p of publications) {
    lignes.push(
      [
        cellule(p.refImport),
        cellule(p.datePrevue),
        cellule(p.heurePrevue),
        cellule(p.compteLibelle),
        cellule(p.identite),
        cellule(p.titreInterne),
        cellule(p.accroche),
        cellule(p.corps),
        cellule(p.premierCommentaire),
        cellule(p.tags.join(" ")),
        cellule(p.lienUrl),
        cellule(p.statutRedaction),
        cellule(p.statutAsset),
        cellule(p.statutDiffusion),
        cellule(p.urlPubliee),
        cellule(p.cheminsMedias.join(" | ")),
      ].join(";"),
    );
  }
  return "﻿" + lignes.join("\r\n") + "\r\n";
}

/**
 * Nom de fichier d'un export mensuel — lisible, triable, sans espace.
 *
 * « publications-2026-09.csv » se range tout seul dans un dossier de
 * téléchargements, ce que « export.csv » ne fait pas.
 */
export function nomFichierCsv(annee: number, mois: number): string {
  return `publications-${annee}-${String(mois).padStart(2, "0")}.csv`;
}

// ── La sauvegarde complète ────────────────────────────────────────────────

/** Version du format de sauvegarde. Incrémentée à tout changement de forme. */
export const VERSION_SAUVEGARDE = 1;

export interface SauvegardeComplete {
  version: number;
  genereeA: string;
  /** Ce que porte la sauvegarde, table par table. */
  contenu: Record<string, unknown[]>;
  /** Décompte par table — pour vérifier une relecture d'un coup d'œil. */
  compte: Record<string, number>;
}

/**
 * Assemble la sauvegarde complète.
 *
 * ⚠️ **Sans les fichiers** — le §2 bis D le dit, et le §5 explique pourquoi :
 * les rushes ne passent jamais par l'outil, et une sauvegarde qui embarquerait
 * les médias pèserait 290 Go par an. Ce qu'on sauvegarde ici, ce sont les
 * DONNÉES : ce qui a été écrit, décidé, mesuré. Les fichiers vivent sur le
 * volume de montage, et c'est lui qu'on sauvegarde autrement.
 *
 * `genereeA` est passé en paramètre plutôt que lu de l'horloge : une fonction
 * pure se teste, une fonction qui appelle `new Date()` se devine.
 */
export function assemblerSauvegarde(
  tables: Record<string, unknown[]>,
  genereeA: Date,
): SauvegardeComplete {
  const compte: Record<string, number> = {};
  for (const [nom, lignes] of Object.entries(tables)) {
    compte[nom] = lignes.length;
  }
  return {
    version: VERSION_SAUVEGARDE,
    genereeA: genereeA.toISOString(),
    contenu: tables,
    compte,
  };
}

/**
 * Sérialise la sauvegarde.
 *
 * `JSON.stringify` ne sait pas écrire un `BigInt` — et `EdAsset.poidsOctets`
 * en est un. Sans ce remplaçant, la sauvegarde lève « Do not know how to
 * serialize a BigInt » au premier asset pesé, c'est-à-dire au pire moment :
 * quand on essaie justement de sortir ses données.
 */
export function serialiserSauvegarde(sauvegarde: SauvegardeComplete): string {
  return JSON.stringify(
    sauvegarde,
    (_cle, valeur: unknown) => {
      if (typeof valeur === "bigint") return valeur.toString();
      if (valeur instanceof Date) return valeur.toISOString();
      return valeur;
    },
    2,
  );
}

/** `sauvegarde-console-editoriale-2026-08-21.json`. */
export function nomFichierSauvegarde(genereeA: Date): string {
  return `sauvegarde-console-editoriale-${genereeA.toISOString().slice(0, 10)}.json`;
}

/**
 * Relit une sauvegarde et dit si elle est exploitable — critère 10 :
 * « la sauvegarde JSON complète se télécharge ET SE RELIT ».
 *
 * Une sauvegarde qu'on ne sait pas relire n'est pas une sauvegarde ; c'est un
 * fichier. Cette fonction est donc la moitié utile du critère.
 */
export function relireSauvegarde(
  texte: string,
): { ok: true; sauvegarde: SauvegardeComplete } | { ok: false; motif: string } {
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch (e) {
    return { ok: false, motif: `JSON illisible : ${e instanceof Error ? e.message : "erreur"}` };
  }
  if (typeof brut !== "object" || brut === null) {
    return { ok: false, motif: "La sauvegarde n'est pas un objet." };
  }
  const o = brut as Partial<SauvegardeComplete>;
  if (typeof o.version !== "number") {
    return { ok: false, motif: "Version absente : format non reconnu." };
  }
  if (o.version > VERSION_SAUVEGARDE) {
    return {
      ok: false,
      motif:
        `Sauvegarde en version ${o.version}, cette console lit jusqu'à ` +
        `${VERSION_SAUVEGARDE}. Mettez la console à jour avant de relire.`,
    };
  }
  if (typeof o.contenu !== "object" || o.contenu === null) {
    return { ok: false, motif: "Contenu absent." };
  }
  return { ok: true, sauvegarde: o as SauvegardeComplete };
}
