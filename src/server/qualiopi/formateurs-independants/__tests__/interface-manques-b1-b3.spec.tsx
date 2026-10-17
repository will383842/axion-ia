/**
 * Manques B1-B3 de la vérification d'interface (2026-10-17) : les écrans « pas encore
 * ouvert » nomment la clé, et les pages sans porte sont reliées.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Compteur simple : un vi.fn() serait ré-appelé par le nettoyage de vitest (restoreMocks).
let appelsNotFound = 0;
vi.mock("next/navigation", () => ({
  notFound: () => {
    appelsNotFound += 1;
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: vi.fn(),
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/server/auth/garde-page", () => ({
  gardePage: async () => ({ autorise: true, role: "admin", peutEcrire: true }),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/auth", () => ({ auth: async () => null }));
// Interrupteurs coupés : la seule branche que ces deux pages doivent rendre.
vi.mock("@/server/qualiopi/formateurs-independants/interrupteur-allume", () => ({
  interrupteurAllume: async () => false,
}));
vi.mock("@/server/qualiopi/formateurs-independants/etats-entree", () => ({
  lireEtatsEntree: async () => ({ virements_a_faire: false, menu_freelance: false }),
}));
vi.mock("@/server/actions/qualiopi/virements-a-faire", () => ({
  prevenirVirementEnAttenteFormAction: async () => undefined,
  virementsFaitsFormAction: async () => undefined,
}));

import MissionsPage from "@/app/[locale]/(admin)/[adminPrefix]/qualiopi/formateurs/missions/page";
import VirementsPage from "@/app/[locale]/(admin)/[adminPrefix]/qualiopi/remuneration/virements/page";

import { liensAnnexes } from "../a-faire-maintenant";
import { INTERRUPTEURS_ENTREE, INTERRUPTEURS_SIGNATURE } from "../interrupteurs";

const params = Promise.resolve({ locale: "fr" as const, adminPrefix: "p" });
const searchParams = Promise.resolve({});

describe("écrans « pas encore ouvert » (les PAGES, interrupteur coupé)", () => {
  beforeEach(() => {
    appelsNotFound = 0;
  });

  it("missions (B2) nomme l'interrupteur, mène à Interrupteurs, sans notFound", async () => {
    const html = renderToStaticMarkup(await MissionsPage({ params, searchParams }));
    expect(appelsNotFound).toBe(0);
    expect(html).toContain(INTERRUPTEURS_SIGNATURE.missions_console.libelle);
    expect(html).toContain("/fr/p/qualiopi/formateurs/interrupteurs");
  });
  it("virements à faire nomme l'interrupteur, sans notFound", async () => {
    const html = renderToStaticMarkup(await VirementsPage({ params, searchParams }));
    expect(appelsNotFound).toBe(0);
    expect(html).toContain(INTERRUPTEURS_ENTREE.virements_a_faire.libelle);
  });
});

describe("liens d'entrée", () => {
  const OUVERT = { suivi_echange: false, mise_a_niveau: false, changement_coordonnees: true };
  const hrefs = (role: string | null, ouvert: Parameters<typeof liensAnnexes>[1] = OUVERT) =>
    liensAnnexes("/fr/p", ouvert, role).map((l) => l.href);
  const B = "/fr/p/qualiopi/formateurs";

  it("B1 : « changements » exige l'interrupteur ET le droit de rémunérer", () => {
    expect(hrefs("admin")).toContain(`${B}/changements`);
    expect(hrefs("admin", { ...OUVERT, changement_coordonnees: false })).not.toContain(
      `${B}/changements`,
    );
    expect(hrefs("responsable_qualite")).not.toContain(`${B}/changements`);
    expect(hrefs(null)).not.toContain(`${B}/changements`);
  });
  it("B3 : « lieux » exige le droit d'habiliter un formateur", () => {
    expect(hrefs("responsable_qualite")).toContain(`${B}/lieux`);
    expect(hrefs("lecteur")).not.toContain(`${B}/lieux`);
  });
  it("B3 : « rattrapage » exige le droit de contresigner", () => {
    expect(hrefs("admin")).toContain(`${B}/rattrapage`);
    expect(hrefs("responsable_qualite")).not.toContain(`${B}/rattrapage`);
  });
});
