/**
 * 🔴 CHANTIER QNC, LOT L11 — LES TROIS BLOCS DU DOSSIER DE SESSION.
 *
 *   · MOYENS — l'état des moyens pédagogiques de l'organisme pendant la
 *     session, et leur historique motivé (`moyens_pedagogiques_historique`,
 *     ajout seul) jusqu'à la fin de la session ;
 *   · RÉCLAMATIONS — celles des inscrits de la session (rattachées par
 *     l'INSCRIPTION, jamais par une seconde clé) et chaque étape de leur
 *     traitement (`reclamation_etapes`, ajout seul) ;
 *   · ADAPTATION — donnée de SANTÉ : lisible du seul référent handicap. Le
 *     détail déclaré n'entre jamais ici ; le référent lit le besoin déclaré et
 *     la mesure, par la même fonction que l'indicateur 10 du ZIP
 *     (`sectionIndicateur10`) ; tout autre lecteur lit une mention de réserve.
 *
 * Les lignes produites ici sont celles de l'écran ET du ZIP (`rendu.ts`).
 * Dates en heure de Paris. Module PUR.
 */

import { dateHeureParis, dateParis } from "@/server/qualiopi/sessions/verrou-dossier-pur";
import type { BlocDossier } from "./rendu";

// ── Moyens ───────────────────────────────────────────────────────────────────

export interface EntreeHistoriqueMoyen {
  readonly creeLe: Date;
  readonly motif: string;
  readonly auteurNom: string;
  readonly avant: unknown;
  readonly apres: unknown;
}

export interface MoyenPourDossier {
  readonly libelle: string;
  readonly categorie: string;
  readonly actif: boolean;
  readonly dateVerification: Date | null;
  /** Historique déjà borné à la fin de la session, dans n'importe quel ordre. */
  readonly historique: readonly EntreeHistoriqueMoyen[];
}

function lisible(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

/** « champ : avant → après » pour chaque champ qui a changé. */
export function differences(avant: unknown, apres: unknown): string[] {
  const a = typeof avant === "object" && avant !== null ? (avant as Record<string, unknown>) : {};
  const b = typeof apres === "object" && apres !== null ? (apres as Record<string, unknown>) : {};
  const champs = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  return champs
    .filter((c) => JSON.stringify(a[c]) !== JSON.stringify(b[c]))
    .map((c) => `${c} : ${lisible(a[c])} → ${lisible(b[c])}`);
}

export function blocMoyens(moyens: readonly MoyenPourDossier[]): BlocDossier {
  const lignes: string[] = [
    "Moyens pédagogiques de l'organisme pendant la session, et leur historique jusqu'à la fin de la session.",
  ];
  if (moyens.length === 0) {
    lignes.push("Aucun moyen pédagogique inventorié à la date de la session.");
  }
  for (const m of moyens) {
    lignes.push(
      `${m.libelle} (${m.categorie})${m.actif ? "" : " — retiré depuis"} — ${
        m.dateVerification === null
          ? "jamais vérifié"
          : `vérifié le ${dateParis(m.dateVerification)}`
      }`,
    );
    const historique = [...m.historique].sort((x, y) => x.creeLe.getTime() - y.creeLe.getTime());
    for (const h of historique) {
      const diff = differences(h.avant, h.apres);
      lignes.push(
        `  ${dateHeureParis(h.creeLe)} — ${h.auteurNom} — motif : ${h.motif}${
          diff.length > 0 ? ` — ${diff.join(" ; ")}` : ""
        }`,
      );
    }
  }
  return { id: "moyens", titre: "Moyens pédagogiques", lignes };
}

// ── Réclamations ─────────────────────────────────────────────────────────────

export interface EtapeReclamationPourDossier {
  readonly etape: string;
  readonly contenu: string;
  readonly auteurNom: string;
  readonly creeLe: Date;
}

export interface ReclamationPourDossier {
  readonly numero: string;
  readonly source: string;
  readonly objet: string;
  readonly statut: string;
  readonly dateReception: Date;
  readonly dateReponse: Date | null;
  readonly reponse: string | null;
  readonly actionsCorrectives: string | null;
  /** Inscription du banc d'essai : montrée, hors chiffres réels. */
  readonly essai: boolean;
  readonly etapes: readonly EtapeReclamationPourDossier[];
}

const LIBELLE_ETAPE: Readonly<Record<string, string>> = {
  reception: "réception",
  accuse: "accusé de réception",
  analyse: "analyse",
  reponse: "réponse",
  reexamen: "réexamen",
  cloture: "clôture",
};

export function blocReclamations(reclamations: readonly ReclamationPourDossier[]): BlocDossier {
  const reelles = reclamations.filter((r) => !r.essai).length;
  const lignes: string[] = [
    reclamations.length === 0
      ? "Aucune réclamation rattachée à une inscription de cette session."
      : `${reelles} réclamation${reelles > 1 ? "s" : ""} rattachée${reelles > 1 ? "s" : ""} aux inscriptions de cette session${
          reclamations.length > reelles
            ? ` (et ${reclamations.length - reelles} du banc d'essai, hors chiffres réels)`
            : ""
        }.`,
  ];
  const triees = [...reclamations].sort(
    (a, b) => a.dateReception.getTime() - b.dateReception.getTime(),
  );
  for (const r of triees) {
    lignes.push(
      `${r.numero} — reçue le ${dateHeureParis(r.dateReception)} — source : ${r.source} — statut : ${r.statut}${
        r.essai ? " [banc d'essai — hors chiffres réels]" : ""
      }`,
      `  Objet : ${r.objet}`,
    );
    if (r.reponse !== null && r.reponse.trim() !== "") {
      lignes.push(
        `  Réponse${r.dateReponse !== null ? ` du ${dateHeureParis(r.dateReponse)}` : ""} : ${r.reponse.trim()}`,
      );
    }
    if (r.actionsCorrectives !== null && r.actionsCorrectives.trim() !== "") {
      lignes.push(`  Actions correctives : ${r.actionsCorrectives.trim()}`);
    }
    const etapes = [...r.etapes].sort((x, y) => x.creeLe.getTime() - y.creeLe.getTime());
    if (etapes.length === 0) {
      lignes.push("  Étapes du traitement : aucune étape inscrite au registre en ajout seul.");
    }
    for (const e of etapes) {
      lignes.push(
        `  ${dateHeureParis(e.creeLe)} — ${LIBELLE_ETAPE[e.etape] ?? e.etape} — ${e.auteurNom}${
          e.contenu.trim() !== "" ? ` — ${e.contenu.trim()}` : ""
        }`,
      );
    }
  }
  return { id: "reclamations", titre: "Réclamations", lignes };
}

// ── Adaptation ───────────────────────────────────────────────────────────────

export const MENTION_RESERVE_REFERENT =
  "Donnée de santé (RGPD art. 9) : ce bloc n'est lisible que par le référent handicap. Il n'est ni affiché ni exporté pour un autre lecteur.";

/**
 * Le référent handicap, dans cette console : le super-administrateur — la
 * même porte que la révélation du besoin déclaré (`lireBesoinAdaptationAction`).
 */
export function lecteurEstReferentHandicap(role: string | null): boolean {
  return role === "super_admin";
}

export function blocAdaptation(entree: {
  readonly referent: boolean;
  /** Les lignes de `sectionIndicateur10` — calculées seulement pour le référent. */
  readonly lignesIndicateur10: readonly string[] | null;
}): BlocDossier {
  const lignes =
    entree.referent && entree.lignesIndicateur10 !== null
      ? [...entree.lignesIndicateur10]
      : [MENTION_RESERVE_REFERENT];
  return { id: "adaptation", titre: "Adaptation (indicateur 10)", lignes };
}
