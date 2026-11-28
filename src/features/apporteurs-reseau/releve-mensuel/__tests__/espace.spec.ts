// @vitest-environment node

/** Lot 6 : la lecture de l'espace apporteur ne voit que les relevés ENVOYÉS de CET apporteur. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ findMany: vi.fn(), findFirst: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { releveMensuelApporteur: { findMany: m.findMany, findFirst: m.findFirst } },
}));

import { cleDuReleveDeLApporteur, relevesDeLEspace } from "../espace";

const A = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";

beforeEach(() => {
  vi.clearAllMocks();
  m.findMany.mockResolvedValue([]);
});

describe("relevesDeLEspace", () => {
  it("filtre sur l'apporteur ET sur le statut `envoye` (jamais un relevé non remis)", async () => {
    await relevesDeLEspace(A);
    expect(m.findMany.mock.calls[0]![0].where).toEqual({
      apporteurId: A,
      statut: "envoye",
      pdfR2Key: { not: null },
    });
  });

  it("colonnes énumérées : ni contenu, ni empreinte, ni clé R2", async () => {
    await relevesDeLEspace(A);
    expect(Object.keys(m.findMany.mock.calls[0]![0].select).sort()).toEqual([
      "envoyeAt",
      "numero",
      "periode",
      "rang",
    ]);
  });

  it("table absente (P2021) : liste vide, pas d'erreur", async () => {
    m.findMany.mockRejectedValue(Object.assign(new Error("t"), { code: "P2021" }));
    expect(await relevesDeLEspace(A)).toEqual([]);
  });

  it("une autre erreur remonte", async () => {
    m.findMany.mockRejectedValue(new Error("base en panne"));
    await expect(relevesDeLEspace(A)).rejects.toThrow("base en panne");
  });
});

describe("cleDuReleveDeLApporteur", () => {
  it("la requête porte l'apporteur, le numéro et le statut `envoye`", async () => {
    m.findFirst.mockResolvedValue({
      numero: "REL-2026-10-0004",
      pdfR2Key: `apporteurs/releves/${A}/x.pdf`,
    });
    expect(await cleDuReleveDeLApporteur(A, "REL-2026-10-0004")).toEqual({
      numero: "REL-2026-10-0004",
      r2Key: `apporteurs/releves/${A}/x.pdf`,
    });
    expect(m.findFirst.mock.calls[0]![0].where).toEqual({
      apporteurId: A,
      numero: "REL-2026-10-0004",
      statut: "envoye",
      pdfR2Key: { not: null },
    });
  });

  it("numéro mal formé : null sans requête", async () => {
    expect(await cleDuReleveDeLApporteur(A, "../etc")).toBeNull();
    expect(m.findFirst).not.toHaveBeenCalled();
  });

  it("garde en profondeur : une clé stockée hors du dossier de l'apporteur n'est jamais servie", async () => {
    m.findFirst.mockResolvedValue({
      numero: "REL-2026-10-0004",
      pdfR2Key: "apporteurs/releves/AUTRE/REL-2026-10-0004-abcd1234.pdf",
    });
    expect(await cleDuReleveDeLApporteur(A, "REL-2026-10-0004")).toBeNull();
  });

  it("inconnu / non envoyé / d'un autre : null", async () => {
    m.findFirst.mockResolvedValue(null);
    expect(await cleDuReleveDeLApporteur(A, "REL-2026-10-0004")).toBeNull();
  });
});
