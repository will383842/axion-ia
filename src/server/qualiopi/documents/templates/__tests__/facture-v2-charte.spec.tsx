// @vitest-environment node

/**
 * Facture v2 (charte 2027) — mise en page nouvelle, SANS rien changer de ce qui engage :
 * montants HT / TVA / TTC, intitulés et mentions légales sont ceux de la v1 archivée.
 *
 * Compare la v2 courante à la v1 archivée (`archives/facture.v1.tsx`) sur sept factures types
 * (voir `facture-cas.spec-util.ts`) : une ligne, plusieurs taux de TVA, remise, avoir,
 * exonération avec subrogation, particulier, arrondi limite. La facture n'a ni acompte ni solde.
 */

import React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/r2-storage", () => ({
  getSignedUrlR2: vi.fn(),
  isR2Configured: () => false,
  uploadToR2: vi.fn(),
}));

import { collectPdfTextNormalized } from "../../collect-pdf-text";
import { formatEurosFromCents } from "../../base-layout";
import { FacturePdf, type FactureData } from "../facture";
import { FacturePdf as FacturePdfV1 } from "../archives/facture.v1";
import { LEGAL_MENTIONS } from "@/server/qualiopi/legal/legal-mentions";
import { computeTotauxFacture, mentionTva } from "@/server/qualiopi/legal/tva";
import { versionGabaritCourante, typeGabarit } from "../gabarit-versions";
import { CAS_FACTURE } from "./facture-cas.spec-util";

const v2 = (d: FactureData) =>
  collectPdfTextNormalized(React.createElement(FacturePdf, { data: d }));
const v1 = (d: FactureData) =>
  collectPdfTextNormalized(React.createElement(FacturePdfV1, { data: d }));

/** Tous les montants en euros d'un texte, triés (multi-ensemble). */
const eur = (c: number): string => formatEurosFromCents(c).replace(/\s+/g, " ");
const montants = (t: string): string[] =>
  (t.match(/-?\d[\d\s]*,\d{2}\s*€/g) ?? []).map((m) => m.replace(/\s+/g, "")).sort();

/** Mots d'un texte, triés (multi-ensemble) ; le taux « 5.5 » de la v1 s'écrit « 5,5 » en v2. */
const mots = (t: string): string[] => t.split(" ").filter(Boolean).sort();

/** Différence de multi-ensembles a \ b. */
function moins(a: string[], b: string[]): string[] {
  const reste = new Map<string, number>();
  for (const x of b) reste.set(x, (reste.get(x) ?? 0) + 1);
  const out: string[] = [];
  for (const x of a) {
    const n = reste.get(x) ?? 0;
    if (n > 0) reste.set(x, n - 1);
    else out.push(x);
  }
  return out;
}

describe("v2 — chaque montant HT, TVA et TTC est celui de la v1", () => {
  for (const [nom, data] of CAS_FACTURE) {
    it(`${nom} : mêmes montants, mêmes occurrences`, () => {
      const a = montants(v1(data));
      const b = montants(v2(data));
      expect(a.length).toBeGreaterThan(3);
      expect(b).toEqual(a);
    });

    it(`${nom} : HT, chaque TVA et TTC calculés par la source de vérité figurent au PDF`, () => {
      const taux = data.tauxTvaStandardPercent ?? 20;
      const t = computeTotauxFacture(data.lignes, data.regimeTva, taux);
      for (const texte of [v1(data), v2(data)]) {
        expect(texte).toContain(`Total HT ${eur(t.totalHtCents)}`);
        expect(texte).toContain(`Total TTC ${eur(t.totalTtcCents)}`);
        for (const v of t.ventilation) {
          expect(texte).toContain(eur(v.montantTvaCents));
        }
      }
    });
  }

  it("valeurs attendues, calculées à la main : 2 800,00 € HT, 560,00 € de TVA, 3 360,00 € TTC", () => {
    const t = v2(CAS_FACTURE[0]![1]);
    expect(t).toContain("Total HT 2 800,00 €");
    expect(t).toContain("TVA (20 %) 560,00 €");
    expect(t).toContain("Total TTC 3 360,00 €");
    // 1 000 + 150 + 40 = 1 190 HT ; TVA 200 + 8,25 + 4 ; (5 % de 150 = 8,25 à 5,5 %).
    const p = v2(CAS_FACTURE[1]![1]);
    expect(p).toContain("TVA 20 % (base 1 000,00 €)");
    expect(p).toContain("TVA 5,5 % (base 150,00 €)");
    expect(p).toContain("TVA 10 % (base 40,00 €)");
    expect(p).toContain("Total HT 1 190,00 €");
    // remise : 2 × 900 − 180 = 1 620 HT ; TVA 324 ; TTC 1 944.
    const r = v2(CAS_FACTURE[2]![1]);
    expect(r).toContain("Total HT 1 620,00 €");
    expect(r).toContain("Total TTC 1 944,00 €");
    // avoir : −1 400 HT ; TVA −280 ; TTC −1 680.
    const a = v2(CAS_FACTURE[3]![1]);
    expect(a).toContain("Total HT -1 400,00 €");
    expect(a).toContain("Total TTC -1 680,00 €");
    // exonération : 3 × 1 200 = 3 600, HT = TTC.
    const e = v2(CAS_FACTURE[4]![1]);
    expect(e).toContain("Total HT 3 600,00 €");
    expect(e).toContain("Total TTC 3 600,00 €");
    // arrondi : 3 × 3,33 = 9,99 HT ; TVA 2,00 ; TTC 11,99.
    const o = v2(CAS_FACTURE[6]![1]);
    expect(o).toContain("Total HT 9,99 €");
    expect(o).toContain("Total TTC 11,99 €");
  });
});

describe("v2 — aucun texte ne change (à l'espace près)", () => {
  for (const [nom, data] of CAS_FACTURE) {
    it(`${nom} : tout mot de la v1 est en v2, hors l'en-tête dédoublé de la v1`, () => {
      const perdus = moins(mots(v1(data)), mots(v2(data)));
      // La v1 répétait, sous le nom de l'organisme, l'adresse et les identifiants (déjà portés
      // par le pied de page, conservé tel quel) : ces seuls mots sont en double dans la v1.
      const entete = mots(
        [
          data.identite.adresseSiege,
          `SIRET ${data.identite.siret}`,
          `NDA ${data.identite.nda}`,
          data.identite.email,
          data.identite.telephone,
          data.identite.site,
          "·",
        ].join(" "),
      );
      // Le taux décimal « 5.5 » de la v1 s'écrit « 5,5 » en v2 (seul changement de texte voulu).
      expect(moins(moins(perdus, entete), ["5.5", "5.5"])).toEqual([]);
    });

    it(`${nom} : v2 n'ajoute que le taux à la française, les titres de page et le surtitre`, () => {
      const ajoutes = moins(mots(v2(data)), mots(v1(data)));
      const autorises = ["Facture", "Avoir", "Organisme", "de", "formation", "5,5", "5,5"];
      expect(moins(ajoutes, autorises)).toEqual([]);
    });
  }
});

describe("v2 — chaque mention légale est imprimée, mot pour mot", () => {
  it("entre professionnels : pénalités, indemnité de recouvrement, escompte", () => {
    for (const [nom, data] of CAS_FACTURE) {
      if (data.client.estPersonnePhysique === true) continue;
      for (const m of [
        LEGAL_MENTIONS.facturePenalitesRetard,
        LEGAL_MENTIONS.factureIndemniteRecouvrement,
        LEGAL_MENTIONS.factureEscompte,
      ]) {
        const attendu = m.replace(/\s+/g, " ").trim();
        expect(v1(data), `v1 ${nom}`).toContain(attendu);
        expect(v2(data), `v2 ${nom}`).toContain(attendu);
      }
    }
  });

  it("particulier : aucune des trois mentions, ni en v1 ni en v2", () => {
    const data = CAS_FACTURE[5]![1];
    for (const m of [
      LEGAL_MENTIONS.facturePenalitesRetard,
      LEGAL_MENTIONS.factureIndemniteRecouvrement,
      LEGAL_MENTIONS.factureEscompte,
    ]) {
      const attendu = m.replace(/\s+/g, " ").trim();
      expect(v1(data)).not.toContain(attendu);
      expect(v2(data)).not.toContain(attendu);
    }
  });

  it("exonération 261-4-4° : même mention de TVA, une seule fois, aucune TVA chiffrée à ajouter", () => {
    const data = CAS_FACTURE[4]![1];
    const mention = (mentionTva("exoneration_261") ?? "").replace(/\s+/g, " ");
    expect(mention).not.toBe("");
    expect(v1(data)).toContain(mention);
    expect(v2(data)).toContain(mention);
    expect(v2(data).split(mention).length).toBe(v1(data).split(mention).length);
  });

  it("franchise 293 B : même mention de TVA", () => {
    const data: FactureData = { ...CAS_FACTURE[0]![1], regimeTva: "franchise_293b" };
    const mention = (mentionTva("franchise_293b") ?? "").replace(/\s+/g, " ");
    expect(mention).not.toBe("");
    expect(v1(data)).toContain(mention);
    expect(v2(data)).toContain(mention);
    expect(montants(v2(data))).toEqual(montants(v1(data)));
  });

  it("subrogation OPCO, avoir, RIB : phrases et intitulés repris tels quels", () => {
    const sub = v2(CAS_FACTURE[4]![1]);
    expect(sub).toContain("Subrogation de paiement OPCO");
    expect(sub).toContain(
      "Facture libellée à l'OPCO OPCO Test dans le cadre de la subrogation de paiement — N° dossier : DOS-12345.",
    );
    const avoir = v2(CAS_FACTURE[3]![1]);
    for (const l of ["N° d'avoir", "Avoir sur facture", "Motif de la rectification"]) {
      expect(avoir, l).toContain(l);
    }
    const rib = v2(CAS_FACTURE[1]![1]);
    expect(rib).toContain("Coordonnées bancaires");
    expect(rib).toContain(
      "Merci de rappeler la référence « AXI-FACT-2026-015 » dans le libellé de votre virement.",
    );
  });
});

describe("v2 — numérotation et mentions d'identité inchangées", () => {
  it("le numéro figure à l'identique (en-tête, tuile, consigne de virement) et l'avoir reste un avoir", () => {
    for (const [nom, data] of CAS_FACTURE) {
      expect(v2(data).split(data.numero).length, nom).toBe(v1(data).split(data.numero).length);
    }
    expect(v2(CAS_FACTURE[3]![1])).toContain("Avoir N° AXI-AVOIR-2026-002");
    expect(v2(CAS_FACTURE[0]![1])).toContain("Facture N° AXI-FACT-2026-014");
  });

  it("SIRET, NDA, RCS, capital, TVA intracommunautaire : présents comme en v1", () => {
    const t = v2(CAS_FACTURE[0]![1]);
    for (const x of [
      "12345678901234",
      "84421234567",
      "Saint-Étienne 123456789",
      "10 000 €",
      "FR12123456789",
    ]) {
      expect(t, x).toContain(x);
    }
  });

  it("une identité incomplète reste visible : « Non renseigné », jamais masqué", () => {
    const data: FactureData = {
      ...CAS_FACTURE[0]![1],
      identite: { ...CAS_FACTURE[0]![1].identite, capitalSocial: null, tvaIntracom: null },
    } as FactureData;
    expect(v2(data).split("Non renseigné").length).toBe(v1(data).split("Non renseigné").length);
    expect(v2(data)).toContain("Non renseigné");
  });

  it("le taux de TVA s'écrit à la française : « 5,5 % », jamais « 5.5 % »", () => {
    const t = v2(CAS_FACTURE[1]![1]);
    expect(t).toContain("5,5 %");
    expect(t).not.toContain("5.5 %");
  });

  it("ESSAI : une pièce d'essai se signale ; COPIE et SPÉCIMEN se conservent", () => {
    const essai = v2({ ...CAS_FACTURE[0]![1], numero: "AXI-FACT-ESSAI-001" });
    expect(essai).toContain("ESSAI — pièce sans valeur");
    const specimen = v2({ ...CAS_FACTURE[0]![1], estSpecimen: true });
    expect(specimen).toContain("SPÉCIMEN — sans valeur juridique");
  });
});

describe("v2 — interdits", () => {
  it("aucune mention de certification, d'OPCO, de financement ou de prise en charge ajoutée", () => {
    for (const [nom, data] of CAS_FACTURE) {
      for (const motif of [/qualiopi/i, /opco/i, /financ/i, /prise en charge/i, /certifi/i]) {
        const a = (v1(data).match(new RegExp(motif.source, "gi")) ?? []).length;
        const b = (v2(data).match(new RegExp(motif.source, "gi")) ?? []).length;
        expect(b, `${nom} ${String(motif)}`).toBe(a);
      }
    }
  });

  it("aucun nom de logiciel d'IA", () => {
    for (const [, data] of CAS_FACTURE) {
      expect(v2(data)).not.toMatch(/claude|anthropic|chatgpt|openai|gemini|copilot/i);
    }
  });
});

describe("v2 — versionnage", () => {
  it("la facture et l'avoir sont en v2 ; la v1 reste archivée", async () => {
    expect(versionGabaritCourante("facture")).toBe(2);
    expect(versionGabaritCourante("avoir")).toBe(2);
    expect(typeGabarit("avoir")).toBe("facture");
    const { gabaritArchive } = await import("../archives");
    expect(gabaritArchive("facture", 1)).not.toBeNull();
  });
});
