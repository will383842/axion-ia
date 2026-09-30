/**
 * L'AUDIO NON PURGÉ ALERTE : un son qui dépasse son échéance de plus d'une
 * heure lève une alerte critique (sans nom ni parole), et sa purge est
 * reprogrammée par le balayage.
 */

import { describe, expect, it } from "vitest";

import { balayerCircuit } from "../balayage-circuit";
import { audioEnRetard } from "../purge-audio";
import type { AlerteCircuit } from "../etapes";
import { baseEspion } from "../../../../tests/outils/base-espion";
import { fauxCout } from "../../../../tests/outils/faux-openai-visio";

const M = new Date("2026-11-05T12:00:00Z");

describe("l'audio non purgé alerte", () => {
  it("échéance dépassée de plus d'une heure → alerte critique, purge reprogrammée", async () => {
    const e = baseEspion({
      $queryRaw: ({ sql }) =>
        String(sql).includes("audio_supprime_le") ? [{ rencontre_id: "r1" }] : [],
      "enregistrement.findMany": () => [
        {
          id: "e1",
          rencontreId: "r1",
          audioAPurgerAvant: new Date("2026-11-05T10:00:00Z"),
          audioSupprimeLe: null,
        },
      ],
    });
    const alertes: AlerteCircuit[] = [];
    const b = await balayerCircuit(e.base, {
      cout: fauxCout().port,
      alerter: async (a) => void alertes.push(a),
      maintenant: () => M,
    });
    expect(b.audiosEnRetard).toBe(1);
    expect(b.purgesProgrammees).toBe(1);
    expect(alertes[0]).toMatchObject({
      code: "visio.audio_non_purge",
      niveau: "critique",
      rencontreId: "r1",
    });
    expect(e.sqls.some((s) => s.valeurs.includes("purger_audio"))).toBe(true);
  });

  it("contre-témoin : dans l'heure de grâce, pas d'alerte", () => {
    expect(
      audioEnRetard({
        audioSupprimeLe: null,
        audioAPurgerAvant: new Date("2026-11-05T11:30:00Z"),
        maintenant: M,
      }),
    ).toBe(false);
    expect(
      audioEnRetard({
        audioSupprimeLe: M,
        audioAPurgerAvant: new Date("2026-11-01T00:00:00Z"),
        maintenant: M,
      }),
    ).toBe(false);
  });
});
