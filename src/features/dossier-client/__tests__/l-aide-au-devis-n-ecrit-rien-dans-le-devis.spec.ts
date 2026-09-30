/**
 * ⛔ L'AIDE AU DEVIS N'ÉCRIT RIEN DANS LE DEVIS (PR 7, décision de Will du 29/09).
 *
 * « DEVIS = OPTION A, AUCUN PRÉ-REMPLISSAGE. » Le panneau « Ce que le client a
 * dit » est en LECTURE SEULE, et rien ne relie ses valeurs au formulaire :
 *
 *   · le calcul (`aide-au-devis.ts`) et le panneau (`ce-que-le-client-a-dit.tsx`)
 *     n'ont ni formulaire, ni champ, ni bouton, ni action, ni accès à la base,
 *     ni `"use client"` ;
 *   · le formulaire de devis (`DevisForm.tsx`) et la vente guidée
 *     (`VenteWizard.tsx`) n'importent pas l'aide ;
 *   · l'action de devis n'écrit aucun `PreRemplissage` ;
 *   · aucun module `pre-remplir-devis` n'existe.
 *
 * Mutation qui rougit : faire lire `aideAuDevis` par `DevisForm`, ajouter un
 * `<button>` au panneau, ou un `preRemplissage.create` dans `devis.ts`.
 * Contre-témoin : le scanner voit bien `<form` dans `VueQuestionnaire.tsx`
 * (un scanner aveugle serait vert pour de mauvaises raisons).
 * Angle mort : Will peut, lui, recopier une valeur du panneau à la main —
 * c'est précisément l'usage voulu.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const lire = (chemin: string): string => readFileSync(join(process.cwd(), chemin), "utf8");
const sansCommentaires = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

const AIDE = "src/features/dossier-client/aide-au-devis.ts";
const PANNEAU = "src/features/dossier-client/ce-que-le-client-a-dit.tsx";
const INTERDITS = [/<form\b/, /<input\b/, /<button\b/, /<textarea\b/, /<select\b/, /\baction=/];

describe("⛔ l'aide au devis n'écrit rien dans le devis", () => {
  it.each([AIDE, PANNEAU])("%s : ni formulaire, ni champ, ni base, ni client", (fichier) => {
    const s = sansCommentaires(lire(fichier));
    for (const re of INTERDITS) expect(s, `${fichier} contient ${re}`).not.toMatch(re);
    expect(s).not.toMatch(/@\/lib\/prisma|server\/actions|use client/);
  });

  it("le formulaire de devis et la vente guidée n'importent pas l'aide", () => {
    for (const f of [
      "src/components/admin/qualiopi/DevisForm.tsx",
      "src/components/admin/qualiopi/VenteWizard.tsx",
    ]) {
      expect(sansCommentaires(lire(f))).not.toMatch(/aide-au-devis|ce-que-le-client-a-dit/);
    }
  });

  it("l'action de devis n'écrit aucun pré-remplissage", () => {
    expect(sansCommentaires(lire("src/server/actions/qualiopi/devis.ts"))).not.toMatch(
      /preRemplissage/i,
    );
    expect(
      existsSync(join(process.cwd(), "src/features/dossier-client/pre-remplir-devis.ts")),
    ).toBe(false);
  });

  it("contre-témoin : le scanner voit un formulaire là où il y en a un", () => {
    const s = sansCommentaires(lire("src/components/admin/visio/VueQuestionnaire.tsx"));
    expect(INTERDITS.some((re) => re.test(s))).toBe(true);
  });
});
