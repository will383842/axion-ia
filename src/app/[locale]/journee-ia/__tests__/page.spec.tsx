import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AUDIT_TIERS, INTERVENTION_TIERS, JOURNEE_IA_TIER, formatAmount } from "@/content/pricing";
import { FOUNDER_PERSON_ID } from "@/lib/brand";
import { DESCRIPTION, prixJourneeIa, titrePage } from "../meta";

vi.mock("next-intl/server", () => ({ setRequestLocale: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  permanentRedirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (p: { src: string; alt: string }) => <img src={p.src} alt={p.alt} />,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...r}>
      {children}
    </a>
  ),
}));
vi.mock("@/server/seo/og-overrides", () => ({ surchargeOgPour: async () => null }));

import Page from "../page";

async function rendu() {
  const el = await Page({ params: Promise.resolve({ locale: "fr" }) });
  return renderToStaticMarkup(el);
}

describe("Journée IA — page", () => {
  it("a 1 H1 et 5 H2", async () => {
    const html = await rendu();
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html.match(/<h2[\s>]/g)).toHaveLength(5);
  });

  it("a 2 liens d'action au même libellé, vers /appel, suivis", async () => {
    const html = await rendu();
    const liens = [...html.matchAll(/<a [^>]*href="(\/appel[^"]*)"[^>]*>([^<]*)<\/a>/g)];
    expect(liens).toHaveLength(2);
    expect(new Set(liens.map((l) => l[2]))).toEqual(new Set(["Prendre rendez-vous"]));
    expect(liens[0]![1]).toContain("depuis=journee-ia-haut");
    expect(liens[1]![1]).toContain("depuis=journee-ia-bas");
  });

  it("n'émet ni Review ni AggregateRating dans le JSON-LD", async () => {
    const html = await rendu();
    const blocs = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)];
    expect(blocs.length).toBeGreaterThanOrEqual(4);
    const tout = blocs.map((b) => b[1]).join("");
    expect(tout).not.toMatch(/"(Review|AggregateRating)"/);
    expect(tout).toContain('"FAQPage"');
    expect(tout).toContain('"priceSpecification"');
    expect(tout).toContain('"valueAddedTaxIncluded":false');
  });

  it("lit le prix dans pricing.ts, jamais en dur", async () => {
    const html = await rendu();
    const montant = formatAmount(JOURNEE_IA_TIER.priceFlat ?? 0, "fr", { compact: true });
    expect(html).toContain(montant);
    expect(html).not.toContain("{{PRIX}}");
  });

  it("a un seul bloc sombre", async () => {
    const html = await rendu();
    expect(html.match(/bg-mocha/g)).toHaveLength(1);
  });

  it("redirige les autres langues vers /fr/journee-ia", async () => {
    await expect(Page({ params: Promise.resolve({ locale: "en" }) })).rejects.toThrow(
      "REDIRECT:/fr/journee-ia",
    );
  });

  it("garde un titre ≤ 60 et une description ≤ 158 caractères", () => {
    expect(titrePage().length).toBeLessThanOrEqual(60);
    expect(DESCRIPTION.length).toBeLessThanOrEqual(158);
  });
});

describe("Journée IA — FAQ", () => {
  it("donne à chaque <summary> une cible d'au moins 48 px (min-h-12)", async () => {
    const html = await rendu();
    const summaries = [...html.matchAll(/<summary([^>]*)>/g)];
    expect(summaries.length).toBeGreaterThan(0);
    for (const s of summaries) {
      const classe = /class="([^"]*)"/.exec(s[1]!)?.[1] ?? "";
      expect(classe.split(/\s+/)).toContain("min-h-12");
    }
  });

  it("crédite le fondateur, pas la persona éditoriale, dans le FAQPage", async () => {
    const html = await rendu();
    const blocs = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)];
    const faq = blocs.map((b) => JSON.parse(b[1]!)).find((d) => d["@type"] === "FAQPage");
    expect(faq.author).toEqual({ "@id": FOUNDER_PERSON_ID });
    expect(JSON.stringify(faq.author)).not.toContain("manon");
  });

  it("cible dans speakable des sélecteurs présents dans le balisage rendu", async () => {
    const html = await rendu();
    const blocs = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)];
    const faq = blocs.map((b) => JSON.parse(b[1]!)).find((d) => d["@type"] === "FAQPage");
    const sel: string[] = (faq.speakable.cssSelector as string[]).flatMap((c) =>
      c.split(",").map((x) => x.trim()),
    );
    expect(sel.length).toBeGreaterThan(0);
    const nbQuestions = faq.mainEntity.length;
    for (const s of sel) {
      const attr = /^\[([a-z-]+)\]$/.exec(s)?.[1];
      expect(attr, `sélecteur inattendu ${s}`).toBeDefined();
      expect(html.match(new RegExp(`<[a-z]+ [^>]*\\b${attr}(?=[\\s=>])`, "g"))).toHaveLength(
        nbQuestions,
      );
    }
  });
});

describe("Journée IA — pricing", () => {
  it("a un priceFlat strictement positif", () => {
    expect(JOURNEE_IA_TIER.priceFlat).toBeGreaterThan(0);
  });

  it("la garde de prix refuse absent, nul, négatif, NaN et infini", () => {
    for (const v of [undefined, null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => prixJourneeIa(v as number)).toThrow(/priceFlat/);
    }
    expect(prixJourneeIa(JOURNEE_IA_TIER.priceFlat)).toBe(JOURNEE_IA_TIER.priceFlat);
  });

  it("JOURNEE_IA_TIER est absent des tableaux existants", () => {
    expect(AUDIT_TIERS.some((t) => t.id === JOURNEE_IA_TIER.id)).toBe(false);
    expect(INTERVENTION_TIERS.some((t) => t.id === JOURNEE_IA_TIER.id)).toBe(false);
  });
});
