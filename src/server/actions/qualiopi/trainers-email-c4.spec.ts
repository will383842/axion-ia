/**
 * Lot C4 — `updateTrainerAction` : changement d'adresse e-mail d'un formateur
 * INDÉPENDANT, et journal sans donnée personnelle.
 *
 * Constat de départ (chaque `it` marqué 🔴 était ROUGE avant le lot) :
 * - un `editor` changeait l'adresse d'un indépendant (simple `requireAdminWrite`) :
 *   les liens de connexion et du dossier partaient vers la nouvelle adresse, sans
 *   que l'ancienne en sache rien ;
 * - les liens du dossier (`accesVersion`) et les liens de connexion en attente
 *   restaient valables ;
 * - le journal recopiait nom, e-mail, téléphone et adresse en clair.
 *
 * Salariés et dirigeants : inchangé (un `editor` change leur adresse comme avant).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/server/qualiopi/sessions/verrou-dossier-garde", () => ({
  assertDossierOuvert: async () => ({ ok: true, sessionId: null }),
  assertDossierOuvertSiRegeneration: async () => ({ ok: true, sessionId: null }),
}));

const m = vi.hoisted(() => ({
  trainerUpdate: vi.fn(),
  trainerFindUnique: vi.fn(),
  magicLinkUpdateMany: vi.fn(),
  envoyer: vi.fn(),
  log: vi.fn(),
  session: { userId: "admin-uuid", role: "super_admin" } as { userId: string; role: string },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainer: {
      update: (...a: unknown[]) => m.trainerUpdate(...a),
      findUnique: (...a: unknown[]) => m.trainerFindUnique(...a),
    },
    formateurMagicLink: { updateMany: (...a: unknown[]) => m.magicLinkUpdateMany(...a) },
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn(async () => m.session),
  requireHabilitation: vi.fn(async () => m.session),
  requireAdminDelete: vi.fn(async () => m.session),
  logQualiopiActivity: (...a: unknown[]) => m.log(...a),
}));

vi.mock("@/server/qualiopi/formateurs-independants/envois", () => ({
  envoyer: (...a: unknown[]) => m.envoyer(...a),
}));

vi.mock("@/features/admin-planning/queries", () => ({ getTrainerConflicts: vi.fn() }));
vi.mock("@/server/qualiopi/trainers/documents", () => ({ getTrainerConformite: vi.fn() }));

import { updateTrainerAction } from "./trainers";

const ID = "22222222-2222-2222-2222-222222222222";
const ANCIENNE = "ancienne@exemple.test";
const NOUVELLE = "nouvelle@exemple.test";

function fiche(statut: string, extra: Record<string, unknown> = {}) {
  return { statut, email: ANCIENNE, prenom: "Camille", ...extra };
}

function dataEcrite(): Record<string, unknown> {
  return (m.trainerUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
}

beforeEach(() => {
  vi.clearAllMocks();
  m.session = { userId: "admin-uuid", role: "super_admin" };
  m.trainerUpdate.mockResolvedValue({ id: ID });
  m.magicLinkUpdateMany.mockResolvedValue({ count: 1 });
  m.envoyer.mockResolvedValue("texte-non-valide");
  m.log.mockResolvedValue(undefined);
});

describe("updateTrainerAction — e-mail d'un indépendant", () => {
  it("🔴 un `editor` ne change PAS l'adresse d'un indépendant", async () => {
    m.session = { userId: "editeur-uuid", role: "editor" };
    m.trainerFindUnique.mockResolvedValue(fiche("sous_traitant"));
    const r = await updateTrainerAction({ id: ID, email: NOUVELLE });
    expect(r).toHaveProperty("error");
    if ("error" in r) expect(r.error).toMatch(/responsable qualité|direction/);
    expect(m.trainerUpdate).not.toHaveBeenCalled();
    expect(m.envoyer).not.toHaveBeenCalled();
  });

  it("🔴 ni en le requalifiant salarié dans la même demande", async () => {
    m.session = { userId: "editeur-uuid", role: "editor" };
    m.trainerFindUnique.mockResolvedValue(fiche("sous_traitant"));
    const r = await updateTrainerAction({ id: ID, email: NOUVELLE, statut: "salarie" });
    expect(r).toHaveProperty("error");
    expect(m.trainerUpdate).not.toHaveBeenCalled();
  });

  it("🔴 un rôle habilité change l'adresse : liens du dossier révoqués dans la MÊME écriture", async () => {
    m.trainerFindUnique.mockResolvedValue(fiche("sous_traitant"));
    const r = await updateTrainerAction({ id: ID, email: NOUVELLE });
    expect(r).toEqual({ data: { id: ID } });
    expect(m.trainerUpdate).toHaveBeenCalledTimes(1);
    expect(dataEcrite()).toMatchObject({ email: NOUVELLE, accesVersion: { increment: 1 } });
  });

  it("🔴 les liens de connexion encore en attente sont consommés", async () => {
    m.trainerFindUnique.mockResolvedValue(fiche("sous_traitant"));
    await updateTrainerAction({ id: ID, email: NOUVELLE });
    // Avant l'écriture (échec = refus) et après (course d'un lien créé entre-temps).
    expect(m.magicLinkUpdateMany).toHaveBeenCalledTimes(2);
    const arg = m.magicLinkUpdateMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(arg.where).toMatchObject({ trainerId: ID, usedAt: null });
    expect(arg.data["usedAt"]).toBeInstanceOf(Date);
  });

  it("🔴 l'ANCIENNE adresse est prévenue, sans jamais recevoir la nouvelle", async () => {
    m.trainerFindUnique.mockResolvedValue(fiche("sous_traitant"));
    await updateTrainerAction({ id: ID, email: NOUVELLE });
    expect(m.envoyer).toHaveBeenCalledTimes(1);
    const e = m.envoyer.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(e).toMatchObject({
      gabarit: "formateur-email-modifie",
      destinataire: ANCIENNE,
      entityType: "Trainer",
      entityId: ID,
    });
    expect(JSON.stringify(e["payload"])).not.toContain(NOUVELLE);
  });

  it("🔴 relecture — un `editor` ne requalifie pas un indépendant (contournement en deux temps)", async () => {
    m.session = { userId: "editeur-uuid", role: "editor" };
    m.trainerFindUnique.mockResolvedValue(fiche("sous_traitant"));
    const r = await updateTrainerAction({ id: ID, statut: "salarie" });
    expect(r).toHaveProperty("error");
    expect(m.trainerUpdate).not.toHaveBeenCalled();
  });

  it("🔴 relecture — les liens en attente sont consommés AVANT l'écriture ; échec = refus", async () => {
    m.trainerFindUnique.mockResolvedValue(fiche("sous_traitant"));
    m.magicLinkUpdateMany.mockRejectedValueOnce(new Error("base indisponible"));
    const r = await updateTrainerAction({ id: ID, email: NOUVELLE });
    expect(r).toHaveProperty("error");
    expect(m.trainerUpdate).not.toHaveBeenCalled();
  });

  it("🔴 relecture — le journal dit qu'une adresse d'indépendant a changé, sans la valeur", async () => {
    m.trainerFindUnique.mockResolvedValue(fiche("sous_traitant"));
    await updateTrainerAction({ id: ID, email: NOUVELLE });
    const entree = m.log.mock.calls[0]?.[0] as { changes: Record<string, unknown> };
    expect(entree.changes).toEqual({ champs: ["email"], emailIndependantModifie: true });
  });

  it("un envoi en échec n'annule pas le changement", async () => {
    m.trainerFindUnique.mockResolvedValue(fiche("sous_traitant"));
    m.envoyer.mockRejectedValue(new Error("file indisponible"));
    // Le second passage (après l'écriture) échoue : l'adresse reste changée.
    m.magicLinkUpdateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockRejectedValue(new Error("base indisponible"));
    const r = await updateTrainerAction({ id: ID, email: NOUVELLE });
    expect(r).toEqual({ data: { id: ID } });
  });

  it("la même adresse (casse près) n'est pas un changement : rien de plus", async () => {
    m.session = { userId: "editeur-uuid", role: "editor" };
    m.trainerFindUnique.mockResolvedValue(fiche("sous_traitant"));
    const r = await updateTrainerAction({ id: ID, email: "Ancienne@Exemple.test" });
    expect(r).toEqual({ data: { id: ID } });
    expect(dataEcrite()).not.toHaveProperty("accesVersion");
    expect(m.envoyer).not.toHaveBeenCalled();
  });

  it("une lecture impossible refuse (garde fermée)", async () => {
    m.trainerFindUnique.mockRejectedValue(new Error("base indisponible"));
    const r = await updateTrainerAction({ id: ID, email: NOUVELLE });
    expect(r).toHaveProperty("error");
    expect(m.trainerUpdate).not.toHaveBeenCalled();
  });
});

describe("updateTrainerAction — e-mail d'un salarié ou d'un dirigeant : INCHANGÉ", () => {
  it.each(["salarie", "dirigeant"])(
    "un `editor` change l'adresse d'un %s comme avant",
    async (statut) => {
      m.session = { userId: "editeur-uuid", role: "editor" };
      m.trainerFindUnique.mockResolvedValue(fiche(statut));
      const r = await updateTrainerAction({ id: ID, email: NOUVELLE });
      expect(r).toEqual({ data: { id: ID } });
      expect(dataEcrite()).toEqual({ email: NOUVELLE });
      expect(m.magicLinkUpdateMany).not.toHaveBeenCalled();
      expect(m.envoyer).not.toHaveBeenCalled();
    },
  );

  it("un `editor` requalifie un salarié comme avant", async () => {
    m.session = { userId: "editeur-uuid", role: "editor" };
    m.trainerFindUnique.mockResolvedValue(fiche("salarie"));
    const r = await updateTrainerAction({ id: ID, statut: "dirigeant" });
    expect(r).toEqual({ data: { id: ID } });
  });

  it("une mise à jour sans e-mail ne lit rien de plus", async () => {
    const r = await updateTrainerAction({ id: ID, telephone: "0102030405" });
    expect(r).toEqual({ data: { id: ID } });
    expect(m.trainerFindUnique).not.toHaveBeenCalled();
  });
});

describe("updateTrainerAction — journal sans donnée personnelle", () => {
  it("🔴 le journal porte la LISTE des champs modifiés, jamais leurs valeurs", async () => {
    m.trainerFindUnique.mockResolvedValue(fiche("salarie"));
    await updateTrainerAction({
      id: ID,
      nom: "Dupont",
      prenom: "Camille",
      email: NOUVELLE,
      telephone: "0612345678",
      adresseProfessionnelle: "12 rue des Lilas, 38000 Grenoble",
    });
    expect(m.log).toHaveBeenCalledTimes(1);
    const entree = m.log.mock.calls[0]?.[0] as { changes: unknown };
    expect(entree.changes).toEqual({
      champs: ["nom", "prenom", "email", "telephone", "adresseProfessionnelle"],
    });
    const brut = JSON.stringify(entree);
    for (const valeur of ["Dupont", "Camille", NOUVELLE, "0612345678", "Lilas"]) {
      expect(brut).not.toContain(valeur);
    }
  });
});
