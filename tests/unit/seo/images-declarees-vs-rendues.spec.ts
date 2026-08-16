/**
 * Verrou GEO-037 / GEO-056 / GEO-101 — ce qu'on DÉCLARE sur nos images doit
 * être vrai (audit GEO/AEO end-to-end du 2026-08-14, lot 11).
 *
 * Les trois défauts couverts ici ont la même forme : une déclaration faite aux
 * moteurs que la réalité dément.
 *
 *  - **GEO-056** — 9 images déclarées en JSON-LD et au sitemap n'étaient pas
 *    sur la page. Mesuré en production le 2026-08-16 : `/fr/roi` déclarait
 *    6 images et n'en rendait que 2 ; `/fr/formations/entreprise` en déclarait
 *    7 pour 2 rendues. Google demande que l'image du sitemap soit sur la page.
 *  - **GEO-037** — `<image:license>` CC BY 4.0 était émise INCONDITIONNELLEMENT,
 *    y compris sur des photos Unsplash. Accorder une licence de réutilisation
 *    qu'on ne détient pas est un défaut juridique, pas seulement SEO.
 *  - **GEO-101** — 133 `<image:loc>` sur 133 du sitemap blog pointaient
 *    `images.unsplash.com` : la valeur d'indexation image de tout le corpus
 *    éditorial était cédée à un hôte tiers.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { PAGE_IMAGES_MANIFEST } from "@/lib/seo/page-images";

function source(relatif: string): string {
  return readFileSync(path.join(process.cwd(), relatif), "utf8");
}

function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function imagesDe(chemin: string) {
  const page = PAGE_IMAGES_MANIFEST.find((p) => p.path === chemin);
  expect(page, `page ${chemin} absente du manifeste`).toBeDefined();
  return page!.images;
}

describe("manifeste — on ne déclare que ce que la page rend (GEO-056)", () => {
  it("garde anti-test-vide : le manifeste est peuplé", () => {
    expect(PAGE_IMAGES_MANIFEST.length).toBeGreaterThan(20);
  });

  // Les slots retirés sont ceux dont la mesure en production a montré qu'ils
  // n'apparaissent dans AUCUN `<img>` de la page. On verrouille par `src` :
  // c'est ce que le sitemap et le JSON-LD publient.
  const RETIREES: ReadonlyArray<readonly [string, readonly string[]]> = [
    [
      "/roi",
      [
        "/illustrations/roi/redaction.avif",
        "/illustrations/roi/recherche.avif",
        "/illustrations/roi/synthese.avif",
        "/illustrations/roi/reporting.avif",
      ],
    ],
    [
      "/formations/entreprise",
      [
        "/illustrations/formation-claude-team-quadriptyque.png",
        "/illustrations/formations/formateur-ia-claude-atelier-pme.png",
        "/illustrations/formations/equipe-pme-formation-ia-atelier-pratique.png",
        "/illustrations/william-fondateur-formateur-ia-axion-ia.png",
      ],
    ],
  ];

  for (const [chemin, sources] of RETIREES) {
    it(`${chemin} ne déclare plus d'image absente du DOM`, () => {
      const declarees = new Set(imagesDe(chemin).map((i) => i.src));
      for (const src of sources) {
        expect(
          declarees.has(src),
          `${src} est de nouveau déclarée sur ${chemin}. Si l'intention est de ` +
            `l'AFFICHER, il faut la rendre dans la page — pas seulement la ` +
            `déclarer : Google exige que l'image du sitemap soit sur la page.`,
        ).toBe(false);
      }
    });
  }

  it("🔴 une image servant de BRANCHE DE REPLI n'est pas une déclaration morte", () => {
    // Piège rencontré en posant ce lot : `home-hero-equipe.avif` n'apparaît
    // dans aucun `<img>` de la page en production, et j'allais donc la retirer
    // comme les autres. Or `entreprise/page.tsx:549` s'en sert comme repli du
    // héro (`) : heroImage ? (`) : la retirer aurait privé ce repli d'image le
    // jour où la branche principale tombe.
    //
    // Le critère n'est donc PAS « rendue à l'instant t » mais « la page a-t-elle
    // un consommateur pour ce slot ». Cette assertion fige la leçon.
    const form = imagesDe("/formations/entreprise");
    const hero = form.find((i) => i.slot === "hero");
    expect(
      hero?.src,
      "le slot `hero` a disparu du manifeste alors que la page le consomme en " +
        'repli : `images.find((i) => i.slot === "hero")` rendrait `undefined`.',
    ).toBe("/illustrations/home-hero-equipe.avif");

    const page = readFileSync(
      path.join(process.cwd(), "src/app/[locale]/formations/entreprise/page.tsx"),
      "utf8",
    );
    expect(
      page.includes('i.slot === "hero"'),
      "la page ne consomme plus le slot `hero` : la déclaration devient morte " +
        "et doit alors être retirée du manifeste.",
    ).toBe(true);
  });

  it("les images réellement rendues sont conservées", () => {
    // Contre-poids du test précédent : une purge trop large se verrait ici.
    const roi = new Set(imagesDe("/roi").map((i) => i.src));
    expect(roi.has("/illustrations/roi/hero.avif")).toBe(true);
    expect(roi.has("/illustrations/roi/banner.avif")).toBe(true);

    const form = new Set(imagesDe("/formations/entreprise").map((i) => i.src));
    expect(
      form.has("/illustrations/formations/comment-reserver-formation-ia-entreprise-axion-ia.avif"),
    ).toBe(true);
  });
});

describe("licence — on ne licencie que ce qui nous appartient (GEO-037)", () => {
  const SITEMAP = sansCommentaires(source("src/app/sitemap-images-services.xml/route.ts"));

  it('les photos tierces sont marquées `origin: "unsplash"`', () => {
    const tierces = PAGE_IMAGES_MANIFEST.flatMap((p) => p.images).filter(
      (i) => i.origin === "unsplash",
    );
    expect(
      tierces.length,
      "plus aucune image n'est marquée comme tierce : soit le marquage a été " +
        "perdu, soit il n'a jamais été propagé aux nouvelles photos Unsplash.",
    ).toBeGreaterThan(5);
  });

  it("le sitemap conditionne `<image:license>` à l'origine de l'image", () => {
    expect(
      /origin\s*===\s*"unsplash"/.test(SITEMAP),
      "la licence CC BY 4.0 est de nouveau émise inconditionnellement : on " +
        "accorde à des tiers un droit de réutilisation sur des photos dont on " +
        "ne détient pas les droits.",
    ).toBe(true);
  });

  it("le sitemap blog n'émet AUCUNE licence", () => {
    // Ses images sont des photos tierces servies par notre domaine : les
    // héberger ne nous en donne pas les droits.
    const blog = sansCommentaires(source("src/app/sitemap-images-blog.xml/route.ts"));
    expect(blog).not.toContain("image:license");
  });
});

describe("sitemap images du blog — servi par le domaine (GEO-101)", () => {
  const BLOG = sansCommentaires(source("src/app/sitemap-images-blog.xml/route.ts"));

  it("les images distantes passent par l'optimiseur du domaine", () => {
    expect(BLOG).toContain("/_next/image?url=");
    expect(
      BLOG.includes("encodeURIComponent"),
      "l'URL source doit être encodée : sans quoi ses `&` cassent la query de " +
        "l'optimiseur et l'image devient un 400.",
    ).toBe(true);
  });

  it("la largeur déclarée franchit le plancher Discover (1200)", () => {
    // Les sources Unsplash étaient en `w=1080`, sous le plancher — c'est le
    // volet image de GEO-059.
    const m = /LARGEUR_DECLAREE\s*=\s*(\d+)/.exec(BLOG);
    expect(m, "LARGEUR_DECLAREE introuvable").not.toBeNull();
    expect(Number(m?.[1] ?? 0)).toBeGreaterThanOrEqual(1200);
  });

  it("ne renvoie plus jamais l'URL distante telle quelle", () => {
    expect(
      /return src;/.test(BLOG),
      "un chemin de retour direct de la source distante est réapparu : les " +
        "`<image:loc>` repartiraient chez l'hôte tiers.",
    ).toBe(false);
  });
});
