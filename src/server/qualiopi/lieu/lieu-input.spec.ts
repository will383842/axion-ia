/**
 * Tests — validation et normalisation de la saisie du lieu de déroulement.
 *
 * L'enjeu n'est pas cosmétique : ce que ce module laisse passer finit imprimé
 * sur une convention (art. L.6353-1) et dans une convocation envoyée au
 * stagiaire.
 */

import { describe, it, expect } from "vitest";

import { lieuInputSchema, normaliserLieu } from "./lieu-input";

describe("lieuInputSchema", () => {
  it("accepte les trois types de lieu et la chaîne vide (= effacer)", () => {
    for (const t of ["sur_site", "nos_locaux", "distanciel", ""]) {
      expect(lieuInputSchema.safeParse({ lieuType: t }).success).toBe(true);
    }
  });

  it("refuse un type de lieu inconnu", () => {
    expect(lieuInputSchema.safeParse({ lieuType: "chez_mamie" }).success).toBe(false);
  });

  it("accepte une URL de visio https", () => {
    const r = lieuInputSchema.safeParse({ lieuVisioUrl: "https://meet.google.com/abc-defg-hij" });
    expect(r.success).toBe(true);
  });

  // 🔴 Le lien de visio part dans une convocation envoyée par courriel. Un
  // `javascript:` ou un `data:` recopié là n'est pas un lieu, c'est un vecteur.
  it("refuse un schéma d'URL autre que http(s)", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,<script>",
      "zoommtg://zoom.us/join",
    ]) {
      expect(lieuInputSchema.safeParse({ lieuVisioUrl: url }).success).toBe(false);
    }
  });

  it("refuse une URL qui n'en est pas une", () => {
    expect(lieuInputSchema.safeParse({ lieuVisioUrl: "meet.google.com" }).success).toBe(false);
  });

  it("tolère une URL de visio vide (lien pas encore créé)", () => {
    expect(lieuInputSchema.safeParse({ lieuVisioUrl: "" }).success).toBe(true);
  });

  it("borne la longueur des champs texte", () => {
    expect(lieuInputSchema.safeParse({ lieuVille: "x".repeat(121) }).success).toBe(false);
    expect(lieuInputSchema.safeParse({ lieuVille: "x".repeat(120) }).success).toBe(true);
  });
});

describe("normaliserLieu", () => {
  // 🔴 Le cœur du module : "" et null se ressemblent à l'écran, pas en base. Un
  // "" stocké ferait passer une session pour « lieu saisi » dans toute requête
  // `NOT NULL`, et isLieuRenseigne() la croirait renseignée.
  it("traduit la chaîne vide en null, jamais en chaîne vide", () => {
    const out = normaliserLieu({ lieuVille: "", lieuAdresse: "   " });
    expect(out.lieuVille).toBeNull();
    expect(out.lieuAdresse).toBeNull();
  });

  it("omet les clés absentes, pour ne pas écraser ce qu'un formulaire n'affiche pas", () => {
    const out = normaliserLieu({ lieuVille: "Saint-Étienne" });
    expect(out.lieuVille).toBe("Saint-Étienne");
    expect("lieuAdresse" in out).toBe(false);
    expect("lieuType" in out).toBe(false);
  });

  it("efface le type de lieu quand la chaîne vide est explicitement transmise", () => {
    const out = normaliserLieu({ lieuType: "" });
    expect(out.lieuType).toBeNull();
  });

  it("conserve un type de lieu valide", () => {
    expect(normaliserLieu({ lieuType: "sur_site" }).lieuType).toBe("sur_site");
  });

  it("retire les espaces de tête et de queue", () => {
    expect(normaliserLieu({ lieuSalle: "  B2  " }).lieuSalle).toBe("B2");
  });

  it("sur une saisie entièrement vide, ne produit que des null (aucun résidu)", () => {
    const out = normaliserLieu({
      lieuType: "",
      lieuIntitule: "",
      lieuAdresse: "",
      lieuCodePostal: "",
      lieuVille: "",
      lieuSalle: "",
      lieuVisioUrl: "",
    });
    expect(Object.values(out).every((v) => v === null)).toBe(true);
  });
});
