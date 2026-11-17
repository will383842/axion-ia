/**
 * Garde-fou (fiche L10, décision du fondateur du 17/11/2026) : pour le moment, aucun e-mail ne
 * parle de la certification qualité, d'un OPCO, d'une prise en charge ni d'un financeur.
 * On lit le texte RENDU (objet, texte, HTML), pas les constantes du gabarit.
 *
 * Et l'accord grammatical : le libellé de la pièce n'a ni le même genre ni d'article
 * (« devis », « convention de formation »), donc jamais « Devis … signée ».
 */
import { describe, expect, it } from "vitest";
import { renderEmailTemplate } from "./index";
import {
  TYPES_SIGNABLES,
  circuitPour,
} from "@/server/qualiopi/documents/signature/parties-requises";

const INTERDIT = /financeur|funding|opco|qualiopi|prise en charge|funding body/i;
const LIBELLES = TYPES_SIGNABLES.map((t) => circuitPour(t)?.libelle ?? "");

describe("piece-exemplaire-signe — rien sur le financement, pour chaque pièce", () => {
  it("couvre au moins un libellé", () => {
    expect(LIBELLES.length).toBeGreaterThan(5);
  });

  for (const locale of ["fr", "en"] as const) {
    for (const libelle of LIBELLES) {
      for (const partielle of [false, true]) {
        it(`${locale} · ${libelle} · ${partielle ? "partielle" : "complète"}`, async () => {
          const r = await renderEmailTemplate("piece-exemplaire-signe", locale, {
            numero: "AXI-DOC-2026-039",
            libellePiece: libelle,
            signataires: ["Camille Dupont"],
            ...(partielle ? { partielle: true } : {}),
          });
          for (const texte of [r.subject, r.text, r.html]) expect(texte).not.toMatch(INTERDIT);
          expect(r.text).not.toMatch(/^\s*(devis|convention|contrat|procuration)\b[^.]*\bsignée/im);
          if (locale === "fr" && !partielle) {
            expect(r.text).toMatch(/La pièce .*AXI-DOC-2026-039 est désormais signée/);
          }
          if (partielle) {
            // Jamais laisser croire que l'accord est conclu.
            expect(r.text).not.toMatch(/désormais signée|now been signed|fait foi|evidences/i);
          }
        });
      }
    }
  }

  it("un devis : le numéro du devis, pas doublé", async () => {
    const r = await renderEmailTemplate("piece-exemplaire-signe", "fr", {
      numero: "AXI-DOC-2026-053",
      numeroDevis: "AXI-DEV-2026-001",
      libellePiece: "devis",
    });
    expect(r.text).toContain("La pièce devis AXI-DEV-2026-001 est désormais signée");
  });

  it("ancien payload sans libellé : la phrase tient encore", async () => {
    const r = await renderEmailTemplate("piece-exemplaire-signe", "fr", { numero: "AXI-DOC-1" });
    expect(r.text).toContain("La pièce AXI-DOC-1 est désormais signée");
  });
});
