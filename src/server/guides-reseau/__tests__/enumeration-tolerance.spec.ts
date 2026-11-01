// @vitest-environment node
//
// Lot PV-1 — fenêtre app/worker (AGENTS.md, « DEUX conteneurs »). La migration de
// l'énumération (`message_prive`) est séparée du code qui l'écrit ; les lecteurs doivent
// tenir avec la valeur ET sans (worker plus récent que la base, ou l'inverse).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { guideRequest: { findMany: (...a: unknown[]) => findMany(...a) } },
}));
vi.mock("@/server/guide-ia/coupe-circuit", () => ({ coupeCircuitDeclenche: async () => false }));
vi.mock("@/server/guide-ia/envoi", () => ({
  envoisDeLaDerniereHeure: async () => 0,
  mettreEnFileGuide: async () => "en-file",
}));

import { rattraperGuides } from "@/server/guide-ia/rattrapage";
import { refusConsole } from "@/server/guide-ia/refus-console";

beforeEach(() => findMany.mockReset().mockResolvedValue([]));

describe("le rattrapage traite message_prive comme formulaire", () => {
  it("filtre « tout sauf admin » : la requête ne cite JAMAIS la valeur nouvelle", async () => {
    await rattraperGuides(new Date("2026-11-20T10:00:00Z"));
    const where = (findMany.mock.calls[0]![0] as { where: Record<string, unknown> }).where;
    expect(where["origine"]).toEqual({ not: "admin" });
    expect(JSON.stringify(where)).not.toContain("message_prive");
  });
});

describe("la console tient avec la valeur", () => {
  const etat = { statut: "unsubscribed", opposee: true, rebondDur: false } as const;
  it("message_prive = demandé par la personne : renvoi permis (comme formulaire)", () => {
    expect(refusConsole(etat, "message_prive")).toBeNull();
    expect(refusConsole(etat, "formulaire")).toBeNull();
    expect(refusConsole(etat, "admin")).toBe("adresse-opposee");
  });
  it("un rebond dur arrête tout, même pour message_prive", () => {
    expect(refusConsole({ ...etat, rebondDur: true }, "message_prive")).toBe("adresse-rejetee");
  });
});

describe("migrations : strictement additives", () => {
  const dossier = join(process.cwd(), "prisma/migrations");
  const miennes = readdirSync(dossier).filter((d) => /^202611010901?00_|^20261101090000_/.test(d));
  it("l'énumération et le journal sont deux migrations séparées", () => {
    expect(miennes.some((d) => d.includes("message_prive"))).toBe(true);
    expect(miennes.some((d) => d.includes("guide_reseau_receptions"))).toBe(true);
  });
  it.each(miennes)(
    "%s : ni DROP (hors commentaire), ni renommage, ni NOT NULL sans défaut sur l'existant",
    (d) => {
      const sql = readFileSync(join(dossier, d, "migration.sql"), "utf8")
        .split("\n")
        .filter((l) => !l.trim().startsWith("--"))
        .join("\n");
      expect(sql).not.toMatch(/\bDROP\b/i);
      expect(sql).not.toMatch(/\bRENAME\b/i);
      expect(sql).not.toMatch(/\bALTER TABLE\b/i);
    },
  );
});
