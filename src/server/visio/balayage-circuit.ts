/**
 * Le BALAYAGE du circuit de compte rendu (toutes les 5 minutes, file `visio`).
 *
 *   1. ENTRÉE dans le circuit : un enregistrement `depose` sans étape
 *      `transcrire` la reçoit ; un enregistrement non confirmé, abandonné ou
 *      validé qui garde du son reçoit `purger_audio`. Un REFUS n'est pas
 *      repris ici : la PR 5 le purge elle-même (`reprendrePurgesDesRefus`) —
 *      une seule responsabilité par cas ;
 *   2. VERROUS EXPIRÉS (worker tué, mémoire) : l'étape repasse `a_faire`, sans
 *      compter d'échec (le plafond de 10 exécutions borne la boucle) ;
 *   3. AUDIO : purge programmée à l'échéance (`audioAPurgerAvant`, 30 jours
 *      au plus) ; ALERTE si un son la dépasse d'une heure ;
 *   4. PLAFOND : une suspension `plafond` reprend dès que le plafond le
 *      permet (1er du mois, ou plafond relevé) — jamais une suspension
 *      `quota` ni `configuration` (reprise manuelle) ;
 *   5. ÉTAPES DUES : rendues au worker pour être mises en file.
 *
 * « Ni compte rendu ni enregistrement déposé » après un rendez-vous tenu
 * n'est PAS une alerte de plus : c'est la pastille « À faire le point » qui
 * existe déjà (audit anti-doublon A3).
 */

import type { EtapeVisio, PrismaClient } from "../../../prisma/generated/client";
import { CODES_ALERTES_CIRCUIT } from "./alertes-circuit";
import type { AlerteCircuit } from "./etapes";
import type { PortCout } from "./openai/cout";
import { audioEnRetard } from "./purge-audio";
import { planifierDans } from "./prise-d-etape";

export interface EtapeDue {
  readonly id: string;
  readonly rencontreId: string;
  readonly etape: EtapeVisio;
}

export interface BilanBalayage {
  readonly entrees: number;
  readonly purgesProgrammees: number;
  readonly verrousLiberes: number;
  readonly audiosEnRetard: number;
  readonly reprisesPlafond: number;
  readonly dues: readonly EtapeDue[];
}

type Db = Pick<
  PrismaClient,
  "$queryRaw" | "$executeRaw" | "$transaction" | "enregistrement" | "traitementVisio"
>;

export async function balayerCircuit(
  db: Db,
  deps: {
    readonly cout: PortCout;
    readonly alerter: (a: AlerteCircuit) => Promise<void>;
    readonly maintenant: () => Date;
  },
  filtreRencontre: string | null = null,
): Promise<BilanBalayage> {
  const maintenant = deps.maintenant();
  let entrees = 0;
  let purgesProgrammees = 0;
  let audiosEnRetard = 0;
  let reprisesPlafond = 0;

  if (filtreRencontre === null) {
    // 1. Entrées.
    const deposes = await db.$queryRaw<Array<{ rencontre_id: string }>>`
      SELECT DISTINCT e."rencontre_id" FROM "enregistrements" e
       WHERE e."statut" = 'depose'
         AND NOT EXISTS (SELECT 1 FROM "traitements_visio" t
                          WHERE t."rencontre_id" = e."rencontre_id" AND t."etape" = 'transcrire')`;
    const aPurger = await db.$queryRaw<Array<{ rencontre_id: string }>>`
      SELECT DISTINCT e."rencontre_id" FROM "enregistrements" e
       WHERE e."audio_supprime_le" IS NULL
         AND (e."statut" IN ('accord_non_confirme', 'abandonne', 'valide')
              OR e."audio_a_purger_avant" <= (now() AT TIME ZONE 'UTC'))
         AND EXISTS (SELECT 1 FROM "enregistrement_tranches" tr WHERE tr."enregistrement_id" = e."id")`;
    await db.$transaction(async (tx) => {
      for (const r of deposes) {
        await planifierDans(tx, r.rencontre_id, { etape: "transcrire", compteRenduId: null });
        entrees += 1;
      }
      for (const r of aPurger) {
        await planifierDans(tx, r.rencontre_id, {
          etape: "purger_audio",
          compteRenduId: null,
          reinitialiser: true,
        });
        purgesProgrammees += 1;
      }
    });

    // 3. Audio en retard sur son échéance.
    const echus = await db.enregistrement.findMany({
      where: { audioSupprimeLe: null, audioAPurgerAvant: { lt: maintenant } },
      select: { id: true, rencontreId: true, audioAPurgerAvant: true, audioSupprimeLe: true },
    });
    for (const e of echus) {
      if (!audioEnRetard({ ...e, maintenant })) continue;
      audiosEnRetard += 1;
      await deps.alerter({
        code: CODES_ALERTES_CIRCUIT.audioNonPurge,
        niveau: "critique",
        titre: "Le son d'un rendez-vous n'a pas été supprimé à son échéance",
        message: `Enregistrement ${e.id} : échéance du ${e.audioAPurgerAvant!.toISOString().slice(0, 10)} dépassée. La purge est reprogrammée ; vérifier R2 si l'alerte revient.`,
        rencontreId: e.rencontreId,
      });
    }

    // 4. Plafond : reprise automatique si la dépense le permet de nouveau.
    const suspenduesPlafond = await db.traitementVisio.count({
      where: { statut: "suspendu", classeErreur: "plafond" },
    });
    if (suspenduesPlafond > 0) {
      try {
        await deps.cout.verifierPlafond(0);
        reprisesPlafond = await db.$executeRaw`
          UPDATE "traitements_visio" SET "statut" = 'a_faire', "classe_erreur" = NULL, "derniere_erreur" = NULL,
                 "prochaine_tentative_le" = NULL
           WHERE "statut" = 'suspendu' AND "classe_erreur" = 'plafond'`;
      } catch {
        // toujours au plafond : on attend.
      }
    }
  }

  // 2. Verrous expirés.
  const verrousLiberes = await db.$executeRaw`
    UPDATE "traitements_visio"
       SET "statut" = 'a_faire', "verrou_jusqua" = NULL, "interruptions" = "interruptions" + 1
     WHERE "statut" = 'en_cours' AND "verrou_jusqua" < (now() AT TIME ZONE 'UTC')`;

  // 5. Étapes dues.
  const dues =
    filtreRencontre === null
      ? await db.$queryRaw<Array<{ id: string; rencontre_id: string; etape: EtapeVisio }>>`
          SELECT "id", "rencontre_id", "etape" FROM "traitements_visio"
           WHERE "statut" = 'a_faire'
             AND ("prochaine_tentative_le" IS NULL OR "prochaine_tentative_le" <= (now() AT TIME ZONE 'UTC'))
           ORDER BY "prochaine_tentative_le" NULLS FIRST
           LIMIT 200`
      : await db.$queryRaw<Array<{ id: string; rencontre_id: string; etape: EtapeVisio }>>`
          SELECT "id", "rencontre_id", "etape" FROM "traitements_visio"
           WHERE "statut" = 'a_faire' AND "rencontre_id" = ${filtreRencontre}::uuid
             AND ("prochaine_tentative_le" IS NULL OR "prochaine_tentative_le" <= (now() AT TIME ZONE 'UTC'))`;

  return {
    entrees,
    purgesProgrammees,
    verrousLiberes,
    audiosEnRetard,
    reprisesPlafond,
    dues: dues.map((d) => ({ id: d.id, rencontreId: d.rencontre_id, etape: d.etape })),
  };
}
