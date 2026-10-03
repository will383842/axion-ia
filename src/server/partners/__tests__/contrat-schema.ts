/**
 * Chantier Axion Partners — INT-T27-A (REQ-INT-004, REQ-INT-032). Un validateur JSON Schema
 * réduit aux mots-clés que `contracts.v2.json` emploie : le dépôt n'en embarque pas. Tout
 * mot-clé inconnu est une FAUTE, jamais un passe-droit.
 */
import contrat from "@/server/partners/contrat/contracts.v3.json";

type Schema = Record<string, unknown>;

const ANNOTATIONS = new Set(["$comment", "$id", "$schema", "title", "$defs"]);
const LUS = new Set([
  "type",
  "properties",
  "required",
  "additionalProperties",
  "anyOf",
  "allOf",
  "if",
  "then",
  "const",
  "enum",
  "pattern",
  "format",
  "minLength",
  // Contrat v3 : un montant en centimes est borné à zéro (`centimes`, minimum 0).
  "minimum",
  "$ref",
  "items",
]);

export const RACINE = contrat as unknown as Schema;

export function resoudre(ref: string): Schema {
  const [, nom] = /^#\/\$defs\/(.+)$/.exec(ref) ?? [];
  const cible = nom ? (RACINE["$defs"] as Record<string, Schema>)[nom] : undefined;
  if (!cible) throw new Error(`$ref introuvable : ${ref}`);
  return cible;
}

function typeDe(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v === "number") return Number.isInteger(v) ? "integer" : "number";
  return typeof v;
}

/** Les fautes de `v` contre `s`, chacune avec son chemin. Vide = conforme. */
export function fautes(s: Schema, v: unknown, chemin = "$"): string[] {
  const inconnus = Object.keys(s).filter((k) => !LUS.has(k) && !ANNOTATIONS.has(k));
  if (inconnus.length > 0) return [`${chemin} : mot-clé non lu par ce validateur (${inconnus})`];
  const f: string[] = [];
  if (typeof s["$ref"] === "string") f.push(...fautes(resoudre(s["$ref"]), v, chemin));
  if (s["type"] !== undefined) {
    const attendus = ([] as unknown[]).concat(s["type"]);
    const t = typeDe(v);
    if (!attendus.some((a) => a === t || (a === "number" && t === "integer"))) {
      f.push(`${chemin} : type ${t}, attendu ${attendus.join("|")}`);
      return f;
    }
  }
  if ("const" in s && v !== s["const"]) f.push(`${chemin} : ≠ ${JSON.stringify(s["const"])}`);
  if (Array.isArray(s["enum"]) && !s["enum"].includes(v)) f.push(`${chemin} : hors enum`);
  if (typeof v === "string") {
    if (typeof s["minLength"] === "number" && v.length < s["minLength"]) {
      f.push(`${chemin} : trop court`);
    }
    if (typeof s["pattern"] === "string" && !new RegExp(s["pattern"], "u").test(v)) {
      f.push(`${chemin} : ne suit pas ${s["pattern"]}`);
    }
  }
  if (typeof v === "number" && typeof s["minimum"] === "number" && v < s["minimum"]) {
    f.push(`${chemin} : sous le minimum ${s["minimum"]}`);
  }
  if (Array.isArray(v) && s["items"]) {
    v.forEach((e, i) => f.push(...fautes(s["items"] as Schema, e, `${chemin}[${i}]`)));
  }
  if (v !== null && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    const props = (s["properties"] ?? {}) as Record<string, Schema>;
    for (const r of (s["required"] ?? []) as string[]) {
      if (!(r in o)) f.push(`${chemin}.${r} : requis, absent`);
    }
    for (const [k, sous] of Object.entries(props)) {
      if (k in o) f.push(...fautes(sous, o[k], `${chemin}.${k}`));
    }
    if (s["additionalProperties"] === false) {
      for (const k of Object.keys(o)) if (!(k in props)) f.push(`${chemin}.${k} : hors contrat`);
    }
  }
  if (Array.isArray(s["anyOf"]) && !s["anyOf"].some((b) => fautes(b as Schema, v).length === 0)) {
    f.push(`${chemin} : aucune branche de anyOf`);
  }
  for (const b of (s["allOf"] ?? []) as Schema[]) f.push(...fautes(b, v, chemin));
  if (s["if"] && fautes(s["if"] as Schema, v).length === 0 && s["then"]) {
    f.push(...fautes(s["then"] as Schema, v, chemin));
  }
  return f;
}
