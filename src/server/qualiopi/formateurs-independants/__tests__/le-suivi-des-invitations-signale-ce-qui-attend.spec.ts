/**
 * V1-A-2 et V1-A-4 — ce que la console dit d'une candidature formateur qui n'a pas été
 * invitée (le motif) ou qui l'a été sans suite (la tuile « à décider »).
 * Base factice en mémoire, comme `l-invitation-formateur-part-une-fois-par-personne`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Cand {
  id: string;
  email: string;
  emailHash: string | null;
  firstName: string;
  status: string;
  origine: string;
  submittedAt: Date;
  offerTitleSnap: string | null;
  natureCollaboration: string | null;
  invitationFormateurAt: Date | null;
  rattrapageAt: Date | null;
  clotureSansSuiteAt: Date | null;
  trainerId: string | null;
  offer: null;
  answers?: unknown;
}
const base = {
  candidatures: [] as Cand[],
  rdv: [] as Array<{ linkedJobApplicationId: string | null }>,
  reponses: [] as Array<{ applicationId: string; receivedAt: Date }>,
  oppositions: [] as Array<{ emailHash: string }>,
};
vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobApplication: {
      findUnique: vi.fn(
        async ({ where }: { where: { id: string } }) =>
          base.candidatures.find((c) => c.id === where.id) ?? null,
      ),
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        if (where.emailHash) {
          const ins = (where.emailHash as { in: string[] }).in;
          return base.candidatures.filter((c) => c.emailHash && ins.includes(c.emailHash));
        }
        return base.candidatures.filter((c) => c.invitationFormateurAt || c.rattrapageAt);
      }),
    },
    calendlyEvent: { findMany: vi.fn(async () => base.rdv) },
    submission: { findMany: vi.fn(async () => []) },
    jobApplicationInboundReply: { findMany: vi.fn(async () => base.reponses) },
    reponseEntranteFormateur: { findMany: vi.fn(async () => []) },
    trainer: { findMany: vi.fn(async () => []) },
    emailOpposition: { findMany: vi.fn(async () => base.oppositions) },
    emailLog: { findMany: vi.fn(async () => []) },
  },
}));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string) => v.replace(/^enc:/, "") }));

import {
  listerInvitationsADecider,
  motifAttenteInvitation,
  resumeInvitationDeLaFiche,
} from "../suivi-invitations";

const M = new Date("2026-10-30T10:00:00Z");
const JOUR = 86_400_000;
let n = 0;
function cand(o: Partial<Cand> = {}): Cand {
  n += 1;
  return {
    id: `0b7c3a52-4a0e-4d4c-9f43-${String(n).padStart(12, "0")}`,
    email: `enc:p${n}@example.com`,
    emailHash: `h${n}`,
    firstName: "enc:Camille",
    status: "new",
    origine: "formulaire",
    submittedAt: new Date(M.getTime() - 20 * JOUR),
    offerTitleSnap: "Formateur IA freelance",
    natureCollaboration: "freelance",
    invitationFormateurAt: null,
    rattrapageAt: null,
    clotureSansSuiteAt: null,
    trainerId: null,
    offer: null,
    ...o,
  };
}
const invitee = (joursAvant: number, o: Partial<Cand> = {}) =>
  cand({ invitationFormateurAt: new Date(M.getTime() - joursAvant * JOUR), ...o });

beforeEach(() => {
  n = 0;
  base.candidatures = [];
  base.rdv = [];
  base.reponses = [];
  base.oppositions = [];
});

describe("V1-A-4 — la tuile « à décider »", () => {
  it("liste la personne invitée depuis plus de 14 jours, sans réservation ni réponse", async () => {
    const silencieuse = invitee(15);
    base.candidatures = [silencieuse, invitee(10), invitee(15, { status: "rejected" })];
    const l = await listerInvitationsADecider(M);
    expect(l.map((x) => x.candidatureId)).toEqual([silencieuse.id]);
  });

  it("ne liste pas celle qui a réservé, répondu, ou été close « sans suite »", async () => {
    const reservee = invitee(15);
    const repondue = invitee(16);
    const close = invitee(20, { clotureSansSuiteAt: new Date(M.getTime() - JOUR) });
    base.candidatures = [reservee, repondue, close];
    base.rdv = [{ linkedJobApplicationId: reservee.id }];
    base.reponses = [{ applicationId: repondue.id, receivedAt: new Date(M.getTime() - 5 * JOUR) }];
    expect(await listerInvitationsADecider(M)).toEqual([]);
  });

  it("la phrase de la fiche dit « À décider » pour la même personne", async () => {
    const silencieuse = invitee(15);
    base.candidatures = [silencieuse];
    expect(await resumeInvitationDeLaFiche(silencieuse.id, M)).toMatch(/À décider/);
  });
});

describe("V1-A-2 — le motif qui retient l'invitation", () => {
  it("opposition : la fiche le dit au lieu de « Pas encore invitée »", async () => {
    const c = cand({ emailHash: "opp" });
    base.candidatures = [c];
    base.oppositions = [{ emailHash: "opp" }];
    expect(await motifAttenteInvitation(c.id)).toBe("opposition");
    expect(await resumeInvitationDeLaFiche(c.id, M)).toMatch(/opposée/);
  });

  it("SIRET du formulaire fermé au registre : « siret-ferme »", async () => {
    const c = cand({ answers: { "Numéro SIRET": "73282932000074" } });
    base.candidatures = [c];
    expect(await motifAttenteInvitation(c.id, async () => "ferme")).toBe("siret-ferme");
  });

  it("registre muet : « registre-muet » ; rien à signaler : null", async () => {
    const c = cand({ answers: { "Numéro SIRET": "73282932000074" } });
    base.candidatures = [c];
    expect(await motifAttenteInvitation(c.id, async () => "muet")).toBe("registre-muet");
    expect(await motifAttenteInvitation(c.id, async () => "ok")).toBeNull();
  });

  it("une candidature déjà invitée n'a pas de motif d'attente", async () => {
    const c = invitee(2);
    base.candidatures = [c];
    expect(await motifAttenteInvitation(c.id)).toBeNull();
  });
});
