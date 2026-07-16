/**
 * Garde-fou — aucun worker BullMQ ne doit importer une Server Action gardée admin.
 *
 * Bug 2026-05-14 → 2026-07-16 : `content-rss-fetch-worker`,
 * `content-similarity-monitor-worker` et `content-quality-improver-worker`
 * importaient `writeContentGenConfig` depuis `@/server/actions/content-gen/_settings`.
 * Cette Server Action est gardée par `requireAdminWriteRateLimited` → `auth()` →
 * `headers()`, qui throw hors requête HTTP. Dans un process worker (aucune requête
 * en cours) : « `headers` was called outside a request scope » → job en échec.
 *
 * Impact réel constaté en prod : content-similarity-monitor 30 échecs / 0 succès
 * (jamais tourné depuis sa création), content-rss-fetch 393 ticks en échec (cache
 * anti-doublon jamais persisté).
 *
 * Le TypeScript ne peut pas détecter ça (la signature est valide) et les tests
 * unitaires non plus (ils moquent le module). D'où ce test statique.
 *
 * Les workers doivent écrire via `@/server/content-gen/config-store`
 * (`persistContentGenConfig`), module serveur nu sans guard admin.
 *
 * `readContentGenConfig` reste autorisé : il est volontairement non-guardé
 * (cf. l'en-tête de `_settings.ts`).
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const WORKERS_DIR = join(process.cwd(), "src/server/queue/workers");

/** Exports de `_settings` qui exigent une session admin → interdits en worker. */
const GUARDED_EXPORTS = ["writeContentGenConfig", "listContentGenConfig"] as const;

function workerFiles(): ReadonlyArray<string> {
  return readdirSync(WORKERS_DIR).filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"));
}

describe("workers BullMQ — pas de Server Action gardée admin", () => {
  it("liste les workers (sanity : le glob ne doit pas être vide)", () => {
    expect(workerFiles().length).toBeGreaterThan(0);
  });

  it.each(workerFiles())("%s n'importe aucun export gardé de _settings", (file) => {
    const source = readFileSync(join(WORKERS_DIR, file), "utf8");
    if (!source.includes("actions/content-gen/_settings")) return;

    for (const guarded of GUARDED_EXPORTS) {
      expect(
        source.includes(guarded),
        `${file} importe/appelle \`${guarded}\` (Server Action gardée admin → \`headers()\` ` +
          `throw hors requête HTTP). Utiliser \`persistContentGenConfig\` ` +
          `depuis @/server/content-gen/config-store.`,
      ).toBe(false);
    }
  });
});

describe("config-store — module serveur nu", () => {
  it('ne porte pas la directive "use server" (sinon endpoint public sans auth)', () => {
    const source = readFileSync(
      join(process.cwd(), "src/server/content-gen/config-store.ts"),
      "utf8",
    );
    // On teste la DIRECTIVE (une instruction à elle seule), pas la sous-chaîne :
    // l'en-tête du module mentionne "use server" pour expliquer pourquoi il ne
    // faut pas l'ajouter.
    const isDirective = (line: string) => /^["']use server["'];?$/.test(line.trim());
    expect(source.split("\n").some(isDirective)).toBe(false);
  });
});
