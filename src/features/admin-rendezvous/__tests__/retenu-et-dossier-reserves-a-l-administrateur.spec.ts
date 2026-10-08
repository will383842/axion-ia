// « Retenu » et « Ouvrir le dossier » réservés à l'ADMINISTRATEUR (relecture de a1, 2026-10-08) :
// ils ouvrent un dossier d'apporteur (contrat, pièces, données personnelles). Un éditeur garde
// les autres issues ; le serveur refuse le reste, quel que soit l'écran.

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

import {
  apercuIssueApporteurAction,
  enregistrerIssueApporteurAction,
  ouvrirDossierEtEnvoyerLienAction,
} from "../issue-apporteur-actions";

const INITIAL = { etat: "initial" } as const;

function fd(issue: string): FormData {
  const f = new FormData();
  f.set("calendlyEventId", "evt_1");
  f.set("issueSansEmail", issue);
  return f;
}

function role(r: string): void {
  auth.mockResolvedValue({ user: { id: "u_1", email: "x@axion-ia.com", role: r } });
}

beforeEach(() => {
  vi.clearAllMocks();
  db.evenement = {
    id: "evt_1",
    eventTypeName: "Échange apporteur d'affaires (15 min)",
    typeRendezVous: "apporteur",
    linkedSubmissionId: null,
  };
  upsert.mockResolvedValue({});
  appliquerTransition.mockResolvedValue({ ok: true });
});

describe("rôle éditeur", () => {
  beforeEach(() => role("editor"));

  it("🔴 « Retenu » est refusé, rien n'est écrit", async () => {
    const r = await enregistrerIssueApporteurAction(INITIAL, fd("retenu"));
    expect(r).toMatchObject({ etat: "erreur" });
    expect(upsert).not.toHaveBeenCalled();
    expect(preparer).not.toHaveBeenCalled();
  });

  it("🔴 l'aperçu de « Retenu » est refusé aussi", async () => {
    const r = await apercuIssueApporteurAction({ calendlyEventId: "evt_1", issue: "retenu" });
    expect(r).toMatchObject({ etat: "erreur" });
    expect(preparer).not.toHaveBeenCalled();
  });

  it("🔴 « Ouvrir le dossier et envoyer le lien » est refusé, aucune lecture", async () => {
    const r = await ouvrirDossierEtEnvoyerLienAction({ calendlyEventId: "evt_1" });
    expect(r).toMatchObject({ etat: "erreur" });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("les autres issues restent permises (« Non retenu »)", async () => {
    const r = await enregistrerIssueApporteurAction(INITIAL, fd("non_retenu"));
    expect(r.etat).toBe("ok");
    expect(upsert).toHaveBeenCalledTimes(1);
  });
});

describe("administrateur", () => {
  it.each(["admin", "super_admin"])("%s : « Retenu » passe la garde", async (r) => {
    role(r);
    const res = await enregistrerIssueApporteurAction(INITIAL, fd("retenu"));
    expect(res.etat).toBe("ok");
    expect(upsert).toHaveBeenCalledTimes(1);
  });
});
