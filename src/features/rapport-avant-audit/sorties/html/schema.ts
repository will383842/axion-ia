/**
 * Schéma des dépendances INTERNE (HTML) — PUR. Rend `null` pour une base `base-audit/1`.
 * Ton INTERNE : la page parle des personnes et du client à la troisième personne, jamais de « vous ».
 */

import type { Automatisation, BaseAudit } from "../../base-audit-schema";
import { VERSION_BASE_AUDIT_2 } from "../../base-audit-schema";

import { formulesHtml } from "./automatisations";
import { liste, section, vide } from "./composants";
import { brut, html, pageInterne, type Brut } from "./echapper";
import { schemaSvg } from "./schema-svg";

/** Valeurs FICTIVES, déterministes (jamais une mesure). */
function valeurFictive(i: number, j: number): number {
  return (((i + 2) * 37 + (j + 1) * 11) % 90) + 5;
}

export function maquetteTableauDeBord(toutes: ReadonlyArray<Automatisation>): Brut {
  const trois = [...toutes].sort((a, b) => a.ordreMiseEnPlace - b.ordreMiseEnPlace).slice(0, 3);
  if (trois.length === 0) return vide("Aucune automatisation : pas de maquette.");
  return html`<div class="carte">
    <p class="alerte">
      <strong>Maquette : valeurs fictives.</strong> Elle montre la forme du tableau de bord, pas des
      résultats.
    </p>
    <table>
      <thead>
        <tr>
          <th>Automatisation</th>
          <th>Indicateur</th>
          <th>Valeur (fictive)</th>
        </tr>
      </thead>
      <tbody>
        ${trois.map((a, i) =>
          a.tableauDeBord === null || a.tableauDeBord.indicateurs.length === 0
            ? html`<tr>
                <td>${a.id} — ${a.titre}</td>
                <td colspan="2" class="vide">Aucun tableau de bord prévu</td>
              </tr>`
            : a.tableauDeBord.indicateurs.map(
                (ind, j) =>
                  html`<tr>
                    <td>${j === 0 ? `${a.id} — ${a.titre}` : ""}</td>
                    <td>${ind}</td>
                    <td>${valeurFictive(i, j)}</td>
                  </tr>`,
              ),
        )}
        <tr>
          <td><strong>Compteur d'IA commun</strong></td>
          <td>Jetons consommés ce mois-ci, toutes automatisations</td>
          <td>${valeurFictive(7, 3) * 1000}</td>
        </tr>
      </tbody>
    </table>
  </div>`;
}

/** Texte fixe, 3e personne, tiré des groupes. */
export function commentAvancer(toutes: ReadonlyArray<Automatisation>): Brut {
  const ids = (g: string) => toutes.filter((a) => a.groupe === g).map((a) => a.id);
  const etapes: string[] = [];
  const base = ids("base_unique");
  const libres = ids("sans_prerequis");
  const etude = ids("a_etudier");
  if (base.length > 0) {
    etapes.push(
      `La base unique se met en place en premier (${base.join(", ")}) : les automatisations qui s'y appuient en dépendent et attendent qu'elle soit posée.`,
    );
  }
  if (libres.length > 0) {
    etapes.push(
      `Les automatisations sans prérequis (${libres.join(", ")}) peuvent démarrer séparément, dans l'ordre de mise en place, sans attendre les autres.`,
    );
  }
  if (etude.length > 0) {
    etapes.push(
      `Les automatisations à étudier ensemble (${etude.join(", ")}) se décident avec le client sur place, après les réponses aux questions communes.`,
    );
  }
  etapes.push(
    "Aucun prix n'est fixé dans ce document : Will le fixe, automatisation par automatisation.",
  );
  return liste(etapes);
}

export function schemaHtml(base: BaseAudit): string | null {
  if (base.version !== VERSION_BASE_AUDIT_2) return null;
  const titre = `Schéma des dépendances — ${base.meta.raisonSociale}`;
  const a = base.automatisations;
  if (a === null || a === undefined) {
    return pageInterne({
      titre,
      corps: html`<h1>${titre}</h1>
        <p class="alerte">
          <strong>Schéma non produit.</strong> L'étape des automatisations n'a pas abouti pour cette
          analyse : relancer l'analyse.
        </p>
        ${section("Limites", base.meta.limites.length === 0 ? vide("Aucune limite signalée.") : liste(base.meta.limites))}`,
    });
  }
  return pageInterne({
    titre,
    corps: html`<h1>${titre}</h1>
      ${section("Dépendances", a.liste.length === 0 ? vide("Aucune automatisation proposée.") : brut(schemaSvg(a.liste)))}
      ${section("Maquette de tableau de bord", maquetteTableauDeBord(a.liste))} ${formulesHtml(a)}
      ${section("Comment avancer", commentAvancer(a.liste))}`,
  });
}
