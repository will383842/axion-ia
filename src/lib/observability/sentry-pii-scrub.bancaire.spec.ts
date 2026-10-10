/**
 * Lot S4 — Sentry applique la même règle que le journal Qualiopi : aucune
 * donnée bancaire ni personnelle ne part en clair, à n'importe quelle
 * profondeur des données jointes à un événement.
 */

import { describe, it, expect } from "vitest";

import {
  piiScrubBeforeSend,
  piiScrubBeforeSendTransaction,
} from "@/lib/observability/sentry-pii-scrub";

const IBAN = "FR7630006000011234567890189";

describe("piiScrubBeforeSend — données bancaires et personnelles", () => {
  it("🔴 masque un IBAN imbriqué dans `extra`, avec ses quatre derniers caractères", () => {
    const e = piiScrubBeforeSend({
      extra: { formateur: { coordonnees: { iban: IBAN, bic: "AGRIFRPP882" } } },
    } as never);
    const texte = JSON.stringify(e);
    expect(texte).not.toContain("30006000011234567890");
    expect(texte).not.toContain("AGRIFRPP");
    expect(texte).toContain('"masque":true');
    expect(texte).toContain('"fin4":"0189"');
  });

  it("masque e-mail, téléphone et adresse par leur clé dans `contexts` et les breadcrumbs", () => {
    const e = piiScrubBeforeSend({
      contexts: { trace: { data: { adresse: { rue: "12 rue des Lilas" } } } },
      breadcrumbs: [{ message: "maj", data: { contact: { telephone: "0612345678" } } }],
    } as never);
    const texte = JSON.stringify(e);
    expect(texte).not.toContain("Lilas");
    expect(texte).not.toContain("0612345678");
  });

  it("masque un IBAN écrit dans le message d'une exception", () => {
    const e = piiScrubBeforeSend({
      exception: { values: [{ value: `virement refusé sur ${IBAN}` }] },
    } as never);
    expect(e?.exception?.values?.[0]?.value).not.toContain("30006000011234567890");
  });

  it("le corps de requête est masqué à toute profondeur", () => {
    const e = piiScrubBeforeSend({
      request: { url: "https://axion-ia.com/fr", data: { saisie: { ribFormateur: IBAN } } },
    } as never);
    expect(JSON.stringify(e)).not.toContain("30006000011234567890");
  });

  it("les transactions suivent la même règle", () => {
    const e = piiScrubBeforeSendTransaction({ extra: { iban: IBAN } } as never);
    expect(JSON.stringify(e)).not.toContain("30006000011234567890");
  });
});
