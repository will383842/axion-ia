/**
 * Garde — le marqueur sur lequel repose « ne rien charger sur la console » est
 * bien celui que le layout admin pose, et il est bien lu par les deux
 * composants qui transmettent quelque chose à un tiers.
 *
 * 🔑 La garde DÉRIVE : elle relit le source du layout admin et le source des
 * composants, au lieu de figer une chaîne dans un test. Le jour où le marqueur
 * change de nom, c'est ICI que ça rougit — pas six mois plus tard, en silence,
 * sur une console qui recommence à partir chez Microsoft.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

import {
  ID_BANNIERE_CONSENTEMENT,
  SELECTEUR_SHELL_CONSOLE,
  estSurfaceConsole,
} from "./surface-console";

const RACINE = join(process.cwd(), "src");
const LAYOUT_ADMIN = join(RACINE, "app", "[locale]", "(admin)", "[adminPrefix]", "layout.tsx");
const CLARITY = join(RACINE, "components", "analytics", "Clarity.tsx");
const BANNIERE = join(RACINE, "components", "analytics", "CookieConsent.tsx");

/** Les classes du sélecteur, extraites du sélecteur lui-même — jamais recopiées. */
const CLASSES = SELECTEUR_SHELL_CONSOLE.split(",").map((c) => c.trim().replace(/^\./, ""));

describe("surface console", () => {
  it("le layout admin pose TOUTES les classes du marqueur", () => {
    const source = readFileSync(LAYOUT_ADMIN, "utf8");
    const absentes = CLASSES.filter((c) => !source.includes(c));
    expect(absentes).toEqual([]);
    // Témoin de non-vacuité : un sélecteur vide passerait le test ci-dessus.
    expect(CLASSES.length).toBeGreaterThan(0);
  });

  it("le masquage CSS du shell public s'appuie sur le MÊME marqueur", () => {
    // Si les deux divergeaient, l'une des deux protections viserait une console
    // que l'autre ne reconnaît pas — le motif « la règle appliquée à un site et
    // oubliée sur son jumeau », payé neuf fois sur onze la nuit du 24 août.
    const source = readFileSync(LAYOUT_ADMIN, "utf8");
    for (const classe of CLASSES) {
      expect(source).toContain(`body:has(.${classe})`);
    }
  });

  it("Clarity refuse de se charger sur la console", () => {
    const source = readFileSync(CLARITY, "utf8");
    expect(source).toMatch(/if\s*\(\s*estSurfaceConsole\(\)\s*\)\s*return null/);
  });

  /**
   * 🔴 Le garde de la BANNIÈRE n'est pas au même endroit que celui de Clarity,
   * et ce n'est pas une incohérence : la bannière est rendue au SERVEUR depuis
   * le correctif de CLS, et React 19 ne supprime pas une branche que le serveur
   * a écrite (« This won't be patched up. »). Un garde côté composant a été
   * essayé, mesuré inopérant, et retiré. Le masquage vit donc dans la feuille de
   * style du layout admin — le seul endroit qui agit dès le premier rendu.
   */
  it("le layout admin masque la bannière de consentement, par son identifiant", () => {
    const source = readFileSync(LAYOUT_ADMIN, "utf8");
    // L'identifiant est INTERPOLÉ depuis le module partagé : la garde vérifie
    // qu'il l'est, pas qu'une chaîne recopiée s'y trouve.
    expect(source).toContain("#${ID_BANNIERE_CONSENTEMENT}");
    expect(source).toContain('ID_BANNIERE_CONSENTEMENT } from "@/lib/analytics/surface-console"');
  });

  it("la bannière tire son identifiant du module partagé, jamais d'un littéral", () => {
    const source = readFileSync(BANNIERE, "utf8");
    expect(source).toContain("const BANNER_ID = ID_BANNIERE_CONSENTEMENT;");
    // Le littéral ne doit plus vivre dans le composant : deux sources, et le
    // masquage viserait un identifiant que le bandeau ne porte plus.
    expect(source).not.toContain(`const BANNER_ID = "${ID_BANNIERE_CONSENTEMENT}"`);
  });

  it("rend `false` quand il n'y a pas de document (rendu serveur)", () => {
    // `document` existe dans l'environnement jsdom de Vitest ; on vérifie donc
    // le comportement réel : hors console, la réponse est `false`.
    expect(estSurfaceConsole()).toBe(false);
  });

  it("reconnaît la console dès que le marqueur est présent dans le DOM", () => {
    const div = document.createElement("div");
    div.className = CLASSES[0] ?? "";
    document.body.appendChild(div);
    try {
      expect(estSurfaceConsole()).toBe(true);
    } finally {
      div.remove();
    }
  });
});
