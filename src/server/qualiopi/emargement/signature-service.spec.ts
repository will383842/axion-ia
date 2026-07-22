/**
 * Tests — signature-service.ts
 *
 * C'est le seul endroit du dépôt qui écrit une signature. Trois familles
 * d'invariants, et les violer ne se voit pas :
 *
 *  1. **Aucune écriture sur un refus.** Un créneau non commencé, sans horaires
 *     déclarés ou sans formateur ne doit produire NI objet R2, NI ligne.
 *  2. **Le snapshot est figé, pas joint.** Renommer une formation après coup ne
 *     doit rien changer à ce qui a été signé.
 *  3. **Le chaînage est réel.** `prevHash` vient d'une relecture DANS la
 *     transaction, pas d'une valeur portée par l'appelant.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    presenceCreneau: { findUnique: vi.fn(), update: vi.fn() },
    emargementSignature: { findFirst: vi.fn(), create: vi.fn(), count: vi.fn() },
    enrollment: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("./storage", () => ({
  storeSignatureImage: vi.fn(),
  supprimerImageSignature: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

// H4 — le service reporte la présence après signature ; isolé ici pour ne tester
// que la logique de signature (le calcul du taux a ses propres tests).
vi.mock("@/server/qualiopi/presence/presence-service", () => ({ recomputeTauxPresence: vi.fn() }));
vi.mock("@/server/qualiopi/indicateurs/service", () => ({ invalidateIndicateursCache: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { storeSignatureImage, supprimerImageSignature } from "./storage";
import { signerCreneau } from "./signature-service";
import { calculerSelfHash, verifierChaine, type TupleSignatureV1 } from "./hash";
import { maillonDepuisLigne, type LigneSignature } from "./reconstruction";
import { MENTION_VERSION } from "./mentions";
import { Prisma } from "../../../../prisma/generated/client";

const mockPrisma = prisma as unknown as {
  presenceCreneau: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  emargementSignature: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  enrollment: { updateMany: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};
const mockStore = storeSignatureImage as unknown as ReturnType<typeof vi.fn>;
const mockSupprimerImage = supprimerImageSignature as unknown as ReturnType<typeof vi.fn>;

/** 10 juin 2026, 10 h 00 Paris (08:00 UTC, heure d'été) — la matinée a commencé. */
const MAINTENANT = new Date("2026-06-10T08:00:00.000Z");
const IMAGE = "data:image/png;base64,AAAA";
const PORTEUR_STAGIAIRE = { type: "stagiaire", enrollmentId: "enr-1", tokenId: "tok-1" } as const;

function contexte(over: Record<string, unknown> = {}) {
  return {
    id: "cre-1",
    date: new Date("2026-06-10T00:00:00.000Z"),
    demiJournee: "matin",
    dureePrevueMinutes: 210,
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
        dateDebut: new Date("2026-06-10T09:00:00.000Z"),
        formation: { titre: "Titre catalogue" },
        formateurPrincipal: { nom: "Jullin", prenom: "Williams" } as {
          nom: string;
          prenom: string;
        } | null,
        jours: [
          {
            date: new Date("2026-06-10T00:00:00.000Z"),
            heureDebut: "09:00",
            heureFin: "17:00",
            modules: ["Module 1 — Cadrage"],
            trainer: null as { nom: string; prenom: string } | null,
          },
        ],
      },
    },
    emargementSignatures: [],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // ⚠️ `clearAllMocks` efface les appels, pas les valeurs de retour.
  mockPrisma.presenceCreneau.findUnique.mockResolvedValue(contexte());
  mockPrisma.presenceCreneau.update.mockResolvedValue({ id: "cre-1" });
  mockPrisma.enrollment.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.emargementSignature.findFirst.mockResolvedValue(null);
  mockPrisma.emargementSignature.create.mockImplementation(
    async (args: { data: { id: string; selfHash: string } }) => ({
      id: args.data.id,
      selfHash: args.data.selfHash,
    }),
  );
  mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb(mockPrisma),
  );
  mockStore.mockResolvedValue({
    key: "emargement/2026/signatures/x.png",
    sha256: "a".repeat(64),
    mimeType: "image/png",
    sizeBytes: 1234,
    id: "x",
  });
});

/** Données passées à `create`, pour inspection. */
function donneesCreees(): Record<string, unknown> {
  return (
    mockPrisma.emargementSignature.create.mock.calls[0]?.[0] as { data: Record<string, unknown> }
  ).data;
}

describe("signerCreneau — H4 : signer vaut présence", () => {
  it("reporte la présence PLEINE d'un créneau présentiel et recalcule le taux", async () => {
    const { recomputeTauxPresence } = await import("@/server/qualiopi/presence/presence-service");
    const { invalidateIndicateursCache } = await import("@/server/qualiopi/indicateurs/service");
    const r = await signerCreneau({
      porteur: PORTEUR_STAGIAIRE,
      creneauId: "cre-1",
      methode: "canvas",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(r.ok).toBe(true);
    // Durée réalisée = durée prévue (210), present=true, dans la transaction.
    expect(mockPrisma.presenceCreneau.update).toHaveBeenCalledWith({
      where: { id: "cre-1" },
      data: { dureeRealiseeMinutes: 210, present: true },
    });
    // Agrégat recalculé + émargement horodaté write-once + cache invalidé.
    expect(recomputeTauxPresence).toHaveBeenCalledWith("enr-1");
    expect(mockPrisma.enrollment.updateMany).toHaveBeenCalledWith({
      where: { id: "enr-1", emargementSigneAt: null },
      data: { emargementSigneAt: MAINTENANT },
    });
    expect(invalidateIndicateursCache).toHaveBeenCalledWith(2026);
  });

  it("NE gonfle PAS la durée d'un créneau distanciel (le relevé de connexion reste la vérité)", async () => {
    mockPrisma.presenceCreneau.findUnique.mockResolvedValue(
      contexte({ importId: "imp-1", dureePrevueMinutes: 210 }),
    );
    const r = await signerCreneau({
      porteur: PORTEUR_STAGIAIRE,
      creneauId: "cre-1",
      methode: "canvas",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(r.ok).toBe(true);
    // La preuve est écrite, mais la durée du créneau distanciel n'est PAS touchée.
    expect(mockPrisma.presenceCreneau.update).not.toHaveBeenCalled();
    // Le taux est tout de même recalculé et l'émargement horodaté.
    const { recomputeTauxPresence } = await import("@/server/qualiopi/presence/presence-service");
    expect(recomputeTauxPresence).toHaveBeenCalledWith("enr-1");
  });

  it("ne touche NI présence NI taux quand la signature est REFUSÉE", async () => {
    mockPrisma.presenceCreneau.findUnique.mockResolvedValue(
      contexte({ emargementSignatures: [{ id: "deja" }] }),
    );
    const { recomputeTauxPresence } = await import("@/server/qualiopi/presence/presence-service");
    const r = await signerCreneau({
      porteur: PORTEUR_STAGIAIRE,
      creneauId: "cre-1",
      methode: "canvas",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(r.ok).toBe(false);
    expect(mockPrisma.presenceCreneau.update).not.toHaveBeenCalled();
    expect(recomputeTauxPresence).not.toHaveBeenCalled();
  });
});

describe("signerCreneau — refus sans AUCUNE écriture", () => {
  it("refuse un créneau introuvable", async () => {
    mockPrisma.presenceCreneau.findUnique.mockResolvedValue(null);
    const r = await signerCreneau({
      porteur: PORTEUR_STAGIAIRE,
      creneauId: "x",
      methode: "canvas",
      imageDataUrl: IMAGE,
    });
    expect(r).toMatchObject({ ok: false, raison: "creneau_introuvable" });
    expect(mockStore).not.toHaveBeenCalled();
  });

  it("refuse un créneau DÉJÀ signé", async () => {
    mockPrisma.presenceCreneau.findUnique.mockResolvedValue(
      contexte({ emargementSignatures: [{ id: "sig-existante" }] }),
    );
    const r = await signerCreneau({
      porteur: PORTEUR_STAGIAIRE,
      creneauId: "cre-1",
      methode: "canvas",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(r).toMatchObject({ ok: false, raison: "deja_signe" });
    expect(mockStore).not.toHaveBeenCalled();
    expect(mockPrisma.emargementSignature.create).not.toHaveBeenCalled();
  });

  it("🔴 refuse si la journée n'a pas d'horaires déclarés", async () => {
    // `heure_debut`/`heure_fin` sont NOT NULL. La seule alternative serait
    // d'inventer un « 09h00–17h00 » — exactement ce que sanctionne CAA Nantes
    // 20/04/2021. On refuse plutôt que de fabriquer une preuve faible.
    const ctx = contexte();
    ctx.enrollment.session.jours = [];
    mockPrisma.presenceCreneau.findUnique.mockResolvedValue(ctx);

    const r = await signerCreneau({
      porteur: PORTEUR_STAGIAIRE,
      creneauId: "cre-1",
      methode: "canvas",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(r).toMatchObject({ ok: false, raison: "journee_non_declaree" });
    expect(mockStore).not.toHaveBeenCalled();
  });

  it("🔴 refuse si aucun formateur n'est affecté", async () => {
    // L'absence du nom du formateur sur la feuille est un motif de redressement
    // à elle seule. Décision de Will : refuser plutôt que de sceller la raison
    // sociale dans une empreinte immuable.
    const ctx = contexte();
    ctx.enrollment.session.formateurPrincipal = null;
    mockPrisma.presenceCreneau.findUnique.mockResolvedValue(ctx);

    const r = await signerCreneau({
      porteur: PORTEUR_STAGIAIRE,
      creneauId: "cre-1",
      methode: "canvas",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(r).toMatchObject({ ok: false, raison: "formateur_absent" });
    expect(mockStore).not.toHaveBeenCalled();
  });

  it("refuse une demi-journée pas encore commencée", async () => {
    // 08:00 Paris = 06:00 UTC : la matinée débute à 09:00.
    const r = await signerCreneau({
      porteur: PORTEUR_STAGIAIRE,
      creneauId: "cre-1",
      methode: "canvas",
      imageDataUrl: IMAGE,
      maintenant: new Date("2026-06-10T06:00:00.000Z"),
    });
    expect(r).toMatchObject({ ok: false, raison: "pas_encore_commence" });
    expect(mockStore).not.toHaveBeenCalled();
  });

  it("refuse un tracé absent", async () => {
    const r = await signerCreneau({
      porteur: PORTEUR_STAGIAIRE,
      creneauId: "cre-1",
      methode: "canvas",
      maintenant: MAINTENANT,
    });
    expect(r).toMatchObject({ ok: false, raison: "image_requise" });
  });

  it("refuse la modalité accessible sans nom saisi", async () => {
    const r = await signerCreneau({
      porteur: PORTEUR_STAGIAIRE,
      creneauId: "cre-1",
      methode: "confirmation_accessible",
      maintenant: MAINTENANT,
    });
    expect(r).toMatchObject({ ok: false, raison: "nom_requis" });
  });

  it("refuse un nom saisi qui ne concorde pas", async () => {
    const r = await signerCreneau({
      porteur: PORTEUR_STAGIAIRE,
      creneauId: "cre-1",
      methode: "confirmation_accessible",
      nomConfirme: "Bob Martin",
      maintenant: MAINTENANT,
    });
    expect(r).toMatchObject({ ok: false, raison: "nom_non_concordant" });
    expect(mockPrisma.emargementSignature.create).not.toHaveBeenCalled();
  });

  it("accepte un nom saisi malgré casse, accents et espaces", async () => {
    // Exiger une frappe au caractère près transformerait une modalité
    // d'accessibilité en obstacle.
    const r = await signerCreneau({
      porteur: PORTEUR_STAGIAIRE,
      creneauId: "cre-1",
      methode: "confirmation_accessible",
      nomConfirme: "  alice   DUPONT ",
      maintenant: MAINTENANT,
    });
    expect(r.ok).toBe(true);
  });
});

describe("signerCreneau — garde d'autorisation", () => {
  it("🔴 REFUSE de signer le créneau d'un AUTRE stagiaire", async () => {
    // Le trou : le jeton atteste d'une inscription, mais `signataireNom` est lu
    // depuis le CRÉNEAU. Sans recoupement, un stagiaire présentait son propre
    // jeton avec l'identifiant de créneau d'un absent, et le service écrivait
    // une signature AU NOM DE L'ABSENT. C'est-à-dire signer la feuille de
    // présence de quelqu'un qui n'est pas venu.
    const r = await signerCreneau({
      porteur: { type: "stagiaire", enrollmentId: "enr-AUTRE", tokenId: "tok-autre" },
      creneauId: "cre-1", // appartient à enr-1
      methode: "canvas",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });

    expect(r).toMatchObject({ ok: false, raison: "porteur_non_autorise" });
    // L'invariant qui compte : aucun effet de bord, pas même l'objet R2.
    expect(mockStore).not.toHaveBeenCalled();
    expect(mockPrisma.emargementSignature.create).not.toHaveBeenCalled();
  });

  it("REFUSE un formateur qui n'anime pas cette session", async () => {
    const r = await signerCreneau({
      porteur: { type: "formateur", sessionId: "ses-AUTRE", trainerId: "tr-1" },
      creneauId: "cre-1",
      methode: "canvas",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(r).toMatchObject({ ok: false, raison: "porteur_non_autorise" });
    expect(mockStore).not.toHaveBeenCalled();
  });

  it("accepte le formateur de LA session", async () => {
    const r = await signerCreneau({
      porteur: { type: "formateur", sessionId: "ses-1", trainerId: "tr-1" },
      creneauId: "cre-1",
      methode: "canvas",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(r.ok).toBe(true);
  });
});

describe("signerCreneau — sessions et inscriptions closes", () => {
  it.each(["annulee", "reportee"])("🔴 REFUSE de signer une session %s", async (statut) => {
    // La révocation des jetons ne fermait qu'une porte sur deux : l'écran
    // formateur ne consulte aucun jeton et aurait continué à produire des
    // signatures valides sur une session qui n'a pas eu lieu.
    const ctx = contexte();
    ctx.enrollment.session.statut = statut;
    mockPrisma.presenceCreneau.findUnique.mockResolvedValue(ctx);

    const r = await signerCreneau({
      porteur: { type: "formateur", sessionId: "ses-1", trainerId: "tr-1" },
      creneauId: "cre-1",
      methode: "canvas",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(r).toMatchObject({ ok: false, raison: "session_close" });
    expect(mockStore).not.toHaveBeenCalled();
  });

  it.each(["abandon", "exclu"])(
    "refuse une NOUVELLE signature pour une inscription %s",
    async (statut) => {
      // ⚠️ N'invalide rien de ce qui a déjà été signé : ces heures ont été
      // réellement suivies et restent facturables (oubli O3).
      const ctx = contexte();
      ctx.enrollment.statut = statut;
      mockPrisma.presenceCreneau.findUnique.mockResolvedValue(ctx);

      const r = await signerCreneau({
        porteur: { type: "formateur", sessionId: "ses-1", trainerId: "tr-1" },
        creneauId: "cre-1",
        methode: "canvas",
        imageDataUrl: IMAGE,
        maintenant: MAINTENANT,
      });
      expect(r).toMatchObject({ ok: false, raison: "inscription_inactive" });
      expect(mockStore).not.toHaveBeenCalled();
    },
  );
});

describe("signerCreneau — écriture", () => {
  it("écrit la ligne et retourne son empreinte", async () => {
    const r = await signerCreneau({
      porteur: PORTEUR_STAGIAIRE,
      creneauId: "cre-1",
      methode: "canvas",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.selfHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("fige le SNAPSHOT — intitulé, modules, formateur, horaires", async () => {
    await signerCreneau({
      porteur: PORTEUR_STAGIAIRE,
      creneauId: "cre-1",
      methode: "canvas",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(donneesCreees()).toMatchObject({
      formationIntitule: "Bien démarrer avec l'IA",
      modulesSnapshot: ["Module 1 — Cadrage"],
      formateurNom: "Williams Jullin",
      heureDebut: "09:00",
      heureFin: "17:00",
      signataireNom: "Alice Dupont",
      mentionVersion: MENTION_VERSION,
    });
  });

  it("le formateur de la JOURNÉE prime sur le principal (désistement, co-animation)", async () => {
    const ctx = contexte();
    ctx.enrollment.session.jours[0]!.trainer = { nom: "Remplaçante", prenom: "Claire" };
    mockPrisma.presenceCreneau.findUnique.mockResolvedValue(ctx);

    await signerCreneau({
      porteur: PORTEUR_STAGIAIRE,
      creneauId: "cre-1",
      methode: "canvas",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(donneesCreees()["formateurNom"]).toBe("Claire Remplaçante");
  });

  it("l'image est stockée AVANT l'insertion, sous l'identifiant de la ligne", async () => {
    // Sans identifiant partagé, l'objet R2 et la ligne ne seraient rattachés
    // par rien.
    await signerCreneau({
      porteur: PORTEUR_STAGIAIRE,
      creneauId: "cre-1",
      methode: "canvas",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    const argStore = mockStore.mock.calls[0]?.[0] as { id: string; genre: string };
    expect(argStore.genre).toBe("signatures");
    expect(donneesCreees()["id"]).toBe(argStore.id);
    expect(donneesCreees()["signatureSha256"]).toBe("a".repeat(64));
  });

  it("la modalité accessible n'a NI image NI empreinte d'image", async () => {
    await signerCreneau({
      porteur: PORTEUR_STAGIAIRE,
      creneauId: "cre-1",
      methode: "confirmation_accessible",
      nomConfirme: "Alice Dupont",
      maintenant: MAINTENANT,
    });
    expect(mockStore).not.toHaveBeenCalled();
    expect(donneesCreees()["signatureKey"]).toBeNull();
    expect(donneesCreees()["signatureSha256"]).toBeNull();
  });

  it("un stagiaire sans téléphone signe sur le poste du formateur — `tokenId` reste nul", async () => {
    // C'est ainsi que la distinction « appareil du stagiaire » / « poste du
    // formateur » est tracée, sans colonne supplémentaire. Dans le second cas
    // l'identification repose sur le formateur qui atteste.
    await signerCreneau({
      porteur: { type: "formateur", sessionId: "ses-1", trainerId: "tr-1" },
      creneauId: "cre-1",
      methode: "canvas",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(donneesCreees()["tokenId"]).toBeNull();
  });

  it("programme la purge à 5 ans", async () => {
    await signerCreneau({
      porteur: PORTEUR_STAGIAIRE,
      creneauId: "cre-1",
      methode: "canvas",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    const purge = donneesCreees()["suppressionPrevueAt"] as Date;
    expect(purge.getUTCFullYear()).toBe(2031);
  });

  it("NE RATTRAPE PAS un échec de stockage — la signature ne doit pas être simulée", async () => {
    mockStore.mockRejectedValue(new Error("R2 503"));
    await expect(
      signerCreneau({
        porteur: PORTEUR_STAGIAIRE,
        creneauId: "cre-1",
        methode: "canvas",
        imageDataUrl: IMAGE,
        maintenant: MAINTENANT,
      }),
    ).rejects.toThrow("R2 503");
    expect(mockPrisma.emargementSignature.create).not.toHaveBeenCalled();
  });
});

describe("signerCreneau — chaînage", () => {
  it("la première signature d'un inscrit n'a pas de prédécesseur", async () => {
    await signerCreneau({
      porteur: PORTEUR_STAGIAIRE,
      creneauId: "cre-1",
      methode: "canvas",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(donneesCreees()["prevHash"]).toBeNull();
  });

  it("scelle l'empreinte de la signature PRÉCÉDENTE du même inscrit", async () => {
    mockPrisma.emargementSignature.findFirst.mockResolvedValue({ selfHash: "b".repeat(64) });
    await signerCreneau({
      porteur: PORTEUR_STAGIAIRE,
      creneauId: "cre-1",
      methode: "canvas",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(donneesCreees()["prevHash"]).toBe("b".repeat(64));
  });

  it("relit le prédécesseur DANS la transaction, dans un ordre déterministe", async () => {
    // Deux signatures à la même milliseconde donneraient sinon un ordre
    // arbitraire, donc une rupture de chaînage fantôme à la vérification.
    await signerCreneau({
      porteur: PORTEUR_STAGIAIRE,
      creneauId: "cre-1",
      methode: "canvas",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    const arg = mockPrisma.emargementSignature.findFirst.mock.calls[0]?.[0] as {
      where: { enrollmentId: string; revokedAt: null };
      orderBy: unknown;
    };
    expect(arg.where).toEqual({ enrollmentId: "enr-1", revokedAt: null });
    // 🔴 L'ordre est celui de l'INSERTION, pas de `signeAt`. `signeAt` est figé
    // avant l'écriture R2 (sharp + réseau) : deux onglets peuvent commiter dans
    // l'ordre inverse de leurs `signeAt`, et un lecteur triant dessus verrait une
    // chaîne « corrompue » à tort, définitivement.
    expect(arg.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
  });

  it("⭐ l'empreinte écrite est bien celle du tuple — recalcul indépendant", async () => {
    mockPrisma.emargementSignature.findFirst.mockResolvedValue({ selfHash: "c".repeat(64) });
    await signerCreneau({
      porteur: PORTEUR_STAGIAIRE,
      creneauId: "cre-1",
      methode: "canvas",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });

    const d = donneesCreees();
    const attendu: TupleSignatureV1 = {
      contexteType: "collectif",
      enrollmentId: "enr-1",
      creneauId: "cre-1",
      coachingId: null,
      date: "2026-06-10",
      demiJournee: "matin",
      heureDebut: "09:00",
      heureFin: "17:00",
      formationIntitule: "Bien démarrer avec l'IA",
      modules: ["Module 1 — Cadrage"],
      formateurNom: "Williams Jullin",
      signataireNom: "Alice Dupont",
      signataireEmail: "alice@example.test",
      methode: "canvas",
      signatureSha256: "a".repeat(64),
      signeAtIso: MAINTENANT.toISOString(),
      ipHash: null,
      userAgentSha256: null,
      mentionVersion: MENTION_VERSION,
      prevHash: "c".repeat(64),
    };
    expect(d["selfHash"]).toBe(calculerSelfHash(attendu));
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Collision de chaîne (index unique partiel anti-fourche)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Violation de contrainte unique, telle que Prisma la lève RÉELLEMENT.
   *
   * ⚠️ Un `Object.assign(new Error(), { code: "P2002" })` ne suffit pas : le
   * service teste `instanceof PrismaClientKnownRequestError`, et un faux objet
   * ferait passer le test par le chemin « erreur inattendue » — donc verdict
   * vert sur un comportement jamais exercé.
   */
  function collisionChaine(): Error {
    return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "5.22.0",
    });
  }

  it("REPREND après une collision de chaîne et finit par écrire", async () => {
    // Deux stagiaires ne se gênent pas — la chaîne est portée par l'inscription.
    // Mais deux onglets d'un même stagiaire, si : l'index unique partiel les
    // sérialise, et la reprise doit relire la nouvelle tête plutôt que rendre
    // une erreur au visage de quelqu'un qui a simplement signé deux fois vite.
    let appels = 0;
    mockPrisma.emargementSignature.create.mockImplementation(
      async (args: { data: { id: string; selfHash: string } }) => {
        appels += 1;
        if (appels === 1) throw collisionChaine();
        return { id: args.data.id, selfHash: args.data.selfHash };
      },
    );
    mockPrisma.emargementSignature.count.mockResolvedValue(0);

    const r = await signerCreneau({
      porteur: PORTEUR_STAGIAIRE,
      creneauId: "cre-1",
      methode: "canvas",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });

    expect(r.ok).toBe(true);
    expect(appels).toBe(2);
  });

  it("🔴 abandonne après 3 tentatives, sans image orpheline", async () => {
    // ⚠️ Ramener `MAX_REPRISES_CHAINE` de 3 à 1 ne faisait échouer aucun test :
    // la reprise n'était vérifiée qu'en « ça finit par réussir ». Le nombre est
    // le compromis entre une contention passagère et une boucle qui tient la
    // transaction ouverte.
    mockPrisma.emargementSignature.create.mockRejectedValue(collisionChaine());
    mockPrisma.emargementSignature.count.mockResolvedValue(0);

    const r = await signerCreneau({
      porteur: PORTEUR_STAGIAIRE,
      creneauId: "cre-1",
      methode: "canvas",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });

    expect(r).toMatchObject({ ok: false, raison: "conflit_concurrent" });
    expect(mockPrisma.emargementSignature.create).toHaveBeenCalledTimes(3);
    // L'image a été écrite sur R2 avant la transaction : sans ce nettoyage elle
    // serait inatteignable par la purge RGPD, qui part de `signature_key`.
    expect(mockSupprimerImage).toHaveBeenCalled();
  });

  it("une collision qui cache une signature DÉJÀ posée est nommée pour ce qu'elle est", async () => {
    // Le message compte : « réessayez » face à une double signature enverrait le
    // stagiaire recommencer indéfiniment.
    mockPrisma.emargementSignature.create.mockRejectedValue(collisionChaine());
    mockPrisma.emargementSignature.count.mockResolvedValue(1);

    const r = await signerCreneau({
      porteur: PORTEUR_STAGIAIRE,
      creneauId: "cre-1",
      methode: "canvas",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });

    expect(r).toMatchObject({ ok: false, raison: "deja_signe" });
    expect(mockPrisma.emargementSignature.create).toHaveBeenCalledTimes(1);
  });
});

describe("signerCreneau — la ligne écrite est VÉRIFIABLE", () => {
  it("⭐ le round-trip complet passe : ligne → tuple reconstruit → chaîne valide", () => {
    // LE test qui manquait. Rien ne gardait la cohérence entre le tuple haché et
    // les colonnes écrites : un renommage de colonne l'aurait cassée sur 100 %
    // des lignes, en silence, dans une table append-only donc non corrigeable.
    return (async () => {
      await signerCreneau({
        porteur: PORTEUR_STAGIAIRE,
        creneauId: "cre-1",
        methode: "canvas",
        imageDataUrl: IMAGE,
        maintenant: MAINTENANT,
      });

      const d = donneesCreees();
      // ⚠️ `create` n'émet PAS de clé `coachingId` (elle vaut `undefined`, pas
      // `null`). La relecture en base la rendrait `null` : on la simule, sinon
      // la canonicalisation lève et l'on obtient `maillon_illisible`.
      const ligne = { coachingId: null, ...d } as unknown as LigneSignature;

      const res = verifierChaine([maillonDepuisLigne(ligne)]);
      expect(res.anomalies).toEqual([]);
      expect(res.valide).toBe(true);
    })();
  });

  it("écrit la colonne `date` exactement à MINUIT UTC", async () => {
    // C'est l'invariant dont dépend la garde de `tupleDepuisLigne` : une date
    // décalée rend le tuple irrecalculable, donc la chaîne invérifiable.
    await signerCreneau({
      porteur: PORTEUR_STAGIAIRE,
      creneauId: "cre-1",
      methode: "canvas",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect((donneesCreees()["date"] as Date).toISOString()).toBe("2026-06-10T00:00:00.000Z");
  });

  it("trace le formateur qui a recueilli la signature sur son poste", async () => {
    // Dans ce mode c'est lui, et lui seul, qui porte l'identification du
    // signataire. Une ligne qui ne dirait pas qui atteste ne prouverait rien.
    await signerCreneau({
      porteur: { type: "formateur", sessionId: "ses-1", trainerId: "tr-42" },
      creneauId: "cre-1",
      methode: "canvas",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(donneesCreees()["recueilliParTrainerId"]).toBe("tr-42");
  });

  it("ne trace aucun formateur quand le stagiaire signe depuis son appareil", async () => {
    await signerCreneau({
      porteur: PORTEUR_STAGIAIRE,
      creneauId: "cre-1",
      methode: "canvas",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(donneesCreees()["recueilliParTrainerId"]).toBeNull();
  });

  it("REFUSE un programme mal formé plutôt que de sceller une liste amputée", async () => {
    const ctx = contexte();
    ctx.enrollment.session.jours[0]!.modules = ["Module 1", { titre: "objet" }] as never;
    mockPrisma.presenceCreneau.findUnique.mockResolvedValue(ctx);

    const r = await signerCreneau({
      porteur: PORTEUR_STAGIAIRE,
      creneauId: "cre-1",
      methode: "canvas",
      imageDataUrl: IMAGE,
      maintenant: MAINTENANT,
    });
    expect(r).toMatchObject({ ok: false, raison: "modules_invalides" });
    expect(mockStore).not.toHaveBeenCalled();
  });

  it("l'horloge injectée est bien celle utilisée — pas `new Date()`", async () => {
    // Sans cette assertion, « purge à 5 ans » passerait aussi si le service
    // ignorait `maintenant` (2026 + 5 = 2031 dans les deux cas).
    await signerCreneau({
      porteur: PORTEUR_STAGIAIRE,
      creneauId: "cre-1",
      methode: "canvas",
      imageDataUrl: IMAGE,
      maintenant: new Date("2027-03-04T09:00:00.000Z"),
    });
    expect((donneesCreees()["signeAt"] as Date).toISOString()).toBe("2027-03-04T09:00:00.000Z");
    expect((donneesCreees()["suppressionPrevueAt"] as Date).getUTCFullYear()).toBe(2032);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Sessions de PLUSIEURS journées
// ─────────────────────────────────────────────────────────────────────────────

describe("signerCreneau — le snapshot est celui de LA BONNE journée", () => {
  /**
   * 🔴 Tous les tests ci-dessus s'appuient sur un fixture à UNE seule journée.
   * Un fixture mono-journée rend indiscernables « chercher la journée du
   * créneau » et « prendre la première journée venue » : la mutation
   * `session.jours.find(...)` → `session.jours[0]` survivait à l'intégralité de
   * la suite.
   *
   * Ce qu'elle coûterait : signer le créneau du troisième jour figerait dans le
   * tuple HACHÉ les horaires, les modules et le formateur du premier. Une preuve
   * fausse, et scellée cryptographiquement — donc indéfendable, puisque son
   * empreinte la déclarerait intacte.
   *
   * Or les sessions en entreprise sont majoritairement multi-jours : c'est le
   * cas NORMAL qui n'était pas testé.
   */
  const JOURS = [
    {
      date: new Date("2026-06-10T00:00:00.000Z"),
      heureDebut: "09:00",
      heureFin: "17:00",
      modules: ["Module 1 — Cadrage"],
      trainer: null as { nom: string; prenom: string } | null,
    },
    {
      date: new Date("2026-06-11T00:00:00.000Z"),
      heureDebut: "08:30",
      heureFin: "12:30",
      modules: ["Module 2 — Cas d'usage"],
      trainer: null as { nom: string; prenom: string } | null,
    },
    {
      date: new Date("2026-06-12T00:00:00.000Z"),
      heureDebut: "10:00",
      heureFin: "16:00",
      modules: ["Module 3 — Passage à l'échelle"],
      // Désistement du formateur principal sur la dernière journée.
      trainer: { nom: "Remplaçante", prenom: "Claire" } as { nom: string; prenom: string } | null,
    },
  ];

  /** Contexte d'un créneau tombant sur la journée `index`, session à 3 jours. */
  function contexteMultiJours(index: number) {
    const base = contexte();
    return {
      ...base,
      date: JOURS[index]!.date,
      enrollment: {
        ...base.enrollment,
        session: { ...base.enrollment.session, jours: JOURS },
      },
    };
  }

  it("🔴 fige les horaires, les modules et le formateur de la journée SIGNÉE", async () => {
    mockPrisma.presenceCreneau.findUnique.mockResolvedValue(contexteMultiJours(2));

    const r = await signerCreneau({
      porteur: PORTEUR_STAGIAIRE,
      creneauId: "cre-1",
      methode: "canvas",
      imageDataUrl: IMAGE,
      maintenant: new Date("2026-06-12T14:00:00.000Z"),
    });

    expect(r.ok).toBe(true);
    const data = donneesCreees();
    expect(data["heureDebut"]).toBe("10:00");
    expect(data["heureFin"]).toBe("16:00");
    expect(data["modulesSnapshot"]).toEqual(["Module 3 — Passage à l'échelle"]);
    // Le formateur de la journée prime : c'est lui qui a réellement animé.
    expect(data["formateurNom"]).toBe("Claire Remplaçante");
  });

  it("prend la journée du MILIEU quand c'est elle qui est signée", async () => {
    // Une session de trois jours a deux extrémités : ne tester que la dernière
    // laisserait passer un `jours[jours.length - 1]`.
    mockPrisma.presenceCreneau.findUnique.mockResolvedValue(contexteMultiJours(1));

    await signerCreneau({
      porteur: PORTEUR_STAGIAIRE,
      creneauId: "cre-1",
      methode: "canvas",
      imageDataUrl: IMAGE,
      maintenant: new Date("2026-06-11T11:00:00.000Z"),
    });

    const data = donneesCreees();
    expect(data["heureDebut"]).toBe("08:30");
    expect(data["heureFin"]).toBe("12:30");
    expect(data["modulesSnapshot"]).toEqual(["Module 2 — Cas d'usage"]);
    // Aucun formateur d'exception ce jour-là : le principal reprend la main.
    expect(data["formateurNom"]).toBe("Williams Jullin");
  });

  it("REFUSE un créneau dont la journée n'est pas déclarée, même si d'autres le sont", async () => {
    const base = contexte();
    mockPrisma.presenceCreneau.findUnique.mockResolvedValue({
      ...base,
      // Le 15 juin n'est pas dans la liste : inventer « 09h00–17h00 » serait
      // exactement ce que sanctionne CAA Nantes 20/04/2021.
      date: new Date("2026-06-15T00:00:00.000Z"),
      enrollment: {
        ...base.enrollment,
        session: { ...base.enrollment.session, jours: JOURS },
      },
    });

    const r = await signerCreneau({
      porteur: PORTEUR_STAGIAIRE,
      creneauId: "cre-1",
      methode: "canvas",
      imageDataUrl: IMAGE,
      maintenant: new Date("2026-06-15T11:00:00.000Z"),
    });

    expect(r).toMatchObject({ ok: false, raison: "journee_non_declaree" });
    expect(mockStore).not.toHaveBeenCalled();
  });
});
