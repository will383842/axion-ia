/**
 * Le contenu rédigé, tenu contre le catalogue.
 *
 * Deux fichiers décrivent la même formation par des gestes différents : ajuster
 * un minutage n'est pas réécrire une consigne. Ils divergeront donc, à moins que
 * quelque chose ne le refuse. C'est le rôle de ce fichier.
 *
 * ⚠️ Ce que ces tests couvrent est MÉCANIQUE : un renvoi vers le vide, deux
 * modules sur le même objectif, un doublon, un objectif vendu que rien ne sert.
 * Ils ne savent pas — et ne sauront jamais — dire si un module sert bien
 * l'objectif qu'il désigne. Ce contrôle-là reste humain ; voir le préambule du
 * bloc « l'intégrité des renvois d'objectif ».
 */

import { describe, it, expect } from "vitest";

import { ENRICHISSEMENTS } from "./index";
import type { EnrichissementModule } from "./types";
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

/**
 * Une seule assertion pour les vingt-deux formations.
 *
 * 🔴 Une boucle qui `expect` formation par formation s'arrête à la PREMIÈRE
 * fautive et laisse croire que les autres vont bien. C'est ainsi que la
 * régression du 15/08/2026 a été annoncée « 1 formation fautive » alors que les
 * vingt-deux l'étaient, et que cinquante-huit objectifs vendus ne servaient à
 * rien. On collecte donc TOUT, puis on assène le rapport complet en une fois :
 * un seul run doit suffire à connaître l'étendue exacte du dégât.
 *
 * L'assertion porte sur le NOMBRE et non sur le tableau : le rapport est déjà
 * dans le message, et le laisser reparaître dans le diff le rendrait illisible.
 */
function exigerAucuneAnomalie(anomalies: readonly string[]): void {
  expect(
    anomalies.length,
    anomalies.length === 0
      ? ""
      : `\n${anomalies.length} formation(s) en défaut — rapport complet :\n\n${anomalies.join("\n\n")}\n`,
  ).toBe(0);
}

/** Forme attendue d'un renvoi : le RANG de l'objectif dans `objectifsFr`. */
const FORME_RENVOI = /^obj-(\d+)$/;

/** Tous les renvois d'objectif d'un module, le principal en tête. */
function renvoisDe(enrichi: EnrichissementModule): ReadonlyArray<{ role: string; id: string }> {
  return [
    { role: "objectif principal", id: enrichi.objectif.objectifGlobalId },
    ...(enrichi.objectif.objectifsSecondairesIds ?? []).map((id) => ({
      role: "objectif secondaire",
      id,
    })),
  ];
}

/** Une formation rédigée, appariée à sa fiche catalogue. */
interface FormationRedigee {
  slug: string;
  modules: ReadonlyArray<EnrichissementModule>;
  objectifsFr: ReadonlyArray<string>;
}

/** Les formations rédigées, appariées à leur fiche catalogue. */
function formationsRedigees(): ReadonlyArray<FormationRedigee> {
  const paires: FormationRedigee[] = [];
  for (const [slug, modules] of Object.entries(ENRICHISSEMENTS)) {
    const formation = FORMATIONS_V2.find((f) => f.slugFr === slug);
    // Un slug inconnu au catalogue est déjà dénoncé par son propre test ; le
    // taire ici évite de faire rougir quatre tests pour une seule cause.
    if (formation === undefined) continue;
    paires.push({ slug, modules, objectifsFr: formation.objectifsFr });
  }
  return paires;
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

  /**
   * ⚠️ Ce test ne dit RIEN de la justesse du renvoi : il vérifie qu'il désigne
   * une case existante du tableau `objectifsFr` de SA formation, principal comme
   * secondaires. Un renvoi hors sujet — le module qui parle de confidentialité
   * et pointe l'objectif « produire un écrit publiable » — le passe au vert. La
   * pertinence est contrôlée par le test d'intégrité qui suit pour ce qui est
   * mécanique, et par une relecture humaine pour le reste.
   */
  it("tous les renvois d'objectif désignent un objectif vendu par leur formation", () => {
    const anomalies: string[] = [];
    for (const { slug, modules, objectifsFr } of formationsRedigees()) {
      const total = objectifsFr.length;
      const fautifs: string[] = [];
      for (const enrichi of modules) {
        for (const { role, id } of renvoisDe(enrichi)) {
          const rang = FORME_RENVOI.exec(id);
          if (rang === null) {
            fautifs.push(`${enrichi.moduleId} — ${role} « ${id} » n'a pas la forme obj-N`);
            continue;
          }
          const n = Number.parseInt(rang[1]!, 10);
          if (n < 1 || n > total) {
            fautifs.push(
              `${enrichi.moduleId} — ${role} « ${id} » désigne le rang ${n}, hors des ${total} objectifs vendus`,
            );
          }
        }
      }
      if (fautifs.length > 0) anomalies.push(`${slug} :\n    • ${fautifs.join("\n    • ")}`);
    }
    exigerAucuneAnomalie(anomalies);
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

/**
 * L'INTÉGRITÉ des renvois — ce qu'une machine peut trancher seule.
 *
 * 🔴 Ce que ces tests ne font PAS, et ne feront jamais : juger qu'un module SERT
 * bien l'objectif qu'il désigne. Aucun code ne sait lire « vous nommez le régime
 * d'usage adapté à chaque document RH » et dire si c'est l'objectif 3 ou
 * l'objectif 4 de la formation. Un test qui prétendrait le faire — par
 * mots-clés, par longueur commune, par n'importe quelle heuristique — rendrait
 * un vert qui ne vaut rien, et c'est un vert qui ne vaut rien qui a laissé la
 * corruption du 15/08/2026 passer : les identifiants existaient tous, donc tout
 * était vert, alors que les vingt-deux formations renvoyaient à une numérotation
 * disparue.
 *
 * **Le contrôle sémantique reste HUMAIN.** Toute renumérotation ou réécriture
 * des `objectifsFr` du catalogue impose de relire, module par module, l'énoncé
 * du bloc objectif contre la liste vendue. Ces tests ne dispensent pas de cette
 * relecture : ils garantissent seulement qu'aucune faute MÉCANIQUE — renvoi vers
 * le vide, deux modules sur le même objectif, doublon, objectif jamais servi —
 * ne s'y ajoute.
 */
describe("l'intégrité des renvois d'objectif (indicateurs 6 et 11)", () => {
  /**
   * Deux modules qui visent le même objectif principal laissent, par simple
   * arithmétique, un autre objectif sans module qui le porte. Ce n'est légitime
   * que si la formation compte PLUS de modules que d'objectifs vendus — cas
   * d'« IA pour l'industrie » — et jamais au-delà de ce surplus.
   */
  it("deux modules ne visent pas le même objectif principal sans nécessité", () => {
    const anomalies: string[] = [];
    for (const { slug, modules, objectifsFr } of formationsRedigees()) {
      const principaux = modules.map((m) => m.objectif.objectifGlobalId);
      const surplus = Math.max(0, modules.length - objectifsFr.length);
      const repetitions = principaux.length - new Set(principaux).size;
      if (repetitions <= surplus) continue;

      const partages = [...new Set(principaux)]
        .filter((id) => principaux.filter((p) => p === id).length > 1)
        .map((id) => {
          const porteurs = modules
            .filter((m) => m.objectif.objectifGlobalId === id)
            .map((m) => m.moduleId);
          return `« ${id} » est l'objectif principal de ${porteurs.join(", ")}`;
        });
      anomalies.push(
        `${slug} — ${modules.length} module(s) rédigé(s) pour ${objectifsFr.length} objectif(s) vendu(s) :` +
          ` ${surplus === 0 ? "aucune répétition n'est arithmétiquement justifiable" : `${surplus} répétition(s) tolérée(s) au plus`},` +
          ` ${repetitions} constatée(s).\n    • ${partages.join("\n    • ")}`,
      );
    }
    exigerAucuneAnomalie(anomalies);
  });

  /**
   * Un secondaire qui répète le principal, ou lui-même, gonfle la couverture
   * sans rien couvrir : le test de l'indicateur 11 verdirait sur du vent.
   */
  it("les objectifs secondaires ne répètent ni le principal ni eux-mêmes", () => {
    const anomalies: string[] = [];
    for (const { slug, modules } of formationsRedigees()) {
      const fautifs: string[] = [];
      for (const enrichi of modules) {
        const principal = enrichi.objectif.objectifGlobalId;
        const secondaires = enrichi.objectif.objectifsSecondairesIds ?? [];
        if (secondaires.includes(principal)) {
          fautifs.push(
            `${enrichi.moduleId} — « ${principal} » est à la fois son objectif principal et un de ses secondaires`,
          );
        }
        const doublons = [...new Set(secondaires.filter((id, i) => secondaires.indexOf(id) !== i))];
        if (doublons.length > 0) {
          fautifs.push(
            `${enrichi.moduleId} — objectif(s) secondaire(s) déclaré(s) deux fois : ${doublons.join(", ")}`,
          );
        }
      }
      if (fautifs.length > 0) anomalies.push(`${slug} :\n    • ${fautifs.join("\n    • ")}`);
    }
    exigerAucuneAnomalie(anomalies);
  });
});

describe("la couverture des objectifs vendus (indicateur 11)", () => {
  /**
   * 🔴 Le contrôle qui a révélé un défaut du MODÈLE, pas des formations : « IA
   * pour les RH » vend cinq objectifs et tient en quatre modules. Avec un seul
   * renvoi par module, un objectif restait mathématiquement découvert, et la
   * formation était déclarée impubliable alors qu'elle est complète. D'où les
   * objectifs secondaires — qui comptent, eux aussi, pour la couverture.
   *
   * Un objectif qui ressort ici n'est pas un renvoi à corriger : c'est un
   * objectif VENDU au client et au financeur que le programme ne tient pas. Le
   * rattacher en secondaire à un module qui ne le sert pas ferait taire le test
   * sans rien réparer, et transformerait une lacune en fausse déclaration.
   */
  it("chaque objectif vendu est couvert par au moins un module rédigé", () => {
    const anomalies: string[] = [];
    for (const { slug, modules, objectifsFr } of formationsRedigees()) {
      const couverts = new Set(modules.flatMap((m) => renvoisDe(m).map((r) => r.id)));
      const orphelins = objectifsFr
        .map((libelle, i) => ({ id: `obj-${i + 1}`, libelle }))
        .filter(({ id }) => !couverts.has(id));
      if (orphelins.length === 0) continue;
      anomalies.push(
        `${slug} — ${orphelins.length} objectif(s) vendu(s) sur ${objectifsFr.length} ne sont servis par aucun module :\n    • ` +
          orphelins.map(({ id, libelle }) => `${id} « ${libelle} »`).join("\n    • "),
      );
    }
    exigerAucuneAnomalie(anomalies);
  });
});
