// @vitest-environment node
// Page de visionnage /fr/videos/[slug] (lot W2).
import type { ReactNode } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { uneVideo } from "../../__tests__/fixture";
import type { VideoPubliee } from "@/server/videos/lecture";

const h = vi.hoisted(() => ({ videos: [] as unknown[] }));

vi.mock("@/server/videos/lecture", () => ({
  videosPubliees: async () => h.videos,
  videoParSlug: async (slug: string) =>
    (h.videos as Array<{ slug: string }>).find((v) => v.slug === slug) ?? null,
  videosDuTheme: async (t: string) =>
    (h.videos as Array<{ theme: string }>).filter((v) => v.theme === t),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  },
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => (
    <a href={String(href)} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next-intl/server", () => ({
  setRequestLocale: () => {},
  getLocale: async () => "fr",
  getTranslations: async () => (cle: string) => cle,
}));

vi.mock("@/server/seo/og-overrides", () => ({ surchargeOgPour: async () => null }));

import Page, { generateMetadata, generateStaticParams } from "../page";

const sansCommentaires = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

const params = (slug: string, locale = "fr") => Promise.resolve({ locale, slug });

async function html(slug = "automatiser-ses-relances"): Promise<string> {
  return renderToStaticMarkup((await Page({ params: params(slug) })) as ReactNode);
}

beforeEach(() => {
  h.videos = [uneVideo()];
});

describe("page /fr/videos/[slug]", () => {
  it("slug inconnu → notFound", async () => {
    await expect(html("inconnu")).rejects.toThrow(/404/);
  });

  it("aucune vidéo publiée (drapeau éteint côté lecture) → notFound", async () => {
    h.videos = [];
    await expect(html()).rejects.toThrow(/404/);
  });

  it("locale autre que fr → notFound", async () => {
    await expect(Page({ params: params("automatiser-ses-relances", "en") })).rejects.toThrow(/404/);
  });

  it("le HTML serveur contient <video preload=none> avec son affiche, sans JS", async () => {
    const sortie = await html();
    expect(sortie).toMatch(/<video[^>]*preload="none"/);
    expect(sortie).toMatch(
      /<video[^>]*poster="\/medias\/videos\/automatiser-ses-relances\/v3\/affiche-16x9\.avif"/,
    );
    expect(sortie).toMatch(
      /<video[^>]*src="\/medias\/videos\/automatiser-ses-relances\/v3\/video-1080p\.mp4"/,
    );
    expect(sortie).toContain('<track kind="captions"');
  });

  it("titre en h1 et JSON-LD VideoObject dans le HTML", async () => {
    const sortie = await html();
    expect(sortie).toMatch(/<h1[^>]*>Automatiser ses relances clients/);
    expect(sortie).toContain('"@type":"VideoObject"');
    expect(sortie).not.toContain("embedUrl");
  });

  it("aucun script tiers dans le HTML de la page", async () => {
    const sortie = await html();
    const sources = [...sortie.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]);
    expect(sources.filter((s) => /^https?:\/\//.test(s!))).toEqual([]);
  });
});

describe("generateMetadata", () => {
  it("canonique /fr/videos/<slug> SANS paramètre, même si l'adresse reçue porte ?t=42", async () => {
    const meta = await generateMetadata({ params: params("automatiser-ses-relances") });
    expect(meta.alternates?.canonical).toBe("/fr/videos/automatiser-ses-relances");
    expect(String(meta.openGraph?.url)).toMatch(/\/fr\/videos\/automatiser-ses-relances$/);
    expect(JSON.stringify(meta)).not.toContain("?t=");
  });

  it("la page ne lit JAMAIS searchParams (sinon elle quitte l'ISR)", () => {
    const code = sansCommentaires(readFileSync(join(__dirname, "../page.tsx"), "utf8"));
    expect(code).not.toMatch(/searchParams/);
  });

  it("vidéo inconnue → métadonnées vides (la page répond 404)", async () => {
    expect(await generateMetadata({ params: params("inconnu") })).toEqual({});
  });
});

describe("rendu statique", () => {
  it("generateStaticParams → [] ; pas de force-static ; ISR 1 h", async () => {
    expect(await generateStaticParams()).toEqual([]);
    const code = sansCommentaires(readFileSync(join(__dirname, "../page.tsx"), "utf8"));
    expect(code).toMatch(/export const revalidate = 3600/);
    expect(code).toMatch(/export const dynamicParams = true/);
    expect(code).not.toMatch(/force-static/);
  });
});

export type { VideoPubliee };
