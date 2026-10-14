/**
 * Lot G1 — la demande d'attestation URSSAF à l'APPROCHE du seuil (F40, variante 4) et
 * le renouvellement (S6) réservé aux formateurs qui ont ATTEINT le seuil.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteurs-etat", () => ({
  lireEtatsInterrupteurs: vi.fn(),
}));
vi.mock("@/server/email/outbox-service", () => ({ jobIdDejaGare: vi.fn() }));
vi.mock("@/server/qualiopi/formateurs-independants/envois", () => ({ envoyer: vi.fn() }));

import { TEXTES_FORMATEUR } from "@/lib/email/templates/formateur-independant-textes";
import { decisionCampagne } from "@/lib/relances/campagne";
import {
  VARIANTES_VALIDEES_A_PART,
  estTexteFormateurAValider,
} from "@/server/email/textes-formateurs-a-valider";
import { REGISTRE_CAMPAGNES, cleRelance } from "@/server/relances/registre-campagnes";

import type { PieceLue } from "../pieces-a-renouveler";
import {
  CAMPAGNE_VIGILANCE,
  CAMPAGNE_VIGILANCE_SEUIL,
  REGLE_VIGILANCE_SEUIL,
  faitsVigilance,
  faitsVigilanceSeuil,
  motifRetenueRelancePiece,
  type FicheRelance,
  type LecturePieces,
} from "../pieces-relances";

const JOUR = 24 * 60 * 60 * 1000;
// Mardi 13 octobre 2026, 10 h à Paris.
const MAINTENANT = new Date("2026-10-13T08:00:00Z");
const T1 = "11111111-1111-4111-8111-111111111111";
const ATT = "33333333-3333-4333-8333-333333333333";

function attestation(over: Partial<PieceLue> = {}): PieceLue {
  return {
    id: ATT,
    type: "attestation_vigilance_urssaf",
    statutValidation: "valide",
    fichierUrl: "r2://att",
    dateEmission: new Date(MAINTENANT.getTime() - 30 * JOUR),
    dateExpiration: null,
    createdAt: new Date(MAINTENANT.getTime() - 30 * JOUR),
    archiveAt: null,
    rejetMotif: null,
    valideAt: new Date(MAINTENANT.getTime() - 29 * JOUR),
    ...over,
  } as PieceLue;
}

function fiche(): FicheRelance {
  return {
    id: T1,
    prenom: "Camille",
    email: "camille@example.com",
    statut: "sous_traitant",
    actif: true,
    finCollaborationAt: null,
    organismeSousTraitantId: null,
    dossierStatut: "verifie",
    candidature: { natureCollaboration: "freelance", status: "hired" },
    pseudonymisee: false,
  };
}

function lecture(
  pieces: PieceLue[],
  cumul: number | null | undefined,
  over: Partial<LecturePieces> = {},
): LecturePieces {
  return {
    fiches: [fiche()],
    pieces: new Map([[T1, pieces]]),
    envois: [],
    opposes: new Set(),
    adressesMortes: new Set(),
    ...(cumul === undefined ? {} : { cumuls: new Map([[T1, cumul]]) }),
    ...over,
  };
}

describe("livré éteint, et validé à part", () => {
  it("inscrite au registre, derrière les mêmes interrupteurs que S6", () => {
    expect(REGISTRE_CAMPAGNES.map((c) => c.id)).toContain(CAMPAGNE_VIGILANCE_SEUIL.id);
    expect(CAMPAGNE_VIGILANCE_SEUIL.interrupteurs).toEqual(["dossier_en_ligne", "pieces_cron"]);
    expect(CAMPAGNE_VIGILANCE_SEUIL.gabarit).toBe("formateur-vigilance");
    expect(CAMPAGNE_VIGILANCE_SEUIL.variante?.("demande")).toBe(4);
    expect(CAMPAGNE_VIGILANCE_SEUIL.id.startsWith("vigilance")).toBe(false);
  });

  it("la variante 4 de F40 existe et se valide à part (jamais sous une validation ancienne)", () => {
    const v = TEXTES_FORMATEUR["formateur-vigilance"].variantes[3];
    expect(v?.etape).toBe("à l'approche du seuil");
    expect(v?.objet.length).toBeLessThanOrEqual(45);
    expect(VARIANTES_VALIDEES_A_PART["formateur-vigilance"]?.[4]).toBe("approche-seuil");
    expect(estTexteFormateurAValider("formateur-vigilance", "approche-seuil")).toBe(true);
  });

  it("le texte respecte le lexique des formateurs", () => {
    const v = TEXTES_FORMATEUR["formateur-vigilance"].variantes[3]!;
    const tout = [v.objet, ...v.paragraphes].join(" ").toLowerCase();
    for (const interdit of [
      "poste",
      "entretien",
      "recrutement",
      "salaire",
      "rémunération",
      "bienvenue",
      "vous devez",
      "obligatoire",
      "agent commercial",
      "grenoble",
      "expert-comptable",
    ]) {
      expect(tout).not.toContain(interdit);
    }
    expect(tout).toContain("[montant]");
  });
});

describe("la demande à l'approche (une fois par épisode)", () => {
  it("sous l'approche (3 999,99 €) : rien", () => {
    expect(faitsVigilanceSeuil(lecture([], 399_999), MAINTENANT)).toEqual([]);
  });

  it("cumul illisible ou non lu : rien (on n'écrit pas sur une donnée inconnue)", () => {
    expect(faitsVigilanceSeuil(lecture([], null), MAINTENANT)).toEqual([]);
    expect(faitsVigilanceSeuil(lecture([], undefined), MAINTENANT)).toEqual([]);
  });

  it("à l'approche (4 200 €), sans attestation : une demande, montant tiré de la constante", () => {
    const [f] = faitsVigilanceSeuil(lecture([], 420_000), MAINTENANT);
    expect(f?.origineId).toBe("aucune");
    expect(f?.etat.actionFaite).toBe(false);
    expect((f?.payload.valeurs as Record<string, string>).montant).toMatch(/^5\s000 €$/);
    const d = decisionCampagne({
      etat: f!.etat,
      maintenant: MAINTENANT,
      regle: REGLE_VIGILANCE_SEUIL,
    });
    expect(d.envoyer).toBe(true);
    expect(cleRelance(CAMPAGNE_VIGILANCE_SEUIL.id, T1, f!.origineId, "demande")).toBe(
      `fi-seuil-urssaf-${T1}-aucune-demande`,
    );
  });

  it("déjà demandée dans cet épisode : plus rien (plafond)", () => {
    const l = lecture([], 420_000, {
      envois: [
        {
          entityId: T1,
          jobId: `fi-seuil-urssaf-${T1}-aucune-demande`,
          at: new Date(MAINTENANT.getTime() - 3 * JOUR),
        },
      ],
    });
    const [f] = faitsVigilanceSeuil(l, MAINTENANT);
    const d = decisionCampagne({
      etat: f!.etat,
      maintenant: MAINTENANT,
      regle: REGLE_VIGILANCE_SEUIL,
    });
    expect(d).toMatchObject({ envoyer: false, motif: "plafond" });
  });

  it("un envoi de S6 (`fi-vigilance-…`) ne compte pas comme une demande au seuil", () => {
    const l = lecture([], 420_000, {
      envois: [{ entityId: T1, jobId: `fi-vigilance-${T1}-aucune-j15`, at: MAINTENANT }],
    });
    expect(faitsVigilanceSeuil(l, MAINTENANT)[0]?.etat.envois).toEqual([]);
  });

  it("attestation déposée, en vérification : action faite", () => {
    const [f] = faitsVigilanceSeuil(
      lecture([attestation({ statutValidation: "en_attente", valideAt: null })], 420_000),
      MAINTENANT,
    );
    expect(f?.etat.actionFaite).toBe(true);
  });

  it("attestation valable : rien", () => {
    expect(faitsVigilanceSeuil(lecture([attestation()], 420_000), MAINTENANT)).toEqual([]);
  });

  it("à l'approche, attestation échue : un nouvel épisode, clé = cette attestation", () => {
    const echue = attestation({
      dateEmission: new Date(MAINTENANT.getTime() - 200 * JOUR),
      createdAt: new Date(MAINTENANT.getTime() - 200 * JOUR),
    });
    const [f] = faitsVigilanceSeuil(lecture([echue], 450_000), MAINTENANT);
    expect(f?.origineId).toBe(ATT);
  });

  it("au seuil sans aucune attestation : la demande part aussi (premier franchissement)", () => {
    expect(faitsVigilanceSeuil(lecture([], 500_000), MAINTENANT)).toHaveLength(1);
  });

  it("au seuil, attestation ÉCHUE : c'est S6 qui relance, pas cette campagne", () => {
    const echue = attestation({
      dateEmission: new Date(MAINTENANT.getTime() - 190 * JOUR),
    });
    expect(faitsVigilanceSeuil(lecture([echue], 600_000), MAINTENANT)).toEqual([]);
    expect(faitsVigilance(lecture([echue], 600_000), MAINTENANT)).toHaveLength(1);
  });
});

describe("le renouvellement (S6) ne vise que les formateurs au seuil", () => {
  // Échéance dans 10 jours : dans la fenêtre de S6.
  const aRenouveler = attestation({
    dateEmission: new Date(MAINTENANT.getTime() - 173 * JOUR),
  });

  it("sous le seuil (4 900 €) : aucun rappel de renouvellement", () => {
    expect(faitsVigilance(lecture([aRenouveler], 490_000), MAINTENANT)).toEqual([]);
  });

  it("au seuil (5 000 €) : le rappel part", () => {
    expect(faitsVigilance(lecture([aRenouveler], 500_000), MAINTENANT)).toHaveLength(1);
  });

  it("cumul illisible : comme avant le lot (garde fermée)", () => {
    expect(faitsVigilance(lecture([aRenouveler], null), MAINTENANT)).toHaveLength(1);
    expect(faitsVigilance(lecture([aRenouveler], undefined), MAINTENANT)).toHaveLength(1);
  });
});

describe("la relecture au départ distingue les deux campagnes de F40", () => {
  it("variante 4 relue avec la demande au seuil : interrupteurs coupés → retenue", async () => {
    const motif = await motifRetenueRelancePiece(
      CAMPAGNE_VIGILANCE.gabarit,
      "Trainer",
      T1,
      { origineRelance: "aucune", etape: 4 },
      async () => false,
    );
    expect(motif).toBe("relances des pièces coupées");
  });
});
