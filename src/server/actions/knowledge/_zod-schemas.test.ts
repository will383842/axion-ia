/**
 * KB-3 — Tests Zod schemas server actions.
 * Aucune I/O DB. Vérifie validation + transformation + valeurs par défaut.
 */

import { describe, expect, it } from "vitest";
import {
  createEntryInputSchema,
  deleteEntryInputSchema,
  saveDraftInputSchema,
  slugSchema,
  translationInputSchema,
  updateEntryInputSchema,
} from "./_zod-schemas";

describe("slugSchema", () => {
  it("accepte un slug kebab-case ASCII", () => {
    expect(() => slugSchema.parse("mon-article")).not.toThrow();
    expect(() => slugSchema.parse("ia-rag-2026")).not.toThrow();
  });

  it("refuse les majuscules + accents + espaces", () => {
    expect(() => slugSchema.parse("Mon-Article")).toThrow();
    expect(() => slugSchema.parse("mon article")).toThrow();
    expect(() => slugSchema.parse("éclair")).toThrow();
  });

  it("refuse les slugs trop courts ou trop longs", () => {
    expect(() => slugSchema.parse("a")).toThrow();
    expect(() => slugSchema.parse("a".repeat(200))).toThrow();
  });
});

describe("translationInputSchema", () => {
  it("accepte une translation minimale", () => {
    const result = translationInputSchema.parse({
      locale: "fr",
      title: "Mon Titre",
      slug: "mon-titre",
    });
    expect(result.locale).toBe("fr");
    expect(result.body).toBe(""); // default
  });

  it("refuse un titre vide", () => {
    expect(() => translationInputSchema.parse({ locale: "fr", title: "", slug: "ok" })).toThrow();
  });

  it("refuse une metaDescription > 160 chars", () => {
    expect(() =>
      translationInputSchema.parse({
        locale: "fr",
        title: "T",
        slug: "ok-slug",
        metaDescription: "a".repeat(161),
      }),
    ).toThrow();
  });
});

describe("createEntryInputSchema", () => {
  it("accepte un payload minimal avec defaults", () => {
    const result = createEntryInputSchema.parse({
      type: "article",
      domain: "editorial",
      slug: "mon-slug",
      translations: [{ locale: "fr", title: "Titre", slug: "titre" }],
    });
    expect(result.audience).toBe("team");
    expect(result.confidentiality).toBe("internal");
    expect(result.status).toBe("draft");
    expect(result.pipelineStage).toBe("idea");
  });

  it("refuse un type inconnu", () => {
    expect(() =>
      createEntryInputSchema.parse({
        type: "inconnu",
        domain: "editorial",
        slug: "ok",
        translations: [{ locale: "fr", title: "T", slug: "t" }],
      }),
    ).toThrow();
  });

  it("requiert au moins 1 translation", () => {
    expect(() =>
      createEntryInputSchema.parse({
        type: "article",
        domain: "editorial",
        slug: "ok-slug",
        translations: [],
      }),
    ).toThrow();
  });
});

describe("updateEntryInputSchema", () => {
  it("requiert un id UUID", () => {
    expect(() => updateEntryInputSchema.parse({ id: "not-a-uuid" })).toThrow();
    expect(() =>
      updateEntryInputSchema.parse({ id: "01234567-89ab-cdef-0123-456789abcdef" }),
    ).not.toThrow();
  });

  it("accepte une mise à jour partielle", () => {
    const result = updateEntryInputSchema.parse({
      id: "01234567-89ab-cdef-0123-456789abcdef",
      status: "published",
    });
    expect(result.status).toBe("published");
    expect(result.type).toBeUndefined();
  });
});

describe("saveDraftInputSchema", () => {
  it("accepte un autosave minimal", () => {
    const result = saveDraftInputSchema.parse({
      entryId: "01234567-89ab-cdef-0123-456789abcdef",
      locale: "fr",
      title: "Titre WIP",
    });
    expect(result.locale).toBe("fr");
  });

  it("accepte un titre vide (WIP draft)", () => {
    expect(() =>
      saveDraftInputSchema.parse({
        entryId: "01234567-89ab-cdef-0123-456789abcdef",
        locale: "en",
        title: "",
      }),
    ).not.toThrow();
  });
});

describe("deleteEntryInputSchema", () => {
  it("accepte un UUID valide", () => {
    expect(() =>
      deleteEntryInputSchema.parse({ id: "01234567-89ab-cdef-0123-456789abcdef" }),
    ).not.toThrow();
  });

  it("refuse une string non-UUID", () => {
    expect(() => deleteEntryInputSchema.parse({ id: "abc" })).toThrow();
  });
});
