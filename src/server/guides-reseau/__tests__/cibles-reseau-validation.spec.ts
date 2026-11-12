// @vitest-environment node
// F1a — validation d'une adresse de page (fonction pure) et catalogue des guides.
import { describe, it, expect } from "vitest";
import {
  HOTES_PAR_DEFAUT,
  RE_CODE_CIBLE,
  hotesAutorises,
  validerAdresse,
  validerTitre,
  normaliserMot,
  validerCheminPdf,
} from "../cibles-reseau";

const HOTES = ["axion-ia.com", "www.axion-ia.com"];
const refuse = (u: unknown, raison: string, hotes = HOTES) =>
  expect(validerAdresse(u, hotes)).toEqual({ ok: false, raison });

describe("validerAdresse", () => {
  it("accepte une adresse https d'un hôte de la liste", () => {
    expect(validerAdresse("https://axion-ia.com/fr/guide-ia", HOTES)).toEqual({
      ok: true,
      url: "https://axion-ia.com/fr/guide-ia",
    });
    expect(validerAdresse("https://WWW.axion-ia.com/a?b=1", HOTES).ok).toBe(true);
  });
  it("refuse http", () => refuse("http://axion-ia.com/", "adresse_https_obligatoire"));
  it("refuse un identifiant ou un mot de passe", () => {
    refuse("https://user:pass@axion-ia.com/", "adresse_identifiants_interdits");
    refuse("https://axion-ia.com@evil.test/", "adresse_identifiants_interdits");
  });
  it("refuse plus de 300 caractères", () =>
    refuse(`https://axion-ia.com/${"a".repeat(300)}`, "adresse_trop_longue"));
  it("refuse un hôte hors liste (y compris ressemblant)", () => {
    refuse("https://evil.test/", "adresse_hote_non_autorise");
    refuse("https://axion-ia.com.evil.test/", "adresse_hote_non_autorise");
    refuse("https://blog.axion-ia.com/", "adresse_hote_non_autorise");
  });
  it("refuse un port, même 443 écrit", () => {
    refuse("https://axion-ia.com:8443/", "adresse_port_interdit");
    refuse("https://axion-ia.com:443/", "adresse_port_interdit");
  });
  it("refuse un fragment et les caractères de contrôle", () => {
    refuse("https://axion-ia.com/#x", "adresse_fragment_interdit");
    refuse("https://axion-ia.com/a\nb", "adresse_caracteres_interdits");
    refuse("https://axion-ia.com/a b", "adresse_caracteres_interdits");
  });
  it("refuse vide, illisible, non texte", () => {
    refuse("", "adresse_vide");
    refuse(42, "adresse_vide");
    refuse("pas une adresse", "adresse_caracteres_interdits");
    refuse("axion-ia.com", "adresse_illisible");
  });
});

describe("liste blanche", () => {
  it("valeur par défaut dans le code", () => {
    expect(HOTES_PAR_DEFAUT).toBe("axion-ia.com,www.axion-ia.com");
    expect(hotesAutorises({})).toEqual(["axion-ia.com", "www.axion-ia.com"]);
    expect(hotesAutorises({ CIBLES_ADRESSES_HOTES: " , " })).toEqual([
      "axion-ia.com",
      "www.axion-ia.com",
    ]);
  });
  it("lit la variable CIBLES_ADRESSES_HOTES (virgules, casse, espaces)", () => {
    expect(hotesAutorises({ CIBLES_ADRESSES_HOTES: " Axion-IA.com , exemple.test " })).toEqual([
      "axion-ia.com",
      "exemple.test",
    ]);
  });
});

describe("code et titre", () => {
  it("code adr- de 6 à 24 caractères", () => {
    expect(RE_CODE_CIBLE.test("adr-abc123")).toBe(true);
    expect(RE_CODE_CIBLE.test("adr-" + "a".repeat(24))).toBe(true);
    for (const mauvais of [
      "adr-abc12",
      "adr-" + "a".repeat(25),
      "ADR-abc123",
      "adr_abc123",
      "abc-abc123",
      "adr-ab cde",
    ]) {
      expect(RE_CODE_CIBLE.test(mauvais)).toBe(false);
    }
  });
  it("titre de 3 à 120 caractères", () => {
    expect(validerTitre("  Offre  ")).toBe("Offre");
    expect(validerTitre("ab")).toBeNull();
    expect(validerTitre("a".repeat(121))).toBeNull();
    expect(validerTitre(7)).toBeNull();
  });
});

describe("code, mot, chemin", () => {
  it("code : gde- ou adr- + 6 à 24 caractères minuscules, chiffres, tirets", () => {
    expect(RE_CODE_CIBLE.test("gde-ia2026")).toBe(true);
    expect(RE_CODE_CIBLE.test("adr-offre01")).toBe(true);
    expect(RE_CODE_CIBLE.test("adr-ab")).toBe(false);
    expect(RE_CODE_CIBLE.test("xyz-offre01")).toBe(false);
    expect(RE_CODE_CIBLE.test("adr-OFFRE01")).toBe(false);
  });
  it("mot : minuscules, sans accent, lettres/chiffres 2 à 30", () => {
    expect(normaliserMot("  Énergie ")).toBe("energie");
    expect(normaliserMot("a")).toBeNull();
    expect(normaliserMot("a".repeat(31))).toBeNull();
    expect(normaliserMot("deux mots")).toBeNull();
    expect(normaliserMot(5)).toBeNull();
  });
  it("chemin du PDF : relatif, .pdf, sans ..", () => {
    expect(validerCheminPdf("imprimes/x.pdf")).toBe("imprimes/x.pdf");
    expect(validerCheminPdf("/etc/x.pdf")).toBeNull();
    expect(validerCheminPdf("../x.pdf")).toBeNull();
    expect(validerCheminPdf("imprimes/x.exe")).toBeNull();
  });
});
