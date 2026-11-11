/**
 * Header public — cliquet sur le BUDGET D'ESPACE de la nav desktop.
 *
 * ## Le défaut que ce fichier existe pour empêcher
 *
 * Mesuré en production le 2026-08-04 : le header débordait horizontalement de
 * 1280 px à ~1658 px — barre de défilement horizontale sur CHAQUE page, sur la
 * quasi-totalité des portables. Personne ne l'avait vu pendant un mois.
 *
 * La cause n'était pas un réglage maladroit. Le budget avait été calculé, à la
 * main, pour 6 onglets. Un 7ᵉ a été ajouté (le méga-menu « Ressources ») avec,
 * dans son propre commentaire, « à surveiller ». La surveillance reposait sur la
 * vigilance humaine : elle n'a pas eu lieu.
 *
 * ## Refonte du 2026-11-11 : 4 onglets, budget refait
 *
 * La maquette validée par Williams ramène la barre à **4 onglets** — Accueil ·
 * La Journée IA · Nos prestations ▾ · Tarifs — et montre « Nous écrire » dès que
 * la barre est là. La nav horizontale apparaît donc à 1280 px (au lieu de 1440),
 * et le seuil intermédiaire `--breakpoint-navcta` disparaît.
 *
 * ## Pourquoi un cliquet plutôt qu'un test de rendu
 *
 * jsdom ne mesure aucune largeur. Ce que l'on PEUT verrouiller, c'est l'entrée
 * du calcul : la liste d'onglets pour laquelle les seuils ont été mesurés. Si
 * quelqu'un en ajoute un, ce test rougit et exige de refaire la mesure. La mesure
 * VIVANTE est `tests/e2e/qualiopi/header-tient-dans-sa-boite.spec.ts`.
 *
 * Refaire la mesure : `next dev`, ouvrir `/fr` et `/fr/tarifs` dans Chromium, et
 * relever pour chaque bande la largeur de la rangée (de la gauche du logo à la
 * droite du bouton « Réserver un appel ») ; la reporter dans ROW_* ci-dessous.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/** Les onglets de la barre, dans l'ordre, pour lesquels les seuils ont été MESURÉS. */
const ONGLETS_MESURES = ["Accueil", "La Journée IA", "Nos prestations", "Tarifs"] as const;

/** Rembourrage horizontal de la rangée au-dessus de 992 px (`lg:px-10`, 2 × 40 px). */
const REMBOURRAGE = 80;

/**
 * Largeurs de rangée MESURÉES le 2026-11-11 (Chromium headless, `next dev`, `/fr`
 * et `/fr/tarifs`, on retient la pire), réserve non comprise :
 *   - bande `nav`    : sans tagline, écart de rangée 24 px ;
 *   - bande `navair` : tagline « Partenaire IA des PME et TPE » + écart 32 px.
 *
 * REMESURÉ le 2026-11-11 après le retour de la barre terracotta (le logo reprend
 * son badge ivoire, `px-3`, +24 px ; « Nous écrire » perd son contour, −2 px) :
 * 1105 → 1127 et 1173 → 1195. Réserve vivante : 73 px à 1280, 91 px à 1366.
 */
const ROW_NAV = 1127;
const ROW_NAVAIR = 1195;

/** Réserve exigée par la mesure vivante (`header-tient-dans-sa-boite.spec.ts`). */
const RESERVE = 16;

function sansCommentaires(chemin: string): string {
  // 🔴 Sans ce décapage, le test se trouverait LUI-MÊME : les fichiers
  // documentent longuement les anciens seuils dans leurs commentaires.
  return readFileSync(chemin, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const lireSeuil = (css: string, nom: string): number =>
  Number(new RegExp(`--breakpoint-${nom}:\\s*(\\d+)px`).exec(css)?.[1] ?? 0);

describe("budget d'espace du header", () => {
  it("🔴 la barre porte exactement les onglets mesurés, dans l'ordre", () => {
    const src = sansCommentaires("src/components/nav/Header.tsx");
    const nav = src.slice(src.indexOf("<nav"), src.indexOf("</nav>"));
    // Chaque onglet de la barre est soit un `NavLink` (sans `variant`), soit le
    // bouton du méga-menu. Leur ordre d'apparition dans la barre doit être celui-ci.
    const ordre = [...nav.matchAll(/<NavLink href=\{(\w+)\.href\}|<HeaderPrestationsMenu/g)].map(
      (m) => m[1] ?? "prestations",
    );
    expect(ordre).toEqual(["accueil", "journeeIa", "prestations", "tarifs"]);
    expect(ONGLETS_MESURES).toHaveLength(ordre.length);
  });

  it("les deux seuils mesurés existent, et `navcta` a disparu", () => {
    const css = sansCommentaires("src/app/globals.css");
    expect(css).toContain("--breakpoint-nav:");
    expect(css).toContain("--breakpoint-navair:");
    expect(css).not.toContain("--breakpoint-navcta:");
  });

  it("les seuils restent ordonnés et au-dessus des largeurs mesurées, rembourrage compris", () => {
    // 🔴 2026-08-21 — la comparaison d'origine oubliait le rembourrage : elle
    // validait la rangée contre une largeur qu'elle n'a jamais eue. Le terme est
    // ici, avec la réserve exigée par la mesure vivante.
    const css = sansCommentaires("src/app/globals.css");
    const nav = lireSeuil(css, "nav");
    const navair = lireSeuil(css, "navair");
    expect(nav).toBeGreaterThanOrEqual(ROW_NAV + REMBOURRAGE + RESERVE);
    expect(navair).toBeGreaterThanOrEqual(ROW_NAVAIR + REMBOURRAGE + RESERVE);
    expect(nav).toBeLessThan(navair);
  });

  it("🔴 la bascule nav/tiroir ne repasse pas sur `xl` ni `2xl`", () => {
    const src = sansCommentaires("src/components/nav/Header.tsx");
    for (const interdit of ["xl:flex", "xl:hidden", "xl:block", "2xl:gap", "navcta:"]) {
      expect(src).not.toContain(interdit);
    }
    expect(src).toContain("nav:flex");
    expect(src).toContain("nav:hidden");
    // L'aération (écart et tagline) dépend du seuil `navair`, jamais d'un `gap`
    // sans variante plus large que l'écart de base.
    expect(src).toContain("navair:gap-8");
    expect(src).toContain("navair:block");
    expect(src).not.toMatch(/(?:^|[^:])\bgap-(?:10|12|16)\b/);
  });
});

describe("bouton du menu ☰", () => {
  it("🔴 n'a aucune visibilité propre : le seuil `nav` du Header décide seul", () => {
    // Le 2026-10-16 : le bouton portait `xl:hidden` (1280) alors que la nav
    // horizontale attendait `nav` (1440). Entre 1280 et 1440, l'en-tête
    // n'affichait plus que le logo.
    const src = sansCommentaires("src/components/nav/MobileNav.tsx");
    expect(src).not.toMatch(/\b(?:sm|md|lg|xl|2xl|nav|navair|min-\[[^\]]+\]):hidden\b/);
  });
});
