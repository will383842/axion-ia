/**
 * La page de la mini-demande : composant serveur, quatre champs, aucun mot interdit.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MOTS_INTERDITS } from "../../__tests__/mots-interdits";

vi.mock("../actions", () => ({ envoyerDemandeTour: vi.fn() }));

import DemandePage, { metadata } from "../page";

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), "utf8");
const DOSSIER = "src/app/tour-france-ia";

async function rendre(sp: Record<string, string | string[] | undefined> = {}) {
  return render(await DemandePage({ searchParams: Promise.resolve(sp) }));
}

afterEach(cleanup);

describe("la page de la demande", () => {
  it("quatre champs étiquetés, avec les bons attributs", async () => {
    const { container } = await rendre();
    const champ = (nom: string) =>
      container.querySelector(`input[name="${nom}"]`) as HTMLInputElement;
    for (const [nom, auto] of [
      ["nom", "name"],
      ["email", "email"],
      ["telephone", "tel"],
      ["ville", "address-level2"],
    ] as const) {
      const el = champ(nom);
      expect(el.required, nom).toBe(true);
      expect(el.getAttribute("autocomplete"), nom).toBe(auto);
      expect(container.querySelector(`label[for="${el.id}"]`), nom).not.toBeNull();
    }
    expect(champ("nom").maxLength).toBe(80);
    expect(champ("email").type).toBe("email");
    expect(champ("email").maxLength).toBe(254);
    expect(champ("telephone").type).toBe("tel");
    expect(champ("telephone").getAttribute("pattern")).toBe(
      "(?=(?:[^0-9]*[0-9]){9})[0-9 +().\\-]{8,20}",
    );
    expect(champ("telephone").getAttribute("title")).toMatch(/9 chiffres/);
    expect(champ("ville").maxLength).toBe(80);
    expect(container.querySelectorAll("datalist#tdf-villes option").length).toBeGreaterThan(100);
    // Le leurre, et le bouton.
    expect(container.querySelector('input[name="website"]')).not.toBeNull();
    expect(container.querySelector('button[type="submit"]')?.textContent).toBe(
      "Choisir mon créneau de visio",
    );
  });

  it("la ville du siège n'est pas suggérée, mais une ville tapée reste acceptée", async () => {
    const { container } = await rendre();
    const options = [...container.querySelectorAll("datalist option")].map((o) =>
      o.getAttribute("value"),
    );
    expect(options).toContain("Lyon");
    expect(options.join("|")).not.toMatch(/gren/i);
  });

  it("depuis et utm_* valides deviennent des champs cachés, les autres sont abandonnés", async () => {
    const { container } = await rendre({
      depuis: "tdf-heros",
      utm_source: "facebook",
      utm_medium: "pas valide!",
      prenom: "Claire",
    });
    const caches = [...container.querySelectorAll('input[type="hidden"]')].map(
      (i) => `${i.getAttribute("name")}=${i.getAttribute("value")}`,
    );
    expect(caches).toEqual(["depuis=tdf-heros", "utm_source=facebook"]);
  });

  it("dit la contrepartie (podcast), les conditions et l'information sur les données", async () => {
    const { container } = await rendre();
    const texte = container.textContent ?? "";
    expect(texte).toMatch(/podcast/);
    expect(texte).toMatch(/sans engagement/);
    expect(texte).toMatch(/Axion IA/);
    expect(texte).toMatch(/empreintes chiffrées/);
    expect(texte).toMatch(/effacement/);
    expect(
      container.querySelector('a[href="/tour-france-ia/conditions-generales"]'),
    ).not.toBeNull();
  });

  it("?erreur=champs et ?erreur=trop affichent un message ; toute autre valeur, rien", async () => {
    for (const e of ["champs", "trop"]) {
      const { container } = await rendre({ erreur: e });
      expect(container.querySelector('[role="alert"]')).not.toBeNull();
      cleanup();
    }
    const { container } = await rendre({ erreur: "<script>" });
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("jamais indexée, aucun référent transmis, aucun JavaScript client", async () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.referrer).toBe("same-origin");
    const source = lire(`${DOSSIER}/demande/page.tsx`);
    expect(source).not.toMatch(/["']use client["']/);
    expect(source).not.toMatch(/cookies|localStorage|useState|useEffect/);
  });

  it("aucun mot interdit, ni dans le texte rendu ni dans les sources (commentaires compris)", async () => {
    const { container } = await rendre({ erreur: "champs" });
    const rendu = container.textContent ?? "";
    const sources = ["demande/page.tsx", "demande/actions.ts", "_composants/CompteurVilles.tsx"]
      .map((f) => lire(`${DOSSIER}/${f}`))
      .join("\n");
    for (const motif of MOTS_INTERDITS) {
      expect(rendu, String(motif)).not.toMatch(motif);
      expect(sources, String(motif)).not.toMatch(motif);
    }
    // Ni repas, ni déplacement, ni montant, ni « partout ».
    expect(`${rendu}\n${sources}`).not.toMatch(/repas|d[ée]placement|\bpartout\b|\d\s?(€|euro)/i);
  });
});
