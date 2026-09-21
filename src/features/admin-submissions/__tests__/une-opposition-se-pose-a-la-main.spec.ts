/**
 * Une opposition reçue AUTREMENT que par le lien se pose depuis la console
 * (2026-09-21).
 *
 * ── Le trou ───────────────────────────────────────────────────────────────
 * `enregistrerOpposition` ne savait lire qu'un JETON : celui du lien de
 * désinscription. Une personne qui dit à Will au téléphone qu'elle ne veut plus
 * rien recevoir n'avait donc aucun moyen d'être enregistrée — il fallait
 * attendre qu'elle clique sur un lien dans un message qu'elle venait de dire ne
 * plus vouloir. Pendant ce temps, les relances déjà programmées partaient.
 *
 * ── Ce que ce test protège, et qui n'est pas évident ──────────────────────
 * 🔑 Une opposition fait TROIS choses, et c'est toujours la troisième qu'une
 * seconde implémentation oublie : poser l'empreinte, prévenir le CRM (la
 * prospection HUMAINE ne lit que lui), et retirer les envois déjà programmés.
 * Le geste de la console passe par le MÊME chemin que le lien — le test le
 * vérifie sur le chemin, pas sur son résultat visible.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
const enregistrer = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { submission: { findUnique: (...a: unknown[]) => findUnique(...a) } },
}));
vi.mock("@/auth", () => ({
  auth: () => Promise.resolve({ user: { id: "admin-1", role: "admin", name: "Will" } }),
}));
vi.mock("@/lib/pii-crypto", () => ({
  decryptPii: (v: string | null) => v,
  isDecryptedEmailUsable: () => true,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/adm/${p}` }));
vi.mock("@/features/admin-inbox/cache-tags", () => ({ INBOX_COUNTS_TAG: "tag" }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/email/templates", () => ({ renderEmailTemplate: vi.fn() }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: vi.fn() }));
vi.mock("@/features/commercial-application/relances-lead-apporteur", () => ({
  annulerRelancesLeadApporteur: vi.fn(),
}));
vi.mock("./transitions", () => ({ appliquerTransition: vi.fn() }));
vi.mock("@/server/email/opposition", () => ({
  enregistrerOppositionPourAdresse: (...a: unknown[]) => enregistrer(...a),
}));

import { enregistrerOppositionDepuisFicheAction } from "../reply-actions";

const UUID = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  findUnique.mockResolvedValue({ contactEmail: "lea@exemple.invalid", deletedAt: null });
  enregistrer.mockResolvedValue({ ok: true, email: "lea@exemple.invalid", dejaOpposee: false });
});

describe("enregistrer une opposition depuis la fiche", () => {
  it("passe par le MÊME chemin que le lien de désinscription", async () => {
    const r = await enregistrerOppositionDepuisFicheAction(UUID);

    expect(r.ok).toBe(true);
    expect(enregistrer).toHaveBeenCalledTimes(1);
    expect(enregistrer.mock.calls[0]?.[0]).toBe("lea@exemple.invalid");
    // L'origine distingue les deux portes dans le registre, sans changer l'effet.
    expect(enregistrer.mock.calls[0]?.[1]).toMatchObject({ origine: "console-admin" });
  });

  it("une opposition déjà connue le DIT, au lieu de faire semblant d'agir", async () => {
    enregistrer.mockResolvedValue({ ok: true, email: "lea@exemple.invalid", dejaOpposee: true });
    const r = await enregistrerOppositionDepuisFicheAction(UUID);
    expect(r).toMatchObject({ ok: true, dejaOpposee: true });
  });

  it("🔴 une fiche EFFACÉE (art. 17) ne reçoit pas d'opposition", async () => {
    // Elle porte une adresse synthétique : poser une opposition dessus
    // créerait une ligne qui n'atteindra jamais personne, et donnerait à
    // croire que la demande a été prise en compte.
    findUnique.mockResolvedValue({ contactEmail: "sub-1@erased.local", deletedAt: null });

    const r = await enregistrerOppositionDepuisFicheAction(UUID);

    expect(r).toMatchObject({ ok: false, erreur: "sans-adresse" });
    expect(enregistrer).not.toHaveBeenCalled();
  });

  it("une fiche supprimée ou inconnue : rien, et on le dit", async () => {
    findUnique.mockResolvedValue(null);
    expect(await enregistrerOppositionDepuisFicheAction(UUID)).toMatchObject({
      ok: false,
      erreur: "introuvable",
    });

    findUnique.mockResolvedValue({ contactEmail: "x@y.invalid", deletedAt: new Date() });
    expect(await enregistrerOppositionDepuisFicheAction(UUID)).toMatchObject({
      ok: false,
      erreur: "introuvable",
    });
    expect(enregistrer).not.toHaveBeenCalled();
  });

  it("un identifiant qui n'est pas un UUID n'atteint jamais la base", async () => {
    const r = await enregistrerOppositionDepuisFicheAction("pas-un-uuid");
    expect(r.ok).toBe(false);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("un échec d'enregistrement ne se rend PAS pour un succès", async () => {
    // Le bouton qui dit « c'est fait » alors que rien n'est fait est le pire
    // des deux : Will ne recommencera pas.
    enregistrer.mockResolvedValue({ ok: false, error: "internal" });
    expect(await enregistrerOppositionDepuisFicheAction(UUID)).toMatchObject({ ok: false });
  });
});
