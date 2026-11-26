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

const { tx, prisma, emisPartages } = vi.hoisted(() => {
  const emisPartages = { liste: [] as Array<{ factureId: string; montantTtcCents: number }> };
  const tx = {
    garantieJourneeIa: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    activityLog: { create: vi.fn() },
    $executeRaw: vi.fn(),
  };
  const prisma = {
    // Simule le retour arrière : tout avoir « émis » dans une transaction qui échoue disparaît.
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => {
      const avant = emisPartages.liste.length;
      try {
        return await fn(tx);
      } catch (e) {
        emisPartages.liste.length = avant;
        throw e;
      }
    }),
    auditMission: { findUnique: vi.fn() },
    client: { findUnique: vi.fn() },
    garantieJourneeIa: { findUnique: vi.fn() },
  };
  return { tx, prisma, emisPartages };
});
vi.mock("@/lib/prisma", () => ({ prisma }));

const lireGarantie = vi.fn();
const dossiersDejaRembourses = vi.fn();
const resoudreFacturesGarantie = vi.fn();
vi.mock("@/server/garanties-journee-ia/lecture", () => ({
  lireGarantie: (...a: unknown[]) => lireGarantie(...a),
  dossiersDejaRembourses: (...a: unknown[]) => dossiersDejaRembourses(...a),
  resoudreFacturesGarantie: (...a: unknown[]) => resoudreFacturesGarantie(...a),
}));

// Faux `genererAvoirFacture` : rejoue les crochets comme le vrai (avant → création → après) dans
// la transaction simulée ; un compteur d'avoirs permet de prouver « un seul avoir ».
const FACTURE = "33333333-3333-4333-8333-333333333333";
const avoirsEmis = emisPartages.liste;
const genererAvoirFacture = vi.fn(
  async (input: { factureId: string; montantTtcCents?: number }, o: { tx?: typeof tx }) => {
    // Une seule voie, DANS la transaction de l'appelant (jamais de transaction propre ici).
    expect(o.tx).toBe(tx);
    avoirsEmis.push({ factureId: input.factureId, montantTtcCents: input.montantTtcCents ?? 0 });
    const n = avoirsEmis.length;
    return {
      avoirId: `44444444-4444-4444-8444-44444444444${3 + n}`,
      numero: `AXI-AVO-2026-00${n}`,
      documentId: null,
      montantHtCents: Math.round((input.montantTtcCents ?? 0) / 1.2),
      montantTtcCents: input.montantTtcCents ?? 0,
      produirePdf: pdf,
    };
  },
);
const pdf = vi.fn(async () => "doc");
vi.mock("@/server/qualiopi/financements/facture-libre", () => ({
  genererAvoirFacture: (...a: [never, never]) => genererAvoirFacture(...a),
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
const fact = (id: string, numero: string, rendableTtcCents: number) => ({
  id,
  numero,
  restantHtCents: Math.round(rendableTtcCents / 1.2),
  restantTtcCents: rendableTtcCents,
  rendableTtcCents,
  destinataire: "entreprise",
});
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
  avoirsEmis.length = 0;
  tx.garantieJourneeIa.findUnique.mockResolvedValue({
    decision: null,
    avoirId: null,
    virementLe: null,
    archiveLe: null,
  });
  resoudreFacturesGarantie.mockResolvedValue({
    ok: true,
    factures: [
      {
        id: FACTURE,
        numero: "AXI-FAC-2026-010",
        restantHtCents: 200000,
        restantTtcCents: 240000,
        rendableTtcCents: 240000,
        destinataire: "entreprise",
      },
    ],
  });
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
  const remb = (extra: Record<string, string> = {}) =>
    form({
      id: ID,
      decision: "remboursement",
      decisionLe: "2026-12-12",
      montantRembourseEuros: "2000",
      ...extra,
    });
  it("remboursement : ÉMET un avoir TTC lié à la facture, écrit la garantie et deux traces dans la même transaction", async () => {
    const r = await va(enregistrerDecisionGarantieJourneeIaAction(remb()));
    expect(r).toMatch(/ok=decision/);
    expect(avoirsEmis).toEqual([{ factureId: FACTURE, montantTtcCents: 200000 }]);
    expect(genererAvoirFacture.mock.calls[0]?.[0]).toMatchObject({
      factureId: FACTURE,
      montantTtcCents: 200000,
    });
    expect(tx.garantieJourneeIa.update.mock.calls[0]?.[0].data).toMatchObject({
      decision: "remboursement",
      montantRembourseCents: 200000,
      factureId: FACTURE,
      avoirId: "44444444-4444-4444-8444-444444444444",
    });
    const actions = tx.activityLog.create.mock.calls.map((c) => c[0].data.action);
    expect(actions).toEqual(["qualiopi.garantie_journee_ia.decision", "facturation.avoir.emettre"]);
  });
  it("remboursement : un avoirId saisi à la main est ignoré (c'est l'avoir émis qui est lié)", async () => {
    await va(
      enregistrerDecisionGarantieJourneeIaAction(
        remb({ avoirId: "55555555-5555-4555-8555-555555555555" }),
      ),
    );
    expect(tx.garantieJourneeIa.update.mock.calls[0]?.[0].data.avoirId).toBe(
      "44444444-4444-4444-8444-444444444444",
    );
  });
  it("remboursement : sans facture rattachée, financeur, ou montant > total payé → refus, aucun avoir", async () => {
    resoudreFacturesGarantie.mockResolvedValueOnce({ ok: false, message: "Aucune facture émise" });
    expect(await va(enregistrerDecisionGarantieJourneeIaAction(remb()))).toMatch(
      /erreur=Aucune%20facture/,
    );
    resoudreFacturesGarantie.mockResolvedValueOnce({
      ok: false,
      message: "Une facture est adressée à un financeur : à traiter à la main par le dirigeant",
    });
    expect(await va(enregistrerDecisionGarantieJourneeIaAction(remb()))).toMatch(/financeur/);
    resoudreFacturesGarantie.mockResolvedValueOnce({
      ok: true,
      factures: [fact("F1", "A", 60000)],
    });
    expect(await va(enregistrerDecisionGarantieJourneeIaAction(remb()))).toMatch(
      /erreur=.*d%C3%A9passe%20le%20total%20pay/,
    );
    expect(genererAvoirFacture).not.toHaveBeenCalled();
    expect(tx.garantieJourneeIa.update).not.toHaveBeenCalled();
  });
  describe("acompte + solde : un avoir par facture, atomique", () => {
    const ACOMPTE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const SOLDE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const deux = () =>
      resoudreFacturesGarantie.mockResolvedValue({
        ok: true,
        factures: [fact(ACOMPTE, "ACOMPTE", 53640), fact(SOLDE, "SOLDE", 125160)],
      });
    it("avoir TOTAL (178,80 + …) : un avoir sur le solde puis un sur l'acompte, total viré = somme", async () => {
      deux();
      const r = await va(
        enregistrerDecisionGarantieJourneeIaAction(remb({ montantRembourseEuros: "1788" })),
      );
      expect(r).toMatch(/ok=decision/);
      expect(avoirsEmis).toEqual([
        { factureId: SOLDE, montantTtcCents: 125160 },
        { factureId: ACOMPTE, montantTtcCents: 53640 },
      ]);
      expect(tx.garantieJourneeIa.update.mock.calls[0]?.[0].data).toMatchObject({
        montantRembourseCents: 178800,
        factureId: SOLDE,
      });
      const actions = tx.activityLog.create.mock.calls.map((c) => c[0].data.action);
      expect(actions).toEqual([
        "qualiopi.garantie_journee_ia.decision",
        "facturation.avoir.emettre",
        "facturation.avoir.emettre",
      ]);
      expect(pdf).toHaveBeenCalledTimes(2);
    });
    it("remboursement PARTIEL : ne touche que le solde", async () => {
      deux();
      await va(enregistrerDecisionGarantieJourneeIaAction(remb({ montantRembourseEuros: "1000" })));
      expect(avoirsEmis).toEqual([{ factureId: SOLDE, montantTtcCents: 100000 }]);
    });
    it("remboursement PARTIEL qui déborde : solde soldé, le reste sur l'acompte", async () => {
      deux();
      await va(enregistrerDecisionGarantieJourneeIaAction(remb({ montantRembourseEuros: "1500" })));
      expect(avoirsEmis).toEqual([
        { factureId: SOLDE, montantTtcCents: 125160 },
        { factureId: ACOMPTE, montantTtcCents: 24840 },
      ]);
    });
    it("montant > total payé : refus, aucun avoir", async () => {
      deux();
      const r = await va(
        enregistrerDecisionGarantieJourneeIaAction(remb({ montantRembourseEuros: "1788,01" })),
      );
      expect(r).toMatch(/erreur=/);
      expect(genererAvoirFacture).not.toHaveBeenCalled();
    });
    it("ATOMICITÉ : le second avoir échoue → aucun avoir ne reste, garantie non écrite, pas de PDF", async () => {
      deux();
      genererAvoirFacture.mockImplementationOnce(async (input) => {
        avoirsEmis.push({
          factureId: input.factureId,
          montantTtcCents: input.montantTtcCents ?? 0,
        });
        return {
          avoirId: "44444444-4444-4444-8444-444444444444",
          numero: "AXI-AVO-2026-001",
          documentId: null,
          montantHtCents: 104300,
          montantTtcCents: 125160,
          produirePdf: pdf,
        };
      });
      genererAvoirFacture.mockRejectedValueOnce(new Error("TVA ambiguë sur l'acompte"));
      const r = await va(
        enregistrerDecisionGarantieJourneeIaAction(remb({ montantRembourseEuros: "1788" })),
      );
      expect(r).toMatch(/erreur=TVA/);
      expect(avoirsEmis).toHaveLength(0);
      expect(tx.garantieJourneeIa.update).not.toHaveBeenCalled();
      expect(pdf).not.toHaveBeenCalled();
    });
    it("REJEU après succès : aucun nouvel avoir (le dossier porte le total)", async () => {
      deux();
      lireGarantie.mockResolvedValue({
        ...dossier,
        decision: "remboursement",
        decisionLe: "2026-12-12",
        montantRembourseCents: 178800,
        avoirId: "44444444-4444-4444-8444-444444444444",
      });
      const r = await va(
        enregistrerDecisionGarantieJourneeIaAction(remb({ montantRembourseEuros: "1788" })),
      );
      expect(r).toMatch(/ok=decision/);
      expect(genererAvoirFacture).not.toHaveBeenCalled();
    });
    it("DOUBLE CLIC simultané : le second voit l'avoir sous verrou, n'émet rien, et obtient le succès (mêmes valeurs)", async () => {
      deux();
      const ecrit = {
        ...dossier,
        decision: "remboursement",
        decisionLe: "2026-12-12",
        montantRembourseCents: 178800,
        avoirId: "44444444-4444-4444-8444-444444444444",
      };
      tx.garantieJourneeIa.findUnique
        .mockResolvedValueOnce({ decision: null, avoirId: null, virementLe: null, archiveLe: null })
        .mockResolvedValueOnce({
          decision: "remboursement",
          avoirId: "44444444-4444-4444-8444-444444444444",
          virementLe: null,
          archiveLe: null,
        });
      // 1er clic : dossier vierge ; 2e clic : lecture initiale vierge, puis relecture = état écrit.
      lireGarantie
        .mockResolvedValueOnce({ ...dossier })
        .mockResolvedValueOnce({ ...dossier })
        .mockResolvedValue(ecrit);
      const f = () => remb({ montantRembourseEuros: "1788" });
      expect(await va(enregistrerDecisionGarantieJourneeIaAction(f()))).toMatch(/ok=decision/);
      expect(await va(enregistrerDecisionGarantieJourneeIaAction(f()))).toMatch(/ok=decision/);
      expect(avoirsEmis).toHaveLength(2);
      expect(tx.garantieJourneeIa.update).toHaveBeenCalledTimes(1);
    });
    it("faux échec évité : l'autre clic a validé entre la lecture et la résolution des factures → succès, pas d'erreur", async () => {
      resoudreFacturesGarantie.mockResolvedValueOnce({
        ok: false,
        message: "Plus rien à rembourser",
      });
      lireGarantie.mockResolvedValueOnce({ ...dossier }).mockResolvedValue({
        ...dossier,
        decision: "remboursement",
        decisionLe: "2026-12-12",
        montantRembourseCents: 200000,
        avoirId: "44444444-4444-4444-8444-444444444444",
      });
      expect(await va(enregistrerDecisionGarantieJourneeIaAction(remb()))).toMatch(/ok=decision/);
      expect(genererAvoirFacture).not.toHaveBeenCalled();
    });
    it("part inatteignable : la transaction est annulée, message sur le TOTAL, rien d'émis", async () => {
      deux();
      resoudreFacturesGarantie.mockResolvedValueOnce({
        ok: true,
        factures: [{ ...fact("SO", "SO", 40_000), atteignable: (c: number) => c % 6 !== 3 }],
      });
      const r = await va(
        enregistrerDecisionGarantieJourneeIaAction(remb({ montantRembourseEuros: "100,05" })),
      );
      expect(r).toMatch(/erreur=.*total%20TTC/);
      expect(avoirsEmis).toHaveLength(0);
    });
  });
  it("DOUBLE CLIC après succès (avoir déjà lié, même montant) : aucun second avoir", async () => {
    lireGarantie.mockResolvedValue({
      ...dossier,
      decision: "remboursement",
      decisionLe: "2026-12-12",
      montantRembourseCents: 200000,
      avoirId: "44444444-4444-4444-8444-444444444444",
      factureId: FACTURE,
    });
    expect(await va(enregistrerDecisionGarantieJourneeIaAction(remb()))).toMatch(/ok=decision/);
    expect(genererAvoirFacture).not.toHaveBeenCalled();
    expect(avoirsEmis).toHaveLength(0);
  });
  it("DOUBLE CLIC simultané : le second relit sous verrou, voit l'avoir et n'en émet pas", async () => {
    // Les deux lectures initiales sont avant l'avoir ; la relecture sous verrou du second le voit.
    tx.garantieJourneeIa.findUnique
      .mockResolvedValueOnce({ decision: null, avoirId: null, virementLe: null, archiveLe: null })
      .mockResolvedValueOnce({
        decision: "remboursement",
        avoirId: "44444444-4444-4444-8444-444444444444",
        virementLe: null,
        archiveLe: null,
      });
    const premier = await va(enregistrerDecisionGarantieJourneeIaAction(remb()));
    const second = await va(enregistrerDecisionGarantieJourneeIaAction(remb()));
    expect(premier).toMatch(/ok=decision/);
    expect(second).toMatch(/erreur=.*vient%20d/);
    expect(avoirsEmis).toHaveLength(1);
    expect(tx.garantieJourneeIa.update).toHaveBeenCalledTimes(1);
  });
  it("avoir déjà émis : changer la date de réponse (même montant) est refusé, pas perdu en silence", async () => {
    lireGarantie.mockResolvedValue({
      ...dossier,
      decision: "remboursement",
      decisionLe: "2026-12-12",
      montantRembourseCents: 200000,
      avoirId: "44444444-4444-4444-8444-444444444444",
    });
    expect(
      await va(enregistrerDecisionGarantieJourneeIaAction(remb({ decisionLe: "2026-12-14" }))),
    ).toMatch(/erreur=L.avoir%20est%20%C3%A9mis/);
    expect(tx.garantieJourneeIa.update).not.toHaveBeenCalled();
  });
  it("double clic : si l'émission échoue sur verrou mais que l'avoir existe, redirection de succès", async () => {
    genererAvoirFacture.mockRejectedValueOnce(
      new Error("Un autre avoir vient d'être émis sur cette facture : recharger la page."),
    );
    lireGarantie.mockResolvedValueOnce({ ...dossier }).mockResolvedValueOnce({
      ...dossier,
      decision: "remboursement",
      decisionLe: "2026-12-12",
      montantRembourseCents: 200000,
      avoirId: "44444444-4444-4444-8444-444444444444",
    });
    expect(await va(enregistrerDecisionGarantieJourneeIaAction(remb()))).toMatch(/ok=decision/);
  });
  it("double clic simultané avec un AUTRE montant : pas de faux succès", async () => {
    genererAvoirFacture.mockRejectedValueOnce(new Error("Un autre avoir vient d'être émis"));
    lireGarantie.mockResolvedValueOnce({ ...dossier }).mockResolvedValueOnce({
      ...dossier,
      decision: "remboursement",
      decisionLe: "2026-12-12",
      montantRembourseCents: 150000,
      avoirId: "44444444-4444-4444-8444-444444444444",
    });
    expect(await va(enregistrerDecisionGarantieJourneeIaAction(remb()))).toMatch(
      /erreur=L.avoir%20est%20%C3%A9mis%20avec%20d.autres/,
    );
  });
  it("double clic simultané avec un AUTRE total des gains : pas de faux succès", async () => {
    genererAvoirFacture.mockRejectedValueOnce(new Error("Un autre avoir vient d'être émis"));
    lireGarantie.mockResolvedValueOnce({ ...dossier }).mockResolvedValueOnce({
      ...dossier,
      decision: "remboursement",
      decisionLe: "2026-12-12",
      montantRembourseCents: 200000,
      totalGainsCents: 100000,
      avoirId: "44444444-4444-4444-8444-444444444444",
    });
    expect(
      await va(enregistrerDecisionGarantieJourneeIaAction(remb({ totalGainsEuros: "5000" }))),
    ).toMatch(/erreur=/);
  });
  it("avoir déjà émis : changer la note (même montant) est refusé", async () => {
    lireGarantie.mockResolvedValue({
      ...dossier,
      decision: "remboursement",
      decisionLe: "2026-12-12",
      montantRembourseCents: 200000,
      motifDecision: "ancienne",
      avoirId: "44444444-4444-4444-8444-444444444444",
    });
    expect(
      await va(enregistrerDecisionGarantieJourneeIaAction(remb({ motifDecision: "nouvelle" }))),
    ).toMatch(/erreur=/);
  });
  it("une erreur technique Prisma n'est jamais recopiée dans l'URL", async () => {
    const e = Object.assign(new Error("Invalid `prisma.x()` SECRET"), {
      name: "PrismaClientKnownRequestError",
    });
    genererAvoirFacture.mockRejectedValueOnce(e);
    const r = await va(enregistrerDecisionGarantieJourneeIaAction(remb()));
    expect(r).toMatch(/erreur=/);
    expect(r).not.toMatch(/SECRET/);
  });
  it("avoir déjà émis : changer de décision ou de montant est refusé (pièce émise, jamais supprimée)", async () => {
    lireGarantie.mockResolvedValue({
      ...dossier,
      decision: "remboursement",
      decisionLe: "2026-12-12",
      montantRembourseCents: 200000,
      avoirId: "44444444-4444-4444-8444-444444444444",
    });
    expect(
      await va(enregistrerDecisionGarantieJourneeIaAction(remb({ montantRembourseEuros: "100" }))),
    ).toMatch(/erreur=/);
    expect(
      await va(
        enregistrerDecisionGarantieJourneeIaAction(
          form({
            id: ID,
            decision: "refus",
            decisionLe: "2026-12-12",
            motifDecision: "motif assez long",
          }),
        ),
      ),
    ).toMatch(/erreur=/);
    expect(genererAvoirFacture).not.toHaveBeenCalled();
    expect(tx.garantieJourneeIa.update).not.toHaveBeenCalled();
  });
  it("un avoir « geste commercial » déjà lié n'est pas écrasé par un remboursement", async () => {
    lireGarantie.mockResolvedValue({
      ...dossier,
      decision: "avoir",
      decisionLe: "2026-12-12",
      avoirId: "55555555-5555-4555-8555-555555555555",
    });
    expect(await va(enregistrerDecisionGarantieJourneeIaAction(remb()))).toMatch(
      /geste%20commercial/,
    );
    expect(genererAvoirFacture).not.toHaveBeenCalled();
  });
  it("refus soumis pendant qu'un remboursement valide : relu sous verrou, rien n'est écrasé", async () => {
    tx.garantieJourneeIa.findUnique.mockResolvedValueOnce({
      decision: "remboursement",
      avoirId: "44444444-4444-4444-8444-444444444444",
      virementLe: null,
      archiveLe: null,
    });
    const r = await va(
      enregistrerDecisionGarantieJourneeIaAction(
        form({
          id: ID,
          decision: "refus",
          decisionLe: "2026-12-12",
          motifDecision: "motif assez long",
        }),
      ),
    );
    expect(r).toMatch(/erreur=.*vient%20d/);
    expect(tx.garantieJourneeIa.update).not.toHaveBeenCalled();
  });
  it("une erreur de l'émission de l'avoir (ex. plafond) est rendue à l'écran, sans écrire la garantie", async () => {
    genererAvoirFacture.mockRejectedValueOnce(new Error("Montant TTC impossible au taux de 20 %"));
    expect(await va(enregistrerDecisionGarantieJourneeIaAction(remb()))).toMatch(/erreur=Montant/);
    expect(tx.garantieJourneeIa.update).not.toHaveBeenCalled();
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
    // « Offrir un avoir » : chemin inchangé, AUCUNE facture d'avoir émise ici.
    expect(genererAvoirFacture).not.toHaveBeenCalled();
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
      avoirId: "44444444-4444-4444-8444-444444444444",
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
  it("virement refusé sans avoir émis, et si le montant viré diffère du TTC de l'avoir", async () => {
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
    ).toMatch(/mettre%20d.abord%20l.avoir/);
    lireGarantie.mockResolvedValue({
      ...dossier,
      decision: "remboursement",
      decisionLe: "2026-12-12",
      montantRembourseCents: 200000,
      avoirId: "44444444-4444-4444-8444-444444444444",
    });
    expect(
      await va(
        enregistrerVirementGarantieJourneeIaAction(
          form({ id: ID, virementLe: "2026-12-20", montantRembourseEuros: "1999" }),
        ),
      ),
    ).toMatch(/montant%20vir/);
    expect(tx.garantieJourneeIa.update).not.toHaveBeenCalled();
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
