// Tests reply-actions (Sprint Notif Infra 2026-05-26 / Chantier 5).
//
// On mocke `@/auth` (RBAC), `@/lib/prisma` (DB) et `@/server/queue/queues`
// (BullMQ) pour tester l'ensemble Server Actions sans dependances externes.

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks ---------------------------------------------------------------------

const authMock = vi.fn();
vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

const enqueueEmailMock = vi.fn();
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...args: unknown[]) => enqueueEmailMock(...args),
}));

const renderEmailTemplateMock = vi.fn().mockResolvedValue({
  subject: "Re: test",
  html: "<p>Hello</p>",
  text: "Hello",
});
vi.mock("@/lib/email/templates", () => ({
  renderEmailTemplate: (...args: unknown[]) => renderEmailTemplateMock(...args),
}));

const submissionFindUnique = vi.fn();
const submissionReplyCreate = vi.fn();
const submissionReplyFindUnique = vi.fn();
const submissionReplyUpdate = vi.fn();
const submissionUpdate = vi.fn();
const submissionUpdateMany = vi.fn();
const submissionFindMany = vi.fn();
const transactionMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: {
      findUnique: (...args: unknown[]) => submissionFindUnique(...args),
      update: (...args: unknown[]) => submissionUpdate(...args),
      updateMany: (...args: unknown[]) => submissionUpdateMany(...args),
      findMany: (...args: unknown[]) => submissionFindMany(...args),
    },
    submissionReply: {
      create: (...args: unknown[]) => submissionReplyCreate(...args),
      findUnique: (...args: unknown[]) => submissionReplyFindUnique(...args),
      update: (...args: unknown[]) => submissionReplyUpdate(...args),
    },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => transactionMock(fn),
  },
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));

const annulerRelancesMock = vi.fn();
vi.mock("@/features/commercial-application/relances-lead-apporteur", () => ({
  annulerRelancesLeadApporteur: (...args: unknown[]) => annulerRelancesMock(...args),
}));

// ---------------------------------------------------------------------------

const VALID_UUID = "11111111-1111-1111-1111-111111111111";
/** Les deux marqueurs du prédicat unique `estApporteur`. */
const APPORTEUR = { unifiedType: "recrutement", subType: "candidature-commerciale" };
const REPLY_ID = "ckxxxxxx";

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({
    user: { id: "admin-1", role: "admin", name: "Will" },
  });
  // enqueueEmail renvoie désormais { enqueued: boolean } (retour détectable).
  enqueueEmailMock.mockResolvedValue({ enqueued: true });
  // Les quatre gestes d'état passent par `transitions.ts` depuis le 21/09 :
  // ils LISENT la fiche, puis écrivent dans une transaction. Le double défaut
  // qu'ils réparent (relances non annulées à l'archivage) a ses propres tests
  // dans `archiver-arrete-les-relances.spec.ts` ; ici on garde le contrat
  // d'action — RBAC, Zod, et ce qui part en base.
  submissionFindMany.mockResolvedValue([]);
  transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      submission: {
        findUnique: (...a: unknown[]) => submissionFindUnique(...a),
        update: (...a: unknown[]) => submissionUpdate(...a),
      },
      activityLog: { create: vi.fn() },
      submissionReply: { create: () => ({ id: REPLY_ID }) },
    }),
  );
});

describe("replyToSubmissionAction", () => {
  it("happy path — crée reply + enqueue + retourne replyId", async () => {
    submissionFindUnique.mockResolvedValueOnce({
      id: VALID_UUID,
      contactEmail: "user@example.com",
      locale: "fr",
      status: "new",
      firstRepliedAt: null,
    });
    transactionMock.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      // Provide a tx with the same shape as prisma
      return fn({
        submissionReply: { create: () => ({ id: REPLY_ID }) },
        submission: { update: () => ({}) },
      });
    });
    const { replyToSubmissionAction } = await import("../reply-actions");
    const result = await replyToSubmissionAction({
      submissionId: VALID_UUID,
      subject: "Re: votre demande",
      bodyMarkdown: "Bonjour,\n\nMerci pour votre message.",
    });
    expect(result).toEqual({ ok: true, replyId: REPLY_ID });
    expect(renderEmailTemplateMock).toHaveBeenCalledWith(
      "submission-reply",
      "fr",
      expect.objectContaining({ subject: "Re: votre demande" }),
    );
    // Sécurité : plus de PII (email en clair) dans le payload de queue — le
    // worker re-déchiffre l'adresse depuis la DB. L'arg `to` est donc vide.
    expect(enqueueEmailMock).toHaveBeenCalledWith(
      "submission-reply",
      "",
      "fr",
      expect.objectContaining({ replyId: REPLY_ID }),
    );
  });

  it("RBAC : non-admin → unauthorized", async () => {
    authMock.mockResolvedValueOnce(null);
    const { replyToSubmissionAction } = await import("../reply-actions");
    const result = await replyToSubmissionAction({
      submissionId: VALID_UUID,
      subject: "S",
      bodyMarkdown: "B",
    });
    expect(result).toEqual({ ok: false, error: "unauthorized" });
  });

  it("submission inexistante → submission_not_found", async () => {
    submissionFindUnique.mockResolvedValueOnce(null);
    const { replyToSubmissionAction } = await import("../reply-actions");
    const result = await replyToSubmissionAction({
      submissionId: VALID_UUID,
      subject: "Re: subject valide",
      bodyMarkdown: "Body content",
    });
    expect(result).toEqual({ ok: false, error: "submission_not_found" });
  });

  it("Zod validation : subject vide → erreur", async () => {
    const { replyToSubmissionAction } = await import("../reply-actions");
    const result = await replyToSubmissionAction({
      submissionId: VALID_UUID,
      subject: "",
      bodyMarkdown: "B",
    });
    expect(result.ok).toBe(false);
  });
});

describe("🔴 répondre depuis la console ARRÊTE les relances en attente", () => {
  // Demande de Will, mot pour mot : « je voudrais pouvoir répondre manuellement
  // sans passer par le circuit normal, pour éviter d'avoir des messages en
  // doublons ».
  //
  // Le doublon est REEL, et il est ici : les rappels « ton dossier t'attend »
  // sont des jobs RETARDES, posés à J+2 et J+7, qui dorment dans Redis. Deux
  // choses seulement les arrêtaient — la personne termine son dossier, ou elle
  // s'oppose. **Rien ne les arrêtait parce qu'on lui avait répondu.**
  //
  // 🔑 Ce test regarde le RETRAIT, pas un drapeau. Une implémentation qui
  // poserait `relancesArretees: true` sans toucher à la file passerait toute
  // garde écrite sur l'état de la fiche — et la personne recevrait quand même
  // ses deux relances.
  /** 🔑 Une fiche APPORTEUR : c'est la seule population dont les relances se retirent. */
  async function repondre(details: unknown = APPORTEUR) {
    submissionFindUnique.mockResolvedValueOnce({
      id: VALID_UUID,
      contactEmail: "lea@exemple.invalid",
      locale: "fr",
      status: "new",
      firstRepliedAt: null,
      details,
    });
    const { replyToSubmissionAction } = await import("../reply-actions");
    return replyToSubmissionAction({
      submissionId: VALID_UUID,
      subject: "Re: ta candidature",
      bodyMarkdown: "Bonjour, on se parle quand tu veux.",
    });
  }

  it("retire les relances de la file, avec un motif lisible au journal", async () => {
    const r = await repondre();

    expect(r.ok).toBe(true);
    expect(annulerRelancesMock).toHaveBeenCalledTimes(1);
    expect(String(annulerRelancesMock.mock.calls[0]?.[1] ?? "")).toContain("réponse");
  });

  it("🔴 une fiche qui N'EST PAS un dossier apporteur : on ne touche à RIEN", async () => {
    // Le défaut que ce test attrape, et il était DOUBLE.
    //
    // `annulerRelancesLeadApporteur` retrouve les jobs par l'EMPREINTE DE
    // L'ADRESSE, jamais par la fiche. Et `ReplyComposer` est monté sur TOUTE
    // fiche de la console. Sans garde : Léa dépose une candidature d'apporteur
    // (relances J+2 et J+7 posées), envoie aussi un message /contact sans
    // rapport, Will répond à CE message — et ses deux relances disparaissent en
    // silence, avec au journal un motif qui parle d'une réponse faite ailleurs.
    //
    // ⚠️ Le précédent test de ce bloc montait une fiche SANS `details` : il
    // ENTÉRINAIT l'absence de garde au lieu de l'attraper.
    const r = await repondre({ unifiedType: "contact" });

    expect(r.ok).toBe(true);
    expect(annulerRelancesMock).not.toHaveBeenCalled();
  });

  it("🔴 si la réponse N'EST PAS PARTIE, les relances RESTENT", async () => {
    // File indisponible. Retirer les relances ici ferait sortir la personne du
    // tunnel EN SILENCE : ni la réponse, ni les rappels — et le journal des
    // envois affirmerait un envoi qui n'a pas eu lieu.
    enqueueEmailMock.mockResolvedValueOnce({ enqueued: false });
    // La reply est alors marquée `failed` : le double du chemin d'échec.
    submissionReplyUpdate.mockResolvedValueOnce({});

    const r = await repondre();

    expect(r.ok).toBe(false);
    expect(annulerRelancesMock).not.toHaveBeenCalled();
  });

  it("un retrait qui ÉCHOUE ne transforme pas une réponse PARTIE en échec", async () => {
    // La file peut être indisponible. Le message, lui, est parti : dire le
    // contraire ferait recommencer Will, et la personne recevrait deux fois la
    // même réponse — exactement le doublon qu'on cherche à éviter.
    annulerRelancesMock.mockRejectedValueOnce(new Error("redis down"));

    const r = await repondre();

    expect(r.ok).toBe(true);
  });
});

describe("archiveSubmissionAction", () => {
  it("archive un id valide → status=archived + archivedAt set", async () => {
    // Adresse absente : aucun retrait de relance à tenter, le compte vaut 0.
    submissionFindUnique.mockResolvedValue({ id: VALID_UUID, contactEmail: null, deletedAt: null });
    submissionUpdate.mockResolvedValue({});
    const { archiveSubmissionAction } = await import("../reply-actions");
    const result = await archiveSubmissionAction(VALID_UUID);
    expect(result).toEqual({ ok: true, relancesRetirees: 0 });
    expect(submissionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: VALID_UUID },
        data: expect.objectContaining({ status: "archived" }),
      }),
    );
  });

  it("RBAC : non-admin → ok=false", async () => {
    authMock.mockResolvedValueOnce(null);
    const { archiveSubmissionAction } = await import("../reply-actions");
    const result = await archiveSubmissionAction(VALID_UUID);
    expect(result.ok).toBe(false);
    expect(submissionUpdate).not.toHaveBeenCalled();
  });
});

describe("bulkArchiveSubmissionsAction", () => {
  it("archive 3 items → archived=3", async () => {
    submissionUpdateMany.mockResolvedValueOnce({ count: 3 });
    const { bulkArchiveSubmissionsAction } = await import("../reply-actions");
    const ids = [
      "11111111-1111-1111-1111-111111111111",
      "22222222-2222-2222-2222-222222222222",
      "33333333-3333-3333-3333-333333333333",
    ];
    const result = await bulkArchiveSubmissionsAction(ids);
    expect(result).toEqual({ archived: 3 });
  });

  it("ids vide → archived=0 (Zod refuse)", async () => {
    const { bulkArchiveSubmissionsAction } = await import("../reply-actions");
    const result = await bulkArchiveSubmissionsAction([]);
    expect(result).toEqual({ archived: 0 });
    expect(submissionUpdateMany).not.toHaveBeenCalled();
  });
});

describe("markNeedsAttentionAction", () => {
  it("toggle needsAttention=true", async () => {
    submissionUpdate.mockResolvedValueOnce({});
    const { markNeedsAttentionAction } = await import("../reply-actions");
    const result = await markNeedsAttentionAction(VALID_UUID, true);
    expect(result).toEqual({ ok: true });
    expect(submissionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: VALID_UUID },
        data: { needsAttention: true },
      }),
    );
  });
});

describe("retryFailedReplyAction", () => {
  it("reply failed → reset pending + re-enqueue", async () => {
    submissionReplyFindUnique.mockResolvedValueOnce({
      id: REPLY_ID,
      toEmail: "u@e.com",
      subject: "S",
      submissionId: VALID_UUID,
      deliveryStatus: "failed",
      submission: { id: VALID_UUID, locale: "fr" },
    });
    submissionReplyUpdate.mockResolvedValueOnce({});
    const { retryFailedReplyAction } = await import("../reply-actions");
    const result = await retryFailedReplyAction(REPLY_ID);
    expect(result).toEqual({ ok: true });
    expect(enqueueEmailMock).toHaveBeenCalledOnce();
  });

  it("reply déjà sent → not_retryable", async () => {
    submissionReplyFindUnique.mockResolvedValueOnce({
      id: REPLY_ID,
      deliveryStatus: "sent",
      submission: { id: VALID_UUID, locale: "fr" },
    });
    const { retryFailedReplyAction } = await import("../reply-actions");
    const result = await retryFailedReplyAction(REPLY_ID);
    expect(result).toEqual({ ok: false, error: "not_retryable" });
    expect(submissionReplyUpdate).not.toHaveBeenCalled();
    expect(enqueueEmailMock).not.toHaveBeenCalled();
  });
});
