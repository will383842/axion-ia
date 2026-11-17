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
import { readFileSync } from "node:fs";
import { join } from "node:path";

const INTERDIT = /financeur|funding|opco|qualiopi|prise en charge|funding body/i;
// Lu dans la source (pas importé : le cloisonnement interdit d'importer le domaine ici).
const LIBELLES = [
  ...readFileSync(
    join(process.cwd(), "src/server/qualiopi/documents/signature/parties-requises.ts"),
    "utf8",
  ).matchAll(/\blibelle:\s*"([^"]+)"/g),
].map((m) => m[1] as string);

describe("piece-exemplaire-signe — rien sur le financement, pour chaque pièce", () => {
  it("couvre tous les libellés, dont « devis » (déclaré sur une seule ligne)", () => {
    expect(LIBELLES).toContain("devis");
    expect(LIBELLES.length).toBeGreaterThanOrEqual(10);
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

  for (const partielle of [false, true]) {
    it(`libellé générique « la pièce » : jamais « pièce pièce » (${partielle ? "partielle" : "complète"})`, async () => {
      const r = await renderEmailTemplate("piece-exemplaire-signe", "fr", {
        numero: "AXI-DOC-1",
        libellePiece: "la pièce",
        ...(partielle ? { partielle: true } : {}),
      });
      expect(r.text).not.toMatch(/pièce\s+pièce/i);
      expect(r.text).toContain(
        partielle ? "sur la pièce AXI-DOC-1 est bien" : "La pièce AXI-DOC-1 est désormais signée",
      );
    });
  }

  for (const libelle of LIBELLES) {
    for (const partielle of [false, true]) {
      it(`anglais · ${libelle} · ${partielle ? "partielle" : "complète"} : aucun libellé français`, async () => {
        const r = await renderEmailTemplate("piece-exemplaire-signe", "en", {
          numero: "AXI-DOC-1",
          libellePiece: libelle,
          ...(partielle ? { partielle: true } : {}),
        });
        expect(r.text).toContain(`document AXI-DOC-1 `);
        expect(r.text).not.toContain(libelle);
        // Le gabarit d'enveloppe peut porter des accents : on lit le corps du message.
        const corps = r.text
          .split("\n")
          .filter((l) => l.includes("AXI-DOC-1"))
          .join("\n");
        expect(corps).toMatch(/document AXI-DOC-1/);
        expect(corps).not.toMatch(/[àâçéèêëîïôûùü]/i);
      });
    }
  }

  it("ancien payload sans libellé : la phrase tient encore", async () => {
    const r = await renderEmailTemplate("piece-exemplaire-signe", "fr", { numero: "AXI-DOC-1" });
    expect(r.text).toContain("La pièce AXI-DOC-1 est désormais signée");
  });
});
