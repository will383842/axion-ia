/**
 * QNC L06 — émargement par demi-journée, derrière `qualiopi.emargement.actif`.
 *
 * Ce que ces tests tiennent :
 *   1. le lien du stagiaire est REFUSÉ hors du créneau de sa demi-journée ;
 *   2. le jeton expire à la fin de SA demi-journée, et après la dernière aucun
 *      lien ne s'émet (fin de la réouverture de 48 h) ;
 *   3. la signature « nom tapé » est réservée aux personnes qui ont une
 *      adaptation ;
 *   4. le formateur contresigne le jour même ;
 *   5. ÉTEINT (clé absente) ou en ESSAI sur une session réelle : le
 *      comportement d'avant, à l'identique.
 *
 * L'interrupteur est lu pour de vrai (`socle/interrupteurs.ts`) : seule la
 * table `settings` est simulée.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: { findUnique: vi.fn() },
    presenceCreneau: { findUnique: vi.fn(), update: vi.fn() },
    emargementSignature: { findFirst: vi.fn(), create: vi.fn(), count: vi.fn() },
    emargementToken: { updateMany: vi.fn(), create: vi.fn() },
    emargementContresignature: { findFirst: vi.fn(), create: vi.fn(), count: vi.fn() },
    enrollment: { updateMany: vi.fn(), findUnique: vi.fn() },
    trainingSession: { findFirst: vi.fn(), findUnique: vi.fn() },
    trainer: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/magic-token", () => ({ signMagicToken: vi.fn(), verifyMagicToken: vi.fn() }));
vi.mock("../../storage", () => ({
  storeSignatureImage: vi.fn(),
  supprimerImageSignature: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/server/qualiopi/presence/presence-service", () => ({ recomputeTauxPresence: vi.fn() }));
vi.mock("@/server/qualiopi/indicateurs/service", () => ({ invalidateIndicateursCache: vi.fn() }));
vi.mock("@/server/qualiopi/adaptation/colonne-declaration", () => ({
  colonneDeclarationDisponible: vi.fn(async () => true),
}));

import { prisma } from "@/lib/prisma";
import { signMagicToken } from "@/lib/magic-token";
import { storeSignatureImage } from "../../storage";
import { signerCreneau } from "../../signature-service";
import { contresignerDemiJournee } from "../../contresignature-service";
import {
  creerTokenInscription,
  FENETRE_APRES_FIN_MS,
  TokenEmargementError,
} from "../../token-service";

type Fn = ReturnType<typeof vi.fn>;
const db = prisma as unknown as {
  setting: { findUnique: Fn };
  presenceCreneau: { findUnique: Fn; update: Fn };
  emargementSignature: { findFirst: Fn; create: Fn; count: Fn };
  emargementToken: { updateMany: Fn; create: Fn };
  emargementContresignature: { findFirst: Fn; create: Fn; count: Fn };
  enrollment: { updateMany: Fn; findUnique: Fn };
  trainingSession: { findFirst: Fn; findUnique: Fn };
  trainer: { findUnique: Fn };
  $transaction: Fn;
};

const JOUR = "2026-10-15";
const JOUR_DATE = new Date(`${JOUR}T00:00:00.000Z`);
/** 10 h 00 Paris : le matin (09:00–13:00) est ouvert. */
const PENDANT_LE_MATIN = new Date("2026-10-15T08:00:00.000Z");
/** 14 h 00 Paris : le matin est clos. */
const APRES_LE_MATIN = new Date("2026-10-15T12:00:00.000Z");
/** Le lendemain, 10 h 00 Paris. */
const LE_LENDEMAIN = new Date("2026-10-16T08:00:00.000Z");
const IMAGE = "data:image/png;base64,AAAA";
const STAGIAIRE = { type: "stagiaire", enrollmentId: "enr-1", tokenId: "tok-1" } as const;

function interrupteur(etat: "eteint" | "essai" | "actif" | null): void {
  db.setting.findUnique.mockResolvedValue(etat === null ? null : { value: { etat } });
}

function creneau(estTestInterne = false) {
  return {
    id: "cre-1",
    date: JOUR_DATE,
    demiJournee: "matin",
    dureePrevueMinutes: 240,
    importId: null,
    enrollmentId: "enr-1",
    enrollment: {
      id: "enr-1",
      statut: "inscrit",
      trainee: { nom: "Dupont", prenom: "Alice", email: "alice@example.test" },
      session: {
        id: "ses-1",
        statut: "en_cours",
        titreSession: "Bien démarrer avec l'IA",
        dateDebut: JOUR_DATE,
        estTestInterne,
        formateurPrincipal: { nom: "Jullin", prenom: "Williams" },
        jours: [
          {
            date: JOUR_DATE,
            heureDebut: "09:00",
            heureFin: "17:00",
            modules: ["Module 1 — Cadrage"],
            trainer: null,
          },
        ],
      },
    },
    emargementSignatures: [],
  };
}

function adaptation(a: { handicap?: boolean; adaptations?: string | null } = {}) {
  db.enrollment.findUnique.mockResolvedValue({
    adaptationsRealisees: a.adaptations ?? null,
    besoinAdaptationDeclareAt: null,
    trainee: { situationHandicap: a.handicap ?? false },
    questionnaires: [],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  interrupteur(null);
  db.presenceCreneau.findUnique.mockResolvedValue(creneau());
  db.presenceCreneau.update.mockResolvedValue({ id: "cre-1" });
  db.enrollment.updateMany.mockResolvedValue({ count: 1 });
  db.emargementSignature.findFirst.mockResolvedValue(null);
  db.emargementSignature.create.mockImplementation(
    async (args: { data: { id: string; selfHash: string } }) => ({
      id: args.data.id,
      selfHash: args.data.selfHash,
    }),
  );
  db.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(db));
  (storeSignatureImage as unknown as Fn).mockResolvedValue({
    key: "k.png",
    sha256: "a".repeat(64),
    mimeType: "image/png",
    sizeBytes: 10,
  });
  (signMagicToken as unknown as Fn).mockResolvedValue("tok.en");
  db.emargementToken.updateMany.mockResolvedValue({ count: 0 });
  db.emargementToken.create.mockResolvedValue({ id: "tok-1" });
  adaptation();
});

describe("signerCreneau — le lien du stagiaire est fermé hors du créneau", () => {
  it("ACTIF : signature refusée après la fin de la demi-journée, sans aucune écriture", async () => {
    interrupteur("actif");
    const r = await signerCreneau({
      creneauId: "cre-1",
      porteur: STAGIAIRE,
      methode: "canvas",
      imageDataUrl: IMAGE,
      maintenant: APRES_LE_MATIN,
    });
    expect(r).toMatchObject({ ok: false, raison: "hors_creneau" });
    expect(storeSignatureImage).not.toHaveBeenCalled();
    expect(db.emargementSignature.create).not.toHaveBeenCalled();
  });

  it("ACTIF : refusée le lendemain aussi (plus de fenêtre de 48 h)", async () => {
    interrupteur("actif");
    const r = await signerCreneau({
      creneauId: "cre-1",
      porteur: STAGIAIRE,
      methode: "canvas",
      imageDataUrl: IMAGE,
      maintenant: LE_LENDEMAIN,
    });
    expect(r).toMatchObject({ ok: false, raison: "hors_creneau" });
  });

  it("ACTIF : acceptée PENDANT la demi-journée", async () => {
    interrupteur("actif");
    const r = await signerCreneau({
      creneauId: "cre-1",
      porteur: STAGIAIRE,
      methode: "canvas",
      imageDataUrl: IMAGE,
      maintenant: PENDANT_LE_MATIN,
    });
    expect(r.ok).toBe(true);
  });

  it("ACTIF : le recueil sur le poste du formateur n'est pas un lien, il n'est pas fermé", async () => {
    interrupteur("actif");
    const r = await signerCreneau({
      creneauId: "cre-1",
      porteur: { type: "formateur", sessionId: "ses-1", trainerId: "tr-1" },
      methode: "canvas",
      imageDataUrl: IMAGE,
      maintenant: APRES_LE_MATIN,
    });
    expect(r.ok).toBe(true);
  });

  it("ÉTEINT (clé absente) : comportement inchangé, la demi-journée passée se signe", async () => {
    const r = await signerCreneau({
      creneauId: "cre-1",
      porteur: STAGIAIRE,
      methode: "canvas",
      imageDataUrl: IMAGE,
      maintenant: LE_LENDEMAIN,
    });
    expect(r.ok).toBe(true);
  });

  it("ESSAI : n'agit que sur le banc d'essai", async () => {
    interrupteur("essai");
    const reelle = await signerCreneau({
      creneauId: "cre-1",
      porteur: STAGIAIRE,
      methode: "canvas",
      imageDataUrl: IMAGE,
      maintenant: LE_LENDEMAIN,
    });
    expect(reelle.ok).toBe(true);

    db.presenceCreneau.findUnique.mockResolvedValue(creneau(true));
    const test = await signerCreneau({
      creneauId: "cre-1",
      porteur: STAGIAIRE,
      methode: "canvas",
      imageDataUrl: IMAGE,
      maintenant: LE_LENDEMAIN,
    });
    expect(test).toMatchObject({ ok: false, raison: "hors_creneau" });
  });
});

describe("signerCreneau — « nom tapé » réservé aux personnes qui ont une adaptation", () => {
  const accessible = {
    creneauId: "cre-1",
    porteur: STAGIAIRE,
    methode: "confirmation_accessible" as const,
    nomConfirme: "Alice Dupont",
    maintenant: PENDANT_LE_MATIN,
  };

  it("ACTIF, sans adaptation : refusé", async () => {
    interrupteur("actif");
    expect(await signerCreneau(accessible)).toMatchObject({
      ok: false,
      raison: "nom_tape_reserve_adaptation",
    });
    expect(db.emargementSignature.create).not.toHaveBeenCalled();
  });

  it("ACTIF, « aucune adaptation nécessaire » consignée : refusé", async () => {
    interrupteur("actif");
    adaptation({ adaptations: "Échange avec le bénéficiaire : aucune adaptation nécessaire." });
    expect((await signerCreneau(accessible)).ok).toBe(false);
  });

  it("ACTIF, situation de handicap déclarée : accepté", async () => {
    interrupteur("actif");
    adaptation({ handicap: true });
    expect((await signerCreneau(accessible)).ok).toBe(true);
  });

  it("ACTIF, adaptation consignée par l'organisme : accepté", async () => {
    interrupteur("actif");
    adaptation({ adaptations: "Supports en gros caractères." });
    expect((await signerCreneau(accessible)).ok).toBe(true);
  });

  it("ÉTEINT : ouvert à tous, comme avant — l'adaptation n'est même pas lue", async () => {
    expect((await signerCreneau(accessible)).ok).toBe(true);
    expect(db.enrollment.findUnique).not.toHaveBeenCalled();
  });
});

describe("creerTokenInscription — un jeton par stagiaire et par demi-journée", () => {
  const dateFinSession = new Date("2026-10-16T15:00:00.000Z");

  function sessionDuJeton(estTestInterne = false) {
    db.trainingSession.findFirst.mockResolvedValue({
      lieuType: "nos_locaux",
      lieuVisioUrl: null,
      estTestInterne,
      jours: [{ horairesConfirmes: true }],
    });
    db.enrollment.findUnique.mockResolvedValue({
      presences: [
        { id: "c-m", date: JOUR_DATE, demiJournee: "matin" },
        { id: "c-a", date: JOUR_DATE, demiJournee: "apres_midi" },
      ],
      session: { jours: [{ date: JOUR_DATE, heureDebut: "09:00", heureFin: "17:00" }] },
    });
  }

  it("ACTIF : expire à la fin de la demi-journée en cours", async () => {
    interrupteur("actif");
    sessionDuJeton();
    const r = await creerTokenInscription({
      enrollmentId: "enr-1",
      dateFinSession,
      destinataireEmail: "alice@example.test",
      maintenant: PENDANT_LE_MATIN,
    });
    expect(r.expiresAt.toISOString()).toBe("2026-10-15T11:00:00.000Z");
    expect(r.demiJournee?.prevue.creneauId).toBe("c-m");
    expect(db.emargementToken.create.mock.calls[0]?.[0].data.expiresAt).toEqual(r.expiresAt);
  });

  it("ACTIF : après la dernière demi-journée, AUCUN lien — pas de réouverture", async () => {
    interrupteur("actif");
    sessionDuJeton();
    await expect(
      creerTokenInscription({
        enrollmentId: "enr-1",
        dateFinSession,
        destinataireEmail: "alice@example.test",
        maintenant: LE_LENDEMAIN,
      }),
    ).rejects.toMatchObject({ motif: "hors_demi_journee" });
    expect(db.emargementToken.create).not.toHaveBeenCalled();
    await expect(
      creerTokenInscription({
        enrollmentId: "enr-1",
        dateFinSession,
        destinataireEmail: "alice@example.test",
        maintenant: LE_LENDEMAIN,
      }),
    ).rejects.toBeInstanceOf(TokenEmargementError);
  });

  it("ÉTEINT : fin de session + 48 h, plancher compris, comme avant", async () => {
    sessionDuJeton();
    const r = await creerTokenInscription({
      enrollmentId: "enr-1",
      dateFinSession,
      destinataireEmail: "alice@example.test",
      maintenant: LE_LENDEMAIN,
    });
    expect(r.expiresAt.getTime()).toBe(dateFinSession.getTime() + FENETRE_APRES_FIN_MS);
    expect(r.demiJournee).toBeUndefined();
  });
});

describe("contresignerDemiJournee — le jour même", () => {
  function sessionContresignee(estTestInterne = false) {
    db.trainingSession.findUnique.mockResolvedValue({
      id: "ses-1",
      statut: "en_cours",
      titreSession: "Bien démarrer avec l'IA",
      estTestInterne,
      jours: [
        {
          date: JOUR_DATE,
          heureDebut: "09:00",
          heureFin: "17:00",
          modules: ["Module 1"],
          trainerId: null,
        },
      ],
      sessionFormateurs: [],
    });
    db.trainer.findUnique.mockResolvedValue({
      nom: "Jullin",
      prenom: "Williams",
      statut: "salarie",
    });
    db.emargementContresignature.findFirst.mockResolvedValue(null);
    db.emargementContresignature.create.mockImplementation(
      async (args: { data: { id: string; selfHash: string } }) => ({
        id: args.data.id,
        selfHash: args.data.selfHash,
      }),
    );
  }
  const entree = {
    sessionId: "ses-1",
    date: JOUR,
    demiJournee: "matin" as const,
    trainerId: "tr-1",
    methode: "canvas" as const,
    imageDataUrl: IMAGE,
  };

  it("ACTIF : refusée le lendemain", async () => {
    interrupteur("actif");
    sessionContresignee();
    expect(await contresignerDemiJournee({ ...entree, maintenant: LE_LENDEMAIN })).toMatchObject({
      ok: false,
      raison: "hors_jour",
    });
    expect(db.emargementContresignature.create).not.toHaveBeenCalled();
  });

  it("ACTIF : acceptée le jour même, même après la demi-journée", async () => {
    interrupteur("actif");
    sessionContresignee();
    expect((await contresignerDemiJournee({ ...entree, maintenant: APRES_LE_MATIN })).ok).toBe(
      true,
    );
  });

  it("ÉTEINT : le lendemain reste possible, comme avant", async () => {
    sessionContresignee();
    expect((await contresignerDemiJournee({ ...entree, maintenant: LE_LENDEMAIN })).ok).toBe(true);
  });
});
