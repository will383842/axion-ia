// « Marquer traité » n'efface plus les notes.
//
// ── Le défaut (constaté le 2026-09-19) ────────────────────────────────────
// Le bouton « Marquer traité » de la liste envoie un FormData qui ne contient
// que `id` et `status`. L'action lisait `formData.get("internalNotes") || null`
// — or `get` d'un champ ABSENT rend `null`, donc l'action écrivait
// `internalNotes: null` et `assignedTo: null`. Un clic de tri effaçait en
// silence les notes prises pendant l'appel et la personne assignée.
//
// La règle verrouillée ici : un champ ABSENT du formulaire n'écrit rien ; un
// champ PRÉSENT mais vide efface (c'est le geste « vider la note » de la fiche).

import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));

const submissionUpdate = vi.fn(async (a: unknown) => a);
const activityLogCreate = vi.fn(async (a: unknown) => a);
vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: { update: (a: unknown) => submissionUpdate(a) },
    activityLog: { create: (a: unknown) => activityLogCreate(a) },
    $transaction: async (ops: unknown[]) => Promise.all(ops),
  },
}));

vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.9" }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));

const { updateSubmissionAction } = await import("../actions");

const ID = "11111111-1111-4111-8111-111111111111";

function formulaire(champs: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(champs)) fd.set(k, v);
  return fd;
}

type AppelUpdate = { where: { id: string }; data: Record<string, unknown> };
type AppelJournal = { data: { changes: Record<string, unknown> } };

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
});

describe("updateSubmissionAction — un champ absent n'écrit rien", () => {
  it("« Marquer traité » (id + status seuls) ne touche ni aux notes ni à l'assignation", async () => {
    const r = await updateSubmissionAction(
      { ok: true },
      formulaire({ id: ID, status: "processed" }),
    );
    expect(r).toEqual({ ok: true });

    const { data } = submissionUpdate.mock.calls[0]?.[0] as AppelUpdate;
    expect(data).toEqual({ status: "processed" });
    expect(data, "les notes de l'appel seraient effacées").not.toHaveProperty("internalNotes");
    expect(data, "l'assignation serait effacée").not.toHaveProperty("assignedTo");

    // Le journal ne doit pas non plus prétendre qu'on a vidé les notes : c'est
    // lui qu'on relit pour savoir qui a effacé quoi.
    const { changes } = (activityLogCreate.mock.calls[0]?.[0] as AppelJournal).data;
    expect(changes).not.toHaveProperty("internalNotes");
    expect(changes).not.toHaveProperty("assignedTo");
  });

  it("un champ PRÉSENT mais vide efface toujours — le geste « vider la note » de la fiche", async () => {
    await updateSubmissionAction(
      { ok: true },
      formulaire({ id: ID, status: "in_progress", internalNotes: "", assignedTo: "" }),
    );
    const { data } = submissionUpdate.mock.calls[0]?.[0] as AppelUpdate;
    expect(data).toEqual({ status: "in_progress", internalNotes: null, assignedTo: null });
  });

  it("un champ présent et rempli est écrit tel quel", async () => {
    await updateSubmissionAction(
      { ok: true },
      formulaire({ id: ID, internalNotes: "Rappeler jeudi", assignedTo: "Will" }),
    );
    const { data } = submissionUpdate.mock.calls[0]?.[0] as AppelUpdate;
    expect(data).toEqual({ internalNotes: "Rappeler jeudi", assignedTo: "Will" });
  });

  it("le schéma reste la garde : une note trop longue est refusée, rien n'est écrit", async () => {
    const r = await updateSubmissionAction(
      { ok: true },
      formulaire({ id: ID, internalNotes: "x".repeat(5001) }),
    );
    expect(r).toEqual({ ok: false, error: "Champs invalides." });
    expect(submissionUpdate).not.toHaveBeenCalled();
  });
});

describe("updateSubmissionAction — rafraîchit les écrans qui existent", () => {
  it("revalide /contacts et /contacts/commercial, et non plus l'ancienne route /submissions", async () => {
    await updateSubmissionAction({ ok: true }, formulaire({ id: ID, status: "processed" }));
    const chemins = revalidatePath.mock.calls.map((c) => String(c[0]));
    expect(chemins.some((p) => p.endsWith("/contacts"))).toBe(true);
    expect(chemins.some((p) => p.endsWith("/contacts/commercial"))).toBe(true);
    // `/submissions` n'est plus qu'une redirection : la revalider ne rafraîchit
    // aucun écran, et laisse la liste réelle afficher l'ancien statut.
    expect(chemins.filter((p) => p.endsWith("/submissions"))).toEqual([]);
  });
});
