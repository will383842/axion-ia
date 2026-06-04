// Smoke integration — valide que le harnais driver pilote réellement la route
// SSE contre la vraie DB (Postgres docker) sans LLM (chemin déterministe).
import { describe, it, expect, beforeAll } from "vitest";
import { driveMessage, finalText, rdvUrl } from "./drive-conversation";
import { prisma } from "@/lib/prisma";

describe("chatbot SSE harness — smoke (chemin déterministe, 0 LLM)", () => {
  beforeAll(() => {
    // Garde-fou : on doit parler à une VRAIE DB, pas au Proxy stub build-time.
    expect(process.env.DATABASE_URL).toBeTruthy();
    expect(process.env.DATABASE_URL).not.toContain("stub.invalid");
    expect(process.env.CHATBOT_ENABLED).toBe("true");
  });

  it("RDV → stream SSE avec lien /fr/appel, session émise, persistance DB", async () => {
    const r = await driveMessage("je veux prendre un rendez-vous");
    expect(r.status).toBe(200);
    expect(r.contentType).toContain("text/event-stream");
    expect(r.sessionUuid).toMatch(/^[0-9a-f-]{36}$/);
    expect(r.events.some((e) => e.type === "session")).toBe(true);
    expect(r.events.some((e) => e.type === "done")).toBe(true);
    expect(rdvUrl(r)).toBe("/fr/appel");
    expect(finalText(r).length).toBeGreaterThan(0);

    // Persistance réelle : conversation + 2 messages (user + assistant).
    const convo = await prisma.chatConversation.findUnique({
      where: { sessionUuid: r.sessionUuid! },
      include: { messages: true },
    });
    expect(convo).not.toBeNull();
    expect(convo!.messages.length).toBeGreaterThanOrEqual(2);
    const roles = convo!.messages.map((m) => m.role).sort();
    expect(roles).toContain("user");
    expect(roles).toContain("assistant");
  });

  it("kill-switch : CHATBOT_ENABLED!=true → 503 chatbot_disabled", async () => {
    const prev = process.env.CHATBOT_ENABLED;
    process.env.CHATBOT_ENABLED = "false";
    try {
      const r = await driveMessage("test kill switch");
      expect(r.status).toBe(503);
      expect(r.errorBody).toMatchObject({ ok: false, error: "chatbot_disabled" });
    } finally {
      process.env.CHATBOT_ENABLED = prev;
    }
  });
});
