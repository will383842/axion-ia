import { describe, expect, it } from "vitest";

import {
  adresseListe,
  appliquerFiltreStatut,
  compterParFiltre,
  lireFiltreStatut,
} from "../filtre-statut-liste";

const B = "/fr/admin/qualiopi/clients";

describe("filtre-statut-liste", () => {
  it("lireFiltreStatut : valeur connue gardée, inconnue ou absente = tous", () => {
    expect(lireFiltreStatut("clients")).toBe("clients");
    expect(lireFiltreStatut("zzz")).toBe("tous");
    expect(lireFiltreStatut(undefined)).toBe("tous");
    expect(lireFiltreStatut("__proto__")).toBe("tous");
  });

  it("les compteurs égalent la longueur de chaque liste filtrée", () => {
    const fiches = [
      "prospect",
      "devis_envoye",
      "client_actif",
      "client_inactif",
      "perdu",
      "perdu",
    ].map((statut) => ({ statut }));
    const n = compterParFiltre(fiches);
    expect(n).toEqual({ tous: 6, prospects: 2, clients: 2, perdus: 2 });
    for (const k of ["tous", "prospects", "clients", "perdus"] as const) {
      expect(appliquerFiltreStatut(fiches, k)).toHaveLength(n[k]);
    }
  });

  it("adresseListe : sans paramètre, l'adresse nue ; « tous » n'écrit pas statut", () => {
    expect(adresseListe(B, {})).toBe(B);
    expect(adresseListe(B, { statut: "tous", q: "" })).toBe(B);
  });

  it("adresseListe : combine archives, statut et q dans cet ordre", () => {
    expect(adresseListe(B, { q: "a", archives: true, statut: "perdus" })).toBe(
      `${B}?archives=1&statut=perdus&q=a`,
    );
  });

  it("adresseListe : encode q (espace, &, accent, =, #)", () => {
    expect(adresseListe(B, { q: "Café & Cie=#1" })).toBe(`${B}?q=Caf%C3%A9+%26+Cie%3D%231`);
  });
});
