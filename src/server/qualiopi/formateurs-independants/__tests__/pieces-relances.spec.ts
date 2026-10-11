// Lot L13b — relances des pièces à renouveler (séquences S6 et S6 bis, 10c §3) :
// l'attestation URSSAF (F40) et les autres pièces (F41) s'inscrivent au registre
// des campagnes, ÉTEINTES derrière `formateurs.pieces_cron`.
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/email/outbox-service", () => ({ jobIdDejaGare: vi.fn() }));
vi.mock("@/server/qualiopi/formateurs-independants/envois", () => ({ envoyer: vi.fn() }));

import { decisionCampagne } from "@/lib/relances/campagne";
import { passerCampagnes } from "@/server/relances/passer-campagnes";
import { REGISTRE_CAMPAGNES, cleRelance } from "@/server/relances/registre-campagnes";

import { etatsParDefaut } from "../interrupteurs";
import type { PieceLue } from "../pieces-a-renouveler";
import {
  CAMPAGNE_PIECES,
  CAMPAGNE_VIGILANCE,
  faitsPieces,
  faitsVigilance,
  type LecturePieces,
} from "../pieces-relances";

const JOUR = 24 * 60 * 60 * 1000;
// Mardi 13 octobre 2026, 10 h à Paris.
const MAINTENANT = new Date("2026-10-13T08:00:00Z");
const T1 = "11111111-1111-4111-8111-111111111111";

function piece(over: Partial<PieceLue> = {}): PieceLue {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    type: "assurance_rc_pro",
    statutValidation: "valide",
    fichierUrl: "r2://piece",
    dateEmission: new Date("2025-11-01T00:00:00Z"),
    dateExpiration: new Date(MAINTENANT.getTime() + 20 * JOUR),
    createdAt: new Date("2025-11-01T00:00:00Z"),
    archiveAt: null,
    rejetMotif: null,
    valideAt: new Date("2025-11-02T00:00:00Z"),
    ...over,
  } as PieceLue;
}

function lecture(pieces: PieceLue[], over: Partial<LecturePieces> = {}): LecturePieces {
  return {
    fiches: [{ id: T1, prenom: "Camille", email: "camille@example.com" }],
    pieces: new Map([[T1, pieces]]),
    envois: [],
    opposes: new Set(),
    adressesMortes: new Set(),
    ...over,
  };
}

describe("livré éteint", () => {
  it("les deux campagnes sont inscrites au registre, derrière `pieces_cron`", () => {
    const ids = REGISTRE_CAMPAGNES.map((c) => c.id);
    expect(ids).toContain(CAMPAGNE_VIGILANCE.id);
    expect(ids).toContain(CAMPAGNE_PIECES.id);
    // Clé mère d'abord : couper le dossier en ligne suspend ces relances.
    expect(CAMPAGNE_VIGILANCE.interrupteurs).toEqual(["dossier_en_ligne", "pieces_cron"]);
    expect(CAMPAGNE_PIECES.interrupteurs).toEqual(["dossier_en_ligne", "pieces_cron"]);
  });

  it("interrupteurs absents : aucun formateur n'est lu, aucun e-mail ne part", async () => {
    const lireFaits = vi.fn(async () => faitsPieces(lecture([piece()]), MAINTENANT));
    const envoyer = vi.fn();
    const b = await passerCampagnes(MAINTENANT, {
      registre: REGISTRE_CAMPAGNES.map((c) => ({ ...c, lireFaits })),
      lireInterrupteurs: async () => etatsParDefaut(),
      relanceesAujourdhui: async () => new Set(),
      dejaTente: async () => false,
      envoyer,
    });
    expect(b.campagnesActives).toBe(0);
    expect(lireFaits).not.toHaveBeenCalled();
    expect(envoyer).not.toHaveBeenCalled();
  });
});

describe("S6 bis — autres pièces (F41)", () => {
  it("RC pro à 20 jours de l'échéance : premier rappel, avec la pièce et la date", () => {
    const [f] = faitsPieces(lecture([piece()]), MAINTENANT);
    expect(f).toBeDefined();
    expect(f!.entityId).toBe(T1);
    expect(f!.destinataire).toBe("camille@example.com");
    const d = decisionCampagne({
      etat: f!.etat,
      maintenant: MAINTENANT,
      regle: CAMPAGNE_PIECES.regle,
    });
    expect(d.envoyer).toBe(true);
    if (d.envoyer) {
      expect(d.etape).toBe("j30");
      expect(CAMPAGNE_PIECES.variante?.(d.etape)).toBe(1);
    }
    const valeurs = f!.payload.valeurs as Record<string, string>;
    expect(valeurs["la pièce"]).toBe("votre attestation d'assurance RC pro");
    expect(valeurs.date).toMatch(/2 novembre 2026/);
    expect(valeurs.N).toBe("20");
  });

  it("la relance à J-15 prend la variante « Relance », jamais celle d'une pièce refusée", () => {
    expect(CAMPAGNE_PIECES.variante?.("j15")).toBe(2);
    expect(CAMPAGNE_PIECES.regle.max).toBe(2);
  });

  it("un dépôt anticipé en attente suspend le rappel", () => {
    const enAttente = piece({
      id: "33333333-3333-4333-8333-333333333333",
      statutValidation: "en_attente",
      createdAt: MAINTENANT,
      valideAt: null,
    });
    const [f] = faitsPieces(lecture([piece(), enAttente]), MAINTENANT);
    expect(f!.etat.actionFaite).toBe(true);
  });

  it("pièce encore valable loin de l'échéance, échue ou refusée : aucune relance F41", () => {
    expect(
      faitsPieces(
        lecture([piece({ dateExpiration: new Date(MAINTENANT.getTime() + 90 * JOUR) })]),
        MAINTENANT,
      ),
    ).toEqual([]);
    expect(
      faitsPieces(
        lecture([piece({ dateExpiration: new Date(MAINTENANT.getTime() - JOUR) })]),
        MAINTENANT,
      ),
    ).toEqual([]);
    expect(
      faitsPieces(
        lecture([piece({ statutValidation: "rejete", rejetMotif: "note interne" })]),
        MAINTENANT,
      ),
    ).toEqual([]);
  });

  it("l'attestation URSSAF n'est jamais relancée par F41", () => {
    const vigilance = piece({
      type: "attestation_vigilance_urssaf",
      dateEmission: new Date(MAINTENANT.getTime() - 170 * JOUR),
      dateExpiration: null,
    });
    expect(faitsPieces(lecture([vigilance]), MAINTENANT)).toEqual([]);
  });

  it("les relances déjà tentées de CETTE échéance comptent, pas celles d'une autre", () => {
    const [f0] = faitsPieces(lecture([piece()]), MAINTENANT);
    const cle = cleRelance(CAMPAGNE_PIECES.id, T1, f0!.origineId, "j30");
    const autre = cleRelance(CAMPAGNE_PIECES.id, T1, "assurance_rc_pro-20251101", "j30");
    const [f] = faitsPieces(
      lecture([piece()], {
        envois: [
          { entityId: T1, jobId: cle, at: new Date(MAINTENANT.getTime() - 2 * JOUR) },
          { entityId: T1, jobId: autre, at: new Date(MAINTENANT.getTime() - 400 * JOUR) },
        ],
      }),
      MAINTENANT,
    );
    expect(f!.etat.envois).toHaveLength(1);
  });

  it("opposition, adresse morte, fiche effacée : la campagne s'arrête", () => {
    const base = lecture([piece()]);
    const [o] = faitsPieces({ ...base, opposes: new Set([T1]) }, MAINTENANT);
    const [m] = faitsPieces({ ...base, adressesMortes: new Set([T1]) }, MAINTENANT);
    const [e] = faitsPieces(
      { ...base, fiches: [{ id: T1, prenom: "", email: "x@erased.local" }] },
      MAINTENANT,
    );
    for (const [f, motif] of [
      [o, "opposition"],
      [m, "adresse-morte"],
      [e, "efface"],
    ] as const) {
      const d = decisionCampagne({
        etat: f!.etat,
        maintenant: MAINTENANT,
        regle: CAMPAGNE_PIECES.regle,
      });
      expect(d.envoyer).toBe(false);
      expect(d.motif).toBe(motif);
    }
  });

  it("la clé d'envoi ne porte ni adresse ni deux-points", () => {
    const [f] = faitsPieces(lecture([piece()]), MAINTENANT);
    const cle = cleRelance(CAMPAGNE_PIECES.id, f!.entityId, f!.origineId, "j30");
    expect(cle).toBe(`fi-piece-${T1}-assurance_rc_pro-20261102-j30`);
    expect(cle).not.toMatch(/@|:/);
  });
});

describe("S6 — attestation URSSAF (F40)", () => {
  const attestation = (joursAvantEcheance: number) =>
    piece({
      type: "attestation_vigilance_urssaf",
      // Échéance = émission + 6 mois.
      dateEmission: new Date(
        new Date(MAINTENANT.getTime() + joursAvantEcheance * JOUR).setUTCMonth(
          new Date(MAINTENANT.getTime() + joursAvantEcheance * JOUR).getUTCMonth() - 6,
        ),
      ),
      dateExpiration: null,
    });

  it("à 20 jours de l'échéance : rien encore (la demande part à J-15)", () => {
    const [f] = faitsVigilance(lecture([attestation(20)]), MAINTENANT);
    const d = decisionCampagne({
      etat: f!.etat,
      maintenant: MAINTENANT,
      regle: CAMPAGNE_VIGILANCE.regle,
    });
    expect(d.envoyer).toBe(false);
    expect(d.motif).toBe("pas-encore");
  });

  it("à 10 jours de l'échéance : la demande part, variante « avant l'échéance »", () => {
    const [f] = faitsVigilance(lecture([attestation(10)]), MAINTENANT);
    const d = decisionCampagne({
      etat: f!.etat,
      maintenant: MAINTENANT,
      regle: CAMPAGNE_VIGILANCE.regle,
    });
    expect(d.envoyer).toBe(true);
    if (d.envoyer) expect(CAMPAGNE_VIGILANCE.variante?.(d.etape)).toBe(2);
    expect(CAMPAGNE_VIGILANCE.regle.max).toBe(3);
  });

  it("échue sans nouveau dépôt : les relances continuent (elles débloquent)", () => {
    const [f] = faitsVigilance(lecture([attestation(-5)]), MAINTENANT);
    expect(f).toBeDefined();
    expect(f!.etat.actionFaite).toBe(false);
  });

  it("une nouvelle attestation en vérification : rien ne part", () => {
    const enAttente = piece({
      id: "44444444-4444-4444-8444-444444444444",
      type: "attestation_vigilance_urssaf",
      statutValidation: "en_attente",
      dateEmission: MAINTENANT,
      dateExpiration: null,
      valideAt: null,
    });
    expect(faitsVigilance(lecture([attestation(-5), enAttente]), MAINTENANT)).toEqual([]);
  });

  it("aucune attestation déposée : pas de F40 « avant l'échéance »", () => {
    expect(faitsVigilance(lecture([]), MAINTENANT)).toEqual([]);
  });
});

describe("le texte qui part est complet", () => {
  it("F40 et F41 : aucun crochet sans valeur, à chaque étape, avec les vraies déclarations", async () => {
    const { valeursManquantes: reel } = await vi.importActual<
      typeof import("@/server/qualiopi/formateurs-independants/envois")
    >("@/server/qualiopi/formateurs-independants/envois");
    const [p] = faitsPieces(lecture([piece()]), MAINTENANT);
    for (const etape of ["j30", "j15"]) {
      const payload = { ...p!.payload, etape: CAMPAGNE_PIECES.variante!(etape) };
      expect(reel("formateur-piece-a-renouveler", payload)).toBe(false);
    }
    const sans = { prenom: "Camille", valeurs: {}, etape: CAMPAGNE_VIGILANCE.variante!("j15") };
    expect(reel("formateur-vigilance", sans)).toBe(false);
  });
});
