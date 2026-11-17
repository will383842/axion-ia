/**
 * Alignement écran → serveur : le bloc de saisie du financement a disparu (PR 2050), mais un
 * ancien brouillon peut encore porter ses valeurs. Le serveur refusait la valeur brute d'une
 * enveloppe illisible sur un champ que plus aucun écran n'affiche. Règle commune avec
 * `vers-offre.ts` : illisible = non envoyé ; lisible = envoyé tel quel.
 */
import { describe, expect, it } from "vitest";

import { payloadVersCreation } from "@/server/qualiopi/devis/assistant/conversion";

import { etatT4 } from "./fixtures";
import { etatVersPayload } from "./vers-payload";
import type { EtatAssistant } from "./types";

const TVA = 20;
const CTX = { tvaStandardPct: TVA, textes: [] };
const SERVEUR = {
  formulesActives: true,
  typeClient: "entreprise" as const,
  maintenant: new Date("2026-11-08T10:00:00Z"),
  tauxStandard: TVA,
};

const avecFinancement = (patch: Partial<EtatAssistant["financement"]>): EtatAssistant => {
  const e = etatT4();
  return { ...e, financement: { ...e.financement, ...patch } };
};

describe("ancien brouillon (financement) → payload → serveur", () => {
  it("(a) enveloppe illisible : acceptée par le serveur, sans enveloppe", () => {
    const e = avecFinancement({ mode: "opco", enveloppeRestante: "beaucoup" });
    const p = etatVersPayload(e, 4, CTX);
    expect(p.opco.enveloppeRestanteEur).toBeUndefined();
    const r = payloadVersCreation(p, SERVEUR);
    expect("erreurs" in r).toBe(false);
    if ("erreurs" in r || r.type !== "classique") throw new Error("classique attendu");
    expect(r.input.opcoEnveloppeRestanteCents).toBeUndefined();
  });

  it("(a bis) participants et durée illisibles : non envoyés, acceptés par le serveur", () => {
    const e = avecFinancement({ mode: "opco", nbParticipants: "0", dureeHeures: "abc" });
    const p = etatVersPayload(e, 4, CTX);
    expect(p.opco.nbParticipants).toBeUndefined();
    expect(p.opco.dureeHeures).toBeUndefined();
    expect("erreurs" in payloadVersCreation(p, SERVEUR)).toBe(false);
  });

  it("(b) valeurs lisibles : transmises à l'identique", () => {
    const e = avecFinancement({
      mode: "opco",
      nbParticipants: "6",
      dureeHeures: "14",
      modaliteOpco: "inter_presentiel",
      enveloppeRestante: "1 500,50",
      dateDebutSession: "2027-02-01",
    });
    const p = etatVersPayload(e, 4, CTX);
    expect(p.opco).toEqual({
      financementSuggere: "opco",
      nbParticipants: "6",
      dureeHeures: "14",
      modaliteOpco: "inter_presentiel",
      enveloppeRestanteEur: "1 500,50",
      dateDebutSessionPrevue: "2027-02-01",
    });
    const r = payloadVersCreation(p, SERVEUR);
    if ("erreurs" in r || r.type !== "classique") throw new Error("classique attendu");
    expect(r.input.opcoEnveloppeRestanteCents).toBe(150050);
    expect(r.input.nbParticipants).toBe(6);
    expect(r.input.dureeHeures).toBe(14);
  });

  it("(c) brouillon neuf : aucun champ de tiers payeur", () => {
    const p = etatVersPayload(etatT4(), 4, CTX);
    expect(p.opco).toEqual({});
    const r = payloadVersCreation(p, SERVEUR);
    if ("erreurs" in r || r.type !== "classique") throw new Error("classique attendu");
    expect(r.input.financementSuggere).toBeUndefined();
    expect(r.input.opcoEnveloppeRestanteCents).toBeUndefined();
  });
});
