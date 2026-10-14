// @vitest-environment node

/**
 * Lot 8B — décision du dirigeant (a) : le certificat de réalisation se CRÉE seul à la
 * fin de la formation, pour chaque stagiaire concerné, comme le ferait le clic de la
 * console (même service, mêmes gardes). Derrière `formateurs.certificat_realisation_auto`,
 * éteint par défaut ; jamais en double ; jamais pour une session annulée ou reportée ;
 * jamais rétroactif (sessions finies le jour de l'allumage ou après). Rien n'est ENVOYÉ.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const reglage = vi.fn();
const inscriptions = vi.fn();
const pieces = vi.fn();
const journal = vi.fn();
const produire = vi.fn();
const entreTemps = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: { findUnique: (...a: unknown[]) => reglage(...a) },
    enrollment: { findMany: (...a: unknown[]) => inscriptions(...a) },
    documentGenere: {
      findMany: (...a: unknown[]) => pieces(...a),
      findFirst: (...a: unknown[]) => entreTemps(...a),
    },
    activityLog: { create: (...a: unknown[]) => journal(...a) },
  },
}));
vi.mock("@/server/qualiopi/documents/production/producteurs", () => ({
  produireCertificatRealisation: (...a: unknown[]) => produire(...a),
}));

import {
  ACTION_CERTIFICAT_AUTO,
  CERTIFICATS_AUTO_PAR_PASSAGE,
  CLE_CERTIFICAT_AUTO,
  emettreCertificatsFinDeFormation,
} from "../certificat-auto";

const E1 = "11111111-1111-4111-8111-111111111111";
const E2 = "22222222-2222-4222-8222-222222222222";
const S = "55555555-5555-4555-8555-555555555555";
const T1 = "66666666-6666-4666-8666-666666666666";
const T2 = "77777777-7777-4777-8777-777777777777";
const MAINTENANT = new Date("2026-11-20T09:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env["DATABASE_URL"];
  // Allumé le 10/11/2026 à 15 h (Paris).
  reglage.mockResolvedValue({
    value: { actif: true, allumeLe: "2026-11-10T14:00:00.000Z" },
    updatedAt: new Date("2026-11-10T14:00:00Z"),
  });
  inscriptions.mockResolvedValue([
    { id: E1, traineeId: T1, sessionId: S },
    { id: E2, traineeId: T2, sessionId: S },
  ]);
  pieces.mockResolvedValue([]);
  entreTemps.mockResolvedValue(null);
  journal.mockResolvedValue({});
  produire.mockResolvedValue({
    ok: true,
    documentId: "doc",
    numero: "AXI-CERT-2026-001",
    details: { dureeHeures: 7, sessionId: S },
  });
});

describe("certificat de réalisation créé à la fin de la formation", () => {
  it("interrupteur éteint (absent, ou `actif: false`) : rien n'est lu ni créé", async () => {
    reglage.mockResolvedValue(null);
    expect((await emettreCertificatsFinDeFormation(MAINTENANT)).etat).toBe("coupe");
    reglage.mockResolvedValue({ value: { actif: false }, updatedAt: new Date() });
    expect((await emettreCertificatsFinDeFormation(MAINTENANT)).etat).toBe("coupe");
    expect(reglage.mock.calls[0]![0].where).toEqual({ key: CLE_CERTIFICAT_AUTO });
    expect(inscriptions).not.toHaveBeenCalled();
    expect(produire).not.toHaveBeenCalled();
  });

  it("allumé : un certificat par stagiaire actif d'une session RÉALISÉE finie depuis l'allumage", async () => {
    const b = await emettreCertificatsFinDeFormation(MAINTENANT);
    expect(b).toMatchObject({ etat: "fait", crees: 2, refuses: 0, dejaPresents: 0 });
    const where = inscriptions.mock.calls[0]![0].where;
    // Annulée ou reportée : jamais (seul `realisee` est lu).
    expect(where.session.statut).toBe("realisee");
    // Jamais rétroactif : fin le jour de l'allumage (00:00 Paris = 23:00 UTC la veille) ou après.
    expect(where.session.dateFin.gte).toEqual(new Date("2026-11-09T23:00:00Z"));
    // À partir de J+2 seulement : le taux de présence doit être définitif.
    expect(where.session.dateFin.lte).toEqual(new Date("2026-11-18T09:00:00Z"));
    // Les sessions les plus récentes d'abord, sans limite posée sur la requête.
    expect(inscriptions.mock.calls[0]![0].orderBy).toEqual({ session: { dateFin: "desc" } });
    expect(inscriptions.mock.calls[0]![0].take).toBeUndefined();
    // Abandon et exclu : aucun certificat (R.6313-3), comme le clic.
    expect(where.statut).toEqual({ notIn: ["abandon", "exclu"] });
    // Le MÊME service que le clic de la console, marqué automatique.
    expect(produire).toHaveBeenCalledWith(E1, {
      metadata: { genereAutomatiquement: true, origine: "fin_de_formation" },
    });
  });

  it("borne basse : 90 jours au plus après la fin (un refus ne se retente pas indéfiniment)", async () => {
    reglage.mockResolvedValue({
      value: { actif: true, allumeLe: "2026-01-01T10:00:00.000Z" },
      updatedAt: null,
    });
    await emettreCertificatsFinDeFormation(MAINTENANT);
    expect(inscriptions.mock.calls[0]![0].where.session.dateFin.gte).toEqual(
      new Date("2026-08-22T09:00:00Z"),
    );
  });

  it("jamais en double : un certificat existant (même annulé ou copie) n'est pas recréé", async () => {
    pieces.mockResolvedValue([{ sessionId: S, traineeId: T1 }]);
    const b = await emettreCertificatsFinDeFormation(MAINTENANT);
    expect(b).toMatchObject({ crees: 1, dejaPresents: 1 });
    expect(produire).toHaveBeenCalledTimes(1);
    expect(produire.mock.calls[0]![0]).toBe(E2);
    // Aucun filtre d'état sur la pièce : tout certificat compte.
    expect(pieces.mock.calls[0]![0].where).toEqual({
      type: "certificat_realisation",
      sessionId: { in: [S] },
      traineeId: { in: [T1, T2] },
    });
  });

  it("relecture : un clic en console PENDANT le passage n'obtient pas de seconde pièce", async () => {
    entreTemps.mockResolvedValueOnce({ id: "clic" });
    const b = await emettreCertificatsFinDeFormation(MAINTENANT);
    expect(b).toMatchObject({ crees: 1, dejaPresents: 1 });
    expect(produire).toHaveBeenCalledTimes(1);
    expect(produire.mock.calls[0]![0]).toBe(E2);
  });

  it("au-delà de la limite du passage : les pièces déjà faites n'occupent pas les places", async () => {
    const n = CERTIFICATS_AUTO_PAR_PASSAGE + 5;
    inscriptions.mockResolvedValue(
      Array.from({ length: n + 3 }, (_, i) => ({
        id: `e${i}`,
        traineeId: `t${i}`,
        sessionId: S,
      })),
    );
    // Les trois premières (les plus récentes) ont déjà leur certificat.
    pieces.mockResolvedValue([0, 1, 2].map((i) => ({ sessionId: S, traineeId: `t${i}` })));
    const b = await emettreCertificatsFinDeFormation(MAINTENANT);
    expect(b).toMatchObject({ crees: CERTIFICATS_AUTO_PAR_PASSAGE, dejaPresents: 3 });
    expect(produire.mock.calls[0]![0]).toBe("e3");
  });

  it("rejeu le lendemain : la pièce créée hier suffit, rien n'est recréé", async () => {
    await emettreCertificatsFinDeFormation(MAINTENANT);
    pieces.mockResolvedValue([
      { sessionId: S, traineeId: T1 },
      { sessionId: S, traineeId: T2 },
    ]);
    await emettreCertificatsFinDeFormation(new Date("2026-11-21T09:00:00Z"));
    expect(produire).toHaveBeenCalledTimes(2);
  });

  it("chaque création est inscrite au journal (identifiants seuls, aucun nom)", async () => {
    await emettreCertificatsFinDeFormation(MAINTENANT);
    const ecrite = journal.mock.calls[0]![0].data;
    expect(ecrite).toMatchObject({
      action: ACTION_CERTIFICAT_AUTO,
      targetType: "Enrollment",
      targetId: E1,
      adminUserId: null,
    });
    expect(ecrite.changes).toMatchObject({ numero: "AXI-CERT-2026-001", sessionId: S });
  });

  it("garde refusée (taux non mesuré, aucune trace) : comptée, rien d'écrit ; l'alerte le dira", async () => {
    produire.mockResolvedValueOnce({ ok: false, motif: "Certificat refusé : …" });
    const b = await emettreCertificatsFinDeFormation(MAINTENANT);
    expect(b).toMatchObject({ crees: 1, refuses: 1 });
    expect(journal).toHaveBeenCalledTimes(1);
  });

  it("une erreur sur un stagiaire n'arrête pas les autres ; la lecture en échec ne lève pas", async () => {
    produire.mockRejectedValueOnce(new Error("pdf"));
    expect(await emettreCertificatsFinDeFormation(MAINTENANT)).toMatchObject({
      crees: 1,
      erreurs: 1,
    });
    inscriptions.mockRejectedValue(new Error("base"));
    expect((await emettreCertificatsFinDeFormation(MAINTENANT)).etat).toBe("echec");
  });

  it("build (stub.invalid) : rien", async () => {
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    expect((await emettreCertificatsFinDeFormation(MAINTENANT)).etat).toBe("coupe");
    expect(reglage).not.toHaveBeenCalled();
  });

  it("n'ENVOIE rien : aucun e-mail, aucune notification (la remise reste un geste humain)", () => {
    const source = readFileSync(join(__dirname, "..", "certificat-auto.ts"), "utf8");
    expect(source).not.toMatch(/enqueueEmail|envoyer\(|notifier|sendTelegram|email/i);
  });
});
