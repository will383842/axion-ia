import { describe, expect, it } from "vitest";

import { etatSourceSearchConsole, fenetres28Jours } from "../sources";

const AUJOURDHUI = "2026-11-27";

describe("etatSourceSearchConsole", () => {
  it("aucun import : indisponible", () => {
    expect(etatSourceSearchConsole([], AUJOURDHUI)).toMatchObject({ etat: "indisponible" });
  });
  it("dernier import réussi récent : disponible, avec la date des données", () => {
    const r = etatSourceSearchConsole([{ jour: "2026-11-24", statut: "reussi" }], AUJOURDHUI);
    expect(r).toMatchObject({ etat: "disponible", donneesJusquAu: "2026-11-24" });
  });
  it("dernier import réussi ancien : en retard", () => {
    const r = etatSourceSearchConsole([{ jour: "2026-11-15", statut: "reussi" }], AUJOURDHUI);
    expect(r).toMatchObject({ etat: "en_retard", donneesJusquAu: "2026-11-15" });
  });
  it("que des échecs : indisponible, sans date inventée", () => {
    const r = etatSourceSearchConsole([{ jour: "2026-11-24", statut: "echec" }], AUJOURDHUI);
    expect(r.etat).toBe("indisponible");
    expect(r.donneesJusquAu).toBeNull();
  });
  it("prend le plus récent réussi, quel que soit l'ordre", () => {
    const r = etatSourceSearchConsole(
      [
        { jour: "2026-11-20", statut: "reussi" },
        { jour: "2026-11-25", statut: "reussi" },
      ],
      AUJOURDHUI,
    );
    expect(r.donneesJusquAu).toBe("2026-11-25");
  });
});

describe("fenetres28Jours", () => {
  it("deux fenêtres contiguës de 28 jours qui finissent à la date des données", () => {
    const f = fenetres28Jours("2026-11-24");
    expect(f.courante).toEqual({ debut: "2026-10-28", fin: "2026-11-24" });
    expect(f.precedente).toEqual({ debut: "2026-09-30", fin: "2026-10-27" });
  });
});
