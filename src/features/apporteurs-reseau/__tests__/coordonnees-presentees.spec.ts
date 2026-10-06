import { describe, expect, it } from "vitest";

import { peutOuvrirDossierApporteur } from "@/server/auth/habilitations";

import { COORDONNEES_MASQUEES, coordonneesAffichables } from "../coordonnees-presentees";

const p = { personneEmail: "durand@acme.fr", personneTelephone: "0612345678" };

describe("coordonnées des personnes présentées (tiers)", () => {
  it("rôle autorisé : e-mail et téléphone visibles", () => {
    expect(coordonneesAffichables(p, true)).toBe("durand@acme.fr · 0612345678");
    expect(coordonneesAffichables({ ...p, personneTelephone: null }, true)).toBe("durand@acme.fr");
  });

  it("rôle de consultation : ni e-mail ni téléphone", () => {
    const vu = coordonneesAffichables(p, false);
    expect(vu).toBe(COORDONNEES_MASQUEES);
    expect(vu).not.toContain("durand");
    expect(vu).not.toContain("0612");
  });

  it("la consultation (reader) ne passe pas la frontière du dossier apporteur", () => {
    expect(peutOuvrirDossierApporteur("reader")).toBe(false);
    expect(peutOuvrirDossierApporteur("admin")).toBe(true);
  });
});
