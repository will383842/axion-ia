import { describe, expect, it, vi } from "vitest";

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { revaliderFicheEquipe } from "../revalider";

describe("revaliderFicheEquipe", () => {
  it("invalide la fiche, le hub et le sitemap", () => {
    revaliderFicheEquipe("camille");
    expect(revalidatePath.mock.calls.map((c) => c[0])).toEqual([
      "/fr/equipe/camille",
      "/fr/equipe",
      "/sitemap.xml",
    ]);
  });
});
