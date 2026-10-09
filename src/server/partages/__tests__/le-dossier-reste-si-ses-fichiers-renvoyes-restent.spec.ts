// @vitest-environment node

/**
 * UN DOSSIER N'EST JAMAIS SUPPRIMÉ — NI ANNONCÉ « EFFACÉ » — TANT QUE LES
 * FICHIERS RENVOYÉS PAR LE CANDIDAT RESTENT DANS LE STOCKAGE
 * (relecture sécurité, 2026-10-08, lot L5b).
 *
 * Le fichier renvoyé (`origine = personne`) est rattaché au dossier par son
 * lien, sans clé étrangère : une fois le dossier supprimé, plus rien ne permet
 * de le retrouver. Si son effacement échoue (stockage injoignable, bibliothèque
 * éteinte), les deux chemins d'effacement MANUEL gardent donc le dossier :
 *
 *  - la suppression depuis la console rend une erreur claire ;
 *  - la demande art. 17 compte la candidature comme CONSERVÉE, pas supprimée.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  effacer: vi.fn(),
  supprimerDossier: vi.fn(async (_a: unknown) => ({})),
  deleteCv: vi.fn(async (_c: string | null) => undefined),
  videos: vi.fn(async (_id: string) => undefined),
}));

vi.mock("@/auth", () => ({
  auth: async () => ({ user: { id: "admin-1", role: "super_admin" } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.1" }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobApplication: {
      findUnique: async () => ({ cvStoragePath: "/cv/1.pdf", photoStoragePath: null }),
      // Par l'empreinte : la candidature ; le repli sans empreinte : rien.
      findMany: async (a: { where: { emailHash: string | null } }) =>
        a.where.emailHash === null
          ? []
          : [{ id: "c-1", cvStoragePath: "/cv/1.pdf", photoStoragePath: null }],
      delete: (a: unknown) => d.supprimerDossier(a),
    },
    activityLog: { create: async () => ({}) },
    jobApplicationInboundReply: { deleteMany: async () => ({ count: 0 }) },
  },
}));
vi.mock("@/server/careers/cv-storage", () => ({ deleteCv: (c: string | null) => d.deleteCv(c) }));
vi.mock("@/server/careers/videos-candidat", () => ({
  supprimerVideosCandidature: (id: string) => d.videos(id),
}));
vi.mock("@/server/partages/effacement-candidat", () => ({
  MSG_FICHIERS_NON_EFFACES:
    "Les fichiers renvoyés par le candidat n'ont pas pu être effacés du stockage ; réessayez.",
  effacerFichiersRenvoyesCandidature: (id: string) => d.effacer(id),
}));

import { deleteApplicationAction } from "@/features/admin-job-applications/actions";
import { effacerCandidaturesPour } from "@/server/careers/candidature-rgpd";

const ECHEC = {
  ok: false,
  effaces: 0,
  conserves: 1,
  erreur:
    "Les fichiers renvoyés par le candidat n'ont pas pu être effacés du stockage ; réessayez.",
};

function formulaire(): FormData {
  const f = new FormData();
  f.set("id", "c-1");
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env["PII_ENCRYPTION_KEY"] = "b".repeat(64);
  d.effacer.mockResolvedValue({ ok: true, effaces: 0, conserves: 0 });
});

describe("suppression depuis la console", () => {
  it("effacement des fichiers renvoyés en échec → dossier GARDÉ, erreur claire, rien d'autre effacé", async () => {
    d.effacer.mockResolvedValue(ECHEC);
    const r = await deleteApplicationAction({ ok: true }, formulaire());
    expect(r).toEqual({ ok: false, error: ECHEC.erreur });
    expect(d.supprimerDossier).not.toHaveBeenCalled();
    // Rien n'est entamé : ni CV, ni vidéos.
    expect(d.deleteCv).not.toHaveBeenCalled();
    expect(d.videos).not.toHaveBeenCalled();
  });

  it("témoin : effacement réussi → le dossier est supprimé", async () => {
    const r = await deleteApplicationAction({ ok: true }, formulaire());
    expect(r).toEqual({ ok: true });
    expect(d.supprimerDossier).toHaveBeenCalledTimes(1);
  });
});

describe("demande art. 17 (gdpr-erase)", () => {
  it("effacement des fichiers renvoyés en échec → candidature CONSERVÉE, jamais comptée supprimée", async () => {
    d.effacer.mockResolvedValue(ECHEC);
    const r = await effacerCandidaturesPour("alice@example.com");
    expect(r.supprimees).toBe(0);
    expect(r.conservees).toBe(1);
    expect(d.supprimerDossier).not.toHaveBeenCalled();
    expect(d.deleteCv).not.toHaveBeenCalled();
  });

  it("témoin : effacement réussi → la candidature est supprimée", async () => {
    const r = await effacerCandidaturesPour("alice@example.com");
    expect(r.supprimees).toBe(1);
    expect(r.conservees).toBe(0);
  });
});
