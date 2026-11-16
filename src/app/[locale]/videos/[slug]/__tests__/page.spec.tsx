// @vitest-environment node
// Page de visionnage /fr/videos/[slug] (lot W2).
import type { ReactNode } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { uneVideo } from "../../__tests__/fixture";
import type { VideoPubliee } from "@/server/videos/lecture";
import { analyserFichePage } from "@/server/videos/contrat";
import { mentionIa } from "@/server/videos/mention-ia";

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

  it("og:video (contentUrl, type, dimensions) et og:image = l'affiche 16:9", async () => {
    const meta = await generateMetadata({ params: params("automatiser-ses-relances") });
    const videos = meta.openGraph && "videos" in meta.openGraph ? meta.openGraph.videos : undefined;
    const chemin = "/medias/videos/automatiser-ses-relances/v3/video-1080p.mp4";
    expect(videos).toEqual([
      {
        url: expect.stringMatching(new RegExp(`^https?://.+${chemin}$`)),
        secureUrl: expect.stringMatching(new RegExp(`^https?://.+${chemin}$`)),
        type: "video/mp4",
        width: 1920,
        height: 1080,
      },
    ]);
    expect(JSON.stringify(meta.openGraph?.images)).toContain("affiche-16x9.avif");
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

// ── SEO-05 : la page d'une automatisation reçoit la FICHE DE PAGE (usine/seo/FICHE-DE-PAGE.md).
const BASE = "/medias/videos/automatiser-ses-relances/v3";
const FICHE_BRUTE = {
  titre: "Gagnez du temps : automatisez vos relances clients",
  metaDescription:
    "Automatisez vos relances clients par étapes, sans perdre le ton de votre entreprise. Découvrez la méthode en vidéo, avec ses limites et ses étapes.",
  h1: "Gagnez du temps en automatisant vos relances clients",
  resumeCitable:
    "L’automatisation des relances clients envoie à votre place les messages de suivi aux bons moments. Elle fait gagner du temps aux petites équipes et évite les oublis. Elle ne remplace pas un appel quand la situation est délicate.",
  gain: "Vos relances partent à temps, sans que personne n’ait à y penser chaque semaine.",
  limites: ["L’automatisation des relances ne remplace pas un appel pour un client mécontent."],
  questions: [1, 2, 3].map((n) => ({
    question: `FAQ-FICHE-${n} : comment fonctionne l’automatisation des relances clients ?`,
    reponse: `REPONSE-FICHE-${n} : l’automatisation des relances clients repose sur des règles simples : un événement déclenche un message prévu à l’avance. Vous choisissez le moment et le ton, puis vous relisez les messages avant le premier envoi.`,
  })),
  auteur: "Équipe Axion-IA",
  carrousel: [1, 2].map((n) => ({
    chemin: `${BASE}/carrousel-${n}.avif`,
    alt: `CARROUSEL-ALT-${n} : schéma en trois étapes d’une relance, du devis envoyé jusqu’à la réponse du client`,
    largeur: 1080,
    hauteur: 1350,
  })),
  infographie: {
    chemin: `${BASE}/infographie.avif`,
    alt: "INFOGRAPHIE-ALT : frise des étapes d’une relance automatique, avec le message envoyé à chaque étape",
    largeur: 1080,
    hauteur: 1920,
  },
};

function uneFiche(): NonNullable<VideoPubliee["fichePage"]> {
  const r = analyserFichePage(FICHE_BRUTE);
  if (!r.ok) throw new Error(`fiche de test invalide : ${r.champs.join(", ")}`);
  return r.donnees;
}

const comptes = (src: string, re: RegExp) => (src.match(re) ?? []).length;

describe("SEO-05 — la fiche de page pilote la page", () => {
  it("la fiche de test respecte le contrat (longueurs de FICHE-DE-PAGE.md)", () => {
    expect(analyserFichePage(FICHE_BRUTE).ok).toBe(true);
    expect(analyserFichePage({ ...FICHE_BRUTE, h1: "trop court" }).ok).toBe(false);
    expect(analyserFichePage({ ...FICHE_BRUTE, prix: 1 }).ok).toBe(false);
    // Champ 20 : l'alt décrit ce qu'on voit, 80 à 125 caractères (refus à 79 et à 126).
    const avecAlt = (alt: string) => ({
      ...FICHE_BRUTE,
      infographie: { ...FICHE_BRUTE.infographie, alt },
    });
    expect(analyserFichePage(avecAlt("a".repeat(79))).ok).toBe(false);
    expect(analyserFichePage(avecAlt("a".repeat(80))).ok).toBe(true);
    expect(analyserFichePage(avecAlt("a".repeat(126))).ok).toBe(false);
  });

  it("UN SEUL h1, celui de la fiche ; sinon le titre de la vidéo", async () => {
    h.videos = [uneVideo({ fichePage: uneFiche() })];
    const avec = await html();
    expect(comptes(avec, /<h1[\s>]/g)).toBe(1);
    expect(avec).toMatch(/<h1[^>]*>Gagnez du temps en automatisant vos relances clients<\/h1>/);
    h.videos = [uneVideo()];
    const sans = await html();
    expect(comptes(sans, /<h1[\s>]/g)).toBe(1);
    expect(sans).toMatch(/<h1[^>]*>Automatiser ses relances clients/);
  });

  it("méta description et titre tirés de la fiche ; canonique = /fr/videos/<slug> sans paramètre", async () => {
    h.videos = [uneVideo({ fichePage: uneFiche() })];
    const meta = await generateMetadata({ params: params("automatiser-ses-relances") });
    expect(meta.description).toBe(FICHE_BRUTE.metaDescription);
    expect(JSON.stringify(meta.title)).toContain(FICHE_BRUTE.titre);
    expect(meta.alternates?.canonical).toBe("/fr/videos/automatiser-ses-relances");
    expect(String(meta.openGraph?.url)).toMatch(/\/fr\/videos\/automatiser-ses-relances$/);
  });

  it("fiche + iaVoixGeneree → la description contient la méta de la fiche ET la mention IA", async () => {
    h.videos = [uneVideo({ fichePage: uneFiche(), iaVoixGeneree: true })];
    const meta = await generateMetadata({ params: params("automatiser-ses-relances") });
    const mention = mentionIa({ iaVoixGeneree: true, iaDoubleNumerique: false });
    expect(mention).toBeTruthy();
    expect(meta.description).toBe(`${FICHE_BRUTE.metaDescription} ${mention}`);
  });

  it("sans fiche : la description de la vidéo reste utilisée (aucune régression)", async () => {
    const meta = await generateMetadata({ params: params("automatiser-ses-relances") });
    expect(meta.description).toContain("relances clients automatiques");
  });

  it("résumé citable, gain, limites, auteur et date de mise à jour sont visibles", async () => {
    h.videos = [uneVideo({ fichePage: uneFiche() })];
    const sortie = await html();
    expect(sortie).toContain("L’automatisation des relances clients envoie à votre place");
    expect(sortie).toContain(FICHE_BRUTE.gain);
    expect(sortie).toContain(FICHE_BRUTE.limites[0]);
    expect(sortie).toContain("Équipe Axion-IA");
    expect(sortie).toMatch(/Mis à jour le/);
  });

  it("carrousel et infographie s'affichent avec leur texte alternatif, chargés en différé", async () => {
    h.videos = [uneVideo({ fichePage: uneFiche() })];
    const sortie = await html();
    expect(comptes(sortie, /<img[^>]*alt="CARROUSEL-ALT-\d/g)).toBe(2);
    expect(sortie).toContain("INFOGRAPHIE-ALT");
    expect(sortie).toMatch(/<img[^>]*loading="lazy"/);
    expect(sortie).toContain("carrousel-1.avif");
    expect(sortie).toContain("infographie.avif");
  });

  it("sans carrousel ni infographie : aucune section vide", async () => {
    const sortie = await html();
    expect(sortie).not.toMatch(/carrousel|infographie/i);
  });

  it("transcription affichée dans le HTML quand elle existe", async () => {
    h.videos = [uneVideo({ transcription: "TRANSCRIPTION-LIGNE-A\n\nTRANSCRIPTION-LIGNE-B" })];
    const sortie = await html();
    expect(sortie).toContain("TRANSCRIPTION-LIGNE-A");
    expect(sortie).toContain("TRANSCRIPTION-LIGNE-B");
  });

  it("questions-réponses de la fiche affichées, et reprises à l'identique dans FAQPage", async () => {
    h.videos = [uneVideo({ fichePage: uneFiche() })];
    const sortie = await html();
    for (const n of [1, 2, 3]) {
      expect(sortie).toContain(`FAQ-FICHE-${n}`);
      expect(sortie).toContain(`REPONSE-FICHE-${n}`);
    }
    expect(sortie).not.toContain("QUESTION-UNE");
    expect(sortie).toContain('"@type":"FAQPage"');
    expect(sortie).toContain('"@type":"ImageObject"');
    expect(sortie).toContain('"@type":"BreadcrumbList"');
  });

  it("aucun mot interdit dans le texte rendu", async () => {
    h.videos = [uneVideo({ fichePage: uneFiche() })];
    const sortie = await html();
    expect(sortie).not.toMatch(/Grenoble|certifi|Qualiopi|Aucun gain garanti|Buffer|€/i);
  });
});

describe("SEO-05 — vidéo retirée : 410 (L8-13b)", () => {
  it("le proxy branche le 410 des vidéos retirées AVANT la page ; la page, elle, ne sert plus rien", async () => {
    const proxy = readFileSync(join(__dirname, "../../../../../proxy.ts"), "utf8");
    expect(proxy).toMatch(/reponseGoneSiRetiree\(/);
    h.videos = [];
    await expect(html()).rejects.toThrow(/404/);
  });
});

export type { VideoPubliee };
