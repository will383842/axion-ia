/**
 * SEC-1c — le préfixe de la console n'a pas de repli en production, et sa valeur réelle n'est
 * écrite nulle part dans le code, les tests ou les workflows.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const RACINE = process.cwd();

function fichiers(dossier: string, out: string[] = []): string[] {
  for (const nom of readdirSync(dossier)) {
    if (nom === "node_modules" || nom === ".next" || nom === "generated") continue;
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) fichiers(chemin, out);
    else if (/\.(ts|tsx|js|mjs|json|ya?ml|md)$/.test(nom)) out.push(chemin);
  }
  return out;
}

describe("aucun repli de préfixe en production", () => {
  it('aucun `ADMIN_URL_PREFIX ?? "admin-dev-…"` dans src/ (hors les deux fichiers nommés)', () => {
    // Deux lecteurs hors périmètre de SEC-1c (csp.ts est « à ne pas toucher », le gabarit
    // d'e-mail est un lien) gardent encore le repli : signalés dans la PR, pas corrigés ici.
    const hors = new Set(["src/lib/csp.ts", "src/lib/email/templates/qualiopi-alerte-interne.tsx"]);
    const motif = /ADMIN_URL_PREFIX["']?\]?\s*\?\?\s*(?:DEV_FALLBACK|["']admin-dev)/;
    const fautifs = fichiers(join(RACINE, "src"))
      .map((f) => relative(RACINE, f))
      .filter((f) => !hors.has(f) && !f.endsWith(".spec.ts") && !f.endsWith(".spec.tsx"))
      .filter((f) => motif.test(readFileSync(join(RACINE, f), "utf8")));
    expect(fautifs).toEqual([]);
  });

  it("le lecteur unique existe et n'importe rien (compatible Edge)", () => {
    const src = readFileSync(join(RACINE, "src/lib/prefixe-admin.ts"), "utf8");
    expect(src).not.toMatch(/^\s*import\s/m);
  });

  it("aucune valeur de préfixe réelle (`admin-` + 10 caractères ou plus contenant un chiffre) dans src/, .github/, tests/", () => {
    const permis = new Set(["admin-dev-x7k2n9", "admin-ci-build"]);
    const motif = /(?<![\w-])admin-(?=[a-z0-9]*\d)[a-z0-9]{10,}(?![\w-])/g;
    const trouves: string[] = [];
    for (const dossier of ["src", ".github", "tests"]) {
      for (const f of fichiers(join(RACINE, dossier))) {
        for (const m of readFileSync(f, "utf8").matchAll(motif)) {
          if (!permis.has(m[0])) trouves.push(relative(RACINE, f));
        }
      }
    }
    expect(trouves).toEqual([]);
  });
});

describe("auth.config `authorized`, production sans variable", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("l'ancienne adresse de repli n'est pas traitée comme console", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env["ADMIN_URL_PREFIX"];
    const { authConfig } = await import("@/auth.config");
    const authorized = authConfig.callbacks.authorized as unknown as (a: unknown) => unknown;
    const reponse = authorized({
      auth: null,
      request: {
        nextUrl: new URL("https://exemple.invalid/fr/admin-dev-x7k2n9/x"),
        headers: new Headers(),
      },
    });
    // Hors console : « laisse passer » (true), sans redirection vers une page de connexion.
    expect(reponse).toBe(true);
  });
});
