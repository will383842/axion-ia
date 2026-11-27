// Anti-doublon : l'ouverture du dossier envoie le lien sous un jobId FIXE.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: async () => ({ user: { id: "u_1", email: "x@axion-ia.com", role: "admin" } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/adm/${p}` }));
vi.mock("@/lib/rgpd-erase", () => ({ ERASED_PLACEHOLDER: "[effacé]" }));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string | null) => v }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    calendlyEvent: {
      findUnique: vi.fn(async () => ({ id: "evt_1", linkedSubmissionId: "sub_1" })),
    },
    apporteurReseau: { findUnique: vi.fn(async () => null) },
    activityLog: { create: vi.fn(async () => ({})) },
  },
}));
vi.mock("../issue-apporteur-envoi", () => ({
  preparerIssueApporteur: vi.fn(),
  envoyerIssue: vi.fn(),
}));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn() }));
vi.mock("@/features/admin-submissions/transitions", () => ({ appliquerTransition: vi.fn() }));
vi.mock("@/features/commercial-application/relances-lead-apporteur", () => ({
  annulerRelancesLeadApporteur: vi.fn(),
}));
vi.mock("@/lib/email/templates", () => ({ renderEmailTemplate: vi.fn() }));

const ouvrir = vi.fn();
vi.mock("@/features/apporteurs-reseau/donnees", () => ({
  ouvrirDossierDepuisCandidature: (...a: unknown[]) => ouvrir(...a),
}));
const envoyerLien = vi.fn();
vi.mock("@/features/apporteurs-reseau/verification", () => ({
  envoyerLien: (...a: unknown[]) => envoyerLien(...a),
}));

import { ouvrirDossierEtEnvoyerLienAction } from "../issue-apporteur-actions";

beforeEach(() => {
  vi.clearAllMocks();
  ouvrir.mockImplementation(async (_id: string, o: { creer?: boolean }) =>
    o.creer
      ? {
          ok: true,
          apporteurId: "app_9",
          versionLien: 1,
          email: "a@b.fr",
          prenom: "A",
          statut: "x",
        }
      : { ok: false, ferme: false, message: "aucun" },
  );
  envoyerLien.mockResolvedValue({ ok: true, message: "Lien envoyé." });
});

describe("ouvrirDossierEtEnvoyerLienAction : jobId fixe", () => {
  it("passe `apporteur-dossier-lien-<id>-ouverture` à envoyerLien", async () => {
    const r = await ouvrirDossierEtEnvoyerLienAction({ calendlyEventId: "evt_1" });
    expect(r.etat).toBe("ok");
    expect(envoyerLien).toHaveBeenCalledTimes(1);
    expect(envoyerLien).toHaveBeenCalledWith(
      "app_9",
      null,
      undefined,
      false,
      "apporteur-dossier-lien-app_9-ouverture",
    );
  });
});
