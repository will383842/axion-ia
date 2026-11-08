/**
 * Fiche S09 — modifier un devis CLASSIQUE en brouillon.
 *
 * Prisma est simulé. Les calculs (total, estimation OPCO, mention TVA) sont ceux du module
 * partagé `champs-classiques` : le test d'égalité compare ce que `createDevisAction` écrit à
 * ce que la modification écrit, pour la MÊME entrée.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  devisFindUnique: vi.fn(),
  devisUpdateMany: vi.fn(),
  devisUpdate: vi.fn(),
  devisDelete: vi.fn(),
  devisDeleteMany: vi.fn(),
  devisCreate: vi.fn(),
  devisFindMany: vi.fn(),
  clientFindUnique: vi.fn(),
  transaction: vi.fn(),
  estimate: vi.fn(),
  config: vi.fn(),
  log: vi.fn(),
  enqueueEmail: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    devis: {
      findUnique: m.devisFindUnique,
      updateMany: m.devisUpdateMany,
      update: m.devisUpdate,
      delete: m.devisDelete,
      deleteMany: m.devisDeleteMany,
    },
    client: { findUnique: m.clientFindUnique },
    $transaction: m.transaction,
  },
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-1", role: "super_admin" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-1", role: "super_admin" }),
  logQualiopiActivity: m.log,
}));
vi.mock("@/server/qualiopi/crm/devis", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/qualiopi/crm/devis")>()),
  estimateOpcoCoverage: m.estimate,
}));
vi.mock("@/server/qualiopi/config/site-settings", () => ({ getQualiopiConfig: m.config }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: m.enqueueEmail }));
vi.mock("@/server/actions/qualiopi/documents", () => ({ genererConventionAction: vi.fn() }));

import { createDevisAction } from "./devis";
import { modifierDevisClassiqueBrouillonAction } from "./devis-classique-modifier";

const CLIENT = "550e8400-e29b-41d4-a716-446655440001";
const DEVIS = "550e8400-e29b-41d4-a716-446655440002";
const MAJ = "2026-11-08T10:00:00.000Z";

const ENTREE = {
  clientId: CLIENT,
  lignes: [
    { designation: "Formation IA", quantite: 2.3, prixUnitaireHtCents: 12345 },
    { designation: "Support", quantite: 1, prixUnitaireHtCents: 1003 },
  ],
};

const EXISTANT = {
  id: DEVIS,
  clientId: CLIENT,
  statut: "brouillon",
  offreSha256: null,
  updatedAt: new Date(MAJ),
  dateValidite: new Date("2026-12-08T10:00:00.000Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  m.devisFindUnique.mockResolvedValue(EXISTANT);
  m.devisUpdateMany.mockResolvedValue({ count: 1 });
  m.config.mockResolvedValue("assujetti");
  m.clientFindUnique.mockResolvedValue({ idcc: null });
});

describe("modifierDevisClassiqueBrouillonAction", () => {
  it("réécrit lignes et total (Σ arrondi par ligne), jamais le statut", async () => {
    m.devisFindUnique
      .mockResolvedValueOnce(EXISTANT)
      .mockResolvedValueOnce({ updatedAt: new Date("2026-11-08T10:05:00.000Z") });
    const r = await modifierDevisClassiqueBrouillonAction({
      id: DEVIS,
      attenduMajLe: MAJ,
      input: ENTREE,
    });
    expect(r).toEqual({ data: { id: DEVIS, majLe: "2026-11-08T10:05:00.000Z" } });
    const arg = m.devisUpdateMany.mock.calls[0]?.[0];
    // Le flottant compte : Math.round(2,3 × 12 345) = 28 393 (pas 28 394) ; + 1 003 = 29 396
    expect(arg.data.montantTotalHtCents).toBe(29396);
    expect(arg.data.lignes).toEqual(ENTREE.lignes);
    expect("statut" in arg.data).toBe(false);
    expect(arg.where).toMatchObject({
      id: DEVIS,
      statut: "brouillon",
      offreSha256: null,
      updatedAt: new Date(MAJ),
    });
  });

  it("refuse un devis à formules (offreSha256 non nul), sans écrire", async () => {
    m.devisFindUnique.mockResolvedValue({ ...EXISTANT, offreSha256: "a".repeat(64) });
    const r = await modifierDevisClassiqueBrouillonAction({
      id: DEVIS,
      attenduMajLe: MAJ,
      input: ENTREE,
    });
    expect("error" in r).toBe(true);
    expect(m.devisUpdateMany).not.toHaveBeenCalled();
  });

  it("refuse un devis qui n'est plus brouillon, sans écrire", async () => {
    m.devisFindUnique.mockResolvedValue({ ...EXISTANT, statut: "envoye" });
    const r = await modifierDevisClassiqueBrouillonAction({
      id: DEVIS,
      attenduMajLe: MAJ,
      input: ENTREE,
    });
    expect("error" in r).toBe(true);
    expect(m.devisUpdateMany).not.toHaveBeenCalled();
  });

  it("refuse une version périmée (updatedAt différent), sans écrire", async () => {
    const r = await modifierDevisClassiqueBrouillonAction({
      id: DEVIS,
      attenduMajLe: "2026-11-08T09:00:00.000Z",
      input: ENTREE,
    });
    expect("error" in r && r.error).toMatch(/modifié ailleurs/);
    expect(m.devisUpdateMany).not.toHaveBeenCalled();
  });

  it("course : le conditionnel ne touche aucune ligne → refus explicite", async () => {
    m.devisUpdateMany.mockResolvedValue({ count: 0 });
    const r = await modifierDevisClassiqueBrouillonAction({
      id: DEVIS,
      attenduMajLe: MAJ,
      input: ENTREE,
    });
    expect("error" in r && r.error).toMatch(/modifié ailleurs/);
    expect(m.log).not.toHaveBeenCalled();
  });

  it("garde 0 € : total nul refusé avant toute lecture ou écriture", async () => {
    const r = await modifierDevisClassiqueBrouillonAction({
      id: DEVIS,
      attenduMajLe: MAJ,
      input: {
        clientId: CLIENT,
        lignes: [{ designation: "Offert", quantite: 1, prixUnitaireHtCents: 0 }],
      },
    });
    expect("error" in r && r.error).toMatch(/0 €/);
    expect(m.devisFindUnique).not.toHaveBeenCalled();
    expect(m.devisUpdateMany).not.toHaveBeenCalled();
  });

  it("refuse un changement de client", async () => {
    const r = await modifierDevisClassiqueBrouillonAction({
      id: DEVIS,
      attenduMajLe: MAJ,
      input: { ...ENTREE, clientId: "550e8400-e29b-41d4-a716-4466554400ff" },
    });
    expect("error" in r).toBe(true);
    expect(m.devisUpdateMany).not.toHaveBeenCalled();
  });

  it("devis introuvable", async () => {
    m.devisFindUnique.mockResolvedValue(null);
    const r = await modifierDevisClassiqueBrouillonAction({
      id: DEVIS,
      attenduMajLe: MAJ,
      input: ENTREE,
    });
    expect("error" in r && r.error).toMatch(/introuvable/i);
  });

  it("aucun delete, aucun e-mail", async () => {
    m.devisFindUnique
      .mockResolvedValueOnce(EXISTANT)
      .mockResolvedValueOnce({ updatedAt: new Date(MAJ) });
    await modifierDevisClassiqueBrouillonAction({ id: DEVIS, attenduMajLe: MAJ, input: ENTREE });
    expect(m.devisDelete).not.toHaveBeenCalled();
    expect(m.devisDeleteMany).not.toHaveBeenCalled();
    expect(m.enqueueEmail).not.toHaveBeenCalled();
  });

  it("OPCO retiré à la modification : les champs d'estimation sont remis à null", async () => {
    m.devisFindUnique
      .mockResolvedValueOnce(EXISTANT)
      .mockResolvedValueOnce({ updatedAt: new Date(MAJ) });
    await modifierDevisClassiqueBrouillonAction({ id: DEVIS, attenduMajLe: MAJ, input: ENTREE });
    const d = m.devisUpdateMany.mock.calls[0]?.[0].data;
    expect(d.financementSuggere).toBeNull();
    expect(d.montantOpcoEstimeCents).toBeNull();
    expect(d.opcoEstimationOrigine).toBeNull();
    expect(d.opcoEstimationAvertissement).toBeNull();
    expect(d.resteAChargeCents).toBeNull();
  });

  it("même entrée → mêmes champs qu'en création (OPCO et mention TVA compris)", async () => {
    m.estimate.mockResolvedValue({
      montantPriseEnChargeCents: 10000,
      resteAChargeCents: 19396,
      origine: "bareme",
      avertissement: "ordre de grandeur",
    });
    const entree = {
      ...ENTREE,
      activite: "formation" as const,
      refClient: "BC-42",
      financementSuggere: "opco" as const,
      nbParticipants: 3,
      dureeHeures: 7,
      modaliteOpco: "intra" as const,
      opcoEnveloppeRestanteCents: 500000,
    };
    // création
    m.devisFindMany.mockResolvedValue([]);
    m.devisCreate.mockResolvedValue({ id: DEVIS, numero: "AXI-DEV-2026-001" });
    m.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({ devis: { findMany: m.devisFindMany, create: m.devisCreate } }),
    );
    await createDevisAction(entree);
    const cree = m.devisCreate.mock.calls[0]?.[0].data;
    // modification
    m.devisFindUnique
      .mockResolvedValueOnce(EXISTANT)
      .mockResolvedValueOnce({ updatedAt: new Date(MAJ) });
    await modifierDevisClassiqueBrouillonAction({ id: DEVIS, attenduMajLe: MAJ, input: entree });
    const modif = m.devisUpdateMany.mock.calls[0]?.[0].data;
    for (const champ of [
      "lignes",
      "montantTotalHtCents",
      "mentionTva",
      "activite",
      "refClient",
      "financementSuggere",
      "montantOpcoEstimeCents",
      "opcoEstimationOrigine",
      "opcoEstimationAvertissement",
      "resteAChargeCents",
    ]) {
      expect(modif[champ], champ).toEqual(cree[champ]);
    }
    expect(modif.montantOpcoEstimeCents).toBe(10000);
    expect(modif.mentionTva).toBeTruthy();
  });
});
