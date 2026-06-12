// Test d'invariant CROISÉ — verrouille la cohérence du catalogue formations V2
// à travers les TROIS référentiels qui le mirroitent (audit 2026-06-12).
//
// Contexte : pour ne pas importer `catalog-v2.ts` (~1,6k lignes) dans le bundle
// du calendrier (budget Web Vitals /reserver), le mapping (gamme, durée) des 17
// formations est RECOPIÉ À LA MAIN dans deux endroits :
//   - `src/lib/intervention-type.ts`  → `FORMATION_BOOKING` (dérive le prix serveur)
//   - `src/content/booking-catalog.ts` → `durationDays` / `bookable` (calendrier)
//
// Sans ce test, un changement de durée/gamme dans `catalog-v2.ts` non propagé
// dans les miroirs provoquerait un DRIFT SILENCIEUX (mauvais prix facturé, mauvais
// nombre de jours bloqués). On verrouille donc, par le COMPORTEMENT observable :
//   1. tout slug de formation V2 est un `InterventionSlug` (accepté Zod + enum Prisma) ;
//   2. le prix dérivé serveur (`getInterventionPriceCents`, qui passe par
//      `FORMATION_BOOKING`) == le prix dérivé du catalogue (`getFormationV2Price`) ;
//   3. la réservabilité + la durée du booking-catalog collent à la durée du catalogue.

import { describe, expect, it } from "vitest";
import { FORMATIONS_V2, getFormationV2Brackets, getFormationV2Price } from "./catalog-v2";
import {
  INTERVENTION_SLUGS,
  getInterventionPriceCents,
  type InterventionSlug,
} from "@/lib/intervention-type";
import { findBookableBySlug } from "@/content/booking-catalog";

const SLUGS = new Set<string>(INTERVENTION_SLUGS);

describe("catalog-v2 ↔ booking — cohérence croisée (anti-drift)", () => {
  it("le catalogue compte bien 17 formations", () => {
    expect(FORMATIONS_V2).toHaveLength(17);
  });

  it("chaque slugFr de formation V2 est un InterventionSlug valide (Zod + enum Prisma)", () => {
    for (const f of FORMATIONS_V2) {
      expect(SLUGS.has(f.slugFr), `slug manquant dans INTERVENTION_SLUGS : ${f.slugFr}`).toBe(true);
    }
  });

  it("le prix serveur (FORMATION_BOOKING) == le prix catalogue, pour chaque formation × tranche", () => {
    for (const f of FORMATIONS_V2) {
      const brackets = getFormationV2Brackets(f);
      expect(brackets.length, `aucune tranche pour ${f.slugFr}`).toBeGreaterThan(0);

      for (const b of brackets) {
        const catalogEur = getFormationV2Price(f, b);
        if (typeof catalogEur !== "number") continue; // tranche « sur devis » éventuelle

        // Un effectif situé DANS la tranche (la borne basse) doit faire retomber
        // `pickFormationBracket` sur exactement cette tranche.
        const lo = Number.parseInt(b.split("-")[0] ?? "", 10);
        const { cents } = getInterventionPriceCents(f.slugFr as InterventionSlug, lo);

        expect(
          cents,
          `drift de prix sur ${f.slugFr} / tranche ${b} : serveur=${cents}, catalogue=${catalogEur * 100}`,
        ).toBe(catalogEur * 100);
      }
    }
  });

  it("réservabilité + durée du booking-catalog cohérentes avec la durée du catalogue", () => {
    for (const f of FORMATIONS_V2) {
      const fmt = findBookableBySlug(f.slugFr);
      if (f.duree === "3j") {
        // Les 3 jours sont « sur devis » (le calendrier ne bloque que 1-2 jours).
        expect(
          fmt,
          `une formation 3 jours ne doit pas être réservable : ${f.slugFr}`,
        ).toBeUndefined();
      } else {
        expect(fmt, `formation réservable absente du booking-catalog : ${f.slugFr}`).toBeDefined();
        const expectedDays = f.duree === "2j" ? 2 : 1; // 4h et 1j bloquent 1 jour
        expect(fmt?.durationDays, `durée incohérente pour ${f.slugFr}`).toBe(expectedDays);
      }
    }
  });
});
