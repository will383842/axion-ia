// @vitest-environment node

/**
 * V2-10 PR-4 — l'ancien formulaire de l'Observatoire est fermé : 301 vers le Score
 * (`/fr/diagnostic#observatoire`), sans supprimer ni la page ni les données.
 * Plan : geo/PLAN-V2-10-SCORE-IA-PME.md, section PR-4.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = path.resolve(__dirname, "../../..");
const lire = (p: string) => readFileSync(path.join(RACINE, p), "utf8");

const CIBLE = "/fr/diagnostic#observatoire";

describe("/observatoire-ia/participer → Score (301)", () => {
  const config = lire("next.config.ts");

  it.each(["/:locale(fr|en)/observatoire-ia/participer", "/observatoire-ia/participer"])(
    "la source %s est redirigée en 301 vers la cible FR",
    (source) => {
      const i = config.indexOf(`source: "${source}"`);
      expect(i, `source ${source} absente de next.config.ts`).toBeGreaterThan(-1);
      const bloc = config.slice(i, i + 200);
      expect(bloc).toContain(`destination: "${CIBLE}"`);
      expect(bloc).toContain("statusCode: 301");
    },
  );

  it("aucune redirection de /diagnostic lui-même (le Score y est servi : ce serait une boucle)", () => {
    expect(config).not.toMatch(/source:\s*"[^"]*\/diagnostic"/);
  });

  it("la page et le formulaire restent dans le dépôt (aucune suppression)", () => {
    expect(() => lire("src/app/[locale]/observatoire-ia/participer/page.tsx")).not.toThrow();
    expect(() => lire("src/components/observatoire/BarometerForm.tsx")).not.toThrow();
    expect(() => lire("src/server/actions/observatoire/public.ts")).not.toThrow();
  });

  it("l'URL n'est plus annoncée dans le sitemap", () => {
    const sitemap = lire("src/app/sitemap.ts");
    const debut = sitemap.indexOf("const EXCLUDED_FROM_INDEX");
    const fin = sitemap.indexOf("];", debut);
    expect(sitemap.slice(debut, fin)).toContain('"/observatoire-ia/participer"');
  });

  it("les liens internes « Participer » de la page Observatoire mènent au Score", () => {
    const page = lire("src/app/[locale]/observatoire-ia/page.tsx");
    expect(page).not.toContain('href="/observatoire-ia/participer"');
    expect(page).toContain('href="/diagnostic"');
  });
});
