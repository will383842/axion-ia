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
    // Vigilance sous-traitance : la règle couvre les DEUX natures. [2026-08-03]
    sousTraitant: { findMany: vi.fn() },
    factureFormation: { findMany: vi.fn() },
    dossierFinancement: { findMany: vi.fn() },
    veille: { findFirst: vi.fn() },
    revueDirection: { findUnique: vi.fn(), findFirst: vi.fn() },
    rgpdDemande: { findMany: vi.fn() },
    // Refonte console phase 1 (2026-08-01) : devis dormants + signatures qui traînent.
    devis: { findMany: vi.fn() },
    documentGenere: { findMany: vi.fn() },
    // Recouvrement 2026-08-02 : relances envoyées restées sans effet.
    relanceProposee: { findMany: vi.fn() },
    // Art. 8 sous-traitance : incidents répétés d'un intervenant. [2026-08-03]
    incident: { groupBy: vi.fn() },
  },
}));

vi.mock("@/server/qualiopi/config/site-settings", () => ({
  getQualiopiConfig: vi.fn(),
}));

// Référentiel OPCO versionné (Lot 5) — mock de la lecture (estBaremePerime reste réel).
vi.mock("@/server/qualiopi/financements/bareme-opco", () => ({
  listBaremesEnVigueur: vi.fn(),
}));

// Vigilance URSSAF — on mocke les LECTURES (pièces + cumul annuel) ; les
// fonctions d'évaluation (seuil, sélection, péremption) restent RÉELLES : ce
// sont les mêmes que la carte conformité, et c'est précisément ce que la règle
// promet de ne pas réimplémenter.
vi.mock("@/server/qualiopi/trainers/documents", () => ({
  listTrainerDocuments: vi.fn(),
  cumulAnnuelFormateurCents: vi.fn(),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Imports
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { listBaremesEnVigueur } from "@/server/qualiopi/financements/bareme-opco";
import {
  cumulAnnuelFormateurCents,
  listTrainerDocuments,
} from "@/server/qualiopi/trainers/documents";
import { evaluerAlertes } from "./evaluateur";
import { ALERTE_CATALOGUE } from "./catalogue";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers typed
// ─────────────────────────────────────────────────────────────────────────────

const mp = prisma as unknown as {
  reclamation: { findMany: ReturnType<typeof vi.fn> };
  enrollment: { findMany: ReturnType<typeof vi.fn> };
  trainingSession: { findMany: ReturnType<typeof vi.fn> };
  trainer: { findMany: ReturnType<typeof vi.fn> };
  sousTraitant: { findMany: ReturnType<typeof vi.fn> };
  incident: { groupBy: ReturnType<typeof vi.fn> };
  factureFormation: { findMany: ReturnType<typeof vi.fn> };
  dossierFinancement: { findMany: ReturnType<typeof vi.fn> };
  veille: { findFirst: ReturnType<typeof vi.fn> };
  revueDirection: {
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
  rgpdDemande: { findMany: ReturnType<typeof vi.fn> };
  devis: { findMany: ReturnType<typeof vi.fn> };
  documentGenere: { findMany: ReturnType<typeof vi.fn> };
  relanceProposee: { findMany: ReturnType<typeof vi.fn> };
};

const mockGetConfig = getQualiopiConfig as ReturnType<typeof vi.fn>;
const mockListBaremes = listBaremesEnVigueur as ReturnType<typeof vi.fn>;
const mockListTrainerDocs = listTrainerDocuments as ReturnType<typeof vi.fn>;
const mockCumulAnnuel = cumulAnnuelFormateurCents as ReturnType<typeof vi.fn>;

/** Configure tous les mocks prisma pour retourner des résultats vides (aucune alerte). */
function setupEmptyMocks() {
  mockListBaremes.mockResolvedValue([]); // aucun barème OPCO → pas d'alerte de péremption
  mockListTrainerDocs.mockResolvedValue([]); // aucune pièce formateur
  mockCumulAnnuel.mockResolvedValue(0); // sous le seuil de vigilance
  mp.reclamation.findMany.mockResolvedValue([]);
  mp.enrollment.findMany.mockResolvedValue([]);
  mp.trainingSession.findMany.mockResolvedValue([]);
  mp.trainer.findMany.mockResolvedValue([]);
  mp.factureFormation.findMany.mockResolvedValue([]);
  mp.dossierFinancement.findMany.mockResolvedValue([]);
  mp.veille.findFirst.mockResolvedValue({ dateVeille: new Date() }); // veille récente
  mp.revueDirection.findUnique.mockResolvedValue({ statut: "valide" }); // BPF déposé
  mp.revueDirection.findFirst.mockResolvedValue({ id: "revue-001" }); // revue récente (cadence OK)
  mp.rgpdDemande.findMany.mockResolvedValue([]);
  mp.devis.findMany.mockResolvedValue([]);
  mp.documentGenere.findMany.mockResolvedValue([]);
  mp.relanceProposee.findMany.mockResolvedValue([]);
  // 🔴 [2026-08-03] Ces deux-là manquaient : `regleVigilanceSousTraitance` lisait
  // un mock non configuré, levait, et le fail-soft par règle avalait l'exception.
  // La règle était donc INERTE dans tous les tests hors de son propre bloc — une
  // régression y serait passée inaperçue.
  mp.sousTraitant.findMany.mockResolvedValue([]);
  mp.incident.groupBy.mockResolvedValue([]);
  // Config : referent_handicap_nom non vide, qualiopi_validite dans >90j
  const now = new Date();
  const futur90 = new Date(now.getTime() + 100 * 24 * 60 * 60 * 1000);
  mockGetConfig.mockImplementation((key: string) => {
    if (key === "referent_handicap_nom") return Promise.resolve("Williams Jullin");
    if (key === "responsable_qualite_nom") return Promise.resolve("Williams Jullin");
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
// Tests règle responsable_qualite_absent
// ─────────────────────────────────────────────────────────────────────────────

describe("evaluerAlertes — responsable_qualite_absent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupEmptyMocks();
  });

  it("crée une alerte importante si responsable_qualite_nom est vide", async () => {
    mockGetConfig.mockImplementation((key: string) => {
      if (key === "referent_handicap_nom") return Promise.resolve("Williams Jullin");
      if (key === "responsable_qualite_nom") return Promise.resolve("");
      if (key === "qualiopi_validite") {
        const futur = new Date(Date.now() + 100 * 24 * 60 * 60 * 1000);
        return Promise.resolve(futur.toISOString().slice(0, 10));
      }
      if (key === "bpf_annee_deposee") return Promise.resolve(new Date().getFullYear());
      return Promise.resolve("");
    });

    const alertes = await evaluerAlertes();
    const a = alertes.find((x) => x.code === "responsable_qualite_absent");
    expect(a).toBeDefined();
    expect(a?.niveau).toBe("important");
    expect(a?.cibleType).toBeUndefined();
  });

  it("ne crée PAS d'alerte si responsable_qualite_nom est renseigné", async () => {
    const alertes = await evaluerAlertes();
    const a = alertes.find((x) => x.code === "responsable_qualite_absent");
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
// Tests règle session_sans_formateur
// ─────────────────────────────────────────────────────────────────────────────

describe("evaluerAlertes — session_sans_formateur", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupEmptyMocks();
  });

  it("crée une alerte importante par session à J-7 sans formateur principal", async () => {
    mp.trainingSession.findMany.mockImplementation(
      ({ where }: { where?: { formateurPrincipalId?: unknown } }) => {
        if (where && "formateurPrincipalId" in where && where.formateurPrincipalId === null) {
          return Promise.resolve([
            {
              id: "ses-042",
              numero: "SES-2026-042",
              titreSession: "IA Express — Entreprise Exemple",
              dateDebut: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            },
          ]);
        }
        return Promise.resolve([]);
      },
    );

    const alertes = await evaluerAlertes();
    const a = alertes.find((x) => x.code === "session_sans_formateur");
    expect(a).toBeDefined();
    expect(a?.niveau).toBe("important");
    expect(a?.cibleType).toBe("TrainingSession");
    expect(a?.cibleId).toBe("ses-042");
    expect(a?.message).toContain("SES-2026-042");
  });

  it("aucune alerte quand toutes les sessions proches ont un formateur", async () => {
    const alertes = await evaluerAlertes();
    expect(alertes.find((x) => x.code === "session_sans_formateur")).toBeUndefined();
  });

  // 🔴 La borne basse de 365 jours est VOULUE (une non-conformité réelle ne doit
  // pas disparaître en silence), mais le titre et le verbe restaient au futur :
  // « Session à J-7 … démarre le 08/07/2026 » sur une session commencée depuis
  // 25 jours. Une alerte qui annonce au futur un fait accompli se lit comme un
  // bug du système, et on cesse de la lire.
  it("parle au PASSÉ quand la session a déjà démarré", async () => {
    mp.trainingSession.findMany.mockImplementation(
      ({ where }: { where?: { formateurPrincipalId?: unknown } }) => {
        if (where && "formateurPrincipalId" in where && where.formateurPrincipalId === null) {
          return Promise.resolve([
            {
              id: "ses-001",
              numero: "SES-2026-001",
              titreSession: "Découverte de l'IA générative",
              dateDebut: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
              client: null,
            },
          ]);
        }
        return Promise.resolve([]);
      },
    );

    const alertes = await evaluerAlertes();
    const a = alertes.find((x) => x.code === "session_sans_formateur");
    expect(a?.titre).toBe("Session démarrée sans formateur principal");
    expect(a?.message).toContain("a démarré le");
    expect(a?.message).not.toContain("démarre le 0");
    // Sans client rattaché, on le DIT : c'est souvent l'anomalie elle-même.
    expect(a?.message).toContain("aucun client rattaché");
  });

  // 🔴 Les alertes ne nommaient que le numéro de session. Il fallait ouvrir la
  // fiche pour savoir de QUI il s'agit — impraticable dès quelques sessions.
  it("nomme le client dans le message", async () => {
    mp.trainingSession.findMany.mockImplementation(
      ({ where }: { where?: { formateurPrincipalId?: unknown } }) => {
        if (where && "formateurPrincipalId" in where && where.formateurPrincipalId === null) {
          return Promise.resolve([
            {
              id: "ses-003",
              numero: "SES-2026-003",
              titreSession: "IA pour l'immobilier",
              dateDebut: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
              client: { raisonSociale: "INVEST SUN" },
            },
          ]);
        }
        return Promise.resolve([]);
      },
    );

    const alertes = await evaluerAlertes();
    const a = alertes.find((x) => x.code === "session_sans_formateur");
    expect(a?.message).toContain("INVEST SUN");
  });
});

/**
 * R03ter — session bloquée en `en_cours`.
 *
 * Angle mort comblé : R03 (`emargement_manquant`) exige `statut: "realisee"`,
 * que la clôture automatique refuse de poser sans trace de présence. Une session
 * non émargée n'était donc signalée par AUCUNE règle.
 */
describe("regleSessionBloqueeEnCours", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupEmptyMocks();
  });

  it("crée une alerte critique par session en_cours terminée depuis +72 h", async () => {
    mp.trainingSession.findMany.mockImplementation(
      ({ where }: { where?: { statut?: unknown } }) => {
        if (where && where.statut === "en_cours") {
          return Promise.resolve([
            {
              id: "ses-099",
              numero: "SES-2026-099",
              dateFin: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
              _count: { enrollments: 12 },
            },
          ]);
        }
        return Promise.resolve([]);
      },
    );

    const alertes = await evaluerAlertes();
    const a = alertes.find((x) => x.code === "session_bloquee_en_cours");
    expect(a).toBeDefined();
    expect(a?.niveau).toBe("critique");
    expect(a?.cibleType).toBe("TrainingSession");
    expect(a?.cibleId).toBe("ses-099");
    expect(a?.message).toContain("SES-2026-099");
    // Le message doit dire POURQUOI c'est grave, pas seulement constater.
    expect(a?.message).toContain("12");
    expect(a?.message).toContain("BPF");
  });

  it("aucune alerte quand aucune session n'est bloquée", async () => {
    const alertes = await evaluerAlertes();
    expect(alertes.find((x) => x.code === "session_bloquee_en_cours")).toBeUndefined();
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

  it("crée bpf_a_deposer si BPF non déposé + date > 1er avril + ORGANISME DÉCLARÉ", async () => {
    const now = new Date();
    const futur90 = new Date(now.getTime() + 100 * 24 * 60 * 60 * 1000);
    // BPF non déposé (année 0) → l'alerte BPF dépend de la date courante.
    // 🔴 F56 — le NDA est désormais INDISPENSABLE : sans déclaration d'activité,
    // aucun BPF n'est dû et la règle ne doit rien lever (cf. cas suivant).
    mockGetConfig.mockImplementation((key: string) => {
      if (key === "referent_handicap_nom") return Promise.resolve("Williams Jullin");
      if (key === "qualiopi_validite") return Promise.resolve(futur90.toISOString().slice(0, 10));
      if (key === "bpf_annee_deposee") return Promise.resolve(0);
      if (key === "nda_numero") return Promise.resolve("84691234567");
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

  // 🔴 F56 — l'obligation de déposer un BPF (art. L6352-11) ne naît qu'avec la
  // DÉCLARATION D'ACTIVITÉ. Sans NDA, l'organisme n'en est pas un au sens du code
  // du travail : il ne doit aucun bilan. La règle affichait pourtant « BPF en
  // retard — régularisation urgente auprès de la DREETS » en CRITIQUE, sur un
  // écran qu'un certificateur peut ouvrir. Constaté en production le 2026-07-26.
  it("F56 : ne crée AUCUNE alerte BPF si l'organisme n'a pas de NDA", async () => {
    mockGetConfig.mockImplementation((key: string) => {
      if (key === "referent_handicap_nom") return Promise.resolve("Williams Jullin");
      if (key === "bpf_annee_deposee") return Promise.resolve(0);
      if (key === "nda_numero") return Promise.resolve("");
      return Promise.resolve("");
    });

    const alertes = await evaluerAlertes();

    expect(alertes.filter((x) => x.code.startsWith("bpf_"))).toHaveLength(0);
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

  /** Récupère l'argument du `findMany` de la règle des impayés (par son select). */
  function whereDesImpayes(): Record<string, unknown> | null {
    for (const call of mp.factureFormation.findMany.mock.calls) {
      const arg = call[0] as {
        where?: Record<string, unknown>;
        select?: Record<string, unknown>;
      };
      // La règle des impayés est la seule à sélectionner `statut` avec un
      // `echeanceAt` NON nul dans son filtre.
      const w = arg.where as { echeanceAt?: unknown } | undefined;
      const ech = w?.echeanceAt as { not?: unknown } | undefined;
      if (arg.select?.["statut"] === true && ech?.not === null) {
        return arg.where ?? null;
      }
    }
    return null;
  }

  // 🔴 LE test qui manquait. L'ancien spec mockait `findMany` sans jamais
  // regarder le `where` : il passait au vert sur du CODE MORT. Le filtre
  // omettait `en_retard`, alors que le cron de 06:30 UTC y bascule toute facture
  // échue AVANT que le cron d'alertes de 07:00 UTC ne s'exécute. La requête ne
  // pouvait donc plus ramener une seule ligne — et le test ne le voyait pas.
  it("le WHERE inclut « en_retard » (sans quoi la règle est du code mort)", async () => {
    mp.factureFormation.findMany.mockResolvedValue([]);
    await evaluerAlertes();

    const where = whereDesImpayes();
    expect(where, "aucun findMany reconnaissable pour la règle des impayés").not.toBeNull();
    const statut = where?.["statut"] as { in?: string[] } | undefined;
    expect(statut?.in).toContain("en_retard");
    expect(statut?.in).toContain("emise");
    expect(statut?.in).toContain("partiellement_payee");
    // Un avoir n'est pas une créance.
    expect(where?.["avoirDeId"]).toBeNull();
  });

  it("crée facture_impayee_j60 pour une facture impayée >60j", async () => {
    mp.factureFormation.findMany.mockResolvedValue([
      {
        id: "fac-002",
        numero: "AXI-FAC-2026-002",
        statut: "en_retard",
        echeanceAt: new Date(Date.now() - 65 * 24 * 60 * 60 * 1000),
      },
    ]);

    const alertes = await evaluerAlertes();
    const f60 = alertes.find((x) => x.code === "facture_impayee_j60");
    expect(f60).toBeDefined();
    expect(f60?.niveau).toBe("critique");
    expect(f60?.cibleType).toBe("FactureFormation");
    expect(f60?.cibleId).toBe("fac-002");
  });

  // 🔴 Anti-doublon, arbitrage 2026-08-02 : le palier J30 est déjà couvert par
  // une `RelanceProposee` ACTIONNABLE dans le hub facturation. Faire tomber les
  // deux pour le même fait créait deux signaux concurrents, avec deux cycles de
  // vie — l'admin envoyait la relance, la proposition passait `envoyee`, et
  // l'alerte restait ouverte à côté sans plus rien signifier.
  it("n'émet PLUS facture_impayee_j30 : ce palier est couvert par une relance proposée", async () => {
    mp.factureFormation.findMany.mockResolvedValue([
      {
        id: "fac-001",
        numero: "AXI-FAC-2026-001",
        statut: "en_retard",
        echeanceAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
      },
    ]);

    const alertes = await evaluerAlertes();
    expect(alertes.find((x) => x.code === "facture_impayee_j30")).toBeUndefined();
    // …et rien ne tombe non plus à J35 : seule l'escalade J60 alerte.
    expect(alertes.find((x) => x.code === "facture_impayee_j60")).toBeUndefined();
  });

  it("le code facture_impayee_j30 reste au CATALOGUE (résolution auto des alertes en base)", () => {
    // Le retirer figerait à vie les alertes déjà créées : `synchroniserAlertes`
    // ne résout que les codes présents avec `resolutionAuto: true`.
    expect(ALERTE_CATALOGUE["facture_impayee_j30"]).toBeDefined();
    expect(ALERTE_CATALOGUE["facture_impayee_j30"]?.resolutionAuto).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests règle facture SANS ÉCHÉANCE (filet de sécurité du recouvrement)
// ─────────────────────────────────────────────────────────────────────────────

describe("evaluerAlertes — facture émise sans échéance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupEmptyMocks();
  });

  it("alerte sur une facture ouverte dont l'échéance est nulle", async () => {
    mp.factureFormation.findMany.mockResolvedValue([
      {
        id: "fac-sans-echeance",
        numero: "AXI-FACT-2026-001",
        statut: "emise",
        emiseAt: new Date("2026-08-01T09:00:00Z"),
        echeanceAt: null,
      },
    ]);

    const alertes = await evaluerAlertes();
    const a = alertes.find((x) => x.code === "facture_sans_echeance");
    expect(a).toBeDefined();
    expect(a?.niveau).toBe("important");
    expect(a?.cibleType).toBe("FactureFormation");
    expect(a?.cibleId).toBe("fac-sans-echeance");
    // Le message doit DIRE la conséquence, pas seulement constater le manque.
    expect(a?.message).toContain("AXI-FACT-2026-001");
    expect(a?.message).toContain("INVISIBLE");
  });

  it("n'alerte PAS quand l'échéance est renseignée", async () => {
    mp.factureFormation.findMany.mockResolvedValue([
      {
        id: "fac-ok",
        numero: "AXI-FACT-2026-002",
        statut: "en_retard",
        emiseAt: new Date("2026-06-01T09:00:00Z"),
        echeanceAt: new Date("2026-07-01T09:00:00Z"),
      },
    ]);

    const alertes = await evaluerAlertes();
    expect(alertes.find((x) => x.code === "facture_sans_echeance")).toBeUndefined();
  });

  it("le code est au catalogue, en résolution automatique", () => {
    expect(ALERTE_CATALOGUE["facture_sans_echeance"]).toBeDefined();
    expect(ALERTE_CATALOGUE["facture_sans_echeance"]?.resolutionAuto).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests règle RELANCE SANS EFFET (« des alertes pour les relances passées »)
// ─────────────────────────────────────────────────────────────────────────────

describe("evaluerAlertes — relance envoyée sans effet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupEmptyMocks();
  });

  const ilYA = (jours: number) => new Date(Date.now() - jours * 24 * 60 * 60 * 1000);

  it("alerte quand une relance envoyée il y a +15 j n'a produit aucun encaissement", async () => {
    mp.relanceProposee.findMany.mockResolvedValue([
      {
        palier: "j30",
        traiteeAt: ilYA(20),
        factureFormationId: "fac-010",
        factureFormation: { id: "fac-010", numero: "AXI-FACT-2026-010", payments: [] },
      },
    ]);

    const alertes = await evaluerAlertes();
    const a = alertes.find((x) => x.code === "relance_sans_effet");
    expect(a).toBeDefined();
    expect(a?.niveau).toBe("important");
    expect(a?.cibleType).toBe("FactureFormation");
    expect(a?.cibleId).toBe("fac-010");
    expect(a?.message).toContain("AXI-FACT-2026-010");
  });

  // 🔴 Un versement partiel arrivé APRÈS la relance prouve qu'elle a porté,
  // même si le solde reste dû. Alerter alors ignorerait la réponse du client.
  it("n'alerte PAS si un encaissement est arrivé depuis l'envoi", async () => {
    mp.relanceProposee.findMany.mockResolvedValue([
      {
        palier: "j30",
        traiteeAt: ilYA(20),
        factureFormationId: "fac-011",
        factureFormation: {
          id: "fac-011",
          numero: "AXI-FACT-2026-011",
          payments: [{ paidAt: ilYA(5) }],
        },
      },
    ]);

    const alertes = await evaluerAlertes();
    expect(alertes.find((x) => x.code === "relance_sans_effet")).toBeUndefined();
  });

  it("un encaissement ANTÉRIEUR à la relance ne compte pas comme une réponse", async () => {
    mp.relanceProposee.findMany.mockResolvedValue([
      {
        palier: "j15",
        traiteeAt: ilYA(20),
        factureFormationId: "fac-012",
        factureFormation: {
          id: "fac-012",
          numero: "AXI-FACT-2026-012",
          payments: [{ paidAt: ilYA(40) }],
        },
      },
    ]);

    const alertes = await evaluerAlertes();
    expect(alertes.find((x) => x.code === "relance_sans_effet")).toBeDefined();
  });

  it("une seule alerte par FACTURE, même si plusieurs paliers sont restés sans effet", async () => {
    mp.relanceProposee.findMany.mockResolvedValue([
      {
        palier: "j30",
        traiteeAt: ilYA(18),
        factureFormationId: "fac-013",
        factureFormation: { id: "fac-013", numero: "AXI-FACT-2026-013", payments: [] },
      },
      {
        palier: "j15",
        traiteeAt: ilYA(40),
        factureFormationId: "fac-013",
        factureFormation: { id: "fac-013", numero: "AXI-FACT-2026-013", payments: [] },
      },
    ]);

    const alertes = await evaluerAlertes();
    const relanceAlertes = alertes.filter((x) => x.code === "relance_sans_effet");
    expect(relanceAlertes).toHaveLength(1);
    // La PLUS RÉCENTE est retenue (le findMany est trié `traiteeAt` desc).
    expect(relanceAlertes[0]?.message).toContain("J+30");
  });

  it("n'alerte pas sur une relance envoyée il y a moins de 15 jours", async () => {
    mp.relanceProposee.findMany.mockResolvedValue([
      {
        palier: "j1",
        traiteeAt: ilYA(3),
        factureFormationId: "fac-014",
        factureFormation: { id: "fac-014", numero: "AXI-FACT-2026-014", payments: [] },
      },
    ]);

    const alertes = await evaluerAlertes();
    expect(alertes.find((x) => x.code === "relance_sans_effet")).toBeUndefined();
  });

  it("le code est au catalogue, en résolution automatique", () => {
    expect(ALERTE_CATALOGUE["relance_sans_effet"]).toBeDefined();
    expect(ALERTE_CATALOGUE["relance_sans_effet"]?.resolutionAuto).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests règle dossiers de financement (suivi OPCO / France Travail)
// ─────────────────────────────────────────────────────────────────────────────

describe("evaluerAlertes — dossiers de financement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupEmptyMocks();
  });

  it("dossier envoyé +30 j sans réponse → alerte importante avec le n° externe", async () => {
    // La règle fait DEUX findMany (sans réponse, puis retard de paiement) :
    // répondre dans l'ordre des appels, pas une valeur unique.
    mp.dossierFinancement.findMany
      .mockResolvedValueOnce([
        {
          id: "dos-00000001",
          financeurNom: "OPCO Atlas",
          numeroDossierExterne: "ATL-2026-0042",
          envoyeAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
        },
      ])
      .mockResolvedValueOnce([]);

    const alertes = await evaluerAlertes();
    const a = alertes.find((x) => x.code === "dossier_financement_sans_reponse");
    expect(a).toBeDefined();
    expect(a?.niveau).toBe("important");
    expect(a?.message).toContain("ATL-2026-0042");
    expect(a?.message).toContain("OPCO Atlas");
    expect(a?.cibleType).toBe("DossierFinancement");
  });

  it("échéance financeur dépassée sans paiement → alerte CRITIQUE (trésorerie due)", async () => {
    mp.dossierFinancement.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: "dos-00000002",
        financeurNom: "OPCO EP",
        numeroDossierExterne: null,
        echeanceFinanceurAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
    ]);

    const alertes = await evaluerAlertes();
    const a = alertes.find((x) => x.code === "financeur_paiement_en_retard");
    expect(a).toBeDefined();
    expect(a?.niveau).toBe("critique");
    expect(a?.message).toContain("OPCO EP");
  });

  it("aucun dossier en souffrance → aucune alerte de financement", async () => {
    const alertes = await evaluerAlertes();
    expect(alertes.filter((x) => x.code === "dossier_financement_sans_reponse")).toHaveLength(0);
    expect(alertes.filter((x) => x.code === "financeur_paiement_en_retard")).toHaveLength(0);
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

// ─────────────────────────────────────────────────────────────────────────────
// Tests revue trimestrielle (LOT 4)
// ─────────────────────────────────────────────────────────────────────────────

describe("evaluerAlertes — revue_trimestrielle_a_faire", () => {
  /** Config par défaut + flag revue_trimestrielle_activee contrôlable. */
  function setupConfigAvecCadence(activee: boolean) {
    const now = new Date();
    const futur90 = new Date(now.getTime() + 100 * 24 * 60 * 60 * 1000);
    mockGetConfig.mockImplementation((key: string) => {
      if (key === "referent_handicap_nom") return Promise.resolve("Williams Jullin");
      if (key === "responsable_qualite_nom") return Promise.resolve("Williams Jullin");
      if (key === "qualiopi_validite") return Promise.resolve(futur90.toISOString().slice(0, 10));
      if (key === "bpf_annee_deposee") return Promise.resolve(now.getFullYear());
      if (key === "revue_trimestrielle_activee") return Promise.resolve(activee);
      return Promise.resolve("");
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    setupEmptyMocks();
  });

  it("crée une alerte info si activée et aucune revue depuis le trimestre précédent", async () => {
    setupConfigAvecCadence(true);
    mp.revueDirection.findFirst.mockResolvedValue(null);

    const alertes = await evaluerAlertes();
    const a = alertes.find((x) => x.code === "revue_trimestrielle_a_faire");
    expect(a).toBeDefined();
    expect(a?.niveau).toBe("info");
    expect(a?.message).toContain("revue de direction");
  });

  it("ne crée PAS d'alerte si une revue couvre le trimestre précédent (dateRevue récente)", async () => {
    setupConfigAvecCadence(true);
    mp.revueDirection.findFirst.mockResolvedValue({ id: "revue-001" });

    const alertes = await evaluerAlertes();
    expect(alertes.find((x) => x.code === "revue_trimestrielle_a_faire")).toBeUndefined();
    // La requête filtre bien sur dateRevue >= début du trimestre précédent
    const arg = mp.revueDirection.findFirst.mock.calls[0]?.[0] as {
      where: { dateRevue: { gte: Date } };
    };
    expect(arg.where.dateRevue.gte).toBeInstanceOf(Date);
  });

  it("ne crée PAS d'alerte si la cadence est désactivée (config false)", async () => {
    setupConfigAvecCadence(false);
    mp.revueDirection.findFirst.mockResolvedValue(null);

    const alertes = await evaluerAlertes();
    expect(alertes.find((x) => x.code === "revue_trimestrielle_a_faire")).toBeUndefined();
    expect(mp.revueDirection.findFirst).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests bareme_opco_perime (Lot 5)
// ─────────────────────────────────────────────────────────────────────────────

describe("evaluerAlertes — bareme_opco_perime", () => {
  beforeEach(() => setupEmptyMocks());

  it("lève une alerte par barème en vigueur au relevé périmé (> 12 mois)", async () => {
    const vieux = new Date();
    vieux.setFullYear(vieux.getFullYear() - 2);
    mockListBaremes.mockResolvedValue([
      { id: "b1", opco: "atlas", releveLe: vieux },
      { id: "b2", opco: "akto", releveLe: new Date() }, // récent → pas d'alerte
    ]);
    const alertes = await evaluerAlertes();
    const perimes = alertes.filter((a) => a.code === "bareme_opco_perime");
    expect(perimes).toHaveLength(1);
    expect(perimes[0]?.cibleId).toBe("b1");
    expect(perimes[0]?.cibleType).toBe("BaremeOpco");
  });

  it("traite un relevé absent comme périmé", async () => {
    mockListBaremes.mockResolvedValue([{ id: "b3", opco: "afdas", releveLe: null }]);
    const alertes = await evaluerAlertes();
    expect(alertes.filter((a) => a.code === "bareme_opco_perime")).toHaveLength(1);
  });

  it("aucune alerte si tous les relevés sont récents", async () => {
    mockListBaremes.mockResolvedValue([{ id: "b2", opco: "akto", releveLe: new Date() }]);
    const alertes = await evaluerAlertes();
    expect(alertes.filter((a) => a.code === "bareme_opco_perime")).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Faux positifs corrigés — vérification E2E 2026-07-26
//
// Quatre règles concluaient au manquement sans vérifier quelle obligation
// s'applique. Sur un tableau de bord d'audit, une alerte CRITIQUE fausse coûte
// plus cher qu'une alerte manquante : elle envoie Will corriger un problème qui
// n'existe pas, et décrédibilise les vraies.
//
// Le harnais de mock ne rejoue pas le filtrage Prisma : pour les règles dont le
// tri est fait EN BASE, on assère donc la forme du `where` émis — c'est lui qui
// porte le correctif. Pour R12, dont la logique est en JS après la lecture, on
// assère le comportement.
// ─────────────────────────────────────────────────────────────────────────────

describe("Faux positifs — gardes sur le where émis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupEmptyMocks();
  });

  function whereEmis(predicat: (w: Record<string, unknown>) => boolean): Record<string, unknown> {
    const appels = mp.trainingSession.findMany.mock.calls as Array<
      [{ where?: Record<string, unknown> }]
    >;
    const trouve = appels.map((c) => c[0]?.where ?? {}).find(predicat);
    expect(trouve).toBeDefined();
    return trouve!;
  }

  it("R13 J-7 — n'interroge que les sessions qu'un OPCO finance réellement", async () => {
    await evaluerAlertes();
    // `opcoStatut: "non_demande"` est la valeur PAR DÉFAUT du schéma : filtrer
    // dessus seul faisait lever l'alerte sur toute session sans financement.
    const w = whereEmis((x) => x["opcoStatut"] === "non_demande" && x["statut"] === "planifiee");
    expect(w["OR"]).toEqual([{ opcoSubrogation: true }, { dossiersFinancement: { some: {} } }]);
  });

  it("R03bis — borne basse d'un an, sinon « démarre le » affiche une date passée", async () => {
    await evaluerAlertes();
    const w = whereEmis((x) => x["formateurPrincipalId"] === null);
    const d = w["dateDebut"] as { lte?: Date; gte?: Date };
    expect(d.gte).toBeInstanceOf(Date);
    expect(d.gte!.getTime()).toBeLessThan(Date.now());
    expect(d.lte!.getTime()).toBeGreaterThan(d.gte!.getTime());
  });

  it("R17 — un contrat de formation (particulier, L6353-3) satisfait l'obligation", async () => {
    await evaluerAlertes();
    const w = whereEmis((x) => x["documents"] !== undefined);
    const docs = w["documents"] as { none: { type: { in: string[] } } };
    expect(docs.none.type.in).toContain("contrat");
    expect(docs.none.type.in).toContain("convention");
  });
});

describe("R12 — vérification Qualiopi d'un sous-traitant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupEmptyMocks();
  });

  function sousTraitantVerifieIlYA(jours: number) {
    mp.trainer.findMany.mockImplementation(({ where }: { where?: { statut?: string } }) => {
      if (where?.statut === "sous_traitant") {
        return Promise.resolve([
          {
            id: "tr-001",
            nom: "Durand",
            prenom: "Paul",
            sousTraitantVerifieAt: new Date(Date.now() - jours * 24 * 60 * 60 * 1000),
          },
        ]);
      }
      return Promise.resolve([]);
    });
  }

  // 🔴 Le faux positif d'origine. `sousTraitantVerifieAt` est la date à laquelle
  // la vérification a été FAITE : la règle la comparait à `now + 60 j`, donc
  // toute date passée déclenchait « expiré » en CRITIQUE. La preuve de
  // conformité servait à conclure au manquement.
  it("vérifié hier → aucune alerte", async () => {
    sousTraitantVerifieIlYA(1);
    const alertes = await evaluerAlertes();
    expect(alertes.filter((a) => a.code.startsWith("sous_traitant_qualiopi"))).toHaveLength(0);
  });

  it("vérifié il y a 13 mois → expiré, critique", async () => {
    sousTraitantVerifieIlYA(400);
    const alertes = await evaluerAlertes();
    const a = alertes.find((x) => x.code === "sous_traitant_qualiopi_expire");
    expect(a).toBeDefined();
    expect(a?.niveau).toBe("critique");
  });

  it("vérifié il y a 11 mois → préavis 60 jours, important", async () => {
    sousTraitantVerifieIlYA(330);
    const alertes = await evaluerAlertes();
    const a = alertes.find((x) => x.code === "sous_traitant_qualiopi_expire_j60");
    expect(a).toBeDefined();
    expect(a?.niveau).toBe("important");
    expect(a?.message).toMatch(/dans \d+ jours/);
  });

  it("jamais vérifié → critique (comportement conservé)", async () => {
    mp.trainer.findMany.mockImplementation(({ where }: { where?: { statut?: string } }) => {
      if (where?.statut === "sous_traitant") {
        return Promise.resolve([
          { id: "tr-002", nom: "Leroy", prenom: "Anne", sousTraitantVerifieAt: null },
        ]);
      }
      return Promise.resolve([]);
    });
    const alertes = await evaluerAlertes();
    const a = alertes.find((x) => x.code === "sous_traitant_qualiopi_expire");
    expect(a?.niveau).toBe("critique");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests règle vigilance_urssaf (2026-08-01)
// ─────────────────────────────────────────────────────────────────────────────

describe("evaluerAlertes — vigilance_urssaf", () => {
  const JOUR = 24 * 60 * 60 * 1000;

  /** Un sous-traitant actif, vérifié récemment (pour taire la règle NDA voisine). */
  function armerSousTraitant() {
    mp.trainer.findMany.mockImplementation((args: { where?: { statut?: string } }) => {
      if (args?.where?.statut === "sous_traitant") {
        return Promise.resolve([
          {
            id: "tr-010",
            nom: "Blanc",
            prenom: "Marie",
            sousTraitantVerifieAt: new Date(Date.now() - 2 * JOUR),
          },
        ]);
      }
      return Promise.resolve([]);
    });
  }

  /** Une attestation de vigilance émise il y a `jours` jours, validée. */
  function attestation(jours: number) {
    return {
      type: "attestation_vigilance_urssaf",
      statutValidation: "valide",
      dateEmission: new Date(Date.now() - jours * JOUR),
      dateExpiration: null,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    setupEmptyMocks();
    armerSousTraitant();
  });

  it("sous le seuil de 5 000 € : aucune obligation, aucune alerte — même sans attestation", async () => {
    mockCumulAnnuel.mockResolvedValue(4000_00);
    const alertes = await evaluerAlertes();
    expect(alertes.filter((a) => a.code.startsWith("vigilance_urssaf"))).toHaveLength(0);
  });

  it("🔴 seuil atteint SANS attestation → critique (responsabilité solidaire)", async () => {
    mockCumulAnnuel.mockResolvedValue(6000_00);
    const alertes = await evaluerAlertes();
    const a = alertes.find((x) => x.code === "vigilance_urssaf_absente");
    expect(a).toBeDefined();
    expect(a?.niveau).toBe("critique");
    expect(a?.message).toContain("Marie Blanc");
    expect(a?.cibleId).toBe("tr-010");
  });

  it("attestation de plus de 6 mois → périmée, critique", async () => {
    mockCumulAnnuel.mockResolvedValue(6000_00);
    mockListTrainerDocs.mockResolvedValue([attestation(200)]);
    const alertes = await evaluerAlertes();
    const a = alertes.find((x) => x.code === "vigilance_urssaf_perimee");
    expect(a).toBeDefined();
    expect(a?.niveau).toBe("critique");
  });

  it("attestation qui atteint 6 mois sous 30 jours → préavis, important", async () => {
    mockCumulAnnuel.mockResolvedValue(6000_00);
    // Émise il y a ~5 mois et 15 jours → expire dans ~15 jours.
    mockListTrainerDocs.mockResolvedValue([attestation(168)]);
    const alertes = await evaluerAlertes();
    const a = alertes.find((x) => x.code === "vigilance_urssaf_expire_j30");
    expect(a).toBeDefined();
    expect(a?.niveau).toBe("important");
    expect(a?.message).toMatch(/dans \d+ jours/);
  });

  it("attestation fraîche (1 mois) → aucune alerte", async () => {
    mockCumulAnnuel.mockResolvedValue(6000_00);
    mockListTrainerDocs.mockResolvedValue([attestation(30)]);
    const alertes = await evaluerAlertes();
    expect(alertes.filter((a) => a.code.startsWith("vigilance_urssaf"))).toHaveLength(0);
  });

  it("🔴 une attestation REJETÉE ne compte pas — même fraîche", async () => {
    // `estValide` exige statutValidation = valide : une pièce refusée par
    // l'admin ne protège de rien, la règle doit crier quand même.
    mockCumulAnnuel.mockResolvedValue(6000_00);
    mockListTrainerDocs.mockResolvedValue([{ ...attestation(30), statutValidation: "rejete" }]);
    const alertes = await evaluerAlertes();
    const a = alertes.find((x) => x.code === "vigilance_urssaf_absente");
    expect(a).toBeDefined();
    expect(a?.niveau).toBe("critique");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests règles devis_sans_reponse + signatures_en_attente (refonte phase 1)
// ─────────────────────────────────────────────────────────────────────────────

describe("evaluerAlertes — devis_sans_reponse", () => {
  const JOUR = 24 * 60 * 60 * 1000;

  beforeEach(() => {
    vi.clearAllMocks();
    setupEmptyMocks();
  });

  it("🔴 un devis envoyé depuis +7 jours sans réponse → relance, important", async () => {
    mp.devis.findMany.mockResolvedValue([
      {
        id: "d1",
        numero: "AXI-DEV-2026-012",
        sentAt: new Date(Date.now() - 9 * JOUR),
        client: { raisonSociale: "ACME SAS" },
      },
    ]);
    const alertes = await evaluerAlertes();
    const a = alertes.find((x) => x.code === "devis_sans_reponse");
    expect(a).toBeDefined();
    expect(a?.niveau).toBe("important");
    expect(a?.message).toContain("AXI-DEV-2026-012");
    expect(a?.message).toContain("ACME SAS");
    expect(a?.cibleId).toBe("d1");
  });

  it("le filtre SQL ne vise que les devis `envoye` de +7 jours", async () => {
    await evaluerAlertes();
    const arg = mp.devis.findMany.mock.calls[0]?.[0] as {
      where: { statut: string; sentAt: Record<string, unknown> };
    };
    expect(arg.where.statut).toBe("envoye");
    expect(arg.where.sentAt["not"]).toBeNull();
  });
});

describe("evaluerAlertes — signatures_en_attente", () => {
  const JOUR = 24 * 60 * 60 * 1000;

  beforeEach(() => {
    vi.clearAllMocks();
    setupEmptyMocks();
  });

  it("🔴 pièce signée d'UN SEUL côté depuis +7 jours → contreseing dû", async () => {
    // Le cas INVEST SUN : le client signe, puis la pièce attend le contreseing
    // de l'organisme — invisible sans ouvrir la fiche session.
    mp.documentGenere.findMany.mockResolvedValue([
      {
        id: "p1",
        type: "convention",
        numero: "AXI-DOC-2026-009",
        statutSignature: "partielle",
        updatedAt: new Date(Date.now() - 8 * JOUR),
      },
    ]);
    const alertes = await evaluerAlertes();
    const a = alertes.find((x) => x.code === "signature_contreseing_du");
    expect(a).toBeDefined();
    expect(a?.niveau).toBe("important");
    expect(a?.message).toContain("AXI-DOC-2026-009");
    expect(a?.message).toContain("contresigner");
  });

  it("lien émis jamais signé depuis +7 jours → relancer le signataire", async () => {
    mp.documentGenere.findMany.mockResolvedValue([
      {
        id: "p2",
        type: "lettre_mission",
        numero: "AXI-LM-2026-004",
        statutSignature: "en_attente",
        updatedAt: new Date(Date.now() - 10 * JOUR),
      },
    ]);
    const alertes = await evaluerAlertes();
    const a = alertes.find((x) => x.code === "signature_en_attente");
    expect(a).toBeDefined();
    expect(a?.message).toContain("relancer");
  });

  it("le filtre SQL exclut les pièces récemment actives (moins de 7 jours)", async () => {
    await evaluerAlertes();
    const arg = mp.documentGenere.findMany.mock.calls[0]?.[0] as {
      where: { statutSignature: { in: string[] }; updatedAt: Record<string, unknown> };
    };
    expect(arg.where.statutSignature.in).toStrictEqual(["en_attente", "partielle"]);
    expect(arg.where.updatedAt["lte"]).toBeInstanceOf(Date);
  });
});

// ── Vigilance sous-traitance (R12 bis) ────────────────────────────────────
//
// Ces tests portent sur le NIVEAU des alertes, pas seulement sur leur
// existence : c'est le niveau qui décide si Will réagit ou pas, et l'arbitrage
// RC pro absente ≠ RC pro expirée est une décision métier (procédure § 4.2)
// qu'une régression silencieuse effacerait.
describe("vigilance sous-traitance", () => {
  const CONFORME = {
    id: "st-1",
    nom: "Organisme X",
    contratSigneAt: new Date("2026-01-10"),
    rcProEcheanceAt: new Date("2027-01-10"),
    rcProAttestationUrl: "https://r2/rc.pdf",
    prochaineVerifAt: new Date("2027-01-10"),
  };

  beforeEach(() => {
    mp.sousTraitant.findMany.mockResolvedValue([]);
    mp.trainer.findMany.mockResolvedValue([]);
  });

  it("ne lève RIEN pour un sous-traitant à jour", async () => {
    mp.sousTraitant.findMany.mockResolvedValue([CONFORME]);
    const a = await evaluerAlertes();
    expect(a.filter((x) => x.code.startsWith("sous_traitant_rc_pro"))).toHaveLength(0);
    expect(a.filter((x) => x.code === "sous_traitant_contrat_cadre_manquant")).toHaveLength(0);
  });

  it("contrat-cadre manquant = CRITIQUE — il bloque l'indicateur 27", async () => {
    mp.sousTraitant.findMany.mockResolvedValue([{ ...CONFORME, contratSigneAt: null }]);
    const a = await evaluerAlertes();
    const alerte = a.find((x) => x.code === "sous_traitant_contrat_cadre_manquant");
    expect(alerte?.niveau).toBe("critique");
  });

  it("RC pro ABSENTE = important, jamais critique (état délibérément accepté)", async () => {
    mp.sousTraitant.findMany.mockResolvedValue([
      { ...CONFORME, rcProAttestationUrl: null, rcProEcheanceAt: null },
    ]);
    const a = await evaluerAlertes();
    const alerte = a.find((x) => x.code === "sous_traitant_rc_pro_absente");
    expect(alerte?.niveau).toBe("important");
    expect(alerte?.niveau).not.toBe("critique");
  });

  it("RC pro EXPIRÉE = critique — elle existait et elle est tombée", async () => {
    mp.sousTraitant.findMany.mockResolvedValue([
      { ...CONFORME, rcProEcheanceAt: new Date("2026-07-01") },
    ]);
    const a = await evaluerAlertes();
    expect(a.find((x) => x.code === "sous_traitant_rc_pro_expiree")?.niveau).toBe("critique");
  });

  it("couvre AUSSI le formateur indépendant, pas seulement l'organisme", async () => {
    mp.trainer.findMany.mockResolvedValue([
      {
        id: "tr-1",
        nom: "Dupont",
        prenom: "Marie",
        sousTraitantContratSigneAt: null,
        rcProEcheanceAt: null,
        rcProAttestationUrl: null,
        sousTraitantProchaineVerifAt: null,
      },
    ]);
    const a = await evaluerAlertes();
    const alerte = a.find((x) => x.code === "sous_traitant_contrat_cadre_manquant");
    expect(alerte?.cibleType).toBe("Trainer");
    expect(alerte?.message).toContain("Marie Dupont");
  });

  // ── Art. 8 : incidents répétés ──────────────────────────────────────────
  //
  // Le point sensible n'est pas que l'alerte existe, c'est qu'elle reste
  // NON BLOQUANTE. Un futur « durcissons un peu » qui la passerait en critique
  // la transformerait en interdiction d'affecter, contre la décision de Will.
  describe("incidents répétés (art. 8)", () => {
    const FORMATEUR_ACTIF = {
      id: "tr-1",
      nom: "Dupont",
      prenom: "Marie",
      sousTraitantContratSigneAt: new Date("2026-01-10"),
      rcProEcheanceAt: new Date("2027-01-10"),
      rcProAttestationUrl: "https://r2/rc.pdf",
      sousTraitantProchaineVerifAt: new Date("2027-01-10"),
    };

    it("un seul incident bloquant ne lève RIEN — un accident n'est pas un motif", async () => {
      mp.trainer.findMany.mockResolvedValue([FORMATEUR_ACTIF]);
      mp.incident.groupBy.mockResolvedValue([
        { trainerId: "tr-1", sousTraitantId: null, _count: { _all: 1 } },
      ]);
      const a = await evaluerAlertes();
      expect(a.filter((x) => x.code === "sous_traitant_incidents_repetes")).toHaveLength(0);
    });

    it("deux incidents bloquants = IMPORTANT, jamais critique (l'alerte informe, elle n'interdit pas)", async () => {
      mp.trainer.findMany.mockResolvedValue([FORMATEUR_ACTIF]);
      mp.incident.groupBy.mockResolvedValue([
        { trainerId: "tr-1", sousTraitantId: null, _count: { _all: 2 } },
      ]);
      const a = await evaluerAlertes();
      const alerte = a.find((x) => x.code === "sous_traitant_incidents_repetes");
      expect(alerte?.niveau).toBe("important");
      expect(alerte?.niveau).not.toBe("critique");
      expect(alerte?.cibleType).toBe("Trainer");
      expect(alerte?.message).toContain("Marie Dupont");
    });

    it("n'alerte pas sur un intervenant devenu inactif — on ne peut plus l'affecter", async () => {
      mp.trainer.findMany.mockResolvedValue([]); // aucun formateur actif
      mp.incident.groupBy.mockResolvedValue([
        { trainerId: "tr-parti", sousTraitantId: null, _count: { _all: 5 } },
      ]);
      const a = await evaluerAlertes();
      expect(a.filter((x) => x.code === "sous_traitant_incidents_repetes")).toHaveLength(0);
    });

    it("vise l'ORGANISME quand c'est lui qui est mis en cause", async () => {
      mp.sousTraitant.findMany.mockResolvedValue([CONFORME]);
      mp.incident.groupBy.mockResolvedValue([
        { trainerId: null, sousTraitantId: "st-1", _count: { _all: 3 } },
      ]);
      const a = await evaluerAlertes();
      const alerte = a.find((x) => x.code === "sous_traitant_incidents_repetes");
      expect(alerte?.cibleType).toBe("SousTraitant");
      expect(alerte?.cibleId).toBe("st-1");
    });

    it("ne compte QUE les faits qui font tomber une session", async () => {
      mp.trainer.findMany.mockResolvedValue([FORMATEUR_ACTIF]);
      mp.incident.groupBy.mockResolvedValue([]);
      await evaluerAlertes();
      const arg = mp.incident.groupBy.mock.calls[0]?.[0] as {
        where: { faitIntervenant: { in: string[] } };
      };
      expect(arg.where.faitIntervenant.in).toStrictEqual(["annulation_tardive", "desistement"]);
    });
  });
});
