// @vitest-environment node

/**
 * Verrou — une seule entité responsable des données : AXION IA SAS (France),
 * la même dans la SSOT d'identité, les deux registres et la notice (chantier
 * visio, PR 8 ; décision B4 de Will du 28/09 : « il n'y a aucune société
 * estonienne »).
 *
 * La mention « Axion-IA OÜ, Estonie » du registre était un reste de la bascule
 * de juin, corrigé par la PR 1. La PR 1 avouait son angle mort : « jusqu'à la
 * PR 8, une réintroduction de « OÜ » ne rougit nulle part ». Ce test le ferme.
 *
 * Tolérée : la ligne d'historique qui DIT la correction (« Entité corrigée le
 * 29/09/2026… ») — elle ne nomme pas l'ancienne entité.
 *
 * Contre-témoin : un registre fictif à « Axion-IA OÜ » est refusé. Angle mort :
 * le SIREN n'est comparé que là où il est écrit (§1 de l'art. 30, en-tête du
 * DPA-REGISTER) ; la notice publique ne le porte pas (les mentions légales le
 * lisent de la SSOT au rendu).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { IDENTITE_LEGALE } from "@/lib/identite-legale-ssot";
import { LEGAL_PAGES } from "../legal";

const REGISTRES = [
  "_AUDIT/DPA-REGISTER.md",
  "_AUDIT/AUDIT-FINAL-PROD-READY-2026-05-22/RGPD-REGISTRE-ART30.md",
] as const;

// « OÜ » sans `\b` : `Ü` n'est pas un caractère de mot pour une regex sans
// drapeau `u`, et `\bOÜ\b` ne trouverait jamais rien.
const AUTRE_ENTITE = /OÜ|estonien|Estonie|\bAKI\b/;

const lire = (f: string): string => readFileSync(join(process.cwd(), f), "utf8");

function sirensDans(texte: string): string[] {
  return [...texte.matchAll(/SIREN\s*[:|]?\s*\|?\s*((?:\d\s?){9})/g)].map((m) =>
    m[1]!.replace(/\s/g, ""),
  );
}

function mentionsDUneAutreEntite(texte: string): string[] {
  return texte.split("\n").filter((l) => AUTRE_ENTITE.test(l));
}

describe("une seule entité responsable dans la notice et les registres", () => {
  for (const registre of REGISTRES) {
    it(`🔴 ${registre} porte le SIREN de la SSOT, et lui seul`, () => {
      const sirens = sirensDans(lire(registre));
      expect(sirens.length, "aucun SIREN dans le registre").toBeGreaterThan(0);
      expect([...new Set(sirens)]).toEqual([IDENTITE_LEGALE.siren]);
    });

    it(`🔴 ${registre} ne nomme aucune autre entité (ni « OÜ », ni droit estonien)`, () => {
      expect(mentionsDUneAutreEntite(lire(registre))).toEqual([]);
    });
  }

  it("🔴 la politique de confidentialité ne nomme aucune autre entité", () => {
    expect(mentionsDUneAutreEntite(JSON.stringify(LEGAL_PAGES))).toEqual([]);
  });

  it("🔑 CONTRE-TÉMOIN : un registre à « Axion-IA OÜ » et un autre SIREN est refusé", () => {
    const fictif = "**Responsable** : Axion-IA OÜ, Tallinn\n| SIREN | 123 456 789 |";
    expect(mentionsDUneAutreEntite(fictif)).toEqual(["**Responsable** : Axion-IA OÜ, Tallinn"]);
    expect(sirensDans(fictif)).toEqual(["123456789"]);
  });
});
