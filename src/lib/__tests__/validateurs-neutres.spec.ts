// FAC-5 — Registre des entreprises et validateurs NEUTRES : sortis du dossier apporteur, ils
// rendent exactement la même chose qu'avant, et les anciens chemins sont des ré-exports.
import { describe, expect, it } from "vitest";

import { PAYS_SEPA, ibanValide } from "../iban";
import { resumerNavigateur } from "../navigateur";
import { luhnValid, normaliserNaf, sirenValide } from "../siret";
import { VIGILANCE_VALIDITE_MOIS } from "../vigilance";
import { STATUTS_JURIDIQUES, estStatutJuridique } from "../statut-juridique";
import * as regles from "@/features/apporteurs-reseau/regles";
import * as reglesDossier from "@/features/apporteurs-reseau/regles-dossier";
import * as signatureRegles from "@/features/apporteurs-reseau/signature-regles";
import * as annuaireApporteur from "@/features/apporteurs-reseau/annuaire";
import * as annuaire from "@/server/registre-entreprises/annuaire";

/** L'ancien `sirenValide` des apporteurs, recopié À L'IDENTIQUE pour la parité. */
function sirenValideAvant(brut: string): boolean {
  const s = brut.replace(/\s+/g, "");
  if (!/^\d{9}$/.test(s)) return false;
  let somme = 0;
  for (let i = 0; i < 9; i++) {
    let n = Number(s[8 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    somme += n;
  }
  return somme % 10 === 0;
}

/** Générateur déterministe (pas de hasard non reproductible dans un test). */
function* pseudoAleatoire(graine: number): Generator<number> {
  let x = graine;
  for (;;) {
    x = (x * 1103515245 + 12345) % 2 ** 31;
    yield x;
  }
}

describe("une seule source : les anciens chemins ré-exportent", () => {
  it("validateurs", () => {
    expect(reglesDossier.ibanValide).toBe(ibanValide);
    expect(reglesDossier.PAYS_SEPA).toBe(PAYS_SEPA);
    expect(reglesDossier.sirenValide).toBe(sirenValide);
    expect(regles.sirenValide).toBe(sirenValide);
    expect(regles.normaliserNaf).toBe(normaliserNaf);
    expect(regles.VIGILANCE_VALIDITE_MOIS).toBe(VIGILANCE_VALIDITE_MOIS);
    expect(signatureRegles.resumerNavigateur).toBe(resumerNavigateur);
    expect(reglesDossier.STATUTS_JURIDIQUES).toBe(STATUTS_JURIDIQUES);
    expect(reglesDossier.estStatutJuridique).toBe(estStatutJuridique);
  });
  it("registre des entreprises", () => {
    expect(annuaireApporteur.lireEntrepriseParSiren).toBe(annuaire.lireEntrepriseParSiren);
    expect(annuaireApporteur.lireRegistre).toBe(annuaire.lireRegistre);
    expect(annuaireApporteur.lireEtablissementParSiret).toBe(annuaire.lireEtablissementParSiret);
  });
});

describe("sirenValide : même sortie qu'avant (délègue à luhnValid)", () => {
  it("cas figés", () => {
    for (const s of [
      "732829320",
      "732 829 320",
      "123456789",
      "000000000",
      "12345678",
      "abcdefghi",
      "",
    ]) {
      expect(sirenValide(s), s).toBe(sirenValideAvant(s));
    }
  });
  it("500 numéros tirés de façon reproductible", () => {
    const g = pseudoAleatoire(42);
    for (let i = 0; i < 500; i++) {
      const s = String(g.next().value % 1_000_000_000).padStart(9, "0");
      expect(sirenValide(s), s).toBe(sirenValideAvant(s));
      expect(luhnValid(s)).toBe(sirenValideAvant(s));
    }
  });
});

describe("ibanValide (ISO 13616, modulo 97, zone SEPA)", () => {
  it("cas figés", () => {
    expect(ibanValide("FR76 3000 6000 0112 3456 7890 189")).toBe(true);
    expect(ibanValide("fr7630006000011234567890189")).toBe(true);
    expect(ibanValide("FR7630006000011234567890188")).toBe(false);
    expect(ibanValide("US12345678901234567890")).toBe(false);
  });
});

describe("normaliserNaf", () => {
  it("cas figés", () => {
    expect(normaliserNaf("6920Z")).toBe("69.20Z");
    expect(normaliserNaf("69.20z")).toBe("69.20Z");
    expect(normaliserNaf(" 85 59A ")).toBe("85.59A");
    expect(normaliserNaf("692")).toBeNull();
    expect(normaliserNaf(null)).toBeNull();
  });
});

describe("resumerNavigateur", () => {
  it("jamais l'agent complet", () => {
    expect(
      resumerNavigateur(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("Safari sur iPhone");
    expect(resumerNavigateur(null)).toBeNull();
  });
});
