/**
 * 🔴 UNE SEULE FAÇON DE LIRE L'IP DU VISITEUR.
 *
 * Mesuré en production le 2026-09-25 : derrière Cloudflare → Traefik → Next,
 * `x-forwarded-for` et `x-real-ip` portent l'adresse du RELAIS Cloudflare, et
 * `cf-connecting-ip` — la seule qui désigne le visiteur — est FORGEABLE, parce
 * que l'origine répond aussi en direct. `client-ip-core.ts` est le seul endroit
 * qui sait trancher ; ~30 fichiers lisaient pourtant ces en-têtes eux-mêmes,
 * dont des preuves de signature Qualiopi qui croyaient `cf-connecting-ip` sans
 * condition.
 *
 * Depuis le 2026-09-25, les ~30 fichiers sont migrés : cette garde n'a plus
 * AUCUNE exception. Toute lecture directe hors `client-ip-core.ts` rougit.
 *
 * Plan : `_PLANS/PLAN-IP-CLIENT-UNIFIEE-2026-09-25.md` (hors dépôt).
 *
 * Lu dans le CODE, commentaires retirés : un commentaire qui explique le défaut
 * cite forcément les en-têtes, et ne doit ni accuser ni absoudre.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const RACINE = process.cwd();
const SRC = path.join(RACINE, "src");

/** Le seul fichier autorisé à lire ces en-têtes. */
const SOURCE_DE_VERITE = "src/lib/client-ip-core.ts";

const LECTURE_DIRECTE = /\.get\(\s*["'`](?:cf-connecting-ip|x-forwarded-for|x-real-ip)["'`]\s*\)/i;

function codeSeul(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

function lit(source: string): boolean {
  return LECTURE_DIRECTE.test(codeSeul(source));
}

function fichiers(dir: string): string[] {
  const out: string[] = [];
  for (const entree of readdirSync(dir)) {
    const abs = path.join(dir, entree);
    if (statSync(abs).isDirectory()) {
      if (entree !== "__tests__" && entree !== "node_modules") out.push(...fichiers(abs));
    } else if (/\.(ts|tsx)$/.test(entree) && !/\.(spec|test)\.tsx?$/.test(entree)) {
      out.push(abs);
    }
  }
  return out;
}

const relatif = (abs: string) => path.relative(RACINE, abs).split(path.sep).join("/");
const lecteurs = fichiers(SRC)
  .filter((f) => lit(readFileSync(f, "utf8")))
  .map(relatif);

describe("🔴 l'IP du visiteur ne se lit qu'à un seul endroit", () => {
  it("contre-témoin : le prédicat reconnaît une lecture directe, et ignore sa citation en commentaire", () => {
    expect(lit(`const ip = req.headers.get("cf-connecting-ip") ?? "x";`)).toBe(true);
    expect(lit(`h.get('X-Forwarded-For')?.split(",")[0]`)).toBe(true);
    expect(lit(`// lu en direct : req.headers.get("cf-connecting-ip")`)).toBe(false);
    expect(lit(`/* h.get("x-real-ip") */ const ip = ipDepuisEntetes(h);`)).toBe(false);
  });

  it("témoin : la source de vérité lit bien ces en-têtes (la garde regarde quelque chose)", () => {
    expect(lecteurs).toContain(SOURCE_DE_VERITE);
  });

  it("🔴 aucune lecture directe hors de client-ip-core — aucune exception", () => {
    const fautifs = lecteurs.filter((f) => f !== SOURCE_DE_VERITE);
    expect(
      fautifs,
      "Lire l'IP par `ipDepuisEntetes(req.headers)`, `ipVisiteurOuNull(h)` ou `await getClientIp()` (lib/client-ip).",
    ).toEqual([]);
  });

  it("le cœur reste utilisable en runtime edge : aucun import de Next", () => {
    const core = codeSeul(readFileSync(path.join(RACINE, SOURCE_DE_VERITE), "utf8"));
    expect(core).not.toMatch(/from\s+["']next\//);
  });
});
