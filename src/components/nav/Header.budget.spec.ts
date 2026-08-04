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
 * main, pour **6 onglets** (commentaire du 2026-06-08). Un 7ᵉ a été ajouté le
 * 2026-07-03 — le méga-menu « Ressources » — avec, dans son propre commentaire,
 * la mention « à surveiller sur la bande 1280–1400 ». La surveillance reposait
 * sur la vigilance humaine : elle n'a pas eu lieu.
 *
 * ## Pourquoi un cliquet plutôt qu'un test de rendu
 *
 * La largeur réelle d'un onglet dépend de la police, du crénage et du navigateur
 * — jsdom ne mesure rien de tout ça, et un test qui prétendrait le faire
 * mentirait. Ce que l'on PEUT verrouiller, c'est l'entrée du calcul : le nombre
 * d'onglets pour lequel les seuils ont été mesurés. Si quelqu'un en ajoute un,
 * ce test rougit et exige de refaire la mesure — ce qui est exactement le geste
 * qui a manqué en juillet.
 *
 * Refaire la mesure : ouvrir une page en production, réduire la rangée du
 * header par dichotomie jusqu'à ce que `scrollWidth` dépasse, pour chacune des
 * trois configurations (gap-8 sans « Nous écrire », gap-8 avec, gap-12 avec),
 * puis reporter les seuils + ~25 px de marge dans `globals.css`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

import { SERVICES } from "@/content/services";

/**
 * Nombre d'onglets pour lequel les seuils de `globals.css` ont été MESURÉS.
 *
 * = SERVICES + « Tarifs » + méga-menu « Ressources ».
 * Le faire monter sans refaire la mesure remet le header en débordement.
 */
const ONGLETS_MESURES = 7;

const ongletsActuels = SERVICES.length + 2;

/** Le fichier de tokens, décapé de ses commentaires. */
function globalsSansCommentaires(): string {
  // 🔴 Sans ce décapage, le test se trouverait LUI-MÊME : `globals.css`
  // documente longuement les anciens seuils (`xl`, `2xl`, 1400) dans les
  // commentaires qui expliquent pourquoi ils ont changé. Chercher « 2xl » dans
  // le fichier brut passerait au vert sur une régression, ou au rouge sans.
  return readFileSync("src/app/globals.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
}

function headerSansCommentaires(): string {
  return readFileSync("src/components/nav/Header.tsx", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("budget d'espace du header", () => {
  it("🔴 le nombre d'onglets n'a pas bougé depuis la mesure", () => {
    expect(ongletsActuels).toBe(ONGLETS_MESURES);
  });

  it("les trois seuils mesurés existent dans les tokens", () => {
    const css = globalsSansCommentaires();
    expect(css).toContain("--breakpoint-nav:");
    expect(css).toContain("--breakpoint-navcta:");
    expect(css).toContain("--breakpoint-navair:");
  });

  it("les seuils restent ordonnés et au-dessus des largeurs mesurées", () => {
    const css = globalsSansCommentaires();
    const lire = (nom: string): number =>
      Number(new RegExp(`--breakpoint-${nom}:\\s*(\\d+)px`).exec(css)?.[1] ?? 0);
    const nav = lire("nav");
    const navcta = lire("navcta");
    const navair = lire("navair");

    // Largeurs de rangée mesurées + 17 px de barre de défilement verticale.
    // Valeurs relevées sur DEUX pages (accueil et /tarifs) ; on garde la pire
    // des deux — l'onglet actif est en gras, ce qui élargit la rangée de ~8 px
    // selon la page consultée.
    expect(nav).toBeGreaterThanOrEqual(1397 + 17);
    expect(navcta).toBeGreaterThanOrEqual(1547 + 17);
    expect(navair).toBeGreaterThanOrEqual(1651 + 17);
    // Un seuil qui doublerait l'autre ferait apparaître les deux états en même
    // temps — donc le débordement qu'on vient de retirer.
    expect(nav).toBeLessThan(navcta);
    expect(navcta).toBeLessThan(navair);
  });

  it("🔴 la bascule nav/drawer ne repasse pas sur `xl` ni `2xl`", () => {
    // Le défaut d'origine, mot pour mot : la nav se montrait à `xl` (1280) et
    // s'aérait à `2xl` (1536), deux seuils sous ce qu'elle réclame.
    const src = headerSansCommentaires();
    for (const interdit of ["xl:flex", "xl:hidden", "xl:block", "2xl:gap-12", "2xl:ml-6"]) {
      expect(src).not.toContain(interdit);
    }
    expect(src).toContain("nav:flex");
    expect(src).toContain("nav:hidden");
    expect(src).toContain("navcta:inline-flex");
    expect(src).toContain("navair:gap-12");
  });
});
