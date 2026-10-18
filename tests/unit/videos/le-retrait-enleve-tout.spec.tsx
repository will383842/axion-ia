// @vitest-environment node
/**
 * W4.4 — LE RETRAIT ENLÈVE TOUT, dans la même opération (plan §8.4).
 *
 * Chaîne RÉELLE : réception signée → faux Prisma en mémoire → `lecture.ts` → suite de
 * publication réelle (qui vide le cache mémoire) → surfaces. Après un `DELETE`, le slug a
 * disparu de TOUTES les surfaces : plan du site, index, llms.txt, llms-full.txt, galerie, page
 * de thème, page de série, encarts — et la page répond 410.
 *
 * Rien n'est mocké de ce qui décide de la présence d'une vidéo : seuls le réseau (HEAD des
 * fichiers, IndexNow, Cloudflare), le cache Next et la mise en page le sont.
 */
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { signerRequete } from "@/server/videos/signature";
import { publicationValide } from "@/server/videos/__tests__/fixtures";
import { creerFauxPrisma } from "@/server/videos/__tests__/faux-prisma";

const SECRET = "s".repeat(40);
const T0 = 1_800_000_000;
const CHEMIN = "/api/interne/videos";
const faux = creerFauxPrisma();

vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return faux.client;
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({
    allowed: true,
    count: 1,
    remaining: 59,
    resetAt: 0,
    panne: false,
  })),
}));
vi.mock("@/server/videos/fichiers", () => ({ verifierFichiers: async () => ({ ok: true }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/indexnow", () => ({
  submitToIndexNow: vi.fn(async () => ({ accepted: "https://yandex.com/indexnow", attempts: [] })),
}));
vi.mock("@/server/cache/revalidate-and-purge", () => ({
  revalidateAndPurge: vi.fn(async () => ({})),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  },
}));
vi.mock("next-intl/server", () => ({
  setRequestLocale: () => {},
  getLocale: async () => "fr",
  getTranslations: async () => (cle: string) => cle,
}));
vi.mock("@/server/seo/og-overrides", () => ({ surchargeOgPour: async () => null }));
vi.mock("@/server/reviews/presence", () => ({ avisPublies: async () => false }));
vi.mock("@/server/exporters/knowledge-sitemap", () => ({
  listKnowledgeSitemapEntries: async () => [],
}));
vi.mock("@/app/sitemap", () => ({
  default: async () => [],
  generateSitemaps: async () => [],
  buildExcludeSlugsByType: () => ({}),
  editorialLastmodForSitemapId: () => new Date("2026-06-08T00:00:00Z"),
}));
vi.mock("@/app/sitemap-news.xml/route", () => ({ listRecentNewsEntries: async () => [] }));
vi.mock("@/app/sitemap-news-evergreen.xml/route", () => ({
  listEvergreenNewsEntries: async () => [],
}));
vi.mock("@/server/exporters/knowledge-sitemap", () => ({
  listKnowledgeSitemapEntries: async () => [],
}));

/* eslint-disable no-restricted-imports */
import { POST, DELETE } from "@/app/api/interne/videos/route";
import { GET as retirees } from "@/app/api/interne/videos/retirees/route";
import { GET as sitemapVideos } from "@/app/sitemap-videos.xml/route";
import { GET as sitemapIndex } from "@/app/sitemap-index.xml/route";
import { GET as llms } from "@/app/llms.txt/route";
import { GET as llmsFull } from "@/app/llms-full.txt/route";
import Galerie from "@/app/[locale]/videos/page";
import PageTheme from "@/app/[locale]/videos/theme/[theme]/page";
import PageSerie from "@/app/[locale]/videos/serie/[serie]/page";
import PageVideoRoute from "@/app/[locale]/videos/[slug]/page";
/* eslint-enable no-restricted-imports */
import { EncartEnVideo } from "@/components/videos/EncartEnVideo";
import { reponseGoneSiRetiree, reinitialiserRetirees } from "@/lib/videos/retirees-edge";

let n = 0;
function requete(methode: "POST" | "DELETE", corps: string): NextRequest {
  n += 1;
  const nonce = n.toString(16).padStart(32, "0");
  const h = String(Math.floor(Date.now() / 1000));
  return new NextRequest(`http://localhost${CHEMIN}`, {
    method: methode,
    headers: {
      "x-axion-horodatage": h,
      "x-axion-nonce": nonce,
      "x-axion-signature": signerRequete({
        secret: SECRET,
        horodatage: h,
        nonce,
        methode,
        chemin: CHEMIN,
        corps,
      }),
      "content-type": "application/json",
    },
    body: corps,
  });
}

const SLUGS = ["episode-un-tres-bien", "episode-deux-tres-bien", "episode-trois-tres-bien"];

async function publier(k: number): Promise<void> {
  const corps = JSON.stringify(
    publicationValide({
      slug: SLUGS[k]!,
      studioVideoId: `vs_episode_${k}_xx`,
      version: 1,
      theme: "audit-ia",
      serie: { slug: "ma-serie", titre: "Ma série de test", rang: k + 1 },
      titre: `Épisode ${k + 1} de la série de test pour le retrait`,
    }),
  );
  expect((await POST(requete("POST", corps))).status).toBe(201);
  await vi.advanceTimersByTimeAsync(60_000); // l'épisode suivant est PLUS RÉCENT
}

const params = <T extends Record<string, string>>(extra: T = {} as T) =>
  Promise.resolve({ locale: "fr", ...extra });
const html = async (el: Promise<unknown>) => renderToStaticMarkup((await el) as ReactNode);

/** Tout ce que le site sert, concaténé : le slug ne doit apparaître nulle part après le retrait. */
async function surfaces(slug: string) {
  const lire = async (r: Response) => (r.status === 404 ? "" : r.text());
  const ou = async (f: () => Promise<string>) => {
    try {
      return await f();
    } catch {
      return "";
    }
  };
  return {
    "sitemap-videos.xml": await lire(await sitemapVideos()),
    "sitemap-index.xml": await lire(await sitemapIndex()),
    "llms.txt": await lire(await llms()),
    "llms-full.txt": await lire(await llmsFull()),
    galerie: await ou(() => html(Galerie({ params: params() }))),
    thème: await ou(() => html(PageTheme({ params: params({ theme: "audit-ia" }) }))),
    série: await ou(() => html(PageSerie({ params: params({ serie: "ma-serie" }) }))),
    encart: await html(EncartEnVideo({ theme: "audit-ia" })),
    [`page ${slug}`]: await ou(() => html(PageVideoRoute({ params: params({ slug }) }))),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0 * 1000);
  vi.stubEnv("VIDEOS_SITE_ENABLED", "true");
  vi.stubEnv("VIDEOS_STUDIO_HMAC_SECRET", SECRET);
  vi.stubEnv("DATABASE_URL", "postgresql://u:p@db.example:5432/x");
  vi.stubEnv("INDEXNOW_KEY", "cle");
  vi.stubEnv("OF_PUBLIC_DISCLOSURE_ENABLED", "true");
  faux.videos.length = 0;
  faux.journal.length = 0;
  reinitialiserRetirees();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("le retrait enlève TOUT", () => {
  it("avant le retrait, la dernière vidéo est partout (le témoin du test)", async () => {
    for (let k = 0; k < 3; k++) await publier(k);
    const avant = await surfaces(SLUGS[2]!);
    for (const [nom, contenu] of Object.entries(avant)) {
      // L'index des plans du site ne cite pas de slug : il liste le plan des vidéos.
      const attendu = nom === "sitemap-index.xml" ? "sitemap-videos.xml" : SLUGS[2]!;
      expect(contenu, `${nom} devrait contenir « ${attendu} » avant le retrait`).toContain(attendu);
    }
  });

  it("après DELETE : le slug a disparu de toutes les surfaces ; la page répond 410", async () => {
    for (let k = 0; k < 3; k++) await publier(k);
    const retrait = JSON.stringify({
      schemaVersion: 1,
      studioVideoId: "vs_episode_2_xx",
      motif: "erreur",
    });
    expect((await DELETE(requete("DELETE", retrait))).status).toBe(200);
    await vi.advanceTimersByTimeAsync(10);

    const apres = await surfaces(SLUGS[2]!);
    for (const [nom, contenu] of Object.entries(apres)) {
      expect(contenu, `${nom} contient encore la vidéo retirée`).not.toContain(SLUGS[2]!);
    }
    // …et l'index, qui liste encore le plan (il reste 2 vidéos), ne le fait que parce qu'il en reste.
    expect(apres["sitemap-index.xml"]).toContain("sitemap-videos.xml");
    // les deux autres épisodes sont toujours là : le retrait ne touche que sa cible
    expect(apres["llms.txt"]).toContain(SLUGS[1]!);
    expect(apres["sitemap-videos.xml"]).toContain(SLUGS[0]!);
    // la page : 404 côté rendu, 410 côté proxy
    await expect(PageVideoRoute({ params: params({ slug: SLUGS[2]! }) })).rejects.toThrow(/404/);
    const gone = await reponseGoneSiRetiree(`/fr/videos/${SLUGS[2]!}`, {
      fetchImpl: async () => retirees(),
      origine: "https://axion-ia.com",
      maintenant: () => Date.now(),
    });
    expect(gone?.status).toBe(410);
  });

  it("la série et le thème passent sous le seuil de 3 : leurs pages disparaissent d'elles-mêmes", async () => {
    for (let k = 0; k < 3; k++) await publier(k);
    await DELETE(
      requete(
        "DELETE",
        JSON.stringify({ schemaVersion: 1, studioVideoId: "vs_episode_1_xx", motif: "autre" }),
      ),
    );
    await vi.advanceTimersByTimeAsync(10);
    await expect(PageTheme({ params: params({ theme: "audit-ia" }) })).rejects.toThrow(/404/);
    await expect(PageSerie({ params: params({ serie: "ma-serie" }) })).rejects.toThrow(/404/);
    const xml = await (await sitemapVideos()).text();
    expect(xml).not.toContain("/fr/videos/theme/");
    expect(xml).not.toContain("/fr/videos/serie/");
  });

  it("retirer la dernière vidéo publiée : plus de sitemap, plus d'index, plus de galerie", async () => {
    await publier(0);
    await DELETE(
      requete(
        "DELETE",
        JSON.stringify({ schemaVersion: 1, studioVideoId: "vs_episode_0_xx", motif: "obsolete" }),
      ),
    );
    await vi.advanceTimersByTimeAsync(10);
    expect((await sitemapVideos()).status).toBe(404);
    expect(await (await sitemapIndex()).text()).not.toContain("sitemap-videos.xml");
    await expect(Galerie({ params: params() })).rejects.toThrow(/404/);
    expect(await (await llms()).text()).not.toContain("## Vidéos");
  });
});
