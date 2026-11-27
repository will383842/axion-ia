// @vitest-environment node

/**
 * Devis v5 — bloc « Conditions particulières » (devis classique).
 * Titre + texte + phrase de primauté, AVANT le renvoi aux Conditions générales ; sécable
 * (un texte de 4000 caractères passe sur deux pages sans rien perdre) ; sans le champ, le
 * rendu est celui d'avant.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { beforeAll, describe, expect, it } from "vitest";
import { DevisPdf, type DevisData } from "./devis";
import { renderPdfToBuffer } from "@/server/qualiopi/documents/render";
import { registerPdfTestFontsFallback } from "@/server/qualiopi/documents/register-pdf-test-fonts";
import { collectPdfTextNormalized } from "../collect-pdf-text";
import type { OrganismeIdentite } from "../organisme";

beforeAll(() => {
  registerPdfTestFontsFallback();
});

const IDENTITE: OrganismeIdentite = {
  raisonSociale: "Axion-IA SAS",
  nda: "84691234567",
  qualiopi: "",
  siret: "12345678901234",
  adresseSiege: "1 rue de la Paix, 75001 Paris",
  adresseExercice: "1 rue de la Paix, 75001 Paris",
  email: "contact@axion-ia.fr",
  telephone: "+33 1 00 00 00 00",
  site: "https://www.axion-ia.fr",
};

function devis(extra: Partial<DevisData> = {}): DevisData {
  return {
    numero: "AXI-DEV-2026-001",
    dateEmission: "06/06/2026",
    dateValidite: "06/07/2026",
    identite: IDENTITE,
    client: { raisonSociale: "Acme SAS", siret: "98765432100011", adresse: "10 avenue des Champs" },
    lignes: [{ designation: "Atelier IA", quantite: 1, prixUnitaireHtCents: 280000 }],
    regimeTva: "assujetti",
    ...extra,
  };
}

/** Phrase de test : le gabarit l'imprime depuis la DONNÉE, jamais depuis une constante. */
const PHRASE_PRIMAUTE_CONDITIONS_PARTICULIERES =
  "Phrase de primauté de test, figée dans la photo de la pièce.";

const texte = (d: DevisData) =>
  collectPdfTextNormalized(React.createElement(DevisPdf, { data: d }));

describe("DevisPdf — conditions particulières", () => {
  const CP = "Acompte de 30 % à la commande.\n\nSolde à 30 jours fin de mois.";
  const t = texte(
    devis({
      conditionsParticulieres: CP,
      phrasePrimaute: PHRASE_PRIMAUTE_CONDITIONS_PARTICULIERES,
    }),
  );

  it("imprime le titre, chaque paragraphe puis la phrase de primauté", () => {
    expect(t).toContain("Conditions particulières");
    expect(t).toContain("Acompte de 30 % à la commande.");
    expect(t).toContain("Solde à 30 jours fin de mois.");
    expect(t).toContain(PHRASE_PRIMAUTE_CONDITIONS_PARTICULIERES);
    expect(t.indexOf("Acompte de 30 %")).toBeLessThan(t.indexOf("Solde à 30 jours"));
    expect(t.indexOf("Solde à 30 jours")).toBeLessThan(
      t.indexOf(PHRASE_PRIMAUTE_CONDITIONS_PARTICULIERES),
    );
  });

  it("le bloc est AVANT « Conditions du devis » et donc avant le renvoi aux CGV", () => {
    const phrase = t.indexOf(PHRASE_PRIMAUTE_CONDITIONS_PARTICULIERES);
    const conditions = t.indexOf("Conditions du devis");
    const cgv = t.indexOf("Conditions générales de vente", conditions);
    expect(phrase).toBeGreaterThan(-1);
    expect(conditions).toBeGreaterThan(phrase);
    expect(cgv).toBeGreaterThan(phrase);
  });

  it("le « Bon pour accord » mentionne les conditions particulières", () => {
    expect(t).toContain(
      "taux de TVA et totaux ci-dessus, les conditions particulières ainsi que les Conditions générales de vente",
    );
  });

  it("phrase absente, nulle ou blanche : le bloc est imprimé SANS phrase de primauté", () => {
    for (const phrasePrimaute of [undefined, null, "  "]) {
      const sans = texte(devis({ conditionsParticulieres: CP, phrasePrimaute }));
      expect(sans, String(phrasePrimaute)).toContain("Conditions particulières");
      expect(sans).toContain("Acompte de 30 % à la commande.");
      expect(sans).not.toContain("primauté");
      expect(sans).not.toContain("dérogent");
    }
  });

  it("la phrase n'est jamais imprimée sans conditions particulières", () => {
    const sans = texte(devis({ phrasePrimaute: PHRASE_PRIMAUTE_CONDITIONS_PARTICULIERES }));
    expect(sans).not.toContain(PHRASE_PRIMAUTE_CONDITIONS_PARTICULIERES);
  });

  it("le gabarit n'importe plus la constante de la phrase", () => {
    const source = readFileSync(
      join(process.cwd(), "src/server/qualiopi/documents/templates/devis.tsx"),
      "utf8",
    );
    expect(source).not.toContain("PHRASE_PRIMAUTE_CONDITIONS_PARTICULIERES");
  });

  it("sans le champ : aucun bloc, texte du « Bon pour accord » inchangé", () => {
    const sans = texte(devis());
    expect(sans).not.toContain("Conditions particulières");
    expect(sans).not.toContain(PHRASE_PRIMAUTE_CONDITIONS_PARTICULIERES);
    expect(sans).toContain(
      "taux de TVA et totaux ci-dessus, ainsi que les Conditions générales de vente",
    );
  });

  it("chaîne vide : traité comme absent", () => {
    expect(texte(devis({ conditionsParticulieres: "" }))).not.toContain("Conditions particulières");
  });

  it("le bloc n'est pas dans un cadre insécable (EncadreDoux, Carte insecable)", () => {
    const source = readFileSync(
      join(process.cwd(), "src/server/qualiopi/documents/templates/devis.tsx"),
      "utf8",
    );
    const debut = source.indexOf("styles.cpTitre");
    expect(debut).toBeGreaterThan(0);
    const fin = source.indexOf('titre="Conditions du devis"', debut);
    expect(fin).toBeGreaterThan(debut);
    const bloc = source.slice(
      source.lastIndexOf("styles.cpBox", debut),
      source.lastIndexOf("<EncadreDoux", fin),
    );
    expect(bloc).not.toContain("EncadreDoux");
    expect(bloc).not.toContain("insecable");
    expect(bloc).not.toContain("wrap={false}");
    expect(bloc).toContain("minPresenceAhead");
  });

  it("4000 caractères : le PDF se rend sur plus d'une page, sans rien perdre", async () => {
    const paragraphes = Array.from({ length: 40 }, (_, i) =>
      `Clause ${String(i + 1).padStart(2, "0")} ${"mot ".repeat(21)}`.trim(),
    );
    const long = paragraphes.join("\n\n").padEnd(4000, " fin").slice(0, 4000);
    expect(long.length).toBe(4000);
    const d = devis({
      conditionsParticulieres: long,
      phrasePrimaute: PHRASE_PRIMAUTE_CONDITIONS_PARTICULIERES,
    });
    const { buffer } = await renderPdfToBuffer(React.createElement(DevisPdf, { data: d }));
    const { getDocumentProxy, extractText } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    expect(pdf.numPages).toBeGreaterThanOrEqual(2);
    const { text } = await extractText(pdf, { mergePages: true });
    const rendu = text.replace(/\s+/g, " ");
    expect(rendu).toContain("Clause 01");
    expect(rendu).toContain("Clause 40".slice(0, 9));
    expect(rendu).toContain(PHRASE_PRIMAUTE_CONDITIONS_PARTICULIERES.slice(0, 60));
    expect(rendu).toContain("Bon pour accord");
  }, 60_000);
});
