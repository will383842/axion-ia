/**
 * Tests — alertes/evaluateur.ts (T15 AGENT A).
 *
 * Stratégie : mock @/lib/prisma + @/server/qualiopi/config/site-settings.
 * Vérifie les règles clés : stub-aware early-exit, referent_handicap_absent,
 * reclamation_sans_reponse_j15, emargement_manquant, qualiopi expiration,
 * bpf, veille_inactive, factures impayées, OPCO, fail-soft par règle.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("@/lib/prisma", () => ({
  prisma: {
    reclamation: { findMany: vi.fn() },
    enrollment: { findMany: vi.fn() },
    trainingSession: { findMany: vi.fn() },
    trainer: { findMany: vi.fn() },
    factureFormation: { findMany: vi.fn() },
    veille: { findFirst: vi.fn() },
    revueDirection: { findUnique: vi.fn() },
    rgpdDemande: { findMany: vi.fn() },
  },
}));

vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: vi.fn(),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Imports
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { evaluerAlertes } from "./evaluateur";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers typed
// ─────────────────────────────────────────────────────────────────────────────

const mp = prisma as unknown as {
  reclamation: { findMany: ReturnType<typeof vi.fn> };
  enrollment: { findMany: ReturnType<typeof vi.fn> };
  trainingSession: { findMany: ReturnType<typeof vi.fn> };
  trainer: { findMany: ReturnType<typeof vi.fn> };
  factureFormation: { findMany: ReturnType<typeof vi.fn> };
  veille: { findFirst: ReturnType<typeof vi.fn> };
  revueDirection: { findUnique: ReturnType<typeof vi.fn> };
  rgpdDemande: { findMany: ReturnType<typeof vi.fn> };
};

const mockGetConfig = getQualiopiConfig as ReturnType<typeof vi.fn>;

/** Configure tous les mocks prisma pour retourner des résultats vides (aucune alerte). */
function setupEmptyMocks() {
  mp.reclamation.findMany.mockResolvedValue([]);
  mp.enrollment.findMany.mockResolvedValue([]);
  mp.trainingSession.findMany.mockResolvedValue([]);
  mp.trainer.findMany.mockResolvedValue([]);
  mp.factureFormation.findMany.mockResolvedValue([]);
  mp.veille.findFirst.mockResolvedValue({ dateVeille: new Date() }); // veille récente
  mp.revueDirection.findUnique.mockResolvedValue({ statut: "valide" }); // BPF déposé
  mp.rgpdDemande.findMany.mockResolvedValue([]);
  // Config : referent_handicap_nom non vide, qualiopi_validite dans >90j
  const now = new Date();
  const futur90 = new Date(now.getTime() + 100 * 24 * 60 * 60 * 1000);
  mockGetConfig.mockImplementation((key: string) => {
    if (key === "referent_handicap_nom") return Promise.resolve("Williams Jullin");
    if (key === "qualiopi_validite") return Promise.resolve(futur90.toISOString().slice(0, 10));
    // BPF de l'année N-1 considéré déposé (marqueur config) → pas d'alerte BPF par défaut.
    if (key === "bpf_annee_deposee") return Promise.resolve(now.getFullYear());
    return Promise.resolve("");
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests stub-aware
// ─────────────────────────────────────────────────────────────────────────────

describe("evaluerAlertes — stub-aware", () => {
  it("retourne [] si DATABASE_URL contient stub.invalid", async () => {
    const orig = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    const result = await evaluerAlertes();
    expect(result).toEqual([]);
    process.env["DATABASE_URL"] = orig;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests règle referent_handicap_absent
// ─────────────────────────────────────────────────────────────────────────────

describe("evaluerAlertes — referent_handicap_absent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupEmptyMocks();
  });

  it("crée une alerte critique si referent_handicap_nom est vide", async () => {
    mockGetConfig.mockImplementation((key: string) => {
      if (key === "referent_handicap_nom") return Promise.resolve("");
      if (key === "qualiopi_validite") {
        const futur = new Date(Date.now() + 100 * 24 * 60 * 60 * 1000);
        return Promise.resolve(futur.toISOString().slice(0, 10));
      }
      return Promise.resolve("");
    });

    const alertes = await evaluerAlertes();
    const a = alertes.find((x) => x.code === "referent_handicap_absent");
    expect(a).toBeDefined();
    expect(a?.niveau).toBe("critique");
    expect(a?.cibleType).toBeUndefined();
  });

  it("ne crée PAS d'alerte si referent_handicap_nom est renseigné", async () => {
    const alertes = await evaluerAlertes();
    const a = alertes.find((x) => x.code === "referent_handicap_absent");
    expect(a).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests règle reclamation_sans_reponse_j15
// ─────────────────────────────────────────────────────────────────────────────

describe("evaluerAlertes — reclamation_sans_reponse_j15", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupEmptyMocks();
  });

  it("crée une alerte critique par réclamation en retard", async () => {
    mp.reclamation.findMany.mockResolvedValue([
      {
        id: "rec-001",
        numero: "AXI-REC-2026-001",
        reclamantNom: "Jean Dupont",
        dateReception: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      },
    ]);

    const alertes = await evaluerAlertes();
    const recs = alertes.filter((x) => x.code === "reclamation_sans_reponse_j15");
    expect(recs).toHaveLength(1);
    expect(recs[0]?.niveau).toBe("critique");
    expect(recs[0]?.cibleType).toBe("Reclamation");
    expect(recs[0]?.cibleId).toBe("rec-001");
  });

  it("ne crée PAS d'alerte si aucune réclamation en retard", async () => {
    const alertes = await evaluerAlertes();
    const recs = alertes.filter((x) => x.code === "reclamation_sans_reponse_j15");
    expect(recs).toHaveLength(0);
  });

  it("crée plusieurs alertes si plusieurs réclamations en retard", async () => {
    mp.reclamation.findMany.mockResolvedValue([
      {
        id: "rec-001",
        numero: "AXI-REC-001",
        reclamantNom: "Alice",
        dateReception: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      },
      {
        id: "rec-002",
        numero: "AXI-REC-002",
        reclamantNom: "Bob",
        dateReception: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    ]);

    const alertes = await evaluerAlertes();
    const recs = alertes.filter((x) => x.code === "reclamation_sans_reponse_j15");
    expect(recs).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests règle emargement_manquant
// ─────────────────────────────────────────────────────────────────────────────

describe("evaluerAlertes — emargement_manquant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupEmptyMocks();
  });

  it("crée une alerte critique par enrollment sans émargement >48h", async () => {
    mp.enrollment.findMany.mockImplementation(
      ({ where }: { where?: { emargementSigneAt?: unknown } }) => {
        // Retourne des enrollments pour la première requête (emargement_manquant)
        if (where && "emargementSigneAt" in where && where.emargementSigneAt === null) {
          return Promise.resolve([
            {
              id: "enr-001",
              trainee: { nom: "Martin", prenom: "Claire" },
              session: { id: "ses-001", numero: "SES-2026-001" },
            },
          ]);
        }
        return Promise.resolve([]);
      },
    );

    const alertes = await evaluerAlertes();
    const emarg = alertes.filter((x) => x.code === "emargement_manquant");
    expect(emarg.length).toBeGreaterThanOrEqual(1);
    if (emarg.length > 0) {
      expect(emarg[0]?.niveau).toBe("critique");
      expect(emarg[0]?.cibleType).toBe("Enrollment");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests règle qualiopi_expiration
// ─────────────────────────────────────────────────────────────────────────────

describe("evaluerAlertes — qualiopi expiration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupEmptyMocks();
  });

  it("crée qualiopi_expire si la date est dépassée", async () => {
    const passe = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    mockGetConfig.mockImplementation((key: string) => {
      if (key === "referent_handicap_nom") return Promise.resolve("Will");
      if (key === "qualiopi_validite") return Promise.resolve(passe.toISOString().slice(0, 10));
      return Promise.resolve("");
    });

    const alertes = await evaluerAlertes();
    const a = alertes.find((x) => x.code === "qualiopi_expire");
    expect(a).toBeDefined();
    expect(a?.niveau).toBe("critique");
  });

  it("crée qualiopi_expire_j30 si la date est dans ≤30 jours", async () => {
    const j20 = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    mockGetConfig.mockImplementation((key: string) => {
      if (key === "referent_handicap_nom") return Promise.resolve("Will");
      if (key === "qualiopi_validite") return Promise.resolve(j20.toISOString().slice(0, 10));
      return Promise.resolve("");
    });

    const alertes = await evaluerAlertes();
    const a = alertes.find((x) => x.code === "qualiopi_expire_j30");
    expect(a).toBeDefined();
    expect(a?.niveau).toBe("critique");
  });

  it("crée qualiopi_expire_j90 si la date est dans ≤90 jours", async () => {
    const j60 = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    mockGetConfig.mockImplementation((key: string) => {
      if (key === "referent_handicap_nom") return Promise.resolve("Will");
      if (key === "qualiopi_validite") return Promise.resolve(j60.toISOString().slice(0, 10));
      return Promise.resolve("");
    });

    const alertes = await evaluerAlertes();
    const a = alertes.find((x) => x.code === "qualiopi_expire_j90");
    expect(a).toBeDefined();
    expect(a?.niveau).toBe("important");
  });

  it("ne crée aucune alerte Qualiopi si la date est dans >90 jours", async () => {
    const alertes = await evaluerAlertes(); // setupEmptyMocks a >90 jours
    const qualiopi = alertes.filter((x) => x.code.startsWith("qualiopi_expire"));
    expect(qualiopi).toHaveLength(0);
  });

  it("ne crée PAS d'alerte si qualiopi_validite est vide", async () => {
    mockGetConfig.mockImplementation((key: string) => {
      if (key === "referent_handicap_nom") return Promise.resolve("Will");
      if (key === "qualiopi_validite") return Promise.resolve("");
      return Promise.resolve("");
    });

    const alertes = await evaluerAlertes();
    const qualiopi = alertes.filter((x) => x.code.startsWith("qualiopi_expire"));
    expect(qualiopi).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests règle BPF
// ─────────────────────────────────────────────────────────────────────────────

describe("evaluerAlertes — BPF", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupEmptyMocks();
  });

  it("ne crée PAS d'alerte BPF si le BPF de l'année est déposé (bpf_annee_deposee)", async () => {
    // setupEmptyMocks règle déjà bpf_annee_deposee = année courante (≥ N-1) → déposé.
    const alertes = await evaluerAlertes();
    const bpf = alertes.filter((x) => x.code.startsWith("bpf_"));
    expect(bpf).toHaveLength(0);
  });

  it("crée bpf_a_deposer si BPF non déposé + date > 1er avril", async () => {
    const now = new Date();
    const futur90 = new Date(now.getTime() + 100 * 24 * 60 * 60 * 1000);
    // BPF non déposé (année 0) → l'alerte BPF dépend de la date courante.
    mockGetConfig.mockImplementation((key: string) => {
      if (key === "referent_handicap_nom") return Promise.resolve("Williams Jullin");
      if (key === "qualiopi_validite") return Promise.resolve(futur90.toISOString().slice(0, 10));
      if (key === "bpf_annee_deposee") return Promise.resolve(0);
      return Promise.resolve("");
    });

    const alertes = await evaluerAlertes();
    const bpf = alertes.filter((x) => x.code.startsWith("bpf_"));

    // Si on est avant le 1er avril, aucune alerte BPF
    const annee = now.getFullYear();
    const avrilThreshold = new Date(`${annee}-04-01`);
    if (now < avrilThreshold) {
      expect(bpf).toHaveLength(0);
    } else {
      expect(bpf.length).toBeGreaterThanOrEqual(1);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests règle veille_inactive_j45
// ─────────────────────────────────────────────────────────────────────────────

describe("evaluerAlertes — veille_inactive_j45", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupEmptyMocks();
  });

  it("crée une alerte si aucune entrée de veille", async () => {
    mp.veille.findFirst.mockResolvedValue(null);

    const alertes = await evaluerAlertes();
    const a = alertes.find((x) => x.code === "veille_inactive_j45");
    expect(a).toBeDefined();
    expect(a?.niveau).toBe("important");
  });

  it("crée une alerte si dernière veille il y a >45 jours", async () => {
    mp.veille.findFirst.mockResolvedValue({
      dateVeille: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000),
    });

    const alertes = await evaluerAlertes();
    const a = alertes.find((x) => x.code === "veille_inactive_j45");
    expect(a).toBeDefined();
  });

  it("ne crée PAS d'alerte si dernière veille il y a <45 jours", async () => {
    mp.veille.findFirst.mockResolvedValue({
      dateVeille: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    });

    const alertes = await evaluerAlertes();
    const a = alertes.find((x) => x.code === "veille_inactive_j45");
    expect(a).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests règle factures_impayees
// ─────────────────────────────────────────────────────────────────────────────

describe("evaluerAlertes — factures impayées", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupEmptyMocks();
  });

  it("crée facture_impayee_j30 pour une facture impayée >30j", async () => {
    mp.factureFormation.findMany.mockResolvedValue([
      {
        id: "fac-001",
        numero: "AXI-FAC-2026-001",
        echeanceAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
      },
    ]);

    const alertes = await evaluerAlertes();
    const fac = alertes.filter((x) => x.code.startsWith("facture_impayee"));
    expect(fac.length).toBeGreaterThanOrEqual(1);
    const f30 = fac.find((x) => x.code === "facture_impayee_j30");
    expect(f30).toBeDefined();
    expect(f30?.cibleType).toBe("FactureFormation");
    expect(f30?.cibleId).toBe("fac-001");
  });

  it("crée facture_impayee_j60 pour une facture impayée >60j", async () => {
    mp.factureFormation.findMany.mockResolvedValue([
      {
        id: "fac-002",
        numero: "AXI-FAC-2026-002",
        echeanceAt: new Date(Date.now() - 65 * 24 * 60 * 60 * 1000),
      },
    ]);

    const alertes = await evaluerAlertes();
    const f60 = alertes.find((x) => x.code === "facture_impayee_j60");
    expect(f60).toBeDefined();
    expect(f60?.niveau).toBe("critique");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests fail-soft (erreur d'une règle n'interrompt pas les autres)
// ─────────────────────────────────────────────────────────────────────────────

describe("evaluerAlertes — fail-soft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupEmptyMocks();
  });

  it("continue les autres règles si une règle échoue", async () => {
    // La règle réclamation va échouer
    mp.reclamation.findMany.mockRejectedValue(new Error("DB error"));

    // Les autres règles doivent continuer
    mp.veille.findFirst.mockResolvedValue(null); // déclenche veille_inactive_j45

    const alertes = await evaluerAlertes();
    // Doit trouver l'alerte veille malgré l'erreur réclamation
    const a = alertes.find((x) => x.code === "veille_inactive_j45");
    expect(a).toBeDefined();
    // Pas d'alerte réclamation (règle en erreur)
    const recs = alertes.filter((x) => x.code === "reclamation_sans_reponse_j15");
    expect(recs).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests OPCO
// ─────────────────────────────────────────────────────────────────────────────

describe("evaluerAlertes — OPCO", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupEmptyMocks();
  });

  it("crée opco_sans_accord si session planifiée J-7 sans accord", async () => {
    mp.trainingSession.findMany.mockImplementation(
      ({ where }: { where?: { statut?: string; opcoStatut?: string } }) => {
        if (where?.statut === "planifiee" && where?.opcoStatut === "non_demande") {
          return Promise.resolve([
            {
              id: "ses-001",
              numero: "SES-2026-001",
              dateDebut: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
              enrollments: [],
            },
          ]);
        }
        return Promise.resolve([]);
      },
    );

    const alertes = await evaluerAlertes();
    const a = alertes.find((x) => x.code === "opco_sans_accord");
    expect(a).toBeDefined();
    expect(a?.niveau).toBe("important");
    expect(a?.cibleType).toBe("TrainingSession");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests RGPD suppression
// ─────────────────────────────────────────────────────────────────────────────

describe("evaluerAlertes — suppression_rgpd_j30", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupEmptyMocks();
  });

  it("crée une alerte info si demande de suppression RGPD >30j non traitée", async () => {
    mp.rgpdDemande.findMany.mockResolvedValue([
      {
        id: "rgpd-001",
        traineeId: "trainee-001",
        demandeAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
      },
    ]);

    const alertes = await evaluerAlertes();
    const a = alertes.find((x) => x.code === "suppression_rgpd_j30");
    expect(a).toBeDefined();
    expect(a?.niveau).toBe("info");
    expect(a?.cibleType).toBe("RgpdDemande");
    expect(a?.cibleId).toBe("rgpd-001");
  });

  it("ne crée PAS d'alerte si aucune demande en attente >30j", async () => {
    const alertes = await evaluerAlertes();
    const a = alertes.find((x) => x.code === "suppression_rgpd_j30");
    expect(a).toBeUndefined();
  });
});
