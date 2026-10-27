import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(async () => []),
    client: { findUnique: vi.fn(), update: vi.fn(async () => ({})) },
    clientContact: { findUnique: vi.fn(async () => null), update: vi.fn(async () => ({})) },
    activityLog: { create: vi.fn(async () => ({})) },
    tourDemande: { update: vi.fn(async () => ({})) },
  };
  return {
    tx,
    prisma: {
      tourDemande: { findUnique: vi.fn(), update: vi.fn(async () => ({})) },
      client: { findMany: vi.fn(async () => []) },
      $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
    },
    trouverFichesProches: vi.fn(),
    fichesAuMemeTelephone: vi.fn(async () => [] as string[]),
    ajouterPersonneAFiche: vi.fn(async () => ({ contactId: "c1", cree: true })),
    emettreFaitClient: vi.fn(async () => undefined),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: m.prisma }));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string) => v }));
vi.mock("@/features/dossier-client/base", () => ({ dansLaTransaction: (t: unknown) => t }));
vi.mock("@/features/dossier-client/fiche-auto", () => ({
  fichesAuMemeTelephone: m.fichesAuMemeTelephone,
}));
vi.mock("@/features/questionnaire-preaudit/interblocage", () => ({
  reessayerSiInterblocage: (fn: () => unknown) => fn(),
}));
vi.mock("@/server/partners-sync/producteurs/client", () => ({
  chargeClientAvant: async () => ({}),
  emettreFaitClient: m.emettreFaitClient,
}));
vi.mock("@/server/qualiopi/crm/contact-facturation", () => ({ NOM_A_COMPLETER: "(à compléter)" }));
vi.mock("@/server/qualiopi/crm/porte-client", () => ({
  preparerCandidat: () => ({}),
  chargerFichesCandidates: async () => [],
  trouverFichesProches: m.trouverFichesProches,
  creerOuRetrouverClient: vi.fn(),
  ajouterPersonneAFiche: m.ajouterPersonneAFiche,
}));

import { champsACompleter, decider, fusionnerProches, rattacherDemande } from "../fiche";

const ligne = {
  id: "d1",
  nom: "Alice Martin",
  email: "alice@societe-exemple.fr",
  telephone: "0612345678",
  villeSaisie: "lyon",
  villeNom: "Lyon",
  depuis: null,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmContent: null,
  rattachement: "a_verifier",
  clientId: null,
};

const proche = (signal: "email" | "nom_ville" | "domaine", id = "f1") => ({
  ficheId: id,
  numero: `C-${id}`,
  raisonSociale: `Fiche ${id}`,
  signal,
});

beforeEach(() => {
  vi.clearAllMocks();
  m.prisma.tourDemande.findUnique.mockResolvedValue(ligne);
  m.fichesAuMemeTelephone.mockResolvedValue([]);
  m.prisma.client.findMany.mockResolvedValue([]);
  m.tx.client.findUnique.mockResolvedValue({ adresseVille: null });
  m.ajouterPersonneAFiche.mockResolvedValue({ contactId: "c1", cree: true });
});

describe("fiche : parties pures", () => {
  it("decider : une seule fiche reconnue à l'e-mail est complétée", () => {
    expect(decider([proche("email")])).toEqual({ issue: "completer", ficheId: "f1" });
  });

  it("decider : un homonyme, un domaine ou plusieurs fiches vont à l'arbitrage", () => {
    expect(decider([proche("nom_ville")]).issue).toBe("arbitrer");
    expect(decider([proche("domaine")]).issue).toBe("arbitrer");
    expect(decider([proche("email", "f1"), proche("email", "f2")]).issue).toBe("arbitrer");
  });

  it("decider : aucune fiche", () => {
    expect(decider([])).toEqual({ issue: "aucune" });
  });

  it("fusionnerProches : une fiche n'apparaît qu'une fois, avec son signal le plus fort", () => {
    const liste = fusionnerProches(
      [{ ficheId: "f1", numero: "C-1", raisonSociale: "A", signal: "email" }],
      [
        { id: "f1", numero: "C-1", raisonSociale: "A" },
        { id: "f2", numero: "C-2", raisonSociale: "B" },
      ],
    );
    expect(liste.map((p) => [p.ficheId, p.signal])).toEqual([
      ["f1", "email"],
      ["f2", "telephone"],
    ]);
  });

  it("champsACompleter : seulement la ville, seulement si elle est vide", () => {
    expect(champsACompleter({ adresseVille: null }, "Lyon")).toEqual({ adresseVille: "Lyon" });
    expect(champsACompleter({ adresseVille: "  " }, "Lyon")).toEqual({ adresseVille: "Lyon" });
    expect(champsACompleter({ adresseVille: "Annecy" }, "Lyon")).toEqual({});
    expect(champsACompleter({ adresseVille: null }, "")).toEqual({});
  });
});

describe("rattacherDemande", () => {
  it("fiche SÛRE : complète seulement ce qui est vide, ne touche ni statut, ni source, ni nom, ni SIREN", async () => {
    m.trouverFichesProches.mockReturnValue([proche("email")]);
    const r = await rattacherDemande("d1");
    expect(r).toEqual({ rattachement: "fiche_completee", clientId: "f1" });
    expect(m.tx.client.update).toHaveBeenCalledTimes(1);
    const data = (
      m.tx.client.update.mock.calls[0] as unknown as [{ data: Record<string, unknown> }]
    )[0].data;
    expect(Object.keys(data)).toEqual(["adresseVille"]);
    expect(data).not.toHaveProperty("statut");
    expect(data).not.toHaveProperty("source");
    expect(data).not.toHaveProperty("raisonSociale");
    expect(data).not.toHaveProperty("siren");
    // La trace « Demande Tour France IA, ville X » est écrite sur la fiche.
    const trace = (
      m.tx.activityLog.create.mock.calls[0] as unknown as [
        { data: { changes: { libelle: string } } },
      ]
    )[0];
    expect(trace.data.changes.libelle).toBe("Demande Tour France IA, ville Lyon");
  });

  it("fiche SÛRE dont la ville est déjà remplie : rien n'est écrasé", async () => {
    m.trouverFichesProches.mockReturnValue([proche("email")]);
    m.tx.client.findUnique.mockResolvedValue({ adresseVille: "Annecy" });
    await rattacherDemande("d1");
    expect(m.tx.client.update).not.toHaveBeenCalled();
    expect(m.emettreFaitClient).not.toHaveBeenCalled();
  });

  it("homonyme (même nom, même ville) : à arbitrer, AUCUNE écriture sur une fiche", async () => {
    m.trouverFichesProches.mockReturnValue([proche("nom_ville")]);
    const r = await rattacherDemande("d1");
    expect(r.rattachement).toBe("a_arbitrer");
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
    expect(m.tx.client.update).not.toHaveBeenCalled();
    const maj = (
      m.prisma.tourDemande.update.mock.calls[0] as unknown as [
        { data: { rattachement: string; fichesProches: Array<{ ficheId: string }> } },
      ]
    )[0];
    expect(maj.data.rattachement).toBe("a_arbitrer");
    expect(maj.data.fichesProches[0]?.ficheId).toBe("f1");
  });

  it("même téléphone qu'une AUTRE fiche : à arbitrer, aucune écriture sur une fiche", async () => {
    m.trouverFichesProches.mockReturnValue([proche("email", "f1")]);
    m.fichesAuMemeTelephone.mockResolvedValue(["f2"]);
    m.prisma.client.findMany.mockResolvedValue([
      { id: "f2", numero: "C-f2", raisonSociale: "Fiche f2" },
    ] as never);
    const r = await rattacherDemande("d1");
    expect(r.rattachement).toBe("a_arbitrer");
    expect(m.tx.client.update).not.toHaveBeenCalled();
  });

  it("aucune fiche : « sans fiche », rien n'est créé", async () => {
    m.trouverFichesProches.mockReturnValue([]);
    const r = await rattacherDemande("d1");
    expect(r).toEqual({ rattachement: "sans_fiche", clientId: null });
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
    expect(m.tx.client.update).not.toHaveBeenCalled();
  });

  it("une demande déjà rattachée est rendue telle quelle (idempotent)", async () => {
    m.prisma.tourDemande.findUnique.mockResolvedValue({
      ...ligne,
      rattachement: "fiche_completee",
      clientId: "f9",
    });
    const r = await rattacherDemande("d1");
    expect(r).toEqual({ rattachement: "fiche_completee", clientId: "f9" });
    expect(m.trouverFichesProches).not.toHaveBeenCalled();
  });
});
