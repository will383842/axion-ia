// Tests — garanties-journee-ia.ts : gardes, refus, écriture + trace dans la même transaction.
import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: (u: string) => redirect(u) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin-path", () => ({
  adminPath: (_l: string, s = "") => `/fr/adm${s ? `/${s}` : ""}`,
}));

const requireAdminWrite = vi.fn();
const requireHabilitation = vi.fn();
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: () => requireAdminWrite(),
  requireHabilitation: (a: string) => requireHabilitation(a),
  donneesJournalQualiopi: vi.fn(async (i: { action: string }) => ({ action: i.action })),
}));

const { tx, prisma } = vi.hoisted(() => {
  const tx = {
    garantieJourneeIa: { create: vi.fn(), update: vi.fn() },
    activityLog: { create: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    auditMission: { findUnique: vi.fn() },
    client: { findUnique: vi.fn() },
    garantieJourneeIa: { findUnique: vi.fn() },
  };
  return { tx, prisma };
});
vi.mock("@/lib/prisma", () => ({ prisma }));

const lireGarantie = vi.fn();
const dossiersDejaRembourses = vi.fn();
vi.mock("@/server/garanties-journee-ia/lecture", () => ({
  lireGarantie: (...a: unknown[]) => lireGarantie(...a),
  dossiersDejaRembourses: (...a: unknown[]) => dossiersDejaRembourses(...a),
}));

import {
  archiverGarantieJourneeIaAction,
  creerGarantieJourneeIaAction,
  enregistrerDatesGarantieJourneeIaAction,
  enregistrerDecisionGarantieJourneeIaAction,
  enregistrerVirementGarantieJourneeIaAction,
} from "./garanties-journee-ia";

const ID = "11111111-1111-4111-8111-111111111111";
const CID = "22222222-2222-4222-8222-222222222222";
const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const dossier = {
  id: ID,
  clientNom: "ACME",
  dateJournee: "2026-12-01",
  rapportRemisLe: "2026-12-03",
  demandeRecueLe: "2026-12-10",
  decision: null,
  decisionLe: null,
  virementLe: null,
  prixHtCents: 200000,
  seuilHtCents: 1000000,
  archiveLe: null,
  montantRembourseCents: null,
  sirenSnapshot: "123456789",
  avoirEmisLe: null,
  avoirId: null,
  notes: null,
  motifDecision: null,
  totalGainsCents: null,
  clientId: CID,
  devisId: null,
  auditMissionId: null,
  factureId: null,
};
const va = async (p: Promise<unknown>) =>
  await p.then(
    () => "ok",
    (e: Error) => e.message,
  );

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminWrite.mockResolvedValue({ userId: "u1", role: "admin" });
  requireHabilitation.mockResolvedValue({ userId: "u1", role: "admin" });
  lireGarantie.mockResolvedValue({ ...dossier });
  dossiersDejaRembourses.mockResolvedValue([]);
  tx.garantieJourneeIa.create.mockResolvedValue({ id: ID });
  prisma.client.findUnique.mockResolvedValue({ id: CID, siren: "123456789" });
  prisma.garantieJourneeIa.findUnique.mockResolvedValue(null);
});

describe("gardes", () => {
  it("décision et virement exigent l'habilitation « facturer » ; un refus de garde n'écrit rien", async () => {
    requireHabilitation.mockRejectedValue(new Error("forbidden: facturer"));
    expect(await va(enregistrerDecisionGarantieJourneeIaAction(form({ id: ID })))).toMatch(
      /forbidden/,
    );
    expect(await va(enregistrerVirementGarantieJourneeIaAction(form({ id: ID })))).toMatch(
      /forbidden/,
    );
    expect(requireHabilitation).toHaveBeenCalledWith("facturer");
    expect(tx.garantieJourneeIa.update).not.toHaveBeenCalled();
  });
  it("création, dates et archivage passent par requireAdminWrite", async () => {
    requireAdminWrite.mockRejectedValue(new Error("forbidden"));
    for (const a of [
      creerGarantieJourneeIaAction,
      enregistrerDatesGarantieJourneeIaAction,
      archiverGarantieJourneeIaAction,
    ]) {
      expect(await va(a(form({ id: ID })))).toBe("forbidden");
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("creerGarantieJourneeIaAction", () => {
  it("crée en centimes, fige le SIREN et trace dans la même transaction", async () => {
    const r = await va(
      creerGarantieJourneeIaAction(
        form({
          clientId: CID,
          dateJournee: "2026-12-01",
          prixHtEuros: "2000",
          seuilHtEuros: "10 000",
        }),
      ),
    );
    expect(r).toBe(`REDIRECT:/fr/adm/garanties-journee-ia/${ID}`);
    const data = tx.garantieJourneeIa.create.mock.calls[0]?.[0].data;
    expect(data).toMatchObject({
      prixHtCents: 200000,
      seuilHtCents: 1000000,
      sirenSnapshot: "123456789",
    });
    expect(tx.activityLog.create).toHaveBeenCalledTimes(1);
  });
  it("avertit si le SIREN a déjà été remboursé", async () => {
    dossiersDejaRembourses.mockResolvedValue([{ id: "x", dateJournee: "2026-01-01" }]);
    expect(
      await va(
        creerGarantieJourneeIaAction(
          form({
            clientId: CID,
            dateJournee: "2026-12-01",
            prixHtEuros: "2000",
            seuilHtEuros: "10000",
          }),
        ),
      ),
    ).toMatch(/avertissement=siren/);
  });
  it("reprend client, date, prix et devis de la mission", async () => {
    prisma.auditMission.findUnique.mockResolvedValue({
      clientId: CID,
      dateDebut: new Date("2026-12-02T00:00:00Z"),
      montantHtCents: 150000,
      devisId: null,
    });
    await va(creerGarantieJourneeIaAction(form({ auditMissionId: ID, seuilHtEuros: "9000" })));
    expect(tx.garantieJourneeIa.create.mock.calls[0]?.[0].data).toMatchObject({
      clientId: CID,
      prixHtCents: 150000,
      auditMissionId: ID,
    });
  });
  it("refuse un seuil illisible sans rien écrire", async () => {
    expect(
      await va(
        creerGarantieJourneeIaAction(
          form({
            clientId: CID,
            dateJournee: "2026-12-01",
            prixHtEuros: "2000",
            seuilHtEuros: "x",
          }),
        ),
      ),
    ).toMatch(/erreur=/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("décision, virement, archivage", () => {
  it("enregistre une décision de remboursement avec sa trace", async () => {
    const r = await va(
      enregistrerDecisionGarantieJourneeIaAction(
        form({
          id: ID,
          decision: "remboursement",
          decisionLe: "2026-12-12",
          montantRembourseEuros: "2000",
        }),
      ),
    );
    expect(r).toMatch(/ok=decision/);
    expect(tx.garantieJourneeIa.update.mock.calls[0]?.[0].data).toMatchObject({
      decision: "remboursement",
      montantRembourseCents: 200000,
    });
    expect(tx.activityLog.create).toHaveBeenCalledTimes(1);
  });
  it("enregistre un avoir plafonné à 4 470 € HT, sans note", async () => {
    const r = await va(
      enregistrerDecisionGarantieJourneeIaAction(
        form({ id: ID, decision: "avoir", decisionLe: "2026-12-12", montantAvoirEuros: "4470" }),
      ),
    );
    expect(r).toMatch(/ok=decision/);
    expect(tx.garantieJourneeIa.update.mock.calls[0]?.[0].data).toMatchObject({
      decision: "avoir",
      montantAvoirHtCents: 447000,
      montantRembourseCents: null,
    });
  });
  it("refuse un avoir au-dessus de 4 470 € ou sans montant", async () => {
    for (const montantAvoirEuros of ["4470,01", ""]) {
      expect(
        await va(
          enregistrerDecisionGarantieJourneeIaAction(
            form({ id: ID, decision: "avoir", decisionLe: "2026-12-12", montantAvoirEuros }),
          ),
        ),
      ).toMatch(/erreur=/);
    }
    expect(tx.garantieJourneeIa.update).not.toHaveBeenCalled();
  });
  it("refuse une décision sans demande reçue", async () => {
    lireGarantie.mockResolvedValue({ ...dossier, demandeRecueLe: null });
    expect(
      await va(
        enregistrerDecisionGarantieJourneeIaAction(
          form({
            id: ID,
            decision: "remboursement",
            decisionLe: "2026-12-12",
            montantRembourseEuros: "2000",
          }),
        ),
      ),
    ).toMatch(/erreur=/);
    expect(tx.garantieJourneeIa.update).not.toHaveBeenCalled();
  });
  it("refuse un virement quand aucun remboursement n'est dû", async () => {
    expect(
      await va(
        enregistrerVirementGarantieJourneeIaAction(
          form({ id: ID, virementLe: "2026-12-11", montantRembourseEuros: "2000" }),
        ),
      ),
    ).toMatch(/erreur=/);
    expect(tx.garantieJourneeIa.update).not.toHaveBeenCalled();
  });
  it("accepte le virement après une décision de remboursement", async () => {
    lireGarantie.mockResolvedValue({
      ...dossier,
      decision: "remboursement",
      decisionLe: "2026-12-12",
      montantRembourseCents: 200000,
    });
    expect(
      await va(
        enregistrerVirementGarantieJourneeIaAction(form({ id: ID, virementLe: "2026-12-20" })),
      ),
    ).toMatch(/ok=virement/);
    expect(tx.garantieJourneeIa.update.mock.calls[0]?.[0].data).toMatchObject({
      montantRembourseCents: 200000,
    });
  });
  it("les dates refusent une demande sans rapport et un dossier archivé", async () => {
    lireGarantie.mockResolvedValue({ ...dossier, rapportRemisLe: null });
    expect(
      await va(
        enregistrerDatesGarantieJourneeIaAction(form({ id: ID, demandeRecueLe: "2026-12-10" })),
      ),
    ).toMatch(/erreur=/);
    lireGarantie.mockResolvedValue({ ...dossier, archiveLe: "2026-12-02T00:00:00.000Z" });
    expect(
      await va(
        enregistrerDatesGarantieJourneeIaAction(form({ id: ID, rapportRemisLe: "2026-12-03" })),
      ),
    ).toMatch(/archiv/);
    expect(tx.garantieJourneeIa.update).not.toHaveBeenCalled();
  });
  it("archive sans jamais supprimer", async () => {
    expect(await va(archiverGarantieJourneeIaAction(form({ id: ID, archiver: "oui" })))).toMatch(
      /ok=archive/,
    );
    expect(tx.garantieJourneeIa.update.mock.calls[0]?.[0].data.archiveLe).toBeInstanceOf(Date);
    expect((tx.garantieJourneeIa as Record<string, unknown>).delete).toBeUndefined();
  });
});
