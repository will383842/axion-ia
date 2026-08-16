/**
 * Verrou GEO-035 / GEO-036 — le crawl ne doit ni faire travailler l'origine,
 * ni écrire en base (audit GEO/AEO end-to-end du 2026-08-14, lot 9).
 *
 * ## Le défaut
 *
 * Chaque page galerie expose DEUX ancres vers sa route de téléchargement. Sur
 * ~288 pages, cela fait ~576 URLs crawlables dont chaque visite déclenche une
 * transformation Sharp et deux écritures en base. Mesuré en production le
 * 2026-08-16 : les deux ancres sont présentes, sans `rel="nofollow"`, et
 * `robots.txt` ne contenait aucune règle sur le segment de téléchargement.
 *
 * Conséquence chaînée (GEO-036) : l'incrément du compteur passait par
 * `prisma.imageAsset.update()`, qui déclenche le `@updatedAt` du modèle — et
 * `sitemaps/images-fr.xml` lit `updatedAt` pour son `<lastmod>`. Le passage d'un
 * robot réécrivait donc la date de dernière modification de l'image : 7 lignes
 * bumpées en 8 h 20 de nuit sans la moindre publication.
 *
 * ## Trois barrières, volontairement
 *
 * `rel="nofollow"` (le lien), `Disallow` (le crawl), `X-Robots-Tag` (la
 * réponse). Une seule suffirait à un robot respectueux ; les trois couvrent les
 * autres. La garde vérifie les trois : en retirer une sans le dire rouvre le
 * chemin.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function source(relatif: string): string {
  return readFileSync(path.join(process.cwd(), relatif), "utf8");
}

function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const PAGE = sansCommentaires(source("src/app/[locale]/galerie/[slug]/page.tsx"));
const ROUTE = sansCommentaires(source("src/app/[locale]/galerie/[slug]/telecharger/route.ts"));
// 🔴 Source BRUTE, sans dépouillement des commentaires : les règles cherchées
// sont des littéraux qui contiennent la séquence ouvrante d'un commentaire de
// bloc (`"/*/telecharger"`). Le dépouilleur les prenait pour un commentaire et
// avalait tout jusqu'au premier `*` suivi d'un `/`, faisant échouer la garde sur
// du code parfaitement correct. On cherche ici des chaînes entre guillemets :
// aucun commentaire ne peut les produire par accident.
const ROBOTS = source("src/app/robots.ts");

describe("galerie — les liens de téléchargement ne se suivent pas (GEO-035)", () => {
  it("garde anti-test-vide : les trois sources sont lues", () => {
    for (const [nom, src] of Object.entries({ PAGE, ROUTE, ROBOTS })) {
      expect(src.length, `${nom} lu vide`).toBeGreaterThan(500);
    }
  });

  it("barrière 1 — les deux ancres portent `rel=\"nofollow\"`", () => {
    // On compte les ancres qui déclarent l'attribut `download` : ce sont
    // exactement les deux boutons de téléchargement.
    const ancres = PAGE.match(/<a\b[\s\S]*?>/g) ?? [];
    const telechargements = ancres.filter((a) => /\bdownload\b/.test(a));
    expect(
      telechargements.length,
      "les ancres de téléchargement sont introuvables — le sélecteur de cette " +
        "garde est périmé, elle ne vérifie plus rien.",
    ).toBe(2);
    for (const a of telechargements) {
      expect(
        /rel="nofollow"/.test(a),
        "une ancre de téléchargement a perdu son `rel=\"nofollow\"` : les moteurs " +
          "se remettent à suivre ~576 URLs qui font travailler l'origine.",
      ).toBe(true);
    }
  });

  it("barrière 2 — robots.txt refuse le segment, dans les DEUX locales", () => {
    // Le segment est traduit (`telecharger` FR / `download` EN) et robots.txt
    // ne connaît pas la table de routage : oublier une locale laisse la moitié
    // du chemin ouvert.
    expect(ROBOTS).toContain('"/*/telecharger"');
    expect(ROBOTS).toContain('"/*/download"');
  });

  it("barrière 3 — la réponse porte `X-Robots-Tag: noindex, nofollow`", () => {
    expect(ROUTE).toContain("X-Robots-Tag");
    expect(ROUTE).toMatch(/noindex,\s*nofollow/);
  });
});

describe("galerie — le compteur ne touche plus la ligne éditoriale (GEO-036)", () => {
  it("🔴 l'incrément passe par un UPDATE brut, pas par le client Prisma", () => {
    expect(
      /\$executeRaw`UPDATE image_assets SET download_count/.test(ROUTE),
      "l'incrément est repassé par `prisma.imageAsset.update()` : le `@updatedAt` " +
        "du modèle se redéclenche, et `sitemaps/images-fr.xml` republie un " +
        "`<lastmod>` frais à chaque passage de robot.",
    ).toBe(true);
    expect(
      /imageAsset\s*\.?\s*\n?\s*\.update\(/.test(ROUTE),
      "`prisma.imageAsset.update()` est de retour dans la route de téléchargement.",
    ).toBe(false);
  });

  it("le compteur reste alimenté — il est affiché dans la console", () => {
    // Le supprimer aurait été la fausse simplification : `downloadCount` est
    // rendu par `image-bank/_v2/OverviewV2.tsx`.
    expect(ROUTE).toContain("download_count = download_count + 1");
    const console_ = source("src/app/[locale]/(admin)/[adminPrefix]/image-bank/_v2/OverviewV2.tsx");
    expect(console_).toContain("downloadCount");
  });

  it("le journal de téléchargement reste écrit — c'est la source du comptage", () => {
    expect(ROUTE).toContain("imageDownloadLog");
  });

  it("⚠️ le plan d'audit citait un early-exit `stub.invalid` qui N'EXISTE PAS", () => {
    // Le « do-not-touch » du lot 9 protégeait « l'early-exit `stub.invalid` de
    // la route (l.84) ». Vérification faite : cette route n'en contient AUCUNE
    // occurrence. Rien à préserver, donc — mais l'écart est consigné plutôt
    // qu'effacé : un plan qui protège du code inexistant fait perdre du temps à
    // la revue suivante, et fait douter des do-not-touch qui, eux, sont réels.
    expect(ROUTE).not.toContain("stub.invalid");
  });
});
