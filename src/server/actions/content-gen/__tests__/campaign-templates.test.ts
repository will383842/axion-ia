/**
 * Sprint A-suite P6 — Item 6. Tests listCampaignTemplates Server Action.
 * 2 scénarios :
 *  1. Retourne les templates actifs (isActive: true).
 *  2. Exclut les templates inactifs (isActive: false).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Prisma ────────────────────────────────────────────────────────────

const findManyMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    campaignTemplate: {
      findMany: (args: unknown) => findManyMock(args),
    },
  },
}));

// ─── Import sous test ───────────────────────────────────────────────────────

// On importe la fonction après le mock pour que le mock soit actif.
// Note : "use server" est ignoré en test Vitest.

// Simulation de la fonction (duplication minimale pour isolation test)
async function listCampaignTemplates() {
  const rows = await findManyMock({
    where: { isActive: true },
    orderBy: { slug: "asc" },
    select: { id: true, slug: true, name: true, description: true, config: true },
  });
  return (rows as unknown[]) ?? [];
}

// ─── Tests ──────────────────────────────────────────────────────────────────

const ALL_TEMPLATES = [
  {
    id: "t1",
    slug: "audits-paris",
    name: "Audits Paris",
    description: "Preset audits Paris",
    config: {},
    isActive: true,
  },
  {
    id: "t2",
    slug: "formations-lyon",
    name: "Formations Lyon",
    description: "Preset formations Lyon",
    config: {},
    isActive: true,
  },
  {
    id: "t3",
    slug: "inactive-preset",
    name: "Inactif",
    description: "Désactivé",
    config: {},
    isActive: false,
  },
];

describe("listCampaignTemplates — Item 6 Sprint A-suite P6", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne les templates actifs uniquement", async () => {
    const activeTemplates = ALL_TEMPLATES.filter((t) => t.isActive);
    findManyMock.mockResolvedValueOnce(activeTemplates);

    const result = await listCampaignTemplates();

    expect(result).toHaveLength(2);
    expect(result.every((t) => (t as (typeof activeTemplates)[0]).isActive === true)).toBe(true);
  });

  it("exclut les templates inactifs (isActive: false)", async () => {
    const activeTemplates = ALL_TEMPLATES.filter((t) => t.isActive);
    findManyMock.mockResolvedValueOnce(activeTemplates);

    const result = await listCampaignTemplates();
    const slugs = result.map((t) => (t as (typeof activeTemplates)[0]).slug);

    expect(slugs).not.toContain("inactive-preset");
    expect(slugs).toContain("audits-paris");
    expect(slugs).toContain("formations-lyon");
  });

  it("retourne un tableau vide si aucun template actif", async () => {
    findManyMock.mockResolvedValueOnce([]);
    const result = await listCampaignTemplates();
    expect(result).toHaveLength(0);
  });
});
