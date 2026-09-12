// T-14 — Tool escalader_question (ChatEscalation + ping équipe best-effort).

import { describe, it, expect, vi, beforeEach } from "vitest";

const escalationCreate = vi.fn();
const sendTelegram = vi.fn();
const enqueueEmail = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { chatEscalation: { create: (...a: unknown[]) => escalationCreate(...a) } },
}));
vi.mock("@/lib/telegram", () => ({ sendTelegram: (...a: unknown[]) => sendTelegram(...a) }));
// 🔴 2026-09-12 — CE MOCK MANQUAIT, ET LE TEST NE PASSAIT QUE PAR ACCIDENT.
//
// `escaladerQuestion` enfile une confirmation visiteur via `enqueueEmail`, donc
// BullMQ, donc Redis. Rien ne le mockait. En CI le test passe parce que
// `REDIS_URL` vaut `stub.invalid` et que le Proxy de `lib/redis.ts` court-circuite
// tout (ADR 0026) : la garde tenait par une propriété de l'ENVIRONNEMENT, pas du
// test. Sur un Redis RÉEL — une machine de développement, par exemple — il PEND
// indéfiniment : mesuré le 2026-09-12, dépassement à 5 s comme à 30 s, 3 fois sur 3.
//
// 🔑 Un test vert dont la verdeur dépend d'un stub d'infrastructure ne mesure pas
// ce qu'il annonce. Et il est pire qu'un test absent : il fait croire que le
// chemin est couvert.
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => enqueueEmail(...a),
}));

import {
  escaladerQuestion,
  EscaladerQuestionInputSchema,
} from "@/server/chatbot/tools/escalader-question";

const ctx = { tenantId: "t1", conversationId: "conv-1" };

beforeEach(() => {
  escalationCreate.mockReset();
  sendTelegram.mockReset();
  enqueueEmail.mockReset();
  enqueueEmail.mockResolvedValue(undefined);
});

describe("T-14 escalader_question", () => {
  it("refuse un email invalide", () => {
    expect(() =>
      EscaladerQuestionInputSchema.parse({ question: "?", contact_email: "pas-un-email" }),
    ).toThrow();
  });

  it("crée une ChatEscalation ouverte et notifie l'équipe", async () => {
    escalationCreate.mockResolvedValue({ id: "esc-1", statut: "ouverte" });
    sendTelegram.mockResolvedValue(true);
    const r = await escaladerQuestion(
      { question: "Faites-vous du conseil RGPD ?", contact_email: "jean@acme.fr" },
      ctx,
    );
    expect(r).toEqual({ escalationId: "esc-1", statut: "ouverte", notified: true });
    const data = escalationCreate.mock.calls[0]![0].data;
    expect(data.tenantId).toBe("t1");
    expect(data.conversationId).toBe("conv-1");
    expect(data.statut).toBe("ouverte");
    expect(data.contactEmail).toBe("jean@acme.fr");
    expect(sendTelegram).toHaveBeenCalledOnce();

    // 🔑 LA CONFIRMATION AU VISITEUR N'ÉTAIT VÉRIFIÉE PAR RIEN.
    // Le code la décrit pourtant comme « le pire endroit pour un silence » : la
    // personne vient d'écrire dans une fenêtre qu'elle va fermer, et sans cet
    // e-mail il ne lui reste ni preuve, ni rappel, ni moyen de relancer.
    expect(enqueueEmail).toHaveBeenCalledOnce();
    const [gabarit, destinataire, locale] = enqueueEmail.mock.calls[0]!;
    expect(gabarit).toBe("chatbot-demande-transmise");
    expect(destinataire).toBe("jean@acme.fr");
    expect(locale).toBe("fr");
  });

  it("fonctionne sans contact ni Telegram configuré (fail-soft → notified=false)", async () => {
    escalationCreate.mockResolvedValue({ id: "esc-2", statut: "ouverte" });
    sendTelegram.mockResolvedValue(false);
    const r = await escaladerQuestion({ question: "Question sans contact" }, { tenantId: "t1" });
    expect(r).toEqual({ escalationId: "esc-2", statut: "ouverte", notified: false });
    // 🔑 CONTRE-TÉMOIN de l'assertion du cas précédent. Sans lui, un
    // `enqueueEmail` appelé INCONDITIONNELLEMENT satisferait les deux tests :
    // on ne saurait pas si la confirmation suit l'adresse ou part toujours.
    expect(
      enqueueEmail,
      "aucune adresse n'a été fournie : il n'y a personne à confirmer",
    ).not.toHaveBeenCalled();
    // Pas de conversationId ni de contactEmail dans le payload.
    const data = escalationCreate.mock.calls[0]![0].data;
    expect(data.conversationId).toBeUndefined();
    expect(data.contactEmail).toBeUndefined();
  });
});
