// « Enregistrer sans envoyer d'e-mail » (2026-10-05, demande de Will : ne pas écrire
// systématiquement à tout le monde, et pouvoir classer un rendez-vous non rattaché).
//
// Gardé ici : AUCUN e-mail ne part, quelle que soit l'issue ; le dossier en ligne
// n'est pas ouvert ; un rendez-vous NON rattaché s'enregistre ; « Non retenu » classe
// la fiche « Sans suite » quand elle existe ; ce n'est jamais un échange client.

import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
vi.mock("@/auth", () => ({ auth: () => auth() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/adm/${p}` }));
vi.mock("@/lib/rgpd-erase", () => ({ ERASED_PLACEHOLDER: "[effacé]" }));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string | null) => v }));

const db = { evenement: null as Record<string, unknown> | null };
const upsert = vi.fn();
const activityCreate = vi.fn();
const preparer = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    calendlyEvent: { findUnique: vi.fn(async () => db.evenement) },
    rendezVousSuivi: { upsert: (...a: unknown[]) => upsert(...a) },
    activityLog: { create: (...a: unknown[]) => activityCreate(...a) },
  },
}));
vi.mock("../issue-apporteur-envoi", () => ({
  preparerIssueApporteur: (...a: unknown[]) => preparer(...a),
  envoyerIssue: vi.fn(),
}));
const enqueueEmail = vi.fn();
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: (...a: unknown[]) => enqueueEmail(...a) }));
const appliquerTransition = vi.fn();
vi.mock("@/features/admin-submissions/transitions", () => ({
  appliquerTransition: (...a: unknown[]) => appliquerTransition(...a),
}));
const annulerRelances = vi.fn();
vi.mock("@/features/commercial-application/relances-lead-apporteur", () => ({
  annulerRelancesLeadApporteur: (...a: unknown[]) => annulerRelances(...a),
}));
vi.mock("@/lib/email/templates", () => ({ renderEmailTemplate: vi.fn() }));

import { enregistrerIssueApporteurAction } from "../issue-apporteur-actions";

const INITIAL = { etat: "initial" } as const;

function fd(issue: string): FormData {
  const f = new FormData();
  f.set("calendlyEventId", "evt_1");
  f.set("issueSansEmail", issue);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ user: { id: "adm_1", email: "will@axion-ia.com", role: "admin" } });
  db.evenement = {
    id: "evt_1",
    eventTypeName: "Échange apporteur d'affaires (15 min)",
    typeRendezVous: "apporteur",
    linkedSubmissionId: null,
  };
  upsert.mockResolvedValue({});
  appliquerTransition.mockResolvedValue({ ok: true });
});

describe("enregistrer l'issue sans envoyer d'e-mail", () => {
  it.each(["absent", "retenu", "non_retenu"])(
    "%s : le point s'écrit, aucun e-mail, aucun dossier ouvert, même sans fiche",
    async (issue) => {
      const r = await enregistrerIssueApporteurAction(INITIAL, fd(issue));
      expect(r.etat).toBe("ok");
      expect(upsert).toHaveBeenCalledTimes(1);
      expect(enqueueEmail).not.toHaveBeenCalled();
      expect(preparer).not.toHaveBeenCalled(); // ni aperçu, ni dossier en ligne
      expect(annulerRelances).not.toHaveBeenCalled();
      expect(activityCreate.mock.calls[0]?.[0]).toMatchObject({
        data: { changes: { issue, sansEmail: true } },
      });
      if (r.etat === "ok") expect(r.message).toContain("Aucun e-mail n'est parti");
    },
  );

  it("« Non retenu » classe la fiche rattachée « Sans suite » (arrête les relances)", async () => {
    db.evenement = { ...db.evenement, linkedSubmissionId: "sub_1" };
    const r = await enregistrerIssueApporteurAction(INITIAL, fd("non_retenu"));
    expect(r.etat).toBe("ok");
    expect(appliquerTransition).toHaveBeenCalledWith("sub_1", "sans-suite", "adm_1");
  });

  it("« Retenu » ne classe rien", async () => {
    db.evenement = { ...db.evenement, linkedSubmissionId: "sub_1" };
    await enregistrerIssueApporteurAction(INITIAL, fd("retenu"));
    expect(appliquerTransition).not.toHaveBeenCalled();
  });

  it("refuse un rendez-vous qui n'est pas un échange apporteur", async () => {
    db.evenement = {
      ...db.evenement,
      eventTypeName: "Diagnostic IA",
      typeRendezVous: "diagnostic",
    };
    const r = await enregistrerIssueApporteurAction(INITIAL, fd("absent"));
    expect(r.etat).toBe("erreur");
    expect(upsert).not.toHaveBeenCalled();
  });

  it("refuse sans session", async () => {
    auth.mockResolvedValue(null);
    const r = await enregistrerIssueApporteurAction(INITIAL, fd("absent"));
    expect(r.etat).toBe("erreur");
    expect(upsert).not.toHaveBeenCalled();
  });
});
