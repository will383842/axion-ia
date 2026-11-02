/**
 * Fiche imprimable d'UNE personne pour l'entretien d'audit (2026-11-02) — module PUR.
 *
 * Document INTERNE : il nomme la personne et cite ses mots. Il ne sort jamais vers le client.
 */

import type { FichePersonne } from "../base-audit-schema";

function citation(t: string): string {
  return t
    .trim()
    .split(/\r?\n/)
    .map((l) => `> ${l}`)
    .join("\n");
}

/** Le nom lisible : jamais une clé technique (`attendu:`, `emp:`). */
function nomAffiche(f: FichePersonne): string {
  if (f.identite.nom?.trim()) return f.identite.nom.trim();
  if (f.personne.startsWith("attendu:")) {
    const nom = f.personne.slice("attendu:".length).trim();
    if (nom) return nom;
  }
  if (f.personne.startsWith("emp:")) return "Personne sans nom";
  return f.personne;
}

/**
 * @param niveauTitre niveau du titre principal (1 = « # »). Mettre 3 pour l'inclure dans un
 *   document plus large.
 */
export function ficheEnMarkdown(f: FichePersonne, niveauTitre = 1): string {
  const h = (n: number) => "#".repeat(Math.min(6, niveauTitre + n));
  const o: string[] = [];
  const id = f.identite;
  o.push(`${h(0)} Fiche d'entretien — ${nomAffiche(f)}`, "");
  o.push(
    `- Fonction : ${id.fonction ?? "non renseignée"}`,
    `- Service : ${id.service ?? "non renseigné"}`,
    "",
  );

  if (f.statut === "n_a_pas_repondu") {
    o.push(
      "> **Cette personne n'a pas répondu au questionnaire.** Rien n'est supposé à sa place.",
      "",
    );
  }

  const section = (titre: string, vide: string, lignes: string[]) => {
    o.push(`${h(1)} ${titre}`, "");
    if (lignes.length === 0) o.push(`_${vide}_`, "");
    else o.push(...lignes, "");
  };

  if (f.statut === "a_repondu") {
    section(
      "Ce qu'elle demande",
      "Aucune demande exprimée.",
      f.demandes.map(
        (d) => `- ${d.enonce}${d.besoinId ? ` [${d.besoinId}]` : ""}\n${citation(d.citation)}`,
      ),
    );
    section(
      "Ce qui lui fait perdre du temps",
      "Aucune douleur exprimée.",
      f.douleurs.map(
        (d) =>
          `- ${d.enonce}${d.besoinId ? ` [${d.besoinId}]` : ""} — temps par semaine : ${d.tempsParSemaine ?? "non précisé"}\n${citation(d.citation)}`,
      ),
    );
    section(
      "Ses tâches",
      "Aucune tâche décrite.",
      f.taches.map((t) => {
        const marques = [
          t.repetitive === true ? "répétitive" : null,
          t.ressaisie === true ? "ressaisie" : null,
        ].filter((x): x is string => x !== null);
        return (
          `- ${t.libelle}` +
          ` — fréquence : ${t.frequence ?? "?"}, durée : ${t.duree ?? "?"}, outil : ${t.outil ?? "?"}` +
          (marques.length > 0 ? ` (${marques.join(", ")})` : "")
        );
      }),
    );
    section(
      "Ses outils",
      "Aucun outil cité.",
      f.outils.map((x) => `- ${x}`),
    );
    section(
      "Ses réserves",
      "Aucune réserve exprimée.",
      f.reserves.map((r) => `- ${r.enonce}\n${citation(r.citation)}`),
    );
  }

  section(
    "Questions à poser sur place",
    "Aucune.",
    f.aVerifierSurPlace.map((q) => `- [ ] ${q.question}\n  - Pourquoi : ${q.pourquoi}`),
  );
  return (
    o
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trimEnd() + "\n"
  );
}
