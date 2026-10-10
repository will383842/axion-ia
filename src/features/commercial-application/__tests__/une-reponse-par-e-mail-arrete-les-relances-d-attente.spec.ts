// R6 — une RÉPONSE PAR E-MAIL de la personne arrête ses relances d'attente
// (2026-10-10).
//
// Avant : le relevé de la boîte Zoho enregistrait la réponse d'une personne
// invitée et arrêtait ses rappels d'invitation, mais jamais les relances
// « votre inscription vous attend » (A1, A2, A3 du tunnel vidéo, J+2 / J+7 de
// l'ancien formulaire) — et il ignorait complètement la réponse d'un lead pas
// encore invité, qui est pourtant le cas courant : il répond à « il vous manque
// une étape ». Deux jours plus tard, il recevait la relance.

import { beforeEach, describe, expect, it, vi } from "vitest";

type Ligne = Record<string, unknown>;

const db = vi.hoisted(() => ({
  submissions: [] as Ligne[],
  emailLogs: [] as Ligne[],
  entrantes: [] as Ligne[],
  annuler: null as unknown as ReturnType<typeof vi.fn>,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: {
      findMany: async (a: { where: { contactEmailHash: { in: string[] } } }) =>
        db.submissions.filter(
          (l) =>
            a.where.contactEmailHash.in.includes(l["contactEmailHash"] as string) &&
            !l["deletedAt"],
        ),
      updateMany: async () => ({ count: 0 }),
    },
    emailLog: {
      findMany: async (a: { where: { entityId: { in: string[] } } }) =>
        db.emailLogs.filter((l) => a.where.entityId.in.includes(l["entityId"] as string)),
    },
    submissionInboundReply: {
      findMany: async () => [],
      create: async (a: { data: Ligne }) => {
        db.entrantes.push(a.data);
        return a.data;
      },
    },
    setting: { findUnique: async () => null, upsert: async () => ({}) },
  },
}));
vi.mock("@/lib/pii-crypto", () => ({
  encryptPii: (v: string | null) => (v ? `enc:${v}` : v),
  decryptPii: (v: string | null) => v,
}));
vi.mock("@/server/notifications", () => ({ notify: vi.fn(async () => ({ ok: true })) }));
vi.mock("../relances-lead-apporteur", () => ({
  annulerRelancesLeadApporteur: (...a: unknown[]) => db.annuler(...a),
}));

import { MOTIF_ANNULATION_REPONSE, passerReponsesEntrantes } from "../reponses-entrantes-apporteur";
import { GABARIT_INVITATION_APPORTEUR } from "../invitation-apporteur";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import type { ClientZohoMail, MessageZoho } from "@/server/zoho-mail/client";
import type { Entetes } from "@/lib/commercial-application/reponse-entrante";

const EMPREINTE = hashEmailForLookup("camille@exemple.fr")!;
const INSCRIT = new Date("2026-10-08T10:00:00Z");
const MAINTENANT = new Date("2026-10-09T10:00:00Z");

const leadVideo = (over: Ligne = {}): Ligne => ({
  id: "lead-video",
  contactEmailHash: EMPREINTE,
  contactName: "Camille",
  submittedAt: INSCRIT,
  deletedAt: null,
  details: {
    unifiedType: "recrutement",
    subType: "candidature-commerciale",
    vsl: { version: "v1", etapeAtteinte: 1 },
  },
  ...over,
});

const message = (over: Partial<MessageZoho> = {}): MessageZoho => ({
  messageId: "m-1",
  folderId: "f-1",
  fromAddress: "Camille <Camille@Exemple.fr>",
  subject: "Re: Il vous manque une étape",
  summary: "Bonjour, je vous rappelle demain.",
  receivedAt: new Date("2026-10-09T09:00:00Z"),
  ...over,
});

const AUTO: Entetes = { "auto-submitted": ["auto-replied"] };

function client(messages: MessageZoho[], entetes: Record<string, Entetes> = {}) {
  return {
    listerMessagesRecus: vi.fn(async () => ({ messages, complet: true })),
    lireEntetes: vi.fn(async (_f: string, id: string) => entetes[id] ?? { "message-id": ["<x>"] }),
  } satisfies ClientZohoMail;
}

beforeEach(() => {
  db.submissions = [leadVideo()];
  db.emailLogs = [];
  db.entrantes = [];
  db.annuler = vi.fn(async () => 3);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("R6 — une réponse par e-mail arrête les relances d'attente", () => {
  it("🔴 un lead de la page vidéo, pas encore invité, répond : ses relances A1/A2/A3 sont annulées", async () => {
    await passerReponsesEntrantes({ client: client([message()]), maintenant: MAINTENANT });
    expect(db.annuler).toHaveBeenCalledTimes(1);
    expect(db.annuler).toHaveBeenCalledWith("camille@exemple.fr", MOTIF_ANNULATION_REPONSE);
    expect(MOTIF_ANNULATION_REPONSE).toBe("Envoi annulé : la personne a répondu par e-mail.");
    // Rien n'est enregistré comme réponse à une invitation : il n'y en a pas.
    expect(db.entrantes).toHaveLength(0);
  });

  it("🔴 une personne invitée répond : réponse enregistrée ET relances d'attente annulées", async () => {
    db.emailLogs = [
      {
        template: GABARIT_INVITATION_APPORTEUR,
        entityType: "Submission",
        entityId: "lead-video",
        status: "sent",
        createdAt: new Date("2026-10-08T12:00:00Z"),
        sentAt: new Date("2026-10-08T12:00:00Z"),
      },
    ];
    await passerReponsesEntrantes({ client: client([message()]), maintenant: MAINTENANT });
    expect(db.entrantes).toHaveLength(1);
    expect(db.annuler).toHaveBeenCalledWith("camille@exemple.fr", MOTIF_ANNULATION_REPONSE);
  });

  it("une réponse AUTOMATIQUE (absence) n'arrête rien", async () => {
    await passerReponsesEntrantes({
      client: client([message()], { "m-1": AUTO }),
      maintenant: MAINTENANT,
    });
    expect(db.annuler).not.toHaveBeenCalled();
  });

  it("un message ANTÉRIEUR à la fiche n'est pas une réponse : il n'arrête rien", async () => {
    await passerReponsesEntrantes({
      client: client([message({ receivedAt: new Date("2026-10-07T09:00:00Z") })]),
      maintenant: MAINTENANT,
    });
    expect(db.annuler).not.toHaveBeenCalled();
  });

  it("un expéditeur inconnu ou une fiche qui n'est pas apporteur n'arrête rien", async () => {
    db.submissions = [leadVideo({ details: { unifiedType: "contact" } })];
    const c = client([message(), message({ messageId: "m-2", fromAddress: "x@ailleurs.fr" })]);
    await passerReponsesEntrantes({ client: c, maintenant: MAINTENANT });
    expect(db.annuler).not.toHaveBeenCalled();
    expect(c.lireEntetes).not.toHaveBeenCalled();
  });

  it("un retrait qui échoue n'interrompt pas le relevé", async () => {
    db.annuler = vi.fn(async () => {
      throw new Error("redis muet");
    });
    const r = await passerReponsesEntrantes({
      client: client([message()]),
      maintenant: MAINTENANT,
    });
    expect(r.erreurs).toBe(0);
  });
});
