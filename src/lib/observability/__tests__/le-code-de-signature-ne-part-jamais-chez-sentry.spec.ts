// S6b — relecture sécurité. Le code de signature à usage unique ne part jamais chez
// Sentry : ni par le CORPS de la requête de la page publique de signature (où le
// signataire le saisit), ni par les données d'un job de la file d'e-mails.
import { describe, expect, it } from "vitest";

import { sanitizeJobData } from "@/server/queue/lib/sanitize-job-data";

import { corpsAIgnorer, piiScrubBeforeSend } from "../sentry-pii-scrub";

const CODE = "042517";
const JETON = "eyJkIjoiYWJjIn0abcdefghijkl.c2lnbmF0dXJlLWRlLXRlc3QtMTIzNDU2";

function evenement(chemin: string) {
  return {
    request: {
      url: `https://axion-ia.com${chemin}/${JETON}`,
      method: "POST",
      data: `1_code=${CODE}&1_nom=Claire%20Exemple`,
      headers: { Referer: `https://axion-ia.com${chemin}/${JETON}`, "Next-Action": "abc" },
    },
    exception: { values: [{ type: "Error", value: "stockage indisponible" }] },
  };
}

describe("le code de signature ne part jamais chez Sentry", () => {
  it.each(["/portail/signer", "/fr/portail/signer"])(
    "🔴 page publique de signature (%s) : ni code, ni jeton dans l'événement",
    (chemin) => {
      const brut = JSON.stringify(evenement(chemin));
      expect(brut).toContain(CODE); // contre-témoin
      const nettoye = JSON.stringify(piiScrubBeforeSend(evenement(chemin) as never));
      expect(nettoye).not.toContain(CODE);
      expect(nettoye).not.toContain(JETON);
      expect(corpsAIgnorer(`${chemin}/${JETON}`)).toBe(true);
    },
  );

  it("contre-témoin : une route voisine par le nom n'est pas purgée", () => {
    expect(corpsAIgnorer("/fr/portail/signature-aide")).toBe(false);
  });

  it("🔴 données d'un job : la clé `code` est masquée à toute profondeur", () => {
    const j = sanitizeJobData({
      template: "formateur-code-signature",
      payload: { valeurs: { code: CODE, durée: "15 minutes" } },
    });
    expect(JSON.stringify(j)).not.toContain(CODE);
  });
});
