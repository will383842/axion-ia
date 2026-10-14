/**
 * `/api/markdown/blog/<slug>` — même réécriture Qualiopi que la page publique
 * (audit initial du 16/10/2026, certification non obtenue). Relecture de la
 * PR n° 1524 : la version markdown de Nanterre servait encore « Axion-IA n'est
 * pas certifié Qualiopi ».
 */

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/seo", () => ({
  SITE_URL: "https://axion-ia.com",
  SITE_EDITORIAL_DATE: "2026-06-08T00:00:00.000Z",
}));

const CORPS =
  "Axion-IA n'est pas certifié Qualiopi, ce qui exclut la prise en charge directe par les OPCO ou le CPF pour nos programmes.\n\n" +
  '<td>Certification Qualiopi</td>\n<td>Vérifier sur <a href="/tarifs">page Tarifs</a></td>';

vi.mock("@/lib/prisma", () => ({
  prisma: {
    articleTranslation: {
      findFirst: async () => ({
        title: "Alternatives formation IA Nanterre",
        excerpt: null,
        body: CORPS,
        bodyText: null,
        updatedAt: new Date("2026-10-01T00:00:00Z"),
        article: {},
      }),
    },
  },
}));

import { GET } from "./route";

async function markdown(): Promise<string> {
  const slug = "alternatives-formation-ia-nanterre";
  const res = await GET(new Request(`https://axion-ia.com/api/markdown/blog/${slug}`) as never, {
    params: Promise.resolve({ type: "blog", slug }),
  });
  expect(res.status).toBe(200);
  return res.text();
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("markdown d'article — certification Qualiopi", () => {
  it("interrupteur éteint : ni négation datée, ni renvoi « page Tarifs » pour Axion-IA", async () => {
    vi.stubEnv("QUALIOPI_CERTIFICATION_OBTENUE", "false");
    const md = await markdown();
    expect(md).not.toMatch(/n'est pas certifié Qualiopi/);
    expect(md).not.toMatch(/page Tarifs/);
    expect(md).toContain("En cours");
  });

  it("interrupteur allumé : l'affirmation d'origine revient, la négation reste neutre", async () => {
    vi.stubEnv("QUALIOPI_CERTIFICATION_OBTENUE", "true");
    const md = await markdown();
    expect(md).toContain("page Tarifs");
    expect(md).not.toMatch(/n'est pas certifié Qualiopi/);
  });
});
