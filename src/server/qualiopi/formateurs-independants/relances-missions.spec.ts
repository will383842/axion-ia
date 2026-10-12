/**
 * Lot C (M16) — les déclencheurs des relances F18, F45, F27 et F21 : calendrier
 * décidé par le moteur commun, sur les faits que les lecteurs fournissent.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const pz = vi.hoisted(() => ({
  prisma: {
    documentGenere: { findUnique: vi.fn() },
    documentSignature: { count: vi.fn() },
    documentSignatureToken: { findFirst: vi.fn() },
    trainer: { findUnique: vi.fn() },
  },
  creerToken: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: pz.prisma }));
// Le vrai `emettreLienSignatureSystem` est branché dans le test de bout en bout : ses
// dépendances hors base sont simulées ici.
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/server/actions/qualiopi/_guards", () => ({ logQualiopiActivity: vi.fn() }));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  creerTokenDocument: pz.creerToken,
  TokenDocumentError: class TokenDocumentError extends Error {},
}));
vi.mock("@/server/email/outbox-service", () => ({ jobIdDejaGare: vi.fn() }));
vi.mock("@/lib/telegram", () => ({ sendTelegram: vi.fn() }));
vi.mock("@/server/journal/journaliser", () => ({ journaliser: vi.fn() }));
const h = vi.hoisted(() => ({ valide: true, manquantes: false, lien: vi.fn() }));
const e = vi.hoisted(() => ({
  etats: { dossier_en_ligne: true, relances_auto: true } as Record<string, boolean>,
}));
vi.mock("./interrupteurs-etat", () => ({ lireEtatsInterrupteurs: async () => e.etats }));
vi.mock("./envois", () => ({
  texteValide: async () => h.valide,
  valeursManquantes: () => h.manquantes,
}));
vi.mock("@/server/qualiopi/documents/signature/emettre-lien-signature", () => ({
  emettreLienSignatureSystem: h.lien,
}));

import { decisionCampagne } from "@/lib/relances/campagne";
import { passerCampagnes } from "@/server/relances/passer-campagnes";
import {
  CAMPAGNE_CONTRAT,
  REGLE_CONTRAT,
  REGLE_LETTRE_1RE,
  REGLE_LETTRE_J3,
  REGLE_NDA,
  REGLE_NOUVELLE_VERSION,
  faitsContrat,
  faitsLettre,
  faitsNda,
  ndaAAlerter,
  ndaEstEnCours,
  passerAlerteNda,
  type LigneContrat,
  type LigneLettre,
  type LigneNda,
} from "./relances-missions";

const J = 86_400_000;
// Mardi 13 octobre 2026, 10 h à Paris.
const MAINTENANT = new Date("2026-10-13T08:00:00Z");
const avant = (jours: number) => new Date(MAINTENANT.getTime() - jours * J);
const apres = (jours: number) => new Date(MAINTENANT.getTime() + jours * J);

beforeEach(() => {
  h.valide = true;
  h.manquantes = false;
  pz.prisma.trainer.findUnique.mockReset().mockResolvedValue({ finCollaborationAt: null });
  h.lien.mockReset().mockResolvedValue({ data: { url: "https://x.invalid/portail/signer/T" } });
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://exemple.test");
});

const contrat = (over: Partial<LigneContrat> = {}): LigneContrat => ({
  trainerId: "t1",
  email: "m@ex.test",
  prenom: "Marie",
  documentId: "d1",
  fermee: false,
  origine: { id: "log1", at: avant(4), gabarit: "formateur-contrat-a-signer" },
  relances: [],
  adresseMorte: false,
  opposition: false,
  ...over,
});

describe("F18 — contrat pas encore signé", () => {
  it("J+3 : la première relance est due, J+2 : non", () => {
    const f = faitsContrat(contrat(), "contrat", MAINTENANT)!;
    const d = decisionCampagne({ etat: f.etat, maintenant: MAINTENANT, regle: REGLE_CONTRAT });
    expect(d).toMatchObject({ envoyer: true, etape: "j3" });
    const tot = faitsContrat(
      contrat({ origine: { id: "l", at: avant(2), gabarit: "formateur-contrat-a-signer" } }),
      "contrat",
      MAINTENANT,
    )!;
    expect(
      decisionCampagne({ etat: tot.etat, maintenant: MAINTENANT, regle: REGLE_CONTRAT }).envoyer,
    ).toBe(false);
  });
  it("deux au plus, rien après 14 jours", () => {
    const deux = faitsContrat(
      contrat({
        origine: { id: "l", at: avant(8), gabarit: "formateur-contrat-a-signer" },
        relances: [avant(5), avant(1)],
      }),
      "contrat",
      MAINTENANT,
    )!;
    expect(
      decisionCampagne({ etat: deux.etat, maintenant: MAINTENANT, regle: REGLE_CONTRAT }),
    ).toMatchObject({ envoyer: false, motif: "plafond" });
    const vieux = faitsContrat(
      contrat({ origine: { id: "l", at: avant(20), gabarit: "formateur-contrat-a-signer" } }),
      "contrat",
      MAINTENANT,
    )!;
    expect(
      decisionCampagne({ etat: vieux.etat, maintenant: MAINTENANT, regle: REGLE_CONTRAT }).envoyer,
    ).toBe(false);
  });
  it("seulement si F16 est parti ; une origine F45 n'est pas une origine F18", () => {
    expect(faitsContrat(contrat({ origine: null }), "contrat", MAINTENANT)).toBeNull();
    const v = contrat({
      origine: { id: "l", at: avant(8), gabarit: "formateur-contrat-nouvelle-version" },
    });
    expect(faitsContrat(v, "contrat", MAINTENANT)).toBeNull();
    expect(faitsContrat(v, "version", MAINTENANT)).not.toBeNull();
  });
  it("le lien est émis à l'envoi seulement, et pas du tout si le texte n'est pas validé", async () => {
    const f = faitsContrat(contrat(), "contrat", MAINTENANT)!;
    expect(h.lien).not.toHaveBeenCalled();
    h.valide = false;
    expect(await f.completerPayload!(f.payload)).toBeNull();
    expect(h.lien).not.toHaveBeenCalled();
    h.valide = true;
    expect(await f.completerPayload!(f.payload)).toMatchObject({
      prenom: "Marie",
      lien: "https://x.invalid/portail/signer/T",
    });
    expect(h.lien).toHaveBeenCalledWith("d1", "sous_traitant");
  });
  it("fin de collaboration survenue depuis la lecture : aucun lien émis (le lien de F16 reste vivant)", async () => {
    pz.prisma.trainer.findUnique.mockResolvedValue({ finCollaborationAt: avant(0) });
    const f = faitsContrat(contrat(), "contrat", MAINTENANT)!;
    expect(await f.completerPayload!(f.payload)).toBeNull();
    expect(h.lien).not.toHaveBeenCalled();
  });
  it("valeurs manquantes au texte : aucun lien émis", async () => {
    h.manquantes = true;
    const f = faitsContrat(contrat(), "contrat", MAINTENANT)!;
    expect(await f.completerPayload!(f.payload)).toBeNull();
    expect(h.lien).not.toHaveBeenCalled();
  });
  it("lien impossible à émettre : rien ne part", async () => {
    h.lien.mockResolvedValue({ error: "Pièce annulée." });
    const f = faitsContrat(contrat(), "contrat", MAINTENANT)!;
    expect(await f.completerPayload!(f.payload)).toBeNull();
  });
});

describe("F45 — nouvelle version du contrat", () => {
  const v = (jours: number, relances: Date[] = []) =>
    contrat({
      origine: { id: "l", at: avant(jours), gabarit: "formateur-contrat-nouvelle-version" },
      relances,
    });
  it("J+7 puis J+21, [N] = jours restants sur 30", async () => {
    const f7 = faitsContrat(v(7), "version", MAINTENANT)!;
    expect(
      decisionCampagne({ etat: f7.etat, maintenant: MAINTENANT, regle: REGLE_NOUVELLE_VERSION }),
    ).toMatchObject({ envoyer: true, etape: "j7" });
    expect((await f7.completerPayload!(f7.payload))!.valeurs).toEqual({ N: "23" });
    const f21 = faitsContrat(v(21, [avant(14)]), "version", MAINTENANT)!;
    expect(
      decisionCampagne({ etat: f21.etat, maintenant: MAINTENANT, regle: REGLE_NOUVELLE_VERSION }),
    ).toMatchObject({ envoyer: true, etape: "j21" });
    expect((await f21.completerPayload!(f21.payload))!.valeurs).toEqual({ N: "9" });
  });
});

const lettre = (
  debutDans: number,
  envoyeAvant: number,
  over: Partial<LigneLettre> = {},
): LigneLettre => ({
  trainerId: "t1",
  email: "m@ex.test",
  prenom: "Marie",
  documentId: "d1",
  intitule: "IA en entreprise",
  debutSession: apres(debutDans),
  fermee: false,
  envoyeeAt: avant(envoyeAvant),
  origineLogId: "log",
  relances1re: [],
  relancesJ3: [],
  adresseMorte: false,
  opposition: false,
  ...over,
});

describe("F27 — lettre de mission pas encore signée", () => {
  it("1re relance 2 jours après F26 (session lointaine)", () => {
    const f = faitsLettre(lettre(30, 2), "1re", MAINTENANT)!;
    expect(
      decisionCampagne({ etat: f.etat, maintenant: MAINTENANT, regle: REGLE_LETTRE_1RE }),
    ).toMatchObject({ envoyer: true, etape: "1re" });
    expect(f.payload).toMatchObject({
      lien: "https://exemple.test/fr/espace-formateur?lettre=d1",
      valeurs: { intitulé: "IA en entreprise" },
    });
    const tot = faitsLettre(lettre(30, 1), "1re", MAINTENANT)!;
    expect(
      decisionCampagne({ etat: tot.etat, maintenant: MAINTENANT, regle: REGLE_LETTRE_1RE }).envoyer,
    ).toBe(false);
  });
  it("seconde relance à J-3 du début, pas avant", () => {
    const f = faitsLettre(lettre(3, 10), "j3", MAINTENANT)!;
    expect(
      decisionCampagne({ etat: f.etat, maintenant: MAINTENANT, regle: REGLE_LETTRE_J3 }),
    ).toMatchObject({ envoyer: true, etape: "j-3" });
    const loin = faitsLettre(lettre(10, 5), "j3", MAINTENANT)!;
    expect(
      decisionCampagne({ etat: loin.etat, maintenant: MAINTENANT, regle: REGLE_LETTRE_J3 }).envoyer,
    ).toBe(false);
  });
  it("rien après le début, ni la 1re ni la seconde", () => {
    expect(faitsLettre(lettre(-1, 10), "1re", MAINTENANT)).toBeNull();
    expect(faitsLettre(lettre(-1, 10), "j3", MAINTENANT)).toBeNull();
  });
  it("jamais deux relances à moins d'un jour l'une de l'autre", () => {
    // Lettre envoyée il y a 2 j pour un début dans 4 j : 1re à J-4+... trop proche de J-3.
    expect(faitsLettre(lettre(4, 1.5), "1re", MAINTENANT)).toBeNull();
    // Lettre envoyée il y a moins d'un jour avant J-3 : pas de seconde relance.
    expect(faitsLettre(lettre(3, 0.5), "j3", MAINTENANT)).toBeNull();
  });
  it("sans journal de F26 ou sans site : aucun fait", () => {
    expect(
      faitsLettre(lettre(30, 2, { envoyeeAt: null, origineLogId: null }), "1re", MAINTENANT),
    ).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(faitsLettre(lettre(30, 2), "1re", MAINTENANT)).toBeNull();
  });
});

const nda = (jours: number, over: Partial<LigneNda> = {}): LigneNda => ({
  trainerId: "t1",
  email: "m@ex.test",
  prenom: "Marie",
  fermee: false,
  contresigneAt: avant(jours),
  relances: [],
  adresseMorte: false,
  opposition: false,
  ...over,
});

describe("F21 — numéro de déclaration d'activité", () => {
  it("lecture de « en cours »", () => {
    expect(ndaEstEnCours("en cours")).toBe(true);
    expect(ndaEstEnCours("En  cours d'attribution")).toBe(true);
    expect(ndaEstEnCours("11755555555")).toBe(false);
    expect(ndaEstEnCours(null)).toBe(false);
  });
  it("30 puis 60 jours après la contresignature", () => {
    const f30 = faitsNda(nda(30))!;
    expect(
      decisionCampagne({ etat: f30.etat, maintenant: MAINTENANT, regle: REGLE_NDA }),
    ).toMatchObject({ envoyer: true, etape: "j30" });
    expect(
      decisionCampagne({ etat: faitsNda(nda(29))!.etat, maintenant: MAINTENANT, regle: REGLE_NDA })
        .envoyer,
    ).toBe(false);
    const f60 = faitsNda(nda(60, { relances: [avant(30)] }))!;
    expect(
      decisionCampagne({ etat: f60.etat, maintenant: MAINTENANT, regle: REGLE_NDA }),
    ).toMatchObject({ envoyer: true, etape: "j60" });
  });
  it("l'alerte interne est due à 90 jours, pas avant, pas pour une fiche close", () => {
    expect(ndaAAlerter([nda(89)], MAINTENANT)).toHaveLength(0);
    expect(ndaAAlerter([nda(90)], MAINTENANT)).toHaveLength(1);
    expect(ndaAAlerter([nda(120, { fermee: true })], MAINTENANT)).toHaveLength(0);
  });
});

describe("passage de l'alerte F21", () => {
  it("fenêtre de 8 h à 19 h et interrupteurs : sinon rien n'est lu", async () => {
    const nuit = new Date("2026-10-13T20:30:00Z");
    expect(await passerAlerteNda(nuit)).toBe(0);
    e.etats = { dossier_en_ligne: true, relances_auto: false };
    expect(await passerAlerteNda(MAINTENANT)).toBe(0);
    e.etats = { dossier_en_ligne: true, relances_auto: true };
  });
});

describe("F18 de bout en bout — un lien révoqué par l'administrateur n'est jamais réémis", () => {
  const DOC = "66666666-6666-4666-8666-666666666666";
  const TRAINER = "77777777-7777-4777-8777-777777777777";

  async function passer(dernierJeton: { revokedAt: Date | null; revokedById: string | null }) {
    const reel = await vi.importActual<
      typeof import("@/server/qualiopi/documents/signature/emettre-lien-signature")
    >("@/server/qualiopi/documents/signature/emettre-lien-signature");
    h.lien.mockImplementation(reel.emettreLienSignatureSystem);
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@db.example:5432/x");
    pz.prisma.documentGenere.findUnique.mockResolvedValue({
      id: DOC,
      type: "contrat_sous_traitance",
      numero: "AXI-DOC-2026-300",
      hashSha256: "d".repeat(64),
      metadata: {},
      annuleeAt: null,
      clientId: null,
      traineeId: null,
      sousTraitantId: null,
      sessionId: null,
      trainerId: TRAINER,
      suppressionPrevueAt: new Date("2031-01-01T00:00:00Z"),
    });
    pz.prisma.documentSignature.count.mockResolvedValue(0);
    pz.prisma.documentSignatureToken.findFirst.mockResolvedValue(dernierJeton);
    pz.prisma.trainer.findUnique.mockResolvedValue({
      statut: "sous_traitant",
      prenom: "Marie",
      nom: "Curie",
      email: "m@ex.test",
    });
    pz.creerToken.mockReset().mockResolvedValue({ token: "JETON", expiresAt: new Date() });
    const envoyer = vi.fn().mockResolvedValue("envoye");
    const ligne = contrat({ trainerId: TRAINER, documentId: DOC });
    const bilan = await passerCampagnes(MAINTENANT, {
      registre: [
        {
          ...CAMPAGNE_CONTRAT,
          lireFaits: async (m: Date) => [faitsContrat(ligne, "contrat", m)!],
        } as never,
      ],
      lireInterrupteurs: async () => e.etats as never,
      relanceesAujourdhui: async () => new Set<string>(),
      dejaTente: async () => false,
      envoyer,
    });
    return { bilan, envoyer };
  }

  it("lien révoqué par l'administrateur : rien ne part, aucun jeton neuf", async () => {
    const { bilan, envoyer } = await passer({
      revokedAt: new Date("2026-10-11T09:00:00Z"),
      revokedById: "88888888-8888-4888-8888-888888888888",
    });
    expect(bilan.envoyes).toBe(0);
    expect(bilan.ecartes["payload-indisponible"]).toBe(1);
    expect(envoyer).not.toHaveBeenCalled();
    expect(pz.creerToken).not.toHaveBeenCalled();
  });

  it("lien humain encore vivant : la relance le renouvelle et part", async () => {
    const { bilan, envoyer } = await passer({ revokedAt: null, revokedById: null });
    expect(bilan.envoyes).toBe(1);
    expect(envoyer).toHaveBeenCalledTimes(1);
    expect(pz.creerToken).toHaveBeenCalledTimes(1);
  });
});
