/**
 * Tests — d'où vient le mandat de facturation.
 *
 * 🔑 CE QUI SE TESTE ICI EST UN REFUS DE DÉDUIRE.
 *
 * Une dérivation trop généreuse affirmerait qu'un mandat existe là où rien ne le
 * prouve — et une facture émise sans mandat est irrégulière, sa TVA non
 * déductible. Les tests qui comptent sont donc ceux qui vérifient que le module
 * NE dérive PAS : contrat en version 1, contrat non signé, contrat annulé.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { documentGenere: { findMany: (...a: unknown[]) => mockFindMany(...a) } },
}));

import { resoudreMandat, VERSION_CONTRAT_AVEC_MANDAT } from "./mandat-source";

const TRAINER = "22222222-2222-4222-8222-222222222222";
const SIGNE_LE = new Date("2026-09-15T10:00:00.000Z");
const PAPIER_LE = new Date("2026-03-01T00:00:00.000Z");

/** Un contrat signé, dans la version qui porte l'article 4 bis. */
function contrat(over: Record<string, unknown> = {}) {
  return {
    numero: "AXI-DOC-2026-042",
    metadata: { renderData: { gabaritVersion: VERSION_CONTRAT_AVEC_MANDAT } },
    signatures: [{ signeAt: SIGNE_LE }],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFindMany.mockResolvedValue([]);
});

describe("resoudreMandat — la saisie manuelle gagne toujours", () => {
  it("🔴 une saisie manuelle n'est JAMAIS écrasée par la dérivation", async () => {
    // Un mandat papier signé en mars est valable, et il est ANTÉRIEUR au
    // contrat électronique de septembre. Le laisser écraser repousserait la
    // date du mandat et rendrait irrégulières, a posteriori, des factures
    // parfaitement régulières le jour de leur émission.
    mockFindMany.mockResolvedValue([contrat()]);
    const r = await resoudreMandat(TRAINER, {
      mandatAutofacturationSigneAt: PAPIER_LE,
      mandatAutofacturationRevoqueAt: null,
    });
    expect(r.signeAt).toEqual(PAPIER_LE);
    expect(r.origine.source).toBe("saisie");
    // La base n'est même pas interrogée : rien à déduire quand on sait.
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("🔑 la révocation reste TOUJOURS celle qui a été saisie", async () => {
    // Révoquer est un acte écrit distinct ; rien dans un contrat signé ne peut
    // l'exprimer. Dériver une révocation inventerait un acte que personne n'a
    // posé — l'inverse exact du risque qu'on évite en amont.
    const revoque = new Date("2026-10-01T00:00:00.000Z");
    mockFindMany.mockResolvedValue([contrat()]);
    const r = await resoudreMandat(TRAINER, {
      mandatAutofacturationSigneAt: null,
      mandatAutofacturationRevoqueAt: revoque,
    });
    expect(r.origine.source).toBe("contrat");
    expect(r.revoqueAt).toEqual(revoque);
  });
});

describe("resoudreMandat — la dérivation, et ses trois refus", () => {
  it("dérive du contrat signé en version ≥ 2, et NOMME la pièce", async () => {
    mockFindMany.mockResolvedValue([contrat()]);
    const r = await resoudreMandat(TRAINER, {
      mandatAutofacturationSigneAt: null,
      mandatAutofacturationRevoqueAt: null,
    });
    expect(r.signeAt).toEqual(SIGNE_LE);
    expect(r.origine).toEqual({
      source: "contrat",
      signeAt: SIGNE_LE,
      numeroContrat: "AXI-DOC-2026-042",
    });
  });

  it("🔴 REFUSE de dériver d'un contrat en version 1", async () => {
    // LE test central. Jusqu'au 2026-09-10, `contrat_sous_traitance` valait 1
    // — y compris APRÈS l'ajout de la clause 4 bis, l'incrément ayant été
    // oublié. Un contrat d'août et un contrat de septembre portaient la même
    // version. Dériver là-dessus, c'est fabriquer la preuve.
    mockFindMany.mockResolvedValue([contrat({ metadata: { renderData: { gabaritVersion: 1 } } })]);
    const r = await resoudreMandat(TRAINER, {
      mandatAutofacturationSigneAt: null,
      mandatAutofacturationRevoqueAt: null,
    });
    expect(r.origine.source).toBe("aucune");
    expect(r.signeAt).toBeNull();
  });

  it("🔴 une version ABSENTE est lue comme 1, jamais comme la version courante", async () => {
    // Les pièces générées avant le mécanisme n'en portent pas. Les lire comme
    // « à jour » ferait passer un contrat d'août pour un contrat contenant la
    // clause : en cas de doute, on refuse.
    for (const metadata of [{}, { renderData: {} }, null, "pas un objet"]) {
      mockFindMany.mockResolvedValue([contrat({ metadata })]);
      const r = await resoudreMandat(TRAINER, {
        mandatAutofacturationSigneAt: null,
        mandatAutofacturationRevoqueAt: null,
      });
      expect(r.origine.source, `metadata ${JSON.stringify(metadata)}`).toBe("aucune");
    }
  });

  it("refuse un contrat sans aucune signature", async () => {
    mockFindMany.mockResolvedValue([contrat({ signatures: [] })]);
    const r = await resoudreMandat(TRAINER, {
      mandatAutofacturationSigneAt: null,
      mandatAutofacturationRevoqueAt: null,
    });
    expect(r.origine.source).toBe("aucune");
  });

  it("🔑 n'interroge QUE les contrats signés et non annulés", async () => {
    // Un contrat annulé n'engage plus personne, un contrat partiellement signé
    // n'engage pas encore. Le filtre est en SQL ; ce test le rend vérifiable.
    await resoudreMandat(TRAINER, {
      mandatAutofacturationSigneAt: null,
      mandatAutofacturationRevoqueAt: null,
    });
    const where = mockFindMany.mock.calls[0]?.[0]?.where as Record<string, unknown>;
    expect(where["statutSignature"]).toBe("signee");
    expect(where["annuleeAt"]).toBeNull();
    expect(where["type"]).toBe("contrat_sous_traitance");
    expect(where["trainerId"]).toBe(TRAINER);
  });

  it("🔑 retient la DERNIÈRE signature, pas la première", async () => {
    // Choix conservateur : le mandat n'engage qu'une fois la pièce complète, et
    // une date plus tardive couvre MOINS de factures. Se tromper vers le tard
    // est sans conséquence ; vers le tôt rend une pièce irrégulière.
    const tot = new Date("2026-09-10T08:00:00.000Z");
    const tard = new Date("2026-09-14T17:00:00.000Z");
    mockFindMany.mockResolvedValue([
      contrat({ signatures: [{ signeAt: tot }, { signeAt: tard }] }),
    ]);
    const r = await resoudreMandat(TRAINER, {
      mandatAutofacturationSigneAt: null,
      mandatAutofacturationRevoqueAt: null,
    });
    expect(r.signeAt).toEqual(tard);
  });

  it("🔑 une lecture qui LÈVE ne dérive rien — elle ne devine pas", async () => {
    // Stub de build, base indisponible : le refus d'émettre qui s'ensuit est le
    // comportement prudent. Rendre un mandat par défaut serait l'inverse exact.
    mockFindMany.mockRejectedValue(new Error("base indisponible (test)"));
    const r = await resoudreMandat(TRAINER, {
      mandatAutofacturationSigneAt: null,
      mandatAutofacturationRevoqueAt: null,
    });
    expect(r.origine.source).toBe("aucune");
    expect(r.signeAt).toBeNull();
  });

  it("🔑 CONTRE-TÉMOIN : la dérivation FONCTIONNE dans le cas nominal", async () => {
    // Sans lui, les sept refus ci-dessus resteraient verts si `resoudreMandat`
    // rendait « aucune » pour TOUT LE MONDE — on mesurerait un module inerte au
    // lieu d'un module prudent.
    mockFindMany.mockResolvedValue([contrat()]);
    const r = await resoudreMandat(TRAINER, {
      mandatAutofacturationSigneAt: null,
      mandatAutofacturationRevoqueAt: null,
    });
    expect(r.signeAt).not.toBeNull();
  });
});
