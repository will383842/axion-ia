/**
 * Icônes de navigation de l'espace formateur, rendues par le SERVEUR.
 *
 * ## Pourquoi pas `lucide-react`
 *
 * Depuis sa v1, la base d'icône de `lucide-react` est un composant `"use client"`
 * (elle lit un contexte de valeurs par défaut). Rendue depuis un composant serveur,
 * elle n'ajoute aucun octet de tracé — mais elle fait entrer son module client dans
 * le chunk de la page qui la rend. La coquille de l'espace étant composée par CHAQUE
 * page, cette base était copiée dans chacune : mesuré le 2026-10-12, c'est elle, avec
 * le bouton de déconnexion, qui faisait les 3,5 ko identiques de chaque page.
 *
 * Ici, le même SVG au caractère près (attributs par défaut de lucide, classes
 * `lucide lucide-<nom>`, `aria-hidden`), sans aucun module client. Tracés repris de
 * lucide v1.33 (licence ISC).
 */

import type { EspaceIcone, EspaceIconeProps } from "@/components/espace/EspaceShell";

type Noeud = readonly ["path" | "rect" | "circle", Readonly<Record<string, string>>];

function iconeServeur(nom: string, noeuds: readonly Noeud[]): EspaceIcone {
  function Icone({
    className,
    strokeWidth = 2,
    "aria-hidden": ariaHidden = "true",
  }: EspaceIconeProps): React.ReactElement {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={24}
        height={24}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={["lucide", `lucide-${nom}`, className].filter(Boolean).join(" ")}
        aria-hidden={ariaHidden}
      >
        {noeuds.map(([Balise, attributs], i) => (
          <Balise key={i} {...attributs} />
        ))}
      </svg>
    );
  }
  return Icone;
}

export const IconeAFaire = iconeServeur("circle-check-big", [
  ["path", { d: "M21.801 10A10 10 0 1 1 17 3.335" }],
  ["path", { d: "m9 11 3 3L22 4" }],
]);

export const IconeFormations = iconeServeur("calendar-days", [
  ["path", { d: "M8 2v3" }],
  ["path", { d: "M16 2v3" }],
  ["rect", { x: "3", y: "3", width: "18", height: "18", rx: "2" }],
  ["path", { d: "M3 9h18" }],
  ["path", { d: "M8 13h.01" }],
  ["path", { d: "M12 13h.01" }],
  ["path", { d: "M16 13h.01" }],
  ["path", { d: "M8 17h.01" }],
  ["path", { d: "M12 17h.01" }],
  ["path", { d: "M16 17h.01" }],
]);

export const IconeRemuneration = iconeServeur("euro", [
  ["path", { d: "M4 10h12" }],
  ["path", { d: "M4 14h9" }],
  [
    "path",
    { d: "M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12c0 4.4 3.5 8 7.8 8 2 0 3.8-.8 5.2-2" },
  ],
]);

export const IconeDossier = iconeServeur("folder-open", [
  [
    "path",
    {
      d: "m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2",
    },
  ],
]);

export const IconeAccompagnements = iconeServeur("user-round", [
  ["circle", { cx: "12", cy: "8", r: "5" }],
  ["path", { d: "M20 21a8 8 0 0 0-16 0" }],
]);
