/**
 * Tests — createCoachingParcoursAction (parcours vente 1-to-1, 2026-08-05).
 *
 * Principe couvert : l'ADMIN crée le parcours et affecte le formateur (la
 * seule création existante vivait dans l'espace formateur). Gardes : slug SSOT
 * uniquement, formateur actif, devis accepté du même client, chronologie des
 * séances.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => {
  const mock = {
    trainer: { findUnique: vi.fn() },
    client: { findUnique: vi.fn() },
    devis: { findUnique: vi.fn() },
    coachingSession: { create: vi.fn() },
    // La transaction délègue au même mock : ce qu'on vérifie, c'est que les
    // creates passent bien PAR le client transactionnel.
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(mock)),
  };
  return { prisma: mock };
});

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-1", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "@/lib/prisma";
import { createCoachingParcoursAction } from "./coaching-parcours";

const mp = prisma as unknown as {
  trainer: { findUnique: ReturnType<typeof vi.fn> };
  client: { findUnique: ReturnType<typeof vi.fn> };
  devis: { findUnique: ReturnType<typeof vi.fn> };
  coachingSession: { create: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

const TRAINER_ID = "a1234567-89ab-cdef-0123-456789abcdef";
const CLIENT_ID = "b1234567-89ab-cdef-0123-456789abcdef";
const DEVIS_ID = "c1234567-89ab-cdef-0123-456789abcdef";

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    trainerId: TRAINER_ID,
    interventionSlug: "coaching-decouverte",
    beneficiaireNom: "Simone Blanc",
    beneficiaireEmail: "simone@investsun.fr",
    beneficiaireEntreprise: "INVEST SUN",
    seances: [
      { date: new Date("2026-09-01T09:00:00Z") },
      { date: new Date("2026-09-08T09:00:00Z") },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mp.trainer.findUnique.mockResolvedValue({ id: TRAINER_ID, actif: true, nom: "Durand" });
  mp.client.findUnique.mockResolvedValue({ id: CLIENT_ID });
  mp.devis.findUnique.mockResolvedValue({ id: DEVIS_ID, clientId: CLIENT_ID, statut: "accepte" });
  let n = 0;
  mp.coachingSession.create.mockImplementation(() => Promise.resolve({ id: `seance-${++n}` }));
});

describe("createCoachingParcoursAction", () => {
  it("crée une CoachingSession par séance, avec les rattachements CRM", async () => {
    const res = await createCoachingParcoursAction(
      baseInput({ clientId: CLIENT_ID, devisId: DEVIS_ID, estAfest: true }),
    );
    if (!("data" in res)) throw new Error(`attendu data, reçu ${JSON.stringify(res)}`);
    expect(res.data.count).toBe(2);
    expect(mp.coachingSession.create).toHaveBeenCalledTimes(2);
    const data = mp.coachingSession.create.mock.calls[0]![0].data;
    expect(data.trainerId).toBe(TRAINER_ID);
    expect(data.clientId).toBe(CLIENT_ID);
    expect(data.devisId).toBe(DEVIS_ID);
    expect(data.estAfest).toBe(true);
    expect(data.beneficiaireNom).toBe("Simone Blanc");
  });

  it("REFUSE un slug hors du SSOT des prestations 1-to-1", async () => {
    const res = await createCoachingParcoursAction(baseInput({ interventionSlug: "slug-invente" }));
    expect("error" in res).toBe(true);
    expect(mp.coachingSession.create).not.toHaveBeenCalled();
  });

  it("REFUSE un formateur inactif — l'affectation exige un formateur actif", async () => {
    mp.trainer.findUnique.mockResolvedValue({ id: TRAINER_ID, actif: false, nom: "X" });
    const res = await createCoachingParcoursAction(baseInput());
    expect("error" in res).toBe(true);
  });

  it("REFUSE un devis non accepté (brouillon)", async () => {
    mp.devis.findUnique.mockResolvedValue({
      id: DEVIS_ID,
      clientId: CLIENT_ID,
      statut: "brouillon",
    });
    const res = await createCoachingParcoursAction(
      baseInput({ clientId: CLIENT_ID, devisId: DEVIS_ID }),
    );
    expect("error" in res).toBe(true);
  });

  it("REFUSE un devis appartenant à un autre client", async () => {
    mp.devis.findUnique.mockResolvedValue({ id: DEVIS_ID, clientId: "autre", statut: "accepte" });
    const res = await createCoachingParcoursAction(
      baseInput({ clientId: CLIENT_ID, devisId: DEVIS_ID }),
    );
    expect("error" in res).toBe(true);
  });

  it("devisId SANS clientId : le client est DÉRIVÉ du devis (garde non contournable)", async () => {
    const res = await createCoachingParcoursAction(baseInput({ devisId: DEVIS_ID }));
    if (!("data" in res)) throw new Error(`attendu data, reçu ${JSON.stringify(res)}`);
    const data = mp.coachingSession.create.mock.calls[0]![0].data;
    // Sans dérivation, la séance porterait un devis sans son client — et la
    // garde d'appartenance était contournable en omettant clientId.
    expect(data.clientId).toBe(CLIENT_ID);
    expect(data.devisId).toBe(DEVIS_ID);
  });

  it("REFUSE une séance dont la fin précède le début", async () => {
    const res = await createCoachingParcoursAction(
      baseInput({
        seances: [
          {
            date: new Date("2026-09-01T10:00:00Z"),
            dateFin: new Date("2026-09-01T09:00:00Z"),
          },
        ],
      }),
    );
    expect("error" in res).toBe(true);
    expect(mp.coachingSession.create).not.toHaveBeenCalled();
  });

  it("exige au moins une séance", async () => {
    const res = await createCoachingParcoursAction(baseInput({ seances: [] }));
    expect("error" in res).toBe(true);
  });

  it("échec en cours de transaction → ActionResult erreur, jamais un throw", async () => {
    mp.$transaction.mockRejectedValueOnce(new Error("DB down"));
    const res = await createCoachingParcoursAction(baseInput());
    expect("error" in res).toBe(true);
  });

  it("les créations passent par le client TRANSACTIONNEL (pas de séance orpheline)", async () => {
    const res = await createCoachingParcoursAction(baseInput());
    expect("data" in res).toBe(true);
    expect(mp.$transaction).toHaveBeenCalledTimes(1);
  });
});
