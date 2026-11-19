/**
 * Fiche publique de Manon (JSON-LD Person, byline) : plume IA déclarée, cible
 * « TPE et PME », et aucune promesse de relecture humaine systématique
 * (audit d'harmonie du 08/11/2026, lot R6).
 */
import { describe, expect, it, vi } from "vitest";
import { seedAuthorProfile } from "../../../../../prisma/seeds/content-gen/author-profile";

function prismaEspion() {
  const upsert = vi.fn(
    async (a: {
      create: { slug: string; aiGenerated: boolean };
    }): Promise<{ slug: string; aiGenerated: boolean }> => ({
      slug: a.create.slug,
      aiGenerated: a.create.aiGenerated,
    }),
  );
  return { upsert, prisma: { authorProfile: { upsert } } };
}

describe("seedAuthorProfile : fiche de Manon", () => {
  it("déclare une plume IA et cible TPE et PME", async () => {
    const { upsert, prisma } = prismaEspion();
    await seedAuthorProfile(prisma as never);
    const arg = upsert.mock.calls[0]![0] as unknown as {
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    };
    expect(arg.create["jobTitle"]).toBe("Plume IA d'Axion-IA");
    expect(arg.update["jobTitle"]).toBe("Plume IA d'Axion-IA");
    const texte = JSON.stringify(arg.create);
    expect(texte).not.toMatch(/Plume éditoriale/);
    expect(texte).not.toMatch(/ETI/);
    expect(texte).toContain("TPE et PME");
  });

  it("ne promet pas une relecture humaine avant publication", async () => {
    const { upsert, prisma } = prismaEspion();
    await seedAuthorProfile(prisma as never);
    const create = (upsert.mock.calls[0]![0] as unknown as { create: Record<string, string> })
      .create;
    for (const champ of ["bioMd", "personaDisclaimer"] as const) {
      const t = create[champ] as string;
      expect(t).not.toMatch(/validés? par (?:notre )?relecture humaine avant publication/i);
      expect(t).toMatch(/contrôles automatiques bloquants/);
      expect(t).toMatch(/relecture humaine en cas d'alerte/);
      expect(t).toMatch(/signalement/);
    }
  });
});
