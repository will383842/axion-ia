/**
 * Garde — aucune variable d'environnement ne doit se replier en silence sur
 * NOTRE origine de production.
 *
 * ## Le défaut, mesuré le 2026-08-23 (PR #788)
 *
 * Trois modules lisaient `process.env["NEXT_PUBLIC_APP_URL"] ?? "https://axion-ia.com"`
 * — dont `features/payment/actions.ts`, qui construit les redirections Stripe.
 * Or `NEXT_PUBLIC_APP_URL` n'était déclarée **nulle part** : ni dans les trois
 * `.env*.example`, ni dans `ci.yml`, ni dans le schéma `env.ts`.
 *
 * Un repli sur une variable que personne ne déclare n'est pas un filet : c'est
 * **la valeur effective**, toujours. Le lien d'accès envoyé au stagiaire pointait
 * donc `https://axion-ia.com` quel que soit l'environnement. Correct en
 * production, faux partout ailleurs — et le parcours E2E du portail mesurait la
 * PRODUCTION au lieu du serveur qu'il venait de construire. C'est le pire des
 * faux verts : il passe précisément quand le produit livré est cassé.
 *
 * `main` a corrigé la cause en supprimant le doublon (tout passe par `SITE_URL`,
 * déclarée et validée). Restait la récidive : rien n'empêchait qu'on réintroduise
 * demain la même construction sous un autre nom.
 *
 * ## Ce que cette garde interdit — et ce qu'elle N'interdit PAS
 *
 * Interdit : un repli **codé en dur vers notre propre domaine** sur une variable
 * **déclarée nulle part**.
 *
 * PAS interdit : un repli vers notre domaine sur une variable DÉCLARÉE
 * (`NEXT_PUBLIC_SITE_URL`, `SITE_URL` — ~110 occurrences légitimes ; là le repli
 * est un vrai filet). PAS interdit non plus : un repli vers une URL TIERCE
 * (`COMPANY_LINKEDIN` → linkedin.com, `NOMINATIM_BASE_URL` → nominatim.org) :
 * pointer un service externe par défaut ne fait pas sortir du serveur sous test.
 *
 * Le périmètre est délibérément étroit. Une garde plus large — « toute variable
 * avec un repli doit être déclarée » — compterait **17 violations** aujourd'hui
 * (seuils, chemins, noms de modèles aux défauts légitimes) et naîtrait rouge :
 * un cliquet posé sur un seuil déjà dépassé n'est pas un garde-fou, c'est un
 * rouge permanent que personne ne peut fermer.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { sansCommentaires } from "@/server/qualiopi/revues/sans-commentaires";

const RACINE = process.cwd();

/** Notre propre domaine — celui dont un repli fait sortir du serveur sous test. */
const NOTRE_DOMAINE = /https?:\/\/(www\.)?axion-ia\.com/;

/**
 * `process.env.X ?? "http…"` ou `process.env["X"] ?? "http…"`.
 * Capture le nom de la variable et l'URL de repli.
 */
const LECTURE_AVEC_REPLI_URL =
  /process\.env(?:\.([A-Z][A-Z0-9_]+)|\["([A-Z][A-Z0-9_]+)"\])\s*(?:\?\?|\|\|)\s*"(https?:\/\/[^"]*)"/g;

/** Endroits où une variable peut légitimement être DÉCLARÉE. */
const SOURCES_DE_DECLARATION = [
  ".env.example",
  ".env.ci.example",
  ".env.dev.example",
  ".github/workflows/ci.yml",
  "src/env.ts",
];

/** Tous les `.ts`/`.tsx` sous `src/`, hors dossiers générés et hors tests. */
function fichiersSource(): string[] {
  const ignores = new Set(["node_modules", ".next", "generated"]);
  const trouves: string[] = [];
  const parcourir = (relatif: string) => {
    for (const entree of readdirSync(path.join(RACINE, relatif), { withFileTypes: true })) {
      if (ignores.has(entree.name)) continue;
      const enfant = `${relatif}/${entree.name}`;
      if (entree.isDirectory()) parcourir(enfant);
      else if (/\.tsx?$/.test(entree.name) && !/\.(spec|test)\.tsx?$/.test(entree.name)) {
        trouves.push(enfant);
      }
    }
  };
  parcourir("src");
  return trouves;
}

function corpusDesDeclarations(): string {
  return SOURCES_DE_DECLARATION.filter((s) => existsSync(path.join(RACINE, s)))
    .map((s) => readFileSync(path.join(RACINE, s), "utf8"))
    .join("\n");
}

interface Repli {
  variable: string;
  url: string;
  fichier: string;
}

function repliVersNotreDomaine(): Repli[] {
  const trouves: Repli[] = [];
  for (const fichier of fichiersSource()) {
    // Sans quoi le test se trouverait lui-même dans les commentaires qui
    // racontent le défaut : `portail/acces/[token]/route.ts` en cite la ligne
    // exacte, au passé. Ce dépôt a déjà payé ce piège.
    const source = sansCommentaires(readFileSync(path.join(RACINE, fichier), "utf8"));
    for (const m of source.matchAll(LECTURE_AVEC_REPLI_URL)) {
      const url = m[3] as string;
      if (!NOTRE_DOMAINE.test(url)) continue;
      trouves.push({ variable: (m[1] ?? m[2]) as string, url, fichier });
    }
  }
  return trouves;
}

describe("Origine de production jamais utilisée comme repli silencieux", () => {
  it("l'instrument trouve bien les replis existants — sinon il ne garde rien", () => {
    // TÉMOIN. `NEXT_PUBLIC_SITE_URL` se replie légitimement sur notre domaine à
    // de nombreux endroits. Si ce compte tombe à zéro, c'est que le motif ou le
    // parcours a cessé de mesurer — et les assertions suivantes passeraient sur
    // du vide, en silence.
    const tous = repliVersNotreDomaine();
    expect(
      tous.length,
      "aucun repli vers notre domaine n'est détecté : l'instrument ne mesure plus rien",
    ).toBeGreaterThan(0);
  });

  it("le motif reconnaît la construction historique — la garde sait donc rougir", () => {
    // TÉMOIN NÉGATIF, sur une reconstruction de la ligne exacte de #788. Si le
    // motif cesse un jour de la reconnaître, la garde deviendrait muette sans
    // qu'aucun test n'échoue.
    const ligneHistorique =
      'const base = process.env["NEXT_PUBLIC_APP_URL"] ?? "https://axion-ia.com";';
    const trouve = [...ligneHistorique.matchAll(LECTURE_AVEC_REPLI_URL)];
    expect(trouve, "le motif ne reconnaît plus la construction qu'il doit interdire").toHaveLength(
      1,
    );
    expect(trouve[0]?.[2]).toBe("NEXT_PUBLIC_APP_URL");
    expect(NOTRE_DOMAINE.test(trouve[0]?.[3] as string)).toBe(true);
  });

  it("toute variable qui se replie sur notre domaine est DÉCLARÉE quelque part", () => {
    const declarations = corpusDesDeclarations();
    expect(
      declarations.length,
      "aucune source de déclaration lue — le test passerait à vide",
    ).toBeGreaterThan(1000);

    const orphelines = repliVersNotreDomaine().filter((r) => !declarations.includes(r.variable));
    const detail = orphelines.map((r) => `  ${r.variable} → "${r.url}"  (${r.fichier})`).join("\n");

    expect(
      orphelines,
      "Une variable qui se replie sur notre origine de production SANS être " +
        "déclarée nulle part n'a pas de filet : le repli EST sa valeur, partout " +
        "hors production. C'est ainsi que le parcours E2E du portail s'est mis à " +
        "mesurer la production au lieu du serveur sous test (#788).\n" +
        "Déclarer la variable dans l'un de " +
        SOURCES_DE_DECLARATION.join(", ") +
        ", ou mieux : passer par `SITE_URL` (@/lib/site-url), l'origine canonique " +
        "déjà validée par le schéma.\n" +
        detail,
    ).toEqual([]);
  });
});
