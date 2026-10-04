/**
 * Relecture L3, défaut (c) — un rendez-vous « Autre » ne disparaît jamais de
 * l'agenda filtré (chantier « Types de rendez-vous », L5b) : « Autre » a son
 * bouton de filtre ; filtré sur « Autre », il reste visible ; le jeton `autre`
 * de l'URL est compris.
 */
import { describe, expect, it } from "vitest";

import { TYPES_FILTRABLES_AGENDA, lireFiltresAgenda, passeLesFiltresAgenda } from "../AgendaBarre";

describe("agenda", () => {
  it("« Autre » a son bouton de filtre", () => {
    expect(TYPES_FILTRABLES_AGENDA.map((t) => t.id)).toContain("autre");
  });

  it("le jeton `autre` de l'URL est compris", () => {
    expect(lireFiltresAgenda("calendly,autre").types).toEqual(["autre"]);
  });

  it("filtré sur « Autre », un rendez-vous « autre » reste visible", () => {
    const filtres = lireFiltresAgenda("autre");
    expect(passeLesFiltresAgenda({ source: "calendly", typeRendezVous: "autre" }, filtres)).toBe(
      true,
    );
    expect(
      passeLesFiltresAgenda({ source: "calendly", typeRendezVous: "diagnostic" }, filtres),
    ).toBe(false);
  });

  it("sans filtre tout passe ; l'agenda personnel passe toujours un filtre de type", () => {
    expect(
      passeLesFiltresAgenda({ source: "calendly", typeRendezVous: "autre" }, lireFiltresAgenda("")),
    ).toBe(true);
    expect(
      passeLesFiltresAgenda(
        { source: "google", typeRendezVous: null },
        lireFiltresAgenda("diagnostic"),
      ),
    ).toBe(true);
  });
});
