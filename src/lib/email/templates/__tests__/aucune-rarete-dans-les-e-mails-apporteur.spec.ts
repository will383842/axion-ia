// Aucune RARETÉ dans les e-mails du tunnel apporteurs (2026-10-10).
//
// « Les créneaux sont limités » était une pression artificielle : l'agenda suit
// les disponibilités de Will, rien n'est rare. Règle de rédaction du tunnel :
// jamais de « places / créneaux limités ». Rendu RÉEL par le registre — c'est le
// texte reçu qui compte — sur chaque gabarit qui parle de réservation, puis une
// lecture des sources de TOUS les gabarits apporteur et de la page vidéo, pour
// qu'une phrase nouvelle ne se glisse pas ailleurs.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { renderEmailTemplate } from "../index";
import { VARIANTE_DOSSIER_COMMENCE } from "@/lib/commercial-application/kit-apporteur";
import {
  VARIANTE_VSL_ABANDON,
  VARIANTE_VSL_ETAPE2,
  VARIANTE_VSL_RELANCE,
} from "@/lib/commercial-application/vsl-apporteur";

const RARETE = /limit[ée]|places? (?:sont )?compt[ée]es|derni[èe]res? places?/i;
const CALENDLY = "https://calendly.com/axion-ia/echange-apporteur";
const DOSSIER = "https://axion-ia.com/fr/devenir-commercial-ia/candidature";

const RENDUS: Array<[string, string, Record<string, unknown>]> = [
  ...[0, 1, 2, 3].map((variante): [string, string, Record<string, unknown>] => [
    `invitation (candidature, variante ${variante})`,
    "apporteur-invitation-appel",
    { contactName: "Camille", calendlyUrl: CALENDLY, candidature: true, variante },
  ]),
  [
    "invitation (saisie manuelle)",
    "apporteur-invitation-appel",
    { contactName: "Camille", calendlyUrl: CALENDLY },
  ],
  [
    "rappel J+3",
    "apporteur-invitation-relance",
    { contactName: "Camille", calendlyUrl: CALENDLY, etape: "j3" },
  ],
  [
    "rappel J+7",
    "apporteur-invitation-relance",
    { contactName: "Camille", calendlyUrl: CALENDLY, etape: "j7" },
  ],
  ["accusé", "lead-apporteur-recu", { contactName: "Camille", dossierUrl: DOSSIER }],
  [
    "dossier commencé",
    "lead-apporteur-recu",
    { contactName: "Camille", dossierUrl: DOSSIER, variante: VARIANTE_DOSSIER_COMMENCE },
  ],
  [
    "vidéo — A1",
    "lead-apporteur-recu",
    { contactName: "Camille", dossierUrl: DOSSIER, variante: VARIANTE_VSL_ABANDON },
  ],
  [
    "vidéo — B1",
    "lead-apporteur-recu",
    {
      contactName: "Camille",
      dossierUrl: DOSSIER,
      calendlyUrl: CALENDLY,
      variante: VARIANTE_VSL_ETAPE2,
    },
  ],
  [
    "vidéo — A2",
    "lead-apporteur-relance",
    { contactName: "Camille", dossierUrl: DOSSIER, etape: "j2", variante: VARIANTE_VSL_RELANCE },
  ],
  [
    "vidéo — A3",
    "lead-apporteur-relance",
    { contactName: "Camille", dossierUrl: DOSSIER, etape: "j7", variante: VARIANTE_VSL_RELANCE },
  ],
];

beforeAll(() => {
  process.env["AUTH_SECRET"] = "secret-de-test-suffisamment-long-0123456789";
});

describe("aucune rareté dans le rendu des e-mails apporteur", () => {
  for (const [nom, id, payload] of RENDUS) {
    for (const locale of ["fr", "en"] as const) {
      it(`${nom} (${locale})`, async () => {
        const r = await renderEmailTemplate(id as never, locale, payload, {
          destinataire: "camille@exemple.fr",
        });
        expect(r.subject).not.toMatch(RARETE);
        expect(r.html).not.toMatch(RARETE);
        expect(r.html).not.toMatch(/slots are limited|limited (?:slots|places)/i);
      });
    }
  }
});

describe("aucune rareté dans les sources du tunnel", () => {
  const racine = process.cwd();
  const gabarits = join(racine, "src/lib/email/templates");
  const fichiers = [
    ...readdirSync(gabarits)
      .filter((f) => /apporteur/.test(f) && /\.tsx?$/.test(f))
      .map((f) => join(gabarits, f)),
    join(racine, "src/app/[locale]/apporteur-affaires/video/page.tsx"),
    join(racine, "src/app/[locale]/apporteur-affaires/video/merci/page.tsx"),
    join(racine, "src/content/recrutement/vsl-apporteur.ts"),
    join(racine, "src/content/recrutement/vsl-apporteur-merci.ts"),
  ];
  it.each(fichiers.map((f) => [f.slice(racine.length + 1), f]))("%s", (_nom, f) => {
    const src = readFileSync(f, "utf8");
    expect(src).not.toMatch(/cr[ée]neaux sont limit|places? limit|slots are limited/i);
  });
});
