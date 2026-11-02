/**
 * Base d'audit en Markdown / JSON (2026-11-02) — modules PURS. Documents INTERNES : complets,
 * avec contradictions, doutes, fiches par personne et annexe intégrale. Ne jamais les remettre
 * au client (voir `filtre-client.ts` pour la vue client).
 */

import type { BaseAudit, Element, Source } from "../base-audit-schema";
import { SECTIONS_ANALYSE } from "../base-audit-schema";
import { ficheEnMarkdown } from "./fiche-personne-markdown";

const TITRES_SECTIONS: Record<(typeof SECTIONS_ANALYSE)[number], string> = {
  identite: "Identité",
  activite_offre: "Activité et offre",
  organisation_equipe: "Organisation et équipe",
  processus: "Processus",
  outils_systeme_information: "Outils et système d'information",
  donnees: "Données",
  commercial_clients: "Commercial et clients",
  finances: "Finances",
  marche_concurrence: "Marché et concurrence",
  presence_numerique: "Présence numérique",
  reputation: "Réputation",
  reglementaire: "Réglementaire",
  maturite_ia: "Maturité IA",
};

const LIBELLE_CONFIANCE = {
  etabli: "établi",
  probable: "probable",
  hypothese: "hypothèse",
} as const;
const LIBELLE_PROVENANCE = { declare: "déclaré", trouve: "trouvé", croise: "croisé" } as const;

function source(s: Source): string {
  const qui = s.personne ? ` (${s.personne})` : "";
  const lien = s.url ? ` — ${s.url}` : "";
  return `${s.type} : ${s.reference}${qui}${lien}`;
}

function citation(t: string): string {
  return t
    .trim()
    .split(/\r?\n/)
    .map((l) => `> ${l}`)
    .join("\n");
}

function element(e: Element): string {
  return [
    `- **${e.libelle}** : ${e.valeur}`,
    `  - ${LIBELLE_PROVENANCE[e.provenance]} · confiance ${LIBELLE_CONFIANCE[e.confiance]}`,
    ...e.sources.map((s) => `  - source — ${source(s)}`),
  ].join("\n");
}

function euros(n: number | null): string {
  return n === null ? "—" : `${Math.round(n).toLocaleString("fr-FR")} €`;
}

/** Rendu lisible COMPLET de la base d'audit. */
export function baseEnMarkdown(base: BaseAudit): string {
  const o: string[] = [];
  const m = base.meta;
  o.push(`# Base d'audit — ${m.raisonSociale}`, "");
  o.push(
    `Document INTERNE. Généré le ${m.genereLe} par ${m.generePar}. Version ${base.version}.`,
    "",
  );
  o.push(m.complet ? "Rapport complet." : "⚠️ Rapport INCOMPLET.", "");
  for (const l of m.limites) o.push(`- Limite : ${l}`);
  if (m.limites.length > 0) o.push("");
  o.push(
    `Partie « direction » remplie par un dirigeant : **${m.reponseDirection.fournieParUnDirigeant}** ` +
      `(répondant : ${m.reponseDirection.repondant}).`,
  );
  if (m.reponseDirection.remarque) o.push("", m.reponseDirection.remarque);
  o.push("");

  o.push("## 1. Ce que le client nous a dit (besoins déclarés)", "");
  if (base.besoins_declares.length === 0) o.push("_Aucun besoin déclaré._", "");
  for (const b of base.besoins_declares) {
    o.push(
      `### ${b.id} — ${b.enonce}`,
      "",
      `Catégorie : ${b.categorie} · intensité : ${b.intensite} · ${b.nbPersonnes} personne(s)`,
      "",
    );
    for (const c of b.citations) o.push(citation(c.texte), `> — ${c.auteur}`, "");
    if (b.divergence) o.push(`**Divergence direction / équipes :** ${b.divergence}`, "");
  }

  o.push("## 2. Équipe d'analyse", "");
  if (base.equipe_analyse.length === 0) o.push("_Aucune._", "");
  for (const e of base.equipe_analyse) {
    o.push(`- **${e.role}** (${e.modele}) : ${e.mission}`);
    for (const q of e.questionsDeRecherche) o.push(`  - ${q}`);
  }
  if (base.equipe_analyse.length > 0) o.push("");

  o.push("## 3. Analyse par section", "");
  for (const cle of SECTIONS_ANALYSE) {
    const s = base[cle];
    o.push(`### ${TITRES_SECTIONS[cle]}`, "");
    if (s.resume) o.push(s.resume, "");
    if (s.elements.length === 0) o.push("_Aucun élément._", "");
    for (const e of s.elements) o.push(element(e));
    if (s.elements.length > 0) o.push("");
  }

  const ev = base.evolution_financiere;
  o.push("## 4. Évolution du chiffre d'affaires", "");
  o.push(
    `Tendance : **${ev.tendance}**` +
      (ev.tauxAnnuelMoyenPct === null ? "" : ` (${ev.tauxAnnuelMoyenPct} % par an en moyenne)`),
    "",
  );
  if (ev.lecture) o.push(ev.lecture, "");
  if (ev.exercices.length > 0) {
    o.push(
      "| Année | Chiffre d'affaires | Résultat net | Effectif | Confiance |",
      "|---|---|---|---|---|",
    );
    for (const x of [...ev.exercices].sort((a, b) => a.annee - b.annee)) {
      o.push(
        `| ${x.annee} | ${euros(x.chiffreAffairesEur)} | ${euros(x.resultatNetEur)} | ${x.effectif ?? "—"} | ${LIBELLE_CONFIANCE[x.confiance]} |`,
      );
    }
    o.push("");
    for (const x of ev.exercices) for (const s of x.sources) o.push(`- ${x.annee} — ${source(s)}`);
    o.push("");
  }
  for (const l of ev.limites) o.push(`- Limite : ${l}`);
  if (ev.limites.length > 0) o.push("");

  o.push("## 5. Pistes", "");
  const retenues = base.pistes
    .filter((p) => !p.horsDemande)
    .sort((a, b) => (a.rang ?? 0) - (b.rang ?? 0));
  const hors = base.pistes.filter((p) => p.horsDemande);
  if (base.pistes.length === 0) o.push("_Aucune piste._", "");
  for (const p of retenues) {
    o.push(
      `### ${p.rang}. ${p.id} — ${p.titre}`,
      "",
      p.description,
      "",
      `Sert : ${p.besoinsServis.join(", ")} · gain ${p.gain} · effort ${p.effort}`,
      "",
    );
    for (const s of p.sources) o.push(`- source — ${source(s)}`);
    if (p.sources.length > 0) o.push("");
  }
  if (hors.length > 0) {
    o.push("### Pistes hors demande (sans priorité)", "");
    for (const p of hors) {
      o.push(`- **${p.id} — ${p.titre}** : ${p.description} (gain ${p.gain}, effort ${p.effort})`);
    }
    o.push("");
  }

  o.push("## 6. Contradictions", "");
  if (base.contradictions.length === 0) o.push("_Aucune._", "");
  for (const c of base.contradictions) {
    o.push(`### ${c.sujet}`, "", `- Version A : ${c.versionA}`, `- Version B : ${c.versionB}`);
    for (const s of c.sources) o.push(`- source — ${source(s)}`);
    o.push("");
  }

  o.push("## 7. Questions du jour J", "");
  if (base.questions_jour_j.length === 0) o.push("_Aucune._", "");
  for (const q of base.questions_jour_j) {
    o.push(
      `- ${q.question}${q.besoinId ? ` [${q.besoinId}]` : ""}`,
      `  - Pourquoi : ${q.pourquoi}`,
    );
  }
  o.push("");

  o.push("## 8. Propositions de mise à jour de la fiche client", "");
  if (base.propositions_fiche.length === 0) o.push("_Aucune._", "");
  for (const p of base.propositions_fiche) {
    o.push(
      `- **${p.champ}** → ${p.valeur} (${LIBELLE_CONFIANCE[p.confiance]}, ${p.application === "auto" ? "automatique" : "à cocher"})`,
    );
    for (const s of p.sources) o.push(`  - source — ${source(s)}`);
  }
  o.push("");

  const c = base.couverture;
  o.push("## 9. Couverture", "");
  o.push(
    `- Personnes ayant répondu : ${c.personnesAvecReponse}`,
    `- Réponses données : ${c.reponsesDonnees}`,
    `- Questions sans réponse : ${c.questionsSansReponse}`,
    `- Personnes attendues sans réponse : ${c.personnesAttenduesSansReponse.join(", ") || "aucune"}`,
  );
  for (const a of c.alertes) o.push(`- Alerte (${a.niveau}) : ${a.texte}`);
  o.push("");

  o.push("## 10. Fiches par personne", "");
  if (base.fiches_personnes.length === 0) o.push("_Aucune fiche._", "");
  for (const f of base.fiches_personnes) o.push(ficheEnMarkdown(f, 3), "");

  o.push("## 11. Annexe — toutes les réponses", "");
  if (base.annexe_reponses.length === 0) o.push("_Aucune réponse reçue._", "");
  for (const a of base.annexe_reponses) {
    o.push(
      `### ${a.personne} (${a.mode}${a.service ? `, ${a.service}` : ""})`,
      "",
      `Statut : ${a.statut} · versions reçues : ${a.versionsRecues} · reçu le ${a.recuLe}` +
        (a.aVerifier ? " · **à vérifier**" : ""),
      "",
    );
    for (const r of a.reponses) {
      o.push(
        `- **${r.question}**${r.rubrique ? ` _(${r.rubrique})_` : ""}${r.prefill ? ` [pré-rempli : ${r.prefill}]` : ""}`,
        citation(r.reponse),
      );
    }
    if (a.nonRepondues.length > 0) {
      o.push("", "Sans réponse :");
      for (const q of a.nonRepondues) {
        o.push(
          `- ${q.question}${q.rubrique ? ` _(${q.rubrique})_` : ""}${q.essentielle ? " — essentielle" : ""}`,
        );
      }
    }
    o.push("");
  }

  o.push("## 12. Sources", "");
  if (base.sources.length === 0) o.push("_Aucune._", "");
  for (const s of base.sources) o.push(`- ${source(s)}`);
  o.push("");

  return o.join("\n");
}

/** JSON indenté de la base, tel quel. */
export function baseEnJson(base: BaseAudit): string {
  return JSON.stringify(base, null, 2);
}
