/**
 * Tests — moyens/moyens-regles.ts (chantier QNC, lot L07 — NC7, indicateur 17).
 * Logique pure : aucun accès base. Écrits AVANT le module (rouge puis vert).
 */

import { describe, expect, it } from "vitest";

import {
  alertesPiecesSession,
  categoriesPourModalite,
  differencesMoyen,
  estLienZoom,
  jourParisDe,
  lienVisioRequis,
  testLienDuAujourdhui,
  validerBlocVerification,
  validerDateVerification,
  validerMotif,
} from "./moyens-regles";

const CREE = new Date("2026-10-01T09:00:00.000Z");
const MAINTENANT = new Date("2026-10-16T10:00:00.000Z");

describe("validerMotif", () => {
  it("refuse un motif absent, vide ou blanc", () => {
    expect(validerMotif(undefined).ok).toBe(false);
    expect(validerMotif("").ok).toBe(false);
    expect(validerMotif("            ").ok).toBe(false);
  });
  it("refuse moins de 10 caractères utiles (comme le CHECK SQL btrim)", () => {
    expect(validerMotif("  trop court ").ok).toBe(true); // 10 car. après trim
    expect(validerMotif("123456789").ok).toBe(false);
    expect(validerMotif("   123456789   ").ok).toBe(false);
  });
  it("rend le motif nettoyé", () => {
    const r = validerMotif("  Salle changée pour travaux  ");
    expect(r).toEqual({ ok: true, motif: "Salle changée pour travaux" });
  });
});

describe("validerDateVerification", () => {
  it("refuse une date antérieure à la création de la ligne", () => {
    const r = validerDateVerification(new Date("2026-09-30T23:59:59.000Z"), CREE, MAINTENANT);
    expect(r).toEqual({ ok: false, raison: "anterieure_creation" });
  });
  it("accepte exactement la date de création et toute date jusqu'à maintenant", () => {
    expect(validerDateVerification(CREE, CREE, MAINTENANT).ok).toBe(true);
    expect(validerDateVerification(MAINTENANT, CREE, MAINTENANT).ok).toBe(true);
  });
  it("refuse une date dans le futur", () => {
    const r = validerDateVerification(new Date("2026-10-17T00:00:00.000Z"), CREE, MAINTENANT);
    expect(r).toEqual({ ok: false, raison: "future" });
  });
  it("refuse une date invalide", () => {
    expect(validerDateVerification(new Date("pas une date"), CREE, MAINTENANT).ok).toBe(false);
  });
});

describe("differencesMoyen", () => {
  const avant = {
    categorie: "salle",
    libelle: "Salle A",
    description: "",
    localisation: "Lyon",
    actif: true,
  };
  it("ne garde que les champs changés, avec avant et après", () => {
    const d = differencesMoyen(avant, { ...avant, libelle: "Salle B", actif: false });
    expect(d.avant).toEqual({ libelle: "Salle A", actif: true });
    expect(d.apres).toEqual({ libelle: "Salle B", actif: false });
  });
  it("rend vide quand rien ne change", () => {
    expect(differencesMoyen(avant, { ...avant }).vide).toBe(true);
  });
  it("compare les dates par instant", () => {
    const a = { ...avant, dateVerification: new Date("2026-10-02T00:00:00Z") };
    const b = { ...avant, dateVerification: new Date("2026-10-02T00:00:00Z") };
    expect(differencesMoyen(a, b).vide).toBe(true);
  });
});

describe("categoriesPourModalite", () => {
  it("présentiel : salle, matériel, humain — pas de plateforme", () => {
    expect([...categoriesPourModalite("presentiel")].sort()).toEqual([
      "humain",
      "materiel",
      "salle",
    ]);
  });
  it("distanciel : plateforme, humain, matériel — pas de salle", () => {
    expect([...categoriesPourModalite("distanciel")].sort()).toEqual([
      "humain",
      "materiel",
      "plateforme",
    ]);
  });
  it("hybride : tout", () => {
    expect(categoriesPourModalite("hybride")).toHaveLength(4);
  });
});

describe("lienVisioRequis / estLienZoom", () => {
  it("obligatoire en distanciel seulement", () => {
    expect(lienVisioRequis("distanciel")).toBe(true);
    expect(lienVisioRequis("hybride")).toBe(false);
    expect(lienVisioRequis("presentiel")).toBe(false);
  });
  it("reconnaît un lien Zoom (zoom.us et sous-domaines, https)", () => {
    expect(estLienZoom("https://us06web.zoom.us/j/81234567890?pwd=abc")).toBe(true);
    expect(estLienZoom("https://zoom.us/j/81234567890")).toBe(true);
  });
  it("refuse les autres outils, http, et les hôtes qui ne font que contenir zoom.us", () => {
    expect(estLienZoom("https://meet.google.com/abc-defg-hij")).toBe(false);
    expect(estLienZoom("http://zoom.us/j/81234567890")).toBe(false);
    expect(estLienZoom("https://zoom.us.evil.example/j/81234567890")).toBe(false);
    expect(estLienZoom("https://notzoom.us/j/81234567890")).toBe(false);
    expect(estLienZoom("")).toBe(false);
    expect(estLienZoom(null)).toBe(false);
  });
});

describe("alertesPiecesSession", () => {
  const piece = (id: string, creeLe: string) => ({
    id,
    type: "convocation",
    creeLe: new Date(creeLe),
  });
  it("aucune alerte sans changement de modalité ou de lieu", () => {
    expect(alertesPiecesSession([piece("p1", "2026-10-02T00:00:00Z")], [])).toEqual([]);
  });
  it("alerte sur les pièces émises AVANT le dernier changement", () => {
    const a = alertesPiecesSession(
      [piece("p1", "2026-10-02T00:00:00Z"), piece("p2", "2026-10-12T00:00:00Z")],
      [{ nature: "lieu", creeLe: new Date("2026-10-10T00:00:00Z") }],
    );
    expect(a.map((x) => x.pieceId)).toEqual(["p1"]);
    expect(a[0]?.natures).toEqual(["lieu"]);
  });
  it("cumule les natures modalité et lieu", () => {
    const a = alertesPiecesSession(
      [piece("p1", "2026-10-02T00:00:00Z")],
      [
        { nature: "lieu", creeLe: new Date("2026-10-10T00:00:00Z") },
        { nature: "modalite", creeLe: new Date("2026-10-11T00:00:00Z") },
      ],
    );
    expect(a[0]?.natures).toEqual(["lieu", "modalite"]);
  });
});

describe("validerBlocVerification", () => {
  const debut = new Date("2026-10-20T08:00:00.000Z");
  const base = {
    salle: true,
    wifi: true,
    projection: true,
    postes: true,
    comptes: true,
    materielStagiaire: true,
  };
  it("accepte un bloc complet horodaté AVANT le début", () => {
    expect(
      validerBlocVerification(base, { debut, maintenant: MAINTENANT, chezEntreprise: false }).ok,
    ).toBe(true);
  });
  it("refuse une vérification faite après le début de la session", () => {
    const r = validerBlocVerification(base, {
      debut,
      maintenant: new Date("2026-10-20T08:00:01.000Z"),
      chezEntreprise: false,
    });
    expect(r).toEqual({ ok: false, raison: "apres_debut" });
  });
  it("exige un booléen pour chacun des six points", () => {
    const { wifi: _w, ...incomplet } = base;
    const r = validerBlocVerification(incomplet as never, {
      debut,
      maintenant: MAINTENANT,
      chezEntreprise: false,
    });
    expect(r.ok).toBe(false);
  });
  it("chez l'entreprise : ce qu'elle fournit ET sa confirmation sont exigés (O11)", () => {
    const ctx = { debut, maintenant: MAINTENANT, chezEntreprise: true };
    expect(validerBlocVerification(base, ctx)).toEqual({
      ok: false,
      raison: "fourniture_entreprise_manquante",
    });
    expect(
      validerBlocVerification({ ...base, fourniParEntreprise: ["salle", "wifi"] }, ctx),
    ).toEqual({ ok: false, raison: "confirmation_entreprise_manquante" });
    expect(
      validerBlocVerification(
        {
          ...base,
          fourniParEntreprise: ["salle", "wifi"],
          confirmationEntreprise: { par: "M. Durand", le: "2026-10-15" },
        },
        ctx,
      ).ok,
    ).toBe(true);
  });
});

describe("testLienDuAujourdhui — le test du lien se fait à J-1 (jour de Paris)", () => {
  it("vrai la veille du début, à Paris", () => {
    // Début mardi 20/10 08:00 Paris → veille lundi 19/10.
    const debut = new Date("2026-10-20T06:00:00.000Z");
    expect(testLienDuAujourdhui(debut, new Date("2026-10-19T09:00:00.000Z"))).toBe(true);
  });
  it("faux avant la veille, et le jour même", () => {
    const debut = new Date("2026-10-20T06:00:00.000Z");
    expect(testLienDuAujourdhui(debut, new Date("2026-10-18T09:00:00.000Z"))).toBe(false);
    expect(testLienDuAujourdhui(debut, new Date("2026-10-20T05:00:00.000Z"))).toBe(false);
  });
  it("tient compte du fuseau : 23:30 UTC le 19/10 est déjà le 20 à Paris (été)", () => {
    const debut = new Date("2026-10-20T06:00:00.000Z");
    expect(jourParisDe(new Date("2026-10-19T23:30:00.000Z"))).toBe("2026-10-20");
    expect(testLienDuAujourdhui(debut, new Date("2026-10-19T23:30:00.000Z"))).toBe(false);
  });
});
