/**
 * ⛔ L'EXTENSION NE PARLE QU'AUX ROUTES DE L'ENREGISTREUR (PR 5).
 *
 *   · `fetch` n'apparaît que dans `lib/api.js` ;
 *   · `lib/api.js` ne construit d'adresse qu'à partir de `BASE_API`
 *     (https://axion-ia.com/api/enregistreur/), sans `..` ni caractère libre ;
 *   · le seul autre site visé est Google Meet (onglet à enregistrer), jamais
 *     appelé par `fetch` ;
 *   · les requêtes n'emportent aucun cookie (`credentials: "omit"`).
 *
 * Mutation qui rougit : ajouter `fetch("https://exemple.test")` dans
 * `service-worker.js` → 1er cas. Contre-témoin : `urlDe` refuse une route qui
 * sortirait du chemin.
 */

import { describe, expect, it } from "vitest";

import { urlDe } from "../../../extensions/enregistreur-meet/lib/api.js";
import { BASE_API } from "../../../extensions/enregistreur-meet/lib/constantes.js";
import { fichiersDeLExtension, sansCommentaires } from "./outils";

const js = fichiersDeLExtension().filter((f) => f.chemin.endsWith(".js"));

describe("⛔ l'extension ne parle qu'aux routes de l'enregistreur", () => {
  it("fetch n'est appelé que par lib/api.js", () => {
    const appelants = js
      .filter((f) => /\bfetch\s*\(/.test(sansCommentaires(f.contenu)))
      .map((f) => f.chemin);
    expect(appelants).toEqual(["lib/api.js"]);
  });

  it("la base est la route de l'enregistreur, et rien d'autre", () => {
    expect(BASE_API).toBe("https://axion-ia.com/api/enregistreur/");
    const api = sansCommentaires(js.find((f) => f.chemin === "lib/api.js")?.contenu ?? "");
    expect(api).toMatch(/fetch\(urlDe\(a\.route\)/);
    expect(api).toContain('credentials: "omit"');
  });

  it("toute adresse écrite dans le code vise l'enregistreur, Meet ou la page publique des sous-traitants", () => {
    const permises = [
      /^https:\/\/axion-ia\.com\/api\/enregistreur\/$/,
      /^https:\/\/meet\.google\.com\//,
      /^https:\/\/axion-ia\.com\/fr\/sous-processeurs$/,
    ];
    for (const f of js) {
      for (const m of sansCommentaires(f.contenu).matchAll(/https?:\/\/[^\s"'`)\\]+/g)) {
        expect(
          permises.some((p) => p.test(m[0])),
          `${f.chemin} vise ${m[0]}`,
        ).toBe(true);
      }
    }
  });

  it("contre-témoin : urlDe refuse de sortir du chemin", () => {
    expect(urlDe("sessions/abc/accord")).toBe(
      "https://axion-ia.com/api/enregistreur/sessions/abc/accord",
    );
    expect(() => urlDe("../admin")).toThrow();
    expect(() => urlDe("https://exemple.test")).toThrow();
    expect(() => urlDe("sessions?x=1")).toThrow();
  });
});
