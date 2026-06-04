"use client";
// use-client: gère un état conversationnel + lit un ReadableStream fetch (SSE).
//
// Hook de streaming du widget (T-08). Envoie un message à
// `POST /api/chatbot/message`, lit la réponse SSE, accumule les deltas dans un
// message assistant « pending », finalise au `done`. Conserve le `sessionUuid`
// renvoyé par le serveur pour préserver l'état multi-tours (slots/linkState).
//
// Zéro dépendance lourde : fetch natif + TextDecoder. Le parsing est délégué
// aux fonctions pures de `sse.ts` (testées en isolation).

import * as React from "react";
import { splitSseFrames, parseSseFrame, reduceAssistant } from "./sse";
import type { ChatMessage, ChatStatus, StreamEvent } from "./types";

let messageSeq = 0;
function nextId(prefix: string): string {
  messageSeq += 1;
  return `${prefix}-${messageSeq}`;
}

export interface UseChatStream {
  readonly messages: ReadonlyArray<ChatMessage>;
  readonly status: ChatStatus;
  readonly send: (text: string) => Promise<void>;
  /** Session serveur courante (pour lier une capture de lead à la conversation). */
  readonly sessionUuid: string | undefined;
}

export function useChatStream(): UseChatStream {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [status, setStatus] = React.useState<ChatStatus>("idle");
  const [sessionUuid, setSessionUuid] = React.useState<string | undefined>(undefined);
  const sessionRef = React.useRef<string | undefined>(undefined);
  // Évite les envois concurrents (double Entrée pendant un stream).
  const inFlightRef = React.useRef(false);

  const send = React.useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || inFlightRef.current) return;
    inFlightRef.current = true;
    setStatus("streaming");

    const userMsg: ChatMessage = { id: nextId("u"), role: "user", text: trimmed };
    const assistantId = nextId("a");
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: "assistant", text: "", pending: true },
    ]);

    const applyEvent = (event: StreamEvent) => {
      if (event.type === "session") {
        sessionRef.current = event.sessionUuid;
        setSessionUuid(event.sessionUuid);
        return;
      }
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? reduceAssistant(m, event) : m)),
      );
    };

    try {
      const res = await fetch("/api/chatbot/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          ...(sessionRef.current ? { sessionUuid: sessionRef.current } : {}),
          ...(typeof window !== "undefined"
            ? { pageContext: window.location.pathname.slice(0, 300) }
            : {}),
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`chatbot_http_${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;
      while (!done) {
        const chunk = await reader.read();
        done = chunk.done;
        if (chunk.value) {
          buffer += decoder.decode(chunk.value, { stream: true });
          const split = splitSseFrames(buffer);
          buffer = split.rest;
          for (const frame of split.frames) {
            const event = parseSseFrame(frame);
            if (event) applyEvent(event);
          }
        }
      }
      // Flush d'une éventuelle dernière trame sans `\n\n` terminal.
      const tail = parseSseFrame(buffer);
      if (tail) applyEvent(tail);
      setStatus("idle");
    } catch {
      // Mode dégradé minimal (T-16 raffinera) : on ne perd jamais la saisie,
      // on signale juste un souci sans afficher d'erreur technique brute. Le
      // texte déjà streamé est conservé tel quel ; seul `pending` retombe.
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, pending: false } : m)));
      setStatus("error");
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  return { messages, status, send, sessionUuid };
}
