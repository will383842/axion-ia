// Parsing SSE + réducteur de message assistant (T-08) — FONCTIONS PURES.
//
// Isolé du hook React pour être testable sans DOM/fetch : on vérifie le
// découpage des trames `data: …\n\n` et l'application des événements à l'état
// d'un message assistant (delta accumulé, message final, cartes, sources, rdv,
// escalade). Aucun import React ici.

import type { ChatMessage, StreamEvent } from "./types";

/**
 * Découpe un buffer SSE en trames complètes (séparateur `\n\n`) + le reste
 * incomplet à conserver pour la prochaine lecture réseau.
 */
export function splitSseFrames(buffer: string): { frames: string[]; rest: string } {
  const parts = buffer.split("\n\n");
  // Le dernier élément est potentiellement une trame incomplète → on le garde.
  const rest = parts.pop() ?? "";
  return { frames: parts.filter((f) => f.trim().length > 0), rest };
}

/**
 * Parse une trame SSE (lignes `data: …`) en `StreamEvent`. Retourne `null` si
 * la charge utile n'est pas un JSON exploitable (trame keep-alive, commentaire).
 */
export function parseSseFrame(frame: string): StreamEvent | null {
  const data = frame
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("");
  if (!data) return null;
  try {
    const parsed = JSON.parse(data) as unknown;
    if (parsed && typeof parsed === "object" && "type" in parsed) {
      return parsed as StreamEvent;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Applique un événement de flux à l'état (immuable) d'un message assistant.
 * Retourne un NOUVEAU message (jamais de mutation), pour un usage React-safe.
 */
export function reduceAssistant(msg: ChatMessage, event: StreamEvent): ChatMessage {
  switch (event.type) {
    case "delta":
      return { ...msg, text: msg.text + event.text, pending: true };
    case "message":
      // Texte final faisant autorité (remplace l'accumulation de deltas).
      return { ...msg, text: event.text, pending: true };
    case "cards":
      return { ...msg, cards: event.cards, sendLinks: event.sendLinks, pending: true };
    case "sources":
      return { ...msg, sources: event.sources, pending: true };
    case "rdv":
      return { ...msg, rdvUrl: event.url, pending: true };
    case "escalate":
      return { ...msg, escalated: true, pending: true };
    case "done":
      return { ...msg, pending: false };
    case "error":
      return { ...msg, pending: false };
    // `session` est traité au niveau du hook, pas du message.
    default:
      return msg;
  }
}
