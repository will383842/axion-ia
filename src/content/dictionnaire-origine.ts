/**
 * DICTIONNAIRE D'ORIGINE FERMÉ « Famille › Détail » (ADR contrat v3, §4).
 *
 * `dictionnaire-origine.v1.json` est copié TEL QUEL dans le site, le CRM et le Studio.
 * Le test d'empreinte compare le SHA-256 du JSON canonique (clés triées) à
 * `EMPREINTE_DICTIONNAIRE` : changer le fichier dans un seul dépôt fait échouer la CI.
 * Ajout = nouvelle version, lecteurs d'abord ; aucune clé retirée (seulement `obsolete: true`).
 */
import { createHash } from "node:crypto";
import dictionnaire from "./dictionnaire-origine.v1.json";

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function canonique(v: Json): string {
  if (Array.isArray(v)) return `[${v.map(canonique).join(",")}]`;
  if (v !== null && typeof v === "object") {
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonique(v[k] as Json)}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

export function empreinteDictionnaire(d: unknown): string {
  return createHash("sha256")
    .update(canonique(d as Json))
    .digest("hex");
}

/** Empreinte du fichier v1. À recalculer UNIQUEMENT avec une nouvelle version du dictionnaire. */
export const EMPREINTE_DICTIONNAIRE =
  "10a65d4d683fbd6fd5d65701c964bd468211352af8dcd5da0a1d8817e75f54af";

export const FAMILLES_ORIGINE = Object.keys(dictionnaire.familles) as readonly string[];

export function detailsDeLaFamille(famille: string): readonly string[] {
  const f = (dictionnaire.familles as Record<string, { details: Record<string, unknown> }>)[
    famille
  ];
  return f ? Object.keys(f.details) : [];
}
