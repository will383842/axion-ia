/**
 * Plus d'offre d'emploi Google pour un apporteur d'affaires (décision Will
 * 2026-09-19, B5).
 *
 * 🔴 POURQUOI. `/devenir-commercial-ia` et `/memo-isere` déclaraient chacune un
 * JSON-LD `JobPosting` : pour Google, un POSTE, avec un employeur
 * (`hiringOrganization`), un « type d'emploi », une catégorie « Agent
 * commercial · VRP ». Or l'apporteur est un indépendant sans mandat ni lien de
 * subordination : une offre d'emploi est exactement la pièce qu'un juge lirait
 * comme l'annonce d'un salariat déguisé. Les pages et leurs URL restent ; seul
 * le balisage « offre d'emploi » part.
 *
 * 🔑 On lit l'ARBRE que la page rend, pas son code source : un `JobPosting`
 * réintroduit par un autre chemin (un composant, un helper) serait vu, alors
 * qu'un `grep` sur le fichier de la page ne le verrait pas. Le `JSON.stringify`
 * est exactement celui que `JsonLd` écrit dans le HTML.
 *
 * Et la liste des offres statiques surveillées par le cron de fraîcheur est
 * vide : sans cela, le cron réclamerait chaque semaine la « republication »
 * d'une offre qui n'existe plus.
 */
import { isValidElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getLocale: vi.fn(async () => "fr"),
  getTranslations: vi.fn(async () => (k: string) => k),
}));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn(),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children }: { children: ReactNode }) => children,
}));
// Aucun avis en base de test : la section avis se masque, le reste de la page
// est rendu comme en production.
vi.mock("@/server/reviews/queries", () => ({
  getPublishedReviews: vi.fn(async () => ({ items: [], total: 0 })),
}));

import { JsonLd } from "@/components/marketing/JsonLd";
import { STATIC_JOB_POSTINGS } from "@/content/recrutement/dates";
import DevenirCommercialHub from "@/app/[locale]/devenir-commercial-ia/page";
import MemoIserePage from "@/app/[locale]/memo-isere/page";

/**
 * Toutes les données structurées de l'arbre, telles qu'elles partent dans le
 * HTML. On descend dans TOUTES les props (pas seulement `children`) : un
 * `JsonLd` passé en prop d'un bloc serait sinon invisible.
 */
function donneesStructurees(noeud: unknown, out: string[] = []): string[] {
  if (Array.isArray(noeud)) {
    for (const n of noeud) donneesStructurees(n, out);
    return out;
  }
  if (!isValidElement(noeud)) return out;
  const props = noeud.props as Record<string, unknown>;
  if (noeud.type === JsonLd) out.push(JSON.stringify(props.data));
  if (noeud.type === "script") {
    const html = (props.dangerouslySetInnerHTML as { __html?: string } | undefined)?.__html;
    if (html) out.push(html);
  }
  for (const v of Object.values(props)) donneesStructurees(v, out);
  return out;
}

const PAGES = [
  [
    "/fr/devenir-commercial-ia",
    () => DevenirCommercialHub({ params: Promise.resolve({ locale: "fr" }) }),
  ],
  ["/fr/memo-isere", () => MemoIserePage({ params: Promise.resolve({ locale: "fr" }) })],
] as const;

describe("aucune offre d'emploi Google pour un apporteur indépendant", () => {
  it.each(PAGES)("%s : aucun JSON-LD JobPosting", async (_url, rendre) => {
    const jsonLd = donneesStructurees(await rendre());
    // 🔑 TÉMOIN — la page porte bien ses autres données structurées : sans lui,
    // un parcours d'arbre qui ne trouverait RIEN verdirait aussi.
    expect(jsonLd.some((j) => j.includes('"@type":"WebPage"'))).toBe(true);
    for (const j of jsonLd) {
      expect(j).not.toContain('"@type":"JobPosting"');
      expect(j).not.toContain("hiringOrganization");
    }
  });

  it("le cron de fraîcheur ne surveille plus aucune offre statique", () => {
    expect(STATIC_JOB_POSTINGS).toEqual([]);
  });
});
