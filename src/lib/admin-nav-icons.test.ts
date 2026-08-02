// Refonte visuelle console 2026-08 — chantier icônes.
//
// Verrous structurels du registre NAV_ICONS, tolérance ZÉRO dans les deux
// sens : un `item.icon` du SSOT qui ne résout pas retomberait en silence sur
// FolderOpen (l'anti-pattern que cette refonte élimine) ; une entrée du
// registre utilisée par aucun item est du poids mort embarqué côté client.

import { describe, it, expect } from "vitest";
import { FolderOpen } from "lucide-react";
import { buildAdminNav } from "./admin-nav";
import { NAV_ICONS, navIcon } from "./admin-nav-icons";

describe("registre d'icônes nav admin (NAV_ICONS)", () => {
  const items = buildAdminNav("p");

  it("chaque item.icon du SSOT résout dans NAV_ICONS (aucun repli silencieux)", () => {
    for (const item of items) {
      expect(
        NAV_ICONS[item.icon],
        `« ${item.label} » (${item.href}) : icône « ${item.icon} » absente du registre NAV_ICONS`,
      ).toBeDefined();
    }
  });

  it("NAV_ICONS ne contient aucune entrée orpheline (icône enregistrée mais inutilisée)", () => {
    const used = new Set(items.map((item) => item.icon));
    for (const name of Object.keys(NAV_ICONS)) {
      expect(used.has(name), `icône « ${name} » enregistrée mais utilisée par aucun item`).toBe(
        true,
      );
    }
  });

  it("navIcon résout un nom connu et retombe sur FolderOpen pour un nom inconnu", () => {
    expect(navIcon("LayoutDashboard")).toBe(NAV_ICONS["LayoutDashboard"]);
    expect(navIcon("NomLucideInexistant")).toBe(FolderOpen);
  });
});
