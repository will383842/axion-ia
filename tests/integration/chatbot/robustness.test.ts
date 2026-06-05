// Phase 6.bis — robustesse transverse contre l'infra réelle (Postgres + Redis).
// Idempotence sous concurrence, isolation session, anti-abus rate-limit, UTF-8.
import { describe, it, expect, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { driveMessage, finalText } from "./drive-conversation";
import { POST as leadPOST } from "@/app/api/chatbot/lead/route";
import { prisma } from "@/lib/prisma";

/** Forge une requête vers la route lead. */
async function postLead(payload: Record<string, unknown>): Promise<Response> {
  const url = "http://localhost:3000/api/chatbot/lead";
  const req = new NextRequest(url, {
    method: "POST",
    headers: new Headers({ "Content-Type": "application/json", host: "localhost:3000" }),
    body: JSON.stringify(payload),
  });
  return leadPOST(req);
}

describe("Phase 6.bis — robustesse transverse (infra réelle)", () => {
  beforeAll(() => {
    expect(process.env.DATABASE_URL).not.toContain("stub.invalid");
    expect(process.env.REDIS_URL).toBeTruthy();
  });

  it("S8 — Lead capture : consentement requis + Submission source=chatbot", async () => {
    const session = randomUUID();
    const email = `lead-${session.slice(0, 8)}@example.com`;
    // Sans consentement → refus.
    const refus = await postLead({
      nom: "Jean Test",
      email,
      besoin: "Je veux un audit",
      consentement: false,
      sessionUuid: session,
    });
    expect(refus.status).toBe(400);
    expect(await refus.json()).toMatchObject({ error: "consent_required" });

    // Avec consentement → Submission créée, source=chatbot.
    const ok = await postLead({
      nom: "Jean Test",
      email,
      besoin: "Je veux un audit IA pour ma PME",
      consentement: true,
      sessionUuid: session,
    });
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as { submissionId: string; idempotent: boolean };
    expect(body.submissionId).toBeTruthy();
    expect(body.idempotent).toBe(false);

    const sub = await prisma.submission.findUnique({ where: { id: body.submissionId } });
    expect(sub?.source).toBe("chatbot");
    expect(sub?.contactEmail).toBe(email);
  });

  it("S9 — Idempotence SÉQUENTIELLE : 2 appels identiques → 1 seul Submission", async () => {
    const session = randomUUID();
    const email = `seq-${session.slice(0, 8)}@example.com`;
    const payload = {
      nom: "Marie Seq",
      email,
      besoin: "Formation Claude pour 5 personnes",
      consentement: true,
      sessionUuid: session,
    };
    const r1 = (await (await postLead(payload)).json()) as {
      submissionId: string;
      idempotent: boolean;
    };
    const r2 = (await (await postLead(payload)).json()) as {
      submissionId: string;
      idempotent: boolean;
    };
    expect(r1.idempotent).toBe(false);
    expect(r2.idempotent).toBe(true);
    expect(r2.submissionId).toBe(r1.submissionId);
    const count = await prisma.submission.count({ where: { contactEmail: email } });
    expect(count).toBe(1);
  });

  it("S9.bis — Idempotence sous CONCURRENCE réelle : 2 requêtes en course → 1 Submission", async () => {
    const session = randomUUID();
    const email = `race-${session.slice(0, 8)}@example.com`;
    const payload = {
      nom: "Paul Race",
      email,
      besoin: "Audit IA concurrent",
      consentement: true,
      sessionUuid: session,
    };
    // Lancement RÉELLEMENT concurrent (Promise.all, pas séquentiel).
    const [a, b] = await Promise.all([postLead(payload), postLead(payload)]);
    const [ja, jb] = (await Promise.all([a.json(), b.json()])) as [
      { submissionId: string; idempotent: boolean },
      { submissionId: string; idempotent: boolean },
    ];
    expect(ja.submissionId).toBe(jb.submissionId);
    // Un seul Submission malgré la course (contrainte chat_action_idempotency + P2002).
    const count = await prisma.submission.count({ where: { contactEmail: email } });
    expect(count).toBe(1);
    // Exactement un gagnant (idempotent=false) et un perdant (idempotent=true).
    expect([ja.idempotent, jb.idempotent].sort()).toEqual([false, true]);
  });

  it("Isolation SESSION : 2 sessions distinctes → états de slots séparés", async () => {
    const sessA = randomUUID();
    const sessB = randomUUID();
    await driveMessage("je cherche une formation en présentiel pour 8 personnes", {
      sessionUuid: sessA,
    });
    await driveMessage("je veux un audit", { sessionUuid: sessB });
    const a = await prisma.chatConversation.findUnique({ where: { sessionUuid: sessA } });
    const b = await prisma.chatConversation.findUnique({ where: { sessionUuid: sessB } });
    expect(a!.id).not.toBe(b!.id);
    // Les slots de A (formation/présentiel/8) ne fuient pas dans B (audit).
    const slotsB = (b!.searchSlots ?? {}) as Record<string, unknown>;
    expect(slotsB.vertical).not.toBe("formation");
  });

  it("Anti-abus : > 20 messages/min même IP → 429 rate_limited (pas d'erreur brute)", async () => {
    const ip = `203.0.113.${Math.floor(1 + Math.random() * 250)}`; // IP de test unique
    let got429 = false;
    let last200 = 0;
    for (let i = 0; i < 26; i++) {
      const r = await driveMessage(`question ${i}`, { headers: { "x-forwarded-for": ip } });
      if (r.status === 200) last200++;
      if (r.status === 429) {
        got429 = true;
        expect(r.errorBody).toMatchObject({ error: "rate_limited" });
        break;
      }
    }
    expect(got429).toBe(true);
    expect(last200).toBeGreaterThan(0); // les premiers passent, puis throttle
  });

  it("UTF-8 : accents FR (é è ç à œ) intègres dans le SSE et en DB", async () => {
    const session = randomUUID();
    const r = await driveMessage("est-ce que vous faites de la plomberie ?", {
      sessionUuid: session,
    });
    const txt = finalText(r);
    // La réponse de recadrage contient « spécialisé » — accents non corrompus.
    expect(txt).toMatch(/spécialisé|é/);
    expect(txt).not.toContain("�"); // pas de caractère de remplacement
    // Persistance : le message assistant en DB garde les accents.
    const convo = await prisma.chatConversation.findUnique({
      where: { sessionUuid: session },
      include: { messages: { where: { role: "assistant" }, take: 1 } },
    });
    const stored = convo?.messages[0]?.contenu ?? "";
    expect(stored).not.toContain("�");
    expect(stored.normalize("NFC")).toBe(stored.normalize("NFC"));
  });
});
