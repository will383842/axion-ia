// @vitest-environment node

/**
 * L13 (paquet 4a) — « aucune question » s'enregistre (relecture 2026-10-09).
 *
 * L'éditeur écrit `[]` quand on supprime la dernière question. L'action doit
 * l'écrire en base : sinon l'offre garde ses anciennes questions alors que la
 * console affiche « Aucune question ». Un champ VIDE, lui, n'écrit toujours
 * rien (offres anciennes sans questions : aller-retour inchangé).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => ({
  db: {
    update: vi.fn(async (a: { where: { id: string }; data: Record<string, unknown> }) => ({
      id: a.where.id,
    })),
    create: vi.fn(async () => ({ id: "nouvelle" })),
  },
}));

vi.mock("@/auth", () => ({
  auth: async () => ({ user: { id: "admin-1", role: "super_admin" } }),
}));
vi.mock("@/server/auth/habilitations", () => ({
  peutConsulter: () => true,
  peutGererLesOffres: () => true,
  estSuperAdmin: () => true,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    jobOffer: {
      findUnique: async () => ({ publishedAt: null, slug: "monteur-video" }),
      update: db.update,
      create: db.create,
    },
    activityLog: { create: async () => ({}) },
  },
}));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "127.0.0.1" }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("@/lib/indexnow", () => ({ pingIndexNow: async () => {} }));

import { ecrireQuestions } from "@/lib/careers/questions-offre";

import { upsertJobOfferAction } from "../actions";

const ID = "11111111-1111-4111-8111-111111111111";

function formulaire(screeningQuestions: string): FormData {
  const f = new FormData();
  f.set("id", ID);
  f.set("slug", "monteur-video");
  f.set("status", "draft");
  f.set("category", "design");
  f.set("titleFr", "Monteur vidéo");
  f.set("summaryFr", "Un résumé assez long.");
  f.set("bodyFr_html", "<p>Corps</p>");
  f.set("bodyFr_text", "Corps");
  f.set("screeningQuestions", screeningQuestions);
  return f;
}

async function enregistrer(texte: string) {
  const r = await upsertJobOfferAction({ ok: false, error: "" }, formulaire(texte));
  expect(r).toEqual({ ok: true, id: ID, created: false });
  return db.update.mock.calls.at(-1)![0].data;
}

beforeEach(() => vi.clearAllMocks());

describe("upsertJobOfferAction — les questions de l'offre", () => {
  it("🔴 la liste vidée dans l'éditeur (`[]`) s'écrit en base", async () => {
    const data = await enregistrer(ecrireQuestions([]));
    expect(data).toHaveProperty("screeningQuestions", []);
  });

  it("un champ vide n'écrit rien (offre ancienne sans questions, inchangée)", async () => {
    const data = await enregistrer("");
    expect(data).not.toHaveProperty("screeningQuestions");
  });

  it("des questions s'écrivent telles quelles", async () => {
    const data = await enregistrer('[{"id":"q1","labelFr":"Pourquoi nous ?"}]');
    expect(data["screeningQuestions"]).toEqual([{ id: "q1", labelFr: "Pourquoi nous ?" }]);
  });
});
