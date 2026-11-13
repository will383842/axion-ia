// @vitest-environment node
// @req REQ-SEC-037
// @req REQ-JUR-028
/**
 * INT-T52-A — le code de parrainage capté par le tunnel de candidature, jusqu'à
 * `candidature.recue.parrainCodeCapture`.
 *
 *   · la FORME : celle de SEC-21 (`AX` puis six caractères Crockford), canonique ; un code mal formé
 *     est ignoré, jamais une erreur ;
 *   · la TRANSMISSION : un code n'est rangé dans la fiche que si le limiteur l'admet sans panne ;
 *     la candidature, elle, part toujours (décision de la coordination, rattrapage 44) ;
 *   · le TRANSPORT (rattrapage 94) : le code est posé sur la fiche qui le reçoit, recopié côté
 *     serveur du premier contact au dossier complet, et relu au clic « prêt à signer » ;
 *   · aucun stockage local ni cookie persistant (SEC-21, REQ-JUR-028).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  CAPTURES_DE_PARRAINAGE,
  CLE_DU_CODE_DE_PARRAINAGE,
  codeDeParrainageCapte,
  codeDeParrainageDeLaFiche,
  codeDeParrainageTransmis,
  codeDuDossierComplet,
} from "@/lib/commercial-application/parrainage";
import { EXEMPTIONS_NOMMEES } from "@/server/partners/frontiere";
import { payloadCandidatureRecue } from "@/server/partners/payloads";

const CODE = "AX4D2K9P";

describe("REQ-SEC-037 — la forme du code capté", () => {
  it("REQ-SEC-037 : TÉMOIN — un code de SEC-21 passe, sous sa forme canonique", () => {
    expect(codeDeParrainageCapte(CODE)).toBe(CODE);
    expect(codeDeParrainageCapte("  ax4d2k9p ")).toBe(CODE);
  });

  it("REQ-SEC-037 : TÉMOIN — tout le reste est ignoré, sans erreur : aucun oracle", () => {
    for (const hors of [
      "AXI-PARR-7781",
      "AX4D2K9",
      "AX4D2K9PQ",
      "AXIL0OU1",
      "BX4D2K9P",
      "jean@exemple.invalid",
      "",
      123,
      null,
      undefined,
      { code: CODE },
    ])
      expect(codeDeParrainageCapte(hors), String(hors)).toBeNull();
  });

  it("REQ-SEC-037 : un code canonique est celui que la frontière du contrat exempte (valeur de code, pas une identité)", () => {
    const exemption = EXEMPTIONS_NOMMEES.find((e) => e.feuille === "parrainCodeCapture");
    expect(exemption?.formeAttendue.test(CODE)).toBe(true);
  });
});

describe("REQ-SEC-037 — la transmission, après le limiteur", () => {
  it("REQ-SEC-037 : TÉMOIN — admis sans panne, le code part ; limité ou en panne, il ne part pas", () => {
    expect(codeDeParrainageTransmis(CODE, { allowed: true })).toBe(CODE);
    expect(codeDeParrainageTransmis(CODE, { allowed: false })).toBeNull();
    expect(codeDeParrainageTransmis(CODE, { allowed: true, panne: true })).toBeNull();
    expect(codeDeParrainageTransmis("AXI-PARR-7781", { allowed: true })).toBeNull();
  });

  it("REQ-SEC-037 : la limite des captures est une constante de la SSOT du tunnel, avec sa fenêtre et son alerte de panne", () => {
    expect(CAPTURES_DE_PARRAINAGE.limite).toBeGreaterThan(0);
    expect(CAPTURES_DE_PARRAINAGE.fenetreSecondes).toBe(3600);
    expect(CAPTURES_DE_PARRAINAGE.alertePanneSecondes).toBeGreaterThan(0);
  });
});

describe("REQ-SEC-037 — le transport, de la fiche à candidature.recue", () => {
  it("REQ-SEC-037 : TÉMOIN — le dossier complet garde son propre code, sinon reprend celui du premier contact", () => {
    expect(codeDuDossierComplet(CODE, "AX7Q8R2T")).toBe(CODE);
    expect(codeDuDossierComplet(null, "AX7Q8R2T")).toBe("AX7Q8R2T");
    expect(codeDuDossierComplet(null, null)).toBeNull();
    expect(codeDeParrainageDeLaFiche({ [CLE_DU_CODE_DE_PARRAINAGE]: " ax4d2k9p " })).toBe(CODE);
    expect(codeDeParrainageDeLaFiche({ [CLE_DU_CODE_DE_PARRAINAGE]: "Jean Dupont" })).toBeNull();
  });

  const fiche = (details: Record<string, unknown>) => ({
    id: "11111111-1111-4111-8111-111111111111",
    type: "contact" as const,
    submittedAt: new Date("2026-10-03T08:00:00.000Z"),
    details: {
      unifiedType: "recrutement",
      subType: "candidature-commerciale",
      score: 72,
      scoreParts: { carnet: 25, b2bAnnees: 25, statut: 12, typesClients: 10 },
      source: "/devenir-commercial-ia/candidature",
      candidature: { version: 1, ville: "Grenoble" },
      ...details,
    },
  });

  it("REQ-SEC-037 : TÉMOIN À DEUX FACES — une fiche avec un code émet le code ; sans code, ou avec une valeur hors forme, elle émet null", () => {
    expect(
      payloadCandidatureRecue({ submission: fiche({ [CLE_DU_CODE_DE_PARRAINAGE]: CODE }) })
        .parrainCodeCapture,
    ).toBe(CODE);
    expect(payloadCandidatureRecue({ submission: fiche({}) }).parrainCodeCapture).toBeNull();
    expect(
      payloadCandidatureRecue({
        submission: fiche({ [CLE_DU_CODE_DE_PARRAINAGE]: "jean@exemple.invalid" }),
      }).parrainCodeCapture,
    ).toBeNull();
  });
});

describe("REQ-JUR-028 — aucun stockage local, aucun cookie persistant", () => {
  it("REQ-JUR-028 : TÉMOIN — le formulaire court lit le code dans l'URL à l'envoi, et ne l'écrit dans aucun stockage", () => {
    const source = readFileSync("src/components/recrutement/LeadApporteurForm.tsx", "utf8");
    expect(source).toMatch(/window\.location\.search/);
    expect(source).toContain("CLE_DU_CODE_DE_PARRAINAGE");
    for (const ligne of source.split("\n"))
      expect(ligne, ligne).not.toMatch(
        /(localStorage|sessionStorage|document\.cookie|indexedDB)[^\n]*(parrain|CLE_DU_CODE)/i,
      );
  });
});
