// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TuilesSession } from "../TuilesSession";

const base = { inscrits: 2, prevus: 4, montantHtCents: 100000, nbConflits: 0 };

describe("tuiles de la fiche session", () => {
  it("checklist rendue : la tuile « Étapes faites » s'affiche", () => {
    render(<TuilesSession {...base} etapes={{ fait: 3, total: 8 }} checklistRendue />);
    expect(screen.getByText("Étapes faites")).toBeTruthy();
  });
  it("session annulée ou reportée (checklist masquée) : pas de tuile, même avec un parcours", () => {
    render(<TuilesSession {...base} etapes={{ fait: 3, total: 8 }} checklistRendue={false} />);
    expect(screen.queryByText("Étapes faites")).toBeNull();
    expect(screen.getByText("Montant HT")).toBeTruthy();
  });
});

describe("teintes des blocs de la page (3 au plus)", () => {
  // La page est un composant serveur lié à Prisma : non rendable ici, on lit les teintes posées.
  const SRC = readFileSync(
    "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/sessions/[id]/page.tsx",
    "utf8",
  );
  it("bleu (principal), terracotta (alertes) et gris seulement", () => {
    const t = new Set([...SRC.matchAll(/teinte="(\w+)"/g)].map((m) => m[1] ?? ""));
    expect([...t].filter((x) => !["bleu", "terracotta", "gris"].includes(x))).toEqual([]);
  });
});
