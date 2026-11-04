/**
 * Synthèse INTERNE (HTML) — réponses, difficultés, logiciels. PUR, valable pour `base-audit/1` et
 * `base-audit/2`. Ordre : en-tête, besoins déclarés, difficultés personne par personne, freins /
 * attentes / budget / formation, logiciels, limites. Jamais transmise au client.
 */

import type { BaseAudit, FichePersonne, RubriqueInterne } from "../../base-audit-schema";

import { citation, etiquette, liste, normaliser, section, vide } from "./composants";
import { html, pageInterne, type Brut } from "./echapper";

export const NON_EXTRAIT_V1 =
  "Non extrait dans cette version de la base : relancer l'analyse pour obtenir les freins, les attentes, le budget et la formation.";

const LIBELLE_CATEGORIE: Record<string, string> = {
  douleur: "Difficulté",
  souhait: "Souhait",
  objectif: "Objectif",
  contrainte: "Contrainte",
  priorite: "Priorité",
};

const LIBELLE_INTENSITE: Record<string, string> = {
  faible: "faible",
  moyen: "moyenne",
  fort: "forte",
};

const LIBELLE_DIRIGEANT: Record<string, string> = {
  oui: "un dirigeant",
  non: "une personne qui n'est pas dirigeante",
  inconnu: "une personne dont on ne sait pas si elle est dirigeante",
};

function nomDeFiche(f: FichePersonne): string {
  const { nom, fonction, service } = f.identite;
  const base =
    nom ?? fonction ?? (f.personne.startsWith("attendu:") ? f.personne.slice(8) : f.personne);
  const precision = [nom !== null ? fonction : null, service].filter((x): x is string => !!x);
  return precision.length > 0 ? `${base} (${precision.join(", ")})` : base;
}

// ── (1) En-tête ──────────────────────────────────────────────────────────────

function enTete(b: BaseAudit): Brut {
  const d = b.meta.reponseDirection;
  const attendus = b.couverture.personnesAttenduesSansReponse;
  return html` <h1>Synthèse interne — ${b.meta.raisonSociale}</h1>
    <p class="discret">Base d'audit ${b.version}, générée le ${b.meta.genereLe}.</p>
    <div class="carte">
      <p>
        <strong>Répondants :</strong> ${b.couverture.personnesAvecReponse} personne(s) ont répondu
        (${b.couverture.reponsesDonnees} réponses données, ${b.couverture.questionsSansReponse}
        questions restées vides).
      </p>
      <p>
        <strong>Partie direction remplie par :</strong> ${d.repondant} —
        ${LIBELLE_DIRIGEANT[d.fournieParUnDirigeant] ?? "inconnu"}.
        ${d.remarque !== "" ? d.remarque : ""}
      </p>
      <p>
        <strong>Attendus sans réponse :</strong> ${
          attendus.length === 0 ? "aucun" : attendus.join(", ")
        }.
      </p>
    </div>`;
}

// ── (2) Besoins déclarés ─────────────────────────────────────────────────────

function besoins(b: BaseAudit): Brut {
  if (b.besoins_declares.length === 0) return vide("Aucun besoin déclaré dans les réponses.");
  return html`${b.besoins_declares.map(
    (x) =>
      html`<div class="carte">
        <h3>${x.id} — ${x.enonce}</h3>
        <p>
          ${etiquette(LIBELLE_CATEGORIE[x.categorie] ?? x.categorie)}
          ${etiquette(`${x.nbPersonnes} personne(s)`)}
          ${etiquette(`intensité ${LIBELLE_INTENSITE[x.intensite] ?? x.intensite}`, x.intensite === "fort")}
        </p>
        ${x.citations.map((c) => citation(c.texte, c.auteur))}
        ${x.divergence !== undefined ? html`<p class="alerte"><strong>Divergence :</strong> ${x.divergence}</p>` : ""}
      </div>`,
  )}`;
}

// ── (3) Difficultés personne par personne ───────────────────────────────────

function personne(b: BaseAudit, f: FichePersonne): Brut {
  const annexe = b.annexe_reponses.find((a) => a.personne === f.personne);
  const questionsSurPlace = f.aVerifierSurPlace.map(
    (q) => html`${q.question} <span class="discret">(${q.pourquoi})</span>`,
  );
  if (f.statut === "n_a_pas_repondu") {
    return html`<div class="carte">
      <h3>${nomDeFiche(f)}</h3>
      <p class="alerte"><strong>N'a pas répondu.</strong> Rien n'est supposé à sa place.</p>
      <h4>Questions à lui poser sur place</h4>
      ${liste(questionsSurPlace)}
    </div>`;
  }
  // « Non répondu » : les questions du parcours restées vides, les essentielles d'abord.
  const vides = [...(annexe?.nonRepondues ?? [])].sort(
    (p, q) => Number(q.essentielle) - Number(p.essentielle),
  );
  return html`<div class="carte">
    <h3>${nomDeFiche(f)}</h3>
    <h4>Difficultés</h4>
    ${
      f.douleurs.length === 0
        ? vide("Aucune difficulté relevée.")
        : f.douleurs.map(
            (d) =>
              html`<p>
                  <strong>${d.enonce}</strong>${
                    d.tempsParSemaine !== null
                      ? html` ${etiquette(`temps : ${d.tempsParSemaine} par semaine`)}`
                      : ""
                  }
                </p>
                ${citation(d.citation)}`,
          )
    }
    <h4>Demandes</h4>
    ${
      f.demandes.length === 0
        ? vide("Aucune demande relevée.")
        : f.demandes.map(
            (d) =>
              html`<p><strong>${d.enonce}</strong></p>
                ${citation(d.citation)}`,
          )
    }
    <h4>Tâches</h4>
    ${
      f.taches.length === 0
        ? vide("Aucune tâche décrite.")
        : html`<table>
            <thead>
              <tr>
                <th>Tâche</th>
                <th>Fréquence</th>
                <th>Durée</th>
                <th>Répétitive</th>
                <th>Ressaisie</th>
                <th>Outil</th>
              </tr>
            </thead>
            <tbody>
              ${f.taches.map(
                (t) =>
                  html`<tr>
                    <td>${t.libelle}</td>
                    <td>${t.frequence ?? "—"}</td>
                    <td>${t.duree ?? "—"}</td>
                    <td>${oui(t.repetitive)}</td>
                    <td>${oui(t.ressaisie)}</td>
                    <td>${t.outil ?? "—"}</td>
                  </tr>`,
              )}
            </tbody>
          </table>`
    }
    <h4>Réserves</h4>
    ${
      f.reserves.length === 0
        ? vide("Aucune réserve exprimée.")
        : f.reserves.map(
            (r) =>
              html`<p><strong>${r.enonce}</strong></p>
                ${citation(r.citation)}`,
          )
    }
    <h4>Non répondu</h4>
    ${
      vides.length === 0
        ? vide("Toutes les questions du parcours ont une réponse.")
        : liste(
            vides.map(
              (q) => html`${q.essentielle ? etiquette("essentielle", true) : ""} ${q.question}`,
            ),
          )
    }
    ${
      f.aVerifierSurPlace.length > 0
        ? html`<h4>À vérifier sur place</h4>
            ${liste(questionsSurPlace)}`
        : ""
    }
  </div>`;
}

const oui = (v: boolean | null): string => (v === null ? "?" : v ? "oui" : "non");

function difficultes(b: BaseAudit): Brut {
  if (b.fiches_personnes.length === 0) return vide("Aucune fiche individuelle dans cette base.");
  return html`${b.fiches_personnes.map((f) => personne(b, f))}`;
}

// ── (4) Freins, attentes, budget, formation ─────────────────────────────────

/** Trois états, trois libellés : « ne sait pas » et « non répondu » ne sont JAMAIS un « non ». */
export function rubrique(nom: string, r: RubriqueInterne): Brut {
  let corps: Brut;
  if (r.etat === "non_repondu") {
    corps = vide("Non répondu : aucune réponse reçue sur ce point.");
  } else if (r.etat === "ne_sait_pas") {
    corps = vide("Réponse reçue : la personne ne sait pas.");
  } else {
    corps =
      r.elements.length === 0
        ? vide("Déclaré, sans détail.")
        : html`${r.elements.map(
            (e) =>
              html`<p><strong>${e.enonce}</strong></p>
                ${e.citations.map((c) => citation(c.texte, c.auteur))}`,
          )}`;
  }
  return html`<div class="carte">
    <h3>${nom}</h3>
    ${corps}
  </div>`;
}

function contexte(b: BaseAudit): Brut {
  const c = b.contexte_interne;
  if (c === undefined || c === null) {
    return html`<p class="alerte">${NON_EXTRAIT_V1}</p>`;
  }
  return html`${rubrique("Freins", c.freins)}${rubrique("Attentes", c.attentes)}${rubrique("Budget", c.budget)}${rubrique("Formation", c.formation)}`;
}

// ── (5) Logiciels ───────────────────────────────────────────────────────────

function decouper(outil: string): string[] {
  return outil
    .split(/[,;]/)
    .map((x) => x.trim())
    .filter((x) => x !== "");
}

/** Les logiciels d'une fiche : `outils` + `taches[].outil`, sans doublon (casse et accents ignorés). */
function outilsDeFiche(f: FichePersonne): string[] {
  const vus = new Map<string, string>();
  for (const o of [...f.outils, ...f.taches.flatMap((t) => (t.outil === null ? [] : [t.outil]))]) {
    for (const nom of decouper(o)) if (!vus.has(normaliser(nom))) vus.set(normaliser(nom), nom);
  }
  return [...vus.values()];
}

export interface LogicielGeneral {
  readonly nom: string;
  /** Usages tirés des tâches (libellés), sans dire qui. */
  readonly usages: ReadonlyArray<string>;
}

export function logicielsGeneraux(fiches: ReadonlyArray<FichePersonne>): LogicielGeneral[] {
  const noms = new Map<string, { nom: string; usages: Map<string, string> }>();
  const ligne = (nom: string) => {
    const k = normaliser(nom);
    let l = noms.get(k);
    if (l === undefined) noms.set(k, (l = { nom, usages: new Map() }));
    return l;
  };
  for (const f of fiches) {
    for (const o of f.outils) for (const n of decouper(o)) ligne(n);
    for (const t of f.taches) {
      if (t.outil === null) continue;
      for (const n of decouper(t.outil)) {
        const l = ligne(n);
        if (!l.usages.has(normaliser(t.libelle))) l.usages.set(normaliser(t.libelle), t.libelle);
      }
    }
  }
  return [...noms.values()]
    .map((l) => ({ nom: l.nom, usages: [...l.usages.values()] }))
    .sort((a, b) => normaliser(a.nom).localeCompare(normaliser(b.nom), "fr"));
}

function logiciels(b: BaseAudit): Brut {
  if (b.fiches_personnes.length === 0) return vide("Aucun logiciel relevé.");
  const postes = b.fiches_personnes.map((f) => ({
    poste: f.identite.fonction ?? "Poste non précisé",
    outils: outilsDeFiche(f),
  }));
  const generaux = logicielsGeneraux(b.fiches_personnes);
  return html`<h3>Par poste</h3>
    <table>
      <thead>
        <tr>
          <th>Poste</th>
          <th>Logiciels</th>
        </tr>
      </thead>
      <tbody>
        ${postes.map(
          (p) =>
            html`<tr>
              <td>${p.poste}</td>
              <td>${p.outils.length === 0 ? "Aucun relevé" : p.outils.join(", ")}</td>
            </tr>`,
        )}
      </tbody>
    </table>
    <h3>Liste générale</h3>
    ${
      generaux.length === 0
        ? vide("Aucun logiciel relevé.")
        : html`<table>
            <thead>
              <tr>
                <th>Logiciel</th>
                <th>Usage</th>
              </tr>
            </thead>
            <tbody>
              ${generaux.map(
                (l) =>
                  html`<tr>
                    <td>${l.nom}</td>
                    <td>${l.usages.length === 0 ? "Usage non précisé" : l.usages.join(" ; ")}</td>
                  </tr>`,
              )}
            </tbody>
          </table>`
    }`;
}

// ── (6) Limites et alertes ──────────────────────────────────────────────────

function limites(b: BaseAudit): Brut {
  const alertes = b.couverture.alertes.map(
    (a) => html`${etiquette(a.niveau, a.niveau !== "info")} ${a.texte}`,
  );
  const lim = b.meta.limites.map((l) => html`${l}`);
  if (alertes.length + lim.length === 0 && b.meta.complet) return vide("Aucune limite signalée.");
  return html`${b.meta.complet ? "" : html`<p class="alerte">Le rapport s'est arrêté avant la fin : il est incomplet.</p>`}
  ${liste(lim)}${liste(alertes)}`;
}

export function syntheseHtml(base: BaseAudit): string {
  const corps = html`${enTete(base)} ${section("Besoins déclarés", besoins(base))}
  ${section("Difficultés, personne par personne", difficultes(base))}
  ${section("Freins, attentes, budget, formation", contexte(base))}
  ${section("Logiciels", logiciels(base))} ${section("Limites et alertes", limites(base))}`;
  return pageInterne({ titre: `Synthèse interne — ${base.meta.raisonSociale}`, corps });
}
