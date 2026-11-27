// Lot 9 : le script de reprise de l'historique (plan §3.3) — essai à blanc, rejeu sans effet, aucune fiche modifiée.
import { beforeEach, describe, expect, it, vi } from "vitest";

const IBAN = "FR1420041010050500013M02606";
const ID1 = "33333333-3333-4333-8333-333333333333";
const ID2 = "44444444-4444-4444-8444-444444444444";

vi.hoisted(() => {
  process.env["PII_ENCRYPTION_KEY"] = "a".repeat(64);
  process.env["IBAN_EMPREINTE_SECRET"] = "secret-de-test-empreinte";
});

const m = vi.hoisted(() => {
  const f = () => vi.fn();
  return {
    prisma: {
      apporteurReseau: { findMany: f(), update: f(), updateMany: f() },
      apporteurIbanHistorique: { findMany: f(), create: f() },
    },
  };
});
vi.mock("@/lib/prisma", () => ({ prisma: m.prisma }));

import { encryptPii } from "@/lib/pii-crypto";
import { reprendreHistoriqueIban } from "../reprise-historique-iban";

beforeEach(() => {
  vi.clearAllMocks();
  m.prisma.apporteurReseau.findMany.mockResolvedValue([
    { id: ID1, iban: encryptPii(IBAN) },
    { id: ID2, iban: null },
  ]);
  m.prisma.apporteurIbanHistorique.findMany.mockResolvedValue([]);
  m.prisma.apporteurIbanHistorique.create.mockResolvedValue({});
});

describe("reprendreHistoriqueIban", () => {
  it("essai à blanc : compte, n'écrit rien", async () => {
    const r = await reprendreHistoriqueIban({ appliquer: false });
    expect(r).toMatchObject({ aCreer: 1, crees: 0, dejaPresents: 0, sansIban: 1 });
    expect(m.prisma.apporteurIbanHistorique.create).not.toHaveBeenCalled();
  });
  it("appliquer : une ligne `dossier_initial` par fiche, IBAN rechiffré en v2, aucune fiche modifiée", async () => {
    const r = await reprendreHistoriqueIban({ appliquer: true });
    expect(r.crees).toBe(1);
    const data = m.prisma.apporteurIbanHistorique.create.mock.calls[0]?.[0].data;
    expect(data.origine).toBe("dossier_initial");
    expect(data.ibanFin4).toBe("2606");
    expect(data.iban).toMatch(/^enc:v2:/);
    expect(data.iban).not.toContain(IBAN);
    expect(m.prisma.apporteurReseau.update).not.toHaveBeenCalled();
    expect(m.prisma.apporteurReseau.updateMany).not.toHaveBeenCalled();
  });
  it("rejeu : une fiche déjà présente dans l'historique ne crée pas de seconde ligne", async () => {
    const { empreinteIban } = await import("@/lib/iban-empreinte");
    m.prisma.apporteurIbanHistorique.findMany.mockResolvedValue([
      { apporteurId: ID1, ibanEmpreinte: empreinteIban(IBAN) },
    ]);
    const r = await reprendreHistoriqueIban({ appliquer: true });
    expect(r).toMatchObject({ crees: 0, dejaPresents: 1 });
    expect(m.prisma.apporteurIbanHistorique.create).not.toHaveBeenCalled();
  });
  it("le compte rendu ne contient jamais l'IBAN entier", async () => {
    const r = await reprendreHistoriqueIban({ appliquer: true });
    expect(JSON.stringify(r)).not.toContain(IBAN);
  });
});
