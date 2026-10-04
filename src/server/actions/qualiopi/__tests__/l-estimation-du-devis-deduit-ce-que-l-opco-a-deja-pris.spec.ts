/**
 * Lot OPCO A7d — l'estimation OPCO du devis lit le barème de l'ANNÉE DE LA
 * SESSION et déduit ce que l'OPCO a déjà pris en charge pour ce client sur
 * cette année civile.
 *
 * Témoins : `asOf` = début prévu de la session ; consommation lue pour l'année
 * de Paris de cette date, et pour l'OPCO de `opcoDuClient` (typé d'abord) ;
 * enveloppe saisie sur le devis → aucune lecture de consommation.
 * Contre-témoin : sans date de session, `asOf` = date de validité du devis.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { CLIENT, fausseBaseDevis } from "./_devis-transactionnel";

const h = vi.hoisted(() => ({
  db: null as unknown,
  estimer: vi.fn(),
  consommation: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return h.db;
  },
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: async () => ({
    userId: "55555555-5555-4555-8555-555555555555",
    role: "admin",
  }),
  requireHabilitation: async () => ({ userId: "u", role: "admin" }),
  logQualiopiActivity: async () => undefined,
}));
vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: async () => "assujetti",
}));
vi.mock("@/server/qualiopi/crm/devis", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/qualiopi/crm/devis")>()),
  estimateOpcoCoverage: (...a: unknown[]) => h.estimer(...a),
}));
vi.mock("@/server/qualiopi/financements/consommation-opco", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/qualiopi/financements/consommation-opco")>()),
  consommationOpcoAnnee: (...a: unknown[]) => h.consommation(...a),
}));
vi.mock("@/server/qualiopi/documents/documents-service", () => ({ generateDocument: vi.fn() }));
vi.mock("@/server/actions/qualiopi/documents", () => ({ genererConventionAction: vi.fn() }));
vi.mock("@/lib/telegram", () => ({ sendTelegram: vi.fn() }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn() }));

import { createDevisAction } from "../devis";

const LIGNE = { designation: "Formation fictive", quantite: 1, prixUnitaireHtCents: 600_000 };
const OPCO = {
  financementSuggere: "opco" as const,
  nbParticipants: 2,
  dureeHeures: 14,
  modaliteOpco: "intra" as const,
};

function base(client: Record<string, unknown>) {
  const { db, etat } = fausseBaseDevis({ collisionsAuCreate: 0 });
  (db as { client: unknown }).client = { findUnique: async () => client };
  h.db = db;
  return etat;
}

beforeEach(() => {
  h.estimer.mockReset();
  h.consommation.mockReset();
  h.estimer.mockResolvedValue({
    montantPriseEnChargeCents: 100_000,
    resteAChargeCents: 500_000,
    origine: "bareme",
    avertissement: "Enveloppe annuelle 2027 diminuée de …",
  });
  h.consommation.mockResolvedValue({ annee: 2027, accordeCents: 300_000, enCoursCents: 50_000 });
});

describe("l'estimation du devis déduit ce que l'OPCO a déjà pris", () => {
  it("asOf = début prévu de la session ; consommation de l'année de la session, OPCO typé", async () => {
    const etat = base({
      opco: "atlas",
      opcoIdentifie: "akto",
      idcc: null,
      opcoEnveloppeAnnuelleCents: 900_000,
    });
    const r = await createDevisAction({
      clientId: CLIENT,
      lignes: [LIGNE],
      ...OPCO,
      dateDebutSessionPrevue: "2027-02-08",
    });
    expect("data" in r).toBe(true);
    expect(h.consommation).toHaveBeenCalledWith(CLIENT, "atlas", 2027);
    const entree = h.estimer.mock.calls[0]![0] as Record<string, unknown>;
    expect((entree["asOf"] as Date).toISOString().slice(0, 10)).toBe("2027-02-08");
    expect(entree["opco"]).toBe("atlas");
    expect(entree["enveloppeAnnuelleClientCents"]).toBe(900_000);
    expect(entree["consommationAnnee"]).toEqual({
      annee: 2027,
      accordeCents: 300_000,
      enCoursCents: 50_000,
    });
    expect(entree).not.toHaveProperty("enveloppeRestanteCents");
    expect(etat.devis[0]!["opcoEstimationAvertissement"]).toContain("diminuée");
  });

  it("enveloppe saisie sur le devis → prime, aucune lecture de consommation", async () => {
    base({ opco: "atlas", opcoIdentifie: null, idcc: null, opcoEnveloppeAnnuelleCents: null });
    await createDevisAction({
      clientId: CLIENT,
      lignes: [LIGNE],
      ...OPCO,
      opcoEnveloppeRestanteCents: 200_000,
    });
    expect(h.consommation).not.toHaveBeenCalled();
    const entree = h.estimer.mock.calls[0]![0] as Record<string, unknown>;
    expect(entree["enveloppeRestanteCents"]).toBe(200_000);
  });

  it("contre-témoin : sans date de session, asOf = date de validité (J+30)", async () => {
    base({ opco: null, opcoIdentifie: "atlas", idcc: null, opcoEnveloppeAnnuelleCents: null });
    const avant = Date.now();
    await createDevisAction({ clientId: CLIENT, lignes: [LIGNE], ...OPCO });
    const entree = h.estimer.mock.calls[0]![0] as Record<string, unknown>;
    const asOf = (entree["asOf"] as Date).getTime();
    expect(asOf - avant).toBeGreaterThan(29 * 86_400_000);
    // Ancien champ seul : `opcoDuClient` le reprend quand il est un identifiant connu.
    expect(entree["opco"]).toBe("atlas");
  });

  it("consommation illisible (null) → estimation sans déduction", async () => {
    h.consommation.mockResolvedValue(null);
    base({ opco: "atlas", opcoIdentifie: null, idcc: null, opcoEnveloppeAnnuelleCents: null });
    await createDevisAction({ clientId: CLIENT, lignes: [LIGNE], ...OPCO });
    const entree = h.estimer.mock.calls[0]![0] as Record<string, unknown>;
    expect(entree).not.toHaveProperty("consommationAnnee");
  });

  it("date de session mal formée → refus", async () => {
    base({ opco: "atlas", opcoIdentifie: null, idcc: null, opcoEnveloppeAnnuelleCents: null });
    const r = await createDevisAction({
      clientId: CLIENT,
      lignes: [LIGNE],
      ...OPCO,
      dateDebutSessionPrevue: "08/02/2027",
    });
    expect("error" in r).toBe(true);
  });
});
