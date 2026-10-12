/**
 * Lot F-CAL-2 — les actions de l'issue formateur : interrupteur coupé = refus ;
 * « Retenu » réservé à l'administrateur ; aucun statut de recrutement écrit ;
 * un e-mail ne part que confirmé.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
vi.mock("@/auth", () => ({ auth: () => auth() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
const etatsEntree = vi.fn();
vi.mock("@/server/qualiopi/formateurs-independants/etats-entree", () => ({
  lireEtatsEntree: () => etatsEntree(),
}));
const envoyer = vi.fn();
vi.mock("@/server/qualiopi/formateurs-independants/envois", () => ({
  envoyer: (...a: unknown[]) => envoyer(...a),
  apercu: vi.fn(),
}));
const creerFiche = vi.fn();
vi.mock("@/features/admin-job-applications/fiche-formateur-actions", () => ({
  creerFicheFormateurDepuisCandidatureAction: (...a: unknown[]) => creerFiche(...a),
}));
const ouvrir = vi.fn();
vi.mock("@/server/qualiopi/formateurs-independants/ouverture-dossier", () => ({
  ouvrirDossierRetenu: (...a: unknown[]) => ouvrir(...a),
}));
const preparer = vi.fn();
vi.mock("../issue-formateur-envoi", () => ({
  preparerIssueFormateur: (...a: unknown[]) => preparer(...a),
}));
const upsert = vi.fn();
const jaUpdate = vi.fn();
const trainerUpdateMany = vi.fn();
const logCreate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    rendezVousSuivi: { upsert: (...a: unknown[]) => upsert(...a) },
    jobApplication: {
      update: (...a: unknown[]) => jaUpdate(...a),
      updateMany: (...a: unknown[]) => jaUpdate(...a),
    },
    trainer: { updateMany: (...a: unknown[]) => trainerUpdateMany(...a) },
    activityLog: { create: (...a: unknown[]) => logCreate(...a) },
  },
}));

import { enregistrerIssueFormateurAction } from "../issue-formateur-actions";

const CAND = "0b7c3a52-4a0e-4d4c-9f43-2f6a7d1c9e10";

function fd(champs: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(champs)) f.set(k, v);
  return f;
}
const INITIAL = { etat: "initial" as const };

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ user: { id: "u1", email: "a@b.c", role: "super_admin" } });
  etatsEntree.mockResolvedValue({ suivi_echange: true });
  preparer.mockResolvedValue({
    ok: true,
    calendlyEventId: "evt_f1",
    candidatureId: CAND,
    lignes: [CAND],
    absencesAnterieures: 0,
    envoi: null,
    sansEmail: "Le dossier en ligne n'est pas encore ouvert.",
  });
  creerFiche.mockResolvedValue({ ok: true, trainerId: "t1", lien: "/x" });
  upsert.mockResolvedValue({});
  trainerUpdateMany.mockResolvedValue({ count: 1 });
  logCreate.mockResolvedValue({});
});

describe("enregistrerIssueFormateurAction", () => {
  it("interrupteur coupé : refus, rien n'est écrit", async () => {
    etatsEntree.mockResolvedValue({ suivi_echange: false });
    const r = await enregistrerIssueFormateurAction(
      INITIAL,
      fd({ calendlyEventId: "evt_f1", issue: "reporte" }),
    );
    expect(r.etat).toBe("erreur");
    expect(upsert).not.toHaveBeenCalled();
  });

  it("« Retenu » par un editor : refus", async () => {
    auth.mockResolvedValue({ user: { id: "u2", email: "e@b.c", role: "editor" } });
    const r = await enregistrerIssueFormateurAction(
      INITIAL,
      fd({ calendlyEventId: "evt_f1", issue: "retenu" }),
    );
    expect(r).toMatchObject({ etat: "erreur" });
    expect(upsert).not.toHaveBeenCalled();
    expect(creerFiche).not.toHaveBeenCalled();
  });

  it("« Retenu » par l'administrateur : point écrit, fiche INACTIVE sous_traitant reliée à sa candidature, aucun statut de recrutement", async () => {
    const r = await enregistrerIssueFormateurAction(
      INITIAL,
      fd({ calendlyEventId: "evt_f1", issue: "retenu" }),
    );
    expect(r.etat).toBe("ok");
    expect(upsert.mock.calls[0]![0].create).toMatchObject({ issue: "eu_lieu", decision: "retenu" });
    expect(creerFiche).toHaveBeenCalledWith({
      applicationId: CAND,
      statut: "sous_traitant",
      actif: false,
    });
    expect(trainerUpdateMany).toHaveBeenCalledWith({
      where: { id: "t1", candidatureId: null },
      data: { candidatureId: CAND },
    });
    expect(jaUpdate).not.toHaveBeenCalled();
    expect(logCreate.mock.calls[0]![0].data.targetId).toBe(CAND);
  });

  it("un e-mail prévu ne part pas sans confirmer=oui", async () => {
    preparer.mockResolvedValue({
      ok: true,
      calendlyEventId: "evt_f1",
      candidatureId: CAND,
      lignes: [CAND],
      absencesAnterieures: 0,
      envoi: { gabarit: "formateur-issue-absent", destinataire: "c@x.y", payload: {}, jobId: "k" },
      sansEmail: null,
    });
    const r = await enregistrerIssueFormateurAction(
      INITIAL,
      fd({ calendlyEventId: "evt_f1", issue: "absent" }),
    );
    expect(r.etat).toBe("erreur");
    expect(envoyer).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();

    envoyer.mockResolvedValue("envoye");
    const ok = await enregistrerIssueFormateurAction(
      INITIAL,
      fd({ calendlyEventId: "evt_f1", issue: "absent", confirmer: "oui" }),
    );
    expect(ok.etat).toBe("ok");
    expect(envoyer).toHaveBeenCalledWith(
      expect.objectContaining({
        gabarit: "formateur-issue-absent",
        entityType: "JobApplication",
        entityId: CAND,
        jobId: "k",
      }),
    );
  });

  it("lot B — « Retenu » avec F5 prévu : fiche créée, dossier OUVERT, F5 par l'ouverture (jamais l'envoi générique)", async () => {
    preparer.mockResolvedValue({
      ok: true,
      calendlyEventId: "evt_f1",
      candidatureId: CAND,
      lignes: [CAND],
      absencesAnterieures: 0,
      envoi: {
        gabarit: "formateur-issue-retenu",
        destinataire: "c@x.y",
        payload: { lien: "https://axion-ia.com/formateur/dossier/…" },
        jobId: "k",
        ouvreDossier: true,
      },
      sansEmail: null,
    });
    ouvrir.mockResolvedValue({ ok: true, envoi: "envoye" });
    const sans = await enregistrerIssueFormateurAction(
      INITIAL,
      fd({ calendlyEventId: "evt_f1", issue: "retenu" }),
    );
    expect(sans.etat).toBe("erreur");
    expect(ouvrir).not.toHaveBeenCalled();

    const r = await enregistrerIssueFormateurAction(
      INITIAL,
      fd({ calendlyEventId: "evt_f1", issue: "retenu", confirmer: "oui" }),
    );
    expect(r).toMatchObject({ etat: "ok" });
    if (r.etat === "ok") expect(r.message).toMatch(/Dossier en ligne ouvert.*E-mail envoyé/);
    expect(ouvrir).toHaveBeenCalledWith(expect.objectContaining({ trainerId: "t1", parId: "u1" }));
    expect(envoyer).not.toHaveBeenCalled();
    expect(logCreate.mock.calls[0]![0].data.changes).toMatchObject({
      gabarit: "formateur-issue-retenu",
      envoi: "envoye",
    });
  });

  it("lot B — fiche non créée : le dossier ne s'ouvre pas, rien ne part", async () => {
    preparer.mockResolvedValue({
      ok: true,
      calendlyEventId: "evt_f1",
      candidatureId: CAND,
      lignes: [CAND],
      absencesAnterieures: 0,
      envoi: {
        gabarit: "formateur-issue-retenu",
        destinataire: "c@x.y",
        payload: {},
        jobId: "k",
        ouvreDossier: true,
      },
      sansEmail: null,
    });
    creerFiche.mockResolvedValue({ ok: false, message: "non éligible" });
    const r = await enregistrerIssueFormateurAction(
      INITIAL,
      fd({ calendlyEventId: "evt_f1", issue: "retenu", confirmer: "oui" }),
    );
    expect(r.etat).toBe("ok");
    expect(ouvrir).not.toHaveBeenCalled();
    expect(envoyer).not.toHaveBeenCalled();
  });
});
