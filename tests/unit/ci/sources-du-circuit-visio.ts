/**
 * Outils partagés des gardes du chantier visio (PR 2).
 *
 * Les gardes « le circuit ne fait jamais X » balaient des dossiers qui, pour
 * la plupart, n'existent pas encore : elles passent donc à vide aujourd'hui.
 * C'est pour cela que chacune porte un CONTRE-TÉMOIN (un texte fictif soumis
 * au même motif) qui prouve qu'elle rougirait — une garde qui ne regarde rien
 * et reste verte est le pire état possible.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/** Les dossiers du circuit visio (code d'exécution). */
export const DOSSIERS_DU_CIRCUIT = [
  "src/server/visio",
  "src/features/dossier-client",
  "src/app/api/enregistreur",
] as const;

/** Le circuit élargi : scripts d'exploitation et extension Chrome. */
export const DOSSIERS_DU_CIRCUIT_ELARGI = [
  ...DOSSIERS_DU_CIRCUIT,
  "scripts/visio",
  "extensions/enregistreur-meet",
] as const;

export function estUnTest(relatif: string): boolean {
  return (
    relatif.split(/[\\/]/).includes("__tests__") || /\.(spec|test)\.[cm]?[jt]sx?$/.test(relatif)
  );
}

/** Retire les commentaires (bloc et ligne) : un rappel n'est pas un appel. */
export function sansCommentaires(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

/**
 * Fichiers de code (hors tests) sous les dossiers donnés, chemins relatifs à
 * la racine avec `/`. Un dossier absent ne produit rien (il n'existe pas
 * encore) — les contre-témoins couvrent ce cas.
 */
export function sourcesSous(
  dossiers: readonly string[],
  extensions: RegExp = /\.[cm]?[jt]sx?$/,
): string[] {
  const trouves: string[] = [];
  const parcourir = (courant: string): void => {
    for (const nom of readdirSync(courant)) {
      if (nom === "node_modules") continue;
      const chemin = path.join(courant, nom);
      if (statSync(chemin).isDirectory()) parcourir(chemin);
      else if (extensions.test(nom)) trouves.push(path.relative(RACINE, chemin));
    }
  };
  for (const d of dossiers) {
    const absolu = path.join(RACINE, d);
    if (existsSync(absolu)) parcourir(absolu);
  }
  return trouves.map((f) => f.split(path.sep).join("/")).filter((f) => !estUnTest(f));
}

export function lire(relatif: string): string {
  return readFileSync(path.join(RACINE, relatif), "utf8");
}

/**
 * Comme `sourcesSous`, mais pour un cliquet qui PROMET de balayer ces
 * dossiers : un dossier introuvable rend le balayage inopérant, donc il lève
 * au lieu de rendre une liste vide (et un vert qui ne regarde rien).
 */
export function sourcesExigeesSous(dossiers: readonly string[]): string[] {
  for (const d of dossiers) {
    if (!existsSync(path.join(RACINE, d))) throw new Error(`balayage inopérant : ${d} introuvable`);
  }
  // Le client Prisma généré n'est pas du code du dépôt.
  return sourcesSous(dossiers).filter((f) => !f.startsWith("prisma/generated/"));
}

/** L'argument d'un appel, parenthèses équilibrées, à partir de la parenthèse ouvrante. */
export function argumentDAppel(source: string, ouvrante: number): string {
  let profondeur = 0;
  for (let i = ouvrante; i < source.length; i += 1) {
    const c = source[i];
    if (c === "(") profondeur += 1;
    else if (c === ")") {
      profondeur -= 1;
      if (profondeur === 0) return source.slice(ouvrante, i + 1);
    }
  }
  return source.slice(ouvrante);
}

/** Vrai si l'un des appels trouvés par `appel` (drapeau `g`) a un argument qui satisfait `motif`. */
export function unAppelNomme(source: string, appel: RegExp, motif: RegExp): boolean {
  for (const m of source.matchAll(appel)) {
    const ouvrante = (m.index ?? 0) + m[0].length - 1;
    if (motif.test(argumentDAppel(source, ouvrante))) return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lecture du schéma : les annotations RGPD des modèles
// ─────────────────────────────────────────────────────────────────────────────

export type AnnotationRgpd = "dossier-client" | "technique" | null;

export interface ModeleLu {
  readonly nom: string;
  /** Table (`@@map`), ou le nom du modèle à défaut. */
  readonly table: string;
  /** Accesseur Prisma (`clientContact`). */
  readonly accesseur: string;
  readonly annotation: AnnotationRgpd;
  /** Motif écrit après « technique — », vide sinon. */
  readonly motif: string;
  /** Tables vers lesquelles le modèle a une relation (champ `@relation`). */
  readonly relationsVers: readonly string[];
  /** Corps brut du modèle. */
  readonly corps: string;
}

/**
 * Découpe `schema.prisma` en modèles, avec le bloc de commentaires `///`
 * qui précède chacun (c'est là que vit l'annotation `rgpd:`).
 */
export function lireModeles(schema: string = lire("prisma/schema.prisma")): ModeleLu[] {
  const lignes = schema.split(/\r?\n/);
  const bruts: Array<{ nom: string; doc: string[]; corps: string[] }> = [];
  let doc: string[] = [];
  let courant: { nom: string; doc: string[]; corps: string[] } | null = null;
  for (const l of lignes) {
    if (courant !== null) {
      if (/^\}/.test(l)) {
        bruts.push(courant);
        courant = null;
        doc = [];
      } else {
        courant.corps.push(l);
      }
      continue;
    }
    const debut = /^model\s+(\w+)\s*\{/.exec(l);
    if (debut !== null) {
      courant = { nom: debut[1] as string, doc, corps: [] };
      continue;
    }
    if (/^\s*\/\/\//.test(l)) doc.push(l.replace(/^\s*\/\/\/\s?/, ""));
    else if (l.trim() !== "") doc = [];
  }

  const typesModeles = new Set(bruts.map((b) => b.nom));
  const tableDe = new Map<string, string>();
  for (const b of bruts) {
    const map = /@@map\("([^"]+)"\)/.exec(b.corps.join("\n"));
    tableDe.set(b.nom, map?.[1] ?? b.nom);
  }

  return bruts.map((b) => {
    const ligneRgpd = b.doc.find((d) => /^rgpd:/.test(d.trim())) ?? "";
    const m = /^rgpd:\s*(dossier-client|technique)\s*(?:—\s*(.*))?$/.exec(ligneRgpd.trim());
    const relationsVers: string[] = [];
    for (const ligne of b.corps) {
      if (!ligne.includes("@relation(") || !ligne.includes("fields:")) continue;
      const type = (ligne.trim().split(/\s+/)[1] ?? "").replace(/[?[\]]/g, "");
      if (typesModeles.has(type)) relationsVers.push(tableDe.get(type) ?? type);
    }
    return {
      nom: b.nom,
      table: tableDe.get(b.nom) ?? b.nom,
      accesseur: b.nom.charAt(0).toLowerCase() + b.nom.slice(1),
      annotation: (m?.[1] as AnnotationRgpd | undefined) ?? null,
      motif: (m?.[2] ?? "").trim(),
      relationsVers,
      corps: b.corps.join("\n"),
    };
  });
}
