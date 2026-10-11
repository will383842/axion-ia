// @vitest-environment node
// L'import du registre est gardé CÔTÉ SERVEUR : rôle administrateur, fichier JSON valide.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string } },
  enregistrer: vi.fn(),
  ecrireBase: vi.fn(),
  journal: vi.fn(),
  configure: true,
  dejaEnBase: 0,
  lecture: { etat: "absent" } as unknown,
}));
vi.mock("@/auth", () => ({ auth: async () => h.session }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/admin-path", () => ({ adminPath: (_l: string, p: string) => `/fr/adm/${p}` }));
vi.mock("@/lib/r2-storage", () => ({
  isR2Configured: () => h.configure,
  uploadToR2: vi.fn(),
  getObjectBufferR2: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { traitementRgpd: { count: async () => h.dejaEnBase } },
}));
vi.mock("@/server/journal/journaliser", () => ({
  journaliser: (...a: unknown[]) => h.journal(...a),
}));
vi.mock("../stockage", async (orig) => ({
  ...(await orig<typeof import("../stockage")>()),
  enregistrerRegistre: (...a: unknown[]) => h.enregistrer(...a),
  lireRegistre: async () => h.lecture,
}));

vi.mock("../base", async (orig) => ({
  ...(await orig<typeof import("../base")>()),
  ecrireRegistreEnBase: (...a: unknown[]) => h.ecrireBase(...a),
}));

import { importerRegistre, importerRegistreAction, reprendreRegistre } from "../actions";
import { validerRegistre } from "../schema";
import { registreFictif } from "./fixtures";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";

function formulaire(contenu: string, nom = "registre.json"): FormData {
  const fd = new FormData();
  fd.set("registre", new File([contenu], nom, { type: "application/json" }));
  return fd;
}

beforeEach(() => {
  h.session = { user: { id: ID, role: "admin" } };
  h.configure = true;
  h.enregistrer.mockReset();
  h.ecrireBase.mockReset();
  h.ecrireBase.mockResolvedValue({ traitements: 3, ecarts: 5, archives: 0 });
  h.journal.mockReset();
  h.dejaEnBase = 0;
  const v = validerRegistre(registreFictif);
  h.lecture = v.ok ? { etat: "ok", registre: v.registre, importeLe: null } : null;
});

describe("Mettre à jour le registre", () => {
  it("refuse sans session", async () => {
    h.session = null;
    const r = await importerRegistre(formulaire(JSON.stringify(registreFictif)));
    expect(r.ok).toBe(false);
    expect(h.enregistrer).not.toHaveBeenCalled();
  });

  it.each(["responsable_qualite", "secretaire", "editor", "reader"])(
    "refuse le rôle %s, sans rien enregistrer",
    async (role) => {
      h.session = { user: { id: ID, role } };
      const r = await importerRegistre(formulaire(JSON.stringify(registreFictif)));
      expect(r).toEqual({ ok: false, erreur: "Réservé aux administrateurs." });
      expect(h.enregistrer).not.toHaveBeenCalled();
      expect(h.ecrireBase).not.toHaveBeenCalled();
      expect(h.journal).not.toHaveBeenCalled();
    },
  );

  it("refuse un JSON invalide en disant quel champ pose problème", async () => {
    const r = await importerRegistre(
      formulaire(
        JSON.stringify({ traitements: [{ id: "x", nom: "X", ecarts: [{ gravite: "?" }] }] }),
      ),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreur).toContain("ecarts › n° 1 › gravite");
    expect(h.enregistrer).not.toHaveBeenCalled();
  });

  it("refuse un fichier qui n'est pas du JSON", async () => {
    const r = await importerRegistre(formulaire("pas du json"));
    expect(r).toEqual({ ok: false, erreur: "Ce fichier n'est pas un JSON lisible." });
  });

  it("refuse un fichier de plus de 2 Mo", async () => {
    const r = await importerRegistre(formulaire(" ".repeat(2 * 1024 * 1024 + 1)));
    expect(r).toEqual({ ok: false, erreur: "Fichier trop lourd (2 Mo au plus)." });
  });

  it("refuse proprement quand le stockage privé n'est pas configuré", async () => {
    h.configure = false;
    const r = await importerRegistre(formulaire(JSON.stringify(registreFictif)));
    expect(r.ok).toBe(false);
    expect(h.enregistrer).not.toHaveBeenCalled();
  });

  it("refuse deux écarts de même code dans une activité, sans rien écrire", async () => {
    const r = await importerRegistre(
      formulaire(
        JSON.stringify({
          traitements: [
            {
              id: "x",
              nom: "X",
              ecarts: [
                { code: "Z", gravite: "faible" },
                { code: "Z", gravite: "moyen" },
              ],
            },
          ],
        }),
      ),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreur).toContain("code déjà utilisé");
    expect(h.enregistrer).not.toHaveBeenCalled();
    expect(h.ecrireBase).not.toHaveBeenCalled();
  });

  it("enregistre un registre valide (copie R2 PUIS base) et journalise SANS contenu", async () => {
    const r = await importerRegistre(formulaire(JSON.stringify(registreFictif)));
    expect(r).toEqual({ ok: true, traitements: 3 });
    expect(h.enregistrer).toHaveBeenCalledTimes(1);
    expect(h.ecrireBase).toHaveBeenCalledTimes(1);
    expect(h.enregistrer.mock.invocationCallOrder[0]).toBeLessThan(
      h.ecrireBase.mock.invocationCallOrder[0]!,
    );
    expect(h.journal).toHaveBeenCalledTimes(1);
    const trace = JSON.stringify(h.journal.mock.calls[0]);
    expect(trace).toContain("conformite.registre.importe");
    expect(trace).not.toContain("Activité A");
    expect(trace).not.toContain("Constat");
  });

  it("l'action du formulaire revient sur la page avec le résultat", async () => {
    await expect(
      importerRegistreAction(formulaire(JSON.stringify(registreFictif))),
    ).rejects.toThrow("REDIRECT:/fr/adm/conformite-rgpd?import=ok");
    h.session = { user: { id: ID, role: "reader" } };
    await expect(importerRegistreAction(formulaire("{}"))).rejects.toThrow(
      /REDIRECT:\/fr\/adm\/conformite-rgpd\?erreur=/,
    );
  });
});

describe("Reprendre le registre déjà importé", () => {
  it("refuse un non-administrateur, sans rien écrire", async () => {
    h.session = { user: { id: ID, role: "secretaire" } };
    expect(await reprendreRegistre()).toEqual({
      ok: false,
      erreur: "Réservé aux administrateurs.",
    });
    expect(h.ecrireBase).not.toHaveBeenCalled();
  });

  it("refuse si la base contient déjà le registre", async () => {
    h.dejaEnBase = 2;
    const r = await reprendreRegistre();
    expect(r.ok).toBe(false);
    expect(h.ecrireBase).not.toHaveBeenCalled();
  });

  it("refuse s'il n'y a rien de lisible dans le stockage privé", async () => {
    h.lecture = { etat: "absent" };
    expect((await reprendreRegistre()).ok).toBe(false);
    expect(h.ecrireBase).not.toHaveBeenCalled();
  });

  it("base vide + registre dans R2 : l'écrit en base et journalise sans contenu", async () => {
    const r = await reprendreRegistre();
    expect(r).toEqual({ ok: true, traitements: 3 });
    expect(h.ecrireBase).toHaveBeenCalledTimes(1);
    const trace = JSON.stringify(h.journal.mock.calls[0]);
    expect(trace).toContain("conformite.registre.repris");
    expect(trace).not.toContain("Activité A");
  });
});
