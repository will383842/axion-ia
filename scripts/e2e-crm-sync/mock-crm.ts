/**
 * MOCK du récepteur d'ingestion du CRM — `POST /api/internal/site-sync`.
 *
 * ── Pourquoi un mock alors que le vrai CRM tourne en local ─────────────────
 * Le harnais doit rester exécutable sur une machine qui n'a PAS la pile Laravel
 * (CI du site, poste neuf, ou simplement Docker à l'arrêt). Le mock rejoue les
 * quatre réponses qui font le contrat côté site — 401, 503, 422, 200 — et rien
 * d'autre : il ne prétend pas ingérer, il prétend RÉPONDRE comme le CRM.
 *
 * 🔴 Ce qu'il ne prouve PAS, et qu'il ne faut jamais lui faire dire : que le CRM
 * écrit bien ses lignes (companies / contacts / activities). Seul le mode RÉEL
 * de `run-loop-check.ts` le prouve. Le mock verrouille la moitié SITE de la
 * boucle (outbox, signature, gestion des statuts, rejeu) ; le mode réel
 * verrouille la moitié CRM. Les deux sont nécessaires, aucun ne remplace l'autre.
 *
 * Miroir de : `backend/app/Http/Controllers/Internal/SiteSyncController.php`,
 * `backend/app/Support/HmacSignature.php` et `backend/app/Crm/Ingest/SiteSyncEvent.php`
 * (dépôt Axion-CRM-Pro).
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { AddressInfo } from "node:net";

/**
 * MIROIRS des constantes PHP. Dupliqués ici volontairement : le mock doit
 * refuser ce que le vrai CRM refuse, y compris quand le module du site se
 * trompe — s'il importait les listes du site, il dirait toujours « oui » aux
 * erreurs du site, et ne garderait plus rien.
 */
const EVENT_TYPES = [
  "form_submission",
  "calendly_booked",
  "calendly_completed",
  "calendly_canceled",
  "calendly_no_show",
  "newsletter_optin",
  "newsletter_optout",
  "review_posted",
  "application_submitted",
  "opt_out",
];

const FORM_TYPES = [
  "audit",
  "implementation",
  "formation",
  "un_a_un",
  "devis",
  "partenariat",
  "presse",
  "recrutement",
  "speaker",
  "investisseur",
  "support_client",
  "autre",
  "podcast",
  "simulateur_roi",
];

const TOP_LEVEL_KEYS = [
  "schema_version",
  "event_id",
  "event_type",
  "occurred_at",
  "form_type",
  "source_slug",
  "subject_ref",
  "person",
  "company",
  "consent",
  "candidate",
  "tags",
  "payload",
];

const SCHEMA_VERSION = 1;

export interface MockCrmOptions {
  /** 0 = port libre choisi par l'OS (recommandé en test). */
  port?: number;
  secret: string;
  /** À `false`, le mock répond 503 comme un CRM dont le drapeau est à OFF. */
  ingestEnabled?: boolean;
  /** Fenêtre de tolérance de l'horodatage signé. 0 = contrôle désactivé. */
  maxSkewSeconds?: number;
}

export interface MockCrm {
  /** URL complète de l'endpoint, prête pour `CRM_SYNC_URL`. */
  url: string;
  /** `event_id` déjà vus — c'est ce qui rend le rejeu `noop_idempotent`. */
  seen: Set<string>;
  close: () => Promise<void>;
  server: Server;
}

interface MockReply {
  status: number;
  body: Record<string, unknown>;
}

/** Miroir de `HmacSignature::signedPayload()` : l'horodatage EST dans la signature. */
function signedPayload(timestamp: string, body: string): string {
  return `${timestamp}.${body}`;
}

/** Miroir de `HmacSignature::verify()` — comparaison à temps constant. */
function verifySignature(secret: string, payload: string, received: string | undefined): boolean {
  if (secret === "" || received === undefined || received === "") return false;

  const clean = received.startsWith("sha256=") ? received.slice(7) : received;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(clean, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejection(error: string, message: string): MockReply {
  return { status: 422, body: { error, message } };
}

/**
 * Sous-ensemble du contrat strict de `SiteSyncEvent::fromArray()` : les refus
 * que le site peut réellement provoquer. Le mock ne rejoue pas la validation
 * fine des dates ni des tags — c'est le mode RÉEL qui la couvre.
 */
function validate(raw: unknown, seen: Set<string>): MockReply {
  if (!isRecord(raw)) return rejection("invalid_type", "Le corps doit être un objet JSON.");

  const unknown = Object.keys(raw).filter((key) => !TOP_LEVEL_KEYS.includes(key));
  if (unknown.length > 0) {
    return rejection(
      "unknown_field",
      `Champ(s) inconnu(s) dans « racine » : ${unknown.join(", ")}.`,
    );
  }

  if (raw["schema_version"] !== SCHEMA_VERSION) {
    return rejection("unsupported_schema_version", "Version de schéma non supportée.");
  }

  const eventId = raw["event_id"];
  if (typeof eventId !== "string" || eventId.length < 8 || eventId.length > 128) {
    return rejection("invalid_event_id", "event_id doit faire entre 8 et 128 caractères.");
  }

  const eventType = raw["event_type"];
  if (typeof eventType !== "string" || !EVENT_TYPES.includes(eventType)) {
    return rejection("unknown_event_type", `Type d'événement inconnu : « ${String(eventType)} ».`);
  }

  const subjectRef = raw["subject_ref"];
  if (typeof subjectRef !== "string" || !subjectRef.startsWith("site:")) {
    return rejection("invalid_subject_ref", "subject_ref doit être préfixé « site: ».");
  }

  const formType = raw["form_type"];
  if (eventType === "form_submission" && formType === undefined) {
    return rejection("missing_form_type", "form_type est obligatoire pour un form_submission.");
  }
  if (formType !== undefined && (typeof formType !== "string" || !FORM_TYPES.includes(formType))) {
    return rejection("unknown_form_type", `Type de formulaire inconnu : « ${String(formType)} ».`);
  }

  const person = raw["person"];
  const personKey = isRecord(person) ? person["person_key"] : undefined;
  if (typeof personKey !== "string" || !/^[0-9a-f]{64}$/.test(personKey)) {
    return rejection("invalid_person_key", "person.person_key doit être un sha256 hexadécimal.");
  }

  // Idempotence par `event_id` : côté CRM c'est `activities.external_ref`.
  if (seen.has(eventId)) {
    return {
      status: 200,
      body: {
        ok: true,
        result: {
          status: "noop_idempotent",
          subject_type: "company",
          subject_id: 1,
          activity_id: 1,
          tags: [],
        },
      },
    };
  }

  seen.add(eventId);
  return {
    status: 200,
    body: {
      ok: true,
      result: {
        status: "created",
        subject_type: "company",
        subject_id: 1,
        activity_id: seen.size,
        tags: Array.isArray(raw["tags"]) ? raw["tags"] : [],
      },
    },
  };
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function header(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

export async function startMockCrm(options: MockCrmOptions): Promise<MockCrm> {
  const seen = new Set<string>();
  const ingestEnabled = options.ingestEnabled ?? true;
  const maxSkew = options.maxSkewSeconds ?? 300;

  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    void handle(request, response);
  });

  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const reply = await route(request);
    response.writeHead(reply.status, { "Content-Type": "application/json" });
    response.end(JSON.stringify(reply.body));
  }

  async function route(request: IncomingMessage): Promise<MockReply> {
    if (request.method !== "POST") {
      return { status: 405, body: { error: "method_not_allowed" } };
    }

    const body = await readBody(request);
    const timestamp = header(request, "X-Site-Timestamp") ?? "";

    // ORDRE DES CONTRÔLES, calqué sur le contrôleur PHP : signature AVANT le
    // drapeau — un appelant non authentifié ne doit rien apprendre de l'état
    // du système.
    if (
      !verifySignature(
        options.secret,
        signedPayload(timestamp, body),
        header(request, "X-Site-Signature"),
      )
    ) {
      return { status: 401, body: { error: "bad_signature" } };
    }

    if (maxSkew > 0) {
      const withinWindow =
        /^\d{1,12}$/.test(timestamp) &&
        Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) <= maxSkew;
      if (!withinWindow) return { status: 401, body: { error: "stale_signature" } };
    }

    if (!ingestEnabled) {
      return {
        status: 503,
        body: {
          error: "ingest_disabled",
          message: "Ingestion site→CRM désactivée (CRM_INGEST_ENABLED).",
        },
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return rejection("invalid_type", "Corps JSON illisible.");
    }

    return validate(parsed, seen);
  }

  await new Promise<void>((resolve) => server.listen(options.port ?? 0, "127.0.0.1", resolve));

  const address = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${address.port}/api/internal/site-sync`,
    seen,
    server,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

/** Lancement autonome : `pnpm tsx scripts/e2e-crm-sync/mock-crm.ts --port 58099`. */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const prefix = `--${name}=`;
    const found = args.find((arg) => arg.startsWith(prefix));
    return found === undefined ? undefined : found.slice(prefix.length);
  };

  const mock = await startMockCrm({
    port: Number(flag("port") ?? process.env.MOCK_CRM_PORT ?? 58099),
    secret: flag("secret") ?? process.env.SITE_SYNC_HMAC_SECRET ?? "",
    ingestEnabled: (flag("ingest-enabled") ?? "true") === "true",
  });

  console.log(`[mock-crm] à l'écoute — CRM_SYNC_URL=${mock.url}`);
  console.log("[mock-crm] Ctrl+C pour arrêter.");
}

// `import.meta.url` vaut le chemin du module ; on ne démarre le serveur que si
// le fichier est exécuté directement, jamais quand un test l'importe.
if (
  process.argv[1] !== undefined &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))
) {
  void main();
}
