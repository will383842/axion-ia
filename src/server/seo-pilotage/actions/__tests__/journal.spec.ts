import { describe, expect, it, vi } from "vitest";

import {
  JOURS_VERROU,
  VerrouModificationError,
  ecrireCorpsJournalise,
  hashTexte,
  verrou28Jours,
  type TxJournal,
} from "../journal";
import { cibleVerrouillee, ConflitEcritureError } from "../journal";
import { annulerModification, type TxAnnulation } from "../annuler";

const T0 = new Date("2026-11-28T10:00:00Z");
const ORIG = new Date("2026-06-01T08:00:00Z");

function fauxTx(derniere: Date | null = null) {
  const appels: string[] = [];
  const creations: Array<{ data: Record<string, unknown> }> = [];
  const tx = {
    articleTranslation: {
      findFirst: vi.fn(async () => ({
        body: "<p>ancien</p>",
        bodyText: "ancien",
        bodyJson: { a: 1 },
        updatedAt: ORIG,
      })),
      updateMany: vi.fn(async (a: unknown) => {
        appels.push("traduction");
        void a;
        return { count: 1 };
      }),
    },
    article: {
      findUnique: vi.fn(async () => ({ updatedAt: ORIG })),
      update: vi.fn(async () => {
        appels.push("article");
      }),
    },
    seoModification: {
      findFirst: vi.fn(async () => (derniere ? { appliqueeLe: derniere } : null)),
      updateMany: vi.fn(async () => ({ count: 0 })),
      create: vi.fn(async (a: { data: Record<string, unknown> }) => {
        appels.push("journal");
        creations.push(a);
        return { id: "m1" };
      }),
    },
  };
  return { tx: tx as unknown as TxJournal, appels, creations, brut: tx };
}

describe("journal des modifications (P13)", () => {
  it("écrit corps, dates et journal ensemble, avec l'avant et les hachages", async () => {
    const { tx, appels, creations, brut } = fauxTx();
    await ecrireCorpsJournalise(tx, {
      articleId: "a1",
      html: "<p>nouveau</p>",
      texteBrut: "nouveau",
      dateModifiee: T0,
      origine: "equipe_maj",
    });
    expect(appels).toEqual(["traduction", "article", "journal"]);
    const data = creations[0]!.data;
    expect(data["hashAvant"]).toBe(hashTexte("<p>ancien</p>"));
    expect(data["hashApres"]).toBe(hashTexte("<p>nouveau</p>"));
    expect(data["dateAvant"]).toEqual(ORIG);
    expect((data["avant"] as { body: string }).body).toBe("<p>ancien</p>");
    // la date publiée est posée sur la traduction
    const maj = brut.articleTranslation.updateMany.mock.calls[0]![0] as {
      data: { updatedAt: Date };
    };
    expect(maj.data.updatedAt).toEqual(T0);
  });

  it("verrou des 28 jours", () => {
    const j = (n: number) => new Date(T0.getTime() - n * 24 * 3600 * 1000);
    expect(JOURS_VERROU).toBe(28);
    expect(verrou28Jours(j(27), T0)).toBe(true);
    expect(verrou28Jours(j(28), T0)).toBe(false);
    expect(verrou28Jours(null, T0)).toBe(false);
  });

  it("refuse d'écrire sous le verrou, sans rien modifier", async () => {
    const { tx, appels } = fauxTx(new Date(T0.getTime() - 3 * 24 * 3600 * 1000));
    await expect(
      ecrireCorpsJournalise(tx, {
        articleId: "a1",
        html: "x",
        texteBrut: "x",
        dateModifiee: T0,
        origine: "equipe_maj",
      }),
    ).rejects.toBeInstanceOf(VerrouModificationError);
    expect(appels).toEqual([]);
  });
});

function fauxAnnulation(corpsActuel: string, etat = "appliquee", concurrent = false) {
  const maj: Array<{ data: Record<string, unknown> }> = [];
  const journal: Array<{ data: Record<string, unknown> }> = [];
  const artMaj: Array<{ data: Record<string, unknown> }> = [];
  const tx: TxAnnulation = {
    seoModification: {
      findUnique: async () => ({
        id: "m1",
        cibleType: "article",
        cibleId: "a1",
        champ: "body",
        etat,
        avant: {
          body: "<p>ancien</p>",
          bodyText: "ancien",
          bodyJson: null,
          articleUpdatedAt: ORIG.toISOString(),
        },
        hashApres: hashTexte("<p>nouveau</p>"),
        dateAvant: ORIG,
      }),
      updateMany: async (a: unknown) => {
        journal.push(a as { data: Record<string, unknown> });
        return { count: etat === "appliquee" || etat === "mesuree" ? 1 : 0 };
      },
    },
    articleTranslation: {
      findFirst: async () => ({ body: corpsActuel }),
      updateMany: async (a: unknown) => {
        maj.push(a as { data: Record<string, unknown> });
        return { count: concurrent ? 0 : 1 };
      },
    },
    article: {
      update: async (a: unknown) => {
        artMaj.push(a as { data: Record<string, unknown> });
      },
    },
  };
  return { tx, maj, journal, artMaj };
}

describe("annulation (P13)", () => {
  it("restaure le corps et l'updatedAt d'origine", async () => {
    const { tx, maj, journal, artMaj } = fauxAnnulation("<p>nouveau</p>");
    expect(await annulerModification(tx, "m1", "admin-1")).toEqual({ ok: true });
    expect(maj[0]!.data["body"]).toBe("<p>ancien</p>");
    expect(maj[0]!.data["updatedAt"]).toEqual(ORIG);
    expect(artMaj[0]!.data["updatedAt"]).toEqual(ORIG);
    expect(journal[0]!.data).toMatchObject({ etat: "annulee", annulePar: "admin-1" });
    expect(journal[0]!.data).not.toHaveProperty("decidePar");
  });

  it("refuse en cas de conflit de hachage, sans rien écrire", async () => {
    const { tx, maj, journal } = fauxAnnulation("<p>retouché à la main</p>");
    expect(await annulerModification(tx, "m1", "admin-1")).toEqual({ ok: false, motif: "conflit" });
    expect(maj).toHaveLength(0);
    expect(journal).toHaveLength(0);
  });

  it("refuse une modification déjà annulée", async () => {
    const { tx, maj } = fauxAnnulation("<p>nouveau</p>", "annulee");
    expect(await annulerModification(tx, "m1", "a")).toEqual({ ok: false, motif: "deja_traitee" });
    expect(maj).toHaveLength(0);
  });
});

describe("corrections de relecture (P13)", () => {
  it("l'annulation ne s'écrase pas sur une écriture concurrente : la transaction est annulée", async () => {
    const { tx } = fauxAnnulation("<p>nouveau</p>", "appliquee", true);
    await expect(annulerModification(tx, "m1", "a")).rejects.toBeInstanceOf(ConflitEcritureError);
  });

  it("pré-contrôle du verrou avant toute dépense", async () => {
    const lecteur = (l: { etat: string; appliqueeLe: Date | null } | null) => ({
      seoModification: { findFirst: async () => l },
    });
    const j = (n: number) => new Date(T0.getTime() - n * 24 * 3600 * 1000);
    expect(await cibleVerrouillee(lecteur(null), "a1", T0)).toBe(false);
    expect(await cibleVerrouillee(lecteur({ etat: "proposee", appliqueeLe: null }), "a1", T0)).toBe(
      true,
    );
    expect(
      await cibleVerrouillee(lecteur({ etat: "appliquee", appliqueeLe: j(5) }), "a1", T0),
    ).toBe(true);
    expect(
      await cibleVerrouillee(lecteur({ etat: "appliquee", appliqueeLe: j(40) }), "a1", T0),
    ).toBe(false);
  });

  it("l'écriture du corps est conditionnelle au corps lu", async () => {
    const { tx, brut } = fauxTx();
    brut.articleTranslation.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      ecrireCorpsJournalise(tx, {
        articleId: "a1",
        html: "x",
        texteBrut: "x",
        dateModifiee: T0,
        origine: "equipe_maj",
      }),
    ).rejects.toBeInstanceOf(ConflitEcritureError);
    expect(brut.seoModification.create).not.toHaveBeenCalled();
  });
});
