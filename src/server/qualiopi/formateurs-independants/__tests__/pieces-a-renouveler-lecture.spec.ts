/** Lot L13 — lecture console : indépendants actifs seulement, fiches à jour écartées. */

import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  fiches: [] as unknown[],
  docs: [] as unknown[],
  argsFiches: null as unknown,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainer: {
      findMany: async (a: unknown) => {
        d.argsFiches = a;
        return d.fiches;
      },
    },
    trainerDocument: { findMany: async () => d.docs },
  },
}));

import { lirePiecesARenouveler } from "../pieces-a-renouveler-lecture";

const MAINTENANT = new Date("2026-10-12T08:00:00Z");
const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const doc = (trainerId: string, type: string, dateEmission: Date) => ({
  id: `${trainerId}-${type}`,
  trainerId,
  type,
  statutValidation: "valide",
  fichierUrl: "r2://x",
  dateEmission,
  dateExpiration: type === "assurance_rc_pro" ? new Date("2027-12-01T00:00:00Z") : null,
  createdAt: dateEmission,
  archiveAt: null,
  rejetMotif: null,
  valideAt: dateEmission,
});

beforeEach(() => {
  d.fiches = [
    { id: A, prenom: "A", nom: "Alpha" },
    { id: B, prenom: "B", nom: "Bravo" },
  ];
  const recent = new Date("2026-09-01T00:00:00Z");
  d.docs = [
    doc(A, "attestation_vigilance_urssaf", recent),
    doc(A, "assurance_rc_pro", recent),
    doc(A, "cv", recent),
    doc(B, "attestation_vigilance_urssaf", new Date("2026-03-01T00:00:00Z")),
    doc(B, "assurance_rc_pro", recent),
    doc(B, "cv", recent),
  ];
});

describe("lirePiecesARenouveler", () => {
  it("ne lit que les indépendants actifs sans fin de collaboration", async () => {
    await lirePiecesARenouveler(MAINTENANT);
    expect(d.argsFiches).toMatchObject({
      where: { statut: "sous_traitant", actif: true, finCollaborationAt: null },
      take: 500,
    });
  });

  it("écarte un dossier à jour ; garde celui dont l'attestation est échue", async () => {
    const l = await lirePiecesARenouveler(MAINTENANT);
    expect(l.map((x) => x.trainerId)).toEqual([B]);
    expect(l[0]!.pieces.find((p) => p.type === "attestation_vigilance_urssaf")!.etat.etat).toBe(
      "echue",
    );
  });
});
