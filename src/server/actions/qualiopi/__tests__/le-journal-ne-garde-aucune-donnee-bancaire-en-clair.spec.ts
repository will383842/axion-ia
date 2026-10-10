/**
 * Lot S4 — le journal Qualiopi ne conserve aucune donnée bancaire ni
 * personnelle en clair (`donneesJournalQualiopi`, partagé par
 * `logQualiopiActivity` et les traces transactionnelles).
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { activityLog: { create: vi.fn() } },
}));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: () => null })),
}));
vi.mock("@/server/actions/knowledge/_guards", () => ({
  requireAdminRead: vi.fn(),
  requireAdminWrite: vi.fn(),
  requireHabilitation: vi.fn(),
  requireAdminPublish: vi.fn(),
  requireAdminDelete: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { donneesJournalQualiopi, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";

const create = (prisma as unknown as { activityLog: { create: ReturnType<typeof vi.fn> } })
  .activityLog.create;
const SESSION = { userId: "admin-uuid-1", role: "admin" as const };
const IBAN = "FR7630006000011234567890189";

function changesEcrits(): Record<string, unknown> {
  const appel = create.mock.calls[0]?.[0] as { data: { changes: Record<string, unknown> } };
  return appel.data.changes;
}

beforeEach(() => {
  vi.clearAllMocks();
  create.mockResolvedValue({});
});

describe("journal Qualiopi — données bancaires", () => {
  it("🔴 `changes.iban` est stocké masqué, avec ses quatre derniers caractères", async () => {
    await logQualiopiActivity({
      action: "qualiopi.test",
      changes: { iban: IBAN },
      session: SESSION,
    });
    const changes = changesEcrits();
    expect((changes["iban"] as { masque: boolean }).masque).toBe(true);
    expect(changes["iban"]).toEqual({ masque: true, fin4: "0189" });
    expect(JSON.stringify(changes)).not.toContain("30006000011234567890");
  });

  it("à n'importe quelle profondeur, et pour BIC / RIB", async () => {
    const data = await donneesJournalQualiopi({
      action: "qualiopi.test",
      changes: {
        avant: { coordonnees: { ibanFormateur: IBAN, codeBic: "AGRIFRPP882" } },
        lignes: [{ rib_url: "https://exemple.invalid/rib.pdf" }],
      },
      session: SESSION,
    });
    const texte = JSON.stringify(data.changes);
    expect(texte).not.toContain(IBAN);
    expect(texte).not.toContain("AGRIFRPP");
    expect(texte).not.toContain("rib.pdf");
    expect(texte).toContain('"fin4":"P882"');
  });

  it("un IBAN rangé sous une clé neutre est masqué quand même", async () => {
    const data = await donneesJournalQualiopi({
      action: "qualiopi.test",
      changes: { note: `virement sur FR76 3000 6000 0112 3456 7890 189 confirmé` },
      session: SESSION,
    });
    expect(JSON.stringify(data.changes)).not.toContain("3000 6000");
  });

  it("une clé qui CONTIENT « rib » sans en être un mot reste lisible", async () => {
    const data = await donneesJournalQualiopi({
      action: "qualiopi.test",
      changes: { attribut: "x", distribution: "y" },
      session: SESSION,
    });
    expect(data.changes).toEqual({ attribut: "x", distribution: "y" });
  });
});

describe("journal Qualiopi — données personnelles", () => {
  it("e-mail, téléphone et adresse sont masqués ; booléens et empreintes restent", async () => {
    const data = await donneesJournalQualiopi({
      action: "qualiopi.test",
      changes: {
        email: "simone@exemple.fr",
        telephone: "06 12 34 56 78",
        adresse: "12 rue des Lilas",
        contact: { codePostal: "69001", "e-mail": "x@exemple.fr" },
        emailEnvoye: true,
        emailHash: "a".repeat(64),
        numero: "LM-2026-0001",
      },
      session: SESSION,
    });
    const c = data.changes as unknown as Record<string, unknown>;
    expect(c["email"]).toEqual({ masque: true });
    expect(c["telephone"]).toEqual({ masque: true });
    expect(c["adresse"]).toEqual({ masque: true });
    expect(c["contact"]).toEqual({ codePostal: { masque: true }, "e-mail": { masque: true } });
    expect(c["emailEnvoye"]).toBe(true);
    expect(c["emailHash"]).toBe("a".repeat(64));
    expect(c["numero"]).toBe("LM-2026-0001");
  });

  it("ne modifie jamais l'objet reçu par l'appelant", async () => {
    const changes = { iban: IBAN };
    await donneesJournalQualiopi({ action: "qualiopi.test", changes, session: SESSION });
    expect(changes.iban).toBe(IBAN);
  });
});

describe("garde statique — aucun littéral `changes:` ne porte d'IBAN", () => {
  const RACINE = join(process.cwd(), "src");

  function fichiers(dossier: string): string[] {
    const sortie: string[] = [];
    for (const nom of readdirSync(dossier)) {
      const chemin = join(dossier, nom);
      if (statSync(chemin).isDirectory()) {
        if (nom === "node_modules" || nom === "generated") continue;
        sortie.push(...fichiers(chemin));
      } else if (/\.(ts|tsx)$/.test(nom) && !/\.(spec|test)\.tsx?$/.test(nom)) {
        sortie.push(chemin);
      }
    }
    return sortie;
  }

  it("aucun `changes: { … iban … }` sous src/**", () => {
    const fautifs: string[] = [];
    for (const f of fichiers(RACINE)) {
      const source = readFileSync(f, "utf-8");
      for (const m of source.matchAll(/changes\s*:\s*\{[^}]*\biban/gi)) {
        fautifs.push(`${relative(process.cwd(), f)} @ ${m.index}`);
      }
    }
    expect(fautifs).toEqual([]);
  });
});
