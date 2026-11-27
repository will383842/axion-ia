// @vitest-environment node
/**
 * Bout en bout (facture unique) : décision « Rembourser » → avoir (`genererAvoirFacture`, simulé avec le
 * VRAI calcul HT de `htPourTtcAvoir`) → `reprendreApresAvoirsClients` → reprise d'une commission DÉJÀ
 * VERSÉE, au prorata arrondi au centime le plus proche. Aucun calcul de commission dans ce fichier :
 * on lit ce que le code de production demande de reprendre.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  factures: [] as Array<Record<string, unknown>>,
  lignes: [] as Array<Record<string, unknown>>,
  reprise: vi.fn(async (..._a: unknown[]) => ({ ok: true, message: "" })),
  maj: vi.fn(async (..._a: unknown[]) => ({ count: 1 })),
}));

vi.mock("next/navigation", () => ({
  redirect: (u: string) => {
    throw new Error(`REDIRECT:${u}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, s = "") => `/fr/adm/${s}` }));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: async () => ({ userId: "u1", role: "admin" }),
  requireHabilitation: async () => ({ userId: "u1", role: "admin" }),
  donneesJournalQualiopi: async (i: { action: string }) => ({ action: i.action }),
}));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: unknown) => v }));

type Where = Record<string, unknown>;
const dansIn = (v: unknown, x: unknown) =>
  v && typeof v === "object" && "in" in (v as object)
    ? ((v as { in: unknown[] }).in as unknown[]).includes(x)
    : true;
const prismaMock = vi.hoisted(() => {
  const p: Record<string, unknown> = {};
  return p;
});
vi.mock("@/lib/prisma", () => {
  const prisma = {
    factureFormation: {
      findMany: vi.fn(async ({ where }: { where: Where }) =>
        h.factures.filter((f) => {
          if (where.avoirDeId === null && f.avoirDeId !== null) return false;
          const a = where.avoirDeId as { not?: null } | undefined;
          if (a && typeof a === "object" && "not" in a && f.avoirDeId === null) return false;
          if (!dansIn(where.id, f.id) || !dansIn(where.devisId, f.devisId)) return false;
          return true;
        }),
      ),
      findUnique: vi.fn(
        async ({ where }: { where: { id: string } }) =>
          h.factures.find((f) => f.id === where.id) ?? null,
      ),
    },
    commissionApporteur: {
      findMany: vi.fn(async ({ where }: { where: Where }) =>
        "palier" in where ? [] : h.lignes.filter((l) => dansIn(where.factureId, l["factureId"])),
      ),
      updateMany: (...a: unknown[]) => h.maj(...a),
      create: vi.fn(async () => ({ id: "n" })),
      findFirst: vi.fn(async () => null),
    },
    garantieJourneeIa: { findUnique: vi.fn(), update: vi.fn() },
    activityLog: { create: vi.fn(async () => ({})) },
    apporteurReseau: { findUnique: vi.fn(async () => ({ prenom: "E", email: "e@x.fr" })) },
    $executeRaw: vi.fn(async () => 1),
    $transaction: vi.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(prisma)),
  };
  Object.assign(prismaMock, prisma);
  return { prisma };
});
vi.mock("@/features/apporteurs-reseau/litige", () => ({ litigeDisponible: async () => true }));
vi.mock("@/features/apporteurs-reseau/commissions", () => ({
  grilleDeLaLigne: vi.fn(async () => ({ grille: "v3", signeeAt: null })), // cas calibrés sur la grille v3
  statutApresVigilance: vi.fn(async () => ({ statut: "due", demander: false })),
  dejaEnvoye: vi.fn(async () => false),
}));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn(async () => ({ enqueued: true })) }));
vi.mock("@/features/apporteurs-reseau/envois", () => ({ envoyer: vi.fn(async () => "envoye") }));
vi.mock("@/features/apporteurs-reseau/signaler", () => ({ signalerErreurReseau: vi.fn() }));
vi.mock("@/features/apporteurs-reseau/manquement", () => ({ retenir: vi.fn() }));
vi.mock("@/features/apporteurs-reseau/resiliation", () => ({
  PREFIXE_PALIER_REPRISE: "reprise:",
  enregistrerReprise: (...a: unknown[]) => h.reprise(...a),
}));
vi.mock("@/features/apporteurs-reseau/ajustement", async (orig) => {
  const vrai = await orig<typeof import("@/features/apporteurs-reseau/ajustement")>();
  return {
    commissionPourPrixConserve: vrai.commissionPourPrixConserve,
    partDuParrain: vrai.partDuParrain,
    annulerCommission: vi.fn(async () => ({ ok: true })),
    reduireCommission: vi.fn(async () => ({ ok: true })),
  };
});

const lecture = vi.hoisted(() => ({
  lireGarantie: vi.fn(),
  resoudreFacturesGarantie: vi.fn(),
}));
vi.mock("@/server/garanties-journee-ia/lecture", () => ({
  lireGarantie: (...a: unknown[]) => lecture.lireGarantie(...a),
  dossiersDejaRembourses: async () => [],
  resoudreFacturesGarantie: (...a: unknown[]) => lecture.resoudreFacturesGarantie(...a),
}));

// Faux `genererAvoirFacture` : MÊME conversion TTC → HT que la production (`htPourTtcAvoir`), et
// l'avoir naît tel que le vrai code le crée : `avoirDeId` = origine, HT négatif, **sans devisId**.
vi.mock("@/server/qualiopi/financements/facture-libre", async () => {
  const { htPourTtcAvoir } = await import("../facture-libre-pur");
  return {
    genererAvoirFacture: async (input: { factureId: string; montantTtcCents: number }) => {
      const conv = htPourTtcAvoir(input.montantTtcCents, "assujetti", 20, 20);
      if (!conv.ok) throw new Error(conv.message);
      h.factures.push({
        id: `AV-${h.factures.length}`,
        devisId: null,
        statut: "emise",
        avoirDeId: input.factureId,
        montantHtCents: -conv.htCents,
        emiseAt: new Date("2026-12-12T10:00:00Z"),
        createdAt: new Date("2026-12-12T10:00:00Z"),
      });
      return {
        avoirId: "AV-1",
        numero: "AXI-AVO-2026-001",
        documentId: null,
        montantHtCents: conv.htCents,
        montantTtcCents: input.montantTtcCents,
      };
    },
  };
});

import { enregistrerDecisionGarantieJourneeIaAction } from "@/server/actions/qualiopi/garanties-journee-ia";
import { reprendreApresAvoirsClients } from "@/features/apporteurs-reseau/avoir-client";
import { PALIER_JOURNEE_IA } from "@/features/apporteurs-reseau/regles";

const ID = "11111111-1111-4111-8111-111111111111";
const LE = new Date("2026-12-15T11:00:00Z");
const form = (montant: string) => {
  const f = new FormData();
  f.set("id", ID);
  f.set("decision", "remboursement");
  f.set("decisionLe", "2026-12-12");
  f.set("montantRembourseEuros", montant);
  return f;
};
const decider = (montant: string) =>
  enregistrerDecisionGarantieJourneeIaAction(form(montant)).then(
    () => "ok",
    (e: Error) => e.message,
  );

beforeEach(() => {
  vi.clearAllMocks();
  h.factures = [
    {
      id: "F1",
      devisId: "D1",
      statut: "payee",
      avoirDeId: null,
      montantHtCents: 149_000,
      emiseAt: new Date("2026-12-01T10:00:00Z"),
      createdAt: new Date("2026-12-01T10:00:00Z"),
      devis: { montantTotalHtCents: 149_000 },
    },
  ];
  // Commission de 500 € DÉJÀ VERSÉE sur la Journée IA (1 490 € HT).
  h.lignes = [
    {
      id: "c1",
      apporteurId: "a1",
      factureId: "F1",
      parrainage: false,
      statut: "versee",
      activite: "formation",
      palier: PALIER_JOURNEE_IA,
      prixPublicHtCents: 149_000,
      factureHtCents: 149_000,
      montantCents: 50_000,
      autofactureNumero: "AXI-APP-2026-0001",
      autofactureEmiseAt: new Date("2026-12-05T10:00:00Z"),
      verseeAt: new Date("2026-12-05T10:00:00Z"),
      creeAt: new Date("2026-12-02T10:00:00Z"),
    },
  ];
  lecture.lireGarantie.mockResolvedValue({
    id: ID,
    clientId: "c",
    decision: null,
    decisionLe: null,
    rapportRemisLe: "2026-12-03",
    demandeRecueLe: "2026-12-10",
    virementLe: null,
    archiveLe: null,
    prixHtCents: 149_000,
    montantRembourseCents: null,
    avoirId: null,
    motifDecision: null,
    totalGainsCents: null,
    devisId: "D1",
    auditMissionId: null,
    factureId: null,
  });
  lecture.resoudreFacturesGarantie.mockResolvedValue({
    ok: true,
    factures: [
      {
        id: "F1",
        numero: "AXI-FAC-2026-010",
        restantHtCents: 149_000,
        restantTtcCents: 178_800,
        rendableTtcCents: 178_800,
        destinataire: "entreprise",
      },
    ],
  });
  const p = prismaMock as {
    garantieJourneeIa: { findUnique: ReturnType<typeof vi.fn> };
  };
  p.garantieJourneeIa.findUnique.mockResolvedValue({
    decision: null,
    avoirId: null,
    virementLe: null,
    archiveLe: null,
  });
});

describe("décision → avoir → reprise de la commission versée", () => {
  it("remboursement PARTIEL 600 € TTC (500 € HT) → commission 332,21 € : reprise de 167,79 €", async () => {
    expect(await decider("600")).toMatch(/ok=decision/);
    const b = await reprendreApresAvoirsClients(LE);
    expect(b.reprises).toBe(1);
    expect(h.reprise).toHaveBeenCalledTimes(1);
    expect(h.reprise).toHaveBeenCalledWith(
      expect.objectContaining({ commissionId: "c1", demandeeCents: 50_000 - 33_221 }),
    );
  });
  it("remboursement TOTAL 1 788 € TTC → toute la commission (500 €) est reprise", async () => {
    expect(await decider("1788")).toMatch(/ok=decision/);
    await reprendreApresAvoirsClients(LE);
    expect(h.reprise).toHaveBeenCalledWith(
      expect.objectContaining({ commissionId: "c1", demandeeCents: 50_000 }),
    );
  });
  it("sans décision (aucun avoir) : rien n'est repris", async () => {
    await reprendreApresAvoirsClients(LE);
    expect(h.reprise).not.toHaveBeenCalled();
  });
  describe("devis acompte (447 € HT) + solde (1 043 € HT), commission portée par le solde", () => {
    const deux = () => {
      h.factures = [
        { ...h.factures[0], id: "AC", montantHtCents: 44_700 },
        { ...h.factures[0], id: "F1", montantHtCents: 104_300 },
      ];
      lecture.resoudreFacturesGarantie.mockResolvedValue({
        ok: true,
        factures: [
          {
            id: "AC",
            numero: "AC",
            restantHtCents: 44_700,
            restantTtcCents: 53_640,
            rendableTtcCents: 53_640,
            destinataire: "entreprise",
          },
          {
            id: "F1",
            numero: "SO",
            restantHtCents: 104_300,
            restantTtcCents: 125_160,
            rendableTtcCents: 125_160,
            destinataire: "entreprise",
          },
        ],
      });
    };
    it("remboursement TOTAL : un avoir par facture, toute la commission reprise (avoir sur l'acompte vu)", async () => {
      deux();
      expect(await decider("1788")).toMatch(/ok=decision/);
      const avoirs = h.factures.filter((f) => f["avoirDeId"] !== null);
      expect(avoirs.map((a) => a["avoirDeId"])).toEqual(["F1", "AC"]);
      await reprendreApresAvoirsClients(LE);
      expect(h.reprise).toHaveBeenCalledWith(
        expect.objectContaining({ commissionId: "c1", demandeeCents: 50_000 }),
      );
    });
    it("avoir posé sur l'ACOMPTE seul (Hub) : la commission du solde est reprise au prorata (150 €)", async () => {
      deux();
      h.factures.push({
        id: "AVAC",
        devisId: null,
        statut: "emise",
        avoirDeId: "AC",
        montantHtCents: -44_700,
        emiseAt: new Date("2026-12-12T10:00:00Z"),
        createdAt: new Date("2026-12-12T10:00:00Z"),
      });
      await reprendreApresAvoirsClients(LE);
      expect(h.reprise).toHaveBeenCalledWith(
        expect.objectContaining({ commissionId: "c1", demandeeCents: 15_000 }),
      );
    });
  });
});
