// @req REQ-SEC-012
/**
 * Chantier Axion Partners — INT-T50-A : le runbook de rotation d'un secret partagé avec Partners
 * (`docs/runbooks/rotation-secret-partners.md`), jugé sur son texte.
 *
 * CE QU'IL PROUVE : le runbook existe ; il pose la règle « le récepteur d'abord » et l'applique dans
 * le bon ordre aux deux secrets ; il borne le délai entre le web et le worker par l'échéance de
 * l'ancienne clé ; il nomme des secrets que le code lit vraiment ; il dit que l'alerte de secret
 * désynchronisé est attendue pendant la rotation, et fait vérifier qu'aucun limiteur d'axion-ia ne
 * bloque Partners après la série de refus (rattrapage 96) ; il ne porte aucune valeur de secret ni
 * aucune adresse.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const CHEMIN = path.resolve(__dirname, "../../../../docs/runbooks/rotation-secret-partners.md");
const lire = () => readFileSync(CHEMIN, "utf8");
/** Le texte lu comme une phrase : une ligne, sans gras, une seule forme d'apostrophe. */
const aplati = () => lire().replace(/\*\*/g, "").replace(/’/g, "'").replace(/\s+/g, " ");
const section = (titre: RegExp) => {
  const t = lire();
  const debut = t.search(titre);
  if (debut < 0) throw new Error(`section introuvable : ${titre}`);
  const suite = t.slice(debut + 1).search(/\n## /);
  return t.slice(debut, suite < 0 ? undefined : debut + 1 + suite).replace(/\*\*/g, "");
};
const avant = (texte: string, a: string, b: string) => {
  const i = texte.indexOf(a);
  const j = texte.indexOf(b);
  expect(i, a).toBeGreaterThanOrEqual(0);
  expect(j, b).toBeGreaterThanOrEqual(0);
  return i < j;
};

describe("REQ-SEC-012 — le runbook de rotation d'un secret partagé avec Partners", () => {
  it("REQ-SEC-012 : le runbook existe, et pose la règle : le récepteur d'abord, jamais l'émetteur avant", () => {
    expect(existsSync(CHEMIN)).toBe(true);
    const t = aplati();
    expect(t).toContain("le récepteur d'abord");
    expect(t).toContain("Jamais l'émetteur avant le récepteur");
  });

  it("REQ-SEC-012 : PARTNERS_SYNC_SECRET — Partners d'abord, puis le web, puis le worker AVANT l'échéance", () => {
    const a = section(/## A\. `PARTNERS_SYNC_SECRET`/);
    expect(avant(a, "Partners d'abord", "Le web d'axion-ia")).toBe(true);
    expect(avant(a, "Le web d'axion-ia", "Le worker d'axion-ia, AVANT E")).toBe(true);
    expect(a.replace(/\s+/g, " ")).toContain("strictement inférieur à E");
  });

  it("REQ-SEC-012 : PARTNERS_RELECTURE_SECRET — axion-ia d'abord, puis Partners", () => {
    const b = section(/## B\. `PARTNERS_RELECTURE_SECRET`/);
    expect(avant(b, "Le web d'axion-ia d'abord", "Partners ensuite")).toBe(true);
  });

  it("REQ-SEC-012 : les secrets nommés sont ceux que le code lit", () => {
    const t = lire();
    // Les deux modules de configuration du canal : l'émission (partners) et la lecture (partners-sync).
    const config = ["../../partners/config.ts", "../config.ts"]
      .map((f) => readFileSync(path.resolve(__dirname, f), "utf8"))
      .join("\n");
    for (const nom of ["PARTNERS_SYNC_SECRET", "PARTNERS_RELECTURE_SECRET"]) {
      expect(t, nom).toContain(`\`${nom}\``);
      expect(config, nom).toContain(nom);
    }
  });

  it("REQ-SEC-012 : TÉMOIN (rattrapage 96) — l'alerte de secret désynchronisé est ATTENDUE pendant la rotation", () => {
    expect(aplati()).toMatch(/alerte de secret désynchronisé[^.]*attendue/i);
  });

  it("REQ-SEC-012 : TÉMOIN (rattrapage 96) — vérifier qu'aucun limiteur d'axion-ia ne bloque Partners après la série de refus", () => {
    const t = aplati();
    expect(t).toMatch(/aucun limiteur d'axion-ia ne bloque Partners/);
    // Le limiteur du rejeu est nommé, et sa place APRÈS la vérification de signature est dite.
    expect(t).toContain("partners:reconciliation");
    expect(t).toMatch(/après la vérification de (la )?signature/);
  });

  it("REQ-SEC-012 : aucune valeur de secret, aucune adresse électronique", () => {
    const t = lire();
    expect(t).not.toMatch(/\b[0-9a-f]{32,}\b/i);
    expect(t).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  });
});
