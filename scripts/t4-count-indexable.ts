/**
 * t4-count-indexable.ts — Audit Will 2026-05-28.
 * Compte précisément le volume de pages indexables (FR-only, EN désactivé).
 */
import { VILLES, getIndexableVilles } from "../src/content/villes";
import { getIndexableRegions, REGIONS } from "../src/content/regions";

function main() {
  const villes = VILLES.length;
  const indexableVilles = getIndexableVilles();
  const hubVilles = indexableVilles.length;

  // Services × villes : seulement villes avec copy.services.<svc> (long-form)
  const svcAudit = indexableVilles.filter((v) => !!v.copy?.services?.audit).length;
  const svcInter = indexableVilles.filter((v) => !!v.copy?.services?.interventions).length;
  const svcImpl = indexableVilles.filter((v) => !!v.copy?.services?.implementation).length;
  const svcUnAUn = indexableVilles.filter((v) => !!v.copy?.services?.unAUn).length;
  const svcTotal = svcAudit + svcInter + svcImpl + svcUnAUn;

  const regionsTotal = REGIONS.length;
  const regionsIndexable = getIndexableRegions().length;

  // Distribution villes par population tier
  const t1 = indexableVilles.filter((v) => v.population >= 100_000).length;
  const t2 = indexableVilles.filter((v) => v.population >= 20_000 && v.population < 100_000).length;
  const t3 = indexableVilles.filter((v) => v.population >= 10_000 && v.population < 20_000).length;
  const t4 = indexableVilles.filter((v) => v.population < 10_000).length;

  console.log("=== VOLUME INDEXABLE (FR-only, EN désactivé) ===\n");
  console.log(`Villes totales (VILLES)           : ${villes}`);
  console.log(`Hub villes indexables (avec copy) : ${hubVilles}`);
  console.log(`  dont T1 (pop ≥ 100k)            : ${t1}`);
  console.log(`  dont T2 (20k–100k)              : ${t2}`);
  console.log(`  dont T3 (10k–20k)               : ${t3}`);
  console.log(`  dont T4 (< 10k)                 : ${t4}`);
  console.log(`\nServices × villes (long-form copy.services) :`);
  console.log(`  audit/par-ville                 : ${svcAudit}`);
  console.log(`  interventions/par-ville         : ${svcInter}`);
  console.log(`  implementation/par-ville        : ${svcImpl}`);
  console.log(`  un-a-un/par-ville               : ${svcUnAUn}`);
  console.log(`  SOUS-TOTAL services×villes      : ${svcTotal}`);
  console.log(`\nRégions totales                   : ${regionsTotal}`);
  console.log(`Régions indexables                : ${regionsIndexable}`);
  console.log(`\n--- ESTIMATION TOTAL pSEO INDEXABLE (FR) ---`);
  console.log(`Hub villes + services×villes + régions = ${hubVilles + svcTotal + regionsIndexable}`);
}

main();
