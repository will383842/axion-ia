/**
 * Prolonger la validité d'un devis envoyé ou expiré.
 * Mocks calqués sur `devis-remis-main-propre.spec.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  habilitation: vi.fn(),
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  txUpdateMany: vi.fn(),
  txLogCreate: vi.fn(),
  emettre: vi.fn(),
  enAttente: vi.fn(),
  journal: vi.fn(),
  creerToken: vi.fn(),
  enqueueEmail: vi.fn(),
  generateDocument: vi.fn(),
  ordre: [] as string[],
  tx: {} as unknown,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    devis: {
      findUnique: (...a: unknown[]) => h.findUnique(...a),
      findFirst: (...a: unknown[]) => h.findFirst(...a),
    },
    $transaction: async (f: (t: unknown) => unknown) => {
      h.tx = {
        devis: {
          updateMany: (...a: unknown[]) => {
            h.ordre.push("updateMany");
            return h.txUpdateMany(...a);
          },
        },
        activityLog: {
          create: (...a: unknown[]) => {
            h.ordre.push("journal");
            return h.txLogCreate(...a);
          },
        },
      };
      return f(h.tx);
    },
  },
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireHabilitation: (...a: unknown[]) => h.habilitation(...a),
  donneesJournalQualiopi: (...a: unknown[]) => h.journal(...a),
}));
vi.mock("@/server/qualiopi/devis/email-devis-en-attente", () => ({
  emailDevisEnAttente: (...a: unknown[]) => h.enAttente(...a),
}));
vi.mock("@/server/partners-sync/producteurs/devis", () => ({
  emettreDevisEmis: (...a: unknown[]) => {
    h.ordre.push("emettre");
    return h.emettre(...a);
  },
}));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  creerTokenDocument: (...a: unknown[]) => h.creerToken(...a),
  revoquerTokensDocument: vi.fn(),
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => h.enqueueEmail(...a),
}));
vi.mock("@/server/qualiopi/documents/documents-service", () => ({
  generateDocument: (...a: unknown[]) => h.generateDocument(...a),
}));

import { prolongerValiditeDevisAction } from "./devis-prolonger-validite";

const ID = "11111111-1111-4111-8111-111111111111";
const SESSION = { userId: "adm-1", role: "super_admin" };

function devisLu(over: Record<string, unknown> = {}) {
  return {
    id: ID,
    statut: "envoye",
    numero: "AXI-DEV-2026-001",
    dateValidite: new Date("2026-07-12T21:59:59Z"),
    documentGenereId: "doc-1",
    offreSha256: null,
    financementSuggere: null,
    montantOpcoEstimeCents: null,
    documentGenere: {
      annuleeAt: null,
      hashSha256: "abc123",
      metadata: { renderData: { data: { dateValidite: "12/07/2026" } } },
      signatures: [],
    },
    ...over,
  };
}

const maintenant = (iso: string) => vi.setSystemTime(new Date(iso));

beforeEach(() => {
  vi.useFakeTimers();
  maintenant("2026-07-10T10:00:00Z");
  vi.resetAllMocks();
  h.ordre.length = 0;
  h.habilitation.mockResolvedValue(SESSION);
  h.findUnique.mockResolvedValue(devisLu());
  h.findFirst.mockResolvedValue(null);
  h.enAttente.mockResolvedValue(false);
  h.txUpdateMany.mockResolvedValue({ count: 1 });
  h.txLogCreate.mockResolvedValue({});
  h.emettre.mockResolvedValue(null);
  h.journal.mockImplementation(async (i: { changes: unknown; action: string }) => ({
    action: i.action,
    changes: i.changes,
  }));
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env["DATABASE_URL"];
});

const erreur = (r: unknown) => (r as { error?: string }).error;

describe("prolongerValiditeDevisAction — refus", () => {
  it("refuse_sans_habilitation", async () => {
    h.habilitation.mockRejectedValue(new Error("forbidden: x"));
    const r = await prolongerValiditeDevisAction({ devisId: ID, nouvelleDate: "2026-07-20" });
    expect(erreur(r)).toBe("Vos droits ne permettent pas de prolonger un devis.");
    expect(h.habilitation).toHaveBeenCalledWith("conclure_devis");
    expect(h.txUpdateMany).not.toHaveBeenCalled();
  });

  it("refuse_date_impossible", async () => {
    const r = await prolongerValiditeDevisAction({ devisId: ID, nouvelleDate: "2026-02-30" });
    expect(erreur(r)).toBe("Date invalide.");
  });

  it("refuse_aujourdhui", async () => {
    const r = await prolongerValiditeDevisAction({ devisId: ID, nouvelleDate: "2026-07-10" });
    expect(erreur(r)).toBe("Choisissez une date entre demain et le 08/10/2026 (90 jours au plus).");
  });

  it("refuse_au_dela_de_90_jours", async () => {
    const r = await prolongerValiditeDevisAction({ devisId: ID, nouvelleDate: "2026-10-09" });
    expect(erreur(r)).toBe("Choisissez une date entre demain et le 08/10/2026 (90 jours au plus).");
    const ok = await prolongerValiditeDevisAction({ devisId: ID, nouvelleDate: "2026-10-08" });
    expect(erreur(ok)).toBeUndefined();
  });

  it.each(["brouillon", "accepte", "refuse", "transforme_convention"])(
    "refuse_statut_%s",
    async (statut) => {
      h.findUnique.mockResolvedValue(devisLu({ statut }));
      const r = await prolongerValiditeDevisAction({ devisId: ID, nouvelleDate: "2026-07-20" });
      expect(erreur(r)).toBe("Seul un devis envoyé ou expiré peut être prolongé.");
      expect(h.txUpdateMany).not.toHaveBeenCalled();
    },
  );

  it("refuse_devis_introuvable", async () => {
    h.findUnique.mockResolvedValue(null);
    const r = await prolongerValiditeDevisAction({ devisId: ID, nouvelleDate: "2026-07-20" });
    expect(erreur(r)).toBe("Ce devis est introuvable.");
  });

  it("refuse_signe_par_client", async () => {
    const d = devisLu();
    d.documentGenere.signatures = [{ partie: "client" }] as never;
    h.findUnique.mockResolvedValue(d);
    const r = await prolongerValiditeDevisAction({ devisId: ID, nouvelleDate: "2026-07-20" });
    expect(erreur(r)).toBe(
      "Le client a déjà signé ce devis : contresignez-le, sa date de validité n'a plus d'effet.",
    );
  });

  it("refuse_successeur_emis", async () => {
    h.findFirst.mockResolvedValue({ id: "v2" });
    const r = await prolongerValiditeDevisAction({ devisId: ID, nouvelleDate: "2026-07-20" });
    expect(erreur(r)).toBe(
      "Une version plus récente de ce devis a déjà été envoyée : c'est elle qu'il faut prolonger.",
    );
    expect(h.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { replacesDevisId: ID, statut: { not: "brouillon" } },
      }),
    );
  });

  it("accepte_successeur_brouillon", async () => {
    // La requête exclut les brouillons : aucun successeur émis n'est trouvé.
    h.findFirst.mockResolvedValue(null);
    const r = await prolongerValiditeDevisAction({ devisId: ID, nouvelleDate: "2026-07-20" });
    expect(erreur(r)).toBeUndefined();
  });

  it("refuse_piece_annulee", async () => {
    const d = devisLu();
    d.documentGenere.annuleeAt = new Date() as never;
    h.findUnique.mockResolvedValue(d);
    const r = await prolongerValiditeDevisAction({ devisId: ID, nouvelleDate: "2026-07-20" });
    expect(erreur(r)).toBe(
      "La pièce de ce devis a été annulée : utilisez « Corriger et renvoyer ».",
    );
  });

  it("refuse_estimation_tiers", async () => {
    h.findUnique.mockResolvedValue(
      devisLu({ financementSuggere: "opco", montantOpcoEstimeCents: 50000 }),
    );
    const r = await prolongerValiditeDevisAction({ devisId: ID, nouvelleDate: "2026-07-20" });
    expect(erreur(r)).toBe(
      "Ce devis porte une estimation de règlement par un tiers liée à sa date : pour changer la date, utilisez « Corriger et renvoyer ».",
    );
  });

  it("refuse_email_en_attente", async () => {
    h.enAttente.mockResolvedValue(true);
    const r = await prolongerValiditeDevisAction({ devisId: ID, nouvelleDate: "2026-07-20" });
    expect(erreur(r)).toBe(
      "Un e-mail de ce devis attend dans Emails → À valider : validez-le ou refusez-le avant de prolonger.",
    );
  });

  it("refuse_date_non_posterieure", async () => {
    h.findUnique.mockResolvedValue(devisLu({ dateValidite: new Date("2026-07-15T21:59:59Z") }));
    const r = await prolongerValiditeDevisAction({ devisId: ID, nouvelleDate: "2026-07-15" });
    expect(erreur(r)).toBe(
      "La nouvelle date doit être postérieure à la date de validité actuelle (15/07/2026).",
    );
    expect(h.txUpdateMany).not.toHaveBeenCalled();
  });

  it("base bouchon de build", async () => {
    process.env["DATABASE_URL"] = "postgresql://stub:stub@stub.invalid:5432/stub";
    const r = await prolongerValiditeDevisAction({ devisId: ID, nouvelleDate: "2026-07-20" });
    expect(erreur(r)).toBe("Indisponible pendant la construction du site.");
  });
});

describe("prolongerValiditeDevisAction — écriture", () => {
  it("envoye_prolonge_reste_envoye", async () => {
    const r = await prolongerValiditeDevisAction({ devisId: ID, nouvelleDate: "2026-07-20" });
    expect(r).toEqual({ data: { nouvelleDateLisible: "20/07/2026", rouvert: false } });
    const arg = h.txUpdateMany.mock.calls[0]![0];
    expect(arg.data.statut).toBe("envoye");
    expect(arg.where.statut).toEqual({ in: ["envoye", "expire"] });
  });

  it("expire_prolonge_redevient_envoye_rouvert_true", async () => {
    h.findUnique.mockResolvedValue(devisLu({ statut: "expire" }));
    const r = await prolongerValiditeDevisAction({ devisId: ID, nouvelleDate: "2026-07-20" });
    expect(r).toEqual({ data: { nouvelleDateLisible: "20/07/2026", rouvert: true } });
    expect(h.txUpdateMany.mock.calls[0]![0].data.statut).toBe("envoye");
  });

  it("date_enregistree_23h59m59_paris (été et hiver)", async () => {
    await prolongerValiditeDevisAction({ devisId: ID, nouvelleDate: "2026-07-20" });
    expect(h.txUpdateMany.mock.calls[0]![0].data.dateValidite.toISOString()).toBe(
      "2026-07-20T21:59:59.000Z",
    );
    maintenant("2026-12-10T10:00:00Z");
    h.findUnique.mockResolvedValue(devisLu({ dateValidite: new Date("2026-12-12T22:59:59Z") }));
    await prolongerValiditeDevisAction({ devisId: ID, nouvelleDate: "2026-12-20" });
    expect(h.txUpdateMany.mock.calls[1]![0].data.dateValidite.toISOString()).toBe(
      "2026-12-20T22:59:59.000Z",
    );
  });

  it("l'écriture est conditionnelle à la date lue et à l'absence de signature client", async () => {
    await prolongerValiditeDevisAction({ devisId: ID, nouvelleDate: "2026-07-20" });
    const where = h.txUpdateMany.mock.calls[0]![0].where;
    expect(where.id).toBe(ID);
    expect(where.dateValidite).toEqual(new Date("2026-07-12T21:59:59Z"));
    expect(where.OR).toBeDefined(); // `pasSigneParLeClient`
  });

  it("course_perdue_count_0_message_recharger", async () => {
    h.txUpdateMany.mockResolvedValue({ count: 0 });
    const r = await prolongerValiditeDevisAction({ devisId: ID, nouvelleDate: "2026-07-20" });
    expect(erreur(r)).toBe(
      "Le devis a changé entre-temps (signature du client, autre onglet ?). Rechargez la page.",
    );
    expect(h.emettre).not.toHaveBeenCalled();
    expect(h.txLogCreate).not.toHaveBeenCalled();
  });

  it("emet_devis_emis_sur_le_tx", async () => {
    await prolongerValiditeDevisAction({ devisId: ID, nouvelleDate: "2026-07-20" });
    expect(h.emettre).toHaveBeenCalledWith(h.tx, ID);
    expect(h.ordre).toEqual(["updateMany", "emettre", "journal"]);
  });

  it("journal_dans_la_transaction_avec_ancienne_nouvelle_date_imprimee", async () => {
    h.findUnique.mockResolvedValue(devisLu({ statut: "expire" }));
    await prolongerValiditeDevisAction({ devisId: ID, nouvelleDate: "2026-07-20" });
    expect(h.txLogCreate).toHaveBeenCalledTimes(1);
    const entree = h.journal.mock.calls[0]![0];
    expect(entree.action).toBe("qualiopi.devis.prolonger_validite");
    expect(entree.targetType).toBe("Devis");
    expect(entree.targetId).toBe(ID);
    expect(entree.session).toEqual(SESSION);
    expect(entree.changes).toEqual({
      numero: "AXI-DEV-2026-001",
      documentGenereId: "doc-1",
      documentHashSha256: "abc123",
      ancienneDate: "2026-07-12T21:59:59.000Z",
      nouvelleDate: "2026-07-20T21:59:59.000Z",
      dateImprimeeSurPdf: "12/07/2026",
      statutAvant: "expire",
      rouvert: true,
    });
  });

  it("aucun_jeton_ni_email", async () => {
    await prolongerValiditeDevisAction({ devisId: ID, nouvelleDate: "2026-07-20" });
    expect(h.creerToken).not.toHaveBeenCalled();
    expect(h.enqueueEmail).not.toHaveBeenCalled();
    expect(h.generateDocument).not.toHaveBeenCalled();
  });
});
