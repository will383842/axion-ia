import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    authorProfile: {
      findUnique: vi.fn(async ({ where }: { where: { slug: string } }) => ({
        slug: where.slug,
        isActive: true,
        displayName: "Manon",
        jobTitle: "Rédactrice",
        personaDisclaimer: null,
      })),
    },
  },
}));

vi.mock("next-intl", () => ({
  hasLocale: (locales: readonly string[], l: string) => locales.includes(l),
}));
vi.mock("next-intl/server", () => ({ setRequestLocale: () => undefined }));
vi.mock("@/components/equipe/ProfilCollaborateur", () => ({ ProfilCollaborateur: () => null }));
vi.mock("@/components/marketing/JsonLd", () => ({ JsonLd: () => null }));
vi.mock("@/components/marketing/JsonLdGraph", () => ({ JsonLdGraph: () => null }));
vi.mock("@/components/nav/Breadcrumbs", () => ({ Breadcrumbs: () => null }));
vi.mock("@/i18n/routing", () => ({
  routing: { locales: ["fr", "en"], pathnames: {} },
}));

import { generateMetadata } from "../page";

const params = (slug: string) => ({ params: Promise.resolve({ locale: "fr", slug }) });
const urlsOg = (m: Awaited<ReturnType<typeof generateMetadata>>) =>
  JSON.stringify(m.openGraph?.images ?? []);

describe("image de partage des fiches équipe", () => {
  it("le portrait ne s'applique qu'au slug williams", async () => {
    const m = await generateMetadata(params("williams"));
    expect(urlsOg(m)).toContain("/api/og/equipe-williams");
    expect(JSON.stringify(m.twitter?.images ?? [])).toContain("/api/og/equipe-williams");
  });

  it("manon garde l'image de partage générique", async () => {
    const m = await generateMetadata(params("manon"));
    expect(urlsOg(m)).not.toContain("equipe-williams");
    expect(urlsOg(m)).toContain("/api/og");
  });

  it("aucun fichier opengraph-image dans le segment [slug] (il s'appliquerait à tous les slugs)", () => {
    const segment = join(process.cwd(), "src/app/[locale]/equipe/[slug]");
    expect(existsSync(join(segment, "opengraph-image.tsx"))).toBe(false);
  });

  it("le fil d'Ariane vise une route existante : /equipe (page + routing)", async () => {
    const source = readFileSync(join(process.cwd(), "src/i18n/routing.ts"), "utf8");
    expect(source).toMatch(/"\/equipe": \{ fr: "\/equipe"/);
    expect(existsSync(join(process.cwd(), "src/app/[locale]/equipe/page.tsx"))).toBe(true);
  });
});
