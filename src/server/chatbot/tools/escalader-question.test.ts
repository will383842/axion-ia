// T-14 — Tool escalader_question (ChatEscalation + ping équipe best-effort).

import { describe, it, expect, vi, beforeEach } from "vitest";

const escalationCreate = vi.fn();
// Décision Will 15/10 : l'escalade part par `notify()` (salon « Clients »).
const notify = vi.fn();
const enqueueEmail = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { chatEscalation: { create: (...a: unknown[]) => escalationCreate(...a) } },
}));
vi.mock("@/server/notifications", () => ({ notify: (...a: unknown[]) => notify(...a) }));
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
  vi.unstubAllEnvs();
  escalationCreate.mockReset();
  notify.mockReset();
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
    // L'alerte part après la réponse (`after`, relecture PR 1553) : `notified`
    // dit qu'une route Telegram existe — ici, le salon « Clients ».
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:abc");
    vi.stubEnv("TELEGRAM_CHAT_ID_CLIENTS", "-100777");
    escalationCreate.mockResolvedValue({ id: "esc-1", statut: "ouverte" });
    notify.mockResolvedValue({ ok: true, channels: { telegram: "sent" } });
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
    expect(notify).toHaveBeenCalledOnce();
    // La question EN ENTIER et l'adresse : le salon « Clients » porte tout.
    expect(notify.mock.calls[0]![0]).toMatchObject({
      category: "CHATBOT_ESCALATION",
      payload: {
        escalationId: "esc-1",
        question: "Faites-vous du conseil RGPD ?",
        contactEmail: "jean@acme.fr",
      },
    });

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
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    escalationCreate.mockResolvedValue({ id: "esc-2", statut: "ouverte" });
    notify.mockResolvedValue({ ok: false, channels: { telegram: "skipped" } });
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
