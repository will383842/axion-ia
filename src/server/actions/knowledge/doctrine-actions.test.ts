/**
 * Actions serveur de la base de connaissance : la porte de doctrine, avec base simulée.
 * - fiche PUBLIQUE fautive : refusée (publish même avec forceOverride, restore,
 *   schedule-publish, create-entry, save-draft sur fiche en ligne, ingest) ;
 * - fiche INTERNE qui énonce la règle : acceptée.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  entry: { audience: "public", confidentiality: "public", status: "approved", deletedAt: null } as {
    audience: string;
    confidentiality: string;
    status: string;
    deletedAt: Date | null;
  },
  translations: [] as Array<Record<string, unknown>>,
  transition: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    knowledgeEntry: {
      findUnique: vi.fn(async () => ({ id: "e1", slug: "s", ...h.entry })),
      create: vi.fn(async () => ({ id: "e1" })),
    },
    knowledgeVersion: {
      findUnique: vi.fn(async () => ({
        entryId: "7d444840-9dc0-11d1-b245-5ffdce74fad2",
        version: 1,
        snapshotJson: { entry: { slug: "s" }, translations: h.translations },
      })),
      findFirst: vi.fn(async () => ({ version: 1 })),
    },
    knowledgeTranslation: { findMany: vi.fn(async () => h.translations) },
    knowledgeIngestRequest: {
      findUnique: vi.fn(async () => null),
      create: vi.fn(async () => ({})),
      update: vi.fn(async () => ({})),
    },
  },
}));
vi.mock("./_guards", () => ({
  requireAdminWrite: vi.fn(async () => ({ role: "admin", userId: "u1" })),
  requireAdminDelete: vi.fn(async () => ({ role: "admin", userId: "u1" })),
  requireAdminPublish: vi.fn(async () => ({ role: "admin", userId: "u1" })),
}));
vi.mock("./_transition", () => ({ executeTransition: h.transition }));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));
vi.mock("@/lib/request-ip", () => ({ getClientIp: vi.fn(async () => "127.0.0.1") }));

const FAUTIF = { title: "Siège", excerpt: null, body: "<p>Notre siège est à Grenoble.</p>" };
const ID = "7d444840-9dc0-11d1-b245-5ffdce74fad2";

beforeEach(() => {
  vi.clearAllMocks();
  h.entry = { audience: "public", confidentiality: "public", status: "approved", deletedAt: null };
  h.translations = [
    { locale: "fr", bodyText: null, metaTitle: null, metaDescription: null, ...FAUTIF },
  ];
});

describe("raisonDoctrineEntree", () => {
  it("fiche publique fautive : raison", async () => {
    const { raisonDoctrineEntree } = await import("./_doctrine");
    expect(await raisonDoctrineEntree(ID)).toMatch(/grenoble/i);
  });
  it.each([
    ["team", "internal"],
    ["will_only", "secret"],
    ["public", "internal"],
    ["team", "public"],
  ])("fiche interne (%s / %s) qui énonce la règle : passe", async (audience, confidentiality) => {
    h.entry = { ...h.entry, audience, confidentiality };
    const { raisonDoctrineEntree } = await import("./_doctrine");
    expect(await raisonDoctrineEntree(ID)).toBeNull();
  });
});

describe("transitions vers « en ligne »", () => {
  it("restore (deprecated → published) refusé", async () => {
    h.entry.status = "deprecated";
    const { restoreAction } = await import("./restore");
    const r = await restoreAction({ id: ID } as never);
    expect(r).toMatchObject({ ok: false, error: "banned_words_violation" });
    expect(h.transition).not.toHaveBeenCalled();
  });
  it("schedule-publish refusé", async () => {
    const { schedulePublishAction } = await import("./schedule-publish");
    const r = await schedulePublishAction({
      id: ID,
      scheduledFor: new Date(Date.now() + 86_400_000),
    } as never);
    expect(r).toMatchObject({ ok: false, error: "banned_words_violation" });
    expect(h.transition).not.toHaveBeenCalled();
  });
  it("publish refusé même avec forceOverride", async () => {
    const { publishAction } = await import("./publish");
    const r = await publishAction({ id: ID, forceOverride: true } as never);
    expect(r).toMatchObject({ ok: false, error: "banned_words_violation" });
    expect(h.transition).not.toHaveBeenCalled();
  });
  it("publish d'une fiche interne fautive : accepté", async () => {
    h.entry = { ...h.entry, audience: "team", confidentiality: "internal" };
    const { publishAction } = await import("./publish");
    const r = await publishAction({ id: ID, forceOverride: true } as never);
    expect(r).toMatchObject({ ok: true });
  });
});

describe("create-entry et save-draft", () => {
  const base = {
    slug: "fiche-test",
    type: "help_article",
    domain: "commercial",
    status: "published",
    translations: [{ locale: "fr", slug: "fiche-test", ...FAUTIF }],
  };
  it("create-entry publique en ligne : refusée avec raison", async () => {
    const { createEntryAction } = await import("./create-entry");
    const r = await createEntryAction({
      ...base,
      audience: "public",
      confidentiality: "public",
    } as never);
    expect(r).toMatchObject({ ok: false, error: "banned_words_violation" });
    expect(String(r.reason)).toMatch(/grenoble/i);
  });
  it("create-entry interne : non refusée par la doctrine", async () => {
    const { createEntryAction } = await import("./create-entry");
    const r = await createEntryAction({
      ...base,
      audience: "team",
      confidentiality: "internal",
    } as never);
    expect(r.error).not.toBe("banned_words_violation");
    expect(r.error).toBe("slug_already_used"); // la porte est passée, le mock du slug arrête ensuite
  });
  it("save-draft d'une fiche publique en ligne : refusé", async () => {
    h.entry.status = "published";
    const { saveDraftAction } = await import("./save-draft");
    const r = await saveDraftAction({ entryId: ID, locale: "fr", ...FAUTIF } as never);
    expect(r).toMatchObject({ ok: false, error: "banned_words_violation" });
  });
  it("save-draft d'une fiche interne en ligne : non refusé par la doctrine", async () => {
    h.entry = { ...h.entry, status: "published", audience: "team", confidentiality: "internal" };
    const { saveDraftAction } = await import("./save-draft");
    const r = await saveDraftAction({ entryId: ID, locale: "fr", ...FAUTIF } as never);
    expect(r).not.toMatchObject({ error: "banned_words_violation" });
  });
});

describe("ingest", () => {
  const payload = {
    idempotencyKey: "k1",
    type: "help_article",
    domain: "commercial",
    title: "Siège",
    body: "<p>Notre siège est à Grenoble.</p>",
    source: { factoryId: "f1" },
  };
  it("fiche destinée au public fautive : rejetée, texte de refus tracé", async () => {
    const { ingestEntry } = await import("./ingest");
    const { prisma } = await import("@/lib/prisma");
    const r = await ingestEntry(payload as never);
    expect(r).toMatchObject({ accepted: false, status: "rejected", rejectReason: "banned_words" });
    const update = vi.mocked(prisma.knowledgeIngestRequest.update).mock.calls[0]![0] as {
      data: { rejectReason: string };
    };
    expect(update.data.rejectReason).toMatch(/Doctrine : .*grenoble/i);
  });
  it("fiche interne : pas rejetée par la doctrine", async () => {
    const { ingestEntry } = await import("./ingest");
    const r = await ingestEntry({
      ...payload,
      audience: "team",
      confidentiality: "internal",
    } as never).catch(() => ({ rejectReason: "autre" }));
    expect(r.rejectReason).not.toBe("banned_words");
  });
});

describe("update-entry et rollback-version", () => {
  it("update-entry : fiche interne en ligne rendue publique avec un interdit : refusé", async () => {
    h.entry = { ...h.entry, status: "published", audience: "team", confidentiality: "internal" };
    const { updateEntryAction } = await import("./update-entry");
    const r = await updateEntryAction({
      id: ID,
      audience: "public",
      confidentiality: "public",
    } as never);
    expect(r).toMatchObject({ ok: false, error: "banned_words_violation" });
    expect(String(r.reason)).toMatch(/grenoble/i);
  });
  it("rollback-version : snapshot fautif sur fiche publique en ligne : refusé", async () => {
    h.entry.status = "published";
    const { rollbackVersionAction } = await import("./rollback-version");
    const r = await rollbackVersionAction({ entryId: ID, versionId: ID });
    expect(r).toMatchObject({ ok: false, error: "banned_words_violation" });
  });
});
