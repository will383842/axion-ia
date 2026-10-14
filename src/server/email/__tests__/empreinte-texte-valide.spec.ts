// Lot 8A (décision du dirigeant, #1510-1) — la validation d'un texte formateur porte
// l'EMPREINTE du texte validé. Si le texte change ensuite, la validation tombe d'elle-même :
// l'envoi est refusé comme pour un texte jamais validé, et l'écran dit « à revalider ».
// Les autres textes (hors formateurs) gardent leur règle : `{ valide: true }` suffit.
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
vi.mock("@/auth", () => ({ auth: () => auth() }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.7" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { tx, lignes } = vi.hoisted(() => ({
  tx: {
    setting: {
      findUnique: vi.fn(async () => null as unknown),
      findMany: vi.fn(async () => [] as Array<{ key: string; value: unknown }>),
      upsert: vi.fn(async () => ({})),
    },
    activityLog: { create: vi.fn(async () => ({})) },
  },
  lignes: { valeur: [] as Array<{ key: string; value: unknown }> },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    setting: { findMany: vi.fn(async () => lignes.valeur) },
  },
}));

import {
  empreinteDe,
  empreinteDuTexte,
  empreinteAttendue,
  listeDesTextesAffichee,
  TEXTES_FORMATEURS_A_VALIDER,
} from "../textes-formateurs-a-valider";
import { cleTexteValide, estTexteValide } from "../textes-valides";
import { lireEtatsTextes, lireTextesValides } from "../textes-valides-lecture";
import {
  validerTexteEmailFormAction,
  validerTousTextesFormateursAction,
} from "../textes-valides-actions";

const INITIAL = { ok: true as const, message: "" };
const form = (champs: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(champs)) f.set(k, v);
  return f;
};
const F = { gabarit: "formateur-dossier-lien" } as const;
const CLE = cleTexteValide(F.gabarit);

beforeEach(() => {
  vi.clearAllMocks();
  lignes.valeur = [];
  auth.mockResolvedValue({ user: { id: "u-1", role: "super_admin" } });
});

describe("l'empreinte d'un texte", () => {
  it("est stable, et change dès qu'un mot change", () => {
    expect(empreinteDe({ a: ["Bonjour"] })).toBe(empreinteDe({ a: ["Bonjour"] }));
    expect(empreinteDe({ a: ["Bonjour"] })).not.toBe(empreinteDe({ a: ["Bonjour."] }));
  });
  it("chaque texte à valider a la sienne ; un texte hors formateurs n'en a pas", () => {
    const toutes = TEXTES_FORMATEURS_A_VALIDER.map(empreinteDuTexte);
    expect(new Set(toutes).size).toBe(toutes.length);
    expect(empreinteAttendue(CLE)).toBe(empreinteDuTexte(F));
    expect(empreinteAttendue(cleTexteValide("accuse-candidature"))).toBeNull();
  });
});

describe("la lecture du registre", () => {
  it("empreinte égale au texte actuel : validé", async () => {
    lignes.valeur = [{ key: CLE, value: { valide: true, empreinte: empreinteDuTexte(F) } }];
    expect(estTexteValide(await lireTextesValides(), F.gabarit)).toBe(true);
  });
  it("texte changé depuis la validation : la validation tombe, l'écran dit « à revalider »", async () => {
    lignes.valeur = [{ key: CLE, value: { valide: true, empreinte: "0".repeat(64) } }];
    expect(estTexteValide(await lireTextesValides(), F.gabarit)).toBe(false);
    expect((await lireEtatsTextes()).aRevalider.has(CLE)).toBe(true);
  });
  it("validation ancienne sans empreinte : à revalider (on ne sait pas quel texte a été relu)", async () => {
    lignes.valeur = [{ key: CLE, value: { valide: true } }];
    expect(estTexteValide(await lireTextesValides(), F.gabarit)).toBe(false);
    expect((await lireEtatsTextes()).aRevalider.has(CLE)).toBe(true);
  });
  it("un texte hors formateurs garde sa règle : `{ valide: true }` suffit", async () => {
    const autre = cleTexteValide("accuse-candidature", "formateur");
    lignes.valeur = [{ key: autre, value: { valide: true } }];
    expect(estTexteValide(await lireTextesValides(), "accuse-candidature", "formateur")).toBe(true);
  });
});

describe("les actions de validation", () => {
  it("valider un texte formateur écrit l'empreinte du texte affiché", async () => {
    const r = await validerTexteEmailFormAction(
      INITIAL,
      form({ ...F, valide: "1", empreinte: empreinteDuTexte(F) }),
    );
    expect(r.ok).toBe(true);
    expect(tx.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { value: { valide: true, empreinte: empreinteDuTexte(F) }, updatedBy: "u-1" },
      }),
    );
  });
  it("texte changé entre l'affichage et le clic : refus, rien n'est écrit", async () => {
    const r = await validerTexteEmailFormAction(
      INITIAL,
      form({ ...F, valide: "1", empreinte: "f".repeat(64) }),
    );
    expect(r.ok).toBe(false);
    expect(tx.setting.upsert).not.toHaveBeenCalled();
  });
  it("valider tous : la liste affichée porte les empreintes, et un texte déjà validé sur un AUTRE texte est réécrit", async () => {
    expect(listeDesTextesAffichee()).toContain(empreinteDuTexte(F));
    tx.setting.findMany.mockResolvedValueOnce([
      { key: CLE, value: { valide: true, empreinte: "0".repeat(64) } },
    ]);
    const r = await validerTousTextesFormateursAction(
      INITIAL,
      form({
        confirme: "oui",
        nombre: String(TEXTES_FORMATEURS_A_VALIDER.length),
        liste: listeDesTextesAffichee(),
      }),
    );
    expect(r.ok).toBe(true);
    const ecrites = (
      tx.setting.upsert.mock.calls as unknown as Array<[{ where: { key: string } }]>
    ).map((c) => c[0].where.key);
    expect(ecrites).toContain(CLE);
    expect(ecrites).toHaveLength(TEXTES_FORMATEURS_A_VALIDER.length);
  });
});
