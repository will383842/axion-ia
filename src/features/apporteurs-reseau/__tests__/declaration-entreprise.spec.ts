import { beforeEach, describe, expect, it, vi } from "vitest";

// Contrat 2.6 : présentations existantes d'avant la 2.6 (toute l'entreprise) ; écriture du SIRET simulée.
vi.mock("../etablissement-presentation", async (orig) => {
  const vrai = await orig<typeof import("../etablissement-presentation")>();
  return {
    ...vrai,
    lireEtablissements: async (ids: readonly string[]) =>
      new Map(ids.map((id) => [id, vrai.AVANT_2_6] as const)),
    lireSiretsDevis: async () => new Map(),
    lireDecisionsAAttribuer: async () => new Map(),
    lireAAttribuerEnAttente: async () => [],
    ouvrirAAttribuer: vi.fn(async () => true),
    enregistrerEtablissement: vi.fn(async () => undefined),
  };
});
vi.mock("server-only", () => ({}));
const findUnique = vi.fn();
const count = vi.fn();
const findMany = vi.fn();
const creerPresentation = vi.fn();
const enqueueEmail = vi.fn();
const envoyer = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apporteurReseau: { findUnique: (...a: unknown[]) => findUnique(...a) },
    presentationEntreprise: {
      count: (...a: unknown[]) => count(...a),
      findMany: (...a: unknown[]) => findMany(...a),
    },
  },
}));
vi.mock("../presentations", () => ({
  creerPresentation: (...a: unknown[]) => creerPresentation(...a),
  nomComplet: () => "Éloïse Lefèvre",
  presentationOccupe: (p: { statut: string }) =>
    p.statut === "reservee" || p.statut === "confirmee",
}));
vi.mock("../envois", () => ({ envoyer: (...a: unknown[]) => envoyer(...a) }));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => enqueueEmail(...a),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { MESSAGE_DEJA, MESSAGE_NEUTRE, declarerEntreprise } from "../declaration-entreprise";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const MAINTENANT = new Date("2026-10-05T10:00:00Z");
const BONNE = {
  siret: "73282932000074",
  denomination: "Boulangerie Martin",
  personneNom: "Claire Durand",
  personneFonction: "Gérante",
  personneEmail: "claire@exemple.fr",
  personneTelephone: "06 12 34 56 78",
  dateContact: "2026-10-01",
};

beforeEach(() => {
  vi.clearAllMocks();
  findUnique.mockResolvedValue({ statut: "signe", prenom: "x", nom: "y" });
  count.mockResolvedValue(0);
  findMany.mockResolvedValue([]);
  creerPresentation.mockResolvedValue({ ok: true, id: "p1" });
  enqueueEmail.mockResolvedValue({ garePourValidation: false });
});

describe("declarerEntreprise", () => {
  it("succès : crée la présentation « à traiter », alerte Williams, n'envoie rien à l'entreprise", async () => {
    const r = await declarerEntreprise(ID, BONNE, MAINTENANT);
    expect(r).toEqual({ ok: true });
    const saisie = creerPresentation.mock.calls[0]![0];
    expect(saisie).toMatchObject({
      apporteurId: ID,
      siret: "73282932000074",
      personneFonction: "Gérante",
      dateEchange: "2026-10-01",
      recueAt: MAINTENANT,
    });
    // Un seul e-mail, INTERNE, sans donnée sur la personne rencontrée.
    expect(enqueueEmail).toHaveBeenCalledTimes(1);
    const [gabarit, destinataire, , payload] = enqueueEmail.mock.calls[0]!;
    expect(gabarit).toBe("apporteur-declaration-recue");
    expect(destinataire).toBe("contact@axion-ia.com");
    expect(JSON.stringify(payload)).not.toContain("claire@exemple.fr");
    expect(JSON.stringify(payload)).not.toContain("Durand");
    expect(envoyer).not.toHaveBeenCalled();
  });

  it("refuse un apporteur dont le contrat n'est pas signé", async () => {
    findUnique.mockResolvedValue({ statut: "a_verifier", prenom: "x", nom: "y" });
    expect(await declarerEntreprise(ID, BONNE, MAINTENANT)).toEqual({
      ok: false,
      message: MESSAGE_NEUTRE,
    });
    expect(creerPresentation).not.toHaveBeenCalled();
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("refuse un apporteur inconnu", async () => {
    findUnique.mockResolvedValue(null);
    expect((await declarerEntreprise(ID, BONNE, MAINTENANT)).ok).toBe(false);
  });

  it("refuse une saisie invalide sans rien écrire", async () => {
    const r = await declarerEntreprise(ID, { ...BONNE, dateContact: "2026-10-06" }, MAINTENANT);
    expect(r.ok).toBe(false);
    expect(creerPresentation).not.toHaveBeenCalled();
  });

  it("aucun plafond par apporteur : même après 500 déclarations en 24 h, la suivante passe (art. 3.7)", async () => {
    count.mockResolvedValue(500);
    expect(await declarerEntreprise(ID, BONNE, MAINTENANT)).toEqual({ ok: true });
    expect(creerPresentation).toHaveBeenCalledTimes(1);
    expect(count).not.toHaveBeenCalled();
  });

  it("doublon : sa propre déclaration encore en cours n'est pas redéclarée", async () => {
    findMany.mockResolvedValue([{ statut: "reservee", protegeeJusquAt: null }]);
    expect(await declarerEntreprise(ID, BONNE, MAINTENANT)).toEqual({
      ok: false,
      message: MESSAGE_DEJA,
    });
    expect(creerPresentation).not.toHaveBeenCalled();
  });

  it("une entreprise attribuée à un autre apporteur est reçue sans rien révéler", async () => {
    // La recherche de doublon ne porte QUE sur l'apporteur : aucun autre n'est lu.
    await declarerEntreprise(ID, BONNE, MAINTENANT);
    expect(findMany.mock.calls[0]![0].where.apporteurId).toBe(ID);
    expect(creerPresentation).toHaveBeenCalledTimes(1);
  });

  it("une panne de file n'annule pas la déclaration", async () => {
    enqueueEmail.mockRejectedValue(new Error("redis"));
    expect(await declarerEntreprise(ID, BONNE, MAINTENANT)).toEqual({ ok: true });
  });
});
