// Longueurs des métadonnées des trois pages apporteurs indexables, montant masqué ET publié.
// Titre ≤ 60 caractères, description ≤ 158 : au-delà, les moteurs tronquent l'extrait.
import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({ publie: false }));

vi.mock("@/content/recrutement/commission-publique", () => ({
  get COMMISSIONS_PUBLIQUES_AFFICHEES() {
    return etat.publie;
  },
}));
vi.mock("@/server/qualiopi/config/flag", () => ({
  isQualiopiCertificationObtenue: () => false,
}));
vi.mock("next-intl/server", () => ({ setRequestLocale: () => undefined }));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: () => undefined }),
  Link: () => null,
}));
vi.mock("@/components/forms/commercial-application/CommercialApplicationWizard", () => ({
  CommercialApplicationWizard: () => null,
}));
vi.mock("@/lib/seo", async (importOriginal) => ({
  // Les constantes (SITE_URL, BRAND_LOGO…) viennent du vrai module : `job-posting` les lit à l'import.
  ...(await importOriginal<typeof import("@/lib/seo")>()),
  buildProductMetadata: async (o: { title: string; description: string }) => ({
    title: o.title,
    description: o.description,
  }),
}));

const TITRE_MAX = 60;
const DESCRIPTION_MAX = 158;

const PAGES = [
  ["hub", () => import("@/app/[locale]/devenir-commercial-ia/page")],
  ["candidature", () => import("@/app/[locale]/devenir-commercial-ia/candidature/page")],
  ["memo-isere", () => import("@/app/[locale]/memo-isere/page")],
] as const;

describe.each([false, true])("métadonnées apporteurs — montant publié : %s", (publie) => {
  beforeEach(() => {
    etat.publie = publie;
  });

  it.each(PAGES)("%s : titre et description tiennent dans les limites", async (_nom, charger) => {
    const { generateMetadata } = await charger();
    const meta = await generateMetadata({ params: Promise.resolve({ locale: "fr" }) });
    const titre =
      typeof meta.title === "string"
        ? meta.title
        : ((meta.title as { absolute?: string } | null | undefined)?.absolute ?? "");
    const description = String(meta.description ?? "");
    expect(titre.length).toBeGreaterThan(0);
    expect(titre.length).toBeLessThanOrEqual(TITRE_MAX);
    expect(description.length).toBeGreaterThan(0);
    expect(description.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
  });
});
