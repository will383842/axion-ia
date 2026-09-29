// @vitest-environment node

/**
 * Verrou — `ouvert` n'est effectif qu'après la FIN DU PRÉAVIS de 30 jours aux
 * clients actifs, et c'est le CODE qui le contrôle (chantier visio, PR 8 ;
 * B3 ; LOTS-EXECUTION §8 point 5 : « jamais avant PREAVIS.finLe, le code le
 * refuse »).
 *
 * La politique de confidentialité promet : « toute évolution est notifiée aux
 * clients actifs au moins 30 jours avant prise d'effet ». Une variable
 * `ENREGISTREMENT_VISIO_OUVERT=true` posée trop tôt dans Coolify ne doit pas
 * suffire à rompre cette promesse : elle donne `pilote` (client fictif
 * seulement) et une alerte, jusqu'au jour dit.
 *
 * Contre-témoins : le jour de la fin, `ouvert` passe (la garde n'est pas un
 * refus permanent) ; `ferme` et `pilote` ne sont jamais touchés. Angle mort :
 * la date est posée à la main par une PR, depuis `07-execution/PREAVIS.md` ;
 * ce test vérifie sa cohérence (fin = envoi + 30 j), pas qu'elle soit la date
 * RÉELLE d'envoi (relevée dans `email_outbox`).
 */

import { describe, expect, it } from "vitest";

import {
  DUREE_PREAVIS_JOURS,
  PREAVIS_SOUS_TRAITANTS,
  finDuPreavis,
  modeEffectif,
  preavisCoherent,
} from "../ouverture";

const PREAVIS = { envoyeLe: "2026-09-30", finLe: "2026-10-30" };

describe("le drapeau « ouvert » attend la fin du préavis", () => {
  it("🔑 le préavis dure 30 jours, comme la notice le promet", () => {
    expect(DUREE_PREAVIS_JOURS).toBe(30);
    expect(finDuPreavis("2026-09-30")).toBe("2026-10-30");
    expect(finDuPreavis("2026-12-15")).toBe("2027-01-14");
  });

  it("🔴 sans préavis envoyé, « ouvert » vaut « pilote » et lève l'alerte", () => {
    expect(modeEffectif("ouvert", new Date("2030-01-01T00:00:00Z"), null)).toEqual({
      mode: "pilote",
      alerte: "preavis_non_echu",
    });
  });

  it("🔴 la veille de la fin, « ouvert » vaut encore « pilote »", () => {
    expect(modeEffectif("ouvert", new Date("2026-10-29T23:59:59Z"), PREAVIS)).toEqual({
      mode: "pilote",
      alerte: "preavis_non_echu",
    });
  });

  it("🔑 CONTRE-TÉMOIN : le jour de la fin, « ouvert » est effectif", () => {
    expect(modeEffectif("ouvert", new Date("2026-10-30T00:00:00Z"), PREAVIS)).toEqual({
      mode: "ouvert",
      alerte: null,
    });
  });

  it("🔴 une fin avancée à la main (raccourcir la promesse) est refusée", () => {
    const raccourci = { envoyeLe: "2026-09-30", finLe: "2026-10-01" };
    expect(preavisCoherent(raccourci)).toBe(false);
    expect(modeEffectif("ouvert", new Date("2026-10-02T00:00:00Z"), raccourci)).toEqual({
      mode: "pilote",
      alerte: "preavis_incoherent",
    });
  });

  it("🔑 CONTRE-TÉMOIN : « ferme » et « pilote » ne dépendent pas du préavis", () => {
    const t = new Date("2026-10-01T00:00:00Z");
    expect(modeEffectif("ferme", t, null)).toEqual({ mode: "ferme", alerte: null });
    expect(modeEffectif("pilote", t, null)).toEqual({ mode: "pilote", alerte: null });
  });

  it("🔴 le préavis posé dans le code est absent ou cohérent", () => {
    // Le 29/09, l'e-mail de préavis attend la validation de Will : la date
    // n'est pas encore posée. Le jour où elle l'est, elle doit être cohérente.
    if (PREAVIS_SOUS_TRAITANTS === null) {
      expect(modeEffectif("ouvert", new Date()).mode).toBe("pilote");
      return;
    }
    expect(preavisCoherent(PREAVIS_SOUS_TRAITANTS)).toBe(true);
  });
});
