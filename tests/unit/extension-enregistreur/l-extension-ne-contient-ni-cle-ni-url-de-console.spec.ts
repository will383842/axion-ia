/**
 * ⛔ L'EXTENSION NE CONTIENT NI CLÉ NI URL DE CONSOLE (PR 5).
 *
 * Le paquet est non empaqueté, lisible sur le disque de Will, et vit dans un
 * dépôt public. Il ne porte donc :
 *   · aucune clé d'API (ni `sk-…`, ni variable `*_API_KEY`, ni `OPENAI`) ;
 *   · aucun chemin de console (`/fr/<préfixe>`, `adminPrefix`,
 *     `ADMIN_URL_PREFIX`) : le panneau passe par `/api/enregistreur/ouvrir` ;
 *   · aucune porte vers l'extérieur (`externally_connectable`,
 *     `onMessageExternal`).
 *
 * Mutation qui rougit : écrire `"https://axion-ia.com/fr/console"` dans
 * `panneau.js` → 2ᵉ cas. Contre-témoin : le balayage voit bien tous les
 * fichiers (manifeste, service worker, offscreen, panneau, options, lib).
 */

import { describe, expect, it } from "vitest";

import { fichiersDeLExtension, sansCommentaires } from "./outils";

const fichiers = fichiersDeLExtension();

describe("⛔ l'extension ne contient ni clé ni URL de console", () => {
  it("le balayage voit le paquet entier", () => {
    const noms = fichiers.map((f) => f.chemin);
    for (const attendu of [
      "manifest.json",
      "service-worker.js",
      "offscreen.js",
      "panneau.js",
      "options.js",
      "stockage-local.js",
      "lib/api.js",
      "lib/etats-capture.js",
      "contrat.json",
    ]) {
      expect(noms).toContain(attendu);
    }
  });

  it.each(fichiers.map((f) => [f.chemin, f.contenu]))(
    "%s : aucune clé, aucun chemin de console",
    (_c, contenu) => {
      const code = sansCommentaires(contenu);
      expect(code).not.toMatch(/\bsk-[A-Za-z0-9]{10,}/);
      expect(code).not.toMatch(/_API_KEY|OPENAI|api\.openai\.com/);
      expect(code).not.toMatch(/ADMIN_URL_PREFIX|adminPrefix|admin-dev-/);
      // Seule adresse /fr/ tolérée : la page PUBLIQUE des sous-traitants.
      for (const m of code.matchAll(/https:\/\/axion-ia\.com\/fr\/[^\s"'`)]*/g)) {
        expect(m[0]).toBe("https://axion-ia.com/fr/sous-processeurs");
      }
    },
  );

  it("aucune porte vers l'extérieur", () => {
    const manifeste = JSON.parse(
      fichiers.find((f) => f.chemin === "manifest.json")?.contenu ?? "{}",
    );
    expect(manifeste.externally_connectable).toBeUndefined();
    for (const f of fichiers)
      expect(sansCommentaires(f.contenu)).not.toMatch(/onMessageExternal|onConnectExternal/);
  });

  it("le manifeste : MV3, Chrome 116+, les permissions prévues et elles seules", () => {
    const m = JSON.parse(fichiers.find((f) => f.chemin === "manifest.json")?.contenu ?? "{}");
    expect(m.manifest_version).toBe(3);
    expect(m.minimum_chrome_version).toBe("116");
    expect([...m.permissions].sort()).toEqual(
      [
        "alarms",
        "notifications",
        "offscreen",
        "scripting",
        "sidePanel",
        "storage",
        "tabCapture",
      ].sort(),
    );
    expect(m.host_permissions).toEqual(["https://axion-ia.com/*", "https://meet.google.com/*"]);
  });

  it("le jeton est gardé en stockage local réservé à l'extension", () => {
    const sw = fichiers.find((f) => f.chemin === "service-worker.js")?.contenu ?? "";
    expect(sw).toMatch(/setAccessLevel\(\{ accessLevel: "TRUSTED_CONTEXTS" \}\)/);
  });
});
