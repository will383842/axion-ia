/**
 * Chantier QNC, L03 — la garde SERVEUR de la convention.
 *
 * Invariant : aucune convention ne part sans « cadrage validé + devis accepté »,
 * sauf dérogation motivée ; éteint, la garde ne change rien.
 */
import { describe, expect, it } from "vitest";

import { decider, type EtatRecueil } from "../garde-convention";

const base: EtatRecueil = {
  interrupteur: "actif",
  sessionEstTest: false,
  projetId: "p1",
  cadrage: { id: "q1", valideLe: new Date("2026-10-10T09:00:00Z") },
  devisStatut: "accepte",
  derogation: null,
};

describe("decider — la garde de la convention", () => {
  it("laisse passer quand le cadrage est validé ET le devis accepté", () => {
    expect(decider(base)).toEqual({ autorise: true, voie: "conforme" });
  });

  it("accepte aussi un devis déjà transformé en convention", () => {
    expect(decider({ ...base, devisStatut: "transforme_convention" }).autorise).toBe(true);
  });

  it("REFUSE quand le cadrage n'est pas validé", () => {
    const d = decider({ ...base, cadrage: { id: "q1", valideLe: null } });
    expect(d).toMatchObject({ autorise: false, manques: ["cadrage_non_valide"] });
  });

  it("REFUSE quand aucun cadrage n'existe (ni projet rattaché)", () => {
    expect(decider({ ...base, cadrage: null })).toMatchObject({
      autorise: false,
      manques: ["cadrage_non_valide"],
    });
    expect(decider({ ...base, projetId: null, cadrage: null }).autorise).toBe(false);
  });

  it.each(["brouillon", "envoye", "refuse", "expire", null] as const)(
    "REFUSE quand le devis est %s",
    (devisStatut) => {
      expect(decider({ ...base, devisStatut })).toMatchObject({
        autorise: false,
        manques: ["devis_non_accepte"],
      });
    },
  );

  it("liste les DEUX manques quand les deux font défaut", () => {
    const d = decider({ ...base, cadrage: null, devisStatut: "envoye" });
    expect(d).toMatchObject({
      autorise: false,
      manques: ["cadrage_non_valide", "devis_non_accepte"],
    });
    if (!d.autorise) expect(d.message).toMatch(/cadrage/i);
  });

  it("une dérogation motivée ouvre la voie, et le dit", () => {
    const accordeeLe = new Date("2026-10-12T08:00:00Z");
    const d = decider({
      ...base,
      cadrage: null,
      derogation: { motif: "Client historique, urgence de rentrée", accordeeLe },
    });
    expect(d).toEqual({
      autorise: true,
      voie: "derogation",
      motif: "Client historique, urgence de rentrée",
      accordeeLe,
    });
  });

  it("une dérogation ne sert à rien quand tout est en règle (voie conforme)", () => {
    const d = decider({
      ...base,
      derogation: { motif: "x".repeat(30), accordeeLe: new Date() },
    });
    expect(d).toEqual({ autorise: true, voie: "conforme" });
  });

  describe("ÉTEINT = INCHANGÉ", () => {
    it("éteint, tout passe, quel que soit l'état du dossier", () => {
      expect(
        decider({ ...base, interrupteur: "eteint", cadrage: null, devisStatut: null }),
      ).toEqual({ autorise: true, voie: "eteint" });
    });

    it("en essai, une session RÉELLE n'est pas touchée", () => {
      expect(
        decider({ ...base, interrupteur: "essai", sessionEstTest: false, cadrage: null }),
      ).toEqual({ autorise: true, voie: "eteint" });
    });

    it("en essai, une session du banc d'essai EST gardée", () => {
      expect(
        decider({ ...base, interrupteur: "essai", sessionEstTest: true, cadrage: null }).autorise,
      ).toBe(false);
    });
  });
});
