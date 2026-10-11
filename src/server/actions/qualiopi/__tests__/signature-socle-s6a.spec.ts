/**
 * Lot S6a — les actions de signature, au bout de la chaîne :
 *   - (i) contresignature par lot : une ligne de preuve PAR PIÈCE, et une pièce
 *     refusée ne bloque pas les autres ;
 *   - lettre signée par le formateur puis contresignée : l'exemplaire part par
 *     l'après-signature commun, sans attendre le rattrapage ;
 *   - (c) la garde de rôle commune refuse `editor` comme avant.
 *
 * `signerDocument` et l'après-signature sont simulés : on éprouve le CÂBLAGE.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  signer: vi.fn(),
  apres: vi.fn(),
  p: {
    documentGenere: { findUnique: vi.fn() },
    documentSignature: { findMany: vi.fn() },
    devis: { findFirst: vi.fn() },
  },
  guards: { requireAdminWrite: vi.fn(), logQualiopiActivity: vi.fn() },
  formateur: vi.fn(),
  mandataire: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: h.p }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn(async () => ({ allowed: true })) }));
vi.mock("../_guards", () => h.guards);
vi.mock("@/server/qualiopi/documents/signature/document-signature-service", () => ({
  signerDocument: h.signer,
}));
vi.mock("@/server/qualiopi/documents/signature/apres-signature", () => ({
  apresSignature: h.apres,
}));
vi.mock("@/server/qualiopi/documents/signature/contexte-requete", () => ({
  contexteRequete: async () => ({ ipHash: null, userAgentSha256: null }),
}));
vi.mock("@/server/formateur/guard", () => ({ requireFormateurAction: h.formateur }));
vi.mock("@/server/qualiopi/documents/signature/mandat-lettre-mission", () => ({
  estMandataireDeLaLettre: h.mandataire,
}));

import { contresignerParLotAction, contresignerPieceAction } from "../piece-signature";
import {
  contresignerLettreMissionAction,
  signerLettreMissionFormateurAction,
} from "../lettre-mission-signature";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ADMIN = { userId: "adm-1", role: "admin" };

beforeEach(() => {
  vi.clearAllMocks();
  h.guards.requireAdminWrite.mockResolvedValue(ADMIN);
  h.p.documentSignature.findMany.mockResolvedValue([{ partie: "client" }]);
  h.p.documentGenere.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
    where.id === B
      ? { type: "facture", numero: "AXI-FAC-1" } // ne se contresigne pas
      : { type: "convention", numero: `AXI-DOC-${where.id.slice(0, 4)}` },
  );
  let n = 0;
  h.signer.mockImplementation(async () => ({
    ok: true,
    signatureId: `sig-${++n}`,
    statutSignature: "signee",
  }));
});

describe("contresignerParLotAction (i)", () => {
  it("une ligne de preuve par pièce ; la pièce refusée ne bloque pas les autres", async () => {
    const r = await contresignerParLotAction({
      ids: [A, B, C],
      methode: "confirmation_accessible",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.signees).toBe(2);
    expect(r.refusees).toBe(1);
    expect(r.resultats.map((x) => [x.documentGenereId, x.ok])).toEqual([
      [A, true],
      [B, false],
      [C, true],
    ]);
    // Une signature — donc une ligne de preuve — par pièce signée, chacune sur SA pièce.
    expect(h.signer).toHaveBeenCalledTimes(2);
    expect(h.signer.mock.calls.map((c) => c[0].documentGenereId)).toEqual([A, C]);
    expect(h.apres).toHaveBeenCalledTimes(2);
  });

  it("une panne sur une pièce reste la panne de CETTE pièce", async () => {
    h.signer.mockImplementationOnce(async () => {
      throw new Error("base");
    });
    const r = await contresignerParLotAction({ ids: [A, C], methode: "confirmation_accessible" });
    expect(r.ok && r.resultats.map((x) => x.ok)).toEqual([false, true]);
  });

  it("refuse editor sans rien lire, avec la même garde que l'unitaire", async () => {
    h.guards.requireAdminWrite.mockResolvedValue({ userId: "ed", role: "editor" });
    const lot = await contresignerParLotAction({ ids: [A], methode: "confirmation_accessible" });
    const un = await contresignerPieceAction({ documentGenereId: A, methode: "trace" });
    expect(lot).toMatchObject({ ok: false, raison: "role_insuffisant" });
    expect(un).toMatchObject({ ok: false, raison: "role_insuffisant" });
    expect(h.p.documentGenere.findUnique).not.toHaveBeenCalled();
  });

  it("refuse un lot vide ou trop gros", async () => {
    expect(
      await contresignerParLotAction({ ids: [], methode: "confirmation_accessible" }),
    ).toMatchObject({ ok: false, raison: "requete_invalide" });
    const trop = Array.from({ length: 51 }, () => A);
    expect(
      await contresignerParLotAction({ ids: trop, methode: "confirmation_accessible" }),
    ).toMatchObject({ ok: false, raison: "requete_invalide" });
  });
});

describe("lettre de mission : signée puis contresignée", () => {
  it("chaque signature passe par apresSignature ; la dernière porte « signee »", async () => {
    h.formateur.mockResolvedValue({ trainerId: "t-1" });
    h.mandataire.mockResolvedValue(true);
    h.p.documentGenere.findUnique.mockResolvedValue({
      type: "lettre_mission",
      numero: "AXI-DOC-2026-300",
      sessionId: null,
      trainerId: "t-1",
    });
    h.signer.mockResolvedValueOnce({ ok: true, signatureId: "s1", statutSignature: "partielle" });
    h.signer.mockResolvedValueOnce({ ok: true, signatureId: "s2", statutSignature: "signee" });

    await signerLettreMissionFormateurAction({ documentGenereId: A, methode: "trace" });
    await contresignerLettreMissionAction({ documentGenereId: A, methode: "trace" });

    expect(h.apres).toHaveBeenCalledTimes(2);
    expect(h.apres.mock.calls[0]![0]).toMatchObject({
      type: "lettre_mission",
      statutSignature: "partielle",
      partie: "formateur",
      acteur: { type: "signataire" },
    });
    expect(h.apres.mock.calls[1]![0]).toMatchObject({
      type: "lettre_mission",
      statutSignature: "signee",
      partie: "axionia",
      acteur: { type: "administrateur" },
    });
  });

  it("refus « introuvable » de L0b préservé : une lettre d'un autre formateur n'appelle rien", async () => {
    h.formateur.mockResolvedValue({ trainerId: "t-2" });
    h.mandataire.mockResolvedValue(false);
    h.p.documentGenere.findUnique.mockResolvedValue({
      type: "lettre_mission",
      numero: "AXI-DOC-2026-300",
      sessionId: null,
      trainerId: "t-1",
    });
    const r = await signerLettreMissionFormateurAction({ documentGenereId: A, methode: "trace" });
    const inconnu = await (async () => {
      h.p.documentGenere.findUnique.mockResolvedValue(null);
      return signerLettreMissionFormateurAction({ documentGenereId: B, methode: "trace" });
    })();
    expect(r).toEqual(inconnu);
    expect(h.apres).not.toHaveBeenCalled();
    expect(h.signer).not.toHaveBeenCalled();
  });
});
