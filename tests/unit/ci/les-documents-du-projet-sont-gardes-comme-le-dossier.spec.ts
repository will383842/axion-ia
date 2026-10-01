/**
 * R7 — LES DOCUMENTS DU PROJET SONT GARDÉS COMME LE DOSSIER CLIENT (ADR 0063, D6).
 *
 * Une action serveur s'appelle directement (`Next-Action`), sans passer par la
 * page : masquer un bouton n'est pas interdire. Chaque action exportée et la
 * route de téléchargement appellent donc `exigerAccesEchanges` (décision A2)
 * en PREMIÈRE instruction — avant Zod, avant la base. Aucune liste de rôles
 * n'est recopiée : la liste vit dans `roles-echanges.ts`.
 *
 * Le refus réel (rôle hors A2 → refusé) est prouvé à l'exécution dans
 * `le-telechargement-ne-montre-jamais-rien.spec.ts` (route) et ici (actions).
 *
 * Contre-témoin : le détecteur rougit sur une action fabriquée qui lit d'abord
 * le formulaire.
 */

import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ACTIONS = "src/features/dossier-client/documents/actions.ts";
const ROUTE =
  "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/clients/[id]/projets/[projetId]/documents/[documentId]/route.ts";

function sansCommentaires(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, ""))
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

/** Les fonctions exportées dont la première instruction n'est pas la garde. */
function sansGardeEnTete(source: string): string[] {
  const code = sansCommentaires(source);
  const fautives: string[] = [];
  const re = /export async function (\w+)\s*\([^)]*\)[^{]*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    const suite = code.slice(m.index + m[0].length).trimStart();
    const premiere = suite.slice(0, suite.indexOf(";") + 1);
    if (!/exigerAccesEchanges\(/.test(premiere)) fautives.push(m[1]!);
  }
  return fautives;
}

const etat = vi.hoisted(() => ({ session: null as unknown, lu: 0 }));
vi.mock("@/auth", () => ({ auth: async () => etat.session }));
vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy(
    {},
    {
      get() {
        etat.lu += 1;
        throw new Error("la base ne doit pas être lue avant la garde");
      },
    },
  ),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
vi.mock("@/server/careers/clamav", () => ({ analyserOctets: async () => ({ issue: "sain" }) }));

describe("les documents du projet sont gardés comme le dossier", () => {
  beforeEach(() => {
    etat.lu = 0;
  });

  it("chaque action exportée et la route admin commencent par exigerAccesEchanges", () => {
    for (const f of [ACTIONS, ROUTE]) {
      const source = readFileSync(f, "utf8");
      expect(source, f).toMatch(/export async function \w+/);
      expect(sansGardeEnTete(source), f).toEqual([]);
    }
  });

  it("aucune liste de rôles n'est recopiée dans le module", () => {
    for (const f of [ACTIONS, ROUTE]) {
      const code = sansCommentaires(readFileSync(f, "utf8"));
      expect(code, f).not.toMatch(/["'](admin|super_admin|direction|reader|editor)["']/);
      expect(code, f).not.toMatch(/ROLES_DOSSIER_ECHANGES/);
    }
  });

  it("un rôle hors de la liste A2 est refusé par chaque action, sans lire la base", async () => {
    const actions = await import("@/features/dossier-client/documents/actions");
    etat.session = { user: { id: "33333333-3333-4333-8333-333333333333", role: "reader" } };
    const fd = new FormData();
    fd.set("clientId", "11111111-1111-4111-8111-111111111111");
    fd.set("projetId", "22222222-2222-4222-8222-222222222222");
    fd.set("id", "44444444-4444-4444-8444-444444444444");
    for (const [nom, action] of Object.entries(actions)) {
      await expect((action as (f: FormData) => Promise<void>)(fd), nom).rejects.toThrow(
        /réservés à Williams et aux administrateurs/,
      );
    }
    expect(Object.keys(actions).length).toBeGreaterThanOrEqual(3);
    expect(etat.lu).toBe(0);
    // Charger `actions.ts` (Sentry, Prisma, ClamAV…) dépasse les 5 s par défaut sur
    // un runner de CI : sans ce délai, le test expirait AVANT de prouver le refus.
  }, 30_000);

  it("contre-témoin : le détecteur voit une action qui lit d'abord le formulaire", () => {
    const fautive = `export async function x(formData: FormData): Promise<void> {
      const id = String(formData.get("id"));
      await exigerAccesEchanges();
    }`;
    expect(sansGardeEnTete(fautive)).toEqual(["x"]);
  });
});
