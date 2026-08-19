/**
 * Verrou GEO-138 / GEO-057 — héritage de `alternates` et double suffixe de marque.
 *
 * POURQUOI CE FICHIER EXISTE. Next Metadata fait hériter à chaque page tout
 * champ top-level que la page ne redéfinit pas. Un `alternates.canonical` posé
 * au LAYOUT fuitait donc vers toutes les pages sans bloc propre :
 * `/fr/diagnostic`, `/fr/simulateur` et `/fr/components` annonçaient « je suis
 * un duplicata de la home » (vérifié en production le 2026-08-14). La home,
 * elle, n'a jamais eu besoin de ce bloc — elle pose son canonical via
 * `buildProductMetadata`.
 *
 * CE QUE CETTE GARDE INTERDIT, dans les deux sens :
 *   1. re-poser un `alternates` au layout (la fuite revient) ;
 *   2. laisser sans canonical explicite les deux pages qui recevaient la fuite
 *      ET qui reçoivent du trafic PAYANT — sans bloc propre elles n'annoncent
 *      plus rien du tout.
 *
 * ⚠️ RÈGLE DE RÉDACTION : on s'ancre sur du code, jamais sur une chaîne nue qui
 * pourrait tomber dans un commentaire — les commentaires de `layout.tsx`
 * expliquent précisément pourquoi `alternates` n'y est plus, et citent le mot en
 * toutes lettres. Les commentaires sont donc retirés avant toute recherche.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildProductMetadata } from "@/lib/seo";

// Vitest s'exécute depuis la racine du dépôt.
function source(relatif: string): string {
  return readFileSync(path.join(process.cwd(), relatif), "utf8");
}

/** Retire commentaires de bloc et de ligne : ils citent `alternates`. */
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const LAYOUT = sansCommentaires(source("src/app/[locale]/layout.tsx"));
const DIAGNOSTIC = sansCommentaires(source("src/app/[locale]/diagnostic/page.tsx"));
const SIMULATEUR = sansCommentaires(source("src/app/[locale]/simulateur/page.tsx"));
const COMPONENTS = sansCommentaires(source("src/app/[locale]/components/page.tsx"));

describe("layout [locale] — l'héritage de canonical est coupé (GEO-138)", () => {
  it("garde anti-test-vide : les quatre sources sont bien lues", () => {
    // Un chemin qui change et une lecture qui rend « » rendraient tous les
    // tests suivants verts sans rien vérifier.
    for (const [nom, src] of Object.entries({ LAYOUT, DIAGNOSTIC, SIMULATEUR, COMPONENTS })) {
      expect(src.length, `${nom} lu vide — le chemin du fichier a changé`).toBeGreaterThan(500);
    }
    expect(LAYOUT).toContain("generateMetadata");
  });

  it("le layout ne déclare AUCUN `alternates` — sinon il fuite vers chaque page sans bloc propre", () => {
    expect(
      /\balternates\s*:/.test(LAYOUT),
      "`alternates` est réapparu dans le generateMetadata du layout. Next le fait " +
        "hériter à toute page qui n'en déclare pas : /fr/diagnostic, /fr/simulateur et " +
        "/fr/components se remettraient à annoncer le canonical de la home. Le hreflang " +
        "se porte page par page, via buildProductMetadata (gaté par isEnLocaleDisabled).",
    ).toBe(false);
  });

  for (const [nom, src, chemin] of [
    ["/fr/diagnostic", DIAGNOSTIC, "/fr/diagnostic"],
    ["/fr/simulateur", SIMULATEUR, "/fr/simulateur"],
  ] as const) {
    it(`${nom} pose un canonical auto-référent EXPLICITE (page à trafic payant)`, () => {
      expect(
        /alternates\s*:\s*\{[\s\S]*?canonical\s*:/.test(src),
        `${nom} n'a plus de bloc alternates. Depuis que le layout n'en pose plus, ` +
          `cette page n'annoncerait AUCUN canonical — or c'est une page qui reçoit du ` +
          `trafic payant.`,
      ).toBe(true);
      expect(src, `${nom} doit rester canonique sur sa propre URL FR`).toContain(chemin);
    });
  }

  it("/fr/components porte son propre noindex — il n'hérite plus de rien", () => {
    // Cette page n'exportait AUCUNE metadata : elle héritait `index: true` du
    // layout racine et le titre de la home. Seul le Disallow de robots.txt la
    // protégeait, ce qui n'empêche pas l'indexation d'une URL découverte par lien.
    expect(/export\s+const\s+metadata/.test(COMPONENTS)).toBe(true);
    expect(/index\s*:\s*false/.test(COMPONENTS)).toBe(true);
  });
});

describe("buildProductMetadata — la marque n'est jamais écrite deux fois (GEO-057)", () => {
  // Le root layout déclare `title.template = "%s · Axion-IA"`. Next l'applique à
  // toute `title` rendue sous forme de string : un titre qui porte déjà la
  // marque doit donc sortir en `{ absolute }` pour court-circuiter le template.
  const casQuiPortentLaMarque = [
    // Les trois familles vivantes mesurées en SERP le 2026-08-14.
    "Combien coûte une formation IA ? · FAQ Axion-IA",
    "Notion IA : ce que le cabinet Axion-IA en fait · stack IA",
    "Blog · Axion-IA · page 2",
    // Le cas historique (suffixe exact) doit rester couvert : le nouveau test
    // est un SUR-ENSEMBLE strict de l'ancien.
    "Audit IA pour PME · Axion-IA",
  ];

  for (const titre of casQuiPortentLaMarque) {
    it(`« ${titre} » sort en { absolute } — le template ne peut pas re-suffixer`, async () => {
      const meta = await buildProductMetadata({
        locale: "fr",
        path: "/audit",
        title: titre,
        description: "Description de test.",
      });
      expect(
        meta.title,
        "titre rendu en string nue : le template du layout racine y ajouterait un " +
          "second « · Axion-IA ».",
      ).toEqual({ absolute: titre });
    });
  }

  it("un titre SANS la marque reste une string nue — c'est le template qui l'appose", async () => {
    const meta = await buildProductMetadata({
      locale: "fr",
      path: "/audit",
      title: "Audit IA pour PME industrielles en Isère",
      description: "Description de test.",
    });
    expect(typeof meta.title).toBe("string");
  });
});
