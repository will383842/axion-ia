/**
 * Lot L7a — un organisme qui REFUSE le mandat d'autofacturation à la signature
 * du contrat-cadre v3 (article 13.4) n'est jamais lu comme mandant.
 *
 * Sans ce refus lu, la règle de version (v3 ≥ 2) dériverait un mandat de son
 * contrat, et Axion émettrait des autofactures en son nom malgré son refus.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { documentGenere: { findMany: (...a: unknown[]) => mockFindMany(...a) } },
}));

import { resoudreMandat } from "./mandat-source";

const TRAINER = "33333333-3333-4333-8333-333333333333";
const SIGNE_LE = new Date("2026-10-12T09:00:00.000Z");
const SAISIE = { mandatAutofacturationSigneAt: null, mandatAutofacturationRevoqueAt: null };

function contratV3(mandatAutofacturation: boolean | undefined) {
  return {
    numero: "AXI-DOC-2026-903",
    metadata: {
      renderData: {
        gabaritVersion: 3,
        data: mandatAutofacturation === undefined ? {} : { mandatAutofacturation },
      },
    },
    signatures: [{ signeAt: SIGNE_LE }],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("contrat-cadre v3 — le refus du mandat est lu", () => {
  it("🔴 mandat refusé (organisme) : aucun mandat dérivé", async () => {
    mockFindMany.mockResolvedValue([contratV3(false)]);
    const r = await resoudreMandat(TRAINER, SAISIE);
    expect(r.origine.source).toBe("aucune");
    expect(r.signeAt).toBeNull();
  });

  it("mandat donné : dérivé du contrat v3", async () => {
    mockFindMany.mockResolvedValue([contratV3(true)]);
    const r = await resoudreMandat(TRAINER, SAISIE);
    expect(r.origine).toEqual({
      source: "contrat",
      signeAt: SIGNE_LE,
      numeroContrat: "AXI-DOC-2026-903",
    });
  });

  it("champ absent : la règle de version décide, comme avant", async () => {
    mockFindMany.mockResolvedValue([contratV3(undefined)]);
    const r = await resoudreMandat(TRAINER, SAISIE);
    expect(r.origine.source).toBe("contrat");
  });

  it("un refus sur le plus récent ne masque pas un contrat antérieur qui portait le mandat", async () => {
    mockFindMany.mockResolvedValue([
      contratV3(false),
      { ...contratV3(true), numero: "AXI-DOC-2026-800" },
    ]);
    const r = await resoudreMandat(TRAINER, SAISIE);
    expect(r.origine).toMatchObject({ source: "contrat", numeroContrat: "AXI-DOC-2026-800" });
  });
});
