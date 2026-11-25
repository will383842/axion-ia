/* eslint-disable @typescript-eslint/no-explicit-any -- doubles de base en mémoire */
import { beforeEach, describe, expect, it, vi } from "vitest";

// La console MASQUE une proposition dont le rendez-vous a été annulé / reporté / marqué absent.
type Ligne = Record<string, any>;
const bd = vi.hoisted(() => ({
  propositions: [] as Ligne[],
  events: [] as Ligne[],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string | null) => v }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    propositionRendezVousPresentation: { findMany: async () => bd.propositions },
    presentationEntreprise: {
      findMany: async () => [
        {
          id: "p1",
          denomination: "ACME",
          siren: "732829320",
          recueAt: new Date("2026-11-01T10:00:00Z"),
          apporteur: { prenom: "A", nom: "B" },
        },
      ],
    },
    calendlyEvent: {
      findUnique: async ({ where }: any) => bd.events.find((e) => e.id === where.id) ?? null,
    },
    rencontre: { findUnique: async () => null },
  },
}));

import { lirePropositionsATraiter } from "../requetes-console";

const prop = (cle: string) => ({
  id: `pr-${cle}`,
  presentationId: "p1",
  rendezVousCle: cle,
  motif: "email_exact",
  apporteurCite: false,
  prisAt: new Date("2026-11-05T10:00:00Z"),
  rendezVousAt: new Date("2026-11-10T10:00:00Z"),
});

beforeEach(() => {
  bd.propositions.length = 0;
  bd.events.length = 0;
  vi.stubEnv("DATABASE_URL", "postgresql://x:y@db:5432/z");
});

describe("lirePropositionsATraiter", () => {
  it("masque les rendez-vous annulés ou absents, garde les autres", async () => {
    bd.propositions.push(prop("calendly:ok"), prop("calendly:ann"), prop("calendly:abs"));
    const ev = (id: string, status: string) =>
      bd.events.push({ id, status, startTime: null, capturedAt: new Date(), rencontre: null });
    ev("ok", "scheduled");
    ev("ann", "canceled");
    ev("abs", "no_show");
    const r = await lirePropositionsATraiter(new Date("2026-11-20T10:00:00Z"));
    expect(r.map((x) => x.rendezVousCle)).toEqual(["calendly:ok"]);
  });
});
