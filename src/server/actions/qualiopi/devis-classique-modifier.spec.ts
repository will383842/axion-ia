/**
 * Fiche S09 — modifier un devis CLASSIQUE en brouillon.
 *
 * Prisma est simulé. Les calculs (total, estimation OPCO, mention TVA) sont ceux du module
 * partagé `champs-classiques` : le test d'égalité compare ce que `createDevisAction` écrit à
 * ce que la modification écrit, pour la MÊME entrée.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
import {
  modifierDevisClassiqueBrouillonAction,
  fixerValiditeDevisBrouillonAction,
} from "./devis-classique-modifier";

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

/**
 * Fiche S10 — validité modifiable (bornes D8 : J+7 à J+90, défaut 30 jours posé à la création).
 *
 * Mutations qui font rougir ces tests : bornes décalées d'un jour (J+6 / J+91), retrait du
 * `updatedAt` dans le `where`, retrait du refus « hors brouillon », ajout d'une écriture de
 * `statut`, retrait du `requireAdminWrite`.
 */
describe("fixerValiditeDevisBrouillonAction (S10)", () => {
  const NOW = new Date("2026-11-08T10:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const appel = (dateValidite: string, o: Record<string, unknown> = {}) =>
    fixerValiditeDevisBrouillonAction({ id: DEVIS, attenduMajLe: MAJ, dateValidite, ...o });

  it("accepte J+30 sur un brouillon classique : updateMany conditionnel, jamais le statut", async () => {
    m.devisFindUnique
      .mockResolvedValueOnce(EXISTANT)
      .mockResolvedValueOnce({ updatedAt: new Date("2026-11-08T10:01:00.000Z") });
    const r = await appel("2026-12-08");
    expect(r).toEqual({ data: { majLe: "2026-11-08T10:01:00.000Z" } });
    const arg = m.devisUpdateMany.mock.calls[0]![0];
    expect(arg.where).toEqual({ id: DEVIS, statut: "brouillon", updatedAt: new Date(MAJ) });
    expect(Object.keys(arg.data)).toEqual(["dateValidite"]);
    expect((arg.data.dateValidite as Date).toISOString()).toBe("2026-12-08T22:59:59.000Z");
    expect(JSON.stringify(arg)).not.toMatch(/"statut":"(?!brouillon)/);
    expect(m.devisUpdate).not.toHaveBeenCalled();
  });

  it("stocke 23:59:59 heure de PARIS (hiver : 22:59:59Z ; été : 21:59:59Z)", async () => {
    for (const [d, iso] of [
      ["2026-12-08", "2026-12-08T22:59:59.000Z"],
      ["2027-01-15", "2027-01-15T22:59:59.000Z"],
      ["2027-07-14", "2027-07-14T21:59:59.000Z"],
    ] as const) {
      // Le cas d'été doit rester dans la fenêtre J+7..J+90 : on avance l'horloge en juillet.
      vi.setSystemTime(
        new Date(d === "2027-07-14" ? "2027-07-01T10:00:00.000Z" : "2026-11-08T10:00:00.000Z"),
      );
      m.devisFindUnique.mockResolvedValueOnce(EXISTANT).mockResolvedValueOnce(null);
      await appel(d);
      expect(
        (m.devisUpdateMany.mock.calls.at(-1)![0].data.dateValidite as Date).toISOString(),
      ).toBe(iso);
    }
    vi.setSystemTime(NOW);
  });

  it("à 23:30 UTC (déjà le lendemain à Paris) : le jour de Paris sert de référence", async () => {
    vi.setSystemTime(new Date("2026-11-08T23:30:00.000Z")); // 9 nov 00:30 à Paris
    // J+7 de Paris = 16 nov (J+8 en UTC) → accepté ; le 15 nov est J+6 à Paris → refusé.
    m.devisFindUnique.mockResolvedValueOnce(EXISTANT).mockResolvedValueOnce(null);
    expect("data" in (await appel("2026-11-16"))).toBe(true);
    expect("error" in (await appel("2026-11-15"))).toBe(true);
    expect(m.devisUpdateMany).toHaveBeenCalledTimes(1);
  });

  it("journalise l'action avec la session de requireAdminWrite", async () => {
    m.devisFindUnique.mockResolvedValueOnce(EXISTANT).mockResolvedValueOnce(null);
    await appel("2026-12-08");
    expect(m.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "qualiopi.devis.fixer_validite_brouillon",
        targetType: "Devis",
        targetId: DEVIS,
        session: { userId: "admin-1", role: "super_admin" },
      }),
    );
  });

  describe("estimation OPCO dépendante de la date", () => {
    const OPCO = {
      ...EXISTANT,
      financementSuggere: "opco",
      montantTotalHtCents: 100000,
      montantOpcoEstimeCents: 50000,
    };
    const COVERAGE = {
      montantPriseEnChargeCents: 40000,
      origine: "reglage_par_defaut",
      avertissement: null,
      resteAChargeCents: 60000,
    };

    it("recalcule l'estimation avec la nouvelle date quand la saisie est fournie", async () => {
      m.estimate.mockResolvedValue(COVERAGE);
      m.devisFindUnique.mockResolvedValueOnce(OPCO).mockResolvedValueOnce(null);
      await appel("2027-01-15", {
        estimation: { nbParticipants: 4, dureeHeures: 14, modaliteOpco: "inter_presentiel" },
      });
      expect(m.estimate.mock.calls[0]![0].asOf.toISOString()).toBe("2027-01-15T22:59:59.000Z");
      const data = m.devisUpdateMany.mock.calls[0]![0].data;
      expect(data.montantOpcoEstimeCents).toBe(40000);
      expect(data.resteAChargeCents).toBe(60000);
    });

    it("sans saisie et estimation non nulle : REFUS, rien n'est écrit", async () => {
      m.devisFindUnique.mockResolvedValueOnce(OPCO);
      const r = await appel("2027-01-15");
      expect("error" in r && r.error).toMatch(/recalculer/);
      expect(m.estimate).not.toHaveBeenCalled();
      expect(m.devisUpdateMany).not.toHaveBeenCalled();
    });

    it("sans saisie et estimation existante à 0 € : REFUS aussi, rien n'est écrit", async () => {
      // estimateOpcoCoverage rend 0 € (enveloppe épuisée, 50 salariés ou plus) : 0 n'est pas « absent ».
      m.devisFindUnique.mockResolvedValueOnce({ ...OPCO, montantOpcoEstimeCents: 0 });
      const r = await appel("2027-01-15");
      expect("error" in r && r.error).toMatch(/recalculer/);
      expect(m.estimate).not.toHaveBeenCalled();
      expect(m.devisUpdateMany).not.toHaveBeenCalled();
    });

    it("sans saisie mais sans estimation existante : la date s'enregistre seule", async () => {
      m.devisFindUnique
        .mockResolvedValueOnce({ ...OPCO, montantOpcoEstimeCents: null })
        .mockResolvedValueOnce(null);
      const r = await appel("2027-01-15");
      expect("data" in r).toBe(true);
      expect(Object.keys(m.devisUpdateMany.mock.calls[0]![0].data)).toEqual(["dateValidite"]);
    });

    it("devis à formules : l'estimation n'est pas touchée", async () => {
      m.devisFindUnique
        .mockResolvedValueOnce({ ...OPCO, offreSha256: "a".repeat(64) })
        .mockResolvedValueOnce(null);
      await appel("2027-01-15");
      expect(Object.keys(m.devisUpdateMany.mock.calls[0]![0].data)).toEqual(["dateValidite"]);
    });
  });

  it("accepte aussi un devis À FORMULES (offreSha256 non nul)", async () => {
    m.devisFindUnique
      .mockResolvedValueOnce({ ...EXISTANT, offreSha256: "a".repeat(64) })
      .mockResolvedValueOnce({ updatedAt: new Date(MAJ) });
    const r = await appel("2026-12-08");
    expect("data" in r).toBe(true);
    expect(m.devisUpdateMany.mock.calls[0]![0].where).not.toHaveProperty("offreSha256");
  });

  it("bornes D8 : J+7 et J+90 passent", async () => {
    for (const d of ["2026-11-15", "2027-02-06"]) {
      m.devisFindUnique
        .mockResolvedValueOnce(EXISTANT)
        .mockResolvedValueOnce({ updatedAt: new Date(MAJ) });
      expect("data" in (await appel(d)), d).toBe(true);
    }
  });

  it("bornes D8 : J+6 et J+91 refusés, rien d'écrit", async () => {
    for (const d of ["2026-11-14", "2027-02-07", "2026-11-08", "2025-01-01"]) {
      const r = await appel(d);
      expect("error" in r, d).toBe(true);
    }
    expect(m.devisUpdateMany).not.toHaveBeenCalled();
  });

  it("date illisible ou impossible refusée (31 février, format libre)", async () => {
    for (const d of ["2026-02-31", "08/12/2026", "2026-13-01", "demain"]) {
      expect("error" in (await appel(d)), d).toBe(true);
    }
    expect(m.devisUpdateMany).not.toHaveBeenCalled();
  });

  it("refuse un devis qui n'est plus brouillon", async () => {
    m.devisFindUnique.mockResolvedValueOnce({ ...EXISTANT, statut: "envoye" });
    const r = await appel("2026-12-08");
    expect("error" in r).toBe(true);
    expect(m.devisUpdateMany).not.toHaveBeenCalled();
  });

  it("refuse si updatedAt n'est plus celui que l'onglet a lu", async () => {
    m.devisFindUnique.mockResolvedValueOnce({
      ...EXISTANT,
      updatedAt: new Date("2026-11-08T10:30:00.000Z"),
    });
    const r = await appel("2026-12-08");
    expect("error" in r).toBe(true);
    expect(m.devisUpdateMany).not.toHaveBeenCalled();
  });

  it("course entre onglets : updateMany à 0 ligne → refus", async () => {
    m.devisFindUnique.mockResolvedValueOnce(EXISTANT);
    m.devisUpdateMany.mockResolvedValue({ count: 0 });
    const r = await appel("2026-12-08");
    expect("error" in r).toBe(true);
  });

  it("devis introuvable → erreur", async () => {
    m.devisFindUnique.mockResolvedValueOnce(null);
    expect("error" in (await appel("2026-12-08"))).toBe(true);
  });

  it("garde d'écriture appelée d'abord", async () => {
    const guards = await import("@/server/actions/qualiopi/_guards");
    vi.mocked(guards.requireAdminWrite).mockRejectedValueOnce(new Error("interdit"));
    await expect(appel("2026-12-08")).rejects.toThrow("interdit");
    expect(m.devisFindUnique).not.toHaveBeenCalled();
  });
});
