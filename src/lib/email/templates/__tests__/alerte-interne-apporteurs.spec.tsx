// L4f — les alertes d'argent des apporteurs portent leur étiquette et leur lien.
//
// Avant : objet « Alerte formation » deviné d'après le code, bouton « Voir les
// alertes » vers la page des alertes de formation. Maintenant : la rubrique
// « apporteurs » (clé FACULTATIVE) donne l'objet « Alerte apporteur » et un bouton
// « Ouvrir les apporteurs » vers la fiche. Sans la clé (jobs posés avant, ou par
// un ancien conteneur), le rendu reste celui d'avant.

import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderEmailTemplate } from "../index";
import { qualiopiAlerteInterneSubject } from "../qualiopi-alerte-interne";

const AVANT = process.env["ADMIN_URL_PREFIX"];
afterEach(() => {
  if (AVANT === undefined) delete process.env["ADMIN_URL_PREFIX"];
  else process.env["ADMIN_URL_PREFIX"] = AVANT;
});

const BASE = {
  niveau: "important",
  code: "code_neutre",
  titre: "À virer : 120 € à un apporteur",
  message: "Un virement est à faire.",
  cibleType: "ApporteurReseau",
  cibleId: "abc123",
};
const AVEC = { ...BASE, rubrique: "apporteurs", chemin: "apporteurs/abc123" };

const rendre = (payload: Record<string, unknown>) =>
  renderEmailTemplate("qualiopi-alerte-interne", "fr", payload, {
    destinataire: "interne@example.test",
  });

describe("qualiopi-alerte-interne — rubrique apporteurs", () => {
  it("🔴 avec la rubrique : objet « Alerte apporteur », bouton et lien vers la fiche", async () => {
    process.env["ADMIN_URL_PREFIX"] = "console-prod-zz91";
    expect(qualiopiAlerteInterneSubject("fr", AVEC)).toContain("Alerte apporteur");
    const { html } = await rendre(AVEC);
    expect(html).toContain("Ouvrir les apporteurs");
    expect(html).toContain("/fr/console-prod-zz91/apporteurs/abc123");
    expect(html).not.toContain("/qualiopi/alertes");
    // ctaSecret gardé : l'adresse n'est pas recopiée en clair dans le corps.
    expect(html.split("/fr/console-prod-zz91/apporteurs/abc123").length - 1).toBe(1);
  });

  it("🔴 un code sans le mot « apporteur » : la rubrique seule suffit à l'objet", () => {
    expect(qualiopiAlerteInterneSubject("fr", BASE)).toContain("Alerte formation");
    expect(qualiopiAlerteInterneSubject("fr", AVEC)).toContain("Alerte apporteur");
  });

  it("sans rubrique : rendu identique à avant (anciens jobs)", async () => {
    process.env["ADMIN_URL_PREFIX"] = "console-prod-zz91";
    const { html } = await rendre({ ...BASE, chemin: "apporteurs/abc123" });
    expect(html).toContain("Voir les alertes");
    expect(html).toContain("/fr/console-prod-zz91/qualiopi/alertes");
    expect(html).not.toContain("Ouvrir les apporteurs");
  });

  it.each([
    "qualiopi/alertes",
    "../admin",
    "https://evil.example/x",
    "apporteurs-x",
    "//apporteurs",
  ])(
    "🔴 un chemin hors « apporteurs » (%s) est ignoré : repli sur la liste des apporteurs",
    async (chemin) => {
      process.env["ADMIN_URL_PREFIX"] = "console-prod-zz91";
      const { html } = await rendre({ ...AVEC, chemin });
      expect(html).toContain("/fr/console-prod-zz91/apporteurs");
      expect(html).not.toContain("evil.example");
      expect(html).not.toContain("/qualiopi/alertes");
      expect(html).not.toContain("../");
    },
  );

  it("rubrique sans chemin : liste des apporteurs", async () => {
    process.env["ADMIN_URL_PREFIX"] = "console-prod-zz91";
    const { html } = await rendre({ ...BASE, rubrique: "apporteurs" });
    expect(html).toContain("/fr/console-prod-zz91/apporteurs");
    expect(html).toContain("Ouvrir les apporteurs");
  });

  it("le texte ajouté ne nomme ni la certification, ni le financement", async () => {
    const { html } = await rendre(AVEC);
    for (const mot of [/qualiopi/i, /opco/i, /prise en charge/i, /financeur/i]) {
      expect(html).not.toMatch(mot);
    }
  });
});

describe("les émetteurs d'alertes d'argent des apporteurs posent la rubrique", () => {
  const racine = join(process.cwd(), "src/features/apporteurs-reseau");
  const comptes: Array<[string, number]> = [
    ["facturation.ts", 3],
    ["alerte-vigilance.ts", 1],
    ["attribution-annonce.ts", 1],
  ];
  it.each(comptes)("🔴 %s : %i alerte(s) portent rubrique et chemin", (fichier, n) => {
    const src = readFileSync(join(racine, fichier), "utf8");
    const rub = src.match(/rubrique: "apporteurs",/g) ?? [];
    const chem = src.match(/chemin: [`"]apporteurs/g) ?? [];
    expect(rub.length).toBe(n);
    expect(chem.length).toBe(n);
  });
});
