import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * **UNE FICHE MÉTHODE N'EST JAMAIS PUBLIABLE, JAMAIS LUE PAR UN LECTEUR PUBLIC (ADR 0076).**
 *
 *   A. `executeTransition` refuse `published` ET `scheduled` (la programmation)
 *      pour une entrée `sourceFactoryId = "methode-import"`, sans aucune écriture ;
 *   B. `searchKnowledge`, `chercherDansKnowledgeEntry` et `fetchPublicKbList` /
 *      `fetchPublicKbBySlug` ne rendent jamais une entrée équipe / interne / approuvée.
 *
 * Base FACTICE, corpus inventé.
 */

// ─── A. La garde de publication ──────────────────────────────────────────────

const h = vi.hoisted(() => ({
  entry: {} as Record<string, unknown>,
  transaction: vi.fn(),
  update: vi.fn(),
  enqueue: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: vi.fn(async () => "127.0.0.1") }));
vi.mock("@/server/content-gen/indexing/enqueue", () => ({
  enqueueIndexingForUrls: (...a: unknown[]) => h.enqueue(...a),
}));
vi.mock("@/server/actions/knowledge/_audit", () => ({
  logKbActivity: (...a: unknown[]) => h.audit(...a),
}));
vi.mock("@/server/actions/knowledge/_revalidate", () => ({
  revalidateAdminKbRoutes: vi.fn(async () => undefined),
  revalidatePublicKbRoutes: vi.fn(async () => undefined),
}));

// ─── B. Base factice partagée par les lecteurs publics ───────────────────────

interface LigneFausse {
  slug: string;
  status: string;
  audience: string;
  confidentiality: string;
  publishedAt: Date | null;
  deletedAt: Date | null;
}

const METHODE: LigneFausse = {
  slug: "methode/faux-atelier/une-fiche",
  status: "approved",
  audience: "team",
  confidentiality: "internal",
  publishedAt: null,
  deletedAt: null,
};
const PUBLIQUE: LigneFausse = {
  slug: "fiche-publique-inventee",
  status: "published",
  audience: "public",
  confidentiality: "public",
  publishedAt: new Date("2026-01-01T00:00:00Z"),
  deletedAt: null,
};
const BASE: LigneFausse[] = [METHODE, PUBLIQUE];

/**
 * Évalue le SQL comme le ferait la base, mais SEULEMENT sur les garde-fous de
 * visibilité : une clause absente laisse passer la ligne (donc le test échoue).
 */
function appliquerGardesSql(sql: string, params: unknown[]): LigneFausse[] {
  const statutsListe = /ke\.status IN \(([^)]*)\)/.exec(sql);
  const statutEgal = /ke\.status = '(\w+)'/.exec(sql);
  const audienceEgal = /ke\.audience = '(\w+)'/.exec(sql);
  const audienceAny = /ke\.audience = ANY\(\$(\d+)/.exec(sql);
  const confEgal = /ke\.confidentiality = '(\w+)'/.exec(sql);
  return BASE.filter((l) => {
    if (statutsListe) {
      const ok = [...statutsListe[1]!.matchAll(/'(\w+)'/g)].map((m) => m[1]);
      if (!ok.includes(l.status)) return false;
    }
    if (statutEgal && l.status !== statutEgal[1]) return false;
    if (audienceEgal && l.audience !== audienceEgal[1]) return false;
    if (audienceAny) {
      const liste = params[Number(audienceAny[1]) - 1] as string[];
      if (!liste.includes(l.audience)) return false;
    }
    if (confEgal && l.confidentiality !== confEgal[1]) return false;
    if (/ke\.deleted_at IS NULL/.test(sql) && l.deletedAt) return false;
    return true;
  });
}

function appliquerGardesWhere(where: Record<string, unknown>): LigneFausse[] {
  return BASE.filter((l) => {
    if (where.status !== undefined && l.status !== where.status) return false;
    if (where.audience !== undefined && l.audience !== where.audience) return false;
    if (where.confidentiality !== undefined && l.confidentiality !== where.confidentiality)
      return false;
    if (where.deletedAt === null && l.deletedAt) return false;
    const pub = where.publishedAt as { lte?: Date } | undefined;
    if (pub?.lte && (!l.publishedAt || l.publishedAt > pub.lte)) return false;
    return true;
  });
}

const queryRawUnsafeMock = vi.fn(async (sql: string, ...params: unknown[]) => {
  if (/COUNT\(\*\)/.test(sql)) return [{ count: BigInt(appliquerGardesSql(sql, params).length) }];
  return appliquerGardesSql(sql, params).map((l) => ({
    entryId: l.slug,
    translationId: l.slug,
    type: "doctrine",
    slug: l.slug,
    title: "Titre inventé",
    excerpt: null,
    locale: "fr",
    rank: 1,
  }));
});

const queryRawMock = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
  const sql = strings.join("?");
  return appliquerGardesSql(sql, values).map((l) => ({
    slug: l.slug,
    type: "doctrine",
    title: "Titre inventé",
    excerpt: null,
    body_text: "Texte inventé.",
  }));
});

const findManyMock = vi.fn(async (args: { where: Record<string, unknown> }) =>
  appliquerGardesWhere(args.where).map((l) => ({
    type: "doctrine",
    publishedAt: l.publishedAt,
    translations: [{ slug: l.slug, title: "Titre inventé", excerpt: null, readingTime: 1 }],
  })),
);

const translationFindFirstMock = vi.fn(
  async (args: { where: { slug: string; entry: Record<string, unknown> } }) => {
    const ligne = appliquerGardesWhere(args.where.entry).find((l) => l.slug === args.where.slug);
    if (!ligne) return null;
    return {
      slug: ligne.slug,
      title: "Titre inventé",
      excerpt: null,
      body: "<p>Texte inventé.</p>",
      metaTitle: null,
      metaDescription: null,
      readingTime: 1,
      wordCount: 3,
      updatedAt: new Date(),
      entry: { type: "doctrine", publishedAt: ligne.publishedAt },
    };
  },
);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    knowledgeEntry: {
      findUnique: vi.fn(async () => h.entry),
      findMany: (...a: unknown[]) => findManyMock(...(a as [never])),
    },
    knowledgeTranslation: { findFirst: (...a: unknown[]) => translationFindFirstMock(...(a as [never])) },
    knowledgeVersion: { findFirst: vi.fn(async () => null) },
    $transaction: (...a: unknown[]) => h.transaction(...a),
    $queryRawUnsafe: (...a: unknown[]) => queryRawUnsafeMock(...(a as [string])),
    $queryRaw: (...a: unknown[]) => queryRawMock(...(a as [TemplateStringsArray])),
  },
}));
vi.mock("@/server/chatbot/retrieval/hybrid-search", () => ({
  hybridSearch: vi.fn(),
  reciprocalRankFusion: vi.fn(),
}));

import { executeTransition } from "@/server/actions/knowledge/_transition";
import { searchKnowledge } from "@/lib/knowledge/search-fts";
import { fetchPublicKbBySlug, fetchPublicKbList } from "@/lib/knowledge/public-fetch";
import { chercherDansKnowledgeEntry } from "@/server/chatbot/retrieval/knowledge-entry-search";

const CONTEXTE = { userRole: "admin", userId: "u-faux" } as never;

function entree(extra: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "e-faux",
    slug: "methode/faux-atelier/une-fiche",
    type: "doctrine",
    status: "approved",
    deletedAt: null,
    createdById: "u-faux",
    sourceFactoryId: null,
    translations: [],
    tags: [],
    outgoingRelations: [],
    ...extra,
  };
}

describe("A · executeTransition refuse de publier ou de programmer une fiche Méthode", () => {
  beforeEach(() => {
    h.transaction.mockReset().mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({ knowledgeEntry: { update: h.update }, knowledgeVersion: { create: vi.fn() } }),
    );
    h.update.mockReset();
    h.audit.mockReset();
    h.enqueue.mockReset();
  });

  for (const cible of ["published", "scheduled"] as const) {
    it(`vers « ${cible} » : refusé, aucune transaction, aucune écriture, aucun audit`, async () => {
      h.entry = entree({ sourceFactoryId: "methode-import" });
      const r = await executeTransition({
        entryId: "e-faux",
        toStatus: cible,
        auditAction: cible === "published" ? "kb.published" : "kb.scheduled",
        context: CONTEXTE,
        extraEntryUpdates: cible === "scheduled" ? { scheduledFor: new Date("2030-01-01") } : {},
      });
      expect(r.ok).toBe(false);
      expect(h.transaction).not.toHaveBeenCalled();
      expect(h.update).not.toHaveBeenCalled();
      expect(h.audit).not.toHaveBeenCalled();
      expect(h.enqueue).not.toHaveBeenCalled();
    });
  }

  it("la garde vaut même depuis un état « scheduled » (passage programmé → publié)", async () => {
    h.entry = entree({ sourceFactoryId: "methode-import", status: "scheduled" });
    const r = await executeTransition({
      entryId: "e-faux",
      toStatus: "published",
      auditAction: "kb.published",
      context: { ...(CONTEXTE as object), system: true } as never,
    });
    expect(r.ok).toBe(false);
    expect(h.update).not.toHaveBeenCalled();
  });

  it("une fiche d'une autre source n'est pas concernée par la garde", async () => {
    h.entry = entree({ sourceFactoryId: "autre-source" });
    const r = await executeTransition({
      entryId: "e-faux",
      toStatus: "published",
      auditAction: "kb.published",
      context: CONTEXTE,
    });
    expect(h.transaction).toHaveBeenCalled();
    expect(r.ok).toBe(true);
  });
});

describe("B · aucun lecteur public ne rend une entrée équipe / interne / approuvée", () => {
  it("searchKnowledge, même avec audiences « team » demandées", async () => {
    for (const audiences of [undefined, ["team"], ["public", "team"]] as const) {
      const r = await searchKnowledge({
        query: "vitrine",
        locale: "fr",
        ...(audiences ? { audiences: [...audiences] as never } : {}),
      });
      expect(r.hits.map((x) => x.slug)).not.toContain(METHODE.slug);
      expect(r.hits.map((x) => x.slug)).toEqual([PUBLIQUE.slug]);
      expect(r.total).toBe(1);
    }
  });

  it("chercherDansKnowledgeEntry (lecteur du chatbot)", async () => {
    const r = await chercherDansKnowledgeEntry("vitrine");
    expect(r.map((x) => x.sourceRef)).toEqual([PUBLIQUE.slug]);
  });

  it("fetchPublicKbList et fetchPublicKbBySlug", async () => {
    const liste = await fetchPublicKbList();
    expect(liste.map((x) => x.slug)).toEqual([PUBLIQUE.slug]);
    expect(await fetchPublicKbBySlug(METHODE.slug)).toBeNull();
    expect((await fetchPublicKbBySlug(PUBLIQUE.slug))?.slug).toBe(PUBLIQUE.slug);
  });

  it("l'évaluateur de la base factice est sensible : sans garde, la fiche Méthode sortirait", () => {
    expect(appliquerGardesSql("SELECT 1", [])).toContain(METHODE);
  });
});
