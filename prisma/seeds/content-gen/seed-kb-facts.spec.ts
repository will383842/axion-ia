import { describe, it, expect, vi } from "vitest";
import { planifierFiche, upsertFact, MARQUEUR_DOCTRINE } from "./seed-kb-facts";
import { verifierDoctrineFiche } from "../../../src/lib/knowledge/banned-words";

const propre = verifierDoctrineFiche({ fait: "Une PME peut commencer simplement." });
const fautive = verifierDoctrineFiche({ fait: "Nous sommes certifiés Qualiopi." });

describe("planifierFiche", () => {
  it("fiche propre et nouvelle : publiée", () => {
    expect(planifierFiche(null, propre)).toMatchObject({ statut: "published", raison: null });
  });
  it("fiche fautive et nouvelle : brouillon avec la raison", () => {
    const p = planifierFiche(null, fautive);
    expect(p.statut).toBe("draft");
    expect(p.raison).toMatch(/qualiopi/);
  });
  it.each(["archived", "deprecated"])("fiche %s : jamais republiée", (status) => {
    const p = planifierFiche({ status, deletedAt: null, briefMarkdown: null }, propre);
    expect(p).toMatchObject({ statut: "inchange", retiree: true });
  });
  it("fiche supprimée (deletedAt) : jamais republiée", () => {
    const p = planifierFiche(
      { status: "published", deletedAt: new Date(), briefMarkdown: null },
      propre,
    );
    expect(p).toMatchObject({ statut: "inchange", retiree: true });
  });
  it("fiche publiée qui viole la doctrine : repasse en brouillon", () => {
    expect(
      planifierFiche({ status: "published", deletedAt: null, briefMarkdown: null }, fautive).statut,
    ).toBe("draft");
  });
  it("brouillon choisi en console : jamais publié par le seed", () => {
    expect(
      planifierFiche({ status: "draft", deletedAt: null, briefMarkdown: "ma note" }, propre).statut,
    ).toBe("inchange");
  });
  it("brouillon posé par le seed puis corrigé : publié", () => {
    expect(
      planifierFiche(
        { status: "draft", deletedAt: null, briefMarkdown: `${MARQUEUR_DOCTRINE}x` },
        propre,
      ).statut,
    ).toBe("published");
  });
});

function fauxPrisma(existante: unknown) {
  const upsert = vi.fn(
    async (a: { create: { slug: string }; update: Record<string, unknown> }) => ({
      id: "e1",
      ...a.create,
    }),
  );
  return {
    upsert,
    prisma: {
      knowledgeEntry: { findUnique: vi.fn(async () => existante), upsert },
      knowledgeTranslation: { upsert: vi.fn(async () => ({ id: "t1" })) },
      knowledgeTag: { upsert: vi.fn(async () => ({ id: "g1" })) },
      knowledgeTagOnEntry: { upsert: vi.fn() },
      knowledgeServiceBinding: { upsert: vi.fn() },
    },
  };
}
const fait = (text: string) => ({
  id: "x-1",
  text,
  source: "Source",
  sourceUrl: "https://example.com",
  verifiedAt: "2026-05-01",
  verticales: ["villes"],
  confidence: 0.9,
});

describe("upsertFact", () => {
  it("fiche retirée : le seed n'écrit ni statut, ni deletedAt", async () => {
    const { prisma, upsert } = fauxPrisma({
      status: "archived",
      deletedAt: new Date(),
      briefMarkdown: null,
    });
    await upsertFact(prisma as never, fait("Une PME peut commencer simplement."));
    const update = upsert.mock.calls[0]![0].update as Record<string, unknown>;
    expect(update).not.toHaveProperty("status");
    expect(update).not.toHaveProperty("deletedAt");
    expect(update).not.toHaveProperty("audience");
  });
  it("fiche fautive : créée en brouillon avec la raison", async () => {
    const { prisma, upsert } = fauxPrisma(null);
    await upsertFact(prisma as never, fait("Notre siège est à Grenoble."));
    const create = upsert.mock.calls[0]![0].create as Record<string, unknown>;
    expect(create.status).toBe("draft");
    expect(String(create.briefMarkdown)).toContain("grenoble");
  });
});
