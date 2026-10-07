// L'issue de l'échange apporteur — les actions de la console (2026-09-28).
//
// Ce qui est gardé ici : le refus de rôle, l'aperçu qui n'écrit ni n'envoie,
// « rien ne part sans confirmation », UN envoi par issue et par personne,
// aucun e-mail pour Reporté / À revoir / deuxième absence, le classement
// « Sans suite » du Non retenu (qui arrête toute relance), le journal.

import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
vi.mock("@/auth", () => ({ auth: () => auth() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/adm/${p}` }));
vi.mock("@/lib/rgpd-erase", () => ({ ERASED_PLACEHOLDER: "[effacé]" }));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string | null) => v }));

const db = {
  evenement: null as Record<string, unknown> | null,
  fiche: null as Record<string, unknown> | null,
  absences: 0,
  journal: null as { createdAt: Date } | null,
  corbeille: null as { createdAt: Date } | null,
};
const upsert = vi.fn();
const activityCreate = vi.fn();
const suiviCount = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    calendlyEvent: { findUnique: vi.fn(async () => db.evenement) },
    submission: {
      findUnique: vi.fn(async () => db.fiche),
      findMany: vi.fn(async () => (db.fiche ? [{ id: db.fiche["id"] }, { id: "sub_autre" }] : [])),
    },
    rendezVousSuivi: {
      count: (...a: unknown[]) => {
        suiviCount(...a);
        return Promise.resolve(db.absences);
      },
      upsert: (...a: unknown[]) => upsert(...a),
    },
    emailLog: { findFirst: vi.fn(async () => db.journal) },
    emailOutbox: { findFirst: vi.fn(async () => db.corbeille) },
    activityLog: { create: (...a: unknown[]) => activityCreate(...a) },
  },
}));

// Le dossier en ligne s'ouvre normalement (07/10 : une panne n'envoie plus rien).
vi.mock("@/features/apporteurs-reseau/donnees", () => ({
  ouvrirDossierDepuisCandidature: vi.fn(async () => ({
    ok: true,
    apporteurId: "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b",
    versionLien: 1,
    email: "camille@exemple.fr",
    prenom: "Camille",
    statut: "dossier_en_cours",
  })),
}));
vi.mock("@/features/apporteurs-reseau/verification", () => ({ envoyerLien: vi.fn() }));
// Retrait du réseau (#1353) : personne n'est retiré, sauf dans le scénario dédié.
const { retraitDe } = vi.hoisted(() => ({ retraitDe: vi.fn(async () => null as Date | null) }));
vi.mock("@/features/apporteurs-reseau/retrait", () => ({
  retraitDe: (...a: unknown[]) => retraitDe(...(a as [])),
}));

const enqueueEmail = vi.fn();
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: (...a: unknown[]) => enqueueEmail(...a) }));
const appliquerTransition = vi.fn();
vi.mock("@/features/admin-submissions/transitions", () => ({
  appliquerTransition: (...a: unknown[]) => appliquerTransition(...a),
}));
const annulerRelancesLeadApporteur = vi.fn();
vi.mock("@/features/commercial-application/relances-lead-apporteur", () => ({
  annulerRelancesLeadApporteur: (...a: unknown[]) => annulerRelancesLeadApporteur(...a),
}));
vi.mock("@/features/commercial-application/relances-invitation-apporteur", () => ({
  lienReservation: () => "https://calendly.com/axion-ia/echange-apporteur",
}));
const renderEmailTemplate = vi.fn();
vi.mock("@/lib/email/templates", () => ({
  renderEmailTemplate: (...a: unknown[]) => renderEmailTemplate(...a),
}));

import {
  apercuIssueApporteurAction,
  enregistrerIssueApporteurAction,
} from "../issue-apporteur-actions";

const INITIAL = { etat: "initial" } as const;

function fd(champs: Record<string, string>): FormData {
  const f = new FormData();
  f.set("calendlyEventId", "evt_1");
  for (const [k, v] of Object.entries(champs)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ user: { id: "adm_1", email: "will@axion-ia.com", role: "admin" } });
  db.evenement = {
    id: "evt_1",
    eventTypeName: "Échange apporteur (15 min)",
    startTime: new Date("2026-09-22T08:00:00Z"),
    inviteeEmail: "camille@exemple.fr",
    linkedSubmissionId: "sub_1",
  };
  db.fiche = {
    id: "sub_1",
    locale: "fr",
    contactName: "Camille Martin",
    contactEmail: "camille@exemple.fr",
    contactEmailHash: "empreinte123",
    details: { unifiedType: "candidature", subType: "commercial" },
    deletedAt: null,
  };
  db.absences = 0;
  db.journal = null;
  db.corbeille = null;
  upsert.mockResolvedValue({});
  activityCreate.mockResolvedValue({});
  enqueueEmail.mockResolvedValue({ enqueued: true });
  appliquerTransition.mockResolvedValue({ ok: true, relancesRetirees: 1 });
  annulerRelancesLeadApporteur.mockResolvedValue(0);
  renderEmailTemplate.mockResolvedValue({
    subject: "Objet",
    html: "<p>html</p>",
    text: "t",
    famille: "B",
  });
});

describe("rôles", () => {
  it.each(["reader", "secretaire", "responsable_qualite", undefined])(
    "le rôle %s est refusé, et rien n'est lu, écrit ni envoyé",
    async (role) => {
      auth.mockResolvedValue({ user: { id: "u", role } });
      const r = await enregistrerIssueApporteurAction(
        INITIAL,
        fd({ issue: "retenu", confirmer: "oui" }),
      );
      expect(r.etat).toBe("erreur");
      const a = await apercuIssueApporteurAction({ calendlyEventId: "evt_1", issue: "retenu" });
      expect(a.etat).toBe("erreur");
      expect(upsert).not.toHaveBeenCalled();
      expect(enqueueEmail).not.toHaveBeenCalled();
      expect(renderEmailTemplate).not.toHaveBeenCalled();
    },
  );

  it("sans session : refusé", async () => {
    auth.mockResolvedValue(null);
    expect((await enregistrerIssueApporteurAction(INITIAL, fd({ issue: "reporte" }))).etat).toBe(
      "erreur",
    );
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe("l'aperçu", () => {
  it("rend le VRAI gabarit avec le prénom et le mot personnel — sans rien écrire ni envoyer", async () => {
    const a = await apercuIssueApporteurAction({
      calendlyEventId: "evt_1",
      issue: "retenu",
      motPersonnel: "Ravi de t'accueillir.",
    });
    expect(a).toMatchObject({
      etat: "apercu",
      email: { sujet: "Objet", destinataire: "camille@exemple.fr" },
    });
    expect(renderEmailTemplate).toHaveBeenCalledWith(
      "apporteur-issue-retenu",
      "fr",
      expect.objectContaining({
        contactName: "Camille Martin",
        motPersonnel: "Ravi de t'accueillir.",
        dossierUrl: expect.stringContaining("/apporteur/dossier/"),
      }),
      { destinataire: "camille@exemple.fr" },
    );
    expect(upsert).not.toHaveBeenCalled();
    expect(enqueueEmail).not.toHaveBeenCalled();
    expect(activityCreate).not.toHaveBeenCalled();
  });

  it("déjà envoyé : l'aperçu le dit, et ne propose aucun e-mail", async () => {
    db.journal = { createdAt: new Date("2026-09-25T10:00:00Z") };
    const a = await apercuIssueApporteurAction({ calendlyEventId: "evt_1", issue: "retenu" });
    expect(a).toMatchObject({ etat: "apercu", email: null });
    expect(a.etat === "apercu" && a.sansEmail).toMatch(/déjà parti.*25\/09/);
    expect(renderEmailTemplate).not.toHaveBeenCalled();
  });

  it("un rendez-vous CLIENT n'a pas d'issue apporteur", async () => {
    db.evenement = { ...db.evenement, eventTypeName: "Appel découverte (30 min)" };
    const a = await apercuIssueApporteurAction({ calendlyEventId: "evt_1", issue: "retenu" });
    expect(a).toMatchObject({
      etat: "erreur",
      message: "Ce rendez-vous n'est pas un échange apporteur.",
    });
  });
});

describe("rien ne part sur un seul clic", () => {
  it.each(["absent", "retenu", "non_retenu"])(
    "%s sans confirmation de l'aperçu : refusé, rien n'est écrit ni envoyé",
    async (issue) => {
      const r = await enregistrerIssueApporteurAction(INITIAL, fd({ issue }));
      expect(r).toMatchObject({ etat: "erreur" });
      expect(r.etat === "erreur" && r.message).toMatch(/aperçu/);
      expect(upsert).not.toHaveBeenCalled();
      expect(enqueueEmail).not.toHaveBeenCalled();
      expect(appliquerTransition).not.toHaveBeenCalled();
    },
  );
});

describe("l'envoi confirmé", () => {
  it("Retenu : point écrit, e-mail en file UNE fois, rattaché à la fiche, relances du dossier coupées, journal", async () => {
    const r = await enregistrerIssueApporteurAction(
      INITIAL,
      fd({ issue: "retenu", confirmer: "oui", noteSur20: "17", justification: "Réseau solide." }),
    );
    expect(r).toMatchObject({ etat: "ok" });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { calendlyEventId: "evt_1" },
        create: expect.objectContaining({
          issue: "eu_lieu",
          decision: "retenu",
          suite: null,
          noteSur20: 17,
          note: "Réseau solide.",
          renseignePar: "will@axion-ia.com",
        }),
      }),
    );
    expect(enqueueEmail).toHaveBeenCalledTimes(1);
    expect(enqueueEmail).toHaveBeenCalledWith(
      "apporteur-issue-retenu",
      "camille@exemple.fr",
      "fr",
      // 07/10 : « Retenu » ne part jamais sans le lien de son dossier.
      {
        contactName: "Camille Martin",
        dossierUrl: expect.stringContaining("/apporteur/dossier/"),
      },
      { entityType: "Submission", entityId: "sub_1", jobId: "apporteur-issue-retenu-empreinte123" },
    );
    expect(annulerRelancesLeadApporteur).toHaveBeenCalledWith(
      "camille@exemple.fr",
      expect.any(String),
    );
    expect(appliquerTransition).not.toHaveBeenCalled();
    expect(activityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminUserId: "adm_1",
        action: "rendez_vous.issue_apporteur",
        targetType: "submission",
        targetId: "sub_1",
        changes: expect.objectContaining({
          issue: "retenu",
          gabarit: "apporteur-issue-retenu",
          envoi: "envoye",
        }),
      }),
    });
  });

  it("🔑 idempotence : un e-mail déjà parti pour CETTE PERSONNE (autre ligne comprise) ne repart pas", async () => {
    db.journal = { createdAt: new Date("2026-09-25T10:00:00Z") };
    const r = await enregistrerIssueApporteurAction(
      INITIAL,
      fd({ issue: "retenu", confirmer: "oui" }),
    );
    expect(r).toMatchObject({ etat: "ok" });
    expect(r.etat === "ok" && r.message).toMatch(/ne sera pas renvoyé/);
    expect(upsert).toHaveBeenCalledTimes(1); // la décision s'enregistre quand même
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("idempotence : un e-mail qui attend dans « Envois à valider » compte aussi", async () => {
    db.corbeille = { createdAt: new Date("2026-09-27T10:00:00Z") };
    await enregistrerIssueApporteurAction(INITIAL, fd({ issue: "non_retenu", confirmer: "oui" }));
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("le jobId est le même à chaque essai : deux clics simultanés ne posent qu'UN job", async () => {
    await enregistrerIssueApporteurAction(INITIAL, fd({ issue: "retenu", confirmer: "oui" }));
    await enregistrerIssueApporteurAction(INITIAL, fd({ issue: "retenu", confirmer: "oui" }));
    const ids = enqueueEmail.mock.calls.map((c) => (c[4] as { jobId: string }).jobId);
    expect(new Set(ids).size).toBe(1);
  });

  it("Non retenu : la fiche est classée « Sans suite » (toute relance future s'arrête), refus envoyé", async () => {
    const r = await enregistrerIssueApporteurAction(
      INITIAL,
      fd({ issue: "non_retenu", confirmer: "oui" }),
    );
    expect(r).toMatchObject({ etat: "ok" });
    expect(appliquerTransition).toHaveBeenCalledWith("sub_1", "sans-suite", "adm_1");
    expect(enqueueEmail.mock.calls[0]?.[0]).toBe("apporteur-issue-non-retenu");
  });

  it("Absent (1re fois) : l'e-mail porte le lien de réservation apporteur et la date de l'échange", async () => {
    await enregistrerIssueApporteurAction(INITIAL, fd({ issue: "absent", confirmer: "oui" }));
    expect(enqueueEmail).toHaveBeenCalledWith(
      "apporteur-issue-absent",
      "camille@exemple.fr",
      "fr",
      {
        contactName: "Camille Martin",
        calendlyUrl: "https://calendly.com/axion-ia/echange-apporteur",
        dateEchange: "mardi 22 septembre",
      },
      expect.objectContaining({ entityType: "Submission", entityId: "sub_1" }),
    );
    expect(upsert.mock.calls[0]?.[0]).toMatchObject({
      create: { issue: "absent", decision: null },
    });
  });

  it("une adresse retenue (opposition) : la décision est enregistrée, mais l'écran dit que RIEN n'est parti", async () => {
    enqueueEmail.mockResolvedValue({ enqueued: false, retenu: "oppose" });
    const r = await enregistrerIssueApporteurAction(
      INITIAL,
      fd({ issue: "retenu", confirmer: "oui" }),
    );
    expect(r.etat).toBe("erreur");
    expect(r.etat === "erreur" && r.message).toMatch(/n'est PAS parti/);
  });
});

describe("aucun e-mail", () => {
  it("Reporté : enregistré au clic, sans confirmation, sans e-mail", async () => {
    const r = await enregistrerIssueApporteurAction(INITIAL, fd({ issue: "reporte" }));
    expect(r).toMatchObject({ etat: "ok" });
    expect(upsert.mock.calls[0]?.[0]).toMatchObject({
      create: { issue: "reporte", decision: null },
    });
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("À revoir : décision interne avec date de rappel, sans e-mail", async () => {
    const r = await enregistrerIssueApporteurAction(
      INITIAL,
      fd({ issue: "a_revoir", rappelLe: "2026-10-15", noteSur20: "12" }),
    );
    expect(r).toMatchObject({ etat: "ok" });
    const create = (upsert.mock.calls[0]?.[0] as { create: Record<string, unknown> }).create;
    expect(create).toMatchObject({ issue: "eu_lieu", decision: "a_revoir", noteSur20: 12 });
    expect((create["suiteLe"] as Date).toISOString()).toBe("2026-10-15T00:00:00.000Z");
    expect(enqueueEmail).not.toHaveBeenCalled();
    expect(appliquerTransition).not.toHaveBeenCalled();
  });

  it("DEUXIÈME absence : enregistrée sans e-mail de reprogrammation, l'écran suggère « Non retenu »", async () => {
    db.absences = 1;
    const a = await apercuIssueApporteurAction({ calendlyEventId: "evt_1", issue: "absent" });
    expect(a).toMatchObject({ etat: "apercu", email: null });
    expect(a.etat === "apercu" && a.sansEmail).toMatch(/Non retenu/);

    const r = await enregistrerIssueApporteurAction(INITIAL, fd({ issue: "absent" }));
    expect(r).toMatchObject({ etat: "ok" });
    expect(enqueueEmail).not.toHaveBeenCalled();
    // Les absences comptées sont celles des AUTRES échanges de la personne.
    expect(suiviCount.mock.calls[0]?.[0]).toMatchObject({
      where: { issue: "absent", calendlyEventId: { not: "evt_1" } },
    });
  });
});

describe("garde-fous de la fiche", () => {
  it("un rendez-vous sans fiche rattachée ne peut pas envoyer d'e-mail", async () => {
    db.evenement = { ...db.evenement, linkedSubmissionId: null };
    db.fiche = null;
    const r = await enregistrerIssueApporteurAction(
      INITIAL,
      fd({ issue: "retenu", confirmer: "oui" }),
    );
    expect(r.etat === "erreur" && r.message).toMatch(/rattaché à aucune fiche/);
    expect(upsert).not.toHaveBeenCalled();
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it("une fiche effacée (art. 17) ne reçoit rien", async () => {
    db.fiche = { ...db.fiche, contactEmail: "x@erased.local", contactName: "[effacé]" };
    const r = await enregistrerIssueApporteurAction(
      INITIAL,
      fd({ issue: "retenu", confirmer: "oui" }),
    );
    expect(r.etat).toBe("erreur");
    expect(enqueueEmail).not.toHaveBeenCalled();
  });
});

describe("🔴 « Retenu » pour un apporteur RETIRÉ du réseau (2026-10-07)", () => {
  it("aperçu ET envoi refusés avec un message clair ; rien ne part, rien n'est écrit", async () => {
    retraitDe.mockResolvedValue(new Date());
    try {
      const a = await apercuIssueApporteurAction({ calendlyEventId: "evt_1", issue: "retenu" });
      expect(a).toMatchObject({ etat: "erreur" });
      expect((a as { message: string }).message).toMatch(/retiré du réseau.*remettez-le/i);
      const r = await enregistrerIssueApporteurAction(
        INITIAL,
        fd({ issue: "retenu", confirmer: "oui", noteSur20: "17", justification: "Réseau solide." }),
      );
      expect(r).toMatchObject({ etat: "erreur" });
      expect((r as { message: string }).message).toMatch(/retiré du réseau/i);
      expect(enqueueEmail).not.toHaveBeenCalled();
      expect(upsert).not.toHaveBeenCalled();
    } finally {
      retraitDe.mockResolvedValue(null);
    }
  });
});
