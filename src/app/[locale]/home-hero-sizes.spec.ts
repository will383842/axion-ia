/**
 * GEO-125 (audit GEO/AEO end-to-end du 2026-08-15) — le hero de la home que le
 * mobile télécharge sans jamais l'afficher.
 *
 * ## Le défaut que ce fichier existe pour empêcher
 *
 * Le hero photo de l'accueil est enveloppé dans `hidden lg:block` : sous
 * 1024 px, il n'est jamais peint. Mais `priority` émet un
 * `<link rel="preload" as="image">` qui n'est PAS conditionné au media, et le
 * `sizes` par défaut d'`Illustration` (« (max-width: 1024px) 100vw, 600px »)
 * déclare une largeur mobile plein écran. Résultat mesuré en production le
 * 2026-08-14 (Pixel 7, 412 px, DPR 2,625) : 62 Ko chargés à t = 146 ms, en
 * plein dans la fenêtre du LCP, pour un élément de largeur nulle.
 *
 * Deux décisions prises à deux endroits — le CSS qui masque, le `sizes` qui
 * déclare — et qui ne se parlaient pas. Ce fichier les rattache l'une à l'autre.
 *
 * ## Pourquoi le `sizes="600px"` prescrit par le plan est REFUSÉ
 *
 * La sélection d'un candidat `srcset` multiplie la largeur déclarée par le
 * rapport de pixels de l'appareil. Le test `sélection de candidat` ci-dessous
 * le démontre sur les chiffres MESURÉS en production : `600px` ferait passer le
 * mobile de 1200w à 1920w — l'inverse du but recherché. On déclare donc la
 * largeur RÉELLE sous 1024 px : nulle.
 *
 * ## Do-not-touch
 *
 * `Illustration.tsx` n'est PAS corrigé à la source : son `sizes` par défaut est
 * partagé par tout le site et convient partout où l'illustration est réellement
 * visible en mobile. La surcharge est LOCALE à la home (H3/H4 de l'audit).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/** Seuil `lg:` de Tailwind — le CSS qui masque et le `sizes` doivent l'accorder. */
const SEUIL_LG_PX = 1024;

/** `deviceSizes` ∪ `imageSizes` de Next 16 (aucun des deux n'est surchargé dans `next.config.ts`). */
const CANDIDATS = [16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840];

function pageHome(): string {
  return readFileSync("src/app/[locale]/page.tsx", "utf8");
}

/**
 * Le bloc JSX du hero HOME-01, DÉCAPÉ de ses commentaires.
 *
 * 🔴 Sans ce décapage, le test se trouverait LUI-MÊME : le commentaire posé
 * au-dessus du `sizes` cite le `sizes="600px"` refusé et le
 * « (max-width: 1024px) 100vw, 600px » d'origine. Chercher ces chaînes dans le
 * fichier brut passerait au vert sur une régression — c'est exactement ce qui
 * s'est produit à la première exécution de ce fichier.
 */
function blocHero(): string {
  const src = pageHome();
  const debut = src.indexOf('slot="HOME-01-hero"');
  expect(debut, "le slot HOME-01-hero a disparu de la home").toBeGreaterThan(-1);
  const fin = src.indexOf("/>", debut);
  return src
    .slice(debut, fin)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/**
 * Reproduit la sélection d'un candidat `srcset` par le navigateur : la valeur
 * `sizes` est résolue pour la fenêtre, multipliée par le rapport de pixels,
 * puis on retient le plus petit candidat qui la couvre.
 *
 * Volontairement naïf sur `sizes` (une suite de « (media) largeur », dernière
 * entrée = repli) — c'est exactement la forme utilisée ici.
 */
function candidatRetenu(sizes: string, viewportPx: number, dpr: number): number {
  let largeurCss: number | null = null;
  for (const entree of sizes.split(",").map((s) => s.trim())) {
    const avecMedia = /^\((min|max)-width:\s*(\d+)px\)\s+(\d+)(px|vw)$/.exec(entree);
    if (avecMedia) {
      const [, sens, seuil, valeur, unite] = avecMedia as unknown as string[];
      const seuilPx = Number(seuil);
      const correspond = sens === "min" ? viewportPx >= seuilPx : viewportPx <= seuilPx;
      if (!correspond) continue;
      largeurCss = unite === "vw" ? (Number(valeur) / 100) * viewportPx : Number(valeur);
      break;
    }
    const repli = /^(\d+)(px|vw)$/.exec(entree);
    if (repli) {
      largeurCss = repli[2] === "vw" ? (Number(repli[1]) / 100) * viewportPx : Number(repli[1]);
      break;
    }
  }
  expect(largeurCss, `sizes non résolu : « ${sizes} »`).not.toBeNull();
  const requis = (largeurCss as number) * dpr;
  return CANDIDATS.find((c) => c >= requis) ?? CANDIDATS[CANDIDATS.length - 1]!;
}

describe("sélection de candidat srcset (modèle validé sur la mesure de prod)", () => {
  // Mesure du 2026-08-14 : Pixel 7, fenêtre 412 px, DPR 2,625, candidat servi
  // `…home-hero-equipe.avif&w=1200`, 62 Ko. Si ce cas ne retombe pas sur 1200,
  // le modèle ci-dessus est faux et les deux assertions suivantes ne valent rien.
  const MOBILE = { vw: 412, dpr: 2.625 };

  it("🔴 reproduit le défaut mesuré en production : 1200w sur mobile", () => {
    expect(candidatRetenu("(max-width: 1024px) 100vw, 600px", MOBILE.vw, MOBILE.dpr)).toBe(1200);
  });

  it('🔴 le `sizes="600px"` prescrit par le plan AGGRAVERAIT le défaut', () => {
    // 600 × 2,625 = 1 575 → 1920w, soit plus lourd que les 1200w constatés.
    // C'est la raison documentée pour laquelle la home s'en écarte.
    expect(candidatRetenu("600px", MOBILE.vw, MOBILE.dpr)).toBe(1920);
  });

  it("la surcharge retenue fait retomber le mobile sur le plus petit candidat", () => {
    expect(candidatRetenu("(min-width: 1024px) 600px, 1px", MOBILE.vw, MOBILE.dpr)).toBe(16);
  });

  it("le candidat desktop est INCHANGÉ (aucun risque sur le LCP desktop)", () => {
    const desktop = { vw: 1440, dpr: 1 };
    const avant = candidatRetenu("(max-width: 1024px) 100vw, 600px", desktop.vw, desktop.dpr);
    const apres = candidatRetenu("(min-width: 1024px) 600px, 1px", desktop.vw, desktop.dpr);
    expect(apres).toBe(avant);
  });
});

describe("hero de la home — accord entre le CSS qui masque et le `sizes`", () => {
  it("🔴 le hero est toujours masqué sous `lg` (sinon le `sizes` ment)", () => {
    const src = pageHome();
    const avantHero = src.slice(0, src.indexOf('slot="HOME-01-hero"'));
    expect(
      avantHero.lastIndexOf('className="hidden lg:block"'),
      "le hero n'est plus masqué en mobile : la surcharge `sizes` doit être retirée",
    ).toBeGreaterThan(-1);
  });

  it("le hero surcharge `sizes` au lieu de subir le défaut d'`Illustration`", () => {
    expect(blocHero()).toContain("sizes=");
  });

  it("🔴 la surcharge ne déclare aucune largeur mobile plein écran", () => {
    // Le défaut exact que l'audit a mesuré. `100vw` sur un élément de largeur
    // nulle, c'est 62 Ko de préchargement pur.
    const sizes = /sizes="([^"]+)"/.exec(blocHero())?.[1];
    expect(sizes, "le hero ne déclare plus de `sizes`").toBeTruthy();
    expect(sizes).not.toContain("100vw");
  });

  it("la branche desktop du `sizes` est calée sur le seuil `lg`", () => {
    const sizes = /sizes="([^"]+)"/.exec(blocHero())?.[1] ?? "";
    expect(sizes).toContain(`(min-width: ${SEUIL_LG_PX}px)`);
  });
});

describe("do-not-touch — `Illustration` n'est pas corrigé à la source", () => {
  it("le `sizes` par défaut du ratio 3:2 est inchangé", () => {
    // H3/H4 : ce défaut est partagé par tout le site et convient partout où
    // l'illustration est réellement visible en mobile. Le corriger ici
    // dégraderait la qualité d'image sur toutes les autres pages.
    const src = readFileSync("src/components/visual/Illustration.tsx", "utf8");
    expect(src).toContain('"3:2": "(max-width: 1024px) 100vw, 600px"');
  });
});
