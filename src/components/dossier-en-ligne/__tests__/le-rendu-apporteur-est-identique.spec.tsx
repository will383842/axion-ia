// FAC-10 — Les composants du dossier en ligne sortent dans `components/dossier-en-ligne/`
// (textes passés en paramètre). Les écrans apporteurs rendent EXACTEMENT le même HTML :
// les rendus de référence ont été figés sur `main` avant l'extraction.
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/apporteur/dossier/[id]/[jeton]/actions", () => ({ deposerPieceAction: vi.fn() }));
vi.mock("@/app/apporteur/dossier/retrouver/actions", () => ({ demanderLienEspace: vi.fn() }));

import REFERENCE from "./rendus-apporteur-reference.json";
import { rendus } from "./_rendus";

// Les rendus de référence portent la date du jour du gel (`max` de la date de
// délivrance) : l'horloge est figée à ce jour, sinon le test rougit chaque minuit.
const JOUR_DU_GEL = new Date("2026-10-11T12:00:00Z");

describe("rendu apporteur identique, octet pour octet", () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(JOUR_DU_GEL);
  const actuels = rendus();
  vi.useRealTimers();
  it("les mêmes cas sont figés", () => {
    expect(Object.keys(actuels).sort()).toEqual(Object.keys(REFERENCE).sort());
  });
  it.each(Object.keys(REFERENCE))("%s", (cas) => {
    expect(actuels[cas]).toBe((REFERENCE as Record<string, string>)[cas]);
  });
});
