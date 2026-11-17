/**
 * SEC-1b : test de route sur trois gestionnaires représentatifs (export d'argent,
 * fichier de personne, agenda). Hors proxy (`locale` = `videos` ou `sitemap`) :
 * 404, `auth()` jamais appelé, aucune lecture en base. Adresse normale : comportement d'avant.
 * Le préfixe d'administration est une valeur factice posée ici.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const CAS: { nom: string; appel: (locale: string, prefixe: string) => Promise<Response> }[] = [
  {
    nom: "export d'argent (DAS2)",
    appel: (locale, adminPrefix) =>
      das2(req("http://x/e?annee=2026"), { params: Promise.resolve({ locale, adminPrefix }) }),
  },
  {
    nom: "fichier de personne (CV)",
    appel: (locale, adminPrefix) =>
      cv(req("http://x/e") as Request, {
        params: Promise.resolve({ locale, adminPrefix, id: "1" }),
      }) as Promise<Response>,
  },
  {
    nom: "agenda (planning/ics)",
    appel: (locale, adminPrefix) =>
      ics(req("http://x/e?trainerId=t"), { params: Promise.resolve({ locale, adminPrefix }) }),
  },
];

describe("routes de la console : gestionnaires représentatifs", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_URL_PREFIX", PREFIXE);
    authMock.mockReset();
    authMock.mockResolvedValue(null);
  });

  for (const { nom, appel } of CAS) {
    describe(nom, () => {
      it.each(["videos", "sitemap"])("locale %s → 404, auth jamais appelé", async (locale) => {
        const r = await appel(locale, PREFIXE);
        expect(r.status).toBe(404);
        expect(r.headers.get("Cache-Control")).toBe("private, no-store");
        expect(authMock).not.toHaveBeenCalled();
      });

      it("mauvais préfixe → 404, auth jamais appelé", async () => {
        const r = await appel("fr", "autre");
        expect(r.status).toBe(404);
        expect(authMock).not.toHaveBeenCalled();
      });

      it("adresse normale : la suite d'avant s'exécute (auth appelé)", async () => {
        const r = await appel("fr", PREFIXE);
        expect(authMock).toHaveBeenCalledTimes(1);
        // Sans session : 401 pour les deux téléchargements, redirection vers la connexion pour l'agenda.
        expect([302, 307, 401]).toContain(r.status);
      });
    });
  }
});
