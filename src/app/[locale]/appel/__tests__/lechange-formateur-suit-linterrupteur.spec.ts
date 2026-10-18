// @vitest-environment node

/**
 * Verrou — `formateurs.echange_ouvert` ferme la RÉSERVATION de l'échange formateur.
 * Garde de texte (comme les autres specs de ce dossier) : le câblage des pages.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const lire = (c: string) => readFileSync(join(process.cwd(), c), "utf8");
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

const PAGE = sansCommentaires(lire("src/app/[locale]/appel/page.tsx"));
const RESERVER = sansCommentaires(lire("src/app/[locale]/appel/reserver/page.tsx"));
const MESSAGE = sansCommentaires(lire("src/components/booking/EchangeFormateurFerme.tsx"));

describe("l'échange formateur suit l'interrupteur", () => {
  it("/appel lit l'interrupteur côté serveur, seulement pour le choix formateur", () => {
    expect(PAGE).toMatch(/choix === "formateur"[\s\S]*echangeFormateurOuvert\(\)/);
  });
  it("/appel rend le message AVANT toute résolution Calendly du choix formateur", () => {
    const iFerme = PAGE.indexOf("<EchangeFormateurFerme");
    const iResolution = PAGE.indexOf("await resoudreChoix(choix)");
    expect(iFerme).toBeGreaterThan(-1);
    expect(iFerme).toBeLessThan(iResolution);
  });
  it("/appel/reserver rend le message avant tout redirect, pour le choix formateur", () => {
    const iFerme = RESERVER.indexOf("<EchangeFormateurFerme");
    expect(iFerme).toBeGreaterThan(-1);
    expect(iFerme).toBeLessThan(RESERVER.indexOf("redirect(calendrier)"));
    expect(RESERVER).toMatch(/choix === "formateur"[\s\S]*echangeFormateurOuvert\(\)/);
  });
  it("le message est poli, réserve sa hauteur, sans JS client ni lien Calendly", () => {
    expect(MESSAGE).toContain("Les échanges avec les formateurs ne sont pas encore ouverts.");
    expect(MESSAGE).toMatch(/min-h-/);
    expect(MESSAGE).not.toMatch(/use client|calendly|href=\{?["`]https?:/i);
  });
  it("les autres choix ne sont pas touchés : la garde ne porte que sur « formateur »", () => {
    expect(PAGE.match(/echangeFormateurOuvert\(\)/g)).toHaveLength(1);
    expect(RESERVER.match(/echangeFormateurOuvert\(\)/g)).toHaveLength(1);
  });
});
