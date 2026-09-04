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
  joursCivilsAvant,
  FENETRE_CONVOCATION_J7_JOURS,
  FENETRE_RAPPEL_J1_HEURES,
} from "./convocation-formateur";
import { libelleDelaiConvocation } from "@/lib/email/templates/formateur-convocation-j7";

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

// ── Le délai annoncé (recette 2026-09-03) ───────────────────────────────────
// Le cron convoque par ÉTAT, donc aussi à J-3 ou à J-1. Le gabarit affirmait
// « dans 7 jours » quoi qu'il arrive.
describe("délai réel avant le démarrage", () => {
  it("compte des jours CIVILS de Paris, pas des tranches de 24 h", () => {
    // 20:00 heure de Paris la veille d'une session de 09:00 : 13 h d'écart,
    // et pourtant la réponse attendue est « demain ».
    const veilleAuSoir = new Date("2026-09-03T18:00:00Z");
    const demainMatin = new Date("2026-09-04T07:00:00Z");
    expect(joursCivilsAvant(demainMatin, veilleAuSoir)).toBe(1);
  });

  it("0 le jour même, négatif une fois commencée", () => {
    const midi = new Date("2026-09-10T10:00:00Z");
    expect(joursCivilsAvant(new Date("2026-09-10T07:00:00Z"), midi)).toBe(0);
    expect(joursCivilsAvant(new Date("2026-09-08T07:00:00Z"), midi)).toBe(-2);
  });

  it("7 jours pleins entre deux dates de calendrier", () => {
    expect(
      joursCivilsAvant(new Date("2026-09-10T07:00:00Z"), new Date("2026-09-03T18:00:00Z")),
    ).toBe(7);
  });

  it("l'objet et le titre DISENT le délai qu'on a mesuré", () => {
    expect(libelleDelaiConvocation(7, "fr")).toEqual({
      prefixeObjet: "Dans 7 jours —",
      titre: "Votre session démarre dans une semaine",
    });
    expect(libelleDelaiConvocation(3, "fr").titre).toBe("Votre session démarre dans 3 jours");
    expect(libelleDelaiConvocation(1, "fr").titre).toBe("Votre session démarre demain");
    expect(libelleDelaiConvocation(0, "fr").titre).toBe("Votre session démarre aujourd'hui");
    expect(libelleDelaiConvocation(-1, "fr").titre).toBe("Votre session démarre aujourd'hui");
  });

  it("🔴 un délai absent ne fabrique AUCUNE promesse de date", () => {
    // Le défaut d'origine, en une ligne : un repli à 7 le referait à l'identique.
    for (const l of [
      libelleDelaiConvocation(undefined, "fr"),
      libelleDelaiConvocation(Number.NaN, "fr"),
    ]) {
      expect(l.titre).toBe("Vos informations pratiques");
      expect(l.titre).not.toMatch(/semaine|jours|demain/);
      expect(l.prefixeObjet).not.toMatch(/7/);
    }
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
