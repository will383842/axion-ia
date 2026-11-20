/**
 * Score IA TPE-PME — snapshot de comparaison (clé `score-ia-pme-v1`).
 *
 * D-B (Williams, 20/11/2026) : la comparaison n'utilise QUE les réponses
 * `source = score-ia-pme`. AUCUNE réponse déjà présente dans l'Observatoire
 * (toute autre source, seed ou non) n'entre dans le calcul.
 *
 * Contenu publié : pourcentages entiers par tranche de 10 points ; aucun effectif
 * par tranche, aucune ligne, aucun croisement, aucune région.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "../../../prisma/generated/client";
import { calculerScore, tranche } from "@/lib/score-ia-pme/formule";
import {
  N_MIN_COMPARAISON,
  SCORE_VERSION,
  SNAPSHOT_KEY_SCORE,
  SOURCE_SCORE,
} from "@/lib/score-ia-pme/constantes";
import { MIN_SEGMENT_N } from "./snapshot";

export interface SegmentScore {
  readonly n: number;
  /** 10 pourcentages entiers (somme 100), tranches 0-9 … 90-100. */
  readonly pctParTranche: number[];
}

export interface SnapshotScore {
  readonly version: string;
  readonly genereLe: string;
  readonly global: SegmentScore | null;
  readonly parTaille: Record<string, SegmentScore>;
  readonly parSecteur: Record<string, SegmentScore>;
}

const PAGE = 5000;

/** Répartition en pourcentages entiers dont la somme vaut exactement 100 (plus fort reste). */
function pourcentages(effectifs: number[], n: number): number[] {
  const brut = effectifs.map((c) => (c * 100) / n);
  const bas = brut.map(Math.floor);
  let reste = 100 - bas.reduce((a, b) => a + b, 0);
  const ordre = brut
    .map((v, i) => ({ i, f: v - Math.floor(v) }))
    .sort((a, b) => b.f - a.f || a.i - b.i);
  for (const { i } of ordre) {
    if (reste <= 0) break;
    bas[i] = (bas[i] ?? 0) + 1;
    reste -= 1;
  }
  return bas;
}

function construire(effectifs: number[], n: number, seuil: number): SegmentScore | null {
  return n >= seuil ? { n, pctParTranche: pourcentages(effectifs, n) } : null;
}

export async function calculerSnapshotScore(): Promise<SnapshotScore> {
  const seuil = Math.max(MIN_SEGMENT_N, N_MIN_COMPARAISON);
  const vide = () => Array<number>(10).fill(0);
  const glob = vide();
  let nGlob = 0;
  const taille = new Map<string, { n: number; t: number[] }>();
  const secteur = new Map<string, { n: number; t: number[] }>();

  let curseur: string | undefined;
  for (;;) {
    const lignes = await prisma.barometerResponse.findMany({
      // D-B : uniquement les réponses données au Score (case cochée).
      where: { source: SOURCE_SCORE },
      select: {
        id: true,
        companySize: true,
        sector: true,
        maturityLevel: true,
        hasStrategy: true,
        useCases: true,
        tools: true,
        teamTrained: true,
        timeSavedPerDay: true,
        annualBudget: true,
      },
      orderBy: { id: "asc" },
      take: PAGE,
      ...(curseur ? { cursor: { id: curseur }, skip: 1 } : {}),
    });
    if (lignes.length === 0) break;

    for (const l of lignes) {
      let t: number;
      try {
        t = tranche(
          calculerScore({
            maturityLevel: l.maturityLevel,
            hasStrategy: l.hasStrategy,
            useCases: Array.isArray(l.useCases) ? (l.useCases as string[]) : [],
            teamTrained: l.teamTrained,
            timeSavedPerDay: l.timeSavedPerDay,
            annualBudget: l.annualBudget,
            tools: Array.isArray(l.tools) ? (l.tools as string[]) : [],
          }).score,
        );
      } catch {
        continue; // ligne à valeur inconnue : ignorée, jamais bloquante
      }
      glob[t] = (glob[t] ?? 0) + 1;
      nGlob += 1;
      for (const [map, cle] of [
        [taille, String(l.companySize)],
        [secteur, l.sector],
      ] as const) {
        const e = map.get(cle) ?? { n: 0, t: vide() };
        e.n += 1;
        e.t[t] = (e.t[t] ?? 0) + 1;
        map.set(cle, e);
      }
    }
    curseur = lignes[lignes.length - 1]?.id;
    if (lignes.length < PAGE) break;
  }

  const segments = (m: Map<string, { n: number; t: number[] }>): Record<string, SegmentScore> => {
    const out: Record<string, SegmentScore> = {};
    for (const [cle, { n, t }] of m) {
      const s = construire(t, n, seuil);
      if (s) out[cle] = s; // segment sous le seuil : ABSENT (pas mis à zéro)
    }
    return out;
  };

  const payload: SnapshotScore = {
    version: SCORE_VERSION,
    genereLe: new Date().toISOString(),
    global: construire(glob, nGlob, seuil),
    parTaille: segments(taille),
    parSecteur: segments(secteur),
  };

  const json = payload as unknown as Prisma.InputJsonValue;
  await prisma.barometerSnapshot.upsert({
    where: { key: SNAPSHOT_KEY_SCORE },
    create: { key: SNAPSHOT_KEY_SCORE, totalResponses: nGlob, payload: json },
    update: { totalResponses: nGlob, payload: json, computedAt: new Date() },
  });
  return payload;
}

/** Lit le snapshot du Score ; `null` si absent ou sous le stub de build. */
export async function lireSnapshotScore(): Promise<SnapshotScore | null> {
  const row = await prisma.barometerSnapshot.findUnique({ where: { key: SNAPSHOT_KEY_SCORE } });
  return row ? (row.payload as unknown as SnapshotScore) : null;
}
