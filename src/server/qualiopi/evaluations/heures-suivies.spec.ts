/**
 * 🔴 3e relecture A09 (audit initial 2026-09-14) — UNE définition des heures
 * suivies et du « 0 h », lue par l'attestation, le certificat de réalisation,
 * l'e-mail et les alertes.
 *
 * Deux défauts fermés ici :
 *   - l'attestation comptait à la minute, le certificat arrondissait à l'heure :
 *     93 % de 7 h donnait « 6 h 31 » sur l'une et « 7,00 » sur l'autre, pour le
 *     même stagiaire ;
 *   - « 0 h » se lisait sur un taux ENTIER : 20 minutes réalisées sur 70 h
 *     arrondissent le taux à 0 %, et la pièce disait « n'a suivi aucune heure ».
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import * as heures from "./heures-suivies";

const H = heures as unknown as Record<string, unknown>;
type Entree = {
  tauxPresencePct: number | null;
  creneaux?: ReadonlyArray<{
    dureePrevueMinutes: number;
    dureeRealiseeMinutes: number;
    date?: Date | string;
    demiJournee?: "matin" | "apres_midi" | "journee";
  }>;
};

const jour = (realisees: number, prevues = 4200) => ({
  dureePrevueMinutes: prevues,
  dureeRealiseeMinutes: realisees,
  date: "2026-06-01",
  demiJournee: "journee" as const,
});

describe("heures suivies — une seule définition", () => {
  it("🔴 « 0 h » = minutes réalisées strictement nulles ; sans créneau, taux strictement nul", () => {
    const aucune = H["aucuneHeureSuivie"] as (p: Entree) => boolean;
    expect(typeof aucune).toBe("function");
    // 20 minutes réalisées sur 70 h : le taux entier vaut 0 %, mais ce n'est PAS 0 h.
    expect(aucune({ tauxPresencePct: 0, creneaux: [jour(20)] })).toBe(false);
    expect(aucune({ tauxPresencePct: 0, creneaux: [jour(0)] })).toBe(true);
    expect(aucune({ tauxPresencePct: 0, creneaux: [] })).toBe(true);
    expect(aucune({ tauxPresencePct: 3 })).toBe(false);
    // Un taux INCONNU n'est pas un taux nul.
    expect(aucune({ tauxPresencePct: null })).toBe(false);
  });

  it("🔴 minutes calculées sur les minutes réalisées quand elles existent, jamais 0 si suivi", () => {
    const minutes = H["minutesSuiviesPresence"] as (p: Entree, dureeHeures: number) => number;
    expect(typeof minutes).toBe("function");
    expect(minutes({ tauxPresencePct: 0, creneaux: [jour(20)] }, 70)).toBe(20);
    // Sans créneau : repli sur le taux (limite : ±0,5 % de la durée).
    expect(minutes({ tauxPresencePct: 93 }, 7)).toBe(391);
    // Suivi non nul ⇒ jamais « 0 h » par arrondi.
    expect(minutes({ tauxPresencePct: 1 }, 0.5)).toBe(1);
    expect(minutes({ tauxPresencePct: 0, creneaux: [jour(0)] }, 70)).toBe(0);
  });

  it("🔴 certificat, attestation, e-mail et alertes lisent la MÊME définition", () => {
    const lire = (chemin: string) => readFileSync(join(process.cwd(), "src", chemin), "utf8");
    const certificat = lire("server/actions/qualiopi/documents.ts");
    expect(certificat).toContain("minutesSuiviesPresence(");
    expect(certificat).not.toMatch(
      /Math\.round\(\(enrollment\.tauxPresencePct \* baseDuree\) \/ 100\)/,
    );
    expect(lire("server/qualiopi/evaluations/attestation-service.ts")).toContain(
      "minutesSuiviesPresence(",
    );
    expect(lire("server/qualiopi/notifications/notifications-service.ts")).toContain(
      "aucuneHeureSuivie(",
    );
    expect(lire("server/qualiopi/alertes/evaluateur.ts")).toContain("aucuneHeureSuivie(");
  });
});

// 🔴 4e relecture A09 (audit initial 2026-09-14).
describe("heures suivies — même base de durée, formulation exacte", () => {
  const lire = (chemin: string) => readFileSync(join(process.cwd(), "src", chemin), "utf8");

  it("🔴 base de durée : réelle, sinon snapshot légal, sinon catalogue — des DEUX côtés", () => {
    const base = H["dureeReferenceHeures"] as (d: {
      dureeReelleHeures: number | null | undefined;
      dureeSnapshotHeures: number | null | undefined;
      dureeCatalogueHeures: number | null | undefined;
    }) => number;
    expect(typeof base).toBe("function");
    // Snapshot légal présent SANS durée : l'attestation retombait à 0, le
    // certificat sur le catalogue.
    expect(
      base({ dureeReelleHeures: null, dureeSnapshotHeures: null, dureeCatalogueHeures: 14 }),
    ).toBe(14);
    expect(
      base({ dureeReelleHeures: null, dureeSnapshotHeures: 12, dureeCatalogueHeures: 14 }),
    ).toBe(12);
    expect(base({ dureeReelleHeures: 16, dureeSnapshotHeures: 12, dureeCatalogueHeures: 14 })).toBe(
      16,
    );
    expect(lire("server/actions/qualiopi/documents.ts")).toContain("dureeReferenceHeures(");
    expect(lire("server/qualiopi/evaluations/attestation-service.ts")).toContain(
      "dureeReferenceHeures(",
    );
  });

  it("🔴 aucune source ne dit « minutes réelles » : c'est une proportion appliquée à la durée", () => {
    // La durée suivie se calcule à partir de la proportion des minutes réalisées
    // sur les minutes prévues, appliquée à la durée de référence.
    const sources = [
      "server/qualiopi/evaluations/heures-suivies.ts",
      "server/qualiopi/evaluations/attestation-service.ts",
      "server/actions/qualiopi/documents.ts",
      "server/qualiopi/alertes/evaluateur.ts",
      "server/qualiopi/notifications/notifications-service.ts",
    ];
    const fautives = sources.filter((s) => /minutes r[ée]elles/i.test(lire(s)));
    expect(fautives).toEqual([]);
  });
});
