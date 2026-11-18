import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  TYPES_GENERATEURS_ANNEXES_VILLE,
  generateurAnnexeVilleGele,
} from "../generateurs-annexes-geles";
import { PHASE_DEFINITIONS, contentTypesActifs } from "../phased-coverage";

const QUATRE = [
  "landing-ville-cas-usage",
  "landing-ville-ecosystem",
  "landing-ville-faq-extended",
  "landing-ville-secteurs",
];

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("générateurs annexes ville : gelés par défaut", () => {
  it("la liste contient exactement les 4 types", () => {
    expect([...TYPES_GENERATEURS_ANNEXES_VILLE].sort()).toEqual(QUATRE);
  });

  it("sans variable, les 4 types sont gelés", () => {
    vi.stubEnv("VILLES_GENERATEURS_ANNEXES_ACTIFS", "");
    for (const t of QUATRE) expect(generateurAnnexeVilleGele(t)).toBe(true);
  });

  it("une valeur autre que 'true' reste gelée", () => {
    for (const v of ["false", "1", "TRUE", "oui"]) {
      vi.stubEnv("VILLES_GENERATEURS_ANNEXES_ACTIFS", v);
      expect(generateurAnnexeVilleGele("landing-ville-cas-usage")).toBe(true);
    }
  });

  it("avec VILLES_GENERATEURS_ANNEXES_ACTIFS=true, ce gel est levé (le refus de #1643, s'il est fusionné, reste)", () => {
    vi.stubEnv("VILLES_GENERATEURS_ANNEXES_ACTIFS", "true");
    for (const t of QUATRE) expect(generateurAnnexeVilleGele(t)).toBe(false);
  });

  it("economic-data, ville-hub-copy et les autres types ne sont JAMAIS gelés", () => {
    for (const v of ["", "true"]) {
      vi.stubEnv("VILLES_GENERATEURS_ANNEXES_ACTIFS", v);
      for (const t of ["landing-ville-economic-data", "ville-hub-copy", "guide_pilier"]) {
        expect(generateurAnnexeVilleGele(t)).toBe(false);
      }
    }
  });
});

describe("planification par phase", () => {
  const phase1 = PHASE_DEFINITIONS.find((p) => p.phase === "PHASE_1_HUB")!;

  it("par défaut, la phase 1 ne planifie ni les 4 annexes ni rien d'autre à geler", () => {
    vi.stubEnv("VILLES_GENERATEURS_ANNEXES_ACTIFS", "");
    expect(contentTypesActifs(phase1)).toEqual(["ville-hub-copy", "landing-ville-economic-data"]);
  });

  it("avec la variable à true, les 6 types sont planifiés comme avant", () => {
    vi.stubEnv("VILLES_GENERATEURS_ANNEXES_ACTIFS", "true");
    expect(contentTypesActifs(phase1)).toEqual(phase1.contentTypes);
  });
});

describe("script regen-villes-stratified", () => {
  const src = readFileSync(
    join(__dirname, "../../../../../scripts/regen-villes-stratified.ts"),
    "utf8",
  );

  it("sort proprement (exit 0) sur l'interrupteur avant d'ouvrir la base", () => {
    const main = src.slice(src.indexOf("async function main"));
    expect(main.indexOf("generateurAnnexeVilleGele(")).toBeGreaterThan(-1);
    expect(main.indexOf("process.exit(0)")).toBeGreaterThan(-1);
    expect(main.indexOf("generateurAnnexeVilleGele(")).toBeLessThan(
      main.indexOf("new PrismaClient()"),
    );
  });
  // La variable ne lève que CE gel : la PR #1643, si fusionnée, refuse en plus
  // tout run payant tant que les résultats ne sont pas sauvegardés.
});
