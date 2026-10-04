/**
 * Lot OPCO A8 — réponses de l'entreprise par jeton. Témoins :
 *   · GET (lecture du jeton) n'écrit JAMAIS ;
 *   · jeton expiré, inconnu, mal formé ou déjà utilisé → neutre, sans fuite ;
 *   · « oui » pose `depotFaitLe` au jour de Paris, sans écraser une date saisie ;
 *   · « accord » passe par la transition légale (`enregistrerAccordEcrit`) ;
 *   · « refus » transitionne vers `refuse` et pose le refus (fin des relances) ;
 *   · interrupteur coupé → neutre.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hacherToken } from "@/server/qualiopi/tokens/hacher-token";

const db = vi.hoisted(() => ({
  opcoSuiviMessage: { findUnique: vi.fn(), updateMany: vi.fn() },
  opcoSuiviEntreprise: { update: vi.fn() },
  dossierFinancement: { findUniqueOrThrow: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  activityLog: { create: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

const f = vi.hoisted(() => ({
  depot: vi.fn(),
  accord: vi.fn(),
  transition: vi.fn(),
}));
vi.mock("../dossier-financement", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../dossier-financement")>()),
  enregistrerDepotDossier: (...a: unknown[]) => f.depot(...a),
  enregistrerAccordEcrit: (...a: unknown[]) => f.accord(...a),
  transitionnerDossier: (...a: unknown[]) => f.transition(...a),
}));
vi.mock("@/lib/r2-storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/r2-storage")>()),
  isR2Configured: () => true,
  uploadToR2: vi.fn(async (key: string) => ({ key, etag: null, sizeBytes: 1 })),
}));

import { enregistrerReponse, lireJeton } from "./reponse";

const JETON = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCde";
const NOW = new Date("2026-10-06T08:00:00.000Z"); // mardi 6 octobre, 10:00 Paris

function message(
  p: { question?: string; reponse?: string | null; expire?: Date; depot?: Date | null } = {},
) {
  return {
    id: "m1",
    question: p.question ?? "depot",
    reponse: p.reponse ?? null,
    jetonExpireLe: p.expire ?? new Date("2026-11-01T00:00:00.000Z"),
    suivi: {
      id: "s1",
      zipKey: "opco-suivi/d1/1.zip",
      zipNom: "dossier.zip",
      dossier: {
        id: "d1",
        depotFaitLe: p.depot ?? null,
        client: { opco: "atlas", opcoIdentifie: null },
        trainingSession: { titreSession: "IA au quotidien", client: null },
      },
    },
  };
}

const ECRITURES = [
  () => db.opcoSuiviMessage.updateMany,
  () => db.opcoSuiviEntreprise.update,
  () => db.dossierFinancement.update,
  () => db.activityLog.create,
  () => f.depot,
  () => f.accord,
  () => f.transition,
];

beforeEach(() => {
  vi.stubEnv("OPCO_SUIVI_ENTREPRISE_ENABLED", "true");
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/test");
  for (const groupe of Object.values(db)) for (const fn of Object.values(groupe)) fn.mockReset();
  for (const fn of Object.values(f)) fn.mockReset();
  db.opcoSuiviMessage.findUnique.mockResolvedValue(message());
  db.opcoSuiviMessage.updateMany.mockResolvedValue({ count: 1 });
  db.dossierFinancement.findUniqueOrThrow.mockResolvedValue({
    statut: "a_monter",
    depotFaitLe: null,
  });
  db.activityLog.create.mockResolvedValue({});
  f.depot.mockResolvedValue({ trainingSessionId: "t1" });
  f.accord.mockResolvedValue({ trainingSessionId: "t1", transitions: ["accord_recu"] });
  f.transition.mockResolvedValue({ statut: "refuse" });
});
afterEach(() => vi.unstubAllEnvs());

describe("lecture du jeton (GET)", () => {
  it("🔴 n'écrit jamais rien, et cherche par l'EMPREINTE", async () => {
    const lu = await lireJeton(JETON, "reponse", NOW);
    expect(lu).toMatchObject({ etat: "valide", question: "depot", nomOpco: "Atlas" });
    expect(db.opcoSuiviMessage.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { jetonHash: hacherToken(JETON) } }),
    );
    for (const e of ECRITURES) expect(e()).not.toHaveBeenCalled();
  });

  it("🔴 expiré, inconnu, mal formé, déjà utilisé → neutre", async () => {
    db.opcoSuiviMessage.findUnique.mockResolvedValueOnce(
      message({ expire: new Date("2026-10-01") }),
    );
    expect(await lireJeton(JETON, "reponse", NOW)).toEqual({ etat: "neutre" });
    db.opcoSuiviMessage.findUnique.mockResolvedValueOnce(null);
    expect(await lireJeton(JETON, "reponse", NOW)).toEqual({ etat: "neutre" });
    expect(await lireJeton("court", "reponse", NOW)).toEqual({ etat: "neutre" });
    db.opcoSuiviMessage.findUnique.mockResolvedValueOnce(message({ reponse: "pas_encore" }));
    expect(await lireJeton(JETON, "reponse", NOW)).toEqual({ etat: "neutre" });
  });

  it("un jeton déjà utilisé permet encore de TÉLÉCHARGER (aucune écriture)", async () => {
    db.opcoSuiviMessage.findUnique.mockResolvedValueOnce(message({ reponse: "pas_encore" }));
    expect(await lireJeton(JETON, "telechargement", NOW)).toMatchObject({ etat: "valide" });
  });

  it("🔴 interrupteur coupé → neutre, sans même lire la base", async () => {
    vi.stubEnv("OPCO_SUIVI_ENTREPRISE_ENABLED", "false");
    expect(await lireJeton(JETON, "reponse", NOW)).toEqual({ etat: "neutre" });
    expect(db.opcoSuiviMessage.findUnique).not.toHaveBeenCalled();
  });
});

describe("réponse (POST)", () => {
  it("🔴 « oui » pose le dépôt au jour de Paris", async () => {
    const r = await enregistrerReponse({ jeton: JETON, reponse: "oui" }, NOW);
    expect(r).toMatchObject({ issue: "enregistree", reponse: "oui" });
    expect(f.depot).toHaveBeenCalledWith({
      dossierId: "d1",
      depotFaitLe: new Date("2026-10-06T00:00:00.000Z"),
    });
  });

  it("🔴 une date de dépôt déjà saisie par l'admin n'est JAMAIS écrasée", async () => {
    db.dossierFinancement.findUniqueOrThrow.mockResolvedValue({
      statut: "a_monter",
      depotFaitLe: new Date("2026-10-02T00:00:00.000Z"),
    });
    await enregistrerReponse({ jeton: JETON, reponse: "oui" }, NOW);
    expect(f.depot).not.toHaveBeenCalled();
  });

  it("🔴 jeton réutilisé (course perdue) → neutre, aucun effet", async () => {
    db.opcoSuiviMessage.updateMany.mockResolvedValue({ count: 0 });
    expect(await enregistrerReponse({ jeton: JETON, reponse: "oui" }, NOW)).toEqual({
      issue: "neutre",
    });
    expect(f.depot).not.toHaveBeenCalled();
  });

  it("une réponse qui n'appartient pas à la question → neutre", async () => {
    expect(await enregistrerReponse({ jeton: JETON, reponse: "accord" }, NOW)).toEqual({
      issue: "neutre",
    });
    expect(db.opcoSuiviMessage.updateMany).not.toHaveBeenCalled();
  });

  it("🔴 « accord reçu » passe par la transition légale, sans montant", async () => {
    db.opcoSuiviMessage.findUnique.mockResolvedValue(message({ question: "reponse" }));
    db.dossierFinancement.findUniqueOrThrow.mockResolvedValue({
      statut: "envoye",
      depotFaitLe: new Date("2026-09-20T00:00:00.000Z"),
    });
    const r = await enregistrerReponse(
      { jeton: JETON, reponse: "accord", dateAccord: "2026-10-05" },
      NOW,
    );
    expect(r).toMatchObject({ issue: "enregistree", reponse: "accord", fichier: "aucun" });
    expect(f.accord).toHaveBeenCalledWith({
      dossierId: "d1",
      accordEcritLe: new Date("2026-10-05T00:00:00.000Z"),
    });
    expect(JSON.stringify(f.accord.mock.calls)).not.toMatch(/montant/i);
  });

  it.each([
    ["accord_recu", new Date("2026-10-13T00:00:00.000Z"), null],
    ["facture", new Date("2026-10-13T00:00:00.000Z"), null],
    ["envoye", null, new Date("2026-10-13T10:00:00.000Z")],
  ])(
    "🔴 un accord déjà acté (%s) n'est JAMAIS réécrit par un ancien lien « Accord reçu »",
    async (statut, accordEcritLe, accordAt) => {
      db.opcoSuiviMessage.findUnique.mockResolvedValue(message({ question: "reponse" }));
      db.dossierFinancement.findUniqueOrThrow.mockResolvedValue({
        statut,
        depotFaitLe: new Date("2026-10-01T00:00:00.000Z"),
        accordEcritLe,
        accordAt,
      });
      const r = await enregistrerReponse(
        { jeton: JETON, reponse: "accord", dateAccord: "2026-10-05" },
        NOW,
      );
      expect(r).toMatchObject({ issue: "enregistree", reponse: "accord" });
      expect(f.accord).not.toHaveBeenCalled();
    },
  );

  it("accord : date dans le futur refusée, rien n'est consommé", async () => {
    db.opcoSuiviMessage.findUnique.mockResolvedValue(message({ question: "reponse" }));
    const r = await enregistrerReponse(
      { jeton: JETON, reponse: "accord", dateAccord: "2026-10-30" },
      NOW,
    );
    expect(r.issue).toBe("invalide");
    expect(db.opcoSuiviMessage.updateMany).not.toHaveBeenCalled();
  });

  it("accord : PDF analysé « sain » → conservé ; infecté → refusé", async () => {
    db.opcoSuiviMessage.findUnique.mockResolvedValue(message({ question: "reponse" }));
    const pdf = new Uint8Array(Buffer.from("%PDF-1.7 accord"));
    const sain = await enregistrerReponse(
      { jeton: JETON, reponse: "accord", dateAccord: "2026-10-05", fichier: pdf },
      NOW,
      async () => ({ issue: "sain" }),
    );
    expect(sain).toMatchObject({ fichier: "conserve" });
    expect(db.opcoSuiviEntreprise.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { accordFichierKey: "opco-suivi/d1/accord-m1.pdf" },
    });
    const infecte = await enregistrerReponse(
      { jeton: JETON, reponse: "accord", dateAccord: "2026-10-05", fichier: pdf },
      NOW,
      async () => ({ issue: "infecte", signature: "Eicar" }),
    );
    expect(infecte).toMatchObject({ fichier: "infecte" });
    const pasPdf = await enregistrerReponse(
      {
        jeton: JETON,
        reponse: "accord",
        dateAccord: "2026-10-05",
        fichier: new Uint8Array([1, 2]),
      },
      NOW,
      async () => ({ issue: "sain" }),
    );
    expect(pasPdf).toMatchObject({ fichier: "refuse_format" });
  });

  it("🔴 « refus » : transition légale vers `refuse` et fin des relances", async () => {
    db.opcoSuiviMessage.findUnique.mockResolvedValue(message({ question: "reponse" }));
    db.dossierFinancement.findUniqueOrThrow.mockResolvedValue({
      statut: "envoye",
      depotFaitLe: new Date("2026-09-20T00:00:00.000Z"),
    });
    await enregistrerReponse({ jeton: JETON, reponse: "refus" }, NOW);
    expect(f.transition).toHaveBeenCalledWith({ dossierId: "d1", vers: "refuse" });
    expect(db.opcoSuiviEntreprise.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { refusDeclareLe: NOW },
    });
    expect(db.dossierFinancement.update).not.toHaveBeenCalled();
  });

  it("refus sans transition légale (dossier facturé…) : une note sur le dossier", async () => {
    db.opcoSuiviMessage.findUnique.mockResolvedValue(message({ question: "reponse" }));
    db.dossierFinancement.findUniqueOrThrow.mockResolvedValue({
      statut: "facture",
      depotFaitLe: new Date("2026-09-20T00:00:00.000Z"),
    });
    db.dossierFinancement.findUnique.mockResolvedValue({ notes: null });
    await enregistrerReponse({ jeton: JETON, reponse: "refus" }, NOW);
    expect(f.transition).not.toHaveBeenCalled();
    expect(db.dossierFinancement.update).toHaveBeenCalledWith({
      where: { id: "d1" },
      data: { notes: expect.stringContaining("Refus de l'OPCO déclaré par l'entreprise") },
    });
  });

  it("« pas encore » : noté, rien d'autre", async () => {
    await enregistrerReponse({ jeton: JETON, reponse: "pas_encore" }, NOW);
    expect(db.opcoSuiviMessage.updateMany).toHaveBeenCalled();
    expect(f.depot).not.toHaveBeenCalled();
    expect(f.transition).not.toHaveBeenCalled();
  });
});
