/**
 * L7 — le rendu du fil : bulles « Reçu » à gauche, « Envoyé » à droite, notes
 * au centre (classes `admin-fil-*` de `admin.css`, comme la maquette).
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { FilEchanges } from "../FilEchanges";
import type { FaitFil } from "@/features/echanges/fil";

const J = (j: number) => new Date(Date.UTC(2026, 9, j, 10));

const FAITS: FaitFil[] = [
  {
    id: "r",
    sens: "recu",
    quand: J(6),
    titre: "Reçu",
    precisions: ["lu automatiquement"],
    texte: "« Parfait »",
    lien: { href: "https://z", libelle: "Ouvrir dans Zoho" },
  },
  {
    id: "n",
    sens: "note",
    quand: J(5),
    titre: "Échange de 15 minutes réservé",
    precisions: ["pour le 09/10 à 10 h 00"],
  },
  {
    id: "e",
    sens: "envoye",
    quand: J(1),
    titre: "Envoyé · Présenter le réseau",
    precisions: ["Will", "lien ouvert le 02/10"],
    badge: { libelle: "remis", ton: "success" },
    erreur: null,
    fichiers: [
      { nom: "Kit-apporteur.pdf", taille: null, etat: "téléchargé le 02/10", ton: "success" },
    ],
  },
];

describe("FilEchanges", () => {
  const html = renderToStaticMarkup(<FilEchanges faits={FAITS} />);

  it("chaque fait de son côté, dans l'ordre reçu", () => {
    expect(html.indexOf("admin-fil-bulle-recu")).toBeGreaterThan(-1);
    expect(html.indexOf("admin-fil-note")).toBeGreaterThan(html.indexOf("admin-fil-bulle-recu"));
    expect(html.indexOf("admin-fil-bulle-envoye")).toBeGreaterThan(html.indexOf("admin-fil-note"));
  });

  it("montre fichiers, état de livraison et lien externe (cible ≥ 44 px)", () => {
    expect(html).toContain("Kit-apporteur.pdf");
    expect(html).toContain("téléchargé le 02/10");
    expect(html).toContain("remis");
    expect(html).toMatch(/class="admin-link admin-fil-lien"[^>]*>Ouvrir dans Zoho/);
  });

  it("un fil vide dit qu'il est vide", () => {
    expect(renderToStaticMarkup(<FilEchanges faits={[]} vide="Rien encore." />)).toContain(
      "Rien encore.",
    );
  });
});
