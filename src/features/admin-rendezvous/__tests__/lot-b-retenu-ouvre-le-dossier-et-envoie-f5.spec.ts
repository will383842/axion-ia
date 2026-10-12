/**
 * Lot B, M2 — côté console : « Retenu » avec le dossier en ligne allumé.
 *   · la préparation rend F5 (aperçu avec un lien indicatif) marqué `ouvreDossier` ;
 *   · l'enregistrement crée la fiche, OUVRE son dossier puis envoie F5 par
 *     `ouvrirDossierRetenu` (jamais par l'envoi générique de la candidature) ;
 *   · un dossier déjà ouvert pour cette personne : aucun e-mail préparé.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── préparation ─────────────────────────────────────────────────────────────
const findUniqueEvt = vi.fn();
const findUniqueJA = vi.fn();
const findManyJA = vi.fn();
const countSuivi = vi.fn();
const findFirstLog = vi.fn();
const findFirstOutbox = vi.fn();
const findFirstTrainer = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    calendlyEvent: { findUnique: (...a: unknown[]) => findUniqueEvt(...a) },
    jobApplication: {
      findUnique: (...a: unknown[]) => findUniqueJA(...a),
      findMany: (...a: unknown[]) => findManyJA(...a),
    },
    rendezVousSuivi: { count: (...a: unknown[]) => countSuivi(...a) },
    emailLog: { findFirst: (...a: unknown[]) => findFirstLog(...a) },
    emailOutbox: { findFirst: (...a: unknown[]) => findFirstOutbox(...a) },
    trainer: { findFirst: (...a: unknown[]) => findFirstTrainer(...a) },
  },
}));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string) => v.replace(/^enc:/, "") }));
vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string | null | undefined) => (e ? `h-${e}` : null),
}));
const etats = vi.fn();
vi.mock("@/server/qualiopi/formateurs-independants/interrupteurs-etat", () => ({
  lireEtatsInterrupteurs: () => etats(),
}));

import { etatsParDefaut } from "@/server/qualiopi/formateurs-independants/interrupteurs";

import {
  LIEN_DOSSIER_APERCU,
  MESSAGE_DOSSIER_DEJA_OUVERT,
  MESSAGE_SANS_DOSSIER,
  preparerIssueFormateur,
} from "../issue-formateur-envoi";

const CAND = "0b7c3a52-4a0e-4d4c-9f43-2f6a7d1c9e10";

beforeEach(() => {
  vi.clearAllMocks();
  etats.mockResolvedValue({ ...etatsParDefaut(), dossier_en_ligne: true });
  findUniqueEvt.mockResolvedValue({
    id: "evt_f1",
    eventTypeName: "Échange formateur indépendant (20 min)",
    typeRendezVous: "autre",
    linkedJobApplicationId: CAND,
    status: "scheduled",
    startTime: new Date("2026-10-01T08:00:00Z"),
  });
  findUniqueJA.mockResolvedValue({
    id: CAND,
    email: "enc:camille@example.com",
    emailHash: "h-camille",
    firstName: "enc:Camille",
  });
  findManyJA.mockResolvedValue([{ id: CAND }]);
  countSuivi.mockResolvedValue(0);
  findFirstLog.mockResolvedValue(null);
  findFirstOutbox.mockResolvedValue(null);
  findFirstTrainer.mockResolvedValue(null);
});

describe("preparerIssueFormateur — Retenu, dossier en ligne allumé", () => {
  it("prépare F5 avec le lien indicatif, marqué « ouvre le dossier »", async () => {
    const p = await preparerIssueFormateur({ calendlyEventId: "evt_f1", issue: "retenu" });
    if (!p.ok || !p.envoi) throw new Error("attendu : un envoi");
    expect(p.envoi).toMatchObject({
      gabarit: "formateur-issue-retenu",
      destinataire: "camille@example.com",
      ouvreDossier: true,
      payload: { prenom: "Camille", lien: LIEN_DOSSIER_APERCU },
    });
  });

  it("dossier déjà ouvert pour cette personne : aucun e-mail", async () => {
    findFirstTrainer.mockResolvedValue({ id: "t1" });
    const p = await preparerIssueFormateur({ calendlyEventId: "evt_f1", issue: "retenu" });
    expect(p).toMatchObject({ ok: true, envoi: null, sansEmail: MESSAGE_DOSSIER_DEJA_OUVERT });
  });

  it("interrupteur coupé : comportement d'avant (aucun e-mail, message inchangé)", async () => {
    etats.mockResolvedValue(etatsParDefaut());
    const p = await preparerIssueFormateur({ calendlyEventId: "evt_f1", issue: "retenu" });
    expect(p).toMatchObject({ ok: true, envoi: null, sansEmail: MESSAGE_SANS_DOSSIER });
    expect(findFirstTrainer).not.toHaveBeenCalled();
  });
});
