// Le PDF du registre (art. 30) n'emporte JAMAIS les points à corriger.
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/qualiopi/documents/fonts", () => ({ registerQualiopiPdfFonts: () => {} }));

import type { TraitementBase } from "../base";
import { activitesPourPdf } from "../registre-pdf";
import { validerRegistre } from "../schema";
import { registreFictif } from "./fixtures";

describe("PDF du registre", () => {
  it("ne transmet aucun écart au gabarit", () => {
    const r = validerRegistre(registreFictif);
    if (!r.ok) throw new Error(r.erreur);
    const activites = activitesPourPdf(r.registre);
    expect(activites).toHaveLength(3);
    for (const a of activites) expect(a).not.toHaveProperty("ecarts");
    expect(JSON.stringify(activites)).not.toContain("Constat");
  });

  it("lu depuis la base : ni écart, ni identifiant interne, ni statut", () => {
    const t: TraitementBase = {
      uuid: "00000000-0000-4000-8000-000000000001",
      id: "activite-a",
      nom: "Activité A",
      statut: "actif",
      personnes: [],
      donnees: [],
      finalite: "Finalité fictive",
      baseLegale: null,
      conservationAnnoncee: null,
      conservationReelle: null,
      destinataires: [],
      securite: null,
      droits: null,
      ecarts: [
        {
          id: "00000000-0000-4000-8000-000000000002",
          code: "A-1",
          gravite: "critique",
          constat: "Constat fictif",
          correction: "Correction fictive",
          statut: "ouvert",
          corrigeLe: null,
          corrigeParNom: null,
          note: "Note fictive",
        },
      ],
    };
    const [a] = activitesPourPdf({ traitements: [t] });
    expect(a).not.toHaveProperty("ecarts");
    expect(a).not.toHaveProperty("uuid");
    expect(a).not.toHaveProperty("statut");
    expect(a?.finalite).toBe("Finalité fictive");
    expect(JSON.stringify(a)).not.toMatch(/Constat|Correction|Note|A-1/);
  });
});
