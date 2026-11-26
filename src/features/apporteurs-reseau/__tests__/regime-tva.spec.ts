import { beforeEach, describe, expect, it, vi } from "vitest";

// CHANGER LE RÉGIME DE TVA d'un apporteur après la signature (contrat 2.8, art. 4.7 et 6.3).
// Décisions de Will (26/11) : changement possible (ex. sortie de la franchise), régime FIGÉ sur chaque
// pièce, commission toujours 500 € HT, jamais TTC ; aucune option « débits ».

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./simulateur-tva")).prisma }));
vi.mock("../annuaire", () => ({
  lireEntrepriseParSiren: vi.fn(async (siren: string) => ({
    ok: true,
    entreprise: { siren, active: true },
  })),
}));
vi.mock("@/server/queue/lib/sentry-worker", () => ({ captureWorkerError: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: unknown) => v }));
vi.mock("@/lib/destinataires-internes", () => ({
  destinataireAlertesInternes: () => "will@interne",
}));
vi.mock("../jeton", () => ({ urlDossier: () => null }));
vi.mock("../envois", async () => {
  const h = await import("./simulateur-tva");
  return {
    envoyer: vi.fn(async (e: Record<string, unknown>) => {
      h.etat.envoyes.push(e);
      if (typeof e["jobId"] === "string") h.etat.jobIds.add(e["jobId"]);
      return "envoye";
    }),
    envoyerConfirmationVirement: vi.fn(async (e: Record<string, unknown>) => {
      h.etat.confirmations.push(e);
      return "envoye";
    }),
  };
});
vi.mock("@/server/queue/queues", async () => {
  const h = await import("./simulateur-tva");
  return {
    enqueueEmail: vi.fn(
      async (
        _g: string,
        _d: string,
        _l: string,
        payload: Record<string, unknown>,
        opts: { jobId: string },
      ) => {
        h.etat.alertes.push({ jobId: opts.jobId, payload });
        h.etat.jobIds.add(opts.jobId);
        return { enqueued: true };
      },
    ),
  };
});
vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: async () => ({ raisonSociale: "Axion IA" }),
}));
vi.mock("@/server/qualiopi/documents/render", () => ({
  renderPdfToBuffer: async () => ({ buffer: Buffer.from("pdf") }),
  storeAndSignPdf: vi.fn(async () => "https://signe"),
}));
vi.mock("@/server/qualiopi/documents/templates/autofacture-honoraires", () => ({
  AutofactureHonorairesPdf: () => null,
}));

import * as h from "./simulateur-tva";
import {
  annulerChangementAVenir,
  basculerRegimesDuJour,
  changerRegimeTva,
  jourDepuisSaisie,
} from "../regime-tva";
import { regimeApplicableAu, oublierPiecesFigeesDisponible } from "../tva-pieces";
import { facturerApporteur, lireVirementsAFaire, marquerVerse } from "../facturation";
import { lignesDas2Apporteurs } from "../commissions";
import { oublierLitigeDisponible } from "../litige";

const { etat, ligne } = h;
const AUJOURDHUI = new Date("2026-11-26T10:00:00Z");
const MARDI = new Date("2026-10-06T09:00:00Z");
const ASSUJETTI = { regimeTva: "assujetti", numeroTva: "FR00123456782" };
const FRANCHISE = { regimeTva: "franchise_293b", numeroTva: null };

const changer = (extra: Partial<Parameters<typeof changerRegimeTva>[0]> = {}) =>
  changerRegimeTva({
    apporteurId: "APP1",
    regimeTva: "franchise_293b",
    effetAu: "26/11/2026",
    acteurId: "ADMIN1",
    maintenant: AUJOURDHUI,
    ...extra,
  });

beforeEach(() => {
  h.remettreAZero();
  oublierPiecesFigeesDisponible();
  oublierLitigeDisponible();
  etat.apporteurs["APP1"] = ASSUJETTI;
});

describe("refus", () => {
  it("date mal écrite ou inexistante", async () => {
    expect((await changer({ effetAu: "2026-12-01" })).ok).toBe(false);
    expect((await changer({ effetAu: "31/02/2026" })).ok).toBe(false);
    expect(jourDepuisSaisie("01/12/2026")).toBe("2026-12-01");
  });
  it("contrat non contresigné ou résilié", async () => {
    etat.apporteurs["APP1"] = { ...ASSUJETTI, signeParSocieteAt: null };
    expect(await changer()).toMatchObject({ ok: false });
    etat.apporteurs["APP1"] = { ...ASSUJETTI, statut: "resilie" };
    expect(await changer()).toMatchObject({ ok: false });
  });
  it("date avant la contresignature, ou à plus de 12 mois", async () => {
    expect(await changer({ effetAu: "01/05/2026" })).toMatchObject({
      ok: false,
      message: expect.stringContaining("contresignature"),
    });
    expect(await changer({ effetAu: "27/11/2027" })).toMatchObject({
      ok: false,
      message: expect.stringContaining("12 mois"),
    });
  });
  it("passage à assujetti sans n° de TVA, ou avec un n° mal formé", async () => {
    etat.apporteurs["APP1"] = FRANCHISE;
    expect(await changer({ regimeTva: "assujetti" })).toMatchObject({ ok: false });
    expect(await changer({ regimeTva: "assujetti", numeroTva: "FR12" })).toMatchObject({
      ok: false,
    });
    expect(etat.changements).toEqual([]);
  });
  it("aucun changement", async () => {
    etat.apporteurs["APP1"] = FRANCHISE;
    expect(await changer()).toMatchObject({ ok: false, message: "Aucun changement." });
  });
  it("table des pièces absente : refus lisible, rien n'est écrit", async () => {
    etat.tables = false;
    expect(await changer()).toMatchObject({
      ok: false,
      message: expect.stringContaining("pas encore en ligne"),
    });
  });
  it("un second changement à venir exige d'annuler le premier", async () => {
    expect((await changer({ effetAu: "01/12/2026" })).ok).toBe(true);
    expect(
      await changer({ effetAu: "01/01/2027", regimeTva: "assujetti", numeroTva: "FR00123456782" }),
    ).toMatchObject({
      ok: false,
      message: expect.stringContaining("annulez-le"),
    });
  });
});

describe("changement au jour même", () => {
  it("2. assujetti → franchise : fiche, n° effacé, historique, journal, e-mail ; pièces d'avant figées « assujetti » d'abord", async () => {
    // Une autofacture émise par un ancien worker, sans pièce figée.
    etat.lignes = [
      ligne("c1", "due", 50_000, {
        autofactureNumero: "AXI-APP-2026-0001",
        autofactureEmiseAt: MARDI,
      }),
    ];
    const r = await changer();
    expect(r).toMatchObject({ ok: true });
    expect(etat.apporteurs["APP1"]).toMatchObject({ regimeTva: "franchise_293b", numeroTva: null });
    expect(etat.changements).toHaveLength(1);
    expect(etat.changements[0]).toMatchObject({
      regimeAvant: "assujetti",
      numeroTvaAvant: "FR00123456782",
      regimeTva: "franchise_293b",
      numeroTva: null,
      saisiPar: "ADMIN1",
    });
    expect(etat.pieces.map((p) => [p.numero, p.regimeTva, p.origine])).toEqual([
      ["AXI-APP-2026-0001", "assujetti", "rattrapage"],
    ]);
    expect(etat.journal.at(-1)).toMatchObject({ action: "apporteur.regime_tva_change" });
    const mail = etat.envoyes.at(-1)!;
    expect(mail["gabarit"]).toBe("apporteur-regime-tva");
    expect(mail["jobId"]).toBe(`apporteur-regime-tva-${etat.changements[0]!.id}`);
    expect(mail["payload"]).toMatchObject({
      regime: "franchise_293b",
      effetAu: "26 novembre 2026",
    });
    expect(JSON.stringify(mail)).not.toMatch(/débits/i);
  });

  it("3. BOUT EN BOUT : autofacture assujettie (600 €), passage en franchise, virement 600 €, DAS2 600 €, la commission suivante SANS TVA", async () => {
    etat.lignes = [ligne("c1", "due", 50_000)];
    await facturerApporteur("APP1", MARDI);
    expect(etat.pieces[0]).toMatchObject({ regimeTva: "assujetti", totalTtcCents: 60_000 });

    expect(await changer()).toMatchObject({ ok: true });

    expect((await lireVirementsAFaire()).map((v) => v.totalCents)).toEqual([60_000]);
    const v = await marquerVerse("APP1", AUJOURDHUI, "AXI-APP-2026-0001");
    expect(v).toMatchObject({ ok: true, totalCents: 60_000 });
    expect((await lignesDas2Apporteurs(2026)).map((l) => l.totalCents)).toEqual([60_000]);

    // La commission suivante : 500 € HT, régime d'aujourd'hui (franchise) : pas de TVA, pas de TTC.
    etat.lignes.push(ligne("c2", "due", 50_000));
    const f = await facturerApporteur("APP1", new Date("2026-11-26T11:00:00Z"));
    expect(f).toMatchObject({ ok: true, totalCents: 50_000 });
    expect(etat.pieces.at(-1)).toMatchObject({
      regimeTva: "franchise_293b",
      numeroTva: null,
      totalHtCents: 50_000,
      totalTvaCents: 0,
      totalTtcCents: 50_000,
    });
  });

  it("6. franchise → assujetti : n° exigé et imprimé sur la prochaine autofacture ; la précédente garde 500 €", async () => {
    etat.apporteurs["APP1"] = FRANCHISE;
    etat.lignes = [ligne("c1", "due", 50_000)];
    await facturerApporteur("APP1", MARDI);
    expect(await changer({ regimeTva: "assujetti", numeroTva: "fr 00 123456782" })).toMatchObject({
      ok: true,
    });
    expect(etat.apporteurs["APP1"]).toMatchObject({
      regimeTva: "assujetti",
      numeroTva: "FR00123456782",
    });
    expect((await lireVirementsAFaire()).map((v) => v.totalCents)).toEqual([50_000]);
    etat.lignes.push(ligne("c2", "due", 50_000));
    await facturerApporteur("APP1", new Date("2026-11-26T11:00:00Z"));
    expect(etat.pieces.at(-1)).toMatchObject({
      regimeTva: "assujetti",
      numeroTva: "FR00123456782",
      totalTtcCents: 60_000,
    });
  });
});

describe("date future et date passée", () => {
  it("4. date FUTURE : l'autofacture établie avant la date reste au régime d'avant ; à la date, le nouveau régime s'applique même sans bascule ; la bascule est idempotente", async () => {
    expect(await changer({ effetAu: "01/12/2026" })).toMatchObject({ ok: true });
    // Fiche inchangée tant que la date n'est pas arrivée.
    expect(etat.apporteurs["APP1"]).toMatchObject(ASSUJETTI);
    expect((await regimeApplicableAu("APP1", "2026-11-30")).regimeTva).toBe("assujetti");
    const au1er = await regimeApplicableAu("APP1", "2026-12-01");
    expect(au1er).toEqual({ regimeTva: "franchise_293b", numeroTva: null });
    // Sans que `basculerRegimesDuJour` ait tourné, une autofacture du 1er décembre est sans TVA.
    etat.lignes = [ligne("c1", "due", 50_000)];
    await facturerApporteur("APP1", new Date("2026-12-01T09:00:00Z"));
    expect(etat.pieces.at(-1)).toMatchObject({
      regimeTva: "franchise_293b",
      totalTtcCents: 50_000,
    });
    // La bascule met la fiche à jour, une seule fois.
    expect(await basculerRegimesDuJour(new Date("2026-11-30T05:00:00Z"))).toBe(0);
    expect(await basculerRegimesDuJour(new Date("2026-12-01T05:00:00Z"))).toBe(1);
    expect(etat.apporteurs["APP1"]).toMatchObject({ regimeTva: "franchise_293b", numeroTva: null });
    expect(await basculerRegimesDuJour(new Date("2026-12-01T06:00:00Z"))).toBe(0);
  });

  it("5. date PASSÉE avec pièces émises depuis : refus avec la liste, puis confirmation ; les pièces restent intactes", async () => {
    etat.lignes = [
      ligne("c1", "due", 50_000, {
        autofactureNumero: "AXI-APP-2026-0001",
        autofactureEmiseAt: new Date("2026-11-15T09:00:00Z"),
      }),
    ];
    etat.pieces.push({
      numero: "AXI-APP-2026-0001",
      apporteurId: "APP1",
      genre: "facture",
      regimeTva: "assujetti",
      numeroTva: "FR00123456782",
      totalHtCents: 50_000,
      totalTvaCents: 10_000,
      totalTtcCents: 60_000,
      factureRectifiee: null,
      emiseAt: new Date("2026-11-15T09:00:00Z"),
      origine: "emission",
    });
    const refus = await changer({ effetAu: "10/11/2026" });
    expect(refus).toMatchObject({
      ok: false,
      piecesEmises: [{ numero: "AXI-APP-2026-0001", emiseLe: "2026-11-15" }],
    });
    expect(etat.changements).toEqual([]);
    const ok = await changer({ effetAu: "10/11/2026", confirmePiecesEmises: true });
    expect(ok).toMatchObject({ ok: true });
    // La pièce émise le 15/11 reste au régime d'alors : aucune rectification automatique.
    expect(etat.pieces[0]).toMatchObject({ regimeTva: "assujetti", totalTtcCents: 60_000 });
    expect(etat.journal.at(-1)).toMatchObject({
      action: "apporteur.regime_tva_change",
      changes: expect.objectContaining({ piecesEmisesDepuis: ["AXI-APP-2026-0001"] }),
    });
  });
});

describe("annulation et concurrence", () => {
  it("7. annuler un changement à venir : `annuleAt`, retour au régime d'avant, journal et e-mail", async () => {
    await changer({ effetAu: "01/12/2026" });
    const id = etat.changements[0]!.id;
    expect(
      await annulerChangementAVenir({
        changementId: id,
        acteurId: "ADMIN1",
        maintenant: AUJOURDHUI,
      }),
    ).toMatchObject({
      ok: true,
    });
    expect(etat.changements[0]!.annuleAt).not.toBeNull();
    expect((await regimeApplicableAu("APP1", "2026-12-05")).regimeTva).toBe("assujetti");
    expect(etat.journal.at(-1)).toMatchObject({ action: "apporteur.regime_tva_change_annule" });
    expect(etat.envoyes.at(-1)!["payload"]).toMatchObject({ annule: true });
    // Un changement déjà en vigueur ne s'annule plus.
    await changer({ effetAu: "01/12/2026" });
    const id2 = etat.changements.at(-1)!.id;
    expect(
      await annulerChangementAVenir({
        changementId: id2,
        acteurId: null,
        maintenant: new Date("2026-12-02T09:00:00Z"),
      }),
    ).toMatchObject({ ok: false });
  });

  it("8. deux changements simultanés : un seul réussit", async () => {
    const [a, b] = await Promise.all([changer(), changer()]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(etat.apporteurs["APP1"]).toMatchObject({ regimeTva: "franchise_293b" });
  });
});
