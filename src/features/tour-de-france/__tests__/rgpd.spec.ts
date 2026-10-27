import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  findMany: vi.fn(),
  updateMany: vi.fn(),
  remove: vi.fn(),
  removeMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tourDemande: {
      findMany: m.findMany,
      updateMany: m.updateMany,
      delete: m.remove,
      deleteMany: m.removeMany,
    },
  },
}));
vi.mock("@/lib/pii-crypto", () => ({
  encryptPii: (v: string) => `enc:${v}`,
  decryptPii: (v: string) => v.replace(/^enc:/, ""),
}));

import { hashEmailForLookup } from "@/lib/security/email-hash";
import { VALEUR_EFFACEE, anonymiserDemandesTour, exporterDemandesTour } from "../rgpd";

beforeEach(() => vi.clearAllMocks());

describe("RGPD : accès (art. 15)", () => {
  it("retrouve les demandes par l'empreinte de l'adresse et les rend en clair", async () => {
    m.findMany.mockResolvedValue([
      {
        nom: "enc:Alice",
        email: "enc:alice@exemple.fr",
        telephone: "enc:0612345678",
        villeSaisie: "Lyon",
        statut: "recue",
        depuis: null,
        creeLe: new Date("2026-10-27T10:00:00Z"),
      },
    ]);
    const r = await exporterDemandesTour("Alice@Exemple.fr");
    expect(r[0]?.nom).toBe("Alice");
    expect(r[0]?.email).toBe("alice@exemple.fr");
    const arg = m.findMany.mock.calls[0]?.[0] as { where: { emailHash: string } };
    expect(arg.where.emailHash).toBe(hashEmailForLookup("alice@exemple.fr"));
  });

  it("une adresse vide ne lit rien", async () => {
    await expect(exporterDemandesTour("  ")).resolves.toEqual([]);
    expect(m.findMany).not.toHaveBeenCalled();
  });
});

describe("RGPD : effacement (art. 17) — on anonymise, on ne supprime jamais", () => {
  it("remplace nom, e-mail et téléphone, retire les empreintes, garde les clés de comptage", async () => {
    m.updateMany.mockResolvedValue({ count: 2 });
    await expect(anonymiserDemandesTour("alice@exemple.fr")).resolves.toEqual({ anonymisees: 2 });
    const arg = m.updateMany.mock.calls[0]?.[0] as {
      where: { emailHash: string };
      data: Record<string, unknown>;
    };
    expect(arg.where.emailHash).toBe(hashEmailForLookup("alice@exemple.fr"));
    expect(arg.data["nom"]).toBe(`enc:${VALEUR_EFFACEE}`);
    expect(arg.data["email"]).toBe(`enc:${VALEUR_EFFACEE}`);
    expect(arg.data["telephone"]).toBe(`enc:${VALEUR_EFFACEE}`);
    expect(arg.data["emailHash"]).toBeNull();
    expect(arg.data["telephoneFin"]).toBeNull();
    expect(arg.data["ipHash"]).toBeNull();
    expect(arg.data["statut"]).toBe("effacee_rgpd");
    // Le compteur d'une ville ne recule pas : les clés de comptage ne sont pas touchées.
    expect(arg.data).not.toHaveProperty("cleComptagePersonne");
    expect(arg.data).not.toHaveProperty("cleComptageDomaine");
    expect(arg.data).not.toHaveProperty("cleComptageTelephone");
    expect(arg.data).not.toHaveProperty("compte");
  });

  it("ne supprime aucune ligne", async () => {
    m.updateMany.mockResolvedValue({ count: 1 });
    await anonymiserDemandesTour("alice@exemple.fr");
    expect(m.remove).not.toHaveBeenCalled();
    expect(m.removeMany).not.toHaveBeenCalled();
  });

  it("une adresse vide n'efface rien", async () => {
    await expect(anonymiserDemandesTour("")).resolves.toEqual({ anonymisees: 0 });
    expect(m.updateMany).not.toHaveBeenCalled();
  });
});
