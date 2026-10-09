// @vitest-environment node
// Règle automatique des avis (src/content/preuves-sociales.ts, 2026-10-09).
//
// Plus d'interrupteur : les avis s'affichent d'eux-mêmes dès qu'un avis
// `status = published` existe. On joue la règle contre un faux Prisma qui
// APPLIQUE les filtres `where` — un avis `hidden`, `pending`, `rejected` ou
// `archived` n'est donc écarté que si le code filtre vraiment sur le statut.
//
//   0 avis publié  → rien (accueil, page service, hub, sitemap, flux, pied
//                    d'e-mail, lien de pied de page) ;
//   1 à 4 avis     → avis affichés, SANS note globale ni AggregateRating ;
//   ≥ 5 avis       → note affichée ;
//   /avis/deposer  → ouverte quel que soit le nombre d'avis.
import type { ReactElement, ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { avisNonPublies, unAvis, type FauxAvis } from "./faux-prisma-avis";

const h = vi.hoisted(() => ({ base: { avis: [] as unknown[] } }));

vi.mock("@/lib/prisma", async () => {
  const { fauxCustomerReview: faux } = await import("./faux-prisma-avis");
  return {
    prisma: { customerReview: faux(h.base as { avis: FauxAvis[] }) },
  };
});

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  },
  redirect: () => {
    throw new Error("NEXT_REDIRECT");
  },
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children?: ReactNode }) => (
    <a href={String(href)}>{children}</a>
  ),
  redirect: () => {
    throw new Error("NEXT_REDIRECT");
  },
  usePathname: () => "/",
  useRouter: () => ({ push: () => undefined }),
  getPathname: () => "/",
}));

vi.mock("@/auth", () => ({ auth: async () => null }));
// Formulaire client (server action) : hors sujet ici, seule la page compte.
vi.mock("@/components/forms/ReviewSubmissionForm", () => ({ ReviewSubmissionForm: () => null }));

vi.mock("next-intl/server", () => ({
  setRequestLocale: () => {},
  getLocale: async () => "fr",
  getTranslations: async () => (cle: string) => cle,
}));

import { __viderCacheAvisPublies, avisPublies, statsAvisPublies } from "@/server/reviews/presence";
import { avisPourVitrine } from "@/server/reviews/vitrine";
import { ServiceReviewsSection } from "@/components/reviews/ServiceReviewsSection";
import { StarRating } from "@/components/reviews/StarRating";
import { Footer } from "@/components/nav/Footer";
import { orgAggregateJsonLd } from "@/server/reviews/jsonld";
import { renderEmailTemplate } from "@/lib/email/templates";
import { PAYLOAD_EXEMPLE } from "@/server/email/apercu/payloads-exemple";
import { GET as sitemapAvis } from "@/app/sitemap-avis.xml/route";
import { GET as fluxAvis } from "@/app/[locale]/avis/feed.xml/route";
import AvisHubPage from "@/app/[locale]/avis/page";
import AvisDetailPage from "@/app/[locale]/avis/[slug]/page";
import DeposerAvisPage from "@/app/[locale]/avis/deposer/page";

function poser(avis: FauxAvis[]): void {
  h.base.avis = avis;
  __viderCacheAvisPublies();
}

/** `n` avis publiés + un avis de chaque statut non publié. */
function publies(n: number): FauxAvis[] {
  return [...Array.from({ length: n }, () => unAvis()), ...avisNonPublies()];
}

/** Parcourt un arbre d'éléments React (sans le rendre) et rend ceux qui passent. */
function trouver(noeud: ReactNode, test: (e: ReactElement) => boolean): ReactElement[] {
  const trouves: ReactElement[] = [];
  const visiter = (n: unknown): void => {
    if (Array.isArray(n)) return n.forEach(visiter);
    if (!n || typeof n !== "object" || !("props" in n)) return;
    const e = n as ReactElement<Record<string, unknown>>;
    if (test(e)) trouves.push(e);
    for (const v of Object.values(e.props ?? {})) visiter(v);
  };
  visiter(noeud);
  return trouves;
}

const params = Promise.resolve({ locale: "fr" });

beforeAll(() => {
  process.env["DATABASE_URL"] = "postgresql://test:test@localhost:5432/test";
  process.env["AUTH_SECRET"] = "secret-de-test-suffisamment-long-0123456789";
  process.env["NEXT_PUBLIC_SITE_URL"] = "https://axion-ia.com";
});

beforeEach(() => poser([]));

describe("helper unique avisPublies() / statsAvisPublies()", () => {
  it("0 avis publié (que des hidden/pending/rejected/archived) → faux, compte 0", async () => {
    poser(avisNonPublies());
    expect(await avisPublies()).toBe(false);
    expect(await statsAvisPublies()).toEqual({ count: 0, avg: 0 });
  });

  it("ne compte QUE les avis publiés", async () => {
    poser([unAvis({ rating: 4 }), unAvis({ rating: 5 }), ...avisNonPublies()]);
    expect(await avisPublies()).toBe(true);
    expect(await statsAvisPublies()).toEqual({ count: 2, avg: 4.5 });
  });

  it("au build (stub.invalid) rend 0 sans lire la base", async () => {
    poser(publies(7));
    const avant = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      expect(await avisPublies()).toBe(false);
    } finally {
      process.env["DATABASE_URL"] = avant;
    }
  });
});

describe("accueil (avisPourVitrine, mêmes paramètres que la page)", () => {
  it("0 avis publié → aucun avis, aucune note, aucun AggregateRating", async () => {
    poser(avisNonPublies());
    const { items, agg } = await avisPourVitrine({ pageSize: 9 });
    expect(items).toEqual([]);
    expect(agg).toBeNull();
    expect(orgAggregateJsonLd(agg)).toBeNull();
  });

  it.each([1, 4])("%i avis publié(s) → avis affichés, SANS note ni AggregateRating", async (n) => {
    poser(publies(n));
    const { items, agg } = await avisPourVitrine({ pageSize: 9 });
    expect(items).toHaveLength(n);
    expect(items.every((a) => !a.comment.includes("INVISIBLE"))).toBe(true);
    expect(agg).toBeNull();
    expect(orgAggregateJsonLd(agg)).toBeNull();
  });

  it("5 avis publiés → note globale + AggregateRating", async () => {
    poser(publies(5));
    const { items, agg } = await avisPourVitrine({ pageSize: 9 });
    expect(items).toHaveLength(5);
    expect(agg?.reviewCount).toBe(5);
    expect(orgAggregateJsonLd(agg)).not.toBeNull();
  });
});

describe("page service (ServiceReviewsSection)", () => {
  it("0 avis publié → la section n'existe pas", async () => {
    poser(avisNonPublies());
    expect(await ServiceReviewsSection({ serviceLine: "audits" })).toBeNull();
  });

  it("2 avis publiés → avis affichés sans étoiles de note globale", async () => {
    poser(publies(2));
    const section = await ServiceReviewsSection({ serviceLine: "audits" });
    expect(section).not.toBeNull();
    expect(trouver(section, (e) => e.type === StarRating)).toHaveLength(0);
  });

  it("5 avis publiés → note globale affichée", async () => {
    poser(publies(5));
    const section = await ServiceReviewsSection({ serviceLine: "audits" });
    expect(trouver(section, (e) => e.type === StarRating)).toHaveLength(1);
  });
});

describe("hub /avis et détail", () => {
  it("0 avis publié → 404 (notFound)", async () => {
    poser(avisNonPublies());
    await expect(AvisHubPage({ params, searchParams: Promise.resolve({}) })).rejects.toThrow(/404/);
    const cache = avisNonPublies()[1]!;
    poser([cache]);
    await expect(
      AvisDetailPage({ params: Promise.resolve({ locale: "fr", slug: cache.slug }) }),
    ).rejects.toThrow(/404/);
  });

  it("1 avis publié → le hub revient", async () => {
    poser(publies(1));
    await expect(AvisHubPage({ params, searchParams: Promise.resolve({}) })).resolves.toBeTruthy();
  });

  it("un avis non publié reste en 404 même quand d'autres avis sont publiés", async () => {
    const caches = avisNonPublies();
    poser([unAvis(), ...caches]);
    for (const a of caches) {
      await expect(
        AvisDetailPage({ params: Promise.resolve({ locale: "fr", slug: a.slug }) }),
      ).rejects.toThrow(/404/);
    }
  });
});

describe("/avis/deposer — toujours ouvert", () => {
  it.each([0, 1, 5])("%i avis publié(s) → la page se rend (pas de 404)", async (n) => {
    poser(publies(n));
    const page = await DeposerAvisPage({ params });
    expect(page).toBeTruthy();
    // Le lien vers le hub /avis ne figure que si le hub existe.
    const liensHub = trouver(page, (e) => (e.props as { href?: unknown }).href === "/avis");
    const fil = trouver(page, (e) => Array.isArray((e.props as { items?: unknown }).items));
    const filVersHub = fil.some((e) =>
      ((e.props as { items: { href: string }[] }).items ?? []).some((i) => i.href === "/avis"),
    );
    if (n === 0) {
      expect(liensHub).toHaveLength(0);
      expect(filVersHub).toBe(false);
    } else {
      expect(liensHub.length).toBeGreaterThan(0);
      expect(filVersHub).toBe(true);
    }
  });
});

describe("sitemap-avis et flux RSS", () => {
  it("0 avis publié → 404", async () => {
    poser(avisNonPublies());
    expect((await sitemapAvis()).status).toBe(404);
    expect((await fluxAvis(new Request("https://x"), { params })).status).toBe(404);
  });

  it("avis publiés → listés ; les non publiés n'y sont jamais", async () => {
    const caches = avisNonPublies();
    const visible = unAvis();
    poser([visible, ...caches]);
    const xml = await (await sitemapAvis()).text();
    expect(xml).toContain(`/fr/avis/${visible.slug}`);
    expect(xml).toContain("/fr/avis/deposer");
    for (const a of caches) expect(xml).not.toContain(a.slug);
    const rss = await (await fluxAvis(new Request("https://x"), { params })).text();
    expect(rss).toContain(visible.slug);
    for (const a of caches) expect(rss).not.toContain(a.slug);
  });
});

describe("pied de page du site", () => {
  /** Liens vers /avis, qu'ils soient des éléments ou des entrées `{ href, label }`. */
  const lienAvis = (pied: ReactNode) => {
    const trouves: unknown[] = [];
    const vus = new Set<unknown>();
    const visiter = (n: unknown): void => {
      if (!n || typeof n !== "object" || vus.has(n)) return;
      vus.add(n);
      if (Array.isArray(n)) return n.forEach(visiter);
      const o = n as Record<string, unknown>;
      if (o["href"] === "/avis") trouves.push(o);
      for (const v of Object.values("props" in o ? (o["props"] as object) : o)) visiter(v);
    };
    visiter(pied);
    return trouves;
  };

  it("0 avis publié → pas de lien « Avis clients »", async () => {
    poser(avisNonPublies());
    expect(lienAvis(await Footer())).toHaveLength(0);
  });

  it("1 avis publié → le lien revient", async () => {
    poser(publies(1));
    expect(lienAvis(await Footer()).length).toBeGreaterThan(0);
  });
});

describe("pied des e-mails (getPublishedReviewStats)", () => {
  const ligneAvis = /\d+ avis clients/;
  const rendre = async () =>
    (await renderEmailTemplate("submission-reply", "fr", PAYLOAD_EXEMPLE)).html;

  it("0 avis publié → aucune ligne d'avis", async () => {
    poser(avisNonPublies());
    expect(await rendre()).not.toMatch(ligneAvis);
  });

  it("4 avis publiés → toujours aucune note", async () => {
    poser(publies(4));
    expect(await rendre()).not.toMatch(ligneAvis);
  });

  it("5 avis publiés → la ligne d'avis apparaît, sur les seuls avis publiés", async () => {
    poser(publies(5));
    const html = await rendre();
    expect(html).toContain("★★★★★  5,0/5 — 5 avis clients");
  });
});
