/** Lot L15c — statistiques internes (W6 D-W6-3, D-W6-4 ; R4). */

import { describe, expect, it, vi } from "vitest";

import {
  agregerStats,
  statsFormateurs,
  type LecteurStats,
  type SessionLue,
} from "../stats-formateurs";

const s = (
  id: string,
  jour: string,
  principal: string | null,
  animateurs: SessionLue["animateurs"] = [],
): SessionLue => ({
  id,
  dateDebut: new Date(`${jour}T09:00:00Z`),
  formateurPrincipalId: principal,
  animateurs,
});

describe("agregerStats", () => {
  it("principal et co-formateur comptent ; assistant et tuteur AFEST non", () => {
    const st = agregerStats(
      ["a", "b", "c"],
      [
        s("s1", "2026-01-10", "a", [{ trainerId: "b", role: "co_formateur" }]),
        s("s2", "2026-03-10", null, [
          { trainerId: "a", role: "principal" },
          { trainerId: "c", role: "assistant" },
        ]),
        s("s3", "2026-04-10", null, [{ trainerId: "c", role: "tuteur_afest" }]),
      ],
      new Map(),
    );
    expect(st.get("a")).toMatchObject({ formationsRealisees: 2 });
    expect(st.get("a")!.derniereFormation?.toISOString()).toBe("2026-03-10T09:00:00.000Z");
    expect(st.get("b")).toMatchObject({ formationsRealisees: 1 });
    expect(st.get("c")).toMatchObject({ formationsRealisees: 0, derniereFormation: null });
  });

  it("le principal listé deux fois (clé et ligne) ne compte qu'une fois", () => {
    const st = agregerStats(
      ["a"],
      [s("s1", "2026-01-10", "a", [{ trainerId: "a", role: "principal" }])],
      new Map([["s1", [5, 4]]]),
    );
    expect(st.get("a")).toMatchObject({ formationsRealisees: 1, satisfaction: null });
  });

  it("satisfaction affichée à partir de 5 avis seulement, jamais « 0 »", () => {
    const quatre = agregerStats(
      ["a"],
      [s("s1", "2026-01-10", "a")],
      new Map([["s1", [5, 5, 4, 4]]]),
    );
    expect(quatre.get("a")!.satisfaction).toBeNull();
    const cinq = agregerStats(
      ["a"],
      [s("s1", "2026-01-10", "a")],
      new Map([["s1", [5, 5, 4, 4, 3]]]),
    );
    expect(cinq.get("a")!.satisfaction).toEqual({ moyenne: 4.2, avis: 5 });
  });

  it("chaque co-animateur reçoit les notes de la session", () => {
    const st = agregerStats(
      ["a", "b"],
      [s("s1", "2026-01-10", "a", [{ trainerId: "b", role: "co_formateur" }])],
      new Map([["s1", [5, 5, 5, 5, 5]]]),
    );
    expect(st.get("b")!.satisfaction).toEqual({ moyenne: 5, avis: 5 });
  });
});

describe("statsFormateurs (lecture)", () => {
  it("ne lit que les sessions RÉALISÉES (un refus de mission n'entre nulle part) ; aucune requête sans formateur", async () => {
    const db: LecteurStats = {
      trainingSession: { findMany: vi.fn(async () => []) },
      questionnaire: { findMany: vi.fn(async () => []) },
    };
    expect(await statsFormateurs(db, [])).toEqual(new Map());
    expect(db.trainingSession.findMany).not.toHaveBeenCalled();
    await statsFormateurs(db, ["a"]);
    const args = (db.trainingSession.findMany as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(args.where.statut).toBe("realisee");
    expect(db.questionnaire.findMany).not.toHaveBeenCalled();
  });
});
