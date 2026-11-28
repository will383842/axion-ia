// Encadré « Signatures » en page 1 du contrat PDF : mise en page seulement, l'empreinte du
// texte signé ne bouge pas.

import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  LIGNE_PREUVE_SIGNATURE,
  empreinte,
  lignesSignatures,
  rendreContratPdf,
  texteDuContrat,
  type SignatureApporteur,
  type SignatureSociete,
} from "../contrat-pdf";

const apporteur: SignatureApporteur = {
  nomTape: "Claire Martin",
  signeAt: "3 novembre 2026 à 10:12",
  ipHash: "abc123",
  navigateur: "Firefox",
  acceptations: [],
  declarations: [],
};
const societe: SignatureSociete = { nom: "Jean Dupont", signeAt: "4 novembre 2026 à 09:00" };

const texte = "## Contrat\n\nUn texte signé.";

describe("encadré « Signatures » (page 1)", () => {
  it("contrat vierge : aucune ligne, donc pas d'encadré", () => {
    expect(lignesSignatures(null, null)).toEqual([]);
  });

  it("signé par l'apporteur seul : signature + attente de contresignature", () => {
    expect(lignesSignatures(apporteur, null)).toEqual([
      "Signé électroniquement par l'Apporteur, Claire Martin, le 3 novembre 2026 à 10:12.",
      "En attente de la contresignature d'AXION IA SAS.",
    ]);
  });

  it("signé des deux : signature + contresignature, contrat conclu", () => {
    expect(lignesSignatures(apporteur, societe)).toEqual([
      "Signé électroniquement par l'Apporteur, Claire Martin, le 3 novembre 2026 à 10:12.",
      "Contresigné électroniquement pour AXION IA SAS par Jean Dupont, Président, le 4 novembre 2026 à 09:00. Le contrat est conclu à cette date.",
    ]);
  });

  it("la ligne de preuve renvoie au certificat", () => {
    expect(LIGNE_PREUVE_SIGNATURE).toContain("certificat en dernière page");
  });

  it("les trois cas rendent un PDF ; l'encadré l'alourdit, le vierge n'en a pas", async () => {
    const vierge = await rendreContratPdf({ texte, apporteur: null, societe: null });
    const seul = await rendreContratPdf({ texte, apporteur, societe: null });
    const deux = await rendreContratPdf({ texte, apporteur, societe });
    for (const b of [vierge, seul, deux]) expect(b.subarray(0, 5).toString()).toBe("%PDF-");
    expect(seul.length).toBeGreaterThan(vierge.length);
    expect(deux.length).toBeGreaterThan(vierge.length);
  });

  it("l'empreinte du texte est inchangée (SHA-256 du texte brut)", () => {
    const t = texteDuContrat({
      identite: "Claire Martin",
      statutJuridique: "micro_entrepreneur",
      siren: "123456789",
      siege: "1 rue Exemple, 38000 Grenoble",
      qualite: "apporteur",
      grilleDate: "1er janvier 2026",
    });
    expect(empreinte(t)).toBe(createHash("sha256").update(t, "utf8").digest("hex"));
    expect(empreinte("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
