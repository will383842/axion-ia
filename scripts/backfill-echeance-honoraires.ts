#!/usr/bin/env tsx
/**
 * Rattrapage des échéances de relevés d'honoraires manquantes.
 *
 * POURQUOI
 * --------
 * `TrainerStatement.echeanceAt` existe au schéma depuis le 2026-07-09
 * (migration `trainer_commissionnement`), **indexée**, et AUCUNE ligne de code
 * ne l'écrivait — vérifié le 2026-09-09. Tous les relevés passés en
 * « facture reçue » avant cette date portent donc `NULL`.
 *
 * ⚠️ CE SCRIPT N'EST PAS LE MÉCANISME PRINCIPAL, ET IL N'EST PAS NON PLUS UNE
 * CONDITION POUR QUE LE PILOTAGE SOIT JUSTE.
 *
 * Deux réparations le précèdent, et c'est voulu :
 *   1. `transitionStatementAction` pose désormais l'échéance au SEUL point
 *      d'entrée qui existe (le passage en `facture_recue`, qui exige déjà
 *      `dateFacture`) — donc toute la production à venir est correcte ;
 *   2. `echeanceEffective` retombe sur `dateFacture + 30 j` partout où la
 *      colonne manque — donc l'alerte `releve_formateur_echu` et l'écran
 *      « Ce qu'on doit » voient juste, script lancé ou non.
 *
 * Ce script sert à remettre la COLONNE en accord avec ce que le code calcule
 * déjà : une donnée indexée qui ment à 100 % finit par être lue par quelqu'un
 * qui ne connaît pas le repli. Contrairement aux factures clients, il n'a pas
 * de cron jumeau — et il n'en a pas besoin : il n'existe qu'UN chemin vers
 * `facture_recue`, alors que les factures clients en avaient six.
 *
 * MÉTHODE
 * -------
 * Échéance = `dateFacture` + 30 jours (clause 4 du contrat de sous-traitance),
 * via la même fonction pure que l'action — jamais une seconde arithmétique.
 *
 * IDEMPOTENT : ne touche QUE les lignes à `echeanceAt` NULL, et l'écriture est
 * conditionnée à cette même nullité.
 *
 * PÉRIMÈTRE, et ses exclusions volontaires :
 *   - relevés NON SOLDÉS uniquement (`valide`, `facture_recue`, `payeAt` nul) :
 *     dater après coup un relevé déjà payé réécrirait un historique comptable
 *     pour rien ;
 *   - relevés SANS `dateFacture` ignorés : sans facture il n'y a pas
 *     d'exigibilité, et lui en inventer une lui donnerait une ancienneté de
 *     dette devinée.
 *
 * USAGE
 *   pnpm backfill:echeance-honoraires            # simulation — n'écrit RIEN
 *   pnpm backfill:echeance-honoraires --apply    # exécute les mises à jour
 */

import { PrismaClient } from "../prisma/generated/client";
import {
  calculerEcheanceHonoraires,
  STATUTS_RELEVE_DU,
} from "../src/server/qualiopi/remuneration/echeance";

const prisma = new PrismaClient();

/** `--apply` écrit ; sans lui, simulation. Le défaut le plus sûr est l'inaction. */
const APPLY = process.argv.includes("--apply");

function jour(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  console.log(
    APPLY
      ? "[backfill-echeance-honoraires] MODE ÉCRITURE (--apply)"
      : "[backfill-echeance-honoraires] SIMULATION — aucune écriture. Ajouter --apply pour exécuter.",
  );

  const releves = await prisma.trainerStatement.findMany({
    where: {
      statut: { in: [...STATUTS_RELEVE_DU] },
      payeAt: null,
      echeanceAt: null,
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      statut: true,
      periodeYear: true,
      periodeMonth: true,
      numeroFacture: true,
      dateFacture: true,
      totalTtcCents: true,
      trainer: { select: { nom: true, prenom: true } },
    },
  });

  if (releves.length === 0) {
    console.log("[backfill-echeance-honoraires] Aucun relevé dû sans échéance. Rien à faire.");
    return;
  }

  console.log(`[backfill-echeance-honoraires] ${releves.length} relevé(s) sans échéance :`);

  let reparees = 0;
  let ignorees = 0;
  for (const r of releves) {
    const qui = `${r.trainer.prenom} ${r.trainer.nom}`.trim();
    const periode = `${String(r.periodeMonth).padStart(2, "0")}/${r.periodeYear}`;

    if (r.dateFacture === null) {
      console.log(
        `  - ${qui} ${periode} [${r.statut}] : IGNORÉ (pas de facture, donc pas d'exigibilité)`,
      );
      ignorees++;
      continue;
    }

    const echeance = calculerEcheanceHonoraires(r.dateFacture);
    console.log(
      `  - ${qui} ${periode} [${r.statut}] ${r.numeroFacture ?? "facture sans numéro"} : ` +
        `facture ${jour(r.dateFacture)} + 30 j → échéance ${jour(echeance)} ` +
        `(${(r.totalTtcCents / 100).toFixed(2)} € TTC)`,
    );

    if (APPLY) {
      const { count } = await prisma.trainerStatement.updateMany({
        where: { id: r.id, echeanceAt: null },
        data: { echeanceAt: echeance },
      });
      if (count === 0) {
        console.log(`      (déjà réparé entre-temps — aucune écriture)`);
        ignorees++;
        continue;
      }
    }
    reparees++;
  }

  console.log(
    APPLY
      ? `[backfill-echeance-honoraires] ${reparees} échéance(s) posée(s), ${ignorees} ignorée(s).`
      : `[backfill-echeance-honoraires] ${reparees} échéance(s) SERAIENT posée(s), ${ignorees} ignorée(s). Relancer avec --apply.`,
  );
}

main()
  .catch((err) => {
    console.error("[backfill-echeance-honoraires] échec :", err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
