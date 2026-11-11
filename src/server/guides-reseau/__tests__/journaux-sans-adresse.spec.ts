// @vitest-environment node
//
// Fiche SITE-PETITS — les deux journaux « guides_reseau_demande » (adresse opposée, demande
// traitée) ne portent AUCUNE partie de l'adresse : ni initiale, ni domaine. Seule une
// empreinte courte non réversible (début de l'empreinte de recherche) identifie la ligne.
import { describe, it, expect, vi, beforeEach } from "vitest";

type Ligne = Record<string, unknown>;
const bd = vi.hoisted(() => ({
  demandes: [] as Ligne[],
  preuves: [] as Ligne[],
  envois: [] as unknown[][],
  limites: [] as unknown[][],
  n: 0,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    guideRequest: {
      findUnique: async ({ where }: { where: Ligne }) => {
        const c = where["emailKey_aimant"] as Ligne;
        return bd.demandes.find((d) => d.emailKey === c.emailKey && d.aimant === c.aimant) ?? null;
      },
      create: async ({ data }: { data: Ligne }) => {
        const l = { id: `d${++bd.n}`, ...data };
        bd.demandes.push(l);
        return l;
      },
      update: async ({ where, data }: { where: Ligne; data: Ligne }) => {
        const l = bd.demandes.find((d) => d.id === where["id"])!;
        Object.assign(l, data);
        return l;
      },
    },
    emailLog: { count: async () => 0 },
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: async (...a: unknown[]) => {
    bd.limites.push(a);
    return { allowed: true };
  },
}));
vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string) => `h:${e.trim().toLowerCase()}`,
}));
vi.mock("@/lib/consents", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  recordConsentEvent: async (i: Ligne) => {
    bd.preuves.push(i);
    return true;
  },
}));
const etat = vi.hoisted(() => ({ opposee: false }));
vi.mock("@/server/email/opposition", () => ({ estOpposee: async () => etat.opposee }));
vi.mock("@/server/guide-ia/mx", () => ({ domaineRecoitDesEmails: async () => "oui" }));
vi.mock("@/server/guide-ia/coupe-circuit", () => ({ coupeCircuitDeclenche: async () => false }));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: async (...a: unknown[]) => {
    bd.envois.push(a);
    return { enqueued: true };
  },
}));
vi.mock("@/server/guides-reseau/origines", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  enregistrerOrigine: async () => ({ creee: true, archivees: 0 }),
}));
vi.mock("@/server/guides-reseau/synchro-v3", () => ({
  transmettreOriginesV3: async () => undefined,
}));

import * as traitement from "../traitement";

const D = {
  schemaVersion: 1,
  email: "Personne.Exemple@example.test",
  mot: "GUIDE",
  reseau: "instagram",
  guide: "guide-ia",
  versionTexteM1: "m1-2026-11",
  locale: "fr",
} as unknown as Parameters<typeof traitement.traiterDemande>[0];

function journaux(): string[] {
  return vi.mocked(console.warn).mock.calls.map((a) => String(a[0]));
}

beforeEach(() => {
  bd.demandes.length = bd.preuves.length = bd.envois.length = bd.limites.length = 0;
  bd.n = 0;
  etat.opposee = false;
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("journaux guides_reseau_demande — aucune partie de l'adresse", () => {
  it.each([
    ["demande traitée", false],
    ["adresse opposée", true],
  ])("%s : ni initiale, ni domaine, une empreinte courte", async (_nom, opposee) => {
    etat.opposee = opposee;
    await traitement.traiterDemande(D, new Date("2026-11-08T10:00:00.000Z"));
    const lignes = journaux().filter((l) => l.includes("guides_reseau_demande"));
    expect(lignes).toHaveLength(1);
    const brut = lignes[0]!.toLowerCase();
    expect(brut).not.toContain("example.test");
    expect(brut).not.toContain("p****");
    expect(brut).not.toContain("personne");
    const j = JSON.parse(lignes[0]!) as Record<string, unknown>;
    expect(j["adresse"]).toBeUndefined();
    expect(j["adresse_empreinte"]).toMatch(/^[0-9a-z:]{1,12}$/i);
    expect(String(j["adresse_empreinte"]).length).toBeLessThanOrEqual(12);
  });
});
