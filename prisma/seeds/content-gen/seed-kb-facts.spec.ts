import { describe, it, expect, vi } from "vitest";
import { planifierFiche, upsertFact, MARQUEUR_DOCTRINE } from "./seed-kb-facts";
import { verifierDoctrineFiche } from "../../../src/lib/knowledge/banned-words";

const propre = verifierDoctrineFiche({ fait: "Une PME peut commencer simplement." });
const fautive = verifierDoctrineFiche({ fait: "Nous citons Qualiopi." });

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
  it("brouillon de console + texte fautif : note conservée, jamais publié ensuite", () => {
    const e = { status: "draft", deletedAt: null, briefMarkdown: "ma note" };
    const p1 = planifierFiche(e, fautive);
    expect(p1).toMatchObject({ statut: "inchange", ecrireRaison: false });
    expect(planifierFiche(e, propre).statut).toBe("inchange");
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
  it("fiche retirée : aucune écriture de traduction", async () => {
    const { prisma } = fauxPrisma({ status: "deprecated", deletedAt: null, briefMarkdown: null });
    await upsertFact(prisma as never, fait("Notre siège est à Grenoble."));
    expect(prisma.knowledgeTranslation.upsert).not.toHaveBeenCalled();
  });
  it("brouillon du seed corrigé : publié ET remis en public", async () => {
    const { prisma, upsert } = fauxPrisma({
      status: "draft",
      deletedAt: null,
      briefMarkdown: `${MARQUEUR_DOCTRINE}x`,
    });
    await upsertFact(prisma as never, fait("Une PME peut commencer simplement."));
    const update = upsert.mock.calls[0]![0].update as Record<string, unknown>;
    expect(update).toMatchObject({
      status: "published",
      audience: "public",
      confidentiality: "public",
      briefMarkdown: null,
    });
  });
  it("fiche fautive : créée en brouillon avec la raison", async () => {
    const { prisma, upsert } = fauxPrisma(null);
    await upsertFact(prisma as never, fait("Notre siège est à Grenoble."));
    const create = upsert.mock.calls[0]![0].create as Record<string, unknown>;
    expect(create.status).toBe("draft");
    expect(String(create.briefMarkdown)).toContain("grenoble");
  });
});

describe("cohérence seed / console", () => {
  it("ce que le seed publie, la console ne le refuse pas (corps tel que le seed l'écrit)", async () => {
    const { verifierDoctrineTraduction } = await import("../../../src/lib/knowledge/banned-words");
    const { ALL_KB_FACTS } = await import("./seed-kb-facts");
    const incoherents: string[] = [];
    for (const f of ALL_KB_FACTS) {
      const seed = verifierDoctrineFiche({ fait: f.text }).length === 0;
      const console_ = verifierDoctrineTraduction({
        body: `<p>${f.text}</p><p><em>Source : <a href="${f.sourceUrl}" rel="noopener noreferrer">${f.source}</a></em></p>`,
        bodyText: `${f.text} Source : ${f.source}.`,
      }).valid;
      if (seed !== console_) incoherents.push(f.id);
    }
    // À corriger par Will : la source de form-075 contient « RNQ » (Qualiopi) ; le seed
    // ne contrôle que le texte du fait, la console contrôle aussi l'étiquette de source.
    expect(incoherents).toEqual(["form-075"]);
  });
});

describe("faits qui passeraient en brouillon au prochain seed", () => {
  it("liste figée : aucun (la correction #1848 est fusionnée)", async () => {
    const { ALL_KB_FACTS } = await import("./seed-kb-facts");
    const enBrouillon = ALL_KB_FACTS.filter(
      (f) => planifierFiche(null, verifierDoctrineFiche({ fait: f.text })).statut === "draft",
    ).map((f) => f.id);
    // Si ce test rougit, la liste ci-dessous est celle des faits à corriger AVANT le seed.
    expect(enBrouillon).toEqual([]);
  });
});
