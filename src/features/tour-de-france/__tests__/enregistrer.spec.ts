import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  create: vi.fn(),
  findFirst: vi.fn(),
  rattacherDemande: vi.fn(),
  envoyerAuCrm: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { tourDemande: { create: m.create, findFirst: m.findFirst } },
}));
vi.mock("@/lib/pii-crypto", () => ({ encryptPii: (v: string) => `enc:${v}` }));
vi.mock("@/features/dossier-client/fiche-auto", () => ({ finDeTelephone: () => "612345678" }));
vi.mock("../fiche", () => ({ rattacherDemande: m.rattacherDemande }));
vi.mock("../crm", () => ({ envoyerAuCrm: m.envoyerAuCrm }));
vi.mock("@sentry/nextjs", () => ({ captureException: m.captureException }));

import { ErreurDemande, enregistrerDemande } from "../enregistrer";

const entree = {
  nom: "Alice Martin",
  email: "Alice@Societe-Exemple.fr",
  telephone: "06 12 34 56 78",
  ville: "LYON",
};

beforeEach(() => {
  vi.clearAllMocks();
  m.create.mockResolvedValue({ id: "d1" });
  m.rattacherDemande.mockResolvedValue({ rattachement: "sans_fiche", clientId: null });
  m.envoyerAuCrm.mockResolvedValue(undefined);
});

describe("enregistrerDemande", () => {
  it("écrit la demande chiffrée, comptée, avec ses trois clés de comptage", async () => {
    const r = await enregistrerDemande(entree);
    expect(r).toEqual({ id: "d1", compte: true, rattachement: "sans_fiche" });
    const { data } = m.create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(data["nom"]).toBe("enc:Alice Martin");
    expect(data["email"]).toBe("enc:alice@societe-exemple.fr");
    expect(data["villeCle"]).toBe("lyon");
    expect(data["villeNom"]).toBe("Lyon");
    expect(data["compte"]).toBe(true);
    expect(String(data["cleComptagePersonne"]).startsWith("lyon:")).toBe(true);
    expect(data["cleComptageDomaine"]).toBe("lyon:societe-exemple.fr");
    expect(data["cleComptageTelephone"]).toBe("lyon:612345678");
  });

  it("clé déjà prise (P2002) : la demande est gardée, sans clé, hors du compteur", async () => {
    m.create
      .mockRejectedValueOnce(Object.assign(new Error("unique"), { code: "P2002" }))
      .mockResolvedValueOnce({ id: "d2" });
    m.findFirst.mockResolvedValue({ id: "d1" });
    const r = await enregistrerDemande(entree);
    expect(r.id).toBe("d2");
    expect(r.compte).toBe(false);
    const { data } = m.create.mock.calls[1]?.[0] as { data: Record<string, unknown> };
    expect(data["compte"]).toBe(false);
    expect(data["doublonDeId"]).toBe("d1");
    expect(data).not.toHaveProperty("cleComptagePersonne");
    expect(data).not.toHaveProperty("cleComptageDomaine");
    expect(data).not.toHaveProperty("cleComptageTelephone");
  });

  it("une autre erreur de la base remonte (la demande n'est pas perdue en silence)", async () => {
    m.create.mockRejectedValueOnce(new Error("base indisponible"));
    await expect(enregistrerDemande(entree)).rejects.toThrow("base indisponible");
  });

  it("une panne de la fiche ou du CRM ne perd pas la demande : Sentry, demande « à vérifier »", async () => {
    m.rattacherDemande.mockRejectedValue(new Error("fiche"));
    m.envoyerAuCrm.mockRejectedValue(new Error("crm"));
    const r = await enregistrerDemande(entree);
    expect(r).toEqual({ id: "d1", compte: true, rattachement: "a_verifier" });
    expect(m.captureException).toHaveBeenCalledTimes(2);
  });

  it("envoie la demande au CRM avec le nom de la ville du référentiel", async () => {
    await enregistrerDemande(entree);
    expect(m.envoyerAuCrm).toHaveBeenCalledWith(
      expect.objectContaining({ id: "d1", ville: "Lyon", email: "alice@societe-exemple.fr" }),
    );
  });

  it("refuse une ville, un nom, un e-mail ou un téléphone vide", async () => {
    await expect(enregistrerDemande({ ...entree, ville: " " })).rejects.toBeInstanceOf(
      ErreurDemande,
    );
    await expect(enregistrerDemande({ ...entree, nom: " " })).rejects.toBeInstanceOf(ErreurDemande);
    await expect(enregistrerDemande({ ...entree, email: " " })).rejects.toBeInstanceOf(
      ErreurDemande,
    );
    await expect(enregistrerDemande({ ...entree, telephone: " " })).rejects.toBeInstanceOf(
      ErreurDemande,
    );
    expect(m.create).not.toHaveBeenCalled();
  });
});
