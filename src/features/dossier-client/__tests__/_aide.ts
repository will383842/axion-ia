/**
 * Outils des tests de l'aide au devis (PR 7). Données FICTIVES.
 */

import { vi } from "vitest";

vi.mock("@/auth", () => ({ auth: async () => null }));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("redirect");
  },
}));

import { aideAuDevis, type AideAuDevis } from "@/features/dossier-client/aide-au-devis";
import { consoliderFaits, type FaitAConsolider } from "@/features/dossier-client/consolider-faits";
import { MAINTENANT } from "./_faits";

export const PROJET = "11111111-1111-4111-8111-111111111111";
export const AUTRE_PROJET = "22222222-2222-4222-8222-222222222222";

export function aide(
  faits: ReadonlyArray<FaitAConsolider>,
  options: {
    readonly role?: string | null;
    readonly citations?: ReadonlyArray<readonly [string, string]>;
  } = {},
): AideAuDevis {
  const consolidation = consoliderFaits(
    faits,
    [
      { id: PROJET, derniereReouvertureLe: null },
      { id: AUTRE_PROJET, derniereReouvertureLe: null },
    ],
    MAINTENANT,
  );
  return aideAuDevis({
    consolidation,
    projetId: PROJET,
    citations: new Map(options.citations ?? []),
    role: options.role === undefined ? "admin" : options.role,
    maintenant: MAINTENANT,
  });
}

/** L'élément d'un type, s'il est affiché. */
export function element(a: AideAuDevis, type: string) {
  return a.rubriques.flatMap((r) => r.elements).find((e) => e.type === type);
}
