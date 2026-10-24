import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Le job de nuit « Chaîne Qualiopi complète » lance ses scripts avec
 * `SKIP_ENV_VALIDATION=true` et sans `NEXT_PUBLIC_SITE_URL`. Dans ce mode,
 * t3-env n'applique pas le `.default(...)` : `env.NEXT_PUBLIC_SITE_URL` vaut
 * `undefined`, et `site-url.ts` cassait au chargement d'un gabarit d'e-mail
 * (`Cannot read properties of undefined (reading 'replace')`).
 *
 * On lance un VRAI sous-processus : la valeur de l'environnement est lue au
 * chargement du module, un import dans le processus de test ne la rejouerait pas.
 */
const RACINE = resolve(__dirname, "../../..");
const TSX = resolve(RACINE, "node_modules/.bin/tsx");

function lancer(code: string, envSup: Record<string, string>) {
  const env: NodeJS.ProcessEnv = { ...process.env, ...envSup };
  delete env.NEXT_PUBLIC_SITE_URL;
  return spawnSync(
    TSX,
    [
      "--eval",
      `(async () => { ${code} })().catch((e) => { console.error(String(e && e.stack || e)); process.exit(1); });`,
    ],
    { cwd: RACINE, env, encoding: "utf8", timeout: 120_000 },
  );
}

describe("SITE_URL sans validation d'environnement", () => {
  it("le gabarit apporteur-demarrage se charge avec SKIP_ENV_VALIDATION=true et sans NEXT_PUBLIC_SITE_URL", () => {
    const r = lancer(
      `const m = await import("./src/lib/email/templates/apporteur-demarrage.tsx");
       if (typeof m.ApporteurContratSigneEmail !== "function") throw new Error("gabarit absent");
       console.log("OK");`,
      { SKIP_ENV_VALIDATION: "true", NODE_ENV: "test" },
    );
    expect(r.stderr).not.toContain("reading 'replace'");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("OK");
  });

  it("SITE_URL retombe sur http://localhost:3000 hors production", () => {
    const r = lancer(
      `const { SITE_URL } = await import("./src/lib/site-url.ts"); console.log("URL=" + SITE_URL);`,
      { SKIP_ENV_VALIDATION: "true", NODE_ENV: "test" },
    );
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("URL=http://localhost:3000");
  });

  it("le filet de production tient : sans adresse en production, l'échec reste explicite", () => {
    const r = lancer(
      `const { SITE_URL } = await import("./src/lib/site-url.ts"); console.log("URL=" + SITE_URL);`,
      { SKIP_ENV_VALIDATION: "true", NODE_ENV: "production" },
    );
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/NEXT_PUBLIC_SITE_URL/);
  });

  it("site-url.ts reste un module feuille : aucun import vers src/lib/email (pas de cycle)", () => {
    const src = readFileSync(resolve(RACINE, "src/lib/site-url.ts"), "utf8");
    const imports = [...src.matchAll(/^import .*?from "([^"]+)"/gm)].map((m) => m[1]);
    expect(imports).toEqual(["@/env"]);
  });
});
