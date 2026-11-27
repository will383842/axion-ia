/**
 * PR S1 — socle des gabarits d'articles : interrupteur, type de contenu, aiguillage.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContentType } from "../../../prisma/generated/client";
import { gabaritsV2Actifs } from "@/lib/blog/gabarits-v2";
import {
  GABARIT_PAR_TYPE,
  GABARITS_ARTICLE,
  gabaritDeRepli,
  gabaritPourType,
} from "@/server/content-gen/blog/gabarits";

describe("interrupteur BLOG_GABARITS_V2", () => {
  const avant = process.env.BLOG_GABARITS_V2;
  afterEach(() => {
    if (avant === undefined) delete process.env.BLOG_GABARITS_V2;
    else process.env.BLOG_GABARITS_V2 = avant;
  });

  it("éteint quand la variable est absente", () => {
    delete process.env.BLOG_GABARITS_V2;
    expect(gabaritsV2Actifs()).toBe(false);
  });

  it.each(["false", "", "TRUE", "True", " true", "true ", "1", "yes"])(
    "éteint pour %j",
    (valeur) => {
      process.env.BLOG_GABARITS_V2 = valeur;
      expect(gabaritsV2Actifs()).toBe(false);
    },
  );

  it('allumé seulement pour "true" exact, lu à chaque appel', () => {
    process.env.BLOG_GABARITS_V2 = "true";
    expect(gabaritsV2Actifs()).toBe(true);
    process.env.BLOG_GABARITS_V2 = "false";
    expect(gabaritsV2Actifs()).toBe(false);
  });
});

describe("table ContentType → gabarit", () => {
  it("couvre exactement toutes les valeurs de l'énumération", () => {
    expect(Object.keys(GABARIT_PAR_TYPE).sort()).toEqual(Object.values(ContentType).sort());
  });

  it("ne rend que des gabarits connus", () => {
    for (const type of Object.values(ContentType)) {
      expect(GABARITS_ARTICLE).toContain(gabaritPourType(type, "<p>x</p>"));
    }
  });

  it.each([
    ["blog_article", "analyse"],
    ["landing_ville", "analyse"],
    ["how_to_x_in_y", "guide"],
    ["calculator_roi", "guide"],
    ["guide_pilier", "guide"],
    ["comparison", "comparatif"],
    ["vs_comparator", "comparatif"],
    ["alternative_to", "comparatif"],
    ["top_x_in_y", "selection"],
    ["best_for_x_in_y", "selection"],
    ["case_study_local", "cas"],
    ["what_is_x", "definition"],
    ["glossary_term", "definition"],
    ["faq_standalone", "faq"],
    ["faq_geo", "faq"],
    ["qa_derived", "faq"],
    ["barometer_insight", "chiffres"],
  ] as const)("%s → %s", (type, attendu) => {
    expect(gabaritPourType(type, "")).toBe(attendu);
  });

  it("le type prime sur l'heuristique HTML", () => {
    const tableau = "<table><tr><td>a</td></tr><tr><td>b</td></tr><tr><td>c</td></tr></table>";
    expect(gabaritPourType("blog_article", tableau)).toBe("analyse");
  });
});

describe("repli HTML (type inconnu)", () => {
  const ligne = "<tr><td>x</td></tr>";
  it("tableau d'au moins 3 lignes → comparatif", () => {
    expect(gabaritPourType(null, `<table>${ligne.repeat(3)}</table>`)).toBe("comparatif");
    expect(gabaritDeRepli(`<table>${ligne.repeat(2)}</table>`)).toBe("analyse");
  });
  it("liste numérotée d'au moins 3 étapes → guide", () => {
    const ol = (n: number) => `<ol>${"<li>e</li>".repeat(n)}</ol>`;
    expect(gabaritPourType(undefined, ol(3))).toBe("guide");
    expect(gabaritPourType(null, ol(2))).toBe("analyse");
  });
  it("sinon, ou HTML vide : analyse", () => {
    expect(gabaritPourType(null, "<p>texte</p><ul><li>a</li><li>b</li><li>c</li></ul>")).toBe(
      "analyse",
    );
    expect(gabaritPourType(null, "")).toBe("analyse");
    expect(gabaritPourType(null, null)).toBe("analyse");
  });
  it("un type hors table (valeur inattendue en base) retombe sur le repli", () => {
    expect(gabaritPourType("inconnu" as never, "<p>x</p>")).toBe("analyse");
    expect(gabaritPourType("toString" as never, "<p>x</p>")).toBe("analyse");
  });
});

describe("chargerTypeContenu", () => {
  const findUnique = vi.fn();
  beforeEach(() => {
    vi.resetModules();
    findUnique.mockReset();
    vi.doMock("@/lib/prisma", () => ({ prisma: { contentGenJob: { findUnique } } }));
  });
  afterEach(() => {
    vi.doUnmock("@/lib/prisma");
    vi.unstubAllEnvs();
  });

  async function charger() {
    return (await import("@/server/content-gen/blog/loader")).chargerTypeContenu;
  }

  it("lit le contentType du job d'origine", async () => {
    findUnique.mockResolvedValue({ contentType: "top_x_in_y" });
    const f = await charger();
    await expect(f({ generatedByJobId: "job-1" })).resolves.toBe("top_x_in_y");
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "job-1" },
      select: { contentType: true },
    });
  });

  it("null sans job, sans requête", async () => {
    const f = await charger();
    await expect(f({ generatedByJobId: null })).resolves.toBeNull();
    await expect(f({})).resolves.toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("null si le job est introuvable ou si la lecture échoue", async () => {
    const f = await charger();
    findUnique.mockResolvedValueOnce(null);
    await expect(f({ generatedByJobId: "x" })).resolves.toBeNull();
    findUnique.mockRejectedValueOnce(new Error("db"));
    await expect(f({ generatedByJobId: "x" })).resolves.toBeNull();
  });

  it("null sans requête avec la base factice du build (stub.invalid)", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://stub:stub@stub.invalid:5432/stub");
    const f = await charger();
    await expect(f({ generatedByJobId: "x" })).resolves.toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });
});
