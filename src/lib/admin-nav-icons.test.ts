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

  // Les deux verrous ci-dessus garantissent que chaque entrée A une icône, pas
  // qu'elle en a une DISTINCTE de ses voisines. Or c'est ce qui rend une liste
  // lisible : dans une même liste dépliée, deux libellés partageant un dessin
  // sont aussi indiscernables que les 105 FolderOpen d'avant cette refonte —
  // à ceci près que rien ne le signale, puisque chaque icône résout.
  //
  // Partager un dessin entre groupes ÉLOIGNÉS reste légitime (`Building2` sert
  // pour « Clients (CRM) » et pour une vue de couverture) : on ne les voit
  // jamais côte à côte. La contrainte ne porte donc que sur un même groupe.
  //
  // Au 2026-08-02 le registre est propre : ce test vaut pour l'avenir.
  it("n'attribue pas la même icône à deux entrées d'un même groupe", () => {
    const vues = new Map<string, Map<string, string>>();
    const collisions: string[] = [];

    for (const item of items) {
      const groupe = vues.get(item.group) ?? new Map<string, string>();
      const precedent = groupe.get(item.icon);
      if (precedent && precedent !== item.label) {
        collisions.push(
          `groupe « ${item.group} » : « ${precedent} » et « ${item.label} » portent tous deux ${item.icon}`,
        );
      } else {
        groupe.set(item.icon, item.label);
      }
      vues.set(item.group, groupe);
    }

    expect(
      collisions,
      `Icône partagée par deux entrées du même groupe — elles seront indiscernables ` +
        `dans la liste :\n  - ${collisions.join("\n  - ")}`,
    ).toEqual([]);
  });
});
