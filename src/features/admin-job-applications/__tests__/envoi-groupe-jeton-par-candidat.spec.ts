/**
 * Lot I2-2, test 7 (PR sensible) — le jeton d'opposition est PERSONNEL.
 *
 * Envoi groupé à deux candidats A et B, avec le VRAI rendu des gabarits : le `bodyHtml`
 * enregistré pour A porte le jeton de A et jamais celui de B, et inversement. Aujourd'hui
 * aucune réponse n'en porte. Seuls la base, la file et les statistiques d'avis sont simulées.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  creations: [] as Array<{ data: { toEmail: string; bodyHtml: string; bodyText: string } }>,
}));

vi.mock("@/auth", () => ({
  auth: async () => ({ user: { id: "u1", role: "admin", name: "Admin" } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/adm/${p}` }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/email/review-stats", () => ({
  getPublishedReviewStats: async () => ({ count: 0, avg: 0 }),
}));
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: (v: string) =>
    ({ chiffreA: "candidate.a@exemple.test", chiffreB: "candidat.b@exemple.test" })[v] ?? "Prénom",
  isDecryptedEmailUsable: (v: unknown) => typeof v === "string" && v.includes("@"),
}));
vi.mock("@/lib/prisma", () => {
  const tx = {
    $executeRaw: async () => 1,
    jobApplicationReply: {
      findMany: async () => [],
      create: async (a: (typeof d.creations)[number]) => {
        d.creations.push(a);
        return { id: `r${d.creations.length}` };
      },
    },
    jobApplicationEvent: { findFirst: async () => null },
    jobApplication: { update: async () => ({}) },
  };
  return {
    prisma: {
      jobApplication: {
        findMany: async () => [
          dossier("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "chiffreA"),
          dossier("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "chiffreB"),
        ],
      },
      $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
      jobApplicationReply: { update: vi.fn() },
    },
  };
});
vi.mock("@/features/admin-job-applications/journal", () => ({
  consignerEvenement: async () => {},
}));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: async () => ({ enqueued: true }) }));
vi.mock("@/features/job-application/complement", () => ({ lienComplement: async () => null }));

function dossier(id: string, email: string) {
  return {
    id,
    email,
    locale: "fr" as const,
    status: "reviewing",
    offerTitleSnap: "Monteur",
    firstName: "chiffre",
    offer: null,
  };
}

import { urlOpposition } from "@/server/email/opposition-jeton";
import { jetonOpposition } from "@/server/email/opposition-jeton";

import { repondreEnMasseAction } from "../actions-reponse-en-masse";
import { ecrireEtEnfilerReponse } from "../envoyer-reponse";

const A = "candidate.a@exemple.test";
const B = "candidat.b@exemple.test";

beforeEach(() => {
  d.creations.length = 0;
});

describe("I2-2 · le bodyHtml enregistré porte le jeton de SON destinataire", () => {
  it("🔴 [test 1] une réponse unitaire porte l'URL d'opposition de l'adresse déchiffrée", async () => {
    const issue = await ecrireEtEnfilerReponse(
      dossier("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "chiffreA"),
      { userId: "u1", nom: "Admin" },
      { subject: "Votre candidature", bodyMarkdown: "Bonjour", modele: "libre" },
    );
    expect(issue.ecrit).toBe(true);
    const html = d.creations[0]?.data.bodyHtml ?? "";
    expect(html).toContain(encodeURIComponent(jetonOpposition(A)));
  });

  it("🔴 [test 7] envoi groupé A et B : le bodyHtml de A porte le jeton de A, jamais celui de B", async () => {
    const f = new FormData();
    f.append("ids", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    f.append("ids", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    f.set("subject", "Votre candidature");
    f.set("bodyMarkdown", "Bonjour,\n\nMerci.");
    const r = await repondreEnMasseAction({ ok: false, error: "" } as never, f);
    expect(r.ok && r.envoyees).toBe(2);

    const jetonA = encodeURIComponent(jetonOpposition(A));
    const jetonB = encodeURIComponent(jetonOpposition(B));
    expect(jetonA).not.toBe(jetonB);
    const deA = d.creations.find((c) => c.data.toEmail === "chiffreA")?.data;
    const deB = d.creations.find((c) => c.data.toEmail === "chiffreB")?.data;
    expect(deA?.bodyHtml).toContain(jetonA);
    expect(deA?.bodyHtml).not.toContain(jetonB);
    expect(deB?.bodyHtml).toContain(jetonB);
    expect(deB?.bodyHtml).not.toContain(jetonA);
    // Le texte brut ne porte jamais l'adresse en clair d'un autre.
    expect(deA?.bodyText).not.toContain(B);
    expect(deB?.bodyText).not.toContain(A);
    expect(urlOpposition(A)).toContain(jetonA);
  });
});
