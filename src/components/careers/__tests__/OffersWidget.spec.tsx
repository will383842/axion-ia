import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { OffersWidget, clampOffersCount } from "../OffersWidget";
import type { JobOffer } from "../../../../prisma/generated/client";

function makeOffer(i: number, over: Partial<JobOffer> = {}): JobOffer {
  return {
    id: `id-${i}`,
    slug: `offre-${i}`,
    titleFr: `Poste ${i}`,
    titleEn: `Role ${i}`,
    summaryFr: `Résumé ${i}`,
    summaryEn: `Summary ${i}`,
    category: "ia",
    workMode: "remote",
    city: null,
    contractLabel: "CDI",
    isCommission: false,
    salaryVisible: true,
    salaryMin: 40000,
    salaryMax: 55000,
    salaryPeriod: "YEAR",
    salaryCurrency: "EUR",
    datePosted: new Date("2026-06-08T00:00:00.000Z"),
    ...over,
  } as unknown as JobOffer;
}

const BASE = "https://axion-ia.com";

describe("clampOffersCount", () => {
  it("borne dans [1, 12] et applique le fallback", () => {
    expect(clampOffersCount("5")).toBe(5);
    expect(clampOffersCount("0")).toBe(1);
    expect(clampOffersCount("99")).toBe(12);
    expect(clampOffersCount(undefined, 3)).toBe(3);
    expect(clampOffersCount("abc", 4)).toBe(4);
  });
});

describe("<OffersWidget>", () => {
  const offers = Array.from({ length: 8 }, (_, i) => makeOffer(i + 1));

  it("tronque à `count`", () => {
    const { container } = render(
      <OffersWidget locale="fr" offers={offers} count={3} variant="large" baseUrl={BASE} />,
    );
    // 3 offres → liens vers /carrieres/offre-N
    const offerLinks = Array.from(container.querySelectorAll("a")).filter((a) =>
      /\/carrieres\/offre-\d+$/.test(a.getAttribute("href") ?? ""),
    );
    expect(offerLinks).toHaveLength(3);
  });

  it("liens en URL absolue ouverts dans un nouvel onglet", () => {
    const { container } = render(
      <OffersWidget locale="fr" offers={offers} count={1} baseUrl={BASE} />,
    );
    const link = container.querySelector('a[href$="/carrieres/offre-1"]');
    expect(link?.getAttribute("href")).toBe(`${BASE}/fr/carrieres/offre-1`);
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toContain("noopener");
  });

  it("variant compact = pas d'image, variant large = image", () => {
    const compact = render(
      <OffersWidget locale="fr" offers={offers} variant="compact" count={2} baseUrl={BASE} />,
    );
    expect(compact.container.querySelectorAll("img")).toHaveLength(0);

    const large = render(
      <OffersWidget locale="fr" offers={offers} variant="large" count={2} baseUrl={BASE} />,
    );
    expect(large.container.querySelectorAll("img").length).toBeGreaterThan(0);
  });

  it("theme dark applique la racine mocha", () => {
    const { container } = render(
      <OffersWidget locale="fr" offers={offers} theme="dark" count={1} baseUrl={BASE} />,
    );
    const root = container.querySelector(".axion-offers-embed");
    expect(root?.getAttribute("data-theme")).toBe("dark");
    expect(root?.className).toContain("bg-mocha-rich");
  });

  it("état vide si aucune offre", () => {
    const { container } = render(<OffersWidget locale="fr" offers={[]} baseUrl={BASE} />);
    expect(container.textContent).toContain("Pas d'offre ouverte");
  });
});
