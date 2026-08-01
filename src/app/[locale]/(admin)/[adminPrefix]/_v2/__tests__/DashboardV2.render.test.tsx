/**
 * Rendu du tableau de bord d'accueil — refonte UI 2026-08-01 (couche 4).
 *
 * POURQUOI CE TEST EXISTE
 * -----------------------
 * La couche 4 remplace des CHAÎNES par des COMPOSANTS : un emoji rendait du
 * texte, une icône lucide rend un `<svg>`. Cette bascule ne peut pas échouer
 * bruyamment — un composant mal branché rend `undefined`, c'est-à-dire RIEN, et
 * la page reste debout avec un trou à la place du pictogramme.
 *
 * Deux constructions de cette page sont particulièrement exposées :
 *   - `<r.icone />` et `<IconeAction />` sont des composants tirés d'un TABLEAU,
 *     pas écrits en dur dans le JSX ; une clé absente ne lève pas ;
 *   - `ICONE_ACTIVITE` traduit une famille nommée par `activity-labels.ts`, un
 *     module qui ne connaît pas React et peut donc introduire une famille sans
 *     que rien ne relie cette famille à une forme.
 *
 * Le test rend donc la page pour de vrai et vérifie ce qui SORT : des `<svg>`,
 * aucun emoji résiduel, et les libellés attendus.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardV2 } from "../DashboardV2";

/** Plage Unicode des pictogrammes — la même que celle qui a servi à l'audit. */
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F000}-\u{1F2FF}]/u;

const PROPS_BASE = {
  adminPrefix: "admin-test",
  email: "will@example.test",
  role: "super_admin",
  logoutAction: () => {},
  kpis: { totalSubmissions: 12, totalArticles: 7, totalSubscribers: 42 },
  aTraiter: { signatures: 3, emails: 2, alertes: 1, total: 6 },
  activityRows: [
    { id: "a1", action: "qualiopi.client.update", secondary: "il y a 2 h" },
    { id: "a2", action: "facturation.relance.envoyer", secondary: "hier" },
    // Clé volontairement inconnue : elle doit retomber sur la famille `inconnu`
    // et rendre une icône malgré tout, jamais un trou.
    { id: "a3", action: "domaine_inedit.objet.verbe", secondary: "la semaine dernière" },
  ],
};

describe("DashboardV2 — rendu", () => {
  it("n'affiche plus aucun emoji", () => {
    const { container } = render(<DashboardV2 {...PROPS_BASE} />);
    const texte = container.textContent ?? "";
    const trouves = texte.match(new RegExp(EMOJI, "gu")) ?? [];

    expect(
      trouves,
      `Emoji(s) encore rendu(s) par le tableau de bord : ${trouves.join(" ")}`,
    ).toEqual([]);
  });

  it("rend une icône pour chaque ligne du journal, y compris sur une clé inconnue", () => {
    render(<DashboardV2 {...PROPS_BASE} />);

    // Chaque ligne du journal porte son pictogramme ; une famille non reliée à
    // un composant ne rendrait rien du tout.
    const lignes = screen.getAllByRole("listitem");
    const lignesJournal = lignes.filter((li) => /il y a|hier|semaine/.test(li.textContent ?? ""));

    expect(lignesJournal).toHaveLength(3);
    for (const li of lignesJournal) {
      expect(
        li.querySelector("svg"),
        `Ligne de journal sans pictogramme : « ${li.textContent} »`,
      ).not.toBeNull();
    }
  });

  it("traduit les clés techniques du journal en français", () => {
    render(<DashboardV2 {...PROPS_BASE} />);

    // La régression d'origine : la page affichait `qualiopi.client.update` brut.
    expect(screen.getByText("Client modifié")).toBeDefined();
    expect(screen.getByText("Relance envoyée")).toBeDefined();
    expect(screen.queryByText(/qualiopi\.client\.update/)).toBeNull();
  });

  it("rend les six raccourcis avec leur pictogramme", () => {
    render(<DashboardV2 {...PROPS_BASE} />);

    for (const titre of [
      "Dossiers",
      "Boîte de réception",
      "Infrastructure",
      "Alertes",
      "Double authentification",
      "Toutes les URLs",
    ]) {
      const lien = screen.getByText(titre).closest("a");
      expect(lien, `Raccourci « ${titre} » absent`).not.toBeNull();
      expect(
        lien?.querySelector("svg"),
        `Raccourci « ${titre} » rendu sans pictogramme — ` +
          "un composant tiré d'un tableau ne lève pas quand il manque.",
      ).not.toBeNull();
    }
  });

  it("garde un nom accessible sur le bouton de déconnexion", () => {
    render(<DashboardV2 {...PROPS_BASE} />);

    // Le libellé était collé à un emoji « 🚪 ». En le remplaçant par une icône
    // décorative, le texte doit rester le nom accessible du bouton.
    expect(screen.getByRole("button", { name: /Déconnexion/ })).toBeDefined();
  });

  it("bascule sur l'état « rien à traiter » sans emoji ni perte d'information", () => {
    const { container } = render(
      <DashboardV2
        {...PROPS_BASE}
        aTraiter={{ signatures: 0, emails: 0, alertes: 0, total: 0 }}
        activityRows={[]}
      />,
    );

    expect(container.textContent).toContain("Rien n’attend d’action.");
    expect(container.textContent?.match(new RegExp(EMOJI, "gu")) ?? []).toEqual([]);
  });
});
