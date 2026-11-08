/**
 * 🔴 La chaîne visio de Gate D ne date JAMAIS son scénario en dur.
 *
 * Incident du 2026-11-05 : `scripts/ci/gate-d-chaine-visio.ts` semait un
 * rendez-vous au `2026-10-06T08:00Z`. La clôture fixe l'échéance de purge du
 * son à fin + 30 jours, et le balayage la compare au `now()` de Postgres : à
 * partir du 2026-11-05 08:10Z, le son était purgé dès le premier balayage et
 * l'étape « Visio — comportements sur base réelle » rendait
 * `R2 : 0 objet(s) au lieu de 4` sur tous les runs (5 sur 5 après la bascule,
 * 0 échec avant).
 *
 * Ce test verrouille :
 *   · l'ancre est dans le passé (le rendez-vous a eu lieu) ;
 *   · l'échéance de purge du 1er rendez-vous ET de la dictée reste dans le
 *     futur, quel que soit le jour du run (y compris dans un an) ;
 *   · le script n'écrit plus aucune date absolue (`new Date("20…")`).
 *
 * Mutation qui rougit : remettre `new Date("2026-10-06T08:00:00Z")` dans
 * `semer` → 3e cas ; porter `RECUL_DU_SCENARIO_MS` à 30 jours → 2e cas.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CONSERVATION_AUDIO_MAX_JOURS } from "../../../src/server/visio/cloture";
import {
  ancreDuScenario,
  apresAncre,
  ECARTS_DU_SCENARIO,
} from "../../../scripts/ci/gate-d-visio-horloge";

const JOUR_MS = 86_400_000;
/** Fin de session posée par le scénario après le début (1er rendez-vous / dictée). */
const FIN_SESSION_MS = 600_000;
const FIN_DICTEE_MS = ECARTS_DU_SCENARIO.dictee + 180_000;

describe("🔴 la chaîne visio ne date pas son scénario en dur", () => {
  it("l'ancre est dans le passé, la dictée et le 2ᵉ rendez-vous gardent leurs écarts", () => {
    const maintenant = new Date("2026-11-05T08:50:05Z");
    const ancre = ancreDuScenario(maintenant);
    expect(ancre.getTime()).toBeLessThan(maintenant.getTime());
    expect(apresAncre(ancre, FIN_DICTEE_MS).getTime()).toBeLessThan(maintenant.getTime());
    expect(apresAncre(ancre, ECARTS_DU_SCENARIO.secondRendezVous).getTime()).toBeGreaterThan(
      ancre.getTime(),
    );
  });

  it.each([
    "2026-11-05T08:50:05Z", // le run 41993277458, qui a rougi
    "2026-12-31T23:59:59Z",
    "2027-11-05T00:00:00Z",
  ])("au %s, l'échéance de purge du son est encore à venir", (iso) => {
    const maintenant = new Date(iso);
    const ancre = ancreDuScenario(maintenant);
    const conservation = CONSERVATION_AUDIO_MAX_JOURS * JOUR_MS;
    for (const fin of [FIN_SESSION_MS, FIN_DICTEE_MS]) {
      const echeance = apresAncre(ancre, fin + conservation);
      // Au moins 28 jours de marge : la chaîne dure quelques secondes.
      expect(echeance.getTime() - maintenant.getTime()).toBeGreaterThan(28 * JOUR_MS);
    }
  });

  it("le script de la chaîne n'écrit aucune date absolue", () => {
    const source = readFileSync(
      join(process.cwd(), "scripts", "ci", "gate-d-chaine-visio.ts"),
      "utf8",
    );
    expect(source.match(/new Date\(\s*["'`]\d{4}-/g) ?? []).toEqual([]);
    expect(source).toContain("ancreDuScenario()");
  });
});
