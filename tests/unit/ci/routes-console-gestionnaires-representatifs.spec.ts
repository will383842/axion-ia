/**
 * SEC-1b : test de route sur trois gestionnaires représentatifs (export d'argent,
 * fichier de personne, agenda). Hors proxy (`locale` = `videos`, `sitemap`, `api` ou `questionnaire`) :
 * 404, `auth()` jamais appelé, aucune lecture en base. Adresse normale : comportement d'avant.
 * Le préfixe d'administration est une valeur factice posée ici.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PREFIXE = "prefixe-factice-test";

const { authMock, prismaMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  prismaMock: new Proxy(
    {},
    {
      get: () => {
        throw new Error("lecture en base interdite hors console");
      },
    },
  ),
}));

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/journal/journaliser", () => ({ journaliser: vi.fn() }));
vi.mock("@/server/paiements-sortants/das2", () => ({ exportDas2Commune: vi.fn() }));
vi.mock("@/server/qualiopi/formateurs-independants/interrupteur-allume", () => ({
  interrupteurAllume: vi.fn(),
}));
vi.mock("@/server/careers/cv-storage", () => ({ readCv: vi.fn() }));
vi.mock("@/features/admin-planning/queries", () => ({ getPlanningRange: vi.fn() }));
vi.mock("@/server/qualiopi/trainers/trainers", () => ({ getTrainer: vi.fn() }));

import { GET as das2 } from "@/app/[locale]/(admin)/[adminPrefix]/paiements-sortants/das2/export/route";
import { GET as cv } from "@/app/[locale]/(admin)/[adminPrefix]/contacts/candidatures/[id]/cv/route";
import { GET as ics } from "@/app/[locale]/(admin)/[adminPrefix]/planning/ics/route";

const req = (url: string): never => new Request(url) as never;

const CAS: {
  nom: string;
  /** Statut exact sans session (adresse normale). */
  nominal: number;
  appel: (locale: string, prefixe: string) => Promise<Response>;
}[] = [
  {
    nom: "export d'argent (DAS2)",
    nominal: 401,
    appel: (locale, adminPrefix) =>
      das2(req("http://x/e?annee=2026"), { params: Promise.resolve({ locale, adminPrefix }) }),
  },
  {
    nom: "fichier de personne (CV)",
    nominal: 401,
    appel: (locale, adminPrefix) =>
      cv(req("http://x/e") as Request, {
        params: Promise.resolve({ locale, adminPrefix, id: "1" }),
      }) as Promise<Response>,
  },
  {
    nom: "agenda (planning/ics)",
    nominal: 307,
    appel: (locale, adminPrefix) =>
      ics(req("http://x/e?trainerId=t"), { params: Promise.resolve({ locale, adminPrefix }) }),
  },
];

describe("routes de la console : gestionnaires représentatifs", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.stubEnv("ADMIN_URL_PREFIX", PREFIXE);
    authMock.mockReset();
    authMock.mockResolvedValue(null);
  });

  const ENTETES = ["Cache-Control", "Content-Type", "X-Robots-Tag"];
  const empreinte = async (r: Response): Promise<unknown> => ({
    statut: r.status,
    corps: await r.text(),
    entetes: Object.fromEntries(ENTETES.map((h) => [h, r.headers.get(h)])),
  });

  for (const { nom, nominal, appel } of CAS) {
    describe(nom, () => {
      it.each(["videos", "sitemap", "api", "questionnaire"])(
        "locale %s → 404, auth jamais appelé",
        async (locale) => {
          const r = await appel(locale, PREFIXE);
          expect(r.status).toBe(404);
          expect(r.headers.get("Cache-Control")).toBe("private, no-store");
          expect(authMock).not.toHaveBeenCalled();
        },
      );

      it("mauvais préfixe → 404, auth jamais appelé", async () => {
        const r = await appel("fr", "autre");
        expect(r.status).toBe(404);
        expect(authMock).not.toHaveBeenCalled();
      });

      it("les trois refus sont IDENTIQUES (statut, corps, en-têtes)", async () => {
        const locale = await empreinte(await appel("questionnaire", PREFIXE));
        const mauvais = await empreinte(await appel("fr", "autre"));
        // Préfixe attendu absent en production : tout est refusé, même le « bon » segment.
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("ADMIN_URL_PREFIX", "");
        const absent = await empreinte(await appel("fr", PREFIXE));
        expect(locale).toEqual({
          statut: 404,
          corps: "not found",
          entetes: {
            "Cache-Control": "private, no-store",
            "Content-Type": "text/plain; charset=utf-8",
            "X-Robots-Tag": "noindex",
          },
        });
        expect(mauvais).toEqual(locale);
        expect(absent).toEqual(locale);
        expect(authMock).not.toHaveBeenCalled();
      });

      it(`adresse normale : la suite d'avant s'exécute (auth appelé), statut ${nominal}`, async () => {
        const r = await appel("fr", PREFIXE);
        expect(authMock).toHaveBeenCalledTimes(1);
        expect(r.status).toBe(nominal);
      });
    });
  }
});
