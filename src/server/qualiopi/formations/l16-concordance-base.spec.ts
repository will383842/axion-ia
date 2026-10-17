/**
 * Lot L16 — moitié « base » de la concordance du site (voir
 * `src/content/formations/__tests__/l16-concordance-du-site.spec.ts` pour la moitié
 * publique). Ce qui s'écrit en base par l'import doit dire la même chose que les
 * fiches : modalité « présentiel ou distanciel » et mêmes moyens à distance.
 */
import { describe, expect, it } from "vitest";

import { FORMATIONS_V2 } from "../../../content/formations/catalog-v2";
import { ASSISTANCE_DISTANCE } from "../legal/assistance-distance";
import { buildFormationImportData } from "./catalog-import";

describe("L16 — ce que l'import écrit en base", () => {
  it("chaque formation est écrite « hybride » (présentiel ou distanciel), jamais « presentiel » en dur", () => {
    // Le séminaire reste en présentiel (modalité d'origine, décision de Will en attente).
    for (const f of FORMATIONS_V2.filter((x) => x.seminaire !== true)) {
      expect(buildFormationImportData(f, "offre-x").modalite, f.slugFr).toBe("hybride");
    }
    for (const f of FORMATIONS_V2.filter((x) => x.seminaire === true)) {
      const d = buildFormationImportData(f, "offre-x");
      expect(d.modalite, f.slugFr).toBe("presentiel");
      expect(d.moyensTechniques, f.slugFr).not.toMatch(/distanciel|Zoom/i);
    }
  });

  it("les moyens techniques imprimés au programme disent la même visio que la fiche", () => {
    const { moyensTechniques } = buildFormationImportData(FORMATIONS_V2[0]!, "offre-x");
    expect(moyensTechniques).toContain("Zoom");
    for (const phrase of ["un ordinateur avec caméra et micro", "une connexion internet stable"]) {
      expect(moyensTechniques, phrase).toContain(phrase);
    }
  });

  it("l'assistance à distance imprimée est celle de la convocation", () => {
    expect(ASSISTANCE_DISTANCE.length).toBeGreaterThanOrEqual(3);
    const { moyensTechniques } = buildFormationImportData(FORMATIONS_V2[0]!, "offre-x");
    expect(moyensTechniques).toContain(ASSISTANCE_DISTANCE[0]!);
    expect(moyensTechniques).toContain(ASSISTANCE_DISTANCE[1]!);
  });
});
