// Activation de la « valeur métier » content-gen (one-shot prod, décision Will 2026-06-25).
//
// Réveille la chaîne pain-matrix + benefit-gate restée DORMANTE (audit 2026-06-25 §C.1) :
//   1. config DB `benefit_gate` → { enabled:true, llmJudge:false, minScore:70 }
//      (gate « bénéfice concret », COMMERCIAL-only, fail-open, llmJudge OFF = pas de coût).
//   2. backfill `targetSecteurWeights` sur les CoverageCampaign qui n'en ont pas
//      → les jobs portent enfin `targetSecteur` → la pain-matrix s'injecte dans les prompts.
//
// ⚠️ SÉCURITÉ ANTI-RÉGRESSION : ces 2 changements sont TOTALEMENT INERTES tant que
// l'env `QUALITY_PROFILES_ENABLED=true` (Coolify web+worker) n'est PAS posé — sans ce
// flag, `qualityProfile=null` → `benefitGateActive=false` → AUCUN gate, AUCUNE injection
// (cf. content-gen-worker.ts:762). Donc lancer ce script ne change RIEN au comportement
// tant que Will n'a pas activé le flag (geste réversible). Quand le flag est posé :
//   - pain-matrix injectée dans les prompts COMMERCIAUX → contenu plus différencié (upside) ;
//   - les contenus COMMERCIAUX (9 types : comparison/vs/alternative/top-x/roi/how-to/
//     best-for/pain-point/case-study) au bénéfice trop faible (<70) partent en
//     `needs_review` (PAS supprimés, récupérables) ; informational/AEO/blog/faq/guides =
//     JAMAIS gatés. throughput borné, pas de halt.
//
// Usage :
//   pnpm tsx scripts/activate-content-gen-value-metier.ts          # DRY-RUN
//   pnpm tsx scripts/activate-content-gen-value-metier.ts --apply  # applique
//
// En prod : exécuter DANS le conteneur. PUIS poser `QUALITY_PROFILES_ENABLED=true`
// sur Coolify (web + worker) + redeploy pour activer réellement.

import { existsSync, readFileSync } from "node:fs";
import { PrismaClient } from "../prisma/generated/client";

if (!process.env["DATABASE_URL"] && existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
}

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();

// Les 10 `Secteur` du SSOT sector-pain-matrix.ts (miroir du seed sector-campaigns.ts).
const DEFAULT_SECTEUR_WEIGHTS: Record<string, number> = {
  comptabilite_finance: 15,
  btp_immobilier: 12,
  commerce_retail: 12,
  industrie_logistique: 12,
  sante_medecine: 10,
  rh_recrutement: 10,
  juridique: 8,
  restauration_hotellerie: 8,
  artisanat_services: 8,
  collectivites_public: 5,
};

const BENEFIT_GATE_VALUE = { enabled: true, llmJudge: false, minScore: 70 };

async function main() {
  console.log(
    `\n=== Activation valeur métier content-gen ===  mode: ${APPLY ? "APPLY" : "DRY-RUN"}\n`,
  );

  // 1. Config benefit_gate.
  const existing = await prisma.contentGenConfig.findUnique({ where: { key: "benefit_gate" } });
  console.log(
    "benefit_gate actuel :",
    existing ? JSON.stringify(existing.value) : "(absent → défaut enabled:false)",
  );
  console.log("benefit_gate cible  :", JSON.stringify(BENEFIT_GATE_VALUE));

  // 2. Campagnes sans targetSecteurWeights.
  const campaigns = await prisma.coverageCampaign.findMany({
    select: { id: true, name: true, status: true, targetSecteurWeights: true },
  });
  const missing = campaigns.filter(
    (c) =>
      c.targetSecteurWeights == null || Object.keys(c.targetSecteurWeights as object).length === 0,
  );
  console.log(
    `\nCampagnes : ${campaigns.length} total, ${missing.length} sans targetSecteurWeights :`,
  );
  for (const c of missing) console.log(`  - ${c.name} [${c.status}]`);

  if (!APPLY) {
    console.log(
      `\nDRY-RUN : benefit_gate serait posé à enabled:true + ${missing.length} campagne(s) backfillée(s). ` +
        `Relancer avec --apply.\n` +
        `RAPPEL : INERTE tant que QUALITY_PROFILES_ENABLED=true n'est pas posé sur Coolify.\n`,
    );
    return;
  }

  // APPLY — benefit_gate config (upsert direct ; pas de session admin en script).
  await prisma.contentGenConfig.upsert({
    where: { key: "benefit_gate" },
    create: {
      key: "benefit_gate",
      value: BENEFIT_GATE_VALUE as never,
      description: "Benefit-gate activé (script activate-content-gen-value-metier 2026-06-25)",
      updatedBy: "system:script",
    },
    update: { value: BENEFIT_GATE_VALUE as never, updatedBy: "system:script" },
  });
  console.log("\n✅ benefit_gate → enabled:true (llmJudge:false, minScore:70).");

  // APPLY — backfill campagnes.
  let n = 0;
  for (const c of missing) {
    await prisma.coverageCampaign.update({
      where: { id: c.id },
      data: { targetSecteurWeights: DEFAULT_SECTEUR_WEIGHTS as never },
    });
    n++;
  }
  console.log(`✅ ${n} campagne(s) backfillée(s) avec targetSecteurWeights.`);
  console.log(
    `\n➡️  ÉTAPE FINALE (Will) : poser QUALITY_PROFILES_ENABLED=true sur Coolify (web + worker) ` +
      `+ redeploy. Réversible (unset = retour comportement actuel).\n`,
  );
}

main()
  .catch((e) => {
    console.error("ERREUR :", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
