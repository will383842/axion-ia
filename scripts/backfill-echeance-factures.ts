#!/usr/bin/env tsx
/**
 * Rattrapage MASSIF des échéances de facture manquantes.
 *
 * POURQUOI
 * --------
 * Une facture émise sans `echeanceAt` est INVISIBLE du circuit de recouvrement :
 * le cron de retard sélectionne sur `echeanceAt < now`, et aucune comparaison SQL
 * n'est vraie pour NULL. Ni statut `en_retard`, ni relance proposée, ni alerte,
 * ni ligne dans le prévisionnel de trésorerie — la créance vieillit sans laisser
 * la moindre trace à l'écran.
 *
 * ⚠️ CE SCRIPT N'EST PAS LE MÉCANISME PRINCIPAL
 * ---------------------------------------------
 * La réparation est AUTOMATIQUE, dans le cron quotidien `handleFacturesRetard`
 * (`src/server/queue/workers/qualiopi-formation-crons-worker.ts`) : à chaque
 * passage, toute facture ouverte sans échéance en reçoit une, calculée par la
 * même fonction pure que celle utilisée ici. Un correctif qui suppose qu'on
 * pense à lancer un script à la main se rouvre au premier chemin de création
 * oublié.
 *
 * Ce script reste utile pour un rattrapage CONTRÔLÉ : voir en un coup d'œil ce
 * qui sera posé, sur quelles factures, avant que le cron ne le fasse — ou pour
 * réparer immédiatement sans attendre le passage du lendemain.
 *
 * MÉTHODE
 * -------
 * Échéance = `emiseAt` (repli `createdAt`) + délai de paiement du client
 * (repli 30 j), borné à [1, 60] jours par `calculerEcheanceFacture`.
 *
 * IDEMPOTENT : ne touche QUE les lignes à `echeanceAt` NULL, et l'écriture est
 * conditionnée à cette même nullité (aucune course avec le cron).
 *
 * PÉRIMÈTRE, et ses deux exclusions volontaires :
 *   - factures OUVERTES seulement (`emise`, `partiellement_payee`, `en_retard`) :
 *     un brouillon n'a pas d'échéance tant qu'il n'est pas émis, une facture
 *     payée ou annulée n'attend plus rien ;
 *   - hors AVOIRS (`avoirDeId`) : un avoir crédite, il ne réclame pas ;
 *   - hors REPRISES D'HISTORIQUE (`estImportee`) : ces lignes viennent d'un
 *     système tiers et sont déjà hors du circuit de relance. Leur inventer une
 *     date d'exigibilité leur donnerait une ancienneté de créance devinée.
 *
 * USAGE
 *   pnpm backfill:echeance             # simulation — n'écrit RIEN (défaut)
 *   pnpm backfill:echeance --apply     # exécute les mises à jour
 */

import { PrismaClient } from "../prisma/generated/client";
import { calculerEcheanceFacture } from "../src/server/qualiopi/financements/conditions-client";
import { STATUTS_FACTURE_OUVERTE } from "../src/server/qualiopi/financements/statuts-facture";

const prisma = new PrismaClient();

/** `--apply` écrit ; sans lui, simulation. Le défaut le plus sûr est l'inaction. */
const APPLY = process.argv.includes("--apply");

function jour(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  console.log(
    APPLY
      ? "[backfill-echeance] MODE ÉCRITURE (--apply)"
      : "[backfill-echeance] SIMULATION — aucune écriture. Ajouter --apply pour exécuter.",
  );

  const factures = await prisma.factureFormation.findMany({
    where: {
      statut: { in: [...STATUTS_FACTURE_OUVERTE] },
      echeanceAt: null,
      avoirDeId: null,
      estImportee: false,
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      numero: true,
      statut: true,
      emiseAt: true,
      createdAt: true,
      client: { select: { raisonSociale: true, delaiPaiementJours: true } },
    },
  });

  if (factures.length === 0) {
    console.log("[backfill-echeance] Aucune facture ouverte sans échéance. Rien à faire.");
    return;
  }

  console.log(`[backfill-echeance] ${factures.length} facture(s) sans échéance :`);

  let reparees = 0;
  let ignorees = 0;
  for (const f of factures) {
    const origine = f.emiseAt ?? f.createdAt;
    if (origine === null) {
      // Sans date d'origine, on ne devine rien : inventer un point de départ
      // inventerait l'ancienneté de la créance, donc le palier de relance.
      console.log(`  - ${f.numero} : IGNORÉE (ni emiseAt ni createdAt exploitable)`);
      ignorees++;
      continue;
    }

    const delai = f.client?.delaiPaiementJours ?? null;
    const echeance = calculerEcheanceFacture(origine, delai);
    const source = f.emiseAt !== null ? "emiseAt" : "createdAt";
    const delaiLabel = delai !== null ? `${delai} j (client)` : "30 j (défaut)";

    console.log(
      `  - ${f.numero} [${f.statut}] ${f.client?.raisonSociale ?? "client inconnu"} : ` +
        `${source} ${jour(origine)} + ${delaiLabel} → échéance ${jour(echeance)}`,
    );

    if (APPLY) {
      // `echeanceAt: null` dans le `where` : idempotent, et sans course avec le
      // cron quotidien qui répare les mêmes lignes.
      const { count } = await prisma.factureFormation.updateMany({
        where: { id: f.id, echeanceAt: null },
        data: { echeanceAt: echeance },
      });
      if (count === 0) {
        console.log(`      (déjà réparée entre-temps — aucune écriture)`);
        ignorees++;
        continue;
      }
    }
    reparees++;
  }

  console.log(
    APPLY
      ? `[backfill-echeance] TERMINÉ : ${reparees} échéance(s) posée(s), ${ignorees} ignorée(s).`
      : `[backfill-echeance] SIMULATION TERMINÉE : ${reparees} échéance(s) seraient posées, ${ignorees} ignorée(s). Relancer avec --apply.`,
  );
}

main()
  .catch((err: unknown) => {
    console.error("[backfill-echeance] ÉCHEC :", err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
