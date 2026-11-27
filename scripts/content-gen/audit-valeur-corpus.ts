#!/usr/bin/env tsx
/**
 * Fiche C2b — audit LECTURE SEULE du corpus publié (articles et pages villes) :
 * faible valeur, sans impressions, doublons de plan. SIGNALEMENTS POUR UN HUMAIN :
 * ce script ne pose aucun noindex, ne supprime rien, ne fusionne rien.
 *
 * Usage : pnpm tsx scripts/content-gen/audit-valeur-corpus.ts [--json]
 */
import { chargerAuditCorpus } from "@/server/content-gen/mesures/lecture-audit-valeur-corpus";
import { formaterRapportCorpus } from "@/server/content-gen/mesures/audit-valeur-corpus";

async function main(): Promise<void> {
  const rapport = await chargerAuditCorpus();
  console.log(
    process.argv.includes("--json")
      ? JSON.stringify(rapport, null, 2)
      : formaterRapportCorpus(rapport),
  );
}

main().then(
  () => process.exit(0),
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  },
);
