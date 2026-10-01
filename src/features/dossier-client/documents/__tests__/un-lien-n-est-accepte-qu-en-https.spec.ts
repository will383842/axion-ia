// @vitest-environment node

/**
 * R5 — UN LIEN N'EST ACCEPTÉ QU'EN HTTPS (ADR 0063, D3).
 *
 * `validerLienHttps` est le MIROIR du CHECK `documents_projet_lien_https` : la
 * table de cas ci-dessous est rejouée telle quelle contre le motif de la
 * migration (lu dans le fichier SQL) — une divergence entre le code et la base
 * rougit ici, avant que Will ne voie un « échec imprévu ».
 *
 * Mutations qui rougissent : accepter `http:` ; oublier les identifiants
 * (`https://u:p@h`) ; ne pas borner la longueur ; laisser passer une espace.
 * Contre-témoin : une vraie adresse https avec requête et ancre est acceptée,
 * telle que Will l'a collée.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { titreDepuisLien, domaineDuLien, validerLienHttps } from "../lien";

const REFUSES: ReadonlyArray<[string, string]> = [
  ["http://axion-ia.com/x", "pas_https"],
  ["javascript:alert(1)", "pas_https"],
  ["data:text/html,<p>x</p>", "pas_https"],
  ["ftp://axion-ia.com/x", "pas_https"],
  ["axion-ia.com/x", "pas_https"],
  ["https://u:p@axion-ia.com/x", "illisible"],
  ["https://axion-ia.com/un lien", "illisible"],
  ["https://axion-ia.com/\u0007", "illisible"],
  [`https://axion-ia.com/${"a".repeat(2001 - "https://axion-ia.com/".length)}`, "trop_long"],
  ["", "vide"],
  ["   ", "vide"],
];

const ACCEPTES: ReadonlyArray<string> = [
  "https://axion-ia.com/x?a=1#b",
  "https://axion-ia.com",
  "https://docs.google.com/document/d/abc/edit?usp=sharing",
  "https://exemple.fr/chemin/avec@arobase",
];

/** Le motif du CHECK, lu dans la migration (POSIX → JavaScript). */
function motifDeLaBase(): RegExp {
  const sql = readFileSync(
    path.join(process.cwd(), "prisma/migrations/20261001120000_documents_projet/migration.sql"),
    "utf8",
  );
  const m =
    /"documents_projet_lien_https" CHECK \("lien_url" IS NULL OR "lien_url" ~ '([^']+)'\)/.exec(
      sql,
    );
  if (!m) throw new Error("CHECK documents_projet_lien_https introuvable dans la migration");
  const js = m[1]!.replace(/\[:space:\]/g, "\\s").replace(/\[:cntrl:\]/g, "\\x00-\\x1f\\x7f");
  return new RegExp(js);
}

describe("un lien n'est accepté qu'en https", () => {
  it.each(REFUSES)("refuse %j (%s)", (texte, raison) => {
    const v = validerLienHttps(texte);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.raison).toBe(raison);
  });

  it.each(ACCEPTES)("accepte %j tel qu'il a été collé", (texte) => {
    const v = validerLienHttps(`  ${texte}  `);
    expect(v).toEqual({ ok: true, url: texte });
  });

  it("2 000 caractères pile passent, comme dans la base", () => {
    const url = `https://axion-ia.com/${"a".repeat(2000 - "https://axion-ia.com/".length)}`;
    expect(url).toHaveLength(2000);
    expect(validerLienHttps(url).ok).toBe(true);
  });

  it("même table de cas que le CHECK de la base : tout ce que le code accepte, la base l'accepte", () => {
    const motif = motifDeLaBase();
    for (const url of ACCEPTES) expect(motif.test(url), url).toBe(true);
    for (const [texte] of REFUSES) {
      if (texte.trim() === "" || texte.length > 2000) continue;
      // La base refuse aussi (sauf `axion-ia.com/x` et `https://…/un lien`, que
      // le code refuse plus tôt — jamais l'inverse).
      if (motif.test(texte)) expect(validerLienHttps(texte).ok, texte).toBe(false);
    }
    expect(motif.test("http://axion-ia.com")).toBe(false);
    expect(motif.test("https://u:p@axion-ia.com")).toBe(false);
  });

  it("le titre par défaut d'un lien est le domaine suivi du chemin raccourci", () => {
    expect(titreDepuisLien("https://www.axion-ia.com/fr/exemples/console-exemple")).toBe(
      "axion-ia.com/…/console-exemple",
    );
    expect(titreDepuisLien("https://axion-ia.com/programme")).toBe("axion-ia.com/programme");
    expect(titreDepuisLien("https://axion-ia.com/")).toBe("axion-ia.com");
    expect(domaineDuLien("https://www.axion-ia.com/x?y=1")).toBe("axion-ia.com");
  });
});
