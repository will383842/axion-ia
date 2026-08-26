/**
 * S5 — GARDES de la production documentaire automatique (écrites AVANT le
 * worker, et vues ROUGIR sur le module stub — ordre imposé par le plan
 * `_AUDIT/RESERVATION-2026-08-26/CHAINE-DOCUMENTAIRE.md`).
 *
 * G1 — aucune pièce avant son jalon (fail-open dates nulles fermé).
 * G2 — aucune pièce `sans_objet` ni `possible` produite (exhaustif
 *      financement × type de client) ; corollaire : la lettre de mission —
 *      la pièce déjà ANNULÉE au registre sur un dossier réel — n'est JAMAIS
 *      produite automatiquement.
 * G3 — idempotence : même état → même liste ; pièce déjà vivante → rien.
 * G4 — aucune pièce d'un tiers : toute nominative porte un `traineeId`.
 * G5 — tout type à jalon ≠ `jamais` a un canal de remise déclaré (la décision
 *      qui ferme M19 : les 9 types sans canal sont DÉCIDÉS, plus subis).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks pour la partie WORKER (G3 côté écriture) ──────────────────────────
// Les gardes G1-G5 testent le module PUR et n'en ont pas besoin ; le worker,
// lui, est testé avec Prisma et les producteurs simulés (patron du spec de
// qualiopi-formation-crons-worker).
vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: { findMany: vi.fn() },
    documentGenere: { findFirst: vi.fn() },
  },
}));

vi.mock("@/server/qualiopi/documents/production/producteurs", () => {
  // ⚠️ Le mock recopie le CONTRAT réel (`{ ok: true, … }`) : un `vi.fn()` nu
  // rendrait `undefined`, que le worker compterait en échec — les tests
  // rougiraient pour la forme du mock, pas pour ce qu'ils vérifient.
  const ok = () => vi.fn(async () => ({ ok: true, documentId: "doc-1", numero: "AXI-DOC-0" }));
  return {
    produireConvention: ok(),
    produireConventionTripartite: ok(),
    produireContratFormation: ok(),
    produireConvocation: ok(),
    produireEmargement: ok(),
    produirePositionnement: ok(),
    produireGrilleEvaluation: ok(),
    produireSatisfaction: ok(),
    produireReglementInterieur: ok(),
    produireProgramme: ok(),
    produireOrganisationAction: ok(),
    produireLivretAccueil: ok(),
  };
});

import { prisma } from "@/lib/prisma";
import * as producteurs from "@/server/qualiopi/documents/production/producteurs";
import { documentsAutoHandler } from "../qualiopi-documents-worker";
import {
  productionsAuJalon,
  CANAL_DE_REMISE,
  type InstantaneProduction,
  type Financement,
  type TypeClient,
} from "@/server/qualiopi/documents/production-au-jalon";
import {
  jalonPour,
  pieceEstRemise,
  TYPES_AVEC_JALON,
} from "@/server/qualiopi/portail/piece-remise";
import { pertinencePiece } from "@/server/qualiopi/documents/pertinence-piece";
import { TYPES_PIECES_NOMINATIVES_ESPACE_STAGIAIRE } from "@/server/qualiopi/portail/portail-service";

const MAINTENANT = new Date("2026-08-26T10:00:00Z");
const JOUR_MS = 24 * 60 * 60 * 1000;

/** Pièces nominatives : celles de l'espace stagiaire + celles établies PAR stagiaire. */
const TYPES_NOMINATIFS: ReadonlyArray<string> = [
  ...TYPES_PIECES_NOMINATIVES_ESPACE_STAGIAIRE,
  "contrat",
  "grille_evaluation",
  "certificat_realisation",
  "attestation",
  "attestation_partielle",
  "kit_cpf",
  "kit_france_travail",
];

/** Session entreprise/direct nominale, un inscrit, aucune pièce existante. */
function instantane(
  overrides: {
    statut?: string;
    dateDebut?: Date | null;
    dateFin?: Date | null;
    financementType?: Financement | null;
    clientType?: TypeClient | null;
    enrollments?: InstantaneProduction["enrollments"];
    piecesExistantes?: InstantaneProduction["piecesExistantes"];
  } = {},
): InstantaneProduction {
  return {
    session: {
      id: "sess-1",
      statut: overrides.statut ?? "planifiee",
      dateDebut:
        overrides.dateDebut === undefined
          ? new Date(MAINTENANT.getTime() + 10 * JOUR_MS)
          : overrides.dateDebut,
      dateFin:
        overrides.dateFin === undefined
          ? new Date(MAINTENANT.getTime() + 11 * JOUR_MS)
          : overrides.dateFin,
      financementType:
        overrides.financementType === undefined ? "direct" : overrides.financementType,
      clientType: overrides.clientType === undefined ? "entreprise" : overrides.clientType,
    },
    enrollments: overrides.enrollments ?? [{ id: "enr-1", traineeId: "trainee-1" }],
    piecesExistantes: overrides.piecesExistantes ?? [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// G1 — aucune pièce avant son jalon
// ─────────────────────────────────────────────────────────────────────────────

describe("G1 — aucune pièce avant son jalon", () => {
  it("tout type produit vérifie pieceEstRemise à l'instant t (jalon jamais exclu)", () => {
    for (const statut of ["planifiee", "en_cours", "realisee"]) {
      const inst = instantane({
        statut,
        dateDebut: new Date(MAINTENANT.getTime() - 2 * JOUR_MS),
        dateFin: new Date(MAINTENANT.getTime() - 1 * JOUR_MS),
      });
      for (const p of productionsAuJalon(inst, MAINTENANT)) {
        expect(jalonPour(p.type), `${p.type} : un type à jalon "jamais" est produit`).not.toBe(
          "jamais",
        );
        expect(
          pieceEstRemise(
            {
              type: p.type,
              sessionDateDebut: inst.session.dateDebut,
              sessionDateFin: inst.session.dateFin,
              sessionStatut: inst.session.statut,
            },
            MAINTENANT,
          ),
          `${p.type} produit AVANT son jalon (statut=${statut})`,
        ).toBe(true);
      }
    }
  });

  it("une session planifiée à J-10 produit les pièces immédiates (le socle prépare)", () => {
    const types = productionsAuJalon(instantane(), MAINTENANT).map((p) => p.type);
    // Sans ces assertions POSITIVES, un module qui ne produit rien passerait
    // toutes les gardes par vacuité — c'est le rouge attendu du stub.
    expect(types).toContain("programme");
    expect(types).toContain("reglement_interieur");
    expect(types).toContain("livret_accueil");
    expect(types).toContain("organisation_action");
    expect(types).toContain("convocation");
    expect(types).toContain("positionnement");
    expect(types).toContain("convention");
    // …mais RIEN d'un jalon ultérieur.
    expect(types).not.toContain("emargement");
    expect(types).not.toContain("grille_evaluation");
    expect(types).not.toContain("satisfaction");
  });

  it("l'émargement n'apparaît qu'au JOUR J, la grille et la satisfaction qu'après réalisation", () => {
    const jourJ = instantane({
      statut: "en_cours",
      dateDebut: new Date(MAINTENANT.getTime() - 2 * 60 * 60 * 1000),
      dateFin: new Date(MAINTENANT.getTime() + 6 * 60 * 60 * 1000),
    });
    const typesJourJ = productionsAuJalon(jourJ, MAINTENANT).map((p) => p.type);
    expect(typesJourJ).toContain("emargement");
    expect(typesJourJ).not.toContain("grille_evaluation");
    expect(typesJourJ).not.toContain("satisfaction");

    const realisee = instantane({
      statut: "realisee",
      dateDebut: new Date(MAINTENANT.getTime() - 3 * JOUR_MS),
      dateFin: new Date(MAINTENANT.getTime() - 2 * JOUR_MS),
    });
    const typesRealisee = productionsAuJalon(realisee, MAINTENANT).map((p) => p.type);
    expect(typesRealisee).toContain("grille_evaluation");
    expect(typesRealisee).toContain("satisfaction");
  });

  it("🔴 CAS CRITIQUE fail-open (piece-remise.ts:169-176) : session SANS dateDebut → rien au-delà des jalons immédiats", () => {
    // `pieceEstRemise` REMET tout quand les dates manquent (choix assumé côté
    // portail : ne pas faire disparaître une pièce attendue). Un producteur
    // naïf publierait donc l'émargement ET la grille sur une session non datée.
    const inst = instantane({ dateDebut: null, dateFin: null, statut: "en_cours" });
    for (const p of productionsAuJalon(inst, MAINTENANT)) {
      expect(
        jalonPour(p.type),
        `${p.type} (jalon ${jalonPour(p.type)}) produit sur une session SANS dateDebut`,
      ).toBe("immediat");
    }
    // Et les immédiats, eux, sortent bien (le trou de données ne gèle pas tout).
    const types = productionsAuJalon(inst, MAINTENANT).map((p) => p.type);
    expect(types).toContain("programme");
  });

  it("session annulée ou reportée → ZÉRO pièce", () => {
    for (const statut of ["annulee", "reportee"]) {
      expect(productionsAuJalon(instantane({ statut }), MAINTENANT)).toEqual([]);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// G2 — aucune sans_objet ni possible produite (exhaustif financement × client)
// ─────────────────────────────────────────────────────────────────────────────

describe("G2 — pertinence `attendue` seulement", () => {
  const FINANCEMENTS: ReadonlyArray<Financement | null> = [
    "direct",
    "opco",
    "cpf",
    "france_travail",
    "mixte",
    null,
  ];
  const CLIENTS: ReadonlyArray<TypeClient | null> = ["entreprise", "particulier", null];

  it("exhaustif : tout type produit est `attendue` pour son contexte", () => {
    for (const financementType of FINANCEMENTS) {
      for (const clientType of CLIENTS) {
        for (const statut of ["planifiee", "en_cours", "realisee"]) {
          const inst = instantane({
            financementType,
            clientType,
            statut,
            dateDebut: new Date(MAINTENANT.getTime() - 2 * JOUR_MS),
            dateFin: new Date(MAINTENANT.getTime() - 1 * JOUR_MS),
          });
          for (const p of productionsAuJalon(inst, MAINTENANT)) {
            expect(
              pertinencePiece(p.type, {
                financement: financementType,
                typeClient: clientType,
                statut,
              }),
              `${p.type} produit alors qu'il n'est pas « attendue » ` +
                `(financement=${financementType}, client=${clientType}, statut=${statut})`,
            ).toBe("attendue");
          }
        }
      }
    }
  });

  it("le contexte de l'INSCRIPTION prime quand il porte un override (R-INTER)", () => {
    // Session entreprise/direct, mais UN inscrit particulier autofinancé :
    // c'est LUI qui signe un contrat L.6353-3 — la pièce le suit, lui.
    const inst = instantane({
      enrollments: [
        { id: "enr-entreprise", traineeId: "t-1" },
        {
          id: "enr-particulier",
          traineeId: "t-2",
          financementType: "direct",
          clientType: "particulier",
        },
      ],
    });
    const productions = productionsAuJalon(inst, MAINTENANT);
    const contrats = productions.filter((p) => p.type === "contrat");
    expect(contrats).toEqual([
      expect.objectContaining({ traineeId: "t-2", enrollmentId: "enr-particulier" }),
    ]);
  });

  it("le contrat suit le PARTICULIER, la convention suit l'ENTREPRISE — jamais l'inverse", () => {
    const particulier = instantane({ clientType: "particulier" });
    const typesParticulier = productionsAuJalon(particulier, MAINTENANT).map((p) => p.type);
    expect(typesParticulier).toContain("contrat");
    expect(typesParticulier).not.toContain("convention");

    const entreprise = instantane({ clientType: "entreprise" });
    const typesEntreprise = productionsAuJalon(entreprise, MAINTENANT).map((p) => p.type);
    expect(typesEntreprise).toContain("convention");
    expect(typesEntreprise).not.toContain("contrat");
  });

  it("la tripartite n'existe qu'en OPCO/mixte", () => {
    expect(
      productionsAuJalon(instantane({ financementType: "opco" }), MAINTENANT).map((p) => p.type),
    ).toContain("convention_tripartite");
    expect(
      productionsAuJalon(instantane({ financementType: "direct" }), MAINTENANT).map((p) => p.type),
    ).not.toContain("convention_tripartite");
  });

  it("🔴 corollaire : lettre_mission n'est JAMAIS produite automatiquement", () => {
    for (const financementType of FINANCEMENTS) {
      for (const clientType of CLIENTS) {
        for (const statut of ["planifiee", "en_cours", "realisee"]) {
          const inst = instantane({
            financementType,
            clientType,
            statut,
            dateDebut: new Date(MAINTENANT.getTime() - 2 * JOUR_MS),
            dateFin: new Date(MAINTENANT.getTime() - 1 * JOUR_MS),
          });
          expect(
            productionsAuJalon(inst, MAINTENANT).map((p) => p.type),
            "la lettre de mission — pièce ANNULÉE au registre sur un dossier réel — est reproduite par l'automatisme",
          ).not.toContain("lettre_mission");
        }
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// G3 — idempotence de la décision
// ─────────────────────────────────────────────────────────────────────────────

describe("G3 — idempotence", () => {
  it("deux appels sur le même état rendent la même liste", () => {
    const inst = instantane({
      statut: "realisee",
      dateDebut: new Date(MAINTENANT.getTime() - 3 * JOUR_MS),
      dateFin: new Date(MAINTENANT.getTime() - 2 * JOUR_MS),
    });
    const a = productionsAuJalon(inst, MAINTENANT);
    const b = productionsAuJalon(inst, MAINTENANT);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it("une pièce VIVANTE du même type et du même porteur n'est pas reproduite", () => {
    const sans = productionsAuJalon(instantane(), MAINTENANT).map((p) => p.type);
    expect(sans).toContain("programme");

    const avec = productionsAuJalon(
      instantane({
        piecesExistantes: [
          { type: "programme", traineeId: null, annuleeAt: null, estCopie: false },
          { type: "convocation", traineeId: "trainee-1", annuleeAt: null, estCopie: false },
        ],
      }),
      MAINTENANT,
    );
    expect(avec.map((p) => p.type)).not.toContain("programme");
    expect(avec.map((p) => p.type)).not.toContain("convocation");
  });

  it("une pièce ANNULÉE ne bloque pas la reproduction ; une COPIE non plus ; le porteur compte", () => {
    const productions = productionsAuJalon(
      instantane({
        enrollments: [
          { id: "enr-1", traineeId: "trainee-1" },
          { id: "enr-2", traineeId: "trainee-2" },
        ],
        piecesExistantes: [
          // Annulée : elle ne circule plus, la pièce attendue manque toujours.
          { type: "programme", traineeId: null, annuleeAt: new Date(), estCopie: false },
          // Copie : un duplicata n'est pas l'original attendu.
          { type: "reglement_interieur", traineeId: null, annuleeAt: null, estCopie: true },
          // La convocation de trainee-1 n'est pas celle de trainee-2.
          { type: "convocation", traineeId: "trainee-1", annuleeAt: null, estCopie: false },
        ],
      }),
      MAINTENANT,
    );
    const types = productions.map((p) => p.type);
    expect(types).toContain("programme");
    expect(types).toContain("reglement_interieur");
    const convocations = productions.filter((p) => p.type === "convocation");
    expect(convocations).toEqual([expect.objectContaining({ traineeId: "trainee-2" })]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// G4 — aucune pièce d'un tiers
// ─────────────────────────────────────────────────────────────────────────────

describe("G4 — toute pièce nominative porte un traineeId", () => {
  it("une inscription SANS traineeId ne reçoit aucune pièce nominative (omise, pas forcée)", () => {
    const productions = productionsAuJalon(
      instantane({
        statut: "realisee",
        dateDebut: new Date(MAINTENANT.getTime() - 3 * JOUR_MS),
        dateFin: new Date(MAINTENANT.getTime() - 2 * JOUR_MS),
        enrollments: [
          { id: "enr-anonyme", traineeId: null },
          { id: "enr-porte", traineeId: "trainee-1" },
        ],
      }),
      MAINTENANT,
    );
    for (const p of productions) {
      if (TYPES_NOMINATIFS.includes(p.type)) {
        expect(p.traineeId, `${p.type} produit SANS porteur`).not.toBeNull();
      }
    }
    // L'inscrit porté, lui, reçoit bien sa convocation.
    expect(productions.filter((p) => p.type === "convocation")).toEqual([
      expect.objectContaining({ traineeId: "trainee-1" }),
    ]);
  });

  it("une session sans aucun inscrit ne produit AUCUNE pièce nominative", () => {
    const productions = productionsAuJalon(instantane({ enrollments: [] }), MAINTENANT);
    for (const p of productions) {
      expect(TYPES_NOMINATIFS.includes(p.type), `${p.type} nominative produite sans inscrit`).toBe(
        false,
      );
    }
    // Les pièces de session, elles, sortent (le programme prépare la session).
    expect(productions.map((p) => p.type)).toContain("programme");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// G5 — tout type à jalon ≠ jamais a un canal de remise déclaré
// ─────────────────────────────────────────────────────────────────────────────

describe("G5 — le canal de remise est une DÉCISION, plus un écart subi (M19)", () => {
  it("aucun type à jalon ≠ jamais n'a le canal « aucun »", () => {
    for (const type of TYPES_AVEC_JALON) {
      if (jalonPour(type) === "jamais") continue;
      expect(
        CANAL_DE_REMISE[type as keyof typeof CANAL_DE_REMISE],
        `${type} (jalon ${jalonPour(type)}) n'a AUCUN canal de remise : ` +
          "la pièce serait produite et jamais remise — l'écart M19 reconduit en silence",
      ).not.toBe("aucun");
    }
  });

  it("les 12 types `jamais` restent sans canal bénéficiaire (pièces organisme ↔ financeur)", () => {
    const jamais = TYPES_AVEC_JALON.filter((t) => jalonPour(t) === "jamais");
    expect(jamais.length).toBe(12);
    for (const type of jamais) {
      expect(CANAL_DE_REMISE[type as keyof typeof CANAL_DE_REMISE]).toBe("aucun");
    }
  });

  it("la table couvre tous les types déclarés au jalon", () => {
    for (const type of TYPES_AVEC_JALON) {
      expect(
        Object.prototype.hasOwnProperty.call(CANAL_DE_REMISE, type),
        `${type} absent de CANAL_DE_REMISE`,
      ).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LE WORKER — G3 côté écriture : le verrou par pièce, le stub, le fail-soft
// ─────────────────────────────────────────────────────────────────────────────

describe("documentsAutoHandler — le worker n'écrit jamais deux fois la même pièce", () => {
  const mockPrisma = prisma as unknown as {
    trainingSession: { findMany: ReturnType<typeof vi.fn> };
    documentGenere: { findFirst: ReturnType<typeof vi.fn> };
  };
  const mockProduireProgramme = producteurs.produireProgramme as unknown as ReturnType<
    typeof vi.fn
  >;
  const mockProduireConvocation = producteurs.produireConvocation as unknown as ReturnType<
    typeof vi.fn
  >;

  /** Session planifiée J+10, entreprise/direct, un inscrit, aucune pièce. */
  const sessionNominale = () => ({
    id: "sess-1",
    numero: "AXI-SESS-2026-001",
    statut: "planifiee",
    dateDebut: new Date(Date.now() + 10 * JOUR_MS),
    dateFin: new Date(Date.now() + 11 * JOUR_MS),
    financementType: "direct",
    client: { type: "entreprise" },
    enrollments: [{ id: "enr-1", traineeId: "trainee-1", financementType: null, client: null }],
    documents: [] as Array<{ type: string; traineeId: string | null }>,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env["DATABASE_URL"];
    mockPrisma.trainingSession.findMany.mockResolvedValue([]);
    mockPrisma.documentGenere.findFirst.mockResolvedValue(null);
    // `vi.clearAllMocks` efface aussi les implémentations posées par la
    // fabrique du vi.mock : on repose le contrat réel.
    for (const fn of Object.values(producteurs)) {
      (fn as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        documentId: "doc-1",
        numero: "AXI-DOC-0",
      });
    }
  });

  it("skip si DATABASE_URL = stub.invalid (ADR 0026)", async () => {
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      await documentsAutoHandler({ type: "documents-auto.production", tick: "t" });
      expect(mockPrisma.trainingSession.findMany).not.toHaveBeenCalled();
    } finally {
      delete process.env["DATABASE_URL"];
    }
  });

  it("produit les pièces décidées par le module (programme ET convocation du porteur)", async () => {
    mockPrisma.trainingSession.findMany.mockResolvedValue([sessionNominale()]);

    await documentsAutoHandler({ type: "documents-auto.production", tick: "t" });

    expect(mockProduireProgramme).toHaveBeenCalledWith(
      "sess-1",
      expect.objectContaining({
        metadata: expect.objectContaining({ genereParWorker: true, jalon: "immediat" }),
      }),
    );
    expect(mockProduireConvocation).toHaveBeenCalledWith(
      "enr-1",
      expect.objectContaining({
        metadata: expect.objectContaining({ genereParWorker: true }),
      }),
    );
  });

  it("🔴 G3 — une pièce déjà VIVANTE dans l'instantané n'est pas reproduite", async () => {
    const session = sessionNominale();
    session.documents = [{ type: "programme", traineeId: null }];
    mockPrisma.trainingSession.findMany.mockResolvedValue([session]);

    await documentsAutoHandler({ type: "documents-auto.production", tick: "t" });

    expect(mockProduireProgramme).not.toHaveBeenCalled();
    // Les autres pièces, elles, sortent toujours.
    expect(mockProduireConvocation).toHaveBeenCalled();
  });

  it("🔴 G3 — le RE-CHECK frais avant create ferme la course avec un clic admin", async () => {
    mockPrisma.trainingSession.findMany.mockResolvedValue([sessionNominale()]);
    // Entre l'instantané et le create, quelqu'un a produit chaque pièce : la
    // relecture fraîche les voit — AUCUN producteur ne doit être appelé.
    mockPrisma.documentGenere.findFirst.mockResolvedValue({ id: "deja-la" });

    await documentsAutoHandler({ type: "documents-auto.production", tick: "t" });

    expect(mockProduireProgramme).not.toHaveBeenCalled();
    expect(mockProduireConvocation).not.toHaveBeenCalled();
  });

  it("fail-soft : un producteur qui refuse n'arrête pas les autres pièces", async () => {
    mockPrisma.trainingSession.findMany.mockResolvedValue([sessionNominale()]);
    mockProduireProgramme.mockResolvedValue({ ok: false, motif: "session sans journée" });

    await expect(
      documentsAutoHandler({ type: "documents-auto.production", tick: "t" }),
    ).resolves.toBeUndefined();

    expect(mockProduireConvocation).toHaveBeenCalled();
  });

  it("sélectionne par ÉTAT, jamais par fenêtre : statuts actifs + realisee bornée", async () => {
    await documentsAutoHandler({ type: "documents-auto.production", tick: "t" });

    const where = mockPrisma.trainingSession.findMany.mock.calls[0]![0].where as {
      OR: Array<Record<string, unknown>>;
    };
    expect(where.OR).toEqual([
      { statut: { in: ["planifiee", "en_cours"] } },
      { statut: "realisee", dateFin: { gte: expect.any(Date) } },
    ]);
  });
});
