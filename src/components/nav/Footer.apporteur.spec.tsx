/**
 * Pied de page — le lien vers `/devenir-commercial-ia` quitte « Carrières »
 * (décision Will 2026-09-19, B5).
 *
 * 🔴 POURQUOI. La sous-colonne « Carrières » rangeait le réseau d'apporteurs à
 * côté de « Nos offres d'emploi », sous le libellé « Recrutement commerciaux ».
 * Un apporteur d'affaires n'est ni embauché ni recruté : c'est un indépendant
 * qui recommande. Le ranger parmi les emplois, sur TOUTES les pages du site,
 * contredisait le contrat (aucun lien de subordination) au même titre que le
 * JSON-LD `JobPosting` retiré le même jour.
 *
 * Le lien n'est pas supprimé : il porte le maillage interne vers une page
 * indexée. Il change de colonne et de libellé, même `href`.
 *
 * On lit les props des colonnes que le composant rend, pas le HTML : les
 * sous-composants (badge Qualiopi, réseaux) n'ont rien à faire dans ce test.
 */
import { isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";

let langue = "fr";
vi.mock("next-intl/server", () => ({
  getLocale: vi.fn(async () => langue),
  getTranslations: vi.fn(async () => (k: string) => k),
}));
vi.mock("@/i18n/navigation", () => ({ Link: () => null }));
// Le badge tire l'authentification (next-auth) à l'import : sans objet ici.
vi.mock("@/components/qualiopi/QualiopiBadge", () => ({ QualiopiBadge: () => null }));

import { Footer } from "./Footer";

type Lien = { href: string; label: string };
type Colonne = { title: string; items: Lien[]; subgroup?: { title: string; items: Lien[] } };

/** Les colonnes de liens du pied de page, reconnues à leur forme `{ title, items }`. */
function colonnes(noeud: unknown, out: Colonne[] = []): Colonne[] {
  if (Array.isArray(noeud)) {
    for (const n of noeud) colonnes(n, out);
    return out;
  }
  if (!isValidElement(noeud)) return out;
  const props = noeud.props as Record<string, unknown>;
  if (typeof props.title === "string" && Array.isArray(props.items)) {
    out.push(props as unknown as Colonne);
  }
  colonnes(props.children, out);
  return out;
}

const CIBLE = "/devenir-commercial-ia";

async function rendre(l: "fr" | "en"): Promise<Colonne[]> {
  langue = l;
  return colonnes(await Footer());
}

describe("pied de page — le réseau d'apporteurs n'est pas rangé parmi les emplois", () => {
  it("/devenir-commercial-ia apparaît UNE seule fois, dans la colonne Entreprise", async () => {
    const cols = await rendre("fr");
    // TÉMOIN — les cinq colonnes sont bien lues : un parcours qui ne trouverait
    // rien verdirait sur l'absence du lien dans « Carrières ».
    expect(cols.map((c) => c.title)).toEqual(
      expect.arrayContaining(["footer.services", "footer.company", "footer.legal"]),
    );

    const tous = cols.flatMap((c) => [...c.items, ...(c.subgroup?.items ?? [])]);
    expect(tous.filter((l) => l.href === CIBLE)).toHaveLength(1);

    const entreprise = cols.find((c) => c.title === "footer.company");
    expect(entreprise?.items).toContainEqual({
      href: CIBLE,
      label: "Devenir apporteur d'affaires",
    });
  });

  it("la sous-colonne Carrières ne garde que les offres d'emploi", async () => {
    const entreprise = (await rendre("fr")).find((c) => c.title === "footer.company");
    expect(entreprise?.subgroup?.title).toBe("Carrières");
    expect(entreprise?.subgroup?.items.map((l) => l.href)).toEqual(["/carrieres"]);
  });

  it("libellé anglais : « Become a business referrer »", async () => {
    const entreprise = (await rendre("en")).find((c) => c.title === "footer.company");
    expect(entreprise?.items).toContainEqual({ href: CIBLE, label: "Become a business referrer" });
  });
});
