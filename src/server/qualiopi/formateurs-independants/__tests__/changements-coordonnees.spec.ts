/**
 * M12 (lot E) — changement de compte bancaire et d'adresse : une DEMANDE depuis
 * l'espace, un DÉLAI, une VALIDATION en console. Protection contre la fraude au
 * changement de compte :
 *  - la fiche n'est pas touchée avant la validation (l'ancien IBAN reste utilisé) ;
 *  - l'IBAN est chiffré (AAD de la demande, puis de la fiche), jamais journalisé ni
 *    envoyé dans une alerte ou un e-mail ;
 *  - une alerte interne à chaque demande, F43 à l'adresse connue ;
 *  - validation refusée avant 48 h ; F44 à la validation ;
 *  - tout est éteint par défaut.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env["IBAN_EMPREINTE_SECRET"] = "secret-empreinte-de-test";
});

const db = vi.hoisted(() => {
  const d = {
    trainer: { findUnique: vi.fn(), update: vi.fn() },
    demandeChangementFormateur: {
      create: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    activityLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  d.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(d));
  return d;
});
const allume = vi.hoisted(() => vi.fn());
const envoyer = vi.hoisted(() => vi.fn());
const notify = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteur-allume", () => ({
  interrupteurAllume: allume,
}));
vi.mock("@/server/qualiopi/formateurs-independants/envois", () => ({ envoyer }));
vi.mock("@/server/notifications", () => ({ notify }));
// Chiffrement simulé : la valeur chiffrée porte son AAD, pour vérifier laquelle est utilisée.
vi.mock("@/lib/pii-crypto", () => ({
  encryptPii: (v: string, o: { aad: string }) =>
    `enc:v2:${o.aad}|${Buffer.from(v).toString("hex")}`,
  decryptPii: (v: string, o: { aad: string }) => {
    const [aad, hex] = v.replace(/^enc:v2:/, "").split("|");
    if (aad !== o.aad) throw new Error("AAD");
    return Buffer.from(hex ?? "", "hex").toString();
  },
}));

import {
  DELAI_VALIDATION_CHANGEMENT_MS,
  demanderChangementAdresse,
  demanderChangementIban,
  lireDemandesEnCours,
  refuserDemandeChangement,
  validerDemandeChangement,
} from "@/server/qualiopi/formateurs-independants/changements-coordonnees";

const ID = "3f2a9c1e-0b7d-4c55-9e21-6a8f0d4b7c13";
const ADMIN = "22222222-2222-4222-8222-222222222222";
const DEMANDE = "9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d";
const IBAN = "FR7630006000011234567890189";
const MAINTENANT = new Date("2026-10-12T10:00:00Z");

const fiche = (over: Record<string, unknown> = {}) => ({
  id: ID,
  statut: "sous_traitant",
  actif: true,
  finCollaborationAt: null,
  prenom: "Camille",
  email: "camille@example.test",
  ibanEmpreinte: "ancienne-empreinte",
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  allume.mockResolvedValue(true);
  envoyer.mockResolvedValue("envoye");
  notify.mockResolvedValue({ ok: true });
  db.trainer.findUnique.mockResolvedValue(fiche());
  db.demandeChangementFormateur.create.mockResolvedValue({});
  db.demandeChangementFormateur.updateMany.mockResolvedValue({ count: 1 });
  db.activityLog.create.mockResolvedValue({});
  db.trainer.update.mockResolvedValue({});
});

const tout = () =>
  JSON.stringify([
    db.activityLog.create.mock.calls,
    notify.mock.calls,
    envoyer.mock.calls,
    db.demandeChangementFormateur.updateMany.mock.calls,
  ]);

describe("M12 — demande de changement d'IBAN", () => {
  it("interrupteur coupé : rien n'est lu ni écrit", async () => {
    allume.mockResolvedValue(false);
    const r = await demanderChangementIban(ID, IBAN, MAINTENANT);
    expect(r.ok).toBe(false);
    expect(db.trainer.findUnique).not.toHaveBeenCalled();
    expect(db.demandeChangementFormateur.create).not.toHaveBeenCalled();
  });

  it("IBAN invalide : refusé", async () => {
    expect((await demanderChangementIban(ID, "FR76 1234", MAINTENANT)).ok).toBe(false);
    expect(db.demandeChangementFormateur.create).not.toHaveBeenCalled();
  });

  it("salarié, fiche inactive ou close : refusé", async () => {
    for (const over of [
      { statut: "salarie" },
      { actif: false },
      { finCollaborationAt: new Date() },
    ]) {
      db.trainer.findUnique.mockResolvedValueOnce(fiche(over));
      expect((await demanderChangementIban(ID, IBAN, MAINTENANT)).ok).toBe(false);
    }
    expect(db.demandeChangementFormateur.create).not.toHaveBeenCalled();
  });

  it("demande créée : IBAN chiffré pour la DEMANDE, fiche intacte, alerte et F43, rien en clair", async () => {
    const r = await demanderChangementIban(ID, "fr76 3000 6000 0112 3456 7890 189", MAINTENANT);
    expect(r).toEqual({ ok: true });
    const data = db.demandeChangementFormateur.create.mock.calls[0]![0].data;
    expect(data.nature).toBe("iban");
    expect(data.valeur).toMatch(new RegExp(`^enc:v2:demande:${data.id}:iban\\|`));
    expect(data.valeurEmpreinte).toMatch(/^[0-9a-f]{64}$/);
    // La fiche n'est pas touchée : l'ancien IBAN reste celui des virements.
    expect(db.trainer.update).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith({
      category: "TRAINER_CHANGEMENT_DEMANDE",
      payload: { trainerId: ID, demandeId: data.id, nature: "iban" },
    });
    expect(envoyer).toHaveBeenCalledWith(
      expect.objectContaining({
        gabarit: "formateur-iban-changement",
        destinataire: "camille@example.test",
        jobId: `fi-changement-${data.id}`,
      }),
    );
    const journal = db.activityLog.create.mock.calls[0]![0].data;
    expect(journal.targetId).toBe(data.id);
    expect(journal.targetId).toMatch(/^[0-9a-f-]{36}$/);
    expect(tout()).not.toMatch(/FR76|30006000|7890189/i);
  });

  it("même compte que celui enregistré : refusé", async () => {
    const { empreinteIban } = await import("@/lib/iban-empreinte");
    db.trainer.findUnique.mockResolvedValue(fiche({ ibanEmpreinte: empreinteIban(IBAN) }));
    expect((await demanderChangementIban(ID, IBAN, MAINTENANT)).ok).toBe(false);
    expect(db.demandeChangementFormateur.create).not.toHaveBeenCalled();
  });

  it("une demande déjà en cours (index partiel) : refusé avec un message clair", async () => {
    db.demandeChangementFormateur.create.mockRejectedValue({ code: "P2002" });
    const r = await demanderChangementIban(ID, IBAN, MAINTENANT);
    expect(r).toEqual({ ok: false, message: expect.stringMatching(/déjà en cours/) });
    expect(notify).not.toHaveBeenCalled();
  });
});

describe("M12 — demande de changement d'adresse", () => {
  it("demande créée, alerte sans l'adresse", async () => {
    const r = await demanderChangementAdresse(ID, "12 rue des Lilas, 69001 Lyon");
    expect(r).toEqual({ ok: true });
    expect(db.demandeChangementFormateur.create.mock.calls[0]![0].data.nature).toBe("adresse");
    expect(JSON.stringify(notify.mock.calls)).not.toContain("Lilas");
    expect(JSON.stringify(db.activityLog.create.mock.calls)).not.toContain("Lilas");
  });
});

describe("M12 — validation en console (W-7)", () => {
  const demande = (over: Record<string, unknown> = {}) => ({
    id: DEMANDE,
    trainerId: ID,
    nature: "iban",
    statut: "en_attente",
    valeur: `enc:v2:demande:${DEMANDE}:iban|${Buffer.from(IBAN).toString("hex")}`,
    valeurEmpreinte: "a".repeat(64),
    createdAt: new Date(MAINTENANT.getTime() - DELAI_VALIDATION_CHANGEMENT_MS - 1000),
    ancienneAdresseAviseeAt: new Date(MAINTENANT.getTime() - DELAI_VALIDATION_CHANGEMENT_MS),
    trainer: {
      statut: "sous_traitant",
      actif: true,
      finCollaborationAt: null,
      prenom: "Camille",
      email: "camille@example.test",
    },
    ...over,
  });

  it("C4 — IBAN dont le titulaire n'a pas été prévenu : refusée, rien n'est écrit", async () => {
    db.demandeChangementFormateur.findUnique.mockResolvedValue(
      demande({ ancienneAdresseAviseeAt: null }),
    );
    const r = await validerDemandeChangement({
      demandeId: DEMANDE,
      adminId: ADMIN,
      maintenant: MAINTENANT,
    });
    expect(r).toEqual({ ok: false, raison: "non_avisee" });
    expect(db.demandeChangementFormateur.updateMany).not.toHaveBeenCalled();
    expect(db.trainer.update).not.toHaveBeenCalled();
  });

  it.each([
    ["fiche inactive", { actif: false }],
    ["collaboration terminée", { finCollaborationAt: new Date("2026-01-01T00:00:00Z") }],
  ])("C4 — %s : refusée, rien n'est écrit", async (_q, over) => {
    const d = demande();
    db.demandeChangementFormateur.findUnique.mockResolvedValue({
      ...d,
      trainer: { ...d.trainer, ...over },
    });
    const r = await validerDemandeChangement({
      demandeId: DEMANDE,
      adminId: ADMIN,
      maintenant: MAINTENANT,
    });
    expect(r).toEqual({ ok: false, raison: "fiche_close" });
    expect(db.demandeChangementFormateur.updateMany).not.toHaveBeenCalled();
    expect(db.trainer.update).not.toHaveBeenCalled();
  });

  it("avant 48 h : refusée, rien n'est écrit", async () => {
    db.demandeChangementFormateur.findUnique.mockResolvedValue(
      demande({ createdAt: new Date(MAINTENANT.getTime() - 60 * 60 * 1000) }),
    );
    const r = await validerDemandeChangement({
      demandeId: DEMANDE,
      adminId: ADMIN,
      maintenant: MAINTENANT,
    });
    expect(r).toEqual({ ok: false, raison: "trop_tot" });
    expect(db.trainer.update).not.toHaveBeenCalled();
  });

  it("après 48 h : IBAN rechiffré pour la FICHE, empreinte posée, F44, rien en clair", async () => {
    db.demandeChangementFormateur.findUnique.mockResolvedValue(demande());
    const r = await validerDemandeChangement({
      demandeId: DEMANDE,
      adminId: ADMIN,
      maintenant: MAINTENANT,
    });
    expect(r).toEqual({ ok: true });
    expect(db.demandeChangementFormateur.updateMany).toHaveBeenCalledWith({
      where: { id: DEMANDE, statut: "en_attente" },
      data: { statut: "acceptee", traiteParId: ADMIN, traiteAt: MAINTENANT },
    });
    const ecrit = db.trainer.update.mock.calls[0]![0];
    expect(ecrit.where).toEqual({ id: ID });
    expect(ecrit.data.iban).toMatch(new RegExp(`^enc:v2:trainer:${ID}:iban\\|`));
    expect(ecrit.data.ibanEmpreinte).toBe("a".repeat(64));
    expect(envoyer).toHaveBeenCalledWith(
      expect.objectContaining({
        gabarit: "formateur-iban-valide",
        jobId: `fi-changement-valide-${DEMANDE}`,
      }),
    );
    expect(envoyer.mock.calls[0]![0].payload.valeurs.nature).toBe("votre compte bancaire");
    expect(tout()).not.toMatch(/FR76|7890189/i);
  });

  it("adresse validée : écrite sur l'adresse professionnelle", async () => {
    db.demandeChangementFormateur.findUnique.mockResolvedValue(
      // Une adresse n'envoie aucun avis : elle se valide sans.
      demande({
        nature: "adresse",
        valeur: "12 rue des Lilas",
        valeurEmpreinte: null,
        ancienneAdresseAviseeAt: null,
      }),
    );
    await validerDemandeChangement({ demandeId: DEMANDE, adminId: ADMIN, maintenant: MAINTENANT });
    expect(db.trainer.update.mock.calls[0]![0].data).toEqual({
      adresseProfessionnelle: "12 rue des Lilas",
    });
  });

  it("déjà traitée (deux validations concurrentes) : la seconde n'écrit rien", async () => {
    db.demandeChangementFormateur.findUnique.mockResolvedValue(demande());
    db.demandeChangementFormateur.updateMany.mockResolvedValue({ count: 0 });
    const r = await validerDemandeChangement({
      demandeId: DEMANDE,
      adminId: ADMIN,
      maintenant: MAINTENANT,
    });
    expect(r).toEqual({ ok: false, raison: "deja_traitee" });
    expect(db.trainer.update).not.toHaveBeenCalled();
    expect(envoyer).not.toHaveBeenCalled();
  });

  it("refus : la demande reste en base, la fiche n'est pas touchée", async () => {
    const r = await refuserDemandeChangement({
      demandeId: DEMANDE,
      adminId: ADMIN,
      motif: "Demande non confirmée par téléphone",
      maintenant: MAINTENANT,
    });
    expect(r).toEqual({ ok: true });
    expect(db.demandeChangementFormateur.updateMany.mock.calls[0]![0].data.statut).toBe("refusee");
    expect(db.trainer.update).not.toHaveBeenCalled();
    expect(JSON.stringify(db.activityLog.create.mock.calls)).not.toContain("téléphone");
  });

  it("🔴 refus sans motif : refusé côté serveur, rien n'est écrit (CHECK `traitement_coherent`)", async () => {
    for (const motif of ["", "   "]) {
      const r = await refuserDemandeChangement({
        demandeId: DEMANDE,
        adminId: ADMIN,
        motif,
        maintenant: MAINTENANT,
      });
      expect(r).toEqual({ ok: false, raison: "motif" });
    }
    expect(db.demandeChangementFormateur.updateMany).not.toHaveBeenCalled();
    expect(db.activityLog.create).not.toHaveBeenCalled();
  });

  it("interrupteur coupé : ni validation ni refus", async () => {
    allume.mockResolvedValue(false);
    expect(
      await validerDemandeChangement({
        demandeId: DEMANDE,
        adminId: ADMIN,
        maintenant: MAINTENANT,
      }),
    ).toEqual({ ok: false, raison: "coupe" });
    expect(db.demandeChangementFormateur.findUnique).not.toHaveBeenCalled();
  });
});

describe("M12 — demandes en cours, lues par « Mon dossier »", () => {
  it("🔴 salarié, fiche inactive ou close : `null` (la page n'affiche aucun formulaire)", async () => {
    for (const over of [
      { statut: "salarie" },
      { actif: false },
      { finCollaborationAt: new Date() },
    ]) {
      db.trainer.findUnique.mockResolvedValueOnce(fiche(over));
      expect(await lireDemandesEnCours(ID)).toBeNull();
    }
    expect(db.demandeChangementFormateur.findMany).not.toHaveBeenCalled();
  });

  it("indépendant actif : la liste des demandes en attente", async () => {
    const d = { nature: "iban", createdAt: MAINTENANT };
    db.demandeChangementFormateur.findMany.mockResolvedValue([d]);
    expect(await lireDemandesEnCours(ID)).toEqual([d]);
  });

  it("interrupteur coupé : `null`, rien n'est lu", async () => {
    allume.mockResolvedValue(false);
    expect(await lireDemandesEnCours(ID)).toBeNull();
    expect(db.trainer.findUnique).not.toHaveBeenCalled();
  });
});
