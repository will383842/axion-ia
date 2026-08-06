/**
 * Le minutage des 22 programmes, tenu contre ce qui est VENDU.
 *
 * Ces gardes portent sur les fiches réelles, pas sur des cas construits. Elles
 * existent parce que trois défauts ont vécu des mois sans que rien ne les
 * contredise, tous invisibles pour la même raison : aucun test ne confrontait le
 * catalogue à l'engagement commercial qu'il porte.
 *
 *  1. Les programmes n'étaient pas minutés du tout. On vendait sept heures et on
 *     en écrivait quatre — 467 minutes manquaient sur l'ensemble du catalogue.
 *  2. Le ratio de pratique était écrit EN DUR à 70 %, et poussé dans le
 *     programme officiel remis au client et à l'OPCO. Personne ne l'avait
 *     vérifié ; les minutages reconstitués donnaient 41 à 62 %.
 *  3. Une fiche programmait 425 minutes pour 420 vendues, et rien ne le disait.
 *
 * Un programme est opposable : c'est lui qui part dans la convention, et c'est
 * lui qu'un auditeur Qualiopi ouvre. Un écart s'y voit immédiatement.
 */

import { describe, it, expect } from "vitest";

import { FORMATIONS_V2 } from "./catalog-v2";
import type { FormationProgrammeStep } from "./catalog-v2";
import {
  calculerRatioPratique,
  MINUTES_DUES_PAR_FORMAT,
  SEUIL_PRATIQUE_PAR_FORMAT,
  BLOCS_COMPTES_COMME_PRATIQUE,
} from "@/server/qualiopi/formations/ratio-pratique";

/** Durée d'une étape en minutes, ou 0 si elle n'en porte pas. */
function minutes(step: FormationProgrammeStep): number {
  const m = /^(\d+)\s*'?$/.exec((step.temps ?? "").trim());
  return m?.[1] === undefined ? 0 : Number.parseInt(m[1], 10);
}

/** Le catalogue, dans la forme que lit le module de calcul. */
function modulesDe(formation: (typeof FORMATIONS_V2)[number]) {
  return formation.programme.map((section) => ({
    sequences: section.steps.map((step) => ({
      dureeMin: minutes(step) || undefined,
      type: step.type,
    })),
  }));
}

describe("les 22 programmes tiennent le temps vendu", () => {
  it("chaque fiche programme EXACTEMENT sa durée vendue", () => {
    for (const f of FORMATIONS_V2) {
      const programmees = f.programme.reduce(
        (total, section) => total + section.steps.reduce((n, step) => n + minutes(step), 0),
        0,
      );
      expect(programmees, `${f.id} (${f.duree})`).toBe(MINUTES_DUES_PAR_FORMAT[f.duree]);
    }
  });

  it("aucune séquence ne reste sans durée ni sans nature", () => {
    for (const f of FORMATIONS_V2) {
      for (const section of f.programme) {
        for (const step of section.steps) {
          expect(
            minutes(step),
            `${f.id} — « ${step.titre.slice(0, 40)} » sans durée`,
          ).toBeGreaterThan(0);
          expect(step.type, `${f.id} — « ${step.titre.slice(0, 40)} » sans nature`).toBeDefined();
        }
      }
    }
  });
});

describe("les 22 programmes tiennent leur promesse de pratique", () => {
  it("chaque fiche atteint le seuil de son format", () => {
    for (const f of FORMATIONS_V2) {
      const r = calculerRatioPratique(modulesDe(f), f.duree);
      expect(r.pct, `${f.id} — ratio incalculable`).not.toBeNull();
      expect(
        r.pct,
        `${f.id} (${f.duree}) : ${r.pct} % pour un seuil de ${r.seuilPct} %`,
      ).toBeGreaterThanOrEqual(SEUIL_PRATIQUE_PAR_FORMAT[f.duree]);
    }
  });

  /**
   * 🔴 Le 70 % en dur revenait à annoncer un chiffre qu'aucun programme ne
   * portait. La garde ne se contente donc pas d'un seuil : elle recalcule à
   * partir des seules durées écrites, sans passer par le module testé.
   */
  it("le ratio calculé est bien celui que le programme écrit", () => {
    for (const f of FORMATIONS_V2) {
      const pratique = f.programme
        .flatMap((section) => section.steps)
        .filter(
          (step) =>
            step.type !== undefined &&
            (BLOCS_COMPTES_COMME_PRATIQUE as readonly string[]).includes(step.type),
        )
        .reduce((n, step) => n + minutes(step), 0);
      const attendu = Math.round((pratique / MINUTES_DUES_PAR_FORMAT[f.duree]) * 100);
      expect(calculerRatioPratique(modulesDe(f), f.duree).pct, f.id).toBe(attendu);
    }
  });

  /**
   * Un garde-fou ne protège que ce qui vient APRÈS lui. Une consigne de
   * confidentialité posée une fois l'atelier terminé ne protège rien : elle
   * arrive après que chacun a déposé ses documents dans l'outil.
   */
  it("chaque module ouvre par autre chose qu'un atelier", () => {
    for (const f of FORMATIONS_V2) {
      for (const section of f.programme) {
        const premiere = section.steps[0];
        if (premiere === undefined) continue;
        expect(
          premiere.type,
          `${f.id} — « ${section.titreFr.slice(0, 40)} » ouvre directement sur « ${premiere.titre.slice(0, 40)} »`,
        ).not.toBe("pratique");
      }
    }
  });
});
