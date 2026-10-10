// Aucune RARETÉ dans les messages du tunnel apporteurs (2026-10-10, audit du
// tunnel publicitaire). « Les créneaux sont limités » était une pression
// artificielle : le calendrier suit les disponibilités de Will, rien n'est rare.
//
// Deux filets : le RENDU réel des gabarits du tunnel, variante par variante, et
// la SOURCE de tous les gabarits apporteur (une phrase ajoutée dans une variante
// que le rendu ci-dessous ne couvre pas reste attrapée).

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { renderEmailTemplate } from "../index";

const RARETE = /limit[ée]|limited|plus que \d+|derni[eè]res? places?/i;
const CALENDLY = "https://calendly.com/axion-ia/echange-apporteur";
const DOSSIER = "https://axion-ia.com/fr/apporteur-affaires/candidature";

beforeAll(() => {
  process.env["AUTH_SECRET"] = "secret-de-test-suffisamment-long-0123456789";
});

const CAS: Array<[string, Record<string, unknown>]> = [
  ["apporteur-invitation-appel", { contactName: "Camille", calendlyUrl: CALENDLY }],
  ...[0, 1, 2, 3].map(
    (variante) =>
      [
        "apporteur-invitation-appel",
        { contactName: "Camille", calendlyUrl: CALENDLY, candidature: true, variante },
      ] as [string, Record<string, unknown>],
  ),
  ["apporteur-invitation-relance", { contactName: "Camille", calendlyUrl: CALENDLY, etape: "j3" }],
  ["apporteur-invitation-relance", { contactName: "Camille", calendlyUrl: CALENDLY, etape: "j7" }],
  ["lead-apporteur-recu", { contactName: "Camille", dossierUrl: DOSSIER }],
  [
    "lead-apporteur-recu",
    { contactName: "Camille", dossierUrl: DOSSIER, variante: "dossier-commence" },
  ],
  ["lead-apporteur-recu", { contactName: "Camille", dossierUrl: DOSSIER, variante: "vsl-abandon" }],
  [
    "lead-apporteur-recu",
    { contactName: "Camille", dossierUrl: DOSSIER, variante: "vsl-etape2", calendlyUrl: CALENDLY },
  ],
  ["lead-apporteur-relance", { contactName: "Camille", dossierUrl: DOSSIER, etape: "j2" }],
  ["lead-apporteur-relance", { contactName: "Camille", dossierUrl: DOSSIER, etape: "j7" }],
  [
    "lead-apporteur-relance",
    { contactName: "Camille", dossierUrl: DOSSIER, etape: "j2", variante: "vsl" },
  ],
  [
    "lead-apporteur-relance",
    { contactName: "Camille", dossierUrl: DOSSIER, etape: "j7", variante: "vsl" },
  ],
];

describe("aucune rareté dans les e-mails du tunnel apporteurs", () => {
  it.each(CAS)("%s %j", async (gabarit, payload) => {
    const r = await renderEmailTemplate(gabarit as never, "fr", payload, {
      destinataire: "camille@exemple.fr",
    });
    expect(r.subject).not.toMatch(RARETE);
    expect(r.html).not.toMatch(RARETE);
  });

  it("aucune source de gabarit apporteur ne parle de créneaux ou places limités", () => {
    const dossier = path.resolve(__dirname, "..");
    const fichiers = readdirSync(dossier).filter((f) => /apporteur/.test(f) && /\.tsx?$/.test(f));
    expect(fichiers.length).toBeGreaterThan(5);
    for (const f of fichiers) {
      const source = readFileSync(path.join(dossier, f), "utf8");
      expect(source, f).not.toMatch(/(cr[ée]neaux|places?|slots?)[^.\n]{0,20}limit/i);
    }
  });
});
