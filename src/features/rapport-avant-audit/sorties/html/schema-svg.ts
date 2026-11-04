/**
 * Schéma des dépendances en SVG, DESSINÉ PAR LE CODE (PUR) : trois colonnes, boîtes empilées, flèches
 * de la dépendance vers l'automatisation qui en dépend. Aucun script, aucune image, aucune URL.
 */

import type { Automatisation } from "../../base-audit-schema";

import { echapper } from "./echapper";

const COLONNES = [
  { groupe: "sans_prerequis", titre: "Sans prérequis" },
  { groupe: "base_unique", titre: "Autour de la base unique" },
  { groupe: "a_etudier", titre: "À étudier ensemble" },
] as const;

const LARGEUR_BOITE = 260;
const HAUTEUR_BOITE = 56;
const ECART_X = 70;
const ECART_Y = 18;
const MARGE = 20;
const HAUT = 56;
export const LONGUEUR_MAX_TITRE = 28;

/** Coupe à ~28 caractères, avec une ellipse. */
export function couper(texte: string, max: number = LONGUEUR_MAX_TITRE): string {
  const t = texte.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

interface Place {
  readonly a: Automatisation;
  readonly col: number;
  readonly x: number;
  readonly y: number;
}

export function schemaSvg(liste: ReadonlyArray<Automatisation>): string {
  const places = new Map<string, Place>();
  const hauteurs: number[] = [];
  COLONNES.forEach((c, col) => {
    const dedans = liste
      .filter((a) => a.groupe === c.groupe)
      .sort((p, q) => p.ordreMiseEnPlace - q.ordreMiseEnPlace);
    dedans.forEach((a, i) => {
      places.set(a.id, {
        a,
        col,
        x: MARGE + col * (LARGEUR_BOITE + ECART_X),
        y: HAUT + i * (HAUTEUR_BOITE + ECART_Y),
      });
    });
    hauteurs.push(HAUT + dedans.length * (HAUTEUR_BOITE + ECART_Y));
  });
  const largeur = MARGE * 2 + 3 * LARGEUR_BOITE + 2 * ECART_X;
  const hLegende = 64;
  const hauteur = Math.max(...hauteurs, HAUT + HAUTEUR_BOITE) + hLegende;

  const titres = COLONNES.map(
    (c, col) =>
      `<text x="${MARGE + col * (LARGEUR_BOITE + ECART_X)}" y="30" style="fill:var(--texte);font-weight:700;font-size:15px">${echapper(c.titre)}</text>`,
  ).join("");

  const boites = [...places.values()]
    .map(({ a, x, y }) => {
      const bord = a.estSocle ? "var(--accent)" : "var(--trait)";
      const epaisseur = a.estSocle ? 3 : 1.5;
      const etoile = a.citeCommePriorite ? " ★" : "";
      return (
        `<g><rect x="${x}" y="${y}" width="${LARGEUR_BOITE}" height="${HAUTEUR_BOITE}" rx="8" style="fill:var(--carte);stroke:${bord};stroke-width:${epaisseur}"/>` +
        `<text x="${x + 12}" y="${y + 23}" style="fill:var(--discret);font-size:12px">${echapper(a.id)}${echapper(etoile)}</text>` +
        `<text x="${x + 12}" y="${y + 43}" style="fill:var(--texte);font-size:14px">${echapper(couper(a.titre))}</text></g>`
      );
    })
    .join("");

  const fleches = [...places.values()]
    .flatMap(({ a }) =>
      a.dependDe.map((d) => {
        const s = places.get(d);
        const t = places.get(a.id);
        if (s === undefined || t === undefined) return "";
        const ys = s.y + HAUTEUR_BOITE / 2;
        const yt = t.y + HAUTEUR_BOITE / 2;
        let chemin: string;
        if (s.col < t.col) {
          chemin = `M${s.x + LARGEUR_BOITE},${ys} C${s.x + LARGEUR_BOITE + 40},${ys} ${t.x - 40},${yt} ${t.x},${yt}`;
        } else if (s.col > t.col) {
          chemin = `M${s.x},${ys} C${s.x - 40},${ys} ${t.x + LARGEUR_BOITE + 40},${yt} ${t.x + LARGEUR_BOITE},${yt}`;
        } else {
          const bord = s.x + LARGEUR_BOITE;
          chemin = `M${bord},${ys} C${bord + 50},${ys} ${bord + 50},${yt} ${bord},${yt}`;
        }
        return `<path d="${chemin}" style="fill:none;stroke:var(--bleu);stroke-width:1.8" marker-end="url(#pointe)"/>`;
      }),
    )
    .join("");

  const yLeg = hauteur - hLegende + 20;
  const legende =
    `<text x="${MARGE}" y="${yLeg}" style="fill:var(--discret);font-size:12px">Légende : ★ citée par le client comme priorité · contour épais : le socle · flèche : de la dépendance vers l’automatisation qui en dépend</text>` +
    `<text x="${MARGE}" y="${yLeg + 20}" style="fill:var(--discret);font-size:12px">Titres coupés à ${LONGUEUR_MAX_TITRE} caractères ; le titre complet est dans la fiche des automatisations.</text>`;

  return (
    `<svg viewBox="0 0 ${largeur} ${hauteur}" width="${largeur}" role="img" aria-label="Schéma des dépendances entre automatisations">` +
    `<defs><marker id="pointe" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--bleu)"/></marker></defs>` +
    titres +
    fleches +
    boites +
    legende +
    `</svg>`
  );
}
