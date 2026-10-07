/**
 * Qualiopi — Lecture du fichier des CONVENTIONS COLLECTIVES du ministère du
 * Travail (INT-T80-A) : l'intitulé de chaque IDCC, son état actif ou inactif,
 * son successeur.
 *
 * Module PUR : un tampon en entrée, des conventions en sortie ; aucune base,
 * aucun réseau. L'écriture et le téléchargement vivent ailleurs
 * (`idcc-intitules-import.ts`, `opco-siro-import-worker.ts`).
 *
 * ## La source (RM-08), lue par A02 le 2026-10-07 à 11:00 UTC
 * axion-apporteurs #782, 6036523485 :
 *  - page `https://travail-emploi.gouv.fr/conventions-collectives-nomenclatures`,
 *    rubrique « Liste des conventions collectives et de leur code IDCC » ;
 *  - ressource `…/files/2026-10/Dares_Suivi_Historique_convention_collective_2026.xlsx`
 *    (« fichier de suivi historique », mis à jour MENSUELLEMENT par la Dares et
 *    la DG Travail, depuis le 1er juin 2026) ; l'URL CHANGE à chaque dépôt ;
 *  - feuille `Conventions de branche`, 1 ligne d'en-tête, 1 665 lignes de
 *    données dont 484 actives ; feuille `Accords et statuts` HORS du champ
 *    (sa clé est `CODE`, pas un IDCC) ;
 *  - colonnes : `IDCC` (CHAÎNE de 5 caractères, zéros de tête : `01596`),
 *    `Libellé`, `Régime`, `Champ d'application`, `IDCCactif`, `NouvIDCC`,
 *    `CRIS`, `DateSignature`, `DateEffet`, `DateFin` (numéros de série Excel),
 *    `LibelléCourt`.
 *
 * ## Règles de lecture
 *  - la feuille se lit par son NOM, l'en-tête par ses INTITULÉS, jamais par
 *    position ; une colonne attendue qui manque REFUSE le fichier ;
 *  - l'IDCC se normalise sur 4 chiffres par `normaliserIdcc` : `01596` et
 *    `1596` désignent la même ligne de `idcc_opco` ;
 *  - les dates (signature, effet, fin) ne sont pas lues : sans usage ici ;
 *  - TOUTES les conventions sont gardées, inactives comprises, avec leur état :
 *    un client peut porter un IDCC ancien (décision de la coordination, #782,
 *    6036541694) ;
 *  - un IDCC en double, une ligne sans intitulé, un état ni 0 ni 1, un régime ou
 *    un champ inconnu, un successeur illisible : le fichier est REFUSÉ avant
 *    toute écriture. Pas de tolérance : 1 665 lignes se lisent entièrement.
 */

import { createHash } from "node:crypto";
import JSZip from "jszip";
import { normaliserIdcc } from "@/server/qualiopi/crm/naf-opco";

export const FEUILLE_CONVENTIONS = "Conventions de branche";

/** Intitulés d'en-tête REQUIS, tels que le fichier les écrit (comparés sans accents ni casse). */
export const COLONNES_REQUISES = [
  "IDCC",
  "Libellé",
  "Régime",
  "Champ d'application",
  "IDCCactif",
  "NouvIDCC",
  "LibelléCourt",
] as const;

/** En dessous, le fichier est jugé tronqué (1 665 lignes dans le millésime 2026-10). */
export const CONVENTIONS_MINIMUM = 1_000;

export type Regime = "general" | "agricole";
export type Champ = "national" | "local";

export interface ConventionCollective {
  /** IDCC sur 4 chiffres (forme de `idcc_opco`). */
  readonly idcc: string;
  readonly intitule: string;
  readonly intituleCourt: string | null;
  readonly actif: boolean;
  /** IDCC qui lui succède (4 chiffres) ; peut lui-même être inactif. */
  readonly successeurIdcc: string | null;
  readonly regime: Regime;
  readonly champ: Champ;
}

export interface LectureConventions {
  /** Triées par IDCC. */
  readonly conventions: ConventionCollective[];
  readonly sha256: string;
  readonly octets: number;
}

export class FichierConventionsRefuse extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FichierConventionsRefuse";
  }
}

// ─── Lecture minimale d'un classeur XLSX ───────────────────────────────────

function normaliserEntete(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function decoderEntites(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#([0-9]+);/g, (_, d: string) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Texte d'un fragment `<si>` / `<is>` : tous ses `<t>`, mis bout à bout (texte riche compris). */
function texteDe(fragment: string): string {
  let out = "";
  for (const m of fragment.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) out += m[1] ?? "";
  return decoderEntites(out);
}

function attribut(balise: string, nom: string): string | null {
  const m = new RegExp(`\\s${nom}="([^"]*)"`).exec(balise);
  return m ? decoderEntites(m[1] ?? "") : null;
}

/** « B12 » → 1 (colonne B, indice base 0). */
function indiceColonne(ref: string): number {
  const lettres = /^[A-Z]+/.exec(ref)?.[0] ?? "";
  let n = 0;
  for (const c of lettres) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

async function lireTexte(zip: JSZip, chemin: string): Promise<string | null> {
  const f = zip.file(chemin);
  return f === null ? null : f.async("string");
}

/** Chemin de la feuille portant ce NOM, ou refus. */
async function cheminDeLaFeuille(zip: JSZip, nom: string): Promise<string> {
  const classeur = await lireTexte(zip, "xl/workbook.xml");
  const rels = await lireTexte(zip, "xl/_rels/workbook.xml.rels");
  if (classeur === null || rels === null) {
    throw new FichierConventionsRefuse(
      "classeur illisible : workbook.xml ou ses relations manquent",
    );
  }
  let rid: string | null = null;
  for (const m of classeur.matchAll(/<sheet\b[^>]*\/?>/g)) {
    if (attribut(m[0], "name") === nom) rid = attribut(m[0], "r:id");
  }
  if (rid === null) throw new FichierConventionsRefuse(`feuille « ${nom} » absente du classeur`);
  for (const m of rels.matchAll(/<Relationship\b[^>]*\/?>/g)) {
    if (attribut(m[0], "Id") === rid) {
      const cible = attribut(m[0], "Target");
      if (cible === null) break;
      return cible.startsWith("/") ? cible.slice(1) : `xl/${cible}`;
    }
  }
  throw new FichierConventionsRefuse(`feuille « ${nom} » : sa relation ${rid} est introuvable`);
}

async function chainesPartagees(zip: JSZip): Promise<string[]> {
  const xml = await lireTexte(zip, "xl/sharedStrings.xml");
  if (xml === null) return [];
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g)].map((m) =>
    m[1] === undefined ? "" : texteDe(m[1]),
  );
}

/** Lignes de la feuille, en tableaux de cellules texte (cases vides = ""). */
async function lireLignes(zip: JSZip, chemin: string): Promise<string[][]> {
  const xml = await lireTexte(zip, chemin);
  if (xml === null) throw new FichierConventionsRefuse(`feuille illisible : ${chemin} manque`);
  const partagees = await chainesPartagees(zip);
  const lignes: string[][] = [];
  for (const ligne of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cellules: string[] = [];
    for (const c of (ligne[1] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1] ?? "";
      const ref = attribut(` ${attrs}`, "r");
      if (ref === null) continue;
      const type = attribut(` ${attrs}`, "t");
      const corps = c[2] ?? "";
      let valeur = "";
      if (type === "inlineStr") {
        valeur = texteDe(corps);
      } else {
        const v = /<v>([\s\S]*?)<\/v>/.exec(corps)?.[1];
        if (v !== undefined) {
          valeur = type === "s" ? (partagees[Number(v)] ?? "") : decoderEntites(v);
        }
      }
      cellules[indiceColonne(ref)] = valeur;
    }
    lignes.push(Array.from(cellules, (v) => v ?? ""));
  }
  return lignes;
}

// ─── Lecture des conventions ───────────────────────────────────────────────

function refuser(ligne: number, message: string): never {
  throw new FichierConventionsRefuse(`ligne ${ligne} : ${message}`);
}

export async function lireConventions(fichier: Buffer | Uint8Array): Promise<LectureConventions> {
  const tampon = Buffer.from(fichier);
  if (tampon.length === 0) throw new FichierConventionsRefuse("fichier vide");
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(tampon);
  } catch {
    throw new FichierConventionsRefuse("fichier illisible : ce n'est pas un classeur XLSX");
  }
  const lignes = await lireLignes(zip, await cheminDeLaFeuille(zip, FEUILLE_CONVENTIONS));
  const entete = lignes[0];
  if (entete === undefined) throw new FichierConventionsRefuse("feuille sans en-tête");

  const position = new Map<string, number>();
  entete.forEach((titre, i) => position.set(normaliserEntete(titre), i));
  const colonne = (nom: string): number => {
    const i = position.get(normaliserEntete(nom));
    if (i === undefined)
      throw new FichierConventionsRefuse(`colonne « ${nom} » absente de l'en-tête`);
    return i;
  };
  const col = {
    idcc: colonne("IDCC"),
    libelle: colonne("Libellé"),
    regime: colonne("Régime"),
    champ: colonne("Champ d'application"),
    actif: colonne("IDCCactif"),
    successeur: colonne("NouvIDCC"),
    court: colonne("LibelléCourt"),
  };

  const vues = new Set<string>();
  const conventions: ConventionCollective[] = [];
  for (let i = 1; i < lignes.length; i++) {
    const l = lignes[i] ?? [];
    const numero = i + 1;
    const brut = (l[col.idcc] ?? "").trim();
    if (l.every((c) => c.trim() === "")) continue; // ligne vide en fin de feuille
    const idcc = normaliserIdcc(brut);
    if (idcc === null) refuser(numero, `IDCC illisible « ${brut} »`);
    if (vues.has(idcc)) refuser(numero, `IDCC ${idcc} en double`);
    vues.add(idcc);

    const intitule = (l[col.libelle] ?? "").trim();
    if (intitule === "") refuser(numero, `IDCC ${idcc} sans intitulé`);

    const etat = (l[col.actif] ?? "").trim();
    if (etat !== "0" && etat !== "1") refuser(numero, `IDCCactif « ${etat} » ni 0 ni 1`);

    const regimeBrut = normaliserEntete(l[col.regime] ?? "");
    const regime: Regime | null =
      regimeBrut === "general" ? "general" : regimeBrut === "agricole" ? "agricole" : null;
    if (regime === null) refuser(numero, `régime « ${l[col.regime] ?? ""} » inconnu`);

    const champBrut = normaliserEntete(l[col.champ] ?? "");
    const champ: Champ | null =
      champBrut === "national" ? "national" : champBrut === "local" ? "local" : null;
    if (champ === null) refuser(numero, `champ d'application « ${l[col.champ] ?? ""} » inconnu`);

    const successeurBrut = (l[col.successeur] ?? "").trim();
    let successeurIdcc: string | null = null;
    if (successeurBrut !== "") {
      successeurIdcc = normaliserIdcc(successeurBrut);
      if (successeurIdcc === null) refuser(numero, `successeur illisible « ${successeurBrut} »`);
    }

    const court = (l[col.court] ?? "").trim();
    conventions.push({
      idcc,
      intitule,
      intituleCourt: court === "" ? null : court,
      actif: etat === "1",
      successeurIdcc,
      regime,
      champ,
    });
  }

  if (conventions.length < CONVENTIONS_MINIMUM) {
    throw new FichierConventionsRefuse(
      `fichier douteux : ${conventions.length} conventions lues, au moins ${CONVENTIONS_MINIMUM} attendues`,
    );
  }
  conventions.sort((a, b) => (a.idcc < b.idcc ? -1 : 1));
  return {
    conventions,
    sha256: createHash("sha256").update(tampon).digest("hex"),
    octets: tampon.length,
  };
}
