/**
 * 🔴 UNE FACTURE ÉMISE NE PEUT PAS DEVENIR INVISIBLE — relecture A09 de la PR
 * 1097, dette n° 2.
 *
 * Le journal `qualiopi.facture.generer.auto`, que lisait l'alerte « e-mail non
 * préparé », était écrit APRÈS la transaction d'émission. Un worker qui meurt
 * entre les deux, ou une transaction qui dépasse son délai après un `create`
 * réussi, laissait une facture numérotée sans PDF ni e-mail — et aucune alerte
 * ne la voyait.
 *
 * Désormais :
 *   - l'alerte part de la FACTURE (état de la base), jamais d'un journal ;
 *   - le cron écrit une trace de TENTATIVE avant d'émettre, et reprend au passage
 *     suivant PDF et e-mail d'une facture qu'il a émise et laissée incomplète —
 *     sans jamais en émettre une seconde.
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

import { casFactureAutoASignaler } from "./facture-auto-regles";
import { genererFacturesDuLendemain } from "./facture-auto-session";

/** Le lendemain matin du passage interrompu (07:00 UTC, balayage des alertes). */
const BALAYAGE = new Date("2026-10-07T07:00:00.000Z");
/** Le passage suivant du cron. */
const PASSAGE_SUIVANT = new Date("2026-10-07T09:30:00.000Z");

function reinitialiser(e: EtatFaux) {
  const vide = etatVide();
  Object.assign(e, vide);
}

/** La session et SA facture automatique restée sans PDF : le processus est mort après le `create`. */
function factureAutomatiqueInterrompue(over: Parameters<typeof factureFausse>[0] = {}) {
  h.etat.sessions = [sessionEligible("s-1")];
  h.etat.factures = [factureFausse({ documentId: null, ...over })];
  h.etat.journaux = [
    {
      action: "qualiopi.facture.generer.auto.tentative",
      targetType: "TrainingSession",
      targetId: "s-1",
      createdAt: new Date("2026-10-06T07:29:58.000Z"),
    },
  ];
}

beforeEach(() => {
  reinitialiser(h.etat);
  h.journal.mockReset().mockResolvedValue({});
  h.emettre.mockReset();
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
      createdAt: new Date(),
    });
    return {
      data: {
        enqueued: false,
        garePourValidation: true,
        to: "compta@acme.test",
        numero: "AXI-FACT-2026-070",
        estAvoir: false,
        pdfHash: "h",
      },
    };
  });
});

describe("🔴 l'alerte part de la FACTURE, pas du journal", () => {
  it("facture de session SANS PDF, aucun journal : signalée", async () => {
    factureAutomatiqueInterrompue();
    h.etat.journaux = [];
    const cas = await casFactureAutoASignaler(BALAYAGE);
    expect(cas).toEqual([
      expect.objectContaining({ cibleType: "FactureFormation", cibleId: "f-1" }),
    ]);
    expect(cas[0]!.message).toContain("AXI-FACT-2026-070");
    expect(cas[0]!.message).toContain("PDF");
  });

  it("facture AVEC PDF mais sans aucune trace d'e-mail, aucun journal : signalée", async () => {
    h.etat.sessions = [sessionEligible("s-1")];
    h.etat.factures = [factureFausse()];
    const cas = await casFactureAutoASignaler(BALAYAGE);
    expect(cas).toEqual([expect.objectContaining({ cibleId: "f-1" })]);
    expect(cas[0]!.message).toContain("Envoyer par email");
  });

  it.each([
    [
      "une ligne de corbeille rattachée à la facture",
      (e: EtatFaux) => {
        e.outbox.push({
          template: "facture-envoi",
          entityId: "f-1",
          payload: {},
          createdAt: new Date(),
        });
      },
    ],
    [
      "une ligne de corbeille d'avant le rattachement, reconnue par son numéro",
      (e: EtatFaux) => {
        e.outbox.push({
          template: "facture-envoi",
          entityId: null,
          payload: { numero: "AXI-FACT-2026-070" },
          createdAt: new Date("2026-10-06T08:00:00.000Z"),
        });
      },
    ],
    [
      "un e-mail journalisé pour la facture",
      (e: EtatFaux) => {
        e.logsEmail.push({ template: "facture-envoi", entityId: "f-1" });
      },
    ],
    [
      "le journal du bouton « Envoyer par email »",
      (e: EtatFaux) => {
        e.journaux.push({
          action: "facturation.email.facture",
          targetType: "FactureFormation",
          targetId: "f-1",
          createdAt: new Date(),
        });
      },
    ],
  ])("🔑 se tait dès qu'il existe %s", async (_nom, poser) => {
    h.etat.sessions = [sessionEligible("s-1")];
    h.etat.factures = [factureFausse()];
    poser(h.etat);
    expect(await casFactureAutoASignaler(BALAYAGE)).toEqual([]);
  });

  it("TÉMOIN : une facture émise il y a moins de 12 h n'est pas encore signalée", async () => {
    h.etat.sessions = [sessionEligible("s-1")];
    h.etat.factures = [factureFausse({ emiseAt: new Date("2026-10-07T01:00:00.000Z") })];
    expect(await casFactureAutoASignaler(BALAYAGE)).toEqual([]);
  });

  it("TÉMOIN : une facture émise avant la mise en service n'est pas concernée", async () => {
    h.etat.sessions = [sessionEligible("s-1")];
    h.etat.factures = [
      factureFausse({ documentId: null, emiseAt: new Date("2026-09-10T08:00:00.000Z") }),
    ];
    expect(await casFactureAutoASignaler(new Date("2026-09-20T07:00:00.000Z"))).toEqual([]);
  });

  it("TÉMOIN : une facture annulée n'est pas signalée comme incomplète (la SESSION l'est)", async () => {
    h.etat.sessions = [sessionEligible("s-1")];
    h.etat.factures = [factureFausse({ documentId: null, statut: "annulee" })];
    const cas = await casFactureAutoASignaler(BALAYAGE);
    expect(cas.filter((c) => c.cibleType === "FactureFormation")).toEqual([]);
  });
});

describe("🔴 le passage suivant REPREND la facture automatique incomplète", () => {
  it("PDF puis e-mail garé, sans émettre de seconde facture", async () => {
    factureAutomatiqueInterrompue();

    await genererFacturesDuLendemain(PASSAGE_SUIVANT);

    expect(h.emettre).not.toHaveBeenCalled();
    expect(h.pdf).toHaveBeenCalledWith("f-1");
    expect(h.email).toHaveBeenCalledWith({ factureId: "f-1" }, { exigerValidation: true });
  });

  it("PDF présent, e-mail manquant : seul l'e-mail est repris", async () => {
    factureAutomatiqueInterrompue({ documentId: "doc-1" });
    await genererFacturesDuLendemain(PASSAGE_SUIVANT);
    expect(h.pdf).not.toHaveBeenCalled();
    expect(h.email).toHaveBeenCalledWith({ factureId: "f-1" }, { exigerValidation: true });
  });

  it("TÉMOIN : une facture émise au BOUTON et laissée incomplète n'est pas reprise par l'automate", async () => {
    factureAutomatiqueInterrompue();
    h.etat.journaux = [];
    await genererFacturesDuLendemain(PASSAGE_SUIVANT);
    expect(h.pdf).not.toHaveBeenCalled();
    expect(h.email).not.toHaveBeenCalled();
  });

  it("une facture complète n'est pas reprise", async () => {
    factureAutomatiqueInterrompue({ documentId: "doc-1" });
    h.etat.outbox.push({
      template: "facture-envoi",
      entityId: "f-1",
      payload: {},
      createdAt: new Date(),
    });
    await genererFacturesDuLendemain(PASSAGE_SUIVANT);
    expect(h.pdf).not.toHaveBeenCalled();
    expect(h.email).not.toHaveBeenCalled();
  });
});

describe("🔴 la tentative est tracée AVANT l'émission", () => {
  it("le premier journal du passage est la tentative, sur la session", async () => {
    h.etat.sessions = [sessionEligible("s-1")];
    const vuAuMomentDeLEmission: string[] = [];
    h.emettre.mockImplementation(async () => {
      vuAuMomentDeLEmission.push(...h.etat.journaux.map((j) => j.action));
      return { error: "Identité de l'organisme incomplète (SIRET)." };
    });

    await genererFacturesDuLendemain(new Date("2026-10-06T09:30:00.000Z"));

    expect(h.emettre).toHaveBeenCalledTimes(1);
    expect(vuAuMomentDeLEmission).toContain("qualiopi.facture.generer.auto.tentative");
    const tentative = h.etat.journaux.find(
      (j) => j.action === "qualiopi.facture.generer.auto.tentative",
    );
    expect(tentative).toMatchObject({ targetType: "TrainingSession", targetId: "s-1" });
  });
});
