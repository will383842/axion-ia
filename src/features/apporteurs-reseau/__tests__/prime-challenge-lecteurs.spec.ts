import { beforeEach, describe, expect, it, vi } from "vitest";

// PR H (#2464) : chaque lecteur d'un `factureId` ignore ou tolère la prime d'un challenge
// (`activite = prime_challenge`, `factureId` = identifiant de la prime, sans facture client).
// Un `it` par lecteur nommé dans le plan.

const PRIME_ID = "9c1d0f3a-2b4e-4c8a-8f55-3a7e6d5c4b21";
const CHALLENGE = "5b0c7e0e-6f0e-4d57-9a64-0d9d6b1f4a10";

const d = vi.hoisted(() => ({
  wheres: [] as Array<Record<string, unknown>>,
  lignes: [] as Array<Record<string, unknown>>,
  factures: [] as Array<Record<string, unknown>>,
  appelsParrainage: 0,
  mails: [] as string[],
}));

vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: unknown) => v }));
vi.mock("@/lib/destinataires-internes", () => ({ destinataireAlertesInternes: () => "x@y" }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: vi.fn(
    async (_g: string, _d: string, _l: string, _p: unknown, o: { jobId: string }) => {
      d.mails.push(o.jobId);
      return { enqueued: true };
    },
  ),
}));
vi.mock("../envois", () => ({ envoyer: vi.fn(async () => "envoye") }));
vi.mock("../jeton", () => ({ urlDossier: () => null }));
vi.mock("../tva-pieces", () => ({
  regimesDesPieces: async () => new Map(),
  piecesFigees: async () => new Map(),
  piecesFigeesDisponible: async () => false,
  regimeApplicableAu: async () => ({ regimeTva: "franchise_293b", numeroTva: null }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: async () => [],
    emailLog: { count: async () => 0 },
    activityLog: { create: async () => ({}) },
    factureFormation: {
      findMany: vi.fn(async (a: { where: Record<string, unknown> }) => {
        if ("avoirDeId" in a.where && !("id" in a.where))
          return [{ avoirDeId: "F1", devisId: null }];
        if ("id" in a.where) {
          const ids = ((a.where["id"] as { in?: string[] }).in ?? []) as string[];
          return d.factures.filter((f) => ids.includes(f["id"] as string));
        }
        return [];
      }),
      findUnique: async () => null,
    },
    commissionApporteur: {
      findMany: vi.fn(async (a: { where: Record<string, unknown> }) => {
        d.wheres.push(a.where);
        if (a.where["parrainage"] === true) d.appelsParrainage += 1;
        return d.lignes;
      }),
      findUnique: async () => d.lignes[0] ?? null,
      updateMany: async () => ({ count: 1 }),
    },
    apporteurReseau: { findMany: async () => [] },
  },
}));

import { designationCommission, echeancePaiement } from "../autofacture-donnees";
import {
  ACTIVITE_PRIME_CHALLENGE,
  challengeIdDuPalier,
  designationPrime,
  facturesClientDesLignes,
} from "../prime-challenge";
import { CODES_REGLE_APPLIQUEE } from "../regles";
import { reprendreApresAvoirsClients } from "../avoir-client";
import { alerterHorsGrille } from "../hors-grille";
import { suspendreCommission } from "../litige";
import { marquerRealiseesDepuisSessions } from "../realisation";
import { lireCommissions, classerActiviteCommission } from "../commissions";
import { notifierDecisionAttribution } from "../notification-attribution";
import { calculerReleve } from "../releve-mensuel/calcul";
import { commission, piece } from "../releve-mensuel/__tests__/fixtures";

const ligne = (surcharge: Record<string, unknown> = {}) => ({
  id: "p1",
  apporteurId: "APP1",
  statut: "a_qualifier",
  activite: ACTIVITE_PRIME_CHALLENGE,
  palier: `challenge:${CHALLENGE}`,
  parrainage: false,
  factureId: PRIME_ID,
  factureHtCents: 0,
  montantCents: 50_000,
  presentationId: null,
  creeAt: new Date("2026-01-01T10:00:00Z"),
  majAt: new Date("2026-01-01T10:00:00Z"),
  autofactureNumero: null,
  apporteur: { prenom: "Jeanne", nom: "Martin" },
  presentation: null,
  ...surcharge,
});

beforeEach(() => {
  d.wheres = [];
  d.lignes = [];
  d.factures = [];
  d.appelsParrainage = 0;
  d.mails = [];
});

describe("prime de challenge : chaque lecteur de factureId", () => {
  it("autofacture-donnees › designationCommission : « Prime exceptionnelle — <titre> (complément de commission) »", () => {
    const c = {
      id: "p1",
      activite: "prime_challenge",
      palier: `challenge:${CHALLENGE}`,
      parrainage: false,
      montantCents: 50_000,
    };
    expect(designationCommission({ ...c, titrePrime: "Challenge de décembre" })).toBe(
      "Prime exceptionnelle — Challenge de décembre (complément de commission)",
    );
    expect(designationCommission(c)).toBe("Prime exceptionnelle");
    expect(designationPrime("  ")).toBe("Prime exceptionnelle");
    expect(challengeIdDuPalier(`challenge:${CHALLENGE}`)).toBe(CHALLENGE);
    expect(challengeIdDuPalier("challenge:pas-un-uuid")).toBeNull();
    expect(challengeIdDuPalier("formation-generale-1j")).toBeNull();
  });

  it("facturation › le paiement intégral du client ne porte jamais sur une prime ; l'échéance part de l'émission", () => {
    const lignes = [
      { activite: "audit", factureId: "F1" },
      { activite: "prime_challenge", factureId: PRIME_ID },
    ];
    expect(facturesClientDesLignes(lignes)).toEqual(["F1"]);
    const emission = new Date("2026-10-06T09:00:00Z");
    expect(echeancePaiement(emission, null).toISOString().slice(0, 10)).toBe("2026-11-05");
  });

  it("avoir-client › la reprise après avoir d'un client ne lit jamais une prime", async () => {
    await reprendreApresAvoirsClients(new Date("2026-10-06T09:00:00Z"));
    expect(d.wheres.length).toBeGreaterThan(0);
    for (const w of d.wheres) expect(w["activite"]).toEqual({ not: "prime_challenge" });
  });

  it("commissions › lireCommissions tolère l'absence de facture et libelle « Prime exceptionnelle »", async () => {
    d.lignes = [ligne({ statut: "due", autofactureNumero: "AXI-APP-2026-0001" })];
    const [v] = await lireCommissions(null);
    expect(v).toMatchObject({
      activite: "prime_challenge",
      factureNumero: null,
      entreprise: "Prime exceptionnelle",
      paiementIntegralAt: null,
    });
  });

  it("commissions › une prime ne se classe pas en activité (classerActiviteCommission)", async () => {
    d.lignes = [ligne()];
    const r = await classerActiviteCommission("p1", "audit");
    expect(r.ok).toBe(false);
  });

  it("commandes-a-attribuer : jamais lue (elle n'est pas une commande) — aucun appel de commissions", async () => {
    // Le module lit `commandeAAttribuer`, pas `CommissionApporteur` : une prime n'y entre pas.
    const src = (await import("node:fs")).readFileSync(
      "src/features/apporteurs-reseau/commandes-a-attribuer.ts",
      "utf8",
    );
    expect(src).not.toMatch(/commissionApporteur/);
  });

  it("hors-grille › l'alerte « à qualifier » exclut les primes", async () => {
    await alerterHorsGrille(new Date("2026-10-06T09:00:00Z"));
    expect(d.wheres[0]!["activite"]).toEqual({ not: "prime_challenge" });
  });

  it("litige › suspendre une prime ne cherche aucune part de parrain", async () => {
    d.lignes = [ligne({ statut: "due" })];
    await suspendreCommission("p1", "contestation");
    expect(d.appelsParrainage).toBe(0);
  });

  it("notification-attribution › une prime n'y entre pas : aucun e-mail", async () => {
    await notifierDecisionAttribution({
      factureId: PRIME_ID,
      choisie: null,
      ecartes: [],
      motif: "",
      siretCommande: null,
    });
    expect(d.mails).toEqual([]);
  });

  it("realisation › le marquage « réalisée » ne parcourt jamais une prime", async () => {
    await marquerRealiseesDepuisSessions(new Date("2026-10-06T09:00:00Z"));
    expect(d.wheres[0]!["activite"]).toEqual({ not: "prime_challenge" });
  });

  it("regles › « prime_challenge » est un code de règle appliquée", () => {
    expect(CODES_REGLE_APPLIQUEE).toContain("prime_challenge");
  });

  it("relevé mensuel › la prime se libelle « Prime exceptionnelle », règle comprise, sans anomalie", () => {
    const { contenu, anomalies } = calculerReleve({
      periode: "2026-10",
      preparationAt: new Date("2026-11-02T08:00:00Z"),
      commissions: [
        commission({
          activite: "prime_challenge",
          palier: `challenge:${CHALLENGE}`,
          entreprise: null,
          factureClientNumero: null,
          factureClientDate: null,
          encaissementIntegralAt: null,
          factureHtCents: 0,
          prixPublicHtCents: null,
          montantCents: 10_000,
          regleAppliquee: "prime_challenge",
        }),
      ],
      pieces: [piece()],
    });
    const l = contenu.facturees.lignes[0]!;
    expect(l.prestation).toBe("Prime exceptionnelle");
    expect(l.regle).toMatchObject({ code: "prime_challenge" });
    expect(anomalies.filter((a) => a.code === "regle_inconnue")).toEqual([]);
  });
});
