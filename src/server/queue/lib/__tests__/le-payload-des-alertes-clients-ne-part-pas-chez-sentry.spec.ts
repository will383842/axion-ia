// Le payload des e-mails « alerte-demande-client » et « recap-demandes-clients » (noms, téléphones,
// messages, liens d'annulation Calendly) ne doit JAMAIS atteindre Sentry, même quand l'envoi échoue.

import { describe, expect, it } from "vitest";
import { sanitizeJobData } from "../sanitize-job-data";

const PAYLOAD = {
  nom: "Alex Exemple",
  telephone: "Téléphone : +33 6 39 98 00 00",
  lignes: [
    "Nom : Alex Exemple",
    "Téléphone : +33 6 39 98 00 00",
    "Message : Bonjour, je souhaite un audit pour mon cabinet.",
    "Annuler / déplacer : https://calendly.com/cancellations/ABCDEF123456",
  ],
  demandes: [
    {
      nom: "Alex Exemple",
      lignes: ["Message : Bonjour, je souhaite un audit pour mon cabinet."],
    },
  ],
};

const INTERDITS = [
  "Alex Exemple",
  "+33 6 39 98 00 00",
  "Bonjour, je souhaite un audit",
  "https://calendly.com/cancellations/ABCDEF123456",
  "calendly.com",
];

describe.each(["alerte-demande-client", "recap-demandes-clients"])(
  "sanitizeJobData · %s",
  (gabarit) => {
    it("remplace tout le payload par [REDACTED]", () => {
      const res = sanitizeJobData({
        template: gabarit,
        to: "contact@exemple.fr",
        locale: "fr",
        payload: PAYLOAD,
      });
      expect(res?.["payload"]).toBe("[REDACTED]");
      expect(res?.["template"]).toBe(gabarit);
      const texte = JSON.stringify(res);
      for (const interdit of INTERDITS) expect(texte).not.toContain(interdit);
    });
  },
);

describe("sanitizeJobData · autre gabarit", () => {
  it("ne masque pas en bloc le payload d'un autre gabarit", () => {
    const res = sanitizeJobData({ template: "autre-gabarit", payload: { note: "bonjour" } });
    expect(res?.["payload"]).toEqual({ note: "bonjour" });
  });
});
