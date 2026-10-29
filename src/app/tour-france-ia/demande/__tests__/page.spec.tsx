/**
 * La page de la mini-demande : composant serveur, trois champs, aucun mot interdit, jamais de téléphone.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BOUTON_ENVOI, CHAMP_HAUT } from "@/components/booking/classes-formulaire";

import { MOTS_INTERDITS } from "../../__tests__/mots-interdits";

// Les mots interdits du Tour, plus ceux que la mini-demande ne dit pas non plus.
const MOTS_INTERDITS_DEMANDE = [
  ...MOTS_INTERDITS,
  /\brepas\b/i,
  /d[ée]placement/i,
  /\bmontant\b/i,
  /aucun gain/i,
];

vi.mock("../actions", () => ({ envoyerDemandeTour: vi.fn() }));
vi.mock("@/features/tour-de-france/lectures", () => ({
  lireCompteursPublics: vi.fn(async () => []),
}));

import DemandePage, { metadata } from "../page";

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), "utf8");
const DOSSIER = "src/app/tour-france-ia";

async function rendre(sp: Record<string, string | string[] | undefined> = {}) {
  return render(await DemandePage({ searchParams: Promise.resolve(sp) }));
}

afterEach(cleanup);

describe("la page de la demande", () => {
  it("trois champs étiquetés, avec les bons attributs", async () => {
    const { container } = await rendre();
    const champ = (nom: string) =>
      container.querySelector(`input[name="${nom}"]`) as HTMLInputElement;
    for (const [nom, auto] of [
      ["nom", "name"],
      ["email", "email"],
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
    // Le téléphone n'est plus demandé ici : il l'est à l'étape suivante.
    expect(container.querySelector('input[name="telephone"]')).toBeNull();
    expect(container.querySelectorAll("form input:not([type=hidden])").length).toBe(4);
    expect(champ("ville").maxLength).toBe(80);
    expect(container.querySelectorAll("datalist#tdf-villes option").length).toBeGreaterThan(100);
    // Le leurre, et le bouton.
    expect(container.querySelector('input[name="website"]')).not.toBeNull();
    expect(container.querySelector('button[type="submit"]')?.textContent).toBe(
      "Choisir mon créneau de visio",
    );
  });

  it("bouton partagé avec l'étape 2 (texte mocha, jamais paper), champs partagés, h1 et fil d'étapes", async () => {
    const { container } = await rendre();
    const bouton = container.querySelector('button[type="submit"]');
    expect(bouton?.className).toBe(BOUTON_ENVOI);
    expect(bouton?.className).toMatch(/\bbg-terracotta\b/);
    expect(bouton?.className).toMatch(/\btext-mocha-fg\b/);
    expect(bouton?.className).not.toMatch(/\btext-paper\b/);
    expect(bouton?.className).not.toMatch(/bg-primary/);
    for (const nom of ["nom", "email", "ville"]) {
      expect(container.querySelector(`input[name="${nom}"]`)?.className, nom).toBe(CHAMP_HAUT);
    }
    expect(container.querySelector("h1")?.textContent).toBe("Votre journée offerte commence ici");
    expect(container.querySelector("main")?.className).toMatch(/\bbg-canvas\b/);
    expect(container.querySelector('[aria-current="step"]')?.textContent).toBe("Votre demande");
    // Les trois champs requis portent un astérisque décoratif.
    for (const id of ["tdf-nom", "tdf-email", "tdf-ville"]) {
      expect(
        container.querySelector(`label[for="${id}"] span[aria-hidden="true"]`),
        id,
      ).not.toBeNull();
    }
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
    expect(texte).toMatch(/téléphone vous sera demandé à l’étape suivante/);
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
    const sources = [
      lire(`${DOSSIER}/demande/page.tsx`),
      lire(`${DOSSIER}/demande/actions.ts`),
      lire(`${DOSSIER}/_composants/CompteurVilles.tsx`),
      lire("src/components/tour/FilEtapesTour.tsx"),
    ].join("\n");
    for (const motif of MOTS_INTERDITS_DEMANDE) {
      expect(rendu, String(motif)).not.toMatch(motif);
      expect(sources, String(motif)).not.toMatch(motif);
    }
    // Ni repas, ni déplacement, ni montant, ni « partout ».
    expect(`${rendu}\n${sources}`).not.toMatch(/repas|d[ée]placement|\bpartout\b|\d\s?(€|euro)/i);
  });
});
