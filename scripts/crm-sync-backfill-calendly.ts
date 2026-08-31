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
 * 2026-08-31 : les 8 réservations orphelines ont toutes été captées entre le
 * 2026-07-01 et le 2026-08-07, alors que le marqueur d'activation date du
 * 2026-08-15T04:30Z. La réconciliation quotidienne ne les signale même pas.
 *
 * ⚠️ MAIS LE VOLUME RÉEL EST BIEN PLUS FAIBLE QUE LE COMPTE BRUT. Sur les 7
 * orphelines porteuses d'une adresse, **6 sont des réservations de test faites
 * depuis le compte de la maison** (deux variantes de l'adresse du dirigeant) :
 * un seul tiers figure dans le lot. Un rattrapage sans filtre aurait créé six
 * fiches du dirigeant dans son propre CRM. D'où `--exclure`, et d'où la
 * consigne : **lire la liste avant d'émettre**. Le compte d'orphelines n'est pas
 * un compte de leads.
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
 * ## ⚠️ Comment le lancer CONTRE LA PRODUCTION
 *
 * `scripts/` **n'est pas** dans l'image de production : le `Dockerfile` ne copie
 * que `scripts/docker-entrypoint.sh` (l.298). Déployer ce fichier ne suffit donc
 * pas à le rendre exécutable en prod — vérifié le 2026-08-31, `ls scripts/` dans
 * le conteneur worker rend 0 entrée.
 *
 * Le conteneur WORKER a en revanche tout le reste : `tsx`, `src/`, les
 * `node_modules` et `DATABASE_URL`. On l'y dépose donc au moment de s'en servir :
 *
 *   docker cp crm-sync-backfill-calendly.ts <worker>:/app/backfill.ts
 *   docker exec <worker> node_modules/.bin/tsx /app/backfill.ts        # simulation
 *   docker exec <worker> node_modules/.bin/tsx /app/backfill.ts --emettre --exclure <adresse>
 *   docker exec <worker> rm /app/backfill.ts
 *
 * 🔑 Ne PAS ajouter `scripts/` au `Dockerfile` pour cet usage : ce serait
 * embarquer une trentaine d'outils de maintenance dans une image de production
 * pour une opération qui n'aura lieu qu'une fois. Un rattrapage ponctuel se
 * transporte, il ne se déploie pas.
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

/**
 * Adresses à NE PAS rattraper, en sous-chaîne, répétable :
 *   --exclure williamsjullin --exclure williamjullin
 *
 * 🔑 POURQUOI CETTE OPTION EXISTE (mesuré le 2026-08-31). Sur les 8 réservations
 * orphelines de production, 7 portaient une adresse — et **6 d'entre elles
 * étaient les réservations de test de Will lui-même** (deux variantes de sa
 * propre adresse). Un seul tiers réel figurait dans le lot. Lancer le rattrapage
 * sans filtre aurait donc créé six fiches du dirigeant dans son propre CRM :
 * pas un rattrapage, une pollution.
 *
 * L'option prend une sous-chaîne et non une liste codée en dur : une adresse
 * écrite dans ce fichier serait fausse au premier changement, et surtout ce
 * script doit rester utilisable par quelqu'un d'autre, sur d'autres données.
 */
const EXCLUSIONS = process.argv.reduce<string[]>((acc, arg, i, tout) => {
  if (arg === "--exclure" && tout[i + 1]) acc.push(tout[i + 1]!.toLowerCase());
  return acc;
}, []);

function estExclu(email: string | null): boolean {
  if (!email) return false;
  const e = email.toLowerCase();
  return EXCLUSIONS.some((motif) => e.includes(motif));
}

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
  const sansAdresse = orphelines.filter((e) => !e.inviteeEmail);
  const exclues = orphelines.filter((e) => e.inviteeEmail && estExclu(e.inviteeEmail));
  const emettables = orphelines.filter((e) => e.inviteeEmail && !estExclu(e.inviteeEmail));

  console.log(`Réservations en base       : ${evenements.length}`);
  console.log(`Déjà connues du CRM        : ${evenements.length - orphelines.length}`);
  console.log(`Orphelines                 : ${orphelines.length}`);
  console.log(`  · émettables             : ${emettables.length}`);
  console.log(`  · sans adresse, ignorées : ${sansAdresse.length}`);
  console.log(`  · exclues par --exclure  : ${exclues.length}`);
  if (!EXCLUSIONS.length) {
    console.log("");
    console.log(
      "  ⚠️ Aucun --exclure passé. Vérifier la liste ci-dessous AVANT d'émettre :\n" +
        "     les réservations de test faites depuis le compte de la maison portent une\n" +
        "     vraie adresse et sont donc indiscernables d'un prospect pour ce script.",
    );
  }
  console.log("");

  for (const e of sansAdresse) {
    console.log(
      `  — ignorée ${e.id} (captée le ${e.capturedAt.toISOString().slice(0, 10)}, ` +
        `source ${e.source}) : aucune adresse, donc aucune clé de personne.`,
    );
  }
  for (const e of exclues) {
    console.log(`  — exclue  ${e.id} (${e.inviteeEmail ?? ""}) : filtrée par --exclure.`);
  }
  if (sansAdresse.length || exclues.length) console.log("");

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
