/**
 * @vitest-environment node
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const PAGE = "src/app/[locale]/equipe/questionnaire/[jeton]/page.tsx";
const FICHIERS_TEXTE = [
  PAGE,
  "src/components/equipe/questionnaire/ChampsQuestionnaire.tsx",
  "src/components/equipe/questionnaire/FormulaireQuestionnaire.tsx",
];

describe("page privée du questionnaire", () => {
  it("n'est jamais indexée ni suivie, et ne laisse pas fuir le jeton dans le Referer", () => {
    const src = lire(PAGE);
    expect(src).toMatch(/robots:\s*\{\s*index:\s*false,\s*follow:\s*false/);
    expect(src).toMatch(/referrer:\s*"no-referrer"/);
    expect(src).toMatch(/dynamic\s*=\s*"force-dynamic"/);
  });
  it("n'est ni dans le sitemap ni liée depuis le site", () => {
    expect(lire("src/app/sitemap.ts")).not.toMatch(/equipe\/questionnaire/);
    expect(lire("src/lib/equipe/donnees/categories.ts")).toMatch(/"questionnaire"/); // slug réservé
  });
  it("ne mentionne ni « interne » ni « externe », ni prix, commission ou Grenoble", () => {
    for (const f of FICHIERS_TEXTE) {
      expect(lire(f), f).not.toMatch(/\b(interne|externe|commission|grenoble|€)\b/i);
    }
  });
  it("les trois accords et l'attestation sont des cases séparées, non cochées d'avance", () => {
    const src = lire("src/components/equipe/questionnaire/ChampsQuestionnaire.tsx");
    for (const nom of ["consent_publication", "consent_photo", "consent_linkedin", "attestation"]) {
      expect(src).toContain(`name="${nom}"`);
    }
    expect(src).not.toMatch(/defaultChecked|checked=/);
  });
  it("Turnstile est chargé à la demande (hors du JavaScript initial)", () => {
    expect(lire("src/components/equipe/questionnaire/FormulaireQuestionnaire.tsx")).toMatch(
      /dynamic\(\s*\(\) =>\s*import\("@\/components\/forms\/TurnstileWidget"\)/,
    );
  });
});
