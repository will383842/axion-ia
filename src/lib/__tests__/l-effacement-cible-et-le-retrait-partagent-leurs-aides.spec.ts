/**
 * ⛔ L'EFFACEMENT CIBLÉ ET LE RETRAIT DE L'ACCORD PARTAGENT LEURS AIDES.
 *
 * `retirerAccordRencontre` (B2) retapait les séquences d'`effacerCibleParAdresses`
 * (art. 17) — vider des faits, passer des comptes rendus à `a_regenerer` — et
 * les copies avaient déjà divergé : seul le retrait détachait les liens des
 * autres faits (`relationAvecFaitId`, `resoluParFaitId`, `remplaceParId`,
 * `doublonDeFaitId`). Un fait effacé par l'art. 17 restait donc désigné par
 * les faits restants. Deux aides, `viderFaits` et `mettreARegenerer`, portent
 * désormais les deux chemins.
 *
 * Mutations qui rougissent : réécrire une séquence à la main dans l'un des
 * deux effacements ; retirer un détachement de lien de `viderFaits`.
 * Contre-témoin : les deux effacements appellent bien les DEUX aides. Angle
 * mort : la purge de conservation (`viderDossier`) garde sa propre séquence —
 * elle vide TOUS les faits d'un dossier, aucun fait restant ne les désigne.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(path.resolve(__dirname, "../rgpd-erase.ts"), "utf8");

function corps(nom: string): string {
  const debut = src.indexOf(`export async function ${nom}(`);
  return src.slice(debut, src.indexOf("\n}\n", debut));
}

function aide(nom: string): string {
  const debut = src.indexOf(`async function ${nom}(`);
  return src.slice(debut, src.indexOf("\n}\n", debut));
}

describe("l'effacement ciblé et le retrait partagent leurs aides", () => {
  for (const nom of ["effacerCibleParAdresses", "retirerAccordRencontre"]) {
    it(`${nom} passe par viderFaits et mettreARegenerer, sans copie`, () => {
      const c = corps(nom);
      expect(c).toMatch(/await viderFaits\(tx, faitIds, /);
      expect(c).toMatch(/await mettreARegenerer\(tx, /);
      expect(c).not.toMatch(/FAIT_CONTENU_VIDE/);
      expect(c).not.toMatch(/statut: "a_regenerer"|COMPTE_RENDU_A_REGENERER/);
      expect(c).not.toMatch(/programmerReecritures\(/);
    });
  }

  it("viderFaits détache les quatre liens des autres faits", () => {
    const v = aide("viderFaits");
    for (const lien of [
      "relationAvecFaitId",
      "resoluParFaitId",
      "remplaceParId",
      "doublonDeFaitId",
    ])
      expect(v, lien).toContain(`${lien}: { in: ids }`);
    expect(v).toContain("PRE_REMPLISSAGE_VIDE");
  });

  it("mettreARegenerer vide, journalise ET programme la réécriture", () => {
    const m = aide("mettreARegenerer");
    expect(m).toContain("COMPTE_RENDU_A_REGENERER");
    expect(m).toContain('journaliserEffacements(tx, "comptes_rendus"');
    expect(m).toContain("programmerReecritures(tx, comptesRendus)");
  });
});
