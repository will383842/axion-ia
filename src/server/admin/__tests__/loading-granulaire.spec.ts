/**
 * Lot 4 — toute surface admin MESURÉE porte son propre squelette d'attente.
 *
 * ## Ce que cette garde relie, et pourquoi c'est elle qui manquait
 *
 * Le Lot 0 a mesuré : à 1 200 sessions, les lectures serveur tiennent en
 * **7 à 17 ms**, soit 2 à 4 % du budget de la page. Le goulot n'est donc PAS
 * la requête — c'est l'attente sans forme. La conclusion du plan est explicite :
 * « le serveur est déjà < 2 s → D1 requalifié en problème de feedback client ».
 *
 * Une surface qu'on juge assez importante pour lui poser une SONDE et un budget
 * est, par construction, une surface où l'attente se voit. Lui laisser le
 * squelette générique du niveau `[adminPrefix]` — trois cartes, quelle que soit
 * la destination — c'est annoncer une forme qui n'est pas celle qui arrive :
 * la mise en page saute (CLS, budget du dépôt : 0) et rien ne dit où l'on vient
 * d'atterrir.
 *
 * 🔴 Cette garde tient les deux lots ensemble. Ajouter une sonde au Lot 0 sans
 * son squelette de Lot 4 rougit ici — et c'est bien le sens de la mesure :
 * ce qu'on mesure, on l'habille.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SONDES } from "../sondes-volumetriques";

const RACINE_ADMIN = "src/app/[locale]/(admin)";

/**
 * `/[adminPrefix]/qualiopi/sessions` → le dossier de route correspondant.
 *
 * Les sondes déclarent la page telle qu'un humain la lit (avec ses paramètres
 * de requête). On ne garde que le CHEMIN.
 */
function dossierDeRoute(page: string): string {
  const sansQuery = page.split("?")[0]!;
  return resolve(process.cwd(), RACINE_ADMIN + sansQuery);
}

describe("🔴 ce qu'on mesure, on l'habille", () => {
  it.each(SONDES.map((s) => [s.cle, s.page] as const))(
    "%s (%s) a son propre loading.tsx",
    (_cle, page) => {
      const dossier = dossierDeRoute(page);
      expect(
        existsSync(resolve(dossier, "loading.tsx")),
        `La route « ${page} » porte une sonde volumétrique et un budget, mais ` +
          `aucun squelette d'attente à sa forme : elle hérite des trois cartes ` +
          `génériques de [adminPrefix]. Le Lot 0 a montré que la requête tient en ` +
          `7-17 ms — ce qui reste à soigner est justement l'attente.`,
      ).toBe(true);
    },
  );

  it("la route mesurée existe vraiment", () => {
    // 🔴 Sans ceci, une sonde qui pointerait une route disparue verrait son
    // `existsSync(loading.tsx)` échouer pour la MAUVAISE raison, et le message
    // d'erreur enverrait chercher un squelette au lieu d'une route.
    for (const sonde of SONDES) {
      expect(
        existsSync(resolve(dossierDeRoute(sonde.page), "page.tsx")),
        `La sonde « ${sonde.cle} » mesure « ${sonde.page} », qui n'a pas de page.tsx.`,
      ).toBe(true);
    }
  });
});

describe("🔴 le squelette générique reste, et reste le dernier recours", () => {
  it("[adminPrefix]/loading.tsx existe toujours", () => {
    // Le retirer laisserait toute route non habillée sans AUCUNE frontière
    // d'attente : la navigation resterait figée sur la page précédente, sans
    // rien dire. Le générique n'est pas le défaut à corriger — c'est le filet.
    expect(existsSync(resolve(process.cwd(), RACINE_ADMIN, "[adminPrefix]/loading.tsx"))).toBe(
      true,
    );
  });
});
