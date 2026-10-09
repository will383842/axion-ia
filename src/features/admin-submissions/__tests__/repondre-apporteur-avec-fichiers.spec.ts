/**
 * L6 — UN SEUL COMPOSEUR, AUSSI POUR LES FUTURS APPORTEURS.
 *
 * `replyToSubmissionAction` accepte désormais des fichiers de la bibliothèque,
 * mais SEULEMENT sur un dossier apporteur : un message client garde l'ancien
 * composeur, sans fichier. Les fichiers partent comme UN lien privé rattaché à
 * la fiche (`LienPartage.submissionId`), jamais en pièce jointe, et jamais à une
 * personne qui s'est opposée aux sollicitations.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));
const enqueueEmailMock = vi.fn();
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => enqueueEmailMock(...a),
}));
const renderMock = vi.fn();
vi.mock("@/lib/email/templates", () => ({
  renderEmailTemplate: (...a: unknown[]) => renderMock(...a),
}));
const submissionFindUnique = vi.fn();
const lienCreate = vi.fn();
const replyCreate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: { findUnique: (...a: unknown[]) => submissionFindUnique(...a) },
    submissionReply: { update: vi.fn() },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        submissionReply: { create: (...a: unknown[]) => replyCreate(...a) },
        submission: { update: vi.fn() },
        lienPartage: { create: (...a: unknown[]) => lienCreate(...a) },
      }),
  },
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/features/commercial-application/relances-lead-apporteur", () => ({
  annulerRelancesLeadApporteur: vi.fn(),
}));
const estOpposeeMock = vi.fn();
vi.mock("@/server/email/opposition", () => ({
  estOpposee: (...a: unknown[]) => estOpposeeMock(...a),
  enregistrerOppositionPourAdresse: vi.fn(),
}));
const preparerMock = vi.fn();
vi.mock("@/server/partages/attacher-a-une-reponse", async (orig) => ({
  ...(await orig<typeof import("@/server/partages/attacher-a-une-reponse")>()),
  preparerLienFichiers: (...a: unknown[]) => preparerMock(...a),
}));

const ID = "11111111-1111-4111-8111-111111111111";
const F1 = "33333333-3333-4333-8333-333333333333";
const LIEN = "55555555-5555-4555-8555-555555555555";
const APPORTEUR = { unifiedType: "recrutement", subType: "candidature-commerciale" };

function fiche(details: unknown) {
  return {
    id: ID,
    contactEmail: "nadine@exemple.fr",
    locale: "fr",
    status: "new",
    details,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { id: "u1", role: "admin", name: "Will" } });
  enqueueEmailMock.mockResolvedValue({ enqueued: true });
  renderMock.mockResolvedValue({ subject: "s", html: "<p>h</p>", text: "t" });
  replyCreate.mockResolvedValue({ id: "rep-1" });
  estOpposeeMock.mockResolvedValue(false);
  preparerMock.mockResolvedValue({
    ok: true,
    lien: {
      lienId: LIEN,
      adresse: `https://axion-ia.com/api/partage/${LIEN}/lien-prive-de-telechargement`,
      expireLe: new Date("2026-11-08T10:00:00Z"),
      fichierIds: [F1],
      categories: ["kit_apporteur"],
      paragraphe: "**Vos fichiers** : [Télécharger](https://axion-ia.com/x)",
    },
  });
});

async function envoyer(details: unknown, extra: Record<string, unknown> = {}) {
  submissionFindUnique.mockResolvedValueOnce(fiche(details));
  const { replyToSubmissionAction } = await import("../reply-actions");
  return replyToSubmissionAction({
    submissionId: ID,
    subject: "Le réseau d'apporteurs",
    bodyMarkdown: "Bonjour Nadine,",
    ...extra,
  });
}

describe("répondre à un futur apporteur avec des fichiers", () => {
  it("prépare le lien dans le monde « apporteur » et l'écrit sur la fiche, dans la transaction", async () => {
    const r = await envoyer(APPORTEUR, { fichierIds: [F1], modele: "presentation-reseau" });
    expect(r).toEqual({ ok: true, replyId: "rep-1" });
    expect(preparerMock).toHaveBeenCalledWith(
      [F1],
      expect.objectContaining({ monde: "apporteur" }),
    );
    expect(lienCreate).toHaveBeenCalledTimes(1);
    const data = (lienCreate.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(data).toMatchObject({ id: LIEN, submissionId: ID, reponseId: "rep-1" });
    expect(data["applicationId"]).toBeUndefined();
    expect(data["depotAutorise"]).toBe(false);
    // Le paragraphe du lien est dans le corps RENDU (l'e-mail a besoin du texte final).
    const rendu = renderMock.mock.calls[0]![2] as { bodyMarkdown: string };
    expect(rendu.bodyMarkdown).toContain("Vos fichiers");
    const reponse = (replyCreate.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(reponse["templateUsed"]).toBe("apporteur:presentation-reseau");
  });

  it("personne opposée : refus, rien n'est écrit", async () => {
    estOpposeeMock.mockResolvedValueOnce(true);
    const r = await envoyer(APPORTEUR, { fichierIds: [F1] });
    expect(r).toMatchObject({ ok: false, error: "opposee" });
    expect(replyCreate).not.toHaveBeenCalled();
    expect(lienCreate).not.toHaveBeenCalled();
  });

  it("message client : les fichiers sont refusés (l'ancien composeur n'en a pas)", async () => {
    const r = await envoyer({ unifiedType: "devis" }, { fichierIds: [F1] });
    expect(r).toMatchObject({ ok: false, error: "fichiers_reserves_apporteur" });
    expect(preparerMock).not.toHaveBeenCalled();
  });

  it("sans fichier : comportement inchangé, aucun lien", async () => {
    const r = await envoyer(APPORTEUR);
    expect(r.ok).toBe(true);
    expect(preparerMock).not.toHaveBeenCalled();
    expect(lienCreate).not.toHaveBeenCalled();
  });
});
