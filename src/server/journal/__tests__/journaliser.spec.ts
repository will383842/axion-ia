/**
 * Lot FAC-8 — journal unique.
 *
 * `journaliser(tx, entree, options?)` écrit l'entrée de journal DANS la
 * transaction que l'appelant lui passe, après filtrage des `changes:` à toute
 * profondeur. `exiger: true` lève si l'écriture échoue (activation, argent) ;
 * sans l'option, la tolérance de `logQualiopiActivity` est conservée.
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

import { headers } from "next/headers";
import { filtrerChangesJournal, journaliser } from "@/server/journal/journaliser";
import { donneesJournalQualiopi, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";

const SESSION = { userId: "admin-uuid-1", role: "admin" as const };
const NDA = "11755555555";
const PIECE = "X4RTBPFW4";

function txFactice() {
  const create = vi.fn().mockResolvedValue({});
  return { tx: { activityLog: { create } }, create };
}

beforeEach(() => {
  vi.clearAllMocks();
  globalCreate.mockResolvedValue({});
});

describe("filtre du journal — à toute profondeur", () => {
  it("🔴 numéro de pièce et numéro de déclaration d'activité deviennent `{ modifie: true }`", () => {
    const sortie = filtrerChangesJournal({
      numeroPiece: PIECE,
      numeroDeclarationActivite: NDA,
      nda: NDA,
      avant: { formateur: { numeroPieceIdentite: PIECE, ndaNumero: NDA } },
      lignes: [[{ passeport: PIECE }], { declarationActivite: { numero: NDA } }],
    }) as Record<string, unknown>;
    expect(sortie["numeroPiece"]).toEqual({ modifie: true });
    expect(sortie["numeroDeclarationActivite"]).toEqual({ modifie: true });
    expect(sortie["nda"]).toEqual({ modifie: true });
    expect(sortie["avant"]).toEqual({
      formateur: { numeroPieceIdentite: { modifie: true }, ndaNumero: { modifie: true } },
    });
    expect(sortie["lignes"]).toEqual([
      [{ passeport: { modifie: true } }],
      { declarationActivite: { modifie: true } },
    ]);
    const texte = JSON.stringify(sortie);
    expect(texte).not.toContain(NDA);
    expect(texte).not.toContain(PIECE);
  });

  it("IBAN, BIC, RIB, e-mail, téléphone et adresse restent masqués dans les tableaux imbriqués", () => {
    const sortie = filtrerChangesJournal({
      lots: [{ contacts: [{ email: "x@exemple.invalid", tel: "0600000000" }] }],
      paiement: [{ coordonnees: { iban: "FR7630006000011234567890189", bic: "AGRIFRPP882" } }],
      envoi: { adresseLivraison: "1 rue de l'Exemple", rib: "rib.pdf" },
    });
    const texte = JSON.stringify(sortie);
    for (const clair of [
      "x@exemple.invalid",
      "0600000000",
      "30006000011234567890",
      "AGRIFRPP",
      "rue de",
      "rib.pdf",
    ]) {
      expect(texte).not.toContain(clair);
    }
  });

  it("les clés voisines qui ne sont pas sensibles restent lisibles", () => {
    const entree = {
      numero: "LM-2026-0001",
      pieceId: "p-1",
      pieces: ["convention"],
      agenda: "mardi",
      declarationEnvoyee: true,
      numeroPieceVerifie: true,
    };
    expect(filtrerChangesJournal(entree)).toEqual(entree);
  });

  it("ne modifie jamais l'objet reçu", () => {
    const changes = { formateur: { nda: NDA } };
    filtrerChangesJournal(changes);
    expect(changes.formateur.nda).toBe(NDA);
  });

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

describe("journaliser — écrit dans la transaction passée", () => {
  it("🔴 l'entrée est écrite par `tx`, jamais par le client global", async () => {
    const { tx, create } = txFactice();
    const ecrit = await journaliser(tx, {
      action: "qualiopi.trainer.activation",
      targetType: "Trainer",
      targetId: "t-1",
      changes: { nda: NDA },
      session: SESSION,
    });
    expect(ecrit).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
    expect(globalCreate).not.toHaveBeenCalled();
    const data = (create.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(data).toMatchObject({
      adminUserId: "admin-uuid-1",
      action: "qualiopi.trainer.activation",
      targetType: "Trainer",
      targetId: "t-1",
      changes: { nda: { modifie: true } },
    });
  });

  it("sans session (acte du système), l'entrée est imputée à personne", async () => {
    const { tx, create } = txFactice();
    await journaliser(tx, { action: "qualiopi.systeme", session: null });
    expect(
      (create.mock.calls[0]![0] as { data: { adminUserId: unknown } }).data.adminUserId,
    ).toBeNull();
  });
});

describe("journaliser — option `exiger`", () => {
  it("🔴 `exiger: true` : un échec d'écriture est levé", async () => {
    const { tx, create } = txFactice();
    create.mockRejectedValueOnce(new Error("base indisponible"));
    await expect(
      journaliser(tx, { action: "qualiopi.test", session: SESSION }, { exiger: true }),
    ).rejects.toThrow("base indisponible");
  });

  it("`exiger: true` : un échec de lecture du contexte est levé aussi", async () => {
    const { tx } = txFactice();
    vi.mocked(headers).mockRejectedValueOnce(new Error("hors requête"));
    await expect(
      journaliser(tx, { action: "qualiopi.test", session: SESSION }, { exiger: true }),
    ).rejects.toThrow("hors requête");
  });

  it("sans l'option : l'échec est toléré, la fonction rend `false`", async () => {
    const { tx, create } = txFactice();
    create.mockRejectedValueOnce(new Error("base indisponible"));
    await expect(journaliser(tx, { action: "qualiopi.test", session: SESSION })).resolves.toBe(
      false,
    );
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

  it("🔴 le module de journal n'importe pas le client global : il écrit dans `tx`", () => {
    const source = readFileSync(join(RACINE, "src/server/journal/journaliser.ts"), "utf-8");
    expect(source).not.toMatch(/from\s+["']@\/lib\/prisma["']/);
  });
});
