#!/usr/bin/env tsx
// Rapport en LECTURE SEULE de la porte de qualité des pages de villes (28/11/2026).
// Liste chaque ville avec son verdict et ses raisons : Will voit l'effet avant d'allumer
// `VILLES_PORTE_QUALITE_ACTIVE`. N'écrit rien, ne change rien sur le site.
//   pnpm villes:rapport            → résumé + liste complète
//   pnpm villes:rapport --json     → JSON
//   pnpm villes:rapport --refus    → seulement les villes non publiables
import { rapportVilles } from "../../src/server/content-gen/villes/verdicts-villes";
import {
  BLOCS_FAITS_MIN,
  SEUIL_SIMILARITE_VILLES,
} from "../../src/server/content-gen/villes/porte-qualite-ville";

const args = new Set(process.argv.slice(2));
const lignes = rapportVilles();
const publiables = lignes.filter((l) => l.publiable);

if (args.has("--json")) {
  console.log(JSON.stringify(lignes, null, 2));
} else {
  console.log(
    `Porte de qualité des villes : ${publiables.length} publiable(s) sur ${lignes.length} ` +
      `(≥ ${BLOCS_FAITS_MIN} blocs sourcés, similarité ≤ ${SEUIL_SIMILARITE_VILLES}).`,
  );
  const comptes = new Map<string, number>();
  for (const l of lignes) {
    for (const r of l.raisons) {
      const cle = r.replace(/[\d.]+/g, "N").replace(/avec [a-z-]+ /, "avec X ");
      comptes.set(cle, (comptes.get(cle) ?? 0) + 1);
    }
  }
  console.log("\nRaisons de refus (nombre de villes) :");
  for (const [r, n] of [...comptes].sort((a, b) => b[1] - a[1])) console.log(`  ${n}\t${r}`);
  console.log("\nVille\tVerdict\tSimilarité max\tRaisons");
  for (const l of lignes) {
    if (args.has("--refus") && l.publiable) continue;
    console.log(
      `${l.slug}\t${l.publiable ? "PUBLIABLE" : "refusée"}\t${l.similariteMax.toFixed(2)}\t${l.raisons.join(" | ")}`,
    );
  }
}
