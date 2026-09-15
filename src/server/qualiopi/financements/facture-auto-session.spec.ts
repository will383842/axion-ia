/**
 * Facture générée le lendemain de la session — le PASSAGE du cron.
 *
 * Ce qui est prouvé ici, contre une base simulée qui garde un ÉTAT (les
 * factures créées restent visibles au passage suivant) :
 *   - J+1 : la facture est émise par le chemin du bouton, son PDF rendu, son
 *     e-mail préparé AVEC `exigerValidation`, et chaque étape journalisée sans
 *     administrateur ;
 *   - pas avant J+1, rien avant la mise en service, rien sur un cas non
 *     automatisable ;
 *   - idempotence : un second passage ne refacture pas, et deux passages
 *     SIMULTANÉS n'émettent qu'une facture (verrou consultatif par session) ;
 *   - un PDF qui échoue ou un e-mail non garé ne se taisent pas ;
 *   - un plafond par passage.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

type Facture = { statut: string; montantHtCents: number; avoirs: never[] };

const etat = vi.hoisted(() => ({
  sessions: [] as Array<Record<string, unknown>>,
  factures: new Map<string, Facture[]>(),
  verrous: new Set<string>(),
  sansVerrou: false,
}));

const d = vi.hoisted(() => ({
  emettre: vi.fn(),
  pdf: vi.fn(),
  email: vi.fn(),
  journal: vi.fn(),
}));

function vue(s: Record<string, unknown>) {
  return { ...s, facturesFormation: [...(etat.factures.get(s["id"] as string) ?? [])] };
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: {
      findMany: vi.fn(async () => etat.sessions.map(vue)),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        const s = etat.sessions.find((x) => x["id"] === where.id);
        return s ? vue(s) : null;
      }),
    },
    activityLog: { create: (...a: unknown[]) => d.journal(...a) },
    // Verrou consultatif simulé : `pg_try_advisory_xact_lock` rend faux si la
    // clé est tenue par une transaction encore ouverte, et la relâche au commit.
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tenues: string[] = [];
      const tx = {
        $queryRaw: async (_s: TemplateStringsArray, ...valeurs: unknown[]) => {
          const cle = String(valeurs[0]);
          if (!etat.sansVerrou && etat.verrous.has(cle)) return [{ acquis: false }];
          etat.verrous.add(cle);
          tenues.push(cle);
          return [{ acquis: true }];
        },
      };
      try {
        return await fn(tx);
      } finally {
        for (const c of tenues) etat.verrous.delete(c);
      }
    }),
  },
}));

vi.mock("./facture-formation-emission", () => ({
  emettreFactureFormationSession: (...a: unknown[]) => d.emettre(...a),
  genererPdfFactureFormation: (...a: unknown[]) => d.pdf(...a),
}));
vi.mock("./facture-envoi-email", () => ({
  preparerEnvoiFactureEmail: (...a: unknown[]) => d.email(...a),
}));

import {
  genererFacturesDuLendemain,
  ligneJournalBilan,
  PLAFOND_FACTURES_AUTO_PAR_PASSAGE,
} from "./facture-auto-session";
import { MISE_EN_SERVICE_FACTURE_AUTO } from "./facture-auto-regles";

/** Fin le 5 octobre 2026 à 16:00, heure de Paris. */
const FIN = new Date("2026-10-05T14:00:00.000Z");
const LENDEMAIN = new Date("2026-10-06T08:30:00.000Z");

function session(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    numero: `AXI-SESS-2026-${id}`,
    titreSession: "Formation test",
    statut: "realisee",
    dateFin: FIN,
    montantHtCents: 150000,
    interEntreprises: false,
    financementType: "direct",
    opcoSubrogation: false,
    client: {
      type: "entreprise",
      raisonSociale: "Acme",
      siret: "12345678900011",
      adresse: "1 rue de l'Exemple, 00000 Ville",
      adresseRue: null,
      adresseCodePostal: null,
      adresseVille: null,
      tvaIntracom: null,
      opcoIdentifie: null,
      contactEmail: "compta@acme.test",
    },
    dossiersFinancement: [],
    ...over,
  };
}

let compteur = 0;

beforeEach(() => {
  vi.clearAllMocks();
  etat.sessions = [];
  etat.factures = new Map();
  etat.verrous = new Set();
  etat.sansVerrou = false;
  compteur = 0;
  d.emettre.mockImplementation(async ({ sessionId }: { sessionId: string }) => {
    // L'émission prend du temps (numérotation, écriture) : c'est pendant ce
    // délai qu'un second passage concurrent lirait « aucune facture ».
    await new Promise((r) => setTimeout(r, 5));
    compteur += 1;
    const liste = etat.factures.get(sessionId) ?? [];
    liste.push({ statut: "emise", montantHtCents: 150000, avoirs: [] });
    etat.factures.set(sessionId, liste);
    return {
      data: {
        factureId: `f-${sessionId}`,
        numero: `AXI-FACT-2026-${String(compteur).padStart(3, "0")}`,
        documentId: null,
        destinataire: "entreprise",
        ventilation: "forfait",
        totalHtCents: 150000,
      },
    };
  });
  d.pdf.mockImplementation(async (factureId: string) => ({
    data: { factureId, documentId: `doc-${factureId}` },
  }));
  d.email.mockResolvedValue({
    data: {
      enqueued: false,
      garePourValidation: true,
      to: "compta@acme.test",
      numero: "AXI-FACT-2026-001",
      estAvoir: false,
      pdfHash: "hash",
    },
  });
  d.journal.mockResolvedValue({});
});

describe("J+1 : la facture est générée, l'e-mail GARÉ", () => {
  it("émet par le chemin du bouton (entreprise, forfait), rend le PDF, prépare l'e-mail en validation", async () => {
    etat.sessions = [session("001")];

    const bilan = await genererFacturesDuLendemain(LENDEMAIN);

    expect(d.emettre).toHaveBeenCalledTimes(1);
    expect(d.emettre).toHaveBeenCalledWith({
      sessionId: "001",
      destinataire: "entreprise",
      ventilation: "forfait",
    });
    expect(d.pdf).toHaveBeenCalledWith("f-001");
    // 🛑 Jamais `auto` : l'automate EXIGE la validation, quelles que soient les
    // règles d'automatisation posées pour ce client.
    expect(d.email).toHaveBeenCalledWith({ factureId: "f-001" }, { exigerValidation: true });
    expect(bilan.emises).toEqual([
      { sessionId: "001", numero: "AXI-FACT-2026-001", email: "garee" },
    ]);
  });

  it("journal : génération `qualiopi.facture.generer.auto`, PDF et e-mail, tous sans administrateur", async () => {
    etat.sessions = [session("001")];

    await genererFacturesDuLendemain(LENDEMAIN);

    const actions = d.journal.mock.calls.map(
      (c) => (c[0] as { data: { action: string; adminUserId: unknown } }).data,
    );
    expect(actions.map((a) => a.action)).toEqual([
      "qualiopi.facture.generer.auto",
      "qualiopi.facture.pdf.generer",
      "facturation.email.facture",
    ]);
    expect(actions.every((a) => a.adminUserId === null)).toBe(true);
    expect(d.journal.mock.calls[0]![0]).toMatchObject({
      data: {
        targetType: "FactureFormation",
        targetId: "f-001",
        changes: {
          sessionId: "001",
          numero: "AXI-FACT-2026-001",
          destinataire: "entreprise",
          ventilation: "forfait",
          totalHtCents: 150000,
        },
      },
    });
  });

  it("pas avant J+1 : le soir même de la fin, rien", async () => {
    etat.sessions = [session("001")];
    const bilan = await genererFacturesDuLendemain(new Date("2026-10-05T21:00:00.000Z"));
    expect(d.emettre).not.toHaveBeenCalled();
    expect(bilan.emises).toEqual([]);
  });

  it("borne basse : une session finie avant la mise en service n'est jamais facturée", async () => {
    const avant = new Date(MISE_EN_SERVICE_FACTURE_AUTO.getTime() - 3600_000);
    etat.sessions = [session("001", { dateFin: avant })];
    await genererFacturesDuLendemain(new Date(avant.getTime() + 2 * 86_400_000));
    expect(d.emettre).not.toHaveBeenCalled();
  });
});

describe("idempotence", () => {
  it("un second passage ne refacture pas", async () => {
    etat.sessions = [session("001")];
    await genererFacturesDuLendemain(LENDEMAIN);
    const second = await genererFacturesDuLendemain(new Date(LENDEMAIN.getTime() + 3600_000));

    expect(d.emettre).toHaveBeenCalledTimes(1);
    expect(second.emises).toEqual([]);
    expect(second.dejaFacturees).toBe(1);
  });

  it("🔴 deux passages SIMULTANÉS n'émettent qu'une seule facture", async () => {
    etat.sessions = [session("001")];

    const [a, b] = await Promise.all([
      genererFacturesDuLendemain(LENDEMAIN),
      genererFacturesDuLendemain(LENDEMAIN),
    ]);

    expect(d.emettre).toHaveBeenCalledTimes(1);
    expect(etat.factures.get("001")).toHaveLength(1);
    expect(a.emises.length + b.emises.length).toBe(1);
    expect(a.verrouPris + b.verrouPris).toBe(1);
  });

  it("la décision est RELUE sous verrou : une facture apparue entre la lecture et le verrou gagne", async () => {
    etat.sessions = [session("001")];
    const { prisma } = await import("@/lib/prisma");
    // La lecture de masse voit la session sans facture ; juste avant le verrou,
    // quelqu'un clique « Générer la facture ».
    vi.mocked(prisma.trainingSession.findMany).mockImplementationOnce((async () => {
      const lues = etat.sessions.map(vue);
      etat.factures.set("001", [{ statut: "emise", montantHtCents: 150000, avoirs: [] }]);
      return lues;
    }) as never);

    const bilan = await genererFacturesDuLendemain(LENDEMAIN);
    expect(d.emettre).not.toHaveBeenCalled();
    expect(bilan.dejaFacturees).toBe(1);
  });
});

describe("cas non automatisables : 0 facture", () => {
  it.each([
    ["montant nul", { montantHtCents: 0 }],
    ["inter-entreprises", { interEntreprises: true }],
    ["financement OPCO", { financementType: "opco" }],
    ["financement CPF", { financementType: "cpf" }],
    ["financement France Travail", { financementType: "france_travail" }],
    ["subrogation", { opcoSubrogation: true }],
    ["aucun client", { client: null }],
  ])("%s", async (_nom, over) => {
    etat.sessions = [session("001", over)];
    const bilan = await genererFacturesDuLendemain(LENDEMAIN);
    expect(d.emettre).not.toHaveBeenCalled();
    expect(bilan.nonAutomatisables).toBe(1);
  });

  it.each([
    ["sans SIRET", { siret: null }],
    ["sans adresse", { adresse: null }],
    ["sans e-mail de contact", { contactEmail: null }],
  ])("client %s", async (_nom, over) => {
    const s = session("001");
    etat.sessions = [{ ...s, client: { ...s.client, ...over } }];
    const bilan = await genererFacturesDuLendemain(LENDEMAIN);
    expect(d.emettre).not.toHaveBeenCalled();
    expect(bilan.nonAutomatisables).toBe(1);
  });

  it("un refus du chemin d'émission (ex. identité de l'organisme incomplète) : rien d'autre, compté", async () => {
    etat.sessions = [session("001")];
    d.emettre.mockResolvedValueOnce({ error: "Identité de l'organisme incomplète (SIRET)." });
    const bilan = await genererFacturesDuLendemain(LENDEMAIN);
    expect(d.pdf).not.toHaveBeenCalled();
    expect(d.email).not.toHaveBeenCalled();
    expect(d.journal).not.toHaveBeenCalled();
    expect(bilan.refusees).toEqual([
      { sessionId: "001", motif: "Identité de l'organisme incomplète (SIRET)." },
    ]);
  });
});

describe("ce qui échoue après l'émission ne se tait pas", () => {
  it("PDF non rendu : pas d'e-mail, la facture est comptée « e-mail non préparé »", async () => {
    etat.sessions = [session("001")];
    d.pdf.mockResolvedValueOnce({ error: "PDF non généré : R2 indisponible" });
    const bilan = await genererFacturesDuLendemain(LENDEMAIN);
    expect(d.email).not.toHaveBeenCalled();
    expect(bilan.emises).toEqual([
      {
        sessionId: "001",
        numero: "AXI-FACT-2026-001",
        email: "non_preparee",
        motifEmail: "PDF non généré : R2 indisponible",
      },
    ]);
  });

  it("e-mail refusé (file indisponible) : non préparé, et PAS de journal d'e-mail", async () => {
    etat.sessions = [session("001")];
    d.email.mockResolvedValueOnce({ error: "File d'envoi indisponible — réessayer." });
    const bilan = await genererFacturesDuLendemain(LENDEMAIN);
    expect(bilan.emises[0]).toMatchObject({ email: "non_preparee" });
    const actions = d.journal.mock.calls.map(
      (c) => (c[0] as { data: { action: string } }).data.action,
    );
    expect(actions).not.toContain("facturation.email.facture");
  });

  it("🛑 un e-mail PARTI au lieu d'être garé est une anomalie, jamais un succès", async () => {
    etat.sessions = [session("001")];
    d.email.mockResolvedValueOnce({
      data: {
        enqueued: true,
        garePourValidation: false,
        to: "x",
        numero: "n",
        estAvoir: false,
        pdfHash: "h",
      },
    });
    const bilan = await genererFacturesDuLendemain(LENDEMAIN);
    expect(bilan.emises[0]).toMatchObject({ email: "non_preparee" });
    expect(ligneJournalBilan(bilan).niveau).toBe("error");
  });
});

describe("plafond et journal du passage", () => {
  it(`au plus ${PLAFOND_FACTURES_AUTO_PAR_PASSAGE} factures par passage, et le journal le dit`, async () => {
    etat.sessions = Array.from({ length: PLAFOND_FACTURES_AUTO_PAR_PASSAGE + 2 }, (_, i) =>
      session(String(i + 1).padStart(3, "0")),
    );
    const bilan = await genererFacturesDuLendemain(LENDEMAIN);
    expect(d.emettre).toHaveBeenCalledTimes(PLAFOND_FACTURES_AUTO_PAR_PASSAGE);
    expect(bilan.plafondAtteint).toBe(true);
    expect(ligneJournalBilan(bilan).ligne).toMatch(/plafond/i);
  });

  it("le journal NOMME les factures émises", async () => {
    etat.sessions = [session("001")];
    const bilan = await genererFacturesDuLendemain(LENDEMAIN);
    const { ligne, niveau } = ligneJournalBilan(bilan);
    expect(ligne).toContain("AXI-FACT-2026-001");
    expect(niveau).toBe("log");
  });

  it("base de build (stub) : aucun accès", async () => {
    const avant = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      etat.sessions = [session("001")];
      const bilan = await genererFacturesDuLendemain(LENDEMAIN);
      expect(bilan.examinees).toBe(0);
      expect(d.emettre).not.toHaveBeenCalled();
    } finally {
      if (avant === undefined) delete process.env["DATABASE_URL"];
      else process.env["DATABASE_URL"] = avant;
    }
  });
});
