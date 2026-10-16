// Hub notifications — channel WhatsApp via CallMeBot (2026-07-19).
//
// CallMeBot expose une API HTTP GRATUITE pour envoyer un message WhatsApp vers
// SON PROPRE numéro (le numéro qui a activé la clé). Aucun compte payant, aucun
// SDK : un simple GET. Cf. https://www.callmebot.com/blog/free-api-whatsapp-messages/
//
//   GET https://api.callmebot.com/whatsapp.php?phone=<phone>&text=<urlenc>&apikey=<key>
//
// Design (aligné sur `channels/telegram.ts`) :
//   - Fail-soft : ne throw JAMAIS. Retourne un statut ("sent"|"skipped"|"failed").
//   - No-op silencieux ("skipped") tant que WHATSAPP_CALLMEBOT_APIKEY +
//     WHATSAPP_NOTIFY_PHONE ne sont pas définis → le canal peut être mergé/déployé
//     AVANT que Will ait sa clé, sans aucun effet ni appel réseau.
//   - Timeout 4s par essai (CallMeBot est un peu plus lent que Telegram).
//   - FILE EN MÉMOIRE sérialisée (2026-10-15) : CallMeBot rejette (503/429) les
//     rafales. `sendWhatsAppRaw` rend la main IMMÉDIATEMENT avec "queued" ; les
//     envois partent un par un, ~1 toutes les 4,5 s, avec 3 essais maximum
//     (attentes 5 s puis 15 s) sur 503/429/5xx/réseau/délai dépassé.
//     ⚠️ La file vit dans le processus : elle est PERDUE si le conteneur redémarre.
//   - Texte PLAIN (pas de MarkdownV2) : cf. `markdownV2ToPlain()` dans format.ts.
//     WhatsApp rend nativement `*gras*` — les marqueurs `*label*` sont conservés.

const CALLMEBOT_ENDPOINT = "https://api.callmebot.com/whatsapp.php";

/** Longueur max de texte envoyée à CallMeBot (garde-fou URL / anti-troncature). */
const MAX_TEXT_LEN = 1000;

export type WhatsAppSendStatus = "sent" | "queued" | "skipped" | "failed";

export interface WhatsAppChannelOptions {
  /** Message texte brut (déjà « déMarkdownisé » pour WhatsApp). */
  text: string;
  /** Timeout réseau ms par essai (défaut 4000). */
  timeoutMs?: number;
}

/** Espacement minimal entre deux envois (CallMeBot limite le débit). */
const SPACING_MS = 4500;
/** Attentes avant le 2e puis le 3e essai. */
const RETRY_DELAYS_MS = [5000, 15000] as const;
const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

/**
 * Corps 200 qui trahissent pourtant un échec CallMeBot. Testé sur le texte SANS balises,
 * et ancré en début de texte (« Error: » ou « Error - », pas « Error-free ») : « Error-free » ou une phrase de succès qui mentionne
 * « not allowed » plus loin ne doivent pas matcher.
 */
const CALLMEBOT_ERROR_BODY =
  /^\s*(?:error(?:\s*:|\s+-\s)|apikey\s+(?:is\s+)?(?:invalid|incorrect|wrong)\b|not\s+allowed\b)/i;

/**
 * Panne côté CallMeBot (vue en prod le 16/10/2026 : HTTP 207, corps « Message to: … Service is
 * down (410) … technical problem … »). Le message n'est PAS parti : échec relançable, cherché
 * n'importe où dans le texte (le corps commence par « Message to: »).
 */
const CALLMEBOT_SERVICE_DOWN_BODY = /service\s+is\s+down|technical\s+problem|not\s+sent/i;

/** Retire les balises HTML (CallMeBot enrobe parfois ses erreurs dans <html><b>…). */
function stripHtml(body: string): string {
  return body.replace(/<[^>]*>/g, "");
}

/** Plafond de messages en attente (en cours d'envoi inclus) : au-delà, on refuse. */
const MAX_QUEUE_SIZE = 50;

interface Job {
  url: string;
  timeoutMs: number;
}

type AttemptResult = "sent" | { retry: boolean; reason: string };

const queue: Job[] = [];
let draining: Promise<void> | null = null;
let lastAttemptAt = 0;
/** Messages acceptés et pas encore terminés (en file + en cours). */
let pending = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    t.unref?.();
  });
}

async function attempt(job: Job): Promise<AttemptResult> {
  const ctrl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Course explicite : un fetch qui ignore le signal ne doit pas bloquer la file.
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      ctrl.abort();
      reject(Object.assign(new Error("timeout"), { name: "AbortError" }));
    }, job.timeoutMs);
  });
  try {
    const res = await Promise.race([
      fetch(job.url, { method: "GET", signal: ctrl.signal }),
      timeout,
    ]);
    if (res.status === 429 || res.status >= 500) {
      return { retry: true, reason: `http-${res.status}` };
    }
    if (!res.ok) return { retry: false, reason: `http-${res.status}` };
    let body = "";
    try {
      body = await res.text();
    } catch {
      // corps illisible : le statut fait foi
    }
    const texte = stripHtml(body);
    if (CALLMEBOT_SERVICE_DOWN_BODY.test(texte)) return { retry: true, reason: "service-down" };
    if (CALLMEBOT_ERROR_BODY.test(texte)) return { retry: false, reason: "corps-erreur" };
    // Seul un 200 vaut envoi : un 2xx « exotique » (207 vu en prod) n'est pas un succès.
    if (res.status !== 200) return { retry: true, reason: `http-${res.status}` };
    return "sent";
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "AbortError";
    return { retry: true, reason: timedOut ? "timeout" : "reseau" };
  } finally {
    clearTimeout(timer);
  }
}

/** Signale un échec définitif — jamais de numéro, de clé ni de texte. */
async function reportFailure(reason: string, attempts: number): Promise<void> {
  const message = `[notif:whatsapp] échec définitif après ${attempts} essai(s) (${reason})`;
  console.error(message);
  try {
    const sentry = (await import("@sentry/nextjs")) as unknown as {
      captureMessage: (m: string, o: { level: "error" }) => void;
    };
    sentry.captureMessage(message, { level: "error" });
  } catch {
    // Sentry absent : la ligne console.error suffit.
  }
}

async function processJob(job: Job): Promise<void> {
  let last = "inconnu";
  for (let n = 1; n <= MAX_ATTEMPTS; n++) {
    const wait = lastAttemptAt + SPACING_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastAttemptAt = Date.now();
    const r = await attempt(job);
    if (r === "sent") return;
    last = r.reason;
    if (!r.retry) return reportFailure(last, n);
    if (n < MAX_ATTEMPTS) await sleep(RETRY_DELAYS_MS[n - 1]!);
  }
  await reportFailure(last, MAX_ATTEMPTS);
}

function drain(): Promise<void> {
  if (!draining) {
    draining = (async () => {
      try {
        let job: Job | undefined;
        while ((job = queue.shift())) {
          try {
            await processJob(job);
          } catch {
            // fail-soft : un job ne doit jamais bloquer la file
          } finally {
            pending--;
          }
        }
      } finally {
        draining = null;
      }
    })();
  }
  return draining;
}

/** Attend que la file soit vide (tests, arrêt propre). */
export async function flushWhatsAppQueue(): Promise<void> {
  while (draining) await draining;
}

/** Remet la file à zéro (tests uniquement). */
export function resetWhatsAppQueueForTests(): void {
  queue.length = 0;
  pending = 0;
  lastAttemptAt = 0;
}

/**
 * Met un message WhatsApp (CallMeBot) en file d'envoi vers le numéro configuré.
 * Ne bloque jamais l'appelant : l'envoi réel se fait en arrière-plan.
 *
 * @returns
 *   - `"skipped"` si la clé ou le numéro ne sont pas configurés (rien en file).
 *   - `"failed"`  si la file est pleine (50 messages) — le message est refusé.
 *   - `"queued"`  sinon — le résultat réel n'est connu que de la file (logs/Sentry).
 */
export async function sendWhatsAppRaw(opts: WhatsAppChannelOptions): Promise<WhatsAppSendStatus> {
  const apiKey = process.env.WHATSAPP_CALLMEBOT_APIKEY?.trim();
  // On retire espaces/tirets éventuels saisis dans Coolify (ex. "+33 7 43 …").
  const phone = process.env.WHATSAPP_NOTIFY_PHONE?.replace(/[\s-]/g, "");

  if (!apiKey || !phone) {
    // Canal non configuré → skip sans bruit (comportement par défaut avant setup).
    return "skipped";
  }

  const text =
    opts.text.length > MAX_TEXT_LEN ? `${opts.text.slice(0, MAX_TEXT_LEN - 1)}…` : opts.text;
  const url =
    `${CALLMEBOT_ENDPOINT}?phone=${encodeURIComponent(phone)}` +
    `&text=${encodeURIComponent(text)}` +
    `&apikey=${encodeURIComponent(apiKey)}`;

  if (pending >= MAX_QUEUE_SIZE) {
    // Aucune donnée personnelle : ni numéro, ni clé, ni texte.
    console.error(`[notif:whatsapp] file pleine (${MAX_QUEUE_SIZE} messages), message refusé`);
    return "failed";
  }

  pending++;
  queue.push({ url, timeoutMs: opts.timeoutMs ?? 4000 });
  void drain();
  return "queued";
}
