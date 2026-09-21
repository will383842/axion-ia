// Le rapprochement CRM ne réclame pas les dossiers apporteurs.
//
// ── Le faux positif que ce test empêche ───────────────────────────────────
// Le rapprochement quotidien (`crm-sync/reconcile.ts`) compare les submissions
// de la fenêtre aux lignes d'outbox émises. Toute submission sans ligne est
// déclarée « manquante », et le passage alerte (`alertCrmSync`).
//
// Depuis la décision B2 du 19/09, un dossier apporteur n'émet PLUS rien — par
// construction. Sans filtre, chacun serait compté manquant et chaque
// candidature produirait une alerte « émission perdue » qui n'en est pas une.
// Une alerte qui crie à tort apprend à ne plus lire : la vraie perte, côté
// clients, passerait ensuite inaperçue.
//
// Les deux sens sont testés : l'apporteur n'est PAS réclamé, le client l'est
// TOUJOURS. Un filtre qui viderait toute la famille rendrait le premier test
// vert en tuant le filet.
//
// ⚠️ Ce test vit hors de `src/server/crm-sync/` exprès : l'unité P2 n'y touche
// que le `loadIds` de `reconcile.ts` (critère d'arrêt).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { submission, outbox, siteSettingUpsert } = vi.hoisted(() => ({
  submission: { findMany: vi.fn() },
  outbox: { findMany: vi.fn() },
  siteSettingUpsert: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission,
    crmSyncOutbox: outbox,
    jobApplication: { findMany: async () => [] },
    calendlyEvent: { findMany: async () => [] },
    newsletterSubscriber: { findMany: async () => [] },
    customerReview: { findMany: async () => [] },
    siteSetting: { upsert: (...a: unknown[]) => siteSettingUpsert(...a) },
  },
}));
// L'alerte n'a rien à dire ici : `collectReconciliation` n'alerte jamais, et le
// vrai module tirerait Redis et le canal Sentry.
vi.mock("@/server/crm-sync/alerts", () => ({ alertCrmSync: async () => undefined }));

import { collectReconciliation } from "@/server/crm-sync/reconcile";

const APPORTEUR = { unifiedType: "recrutement", subType: "candidature-commerciale" };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRM_SYNC_ENABLED = "true";
  delete process.env.CRM_SYNC_CANDIDATES_ENABLED;
  siteSettingUpsert.mockImplementation((args: { create: { value: string } }) =>
    Promise.resolve({ value: args.create.value }),
  );
  // Aucune ligne d'outbox : tout ce qui est compté est « manquant ».
  outbox.findMany.mockResolvedValue([]);
});

afterEach(() => {
  delete process.env.CRM_SYNC_ENABLED;
});

async function familleSubmission() {
  const rapport = await collectReconciliation();
  return rapport.families.find((f) => f.family === "submission");
}

describe("rapprochement CRM — famille submission (B2, 19/09)", () => {
  it("un dossier apporteur sans ligne d'outbox n'est PAS compté manquant", async () => {
    submission.findMany.mockResolvedValue([{ id: "s-apporteur", details: APPORTEUR }]);
    const famille = await familleSubmission();
    expect(famille?.missing, "le dossier apporteur n'émet plus rien, par décision").toBe(0);
    expect(famille?.missingIds).toEqual([]);
  });

  it("une submission client sans ligne d'outbox l'est TOUJOURS", async () => {
    // Contre-témoin : le filet doit continuer de voir une vraie perte.
    submission.findMany.mockResolvedValue([
      { id: "s-apporteur", details: APPORTEUR },
      { id: "s-client", details: { unifiedType: "projet" } },
    ]);
    const famille = await familleSubmission();
    expect(famille?.missing).toBe(1);
    expect(famille?.missingIds).toEqual(["site:submission:s-client"]);
  });

  it("le /contact « recrutement » (sans sous-type apporteur) reste réclamé", async () => {
    // Il reste soumis aux drapeaux du vivier CRM (ADR 0051 § l) : ce n'est pas
    // un dossier apporteur, son absence d'émission est une vraie anomalie.
    submission.findMany.mockResolvedValue([
      { id: "s-contact-recrutement", details: { unifiedType: "recrutement" } },
    ]);
    const famille = await familleSubmission();
    expect(famille?.missingIds).toEqual(["site:submission:s-contact-recrutement"]);
  });

  it("le tri se fait EN MÉMOIRE : la requête ne porte aucun NOT sur un chemin JSON", async () => {
    // 🔑 Un `NOT` Prisma sur un chemin JSON EXCLUT aussi les lignes où la clé
    // est absente (SQL : NULL n'est ni égal ni différent). Toutes les demandes
    // clients sans `subType` disparaîtraient du rapprochement, en silence.
    submission.findMany.mockResolvedValue([]);
    await familleSubmission();
    const args = submission.findMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
      select: Record<string, unknown>;
    };
    expect(JSON.stringify(args.where)).not.toContain("NOT");
    expect(JSON.stringify(args.where)).not.toContain("details");
    expect(args.select).toEqual({ id: true, details: true });
  });
});
