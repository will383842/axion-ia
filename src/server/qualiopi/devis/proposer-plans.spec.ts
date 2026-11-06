// @vitest-environment node
/**
 * Proposition des plans d'un devis à formules accepté : inerte interrupteur éteint,
 * `pause` + devisId + nature + proposeAt, idempotente, fail-closed, aucune facture ni e-mail.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
vi.mock("@sentry/nextjs", () => sentry);

const h = vi.hoisted(() => {
  const tx = {
    planRecurrent: { findMany: vi.fn(), create: vi.fn() },
  };
  return {
    tx,
    p: {
      devis: { findUnique: vi.fn() },
      $transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
      factureFormation: { create: vi.fn() },
    },
    actif: vi.fn(),
  };
});
vi.mock("@/lib/prisma", () => ({ prisma: h.p }));
vi.mock("./interrupteur-formules", () => ({ formulesActives: h.actif }));

import { sha256Offre } from "./offre-calculs";
import { offreFictive } from "./offre-fixtures.spec-util";
import { proposerPlansApresAcceptation, proposerPlansRecurrentsDuDevis } from "./proposer-plans";

const DEVIS = "11111111-1111-4111-8111-111111111111";
const ACCEPTE = new Date("2030-01-15T10:00:00.000Z");

function devisB(sur: Record<string, unknown> = {}, offre = offreFictive()) {
  const sha = sha256Offre(offre);
  return {
    id: DEVIS,
    numero: "AXI-DEV-2030-001",
    statut: "accepte",
    activite: "implementation",
    clientId: "cli-1",
    refClient: "BC-9",
    acceptedAt: ACCEPTE,
    offre,
    offreSha256: sha,
    formuleRetenue: "abonnement",
    choixRetenu: {
      v: 1,
      devisNumero: "AXI-DEV-2030-001",
      offreSha256: sha,
      formule: "abonnement",
      automatisationsRetenues: [],
      maintenanceRetenue: false,
      periodiciteMois: 1,
    },
    ...sur,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.actif.mockResolvedValue(true);
  h.tx.planRecurrent.findMany.mockResolvedValue([]);
  h.tx.planRecurrent.create.mockResolvedValue({ id: "plan-1" });
});

describe("inertie", () => {
  it("interrupteur éteint : aucune lecture, aucune écriture", async () => {
    h.actif.mockResolvedValue(false);
    const r = await proposerPlansRecurrentsDuDevis(DEVIS);
    expect(r).toEqual({ statut: "inerte", raison: "interrupteur_eteint" });
    expect(h.p.devis.findUnique).not.toHaveBeenCalled();
    expect(h.tx.planRecurrent.create).not.toHaveBeenCalled();
  });

  it("devis classique (offre NULL) : rien", async () => {
    h.p.devis.findUnique.mockResolvedValue(
      devisB({ offre: null, offreSha256: null, formuleRetenue: null }),
    );
    expect(await proposerPlansRecurrentsDuDevis(DEVIS)).toEqual({
      statut: "inerte",
      raison: "sans_offre",
    });
    expect(h.tx.planRecurrent.create).not.toHaveBeenCalled();
  });
});

describe("création", () => {
  it("formule B : un plan en PAUSE, lié au devis, proposé, jamais actif ni validé", async () => {
    h.p.devis.findUnique.mockResolvedValue(devisB());
    const r = await proposerPlansRecurrentsDuDevis(DEVIS);
    expect(r).toMatchObject({ statut: "traite", crees: ["abonnement"], dejaPresents: [] });
    expect(h.tx.planRecurrent.create).toHaveBeenCalledTimes(1);
    const data = h.tx.planRecurrent.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({
      clientId: "cli-1",
      activite: "implementation",
      refClient: "BC-9",
      statut: "pause",
      devisId: DEVIS,
      nature: "abonnement",
      periodiciteMois: 1,
      nbMaxFactures: 12,
    });
    expect(data.proposeAt).toBeInstanceOf(Date);
    expect(data).not.toHaveProperty("valideAt");
    expect(data.prochaineGenerationAt).toEqual(ACCEPTE); // à échoir : date de début
    expect(data.lignes).toEqual([
      expect.objectContaining({ quantite: 1, prixUnitaireHtCents: 9000, tauxTvaPercent: 20 }),
    ]);
  });

  it("aucune facture n'est créée (ni brouillon, ni émise)", async () => {
    h.p.devis.findUnique.mockResolvedValue(devisB());
    await proposerPlansRecurrentsDuDevis(DEVIS);
    expect(h.p.factureFormation.create).not.toHaveBeenCalled();
  });

  it("idempotente : le plan de cette nature existe → rien de plus", async () => {
    h.p.devis.findUnique.mockResolvedValue(devisB());
    h.tx.planRecurrent.findMany.mockResolvedValue([{ nature: "abonnement" }]);
    const r = await proposerPlansRecurrentsDuDevis(DEVIS);
    expect(r).toMatchObject({ statut: "traite", crees: [], dejaPresents: ["abonnement"] });
    expect(h.tx.planRecurrent.create).not.toHaveBeenCalled();
  });

  it("course : violation de l'index unique partiel (P2002) → traité sans erreur", async () => {
    h.p.devis.findUnique.mockResolvedValue(devisB());
    h.tx.planRecurrent.create.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    const r = await proposerPlansRecurrentsDuDevis(DEVIS);
    expect(r).toMatchObject({ statut: "traite", crees: [], dejaPresents: ["abonnement"] });
  });

  it("formule A, maintenance retenue : plan « maintenance » ; non retenue : aucun plan", async () => {
    const offre = offreFictive();
    const sha = sha256Offre(offre);
    const choix = (retenue: boolean) => ({
      v: 1,
      devisNumero: "AXI-DEV-2030-001",
      offreSha256: sha,
      formule: "achat",
      automatisationsRetenues: [],
      maintenanceRetenue: retenue,
      periodiciteMois: 12,
    });
    h.p.devis.findUnique.mockResolvedValue(
      devisB({ formuleRetenue: "achat", choixRetenu: choix(true) }, offre),
    );
    const r = await proposerPlansRecurrentsDuDevis(DEVIS);
    expect(r).toMatchObject({ crees: ["maintenance"] });
    expect(h.tx.planRecurrent.create.mock.calls[0]![0].data.lignes[0].prixUnitaireHtCents).toBe(
      48000,
    );

    h.tx.planRecurrent.create.mockClear();
    h.p.devis.findUnique.mockResolvedValue(
      devisB({ formuleRetenue: "achat", choixRetenu: choix(false) }, offre),
    );
    expect(await proposerPlansRecurrentsDuDevis(DEVIS)).toMatchObject({
      statut: "traite",
      crees: [],
    });
    expect(h.tx.planRecurrent.create).not.toHaveBeenCalled();
  });
});

describe("fail-closed", () => {
  const cas: Array<[string, Record<string, unknown>, string]> = [
    ["aucune formule retenue", { formuleRetenue: null }, "aucune_formule"],
    ["devis non accepté", { statut: "envoye" }, "devis_non_accepte"],
    ["activité absente", { activite: null }, "activite_absente"],
    ["choix absent", { choixRetenu: null }, "choix_illisible"],
    ["offre illisible", { offre: { v: 9 } }, "offre_illisible"],
    ["empreinte de l'offre stockée différente", { offreSha256: "0".repeat(64) }, "offre_alteree"],
    ["formule retenue ≠ formule du choix", { formuleRetenue: "achat" }, "choix_incoherent"],
  ];
  it.each(cas)("%s → refus, aucune écriture", async (_n, surcharge, code) => {
    h.p.devis.findUnique.mockResolvedValue(devisB(surcharge));
    const r = await proposerPlansRecurrentsDuDevis(DEVIS);
    expect(r).toMatchObject({ statut: "refuse", code });
    expect(h.tx.planRecurrent.create).not.toHaveBeenCalled();
  });

  it("offre modifiée après le choix : l'empreinte recalculée diffère → refus", async () => {
    const d = devisB();
    d.offre.abonnement!.mensuelCatalogueHtCents = 1; // altération en base
    h.p.devis.findUnique.mockResolvedValue(d);
    expect(await proposerPlansRecurrentsDuDevis(DEVIS)).toMatchObject({
      statut: "refuse",
      code: "offre_alteree",
    });
  });

  it("numéro du choix ≠ numéro du devis → refus", async () => {
    const d = devisB();
    d.choixRetenu.devisNumero = "AXI-DEV-AUTRE";
    h.p.devis.findUnique.mockResolvedValue(d);
    expect(await proposerPlansRecurrentsDuDevis(DEVIS)).toMatchObject({ code: "choix_incoherent" });
  });
});

describe("proposerPlansApresAcceptation (fail-soft)", () => {
  it("n'échoue jamais : une erreur base part à Sentry", async () => {
    h.p.devis.findUnique.mockRejectedValue(new Error("db down"));
    await expect(proposerPlansApresAcceptation(DEVIS, "console")).resolves.toBeUndefined();
    expect(sentry.captureException).toHaveBeenCalled();
  });

  it("un refus est signalé (code, sans donnée personnelle)", async () => {
    h.p.devis.findUnique.mockResolvedValue(devisB({ formuleRetenue: null }));
    await proposerPlansApresAcceptation(DEVIS, "signature_complete");
    expect(sentry.captureMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ tags: expect.objectContaining({ code: "aucune_formule" }) }),
    );
  });

  it("interrupteur éteint : silence total", async () => {
    h.actif.mockResolvedValue(false);
    await proposerPlansApresAcceptation(DEVIS, "console");
    expect(sentry.captureMessage).not.toHaveBeenCalled();
    expect(sentry.captureException).not.toHaveBeenCalled();
  });
});
