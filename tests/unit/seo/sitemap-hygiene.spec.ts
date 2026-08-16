/**
 * Verrou GEO-130 / GEO-131 / GEO-145 / GEO-147 — hygiène des sitemaps
 * (audit GEO/AEO end-to-end du 2026-08-14, lot 20).
 *
 * ## Les quatre défauts que ce fichier existe pour empêcher
 *
 * 1. **GEO-130** — une URL `noindex` déclarée dans `pages.xml`
 *    (`/demande-devis/confirmation`). Search Console la remonte en
 *    « noindexed URL in sitemap » : on demande l'indexation de ce qu'on
 *    interdit d'indexer.
 * 2. **GEO-131** — l'inverse : `/ressources` répond 200, est indexable, et
 *    n'était déclarée dans AUCUN sitemap.
 * 3. **GEO-145** — `/fr/equipe/manon`, page CIBLE du `@id` du nœud `Person` de
 *    tout le JSON-LD éditorial, absente des sitemaps alors que
 *    `/fr/equipe/williams` y est.
 * 4. **GEO-147** — un sub-sitemap `guides` redondant, à une seule URL déjà
 *    émise par `pages.xml`.
 *
 * ## Ce que la garde vérifie, et pourquoi ainsi
 *
 * `generateSitemaps()` et les builders lisent la base et l'environnement : les
 * exécuter ici demanderait un harnais entier. On s'ancre donc sur les deux
 * SOURCES DE VÉRITÉ qui décident du contenu de `pages.xml` — la table
 * `routing.pathnames` et la liste d'exclusion de `sitemap.ts` — plus la
 * déclaration explicite des deux fiches d'équipe.
 *
 * ⚠️ RÈGLE DE RÉDACTION : les commentaires de `sitemap.ts` citent en toutes
 * lettres les clés concernées (c'est leur rôle : expliquer pourquoi elles sont
 * là ou pas). Ils sont retirés avant toute recherche, sinon la garde se trouve
 * elle-même.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { routing } from "@/i18n/routing";

function source(relatif: string): string {
  return readFileSync(path.join(process.cwd(), relatif), "utf8");
}

/** Retire commentaires de bloc et de ligne. Voir la règle de rédaction ci-dessus. */
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const SITEMAP = sansCommentaires(source("src/app/sitemap.ts"));

describe("pages.xml — ce qui est noindex n'y entre pas (GEO-130)", () => {
  it("garde anti-test-vide : la liste d'exclusion est bien lue", () => {
    // Sans cette borne, une liste vide ferait passer les tests suivants au vert
    // en n'ayant rien vérifié du tout.
    expect(SITEMAP.length, "src/app/sitemap.ts lu vide").toBeGreaterThan(5000);
    expect(SITEMAP).toContain("EXCLUDED_FROM_INDEX");
  });

  it("`/demande-devis/confirmation` est exclue — la page porte `index: false`", () => {
    const page = sansCommentaires(source("src/app/[locale]/demande-devis/confirmation/page.tsx"));
    // La garde n'a de sens que si la page est bien noindex : on le vérifie
    // AVANT d'exiger son exclusion, sinon on verrouillerait une exclusion
    // devenue injustifiée.
    expect(
      /index:\s*false/.test(page),
      "la page de confirmation n'est plus `noindex` : cette exclusion du sitemap " +
        "n'a plus lieu d'être, il faut la revoir plutôt que de la conserver.",
    ).toBe(true);
    expect(
      SITEMAP.includes('"/demande-devis/confirmation"'),
      "URL `noindex` de nouveau déclarable dans pages.xml — c'est l'incohérence " +
        "« noindexed URL in sitemap » que Search Console remonte.",
    ).toBe(true);
  });
});

describe("pages.xml — ce qui est indexable y entre (GEO-131)", () => {
  it("`/ressources` a une clé dans routing.pathnames", () => {
    // `pages.xml` se construit en parcourant `routing.pathnames` : sans clé,
    // aucune déclaration possible, quelle que soit la qualité de la page.
    expect(
      Object.keys(routing.pathnames),
      "sans cette clé, `/fr/ressources` redevient invisible pour les sitemaps.",
    ).toContain("/ressources");
  });

  it("`/ressources` n'est pas exclue de l'index", () => {
    const exclusions = SITEMAP.slice(
      SITEMAP.indexOf("EXCLUDED_FROM_INDEX"),
      SITEMAP.indexOf("]", SITEMAP.indexOf("EXCLUDED_FROM_INDEX")),
    );
    expect(exclusions).not.toContain('"/ressources"');
  });
});

describe("fiches d'équipe — le graphe d'entité ne reste pas ouvert (GEO-145)", () => {
  for (const slug of ["williams", "manon"]) {
    it(`/fr/equipe/${slug} est déclarée explicitement`, () => {
      expect(
        SITEMAP.includes(`/fr/equipe/${slug}`),
        `la fiche ${slug} n'est plus déclarée. Le template /equipe/[slug] étant ` +
          `exclu (slug template), ces URLs ne sont découvrables QUE par cette ` +
          `déclaration explicite — et celle de Manon est la cible du @id Person ` +
          `de tout le JSON-LD éditorial.`,
      ).toBe(true);
    });
  }

  it("le profil `manon` reste ACTIF dans le seed — sinon la page 404", () => {
    // `/equipe/manon` est DB-dépendante (contrairement à `williams`, codé en
    // dur) : `page.tsx` fait `notFound()` si le profil est absent ou inactif.
    // Déclarer dans un sitemap une URL qui peut 404 est pire que ne pas la
    // déclarer. Cette assertion lie la déclaration à sa précondition.
    const seed = source("prisma/seeds/content-gen/author-profile.ts");
    expect(seed).toContain('slug: "manon"');
    expect(
      /isActive:\s*true/.test(seed),
      "le seed ne déclare plus le profil comme actif : `/fr/equipe/manon` " +
        "répondrait 404 alors que le sitemap la déclare.",
    ).toBe(true);
  });
});

describe("sub-sitemaps — pas de doublon à une URL (GEO-147)", () => {
  it("`guides` n'est plus un sub-sitemap", () => {
    const debut = SITEMAP.indexOf("generateSitemaps");
    const bloc = SITEMAP.slice(debut, debut + 3000);
    expect(
      bloc.includes('"guides"'),
      "le sub-sitemap `guides` est revenu. Il ne contenait QU'UNE URL — le hub " +
        "`/fr/guides` — déjà émise par pages.xml, avec un `lastmod` figé.",
    ).toBe(false);
  });

  it("le hub `/guides` reste déclarable par pages.xml", () => {
    // C'est la condition qui rend le retrait ci-dessus sans perte. Si la clé
    // disparaissait de `routing.pathnames`, ou entrait dans les exclusions, le
    // hub ne serait plus déclaré NULLE PART.
    expect(Object.keys(routing.pathnames)).toContain("/guides");
    const exclusions = SITEMAP.slice(
      SITEMAP.indexOf("EXCLUDED_FROM_INDEX"),
      SITEMAP.indexOf("]", SITEMAP.indexOf("EXCLUDED_FROM_INDEX")),
    );
    expect(exclusions).not.toContain('"/guides"');
  });
});
