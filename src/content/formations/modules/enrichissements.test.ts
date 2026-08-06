/**
 * Le contenu rédigé, tenu contre le catalogue.
 *
 * Deux fichiers décrivent la même formation par des gestes différents : ajuster
 * un minutage n'est pas réécrire une consigne. Ils divergeront donc, à moins que
 * quelque chose ne le refuse. C'est le rôle de ce fichier.
 */

import { describe, it, expect } from "vitest";

import { ENRICHISSEMENTS } from "./index";
import { FORMATIONS_V2 } from "../catalog-v2";
import {
  diagnostiquerModule,
  modulePedagogiqueSchema,
} from "@/server/qualiopi/formations/module-pedagogique";
import { NATURES_HORS_BLOCS } from "@/server/qualiopi/formations/module-pedagogique";

/** Le module du catalogue correspondant, reconstruit comme le fait l'import. */
function moduleCatalogue(slug: string, moduleId: string) {
  const formation = FORMATIONS_V2.find((f) => f.slugFr === slug);
  if (formation === undefined) return undefined;
  const index = Number.parseInt(moduleId.replace("mod-", ""), 10) - 1;
  const section = formation.programme[index];
  if (section === undefined) return undefined;
  return {
    moduleId,
    titre: section.titreFr,
    sequences: section.steps.map((step, j) => {
      const m = /^(\d+)\s*'?$/.exec((step.temps ?? "").trim());
      return {
        id: `seq-${index + 1}-${j + 1}`,
        titre: step.titre,
        ...(m?.[1] !== undefined ? { dureeMin: Number.parseInt(m[1], 10) } : {}),
        ...(step.type !== undefined ? { type: step.type } : {}),
      };
    }),
  };
}

describe("chaque contenu rédigé se rattache à un vrai module du catalogue", () => {
  it("le slug de formation existe au catalogue", () => {
    for (const slug of Object.keys(ENRICHISSEMENTS)) {
      expect(
        FORMATIONS_V2.some((f) => f.slugFr === slug),
        `« ${slug} » n'existe pas au catalogue`,
      ).toBe(true);
    }
  });

  /**
   * 🔴 La garde qui empêche la divergence silencieuse. Renuméroter ou supprimer
   * un module au catalogue laisserait son contenu rédigé orphelin : il ne serait
   * plus fusionné, les documents ressortiraient vides, et RIEN ne le dirait.
   */
  it("chaque moduleId correspond à un module réellement présent", () => {
    for (const [slug, modules] of Object.entries(ENRICHISSEMENTS)) {
      for (const enrichi of modules) {
        expect(
          moduleCatalogue(slug, enrichi.moduleId),
          `${slug} — « ${enrichi.moduleId} » ne correspond à aucun module du catalogue`,
        ).toBeDefined();
      }
    }
  });

  it("aucun module n'est enrichi deux fois", () => {
    for (const [slug, modules] of Object.entries(ENRICHISSEMENTS)) {
      const ids = modules.map((m) => m.moduleId);
      expect(new Set(ids).size, `${slug} — doublon de moduleId`).toBe(ids.length);
    }
  });

  it("l'objectif de chaque module renvoie à un objectif réellement vendu", () => {
    for (const [slug, modules] of Object.entries(ENRICHISSEMENTS)) {
      const formation = FORMATIONS_V2.find((f) => f.slugFr === slug)!;
      const vendus = formation.objectifsFr.map((_, i) => `obj-${i + 1}`);
      for (const enrichi of modules) {
        expect(
          vendus,
          `${slug}/${enrichi.moduleId} renvoie à « ${enrichi.objectif.objectifGlobalId} », absent des objectifs vendus`,
        ).toContain(enrichi.objectif.objectifGlobalId);
      }
    }
  });
});

describe("le contenu rédigé respecte le Standard", () => {
  it("chaque module fusionné est déclaré COMPLET par le diagnostic", () => {
    for (const [slug, modules] of Object.entries(ENRICHISSEMENTS)) {
      for (const enrichi of modules) {
        const base = moduleCatalogue(slug, enrichi.moduleId)!;
        const dureeMin = base.sequences.reduce((n, s) => n + (s.dureeMin ?? 0), 0);
        const d = diagnostiquerModule({ ...base, dureeMin, ...enrichi });

        expect(d.blocsManquants, `${slug}/${enrichi.moduleId}`).toEqual([]);
        expect(d.notesIncompletes, `${slug}/${enrichi.moduleId} — notes d'animation`).toEqual([]);
        expect(
          d.dureeIncoherente,
          `${slug}/${enrichi.moduleId} — ${d.dureeBlocsMin} min de blocs pour ${dureeMin} min annoncées`,
        ).toBe(false);
        expect(d.complet, `${slug}/${enrichi.moduleId}`).toBe(true);
      }
    }
  });

  /**
   * Le schéma complet, en plus du diagnostic : le diagnostic dit ce qui manque,
   * le schéma refuse ce qui est mal formé. Les deux ne couvrent pas la même
   * chose — un prompt tronqué passe le premier et pas le second.
   */
  it("chaque module fusionné passe le schéma complet", () => {
    for (const [slug, modules] of Object.entries(ENRICHISSEMENTS)) {
      for (const enrichi of modules) {
        const base = moduleCatalogue(slug, enrichi.moduleId)!;
        const dureeMin = base.sequences.reduce((n, s) => n + (s.dureeMin ?? 0), 0);
        const r = modulePedagogiqueSchema.safeParse({ ...base, dureeMin, ...enrichi });
        expect(
          r.success,
          `${slug}/${enrichi.moduleId} : ${r.success ? "" : JSON.stringify(r.error.issues[0])}`,
        ).toBe(true);
      }
    }
  });

  /**
   * La durée des blocs doit correspondre à la durée des séquences de MÊME
   * nature. Sans ce contrôle, un bloc pourrait annoncer 25 minutes d'atelier
   * quand le programme publié en annonce 40 : le formateur suivrait l'un, le
   * client aurait lu l'autre.
   */
  it("la durée de chaque bloc correspond aux séquences de même nature", () => {
    for (const [slug, modules] of Object.entries(ENRICHISSEMENTS)) {
      for (const enrichi of modules) {
        const base = moduleCatalogue(slug, enrichi.moduleId)!;
        for (const bloc of ["objectif", "demonstration", "pratique", "verification", "synthese"]) {
          const attendu = base.sequences
            .filter((s) => s.type === bloc)
            .reduce((n, s) => n + (s.dureeMin ?? 0), 0);
          if (attendu === 0) continue; // nature absente du découpage publié
          const declare = (enrichi as unknown as Record<string, { dureeMin: number }>)[bloc]!
            .dureeMin;
          expect(
            declare,
            `${slug}/${enrichi.moduleId} — bloc « ${bloc} » : ${declare} min déclarées, ${attendu} min au programme publié`,
          ).toBe(attendu);
        }
      }
    }
  });

  it("les natures hors blocs ne sont jamais réclamées comme blocs", () => {
    // Garde de cohérence du modèle : `cadre` et `pause` consomment du temps de
    // module sans être des blocs, et ne doivent donc pas figurer dans le contenu
    // rédigé, sous peine de compter deux fois.
    for (const [slug, modules] of Object.entries(ENRICHISSEMENTS)) {
      for (const enrichi of modules) {
        for (const nature of NATURES_HORS_BLOCS) {
          expect(
            Object.hasOwn(enrichi, nature),
            `${slug}/${enrichi.moduleId} déclare un bloc « ${nature} »`,
          ).toBe(false);
        }
      }
    }
  });
});

describe("la couverture des objectifs vendus (indicateur 11)", () => {
  /**
   * 🔴 Le contrôle qui a révélé un défaut du MODÈLE, pas des formations : « IA
   * pour les RH » vend cinq objectifs et tient en quatre modules. Avec un seul
   * renvoi par module, un objectif restait mathématiquement découvert, et la
   * formation était déclarée impubliable alors qu'elle est complète.
   */
  it("chaque objectif vendu est couvert par au moins un module rédigé", () => {
    for (const [slug, modules] of Object.entries(ENRICHISSEMENTS)) {
      const formation = FORMATIONS_V2.find((f) => f.slugFr === slug)!;
      const couverts = new Set(
        modules.flatMap((m) => [
          m.objectif.objectifGlobalId,
          ...(m.objectif.objectifsSecondairesIds ?? []),
        ]),
      );
      for (const [i, libelle] of formation.objectifsFr.entries()) {
        expect(
          couverts.has(`obj-${i + 1}`),
          `${slug} — « ${libelle} » (obj-${i + 1}) n'est servi par aucun module`,
        ).toBe(true);
      }
    }
  });
});
