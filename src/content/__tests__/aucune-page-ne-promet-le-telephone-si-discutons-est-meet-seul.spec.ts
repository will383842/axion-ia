// @vitest-environment node

/**
 * Verrou — « Discutons de votre projet IA » se tient en Google Meet SEULEMENT
 * (décision B5 de Will, 28/09 : « 1 ET 2 ») ; aucune page ne doit encore
 * proposer « par téléphone ou en visio » (chantier visio, PR 8, T23).
 *
 * Les pages qui le promettaient le 2026-09-29 : `/appel` (description et étape
 * 1), `/guide-ia` (encart de l'appel), la politique de confidentialité
 * (section « Rendez-vous de découverte »). Le réglage de Calendly (lieu
 * « Google Meet » seul) est un geste de Will, APRÈS la mise en ligne.
 *
 * Ce qui RESTE, à dessein : la branche téléphone de l'e-mail
 * `appel-rappel.tsx` (les rendez-vous téléphoniques déjà pris), et
 * `OrangeContactBanner` (« nous vous recontactons par téléphone ou par mail »
 * parle de la réponse à un formulaire, pas du rendez-vous).
 *
 * Contre-témoin : l'ancienne formule est reconnue par le motif. Angle mort :
 * seules les pages listées sont lues — une nouvelle page qui écrirait la
 * formule ailleurs passerait ; la liste est celle de l'inventaire 05 (T23).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { LEGAL_PAGES } from "../legal";
import { DISCUTONS_MEET_SEUL } from "@/server/visio/visio-annonce";

const PAGES = [
  "src/app/[locale]/appel/page.tsx",
  "src/app/[locale]/appel/confirme/page.tsx",
  "src/content/guide-ia-page.ts",
] as const;

const PROMESSE_TELEPHONE =
  /par t[ée]l[ée]phone ou (en |par )?visio|t[ée]l[ée]phone ou (en )?visio|au choix par t[ée]l[ée]phone|by phone or (by )?video|by phone or video/i;

describe("aucune page ne promet le téléphone quand « Discutons » est en Meet seul", () => {
  it("🔑 la décision B5 est codée", () => {
    expect(DISCUTONS_MEET_SEUL).toBe(true);
  });

  for (const page of PAGES) {
    it(`🔴 ${page} ne propose plus « par téléphone ou en visio »`, () => {
      if (!DISCUTONS_MEET_SEUL) return;
      const source = readFileSync(join(process.cwd(), page), "utf8");
      expect(source.match(PROMESSE_TELEPHONE)?.[0] ?? null).toBeNull();
    });
  }

  it("🔴 la politique de confidentialité publiée ne le propose plus", () => {
    if (!DISCUTONS_MEET_SEUL) return;
    expect(JSON.stringify(LEGAL_PAGES).match(PROMESSE_TELEPHONE)?.[0] ?? null).toBeNull();
  });

  it("🔑 CONTRE-TÉMOIN : l'ancienne formule est reconnue", () => {
    expect(
      PROMESSE_TELEPHONE.test("Premier échange de 45 minutes, par téléphone ou en visioconférence"),
    ).toBe(true);
    expect(PROMESSE_TELEPHONE.test("se tient au choix par téléphone ou en visioconférence")).toBe(
      true,
    );
    expect(PROMESSE_TELEPHONE.test("Un diagnostic de 45 minutes, par téléphone ou en visio")).toBe(
      true,
    );
  });
});
