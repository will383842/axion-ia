/**
 * Rattrapage CRM de la LETTRE et du GUIDE (lot L4-S, 2026-09-25).
 *
 * Transmet au CRM ce que le geste en direct n'a pas transmis :
 *   · les demandes du guide CLIQUÉES avant l'ouverture de `CRM_SYNC_GUIDE_ENABLED`
 *     (`lead_magnet_requested`, et l'inscription à la lettre qui va avec) ;
 *   · les abonnés inscrits à l'adresse VÉRIFIÉE jamais transmis
 *     (`newsletter_optin`), y compris l'inscription faite après un clic déjà
 *     transmis.
 * La logique vit dans `src/server/crm-sync/rattrapage-lettre-guide.ts` (testée) ;
 * ce fichier ne fait que lire les arguments et imprimer les COMPTES.
 *
 * ## Usage
 *
 *   pnpm tsx scripts/crm-sync-rattrapage-lettre-guide.ts                  # À BLANC
 *   pnpm tsx scripts/crm-sync-rattrapage-lettre-guide.ts --a-blanc        # idem, explicite
 *   pnpm tsx scripts/crm-sync-rattrapage-lettre-guide.ts --executer --exclure-stdin < exclusions.txt
 *   pnpm tsx scripts/crm-sync-rattrapage-lettre-guide.ts --executer \
 *     --exclure <adresse> --exclure <adresse>                             # déconseillé
 *
 * 🔑 À BLANC par défaut : aucune écriture, aucune mise en file. La sortie ne
 * contient QUE des comptes — jamais une adresse, même exclue.
 * 🔑 EXCLUSIONS (décision D4), trois sources, toutes comptées AVANT le reste :
 *   · `CRM_SYNC_EXCLUSIONS_SHA256` (environnement, empreintes SHA-256) — la
 *     seule PERSISTANTE : elle vaut aussi pour le clic, l'inscription et le
 *     rebond de demain. À renseigner d'abord ;
 *   · `--exclure-stdin` : une adresse par ligne sur l'entrée standard (lignes
 *     vides et `#` ignorés). PRÉFÉRÉ à `--exclure` : l'adresse n'entre pas dans
 *     l'historique du shell ni dans la liste des processus ;
 *   · `--exclure <adresse>` : répétable, comparée après normalisation (casse,
 *     espaces). Reste dans l'historique du shell : à éviter.
 * Aucune adresse n'est écrite dans ce dépôt, qui est public.
 * 🔑 Les adresses OPPOSÉES à la prospection (`email_oppositions`) ne partent
 * jamais ; elles sont comptées.
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
 *   docker exec -i <worker> node_modules/.bin/tsx /app/rattrapage.ts --executer --exclure-stdin < exclusions.txt
 *   docker exec <worker> rm /app/rattrapage.ts
 */

import { prisma } from "@/lib/prisma";
import { erreurSansDonnees } from "@/server/crm-sync/enqueue";
import { exclusionsInvalides, empreintesExclues } from "@/server/crm-sync/exclusions";
import {
  adressesDeLEntree,
  lireArgumentsRattrapage,
  rattraperLettreEtGuide,
  rattraperOriginesSuivantes,
} from "@/server/crm-sync/rattrapage-lettre-guide";

async function lireEntreeStandard(): Promise<string> {
  const morceaux: Buffer[] = [];
  for await (const m of process.stdin) morceaux.push(Buffer.from(m as Buffer));
  return Buffer.concat(morceaux).toString("utf8");
}

async function main(): Promise<void> {
  const args = lireArgumentsRattrapage(process.argv.slice(2));
  if (args.erreur) {
    console.error(`✗ ${args.erreur} Rien n'a été fait.`);
    process.exit(1);
  }
  const exclure = [
    ...args.exclure,
    ...(args.exclureStdin ? adressesDeLEntree(await lireEntreeStandard()) : []),
  ];

  const b = await rattraperLettreEtGuide({ executer: args.executer, exclure });

  const mode = b.mode === "a-blanc" ? "À BLANC (rien d'écrit)" : "EXÉCUTION";
  console.log(`Mode                                   : ${mode}`);
  console.log(`Exclusions passées à l'exécution       : ${exclure.length}`);
  console.log(`Empreintes CRM_SYNC_EXCLUSIONS_SHA256  : ${empreintesExclues().size}`);
  if (exclusionsInvalides() > 0) {
    console.log(`  ⚠ valeurs ignorées (pas une empreinte) : ${exclusionsInvalides()}`);
  }
  console.log("");
  console.log("Demandes du guide cliquées, jamais transmises");
  console.log(`  · exclues                            : ${b.demandes.exclues}`);
  console.log(`  · opposées à la prospection          : ${b.demandes.opposees}`);
  console.log(`  · à transmettre                      : ${b.demandes.aTransmettre}`);
  console.log("Abonnés inscrits");
  console.log(`  · examinés                           : ${b.abonnes.examines}`);
  console.log(`  · exclus                             : ${b.abonnes.exclus}`);
  console.log(`  · opposés à la prospection           : ${b.abonnes.opposes}`);
  console.log(`  · non vérifiés (guide jamais cliqué) : ${b.abonnes.nonVerifies}`);
  console.log(`  · déjà transmis                      : ${b.abonnes.dejaTransmis}`);
  console.log(`  · partent avec leur demande          : ${b.abonnes.avecLaDemande}`);
  console.log(`  · à transmettre                      : ${b.abonnes.aTransmettre}`);

  if (b.refus === "drapeau-guide-ferme") {
    console.error("\n✗ CRM_SYNC_GUIDE_ENABLED est fermé : rien n'a été écrit.");
    process.exit(1);
  }
  // Lot guide réseau 4 (O5) : origines suivantes restées en route. Sans `ORIGINES_SUIVANTES_DEPUIS`
  // (décision D3 de Williams), le passage ne fait rien ; il ne s'exécute que si les interrupteurs
  // `SYNCHRO_CRM_V3` et `SYNCHRO_CRM_V3_ORIGINES_SUIVANTES` sont allumés (sinon la fonction rend « eteinte »).
  const o = await rattraperOriginesSuivantes({ executer: args.executer, exclure });
  console.log("Origines suivantes (guide réseau)");
  console.log(
    o.refus
      ? `  · passage ignoré                     : ${o.refus}`
      : `  · groupes en attente / transmis      : ${o.groupes} / ${o.transmis}`,
  );
  if (!o.refus) console.log(`  · groupes exclus (sautés)            : ${o.exclues ?? 0}`);
  if (b.mode === "a-blanc") {
    console.log("\nÀ blanc : AUCUNE écriture. Relancer avec --executer pour agir.");
    return;
  }
  console.log("");
  console.log(`Demandes transmises                    : ${b.demandes.transmises}`);
  console.log(`Demandes déjà transmises               : ${b.demandes.dejaTransmises}`);
  console.log(`Demandes parties SANS leur inscription : ${b.demandes.inscriptionsNonEcrites}`);
  console.log(`Demandes en échec                      : ${b.demandes.echecs}`);
  console.log(`Inscriptions transmises                : ${b.abonnes.transmis}`);
  console.log(`Inscriptions non écrites               : ${b.abonnes.echecs}`);
  if (b.demandes.echecs > 0 || b.demandes.inscriptionsNonEcrites > 0 || b.abonnes.echecs > 0) {
    console.error("\n✗ Des écritures ont échoué : relancer (rejouable, sans doublon).");
    process.exit(1);
  }
}

void main()
  .catch((e: unknown) => {
    console.error("✗ Échec inattendu :", erreurSansDonnees(e));
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
