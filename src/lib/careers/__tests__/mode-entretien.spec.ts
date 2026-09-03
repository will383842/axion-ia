// @vitest-environment node

/**
 * La déduction du mode d'entretien — et les deux cas où une version naïve se
 * trompe de pièce.
 *
 * L'enjeu n'est pas cosmétique : un mode faux envoie quelqu'un attendre devant
 * un écran pendant qu'on l'attend dans une salle, ou l'inverse. C'est le genre
 * de défaut qu'on ne découvre qu'à l'heure du rendez-vous.
 */

import { describe, expect, it } from "vitest";

import { modeDepuisLieu } from "../mode-entretien";

describe("mode d'entretien déduit du lieu", () => {
  it("un lien est une visioconférence", () => {
    expect(modeDepuisLieu("https://meet.google.com/abc-defg-hij")).toBe("visio");
    expect(modeDepuisLieu("http://exemple.invalid/salle")).toBe("visio");
    expect(modeDepuisLieu("HTTPS://MEET.EXEMPLE.INVALID/x")).toBe("visio");
  });

  it("une adresse est un rendez-vous sur site", () => {
    expect(modeDepuisLieu("12 rue de la République, 38000 Grenoble")).toBe("sur_site");
  });

  it("rien du tout est un appel téléphonique", () => {
    expect(modeDepuisLieu(null)).toBe("telephone");
    expect(modeDepuisLieu(undefined)).toBe("telephone");
    expect(modeDepuisLieu("")).toBe("telephone");
  });

  it("🔴 un lieu fait UNIQUEMENT d'espaces est un appel, pas une adresse", () => {
    // Sans `trim`, cette chaîne serait « non vide » et vaudrait sur site. On
    // enverrait quelqu'un à une adresse qui n'existe pas.
    expect(modeDepuisLieu("   ")).toBe("telephone");
    expect(modeDepuisLieu("\n\t ")).toBe("telephone");
  });

  it("🔴 une adresse qui CONTIENT une URL reste un rendez-vous sur site", () => {
    // 🔑 Le cas qui distingue `startsWith` d'`includes`. Une version naïve
    // classerait ces deux lieux en visioconférence, et le candidat attendrait
    // devant un écran pendant qu'on l'attend dans une salle.
    expect(modeDepuisLieu("Bureau 3B — plan sur https://exemple.invalid/plan")).toBe("sur_site");
    expect(modeDepuisLieu("12 rue du Http, Lyon")).toBe("sur_site");
  });

  it("les trois valeurs rendues sont bien les trois modes du schéma", () => {
    // Témoin de cohérence : si l'enum Prisma gagne un mode, ce test ne le verra
    // pas — mais il verra qu'on rend une valeur qui n'est pas un mode.
    const rendus = new Set([
      modeDepuisLieu(null),
      modeDepuisLieu("adresse"),
      modeDepuisLieu("https://x.invalid"),
    ]);
    expect([...rendus].sort()).toEqual(["sur_site", "telephone", "visio"]);
  });
});
