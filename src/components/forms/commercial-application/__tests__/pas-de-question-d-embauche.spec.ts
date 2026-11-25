/**
 * Plan « sept points salariat », lot L5b (D5 = oui) — verrou du formulaire.
 *
 * Le texte rendu du formulaire ne pose plus de question d'embauche : naissance,
 * nationalité, zone, déplacements, disponibilité, parcours sur dix ans.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { COMMERCIAL_APPLICATION_STORAGE_KEY } from "@/lib/commercial-application/model";
import {
  buildSubmissionPayload,
  emptyAnswers,
  loadDraft,
  validateStep,
  type WizardAnswers,
} from "../wizard-state";

const DOSSIER = path.resolve(__dirname, "..");
const lire = (f: string) =>
  readFileSync(path.join(DOSSIER, f), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

describe("le texte rendu ne pose plus de question d'embauche", () => {
  const rendu = lire("steps.tsx") + lire("CommercialApplicationWizard.tsx");
  for (const re of [
    /Date de naissance/i,
    /Nationalité/i,
    /déplacer/i,
    /disponible/i,
    /zone souhaitez-vous travailler/i,
    /10 dernières années/i,
    /dix dernières années/i,
  ]) {
    it(`ne contient pas ${re}`, () => {
      expect(rendu).not.toMatch(re);
    });
  }
});

function complet(): WizardAnswers {
  return {
    ...emptyAnswers(),
    prenom: "Jean",
    nom: "Dupont",
    email: "jean@example.com",
    telephone: "0600000000",
    ville: "Lyon",
    codePostal: "69001",
    consent: true,
    b2bDejaVendu: false,
    iaUtilise: false,
    informatiqueUtilise: false,
    pitch: "x".repeat(150),
  };
}

describe("validation et charge utile", () => {
  it("le dernier écran ne demande plus de disponibilité", () => {
    const n = 7; // 7 écrans : identité, B2B, IA, outils, pitch, message, détails
    expect(validateStep(n, complet())).toEqual({});
  });

  it("aucun écran ne bloque sur zone, déplacement, parcours ni naissance", () => {
    for (let s = 1; s <= 7; s++) expect(validateStep(s, complet()), `écran ${s}`).toEqual({});
  });

  it("la charge utile n'envoie plus ces champs", () => {
    const p = buildSubmissionPayload(complet()) as Record<string, unknown>;
    for (const k of [
      "dateNaissance",
      "nationalite",
      "experiences",
      "zoneMobile",
      "zones",
      "deplacement",
      "disponibilite",
    ])
      expect(p, k).not.toHaveProperty(k);
  });
});

describe("brouillon d'avant le retrait", () => {
  it("écarte les champs retirés et ramène l'écran sur le nouveau parcours", () => {
    const store: Record<string, string> = {};
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => void (store[k] = v),
        removeItem: (k: string) => void delete store[k],
      },
    };
    const vieux = { ...complet(), nationalite: "X", deplacement: "oui", zones: ["Isère (38)"] };
    // écran 9 de l'ancien parcours = « derniers détails » = nouvel écran 7
    window.localStorage.setItem(
      COMMERCIAL_APPLICATION_STORAGE_KEY,
      JSON.stringify({ v: 1, screen: 9, answers: vieux }),
    );
    const d = loadDraft();
    expect(d).not.toBeNull();
    expect(d!.screen).toBe(7);
    for (const k of ["nationalite", "deplacement", "zones", "experiences"])
      expect(d!.answers).not.toHaveProperty(k);
  });
});
