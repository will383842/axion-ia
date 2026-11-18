/**
 * Changer le type « particulier / entreprise » d'une fiche client SANS pièce.
 * Base simulée, données FICTIVES. Écrit AVANT le code (tests rouges d'abord).
 */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ID = "11111111-1111-4111-8111-111111111111";
const AUTRE = "22222222-2222-4222-8222-222222222222";

const MODELES = vi.hoisted(() => [
  "devis",
  "factureFormation",
  "documentGenere",
  "trainingSession",
  "dossierFinancement",
  "enrollment",
  "coachingContract",
  "planRecurrent",
  "auditMission",
  "clientFactureHorsConsole",
]);

const m = vi.hoisted(() => ({
  update: vi.fn(),
  findUnique: vi.fn(),
  queryRaw: vi.fn(),
  fusionFindFirst: vi.fn(),
  fusionFindMany: vi.fn(),
  contactWrite: vi.fn(),
  definirContact: vi.fn(),
  log: vi.fn(),
  avant: vi.fn(),
  emettre: vi.fn(),
  revalidate: vi.fn(),
  compteurs: {} as Record<string, ReturnType<typeof vi.fn>>,
}));

vi.mock("@/lib/prisma", () => {
  const tx: Record<string, unknown> = {
    client: { update: m.update, findUnique: m.findUnique },
    $queryRaw: m.queryRaw,
    $executeRaw: m.queryRaw,
    clientFusion: { findFirst: m.fusionFindFirst, findMany: m.fusionFindMany },
    clientContact: { update: m.contactWrite, create: m.contactWrite, updateMany: m.contactWrite },
    clientContactAdresse: { create: m.contactWrite, deleteMany: m.contactWrite },
  };
  for (const nom of MODELES) {
    m.compteurs[nom] = vi.fn();
    tx[nom] = { count: m.compteurs[nom] };
  }
  tx["$transaction"] = async (fn: (t: unknown) => unknown) => fn(tx);
  return { prisma: tx };
});
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: m.log,
}));
vi.mock("@/server/partners-sync/producteurs/client", () => ({
  chargeClientAvant: m.avant,
  emettreFaitClient: m.emettre,
}));
vi.mock("@/server/qualiopi/crm/contact-facturation", () => ({
  definirContactFacturation: m.definirContact,
}));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import {
  changerTypeClientAction,
  changerTypeClientFormAction,
  updateClientAction,
} from "./clients";

function ficheEnBase(sur: Record<string, unknown> = {}) {
  return {
    type: "particulier",
    raisonSociale: "Anne Dupont",
    contactNom: "DUPONT Anne",
    siret: null,
    siren: null,
    nafCode: null,
    conventionCollective: null,
    idcc: null,
    taille: null,
    opcoIdentifie: null,
    opcoNumeroAdherent: null,
    opcoEnveloppeAnnuelleCents: null,
    opco: null,
    effectif: null,
    opcoAdhesionOffreMobilites: null,
    opcoVersementVolontaire: null,
    tvaIntracom: null,
    opcoAdhesionsRenseigneesLe: null,
    effectifSource: null,
    effectifReleveLe: null,
    ...sur,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.findUnique.mockResolvedValue(ficheEnBase());
  m.update.mockResolvedValue({});
  m.queryRaw.mockResolvedValue([{ "?column?": 1 }]);
  m.fusionFindFirst.mockResolvedValue(null);
  m.fusionFindMany.mockResolvedValue([]);
  m.avant.mockResolvedValue(null);
  m.emettre.mockResolvedValue(null);
  for (const nom of MODELES) m.compteurs[nom]!.mockResolvedValue(0);
});

const versEntreprise = { id: ID, type: "entreprise" as const, raisonSociale: "Dupont Conseil SAS" };

describe("changerTypeClientAction — refus avec pièces", () => {
  it.each([
    ["devis", "devis"],
    ["factureFormation", "facture"],
    ["documentGenere", "convention"],
    ["trainingSession", "session"],
    ["clientFactureHorsConsole", "factures hors console"],
  ])("refuse s'il y a des %s, nomme la pièce, aucun client.update", async (modele, mot) => {
    m.compteurs[modele]!.mockResolvedValue(2);
    const r = await changerTypeClientAction(versEntreprise);
    expect("error" in r).toBe(true);
    expect((r as { error: string }).error).toContain(mot);
    expect((r as { error: string }).error).toContain("2");
    expect(m.update).not.toHaveBeenCalled();
    expect(m.log).not.toHaveBeenCalled();
  });

  it("compte aussi les pièces des fiches absorbées", async () => {
    m.fusionFindMany.mockResolvedValue([{ absorbeId: AUTRE }]);
    m.compteurs["devis"]!.mockResolvedValue(1);
    await changerTypeClientAction(versEntreprise);
    const where = m.compteurs["devis"]!.mock.calls[0]![0].where;
    expect(JSON.stringify(where)).toContain(AUTRE);
    expect(JSON.stringify(where)).toContain(ID);
  });

  it("ne compte que les documents convention / tripartite / contrat", async () => {
    await changerTypeClientAction(versEntreprise);
    const where = m.compteurs["documentGenere"]!.mock.calls[0]![0].where;
    expect(where.type.in).toEqual(["convention", "convention_tripartite", "contrat"]);
  });
});

describe("changerTypeClientAction — vers entreprise", () => {
  it("refuse sans raison sociale", async () => {
    const r = await changerTypeClientAction({ ...versEntreprise, raisonSociale: "  " });
    expect("error" in r).toBe(true);
    expect(m.update).not.toHaveBeenCalled();
  });

  it("refuse une raison sociale égale au nom du contact (« Anne Dupont » / « DUPONT Anne »)", async () => {
    const r = await changerTypeClientAction({ ...versEntreprise, raisonSociale: "Anne Dupont" });
    expect("error" in r).toBe(true);
    expect(m.update).not.toHaveBeenCalled();
  });

  it("refuse une raison sociale égale à l'ancienne", async () => {
    m.findUnique.mockResolvedValue(ficheEnBase({ contactNom: null }));
    const r = await changerTypeClientAction({ ...versEntreprise, raisonSociale: "dupont ANNE" });
    expect("error" in r).toBe(true);
    expect(m.update).not.toHaveBeenCalled();
  });

  it("refuse si le type demandé est déjà celui de la base", async () => {
    m.findUnique.mockResolvedValue(ficheEnBase({ type: "entreprise" }));
    const r = await changerTypeClientAction(versEntreprise);
    expect("error" in r).toBe(true);
    expect(m.update).not.toHaveBeenCalled();
  });

  it("écrit type et raisonSociale seulement, aucune personne touchée, journal posé", async () => {
    const r = await changerTypeClientAction({ ...versEntreprise, motif: "Société du client" });
    expect(r).toEqual({ data: { id: ID } });

    expect(m.queryRaw).toHaveBeenCalled(); // SELECT … FOR UPDATE
    expect(m.update).toHaveBeenCalledTimes(1);
    expect(m.update.mock.calls[0]![0]).toEqual({
      where: { id: ID },
      data: { type: "entreprise", raisonSociale: "Dupont Conseil SAS" },
    });
    expect(m.contactWrite).not.toHaveBeenCalled();
    expect(m.definirContact).not.toHaveBeenCalled();

    // Le cliquet exige la charge avant, puis le fait, dans la même transaction.
    expect(m.avant).toHaveBeenCalledWith(expect.anything(), ID);
    expect(m.emettre).toHaveBeenCalledWith(expect.anything(), ID, { avant: null });
    expect(m.avant.mock.invocationCallOrder[0]!).toBeLessThan(
      m.update.mock.invocationCallOrder[0]!,
    );
    expect(m.update.mock.invocationCallOrder[0]!).toBeLessThan(
      m.emettre.mock.invocationCallOrder[0]!,
    );

    expect(m.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "qualiopi.client.type_change",
        targetType: "Client",
        targetId: ID,
        changes: {
          typeAvant: "particulier",
          typeApres: "entreprise",
          raisonSocialeAvant: "Anne Dupont",
          raisonSocialeApres: "Dupont Conseil SAS",
          motif: "Société du client",
        },
      }),
    );
    expect(m.revalidate).toHaveBeenCalledTimes(2);
  });
});

describe("changerTypeClientAction — vers particulier et fiche absorbée", () => {
  const versParticulier = { id: ID, type: "particulier" as const, raisonSociale: "Anne Dupont" };

  it("refuse s'il reste un SIRET en base, sans rien effacer", async () => {
    m.findUnique.mockResolvedValue(
      ficheEnBase({ type: "entreprise", raisonSociale: "Dupont SAS", siret: "55210055400013" }),
    );
    const r = await changerTypeClientAction(versParticulier);
    expect("error" in r).toBe(true);
    expect((r as { error: string }).error).toContain("employeur");
    expect(m.update).not.toHaveBeenCalled();
  });

  it.each(["opcoAdhesionsRenseigneesLe", "effectifSource", "effectifReleveLe"])(
    "refuse si « %s » est renseigné",
    async (champ) => {
      m.findUnique.mockResolvedValue(
        ficheEnBase({
          type: "entreprise",
          [champ]: champ === "effectifSource" ? "insee" : new Date(),
        }),
      );
      const r = await changerTypeClientAction(versParticulier);
      expect("error" in r).toBe(true);
      expect(m.update).not.toHaveBeenCalled();
    },
  );

  it("passe en particulier quand aucun champ d'employeur ne reste", async () => {
    m.findUnique.mockResolvedValue(
      ficheEnBase({ type: "entreprise", raisonSociale: "Dupont SAS" }),
    );
    const r = await changerTypeClientAction(versParticulier);
    expect(r).toEqual({ data: { id: ID } });
    expect(m.update.mock.calls[0]![0].data).toEqual({
      type: "particulier",
      raisonSociale: "Anne Dupont",
    });
  });

  it("refuse une fiche absorbée : « Changez le type sur la fiche principale »", async () => {
    m.fusionFindFirst.mockResolvedValue({ id: "f1" });
    const r = await changerTypeClientAction(versEntreprise);
    expect((r as { error: string }).error).toContain("Changez le type sur la fiche principale");
    expect(m.update).not.toHaveBeenCalled();
  });
});

describe("changerTypeClientFormAction — le motif", () => {
  it("transmet le motif saisi jusqu'au journal", async () => {
    const fd = new FormData();
    fd.set("id", ID);
    fd.set("type", "entreprise");
    fd.set("raisonSociale", "Dupont Conseil SAS");
    fd.set("motif", "Création de la société en septembre");
    await changerTypeClientFormAction(fd);
    expect(m.log).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(m.log.mock.calls[0]![0])).toContain(
      "Création de la société en septembre",
    );
  });
});

describe("updateClientAction — l'ancienne porte est fermée", () => {
  it("refuse de changer le type (particulier → entreprise)", async () => {
    m.findUnique.mockResolvedValue({ type: "particulier" });
    const r = await updateClientAction({ id: ID, type: "entreprise" });
    expect((r as { error: string }).error).toContain("Changer le type");
    expect(m.update).not.toHaveBeenCalled();
  });

  it("accepte le MÊME type", async () => {
    m.findUnique.mockResolvedValue({ type: "particulier" });
    const r = await updateClientAction({ id: ID, type: "particulier", notes: "x" });
    expect("error" in r).toBe(false);
    expect(m.update).toHaveBeenCalledTimes(1);
  });

  it("n'écrit jamais `type` dans l'update (le type a été lu hors verrou)", async () => {
    m.findUnique.mockResolvedValue({ type: "particulier" });
    await updateClientAction({ id: ID, type: "particulier", notes: "x" });
    const data = m.update.mock.calls[0]![0].data as Record<string, unknown>;
    expect("type" in data).toBe(false);
    expect(data["notes"]).toBe("x");
  });
});

describe("la synchro CRM reste l'affaire du balayage", () => {
  it("changerTypeClientAction n'appelle aucune synchro directement", () => {
    const src = readFileSync("src/server/actions/qualiopi/clients.ts", "utf8");
    const debut = src.indexOf("export async function changerTypeClientAction");
    expect(debut).toBeGreaterThan(-1);
    const fin = src.indexOf("\nexport async function ", debut + 10);
    const corps = src.slice(debut, fin === -1 ? undefined : fin);
    expect(corps).not.toMatch(
      /crm-sync|synchroniserDossierClient|balayerDossiersClients|enqueueCrmSyncEvent/,
    );
  });
});
