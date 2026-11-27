/**
 * Lot 3e — les deux pages en LECTURE : VRAIE `gardePage`, session et lecture doublées.
 * Sans session : redirection vers la connexion. Rôle sans accès : refus nommé. Un compte de
 * consultation (`reader`) ne lit pas l'identité des apporteurs.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({ session: null as unknown }));

vi.mock("@/auth", () => ({ auth: () => Promise.resolve(d.session) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/features/apporteurs-reseau/releve-mensuel/statistiques", async (orig) => {
  const reel = await orig<typeof import("@/features/apporteurs-reseau/releve-mensuel/statistiques")>();
  return {
    ...reel,
    lireVueStatistiques: async () => ({
      cartes: {
        periode: "2026-10",
        apporteursSignes: 4,
        avecMouvement: 2,
        facturesHtCents: 10_000,
        viresTtcCents: 0,
        enAttenteHtCents: 0,
        cumulAnneeHtCents: 10_000,
        source: "releves",
      },
      serie: [],
      periodes: [{ periode: "2026-10", prepares: 1, envoyes: 0, echecs: 0, ecartes: 0 }],
    }),
    lireVuePeriode: async (_p: string, voitIdentite: boolean) => ({
      nbCibles: 1,
      releves: [
        {
          id: "r1",
          numero: "REL-2026-10-0001",
          apporteurId: "a1",
          apporteurNom: voitIdentite ? "Camille Exemple" : "Apporteur (identité masquée)",
          rang: 0,
          statut: "prepare",
          nbLignes: 1,
          facturesHtCents: 10_000,
          avoirsHtCents: 0,
          viresTtcCents: 0,
          enAttenteHtCents: 0,
          cumulAnneeHtCents: 10_000,
          empreinteCourte: "abcd1234",
          pdfDisponible: true,
          emailPresent: true,
          erreur: null,
          motifEcart: null,
          envoyeAt: null,
        },
      ],
    }),
  };
});

import PageListe from "../page";
import PagePeriode from "../[periode]/page";

const params = Promise.resolve({ adminPrefix: "gestion" });
const paramsPeriode = (periode: string) => Promise.resolve({ adminPrefix: "gestion", periode });

beforeEach(() => {
  d.session = { user: { id: "u1", role: "admin" } };
});

describe("page releves", () => {
  it("sans session : redirige vers la connexion", async () => {
    d.session = null;
    await expect(PageListe({ params })).rejects.toThrow(/NEXT_REDIRECT .*login/);
  });
  it("un administrateur lit les cartes et la liste des périodes", async () => {
    const html = renderToStaticMarkup(await PageListe({ params }));
    expect(html).toContain("octobre 2026");
    expect(html).toContain("/apporteurs/releves/2026-10");
  });
});

describe("page releves/[periode]", () => {
  it("période invalide : 404", async () => {
    await expect(
      PagePeriode({ params: paramsPeriode("2026-13"), searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
  it("un administrateur voit l'identité et le lien d'aperçu PDF", async () => {
    const html = renderToStaticMarkup(
      await PagePeriode({ params: paramsPeriode("2026-10"), searchParams: Promise.resolve({}) }),
    );
    expect(html).toContain("Camille Exemple");
    expect(html).toContain("pdf?numero=REL-2026-10-0001");
    expect(html).not.toMatch(/<button|Envoyer les relevés/);
  });
  it("un compte de consultation ne lit pas l'identité et n'a pas le lien PDF", async () => {
    d.session = { user: { id: "u2", role: "reader" } };
    const html = renderToStaticMarkup(
      await PagePeriode({ params: paramsPeriode("2026-10"), searchParams: Promise.resolve({}) }),
    );
    expect(html).not.toContain("Camille Exemple");
    expect(html).not.toContain("pdf?numero=");
  });
});
