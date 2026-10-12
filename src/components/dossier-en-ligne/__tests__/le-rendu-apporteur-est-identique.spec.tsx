// FAC-10 — Les composants du dossier en ligne sortent dans `components/dossier-en-ligne/`
// (textes passés en paramètre). Les écrans apporteurs rendent EXACTEMENT le même HTML :
// les rendus de référence ont été figés sur `main` avant l'extraction.
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/apporteur/dossier/[id]/[jeton]/actions", () => ({ deposerPieceAction: vi.fn() }));
vi.mock("@/app/apporteur/dossier/retrouver/actions", () => ({ demanderLienEspace: vi.fn() }));

import REFERENCE from "./rendus-apporteur-reference.json";
import { rendus } from "./_rendus";

// Le rendu de `DepotPiece` porte la date du jour (`max` du champ « Date de délivrance ») :
// l'horloge est figée à la date des références, sinon le test rougit à minuit UTC.
// Seul `Date` est simulé (pas les minuteries), et l'horloge est restaurée aussitôt.
const JOUR_DES_REFERENCES = new Date("2026-10-11T12:00:00Z");

function rendusALaDateDesReferences() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(JOUR_DES_REFERENCES);
  try {
    return rendus();
  } finally {
    vi.useRealTimers();
  }
}

describe("rendu apporteur identique, octet pour octet", () => {
  const actuels = rendusALaDateDesReferences();
  it("les mêmes cas sont figés", () => {
    expect(Object.keys(actuels).sort()).toEqual(Object.keys(REFERENCE).sort());
  });
  it.each(Object.keys(REFERENCE))("%s", (cas) => {
    expect(actuels[cas]).toBe((REFERENCE as Record<string, string>)[cas]);
  });
});
