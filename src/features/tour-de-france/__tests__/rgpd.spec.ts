import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  findMany: vi.fn(),
  update: vi.fn(async (_arg: unknown) => ({})),
  updateMany: vi.fn(),
  remove: vi.fn(),
  removeMany: vi.fn(),
  decrypt: vi.fn((v: string, _options?: unknown) => v.replace(/^enc:/, "")),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tourDemande: {
      findMany: m.findMany,
      update: m.update,
      updateMany: m.updateMany,
      delete: m.remove,
      deleteMany: m.removeMany,
    },
  },
}));
vi.mock("@/lib/pii-crypto", () => ({
  encryptPii: (v: string) => `enc:${v}`,
  decryptPii: m.decrypt,
}));

import { Prisma } from "../../../../prisma/generated/client";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import {
  VALEUR_EFFACEE,
  VILLE_CLE_EFFACEE,
  anonymiserDemandesTour,
  exporterDemandesTour,
} from "../rgpd";

beforeEach(() => {
  vi.clearAllMocks();
  m.decrypt.mockImplementation((v: string) => v.replace(/^enc:/, ""));
});

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

  it("déchiffre avec la clé exigée et la donnée authentifiée de chaque champ", async () => {
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
    await exporterDemandesTour("alice@exemple.fr");
    expect(m.decrypt.mock.calls.map((c) => c[1])).toEqual([
      { cleExigee: true, aad: "tour_demandes:nom" },
      { cleExigee: true, aad: "tour_demandes:email" },
      { cleExigee: true, aad: "tour_demandes:telephone" },
    ]);
  });

  it("une valeur illisible ne fait JAMAIS planter l'export de la personne", async () => {
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
    m.decrypt.mockImplementation(() => {
      throw new Error("clé absente ou donnée altérée");
    });
    const r = await exporterDemandesTour("alice@exemple.fr");
    expect(r).toHaveLength(1);
    expect(r[0]?.nom).toBe("illisible");
    expect(r[0]?.email).toBe("illisible");
    expect(r[0]?.telephone).toBe("illisible");
    expect(r[0]?.ville).toBe("Lyon");
  });

  it("une adresse vide ne lit rien", async () => {
    await expect(exporterDemandesTour("  ")).resolves.toEqual([]);
    expect(m.findMany).not.toHaveBeenCalled();
  });
});

describe("RGPD : effacement (art. 17) — on vide la ligne, on ne supprime jamais", () => {
  const ligneComptee = {
    id: "11111111-1111-4111-8111-111111111111",
    villeNom: "Lyon",
    cleComptagePersonne: "lyon:aaaa",
    cleComptageDomaine: "lyon:bbbb",
    cleComptageTelephone: "lyon:cccc",
  };

  function donnees(i = 0): Record<string, unknown> {
    return (m.update.mock.calls[i]?.[0] as { data: Record<string, unknown> }).data;
  }

  it("retrouve les lignes par l'empreinte de l'adresse, puis les met à jour une à une", async () => {
    m.findMany.mockResolvedValue([ligneComptee, { ...ligneComptee, id: "autre" }]);
    await expect(anonymiserDemandesTour("alice@exemple.fr")).resolves.toEqual({ anonymisees: 2 });
    const arg = m.findMany.mock.calls[0]?.[0] as { where: { emailHash: string } };
    expect(arg.where.emailHash).toBe(hashEmailForLookup("alice@exemple.fr"));
    expect(m.update).toHaveBeenCalledTimes(2);
    expect(m.updateMany).not.toHaveBeenCalled();
  });

  it("remplace nom, e-mail et téléphone, retire les empreintes, la ville tapée et les repères", async () => {
    m.findMany.mockResolvedValue([ligneComptee]);
    await anonymiserDemandesTour("alice@exemple.fr");
    const d = donnees();
    expect(d["nom"]).toBe(`enc:${VALEUR_EFFACEE}`);
    expect(d["email"]).toBe(`enc:${VALEUR_EFFACEE}`);
    expect(d["telephone"]).toBe(`enc:${VALEUR_EFFACEE}`);
    expect(d["emailHash"]).toBeNull();
    expect(d["ipHash"]).toBeNull();
    expect(d["villeSaisie"]).toBe(VALEUR_EFFACEE);
    expect(d["depuis"]).toBeNull();
    for (const utm of ["utmSource", "utmMedium", "utmCampaign", "utmContent"]) {
      expect(d[utm], utm).toBeNull();
    }
    // Les fiches proches (qui peuvent porter le nom d'un particulier) sont retirées.
    expect(d["fichesProches"]).toBe(Prisma.DbNull);
    expect(d["statut"]).toBe("effacee_rgpd");
    expect(d).not.toHaveProperty("telephoneFin");
  });

  it("remplace les trois clés de comptage par une valeur opaque propre à la ligne", async () => {
    m.findMany.mockResolvedValue([ligneComptee]);
    await anonymiserDemandesTour("alice@exemple.fr");
    const d = donnees();
    expect(d["cleComptagePersonne"]).toBe(`efface:${ligneComptee.id}:p`);
    expect(d["cleComptageDomaine"]).toBe(`efface:${ligneComptee.id}:d`);
    expect(d["cleComptageTelephone"]).toBe(`efface:${ligneComptee.id}:t`);
  });

  it("une clé déjà nulle (doublon, webmail) reste nulle : rien n'est inventé", async () => {
    m.findMany.mockResolvedValue([
      { ...ligneComptee, cleComptagePersonne: null, cleComptageDomaine: null },
    ]);
    await anonymiserDemandesTour("alice@exemple.fr");
    const d = donnees();
    expect(d).not.toHaveProperty("cleComptagePersonne");
    expect(d).not.toHaveProperty("cleComptageDomaine");
    expect(d["cleComptageTelephone"]).toBe(`efface:${ligneComptee.id}:t`);
  });

  it("la ligne reste comptée : `compte` n'est pas touché, le compteur d'une ville ne recule pas", async () => {
    m.findMany.mockResolvedValue([ligneComptee]);
    await anonymiserDemandesTour("alice@exemple.fr");
    expect(donnees()).not.toHaveProperty("compte");
  });

  it("la clé de ville du référentiel est gardée ; celle d'une ville tapée à la main est retirée", async () => {
    m.findMany.mockResolvedValue([ligneComptee, { ...ligneComptee, id: "autre", villeNom: null }]);
    await anonymiserDemandesTour("alice@exemple.fr");
    expect(donnees(0)).not.toHaveProperty("villeCle");
    expect(donnees(1)["villeCle"]).toBe(VILLE_CLE_EFFACEE);
  });

  it("ne supprime aucune ligne", async () => {
    m.findMany.mockResolvedValue([ligneComptee]);
    await anonymiserDemandesTour("alice@exemple.fr");
    expect(m.remove).not.toHaveBeenCalled();
    expect(m.removeMany).not.toHaveBeenCalled();
  });

  it("une adresse vide n'efface rien", async () => {
    await expect(anonymiserDemandesTour("")).resolves.toEqual({ anonymisees: 0 });
    expect(m.findMany).not.toHaveBeenCalled();
    expect(m.update).not.toHaveBeenCalled();
  });

  it("aucune ligne pour cette adresse : zéro, sans écrire", async () => {
    m.findMany.mockResolvedValue([]);
    await expect(anonymiserDemandesTour("inconnue@exemple.fr")).resolves.toEqual({
      anonymisees: 0,
    });
    expect(m.update).not.toHaveBeenCalled();
  });
});
