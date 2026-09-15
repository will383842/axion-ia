/**
 * Facture générée le lendemain de la session — le PASSAGE du cron.
 *
 * Contre une fausse base À ÉTAT (`__tests__/fausse-base-facture-auto.ts`) : les
 * factures créées et les journaux écrits restent visibles au passage suivant.
 *
 *   - J+1 : trace de tentative, émission par le chemin du bouton (avec une garde
 *     relue sous verrou), PDF, e-mail préparé AVEC `exigerValidation`, journal
 *     sans administrateur ;
 *   - pas avant J+1, rien avant la mise en service, rien sur un cas non
 *     automatisable ;
 *   - idempotence : second passage, refus « verrou pris » et « déjà facturée »
 *     du point d'émission, décision relue sous verrou ;
 *   - un refus ou une exception laissent un journal d'ÉCHEC (lu par l'alerte) ;
 *   - un PDF qui échoue ou un e-mail non garé ne se taisent pas ;
 *   - plafond, horodatage du passage.
 *
 * La concurrence réelle (deux émissions simultanées, une seule facture) est
 * éprouvée au point d'émission lui-même : `facture-formation-emission.doublon.spec.ts`.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  etatVide,
  factureFausse,
  sessionEligible,
  type EtatFaux,
} from "./__tests__/fausse-base-facture-auto";

const h = vi.hoisted(() => ({
  etat: null as unknown as EtatFaux,
  journal: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
  emettre: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
  pdf: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
  email: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
}));

vi.mock("@/lib/prisma", async () => {
  const { vi: v } = await import("vitest");
  const { etatVide: vide, faussePrisma: fausse } =
    await import("./__tests__/fausse-base-facture-auto");
  h.etat = vide();
  h.journal = v.fn();
  return { prisma: fausse(h.etat, h.journal) };
});
vi.mock("./facture-formation-emission", async () => {
  const { vi: v } = await import("vitest");
  h.emettre = v.fn();
  h.pdf = v.fn();
  return {
    emettreFactureFormationSession: (...a: unknown[]) => h.emettre(...a),
    genererPdfFactureFormation: (...a: unknown[]) => h.pdf(...a),
  };
});
vi.mock("./facture-envoi-email", async () => {
  const { vi: v } = await import("vitest");
  h.email = v.fn();
  return { preparerEnvoiFactureEmail: (...a: unknown[]) => h.email(...a) };
});

import {
  genererFacturesDuLendemain,
  ligneJournalBilan,
  PLAFOND_FACTURES_AUTO_PAR_PASSAGE,
} from "./facture-auto-session";
import { MISE_EN_SERVICE_FACTURE_AUTO } from "./facture-auto-regles";

/** Fin le 5 octobre 2026 à 16:00, heure de Paris. */
const LENDEMAIN = new Date("2026-10-06T09:30:00.000Z");

let compteur = 0;

type Garde = { garde?: () => Promise<string | null> };

beforeEach(() => {
  Object.assign(h.etat, etatVide());
  h.journal.mockReset().mockResolvedValue({});
  compteur = 0;
  // L'émission simulée respecte le contrat du point d'émission : elle évalue la
  // garde de l'appelant, puis écrit une facture qui reste visible en base.
  h.emettre
    .mockReset()
    .mockImplementation(async ({ sessionId }: { sessionId: string }, options?: Garde) => {
      const refus = options?.garde ? await options.garde() : null;
      if (refus !== null) return { error: refus, code: "garde" };
      compteur += 1;
      const numero = `AXI-FACT-2026-${String(compteur).padStart(3, "0")}`;
      h.etat.factures.push(
        factureFausse({
          id: `f-${sessionId}`,
          numero,
          sessionId,
          documentId: null,
          emiseAt: LENDEMAIN,
          createdAt: LENDEMAIN,
        }),
      );
      return {
        data: {
          factureId: `f-${sessionId}`,
          numero,
          documentId: null,
          destinataire: "entreprise",
          ventilation: "forfait",
          totalHtCents: 150000,
        },
      };
    });
  h.pdf.mockReset().mockImplementation(async (factureId: string) => {
    const f = h.etat.factures.find((x) => x.id === factureId);
    if (f) f.documentId = `doc-${factureId}`;
    return { data: { factureId, documentId: `doc-${factureId}` } };
  });
  h.email.mockReset().mockImplementation(async ({ factureId }: { factureId: string }) => {
    h.etat.outbox.push({
      template: "facture-envoi",
      entityId: factureId,
      payload: {},
      createdAt: LENDEMAIN,
    });
    return {
      data: {
        enqueued: false,
        garePourValidation: true,
        to: "compta@acme.test",
        numero: "AXI-FACT-2026-001",
        estAvoir: false,
        pdfHash: "hash",
      },
    };
  });
});

const actions = () => h.etat.journaux.map((j) => j.action);

describe("J+1 : la facture est générée, l'e-mail GARÉ", () => {
  it("émet par le chemin du bouton (entreprise, forfait) avec une garde, rend le PDF, prépare l'e-mail en validation", async () => {
    h.etat.sessions = [sessionEligible("001")];

    const bilan = await genererFacturesDuLendemain(LENDEMAIN);

    expect(h.emettre).toHaveBeenCalledTimes(1);
    expect(h.emettre).toHaveBeenCalledWith(
      { sessionId: "001", destinataire: "entreprise", ventilation: "forfait" },
      { garde: expect.any(Function) },
    );
    expect(h.pdf).toHaveBeenCalledWith("f-001");
    // 🛑 Jamais `auto` : l'automate EXIGE la validation, quelles que soient les
    // règles d'automatisation posées pour ce client.
    expect(h.email).toHaveBeenCalledWith({ factureId: "f-001" }, { exigerValidation: true });
    expect(bilan.emises).toEqual([
      { sessionId: "001", numero: "AXI-FACT-2026-001", email: "garee" },
    ]);
  });

  it("journal : tentative AVANT, puis génération, PDF et e-mail — tous sans administrateur", async () => {
    h.etat.sessions = [sessionEligible("001")];

    await genererFacturesDuLendemain(LENDEMAIN);

    const ecrits = h.journal.mock.calls.map(
      (c) => (c[0] as { data: { action: string; adminUserId: unknown; targetType: string } }).data,
    );
    expect(ecrits.map((a) => a.action)).toEqual([
      "qualiopi.facture.generer.auto.tentative",
      "qualiopi.facture.generer.auto",
      "qualiopi.facture.pdf.generer",
      "facturation.email.facture",
    ]);
    expect(ecrits.every((a) => a.adminUserId === null)).toBe(true);
    expect(ecrits[0]).toMatchObject({ targetType: "TrainingSession", targetId: "001" });
    expect(h.journal.mock.calls[1]![0]).toMatchObject({
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
    h.etat.sessions = [sessionEligible("001")];
    const bilan = await genererFacturesDuLendemain(new Date("2026-10-05T21:00:00.000Z"));
    expect(h.emettre).not.toHaveBeenCalled();
    expect(bilan.emises).toEqual([]);
  });

  it("borne basse : une session finie avant la mise en service n'est jamais facturée", async () => {
    const avant = new Date(MISE_EN_SERVICE_FACTURE_AUTO.getTime() - 3600_000);
    h.etat.sessions = [sessionEligible("001", { dateDebut: avant, dateFin: avant })];
    await genererFacturesDuLendemain(new Date(avant.getTime() + 2 * 86_400_000));
    expect(h.emettre).not.toHaveBeenCalled();
  });

  it("le passage est horodaté, pour que l'alerte sache que le cron tourne", async () => {
    await genererFacturesDuLendemain(LENDEMAIN);
    expect(h.etat.reglages.get("facture_auto_dernier_passage")).toEqual({
      at: LENDEMAIN.toISOString(),
    });
  });
});

describe("idempotence", () => {
  it("un second passage ne refacture pas", async () => {
    h.etat.sessions = [sessionEligible("001")];
    await genererFacturesDuLendemain(LENDEMAIN);
    const second = await genererFacturesDuLendemain(new Date(LENDEMAIN.getTime() + 3600_000));

    expect(h.emettre).toHaveBeenCalledTimes(1);
    expect(second.emises).toEqual([]);
    expect(second.dejaFacturees).toBe(1);
  });

  it("verrou tenu par un autre passage : compté, sans journal d'échec", async () => {
    h.etat.sessions = [sessionEligible("001")];
    h.emettre.mockResolvedValueOnce({ error: "en cours", code: "verrou_pris" });
    const bilan = await genererFacturesDuLendemain(LENDEMAIN);
    expect(bilan.verrouPris).toBe(1);
    expect(actions()).not.toContain("qualiopi.facture.generer.auto.echec");
  });

  it("le point d'émission voit une facture vivante : compté « déjà facturée », sans échec", async () => {
    h.etat.sessions = [sessionEligible("001")];
    h.emettre.mockResolvedValueOnce({ error: "existe déjà", code: "deja_facturee" });
    const bilan = await genererFacturesDuLendemain(LENDEMAIN);
    expect(bilan.dejaFacturees).toBe(1);
    expect(actions()).not.toContain("qualiopi.facture.generer.auto.echec");
  });

  it("🔴 la décision est RELUE sous verrou : une facture apparue entre la lecture et le verrou gagne", async () => {
    h.etat.sessions = [sessionEligible("001")];
    const { prisma } = await import("@/lib/prisma");
    const lectureDeMasse = vi.mocked(prisma.trainingSession.findMany);
    const original = lectureDeMasse.getMockImplementation()!;
    lectureDeMasse.mockImplementationOnce((async (args: never) => {
      const lues = await original(args);
      // Juste après la lecture de masse, quelqu'un clique « Générer la facture ».
      h.etat.factures.push(factureFausse({ id: "f-clic", sessionId: "001" }));
      return lues;
    }) as never);

    const bilan = await genererFacturesDuLendemain(LENDEMAIN);

    expect(h.etat.factures.filter((f) => f.sessionId === "001")).toHaveLength(1);
    expect(bilan.emises).toEqual([]);
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
    ["aucun client", { client: null, clientId: null }],
  ])("%s", async (_nom, over) => {
    h.etat.sessions = [sessionEligible("001", over)];
    const bilan = await genererFacturesDuLendemain(LENDEMAIN);
    expect(h.emettre).not.toHaveBeenCalled();
    expect(bilan.nonAutomatisables).toBe(1);
  });

  it.each([
    ["sans SIRET", { siret: null }],
    ["sans adresse", { adresse: null }],
    ["sans e-mail de contact", { contactEmail: null }],
  ])("client %s", async (_nom, over) => {
    const s = sessionEligible("001");
    h.etat.sessions = [{ ...s, client: { ...s.client, ...over } }];
    const bilan = await genererFacturesDuLendemain(LENDEMAIN);
    expect(h.emettre).not.toHaveBeenCalled();
    expect(bilan.nonAutomatisables).toBe(1);
  });
});

describe("🔴 un échec laisse une trace que l'alerte lit", () => {
  it("refus du chemin d'émission (identité de l'organisme incomplète) : rien d'autre, journal d'ÉCHEC avec le motif", async () => {
    h.etat.sessions = [sessionEligible("001")];
    h.emettre.mockResolvedValueOnce({ error: "Identité de l'organisme incomplète (SIRET)." });
    const bilan = await genererFacturesDuLendemain(LENDEMAIN);
    expect(h.pdf).not.toHaveBeenCalled();
    expect(h.email).not.toHaveBeenCalled();
    expect(bilan.refusees).toEqual([
      { sessionId: "001", motif: "Identité de l'organisme incomplète (SIRET)." },
    ]);
    expect(
      h.etat.journaux.find((j) => j.action === "qualiopi.facture.generer.auto.echec"),
    ).toMatchObject({
      targetType: "TrainingSession",
      targetId: "001",
      changes: { motif: "Identité de l'organisme incomplète (SIRET)." },
    });
  });

  it("exception pendant l'émission : erreur comptée, journal d'ÉCHEC", async () => {
    h.etat.sessions = [sessionEligible("001")];
    h.emettre.mockRejectedValueOnce(new Error("Transaction already closed"));
    const bilan = await genererFacturesDuLendemain(LENDEMAIN);
    expect(bilan.erreurs).toBe(1);
    expect(actions()).toContain("qualiopi.facture.generer.auto.echec");
  });
});

describe("ce qui échoue après l'émission ne se tait pas", () => {
  it("PDF non rendu : pas d'e-mail, la facture est comptée « e-mail non préparé »", async () => {
    h.etat.sessions = [sessionEligible("001")];
    h.pdf.mockResolvedValueOnce({ error: "PDF non généré : stockage indisponible" });
    const bilan = await genererFacturesDuLendemain(LENDEMAIN);
    expect(h.email).not.toHaveBeenCalled();
    expect(bilan.emises).toEqual([
      {
        sessionId: "001",
        numero: "AXI-FACT-2026-001",
        email: "non_preparee",
        motifEmail: "PDF non généré : stockage indisponible",
      },
    ]);
  });

  it("e-mail refusé (file indisponible) : non préparé, et PAS de journal d'e-mail", async () => {
    h.etat.sessions = [sessionEligible("001")];
    h.email.mockResolvedValueOnce({ error: "File d'envoi indisponible — réessayer." });
    const bilan = await genererFacturesDuLendemain(LENDEMAIN);
    expect(bilan.emises[0]).toMatchObject({ email: "non_preparee" });
    expect(actions()).not.toContain("facturation.email.facture");
  });

  it("🛑 un e-mail PARTI au lieu d'être garé est une anomalie, jamais un succès", async () => {
    h.etat.sessions = [sessionEligible("001")];
    h.email.mockResolvedValueOnce({
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
    h.etat.sessions = Array.from({ length: PLAFOND_FACTURES_AUTO_PAR_PASSAGE + 2 }, (_, i) =>
      sessionEligible(String(i + 1).padStart(3, "0"), { clientId: `client-${i}` }),
    );
    const bilan = await genererFacturesDuLendemain(LENDEMAIN);
    expect(h.emettre).toHaveBeenCalledTimes(PLAFOND_FACTURES_AUTO_PAR_PASSAGE);
    expect(bilan.plafondAtteint).toBe(true);
    expect(ligneJournalBilan(bilan).ligne).toMatch(/plafond/i);
  });

  it("le journal NOMME les factures émises", async () => {
    h.etat.sessions = [sessionEligible("001")];
    const bilan = await genererFacturesDuLendemain(LENDEMAIN);
    const { ligne, niveau } = ligneJournalBilan(bilan);
    expect(ligne).toContain("AXI-FACT-2026-001");
    expect(niveau).toBe("log");
  });

  it("base de build (stub) : aucun accès", async () => {
    const avant = process.env["DATABASE_URL"];
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    try {
      h.etat.sessions = [sessionEligible("001")];
      const bilan = await genererFacturesDuLendemain(LENDEMAIN);
      expect(bilan.examinees).toBe(0);
      expect(h.emettre).not.toHaveBeenCalled();
    } finally {
      if (avant === undefined) delete process.env["DATABASE_URL"];
      else process.env["DATABASE_URL"] = avant;
    }
  });
});
