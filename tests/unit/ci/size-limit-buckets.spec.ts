/**
 * Buckets `size-limit` de `package.json` — verrou anti-glob mort.
 *
 * POURQUOI CE FICHIER EXISTE. La page `/reserver` a été supprimée le 2026-06-26
 * (décision Will, tracée dans `next.config.ts`). Ses trois globs `size-limit`,
 * eux, sont restés. Pendant six semaines, le gate a donc mesuré **du vide** en
 * restant vert : `size-limit` ne considère pas un glob sans correspondance comme
 * une erreur. Pire, l'exception de budget d'AGENTS.md (110 KB gz) désignait une
 * route morte, et `/appel` — la vraie page à iframe Calendly — tombait dans le
 * bucket « Pages standard » à 75 KB.
 *
 * Un gate qui ne rougit jamais ne vaut rien : c'est le diagnostic n°1 de l'audit
 * GEO/AEO E2E du 2026-08-14 (GEO-025). Ce fichier vérifie donc que chaque route
 * nommée dans un glob correspond encore à une route du site.
 *
 * ⚠️ Ce test ne peut pas vérifier que le glob matche des fichiers réels : les
 * chunks n'existent qu'après un build. Il vérifie l'invariant qu'on peut établir
 * sans build — le segment de route nommé existe toujours — et c'est exactement
 * celui qui a cassé.
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const RACINE = process.cwd();

function lire(relatif: string): string {
  return readFileSync(path.join(RACINE, ...relatif.split("/")), "utf8");
}

type BucketSizeLimit = { name?: string; path?: string | string[]; limit?: string };

const PACKAGE = JSON.parse(lire("package.json")) as {
  "size-limit"?: BucketSizeLimit[];
};
const BUCKETS = PACKAGE["size-limit"] ?? [];

/**
 * Segments de route connus du site : répertoires de l'App Router **et** segments
 * déclarés dans les `pathnames` de next-intl (les alias EN comme `gallery` ou
 * `locations` n'ont pas de répertoire propre, ils sont réécrits au runtime).
 */
function segmentsConnus(): Set<string> {
  const connus = new Set<string>();

  for (const entree of readdirSync(path.join(RACINE, "src", "app", "[locale]"), {
    withFileTypes: true,
  })) {
    if (entree.isDirectory()) connus.add(entree.name);
  }

  const routing = lire("src/i18n/routing.ts");
  for (const litteral of routing.matchAll(/"(\/[^"]*)"/g)) {
    for (const segment of litteral[1].split("/")) {
      if (segment && !segment.startsWith("[")) connus.add(segment);
    }
  }

  return connus;
}

/** Segments de route nommés dans les globs `.next/static/chunks/app/**\/<segment>/`. */
function segmentsCites(): { bucket: string; segment: string }[] {
  const cites: { bucket: string; segment: string }[] = [];
  for (const bucket of BUCKETS) {
    const globs = Array.isArray(bucket.path) ? bucket.path : bucket.path ? [bucket.path] : [];
    for (const glob of globs) {
      for (const trouve of glob.matchAll(/chunks\/app\/\*\*\/([A-Za-z0-9._-]+)\//g)) {
        cites.push({ bucket: bucket.name ?? "(sans nom)", segment: trouve[1] });
      }
    }
  }
  return cites;
}

describe("package.json — buckets size-limit", () => {
  it("déclare au moins un bucket", () => {
    expect(BUCKETS.length).toBeGreaterThan(0);
  });

  it("ne nomme aucune route qui n'existe plus", () => {
    const connus = segmentsConnus();
    const morts = segmentsCites().filter(({ segment }) => !connus.has(segment));

    expect(
      morts,
      `Glob(s) size-limit pointant une route inexistante : ${morts
        .map(({ bucket, segment }) => `« ${bucket} » → /${segment}`)
        .join(
          ", ",
        )}. size-limit reste VERT sur un glob sans correspondance : le bucket ne mesure plus rien.`,
    ).toEqual([]);
  });

  it("donne un support technique à l'exception de budget d'AGENTS.md", () => {
    // AGENTS.md accorde 110 KB gz à une route et une seule. Si la doctrine et la
    // configuration divergent, l'exception n'est qu'une phrase : la route
    // exceptée est mesurée au seuil standard, et personne ne le voit.
    const agents = lire("AGENTS.md");
    const exception = /Exception\s*:\s*`(\/[a-z0-9-]+)`/.exec(agents);
    expect(exception, "Exception de budget introuvable dans AGENTS.md").not.toBeNull();

    const route = exception![1]; // ex. « /appel »
    const bucket = BUCKETS.find((b) => (b.name ?? "").includes(route));
    expect(
      bucket,
      `Aucun bucket size-limit ne couvre la route exceptée ${route} déclarée par AGENTS.md.`,
    ).toBeDefined();
    expect(bucket!.limit).toBe("110 KB");

    const globs = Array.isArray(bucket!.path) ? bucket!.path : [bucket!.path];
    expect(globs.some((g) => (g ?? "").includes(`/${route.slice(1)}/`))).toBe(true);
  });

  it("garde `running: false` sur chaque bucket (sinon Chrome headless SIGTERM le Gate B)", () => {
    for (const bucket of BUCKETS) {
      expect(
        (bucket as { running?: boolean }).running,
        `Bucket « ${bucket.name} » sans running:false`,
      ).toBe(false);
    }
  });
});
