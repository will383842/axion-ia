/**
 * Garde serveur contre le double envoi d'une réponse à un candidat : l'action
 * demande la garde, qui vit dans la transaction d'écriture
 * (`envoyer-reponse.verrou-doublon.spec.ts` prouve verrou → recherche → écriture).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const ecrire = vi.fn();
const replyFindMany = vi.fn();
const eventFindFirst = vi.fn();

vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: "u1", name: "Fondateur" } }) }));
vi.mock("@/server/auth/habilitations", () => ({ peutOuvrirDossierCandidat: () => true }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobApplication: {
      findUnique: async () => ({
        id: "11111111-1111-1111-1111-111111111111",
        email: "x",
        locale: "fr",
        status: "reviewing",
        offerTitleSnap: null,
        offer: null,
      }),
    },
    jobApplicationReply: { findMany: (...a: unknown[]) => replyFindMany(...a) },
    jobApplicationEvent: { findFirst: (...a: unknown[]) => eventFindFirst(...a) },
  },
}));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/admin/${p}` }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/features/admin-inbox/cache-tags", () => ({ INBOX_COUNTS_TAG: "t" }));
vi.mock("../envoyer-reponse", () => ({
  ecrireEtEnfilerReponse: (...a: unknown[]) => ecrire(...a),
}));
vi.mock("@/features/job-application/complement", () => ({ lienComplement: vi.fn() }));
vi.mock("@/lib/careers/formateur-freelance", () => ({ estCandidatureFormateurFreelance: vi.fn() }));
vi.mock("@/server/qualiopi/formateurs-independants/etats-entree", () => ({
  lireEtatsEntree: vi.fn(),
}));

import { repondreAuCandidatAction } from "../reply-actions";

const entree = {
  applicationId: "11111111-1111-1111-1111-111111111111",
  subject: "Votre candidature",
  bodyMarkdown: "Bonjour",
  modele: "libre" as const,
};

beforeEach(() => {
  ecrire.mockReset().mockResolvedValue({ ecrit: true, enfile: true, replyId: "neuve" });
  replyFindMany.mockReset();
  eventFindFirst.mockReset();
});

describe("repondreAuCandidatAction — double envoi", () => {
  it("🔴 la garde est confiée à la transaction d'écriture : aucune recherche hors transaction", async () => {
    await repondreAuCandidatAction(entree);
    expect(replyFindMany).not.toHaveBeenCalled();
    expect(eventFindFirst).not.toHaveBeenCalled();
    expect(ecrire.mock.calls[0]?.[3]).toEqual({ garderContreDoublon: true });
  });

  it("🔴 un doublon trouvé dans la transaction rend la MÊME réponse (idempotent)", async () => {
    ecrire.mockResolvedValue({ ecrit: false, error: "doublon", replyId: "deja" });
    const r = await repondreAuCandidatAction(entree);
    expect(r).toEqual({ ok: true, replyId: "deja" });
  });

  it("écrit normalement quand aucune réponse identique n'existe", async () => {
    const r = await repondreAuCandidatAction(entree);
    expect(r).toEqual({ ok: true, replyId: "neuve" });
    expect(ecrire).toHaveBeenCalledTimes(1);
  });
});
