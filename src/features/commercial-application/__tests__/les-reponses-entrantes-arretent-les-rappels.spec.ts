// Les réponses des candidats apporteurs, relevées dans la boîte Zoho Mail
// (décision Will, 2026-09-27).
//
// Joué sur une base EN MÉMOIRE (les filtres Prisma employés sont réinterprétés
// ici) et un client Zoho DOUBLÉ — aucun appel réseau. On vérifie :
//   · le rattachement par empreinte d'adresse, à la fiche invitée ;
//   · ce qui est ignoré : expéditeur inconnu, message antérieur à l'invitation,
//     fiche supprimée ;
//   · l'idempotence par identifiant Zoho, et le curseur ;
//   · qu'une réponse HUMAINE arrête les rappels (passage quotidien ET filet du
//     départ), qu'une réponse AUTOMATIQUE ne les arrête pas ;
//   · le badge de la liste ;
//   · l'inertie : variables absentes, build `stub.invalid`, table pas encore
//     migrée, Zoho injoignable.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Ligne = Record<string, unknown>;

const db = vi.hoisted(() => ({
  submissions: [] as Ligne[],
  emailLogs: [] as Ligne[],
  outbox: [] as Ligne[],
  calendly: [] as Ligne[],
  replies: [] as Ligne[],
  entrantes: [] as Ligne[],
  settings: new Map<string, unknown>(),
  tableAbsente: false,
  enqueue: null as unknown as ReturnType<typeof vi.fn>,
  verdict: null as unknown as ReturnType<typeof vi.fn>,
  notify: null as unknown as ReturnType<typeof vi.fn>,
  annuler: null as unknown as ReturnType<typeof vi.fn>,
}));

function correspond(ligne: Ligne, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([cle, cond]) => {
    if (cle === "OR") return (cond as Record<string, unknown>[]).some((w) => correspond(ligne, w));
    const v = ligne[cle];
    if (cond !== null && typeof cond === "object" && !(cond instanceof Date)) {
      const c = cond as Record<string, unknown>;
      if ("in" in c) {
        const liste = c["in"] as unknown[];
        return liste.some((x) =>
          typeof x === "string" && typeof v === "string"
            ? x.toLowerCase() === v.toLowerCase()
            : x === v,
        );
      }
      if ("gt" in c) return v instanceof Date && v.getTime() > (c["gt"] as Date).getTime();
      if ("gte" in c) return v instanceof Date && v.getTime() >= (c["gte"] as Date).getTime();
      if ("not" in c) return v !== c["not"] && v !== undefined;
      return false;
    }
    return v === cond;
  });
}

function trouver(table: Ligne[], args: { where?: Record<string, unknown>; orderBy?: unknown }) {
  const rows = table.filter((l) => correspond(l, args.where));
  const ordre = args.orderBy as { createdAt?: "asc" | "desc" } | undefined;
  if (ordre?.createdAt) {
    rows.sort((a, b) => {
      const d = (a["createdAt"] as Date).getTime() - (b["createdAt"] as Date).getTime();
      return ordre.createdAt === "desc" ? -d : d;
    });
  }
  return rows;
}

function absente(): never {
  throw Object.assign(new Error("The table `submission_inbound_replies` does not exist"), {
    code: "P2021",
  });
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: {
      findMany: async (a: { where?: Record<string, unknown> }) => trouver(db.submissions, a),
      findUnique: async (a: { where: { id: string } }) =>
        db.submissions.find((l) => l["id"] === a.where.id) ?? null,
      updateMany: async (a: {
        where: { id: string; status: string };
        data: Record<string, unknown>;
      }) => {
        const cibles = db.submissions.filter(
          (l) => l["id"] === a.where.id && l["status"] === a.where.status,
        );
        for (const l of cibles) Object.assign(l, a.data);
        return { count: cibles.length };
      },
    },
    emailLog: {
      findMany: async (a: { where?: Record<string, unknown> }) => trouver(db.emailLogs, a),
      findFirst: async (a: { where?: Record<string, unknown> }) =>
        trouver(db.emailLogs, a)[0] ?? null,
    },
    emailOutbox: {
      findMany: async (a: { where?: Record<string, unknown> }) => trouver(db.outbox, a),
    },
    calendlyEvent: {
      findMany: async (a: { where?: Record<string, unknown> }) => trouver(db.calendly, a),
    },
    submissionReply: {
      findMany: async (a: { where?: Record<string, unknown> }) => trouver(db.replies, a),
    },
    submissionInboundReply: {
      findMany: async (a: { where?: Record<string, unknown> }) =>
        db.tableAbsente ? absente() : trouver(db.entrantes, a),
      create: async (a: { data: Ligne }) => {
        if (db.tableAbsente) absente();
        if (db.entrantes.some((l) => l["zohoMessageId"] === a.data["zohoMessageId"])) {
          throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
        }
        const ligne = { id: `rep-${db.entrantes.length}`, auto: false, ...a.data };
        db.entrantes.push(ligne);
        return ligne;
      },
    },
    setting: {
      findUnique: async (a: { where: { key: string } }) =>
        db.settings.has(a.where.key) ? { value: db.settings.get(a.where.key) } : null,
      upsert: async (a: { where: { key: string }; update: { value: unknown } }) => {
        db.settings.set(a.where.key, a.update.value);
        return {};
      },
    },
  },
}));
vi.mock("@/lib/pii-crypto", () => ({
  encryptPii: (v: string | null) => (v ? `enc:${v}` : v),
  decryptPii: (v: string | null) => (v && v.startsWith("enc:") ? v.slice(4) : v),
  isDecryptedEmailUsable: (v: string | null) => !!v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  PII_DECRYPT_PLACEHOLDER: "[encrypted — key missing]",
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => db.enqueue(...a),
}));
vi.mock("@/server/email/verdict-envoi", () => ({
  verdictAvantEnvoi: (...a: unknown[]) => db.verdict(...a),
}));
vi.mock("@/server/notifications", () => ({
  notify: (...a: unknown[]) => db.notify(...a),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import {
  CHEVAUCHEMENT_MS,
  CLE_CURSEUR,
  RATTRAPAGE_INITIAL_MS,
  passerReponsesEntrantes,
  reinitialiserJournalConfig,
} from "../reponses-entrantes-apporteur";
import { passerRelancesInvitation } from "../relances-invitation-apporteur";
import { motifRetenueRelanceInvitation } from "../relance-invitation-etat";
import { GABARIT_INVITATION_APPORTEUR, lireSuiviInvitationListe } from "../invitation-apporteur";
import { badgeSuiviInvitation } from "@/lib/commercial-application/relance-invitation";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import type { ClientZohoMail, MessageZoho } from "@/server/zoho-mail/client";
import type { Entetes } from "@/lib/commercial-application/reponse-entrante";

const JOUR = 24 * 60 * 60 * 1000;
const INVITATION = new Date("2026-09-27T19:30:00Z");
const EMPREINTE = hashEmailForLookup("camille@exemple.fr")!;
const CALENDLY = "https://calendly.com/axion-ia/echange-apporteur";
const passage = (jour: number) => new Date(Date.UTC(2026, 8, 27 + jour, 8, 0, 0));

function ligne(over: Ligne = {}): Ligne {
  return {
    id: "ligne-a",
    contactEmailHash: EMPREINTE,
    contactEmail: "camille@exemple.fr",
    contactName: "Camille Martin",
    locale: "fr",
    deletedAt: null,
    archivedAt: null,
    status: "new",
    details: { unifiedType: "recrutement", subType: "candidature-commerciale" },
    ...over,
  };
}

function invitation(over: Ligne = {}): Ligne {
  return {
    id: "inv-1",
    template: GABARIT_INVITATION_APPORTEUR,
    entityType: "Submission",
    entityId: "ligne-a",
    status: "sent",
    createdAt: INVITATION,
    sentAt: INVITATION,
    ...over,
  };
}

function message(over: Partial<MessageZoho> = {}): MessageZoho {
  return {
    messageId: "1709887058769100001",
    folderId: "9000000002014",
    fromAddress: "Camille@Exemple.fr",
    subject: "Re: Ton échange de 15 minutes",
    summary:
      "Bonjour, merci ! Je suis disponible jeudi. Le 27 sept. 2026 à 21:30, Axion-IA a écrit : Bonjour Camille",
    // Le lendemain de l'invitation, une demi-heure avant le passage testé.
    receivedAt: new Date("2026-09-28T09:30:00Z"),
    ...over,
  };
}

const HUMAIN: Entetes = {
  "message-id": ["<abc@exemple.fr>"],
  "in-reply-to": ["<invitation@axion-ia.com>"],
};
const AUTOMATIQUE: Entetes = { "auto-submitted": ["auto-replied"], "message-id": ["<oof@x>"] };

function clientDouble(messages: MessageZoho[], entetes: Record<string, Entetes> = {}) {
  const client = {
    listerMessagesRecus: vi.fn(async (depuis: Date) => ({
      messages: messages.filter((m) => m.receivedAt.getTime() >= depuis.getTime()),
      complet: true,
    })),
    lireEntetes: vi.fn(async (_f: string, id: string) => entetes[id] ?? HUMAIN),
  };
  return client satisfies ClientZohoMail;
}

beforeEach(() => {
  db.submissions = [ligne()];
  db.emailLogs = [invitation()];
  db.outbox = [];
  db.calendly = [];
  db.replies = [];
  db.entrantes = [];
  db.settings = new Map();
  db.tableAbsente = false;
  db.enqueue = vi.fn(async () => ({ enqueued: true }));
  db.verdict = vi.fn(async () => ({ retenu: false }));
  db.notify = vi.fn(async () => ({ ok: true }));
  db.annuler = vi.fn(async () => 0);
  process.env["CALENDLY_APPORTEUR_URL"] = CALENDLY;
  reinitialiserJournalConfig();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  delete process.env["CALENDLY_APPORTEUR_URL"];
  vi.restoreAllMocks();
});

const MAINTENANT = new Date("2026-09-28T10:00:00Z");

describe("le rattachement d'une réponse à la fiche invitée", () => {
  it("🔴 une réponse de la personne invitée est enregistrée, rattachée par l'empreinte de son adresse", async () => {
    const client = clientDouble([message()]);
    const r = await passerReponsesEntrantes({ client, maintenant: MAINTENANT });

    expect(r.enregistrees).toEqual({ humaines: 1, automatiques: 0 });
    expect(db.entrantes).toHaveLength(1);
    const e = db.entrantes[0]!;
    expect(e["submissionId"]).toBe("ligne-a");
    expect(e["fromEmailHash"]).toBe(EMPREINTE);
    expect(e["zohoMessageId"]).toBe("1709887058769100001");
    expect(e["internetMessageId"]).toBe("<abc@exemple.fr>");
    expect(e["auto"]).toBe(false);
    // L'extrait est CHIFFRÉ, et la citation de notre invitation en est retirée.
    expect(e["excerpt"]).toBe("enc:Bonjour, merci ! Je suis disponible jeudi.");
    // Will est prévenu, sans adresse ni extrait.
    expect(db.notify).toHaveBeenCalledTimes(1);
    expect(db.notify.mock.calls[0]![0]).toMatchObject({
      category: "APPORTEUR_REPLIED",
      payload: { submissionId: "ligne-a", contactName: "Camille Martin" },
    });
    expect(JSON.stringify(db.notify.mock.calls[0])).not.toContain("camille@exemple.fr");
  });

  it("la réponse va à la fiche de l'invitation, même si la personne a une ligne plus récente", async () => {
    db.submissions.push(
      ligne({
        id: "ligne-recente",
        details: { unifiedType: "recrutement", subType: "candidature-commerciale", etape: "1" },
      }),
    );
    await passerReponsesEntrantes({ client: clientDouble([message()]), maintenant: MAINTENANT });
    expect(db.entrantes.map((e) => e["submissionId"])).toEqual(["ligne-a"]);
  });

  it("ignore un expéditeur inconnu", async () => {
    const client = clientDouble([message({ fromAddress: "quelquun@ailleurs.fr" })]);
    const r = await passerReponsesEntrantes({ client, maintenant: MAINTENANT });
    expect(r.reconnus).toBe(0);
    expect(db.entrantes).toHaveLength(0);
    expect(client.lireEntetes).not.toHaveBeenCalled();
    expect(db.notify).not.toHaveBeenCalled();
  });

  it("ignore un message ANTÉRIEUR à l'invitation — il n'y répond pas", async () => {
    const client = clientDouble([message({ receivedAt: new Date(INVITATION.getTime() - 60_000) })]);
    // Le premier passage remonte assez loin pour le voir.
    const r = await passerReponsesEntrantes({ client, maintenant: MAINTENANT });
    expect(r.lus).toBe(1);
    expect(r.reconnus).toBe(0);
    expect(db.entrantes).toHaveLength(0);
  });

  it("ignore une personne jamais invitée, et une fiche supprimée", async () => {
    db.emailLogs = [];
    await passerReponsesEntrantes({ client: clientDouble([message()]), maintenant: MAINTENANT });
    expect(db.entrantes).toHaveLength(0);

    db.emailLogs = [invitation()];
    db.submissions = [ligne({ deletedAt: new Date("2026-09-28T00:00:00Z") })];
    await passerReponsesEntrantes({ client: clientDouble([message()]), maintenant: MAINTENANT });
    expect(db.entrantes).toHaveLength(0);
  });

  it("une invitation en ÉCHEC n'est pas une invitation partie : rien n'est rattaché", async () => {
    db.emailLogs = [invitation({ status: "failed" })];
    await passerReponsesEntrantes({ client: clientDouble([message()]), maintenant: MAINTENANT });
    expect(db.entrantes).toHaveLength(0);
  });
});

describe("l'idempotence et le curseur", () => {
  it("🔴 un même message Zoho n'est enregistré qu'une fois, ses en-têtes ne sont relus qu'une fois", async () => {
    const client = clientDouble([message()]);
    await passerReponsesEntrantes({ client, maintenant: MAINTENANT });
    const r2 = await passerReponsesEntrantes({
      client,
      maintenant: new Date(MAINTENANT.getTime() + 15 * 60_000),
    });
    expect(db.entrantes).toHaveLength(1);
    expect(r2.dejaConnues).toBe(1);
    expect(r2.enregistrees).toEqual({ humaines: 0, automatiques: 0 });
    expect(client.lireEntetes).toHaveBeenCalledTimes(1);
    expect(db.notify).toHaveBeenCalledTimes(1);
  });

  it("le premier passage remonte 14 jours ; le suivant repart du curseur moins deux heures", async () => {
    const client = clientDouble([]);
    await passerReponsesEntrantes({ client, maintenant: MAINTENANT });
    expect(client.listerMessagesRecus.mock.calls[0]![0].getTime()).toBe(
      MAINTENANT.getTime() - RATTRAPAGE_INITIAL_MS,
    );
    expect(db.settings.get(CLE_CURSEUR)).toEqual({ depuis: MAINTENANT.toISOString() });

    const ensuite = new Date(MAINTENANT.getTime() + 15 * 60_000);
    await passerReponsesEntrantes({ client, maintenant: ensuite });
    expect(client.listerMessagesRecus.mock.calls[1]![0].getTime()).toBe(
      MAINTENANT.getTime() - CHEVAUCHEMENT_MS,
    );
  });

  it("un message non enregistré (base en erreur) garde le curseur : il sera relu", async () => {
    db.settings.set(CLE_CURSEUR, { depuis: "2026-09-28T09:00:00.000Z" });
    const client = clientDouble([message()]);
    const { prisma } = await import("@/lib/prisma");
    const spy = vi
      .spyOn(prisma.submissionInboundReply, "create")
      .mockRejectedValueOnce(new Error("connexion perdue"));
    const r = await passerReponsesEntrantes({ client, maintenant: MAINTENANT });
    expect(r.erreurs).toBe(1);
    expect(db.settings.get(CLE_CURSEUR)).toEqual({ depuis: "2026-09-28T09:00:00.000Z" });
    spy.mockRestore();
  });
});

describe("🔴 ce qu'une réponse change aux rappels", () => {
  it("une réponse HUMAINE arrête les rappels : le passage quotidien n'envoie rien", async () => {
    await passerReponsesEntrantes({ client: clientDouble([message()]), maintenant: MAINTENANT });
    const r = await passerRelancesInvitation(passage(4));
    expect(db.enqueue).not.toHaveBeenCalled();
    expect(r.ecartees["repondu"]).toBe(1);
  });

  it("une réponse HUMAINE retient aussi le rappel AU DÉPART (filet du worker d'e-mails)", async () => {
    expect(await motifRetenueRelanceInvitation("ligne-a")).toBeNull();
    await passerReponsesEntrantes({ client: clientDouble([message()]), maintenant: MAINTENANT });
    expect(await motifRetenueRelanceInvitation("ligne-a")).toMatch(/réponse a été échangée/);
  });

  it("une réponse AUTOMATIQUE est gardée, marquée, et n'arrête PAS les rappels", async () => {
    const m = message({ subject: "Re: Ton échange de 15 minutes" });
    await passerReponsesEntrantes({
      client: clientDouble([m], { [m.messageId]: AUTOMATIQUE }),
      maintenant: MAINTENANT,
    });
    expect(db.entrantes).toHaveLength(1);
    expect(db.entrantes[0]!["auto"]).toBe(true);
    expect(db.notify).not.toHaveBeenCalled();

    expect(await motifRetenueRelanceInvitation("ligne-a")).toBeNull();
    const r = await passerRelancesInvitation(passage(4));
    expect(r.envoyees.j3).toBe(1);
  });

  it("🔴 une réponse HUMAINE remet « à traiter » la fiche rangée à l'invitation", async () => {
    db.submissions = [ligne({ status: "processed" })];
    await passerReponsesEntrantes({ client: clientDouble([message()]), maintenant: MAINTENANT });
    expect(db.submissions[0]).toMatchObject({ status: "in_progress", needsAttention: true });
  });

  it("une réponse AUTOMATIQUE laisse la fiche rangée", async () => {
    db.submissions = [ligne({ status: "processed" })];
    const m = message({ subject: "Re: Ton échange de 15 minutes" });
    await passerReponsesEntrantes({
      client: clientDouble([m], { [m.messageId]: AUTOMATIQUE }),
      maintenant: MAINTENANT,
    });
    expect(db.submissions[0]!["status"]).toBe("processed");
  });

  it("un objet « Réponse automatique » suffit quand les en-têtes ne se lisent pas", async () => {
    const m = message({ subject: "Réponse automatique : Ton échange de 15 minutes" });
    const client = clientDouble([m]);
    client.lireEntetes.mockRejectedValueOnce(new Error("503"));
    await passerReponsesEntrantes({ client, maintenant: MAINTENANT });
    expect(db.entrantes[0]!["auto"]).toBe(true);
  });

  it("une réponse arrivée AVANT une nouvelle invitation n'arrête pas les rappels de celle-ci", async () => {
    await passerReponsesEntrantes({ client: clientDouble([message()]), maintenant: MAINTENANT });
    // « Renvoyer quand même » deux jours plus tard : nouvelle invitation, nouveau compte.
    db.emailLogs.push(invitation({ id: "inv-2", createdAt: passage(2), sentAt: passage(2) }));
    expect(await motifRetenueRelanceInvitation("ligne-a")).toBeNull();
  });
});

describe("🔴 R6 — une réponse arrête aussi les relances du premier contact (A1, A2, A3)", () => {
  const MOTIF = "Envoi annulé : la personne a répondu par e-mail.";

  /** Un lead du tunnel vidéo : aucune invitation, seulement A1 parti. */
  function leadVideoAvecA1(): void {
    db.submissions = [
      ligne({
        details: {
          unifiedType: "recrutement",
          subType: "candidature-commerciale",
          vsl: { etapeAtteinte: 1 },
        },
      }),
    ];
    db.emailLogs = [
      {
        id: "a1",
        template: "lead-apporteur-recu",
        entityType: "Submission",
        entityId: "ligne-a",
        status: "sent",
        createdAt: new Date("2026-09-27T20:00:00Z"),
        sentAt: new Date("2026-09-27T20:00:00Z"),
      },
    ];
  }

  it("une réponse HUMAINE d'une personne invitée retire ses relances de premier contact", async () => {
    await passerReponsesEntrantes({
      client: clientDouble([message()]),
      maintenant: MAINTENANT,
      arreterRelances: db.annuler,
    });
    expect(db.annuler).toHaveBeenCalledTimes(1);
    expect(db.annuler).toHaveBeenCalledWith("camille@exemple.fr", MOTIF);
  });

  it("une réponse AUTOMATIQUE d'une personne invitée ne retire rien", async () => {
    const m = message();
    await passerReponsesEntrantes({
      client: clientDouble([m], { [m.messageId]: AUTOMATIQUE }),
      maintenant: MAINTENANT,
      arreterRelances: db.annuler,
    });
    expect(db.annuler).not.toHaveBeenCalled();
  });

  it("🔴 un lead vidéo JAMAIS invité qui répond à A1 : ses relances A2/A3 sont retirées", async () => {
    leadVideoAvecA1();
    const r = await passerReponsesEntrantes({
      client: clientDouble([message()]),
      maintenant: MAINTENANT,
      arreterRelances: db.annuler,
    });
    expect(db.annuler).toHaveBeenCalledWith("camille@exemple.fr", MOTIF);
    // Le relevé des réponses reste celui des invitations : rien d'enregistré, Will
    // n'est pas notifié pour autant.
    expect(r.reconnus).toBe(0);
    expect(db.entrantes).toHaveLength(0);
    expect(db.notify).not.toHaveBeenCalled();
  });

  it("un lead vidéo : un « je suis absent » ne retire rien", async () => {
    leadVideoAvecA1();
    const m = message();
    await passerReponsesEntrantes({
      client: clientDouble([m], { [m.messageId]: AUTOMATIQUE }),
      maintenant: MAINTENANT,
      arreterRelances: db.annuler,
    });
    expect(db.annuler).not.toHaveBeenCalled();
  });

  it("un message ANTÉRIEUR à tout message de premier contact ne retire rien", async () => {
    leadVideoAvecA1();
    const m = message({ receivedAt: new Date("2026-09-27T19:00:00Z") });
    await passerReponsesEntrantes({
      client: clientDouble([m]),
      maintenant: MAINTENANT,
      arreterRelances: db.annuler,
    });
    expect(db.annuler).not.toHaveBeenCalled();
  });

  it("sans fonction d'arrêt injectée, le relevé passe sans rien retirer", async () => {
    leadVideoAvecA1();
    const r = await passerReponsesEntrantes({
      client: clientDouble([message()]),
      maintenant: MAINTENANT,
    });
    expect(r.erreurs).toBe(0);
    expect(db.annuler).not.toHaveBeenCalled();
  });

  it("un expéditeur inconnu ne retire rien, et ses en-têtes ne sont pas lus", async () => {
    leadVideoAvecA1();
    const client = clientDouble([message({ fromAddress: "quelquun@ailleurs.fr" })]);
    await passerReponsesEntrantes({ client, maintenant: MAINTENANT, arreterRelances: db.annuler });
    expect(db.annuler).not.toHaveBeenCalled();
    expect(client.lireEntetes).not.toHaveBeenCalled();
  });
});

describe("la liste des apporteurs", () => {
  it("🔴 affiche « A répondu » après une réponse humaine, pas après une réponse automatique", async () => {
    let suivi = (await lireSuiviInvitationListe(["ligne-a"])).get("ligne-a");
    expect(badgeSuiviInvitation(suivi)).toEqual({ type: "invite", le: INVITATION });

    const auto = message({ messageId: "auto-1" });
    await passerReponsesEntrantes({
      client: clientDouble([auto], { "auto-1": AUTOMATIQUE }),
      maintenant: MAINTENANT,
    });
    suivi = (await lireSuiviInvitationListe(["ligne-a"])).get("ligne-a");
    expect(badgeSuiviInvitation(suivi)?.type).toBe("invite");

    const humaine = message({ messageId: "humain-1" });
    await passerReponsesEntrantes({
      client: clientDouble([humaine]),
      maintenant: new Date(MAINTENANT.getTime() + 15 * 60_000),
    });
    suivi = (await lireSuiviInvitationListe(["ligne-a"])).get("ligne-a");
    expect(badgeSuiviInvitation(suivi)).toEqual({ type: "a-repondu", le: humaine.receivedAt });
  });

  it("la liste s'affiche sans le badge si la table n'est pas encore migrée", async () => {
    db.tableAbsente = true;
    const suivi = (await lireSuiviInvitationListe(["ligne-a"])).get("ligne-a");
    expect(badgeSuiviInvitation(suivi)).toEqual({ type: "invite", le: INVITATION });
  });
});

describe("l'inertie", () => {
  it("🔴 sans variables Zoho : aucune lecture, dit UNE fois", async () => {
    for (const k of ["ZOHO_MAIL_CLIENT_ID", "ZOHO_MAIL_CLIENT_SECRET", "ZOHO_MAIL_REFRESH_TOKEN"]) {
      delete process.env[k];
    }
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const r1 = await passerReponsesEntrantes({ maintenant: MAINTENANT });
    const r2 = await passerReponsesEntrantes({ maintenant: MAINTENANT });
    expect(r1.suspendu).toBe("config-absente");
    expect(r2.suspendu).toBe("config-absente");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(db.settings.size).toBe(0);
    const dits = vi
      .mocked(console.warn)
      .mock.calls.filter((c) => String(c[0]).includes("ZOHO_MAIL_CLIENT_ID"));
    expect(dits).toHaveLength(1);
  });

  it("🔴 au build (`stub.invalid`) : rien, pas même la boîte Zoho", async () => {
    const avant = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      const client = clientDouble([message()]);
      const r = await passerReponsesEntrantes({ client, maintenant: MAINTENANT });
      expect(r.suspendu).toBe("build");
      expect(client.listerMessagesRecus).not.toHaveBeenCalled();
      expect(db.entrantes).toHaveLength(0);
    } finally {
      if (avant === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = avant;
    }
  });

  it("table pas encore migrée (fenêtre app/worker) : le relevé s'abstient, le curseur ne bouge pas", async () => {
    db.tableAbsente = true;
    const r = await passerReponsesEntrantes({
      client: clientDouble([message()]),
      maintenant: MAINTENANT,
    });
    expect(r.suspendu).toBe("table-absente");
    expect(db.settings.has(CLE_CURSEUR)).toBe(false);
    // …et les rappels, eux, continuent : la table absente est tenue pour vide.
    expect(await motifRetenueRelanceInvitation("ligne-a")).toBeNull();
  });

  it("Zoho injoignable : rien, curseur intact, sans lever", async () => {
    const client = clientDouble([]);
    client.listerMessagesRecus.mockRejectedValueOnce(new Error("jeton refusé"));
    const r = await passerReponsesEntrantes({ client, maintenant: MAINTENANT });
    expect(r.suspendu).toBe("zoho-injoignable");
    expect(db.settings.has(CLE_CURSEUR)).toBe(false);
  });

  it("une notification en panne n'empêche pas l'enregistrement", async () => {
    db.notify = vi.fn(async () => {
      throw new Error("Telegram muet");
    });
    const r = await passerReponsesEntrantes({
      client: clientDouble([message()]),
      maintenant: MAINTENANT,
    });
    expect(r.enregistrees.humaines).toBe(1);
    expect(db.entrantes).toHaveLength(1);
  });
});

// Garde contre une régression de calendrier : la fenêtre de rattrapage est
// celle des rappels — au-delà, il n'y a plus de rappel à arrêter.
describe("les bornes", () => {
  it("le rattrapage initial vaut la fenêtre des rappels (14 jours)", () => {
    expect(RATTRAPAGE_INITIAL_MS).toBe(14 * JOUR);
  });
});
