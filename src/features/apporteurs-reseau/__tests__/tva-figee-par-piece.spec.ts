import { beforeEach, describe, expect, it, vi } from "vitest";

// TVA FIGÉE PAR PIÈCE (décisions de Will, 26/11) : le régime est figé sur chaque autofacture et chaque
// avoir ; une commission facturée sans TVA en mars reste sans TVA au virement même si l'apporteur
// passe à la TVA en avril, et réciproquement. Le virement suit le PDF.

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("./simulateur-tva")).prisma }));
vi.mock("../annuaire", () => ({
  lireEntrepriseParSiren: vi.fn(async (siren: string) => ({
    ok: true,
    entreprise: { siren, active: true },
  })),
}));
vi.mock("@/server/queue/lib/sentry-worker", async () => ({
  captureWorkerError: vi.fn((_a: string, _b: string, _c: unknown, err: Error) => {
    await_etat().sentry.push(err.message);
  }),
}));
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
import { exportDas2, lignesDas2Apporteurs, cumulVigilanceCents } from "../commissions";
import { facturerApporteur, lireVirementsAFaire, marquerVerse } from "../facturation";
import { oublierPiecesFigeesDisponible, figerPiecesManquantes } from "../tva-pieces";
import { oublierLitigeDisponible } from "../litige";

// Petit détour : le mock Sentry est hoisté avant l'import du simulateur.
function await_etat() {
  return (globalThis as unknown as { __etatTva: typeof h.etat }).__etatTva;
}
(globalThis as unknown as { __etatTva: typeof h.etat }).__etatTva = h.etat;

const { etat, ligne } = h;
const MARDI = new Date("2026-10-06T09:00:00Z");
const ASSUJETTI = { regimeTva: "assujetti", numeroTva: "FR00123456782" };
const FRANCHISE = { regimeTva: "franchise_293b", numeroTva: null };

beforeEach(() => {
  h.remettreAZero();
  oublierPiecesFigeesDisponible();
  oublierLitigeDisponible();
});

describe("le virement suit le PDF, pas la fiche", () => {
  it("6. assujetti → franchise après l'autofacture : 600 € partout (virement, e-mail, DAS2, cumul)", async () => {
    etat.apporteurs["APP1"] = ASSUJETTI;
    etat.lignes = [ligne("c1", "due", 50_000)];
    const f = await facturerApporteur("APP1", MARDI);
    expect(f).toMatchObject({ ok: true, numero: "AXI-APP-2026-0001", totalCents: 60_000 });
    // Pièce figée : assujetti, HT 50 000, TVA 10 000, TTC 60 000.
    expect(etat.pieces).toHaveLength(1);
    expect(etat.pieces[0]).toMatchObject({
      numero: "AXI-APP-2026-0001",
      genre: "facture",
      regimeTva: "assujetti",
      numeroTva: "FR00123456782",
      totalHtCents: 50_000,
      totalTvaCents: 10_000,
      totalTtcCents: 60_000,
      origine: "emission",
    });
    expect(etat.envoyes[0]!["payload"]).toMatchObject({ regimeTva: "assujetti" });

    // L'apporteur passe en franchise APRÈS l'émission.
    etat.apporteurs["APP1"] = FRANCHISE;

    const virements = await lireVirementsAFaire();
    expect(virements.map((v) => v.totalCents)).toEqual([60_000]);
    // Le cumul de vigilance : la ligne facturée garde son TTC (600 €), une nouvelle commission due
    // de 500 € compte 500 € au nouveau régime.
    expect(await cumulVigilanceCents("APP1")).toBe(60_000);
    etat.lignes.push(ligne("c2", "due", 50_000));
    expect(await cumulVigilanceCents("APP1")).toBe(110_000);
    etat.lignes.pop();

    const v = await marquerVerse("APP1", MARDI, "AXI-APP-2026-0001");
    expect(v).toMatchObject({ ok: true, totalCents: 60_000 });
    expect(etat.confirmations[0]!["montant"]).toContain("600");
    // DAS2 : la ligne versée dans l'année vaut le TTC de son PDF.
    const das2 = await lignesDas2Apporteurs(2026);
    expect(das2.map((l) => l.totalCents)).toEqual([60_000]);
    expect(await exportDas2(2026)).toContain("600");
  });

  it("7. symétrique : franchise → assujetti après l'autofacture : 500 €, jamais 600", async () => {
    etat.apporteurs["APP1"] = FRANCHISE;
    etat.lignes = [ligne("c1", "due", 50_000)];
    const f = await facturerApporteur("APP1", MARDI);
    expect(f).toMatchObject({ ok: true, totalCents: 50_000 });
    expect(etat.pieces[0]).toMatchObject({
      regimeTva: "franchise_293b",
      numeroTva: null,
      totalTtcCents: 50_000,
    });
    etat.apporteurs["APP1"] = ASSUJETTI;
    expect((await lireVirementsAFaire()).map((v) => v.totalCents)).toEqual([50_000]);
    const v = await marquerVerse("APP1", MARDI, "AXI-APP-2026-0001");
    expect(v).toMatchObject({ ok: true, totalCents: 50_000 });
    expect((await lignesDas2Apporteurs(2026)).map((l) => l.totalCents)).toEqual([50_000]);
  });

  it("8. avoir après changement : nouvelle autofacture SANS TVA (1 000 €), avoir AVEC TVA (600 €), virement 400 €", async () => {
    etat.apporteurs["APP1"] = ASSUJETTI;
    etat.lignes = [ligne("c1", "due", 50_000)];
    await facturerApporteur("APP1", MARDI);
    await marquerVerse("APP1", MARDI, "AXI-APP-2026-0001");
    etat.apporteurs["APP1"] = FRANCHISE;
    etat.lignes.push(
      ligne("r1", "reprise", -50_000, { palier: "reprise-de:c1", activite: "reprise" }),
      ligne("c2", "due", 100_000),
    );
    const f = await facturerApporteur("APP1", MARDI);
    expect(f).toMatchObject({ ok: true, totalCents: 40_000 });
    const parNumero = Object.fromEntries(etat.pieces.map((p) => [p.numero, p]));
    expect(parNumero["AXI-APP-2026-0002"]).toMatchObject({
      genre: "facture",
      regimeTva: "franchise_293b",
      totalTtcCents: 100_000,
    });
    expect(parNumero["AXI-APP-2026-0003"]).toMatchObject({
      genre: "avoir",
      regimeTva: "assujetti",
      numeroTva: "FR00123456782",
      totalHtCents: 50_000,
      totalTtcCents: 60_000,
      factureRectifiee: "AXI-APP-2026-0001",
    });
    // Le virement de cette autofacture : 1 000 − 600 = 400 €.
    expect((await lireVirementsAFaire()).map((v) => v.totalCents)).toEqual([40_000]);
  });

  it("9. le net négatif ne revient pas : 500 € en franchise contre 450 € HT d'une pièce assujettie → compensation", async () => {
    etat.apporteurs["APP1"] = FRANCHISE;
    etat.pieces.push({
      numero: "AXI-APP-2026-0001",
      apporteurId: "APP1",
      genre: "facture",
      regimeTva: "assujetti",
      numeroTva: "FR00123456782",
      totalHtCents: 45_000,
      totalTvaCents: 9_000,
      totalTtcCents: 54_000,
      factureRectifiee: null,
      emiseAt: new Date("2026-09-01T09:00:00Z"),
      origine: "emission",
    });
    etat.lignes = [
      ligne("c0", "versee", 45_000, {
        autofactureNumero: "AXI-APP-2026-0001",
        releveMois: "2026-09",
        verseeAt: new Date("2026-09-03T09:00:00Z"),
      }),
      ligne("r1", "reprise", -45_000, { palier: "reprise-de:c0" }),
      ligne("c1", "due", 50_000),
    ];
    const f = await facturerApporteur("APP1", MARDI);
    expect(f.ok).toBe(true);
    expect(etat.sentry.filter((m) => m.includes("net négatif"))).toEqual([]);
    // L'avoir (assujetti) tient sous l'autofacture (franchise) : 41 667 HT = 50 000 TTC, net 0.
    const avoir = etat.pieces.find((p) => p.genre === "avoir")!;
    expect(avoir).toMatchObject({ regimeTva: "assujetti", totalTtcCents: 50_000 });
    expect(f.ok && f.totalCents).toBe(0);
  });

  it("11. garde « le virement suit le PDF » : un recalcul différent du PDF est refusé et signalé", async () => {
    etat.apporteurs["APP1"] = ASSUJETTI;
    etat.lignes = [ligne("c1", "due", 50_000)];
    await facturerApporteur("APP1", MARDI);
    // Une ligne modifiée à la main après l'émission : le recalcul donne 59 999, le PDF dit 60 000.
    etat.lignes[0]!.montantCents = 49_999;
    const v = await marquerVerse("APP1", MARDI, "AXI-APP-2026-0001");
    expect(v.ok).toBe(false);
    expect(etat.lignes[0]!.statut).toBe("due");
    expect(etat.confirmations).toEqual([]);
    expect(etat.sentry.some((m) => m.includes("AXI-APP-2026-0001"))).toBe(true);
  });

  it("12. table absente : la facturation et le virement fonctionnent comme avant (repli sur la fiche), sans écriture", async () => {
    etat.tables = false;
    etat.apporteurs["APP1"] = ASSUJETTI;
    etat.lignes = [ligne("c1", "due", 50_000)];
    const f = await facturerApporteur("APP1", MARDI);
    expect(f).toMatchObject({ ok: true, totalCents: 60_000 });
    expect(etat.pieces).toEqual([]);
    expect((await lireVirementsAFaire()).map((v) => v.totalCents)).toEqual([60_000]);
    const v = await marquerVerse("APP1", MARDI, "AXI-APP-2026-0001");
    expect(v).toMatchObject({ ok: true, totalCents: 60_000 });
    expect(etat.pieces).toEqual([]);
    expect(await figerPiecesManquantes()).toBe(0);
  });
});

describe("13. figerPiecesManquantes : rattrapage idempotent", () => {
  it("une autofacture émise sans pièce → une ligne « rattrapage » ; un second appel → 0", async () => {
    etat.apporteurs["APP1"] = FRANCHISE;
    etat.lignes = [
      ligne("c1", "due", 50_000, {
        autofactureNumero: "AXI-APP-2026-0007",
        autofactureEmiseAt: new Date("2026-10-01T09:00:00Z"),
      }),
    ];
    expect(await figerPiecesManquantes()).toBe(1);
    expect(etat.pieces[0]).toMatchObject({
      numero: "AXI-APP-2026-0007",
      regimeTva: "franchise_293b",
      origine: "rattrapage",
      totalTtcCents: null,
    });
    expect(await figerPiecesManquantes()).toBe(0);
    expect(etat.pieces).toHaveLength(1);
  });

  it("une pièce émise avant un changement de régime est figée au régime d'AVANT (jour d'émission)", async () => {
    etat.apporteurs["APP1"] = FRANCHISE;
    etat.changements.push({
      id: "chg-1",
      apporteurId: "APP1",
      regimeAvant: "assujetti",
      numeroTvaAvant: "FR00123456782",
      regimeTva: "franchise_293b",
      numeroTva: null,
      effetAu: new Date(Date.UTC(2026, 10, 1, 12)),
      saisiAt: new Date("2026-10-20T09:00:00Z"),
      saisiPar: null,
      annuleAt: null,
    });
    etat.lignes = [
      ligne("c1", "due", 50_000, {
        autofactureNumero: "AXI-APP-2026-0007",
        autofactureEmiseAt: new Date("2026-10-01T09:00:00Z"),
      }),
    ];
    // Émise le 1er octobre, avant l'effet du 1er novembre : le régime applicable ce jour-là est celui
    // de la fiche d'ALORS. Ici la fiche (déjà basculée) dit franchise : le rattrapage suit `regimeApplicableAu`,
    // qui lit le changement ≤ jour (aucun) puis la fiche. C'est `changerRegimeTva` qui fige AVANT de basculer.
    expect(await figerPiecesManquantes("APP1")).toBe(1);
    expect(etat.pieces[0]!.numero).toBe("AXI-APP-2026-0007");
  });
});
