/**
 * Canal de changement de compte bancaire — le RIB du nouveau compte (préalable de
 * `passage_paiement`, plan §8.10 n° 12).
 *
 * Depuis l'espace, une demande d'IBAN se fait AVEC le RIB du nouveau compte, déposé
 * comme pièce (contrôle commun, antivirus, chiffrement au repos, pièce EN ATTENTE de
 * vérification humaine). La console ne valide un nouvel IBAN que si un RIB récent,
 * non rejeté, est au dossier. Le reste du circuit (F43, 48 h, C-1, V1-C-7) est inchangé.
 *
 * Valeurs fictives uniquement.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env["IBAN_EMPREINTE_SECRET"] = "secret-empreinte-de-test";
});

const db = vi.hoisted(() => {
  const d = {
    trainer: { findUnique: vi.fn(), update: vi.fn() },
    trainerDocument: { findFirst: vi.fn(), findMany: vi.fn() },
    demandeChangementFormateur: {
      create: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    activityLog: { create: vi.fn() },
    formateurMagicLink: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  };
  d.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(d));
  return d;
});
const allume = vi.hoisted(() => vi.fn());
const envoyer = vi.hoisted(() => vi.fn());
const notify = vi.hoisted(() => vi.fn());
const deposer = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteur-allume", () => ({
  interrupteurAllume: allume,
}));
vi.mock("@/server/qualiopi/formateurs-independants/envois", () => ({ envoyer }));
vi.mock("@/server/qualiopi/formateurs-independants/depot", () => ({
  deposerPieceFormateur: deposer,
}));
vi.mock("@/server/notifications", () => ({ notify }));
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
  FENETRE_RIB_AVANT_DEMANDE_MS,
  MESSAGES_CHANGEMENT,
  demanderChangementIbanAvecRib,
  lireDemandesAValider,
  validerDemandeChangement,
} from "@/server/qualiopi/formateurs-independants/changements-coordonnees";

const ID = "3f2a9c1e-0b7d-4c55-9e21-6a8f0d4b7c13";
const ADMIN = "22222222-2222-4222-8222-222222222222";
const DEMANDE = "9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d";
/** IBAN de test publié par la Banque de France (fictif). */
const IBAN = "FR7630006000011234567890189";
const MAINTENANT = new Date("2026-10-12T10:00:00Z");
const RIB = { nomFichier: "rib.pdf", octets: new Uint8Array([0x25, 0x50, 0x44, 0x46]) };

const fiche = (over: Record<string, unknown> = {}) => ({
  id: ID,
  statut: "sous_traitant",
  actif: true,
  finCollaborationAt: null,
  prenom: "Camille",
  email: "camille@example.test",
  ibanEmpreinte: "ancienne-empreinte",
  emailRemplace: null,
  emailRemplaceAt: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  allume.mockResolvedValue(true);
  envoyer.mockResolvedValue("envoye");
  notify.mockResolvedValue({ ok: true });
  deposer.mockResolvedValue({ ok: true, documentId: "doc-rib" });
  db.trainer.findUnique.mockResolvedValue(fiche());
  db.demandeChangementFormateur.findFirst.mockResolvedValue(null);
  db.demandeChangementFormateur.create.mockResolvedValue({});
  db.demandeChangementFormateur.updateMany.mockResolvedValue({ count: 1 });
  db.activityLog.create.mockResolvedValue({});
  db.trainer.update.mockResolvedValue({});
  db.formateurMagicLink.updateMany.mockResolvedValue({ count: 0 });
});

describe("demande depuis l'espace : IBAN + RIB", () => {
  it("interrupteur coupé : rien n'est lu, rien n'est déposé", async () => {
    allume.mockResolvedValue(false);
    const r = await demanderChangementIbanAvecRib(ID, IBAN, RIB, MAINTENANT);
    expect(r).toEqual({ ok: false, message: MESSAGES_CHANGEMENT.indisponible });
    expect(db.trainer.findUnique).not.toHaveBeenCalled();
    expect(deposer).not.toHaveBeenCalled();
  });

  it("sans RIB (absent ou vide) : refusé, rien n'est déposé ni demandé", async () => {
    for (const rib of [null, { nomFichier: "rib.pdf", octets: new Uint8Array() }]) {
      const r = await demanderChangementIbanAvecRib(ID, IBAN, rib, MAINTENANT);
      expect(r).toEqual({ ok: false, message: MESSAGES_CHANGEMENT.ribManquant });
    }
    expect(deposer).not.toHaveBeenCalled();
    expect(db.demandeChangementFormateur.create).not.toHaveBeenCalled();
  });

  it("IBAN invalide : le RIB n'est pas déposé pour rien", async () => {
    const r = await demanderChangementIbanAvecRib(ID, "FR76 1234", RIB, MAINTENANT);
    expect(r).toEqual({ ok: false, message: MESSAGES_CHANGEMENT.ibanInvalide });
    expect(deposer).not.toHaveBeenCalled();
  });

  it("même compte que celui enregistré : refusé, rien n'est déposé", async () => {
    const { empreinteIban } = await import("@/lib/iban-empreinte");
    db.trainer.findUnique.mockResolvedValue(fiche({ ibanEmpreinte: empreinteIban(IBAN) }));
    const r = await demanderChangementIbanAvecRib(ID, IBAN, RIB, MAINTENANT);
    expect(r).toEqual({ ok: false, message: MESSAGES_CHANGEMENT.identique });
    expect(deposer).not.toHaveBeenCalled();
  });

  it("une demande d'IBAN déjà en cours : refusé, rien n'est déposé", async () => {
    db.demandeChangementFormateur.findFirst.mockResolvedValue({ id: DEMANDE });
    const r = await demanderChangementIbanAvecRib(ID, IBAN, RIB, MAINTENANT);
    expect(r).toEqual({ ok: false, message: MESSAGES_CHANGEMENT.dejaEnCours });
    expect(deposer).not.toHaveBeenCalled();
  });

  it("salarié, fiche inactive ou close : refusé, rien n'est déposé", async () => {
    for (const over of [
      { statut: "salarie" },
      { actif: false },
      { finCollaborationAt: new Date() },
    ]) {
      db.trainer.findUnique.mockResolvedValueOnce(fiche(over));
      const r = await demanderChangementIbanAvecRib(ID, IBAN, RIB, MAINTENANT);
      expect(r.ok).toBe(false);
    }
    expect(deposer).not.toHaveBeenCalled();
  });

  it("le dépôt du RIB échoue (antivirus, format…) : son message, AUCUNE demande", async () => {
    deposer.mockResolvedValue({ ok: false, message: "Ce format de fichier n'est pas accepté." });
    const r = await demanderChangementIbanAvecRib(ID, IBAN, RIB, MAINTENANT);
    expect(r).toEqual({ ok: false, message: "Ce format de fichier n'est pas accepté." });
    expect(db.demandeChangementFormateur.create).not.toHaveBeenCalled();
    expect(envoyer).not.toHaveBeenCalled();
  });

  it("tout va : RIB déposé sur la fiche de la SESSION, puis la demande du circuit (F43, journal)", async () => {
    const r = await demanderChangementIbanAvecRib(ID, IBAN, RIB, MAINTENANT);
    expect(r).toEqual({ ok: true });
    expect(deposer).toHaveBeenCalledWith({
      trainerId: ID,
      type: "rib",
      nomFichier: "rib.pdf",
      octets: RIB.octets,
    });
    const data = db.demandeChangementFormateur.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({ trainerId: ID, nature: "iban" });
    expect(envoyer).toHaveBeenCalledWith(
      expect.objectContaining({ gabarit: "formateur-iban-changement" }),
    );
    // Le dépôt précède la demande : une demande n'existe jamais sans son RIB.
    expect(deposer.mock.invocationCallOrder[0]!).toBeLessThan(
      db.demandeChangementFormateur.create.mock.invocationCallOrder[0]!,
    );
    const tout = JSON.stringify([
      db.activityLog.create.mock.calls,
      notify.mock.calls,
      envoyer.mock.calls,
      deposer.mock.calls,
    ]);
    expect(tout).not.toMatch(/FR76|30006000|7890189/i);
  });
});

describe("validation en console : un RIB récent est exigé pour un IBAN", () => {
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
  const valider = () =>
    validerDemandeChangement({ demandeId: DEMANDE, adminId: ADMIN, maintenant: MAINTENANT });

  it("aucun RIB récent non rejeté : refusée (rib_absent), rien n'est écrit", async () => {
    db.demandeChangementFormateur.findUnique.mockResolvedValue(demande());
    db.trainerDocument.findFirst.mockResolvedValue(null);
    expect(await valider()).toEqual({ ok: false, raison: "rib_absent" });
    expect(db.demandeChangementFormateur.updateMany).not.toHaveBeenCalled();
    expect(db.trainer.update).not.toHaveBeenCalled();
  });

  it("la recherche du RIB vise la fiche de la demande, actif, non rejeté, déposé autour de la demande", async () => {
    const d = demande();
    db.demandeChangementFormateur.findUnique.mockResolvedValue(d);
    db.trainerDocument.findFirst.mockResolvedValue({ id: "doc-rib", createdAt: d.createdAt });
    expect(await valider()).toEqual({ ok: true });
    expect(db.trainerDocument.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          trainerId: ID,
          type: "rib",
          archiveAt: null,
          statutValidation: { not: "rejete" },
          createdAt: { gte: new Date(d.createdAt.getTime() - FENETRE_RIB_AVANT_DEMANDE_MS) },
        },
      }),
    );
  });

  it("une adresse ne demande pas de RIB", async () => {
    db.demandeChangementFormateur.findUnique.mockResolvedValue(
      demande({
        nature: "adresse",
        valeur: "12 rue des Lilas",
        valeurEmpreinte: null,
        ancienneAdresseAviseeAt: null,
      }),
    );
    db.trainerDocument.findFirst.mockResolvedValue(null);
    expect(await valider()).toEqual({ ok: true });
  });
});

describe("console W-7 : le RIB de chaque demande d'IBAN", () => {
  it("rend la date du RIB déposé avec la demande, ou null", async () => {
    const creee = new Date(MAINTENANT.getTime() - 60_000);
    db.demandeChangementFormateur.findMany.mockResolvedValue([
      {
        id: DEMANDE,
        trainerId: ID,
        nature: "iban",
        createdAt: creee,
        valeur: "enc:v2:x",
        trainer: { prenom: "Camille", nom: "Martin" },
      },
      {
        id: "11111111-1111-4111-8111-111111111111",
        trainerId: "44444444-4444-4444-8444-444444444444",
        nature: "iban",
        createdAt: creee,
        valeur: "enc:v2:y",
        trainer: { prenom: "Alex", nom: "Durand" },
      },
    ]);
    db.trainerDocument.findMany.mockResolvedValue([
      { trainerId: ID, createdAt: new Date(creee.getTime() - 1000) },
      // Trop ancien : pas celui de la demande.
      {
        trainerId: "44444444-4444-4444-8444-444444444444",
        createdAt: new Date(creee.getTime() - FENETRE_RIB_AVANT_DEMANDE_MS - 1000),
      },
    ]);
    const l = await lireDemandesAValider(MAINTENANT);
    expect(l[0]!.ribDeposeAt).toEqual(new Date(creee.getTime() - 1000));
    expect(l[1]!.ribDeposeAt).toBeNull();
    // Jamais l'IBAN demandé.
    expect(JSON.stringify(l)).not.toMatch(/enc:v2/);
  });
});
