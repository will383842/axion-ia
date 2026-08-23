/**
 * T-17 — Tool capturer_lead (idempotent → Submission, source=chatbot).
 *
 * Couvre : consentement RGPD requis · Submission créée avec source=chatbot ·
 * retry idempotent (pas de doublon) · conversationId requis · atomicité
 * transactionnelle + course concurrente (conflit P2002 → 0 doublon).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Prisma } from "../../../../prisma/generated/client";

const findUnique = vi.fn();
const submissionCreate = vi.fn();
const idemCreate = vi.fn();
const convUpdate = vi.fn();

// Transaction interactive : exécute le callback avec un client `tx` exposant les
// mêmes mocks (submission.create + chatActionIdempotency.create + conv.update).
const transaction = vi.fn(
  (fn: (tx: unknown) => unknown) =>
    fn({
      submission: { create: (...a: unknown[]) => submissionCreate(...a) },
      chatActionIdempotency: { create: (...a: unknown[]) => idemCreate(...a) },
      chatConversation: { update: (...a: unknown[]) => convUpdate(...a) },
    }) as unknown,
);

const enqueueEmailMock = vi.fn((..._a: unknown[]) => Promise.resolve({ enqueued: true }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    chatActionIdempotency: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      create: (...a: unknown[]) => idemCreate(...a),
    },
    submission: { create: (...a: unknown[]) => submissionCreate(...a) },
    $transaction: (...a: unknown[]) => transaction(...(a as [(tx: unknown) => unknown])),
  },
}));

vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => enqueueEmailMock(...a),
}));

const sendTelegramMock = vi.fn((..._a: unknown[]) => Promise.resolve({ ok: true }));
vi.mock("@/lib/telegram", () => ({
  sendTelegram: (...a: unknown[]) => sendTelegramMock(...a),
}));

// E33-002 — on intercepte les deux sorties de PREUVE du consentement :
// l'événement CRM (section `consent`) et le registre indexé par personne.
// Sans ces deux mocks, le tool appelait les vraies fonctions, qui ne font rien
// hors configuration : le défaut restait indétectable depuis un test.
const syncFormSubmissionToCrmMock = vi.fn((..._a: unknown[]) => Promise.resolve());
vi.mock("@/server/crm-sync", () => ({
  syncFormSubmissionToCrm: (...a: unknown[]) => syncFormSubmissionToCrmMock(...a),
}));

const recordConsentEventMock = vi.fn((..._a: unknown[]) => Promise.resolve(true));
vi.mock("@/lib/consents", async (importOriginal) => {
  // `CONSENT_FORM_REFS` reste le VRAI : une garde qui compare la référence
  // écrite à une constante qu'elle a elle-même inventée ne prouve rien.
  const reel = await importOriginal<typeof import("@/lib/consents")>();
  return {
    ...reel,
    recordConsentEvent: (...a: unknown[]) => recordConsentEventMock(...a),
  };
});

import {
  capturerLead,
  CapturerLeadInputSchema,
  CHATBOT_CONSENT_VERSION,
} from "@/server/chatbot/tools/capturer-lead";
import { CONSENT_FORM_REFS } from "@/lib/consents";
import { decryptPii, isEncryptedPii } from "@/lib/pii-crypto";

const ctx = { tenantId: "t1", conversationId: "conv-1" };
const validInput = {
  nom: "Jean Dupont",
  email: "jean@acme.fr",
  besoin_resume: "Audit IA pour ma PME",
  consentement_rgpd: true as const,
};

beforeEach(() => {
  findUnique.mockReset();
  submissionCreate.mockReset();
  idemCreate.mockReset();
  convUpdate.mockReset();
  transaction.mockClear();
  enqueueEmailMock.mockClear();
  sendTelegramMock.mockClear();
  syncFormSubmissionToCrmMock.mockClear();
  recordConsentEventMock.mockClear();
});

describe("T-17 capturer_lead", () => {
  it("refuse sans consentement RGPD (Zod literal true)", () => {
    expect(() =>
      CapturerLeadInputSchema.parse({ ...validInput, consentement_rgpd: false }),
    ).toThrow();
  });

  it("crée un Submission avec source=chatbot (dans une transaction)", async () => {
    findUnique.mockResolvedValue(null);
    submissionCreate.mockResolvedValue({ id: "sub-1" });
    idemCreate.mockResolvedValue({});
    const r = await capturerLead(validInput, ctx);
    expect(r).toEqual({ submissionId: "sub-1", idempotent: false });
    expect(transaction).toHaveBeenCalledOnce();
    const data = submissionCreate.mock.calls[0]![0].data;
    expect(data.source).toBe("chatbot");
    expect(data.contactEmail).toBe("jean@acme.fr");
    expect(data.type).toBe("contact");
    // La clé d'idempotence est créée (pas upsert) dans la même transaction.
    expect(idemCreate).toHaveBeenCalledOnce();
    expect(idemCreate.mock.calls[0]![0].data.resultat).toEqual({ submissionId: "sub-1" });
    // Backlink conversation → lead (RGPD : rattachement export/erase).
    expect(convUpdate).toHaveBeenCalledOnce();
    expect(convUpdate.mock.calls[0]![0]).toEqual({
      where: { id: "conv-1" },
      data: { submissionId: "sub-1" },
    });
  });

  it("retry idempotent → renvoie le lead mémorisé, AUCUNE transaction", async () => {
    findUnique.mockResolvedValue({ cle: "k", resultat: { submissionId: "sub-1" } });
    const r = await capturerLead(validInput, ctx);
    expect(r).toEqual({ submissionId: "sub-1", idempotent: true });
    expect(transaction).not.toHaveBeenCalled();
    expect(submissionCreate).not.toHaveBeenCalled();
  });

  it("course concurrente (P2002 sur la clé) → 0 doublon, renvoie le gagnant", async () => {
    // 1er findUnique (pré-check) = rien → on entre en transaction.
    // La création de la clé conflicte (un appel concurrent a gagné) → P2002.
    // 2e findUnique (relecture post-conflit) = résultat du gagnant.
    findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ cle: "k", resultat: { submissionId: "sub-winner" } });
    submissionCreate.mockResolvedValue({ id: "sub-loser" });
    idemCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint", {
        code: "P2002",
        clientVersion: "x",
      }),
    );
    const r = await capturerLead(validInput, ctx);
    expect(r).toEqual({ submissionId: "sub-winner", idempotent: true });
  });

  it("exige un conversationId (idempotence impossible sinon)", async () => {
    await expect(capturerLead(validInput, { tenantId: "t1" })).rejects.toThrow(/conversationId/);
  });

  it("propage l'ipHash si fourni", async () => {
    findUnique.mockResolvedValue(null);
    submissionCreate.mockResolvedValue({ id: "sub-2" });
    idemCreate.mockResolvedValue({});
    await capturerLead(validInput, { ...ctx, ipHash: "abcdef" });
    expect(submissionCreate.mock.calls[0]![0].data.ipHash).toBe("abcdef");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Confirmation au visiteur (2026-08-13)
// ─────────────────────────────────────────────────────────────────────────────
//
// Ce que ces tests protègent : le visiteur laissait son adresse dans une
// fenêtre de discussion qu'il allait fermer, et ne recevait RIEN. Aucune
// trace de son geste, ni preuve, ni moyen de relancer.

describe("capturer_lead — confirmation au visiteur", () => {
  it("envoie une confirmation sur un NOUVEAU lead", async () => {
    findUnique.mockResolvedValue(null);
    submissionCreate.mockResolvedValue({ id: "sub-neuf" });
    idemCreate.mockResolvedValue({});

    await capturerLead(validInput, ctx);

    expect(enqueueEmailMock).toHaveBeenCalledTimes(1);
    const [gabarit, destinataire] = enqueueEmailMock.mock.calls[0]!;
    expect(gabarit).toBe("chatbot-demande-transmise");
    expect(destinataire).toBe("jean@acme.fr");
  }, 20_000);

  it("N'ENVOIE RIEN sur un rejeu idempotent", async () => {
    // Le chatbot rejoue ses actions. Sans la garde `!result.idempotent`, la
    // même personne recevrait un e-mail à chaque rejeu — exactement le genre
    // de nuisance qui fait marquer un expéditeur comme indésirable.
    findUnique.mockResolvedValue({ resultat: { submissionId: "sub-existant" } });

    await capturerLead(validInput, ctx);

    expect(enqueueEmailMock).not.toHaveBeenCalled();
  }, 20_000);
});

// ─────────────────────────────────────────────────────────────────────────────
// PII chiffré au repos (2026-08-18, préalables CRM ligne 13)
// ─────────────────────────────────────────────────────────────────────────────
//
// Ce que ces tests protègent : `capturer_lead` était le SEUL point de capture
// du site à écrire nom / e-mail / téléphone EN CLAIR dans `submissions`. Le
// formulaire unifié chiffre depuis 2026-07-01 (`unified-contact/actions.ts`),
// et les colonnes sont en `@db.Text` précisément pour recevoir du `enc:v1:`.
// Le chatbot est éteint (`CHATBOT_ENABLED`) : c'est un défaut DORMANT, qui
// attend un rallumage — donc invisible tant qu'on ne le regarde pas.
//
// Contrepartie testée aussi : la notification interne et l'e-mail de
// confirmation doivent continuer de porter la valeur EN CLAIR. Un Telegram qui
// annonce « Email : enc:v1:… » et un envoi vers cette même chaîne, c'est un
// lead perdu — le remède serait pire que le mal.

const CLE_TEST = "a".repeat(64);

describe("capturer_lead — PII chiffré au repos (AES-256-GCM)", () => {
  beforeEach(() => {
    process.env.PII_ENCRYPTION_KEY = CLE_TEST;
    findUnique.mockResolvedValue(null);
    submissionCreate.mockResolvedValue({ id: "sub-pii" });
    idemCreate.mockResolvedValue({});
  });
  afterEach(() => {
    delete process.env.PII_ENCRYPTION_KEY;
  });

  it("chiffre nom / e-mail / téléphone avant l'écriture en base", async () => {
    await capturerLead({ ...validInput, telephone: "+33611223344" }, ctx);

    const data = submissionCreate.mock.calls[0]![0].data as Record<string, string>;
    expect(isEncryptedPii(data.contactName)).toBe(true);
    expect(isEncryptedPii(data.contactEmail)).toBe(true);
    expect(isEncryptedPii(data.contactPhone)).toBe(true);
    // Rien d'exploitable en clair ne doit subsister dans la ligne écrite.
    expect(JSON.stringify(data)).not.toContain("jean@acme.fr");
    expect(JSON.stringify(data)).not.toContain("Jean Dupont");
    expect(JSON.stringify(data)).not.toContain("+33611223344");
    // …et le chiffrement doit être réversible, sinon on a perdu le lead.
    expect(decryptPii(data.contactName)).toBe("Jean Dupont");
    expect(decryptPii(data.contactEmail)).toBe("jean@acme.fr");
    expect(decryptPii(data.contactPhone)).toBe("+33611223344");
  }, 20_000);

  it("garde le hash de recherche calculé sur l'adresse EN CLAIR", async () => {
    // `contactEmailHash` est l'index RGPD (art. 15 / 17). Le calculer sur le
    // ciphertext le rendrait inutilisable : l'IV est aléatoire, donc deux
    // captures de la même adresse donneraient deux hash différents et la
    // personne redeviendrait introuvable.
    const { hashEmailForLookup } = await import("@/lib/security/email-hash");
    await capturerLead(validInput, ctx);
    const data = submissionCreate.mock.calls[0]![0].data as Record<string, string>;
    expect(data.contactEmailHash).toBe(hashEmailForLookup("jean@acme.fr"));
  }, 20_000);

  it("notifie l'équipe et écrit au visiteur avec la valeur EN CLAIR", async () => {
    await capturerLead({ ...validInput, telephone: "+33611223344" }, ctx);

    const corps = (sendTelegramMock.mock.calls[0]![0] as { body: string }).body;
    expect(corps).toContain("jean@acme.fr");
    expect(corps).toContain("Jean Dupont");
    expect(corps).not.toContain("enc:v1:");

    expect(enqueueEmailMock.mock.calls[0]![1]).toBe("jean@acme.fr");
  }, 20_000);

  it("sans clé, la ligne reste en clair (repli dev) — aucun `enc:v1:` bâtard", async () => {
    delete process.env.PII_ENCRYPTION_KEY;
    await capturerLead(validInput, ctx);
    const data = submissionCreate.mock.calls[0]![0].data as Record<string, string>;
    expect(data.contactEmail).toBe("jean@acme.fr");
  }, 20_000);
});

// ─────────────────────────────────────────────────────────────────────────────
// E33-002 — le consentement exigé doit AUSSI être transmis et enregistré
// ─────────────────────────────────────────────────────────────────────────────
//
// Le défaut, mesuré le 2026-08-22 : `capturer_lead` REFUSE la capture sans
// consentement explicite (`consentement_rgpd: z.literal(true)`, l. 51) — c'est
// le point de capture le plus strict du site — et c'était le seul dont la
// preuve ne sortait jamais. L'appel `syncFormSubmissionToCrm` ne portait
// aucune clé `consent`, alors que `crm-sync/index.ts` en déclare une et que
// `unified-contact/actions.ts` la remplit ; et `recordConsentEvent` n'était
// appelé nulle part dans ce fichier. Résultat : un lead arrivait dans une base
// de prospection sans qu'on puisse dire à quel texte, ni quand, la personne
// avait dit oui.
//
// ⚠️ CE QUE CES GARDES NE COUVRENT PAS : elles vérifient ce que le tool ÉMET,
// pas ce que le CRM en fait, ni que le libellé `chatbot.leadConsent` affiché à
// la personne correspond bien à la version déclarée. Ce dernier lien est humain
// et reste à la charge de qui modifie le texte.

describe("capturer_lead — preuve du consentement (E33-002)", () => {
  beforeEach(() => {
    findUnique.mockResolvedValue(null);
    submissionCreate.mockResolvedValue({
      id: "sub-consent",
      submittedAt: new Date("2026-08-22T10:11:12.000Z"),
    });
    idemCreate.mockResolvedValue({});
  });

  it("transmet la section `consent` au CRM (version + horodatage + texte)", async () => {
    await capturerLead(validInput, ctx);

    expect(syncFormSubmissionToCrmMock).toHaveBeenCalledOnce();
    const envoi = syncFormSubmissionToCrmMock.mock.calls[0]![0] as {
      consent?: { version?: string; at?: Date; textRef?: string };
    };
    expect(
      envoi.consent,
      "E33-002 : l'événement CRM du chatbot repart sans section `consent`. " +
        "Geste : dans capturer-lead.ts, ajouter `consent: { version: " +
        "CHATBOT_CONSENT_VERSION, at: submission.submittedAt, textRef: " +
        "CONSENT_FORM_REFS.chatbot }` à l'appel `syncFormSubmissionToCrm`.",
    ).toBeDefined();
    expect(envoi.consent!.version).toBe(CHATBOT_CONSENT_VERSION);
    expect(envoi.consent!.textRef).toBe(CONSENT_FORM_REFS.chatbot);
    // L'horodatage est celui que la BASE a retenu, pas un `new Date()`
    // d'application : c'est lui qui fera foi si l'accord est contesté.
    expect(envoi.consent!.at).toEqual(new Date("2026-08-22T10:11:12.000Z"));
  }, 20_000);

  it("inscrit l'opt-in au registre indexé par personne", async () => {
    await capturerLead(validInput, ctx);

    expect(
      recordConsentEventMock.mock.calls.length,
      "E33-002 : aucun `recordConsentEvent` sur le chemin chatbot. Sans lui, " +
        "« prouvez le consentement de cette personne » n'a pas de réponse — " +
        "l'événement CRM est indexé par lead, pas par personne. Geste : " +
        "appeler `recordConsentEvent({ email, formRef: CONSENT_FORM_REFS." +
        "chatbot, consentVersion: CHATBOT_CONSENT_VERSION, action: 'optin' })` " +
        "après le commit, sous la garde `!result.idempotent`.",
    ).toBe(1);

    const ligne = recordConsentEventMock.mock.calls[0]![0] as {
      email: string;
      formRef: string;
      consentVersion: string;
      action: string;
      occurredAt?: Date;
    };
    expect(ligne.email).toBe("jean@acme.fr");
    expect(ligne.formRef).toBe(CONSENT_FORM_REFS.chatbot);
    expect(ligne.consentVersion).toBe(CHATBOT_CONSENT_VERSION);
    expect(ligne.action).toBe("optin");
    expect(ligne.occurredAt).toEqual(new Date("2026-08-22T10:11:12.000Z"));
  }, 20_000);

  it("n'inscrit RIEN au registre sur un rejeu idempotent", async () => {
    // Le registre est APPEND-ONLY : un rejeu du chatbot y écrirait un second
    // opt-in pour un seul geste de la personne, et le décompte des accords
    // deviendrait faux dans le sens qui arrange — exactement ce qu'un registre
    // de preuve ne doit jamais faire.
    findUnique.mockResolvedValue({ resultat: { submissionId: "sub-existant" } });

    await capturerLead(validInput, ctx);

    expect(
      recordConsentEventMock.mock.calls.length,
      "E33-002 : un rejeu idempotent a écrit une ligne de consentement de plus. " +
        "Geste : garder l'appel `recordConsentEvent` sous `if (!result.idempotent)`.",
    ).toBe(0);
  }, 20_000);

  it("ne passe pas un condensat d'IP là où une IP en clair est attendue", async () => {
    // `recordConsentEvent` hache lui-même ce qu'on lui donne. Le chemin chatbot
    // ne dispose que de `ctx.ipHash`, DÉJÀ haché : le lui passer produirait un
    // hachage de hachage, incomparable au reste du registre. Un contexte absent
    // vaut mieux qu'un contexte faux.
    await capturerLead(validInput, { ...ctx, ipHash: "abcdef" });

    const ligne = recordConsentEventMock.mock.calls[0]![0] as { ip?: unknown };
    expect(
      ligne.ip ?? null,
      "E33-002 : `ip` transmis au registre alors que seul un condensat est " +
        "disponible ici. Geste : ne pas passer `ip` tant que le tool ne reçoit " +
        "pas l'adresse en clair.",
    ).toBeNull();
  }, 20_000);

  it("la version déclarée n'est ni vide ni recyclée d'un autre formulaire", () => {
    // Verrou anti-« vert sans mesure » : les deux tests ci-dessus comparent la
    // valeur écrite à `CHATBOT_CONSENT_VERSION`. Si cette constante devenait
    // vide, ou reprenait la version d'un AUTRE point de capture, ils
    // resteraient verts en certifiant une preuve fausse.
    expect(CHATBOT_CONSENT_VERSION).toMatch(/^chatbot-v\d+-\d{4}-\d{2}-\d{2}$/);
    expect(CONSENT_FORM_REFS.chatbot).toBe("chatbot-lead-form");
    expect(CONSENT_FORM_REFS.chatbot).not.toBe(CONSENT_FORM_REFS.unifiedContact);
  });
});
