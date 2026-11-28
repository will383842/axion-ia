// Lot 7 : preuve du compte payé (empreinte + fin, jamais l'IBAN) et lignes « Virements à faire ».
import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  demandes: [] as Array<Record<string, unknown>>,
  ecrites: [] as Array<Record<string, unknown>>,
  deja: 0,
}));

vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: unknown) => v }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    apporteurChangementIban: { findMany: vi.fn(async () => etat.demandes) },
    apporteurIbanHistorique: { findMany: vi.fn(async () => []) },
    apporteurReseau: {
      findMany: vi.fn(async () => [{ id: "B", iban: "FR7630006000011234567890189" }]),
    },
  },
}));

import { ecrirePreuveDeCompte, enrichirVirements } from "../virement-compte";

const IBAN = "FR7630006000011234567890189";
const maintenant = new Date("2026-12-01T10:00:00Z");

beforeEach(() => {
  process.env["IBAN_EMPREINTE_SECRET"] = "secret-de-test";
  etat.demandes = [];
  etat.ecrites = [];
  etat.deja = 0;
});

describe("preuve du compte payé", () => {
  const tx = {
    apporteurVirementCompte: {
      count: vi.fn(async () => etat.deja),
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        etat.ecrites.push(a.data);
        return a.data;
      }),
    },
  };

  it("une ligne par autofacture, le premier virement sur un compte est marqué", async () => {
    await ecrirePreuveDeCompte(tx as never, {
      apporteurId: "B",
      numeros: ["AXI-APP-2026-0001", "AXI-APP-2026-0002"],
      verseAt: maintenant,
      compte: { fin4: "0189", empreinte: "e".repeat(64) },
      declarePar: "u1",
    });
    expect(etat.ecrites.map((e) => e["premierSurCeCompte"])).toEqual([true, false]);
    expect(etat.ecrites[0]).toMatchObject({ ibanFin4: "0189", ibanEmpreinte: "e".repeat(64) });
  });

  it("déjà un virement sur ce compte : jamais « premier »", async () => {
    etat.deja = 3;
    await ecrirePreuveDeCompte(tx as never, {
      apporteurId: "B",
      numeros: ["AXI-APP-2026-0003"],
      verseAt: maintenant,
      compte: { fin4: "0189", empreinte: "e".repeat(64) },
      declarePar: "u1",
    });
    expect(etat.ecrites[0]!["premierSurCeCompte"]).toBe(false);
  });

  it("aucun IBAN entier dans ce qui est écrit", async () => {
    await ecrirePreuveDeCompte(tx as never, {
      apporteurId: "B",
      numeros: ["AXI-APP-2026-0004"],
      verseAt: maintenant,
      compte: { fin4: "0189", empreinte: "e".repeat(64) },
      declarePar: "u1",
    });
    expect(JSON.stringify(etat.ecrites)).not.toContain(IBAN);
  });
});

describe("lignes « Virements à faire »", () => {
  const ligne = {
    numero: "AXI-APP-2026-0009",
    apporteurId: "B",
    emissionAt: new Date("2026-11-20T10:00:00Z"),
    paiementIntegralAt: null,
  };

  it("sans demande : le compte de la fiche est masqué, pas de gel", async () => {
    const m = await enrichirVirements([ligne], maintenant);
    expect(m.get(ligne.numero)).toMatchObject({ gel: null, compteFin4: "0189" });
    expect(JSON.stringify([...m])).not.toContain(IBAN);
  });

  it("demande confirmée : ligne gelée avec la plus proche échéance, aucun compte présenté", async () => {
    etat.demandes = [
      {
        id: "d",
        apporteurId: "B",
        statut: "confirmee",
        demandeeAt: maintenant,
        confirmeeAt: maintenant,
      },
    ];
    const m = await enrichirVirements([ligne], maintenant);
    const e = m.get(ligne.numero)!;
    expect(e.gel?.plusProcheEcheance).toBeInstanceOf(Date);
    expect(e.compteFin4).toBeNull();
  });

  it("demande annulée : plus de gel, le compte de la fiche revient", async () => {
    etat.demandes = [];
    expect((await enrichirVirements([ligne], maintenant)).get(ligne.numero)?.gel).toBeNull();
  });
});
