/**
 * Rejoue le journal des effacements (`effacements_journal`) APRÈS UNE
 * RESTAURATION de la base (chantier visio, PR 8 ; ADR 0056).
 *
 * Une sauvegarde prise avant un effacement RGPD ramène la personne effacée :
 * ses paroles, les faits dont elle est sujet, son nom dans le dossier client.
 * Ce script ré-efface tout ce que le journal désigne, de façon idempotente.
 * Procédure : `docs/runbooks/R33-disaster-recovery-cold-start.md`, étape
 * « Rejouer les effacements ».
 *
 * Usage (dans le conteneur worker, qui a `DATABASE_URL`) :
 *   npx tsx scripts/rgpd-rejouer-effacements.ts             # À BLANC : compte, n'écrit rien
 *   npx tsx scripts/rgpd-rejouer-effacements.ts --appliquer # ré-efface
 *
 * Sortie en NOMBRES seulement : aucun identifiant, aucun contenu.
 */

import { rejouerEffacements } from "@/lib/rgpd-erase";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const inconnus = args.filter((a) => a !== "--appliquer");
  if (inconnus.length > 0) {
    console.error(`✗ Option inconnue : ${inconnus.join(" ")}. Rien n'a été fait.`);
    process.exit(1);
  }
  const appliquer = args.includes("--appliquer");
  const r = await rejouerEffacements({ appliquer });
  console.log(`Mode                         : ${appliquer ? "RÉ-EFFACEMENT" : "À BLANC"}`);
  console.log(`Lignes du journal lues       : ${r.lues}`);
  console.log(`Cibles revenues (restaurées) : ${r.reappliquees}`);
  if (!appliquer && r.reappliquees > 0) {
    console.log("\nÀ blanc : rien n'a été écrit. Relancer avec --appliquer pour ré-effacer.");
  }
}

void main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    // Jamais le message brut : il pourrait contenir une donnée restaurée.
    console.error(`✗ Échec : ${e instanceof Error ? e.name : "erreur inconnue"}`);
    process.exit(1);
  });
