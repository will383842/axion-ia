/**
 * C2b — mise en forme du rapport (Markdown, français). Module PUR.
 * Le rapport ne propose AUCUNE action automatique : il liste, un humain décide page par page.
 */
import type { CodeSignalement, ResultatAudit } from "./analyser";

const TITRES: Record<CodeSignalement, string> = {
  faible_valeur: "Faible valeur (contenu très court)",
  sans_impression: "Aucune impression dans Search Console",
  doublon_plan: "Doublons de plan",
  ville_quasi_identique: "Pages villes quasi identiques",
};

export const MAX_LIGNES_PAR_SECTION = 200;

export function formaterRapport(r: ResultatAudit, maintenant: Date): string {
  const l: string[] = [];
  l.push(`# Audit du corpus publié (C2b) — ${maintenant.toISOString().slice(0, 10)}`);
  l.push("");
  l.push(
    "**Lecture seule.** Cet outil signale ; aucune URL n'est modifiée, retirée, fusionnée ni passée en noindex. " +
      "Un humain décide page par page : améliorer, fusionner (avec redirection décidée à la main) ou retirer.",
  );
  l.push("");
  l.push(`Pages examinées : ${r.total}. Signalements : ${r.signalements.length}.`);
  const d = r.donneesIndisponibles;
  l.push(
    `Données indisponibles (jamais lues comme zéro) : mots ${d.mots}, impressions ${d.impressions}, date de publication ${d.publieLe}.`,
  );
  if (r.signalements.length === 0) {
    l.push("", "Aucun signalement.");
    return l.join("\n") + "\n";
  }
  for (const code of Object.keys(TITRES) as CodeSignalement[]) {
    const lignes = r.signalements.filter((s) => s.code === code);
    if (lignes.length === 0) continue;
    l.push("", `## ${TITRES[code]} (${lignes.length})`, "");
    for (const s of lignes.slice(0, MAX_LIGNES_PAR_SECTION)) {
      const liees = s.liees.length > 0 ? ` — voir aussi : ${s.liees.join(", ")}` : "";
      l.push(`- ${s.url} : ${s.motif}${liees}`);
    }
    if (lignes.length > MAX_LIGNES_PAR_SECTION) {
      l.push(`- … et ${lignes.length - MAX_LIGNES_PAR_SECTION} autres non listées.`);
    }
  }
  return l.join("\n") + "\n";
}
