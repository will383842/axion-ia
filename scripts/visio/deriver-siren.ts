#!/usr/bin/env tsx
/**
 * Rattrapage du SIREN des fiches clients existantes (chantier visio, PR 2).
 *
 * Depuis la PR 2, `createClientAction` et `updateClientAction` écrivent le
 * SIREN dérivé du SIRET. Les fiches créées AVANT n'ont pas de SIREN (1 en
 * production le 28/09, mesuré). Ce script le leur donne.
 *
 * Règles :
 *   · essai à blanc PAR DÉFAUT : rien n'est écrit sans `--appliquer` ;
 *   · IDEMPOTENT : seules les fiches sans SIREN sont écrites, et la condition
 *     est dans la requête (`siren` vide au moment de l'écriture) ;
 *   · un SIREN déjà présent qui CONTREDIT le SIRET n'est jamais écrasé : il
 *     est compté à part, pour que Will tranche ;
 *   · aucune écriture SQL directe (Prisma seulement) ;
 *   · sortie en NOMBRES seulement : ni raison sociale, ni identifiant.
 *
 * N'importe que `src/**` : il peut être copié dans le conteneur du worker et
 * lancé avec `tsx`.
 *
 * Usage :
 *   pnpm exec tsx scripts/visio/deriver-siren.ts              # essai à blanc
 *   pnpm exec tsx scripts/visio/deriver-siren.ts --appliquer  # écriture réelle
 */

import { checkSiretFormat, sirenDuSiret } from "@/lib/siret";

/** Ce dont le rattrapage a besoin de la base — rien de plus. */
export interface BaseClientsSiren {
  client: {
    findMany(args: {
      where: { siret: { not: null } };
      select: { id: true; siret: true; siren: true };
      orderBy: { id: "asc" };
    }): Promise<Array<{ id: string; siret: string | null; siren: string | null }>>;
    updateMany(args: {
      where: { id: string; OR: Array<{ siren: null } | { siren: "" }> };
      data: { siren: string };
    }): Promise<{ count: number }>;
  };
}

export interface BilanSiren {
  /** Fiches portant un SIRET. */
  readonly examinees: number;
  /** Fiches dont le SIREN est déjà celui du SIRET. */
  readonly dejaJustes: number;
  /** Fiches sans SIREN, à compléter. */
  readonly aCompleter: number;
  /** Fiches effectivement complétées (0 en essai à blanc). */
  readonly completees: number;
  /** SIREN présent qui contredit le SIRET : jamais écrasé, à trancher par Will. */
  readonly contradictoires: number;
  /** SIRET mal formé en base : rien n'est dérivé d'une valeur fausse. */
  readonly siretInvalides: number;
}

export async function deriverSiren(
  db: BaseClientsSiren,
  options: { readonly appliquer: boolean },
): Promise<BilanSiren> {
  const fiches = await db.client.findMany({
    where: { siret: { not: null } },
    select: { id: true, siret: true, siren: true },
    orderBy: { id: "asc" },
  });

  let dejaJustes = 0;
  let aCompleter = 0;
  let completees = 0;
  let contradictoires = 0;
  let siretInvalides = 0;

  for (const fiche of fiches) {
    const controle = checkSiretFormat(fiche.siret ?? "");
    if (!controle.ok) {
      siretInvalides += 1;
      continue;
    }
    const derive = sirenDuSiret(controle.value);
    const actuel = fiche.siren ?? "";
    if (actuel === derive) {
      dejaJustes += 1;
      continue;
    }
    if (actuel !== "") {
      contradictoires += 1;
      continue;
    }
    aCompleter += 1;
    if (!options.appliquer) continue;
    // La condition « SIREN vide » est DANS la requête : si une saisie l'a
    // posé entre la lecture et l'écriture, on ne l'écrase pas.
    const r = await db.client.updateMany({
      where: { id: fiche.id, OR: [{ siren: null }, { siren: "" }] },
      data: { siren: derive },
    });
    completees += r.count;
  }

  return {
    examinees: fiches.length,
    dejaJustes,
    aCompleter,
    completees,
    contradictoires,
    siretInvalides,
  };
}

async function main(): Promise<void> {
  const appliquer = process.argv.includes("--appliquer");
  const { prisma } = await import("@/lib/prisma");
  console.log(
    appliquer
      ? "== SIREN DÉRIVÉ DU SIRET — écriture RÉELLE =="
      : "== SIREN DÉRIVÉ DU SIRET — essai à blanc (aucune écriture ; --appliquer pour écrire) ==",
  );
  const bilan = await deriverSiren(prisma as unknown as BaseClientsSiren, { appliquer });
  console.log(`fiches avec SIRET          : ${bilan.examinees}`);
  console.log(`SIREN déjà juste           : ${bilan.dejaJustes}`);
  console.log(`SIREN à compléter          : ${bilan.aCompleter}`);
  console.log(`SIREN complétés            : ${bilan.completees}`);
  console.log(
    `SIREN contraire au SIRET   : ${bilan.contradictoires}   ← jamais écrasé, à trancher`,
  );
  console.log(`SIRET mal formé            : ${bilan.siretInvalides}`);
  await prisma.$disconnect();
}

const lanceDirectement = /deriver-siren\.[cm]?[jt]s$/.test(process.argv[1] ?? "");
if (lanceDirectement) {
  main().catch((err: unknown) => {
    console.error("[deriver-siren] échec :", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
