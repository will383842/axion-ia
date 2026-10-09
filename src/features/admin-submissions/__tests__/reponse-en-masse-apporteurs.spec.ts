/**
 * L6b — ENVOI GROUPÉ AUX FUTURS APPORTEURS, NEUF ET RÉDUIT AUX MODÈLES.
 *
 * Le texte part du MODÈLE choisi, lu côté serveur — jamais d'un texte libre
 * posé par le navigateur. Exclus et nommés : opposés, « Sans suite ». Chacun
 * reçoit son propre message, et son propre lien s'il y a des fichiers.
 */
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: async () => ({ user: { id: "u1", role: "admin", name: "Will" } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: string) => v }));
const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { submission: { findMany: (...a: unknown[]) => findMany(...a) } },
}));
const ecrire = vi.fn();
vi.mock("../envoyer-reponse", () => ({
  ecrireEtEnfilerReponseSubmission: (...a: unknown[]) => ecrire(...a),
}));
const opposees = new Set<string>();
vi.mock("@/server/email/opposition", () => ({ estOpposee: async (e: string) => opposees.has(e) }));
const preparer = vi.fn();
vi.mock("@/server/partages/attacher-a-une-reponse", () => ({
  preparerLienFichiers: (...a: unknown[]) => preparer(...a),
}));
vi.mock("@/features/commercial-application/relances-lead-apporteur", () => ({
  annulerRelancesLeadApporteur: vi.fn(),
}));
vi.mock("@/features/commercial-application/invitation-apporteur", () => ({
  lireSuiviInvitationListe: async () => new Map(),
}));

import { repondreEnMasseApporteursAction } from "../actions-reponse-en-masse-apporteurs";

const APPORTEUR = { unifiedType: "recrutement", subType: "candidature-commerciale" };
const F1 = "33333333-3333-4333-8333-333333333333";

function fiche(i: number, extra: Record<string, unknown> = {}) {
  return {
    id: `0000000${i}-0000-4000-8000-000000000000`,
    contactEmail: `p${i}@exemple.fr`,
    contactName: `Prenom${i} Nom${i}`,
    locale: "fr",
    status: "new",
    deletedAt: null,
    details: APPORTEUR,
    ...extra,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  opposees.clear();
  ecrire.mockResolvedValue({ ecrit: true, enfile: true, replyId: "r" });
  preparer.mockImplementation(async (ids: string[]) => ({
    ok: true,
    lien: { lienId: randomUUID(), fichierIds: ids, categories: ["kit_apporteur"], paragraphe: "p" },
  }));
});

describe("repondreEnMasseApporteursAction", () => {
  it("5 cochés dont 1 opposé → 4 envois, 4 liens distincts, l'opposé nommé", async () => {
    const lignes = [1, 2, 3, 4, 5].map((i) => fiche(i));
    opposees.add("p2@exemple.fr");
    findMany.mockResolvedValueOnce(lignes);
    const r = await repondreEnMasseApporteursAction({
      ids: lignes.map((l) => l.id),
      modele: "presentation-reseau",
      fichierIds: [F1],
    });
    expect(r.ok && r.envoyees).toBe(4);
    const liens = ecrire.mock.calls.map(
      (c) => (c[2] as { lienFichiers: { lienId: string } }).lienFichiers.lienId,
    );
    expect(new Set(liens).size).toBe(4);
    expect(preparer).toHaveBeenCalledWith([F1], expect.objectContaining({ monde: "apporteur" }));
    expect(r.ok && r.details).toEqual([
      expect.objectContaining({ id: lignes[1]!.id, motif: "opposee", nom: "Prenom2 N." }),
    ]);
  });

  it("le texte vient du MODÈLE, personnalisé pour chacun ; « libre » est refusé", async () => {
    findMany.mockResolvedValueOnce([fiche(1)]);
    const r = await repondreEnMasseApporteursAction({
      ids: [fiche(1).id],
      modele: "presentation-reseau",
    });
    expect(r.ok).toBe(true);
    const contenu = ecrire.mock.calls[0]![2] as { bodyMarkdown: string; templateUsed: string };
    expect(contenu.bodyMarkdown).toMatch(/^Bonjour Prenom1,/);
    expect(contenu.templateUsed).toBe("apporteur-groupe:presentation-reseau");
    const refus = await repondreEnMasseApporteursAction({
      ids: [fiche(1).id],
      modele: "libre" as never,
    });
    expect(refus.ok).toBe(false);
  });

  it("« Sans suite » exclue et nommée ; une fiche qui n'est pas apporteur est ignorée", async () => {
    findMany.mockResolvedValueOnce([
      fiche(1, { details: { ...APPORTEUR, sansSuiteAt: "2026-09-30T10:00:00Z" } }),
      fiche(2, { details: { unifiedType: "devis" } }),
      fiche(3),
    ]);
    const r = await repondreEnMasseApporteursAction({
      ids: [fiche(1).id, fiche(2).id, fiche(3).id],
      modele: "apres-echange",
    });
    expect(r.ok && r.envoyees).toBe(1);
    expect(r.ok && r.details.map((d) => d.motif)).toEqual(["sans_suite", "dossier_introuvable"]);
  });
});
