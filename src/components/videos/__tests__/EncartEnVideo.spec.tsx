// @vitest-environment node
import type { ReactNode } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { uneVideo } from "@/app/[locale]/videos/__tests__/fixture";

const h = vi.hoisted(() => ({ videos: [] as unknown[] }));
vi.mock("@/server/videos/lecture", () => ({ videosPubliees: async () => h.videos }));

import { EncartEnVideo } from "../EncartEnVideo";

const rendre = async (props: Parameters<typeof EncartEnVideo>[0]) =>
  renderToStaticMarkup((await EncartEnVideo(props)) as ReactNode);

beforeEach(() => {
  h.videos = [];
});

describe("EncartEnVideo — serveur, zéro JS (W4.1)", () => {
  it("thème sans vidéo → rien du tout", async () => {
    expect(await rendre({ theme: "audit-ia" })).toBe("");
  });

  it("une carte : titre, durée, lien vers la page vidéo, intitulé « En vidéo »", async () => {
    h.videos = [uneVideo({ theme: "audit-ia" })];
    const html = await rendre({ theme: "audit-ia" });
    expect(html).toContain("En vidéo");
    expect(html).toContain("Automatiser ses relances clients");
    expect(html).toContain("3 min 04");
    expect(html).toMatch(/<a[^>]*href="\/fr\/videos\/automatiser-ses-relances"/);
  });

  it("AUCUN <video>, AUCUN JSON-LD (VideoObject ou autre) sur la page hôte", async () => {
    h.videos = [uneVideo({ theme: "audit-ia" })];
    const html = await rendre({ theme: "audit-ia" });
    expect(html).not.toContain("<video");
    expect(html).not.toContain("ld+json");
    expect(html).not.toContain("VideoObject");
  });

  it("vignette paresseuse, dimensions explicites (CLS = 0), hors optimiseur", async () => {
    h.videos = [uneVideo({ theme: "audit-ia" })];
    const html = await rendre({ theme: "audit-ia" });
    expect(html).toMatch(/<img[^>]*loading="lazy"/);
    expect(html).toMatch(
      /<img[^>]*width="960"[^>]*height="720"|<img[^>]*height="720"[^>]*width="960"/,
    );
    expect(html).toContain("aspect-[4/3]");
  });

  it("mention IA courte quand la vidéo en porte une, rien sinon", async () => {
    h.videos = [uneVideo({ theme: "audit-ia", iaVoixGeneree: true })];
    expect(await rendre({ theme: "audit-ia" })).toContain("Voix de synthèse générée par IA.");
    h.videos = [uneVideo({ theme: "audit-ia" })];
    expect(await rendre({ theme: "audit-ia" })).not.toContain("générée par IA");
  });

  it("même vidéo jamais deux fois : l'exclusion fait passer à la suivante", async () => {
    h.videos = [
      uneVideo({ slug: "a", theme: "audit-ia" }),
      uneVideo({ slug: "b", theme: "audit-ia" }),
    ];
    const html = await rendre({ theme: "audit-ia", exclure: ["a"] });
    expect(html).toContain("/fr/videos/b");
    expect(html).not.toContain('/fr/videos/a"');
  });

  it("aucun « use client » ni lecteur dans le composant", () => {
    const src = readFileSync("src/components/videos/EncartEnVideo.tsx", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(src).not.toMatch(/^\s*["']use client["']/m);
    expect(src).not.toMatch(/VslVideo|PageVideo/);
  });
});
