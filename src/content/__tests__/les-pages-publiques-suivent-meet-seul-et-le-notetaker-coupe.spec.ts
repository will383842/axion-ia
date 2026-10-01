/**
 * R5 et R6 (2e vérification du chantier visio) — deux textes publics
 * contredisaient la décision B5 (« Discutons » en Google Meet seul) :
 *
 *   · R5 : `/audit` (données structurées HowTo, étape 1) promettait un
 *     « appel téléphonique » ;
 *   · R6 : `/fr/sous-processeurs` décrivait le Notetaker Calendly comme
 *     « réglé pour rejoindre » les réunions, alors qu'il est désactivé —
 *     deux enregistreurs annoncés pour les mêmes visios.
 *
 * Mutation qui rougit : remettre l'une des deux phrases.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { SUBPROCESSORS } from "../subprocessors";

describe("les pages publiques suivent « Meet seul » et le Notetaker coupé", () => {
  it("R5 : /audit ne promet plus le téléphone, il nomme Google Meet", () => {
    const src = readFileSync("src/app/[locale]/audit/page.tsx", "utf8");
    expect(src).not.toMatch(/appel téléphonique|phone call/i);
    expect(src).toContain("Google Meet, gratuit et sans engagement");
  });

  it("R6 : le Notetaker Calendly est décrit comme désactivé", () => {
    const n = SUBPROCESSORS.find((s) => s.name.includes("Notetaker"));
    expect(n).toBeDefined();
    expect(n?.purposeFr).not.toMatch(/réglé .*pour rejoindre/i);
    expect(n?.purposeEn).not.toMatch(/configured .*to join/i);
    expect(n?.purposeFr).toContain("Désactivé : aucun assistant Calendly ne rejoint nos réunions.");
    expect(n?.purposeEn).toContain("Disabled: no Calendly assistant joins our meetings.");
  });
});
