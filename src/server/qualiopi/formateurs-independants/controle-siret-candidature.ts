/**
 * V1-A-1 — le SIRET déclaré AU FORMULAIRE de candidature, contrôlé au registre avant
 * l'invitation (F1 / F55).
 *
 * Une candidature ne porte pas de fiche formateur, donc pas de contrôle du registre : le
 * SIRET n'est que dans ses réponses (`JobApplication.answers`). Ce module le lit et dit si
 * l'invitation peut partir.
 *
 * 🔴 Une absence de réponse n'est JAMAIS une conclusion (ADR 0066 (i)), mais ce n'est pas
 * non plus un feu vert : registre muet, en panne ou sans réponse sur ce SIRET → « muet »,
 * aucune invitation AUTOMATIQUE, la candidature attend avec son motif (`registre-muet`).
 *
 * Module neutre (ni `server-only`, ni Next) : le worker d'e-mails le charge.
 */

import { REPONSE_SIRET } from "@/lib/careers/formulaire-formateur-freelance";

/** `ok` : établissement ouvert · `ferme` : fermé ou cessé · `muet` : pas de réponse exploitable. */
export type VerdictSiretCandidature = "ok" | "ferme" | "muet";

export type ControleSiretCandidature = (siret: string) => Promise<VerdictSiretCandidature>;

/** Le SIRET (14 chiffres) saisi au formulaire, ou `null` : absent ou illisible. */
export function siretDuFormulaire(answers: unknown): string | null {
  if (!answers || typeof answers !== "object") return null;
  const brut = (answers as Record<string, unknown>)[REPONSE_SIRET];
  if (typeof brut !== "string") return null;
  const siret = brut.replace(/\s+/g, "");
  return /^\d{14}$/.test(siret) ? siret : null;
}

/**
 * Le balayage repasse toutes les 5 minutes sur la même candidature pendant 72 h : une
 * réponse FERME du registre (ouvert / fermé) est gardée une heure par processus, pour ne pas
 * rappeler l'API publique à chaque passage. Un « muet » n'est jamais gardé.
 */
const MEMOIRE_MS = 60 * 60_000;
const memoire = new Map<string, { verdict: "ok" | "ferme"; jusqua: number }>();

/** Pour les tests : oublie les réponses gardées. */
export function oublierControlesSiret(): void {
  memoire.clear();
}

export const controleSiretParDefaut: ControleSiretCandidature = async (siret) => {
  const gardee = memoire.get(siret);
  if (gardee && gardee.jusqua > Date.now()) return gardee.verdict;
  const { lireEtablissementParSiret } = await import("@/server/registre-entreprises/annuaire");
  const r = await lireEtablissementParSiret(siret);
  if (!r.ok) return "muet";
  const verdict = r.entreprise.active ? "ok" : "ferme";
  memoire.set(siret, { verdict, jusqua: Date.now() + MEMOIRE_MS });
  return verdict;
};

/**
 * Le motif qui retient l'invitation d'une candidature à ce SIRET, ou `null` : elle peut
 * partir. Ne lève jamais : une panne vaut « muet ».
 */
export async function motifRegistreSiret(
  siret: string | null,
  controle: ControleSiretCandidature = controleSiretParDefaut,
): Promise<"siret-ferme" | "registre-muet" | null> {
  if (siret === null) return null;
  let verdict: VerdictSiretCandidature;
  try {
    verdict = await controle(siret);
  } catch {
    verdict = "muet";
  }
  if (verdict === "ferme") return "siret-ferme";
  return verdict === "ok" ? null : "registre-muet";
}
