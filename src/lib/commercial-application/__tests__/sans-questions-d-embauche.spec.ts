/**
 * Plan « sept points salariat », lot L5b (décision D5 = oui).
 *
 * Le formulaire d'entrée ne demande plus la date de naissance, la nationalité,
 * la zone, les déplacements, la disponibilité ni le parcours sur dix ans. Le
 * schéma les garde FACULTATIFS (un onglet ouvert avant le déploiement les envoie
 * encore) : rien n'est retiré, rien n'est effacé en base.
 */
import { describe, expect, it } from "vitest";

import { commercialApplicationSchema } from "../model";
import { scoreCandidature, SCORE_POIDS } from "../scoring";

const SANS = {
  prenom: "Jean",
  nom: "Dupont",
  email: "jean@example.com",
  telephone: "0600000000",
  ville: "Lyon",
  codePostal: "69001",
  b2bDejaVendu: false,
  iaUtilise: false,
  informatiqueUtilise: false,
  pitch: "x".repeat(150),
  consent: true,
};

const ANCIEN_ONGLET = {
  ...SANS,
  dateNaissance: "1980-01-02",
  nationalite: "Française",
  experiences: [
    {
      entreprise: "ACME",
      ville: "Lyon",
      poste: "Commercial",
      debut: "2020-01",
      posteActuel: true,
      typesClients: ["entreprises"],
    },
  ],
  zoneMobile: false,
  zones: ["Isère (38)"],
  deplacement: "oui",
  disponibilite: "2026-12",
};

describe("schéma — questions d'embauche facultatives", () => {
  it("accepte une demande sans parcours, zone, déplacement ni disponibilité", () => {
    const r = commercialApplicationSchema.safeParse(SANS);
    expect(r.success, JSON.stringify(r)).toBe(true);
  });

  it("accepte encore la demande d'un onglet ouvert avant le déploiement", () => {
    const r = commercialApplicationSchema.safeParse(ANCIEN_ONGLET);
    expect(r.success, JSON.stringify(r)).toBe(true);
  });

  it("n'exige plus de zone quand zoneMobile est absent", () => {
    expect(commercialApplicationSchema.safeParse({ ...SANS, zoneMobile: false }).success).toBe(
      true,
    );
  });
});

describe("score — ne lit plus de critère d'embauche", () => {
  const sans = scoreCandidature(SANS as never);
  const avec = scoreCandidature(ANCIEN_ONGLET as never);

  it("la note ne dépend ni du parcours, ni de la zone, ni du déplacement", () => {
    expect(avec.total).toBe(sans.total);
  });

  it("le barème ne porte plus ces critères et fait toujours 100", () => {
    const cles = Object.keys(SCORE_POIDS);
    for (const k of ["deplacement", "zone", "typesClients"]) expect(cles).not.toContain(k);
    expect(Object.values(SCORE_POIDS).reduce((a, b) => a + b, 0)).toBe(100);
  });
});
