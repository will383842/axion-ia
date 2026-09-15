/**
 * « Envoyer par email » d'une facture — le comportement du BOUTON, épinglé.
 *
 * 🔑 Pourquoi ce fichier existe (2026-09-15). `envoyerFactureEmailAction`
 * n'avait AUCUN test. Le chemin qu'elle porte est désormais partagé avec la
 * génération automatique du lendemain de session (`facture-auto-session.ts`) :
 * le corps a été extrait dans un service pur, l'action n'en est plus que
 * l'enveloppe (garde d'accès + journal). Une extraction sans filet change un
 * comportement sans que rien ne rougisse — ces tests ont été écrits et passés
 * au vert sur le code d'AVANT l'extraction, puis rejoués après.
 *
 * Ce qui est épinglé :
 *   - le destinataire par défaut est l'e-mail de contact du client ;
 *   - brouillon, PDF absent, destinataire absent : refus, rien n'est mis en file ;
 *   - le gabarit, la pièce jointe (clé R2 dérivée du document), le `clientId`,
 *     le sujet et le montant réclamé (reste dû net) ;
 *   - un e-mail GARÉ en validation est un succès, et il est journalisé ;
 *   - le bouton ne force PAS la validation : les règles d'automatisation par
 *     client restent souveraines sur ce chemin (c'est la génération
 *     automatique, et elle seule, qui l'exige).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const d = vi.hoisted(() => ({
  factureFindUnique: vi.fn(),
  documentFindUnique: vi.fn(),
  enqueueEmail: vi.fn(),
  log: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    factureFormation: { findUnique: d.factureFindUnique },
    documentGenere: { findUnique: d.documentFindUnique },
  },
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => d.enqueueEmail(...a),
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-1", role: "super_admin" }),
  logQualiopiActivity: (...a: unknown[]) => d.log(...a),
}));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  creerTokenDocument: vi.fn(),
  TokenDocumentError: class extends Error {},
}));

import { envoyerFactureEmailAction } from "@/server/actions/qualiopi/facturation-emails";

const FACTURE_ID = "11111111-1111-4111-8111-111111111111";

function facture(over: Record<string, unknown> = {}) {
  return {
    id: FACTURE_ID,
    numero: "AXI-FACT-2026-042",
    statut: "emise",
    documentId: "doc-1",
    clientId: "client-1",
    avoirDeId: null,
    destinataireNom: "Acme",
    montantHtCents: 100000,
    montantTtcCents: 120000,
    echeanceAt: new Date("2026-10-15T00:00:00Z"),
    client: { raisonSociale: "Acme", contactEmail: "compta@acme.test" },
    payments: [{ amountCents: 20000, status: "succeeded" }],
    avoirs: [],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  d.factureFindUnique.mockResolvedValue(facture());
  d.documentFindUnique.mockResolvedValue({
    type: "facture",
    numero: "AXI-DOC-2026-100",
    hashSha256: "hash-pdf",
    createdAt: new Date("2026-09-16T08:00:00Z"),
  });
  d.enqueueEmail.mockResolvedValue({ enqueued: false, garePourValidation: true, outboxId: "o-1" });
});

describe("envoyerFactureEmailAction — comportement du bouton", () => {
  it("destinataire par défaut = e-mail de contact du client, garé = succès journalisé", async () => {
    const r = await envoyerFactureEmailAction({ factureId: FACTURE_ID });

    expect(r).toEqual({
      data: { enqueued: false, garePourValidation: true, to: "compta@acme.test" },
    });
    expect(d.enqueueEmail).toHaveBeenCalledTimes(1);
    const [gabarit, to, locale, payload, options] = d.enqueueEmail.mock.calls[0]!;
    expect(gabarit).toBe("facture-envoi");
    expect(to).toBe("compta@acme.test");
    expect(locale).toBe("fr");
    expect(payload).toMatchObject({
      clientNom: "Acme",
      numero: "AXI-FACT-2026-042",
      estAvoir: false,
      // Reste dû NET : 1 200,00 TTC − 200,00 encaissés.
      montantLabel: expect.stringMatching(/^1\s000,00\s€ TTC$/) as unknown as string,
    });
    expect(options).toMatchObject({
      attachments: [{ filename: "AXI-FACT-2026-042.pdf", r2Key: expect.any(String) }],
      clientId: "client-1",
      sujet: "Facture AXI-FACT-2026-042 — Axion-IA",
    });
    // Le bouton laisse les règles d'automatisation décider : il ne force rien.
    expect((options as Record<string, unknown>)["exigerValidation"]).toBeUndefined();

    expect(d.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "facturation.email.facture",
        targetType: "FactureFormation",
        targetId: FACTURE_ID,
        changes: {
          to: "compta@acme.test",
          numero: "AXI-FACT-2026-042",
          estAvoir: false,
          pdfHash: "hash-pdf",
        },
        session: { userId: "admin-1", role: "super_admin" },
      }),
    );
  });

  it("un destinataire explicite prime sur le contact du client", async () => {
    const r = await envoyerFactureEmailAction({ factureId: FACTURE_ID, to: "autre@acme.test" });
    expect(r).toMatchObject({ data: { to: "autre@acme.test" } });
    expect(d.enqueueEmail.mock.calls[0]![1]).toBe("autre@acme.test");
  });

  it("brouillon : refus, rien en file, rien au journal", async () => {
    d.factureFindUnique.mockResolvedValue(facture({ statut: "brouillon" }));
    const r = await envoyerFactureEmailAction({ factureId: FACTURE_ID });
    expect(r).toEqual({ error: "Une facture en brouillon ne s'envoie pas — l'émettre d'abord." });
    expect(d.enqueueEmail).not.toHaveBeenCalled();
    expect(d.log).not.toHaveBeenCalled();
  });

  it("PDF absent : refus", async () => {
    d.factureFindUnique.mockResolvedValue(facture({ documentId: null }));
    const r = await envoyerFactureEmailAction({ factureId: FACTURE_ID });
    expect(r).toEqual({ error: "PDF absent : générer le PDF de la facture avant l'envoi." });
    expect(d.enqueueEmail).not.toHaveBeenCalled();
  });

  it("aucun e-mail de contact et aucun destinataire saisi : refus", async () => {
    d.factureFindUnique.mockResolvedValue(
      facture({ client: { raisonSociale: "Acme", contactEmail: null } }),
    );
    const r = await envoyerFactureEmailAction({ factureId: FACTURE_ID });
    expect(r).toEqual({
      error: "Aucun destinataire : renseigner un email (ou l'email de contact du client).",
    });
    expect(d.enqueueEmail).not.toHaveBeenCalled();
  });

  it("file indisponible (ni en file, ni garé) : erreur, rien au journal", async () => {
    d.enqueueEmail.mockResolvedValue({ enqueued: false });
    const r = await envoyerFactureEmailAction({ factureId: FACTURE_ID });
    expect(r).toEqual({ error: "File d'envoi indisponible — réessayer." });
    expect(d.log).not.toHaveBeenCalled();
  });

  it("entrée invalide : refus avant toute lecture", async () => {
    const r = await envoyerFactureEmailAction({ factureId: "pas-un-uuid" });
    expect(r).toEqual({ error: "Entrée invalide." });
    expect(d.factureFindUnique).not.toHaveBeenCalled();
  });
});
