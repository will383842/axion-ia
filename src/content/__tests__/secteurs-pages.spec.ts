/**
 * Phase 3 SEO secteurs (2026-06-21) — contrat des pages /secteurs.
 *
 * Garde ANTI-DOORWAY (HCU 2024) : les 50 pages croisées
 * /secteurs/[secteur]/[activite] ne doivent JAMAIS être des pages « gabarit »
 * thin. Chacune rend un combo pain-matrix UNIQUE (hand-authored). Ce test
 * garantit que les 50 combos existent → aucune page croisée ne tombe sur le
 * filet noindex (cf. resolve() dans [activite]/page.tsx). Si un combo venait à
 * manquer (suppression pain-matrix), ce test pète AVANT la mise en ligne.
 */

import { describe, it, expect } from "vitest";
import { CLIENT_SECTORS } from "@/content/sectors";
import { SERVICE_DEFS } from "@/content/knowledge/services";
import {
  getSectorPainContext,
  type Secteur,
  type Verticale,
} from "@/server/content-gen/kb/sector-pain-matrix";

const VALID_VERTICALES: readonly Verticale[] = [
  "audits",
  "interventions_formations",
  "implementations",
  "un_a_un",
  "sites_web_augmentes",
];

describe("Phase 3 — pages /secteurs", () => {
  it("10 secteurs × 5 activités = 50 pages croisées indexables (contenu pain unique)", () => {
    expect(CLIENT_SECTORS.length).toBe(10);
    expect(SERVICE_DEFS.length).toBe(5);
    let combos = 0;
    for (const sector of CLIENT_SECTORS) {
      for (const svc of SERVICE_DEFS) {
        const verticale = svc.verticales[0] as Verticale;
        const pain = getSectorPainContext(sector.slug as Secteur, verticale);
        // Anti-doorway : chaque page croisée DOIT avoir un combo (sinon noindex).
        expect(pain, `combo manquant : ${sector.slug} × ${svc.slug}`).toBeDefined();
        // Profondeur minimale du contenu rendu (douleur + bénéfice + lexique).
        expect(pain!.painStatement.length).toBeGreaterThan(20);
        expect(pain!.benefitMeasured.length).toBeGreaterThan(20);
        expect(pain!.sectorLexicon.length).toBeGreaterThanOrEqual(5);
        combos++;
      }
    }
    expect(combos).toBe(50);
  });

  it("chaque activité mappe vers une verticale valide de la pain-matrix", () => {
    for (const svc of SERVICE_DEFS) {
      expect(svc.verticales.length).toBeGreaterThan(0);
      expect(VALID_VERTICALES).toContain(svc.verticales[0] as Verticale);
    }
  });

  it("slugs de secteur uniques + slugs d'activité uniques (URLs déterministes)", () => {
    const sectorSlugs = CLIENT_SECTORS.map((s) => s.slug);
    const serviceSlugs = SERVICE_DEFS.map((s) => s.slug);
    expect(new Set(sectorSlugs).size).toBe(sectorSlugs.length);
    expect(new Set(serviceSlugs).size).toBe(serviceSlugs.length);
  });
});
