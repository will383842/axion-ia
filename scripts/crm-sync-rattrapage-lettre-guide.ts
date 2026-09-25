/**
 * Rattrapage CRM de la LETTRE et du GUIDE (lot L4-S, 2026-09-25).
 *
 * Transmet au CRM ce que le geste en direct n'a pas transmis :
 *   · les demandes du guide CLIQUÉES avant l'ouverture de `CRM_SYNC_GUIDE_ENABLED`
 *     (`lead_magnet_requested`, et l'inscription à la lettre qui va avec) ;
 *   · les abonnés inscrits à l'adresse VÉRIFIÉE jamais transmis
 *     (`newsletter_optin`).
 * La logique vit dans `src/server/crm-sync/rattrapage-lettre-guide.ts` (testée) ;
 * ce fichier ne fait que lire les arguments et imprimer les COMPTES.
 *
 * ## Usage
 *
 *   pnpm tsx scripts/crm-sync-rattrapage-lettre-guide.ts                  # À BLANC
 *   pnpm tsx scripts/crm-sync-rattrapage-lettre-guide.ts --a-blanc        # idem, explicite
 *   pnpm tsx scripts/crm-sync-rattrapage-lettre-guide.ts --executer \
 *     --exclure <adresse> --exclure <adresse>                             # pour de vrai
 *
 * 🔑 À BLANC par défaut : aucune écriture, aucune mise en file. La sortie ne
 * contient QUE des comptes — jamais une adresse, même exclue.
 * 🔑 `--exclure <adresse>` est RÉPÉTABLE et compare l'adresse entière, après
 * normalisation (casse, espaces). Les adresses à écarter se passent ICI, à
 * l'exécution : aucune n'est écrite dans ce dépôt, qui est public (décision D4).
 * 🔑 Rejouable : les `event_id` sont déterministes. Deux exécutions ne créent
 * aucun doublon, ni dans l'outbox, ni au CRM.
 * 🔑 `--executer` refuse d'agir si `CRM_SYNC_GUIDE_ENABLED` est fermé.
 *
 * ## Contre la production
 *
 * `scripts/` n'est pas dans l'image : on le dépose dans le conteneur WORKER le
 * temps de s'en servir, comme `crm-sync-backfill-calendly.ts` :
 *
 *   docker cp crm-sync-rattrapage-lettre-guide.ts <worker>:/app/rattrapage.ts
 *   docker exec <worker> node_modules/.bin/tsx /app/rattrapage.ts               # à blanc
 *   docker exec <worker> node_modules/.bin/tsx /app/rattrapage.ts --executer --exclure <adresse>
 *   docker exec <worker> rm /app/rattrapage.ts
 */

import { prisma } from "@/lib/prisma";
import {
  lireArgumentsRattrapage,
  rattraperLettreEtGuide,
} from "@/server/crm-sync/rattrapage-lettre-guide";

async function main(): Promise<void> {
  const args = lireArgumentsRattrapage(process.argv.slice(2));
  if (args.erreur) {
    console.error(`✗ ${args.erreur} Rien n'a été fait.`);
    process.exit(1);
  }

  const b = await rattraperLettreEtGuide({ executer: args.executer, exclure: args.exclure });

  const mode = b.mode === "a-blanc" ? "À BLANC (rien d'écrit)" : "EXÉCUTION";
  console.log(`Mode                                   : ${mode}`);
  console.log(`Exclusions passées en argument         : ${args.exclure.length}`);
  console.log("");
  console.log("Demandes du guide cliquées, jamais transmises");
  console.log(`  · à transmettre                      : ${b.demandes.aTransmettre}`);
  console.log(`  · exclues par --exclure              : ${b.demandes.exclues}`);
  console.log("Abonnés inscrits");
  console.log(`  · examinés                           : ${b.abonnes.examines}`);
  console.log(`  · non vérifiés (guide jamais cliqué) : ${b.abonnes.nonVerifies}`);
  console.log(`  · déjà transmis                      : ${b.abonnes.dejaTransmis}`);
  console.log(`  · partent avec leur demande          : ${b.abonnes.avecLaDemande}`);
  console.log(`  · exclus par --exclure               : ${b.abonnes.exclus}`);
  console.log(`  · à transmettre                      : ${b.abonnes.aTransmettre}`);

  if (b.refus === "drapeau-guide-ferme") {
    console.error("\n✗ CRM_SYNC_GUIDE_ENABLED est fermé : rien n'a été écrit.");
    process.exit(1);
  }
  if (b.mode === "a-blanc") {
    console.log("\nÀ blanc : AUCUNE écriture. Relancer avec --executer pour agir.");
    return;
  }
  console.log("");
  console.log(`Demandes transmises                    : ${b.demandes.transmises}`);
  console.log(`Demandes déjà transmises               : ${b.demandes.dejaTransmises}`);
  console.log(`Demandes en échec                      : ${b.demandes.echecs}`);
  console.log(`Inscriptions transmises                : ${b.abonnes.transmis}`);
  console.log(`Inscriptions non écrites               : ${b.abonnes.echecs}`);
  if (b.demandes.echecs > 0) process.exit(1);
}

void main()
  .catch((e: unknown) => {
    console.error("✗ Échec inattendu :", e instanceof Error ? e.message : String(e));
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
