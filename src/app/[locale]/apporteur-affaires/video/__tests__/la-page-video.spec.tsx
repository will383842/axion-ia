/**
 * La page VSL apporteurs (`/apporteur-affaires/video`) : rendu RÉEL du composant
 * serveur, puis HTML statique — noindex, hors sitemap, livrable sans film, texte
 * conforme, boutons vers le formulaire, films servis hors du proxy et en cache long.
 */
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

const { film } = vi.hoisted(() => ({ film: { present: false } }));

vi.mock("next-intl/server", () => ({ setRequestLocale: () => undefined }));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: () => undefined }),
  Link: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
vi.mock("@/lib/lp/video-disponible", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@/lib/lp/video-disponible")>();
  return {
    ...reel,
    videoDisponible: () => film.present,
    fichierPublicExiste: () => film.present,
    lireTranscription: () => (film.present ? ["Bonjour, je suis Williams.", "À bientôt."] : []),
  };
});

import Page, { generateMetadata, generateStaticParams, revalidate } from "../page";

const RACINE = process.cwd();

function texte(h: string): string {
  return h
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&nbsp;| | /g, " ")
    .replace(/\s+/g, " ");
}

async function rendre(): Promise<string> {
  return renderToStaticMarkup(await Page({ params: Promise.resolve({ locale: "fr" }) }));
}

describe("la page vidéo des apporteurs : référencement", () => {
  it("noindex : jamais dans Google, mais lisible par le robot de Meta", async () => {
    const m = await generateMetadata({ params: Promise.resolve({ locale: "fr" }) });
    expect(m.robots).toMatchObject({ index: false });
    expect(m.title).toMatchObject({ absolute: expect.stringContaining("Apporteur d'affaires") });
  });

  it("statique (régénérée toutes les heures) : aucune lecture de donnée au rendu", () => {
    expect(revalidate).toBe(3600);
    expect(generateStaticParams().map((p) => p.locale)).toContain("fr");
  });

  it("hors sitemap : aucune source de sitemap ne cite la page", () => {
    const app = join(RACINE, "src/app");
    const dossiers = readdirSync(app).filter((n) => n.startsWith("sitemap"));
    const fichiers = (d: string): string[] =>
      readdirSync(d).flatMap((n) => {
        const p = join(d, n);
        return statSync(p).isDirectory() ? fichiers(p) : [p];
      });
    const sources = [
      ...dossiers.flatMap((n) => {
        const p = join(app, n);
        return statSync(p).isDirectory() ? fichiers(p) : [p];
      }),
      ...fichiers(join(app, "sitemaps")),
    ];
    // Témoin : on a bien lu des fichiers (sinon « rien trouvé » ne prouverait rien).
    expect(sources.length).toBeGreaterThan(5);
    for (const f of sources) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/apporteur-affaires\/video/);
    }
  });

  it("pas de « facebook » dans l'adresse de la page ni dans celle de la page de merci", () => {
    const racine = join(RACINE, "src/app/[locale]/apporteur-affaires/video");
    expect(statSync(join(racine, "page.tsx")).isFile()).toBe(true);
    expect(statSync(join(racine, "merci", "page.tsx")).isFile()).toBe(true);
    expect(racine.toLowerCase()).not.toMatch(/facebook/);
  });
});

describe("la page vidéo des apporteurs : livrable SANS film", () => {
  it("sans fichier : ni lecteur, ni piste, ni transcription — la page tient (titre, bouton, formulaire)", async () => {
    film.present = false;
    const h = await rendre();
    expect(h).not.toContain("<video");
    expect(h).not.toContain("<track");
    expect(texte(h)).not.toContain("Lire la transcription");
    expect(h).toContain("<h1");
    expect(texte(h)).toContain("Vous connaissez des dirigeants de PME ?");
    expect(h).toContain('id="candidater"');
    expect(h).toContain('id="vsl-formulaire"');
  });

  it("avec les fichiers : le film (4:5 sur téléphone, sous-titres, transcription repliable) apparaît", async () => {
    film.present = true;
    const h = await rendre();
    expect(h).toContain("<video");
    expect(h).toContain('src="/videos/vsl-apporteur-v1.mp4"');
    expect(h).toContain('preload="none"');
    expect(h).toContain('kind="captions"');
    expect(h).toContain("aspect-[4/5]");
    expect(h).toContain("<details");
    expect(texte(h)).toContain("Bonjour, je suis Williams.");
    film.present = false;
  });
});

describe("la page vidéo des apporteurs : contenu servi", () => {
  it("un seul bouton répété, qui mène au formulaire (ancre) ; le bouton collant aussi", async () => {
    const h = await rendre();
    const ancres = h.match(/href="\/apporteur-affaires\/video#candidater"/g) ?? [];
    expect(ancres.length).toBeGreaterThanOrEqual(3); // héro, milieu, bouton collant (mobile + bureau)
    expect(texte(h)).toContain("Je candidate (2 minutes)");
    // Chaque bouton vers le formulaire garde le MÊME libellé : un seul geste attendu.
    const boutons = [...h.matchAll(/<a [^>]*data-cta="(vsl-[^"]*)"[^>]*>(.*?)<\/a>/g)]
      .filter((m) => /^vsl-(vsl-|sticky)/.test(m[1] ?? ""))
      .map((m) =>
        texte(m[2] ?? "")
          .replace("→", "")
          .trim(),
      );
    expect(boutons.length).toBeGreaterThanOrEqual(3);
    expect(new Set(boutons)).toEqual(new Set(["Je candidate (2 minutes)"]));
  });

  it("aucun mot interdit, aucun téléphone, aucun montant hors FAQ, aucun gain en tête de page", async () => {
    const t = texte(await rendre());
    expect(t).not.toMatch(/qualiopi|parrain|vendre|commercial|recrutement|facebook/i);
    expect(t).not.toMatch(/(?:\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}/);
    expect(t).not.toMatch(/tel:/i);
    // La seule somme vient de pricing.ts et vit dans la FAQ, « à titre indicatif ».
    const montants = t.match(/\d[\d\s]*\s€/g) ?? [];
    expect(montants).toHaveLength(1);
    expect(t).toMatch(/À titre indicatif, jusqu'à 500 € par journée/);
    const tete = t.slice(0, t.indexOf("Je candidate"));
    expect(tete).not.toMatch(/€|gagn/);
  });

  it("une colonne, pas d'image avant le formulaire (le LCP est le titre) ni de lien vers le site", async () => {
    film.present = false;
    const h = await rendre();
    const avantFormulaire = h.slice(0, h.indexOf('id="candidater"'));
    expect(avantFormulaire).not.toContain("<img");
    expect(h).not.toMatch(/href="\/fr\/(?!catalogue)[a-z-]+"/);
  });

  it("la FAQ ne publie pas de JSON-LD (page noindex)", async () => {
    expect(await rendre()).not.toContain("application/ld+json");
  });

  it("le formulaire est rendu à l'étape 1, avec ses deux actions reçues par props", async () => {
    const h = await rendre();
    expect(texte(h)).toContain("Étape 1 sur 2");
    expect(h).toContain('name="prenom"');
    expect(h).toContain('name="email"');
    expect(h).not.toContain('name="telephone"');
  });
});

describe("les films : servis hors du proxy, en cache long", () => {
  /** Le motif du `matcher` tel qu'il est réellement écrit dans proxy.ts. */
  function matcherRegex(): RegExp {
    const source = readFileSync(join(RACINE, "src/proxy.ts"), "utf8");
    const ligne = source.split("\n").find((l) => l.trim().startsWith('"/((?!'));
    if (!ligne) throw new Error("Motif du matcher introuvable dans src/proxy.ts");
    const pattern = ligne.trim().replace(/^"/, "").replace(/",?$/, "").replace(/\\\\/g, "\\");
    return new RegExp(`^${pattern}$`);
  }

  it("le proxy ne capte ni le MP4 ni les sous-titres (sinon 301 vers /fr/videos/… = 404)", () => {
    const m = matcherRegex();
    expect(m.test("/videos/vsl-apporteur-v1.mp4")).toBe(false);
    expect(m.test("/videos/vsl-apporteur-v1.fr.vtt")).toBe(false);
    expect(m.test("/videos/vsl-apporteur-v1-poster.avif")).toBe(false);
  });

  it("contre-témoin : les pages restent captées, et une route voisine sans barre aussi", () => {
    const m = matcherRegex();
    expect(m.test("/fr/apporteur-affaires/video")).toBe(true);
    expect(m.test("/fr/apporteur-affaires/video/merci")).toBe(true);
    expect(m.test("/videos-de-formation")).toBe(true);
  });

  it("next.config.ts pose un cache d'un an, immuable, sur /videos/*", () => {
    const config = readFileSync(join(RACINE, "next.config.ts"), "utf8");
    const i = config.indexOf('source: "/videos/:path*"');
    expect(i).toBeGreaterThan(0);
    expect(config.slice(i, i + 300)).toContain("public, max-age=31536000, immutable");
  });
});
