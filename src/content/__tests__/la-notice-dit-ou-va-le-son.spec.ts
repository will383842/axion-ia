// @vitest-environment node

/**
 * Verrou — la notice qui annonce l'enregistrement dit OÙ VA LE SON : nos
 * serveurs, un stockage chiffré, au plus 30 jours, puis OpenAI (chantier visio,
 * PR 8 ; motif n° 3 de la décision du 2026-09-01 : « on ne sait pas où va le
 * son ni combien de temps il y reste »).
 *
 * Le texte vérifié est celui qui SERA publié (`actif = true`) : il se relit
 * avant la bascule, pas après. Les lignes Google Meet et Cloudflare de
 * `/sous-processeurs` basculent avec lui : Meet dit que le son peut être
 * enregistré par Axion-IA (et non par Google), Cloudflare qu'il y est déposé
 * chiffré.
 *
 * Contre-témoin : le texte d'aujourd'hui (`actif = false`) ne dit rien de
 * tout cela — la garde discrimine. Angle mort : elle vérifie des présences,
 * pas l'exactitude des durées, que tient `une-duree-annoncee-a-sa-purge.spec.ts`.
 */

import { describe, expect, it } from "vitest";

import {
  donneesMeet,
  phraseConfirmationVisio,
  sectionRendezVousDecouverte,
  stockageSonCloudflare,
} from "../visio-annonce-textes";

const OU_VA_LE_SON = {
  fr: ["nos serveurs", "chiffré", "30 jours", "OpenAI", "effacé"],
  en: ["our servers", "encrypted", "30 days", "OpenAI", "deleted"],
} as const;

describe("la notice dit où va le son et combien de temps il y reste", () => {
  for (const locale of ["fr", "en"] as const) {
    it(`🔴 ${locale} : la section publiée à la bascule nomme chaque étape du son`, () => {
      const texte = sectionRendezVousDecouverte(locale, true);
      const absentes = OU_VA_LE_SON[locale].filter((f) => !texte.includes(f));
      expect(absentes, "la notice ne dit pas où va le son").toEqual([]);
    });

    it(`🔴 ${locale} : les lignes Meet et Cloudflare basculent avec la notice`, () => {
      expect(donneesMeet(locale, true)).toMatch(/Axion-IA/);
      expect(donneesMeet(locale, true)).not.toBe(donneesMeet(locale, false));
      expect(stockageSonCloudflare(locale, true)).toMatch(
        locale === "fr" ? /chiffré/ : /encrypted/,
      );
      expect(stockageSonCloudflare(locale, true)).toMatch(/30/);
    });

    it(`🔑 ${locale} : CONTRE-TÉMOIN — rien de tout cela n'est publié avant la bascule`, () => {
      const avant = sectionRendezVousDecouverte(locale, false);
      expect(avant.includes("OpenAI")).toBe(false);
      expect(stockageSonCloudflare(locale, false)).toBe("");
      expect(phraseConfirmationVisio(locale, false)).toBeNull();
      expect(phraseConfirmationVisio(locale, true)).toBeTruthy();
    });
  }
});
