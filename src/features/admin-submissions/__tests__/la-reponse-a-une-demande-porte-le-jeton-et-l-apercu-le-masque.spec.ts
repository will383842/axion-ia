// Fiche I2-1 : la réponse écrite à une demande est rendue avec le VRAI destinataire (le pied de
// page porte son lien d'opposition, figé dans `bodyHtml`), par la MÊME fonction que l'aperçu ;
// l'aperçu, lui, ne renvoie au navigateur ni jeton ni lien cliquable. Aucun e-mail réel ne part.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  enqueue: vi.fn(),
  findUnique: vi.fn(),
  replyCreate: vi.fn(),
  render: vi.fn(),
  rendreEspion: vi.fn(),
  masquer: vi.fn(),
}));

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const ADRESSE = "claire@exemple.fr";

vi.mock("server-only", () => ({}));
vi.mock("@/auth", () => ({ auth: () => h.auth() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: (v: string) => (v === "illisible" ? null : v),
  isDecryptedEmailUsable: (v: string | null) => typeof v === "string" && v.includes("@"),
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => h.enqueue(...a),
}));
vi.mock("@/features/commercial-application/relances-lead-apporteur", () => ({
  annulerRelancesLeadApporteur: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: { findUnique: (...a: unknown[]) => h.findUnique(...a), update: vi.fn() },
    submissionReply: { create: (...a: unknown[]) => h.replyCreate(...a), update: vi.fn() },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        submissionReply: { create: (...a: unknown[]) => h.replyCreate(...a) },
        submission: { update: vi.fn() },
      }),
  },
}));
vi.mock("@/lib/email/templates", async (orig) => {
  const vrai = await orig<typeof import("@/lib/email/templates")>();
  return {
    ...vrai,
    renderEmailTemplate: (...a: Parameters<typeof vrai.renderEmailTemplate>) => {
      h.render(...a);
      return vrai.renderEmailTemplate(...a);
    },
  };
});
vi.mock("../rendu-reponse", async (orig) => {
  const vrai = await orig<typeof import("../rendu-reponse")>();
  return {
    ...vrai,
    rendreReponseDemande: (...a: Parameters<typeof vrai.rendreReponseDemande>) => {
      h.rendreEspion(...a);
      return vrai.rendreReponseDemande(...a);
    },
  };
});
vi.mock("@/lib/email/masquer-secrets", async (orig) => {
  const vrai = await orig<typeof import("@/lib/email/masquer-secrets")>();
  return {
    ...vrai,
    masquerSecretsEmail: (...a: Parameters<typeof vrai.masquerSecretsEmail>) => {
      h.masquer(...a);
      return vrai.masquerSecretsEmail(...a);
    },
  };
});

import { apercuReponseDemandeAction, replyToSubmissionAction } from "../reply-actions";
import { jetonOpposition, urlOpposition } from "@/server/email/opposition-jeton";

const saisie = { subject: "Re: votre demande", bodyMarkdown: "Bonjour,\n\nMerci **beaucoup**." };

beforeEach(() => {
  vi.clearAllMocks();
  process.env["AUTH_SECRET"] = "x".repeat(48);
  h.auth.mockResolvedValue({ user: { id: "u1", role: "admin", name: "Admin" } });
  h.enqueue.mockResolvedValue({ enqueued: true });
  h.replyCreate.mockResolvedValue({ id: "r1" });
  h.findUnique.mockResolvedValue({
    id: ID,
    contactEmail: ADRESSE,
    locale: "fr",
    status: "new",
    details: {},
  });
});

describe("I2-1 — réponse à une demande", () => {
  it("1) le bodyHtml écrit contient l'URL d'opposition de l'adresse déchiffrée", async () => {
    const r = await replyToSubmissionAction({ submissionId: ID, ...saisie });
    expect(r.ok).toBe(true);
    const ecrit = h.replyCreate.mock.calls[0]?.[0] as { data: { bodyHtml: string } };
    expect(ecrit.data.bodyHtml).toContain(urlOpposition(ADRESSE).replaceAll("&", "&amp;"));
  });

  it("2) aperçu et envoi appellent rendreReponseDemande avec les mêmes arguments ; l'HTML avant masquage égale le bodyHtml stocké", async () => {
    await replyToSubmissionAction({ submissionId: ID, ...saisie });
    const apercu = await apercuReponseDemandeAction({ submissionId: ID, ...saisie });
    expect(apercu.ok).toBe(true);
    expect(h.rendreEspion).toHaveBeenCalledTimes(2);
    expect(h.rendreEspion.mock.calls[0]).toEqual(h.rendreEspion.mock.calls[1]);
    expect(h.rendreEspion.mock.calls[0]?.[0]).toEqual({ locale: "fr", destinataire: ADRESSE });
    const stocke = (h.replyCreate.mock.calls[0]?.[0] as { data: { bodyHtml: string } }).data
      .bodyHtml;
    const avantMasquage = (h.masquer.mock.calls[0]?.[0] as { html: string }).html;
    expect(avantMasquage).toBe(stocke);
  });

  it("3) le HTML renvoyé ne contient ni jeton ni href", async () => {
    const r = await apercuReponseDemandeAction({ submissionId: ID, ...saisie });
    if (!r.ok) throw new Error(r.error);
    const jeton = jetonOpposition(ADRESSE);
    expect(jeton.length).toBeGreaterThan(10);
    const tout = JSON.stringify(r.apercu);
    expect(tout).not.toContain(jeton);
    expect(r.apercu.html).not.toMatch(/\shref\s*=/i);
    expect(r.apercu.texte ?? "").not.toContain(jeton);
    expect(r.apercu.a).toBe(ADRESSE);
  });

  it("4) rôle sans écriture, ou adresse illisible : refus, rendu jamais appelé", async () => {
    h.auth.mockResolvedValueOnce({ user: { id: "u2", role: "viewer", name: "Lecteur" } });
    const interdit = await apercuReponseDemandeAction({ submissionId: ID, ...saisie });
    expect(interdit).toEqual({ ok: false, error: "forbidden" });

    h.findUnique.mockResolvedValueOnce({ id: ID, contactEmail: "illisible", locale: "fr" });
    const illisible = await apercuReponseDemandeAction({ submissionId: ID, ...saisie });
    expect(illisible).toEqual({ ok: false, error: "invalid_recipient" });

    h.findUnique.mockResolvedValueOnce({ id: ID, contactEmail: "illisible", locale: "fr" });
    const envoi = await replyToSubmissionAction({ submissionId: ID, ...saisie });
    expect(envoi.ok).toBe(false);

    expect(h.render).not.toHaveBeenCalled();
    expect(h.rendreEspion).not.toHaveBeenCalled();
  });

  it("5) garde de source : ni console., ni Sentry avec le HTML, ni cache dans le rendu et l'action d'aperçu", () => {
    const rendu = readFileSync(
      join(process.cwd(), "src/features/admin-submissions/rendu-reponse.ts"),
      "utf8",
    );
    const actions = readFileSync(
      join(process.cwd(), "src/features/admin-submissions/reply-actions.ts"),
      "utf8",
    );
    const debut = actions.indexOf("export async function apercuReponseDemandeAction");
    const fin = actions.indexOf("// archive / unarchive");
    expect(debut).toBeGreaterThan(0);
    expect(fin).toBeGreaterThan(debut);
    const sansCommentaires = (t: string) =>
      t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const src of [sansCommentaires(rendu), sansCommentaires(actions.slice(debut, fin))]) {
      expect(src).not.toMatch(/console\./);
      expect(src).not.toMatch(/Sentry\.capture/);
      expect(src).not.toMatch(/["']use cache["']/);
      expect(src).not.toMatch(/unstable_cache/);
    }
  });
});
