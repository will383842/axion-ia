import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { suitLaRegleRendezVous } from "../reservation-presentation";

// Point B : une présentation de la règle par rendez-vous ne se confirme pas « maintenant » dans la
// console ; elle se valide par un rendez-vous tenu ou une commande signée.

describe("suitLaRegleRendezVous", () => {
  it("ligne « rendez_vous » : oui ; sans ligne ou autre règle : non", () => {
    expect(suitLaRegleRendezVous({ regle: "rendez_vous" })).toBe(true);
    expect(suitLaRegleRendezVous(undefined)).toBe(false);
    expect(suitLaRegleRendezVous(null)).toBe(false);
    expect(suitLaRegleRendezVous({ regle: "ancienne" })).toBe(false);
  });
});

describe("page « Entreprises présentées »", () => {
  const src = readFileSync(
    join(process.cwd(), "src/app/[locale]/(admin)/[adminPrefix]/apporteurs/entreprises/page.tsx"),
    "utf8",
  );
  it("n'affiche pas ConfirmerAttribution et passe peutConfirmer faux pour la règle par rendez-vous", () => {
    expect(src).toMatch(/!parRendezVous \? \(\s*<ConfirmerAttribution/);
    expect(src).toContain('peutConfirmer={p.statut === "reservee" && !parRendezVous}');
    expect(src).toContain("Validation par rendez-vous ou par commande signée");
    expect(src).toContain("suitLaRegleRendezVous");
  });
});
