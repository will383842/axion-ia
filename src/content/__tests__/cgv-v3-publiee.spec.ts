/**
 * CGV v3 : publication.
 *
 * Tant que la certification n'est pas obtenue (`QUALIOPI_CERTIFICATION_OBTENUE` ≠ "true"), aucun
 * passage de financement ni de certification n'est publié. Une fois la variable posée, cinq passages
 * précis apparaissent mot pour mot et la version prend le suffixe « -f ».
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const INTERDIT_SANS_CERTIFICATION =
  /\bOPCO\b|opérateur de compétences|qualiopi|certification|france travail|\bCPF\b|subrogation|demande de financement|financeurs?\b|financée par un tiers/i;

type Page = {
  title: string;
  titleEm?: string;
  intro: string;
  sections: ReadonlyArray<{ title: string; body: string }>;
};

const texteComplet = (p: Page) =>
  [p.title, p.titleEm ?? "", p.intro, ...p.sections.flatMap((s) => [s.title, s.body])].join("\n");

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("CGV v3 publiées : variante normale (environnement non défini)", () => {
  it("aucun passage de financement ni de certification, en FR comme en EN", async () => {
    vi.stubEnv("QUALIOPI_CERTIFICATION_OBTENUE", "");
    vi.resetModules();
    const { getLegal } = await import("@/content/legal");
    const cg = getLegal("conditions-generales");
    expect(texteComplet(cg.fr)).not.toMatch(INTERDIT_SANS_CERTIFICATION);
    expect(texteComplet(cg.en)).not.toMatch(INTERDIT_SANS_CERTIFICATION);
  });

  it("le texte FR est la v3 : professionnels seulement, 60 articles, annexes", async () => {
    const { getLegal } = await import("@/content/legal");
    const fr = getLegal("conditions-generales").fr as Page;
    expect(texteComplet(fr)).toContain("Axion-IA contracte exclusivement avec des professionnels");
    const articles = fr.sections.filter((s) => /Article \d+\. /.test(s.title));
    expect(articles).toHaveLength(60);
    articles.forEach((s, i) => {
      expect(s.title).toMatch(new RegExp(`^(TITRE [^·]+ · )?Article ${i + 1}\\. `));
    });
    expect(fr.sections.some((s) => s.title === "Annexes")).toBe(true);
    expect(fr.sections).toHaveLength(61);
  });
});

describe("CGV v3 publiées : variante certifiée", () => {
  it("les cinq passages apparaissent mot pour mot et la version finit par « -f »", async () => {
    vi.stubEnv("QUALIOPI_CERTIFICATION_OBTENUE", "true");
    vi.resetModules();
    const { getLegal } = await import("@/content/legal");
    const { CGV_VERSION } = await import("@/content/cgv-version");
    const fr = getLegal("conditions-generales").fr as Page;
    const corps = (n: number) => fr.sections.find((s) => s.title.includes(`Article ${n}. `))!.body;
    expect(corps(7)).toContain(
      "7.2 Le prix est dû par le Client en totalité, quelle que soit l'issue d'une demande de financement qu'il ferait auprès d'un tiers.",
    );
    expect(corps(48)).toContain("il ne vaut ni certification, ni audit de sécurité");
    expect(corps(48)).toContain(
      "à ses conseils, à son expert-comptable, à ses financeurs ou à un acquéreur",
    );
    expect(corps(49)).toContain("commandée et payée par une entreprise, ou financée par un tiers");
    expect(corps(49)).toContain(
      "elle ne vaut ni certification ni attestation de conformité à une réglementation",
    );
    expect(CGV_VERSION.endsWith("-f")).toBe(true);
  });
});
