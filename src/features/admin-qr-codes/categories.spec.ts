// Garde structurelle des sous-onglets QR.
//
// Ce que ce test empêche de revenir, constaté le 2026-08-17 : la catégorie
// `general` déclarait `route: "general"` alors qu'AUCUNE page
// `qr-codes/general/` n'existait, et qu'aucune entrée de menu n'y menait. Ses QR
// — dont les DEUX de la carte de visite, `vc` et `wa` — n'apparaissaient que
// dans la liste racine, noyés parmi 45 QR de catalogue. Le défaut était
// invisible : il fallait comparer trois fichiers pour s'en apercevoir, et rien
// ne rougissait.
//
// Le test lit le DISQUE plutôt que de relire la liste : une déclaration qui se
// vérifie elle-même ne vérifie rien. Une catégorie ajoutée sans sa page fait
// désormais échouer la CI, avant qu'un QR ne devienne introuvable en console.

import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";

import { buildAdminNav } from "@/lib/admin-nav";

import { QR_CATEGORIES } from "./categories";

/** Dossier des sous-pages QR de la console. */
const QR_PAGES = path.join(
  process.cwd(),
  "src",
  "app",
  "[locale]",
  "(admin)",
  "[adminPrefix]",
  "qr-codes",
);

const PREFIXE = "admin-test";

describe("catégories QR — chaque onglet déclaré est réellement atteignable", () => {
  it("chaque `route` déclarée a sa page sur le disque", () => {
    const orphelines = QR_CATEGORIES.filter(
      (cat) => !existsSync(path.join(QR_PAGES, cat.route, "page.tsx")),
    ).map((cat) => `« ${cat.label} » → qr-codes/${cat.route}/page.tsx introuvable`);

    expect(
      orphelines,
      "Une catégorie qui déclare une route sans page produit un 404 depuis la " +
        "barre latérale, et ses QR deviennent invisibles hors de la liste racine",
    ).toEqual([]);
  });

  it("contre-épreuve : le test lit bien le disque", () => {
    // Sans elle, un chemin `QR_PAGES` erroné ferait échouer le test ci-dessus
    // pour de mauvaises raisons — ou, si `existsSync` renvoyait toujours vrai,
    // le laisserait vert en permanence. On vérifie les deux sens.
    expect(existsSync(path.join(QR_PAGES, "page.tsx"))).toBe(true);
    expect(existsSync(path.join(QR_PAGES, "categorie-qui-nexiste-pas", "page.tsx"))).toBe(false);
  });

  it("chaque catégorie a son entrée de menu, dérivée et non recopiée", () => {
    const nav = buildAdminNav(PREFIXE);

    const manquantes = QR_CATEGORIES.filter(
      (cat) =>
        !nav.some(
          (item) =>
            item.href === `/fr/${PREFIXE}/qr-codes/${cat.route}` &&
            item.label === cat.label &&
            item.navLevel === 2,
        ),
    ).map((cat) => `« ${cat.label} » (${cat.route})`);

    expect(
      manquantes,
      "Les entrées de niveau 2 doivent dériver de QR_CATEGORIES — une liste " +
        "recopiée à la main finit par diverger de sa source, c'est ce qui est arrivé",
    ).toEqual([]);
  });

  it("aucune entrée de menu QR ne survit à la suppression de sa catégorie", () => {
    // L'inverse du test précédent : la nav ne doit porter AUCUN sous-onglet QR
    // qui ne corresponde plus à une catégorie. Un onglet fantôme mènerait à un
    // 404, symétrique du défaut d'origine.
    const routes = new Set(QR_CATEGORIES.map((c) => c.route));
    const fantomes = buildAdminNav(PREFIXE)
      .filter((item) => item.navLevel === 2 && item.href.includes("/qr-codes/"))
      .map((item) => item.href.split("/qr-codes/")[1])
      .filter((route) => !routes.has(route as (typeof QR_CATEGORIES)[number]["route"]));

    expect(fantomes).toEqual([]);
  });
});

describe("catégories QR — les libellés restent distinguables", () => {
  it("n'a aucun doublon de libellé", () => {
    const labels = QR_CATEGORIES.map((c) => c.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("ne distingue pas deux onglets par une seule préposition", () => {
    // Jusqu'au 2026-08-17, « QR **du** catalogue » (celui qui MÈNE au catalogue)
    // et « QR **dans** le catalogue » (les 38 qu'on y IMPRIME) désignaient des
    // choses opposées à une préposition d'écart. Il fallait lire les
    // descriptions du code pour les distinguer — donc à chaque consultation.
    const normalise = (s: string) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .split(/\s+/)
        .filter((mot) => !["du", "de", "des", "dans", "le", "la", "les", "l", "&"].includes(mot))
        .join(" ");

    const parSquelette = new Map<string, string[]>();
    for (const cat of QR_CATEGORIES) {
      const cle = normalise(cat.label);
      parSquelette.set(cle, [...(parSquelette.get(cle) ?? []), cat.label]);
    }

    const ambigus = [...parSquelette.values()].filter((labels) => labels.length > 1);

    expect(
      ambigus,
      "Deux libellés qui ne diffèrent que par un mot outil sont indistinguables en lecture rapide",
    ).toEqual([]);
  });
});
