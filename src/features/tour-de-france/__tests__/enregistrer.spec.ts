import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  create: vi.fn(),
  findFirst: vi.fn(),
  encryptPii: vi.fn((v: string, _options?: unknown) => `enc:${v}`),
  rattacherDemande: vi.fn(),
  envoyerAuCrm: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { tourDemande: { create: m.create, findFirst: m.findFirst } },
}));
vi.mock("@/lib/pii-crypto", () => ({ encryptPii: m.encryptPii }));
vi.mock("@/features/dossier-client/fiche-auto", () => ({
  finDeTelephone: (t: string) => {
    const chiffres = t.replace(/\D/g, "");
    return chiffres.length >= 9 ? chiffres.slice(-9) : null;
  },
}));
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

const HMAC_LYON = /^lyon:[0-9a-f]{64}$/;

beforeEach(() => {
  vi.clearAllMocks();
  m.create.mockResolvedValue({ id: "d1" });
  m.rattacherDemande.mockResolvedValue({ rattachement: "sans_fiche", clientId: null });
  m.envoyerAuCrm.mockResolvedValue(undefined);
});

describe("enregistrerDemande", () => {
  it("écrit la demande chiffrée, comptée, avec ses trois clés de comptage (des HMAC)", async () => {
    const r = await enregistrerDemande(entree);
    expect(r).toEqual({ id: "d1", compte: true, rattachement: "sans_fiche" });
    const { data } = m.create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(data["nom"]).toBe("enc:Alice Martin");
    expect(data["email"]).toBe("enc:alice@societe-exemple.fr");
    expect(data["telephone"]).toBe("enc:06 12 34 56 78");
    expect(data["villeCle"]).toBe("lyon");
    expect(data["villeNom"]).toBe("Lyon");
    expect(data["compte"]).toBe(true);
    expect(String(data["cleComptagePersonne"])).toMatch(HMAC_LYON);
    expect(String(data["cleComptageDomaine"])).toMatch(HMAC_LYON);
    expect(String(data["cleComptageTelephone"])).toMatch(HMAC_LYON);
    // Rien de lisible dans les clés, et aucune colonne « fin de numéro ».
    expect(String(data["cleComptageDomaine"])).not.toContain("societe-exemple");
    expect(String(data["cleComptageTelephone"])).not.toContain("612345678");
    expect(data).not.toHaveProperty("telephoneFin");
  });

  it("chiffre avec la clé exigée et une donnée authentifiée propre à chaque champ", async () => {
    await enregistrerDemande(entree);
    const options = m.encryptPii.mock.calls.map((c) => [c[0], c[1]]);
    expect(options).toEqual([
      ["Alice Martin", { cleExigee: true, aad: "tour_demandes:nom" }],
      ["alice@societe-exemple.fr", { cleExigee: true, aad: "tour_demandes:email" }],
      ["06 12 34 56 78", { cleExigee: true, aad: "tour_demandes:telephone" }],
    ]);
  });

  it("deux écritures de la même boîte (+étiquette, casse) donnent la même clé personne", async () => {
    await enregistrerDemande(entree);
    await enregistrerDemande({ ...entree, email: "ALICE+tour@societe-exemple.fr" });
    const cle = (i: number): unknown => {
      const { data } = m.create.mock.calls[i]?.[0] as { data: Record<string, unknown> };
      return data["cleComptagePersonne"];
    };
    expect(cle(0)).toBe(cle(1));
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

describe("enregistrerDemande : ce qu'un visiteur ne peut pas faire passer", () => {
  it("refuse tout champ qui commence par « enc: » (il passerait pour un chiffré), sans égard à la casse", async () => {
    for (const faux of ["enc:v1:abc", "ENC:V2:abc", "  Enc:v1:abc", "ｅｎｃ:v1:abc"]) {
      await expect(enregistrerDemande({ ...entree, nom: faux })).rejects.toMatchObject({
        champ: "nom",
      });
      await expect(enregistrerDemande({ ...entree, telephone: faux })).rejects.toMatchObject({
        champ: "telephone",
      });
    }
    await expect(enregistrerDemande({ ...entree, email: "enc:v1:abc" })).rejects.toMatchObject({
      champ: "email",
    });
    expect(m.create).not.toHaveBeenCalled();
  });

  it("refuse une adresse qui n'en est pas une, ou plus longue que 254 caractères", async () => {
    for (const mauvaise of ["alice", "alice@", "@societe-exemple.fr", "a b@societe-exemple.fr"]) {
      await expect(enregistrerDemande({ ...entree, email: mauvaise })).rejects.toMatchObject({
        champ: "email",
      });
    }
    const trop = `${"a".repeat(250)}@societe-exemple.fr`;
    await expect(enregistrerDemande({ ...entree, email: trop })).rejects.toMatchObject({
      champ: "email",
    });
    expect(m.create).not.toHaveBeenCalled();
  });

  it("refuse un téléphone illisible (moins de 9 chiffres)", async () => {
    await expect(enregistrerDemande({ ...entree, telephone: "06 12" })).rejects.toMatchObject({
      champ: "telephone",
    });
    await expect(enregistrerDemande({ ...entree, telephone: "abc" })).rejects.toMatchObject({
      champ: "telephone",
    });
    expect(m.create).not.toHaveBeenCalled();
  });

  it("nettoie le nom : forme NFKC, caractères de contrôle et d'inversion retirés, 120 caractères", async () => {
    await enregistrerDemande({ ...entree, nom: "  Ali\u202Ece\u0000  \n Mar\u200Btin\u2067 " });
    const premier = m.encryptPii.mock.calls[0];
    expect(premier?.[0]).toBe("Alice Martin");
    m.encryptPii.mockClear();
    await enregistrerDemande({ ...entree, nom: "ｍ".repeat(300) });
    expect((m.encryptPii.mock.calls[0]?.[0] as string).length).toBe(120);
  });

  it("nettoie aussi la ville tapée avant de la ramener à sa clé", async () => {
    await enregistrerDemande({ ...entree, ville: "Ly\u202Eon\u0007" });
    const { data } = m.create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(data["villeCle"]).toBe("lyon");
    expect(data["villeSaisie"]).toBe("Lyon");
  });
});
