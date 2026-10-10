/**
 * Lot FAC-8 — `_guards` délègue au journal unique (`@/server/journal/journaliser`).
 *
 * `donneesJournalQualiopi` applique le filtre étendu (à toute profondeur),
 * `logQualiopiActivity` délègue à `journaliser` avec sa tolérance inchangée, et
 * tout `changes:` écrit par le module de journal ou par `_guards` passe par
 * `filtrerChangesJournal`.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { globalCreate } = vi.hoisted(() => ({ globalCreate: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { activityLog: { create: globalCreate } },
}));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: () => null })),
}));
vi.mock("@/server/actions/knowledge/_guards", () => ({
  requireAdminRead: vi.fn(),
  requireAdminWrite: vi.fn(),
  requireAdminPublish: vi.fn(),
  requireAdminDelete: vi.fn(),
  requireSuperAdmin: vi.fn(),
}));

import { donneesJournalQualiopi, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";

const SESSION = { userId: "admin-uuid-1", role: "admin" as const };
const NDA = "11755555555";

beforeEach(() => {
  vi.clearAllMocks();
  globalCreate.mockResolvedValue({});
});

describe("donneesJournalQualiopi — filtre étendu", () => {
  it("🔴 `donneesJournalQualiopi` applique le filtre étendu", async () => {
    const data = await donneesJournalQualiopi({
      action: "qualiopi.test",
      changes: { formateurs: [{ numeroDeclarationActivite: NDA }] },
      session: SESSION,
    });
    expect(data.changes).toEqual({
      formateurs: [{ numeroDeclarationActivite: { modifie: true } }],
    });
  });
});

describe("logQualiopiActivity — délègue à journaliser, tolérance inchangée", () => {
  it("🔴 le filtre étendu s'applique aussi par cette porte", async () => {
    await logQualiopiActivity({ action: "qualiopi.test", changes: { nda: NDA }, session: SESSION });
    const data = (globalCreate.mock.calls[0]![0] as { data: { changes: unknown } }).data;
    expect(data.changes).toEqual({ nda: { modifie: true } });
  });

  it("un échec d'écriture reste muet", async () => {
    globalCreate.mockRejectedValueOnce(new Error("base indisponible"));
    await expect(
      logQualiopiActivity({ action: "qualiopi.test", session: SESSION }),
    ).resolves.toBeUndefined();
  });
});

describe("garde statique — tout `changes:` du journal passe par le filtre", () => {
  const RACINE = process.cwd();
  const GUARDS = "src/server/actions/qualiopi/_guards.ts";

  function fichiers(dossier: string): string[] {
    const sortie: string[] = [];
    let noms: string[] = [];
    try {
      noms = readdirSync(dossier);
    } catch {
      return sortie;
    }
    for (const nom of noms) {
      const chemin = join(dossier, nom);
      if (statSync(chemin).isDirectory()) {
        if (nom === "__tests__") continue;
        sortie.push(...fichiers(chemin));
      } else if (/\.tsx?$/.test(nom) && !/\.(spec|test)\.tsx?$/.test(nom)) {
        sortie.push(relative(RACINE, chemin).split("\\").join("/"));
      }
    }
    return sortie;
  }

  function sansCommentaires(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
  }

  it("🔴 dans le module de journal et `_guards`, chaque `changes:` écrit est `filtrerChangesJournal(…)`", () => {
    const cibles = [...fichiers(join(RACINE, "src/server/journal")), GUARDS];
    const fautifs: string[] = [];
    let vus = 0;
    for (const f of cibles) {
      const code = sansCommentaires(readFileSync(join(RACINE, f), "utf-8"));
      for (const m of code.matchAll(/\bchanges\s*:\s*([^,\n}]+)/g)) {
        // Les déclarations de type (`changes?: unknown`, `changes: never`) ne sont pas des écritures.
        if (/^\s*(unknown|never|Prisma\.)/.test(m[1]!)) continue;
        vus += 1;
        if (!/^\s*filtrerChangesJournal\(/.test(m[1]!)) {
          fautifs.push(`${f} : changes: ${m[1]!.trim()}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
    expect(vus).toBeGreaterThan(0);
  });

  it("🔴 `logQualiopiActivity` délègue à `journaliser` et n'écrit plus lui-même", () => {
    const code = sansCommentaires(readFileSync(join(RACINE, GUARDS), "utf-8"));
    const corps = code.slice(code.indexOf("export async function logQualiopiActivity"));
    expect(corps).toMatch(/\bjournaliser\s*\(\s*prisma\s*,/);
    expect(corps).not.toMatch(/activityLog\.create/);
  });
});
