/**
 * Détail COMPLET dans les salons dédiés (décision du fondateur, 14/11/2026).
 *
 * Calendly non-client, presse, investisseurs, avis, podcast et conférences : le salon DÉDIÉ
 * reçoit nom complet, coordonnées et message intégral (texte brut, avec son). Sans salon dédié,
 * le repli reçoit le gabarit ALLÉGÉ : jamais de coordonnées hors d'un salon dédié.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { flushPendingDispatches, notify } from "../index";
import { formatNotificationDetail, type EvenementDetail } from "../format-detail";
import { aDetailComplet, ALL_NOTIFICATION_CATEGORIES } from "../routing";
import type { NotifyInput } from "../types";

vi.mock("@/lib/redis", () => ({
  redis: {
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
  },
}));

const NOM = "Marie Dupontcanari";
const EMAIL = "marie.canari@exemple.fr";
const TEL = "+33 6 39 98 12 34";
const TEXTE = "MESSAGE-INTEGRAL-CANARI";

const EVENEMENTS: EvenementDetail[] = [
  {
    category: "CALENDLY_INVITEE_CREATED",
    payload: {
      eventUri: "evt_1",
      inviteeEmail: EMAIL,
      inviteeName: NOM,
      inviteePhone: TEL,
      eventStartTime: "2026-11-20T09:00:00.000Z",
      eventName: "Échange apporteur",
      answersText: TEXTE,
    },
  },
  {
    category: "CALENDLY_INVITEE_CANCELED",
    payload: {
      eventUri: "evt_1",
      inviteeEmail: EMAIL,
      inviteeName: NOM,
      inviteePhone: TEL,
      eventName: "Échange apporteur",
      reason: TEXTE,
    },
  },
  {
    category: "CALENDLY_INVITEE_RESCHEDULED",
    payload: {
      eventUri: "evt_1",
      inviteeEmail: EMAIL,
      inviteeName: NOM,
      inviteePhone: TEL,
      eventName: "Échange apporteur",
      oldStart: "2026-11-20T09:00:00.000Z",
      newStart: "2026-11-21T09:00:00.000Z",
    },
  },
  {
    category: "PRESS_REQUEST_SUBMITTED",
    payload: {
      submissionId: "sub_p",
      contactName: NOM,
      contactEmail: EMAIL,
      contactPhone: TEL,
      outlet: "Le Quotidien",
      message: TEXTE,
      locale: "fr",
    },
  },
  {
    category: "INVESTOR_INQUIRY_RECEIVED",
    payload: {
      submissionId: "sub_i",
      contactName: NOM,
      contactEmail: EMAIL,
      contactPhone: TEL,
      firm: "Fonds Fictif",
      message: TEXTE,
      locale: "fr",
    },
  },
  {
    category: "REVIEW_SUBMITTED",
    payload: {
      reviewId: "rev_1",
      authorName: "Marie D.",
      rating: 5,
      companyName: "Exemple SARL",
      hasPhoto: false,
      excerpt: TEXTE,
      locale: "fr",
    },
  },
  {
    category: "PODCAST_REQUEST_SUBMITTED",
    payload: {
      requestId: "req_1",
      companyName: "Exemple SARL",
      leaderName: NOM,
      contactEmail: EMAIL,
      contactPhone: TEL,
      city: "Lyon",
      postalCode: "69000",
      message: TEXTE,
      locale: "fr",
    },
  },
  {
    category: "SPEAKER_INVITATION_RECEIVED",
    payload: {
      submissionId: "sub_s",
      contactName: NOM,
      contactEmail: EMAIL,
      contactPhone: TEL,
      eventName: "Salon Fictif",
      message: TEXTE,
      locale: "fr",
    },
  },
];

/** Variable du salon dédié de chaque catégorie. */
const SALON_DE: Record<string, string> = {
  CALENDLY_INVITEE_CREATED: "TELEGRAM_CHAT_ID_CALENDLY",
  CALENDLY_INVITEE_CANCELED: "TELEGRAM_CHAT_ID_CALENDLY",
  CALENDLY_INVITEE_RESCHEDULED: "TELEGRAM_CHAT_ID_CALENDLY",
  PRESS_REQUEST_SUBMITTED: "TELEGRAM_CHAT_ID_PRESSE",
  INVESTOR_INQUIRY_RECEIVED: "TELEGRAM_CHAT_ID_INVESTISSEURS",
  REVIEW_SUBMITTED: "TELEGRAM_CHAT_ID_AVIS",
  PODCAST_REQUEST_SUBMITTED: "TELEGRAM_CHAT_ID_MESSAGES",
  SPEAKER_INVITATION_RECEIVED: "TELEGRAM_CHAT_ID_MESSAGES",
};

const fetchMock = vi.fn();

function envoyes(): Array<{ chat: string; texte: string; parseMode: string | undefined }> {
  return fetchMock.mock.calls.map((c) => {
    const b = JSON.parse((c[1] as { body: string }).body) as Record<string, unknown>;
    return {
      chat: String(b["chat_id"]),
      texte: String(b["text"]),
      parseMode: b["parse_mode"] as string | undefined,
    };
  });
}

async function emettre(e: EvenementDetail): Promise<void> {
  await notify({ category: e.category, payload: e.payload, sync: true } as unknown as NotifyInput);
  await flushPendingDispatches();
}

describe("salons humains — détail complet", () => {
  const fetchOriginal = globalThis.fetch;
  const envOriginal = { ...process.env };

  beforeEach(() => {
    fetchMock
      .mockReset()
      .mockImplementation(async () => new Response('{"ok":true}', { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    for (const k of Object.keys(process.env)) if (k.startsWith("TELEGRAM_")) delete process.env[k];
    process.env.TELEGRAM_BOT_TOKEN = "bot";
    process.env.TELEGRAM_CHAT_ID = "-general";
    process.env.REDIS_URL = "redis://localhost:6381";
  });

  afterEach(() => {
    globalThis.fetch = fetchOriginal;
    process.env = { ...envOriginal };
  });

  it("`aDetailComplet` : exactement les 8 catégories prévues", () => {
    expect(ALL_NOTIFICATION_CATEGORIES.filter(aDetailComplet).sort()).toEqual(
      EVENEMENTS.map((e) => e.category).sort(),
    );
    for (const c of [
      "RGPD_REQUEST_SUBMITTED",
      "QUESTIONNAIRE_PREAUDIT_REPONSE",
      "QUESTIONNAIRE_PREAUDIT_SUIVI",
      "GUIDE_REQUESTED",
      "TOUR_DEMANDE_RECUE",
    ] as const) {
      expect(aDetailComplet(c), c).toBe(false);
    }
  });

  it("le gabarit complet porte nom, e-mail, téléphone et message intégral", () => {
    for (const e of EVENEMENTS) {
      const t = formatNotificationDetail(e, new Date("2026-11-14T08:00:00Z"));
      if (e.category === "REVIEW_SUBMITTED") {
        // Auteur déjà public (prénom + initiale) : le commentaire est repris tel quel.
        expect(t, e.category).toContain("Marie D.");
        expect(t, e.category).toContain(TEXTE);
        continue;
      }
      expect(t, e.category).toContain(EMAIL);
      expect(t, e.category).toContain("Dupontcanari");
      if (e.category !== "CALENDLY_INVITEE_RESCHEDULED") expect(t, e.category).toContain(TEXTE);
    }
  });

  it("en-têtes des rendez-vous Calendly non-client", () => {
    const [cree, annule, reporte] = EVENEMENTS.slice(0, 3).map(
      (e) => formatNotificationDetail(e).split("\n")[0],
    );
    expect(cree).toBe("📅 RDV APPORTEUR / FORMATEUR — Échange apporteur");
    expect(annule).toContain("ANNULÉ");
    expect(reporte).toContain("REPORTÉ");
  });

  it("salon dédié posé : le détail complet y part, en texte brut, sans repli", async () => {
    process.env.TELEGRAM_CHAT_ID_PRESSE = "-presse";
    process.env.TELEGRAM_CHAT_ID_INVESTISSEURS = "-invest";
    process.env.TELEGRAM_CHAT_ID_AVIS = "-avis";
    process.env.TELEGRAM_CHAT_ID_MESSAGES = "-messages";
    process.env.TELEGRAM_CHAT_ID_CALENDLY = "-calendly";
    process.env.TELEGRAM_CALENDLY_BOT_TOKEN = "bot-calendly";
    for (const e of EVENEMENTS) {
      fetchMock.mockClear();
      await emettre(e);
      const envoye = envoyes();
      expect(envoye.length, e.category).toBe(1);
      expect(envoye[0]!.chat, e.category).toBe(process.env[SALON_DE[e.category]!]);
      expect(envoye[0]!.parseMode, e.category).toBeUndefined();
      expect(envoye[0]!.texte, e.category).toContain(
        e.category === "REVIEW_SUBMITTED" ? TEXTE : "Dupontcanari",
      );
    }
  });

  it("le détail complet part SANS aperçu de lien (Telegram ne va pas lire l'URL console)", async () => {
    process.env.TELEGRAM_CHAT_ID_PRESSE = "-presse";
    process.env.TELEGRAM_CHAT_ID_INVESTISSEURS = "-invest";
    process.env.TELEGRAM_CHAT_ID_AVIS = "-avis";
    process.env.TELEGRAM_CHAT_ID_MESSAGES = "-messages";
    process.env.TELEGRAM_CHAT_ID_CALENDLY = "-calendly";
    process.env.TELEGRAM_CALENDLY_BOT_TOKEN = "bot-calendly";
    for (const e of EVENEMENTS) {
      fetchMock.mockClear();
      await emettre(e);
      expect(fetchMock.mock.calls.length, e.category).toBe(1);
      const corps = JSON.parse((fetchMock.mock.calls[0]![1] as { body: string }).body) as {
        link_preview_options?: { is_disabled?: boolean };
      };
      expect(corps.link_preview_options?.is_disabled, e.category).toBe(true);
    }
  });

  it("🔴 salon dédié absent : le repli ne reçoit JAMAIS de coordonnées", async () => {
    for (const e of EVENEMENTS) {
      fetchMock.mockClear();
      await emettre(e);
      for (const m of envoyes()) {
        for (const interdit of ["Dupontcanari", "canari@", "6 39 98 12 34", "CANARI"]) {
          expect(m.texte, `${e.category} : « ${interdit} »`).not.toContain(interdit);
        }
      }
    }
  });

  it("🔴 envoi au salon dédié raté : le dernier essai est allégé", async () => {
    process.env.TELEGRAM_CHAT_ID_PRESSE = "-presse";
    process.env.TELEGRAM_CHAT_ID_MESSAGES = "-messages";
    fetchMock.mockImplementation(async (_u: unknown, init: { body: string }) => {
      const b = JSON.parse(init.body) as { chat_id: string };
      return b.chat_id === "-presse"
        ? new Response('{"ok":false}', { status: 500 })
        : new Response('{"ok":true}', { status: 200 });
    });
    await emettre(EVENEMENTS.find((x) => x.category === "PRESS_REQUEST_SUBMITTED")!);
    const dernier = envoyes().at(-1)!;
    expect(dernier.chat).toBe("-messages");
    expect(dernier.texte).not.toContain("canari@");
  });
});
