import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  lireTaches: vi.fn(),
  lirePersonnes: vi.fn(),
  lirePrestations: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/features/dossier-client/queries-rencontres", () => ({
  lirePersonnesCourtes: h.lirePersonnes,
}));
vi.mock("@/features/dossier-client/fiche/taches", () => ({
  jourDeParis: () => "2026-10-30",
  lireTachesDeLaFiche: h.lireTaches,
  lirePrestationsCourtes: h.lirePrestations,
}));
vi.mock("@/features/dossier-client/fiche/actions-taches", () => ({
  ajouterTacheFormAction: vi.fn(),
  marquerFaiteFormAction: vi.fn(),
  rouvrirTacheFormAction: vi.fn(),
}));

import { TEXTE_LECTURE_IMPOSSIBLE } from "@/features/dossier-client/bandeau-ou-en-est";
import { resumeTaches } from "../ResumeTaches";
import type { ContexteFiche } from "../contexte";

const ctx = (voitEchanges: boolean): ContexteFiche =>
  ({
    clientId: "11111111-1111-4111-8111-111111111111",
    ficheHref: "/fr/x/qualiopi/clients/abc",
    peutEcrire: true,
    voitEchanges,
    maintenant: new Date("2026-10-30T10:00:00Z"),
  }) as unknown as ContexteFiche;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-30T10:00:00Z"));
  h.lireTaches.mockReset();
  h.lirePersonnes.mockReset().mockResolvedValue([]);
  h.lirePrestations.mockReset().mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("resumeTaches", () => {
  it("sans droit de voir les échanges : rien n'est rendu ni lu", async () => {
    expect(await resumeTaches(ctx(false))).toBeNull();
    expect(h.lireTaches).not.toHaveBeenCalled();
    expect(h.lirePersonnes).not.toHaveBeenCalled();
    expect(h.lirePrestations).not.toHaveBeenCalled();
  });

  it("lecture en échec : le rendu annonce la lecture impossible, jamais « aucune tâche »", async () => {
    h.lireTaches.mockRejectedValue(new Error("panne"));
    const el = await resumeTaches(ctx(true));
    const html = renderToStaticMarkup(el as React.ReactElement);
    expect(html).toContain(TEXTE_LECTURE_IMPOSSIBLE);
    expect(html).not.toContain("Aucune tâche");
  });
});
