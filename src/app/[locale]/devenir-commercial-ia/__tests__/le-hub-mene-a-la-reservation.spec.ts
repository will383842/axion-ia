// @vitest-environment node

/**
 * Le hub `/devenir-commercial-ia` mène à la RÉSERVATION (décision de Will, 25/11/2026).
 *
 * Le dossier de 3 minutes faisait perdre trop de monde : chaque bouton « réserver » du hub
 * va à `/fr/appel/apporteur` avec son emplacement dans `?depuis=` (suivi par la réservation :
 * forme acceptée par `lireDepuis`). La page `/candidature` reste en place (liens de relance
 * e-mail) mais le hub n'y renvoie plus.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { lireDepuis } from "@/server/calendly/choix-rendez-vous";

const lire = (c: string) => readFileSync(join(process.cwd(), c), "utf8");
const SECTIONS = lire("src/components/recrutement/landings/SectionsPrincipale.tsx");
const PAGE = lire("src/app/[locale]/devenir-commercial-ia/page.tsx");
const FAQ = lire("src/components/recrutement/landings/faq.tsx");

const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

describe("🔑 le hub apporteurs mène à la réservation", () => {
  it("aucun lien du hub ne pointe plus vers /candidature", () => {
    for (const src of [SECTIONS, PAGE, FAQ]) {
      expect(code(src)).not.toMatch(/href=\{?["'`][^"'`]*candidature/);
      expect(code(src)).not.toContain("DOSSIER");
    }
  });

  it("les quatre boutons de la page portent leur depuis, au format accepté", () => {
    const depuis = [
      ...code(SECTIONS).matchAll(/href="\/fr\/appel\/apporteur\?depuis=([^"]+)"/g),
    ].map((m) => m[1]!);
    expect(depuis.sort()).toEqual(["bas", "comment", "commission", "haut"]);
    for (const d of depuis) expect(lireDepuis(d)).toBe(d);
  });

  it("le bouton collant mène à /appel/apporteur avec depuis=mobile", () => {
    const m = code(PAGE).match(/const RESERVATION = "([^"]+)"/);
    expect(m?.[1]).toBe("/appel/apporteur?depuis=mobile");
    expect(code(PAGE)).toContain("href={RESERVATION}");
    expect(lireDepuis("mobile")).toBe("mobile");
  });

  it("aucun texte du hub n'annonce encore le dossier ni l'invitation", () => {
    for (const src of [SECTIONS, FAQ]) {
      expect(src).not.toMatch(/dossier de 3 minutes|sur invitation|Trois minutes/i);
    }
  });
});
