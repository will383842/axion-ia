// Challenges d'apporteurs : les écritures de la console exigent l'habilitation `facturer`
// (admin, super_admin), l'interrupteur allumé, les trois cases de publication. Données FICTIVES.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  role: "admin" as string | undefined,
  user: true,
  creer: vi.fn(async () => "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b"),
  modifier: vi.fn(async () => ({ ok: true as const })),
  publier: vi.fn(async () => ({ ok: true as const })),
  archiver: vi.fn(async () => ({ ok: true as const })),
  journal: vi.fn(async () => ({})),
}));
vi.mock("@/auth", () => ({
  auth: async () => (h.user ? { user: { id: "adm-1", role: h.role } } : null),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (u: string) => {
    throw new Error(`REDIRECT:${u}`);
  },
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { activityLog: { create: h.journal } } }));
vi.mock("../challenge-donnees", () => ({
  creerBrouillon: h.creer,
  modifierBrouillon: h.modifier,
  publierChallenge: h.publier,
  archiverChallenge: h.archiver,
}));

import {
  archiverChallengeAction,
  enregistrerBrouillonAction,
  publierChallengeAction,
} from "../actions-challenges-console";

const ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const SAISIE = {
  titre: "Challenge de test",
  debutLe: "2026-12-01",
  finLe: "2026-12-31",
  paiementJusquAu: "",
  produit: "journee-ia",
  critere: "facturees_dans_la_periode",
  seuil: "10",
  primeHt: "2000",
  reglement: "Rien n'est attendu de vous.",
};
const lancer = async (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: Error) => e.message,
  );

beforeEach(() => {
  vi.clearAllMocks();
  h.role = "admin";
  h.user = true;
  process.env.APPORTEUR_CHALLENGES_CONSOLE_ENABLED = "true";
});

describe("rôles", () => {
  it.each(["editor", "reader", "viewer", undefined])(
    "%s : refus de créer, publier, archiver",
    async (role) => {
      h.role = role;
      const r = await enregistrerBrouillonAction({ etat: "initial" }, fd(SAISIE));
      expect(r.etat).toBe("erreur");
      expect(
        await lancer(
          publierChallengeAction(fd({ id: ID, case1: "oui", case2: "oui", case3: "oui" })),
        ),
      ).toContain("REDIRECT:");
      expect(await lancer(archiverChallengeAction(fd({ id: ID, confirmer: "oui" })))).toContain(
        "erreur=",
      );
      expect(h.creer).not.toHaveBeenCalled();
      expect(h.publier).not.toHaveBeenCalled();
      expect(h.archiver).not.toHaveBeenCalled();
    },
  );
  it("sans session : refus", async () => {
    h.user = false;
    expect((await enregistrerBrouillonAction({ etat: "initial" }, fd(SAISIE))).etat).toBe("erreur");
    expect(h.creer).not.toHaveBeenCalled();
  });
  it("interrupteur éteint : refus même pour un admin", async () => {
    delete process.env.APPORTEUR_CHALLENGES_CONSOLE_ENABLED;
    expect((await enregistrerBrouillonAction({ etat: "initial" }, fd(SAISIE))).etat).toBe("erreur");
    expect(h.creer).not.toHaveBeenCalled();
  });
  it.each(["TRUE", "1", " true "])("interrupteur « %s » : éteint", async (v) => {
    process.env.APPORTEUR_CHALLENGES_CONSOLE_ENABLED = v;
    expect((await enregistrerBrouillonAction({ etat: "initial" }, fd(SAISIE))).etat).toBe("erreur");
  });
});

describe("création et publication", () => {
  it("un admin crée un BROUILLON et la trace est écrite", async () => {
    const r = await lancer(enregistrerBrouillonAction({ etat: "initial" }, fd(SAISIE)));
    expect(r).toContain(`REDIRECT:`);
    expect(h.creer).toHaveBeenCalledTimes(1);
    expect(h.publier).not.toHaveBeenCalled();
    expect(h.journal).toHaveBeenCalledTimes(1);
  });
  it("une saisie avec formule de pression est refusée, les valeurs sont rendues", async () => {
    const r = await enregistrerBrouillonAction(
      { etat: "initial" },
      fd({ ...SAISIE, reglement: "Dépêchez-vous !" }),
    );
    expect(r.etat).toBe("erreur");
    if (r.etat === "erreur") expect(r.valeurs["titre"]).toBe("Challenge de test");
    expect(h.creer).not.toHaveBeenCalled();
  });
  it("publier exige les trois cases", async () => {
    for (const manque of ["case1", "case2", "case3"]) {
      const f = { id: ID, case1: "oui", case2: "oui", case3: "oui", [manque]: "" };
      expect(await lancer(publierChallengeAction(fd(f)))).toContain("erreur=");
    }
    expect(h.publier).not.toHaveBeenCalled();
    expect(
      await lancer(
        publierChallengeAction(fd({ id: ID, case1: "oui", case2: "oui", case3: "oui" })),
      ),
    ).toContain("retour=");
    expect(h.publier).toHaveBeenCalledTimes(1);
  });
  it("archiver exige la confirmation", async () => {
    expect(await lancer(archiverChallengeAction(fd({ id: ID })))).toContain("erreur=");
    expect(h.archiver).not.toHaveBeenCalled();
    expect(await lancer(archiverChallengeAction(fd({ id: ID, confirmer: "oui" })))).toContain(
      "retour=",
    );
    expect(h.archiver).toHaveBeenCalledTimes(1);
  });
  it("identifiant invalide : refusé", async () => {
    await lancer(publierChallengeAction(fd({ id: "x", case1: "oui", case2: "oui", case3: "oui" })));
    expect(h.publier).not.toHaveBeenCalled();
  });
});
