// « Marquer la prestation réalisée » / « Annuler » depuis la fiche d'une entreprise présentée,
// et l'état « En attente de réalisation » de « Vos déclarations » (contrat 2.3, art. 4.2).
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string } },
  marquer: vi.fn(),
  annuler: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: async () => h.session }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/adm/${p}` }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("../realisation", () => ({
  marquerPrestationRealisee: (...a: unknown[]) => h.marquer(...a),
  annulerRealisation: (...a: unknown[]) => h.annuler(...a),
  realisationDisponible: async () => true,
}));

import {
  annulerRealisationFicheAction,
  marquerRealiseeFicheAction,
} from "../actions-prestation-fiche";
import { etatPrestation } from "../prestation-presentation";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";

function form(champs: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(champs)) fd.set(k, v);
  return fd;
}

async function redirection(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    const m = /^REDIRECT:(.*)$/.exec((e as Error).message);
    if (m) return decodeURIComponent(m[1]!.replace(/\+/g, " "));
    throw e;
  }
  throw new Error("aucune redirection");
}

beforeEach(() => {
  vi.clearAllMocks();
  h.marquer.mockResolvedValue({ ok: true });
  h.annuler.mockResolvedValue({ ok: true });
});

describe("actions de la fiche — garde serveur et retour sur la fiche", () => {
  it.each([
    ["sans session", null],
    ["rôle éditeur", { user: { id: "u", role: "editor" } }],
  ])("%s : refusé, le métier n'est jamais appelé", async (_c, session) => {
    h.session = session;
    const a = await redirection(
      marquerRealiseeFicheAction(form({ id: ID, realiseeLe: "2026-10-01", onglet: "toutes" })),
    );
    const b = await redirection(annulerRealisationFicheAction(form({ id: ID, onglet: "toutes" })));
    expect(a).toContain("prestationErreur=");
    expect(b).toContain("prestationErreur=");
    expect(h.marquer).not.toHaveBeenCalled();
    expect(h.annuler).not.toHaveBeenCalled();
  });

  it("administrateur : marque à midi UTC du jour saisi, auteur tracé, retour sur la fiche", async () => {
    h.session = { user: { id: "adm-1", role: "admin" } };
    const url = await redirection(
      marquerRealiseeFicheAction(form({ id: ID, realiseeLe: "2026-10-01", onglet: "protegees" })),
    );
    expect(h.marquer).toHaveBeenCalledWith(
      ID,
      new Date("2026-10-01T12:00:00.000Z"),
      expect.any(Date),
      "adm-1",
    );
    expect(url).toMatch(/^\/fr\/adm\/apporteurs\/entreprises\?onglet=protegees&prestation=/);
  });

  it("annuler : le métier reçoit l'identifiant et l'auteur ; son refus revient en erreur", async () => {
    h.session = { user: { id: "adm-1", role: "admin" } };
    h.annuler.mockResolvedValue({ ok: false, message: "Cette commission est déjà facturée." });
    const url = await redirection(annulerRealisationFicheAction(form({ id: ID, onglet: "x" })));
    expect(h.annuler).toHaveBeenCalledWith(ID, "adm-1");
    // Un onglet inconnu ne passe pas dans l'adresse de retour.
    expect(url).toContain("onglet=toutes");
    expect(url).toContain("prestationErreur=Cette commission est déjà facturée.");
  });

  it("identifiant invalide : refusé", async () => {
    h.session = { user: { id: "adm-1", role: "admin" } };
    const url = await redirection(
      marquerRealiseeFicheAction(form({ id: "pas-un-uuid", realiseeLe: "2026-10-01" })),
    );
    expect(url).toContain("prestationErreur=");
    expect(h.marquer).not.toHaveBeenCalled();
  });
});

describe("« Vos déclarations » — l'état de la prestation", () => {
  const le = (j: string) => new Date(`${j}T12:00:00.000Z`);
  it("aucune commission : rien à afficher", () => {
    expect(etatPrestation([])).toBeNull();
  });
  it("une commission non marquée : en attente de réalisation", () => {
    expect(etatPrestation([{ statut: "due", prestationRealiseeAt: null }])).toEqual({
      etat: "en_attente",
    });
  });
  it("toutes marquées : réalisée, à la date la plus récente", () => {
    expect(
      etatPrestation([
        { statut: "due", prestationRealiseeAt: le("2026-09-01") },
        { statut: "a_qualifier", prestationRealiseeAt: le("2026-09-20") },
      ]),
    ).toEqual({ etat: "realisee", le: le("2026-09-20") });
  });
  it("une seule non marquée suffit : en attente", () => {
    expect(
      etatPrestation([
        { statut: "due", prestationRealiseeAt: le("2026-09-01") },
        { statut: "due", prestationRealiseeAt: null },
      ]),
    ).toEqual({ etat: "en_attente" });
  });
  it("une commission reprise (remboursement) ne compte pas", () => {
    expect(etatPrestation([{ statut: "reprise", prestationRealiseeAt: null }])).toBeNull();
  });
});
