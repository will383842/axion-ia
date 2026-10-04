/**
 * Lot OPCO A8 — envoi du dossier à l'entreprise. Témoins :
 *   · envoi automatique UNIQUE (un dossier qui a déjà un suivi ne repart pas) ;
 *   · interrupteur coupé → rien ne part, rien ne s'écrit ;
 *   · convention non signée → rien ne part ;
 *   · le dossier part en LIEN (jamais en pièce jointe) ;
 *   · file indisponible → le message ET le suivi sont retirés (réessai possible).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  dossierFinancement: { findUnique: vi.fn() },
  documentGenere: { findUnique: vi.fn(), findFirst: vi.fn() },
  opcoSuiviEntreprise: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  opcoSuiviMessage: { create: vi.fn(), delete: vi.fn() },
  activityLog: { create: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

const m = vi.hoisted(() => ({
  enqueue: vi.fn(),
  kit: vi.fn(),
  pret: vi.fn(),
  zip: vi.fn(),
  upload: vi.fn(),
}));
// ⚠️ Deux mocks ÉTROITS, assumés : leurs modules réels tirent `next-auth`, qui ne
// se charge pas sous Vitest (pas d'`importOriginal` possible). `envoi.ts`
// n'en importe que ces deux fonctions.
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => m.enqueue(...a),
}));
vi.mock("@/server/qualiopi/documents/production/producteurs", () => ({
  produireKitOpco: (...a: unknown[]) => m.kit(...a),
}));
vi.mock("@/server/qualiopi/sessions/verrou-dossier-garde", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/qualiopi/sessions/verrou-dossier-garde")>()),
  assertDossierOuvertSiRegeneration: async () => ({ ok: true, sessionId: "t1" }),
}));
vi.mock("../dossier-pret-a-deposer-lecture", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../dossier-pret-a-deposer-lecture")>()),
  chargerDossierPretADeposer: (...a: unknown[]) => m.pret(...a),
}));
vi.mock("../dossier-pret-a-deposer-zip", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../dossier-pret-a-deposer-zip")>()),
  construireZipPretADeposer: (...a: unknown[]) => m.zip(...a),
}));
vi.mock("@/lib/r2-storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/r2-storage")>()),
  isR2Configured: () => true,
  uploadToR2: (...a: unknown[]) => m.upload(...a),
}));

import { envoyerDossierEntreprise } from "./envoi";

const NOW = new Date("2026-10-06T06:30:00.000Z");
const CLIENT = {
  id: "c1",
  raisonSociale: "ACME",
  contactNom: "Claire Martin",
  contactEmail: "rh@acme.fr",
  contactTelephone: "06 12 34 56 78",
  opco: "atlas",
  opcoIdentifie: null,
};

function dossier(p: Record<string, unknown> = {}) {
  return {
    id: "d1",
    type: "opco",
    statut: "a_monter",
    depotFaitLe: null,
    accordEcritLe: null,
    accordAt: null,
    envoyeAt: null,
    trainingSessionId: "t1",
    client: CLIENT,
    trainingSession: {
      id: "t1",
      numero: "AXI-SESS-2026-042",
      titreSession: "IA au quotidien",
      dateDebut: new Date("2026-11-16T08:00:00.000Z"),
      client: CLIENT,
    },
    suiviEntreprise: null,
    ...p,
  };
}

function pret(conventionPresente = true) {
  return {
    numeroSession: "AXI-SESS-2026-042",
    intituleFormation: "IA au quotidien",
    raisonSociale: "ACME",
    bandeau: null,
    pieces: [{ cle: "convention", libelle: "Convention", presente: conventionPresente }],
    encart: { portailUrl: null },
  };
}

beforeEach(() => {
  vi.stubEnv("OPCO_SUIVI_ENTREPRISE_ENABLED", "true");
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/test");
  for (const groupe of Object.values(db)) for (const fn of Object.values(groupe)) fn.mockReset();
  for (const fn of Object.values(m)) fn.mockReset();
  db.dossierFinancement.findUnique.mockResolvedValue(dossier());
  db.documentGenere.findUnique.mockResolvedValue({ numero: "KIT-1", createdAt: NOW });
  db.opcoSuiviEntreprise.create.mockResolvedValue({ id: "s1" });
  db.opcoSuiviMessage.create.mockResolvedValue({ id: "m1" });
  db.opcoSuiviMessage.delete.mockResolvedValue({});
  db.opcoSuiviEntreprise.delete.mockResolvedValue({});
  db.activityLog.create.mockResolvedValue({});
  m.pret.mockResolvedValue(pret());
  m.kit.mockResolvedValue({ ok: true, documentId: "k1", numero: "KIT-1" });
  m.zip.mockResolvedValue({
    base64: "UEsDBA==",
    filename: "dossier.zip",
    joints: ["KIT-1"],
    manquantes: [],
  });
  m.upload.mockResolvedValue({ key: "x", etag: null, sizeBytes: 4 });
  m.enqueue.mockResolvedValue({ enqueued: true });
});
afterEach(() => vi.unstubAllEnvs());

describe("envoi du dossier à l'entreprise", () => {
  it("dossier prêt : un suivi, un message, un e-mail avec LIEN de téléchargement, sans pièce jointe", async () => {
    const r = await envoyerDossierEntreprise({ dossierId: "d1", mode: "auto", now: NOW });
    expect(r).toEqual({ ok: true, messageId: "m1", garePourValidation: false });
    expect(db.opcoSuiviEntreprise.create).toHaveBeenCalledTimes(1);
    expect(db.opcoSuiviMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ etape: "envoi", rang: 0, question: "depot" }),
      }),
    );
    const [template, to, , payload, options] = m.enqueue.mock.calls[0]!;
    expect(template).toBe("opco-suivi-entreprise");
    expect(to).toBe("rh@acme.fr");
    expect(payload.lienDossier).toMatch(/\/api\/qualiopi\/suivi-opco\/[A-Za-z0-9_-]{43}\/dossier$/);
    expect(payload.liens.oui).toMatch(/\?reponse=oui$/);
    expect(options.attachments).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain("06 12 34 56 78");
  });

  it("🔴 envoi automatique UNIQUE : un dossier qui a déjà un suivi ne repart pas", async () => {
    db.dossierFinancement.findUnique.mockResolvedValue(
      dossier({
        suiviEntreprise: {
          id: "s1",
          envoyeLe: NOW,
          envoiAutomatique: true,
          zipKey: "k",
          zipNom: "z",
          relancesArreteesLe: null,
          refusDeclareLe: null,
          accordFichierKey: null,
          messages: [],
        },
      }),
    );
    const r = await envoyerDossierEntreprise({ dossierId: "d1", mode: "auto", now: NOW });
    expect(r).toMatchObject({ ok: false, motif: "deja_envoye" });
    expect(m.kit).not.toHaveBeenCalled();
    expect(m.enqueue).not.toHaveBeenCalled();
  });

  it("🔴 course entre deux passages : la clé unique du suivi l'emporte, rien ne part deux fois", async () => {
    db.opcoSuiviEntreprise.create.mockRejectedValue(
      Object.assign(new Error("dup"), { code: "P2002" }),
    );
    const r = await envoyerDossierEntreprise({ dossierId: "d1", mode: "auto", now: NOW });
    expect(r).toMatchObject({ ok: false, motif: "deja_envoye" });
    expect(m.enqueue).not.toHaveBeenCalled();
  });

  it("🔴 interrupteur coupé → rien ne part, rien ne s'écrit", async () => {
    vi.stubEnv("OPCO_SUIVI_ENTREPRISE_ENABLED", "false");
    const r = await envoyerDossierEntreprise({ dossierId: "d1", mode: "manuel", now: NOW });
    expect(r).toMatchObject({ ok: false, motif: "drapeau" });
    expect(db.dossierFinancement.findUnique).not.toHaveBeenCalled();
    expect(m.enqueue).not.toHaveBeenCalled();
  });

  it("convention non signée → rien ne part", async () => {
    m.pret.mockResolvedValue(pret(false));
    const r = await envoyerDossierEntreprise({ dossierId: "d1", mode: "auto", now: NOW });
    expect(r).toMatchObject({ ok: false, motif: "convention" });
    expect(m.enqueue).not.toHaveBeenCalled();
  });

  it("file indisponible → message et suivi retirés, le passage suivant réessaiera", async () => {
    m.enqueue.mockResolvedValue({ enqueued: false });
    const r = await envoyerDossierEntreprise({ dossierId: "d1", mode: "auto", now: NOW });
    expect(r).toMatchObject({ ok: false, motif: "file" });
    expect(db.opcoSuiviMessage.delete).toHaveBeenCalledWith({ where: { id: "m1" } });
    expect(db.opcoSuiviEntreprise.delete).toHaveBeenCalledWith({ where: { id: "s1" } });
  });

  it("e-mail garé en validation : compté comme parti (il attend la relecture)", async () => {
    m.enqueue.mockResolvedValue({ enqueued: false, garePourValidation: true, outboxId: "o1" });
    const r = await envoyerDossierEntreprise({ dossierId: "d1", mode: "manuel", now: NOW });
    expect(r).toEqual({ ok: true, messageId: "m1", garePourValidation: true });
    expect(db.opcoSuiviMessage.delete).not.toHaveBeenCalled();
  });
});
