/**
 * I2-3 — aperçu exact d'un e-mail de la file « à valider ».
 *
 * 1. Pour la même saisie, la charge rendue par l'aperçu est égale à celle
 *    qu'`approuverEmailAction` passe à `enqueueEmail` (et l'objet forcé aussi).
 * 2. Message personnalisé : présent pour un gabarit qui le lit, jamais injecté sinon.
 * 3. L'objet saisi remplace l'objet de la file.
 * 4. Statut ≠ `a_valider`, rôle sans écriture, identifiant inconnu : refus sans rendu.
 * 5. Lien d'opposition masqué, aucun `href`.
 * Seuls le rendu, la file et la base sont simulés ; aucun e-mail ne part.
 */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const JETON = "JETONMARQUEURabcdef0123456789ZZ";
const OPPOSITION = `https://axion-ia.com/fr/opposition?t=${JETON}`;
const HTML = `<html><body><div data-skip-in-text="true">Pré-entête test</div><p>Bonjour</p><a href="${OPPOSITION}">Se désabonner</a></body></html>`;
const TEXTE = `Bonjour\nSe désabonner : ${OPPOSITION}`;

const h = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  update: vi.fn(),
  enqueue: vi.fn(),
  render: vi.fn(),
  garde: vi.fn(),
  log: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/qualiopi/documents/signature/lien-precedent", () => ({
  ligneDuLien: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/server/qualiopi/documents/signature/token-document", () => ({
  revoquerJetonPrecis: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: () => h.garde(),
  logQualiopiActivity: (...a: unknown[]) => h.log(...a),
}));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: (...a: unknown[]) => h.enqueue(...a) }));
vi.mock("@/lib/email/templates", () => ({
  renderEmailTemplate: (...a: unknown[]) => h.render(...a),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailOutbox: {
      findUnique: (...a: unknown[]) => h.findUnique(...a),
      updateMany: (...a: unknown[]) => h.updateMany(...a),
      update: (...a: unknown[]) => h.update(...a),
    },
  },
}));

import { apercuOutboxAction } from "@/server/actions/qualiopi/email-outbox-apercu";
import { approuverEmailAction } from "@/server/actions/qualiopi/email-outbox";

const ID = "00000000-0000-4000-8000-000000000001";
// Gabarit qui lit le message personnalisé / gabarit qui ne le lit pas : voir `outbox-policy.ts`.
import { GABARITS_QUI_LISENT_LE_MESSAGE } from "@/server/email/outbox-policy";
const LIT = [...GABARITS_QUI_LISENT_LE_MESSAGE][0] ?? "";
const NE_LIT_PAS = "contact-confirmed";

const ligne = (over: Record<string, unknown> = {}) => ({
  id: ID,
  template: LIT,
  recipient: "destinataire@exemple.test",
  locale: "fr",
  payload: { montant: 42 },
  sujet: "Objet de la file",
  statut: "a_valider",
  clientId: null,
  entityType: "Devis",
  entityId: "devis-1",
  attachments: [{ filename: "devis.pdf", r2Key: "k/devis.pdf" }],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.garde.mockResolvedValue({ userId: "u-1", role: "super_admin" });
  h.findUnique.mockResolvedValue(ligne());
  h.updateMany.mockResolvedValue({ count: 1 });
  h.update.mockResolvedValue({});
  h.enqueue.mockResolvedValue({ enqueued: true });
  h.render.mockResolvedValue({ subject: "Objet du gabarit", html: HTML, text: TEXTE });
});

describe("apercuOutboxAction", () => {
  it("1) rend avec la charge exacte que l'approbation met en file (même saisie)", async () => {
    const saisie = {
      id: ID,
      sujet: "Objet corrigé",
      messagePersonnalise: "Merci de votre retour.",
    };
    const r = await apercuOutboxAction(saisie);
    expect("data" in r).toBe(true);
    await approuverEmailAction(saisie);

    const [gabarit, locale, charge, options] = h.render.mock.calls[0]!;
    const [gabaritFile, destFile, localeFile, chargeFile, optionsFile] = h.enqueue.mock.calls[0]!;
    expect(gabarit).toBe(gabaritFile);
    expect(locale).toBe(localeFile);
    expect(charge).toEqual(chargeFile);
    expect(options).toEqual({ destinataire: destFile });
    expect(optionsFile.sujetForce).toBe("Objet corrigé");
    if ("data" in r) expect(r.data.objet).toBe(optionsFile.sujetForce);
  });

  it("2) le message personnalisé n'est injecté que pour un gabarit qui le lit", async () => {
    await apercuOutboxAction({ id: ID, messagePersonnalise: "Un mot." });
    expect(h.render.mock.calls[0]![2]).toMatchObject({ messagePersonnalise: "Un mot." });

    h.render.mockClear();
    h.findUnique.mockResolvedValue(ligne({ template: NE_LIT_PAS }));
    await apercuOutboxAction({ id: ID, messagePersonnalise: "Un mot." });
    expect(h.render.mock.calls[0]![2]).not.toHaveProperty("messagePersonnalise");
  });

  it("3) l'objet saisi remplace celui de la file ; inchangé, le gabarit décide (comme le worker)", async () => {
    const a = await apercuOutboxAction({ id: ID, sujet: "Objet saisi" });
    const b = await apercuOutboxAction({ id: ID });
    if (!("data" in a) || !("data" in b)) throw new Error("aperçu attendu");
    expect(a.data.objet).toBe("Objet saisi");
    expect(b.data.objet).toBe("Objet du gabarit");
  });

  it("4) refuse sans rendre : statut autre, identifiant inconnu, rôle sans écriture", async () => {
    h.findUnique.mockResolvedValue(ligne({ statut: "envoye" }));
    expect("error" in (await apercuOutboxAction({ id: ID }))).toBe(true);
    h.findUnique.mockResolvedValue(null);
    expect("error" in (await apercuOutboxAction({ id: ID }))).toBe(true);
    h.findUnique.mockResolvedValue(ligne());
    h.garde.mockRejectedValue(new Error("droits"));
    await expect(apercuOutboxAction({ id: ID })).rejects.toThrow();
    expect(h.render).not.toHaveBeenCalled();
    expect(h.enqueue).not.toHaveBeenCalled();
  });

  it("5) le lien d'opposition est masqué et le HTML n'a aucun href ni jeton", async () => {
    const r = await apercuOutboxAction({ id: ID });
    if (!("data" in r)) throw new Error("aperçu attendu");
    const tout = JSON.stringify(r.data);
    expect(tout).not.toContain(JETON);
    expect(r.data.html).not.toMatch(/href=/i);
    expect(r.data.texte).not.toContain(JETON);
    expect(r.data.piecesJointes).toEqual(["devis.pdf"]);
    expect(r.data.a).toBe("destinataire@exemple.test");
  });

  it("n'écrit rien en base, n'enfile rien", async () => {
    await apercuOutboxAction({ id: ID });
    expect(h.updateMany).not.toHaveBeenCalled();
    expect(h.update).not.toHaveBeenCalled();
    expect(h.enqueue).not.toHaveBeenCalled();
  });

  it("garde de source : ni console., ni Sentry, ni cache dans l'action d'aperçu", () => {
    const src = readFileSync("src/server/actions/qualiopi/email-outbox-apercu.ts", "utf8");
    expect(src).not.toMatch(/console\./);
    expect(src).not.toMatch(/Sentry\.capture/);
    expect(src).not.toMatch(/use cache|unstable_cache/);
    expect(src.startsWith('"use server"') || src.includes('\n"use server"')).toBe(true);
  });
});
