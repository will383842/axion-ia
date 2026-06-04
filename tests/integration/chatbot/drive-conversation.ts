// Driver Node direct (PROMPT §1, méthode LIVE privilégiée Windows) — importe le
// handler POST de la route SSE chatbot, lui passe un NextRequest forgé, et
// consomme le ReadableStream SSE (parse `data:` lignes JSON). 0 serveur HTTP,
// déterministe, marche sous Windows. Base des 20 conversations Phase 6.
//
// L'env est chargé par vitest.integration.setup.ts (dotenv-like) AVANT cet import.
import { NextRequest } from "next/server";
import { POST } from "@/app/api/chatbot/message/route";

/** Un event SSE décodé (chaque `data: {...}` du flux). */
export interface SseEvent {
  readonly type: string;
  readonly [k: string]: unknown;
}

export interface DriveResult {
  /** Statut HTTP de la Response (200 = stream, 4xx/5xx = jsonError). */
  readonly status: number;
  readonly contentType: string | null;
  /** Tous les events SSE reçus, dans l'ordre. */
  readonly events: SseEvent[];
  /** Concaténation des deltas `type:"delta"` (texte streamé token-par-token). */
  readonly streamedText: string;
  /** Le sessionUuid émis par le serveur (event `session`). */
  readonly sessionUuid: string | null;
  /** Corps JSON si la réponse n'était pas un stream SSE (erreur). */
  readonly errorBody: unknown;
  /** Headers bruts de la réponse. */
  readonly headers: Headers;
}

export interface DriveOpts {
  readonly sessionUuid?: string;
  readonly tenantKey?: string;
  readonly pageContext?: string;
  readonly turnstileToken?: string;
  /** En-têtes additionnels (Origin, Host, x-forwarded-for…). */
  readonly headers?: Record<string, string>;
  /** URL de la requête (défaut same-origin localhost:3000). */
  readonly url?: string;
}

const DEFAULT_URL = "http://localhost:3000/api/chatbot/message";

/** Envoie UN message au handler SSE et retourne le flux décodé. */
export async function driveMessage(message: string, opts: DriveOpts = {}): Promise<DriveResult> {
  const url = opts.url ?? DEFAULT_URL;
  const body = JSON.stringify({
    message,
    ...(opts.sessionUuid ? { sessionUuid: opts.sessionUuid } : {}),
    ...(opts.tenantKey ? { tenantKey: opts.tenantKey } : {}),
    ...(opts.pageContext ? { pageContext: opts.pageContext } : {}),
    ...(opts.turnstileToken ? { turnstileToken: opts.turnstileToken } : {}),
  });
  // Same-origin par défaut : Host = host de l'URL, pas d'Origin (server-to-server
  // autorisé par checkOrigin). Le test d'isolation forge un Origin étranger.
  const reqUrl = new URL(url);
  const headers = new Headers({
    "Content-Type": "application/json",
    host: reqUrl.host,
    ...(opts.headers ?? {}),
  });
  const req = new NextRequest(url, { method: "POST", headers, body });

  const res = await POST(req);
  const contentType = res.headers.get("content-type");

  if (!contentType || !contentType.includes("text/event-stream")) {
    // Réponse d'erreur JSON (chatbot_disabled, invalid_body, rate_limited…).
    let errorBody: unknown = null;
    try {
      errorBody = await res.json();
    } catch {
      errorBody = await res.text();
    }
    return {
      status: res.status,
      contentType,
      events: [],
      streamedText: "",
      sessionUuid: null,
      errorBody,
      headers: res.headers,
    };
  }

  // Consomme le stream SSE.
  const events: SseEvent[] = [];
  let streamedText = "";
  let sessionUuid: string | null = null;
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // Les events sont séparés par \n\n ; chaque ligne `data: <json>`.
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      for (const line of chunk.split("\n")) {
        const trimmed = line.startsWith("data:") ? line.slice(5).trim() : "";
        if (!trimmed) continue;
        try {
          const evt = JSON.parse(trimmed) as SseEvent;
          events.push(evt);
          if (evt.type === "delta" && typeof evt.text === "string") streamedText += evt.text;
          if (evt.type === "session" && typeof evt.sessionUuid === "string")
            sessionUuid = evt.sessionUuid;
        } catch {
          /* ligne non-JSON ignorée */
        }
      }
    }
  }

  return {
    status: res.status,
    contentType,
    events,
    streamedText,
    sessionUuid,
    errorBody: null,
    headers: res.headers,
  };
}

/** Texte « final » consolidé d'un tour : message complet OU deltas concaténés. */
export function finalText(r: DriveResult): string {
  const msg = r.events.find((e) => e.type === "message");
  if (msg && typeof msg.text === "string") return msg.text;
  return r.streamedText;
}

/** Les cartes d'offre émises (event `cards`). */
export function cards(r: DriveResult): Array<Record<string, unknown>> {
  const c = r.events.find((e) => e.type === "cards");
  return c && Array.isArray(c.cards) ? (c.cards as Array<Record<string, unknown>>) : [];
}

/** L'URL RDV émise (event `rdv`), si présente. */
export function rdvUrl(r: DriveResult): string | null {
  const e = r.events.find((ev) => ev.type === "rdv");
  return e && typeof e.url === "string" ? e.url : null;
}

/** true si un event `escalate` a été émis. */
export function escalated(r: DriveResult): boolean {
  return r.events.some((e) => e.type === "escalate");
}
