/**
 * Chantier QNC, lot L10 — le registre de veille lu par l'écran ET l'export :
 * deux dates visibles (information, saisie de la PREMIÈRE version), la décision
 * et son auteur réel, l'archivage. Une correction ne rajeunit pas une veille.
 */

import { describe, expect, it } from "vitest";
import { ACTION_JOURNAL_VEILLE, lireTraceVeille } from "../trace-veille";
import { assemblerRegistreVeille, formatSaisieParis } from "../registre-veille";

const t = (iso: string) => new Date(iso);
const base = {
  type: "legale" as const,
  source: "Légifrance",
  titre: "Décret",
  contenu: "Analyse",
  impact: null,
  dateVeille: t("2026-09-01T12:00:00Z"),
};

describe("le registre de veille", () => {
  it("interrupteur éteint : chaque ligne porte la date de l'information et sa date de saisie", () => {
    const [l] = assemblerRegistreVeille(
      [{ ...base, id: "v1", actionDecidee: null, createdAt: t("2026-09-29T22:30:00Z") }],
      null,
      new Map(),
    );
    expect(l).toMatchObject({
      dateVeille: base.dateVeille,
      saisieLe: t("2026-09-29T22:30:00Z"),
      decision: null,
      archivage: null,
    });
    expect(formatSaisieParis(l!.saisieLe)).toBe("30/09/2026 à 00:30");
  });

  it("veille tracée : la version décidée garde la saisie de la première version, et nomme son décideur", () => {
    const trace = lireTraceVeille([
      {
        action: ACTION_JOURNAL_VEILLE.decision,
        targetId: "v2",
        adminUserId: "u-will",
        createdAt: t("2026-10-05T08:00:00Z"),
        changes: { remplace: "v1", decision: "Revoir P04", pieceModifiee: "P04 v3" },
      },
      {
        action: ACTION_JOURNAL_VEILLE.archivage,
        targetId: "v1",
        adminUserId: "u-will",
        createdAt: t("2026-10-05T08:00:00Z"),
        changes: { motif: "Décision prise", remplaceePar: "v2" },
      },
    ]);
    const lignes = assemblerRegistreVeille(
      [
        { ...base, id: "v2", actionDecidee: "Revoir P04", createdAt: t("2026-10-05T08:00:00Z") },
        { ...base, id: "v1", actionDecidee: null, createdAt: t("2026-09-29T22:30:00Z") },
      ],
      trace,
      new Map([["u-will", "Will Jullin"]]),
    );
    expect(lignes[0]).toMatchObject({
      saisieLe: t("2026-09-29T22:30:00Z"),
      decision: { par: "Will Jullin", pieceModifiee: "P04 v3" },
      archivage: null,
    });
    expect(lignes[1]).toMatchObject({ archivage: { remplaceePar: "v2", motif: "Décision prise" } });
  });
});
