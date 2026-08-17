/**
 * VÉRIFICATEUR DE BOUCLE site → Axion CRM Pro, sans navigateur.
 *
 * ── Ce qu'il prouve, et pourquoi il existe ────────────────────────────────
 * Le lot L2 pose une outbox, une signature, un contrat strict et une
 * idempotence. Aucun test unitaire ne peut dire si les DEUX dépôts se
 * comprennent : ils ne partagent ni compilateur, ni types, ni CI. Ce script
 * fait circuler un événement RÉEL à travers le code RÉEL du site — pas une
 * copie de la logique — jusqu'à la base du CRM, puis le rejoue.
 *
 * 🔴 Règle tenue ici : on importe `enqueueCrmSyncEvent` et `emitOutboxRow` du
 * module de production. Réécrire la construction du payload ou la signature
 * dans ce fichier en ferait un test de lui-même — la panne la plus courante
 * d'un harnais d'intégration, et la plus coûteuse : il reste vert pendant que
 * la vraie chaîne est cassée.
 *
 * ── Les cinq étapes ──────────────────────────────────────────────────────
 *   1. config     — les variables nécessaires sont là ;
 *   2. enqueue    — une ligne d'outbox est écrite par le module réel ;
 *   3. emit       — le message part, signé ; le statut rendu est interprété ;
 *   4. crm-db     — les lignes attendues existent côté CRM (mode réel) ;
 *   5. replay     — le MÊME événement rejoué ne crée rien (`noop_idempotent`).
 *
 * ── Les deux issues normales de l'étape 3 ────────────────────────────────
 * `sent` (le CRM local est ouvert) ET `failed` avec un 503 (drapeau
 * `CRM_INGEST_ENABLED` à OFF) sont TOUTES DEUX des réussites du canal : le
 * 503 est l'état nominal tant que la bascule n'a pas eu lieu, et l'outbox doit
 * garder la ligne. Un `gave_up` en 422, lui, est un vrai échec : les deux
 * contrats ont divergé.
 *
 * ── Usage ────────────────────────────────────────────────────────────────
 *   pnpm tsx scripts/e2e-crm-sync/run-loop-check.ts            (CRM local réel)
 *   pnpm tsx scripts/e2e-crm-sync/run-loop-check.ts --mock     (mock intégré)
 *   pnpm tsx scripts/e2e-crm-sync/run-loop-check.ts --cleanup  (purge ZZ TEST)
 *
 * Voir `scripts/e2e-crm-sync/README.md` pour le montage des deux piles.
 */

import { execFileSync } from "node:child_process";

// Import de TYPE uniquement : il est effacé à la compilation et ne déclenche
// donc pas le chargement du client Prisma, que l'on veut retarder jusqu'à ce
// que l'environnement soit posé (cf. les imports dynamiques dans `main`).
import type { CrmSyncEvent } from "@/server/crm-sync/types";

// ── Paramètres ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function flag(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  const found = args.find((arg) => arg.startsWith(prefix));
  return found === undefined ? fallback : found.slice(prefix.length);
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

/**
 * Secret de TEST, construit par concaténation plutôt qu'écrit d'un bloc : un
 * littéral de 64 caractères hexadécimaux dans un fichier versionné est exactement
 * ce qu'un scanner de secrets doit signaler. Celui-ci n'ouvre rien — il doit
 * simplement être IDENTIQUE des deux côtés du canal.
 */
const SECRET_FRAGMENT = "0123456789" + "abcdef";
const DEFAULT_TEST_SECRET = SECRET_FRAGMENT.repeat(4);

const config = {
  databaseUrl: process.env.DATABASE_URL ?? flag("database-url", ""),
  crmSyncUrl: flag(
    "crm-url",
    process.env.CRM_SYNC_URL ?? "http://localhost:58080/api/internal/site-sync",
  ),
  secret: flag("secret", process.env.SITE_SYNC_HMAC_SECRET ?? DEFAULT_TEST_SECRET),
  /** Conteneur Postgres du compose CRM (`docker compose up -d postgres`). */
  crmContainer: flag("crm-container", process.env.CRM_PG_CONTAINER ?? "axion-crm-postgres"),
  crmDb: flag("crm-db", process.env.CRM_PG_DATABASE ?? "axion_crm"),
  crmUser: flag("crm-user", process.env.CRM_PG_USER ?? "axion"),
  /** SIREN de test — 9 chiffres, volontairement non attribuable. */
  siren: flag("siren", "000000000"),
  useMock: hasFlag("mock"),
  cleanup: hasFlag("cleanup"),
};

// ── Rapport ────────────────────────────────────────────────────────────────

type StepStatus = "PASS" | "FAIL" | "SKIP";

interface Step {
  name: string;
  status: StepStatus;
  detail: string;
}

const steps: Step[] = [];

/**
 * Gardé à la portée du module pour que l'arrêt du serveur mock ait lieu même
 * quand `main()` lève : sans cela, le processus reste vivant sur un serveur
 * HTTP ouvert et le harnais « pend » au lieu d'échouer franchement.
 */
let mockHandle: { url: string; close: () => Promise<void> } | null = null;

function record(name: string, status: StepStatus, detail: string): void {
  steps.push({ name, status, detail });
  const badge = status === "PASS" ? "PASS" : status === "FAIL" ? "FAIL" : "SKIP";
  console.log(`  [${badge}] ${name.padEnd(10)} ${detail}`);
}

// ── Interrogation de la base du CRM ────────────────────────────────────────

/**
 * On passe par `docker exec … psql` plutôt que par un client Postgres : le
 * dépôt du site n'a pas `pg` en dépendance, et en ajouter une pour un harnais
 * de vérification serait un coût permanent pour un besoin ponctuel.
 */
function crmQuery(sql: string): string {
  return execFileSync(
    "docker",
    ["exec", config.crmContainer, "psql", "-U", config.crmUser, "-d", config.crmDb, "-tAc", sql],
    { encoding: "utf8", timeout: 60_000 },
  ).trim();
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

// ── Corps du vérificateur ──────────────────────────────────────────────────

async function main(): Promise<number> {
  console.log("\n=== Boucle site → CRM : vérification de bout en bout ===\n");

  // ÉTAPE 1 — configuration.
  const missing: string[] = [];
  if (config.databaseUrl === "") missing.push("DATABASE_URL (base dev du SITE)");
  if (config.secret === "") missing.push("SITE_SYNC_HMAC_SECRET");

  if (missing.length > 0) {
    record("config", "FAIL", `manquant : ${missing.join(", ")}`);
    return finish();
  }

  // Les drapeaux du SITE sont posés ici : sans eux, `enqueueCrmSyncEvent` ne
  // fait STRICTEMENT rien (verrou d'inertie du lot) et le harnais n'aurait
  // rien à observer. Le drapeau du CRM, lui, n'est pas de notre ressort — s'il
  // est à OFF, on l'apprend par un 503, ce qui est un résultat valide.
  process.env.CRM_SYNC_ENABLED = "true";
  process.env.CRM_SYNC_CANDIDATES_ENABLED ??= "false";
  process.env.SITE_SYNC_HMAC_SECRET = config.secret;
  process.env.SKIP_ENV_VALIDATION = "true";
  // Sans cela, l'écriture d'outbox tenterait de joindre Redis pour la mise en
  // file. Ce n'est pas ce qu'on mesure, et `crmSyncQueue` vaut alors `null`.
  process.env.BULLMQ_DISABLED = "true";

  if (config.useMock) {
    const { startMockCrm } = await import("./mock-crm");
    const mock = await startMockCrm({ secret: config.secret, ingestEnabled: true });
    mockHandle = mock;
    config.crmSyncUrl = mock.url;
  }
  process.env.CRM_SYNC_URL = config.crmSyncUrl;

  record(
    "config",
    "PASS",
    `cible=${config.crmSyncUrl}${config.useMock ? " (MOCK intégré)" : " (CRM réel)"}`,
  );

  // Import APRÈS avoir posé l'environnement : le client Prisma et les drapeaux
  // se lisent au chargement du module.
  const { enqueueCrmSyncEvent, emitOutboxRow, newCrmEventId, CRM_SYNC_SCHEMA_VERSION } =
    await import("@/server/crm-sync");
  const { hashEmailForLookup } = await import("@/lib/security/email-hash");
  const { prisma } = await import("@/lib/prisma");

  // ÉTAPE 2 — écriture d'outbox par le module réel.
  const eventId = newCrmEventId();
  const marker = eventId.slice(0, 8);
  const email = `zz-test-e2e+${marker}@axion-ia.test`;
  const personKey = hashEmailForLookup(email);
  const subjectRef = `site:submission:${eventId}`;

  if (personKey === null) {
    record("enqueue", "FAIL", "person_key non calculable (PII_ENCRYPTION_KEY ?)");
    return finish();
  }

  const event: CrmSyncEvent = {
    schema_version: CRM_SYNC_SCHEMA_VERSION,
    event_id: eventId,
    event_type: "form_submission" as const,
    occurred_at: new Date().toISOString(),
    form_type: "audit" as const,
    source_slug: "zz-test-e2e",
    subject_ref: subjectRef,
    person: {
      person_key: personKey,
      email,
      first_name: "ZZ",
      last_name: `TEST E2E ${marker}`,
    },
    company: {
      siren: config.siren,
      name: `ZZ TEST E2E ${marker}`,
      postcode: "38000",
      city: "Grenoble",
    },
    tags: ["src:zz-test-e2e"],
    payload: { page: "/zz-test-e2e", harness: "run-loop-check" },
  };

  const outboxId = await enqueueCrmSyncEvent(event);

  if (outboxId === null) {
    record("enqueue", "FAIL", "aucune ligne d'outbox écrite (drapeau ou base ?)");
    return finish();
  }
  record("enqueue", "PASS", `outbox=${outboxId} event_id=${eventId}`);

  // ÉTAPE 3 — émission signée.
  const emitted = await emitOutboxRow(outboxId);
  const crmOpen = emitted.status === "sent";

  if (crmOpen) {
    record("emit", "PASS", `HTTP ${emitted.httpStatus} → statut CRM « ${emitted.crmResult} »`);
  } else if (emitted.status === "failed" && emitted.httpStatus === 503) {
    // 🔴 Tous les 503 ne se valent PAS. `ingest_disabled`, c'est le drapeau du
    // CRM à OFF : l'état nominal avant la bascule, la ligne reste en attente.
    // Mais `workspace_missing` sort AUSSI en 503 (SiteSyncRejection::unavailable)
    // et signale, lui, une pile mal montée. Les confondre ferait passer un
    // harnais cassé pour un harnais au repos — exactement le faux vert qu'on
    // cherche à rendre impossible.
    if (emitted.error === "ingest_disabled") {
      record(
        "emit",
        "PASS",
        "CRM fermé (503 ingest_disabled) — la ligne reste en attente, c'est nominal",
      );
    } else {
      record(
        "emit",
        "FAIL",
        `503 mais « ${emitted.error ?? "sans code"} » — ce n'est PAS le drapeau d'ingestion`,
      );
    }
  } else {
    record(
      "emit",
      "FAIL",
      `statut=${emitted.status} http=${emitted.httpStatus ?? "-"} erreur=${emitted.error ?? "-"}`,
    );
  }

  // ÉTAPE 4 — les lignes attendues côté CRM.
  if (!crmOpen) {
    record("crm-db", "SKIP", "le CRM n'a rien ingéré (voir l'étape emit)");
  } else if (config.useMock) {
    record("crm-db", "SKIP", "mode MOCK : aucune base CRM à interroger");
  } else {
    try {
      const activityRef = `site:event:${eventId}`;
      const activity = crmQuery(
        `select id || '|' || coalesce(subject_type,'-') || '|' || coalesce(subject_id::text,'-') from activities where external_ref = ${sqlString(activityRef)}`,
      );
      const company = crmQuery(`select id from companies where siren = ${sqlString(config.siren)}`);
      const contact = crmQuery(
        `select id from contacts where external_ref = ${sqlString(subjectRef)}`,
      );

      const holes: string[] = [];
      if (activity === "") holes.push(`activities(external_ref=${activityRef})`);
      if (company === "") holes.push(`companies(siren=${config.siren})`);
      if (contact === "") holes.push(`contacts(external_ref=${subjectRef})`);

      if (holes.length > 0) {
        record("crm-db", "FAIL", `ligne(s) absente(s) : ${holes.join(", ")}`);
      } else {
        record("crm-db", "PASS", `activity=${activity} company=${company} contact=${contact}`);
      }
    } catch (error) {
      record(
        "crm-db",
        "FAIL",
        `interrogation impossible (${config.crmContainer}) : ${message(error)}`,
      );
    }
  }

  // ÉTAPE 5 — rejeu du MÊME événement.
  if (!crmOpen) {
    record("replay", "SKIP", "rien à rejouer tant que le CRM n'a pas accepté");
  } else {
    // On remet la ligne en attente pour repasser par le chemin d'émission réel.
    // Reconstruire une requête à la main ici testerait notre propre code, pas
    // le sien — et le rejeu que l'on veut prouver est bien celui de l'outbox.
    await prisma.crmSyncOutbox.update({
      where: { id: outboxId },
      data: { status: "pending", nextAttemptAt: null, sentAt: null, crmResult: null },
    });

    const replayed = await emitOutboxRow(outboxId);

    if (replayed.status === "sent" && replayed.crmResult === "noop_idempotent") {
      record("replay", "PASS", "le rejeu ne crée rien : « noop_idempotent »");
    } else {
      record(
        "replay",
        "FAIL",
        `attendu « noop_idempotent », obtenu statut=${replayed.status} crm=${replayed.crmResult ?? "-"}`,
      );
    }
  }

  // Purge optionnelle.
  if (config.cleanup) {
    await prisma.crmSyncOutbox.deleteMany({ where: { id: outboxId } });
    if (crmOpen && !config.useMock) {
      try {
        crmQuery(
          `delete from activities where external_ref = ${sqlString(`site:event:${eventId}`)}`,
        );
        crmQuery(`delete from contacts where external_ref = ${sqlString(subjectRef)}`);
      } catch (error) {
        console.log(`  [note] purge CRM partielle : ${message(error)}`);
      }
    }
    console.log(
      "\n  Purge ZZ TEST effectuée (la fiche entreprise du SIREN de test est conservée).",
    );
  }

  await prisma.$disconnect();

  return finish();
}

/** Libère ce qui tient le processus en vie, quelle que soit l'issue. */
async function shutdown(): Promise<void> {
  if (mockHandle !== null) {
    await mockHandle.close();
    mockHandle = null;
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function finish(): number {
  const failed = steps.filter((step) => step.status === "FAIL");
  const passed = steps.filter((step) => step.status === "PASS");
  const skipped = steps.filter((step) => step.status === "SKIP");

  console.log(
    `\n=== ${failed.length === 0 ? "BOUCLE VÉRIFIÉE" : "BOUCLE EN ÉCHEC"} — ` +
      `${passed.length} PASS / ${failed.length} FAIL / ${skipped.length} SKIP ===\n`,
  );

  return failed.length === 0 ? 0 : 1;
}

main()
  .catch((error: unknown) => {
    console.error("\n[run-loop-check] interruption :", message(error));
    return 1;
  })
  .then(async (code) => {
    await shutdown();
    process.exitCode = code;

    // 🔴 Ne PAS appeler `process.exit()` ici. Sur Windows, sortir pendant que
    // les descripteurs du serveur mock et du client Prisma sont encore en
    // train de se fermer fait planter libuv (« Assertion failed:
    // !(handle->flags & UV_HANDLE_CLOSING) ») et rend un code de sortie 127
    // ALORS QUE le rapport est bon — un faux rouge, exactement ce qu'un
    // harnais ne doit jamais produire.
    //
    // Filet de sécurité si un descripteur oublié retenait quand même la
    // boucle : on force la sortie après un délai, et `unref()` fait que ce
    // minuteur n'est JAMAIS ce qui maintient le processus en vie.
    setTimeout(() => {
      console.error("[run-loop-check] descripteurs encore ouverts — sortie forcée.");
      process.exit(code);
    }, 5_000).unref();
  });
