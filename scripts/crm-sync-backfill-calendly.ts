/**
 * Rattrapage CRM des réservations d'appel antérieures à l'activation du drapeau.
 *
 * ## Le trou que ce script comble
 *
 * `collectReconciliation()` (`src/server/crm-sync/reconcile.ts`) est le filet
 * qui repère les enregistrements jamais émis vers le CRM. Sa borne basse est
 * `site_settings.crm_sync_activated_at` — l'horodatage du premier passage
 * drapeau ouvert. Ce choix est délibéré et JUSTE : sans lui, le filet serait
 * aveugle au cas même qu'il existe pour couvrir.
 *
 * Mais il a une conséquence que rien ne traitait : **tout ce qui a été capté
 * AVANT cette borne est hors du filet pour toujours.** Mesuré en production le
 * 2026-08-31 : sur 15 `calendly_events`, 7 ont un pendant CRM et 8 n'en ont
 * pas ; les 8 orphelines ont toutes été captées entre le 2026-07-01 et le
 * 2026-08-07, alors que le marqueur d'activation date du 2026-08-15T04:30Z.
 * Sept d'entre elles portent une adresse e-mail exploitable — sept vrais leads
 * qui ne seraient jamais entrés dans le CRM, et que la réconciliation
 * quotidienne ne signalait même pas.
 *
 * Ce n'est donc pas une panne à réparer dans le filet : c'est un rattrapage
 * ponctuel, à faire une fois, en connaissance de cause. D'où un script et non
 * un cron.
 *
 * ## Usage
 *
 *   pnpm tsx scripts/crm-sync-backfill-calendly.ts            # SIMULATION
 *   pnpm tsx scripts/crm-sync-backfill-calendly.ts --emettre  # émet vraiment
 *
 * 🔑 La simulation est le DÉFAUT, et ce n'est pas de la prudence décorative :
 * émettre écrit dans `crm_sync_outbox`, ce qui déclenche de vraies créations de
 * fiches dans un CRM de production. Un script de rattrapage qui agit par défaut
 * est un script qu'on lance « pour voir » et qui a déjà agi.
 *
 * ## Ce que le script NE fait pas
 *
 * - Il n'émet rien pour une ligne sans `inviteeEmail` : sans adresse, aucune
 *   clé de personne n'est calculable côté CRM (même règle que `discover.ts`).
 *   Ces lignes sont comptées et listées, pas émises.
 * - Il ne touche pas au marqueur `crm_sync_activated_at`.
 * - Il est **idempotent** : une ligne qui a déjà un `subject_ref` dans
 *   `crm_sync_outbox` est ignorée, quel que soit le statut de cette émission.
 *   On peut donc le relancer sans créer de doublon.
 */

import { prisma } from "@/lib/prisma";
import { syncCalendlyEventToCrm } from "@/server/crm-sync";
// `isCrmSyncEnabled` n'est pas ré-exporté par l'index : on le prend à sa
// source, plutôt que d'en recopier la condition ici — un prédicat recopié
// diverge toujours de son original.
import { isCrmSyncEnabled } from "@/server/crm-sync/config";

const EMETTRE = process.argv.includes("--emettre");

function subjectRef(id: string): string {
  return `site:calendly_event:${id}`;
}

async function main(): Promise<void> {
  if (!isCrmSyncEnabled()) {
    console.error(
      "✗ CRM_SYNC_ENABLED n'est pas ouvert. Rien n'a été fait.\n" +
        "  Émettre avec le drapeau fermé remplirait l'outbox sans consommateur.",
    );
    process.exit(1);
  }

  const evenements = await prisma.calendlyEvent.findMany({
    orderBy: { capturedAt: "asc" },
    select: {
      id: true,
      capturedAt: true,
      startTime: true,
      eventTypeName: true,
      inviteeEmail: true,
      inviteeName: true,
      inviteePhone: true,
      source: true,
      status: true,
    },
  });

  // Une seule requête pour toutes les références déjà émises : comparer ligne à
  // ligne ferait N allers-retours pour une information qui tient en un SELECT.
  const refs = evenements.map((e) => subjectRef(e.id));
  const dejaEmis = await prisma.crmSyncOutbox.findMany({
    where: { subjectRef: { in: refs } },
    select: { subjectRef: true },
  });
  const connues = new Set(dejaEmis.map((r) => r.subjectRef));

  const orphelines = evenements.filter((e) => !connues.has(subjectRef(e.id)));
  const emettables = orphelines.filter((e) => e.inviteeEmail);
  const sansAdresse = orphelines.filter((e) => !e.inviteeEmail);

  console.log(`Réservations en base      : ${evenements.length}`);
  console.log(`Déjà connues du CRM       : ${evenements.length - orphelines.length}`);
  console.log(`Orphelines                : ${orphelines.length}`);
  console.log(`  · émettables (adresse)  : ${emettables.length}`);
  console.log(`  · sans adresse, ignorées: ${sansAdresse.length}`);
  console.log("");

  for (const e of sansAdresse) {
    console.log(
      `  — ignorée ${e.id} (captée le ${e.capturedAt.toISOString().slice(0, 10)}, ` +
        `source ${e.source}) : aucune adresse, donc aucune clé de personne.`,
    );
  }
  if (sansAdresse.length) console.log("");

  if (!emettables.length) {
    console.log("✓ Rien à rattraper.");
    return;
  }

  let emis = 0;
  let echecs = 0;

  for (const e of emettables) {
    const ref = subjectRef(e.id);
    const quand = (e.startTime ?? e.capturedAt).toISOString().slice(0, 16).replace("T", " ");
    const ligne = `${ref}  ${quand}  ${e.inviteeEmail ?? ""}  [${e.status}]`;

    if (!EMETTRE) {
      console.log(`  SIMULATION → ${ligne}`);
      continue;
    }

    try {
      await syncCalendlyEventToCrm({
        // Toujours `booked`, même pour une ligne annulée : c'est l'évènement
        // d'ORIGINE qu'on rattrape. Le CRM doit d'abord connaître la prise de
        // rendez-vous ; émettre `canceled` sans `booked` préalable créerait une
        // annulation qui ne se rapporte à rien.
        kind: "booked",
        subjectRef: ref,
        sourceSlug: "calendly",
        ...(e.startTime ? { occurredAt: e.startTime } : {}),
        person: {
          email: e.inviteeEmail as string,
          fullName: e.inviteeName,
          phone: e.inviteePhone,
        },
        // `backfill: true` : côté CRM, ces évènements arrivent des semaines
        // après les faits. Sans ce drapeau, ils se liraient comme un pic
        // soudain de réservations le jour du rattrapage.
        payload: { eventTypeName: e.eventTypeName, source: e.source, backfill: true },
      });
      emis += 1;
      console.log(`  ✓ émis → ${ligne}`);
    } catch (err) {
      echecs += 1;
      console.error(`  ✗ échec → ${ligne} : ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log("");
  if (!EMETTRE) {
    console.log(
      `Simulation terminée : ${emettables.length} émission(s) prête(s), AUCUNE effectuée.\n` +
        "Relancer avec --emettre pour agir.",
    );
    return;
  }
  console.log(`Terminé : ${emis} émise(s), ${echecs} en échec.`);
  if (echecs) process.exit(1);
}

void main()
  .catch((e: unknown) => {
    console.error("✗ Échec inattendu :", e instanceof Error ? e.message : String(e));
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
