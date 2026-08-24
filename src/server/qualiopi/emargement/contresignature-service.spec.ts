/**
 * Tests — contresignature-service.ts
 *
 * Premier (et seul) écrivain de la table `emargement_contresignatures`, jusqu'ici
 * complète et vide. Mêmes trois familles d'invariants que le service stagiaire :
 *
 *  1. **Aucune écriture sur un refus** — ni objet R2, ni ligne.
 *  2. **Le snapshot est figé** — intitulé, horaires, modules et nom du formateur
 *     sont recalculables depuis la ligne, donc le chaînage prouve quelque chose.
 *  3. **Le chaînage est réel** — `prevHash` vient d'une relecture DANS la
 *     transaction, portée (session × formateur), ordre `createdAt`.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: { findUnique: vi.fn() },
    trainer: { findUnique: vi.fn() },
    emargementContresignature: { findFirst: vi.fn(), create: vi.fn(), count: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("./storage", () => ({
  storeSignatureImage: vi.fn(),
  supprimerImageSignature: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { storeSignatureImage, supprimerImageSignature } from "./storage";
import { contresignerDemiJournee } from "./contresignature-service";
import {
  calculerSelfHashContresignature,
  tupleContresignatureDepuisLigne,
  maillonContresignatureDepuisLigne,
  type LigneContresignature,
} from "./contresignature-hash";
import { verifierChaine } from "./hash";
// 🔴 2026-08-24 — la contresignature scelle désormais SA PROPRE version, et non
//    celle du texte du stagiaire : le formateur lit un texte différent, et deux
//    textes ne peuvent pas partager une `mention_version`.
//    On importe la constante plutôt que d'écrire « cs-v1 » en dur : un littéral
//    redeviendrait faux au premier incrément, sans que rien ne le signale.
import { MENTION_VERSION_CONTRESIGNATURE } from "./mentions";
import { Prisma } from "../../../../prisma/generated/client";

const mockPrisma = prisma as unknown as {
  trainingSession: { findUnique: ReturnType<typeof vi.fn> };
  trainer: { findUnique: ReturnType<typeof vi.fn> };
  emargementContresignature: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};
const mockStore = storeSignatureImage as unknown as ReturnType<typeof vi.fn>;
const mockSupprimerImage = supprimerImageSignature as unknown as ReturnType<typeof vi.fn>;

/** 10 juin 2026, 10 h 00 Paris (08:00 UTC, heure d'été) — la matinée a commencé. */
const MAINTENANT = new Date("2026-06-10T08:00:00.000Z");
const IMAGE = "data:image/png;base64,AAAA";

function entree(over: Record<string, unknown> = {}) {
  return {
    sessionId: "ses-1",
    date: "2026-06-10",
    demiJournee: "matin" as const,
    trainerId: "tr-1",
    methode: "canvas" as const,
    imageDataUrl: IMAGE,
    ipHash: "ip".repeat(32),
    userAgentSha256: "ua".repeat(32),
    maintenant: MAINTENANT,
    ...over,
  };
}

function sessionMock(over: Record<string, unknown> = {}) {
  return {
    id: "ses-1",
    statut: "en_cours",
    titreSession: "Bien démarrer avec l'IA",
    jours: [
      {
        date: new Date("2026-06-10T00:00:00.000Z"),
        heureDebut: "09:00",
        heureFin: "17:00",
        modules: ["Module 1 — Cadrage"],
      },
    ],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // ⚠️ `clearAllMocks` efface les appels, pas les valeurs de retour.
  mockPrisma.trainingSession.findUnique.mockResolvedValue(sessionMock());
  mockPrisma.trainer.findUnique.mockResolvedValue({ nom: "Jullin", prenom: "Williams" });
  mockPrisma.emargementContresignature.findFirst.mockResolvedValue(null);
  mockPrisma.emargementContresignature.create.mockImplementation(
    async (args: { data: { id: string; selfHash: string } }) => ({
      id: args.data.id,
      selfHash: args.data.selfHash,
    }),
  );
  mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb(mockPrisma),
  );
  mockStore.mockResolvedValue({
    key: "emargement/2026/contresignatures/x.png",
    sha256: "b".repeat(64),
    mimeType: "image/png",
    sizeBytes: 1234,
    id: "x",
  });
});

/** Données passées à `create`, pour inspection. */
function donneesCreees(): Record<string, unknown> {
  return (
    mockPrisma.emargementContresignature.create.mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    }
  ).data;
}

describe("contresignerDemiJournee — refus sans écriture", () => {
  it("refuse une session introuvable", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(null);
    const r = await contresignerDemiJournee(entree());
    expect(r).toMatchObject({ ok: false, raison: "session_introuvable" });
    expect(mockPrisma.emargementContresignature.create).not.toHaveBeenCalled();
    expect(mockStore).not.toHaveBeenCalled();
  });

  it("refuse une session annulée ou reportée", async () => {
    for (const statut of ["annulee", "reportee"]) {
      vi.clearAllMocks();
      mockPrisma.trainingSession.findUnique.mockResolvedValue(sessionMock({ statut }));
      const r = await contresignerDemiJournee(entree());
      expect(r).toMatchObject({ ok: false, raison: "session_close" });
      expect(mockStore).not.toHaveBeenCalled();
    }
  });

  it("refuse une journée non déclarée", async () => {
    const r = await contresignerDemiJournee(entree({ date: "2026-06-11" }));
    expect(r).toMatchObject({ ok: false, raison: "journee_non_declaree" });
    expect(mockStore).not.toHaveBeenCalled();
  });

  it("refuse un formateur introuvable", async () => {
    mockPrisma.trainer.findUnique.mockResolvedValue(null);
    const r = await contresignerDemiJournee(entree());
    expect(r).toMatchObject({ ok: false, raison: "formateur_introuvable" });
    expect(mockStore).not.toHaveBeenCalled();
  });

  it("refuse une demi-journée non commencée", async () => {
    // 07 h 00 Paris (05:00 UTC) : avant le début à 09 h 00.
    const r = await contresignerDemiJournee(
      entree({ maintenant: new Date("2026-06-10T05:00:00.000Z") }),
    );
    expect(r).toMatchObject({ ok: false, raison: "pas_encore_commence" });
    expect(mockStore).not.toHaveBeenCalled();
  });

  it("refuse une demi-journée déjà contresignée par ce formateur", async () => {
    mockPrisma.emargementContresignature.findFirst.mockResolvedValue({ id: "deja" });
    const r = await contresignerDemiJournee(entree());
    expect(r).toMatchObject({ ok: false, raison: "deja_contresigne" });
    expect(mockStore).not.toHaveBeenCalled();
    expect(mockPrisma.emargementContresignature.create).not.toHaveBeenCalled();
  });

  it("refuse le tracé absent", async () => {
    const r = await contresignerDemiJournee(entree({ imageDataUrl: undefined }));
    expect(r).toMatchObject({ ok: false, raison: "image_requise" });
  });

  it("refuse la modalité accessible sans nom", async () => {
    const r = await contresignerDemiJournee(
      entree({ methode: "confirmation_accessible", imageDataUrl: undefined }),
    );
    expect(r).toMatchObject({ ok: false, raison: "nom_requis" });
  });

  it("refuse un nom qui ne concorde pas avec le compte formateur", async () => {
    const r = await contresignerDemiJournee(
      entree({
        methode: "confirmation_accessible",
        imageDataUrl: undefined,
        nomConfirme: "Quelqu'un d'Autre",
      }),
    );
    expect(r).toMatchObject({ ok: false, raison: "nom_non_concordant" });
  });

  it("refuse un programme mal formé (modules non tableau de chaînes)", async () => {
    mockPrisma.trainingSession.findUnique.mockResolvedValue(
      sessionMock({
        jours: [
          {
            date: new Date("2026-06-10T00:00:00.000Z"),
            heureDebut: "09:00",
            heureFin: "17:00",
            modules: [{ pas: "une chaîne" }],
          },
        ],
      }),
    );
    const r = await contresignerDemiJournee(entree());
    expect(r).toMatchObject({ ok: false, raison: "modules_invalides" });
    expect(mockStore).not.toHaveBeenCalled();
  });
});

describe("contresignerDemiJournee — écriture conforme", () => {
  it("écrit une contresignature avec le snapshot figé et le nom du formateur", async () => {
    const r = await contresignerDemiJournee(entree());
    expect(r.ok).toBe(true);

    const d = donneesCreees();
    expect(d).toMatchObject({
      contexteType: "collectif",
      sessionId: "ses-1",
      trainerId: "tr-1",
      demiJournee: "matin",
      heureDebut: "09:00",
      heureFin: "17:00",
      formationIntitule: "Bien démarrer avec l'IA",
      formateurNom: "Williams Jullin",
      methode: "canvas",
      mentionVersion: MENTION_VERSION_CONTRESIGNATURE,
    });
    expect(d["modulesSnapshot"]).toEqual(["Module 1 — Cadrage"]);
    // Date scellée à minuit UTC, comme une colonne @db.Date.
    expect((d["date"] as Date).toISOString()).toBe("2026-06-10T00:00:00.000Z");
    // Image hachée, clé posée.
    expect(d["signatureSha256"]).toBe("b".repeat(64));
    expect(d["signatureKey"]).toBe("emargement/2026/contresignatures/x.png");
  });

  it("ne stocke AUCUNE image en modalité accessible", async () => {
    const r = await contresignerDemiJournee(
      entree({
        methode: "confirmation_accessible",
        imageDataUrl: undefined,
        nomConfirme: "williams jullin",
      }),
    );
    expect(r.ok).toBe(true);
    expect(mockStore).not.toHaveBeenCalled();
    const d = donneesCreees();
    expect(d["signatureKey"]).toBeNull();
    expect(d["signatureSha256"]).toBeNull();
  });

  it("le selfHash écrit est celui que recalcule le module pur", async () => {
    await contresignerDemiJournee(entree());
    const d = donneesCreees();
    const ligne: LigneContresignature = {
      id: d["id"] as string,
      contexteType: "collectif",
      sessionId: d["sessionId"] as string,
      coachingId: null,
      trainerId: d["trainerId"] as string,
      formateurNom: d["formateurNom"] as string,
      date: d["date"] as Date,
      demiJournee: "matin",
      heureDebut: d["heureDebut"] as string,
      heureFin: d["heureFin"] as string,
      formationIntitule: d["formationIntitule"] as string,
      modulesSnapshot: d["modulesSnapshot"],
      methode: "canvas",
      signatureSha256: d["signatureSha256"] as string,
      signeAt: d["signeAt"] as Date,
      ipHash: d["ipHash"] as string,
      userAgentSha256: d["userAgentSha256"] as string,
      mentionVersion: d["mentionVersion"] as string,
      prevHash: (d["prevHash"] as string | null) ?? null,
      selfHash: d["selfHash"] as string,
      hashVersion: d["hashVersion"] as number,
    };
    const tuple = tupleContresignatureDepuisLigne(ligne);
    expect(tuple).not.toBeNull();
    expect(calculerSelfHashContresignature(tuple!)).toBe(d["selfHash"]);
  });

  it("chaîne sur la contresignature précédente du MÊME formateur (prevHash relu)", async () => {
    mockPrisma.emargementContresignature.findFirst.mockImplementation(
      async (args: { where: Record<string, unknown> }) => {
        // Le déjà-signé (avec demiJournee) répond null ; la relecture de chaîne
        // (sans demiJournee) répond la tête précédente.
        return args.where["demiJournee"] === undefined ? { selfHash: "c".repeat(64) } : null;
      },
    );
    await contresignerDemiJournee(entree());
    expect(donneesCreees()["prevHash"]).toBe("c".repeat(64));
  });

  it("produit une chaîne vérifiable de deux contresignatures", async () => {
    // 1re contresignature (matin) — pas de précédente.
    await contresignerDemiJournee(entree());
    const d1 = donneesCreees();

    // 2e (après-midi) — chaînée sur la 1re.
    mockPrisma.emargementContresignature.create.mockClear();
    mockPrisma.emargementContresignature.findFirst.mockImplementation(
      async (args: { where: Record<string, unknown> }) =>
        args.where["demiJournee"] === undefined ? { selfHash: d1["selfHash"] } : null,
    );
    // 15 h 00 Paris (13:00 UTC) : l'après-midi a commencé.
    await contresignerDemiJournee(
      entree({ demiJournee: "apres_midi", maintenant: new Date("2026-06-10T13:00:00.000Z") }),
    );
    const d2 = donneesCreees();

    const ligneMock = (d: Record<string, unknown>): LigneContresignature => ({
      id: d["id"] as string,
      contexteType: "collectif",
      sessionId: d["sessionId"] as string,
      coachingId: null,
      trainerId: d["trainerId"] as string,
      formateurNom: d["formateurNom"] as string,
      date: d["date"] as Date,
      demiJournee: d["demiJournee"] as "matin" | "apres_midi" | "journee",
      heureDebut: d["heureDebut"] as string,
      heureFin: d["heureFin"] as string,
      formationIntitule: d["formationIntitule"] as string,
      modulesSnapshot: d["modulesSnapshot"],
      methode: "canvas",
      signatureSha256: d["signatureSha256"] as string,
      signeAt: d["signeAt"] as Date,
      ipHash: d["ipHash"] as string,
      userAgentSha256: d["userAgentSha256"] as string,
      mentionVersion: d["mentionVersion"] as string,
      prevHash: (d["prevHash"] as string | null) ?? null,
      selfHash: d["selfHash"] as string,
      hashVersion: d["hashVersion"] as number,
    });

    const res = verifierChaine(
      [ligneMock(d1), ligneMock(d2)].map(maillonContresignatureDepuisLigne),
    );
    expect(res.valide).toBe(true);
  });
});

describe("contresignerDemiJournee — concurrence", () => {
  it("traduit un conflit d'unicité déjà-posé en refus deja_contresigne, et nettoie l'image", async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError("unique", {
      code: "P2002",
      clientVersion: "5",
    });
    mockPrisma.emargementContresignature.create.mockRejectedValue(p2002);
    mockPrisma.emargementContresignature.count.mockResolvedValue(1);

    const r = await contresignerDemiJournee(entree());
    expect(r).toMatchObject({ ok: false, raison: "deja_contresigne" });
    // L'image écrite avant la transaction ne doit pas rester orpheline sur R2.
    expect(mockSupprimerImage).toHaveBeenCalledWith("emargement/2026/contresignatures/x.png");
  });
});
