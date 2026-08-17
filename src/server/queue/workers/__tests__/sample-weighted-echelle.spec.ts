/**
 * Verrou — le tirage pondéré de l'orchestrateur doit être INDIFFÉRENT À
 * L'ÉCHELLE des poids (audit GEO/AEO end-to-end du 2026-08-14).
 *
 * ## Le défaut que ce fichier existe pour empêcher
 *
 * `sampleWeighted` calculait `position = (slotIndex + seed) % total` avec
 * `total` = somme BRUTE des poids. Quand cette somme vaut 1 — le cas de la
 * PRODUCTION, qui stocke ses répartitions en fractions (cf.
 * `intent-distribution-schema.ts` : « la production les stocke en fractions de
 * somme 1 ») — `(entier) % 1` vaut 0 pour tout slot : la position ne bouge
 * jamais et la PREMIÈRE clé de l'objet gagne à chaque tirage.
 *
 * Conséquence en production : toute campagne sans `searchIntentMix` propre
 * reçoit le `globalIntentMix`, dont `informational` est la première clé →
 * 100 % d'informational dès le premier tick, sans la moindre erreur levée.
 *
 * ## Pourquoi on teste par `sampleTargetSecteur`
 *
 * `sampleWeighted` est privée. Plutôt que de l'exporter pour les besoins du
 * test — ce qui reviendrait à élargir la surface publique pour se rassurer —
 * on la teste à travers `sampleTargetSecteur`, qui est déjà exportée et n'est
 * qu'un passe-plat vers elle (seed 53). Le défaut est observable de l'extérieur ;
 * la garde l'observe de l'extérieur.
 */

import { describe, it, expect, vi } from "vitest";

// ─── Harnais d'import (identique aux autres specs de ce dossier) ──────────────
// Importer l'orchestrateur tire Prisma, BullMQ et la chaîne de configuration ;
// sans ces bouchons, le module ne se charge pas sous Vitest. Aucun d'eux ne
// touche au tirage lui-même, qui est une fonction pure.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    coverageCampaign: { findMany: vi.fn(), update: vi.fn() },
    contentGenJob: {
      create: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      aggregate: vi.fn(),
    },
    cityGenerationOrder: { findMany: vi.fn() },
  },
}));
vi.mock("@/server/actions/content-gen/_settings", () => ({
  readContentGenConfig: vi.fn(),
}));
vi.mock("@/server/content-gen/config-store", () => ({
  readKillSwitchFailSafe: vi.fn(async () => ({ active: false })),
}));
vi.mock("@/server/content-gen/shared/content-gen-alerts", () => ({
  alertCampaignDone: vi.fn(),
}));
vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));
vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({ add: vi.fn() })),
  Worker: vi.fn().mockImplementation(() => ({ on: vi.fn(), close: vi.fn() })),
}));

import { sampleTargetSecteur } from "../content-orchestrator-worker";

/** Compte les clés rendues sur un cycle complet de 100 slots. */
function repartitionSur100(poids: Record<string, number>): Record<string, number> {
  const compte: Record<string, number> = {};
  for (let slot = 0; slot < 100; slot++) {
    const clef = sampleTargetSecteur(poids, slot);
    if (clef) compte[clef] = (compte[clef] ?? 0) + 1;
  }
  return compte;
}

describe("tirage pondéré — poids en FRACTIONS (le cas de la production)", () => {
  it("🔴 une somme de 1 ne doit PAS figer le tirage sur la première clé", () => {
    const compte = repartitionSur100({ sante: 0.6, btp: 0.4 });

    // Avant correctif : { sante: 100 } — la seconde clé n'était jamais tirée.
    expect(
      Object.keys(compte).sort(),
      "les deux clés doivent être tirées ; n'en voir qu'une signifie que le " +
        "modulo est retombé sur 0 à chaque slot (poids en fractions).",
    ).toEqual(["btp", "sante"]);
    expect(compte.sante).toBe(60);
    expect(compte.btp).toBe(40);
  });

  it("une somme de 1 sur trois clés respecte les proportions", () => {
    const compte = repartitionSur100({ a: 0.5, b: 0.3, c: 0.2 });
    expect(compte).toEqual({ a: 50, b: 30, c: 20 });
  });

  it("la première clé déclarée n'est pas privilégiée quand elle est minoritaire", () => {
    // Ordre d'insertion volontairement « petit poids d'abord » : c'est
    // exactement la configuration où le défaut était le plus trompeur, puisqu'il
    // rendait 100 % d'une clé qui ne pesait que 10 %.
    const compte = repartitionSur100({ minoritaire: 0.1, majoritaire: 0.9 });
    expect(compte.minoritaire).toBe(10);
    expect(compte.majoritaire).toBe(90);
  });
});

describe("tirage pondéré — non-régression des poids en POURCENTAGES", () => {
  // Le correctif doit être neutre sur la somme 100 : `(w / 100) * 100 === w`,
  // et le modulo portait déjà sur 100. Toute dérive ici serait une régression
  // silencieuse sur les campagnes seedées (`DEFAULT_INTENT_MIX`).
  it("une somme de 100 rend exactement la même répartition", () => {
    expect(repartitionSur100({ sante: 60, btp: 40 })).toEqual({ sante: 60, btp: 40 });
  });

  it("la séquence slot par slot est celle d'origine (seed 53, modulo 100)", () => {
    const poids = { sante: 60, btp: 40 };
    for (let slot = 0; slot < 100; slot++) {
      const attendu = (slot + 53) % 100 < 60 ? "sante" : "btp";
      expect(sampleTargetSecteur(poids, slot), `slot ${slot}`).toBe(attendu);
    }
  });
});

describe("tirage pondéré — échelles arbitraires et entrées abîmées", () => {
  it("des poids relatifs quelconques donnent les bonnes proportions", () => {
    // 3:1 exprimé en « 3 et 1 » (somme 4) : ni pourcentage, ni fraction.
    const compte = repartitionSur100({ a: 3, b: 1 });
    expect(compte.a).toBe(75);
    expect(compte.b).toBe(25);
  });

  it("une somme nulle ne tire rien plutôt que de tirer au hasard", () => {
    expect(sampleTargetSecteur({ a: 0, b: 0 }, 7)).toBeNull();
  });

  it("un poids NaN ne fait pas passer une configuration abîmée pour valide", () => {
    // `total <= 0` laissait passer NaN (toute comparaison avec NaN est fausse),
    // et le tirage rendait alors la dernière clé par défaut. `!(total > 0)`
    // attrape les deux cas.
    expect(sampleTargetSecteur({ a: Number.NaN, b: 1 }, 7)).toBeNull();
  });

  it("un dictionnaire vide ou absent ne tire rien", () => {
    expect(sampleTargetSecteur({}, 3)).toBeNull();
    expect(sampleTargetSecteur(null, 3)).toBeNull();
  });
});
