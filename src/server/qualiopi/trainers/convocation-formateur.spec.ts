/**
 * Convocation J-7 / rappel J-1 du formateur (2026-09-03) — les formulations
 * pures, et la garde qui relie les traces d'état au cron.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

import {
  formulerAdresseComplete,
  formulerContactSurPlace,
  formulerHoraires,
  FENETRE_CONVOCATION_J7_JOURS,
  FENETRE_RAPPEL_J1_HEURES,
} from "./convocation-formateur";

describe("formulations", () => {
  it("horaires : une ligne par journée, rien sans journée", () => {
    expect(formulerHoraires([])).toBeUndefined();
    const h = formulerHoraires([
      { date: new Date("2026-09-14T00:00:00Z"), heureDebut: "09:00", heureFin: "17:00" },
      { date: new Date("2026-09-15T00:00:00Z"), heureDebut: "09:00", heureFin: "12:30" },
    ]);
    expect(h).toContain("09:00–17:00");
    expect(h).toContain("09:00–12:30");
    expect(h?.split(" · ")).toHaveLength(2);
  });

  it("contact sur place : nom et téléphone, l'un des deux suffit, rien sans les deux", () => {
    expect(formulerContactSurPlace(null, null)).toBeUndefined();
    expect(formulerContactSurPlace("  ", "")).toBeUndefined();
    expect(formulerContactSurPlace("Camille Dupont", null)).toBe("Camille Dupont");
    expect(formulerContactSurPlace(null, "06 00 00 00 00")).toBe("06 00 00 00 00");
    expect(formulerContactSurPlace("Camille Dupont", "06 00 00 00 00")).toBe(
      "Camille Dupont — 06 00 00 00 00",
    );
  });

  it("adresse complète : rue, puis code postal et ville ; rien si tout est vide", () => {
    expect(
      formulerAdresseComplete({ lieuAdresse: null, lieuCodePostal: null, lieuVille: null }),
    ).toBeUndefined();
    expect(
      formulerAdresseComplete({
        lieuAdresse: "12 rue de l'Exemple",
        lieuCodePostal: "38000",
        lieuVille: "Grenoble",
      }),
    ).toBe("12 rue de l'Exemple, 38000 Grenoble");
    expect(
      formulerAdresseComplete({ lieuAdresse: null, lieuCodePostal: null, lieuVille: "Lyon" }),
    ).toBe("Lyon");
  });
});

describe("les traces d'état existent là où le cron les lit", () => {
  it("le schéma porte les deux colonnes, le worker sélectionne dessus", () => {
    const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
    const worker = readFileSync(
      join(process.cwd(), "src/server/queue/workers/qualiopi-formation-crons-worker.ts"),
      "utf8",
    );
    for (const trace of ["convocationJ7EnvoyeeAt", "rappelJ1EnvoyeAt"]) {
      expect(schema).toContain(`${trace} `);
      expect(worker).toContain(`"${trace}"`);
    }
  });

  it("les fenêtres sont celles annoncées : 7,5 jours et 36 heures", () => {
    expect(FENETRE_CONVOCATION_J7_JOURS).toBe(7.5);
    expect(FENETRE_RAPPEL_J1_HEURES).toBe(36);
  });
});
