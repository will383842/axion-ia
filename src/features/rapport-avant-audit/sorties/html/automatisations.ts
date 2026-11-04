/**
 * Fiche des automatisations INTERNE (HTML) — PUR. Rend `null` pour une base `base-audit/1` : ce
 * document n'existe que pour une analyse lancée après la mise à jour.
 */

import type { Automatisation, BaseAudit, Automatisations } from "../../base-audit-schema";
import { VERSION_BASE_AUDIT_2 } from "../../base-audit-schema";

import { citation, etiquette, liste, section, vide } from "./composants";
import { html, pageInterne, type Brut } from "./echapper";
import { heuresParSemaine, libelleHeures, minutesParSemaine } from "./heures";

export const NOTE_NON_CHIFFRE =
  "Non chiffré ne veut pas dire aucun effet ; ce sont des maxima d'après leurs chiffres, pas des promesses";

export const LIBELLE_IMPORTANCE: Record<string, string> = {
  haute: "Haute",
  moyenne_haute: "Moyenne à haute",
  moyenne: "Moyenne",
  faible: "Faible",
};
export const LIBELLE_GROUPE: Record<string, string> = {
  sans_prerequis: "Sans prérequis",
  base_unique: "Autour de la base unique",
  a_etudier: "À étudier ensemble",
};
const LIBELLE_VENTE: Record<string, string> = {
  unique: "Vente unique",
  abonnement: "Abonnement",
  a_definir: "À définir",
};
const LIBELLE_JETONS: Record<string, string> = {
  aucun: "aucun",
  peu: "peu",
  moyen: "moyen",
  eleve: "élevé",
};
const LIBELLE_PERIODE: Record<string, string> = {
  jour: "par jour",
  semaine: "par semaine",
  mois: "par mois",
};

/** Vrai si l'automatisation est le socle, ou en dépend (directement ou non). */
export function dependDuSocle(a: Automatisation, liste_: ReadonlyArray<Automatisation>): boolean {
  const par = new Map(liste_.map((x) => [x.id, x]));
  const vus = new Set<string>();
  const marche = (x: Automatisation): boolean => {
    if (vus.has(x.id)) return false;
    vus.add(x.id);
    return x.dependDe.some((d) => {
      const p = par.get(d);
      return p !== undefined && (p.estSocle || marche(p));
    });
  };
  return marche(a);
}

/** « V1 » seulement pour le tri de boîte mail du catalogue ; tout le reste : V2 ou plus tard. */
export function libelleConsole(a: Automatisation): string {
  return a.catalogueId === "adm-tri-boite-mail" ? "V1" : "V2 ou plus tard";
}

function classement(l: Automatisations): Brut {
  const triees = [...l.liste].sort((a, b) => a.rangImportance - b.rangImportance);
  if (triees.length === 0) return vide("Aucune automatisation proposée.");
  return html`<table>
      <thead>
        <tr>
          <th>Rang</th>
          <th>Automatisation</th>
          <th>Importance</th>
          <th>Ordre de mise en place</th>
          <th>Utilité</th>
          <th>Heures</th>
        </tr>
      </thead>
      <tbody>
        ${triees.map(
          (a) =>
            html`<tr>
              <td>${a.rangImportance}</td>
              <td>${a.id} — ${a.titre}${a.citeCommePriorite ? " ★" : ""}</td>
              <td>${LIBELLE_IMPORTANCE[a.importance] ?? a.importance}</td>
              <td>${a.ordreMiseEnPlace}</td>
              <td>${a.utilite}</td>
              <td>${libelleHeures(heuresParSemaine(a.temps))}</td>
            </tr>`,
        )}
      </tbody>
    </table>
    <p class="discret">${NOTE_NON_CHIFFRE}.</p>
    <p class="discret">★ : citée par le client comme une priorité.</p>`;
}

function carte(a: Automatisation, toutes: ReadonlyArray<Automatisation>): Brut {
  const socle = a.estSocle
    ? "C'est le socle"
    : dependDuSocle(a, toutes)
      ? "Dépend du socle : oui"
      : "Dépend du socle : non";
  const titres = new Map(toutes.map((x) => [x.id, x.titre]));
  return html`<div class="carte">
    <h3>${a.id} — ${a.titre}</h3>
    <p>
      ${etiquette(`Rang ${a.rangImportance}`)}${etiquette(`Importance : ${LIBELLE_IMPORTANCE[a.importance] ?? a.importance}`, a.importance === "haute")}
      ${etiquette(`Mise en place n° ${a.ordreMiseEnPlace}`)}${etiquette(socle)}
      ${etiquette(a.source === "catalogue" ? `Catalogue (${a.catalogueId ?? ""})` : "Sur mesure")}
      ${etiquette(LIBELLE_GROUPE[a.groupe] ?? a.groupe)}
      ${a.citeCommePriorite ? etiquette("★ citée comme priorité", true) : ""}
      ${a.horsDemande ? etiquette("Hors demande", true) : ""}
    </p>
    <h4>Ce qu'elle fait</h4>
    <p>${a.ceQuElleFait}</p>
    <h4>Utilité</h4>
    <p>${a.utilite}</p>
    <h4>Douleur citée</h4>
    ${a.douleurs.length === 0 ? vide("Aucune douleur citée (hors demande).") : a.douleurs.map((d) => citation(d.texte, d.auteur))}
    <h4>Temps déclaré</h4>
    ${
      a.temps.length === 0
        ? vide("Aucun temps déclaré.")
        : html`<table>
            <thead>
              <tr>
                <th>Quoi</th>
                <th>Ce qui a été dit</th>
                <th>Fréquence</th>
                <th>Durée</th>
                <th>Heures / sem. (maximum)</th>
              </tr>
            </thead>
            <tbody>
              ${a.temps.map((t) => {
                const m = minutesParSemaine(t);
                return html`<tr>
                  <td>${t.libelle}</td>
                  <td>${t.citation}</td>
                  <td>
                    ${t.occurrences !== null ? `${t.occurrences} ${t.periode !== null ? (LIBELLE_PERIODE[t.periode] ?? "") : ""}` : "—"}
                  </td>
                  <td>
                    ${t.minutesMin === null && t.minutesMax === null ? "—" : `${t.minutesMin ?? "?"} à ${t.minutesMax ?? "?"} min`}
                  </td>
                  <td>${m === null ? "Non chiffré" : libelleHeures(heuresParSemaine([t]))}</td>
                </tr>`;
              })}
            </tbody>
          </table>`
    }
    <h4>Dépendance</h4>
    <p>
      ${a.dependDe.length === 0 ? "Aucune dépendance." : `Dépend de : ${a.dependDe.map((d) => `${d} (${titres.get(d) ?? "?"})`).join(", ")}.`}
      ${a.dependanceExpliquee}
    </p>
    <h4>Questions à poser</h4>
    ${
      a.questions.length === 0
        ? vide("Aucune question.")
        : a.questions.map(
            (q) =>
              html`<p><strong>${q.theme}</strong></p>
                ${liste(q.questions)}`,
          )
    }
    <h4>Vente, prix, jetons</h4>
    <p>
      ${LIBELLE_VENTE[a.vente] ?? a.vente}${a.venteRaison !== "" ? ` — ${a.venteRaison}` : ""}.
      <strong>Prix : à fixer par Will.</strong> Consommation d'IA (jetons) :
      ${LIBELLE_JETONS[a.jetonsIA] ?? a.jetonsIA}.
    </p>
    <p>
      <strong>Tableau de bord :</strong>
      ${a.tableauDeBord === null ? "aucun" : `${a.tableauDeBord.titre} (${a.tableauDeBord.indicateurs.join(", ")})`}.
      <strong>Console :</strong> ${libelleConsole(a)}.
    </p>
  </div>`;
}

export function formulesHtml(l: Automatisations): Brut {
  return html`${section(
    "Formules",
    l.formules.length === 0
      ? vide("Aucune formule proposée.")
      : html`${l.formules.map(
          (f) =>
            html`<div class="carte">
              <h3>${f.nom}</h3>
              <p>${f.ids.join(", ")}</p>
              ${f.remarque !== "" ? html`<p>${f.remarque}</p>` : ""}
            </div>`,
        )}`,
  )}`;
}

function questionsCommunes(l: Automatisations): Brut {
  return l.questionsCommunes.length === 0
    ? vide("Aucune question commune.")
    : html`${l.questionsCommunes.map(
        (q) =>
          html`<p><strong>${q.theme}</strong></p>
            ${liste(q.questions)}`,
      )}`;
}

function limitesBase(b: BaseAudit): Brut {
  return b.meta.limites.length === 0 ? vide("Aucune limite signalée.") : liste(b.meta.limites);
}

/** La fiche, ou `null` pour une base qui n'est pas en version 2. */
export function automatisationsHtml(base: BaseAudit): string | null {
  if (base.version !== VERSION_BASE_AUDIT_2) return null;
  const titre = `Fiche des automatisations — ${base.meta.raisonSociale}`;
  const a = base.automatisations;
  if (a === null || a === undefined) {
    return pageInterne({
      titre,
      corps: html`<h1>${titre}</h1>
        <p class="alerte">
          <strong>Fiche non produite.</strong> L'étape des automatisations n'a pas abouti pour cette
          analyse : relancer l'analyse.
        </p>
        ${section("Limites", limitesBase(base))}`,
    });
  }
  const triees = [...a.liste].sort((x, y) => x.rangImportance - y.rangImportance);
  return pageInterne({
    titre,
    corps: html`<h1>${titre}</h1>
      ${section("Classement", classement(a))}
      ${section("Une fiche par automatisation", html`${triees.map((x) => carte(x, a.liste))}`)}
      ${formulesHtml(a)} ${section("Questions communes", questionsCommunes(a))}
      ${section("Limites", limitesBase(base))}`,
  });
}
