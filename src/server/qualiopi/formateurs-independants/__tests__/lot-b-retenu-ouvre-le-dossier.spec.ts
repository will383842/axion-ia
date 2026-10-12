/**
 * Lot B, M2 — « Retenu » OUVRE le dossier en ligne : statut `en_cours`, date
 * d'ouverture, nouvelle version d'accès (le lien), puis F5 part avec ce lien, sur la
 * fiche (`entityType: "Trainer"`) : c'est l'origine de la campagne S3 (F9).
 *
 * Interrupteur `dossier_en_ligne` coupé : rien n'est ouvert, rien ne part.
 * Une fiche dont le dossier est déjà ouvert n'est jamais rouverte par ce geste.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const etats = vi.fn();
vi.mock("../interrupteurs-etat", () => ({ lireEtatsInterrupteurs: () => etats() }));
const envoyer = vi.fn();
vi.mock("../envois", () => ({ envoyer: (...a: unknown[]) => envoyer(...a) }));
const journaliser = vi.fn();
vi.mock("@/server/journal/journaliser", () => ({
  journaliser: (...a: unknown[]) => journaliser(...a),
}));

const updateMany = vi.fn();
const findUnique = vi.fn();
const tx = {
  trainer: {
    updateMany: (...a: unknown[]) => updateMany(...a),
    findUnique: (...a: unknown[]) => findUnique(...a),
  },
};
vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: (f: (t: typeof tx) => unknown) => f(tx) },
}));

import { etatsParDefaut } from "../interrupteurs";
import { ouvrirDossierRetenu } from "../ouverture-dossier";
import { ORIGINES_RELANCE_DOSSIER } from "../relance-dossier";

const T = "6f1b8a52-4a0e-4d4c-9f43-2f6a7d1c9e10";
const ADMIN = "a1b2c3d4-0000-4000-8000-000000000001";
const MAINTENANT = new Date("2026-10-12T09:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  etats.mockResolvedValue({ ...etatsParDefaut(), dossier_en_ligne: true, textes_valides: true });
  updateMany.mockResolvedValue({ count: 1 });
  findUnique.mockResolvedValue({ id: T, email: "c@x.fr", prenom: "Camille", accesVersion: 1 });
  envoyer.mockResolvedValue("envoye");
  journaliser.mockResolvedValue(undefined);
});

describe("ouvrirDossierRetenu", () => {
  it("ouvre le dossier (statut, date, version d'accès) puis envoie F5 avec le lien, sur la fiche", async () => {
    const r = await ouvrirDossierRetenu({ trainerId: T, parId: ADMIN, maintenant: MAINTENANT });
    expect(r).toEqual({ ok: true, envoi: "envoye" });

    const ecriture = updateMany.mock.calls[0]![0];
    expect(ecriture.where).toMatchObject({
      id: T,
      statut: "sous_traitant",
      dossierStatut: null,
      finCollaborationAt: null,
      organismeSousTraitantId: null,
    });
    expect(ecriture.data).toEqual({
      dossierStatut: "en_cours",
      dossierOuvertAt: MAINTENANT,
      accesVersion: { increment: 1 },
    });

    expect(journaliser.mock.calls[0]![1]).toMatchObject({
      action: "qualiopi.formateur.dossier_ouvert",
      targetType: "Trainer",
      targetId: T,
      session: { userId: ADMIN },
    });

    const e = envoyer.mock.calls[0]![0];
    expect(e).toMatchObject({
      gabarit: "formateur-issue-retenu",
      destinataire: "c@x.fr",
      entityType: "Trainer",
      entityId: T,
      jobId: `fi-issue-retenu-${T}`,
    });
    expect(e.payload.prenom).toBe("Camille");
    expect(e.payload.lien).toMatch(new RegExp(`/formateur/dossier/${T}/\\d+\\.[A-Za-z0-9_-]{43}$`));
    // F5 est bien une origine de la campagne S3 (relances F9).
    expect(ORIGINES_RELANCE_DOSSIER).toContain(e.gabarit);
  });

  it("interrupteur `dossier_en_ligne` coupé : rien n'est écrit ni envoyé", async () => {
    etats.mockResolvedValue(etatsParDefaut());
    const r = await ouvrirDossierRetenu({ trainerId: T, parId: ADMIN, maintenant: MAINTENANT });
    expect(r.ok).toBe(false);
    expect(updateMany).not.toHaveBeenCalled();
    expect(envoyer).not.toHaveBeenCalled();
  });

  it("dossier déjà ouvert (écriture conditionnelle sans effet) : ni journal ni e-mail", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    const r = await ouvrirDossierRetenu({ trainerId: T, parId: ADMIN, maintenant: MAINTENANT });
    expect(r.ok).toBe(false);
    expect(journaliser).not.toHaveBeenCalled();
    expect(envoyer).not.toHaveBeenCalled();
  });

  it("texte F5 non validé : le dossier reste ouvert, l'écran le dit (envoi non parti)", async () => {
    envoyer.mockResolvedValue("texte-non-valide");
    const r = await ouvrirDossierRetenu({ trainerId: T, parId: ADMIN, maintenant: MAINTENANT });
    expect(r).toEqual({ ok: true, envoi: "texte-non-valide" });
    expect(updateMany).toHaveBeenCalledTimes(1);
  });
});
