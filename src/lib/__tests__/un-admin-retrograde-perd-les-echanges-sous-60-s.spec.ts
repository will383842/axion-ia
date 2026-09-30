// @vitest-environment node

/**
 * ⛔ UN ADMIN RÉTROGRADÉ PERD LES ÉCHANGES SOUS 60 S (vérification finale V1, S1).
 *
 * Le rôle du jeton de session n'était écrit qu'à la connexion : le
 * rafraîchissement ne relisait que le statut. Un administrateur passé en rôle
 * Qualiopi gardait, jusqu'à 30 jours (durée de la session), la lecture des
 * transcriptions, citations et comptes rendus (décision A2 : Will et les
 * administrateurs seulement) — `exigerAccesEchanges` et `gardeLectureEchanges`
 * lisent le rôle de la session.
 *
 * Désormais `rafraichirJetonAdmin` relit le rôle AVEC le statut, sous le même
 * cache de 60 s, et le réécrit dans le jeton.
 *
 * Mutation qui rougit : ne plus réécrire `token.role` depuis la base → 1er et
 * 2e cas ; rendre au callback `jwt` de `src/auth.ts` son ancien corps → dernier cas.
 * Contre-témoin : dans les 60 s, le cache sert (une seule lecture) ; un compte
 * suspendu ou supprimé perd sa session (comportement d'avant, gardé).
 * Angle mort : jusqu'à 60 s après le changement de rôle, l'ancien rôle vaut
 * encore (même borne que la suspension).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const base = vi.hoisted(() => ({
  lignes: new Map<string, { status: string; role: string }>(),
  lectures: 0,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminUser: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        base.lectures += 1;
        return base.lignes.get(where.id) ?? null;
      },
    },
  },
}));

import { peutVoirLesEchanges } from "@/features/dossier-client/roles-echanges";

import { oublierCacheAdmin, rafraichirJetonAdmin } from "../auth-jeton-admin";

const T0 = 1_800_000_000_000;

/** Un jeton vide TYPÉ : `{}` littéral ferait inférer `T = {}` et interdirait `jeton["role"]`. */
const jetonVide = (): Record<string, unknown> => ({});

beforeEach(() => {
  base.lignes.clear();
  base.lectures = 0;
  oublierCacheAdmin();
});

describe("⛔ un admin rétrogradé perd les échanges sous 60 s", () => {
  it("🔴 rôle changé en base : le jeton le suit au premier rafraîchissement après 60 s", async () => {
    base.lignes.set("u1", { status: "active", role: "admin" });
    let jeton = await rafraichirJetonAdmin(
      { token: jetonVide(), user: { id: "u1", role: "admin" } },
      T0,
    );
    expect(jeton?.["role"]).toBe("admin");
    expect(peutVoirLesEchanges(jeton?.["role"] as string)).toBe(true);

    base.lignes.set("u1", { status: "active", role: "secretaire" });
    jeton = await rafraichirJetonAdmin({ token: jeton ?? {} }, T0 + 61_000);
    expect(jeton?.["role"]).toBe("secretaire");
    expect(peutVoirLesEchanges(jeton?.["role"] as string)).toBe(false);
  });

  it("🔴 un rôle forgé dans la connexion est remplacé par celui de la base", async () => {
    base.lignes.set("u2", { status: "active", role: "reader" });
    const jeton = await rafraichirJetonAdmin(
      { token: jetonVide(), user: { id: "u2", role: "admin" } },
      T0,
    );
    expect(jeton?.["role"]).toBe("reader");
  });

  it("contre-témoin : dans les 60 s, une seule lecture de la base", async () => {
    base.lignes.set("u3", { status: "active", role: "admin" });
    const j = await rafraichirJetonAdmin(
      { token: jetonVide(), user: { id: "u3", role: "admin" } },
      T0,
    );
    await rafraichirJetonAdmin({ token: j ?? {} }, T0 + 10_000);
    await rafraichirJetonAdmin({ token: j ?? {} }, T0 + 59_000);
    expect(base.lectures).toBe(1);
  });

  it("contre-témoin : un compte suspendu ou supprimé perd sa session", async () => {
    base.lignes.set("u4", { status: "suspended", role: "admin" });
    expect(await rafraichirJetonAdmin({ token: { id: "u4", role: "admin" } }, T0)).toBeNull();
    expect(await rafraichirJetonAdmin({ token: { id: "absent", role: "admin" } }, T0)).toBeNull();
  });

  it("un jeton sans identifiant passe tel quel (aucune lecture)", async () => {
    const jeton = { name: "x" };
    expect(await rafraichirJetonAdmin({ token: jeton }, T0)).toBe(jeton);
    expect(base.lectures).toBe(0);
  });

  it("🔴 le callback `jwt` de src/auth.ts passe par `rafraichirJetonAdmin`", () => {
    const source = readFileSync(join(process.cwd(), "src", "auth.ts"), "utf8");
    const debut = source.indexOf("async jwt(");
    expect(debut).toBeGreaterThan(-1);
    const corps = source.slice(debut, source.indexOf("\n    },", debut));
    expect(corps).toMatch(/return rafraichirJetonAdmin\(\{ token, user \}\)/);
  });
});
