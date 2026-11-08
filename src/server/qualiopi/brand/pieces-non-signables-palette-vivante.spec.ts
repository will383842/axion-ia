/**
 * V8-P3 — les PDF NON signables lisent la palette VIVANTE (`COULEURS_MARQUE`),
 * pas la copie gelée de V8-P0 (`QUALIOPI_BRAND_COLORS`, réservée aux pièces signables).
 *
 * Basculés : registre RGPD (+ journal des incidents, qui réutilise ses styles) et plan de production.
 * NON basculés (voir fiches/journaux/V8-P3.md) : cgv-pdf (aucune couleur de marque, hors périmètre argent),
 * contrat-pdf (signable, rendu depuis la signature), support-pdf (cadre partagé base-layout, gelé).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const SENTINELLE = "#123456";

vi.mock("@/lib/brand/couleurs-marque", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@/lib/brand/couleurs-marque")>();
  return { ...reel, COULEURS_MARQUE: { ...reel.COULEURS_MARQUE, fg: "#123456" } };
});

const RACINE = process.cwd();
const lire = (p: string) => readFileSync(join(RACINE, p), "utf8");

describe("PDF non signables : palette vivante", () => {
  it("le registre RGPD suit COULEURS_MARQUE", async () => {
    const { styles } = await import("@/features/conformite-rgpd/registre-pdf");
    expect(styles.page.color).toBe(SENTINELLE);
  });

  it("le plan de production suit COULEURS_MARQUE", async () => {
    const { styles } = await import("@/server/editorial/plan-production-pdf");
    expect(styles.page.color).toBe(SENTINELLE);
  });

  it("aucun des deux n'importe la copie gelée", () => {
    for (const f of [
      "src/features/conformite-rgpd/registre-pdf.tsx",
      "src/server/editorial/plan-production-pdf.tsx",
    ]) {
      const src = lire(f);
      expect(src).not.toMatch(/\bbrandColor\b|QUALIOPI_BRAND_COLORS/);
      expect(src).toMatch(/@\/lib\/brand\/couleurs-marque"/);
      expect(src).not.toMatch(/couleurs-marque-gelees/);
    }
  });

  it("les pièces signables et les archives restent sur le gel (garde-fou)", () => {
    expect(lire("src/server/qualiopi/brand/brand-tokens.ts")).toMatch(
      /QUALIOPI_BRAND_COLORS = COULEURS_MARQUE_GELEES_2026_11/,
    );
  });
});
