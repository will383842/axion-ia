/**
 * GEO-028 (audit GEO/AEO end-to-end du 2026-08-15) — le portrait d'auteur.
 *
 * ## Le défaut que ce fichier existe pour empêcher
 *
 * `AuthorProfile.photoUrl256` (SSOT, seedé à `/auteurs/manon.png`) désigne un
 * PNG de 1 513 427 octets. La byline l'affichait en 64 × 64 dans un `<img>`
 * BRUT — donc 1,5 Mo transférés, sur toutes les pages éditoriales du site
 * (blog, actualités, guides, cas concrets), pour 4 096 pixels peints.
 *
 * Le commentaire qui justifiait le `<img>` brut n'était pas absurde : il
 * affirmait que `authorAvatarUrl` était « une URL remote arbitraire (DB) ».
 * C'est vrai en théorie et faux en pratique — la seule valeur que la base ait
 * jamais portée est un chemin LOCAL, que `next/image` sait servir en AVIF
 * dimensionné. Un raisonnement juste sur le type, faux sur la donnée.
 *
 * ## Ce que les tests verrouillent
 *
 * 1. Le comportement : URL locale → optimiseur, URL distante → `<img>` brut
 *    (l'optimiseur renverrait 400, `images.remotePatterns` n'autorisant que
 *    `images.unsplash.com`).
 * 2. Le cliquet de poids : tant que le portrait du seed dépasse le budget,
 *    la byline DOIT passer par `next/image`. Ce test rougit sur `main` avant
 *    le correctif — c'est sa seule raison d'exister.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, statSync, existsSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";

import { AuthorByline, isLocalAvatarUrl } from "./AuthorByline";

/** Budget d'un visuel servi tel quel sur une page publique. */
const BUDGET_ASSET_BRUT_OCTETS = 200_000;

const BASE = {
  authorName: "Manon",
  publishedAt: new Date("2026-01-15T00:00:00.000Z"),
  locale: "fr" as const,
  emitJsonLd: false,
};

function rendu(avatarUrl: string): string {
  return renderToStaticMarkup(<AuthorByline {...BASE} authorAvatarUrl={avatarUrl} />);
}

describe("isLocalAvatarUrl", () => {
  it("reconnaît un chemin servi depuis public/", () => {
    expect(isLocalAvatarUrl("/auteurs/manon.png")).toBe(true);
  });

  it("🔴 ne prend pas une URL protocol-relative pour une ressource locale", () => {
    // `//cdn.example.com/x.png` commence bien par « / » : c'est le piège que
    // ce prédicat existe pour désamorcer. L'optimiseur refuserait l'origine.
    expect(isLocalAvatarUrl("//cdn.example.com/portrait.png")).toBe(false);
  });

  it("laisse passer les URL absolues au traitement distant", () => {
    expect(isLocalAvatarUrl("https://images.unsplash.com/photo-1")).toBe(false);
  });
});

describe("AuthorByline — rendu de l'avatar", () => {
  it("🔴 un portrait LOCAL passe par l'optimiseur d'images", () => {
    const html = rendu("/auteurs/manon.png");
    expect(html).toContain("/_next/image");
    // Le fichier source ne doit plus apparaître comme `src` direct.
    expect(html).not.toContain('src="/auteurs/manon.png"');
  });

  it("un portrait DISTANT garde son URL intacte", () => {
    const distant = "https://images.unsplash.com/photo-1?w=64";
    const html = rendu(distant);
    expect(html).toContain(distant);
    expect(html).not.toContain("/_next/image");
  });

  it("les dimensions restent fixées dans les deux cas (CLS = 0)", () => {
    for (const url of ["/auteurs/manon.png", "https://images.unsplash.com/photo-1"]) {
      const html = rendu(url);
      expect(html).toContain('width="64"');
      expect(html).toContain('height="64"');
      expect(html).toContain('loading="lazy"');
    }
  });

  it("sans URL de portrait, aucune image n'est rendue", () => {
    const html = renderToStaticMarkup(<AuthorByline {...BASE} />);
    expect(html).not.toContain("<img");
  });
});

describe("cliquet de poids du portrait de byline", () => {
  /** Le SSOT du portrait : le seed `AuthorProfile`, pas une constante locale. */
  function portraitDuSeed(): string | null {
    const seed = readFileSync("prisma/seeds/content-gen/author-profile.ts", "utf8");
    return /photoUrl256:\s*"([^"]+)"/.exec(seed)?.[1] ?? null;
  }

  it("le seed déclare bien un portrait de byline", () => {
    expect(portraitDuSeed()).toBeTruthy();
  });

  it("🔴 un portrait local hors budget IMPOSE le passage par next/image", () => {
    const chemin = portraitDuSeed();
    if (!chemin || !isLocalAvatarUrl(chemin)) return; // portrait distant : hors sujet.

    const fichier = `public${chemin}`;
    if (!existsSync(fichier)) return; // servi ailleurs (R2/CDN) : hors sujet.

    const octets = statSync(fichier).size;
    if (octets <= BUDGET_ASSET_BRUT_OCTETS) return; // rien à optimiser.

    // Le fichier dépasse le budget : le servir brut est une régression.
    const source = readFileSync("src/components/knowledge/public/AuthorByline.tsx", "utf8");
    expect(
      source.includes('from "next/image"'),
      `${fichier} pèse ${octets} octets (> ${BUDGET_ASSET_BRUT_OCTETS}) : ` +
        "AuthorByline doit le servir via next/image, pas dans un <img> brut.",
    ).toBe(true);
  });
});
