/**
 * V2-14 — plan de corrections du crible : propositions, empreinte, restauration, rapport. Module pur.
 *
 * Une proposition = une ligne de la table `articles` dont l'avis d'expert change. Le plan n'a pas
 * d'autre forme d'écriture. L'empreinte (sha256) porte sur les seules propositions : `apply` la
 * recalcule et refuse si elle diffère de celle de l'essai à blanc.
 */
import { createHash } from "node:crypto";
import type { Champs, ResultatArticle, CodeConstat } from "./analyse";

export const ACTION_CRIBLE = "crible-stock-2026-11";
export const ACTION_RESTAURATION = "crible-stock-2026-11-restauration";

export interface Proposition {
  /** Clé de sauvegarde : `article:<id>`. */
  readonly cle: string;
  readonly id: string;
  readonly slug: string;
  readonly type: "reattribuer-avis" | "retirer-avis";
  readonly avant: Champs;
  readonly apres: Champs;
}

/** Sérialisation stable (clés triées), pour que l'empreinte ne dépende pas de l'ordre des champs. */
function stable(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
    .join(",")}}`;
}

export function empreinte(v: unknown): string {
  return createHash("sha256").update(stable(v)).digest("hex");
}

export function propositions(resultats: ReadonlyArray<ResultatArticle>): Proposition[] {
  const out: Proposition[] = [];
  for (const r of resultats) {
    // Garde redondante avec `cribler` : un article exclu n'entre JAMAIS dans le plan.
    if (r.exclusion || !r.correction) continue;
    out.push({
      cle: `article:${r.id}`,
      id: r.id,
      slug: r.slug,
      type: r.correction.type,
      avant: r.correction.avant,
      apres: r.correction.apres,
    });
  }
  return out.sort((a, b) => a.cle.localeCompare(b.cle));
}

export function empreintePlan(p: ReadonlyArray<Proposition>): string {
  return empreinte(
    [...p]
      .sort((a, b) => a.cle.localeCompare(b.cle))
      .map((x) => ({ cle: x.cle, avant: x.avant, apres: x.apres })),
  );
}

/** Champs à remettre à la restauration : ceux que le script a écrits, avec leur valeur d'origine. */
export function champsARestaurer(avant: Partial<Champs>, apres: Partial<Champs>): Partial<Champs> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(apres) as Array<keyof Champs>) out[k] = avant[k] ?? null;
  return out as Partial<Champs>;
}

export function resume(rs: ReadonlyArray<ResultatArticle>, p: ReadonlyArray<Proposition>) {
  const parCode = new Map<CodeConstat, number>();
  for (const r of rs)
    for (const c of new Set(r.constats.map((x) => x.code)))
      parCode.set(c, (parCode.get(c) ?? 0) + 1);
  return {
    articles: rs.length,
    exclus: rs.filter((r) => r.exclusion).length,
    a_corriger: p.length,
    reattribues: p.filter((x) => x.type === "reattribuer-avis").length,
    retires: p.filter((x) => x.type === "retirer-avis").length,
    parCode,
  };
}

const TITRES: Readonly<Record<CodeConstat, string>> = {
  "chiffre-sans-source": "Chiffres sans source à portée",
  "citation-non-attribuee": "Citations sans auteur",
  "citation-expert-nommee": "Avis d'expert signé d'une personne",
  "definition-absente": "Pas de définition en tête",
  "lien-glossaire-absent": "Aucun lien vers le glossaire",
  "phrase-interdite": "Phrases interdites par la doctrine",
};

/** Rapport en Markdown : textes PUBLICS seulement (extraits courts), jamais le corps entier. */
export function rapport(
  mode: string,
  sha: string,
  rs: ReadonlyArray<ResultatArticle>,
  p: ReadonlyArray<Proposition>,
): string {
  const r = resume(rs, p);
  const l: string[] = [
    `# Crible du stock d'articles (V2-14) — ${mode}`,
    "",
    `Empreinte du plan : \`${sha}\``,
    "",
    `Articles criblés : ${r.articles} · exclus de toute correction : ${r.exclus} · à corriger : ${r.a_corriger} (avis réattribués : ${r.reattribues}, avis retirés : ${r.retires})`,
    "",
    "## Articles concernés par chaque constat",
    ...(Object.keys(TITRES) as CodeConstat[]).map(
      (c) => `- ${TITRES[c]} : ${r.parCode.get(c) ?? 0}`,
    ),
    "",
    "## Corrections proposées (seules écritures possibles : avis d'expert)",
  ];
  if (p.length === 0) l.push("- aucune");
  for (const x of p)
    l.push(
      `- \`${x.cle}\` (${x.slug}) · ${x.type} : « ${x.avant.expertQuoteName ?? "∅"} » → « ${x.apres.expertQuoteName ?? "∅"} »`,
    );

  l.push(
    "",
    "## Exclus de toute correction (décision de Williams : laissés tels quels, aucune mention)",
  );
  const ex = rs.filter((x) => x.exclusion);
  if (ex.length === 0) l.push("- aucun");
  for (const x of ex) l.push(`- ${x.slug} (${x.exclusion})`);

  l.push("", "## Détail par article (LISTE SEULE, aucune écriture)");
  for (const x of rs.filter((y) => !y.exclusion && y.constats.length > 0)) {
    l.push("", `### ${x.slug}`);
    for (const c of x.constats)
      l.push(
        `- ${c.code}${c.motif ? ` (${c.motif})` : ""}${c.champ ? ` · ${c.champ}` : ""} : « ${c.extrait} »`,
      );
  }
  l.push(
    "",
    "## Hors périmètre",
    "- le corps des articles n'est jamais modifié ; statut et indexation non plus ; rien n'est supprimé ;",
    "- les articles à témoignage ou à cas chiffré fictif : voir la section d'exclusion.",
  );
  return `${l.join("\n")}\n`;
}

export function rapportRestauration(r: {
  restaures: number;
  divergences: string[];
  lignes: string[];
}): string {
  return [
    "# Crible du stock d'articles (V2-14) — restauration",
    "",
    `Restaurés : ${r.restaures}`,
    ...r.lignes.map((x) => `- ${x}`),
    ...(r.divergences.length > 0
      ? ["", "## Non restaurés", ...r.divergences.map((d) => `- ${d}`)]
      : []),
    "",
  ].join("\n");
}
