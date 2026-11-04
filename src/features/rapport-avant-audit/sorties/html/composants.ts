/** Petits morceaux de page communs aux trois documents internes (purs). */

import { brut, html, type Brut } from "./echapper";

export function citation(texte: string, auteur?: string): Brut {
  return html`<blockquote class="citation">
    « ${texte} »${auteur ? html`<cite>— ${auteur}</cite>` : ""}
  </blockquote>`;
}

export function etiquette(texte: string, fort = false): Brut {
  return html`<span class="${fort ? "etiquette fort" : "etiquette"}">${texte}</span>`;
}

export function vide(texte: string): Brut {
  return html`<p class="vide">${texte}</p>`;
}

export function liste(items: ReadonlyArray<Brut | string>): Brut {
  return items.length === 0
    ? brut("")
    : html`<ul>
        ${items.map((i) => html`<li>${i}</li>`)}
      </ul>`;
}

export function section(titre: string, corps: Brut): Brut {
  return html`<section>
    <h2>${titre}</h2>
    ${corps}
  </section>`;
}

/** Comparaison de libellés : casse et accents ignorés, espaces écrasés. */
export function normaliser(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
