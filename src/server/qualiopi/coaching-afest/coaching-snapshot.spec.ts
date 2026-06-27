/**
 * Tests — snapshot légal anti-stale 1-to-1 / AFEST (WS9).
 * Helpers purs + ensureCoachingSnapshot idempotent (prisma mocké).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { coachingSession: { update: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import {
  buildCoachingSnapshot,
  readCoachingForDocs,
  isUsableCoachingSnapshot,
  ensureCoachingSnapshot,
  AFEST_MODALITE,
  type CoachingSnapshotSource,
} from "./coaching-snapshot";

const FIXED = new Date("2026-06-27T12:00:00.000Z");

// "coaching-decouverte" est un slug connu du catalogue coaching-options.
const source: CoachingSnapshotSource = {
  interventionSlug: "coaching-decouverte",
  objectifsPedagogiques: [{ libelle: "Optimiser le poste" }],
  heuresPrevuesConvention: 14,
  certificationType: "aucune",
  codeRncp: null,
  codeRs: null,
  numeroEnregistrementFc: null,
};

const mockPrisma = prisma as unknown as {
  coachingSession: { update: ReturnType<typeof vi.fn> };
};

beforeEach(() => vi.clearAllMocks());

describe("buildCoachingSnapshot", () => {
  it("résout l'intitulé depuis le slug (pas le slug brut)", () => {
    const snap = buildCoachingSnapshot(source, FIXED);
    expect(snap.v).toBe(1);
    expect(snap.intitule).toBe("Collaborateur · Optimisation du poste"); // label, pas le slug
    expect(snap.modalite).toBe(AFEST_MODALITE);
    expect(snap.capturedAt).toBe("2026-06-27T12:00:00.000Z");
  });

  it("coerce les heures (Decimal-like ou number) en number", () => {
    expect(
      buildCoachingSnapshot({ ...source, heuresPrevuesConvention: 21 }, FIXED)
        .heuresPrevuesConvention,
    ).toBe(21);
    // Decimal Prisma expose toString()
    const decimalLike = { toString: () => "10.5" };
    expect(
      buildCoachingSnapshot({ ...source, heuresPrevuesConvention: decimalLike }, FIXED)
        .heuresPrevuesConvention,
    ).toBe(10.5);
    expect(
      buildCoachingSnapshot({ ...source, heuresPrevuesConvention: null }, FIXED)
        .heuresPrevuesConvention,
    ).toBeNull();
  });

  it("slug inconnu → intitulé = slug (fallback coachingInterventionLabel)", () => {
    const snap = buildCoachingSnapshot({ interventionSlug: "slug-inconnu-xyz" }, FIXED);
    expect(snap.intitule).toBe("slug-inconnu-xyz");
    expect(snap.objectifsPedagogiques).toBeNull();
  });
});

describe("readCoachingForDocs", () => {
  it("priorise le snapshot exploitable (intitulé figé)", () => {
    const snap = buildCoachingSnapshot(source, FIXED);
    // live a un slug DIFFÉRENT → si on lisait live, l'intitulé changerait.
    const r = readCoachingForDocs(snap, { interventionSlug: "dirigeant-vision-strategique" });
    expect(r.source).toBe("snapshot");
    expect(r.intitule).toBe("Collaborateur · Optimisation du poste"); // figé
  });

  it("repli LIVE si pas de snapshot (parcours legacy)", () => {
    const r = readCoachingForDocs(null, source);
    expect(r.source).toBe("live");
    expect(r.intitule).toBe("Collaborateur · Optimisation du poste");
    expect(r.heuresPrevuesConvention).toBe(14);
  });

  it("repli LIVE si snapshot corrompu (objet sans intitule)", () => {
    const r = readCoachingForDocs({ garbage: true }, source);
    expect(r.source).toBe("live");
  });
});

describe("isUsableCoachingSnapshot", () => {
  it("vrai uniquement si objet avec intitule string", () => {
    expect(isUsableCoachingSnapshot(buildCoachingSnapshot(source, FIXED))).toBe(true);
    expect(isUsableCoachingSnapshot(null)).toBe(false);
    expect(isUsableCoachingSnapshot({ intitule: 42 })).toBe(false);
    expect(isUsableCoachingSnapshot("x")).toBe(false);
  });
});

describe("ensureCoachingSnapshot (snapshot-on-first-emit)", () => {
  it("construit + PERSISTE le snapshot si absent", async () => {
    const cs = { id: "cs-1", coachingSnapshot: null, ...source };
    const snap = await ensureCoachingSnapshot(cs, FIXED);
    expect(snap.intitule).toBe("Collaborateur · Optimisation du poste");
    expect(mockPrisma.coachingSession.update).toHaveBeenCalledTimes(1);
    const arg = mockPrisma.coachingSession.update.mock.calls[0]![0];
    expect(arg.where).toEqual({ id: "cs-1" });
    expect(arg.data.coachingSnapshot.intitule).toBe("Collaborateur · Optimisation du poste");
  });

  it("réutilise le snapshot existant SANS réécriture (idempotent)", async () => {
    const existing = buildCoachingSnapshot(source, FIXED);
    const cs = { id: "cs-1", coachingSnapshot: existing, ...source };
    const snap = await ensureCoachingSnapshot(cs, new Date("2027-01-01T00:00:00.000Z"));
    expect(snap).toBe(existing); // même objet figé
    expect(mockPrisma.coachingSession.update).not.toHaveBeenCalled();
  });
});
