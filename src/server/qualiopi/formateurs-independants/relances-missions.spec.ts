/**
 * Lot C (M16) — les déclencheurs des relances F18, F45, F27 et F21 : calendrier
 * décidé par le moteur commun, sur les faits que les lecteurs fournissent.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/telegram", () => ({ sendTelegram: vi.fn() }));
vi.mock("@/server/journal/journaliser", () => ({ journaliser: vi.fn() }));
const h = vi.hoisted(() => ({ valide: true, lien: vi.fn() }));
const e = vi.hoisted(() => ({
  etats: { dossier_en_ligne: true, relances_auto: true } as Record<string, boolean>,
}));
vi.mock("./interrupteurs-etat", () => ({ lireEtatsInterrupteurs: async () => e.etats }));
vi.mock("./envois", () => ({ texteValide: async () => h.valide }));
vi.mock("@/server/qualiopi/documents/signature/emettre-lien-signature", () => ({
  emettreLienSignatureSystem: h.lien,
}));

import { decisionCampagne } from "@/lib/relances/campagne";
import {
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
      lien: "https://exemple.test/fr/espace-formateur/lettre/d1",
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
