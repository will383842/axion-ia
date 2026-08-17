/**
 * Tests NÉGATIFS de l'aveu de troncature de la vue Dossiers.
 *
 * ## Ce que ces tests verrouillent, et pourquoi c'est plus qu'un affichage
 *
 * `dossiers-pipeline.ts` promet, à quinze lignes du plafond qui la contredit :
 *
 * > « Une prestation réalisée mais IMPAYÉE n'est JAMAIS soldée — et elle ne sort
 * > JAMAIS de la vue, quel que soit son âge. Faire vieillir une créance hors de
 * > l'écran, c'est exactement comme ça qu'on oublie de se faire payer. »
 *
 * Or la lecture est bornée à `TAKE_MAX` lignes **par source**, triées par
 * activité récente. Au-delà, une créance ancienne n'atteint même pas
 * `deriverStatutDossier` : **la garde métier est désarmée par une limite de
 * lecture**, et rien ne le disait.
 *
 * On ne déplace pas le plafond ici — c'est une décision de produit. On le rend
 * VISIBLE : un écran qui montre 200 lignes sur 1 187 sans le dire ne se lit pas
 * comme incomplet, il se lit comme exhaustif.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    devis: { findMany: vi.fn(), count: vi.fn() },
    trainingSession: { findMany: vi.fn(), count: vi.fn() },
    coachingSession: { findMany: vi.fn(), count: vi.fn() },
    auditMission: { findMany: vi.fn(), count: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { lireDossiersPipeline, TAKE_MAX } from "./dossiers-pipeline";

const MAINTENANT = new Date("2026-08-01T12:00:00Z");

/** `n` sessions vivantes minimales, telles que le `select` du module les lit. */
function sessions(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `s-${i}`,
    numero: `AXI-SESS-2026-${i}`,
    titreSession: "Formation",
    statut: "realisee",
    dateDebut: new Date("2026-01-05T09:00:00Z"),
    dateFin: new Date("2026-01-05T17:00:00Z"),
    updatedAt: new Date("2026-07-25T12:00:00Z"),
    client: { raisonSociale: "ACME" },
    documents: [],
    // Impayée : c'est le cas que le module promet de ne jamais faire disparaître.
    facturesFormation: [{ id: "f-1" }],
    dossiersFinancement: [],
  }));
}

describe("l'aveu de troncature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.devis.findMany).mockResolvedValue([]);
    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue([]);
    vi.mocked(prisma.coachingSession.findMany).mockResolvedValue([]);
    vi.mocked(prisma.auditMission.findMany).mockResolvedValue([]);
    vi.mocked(prisma.devis.count).mockResolvedValue(0);
    vi.mocked(prisma.trainingSession.count).mockResolvedValue(0);
    vi.mocked(prisma.coachingSession.count).mockResolvedValue(0);
    vi.mocked(prisma.auditMission.count).mockResolvedValue(0);
  });

  it("🔴 une source plafonnée le DÉCLARE, avec son total réel", async () => {
    // 200 lues, 1187 en base : 987 affaires n'ont pas été regardées.
    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue(sessions(TAKE_MAX) as never);
    vi.mocked(prisma.trainingSession.count).mockResolvedValue(1187);

    const lecture = await lireDossiersPipeline(MAINTENANT);

    expect(lecture.tronquee, "la troncature n'est pas déclarée").toBe(true);
    const src = lecture.sources.find((s) => s.source === "sessions");
    expect(src?.lues).toBe(TAKE_MAX);
    expect(src?.total).toBe(1187);
    expect(src?.tronquee).toBe(true);
  });

  it("aucune troncature quand tout tient sous le plafond", async () => {
    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue(sessions(3) as never);
    vi.mocked(prisma.trainingSession.count).mockResolvedValue(3);

    const lecture = await lireDossiersPipeline(MAINTENANT);

    expect(lecture.tronquee).toBe(false);
    expect(lecture.sources.every((s) => !s.tronquee)).toBe(true);
  });

  it("🔴 « je n'ai pas pu savoir » n'est PAS « il n'y a rien de plus »", async () => {
    // Une lecture en panne rendait [] — indiscernable d'une base vide. Afficher
    // une vue rassurante sur une panne est pire que ne rien afficher.
    vi.mocked(prisma.trainingSession.findMany).mockRejectedValue(new Error("DB indisponible"));

    const lecture = await lireDossiersPipeline(MAINTENANT);

    const src = lecture.sources.find((s) => s.source === "sessions");
    expect(src?.fiable, "une source en panne est déclarée fiable").toBe(false);
    // Et surtout : on n'accuse pas une troncature qu'on n'a pas pu mesurer.
    expect(src?.tronquee).toBe(false);
  });

  it("le total vient du MÊME filtre que les lignes — pas d'un count global", async () => {
    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue(sessions(2) as never);
    vi.mocked(prisma.trainingSession.count).mockResolvedValue(2);

    await lireDossiersPipeline(MAINTENANT);

    const whereFindMany = vi.mocked(prisma.trainingSession.findMany).mock.calls[0]?.[0]?.where;
    const whereCount = vi.mocked(prisma.trainingSession.count).mock.calls[0]?.[0]?.where;
    // Un `where` écrit deux fois diverge un jour : c'est ce qui a produit la
    // pastille « 2 » face à « Rien à traiter », documentée dans ce dépôt.
    expect(whereCount, "le count ne filtre pas comme le findMany").toEqual(whereFindMany);
  });

  it("les quatre sources sont déclarées, même vides — une absence se lit", async () => {
    const lecture = await lireDossiersPipeline(MAINTENANT);
    expect(lecture.sources.map((s) => s.source).sort()).toEqual([
      "audits",
      "coachings",
      "devis",
      "sessions",
    ]);
  });

  it("les lignes restent accessibles sous `colonnes` — aucune donnée perdue", async () => {
    vi.mocked(prisma.trainingSession.findMany).mockResolvedValue(sessions(1) as never);
    vi.mocked(prisma.trainingSession.count).mockResolvedValue(1);

    const lecture = await lireDossiersPipeline(MAINTENANT);

    // Réalisée + impayée → « à solder », quelle que soit son ancienneté.
    expect(lecture.colonnes.a_solder).toHaveLength(1);
  });
});
